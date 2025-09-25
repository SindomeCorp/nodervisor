import { useEffect, useMemo, useRef, useState } from 'react';

const STATUS_ORDER = ['CONERR', 'FATAL', 'EXITED', 'STARTING', 'RUNNING', 'STOPPED', 'BACKOFF'];
const STATUS_META = {
  CONERR: { className: 'redIcons', icon: 'fa-solid fa-bolt' },
  FATAL: { className: 'redIcons', icon: 'fa-solid fa-circle-exclamation' },
  EXITED: { className: 'redIcons', icon: 'fa-solid fa-circle-exclamation' },
  STARTING: { className: 'goldIcons', icon: 'fa-solid fa-rotate' },
  RUNNING: { className: 'greenIcons', icon: 'fa-solid fa-circle-check' },
  STOPPED: { className: 'blueIcons', icon: 'fa-solid fa-circle-minus' },
  BACKOFF: { className: 'blueIcons', icon: 'fa-solid fa-circle-minus' }
};

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

function summarizeProcesses(processes) {
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

function useDashboardData(pollInterval) {
  const [hosts, setHosts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timerId;
    let controller = new AbortController();

    async function load() {
      if (initialLoad.current) {
        setLoading(true);
      }

      controller.abort();
      controller = new AbortController();

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

        setHosts(transformHosts(payload?.data));
        setError(null);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') {
          return;
        }
        setError(err.message ?? 'Failed to load dashboard data.');
      } finally {
        if (cancelled) {
          return;
        }
        if (initialLoad.current) {
          setLoading(false);
          initialLoad.current = false;
        }
        timerId = setTimeout(load, pollInterval);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
      controller.abort();
    };
  }, [pollInterval]);

  return { hosts, error, loading };
}

function HostCard({ host, processes }) {
  const summary = useMemo(() => summarizeProcesses(processes), [processes]);
  const meta = STATUS_META[summary.status] ?? STATUS_META.CONERR;
  const label = summary.count;

  return (
    <div className="card dashboard-card">
      <div className="card-body">
        <h3 className="h5 mb-4">{host?.Name ?? 'Unknown Host'}</h3>
        <div className={`dashboard-status-label ${meta.className}`}>
          <i className={`${meta.icon}`} aria-hidden="true"></i>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { hosts, error, loading } = useDashboardData(10000);
  const hasHosts = hosts.length > 0;

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-heading">
      <header className="mb-4">
        <h2 id="dashboard-heading" className="h4">
          Supervisor overview
        </h2>
      </header>
      {loading && hosts.length === 0 && <p>Loading the latest supervisor information…</p>}
      {error && (
        <div className="alert alert-danger dashboard-error" role="alert">
          {error}
        </div>
      )}
      {!hasHosts && !loading && !error && <p>No hosts available.</p>}
      {hasHosts && (
        <div className="dashboard-grid">
          {hosts.map((entry, index) => (
            <HostCard
              key={entry.host?.idHost ?? `${entry.host?.Name ?? 'host'}-${index}`}
              host={entry.host}
              processes={entry.data}
            />
          ))}
        </div>
      )}
    </section>
  );
}
