import { jest } from '@jest/globals';

import {
  SupervisordService,
  DEFAULT_PROCESS_STREAM_INTERVAL_MS,
  MAX_PROCESS_STREAM_INTERVAL_MS,
  MIN_PROCESS_STREAM_INTERVAL_MS
} from '../../services/supervisordService.js';

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

describe('SupervisordService.createProcessStream interval bounds', () => {
  let service;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    service = new SupervisordService({
      config: { hosts: {} },
      supervisordapi: { connect: jest.fn() },
      logger: createLoggerMock(),
      metrics: createMetricsMock()
    });
    service.fetchAllProcessInfo = jest.fn().mockResolvedValue({});
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (service?.fetchAllProcessInfo) {
      service.fetchAllProcessInfo.mockReset();
    }
    if (jest.isMockFunction(global.setTimeout)) {
      global.setTimeout.mockRestore();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const waitForInitialTick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('enforces the minimum polling interval', async () => {
    const stream = service.createProcessStream({ intervalMs: MIN_PROCESS_STREAM_INTERVAL_MS / 2 });

    await waitForInitialTick();

    expect(service.fetchAllProcessInfo).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), MIN_PROCESS_STREAM_INTERVAL_MS);

    stream.close();
  });

  it('enforces the maximum polling interval', async () => {
    const stream = service.createProcessStream({ intervalMs: MAX_PROCESS_STREAM_INTERVAL_MS * 2 });

    await waitForInitialTick();

    expect(service.fetchAllProcessInfo).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), MAX_PROCESS_STREAM_INTERVAL_MS);

    stream.close();
  });

  it('uses the default interval for non-numeric values', async () => {
    const stream = service.createProcessStream({ intervalMs: Number.NaN });

    await waitForInitialTick();

    expect(service.fetchAllProcessInfo).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), DEFAULT_PROCESS_STREAM_INTERVAL_MS);

    stream.close();
  });
});
