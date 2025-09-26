import { EventEmitter } from 'node:events';
import pino from 'pino';

import { ServiceError, sanitizeErrorDetails } from './errors.js';
import { SupervisordClientWrapper } from './supervisordClientWrapper.js';

const DEFAULT_RPC_OPTIONS = {
  requestTimeoutMs: 5000,
  maxRetries: 2,
  backoffBaseMs: 100,
  backoffMaxMs: 2000,
  circuitBreakerThreshold: 3,
  circuitBreakerResetMs: 30000
};

const NOOP_METRICS = {
  onRpcSuccess: () => {},
  onRpcFailure: () => {},
  onCircuitOpen: () => {},
  onCircuitClose: () => {}
};

export class SupervisordService {
  constructor({ config, supervisordapi, logger, metrics, rpcOptions } = {}) {
    if (!config) {
      throw new Error('SupervisordService requires a config');
    }

    if (!supervisordapi) {
      throw new Error('SupervisordService requires a supervisordapi');
    }

    this.config = config;
    this.supervisordapi = supervisordapi;
    this.logger = this.#initializeLogger(logger);
    this.metrics = this.#initializeMetrics(metrics);
    this.rpcOptions = { ...DEFAULT_RPC_OPTIONS, ...(rpcOptions ?? {}) };
    this.clientCache = new Map();
  }

  async controlProcess({ hostId, processName, action }) {
    if (!hostId) {
      throw new ServiceError('Host is required', 400);
    }

    if (!action) {
      throw new ServiceError('Action is required', 400);
    }

    if (action !== 'restartAll' && !processName) {
      throw new ServiceError('Process is required', 400);
    }

    const client = this.#getClient(hostId);

    switch (action) {
      case 'stop':
        await this.#callClient(client, 'stopProcess', processName);
        break;
      case 'start':
        await this.#callClient(client, 'startProcess', processName);
        break;
      case 'restart':
        await this.#callClient(client, 'stopProcess', processName);
        await this.#callClient(client, 'startProcess', processName);
        break;
      case 'restartAll':
        await this.#callClient(client, 'stopAllProcesses', true);
        await this.#callClient(client, 'startAllProcesses', true);
        break;
      default:
        throw new ServiceError(`Unknown action: ${action}`, 400);
    }

    return {
      hostId,
      process: processName ?? null,
      action
    };
  }

  async fetchAllProcessInfo() {
    const hosts = this.config.hostCache?.getAll?.() ?? Object.values(this.config.hosts ?? {});
    const results = await Promise.all(
      hosts.map(async (host) => {
        const hostId = this.#resolveHostId(host);
        try {
          const client = this.#createClient(host);
          const data = await this.#callClient(client, 'getAllProcessInfo');
          return [hostId, { host: this.#cloneHostForResponse(host), data }];
        } catch (err) {
          const error = err instanceof ServiceError ? err : this.#wrapRpcError(err);
          return [hostId, { host: this.#cloneHostForResponse(host), error: this.#serializeError(error) }];
        }
      })
    );

    return Object.fromEntries(results);
  }

  createProcessStream({ intervalMs = 5000, signal } = {}) {
    const emitter = new EventEmitter();
    let closed = false;
    let timer;
    let previousState = new Map();

    const normalizedInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5000;

    const stop = () => {
      if (closed) {
        return;
      }
      closed = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (signal) {
        signal.removeEventListener('abort', stop);
      }
    };

    const scheduleNext = () => {
      if (closed) {
        return;
      }
      timer = setTimeout(tick, normalizedInterval);
      if (typeof timer?.unref === 'function') {
        timer.unref();
      }
    };

    const tick = async () => {
      if (closed) {
        return;
      }

      try {
        const snapshot = await this.fetchAllProcessInfo();
        if (closed) {
          return;
        }

        const nextState = toHostStateMap(snapshot);

        if (previousState.size === 0) {
          previousState = nextState;
          emitter.emit('snapshot', snapshot);
        } else {
          const diff = diffHostState(previousState, nextState);
          previousState = nextState;

          if (diff.changed.length > 0 || diff.removed.length > 0) {
            const updates = Object.fromEntries(
              diff.changed
                .map((hostId) => [hostId, snapshot?.[hostId]])
                .filter(([, entry]) => entry !== undefined)
            );

            emitter.emit('update', { updates, removed: diff.removed });
          }
        }
      } catch (err) {
        if (!closed) {
          emitter.emit('error', err);
        }
      } finally {
        scheduleNext();
      }
    };

    if (signal) {
      if (signal.aborted) {
        stop();
        return emitter;
      }

      signal.addEventListener('abort', stop);
    }

    emitter.close = stop;

    // Kick off the initial poll immediately.
    tick();

    return emitter;
  }

  async getProcessLog({ hostId, processName, type, offset = 0, length = 16384 }) {
    if (!hostId || !processName) {
      throw new ServiceError('Host and process are required', 400);
    }

    if (!type) {
      throw new ServiceError('Log type is required', 400);
    }

    const client = this.#getClient(hostId);
    const normalizedType = type.toLowerCase();

    if (normalizedType === 'clear') {
      await this.#callClient(client, 'clearProcessLogs', processName);
      return ['', 0, false];
    }

    const method = this.#resolveLogMethod(normalizedType);
    if (!method) {
      throw new ServiceError(`Unknown log type: ${type}`, 400);
    }

    let startOffset = Number(offset);
    if (!Number.isFinite(startOffset) || startOffset < 0) {
      startOffset = 0;
    }

    let windowSize = Number(length);
    if (!Number.isFinite(windowSize) || windowSize <= 0) {
      windowSize = 16384;
    }

    const fetchWindow = async (start) => {
      const data = await this.#callClient(client, method, processName, start, windowSize);
      const [logContent, nextOffset, overflow] = data;
      const expectedLength = Math.max(nextOffset - start, 0);
      const trimmedLog = expectedLength === 0 ? '' : logContent.slice(-expectedLength);
      return [trimmedLog, nextOffset, overflow];
    };

    if (startOffset === 0) {
      const [, tailOffset] = await this.#callClient(client, method, processName, 0, 0);
      startOffset = Math.max(tailOffset - windowSize, 0);
    }

    return fetchWindow(startOffset);
  }

  #initializeLogger(logger) {
    const hasRequiredMethods = (candidate) =>
      candidate && ['debug', 'info', 'warn', 'error'].every((method) => typeof candidate[method] === 'function');

    if (hasRequiredMethods(logger)) {
      return logger.child ? logger.child({ component: 'SupervisordService' }) : logger;
    }

    const base = pino({ name: 'SupervisordService' });
    return base.child({ component: 'SupervisordService' });
  }

  #initializeMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      return { ...NOOP_METRICS };
    }

    return {
      onRpcSuccess: metrics.onRpcSuccess ?? NOOP_METRICS.onRpcSuccess,
      onRpcFailure: metrics.onRpcFailure ?? NOOP_METRICS.onRpcFailure,
      onCircuitOpen: metrics.onCircuitOpen ?? NOOP_METRICS.onCircuitOpen,
      onCircuitClose: metrics.onCircuitClose ?? NOOP_METRICS.onCircuitClose
    };
  }

  #getClient(hostId) {
    const host = this.config.hostCache?.get?.(hostId) ?? this.config.hosts?.[hostId];
    if (!host) {
      throw new ServiceError(`Host not found: ${hostId}`, 404);
    }

    return this.#createClient(host);
  }

  #createClient(host) {
    const hostId = this.#resolveHostId(host);
    const signature = this.#computeConnectionSignature(hostId, host);
    const cachedEntry = this.clientCache.get(hostId);

    if (cachedEntry?.signature === signature) {
      return cachedEntry.wrapper;
    }

    if (cachedEntry) {
      this.clientCache.delete(hostId);
      this.#disposeClient(hostId, cachedEntry.wrapper);
    }

    const wrapper = this.#buildClientWrapper(hostId, host);
    this.clientCache.set(hostId, { wrapper, signature });
    return wrapper;
  }

  #buildClientWrapper(hostId, host) {
    const rawClient = this.config.supervisord?.createClient
      ? this.config.supervisord.createClient(this.supervisordapi, host)
      : this.supervisordapi.connect(host.Url);

    const clientLogger = this.logger.child
      ? this.logger.child({ hostId, hostUrl: host?.Url })
      : this.logger;

    return new SupervisordClientWrapper({
      hostId,
      hostUrl: host?.Url,
      client: rawClient,
      options: this.rpcOptions,
      logger: clientLogger,
      metrics: this.metrics,
      wrapRpcError: (error) => this.#wrapRpcError(error)
    });
  }

  #computeConnectionSignature(hostId, host) {
    const { supervisord } = this.config ?? {};
    if (supervisord && typeof supervisord.buildTarget === 'function') {
      try {
        const target = supervisord.buildTarget(host);
        if (target && typeof target === 'object') {
          return stableStringify({ target });
        }

        return stableStringify({ target: target ?? null });
      } catch (error) {
        this.logger?.warn?.(
          { hostId, error },
          'Failed to compute supervisord connection target; falling back to host fields'
        );
      }
    }

    const connectionDetails = {};

    if (host?.Url !== undefined) {
      connectionDetails.url = host.Url;
    }

    const override = host?.override?.connection;
    if (override && typeof override === 'object') {
      connectionDetails.override = Object.fromEntries(
        Object.entries(override).filter(([, value]) => value !== undefined)
      );
    }

    if (host?.socketPath !== undefined) {
      connectionDetails.socketPath = host.socketPath;
    }

    if (Object.keys(connectionDetails).length === 0) {
      return stableStringify({ hostId });
    }

    return stableStringify(connectionDetails);
  }

  #disposeClient(hostId, wrapper) {
    if (!wrapper) {
      return;
    }

    const candidates = [wrapper, wrapper.client].filter((candidate, index, self) => {
      if (!candidate || typeof candidate !== 'object') {
        return false;
      }
      return self.indexOf(candidate) === index;
    });

    const methods = ['dispose', 'close', 'destroy', 'end'];

    for (const candidate of candidates) {
      for (const method of methods) {
        if (typeof candidate[method] === 'function') {
          try {
            candidate[method]();
          } catch (error) {
            this.logger?.warn?.(
              { hostId, method, error },
              'Failed to dispose supervisord client'
            );
          }
          break;
        }
      }
    }
  }

  #resolveLogMethod(type) {
    switch (type) {
      case 'out':
        return 'tailProcessStdoutLog';
      case 'err':
        return 'tailProcessStderrLog';
      default:
        return null;
    }
  }

  async #callClient(client, method, ...args) {
    return client.call(method, ...args);
  }

  #resolveHostId(host) {
    const candidate =
      host?.idHost ??
      host?.hostId ??
      host?.id ??
      host?.Name ??
      host?.name ??
      host?.Url ??
      host?.url;

    if (!candidate) {
      this.logger.warn?.({ host }, 'Unable to determine host identifier, defaulting to anon-host');
      return 'anon-host';
    }

    return String(candidate);
  }

  #wrapRpcError(err) {
    if (err instanceof ServiceError) {
      return err;
    }

    const message = err?.faultString || err?.message || 'Supervisord RPC error';
    const metadata = this.#extractRpcErrorMetadata(err);
    const details = sanitizeErrorDetails(metadata);
    return new ServiceError(message, 502, details);
  }

  #serializeError(error) {
    if (!(error instanceof ServiceError)) {
      return { message: 'Unexpected error' };
    }

    const payload = { message: error.message };
    const sanitizedDetails = sanitizeErrorDetails(error.details);
    if (sanitizedDetails !== undefined) {
      payload.details = sanitizedDetails;
    }

    return payload;
  }

  #extractRpcErrorMetadata(err) {
    if (!err || typeof err !== 'object') {
      return undefined;
    }

    const metadata = {};
    const allowedKeys = ['name', 'code', 'errno', 'faultCode', 'faultString'];
    for (const key of allowedKeys) {
      if (err[key] !== undefined) {
        metadata[key] = err[key];
      }
    }

    if (err.data !== undefined) {
      metadata.data = err.data;
    }

    if (err.details !== undefined && metadata.details === undefined) {
      metadata.details = err.details;
    }

    return metadata;
  }

  #cloneHostForResponse(host) {
    if (!host || typeof host !== 'object') {
      return null;
    }

    const cloned = { ...host };
    delete cloned.override;

    if (typeof cloned.Url === 'string') {
      cloned.Url = this.#stripUrlCredentials(cloned.Url);
    }

    return cloned;
  }

  #stripUrlCredentials(url) {
    if (typeof url !== 'string') {
      return url;
    }

    if (!url.includes('@')) {
      return url;
    }

    try {
      const parsed = new URL(url);
      if (!parsed.username && !parsed.password) {
        return url;
      }

      parsed.username = '';
      parsed.password = '';

      const needsTrailingSlash =
        parsed.pathname === '/' && !url.replace(/^[^:]+:\/\//, '').includes('/');
      const sanitizedPath = needsTrailingSlash ? '' : parsed.pathname;

      return `${parsed.protocol}//${parsed.host}${sanitizedPath}${parsed.search}${parsed.hash}`;
    } catch {
      return url.replace(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/)(?:[^@]*@)(.+)$/, '$1$2');
    }
  }
}

function toHostStateMap(rawHosts) {
  const map = new Map();
  if (!rawHosts || typeof rawHosts !== 'object') {
    return map;
  }

  for (const [hostId, entry] of Object.entries(rawHosts)) {
    map.set(String(hostId), computeHostSignature(entry));
  }

  return map;
}

function diffHostState(previous, next) {
  const changed = [];
  const removed = [];

  for (const [hostId, signature] of next.entries()) {
    if (!previous.has(hostId) || previous.get(hostId) !== signature) {
      changed.push(hostId);
    }
  }

  for (const hostId of previous.keys()) {
    if (!next.has(hostId)) {
      removed.push(hostId);
    }
  }

  return { changed, removed };
}

function computeHostSignature(entry) {
  if (!entry || typeof entry !== 'object') {
    return 'null';
  }

  const normalized = {};

  if (entry.host !== undefined) {
    normalized.host = normalizeValue(entry.host);
  }

  if (entry.data !== undefined) {
    normalized.data = Array.isArray(entry.data)
      ? normalizeProcessList(entry.data)
      : normalizeValue(entry.data);
  }

  if (entry.error !== undefined) {
    normalized.error = normalizeValue(entry.error);
  }

  return stableStringify(normalized);
}

function normalizeProcessList(processes) {
  return processes
    .map((process) => normalizeValue(process))
    .sort((a, b) => {
      const groupA = extractComparableField(a, ['group', 'Group']);
      const groupB = extractComparableField(b, ['group', 'Group']);
      if (groupA !== groupB) {
        return groupA.localeCompare(groupB);
      }

      const nameA = extractComparableField(a, ['name', 'processname', 'Name']);
      const nameB = extractComparableField(b, ['name', 'processname', 'Name']);
      return nameA.localeCompare(nameB);
    });
}

function extractComparableField(value, candidates) {
  if (!value || typeof value !== 'object') {
    return '';
  }

  for (const field of candidates) {
    const candidate = value[field];
    if (candidate !== undefined && candidate !== null) {
      return String(candidate);
    }
  }

  return '';
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeValue(value[key])])
    );
  }

  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
