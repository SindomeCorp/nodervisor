import { inspect } from 'util';
import pino from 'pino';

import { ServiceError } from './errors.js';
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
          return [hostId, { host, data }];
        } catch (err) {
          const error = err instanceof ServiceError ? err : this.#wrapRpcError(err);
          return [hostId, { host, error: this.#serializeError(error) }];
        }
      })
    );

    return Object.fromEntries(results);
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
    if (this.clientCache.has(hostId)) {
      return this.clientCache.get(hostId);
    }

    const rawClient = this.config.supervisord?.createClient
      ? this.config.supervisord.createClient(this.supervisordapi, host)
      : this.supervisordapi.connect(host.Url);

    const clientLogger = this.logger.child
      ? this.logger.child({ hostId, hostUrl: host?.Url })
      : this.logger;

    const wrapper = new SupervisordClientWrapper({
      hostId,
      hostUrl: host?.Url,
      client: rawClient,
      options: this.rpcOptions,
      logger: clientLogger,
      metrics: this.metrics,
      wrapRpcError: (error) => this.#wrapRpcError(error)
    });

    this.clientCache.set(hostId, wrapper);
    return wrapper;
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
    const details = err ? inspect(err, { depth: 2 }) : undefined;
    return new ServiceError(message, 502, details);
  }

  #serializeError(error) {
    if (!(error instanceof ServiceError)) {
      return { message: 'Unexpected error' };
    }

    const payload = { message: error.message };
    if (error.details) {
      payload.details = error.details;
    }

    return payload;
  }
}
