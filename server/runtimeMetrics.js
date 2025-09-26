import os from 'node:os';

let lastRestartAt = new Date();
let cpuBaseline = process.cpuUsage();

export function markRuntimeStart() {
  lastRestartAt = new Date();
  cpuBaseline = process.cpuUsage();
}

function formatCpuUsage(usage) {
  const userSeconds = usage.user / 1e6;
  const systemSeconds = usage.system / 1e6;
  return {
    user: userSeconds,
    system: systemSeconds,
    total: userSeconds + systemSeconds
  };
}

function formatMemoryUsage(usage) {
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers
  };
}

export function collectRuntimeMetrics() {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage(cpuBaseline);
  const uptimeMs = Math.max(0, Date.now() - lastRestartAt.getTime());

  return {
    timestamp: new Date().toISOString(),
    lastRestart: lastRestartAt.toISOString(),
    uptime: {
      milliseconds: uptimeMs,
      seconds: uptimeMs / 1000
    },
    memory: formatMemoryUsage(memoryUsage),
    cpu: formatCpuUsage(cpuUsage),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    system: {
      hostname: os.hostname()
    }
  };
}
