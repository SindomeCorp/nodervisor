import { useEffect, useMemo, useRef, useState } from 'react';

export const STATUS_ORDER = ['CONERR', 'FATAL', 'EXITED', 'STARTING', 'RUNNING', 'STOPPED', 'BACKOFF'];

export const STATUS_META = {
  CONERR: { tone: 'danger', icon: 'bolt' },
  FATAL: { tone: 'danger', icon: 'alert' },
  EXITED: { tone: 'danger', icon: 'alert' },
  STARTING: { tone: 'warning', icon: 'refresh' },
  RUNNING: { tone: 'success', icon: 'check' },
  STOPPED: { tone: 'info', icon: 'pause' },
  BACKOFF: { tone: 'info', icon: 'pause' }
};

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function StatusIcon({ name, className }) {
  switch (name) {
    case 'bolt':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M11.25 2.25a.75.75 0 01.654.37l4.5 7.5a.75.75 0 01-.654 1.13H12v8.5a.75.75 0 01-1.404.36l-4.5-7.5A.75.75 0 016.75 11H10V2.75a.75.75 0 01.75-.75z"
          />
        </svg>
      );
    case 'alert':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 5a1 1 0 01.993.883L13 8v5a1 1 0 01-1.993.117L11 13V8a1 1 0 011-1zm0 9.25a1.25 1.25 0 11-1.25 1.25A1.25 1.25 0 0112 16.25z"
          />
        </svg>
      );
    case 'refresh':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M3.978 8.223a9 9 0 0114.962-3.74V3.75a.75.75 0 011.5 0v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 010-1.5h2.385a7.5 7.5 0 10.748 7.105.75.75 0 111.318.75A9 9 0 113.978 8.223z"
          />
        </svg>
      );
    case 'check':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm4.28 7.22l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L11 12.94l4.22-4.22a.75.75 0 111.06 1.06z"
          />
        </svg>
      );
    case 'pause':
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm-2.25 5.75a.75.75 0 00-.75.75v7a.75.75 0 001.5 0v-7a.75.75 0 00-.75-.75zm4.5 0a.75.75 0 00-.75.75v7a.75.75 0 001.5 0v-7a.75.75 0 00-.75-.75z"
          />
        </svg>
      );
  }
}

export function summarizeProcesses(processes) {
  if (!Array.isArray(processes) || processes.some((proc) => proc && proc.errno)) {
    return { status: 'CONERR', count: 'NA' };
  }

  const counts = new Map();
  for (const proc of processes) {
    const status = proc?.statename;
    if (!status) {
      continue;
    }
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return { status: 'CONERR', count: 'NA' };
  }

  const [status, count] = [...counts.entries()].sort(
    ([statusA], [statusB]) => STATUS_ORDER.indexOf(statusA) - STATUS_ORDER.indexOf(statusB)
  )[0];

  return { status, count };
}

function normalizeHostEntries(hostMap) {
  const entries = [];
  for (const [hostId, entry] of hostMap.entries()) {
    const host = entry?.host ?? null;
    let processes = [];
    let processError = null;

    if (Array.isArray(entry?.data)) {
      processes = entry.data;
    } else if (entry?.data && entry.data.errno) {
      processError = entry.data;
    } else if (entry?.data) {
      processes = [entry.data];
    }

    const error = entry?.error ?? (processError ? serializeProcessError(processError) : null);

    entries.push({
      hostId,
      host,
      processes,
      processError,
      error,
      raw: entry
    });
  }

  return entries.sort((a, b) => {
    const groupA = (a.host?.GroupName ?? '').toString().toLowerCase();
    const groupB = (b.host?.GroupName ?? '').toString().toLowerCase();
    if (groupA !== groupB) {
      return groupA.localeCompare(groupB);
    }

    const nameA = (a.host?.Name ?? a.hostId ?? '').toString().toLowerCase();
    const nameB = (b.host?.Name ?? b.hostId ?? '').toString().toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function serializeProcessError(error) {
  if (!error || typeof error !== 'object') {
    return { message: 'Supervisor connection error' };
  }

  if (typeof error.errmsg === 'string') {
    return { message: error.errmsg };
  }

  if (typeof error.message === 'string') {
    return { message: error.message };
  }

  return { message: 'Supervisor connection error' };
}

function transformHosts(rawHosts) {
  const entries = Object.entries(rawHosts ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const grouped = new Map();

  for (const [, value] of entries) {
    if (!value || !value.host) {
      continue;
    }

    const { host, data = [] } = value;
    const groupName = host.GroupName;

    if (groupName) {
      const existing = grouped.get(groupName);
      if (existing) {
        existing.data = existing.data.concat(Array.isArray(data) ? data : []);
      } else {
        grouped.set(groupName, {
          host: { Name: groupName },
          data: Array.isArray(data) ? [...data] : []
        });
      }
    } else {
      const key = host.Name ?? '';
      if (!grouped.has(key)) {
        grouped.set(key, {
          host,
          data: Array.isArray(data) ? data : data && data.errno ? [data] : []
        });
      } else {
        const existing = grouped.get(key);
        existing.data = existing.data.concat(Array.isArray(data) ? data : []);
      }
    }
  }

  return Array.from(grouped.values());
}

function normalizeRawHosts(rawHosts) {
  if (!rawHosts || typeof rawHosts !== 'object') {
    return new Map();
  }

  return new Map(Object.entries(rawHosts));
}

export function useSupervisorData(pollIntervalMs = 10000) {
  const [hostEntries, setHostEntries] = useState([]);
  const [groupedHosts, setGroupedHosts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const hostState = useRef(new Map());
  const controllerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fallbackInterval = Math.max(Number(pollIntervalMs) || 0, 60000);

    const applyHostMap = (hostMap) => {
      hostState.current = hostMap;
      setHostEntries(normalizeHostEntries(hostState.current));
      setGroupedHosts(transformHosts(Object.fromEntries(hostState.current)));
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    };

    const applyRawHosts = (rawHosts) => {
      const normalized = normalizeRawHosts(rawHosts);
      applyHostMap(normalized);
    };

    const applyUpdatePayload = (payload) => {
      const current = new Map(hostState.current);
      if (payload?.updates && typeof payload.updates === 'object') {
        for (const [hostId, entry] of Object.entries(payload.updates)) {
          current.set(hostId, entry);
        }
      }
      if (Array.isArray(payload?.removed)) {
        for (const hostId of payload.removed) {
          current.delete(hostId);
        }
      }

      applyHostMap(current);
    };

    const clearFallbackTimer = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const scheduleFallbackFetch = () => {
      clearFallbackTimer();
      fallbackTimerRef.current = setTimeout(() => {
        performFetch({ showLoading: false, scheduleNext: true });
      }, fallbackInterval);
      if (typeof fallbackTimerRef.current?.unref === 'function') {
        fallbackTimerRef.current.unref();
      }
    };

    const performFetch = async ({ showLoading, scheduleNext } = {}) => {
      if (cancelled) {
        return;
      }

      if (showLoading && initialLoad.current) {
        setLoading(true);
      }

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch('/api/v1/supervisors', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
          credentials: 'same-origin'
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        applyRawHosts(payload?.data);
        setError(null);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') {
          return;
        }
        setError(err.message ?? 'Failed to load supervisor data.');
      } finally {
        if (scheduleNext && !cancelled) {
          scheduleFallbackFetch();
        }
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const startStream = () => {
      if (cancelled) {
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const source = new EventSource('/api/v1/supervisors/stream');
      eventSourceRef.current = source;

      source.onopen = () => {
        setError(null);
      };

      source.addEventListener('snapshot', (event) => {
        try {
          const payload = JSON.parse(event.data);
          applyRawHosts(payload);
          setError(null);
        } catch (_err) {
          setError('Received malformed supervisor snapshot.');
        }
      });

      source.addEventListener('update', (event) => {
        try {
          const payload = JSON.parse(event.data);
          applyUpdatePayload(payload);
          setError(null);
        } catch (_err) {
          setError('Received malformed supervisor update.');
        }
      });

      source.onerror = () => {
        if (cancelled) {
          return;
        }

        setError((current) => current ?? 'Reconnecting to supervisor stream…');

        if (source.readyState === EventSource.CLOSED && !reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            startStream();
          }, 3000);
        }
      };
    };

    performFetch({ showLoading: true, scheduleNext: true });
    startStream();

    return () => {
      cancelled = true;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      clearFallbackTimer();
      clearReconnectTimer();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [pollIntervalMs]);

  const value = useMemo(
    () => ({ hostEntries, groupedHosts, error, loading }),
    [hostEntries, groupedHosts, error, loading]
  );

  return value;
}

export function formatProcessIdentifier(process) {
  if (!process || typeof process !== 'object') {
    return '';
  }

  const name = process.name ?? process.processname ?? process.Program ?? process.command ?? '';
  const group = process.group ?? process.Group ?? '';

  if (name && group && group !== name) {
    return `${group}:${name}`;
  }

  return name || group || '';
}

export function formatTimestamp(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  try {
    return new Date(value * 1000).toLocaleString();
  } catch {
    return null;
  }
}

export function formatDuration(seconds) {
  let remaining = Math.floor(Number(seconds));
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return null;
  }

  const parts = [];
  const units = [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1]
  ];

  for (const [suffix, value] of units) {
    if (remaining < value) {
      continue;
    }

    const amount = Math.floor(remaining / value);
    remaining -= amount * value;
    parts.push(`${amount}${suffix}`);

    if (parts.length >= 2) {
      break;
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
