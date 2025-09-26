import { jest } from '@jest/globals';

import { SupervisordService } from '../../services/supervisordService.js';
import { ServiceError } from '../../services/errors.js';

const createLoggerMock = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  logger.child = jest.fn(() => logger);
  return logger;
};

const createMetricsMock = () => ({
  onRpcSuccess: jest.fn(),
  onRpcFailure: jest.fn(),
  onCircuitOpen: jest.fn(),
  onCircuitClose: jest.fn()
});

const HOST_ID = 'host-1';

const baseHost = { idHost: HOST_ID, Url: 'http://localhost:9001/RPC2' };

const buildService = ({ clientFactory, metrics = createMetricsMock(), rpcOptions = {} }) => {
  const supervisordapi = {
    connect: jest.fn(() => clientFactory())
  };

  const service = new SupervisordService({
    config: {
      hosts: { [HOST_ID]: baseHost }
    },
    supervisordapi,
    logger: createLoggerMock(),
    metrics,
    rpcOptions
  });

  return { service, metrics, supervisordapi };
};

describe('SupervisordService integration', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('enforces request deadlines and limits retries for slow RPCs', async () => {
    jest.useFakeTimers();
    let callCount = 0;
    const clientFactory = () => ({
      stopProcess: (_name, callback) => {
        callCount += 1;
        setTimeout(() => callback(null, 'ok'), 100);
      }
    });

    const rpcOptions = {
      requestTimeoutMs: 10,
      maxRetries: 2,
      backoffBaseMs: 1,
      backoffMaxMs: 2
    };

    const { service, metrics } = buildService({ clientFactory, rpcOptions });

    const invocation = service
      .controlProcess({
        hostId: HOST_ID,
        processName: 'web',
        action: 'stop'
      })
      .catch((error) => error);

    await jest.advanceTimersByTimeAsync(500);

    const error = await invocation;
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({
      statusCode: 504,
      message: expect.stringContaining('timeout')
    });

    expect(callCount).toBe(3);
    expect(metrics.onRpcFailure).toHaveBeenCalledTimes(3);
    expect(metrics.onRpcSuccess).not.toHaveBeenCalled();
  });

  it('opens the circuit after repeated transient failures and rejects subsequent calls', async () => {
    jest.useFakeTimers();
    let callCount = 0;
    const clientFactory = () => ({
      stopProcess: (_name, callback) => {
        callCount += 1;
        setTimeout(() => callback(new Error('connection reset')), 0);
      }
    });

    const metrics = createMetricsMock();
    const rpcOptions = {
      requestTimeoutMs: 50,
      maxRetries: 1,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 1000
    };

    const { service } = buildService({ clientFactory, metrics, rpcOptions });

    const firstAttempt = service
      .controlProcess({
        hostId: HOST_ID,
        processName: 'worker',
        action: 'stop'
      })
      .catch((error) => error);

    await jest.advanceTimersByTimeAsync(100);

    const firstError = await firstAttempt;
    expect(firstError).toBeInstanceOf(ServiceError);
    expect(firstError.statusCode).toBe(502);
    expect(callCount).toBe(2);

    const secondAttempt = service
      .controlProcess({
        hostId: HOST_ID,
        processName: 'worker',
        action: 'stop'
      })
      .catch((error) => error);

    const secondError = await secondAttempt;
    expect(secondError).toBeInstanceOf(ServiceError);
    expect(secondError.statusCode).toBe(503);
    expect(callCount).toBe(2);
    expect(metrics.onCircuitOpen).toHaveBeenCalledTimes(1);
    expect(metrics.onCircuitClose).not.toHaveBeenCalled();
    expect(metrics.onRpcFailure).toHaveBeenCalledTimes(3);
  });

  it('redacts sensitive data when serializing RPC errors', async () => {
    const rpcError = new Error('RPC failure');
    rpcError.faultString = 'FAILED';
    rpcError.faultCode = 401;
    rpcError.data = {
      headers: {
        Authorization: 'Basic secret-token',
        'X-Custom': 'value'
      },
      nested: {
        Authorization: 'Another secret'
      }
    };
    rpcError.request = {
      headers: {
        Authorization: 'Basic secret-token'
      }
    };
    rpcError.response = {
      headers: {
        Authorization: 'Bearer token'
      }
    };

    const clientFactory = () => ({
      getAllProcessInfo: (callback) => {
        callback(rpcError);
      }
    });

    const { service } = buildService({ clientFactory });

    const snapshot = await service.fetchAllProcessInfo();
    const entry = snapshot[HOST_ID];
    expect(entry).toBeDefined();
    expect(entry.error).toBeDefined();
    expect(entry.error.message).toBe('FAILED');
    expect(entry.error.details).toBeDefined();
    expect(entry.error.details).not.toHaveProperty('request');
    expect(entry.error.details).not.toHaveProperty('response');
    expect(entry.error.details.faultCode).toBe(401);
    expect(entry.error.details.data).toBeDefined();
    expect(entry.error.details.data.headers.Authorization).toBe('[REDACTED]');
    expect(JSON.stringify(entry.error)).not.toContain('secret-token');
  });
});
