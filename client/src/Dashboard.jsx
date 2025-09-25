import { useEffect, useMemo, useRef, useState } from 'react';

const STATUS_ORDER = ['CONERR', 'FATAL', 'EXITED', 'STARTING', 'RUNNING', 'STOPPED', 'BACKOFF'];
const STATUS_META = {
  CONERR: { className: 'redIcons', icon: 'fa fa-bolt' },
  FATAL: { className: 'redIcons', icon: 'fa fa-exclamation-circle' },
  EXITED: { className: 'redIcons', icon: 'fa fa-exclamation-circle' },
  STARTING: { className: 'goldIcons', icon: 'fa fa-refresh' },
  RUNNING: { className: 'greenIcons', icon: 'fa fa-check-circle' },
  STOPPED: { className: 'blueIcons', icon: 'fa fa-minus-circle' },
  BACKOFF: { className: 'blueIcons', icon: 'fa fa-minus-circle' }
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

function chunkHosts(hosts, size) {
  const rows = [];
  for (let i = 0; i < hosts.length; i += size) {
    rows.push(hosts.slice(i, i + size));
  }
  return rows;
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
    <div className="span2 well well-small dashboard-card">
      <h2 style={{ marginTop: 0 }}>{host?.Name ?? 'Unknown Host'}</h2>
      <div>
        <span className={`${meta.className} largeIcon`}>
          <i className={meta.icon}></i> {label}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { hosts, error, loading } = useDashboardData(10000);
  const rows = useMemo(() => chunkHosts(hosts, 6), [hosts]);

  return (
    <div className="container dashboard-app-container">
      <div className="main-container dashboard-main-container">
        <div className="main clearfix dashboard-main">
          <article>
          {loading && hosts.length === 0 && (
            <p>Loading the latest supervisor information…</p>
          )}
          {error && (
            <div className="alert alert-danger dashboard-error" role="alert">
              {error}
            </div>
          )}
          {rows.length === 0 && !loading && !error && (
            <p>No hosts available.</p>
          )}
          {rows.map((row, rowIndex) => (
            <div className="row-fluid" key={`row-${rowIndex}`}>
              {row.map((entry, index) => (
                <HostCard
                  key={entry.host?.idHost ?? `${entry.host?.Name ?? 'host'}-${index}`}
                  host={entry.host}
                  processes={entry.data}
                />
              ))}
            </div>
          ))}
          </article>
        </div>
      </div>
    </div>
  );
}
