import { ServiceError } from './errors.js';

const sleep = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer?.unref === 'function') {
      timer.unref();
    }
  });

const defaultMetrics = {
  onRpcSuccess: () => {},
  onRpcFailure: () => {},
  onCircuitOpen: () => {},
  onCircuitClose: () => {}
};

export class SupervisordClientWrapper {
  constructor({
    hostId,
    hostUrl,
    client,
    options = {},
    logger,
    metrics = {},
    wrapRpcError
  }) {
    this.hostId = hostId;
    this.hostUrl = hostUrl;
    this.client = client;
    this.logger = logger;
    this.wrapRpcError = wrapRpcError;
    this.metrics = { ...defaultMetrics, ...metrics };

    this.options = {
      requestTimeoutMs: 5000,
      maxRetries: 2,
      backoffBaseMs: 100,
      backoffMaxMs: 2000,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 30000,
      ...options
    };

    this.circuit = {
      state: 'closed',
      failureCount: 0,
      nextAttemptAfter: 0
    };
  }

  async call(method, ...args) {
    if (typeof this.client?.[method] !== 'function') {
      throw new ServiceError(`Unsupported supervisord method: ${method}`, 500);
    }

    const now = Date.now();
    if (this.circuit.state === 'open') {
      if (now < this.circuit.nextAttemptAfter) {
        const error = new ServiceError(
          `Circuit open for host ${this.hostId}`,
          503
        );
        this.logger?.warn?.({
          hostId: this.hostId,
          hostUrl: this.hostUrl,
          method,
          circuitState: this.circuit.state
        }, 'Circuit breaker open');
        this.metrics.onRpcFailure({
          hostId: this.hostId,
          method,
          error,
          attempt: 0,
          transient: true,
          circuitState: this.circuit.state
        });
        throw error;
      }

      this.logger?.info?.({
        hostId: this.hostId,
        hostUrl: this.hostUrl,
        method
      }, 'Circuit half-open, probing RPC');
      this.circuit.state = 'half-open';
    }

    const maxAttempts = this.options.maxRetries + 1;
    let attempt = 0;
    let lastError;

    while (attempt < maxAttempts) {
      attempt += 1;
      const startedAt = Date.now();
      try {
        this.logger?.debug?.({
          hostId: this.hostId,
          hostUrl: this.hostUrl,
          method,
          attempt
        }, 'Invoking supervisord RPC');
        const result = await this.#invokeWithTimeout(method, args);
        const duration = Date.now() - startedAt;
        this.#onSuccess();
        this.metrics.onRpcSuccess({
          hostId: this.hostId,
          method,
          duration,
          attempt
        });
        this.logger?.debug?.({
          hostId: this.hostId,
          hostUrl: this.hostUrl,
          method,
          attempt,
          duration
        }, 'Supervisord RPC succeeded');
        return result;
      } catch (err) {
        const wrappedError =
          err instanceof ServiceError
            ? err
            : this.wrapRpcError?.(err) ?? this.#defaultWrap(err);
        lastError = wrappedError;
        const duration = Date.now() - startedAt;
        const transient = this.#isTransient(wrappedError);
        this.logger?.warn?.({
          hostId: this.hostId,
          hostUrl: this.hostUrl,
          method,
          attempt,
          duration,
          transient,
          error: wrappedError
        }, 'Supervisord RPC failed');
        this.metrics.onRpcFailure({
          hostId: this.hostId,
          method,
          error: wrappedError,
          attempt,
          transient,
          duration
        });
        this.#onFailure(transient, wrappedError);

        if (!transient || attempt >= maxAttempts || this.circuit.state === 'open') {
          throw wrappedError;
        }

        const delay = this.#computeBackoff(attempt);
        if (delay > 0) {
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new ServiceError('Supervisord RPC failure', 502);
  }

  async #invokeWithTimeout(method, args) {
    const timeoutMs = this.options.requestTimeoutMs;
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer;

      const finalize = (err, result) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      };

      try {
        if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
          timer = setTimeout(() => {
            finalize(new ServiceError(`Supervisord RPC timeout after ${timeoutMs}ms`, 504));
          }, timeoutMs);
          if (typeof timer?.unref === 'function') {
            timer.unref();
          }
        }

        this.client[method](...args, (err, result) => finalize(err, result));
      } catch (err) {
        finalize(err);
      }
    });
  }

  #isTransient(error) {
    if (!(error instanceof ServiceError)) {
      return true;
    }

    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    const message = error.message?.toLowerCase?.() ?? '';
    if (message.includes('timeout') || message.includes('temporarily unavailable')) {
      return true;
    }

    return false;
  }

  #computeBackoff(attempt) {
    const base = Math.max(this.options.backoffBaseMs, 0);
    const max = Math.max(this.options.backoffMaxMs, base);
    const exponent = Math.max(attempt - 1, 0);
    return Math.min(max, base * 2 ** exponent);
  }

  #onSuccess() {
    const previousState = this.circuit.state;
    this.circuit.state = 'closed';
    this.circuit.failureCount = 0;
    this.circuit.nextAttemptAfter = 0;
    if (previousState !== 'closed') {
      this.logger?.info?.({
        hostId: this.hostId,
        hostUrl: this.hostUrl
      }, 'Circuit closed');
      this.metrics.onCircuitClose({ hostId: this.hostId });
    }
  }

  #onFailure(transient, error) {
    if (!transient) {
      this.circuit.failureCount = 0;
      this.circuit.state = 'closed';
      return;
    }

    const now = Date.now();

    if (this.circuit.state === 'half-open') {
      this.#tripCircuit(now, error);
      return;
    }

    this.circuit.failureCount += 1;
    if (this.circuit.failureCount >= this.options.circuitBreakerThreshold) {
      this.#tripCircuit(now, error);
    }
  }

  #tripCircuit(now, error) {
    this.circuit.state = 'open';
    this.circuit.failureCount = 0;
    this.circuit.nextAttemptAfter = now + this.options.circuitBreakerResetMs;
    this.logger?.error?.({
      hostId: this.hostId,
      hostUrl: this.hostUrl,
      nextAttemptAfter: this.circuit.nextAttemptAfter,
      error
    }, 'Circuit opened due to repeated failures');
    this.metrics.onCircuitOpen({ hostId: this.hostId, error });
  }

  #defaultWrap(err) {
    if (err instanceof Error) {
      return new ServiceError(err.message, 502);
    }

    return new ServiceError('Supervisord RPC error', 502);
  }
}
