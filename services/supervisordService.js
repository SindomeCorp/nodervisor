import { inspect } from 'util';

class ServiceError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class SupervisordService {
  constructor({ config, supervisordapi }) {
    this.config = config;
    this.supervisordapi = supervisordapi;
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
        try {
          const client = this.#createClient(host);
          const data = await this.#callClient(client, 'getAllProcessInfo');
          return [host.idHost, { host, data }];
        } catch (err) {
          const error = err instanceof ServiceError ? err : this.#wrapRpcError(err);
          return [host.idHost, { host, error: this.#serializeError(error) }];
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

  #getClient(hostId) {
    const host = this.config.hostCache?.get?.(hostId) ?? this.config.hosts?.[hostId];
    if (!host) {
      throw new ServiceError(`Host not found: ${hostId}`, 404);
    }

    return this.#createClient(host);
  }

  #createClient(host) {
    if (this.config.supervisord?.createClient) {
      return this.config.supervisord.createClient(this.supervisordapi, host);
    }

    return this.supervisordapi.connect(host.Url);
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
    if (typeof client?.[method] !== 'function') {
      throw new ServiceError(`Unsupported supervisord method: ${method}`, 500);
    }

    return new Promise((resolve, reject) => {
      client[method](...args, (err, result) => {
        if (err) {
          reject(this.#wrapRpcError(err));
          return;
        }

        resolve(result);
      });
    });
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

export { ServiceError };
