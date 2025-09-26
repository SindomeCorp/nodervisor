import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { requestJson } from './apiClient.js';
import { ansiToHtml } from './utils/ansiToHtml.js';
import {
  STATUS_META,
  StatusIcon,
  formatDuration,
  formatProcessIdentifier,
  formatTimestamp,
  summarizeProcesses,
  useSupervisorData
} from './supervisorData.jsx';
import dashboardStyles from './Dashboard.module.css';
import ui from './styles/ui.module.css';
import { isSafeUrl } from '../../shared/url.js';

const STATUS_TONE_CLASS = {
  danger: dashboardStyles.statusToneDanger,
  success: dashboardStyles.statusToneSuccess,
  info: dashboardStyles.statusToneInfo,
  warning: dashboardStyles.statusToneWarning
};

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function formatStatusLabel(status) {
  if (!status) {
    return 'Unknown';
  }

  const normalized = status.toUpperCase();
  switch (normalized) {
    case 'CONERR':
      return 'Connection error';
    case 'FATAL':
      return 'Fatal';
    case 'EXITED':
      return 'Exited';
    case 'STARTING':
      return 'Starting';
    case 'RUNNING':
      return 'Running';
    case 'STOPPED':
      return 'Stopped';
    case 'BACKOFF':
      return 'Backoff';
    default:
      return normalized.charAt(0) + normalized.slice(1).toLowerCase();
  }
}

function StatusBadge({ status, children }) {
  const normalized = typeof status === 'string' ? status.toUpperCase() : 'CONERR';
  const meta = STATUS_META[normalized] ?? STATUS_META.CONERR;
  const toneClass = STATUS_TONE_CLASS[meta.tone] ?? STATUS_TONE_CLASS.info;
  const label = children ?? formatStatusLabel(normalized);

  return (
    <span className={classNames(dashboardStyles.statusBadge, toneClass)}>
      <StatusIcon name={meta.icon} className={dashboardStyles.statusIcon} />
      <span>{label}</span>
    </span>
  );
}

const SCROLL_STICKY_EPSILON_PX = 2;

function isScrolledToBottom(node) {
  const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
  return Math.abs(distanceFromBottom) <= SCROLL_STICKY_EPSILON_PX;
}

function createLogState() {
  return {
    out: {
      content: '',
      offset: 0,
      overflow: false,
      loading: false,
      loadingMode: null,
      error: null
    },
    err: {
      content: '',
      offset: 0,
      overflow: false,
      loading: false,
      loadingMode: null,
      error: null
    }
  };
}

function ProcessLogDialog({ open, hostId, hostName, processName, displayName, onClose }) {
  const [activeTab, setActiveTab] = useState('out');
  const [logState, setLogState] = useState(() => createLogState());
  const [reloadToken, setReloadToken] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const appendModeRef = useRef(false);
  const logStateRef = useRef(logState);
  const logContentRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const storageKey = hostId ? `nodervisor:logAutoRefresh:${hostId}` : null;

  useEffect(() => {
    logStateRef.current = logState;
  }, [logState]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setAutoRefresh(false);
      return;
    }

    let storedValue = false;
    try {
      storedValue = window.localStorage.getItem(storageKey) === 'true';
    } catch (_err) {
      storedValue = false;
    }

    setAutoRefresh(storedValue);
  }, [storageKey]);

  const triggerReload = useCallback(
    (append = false) => {
      appendModeRef.current = append;
      setReloadToken((token) => token + 1);
    },
    [setReloadToken]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveTab('out');
    setLogState(createLogState());
    appendModeRef.current = false;
    triggerReload(false);
  }, [open, hostId, processName, triggerReload]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const shouldAppend = appendModeRef.current && reloadToken !== 0;
    appendModeRef.current = false;

    const measureShouldStickToBottom = () => {
      if (!shouldAppend) {
        return false;
      }

      const container = logContentRef.current;
      if (!container) {
        return true;
      }

      return isScrolledToBottom(container);
    };
    pendingScrollRef.current = null;

    setLogState((prev) => {
      const previousTab = prev[activeTab] ?? {
        content: '',
        offset: 0,
        overflow: false,
        loading: false,
        loadingMode: null,
        error: null
      };
      return {
        ...prev,
        [activeTab]: {
          ...previousTab,
          loading: true,
          loadingMode: shouldAppend ? 'append' : 'replace',
          error: null
        }
      };
    });

    async function loadLogs() {
      try {
        const query = new URLSearchParams({
          host: hostId,
          process: processName,
          type: activeTab
        });
        if (shouldAppend) {
          const currentTabState = logStateRef.current[activeTab];
          const startOffset = Number(currentTabState?.offset ?? 0);
          if (Number.isFinite(startOffset) && startOffset > 0) {
            query.set('offset', String(startOffset));
          } else {
            query.set('offset', '0');
          }
        }
        const data = await requestJson(`/api/v1/supervisors/logs?${query.toString()}`);
        if (cancelled) {
          return;
        }

        const [content, offset, overflow] = Array.isArray(data) ? data : ['', 0, false];
        const shouldStickToBottom = measureShouldStickToBottom();
        let shouldScrollAfterUpdate = false;
        setLogState((prev) => {
          const previousTab = prev[activeTab] ?? {
            content: '',
            offset: 0,
            overflow: false,
            loading: false,
            loadingMode: null,
            error: null
          };
          const nextOffset = Number.isFinite(Number(offset)) ? Number(offset) : 0;
          const newContent = typeof content === 'string' ? content : '';
          const canAppend = shouldAppend && nextOffset > previousTab.offset;
          const combinedContent = canAppend ? `${previousTab.content}${newContent}` : newContent;
          if (shouldAppend && shouldStickToBottom && typeof newContent === 'string' && newContent.length > 0) {
            shouldScrollAfterUpdate = true;
          }
          return {
            ...prev,
            [activeTab]: {
              ...previousTab,
              loading: false,
              loadingMode: null,
              content: combinedContent,
              offset: nextOffset,
              overflow: Boolean(overflow),
              error: null
            }
          };
        });
        if (shouldScrollAfterUpdate) {
          pendingScrollRef.current = activeTab;
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        setLogState((prev) => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            loading: false,
            loadingMode: null,
            error: err.message ?? 'Failed to load logs.'
          }
        }));
      }
    }

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [open, activeTab, hostId, processName, reloadToken]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (pendingScrollRef.current !== activeTab) {
      return;
    }

    const container = logContentRef.current;
    if (!container) {
      pendingScrollRef.current = null;
      return;
    }

    pendingScrollRef.current = null;
    requestAnimationFrame(() => {
      const node = logContentRef.current;
      if (!node) {
        return;
      }
      node.scrollTop = node.scrollHeight;
    });
  }, [logState, activeTab, open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const tabState =
    logState[activeTab] ?? {
      content: '',
      offset: 0,
      overflow: false,
      loading: false,
      loadingMode: null,
      error: null
    };
  const tabs = [
    { key: 'out', label: 'Stdout' },
    { key: 'err', label: 'Stderr' }
  ];

  const handleRefresh = () => {
    triggerReload(false);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await requestJson('/api/v1/supervisors/logs/clear', {
        method: 'POST',
        body: JSON.stringify({ host: hostId, process: processName })
      });
      triggerReload(false);
    } catch (err) {
      setLogState((prev) => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          error: err.message ?? 'Failed to clear logs.'
        }
      }));
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (!open || !autoRefresh || typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      triggerReload(true);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open, autoRefresh, triggerReload, activeTab, hostId, processName]);

  const handleToggleAutoRefresh = () => {
    setAutoRefresh((previous) => {
      const nextValue = !previous;
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, String(nextValue));
        } catch (_err) {
          // Ignore storage errors.
        }
      }
      if (nextValue) {
        triggerReload(true);
      }
      return nextValue;
    });
  };

  const logLabel = activeTab === 'out' ? 'stdout' : 'stderr';
  const logContentText =
    typeof tabState.content === 'string' && tabState.content.length > 0
      ? tabState.content
      : `No ${logLabel} output.`;
  const renderedLogHtml = useMemo(
    () => ansiToHtml(logContentText),
    [logContentText]
  );

  return (
    <div className={dashboardStyles.logOverlay} role="presentation">
      <div
        className={dashboardStyles.logDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-dialog-title"
      >
        <div className={dashboardStyles.logHeader}>
          <div>
            <h3 id="log-dialog-title" className={dashboardStyles.logTitle}>
              {displayName}
            </h3>
            <p className={dashboardStyles.logSubtitle}>{hostName}</p>
          </div>
          <button
            type="button"
            className={dashboardStyles.closeButton}
            onClick={onClose}
            aria-label="Close log viewer"
          >
            ×
          </button>
        </div>
        <div className={dashboardStyles.logTabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={dashboardStyles.logTab}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={dashboardStyles.logContent} role="tabpanel" ref={logContentRef}>
          {tabState.error && (
            <div className={dashboardStyles.logError} role="alert">
              {tabState.error}
            </div>
          )}
          {tabState.loading && tabState.loadingMode !== 'append' && !tabState.content ? (
            <p>Loading {logLabel} log…</p>
          ) : (
            <pre
              className={dashboardStyles.logPre}
              dangerouslySetInnerHTML={{ __html: renderedLogHtml }}
            />
          )}
        </div>
        <div className={dashboardStyles.logFooter}>
          <div className={dashboardStyles.logStatus}>
            {tabState.overflow
              ? 'Showing the most recent log entries.'
              : `Next offset: ${tabState.offset}`}
          </div>
          <div className={dashboardStyles.logFooterActions}>
            <button
              type="button"
              className={`${ui.button} ${autoRefresh ? ui.buttonPrimary : ui.buttonGhost}`}
              onClick={handleToggleAutoRefresh}
              aria-pressed={autoRefresh}
            >
              {autoRefresh ? 'Auto Refresh: On' : 'Auto Refresh: Off'}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSecondary}`}
              onClick={handleRefresh}
              disabled={tabState.loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonDanger}`}
              onClick={handleClear}
              disabled={clearing}
            >
              {clearing ? 'Clearing…' : 'Clear logs'}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonGhost}`}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessRow({ hostId, hostName, process, onProcessAction, onViewLogs }) {
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState(null);

  const identifier = useMemo(() => formatProcessIdentifier(process), [process]);
  const nameCandidate = process?.name ?? process?.processname ?? identifier;
  const displayName =
    typeof nameCandidate === 'string'
      ? nameCandidate.trim() || 'Unknown service'
      : nameCandidate || 'Unknown service';
  const status = process?.statename ?? 'CONERR';
  const startSeconds = Number(process?.start);
  const nowSeconds = Number(process?.now);
  const pid = Number(process?.pid);

  const uptime =
    status === 'RUNNING' && Number.isFinite(startSeconds) && Number.isFinite(nowSeconds)
      ? formatDuration(nowSeconds - startSeconds)
      : null;
  const startedAt = formatTimestamp(startSeconds);
  const spawnError = typeof process?.spawnerr === 'string' ? process.spawnerr : null;

  const handleAction = async (action) => {
    if (!identifier || !action) {
      return;
    }

    setPendingAction(action);
    setActionError(null);
    try {
      await onProcessAction({ hostId, processName: identifier, action });
    } catch (err) {
      setActionError(err.message ?? 'Failed to control process.');
    } finally {
      setPendingAction(null);
    }
  };

  const canStart = ['STOPPED', 'EXITED', 'BACKOFF', 'FATAL'].includes(status);
  const canStop = ['RUNNING', 'STARTING'].includes(status);
  const disableStart = pendingAction !== null || !identifier || !canStart;
  const disableStop = pendingAction !== null || !identifier || !canStop;
  const disableRestart = pendingAction !== null || !identifier;
  const disableLogs = !identifier || typeof onViewLogs !== 'function';

  const pidDisplay = Number.isFinite(pid) && pid > 0 ? pid : '—';

  return (
    <tr>
      <th scope="row">
        <p className={dashboardStyles.processName}>{displayName}</p>
        {spawnError && (
          <p className={dashboardStyles.processDescription}>Last error: {spawnError}</p>
        )}
      </th>
      <td className={dashboardStyles.pidCell}>{pidDisplay}</td>
      <td className={dashboardStyles.statusCell}>
        <StatusBadge status={status} />
      </td>
      <td className={dashboardStyles.uptimeCell}>{uptime ?? '—'}</td>
      <td className={dashboardStyles.startedCell}>{startedAt ?? '—'}</td>
      <td className={classNames(dashboardStyles.actionsCell, ui.tableCellNumeric)}>
        <div className={ui.buttonGroup} role="group">
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSuccess}`}
            disabled={disableStart}
            onClick={() => handleAction('start')}
          >
            {pendingAction === 'start' ? 'Starting…' : 'Start'}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonDanger}`}
            disabled={disableStop}
            onClick={() => handleAction('stop')}
          >
            {pendingAction === 'stop' ? 'Stopping…' : 'Stop'}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={disableRestart}
            onClick={() => handleAction('restart')}
          >
            {pendingAction === 'restart' ? 'Restarting…' : 'Restart'}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonGhost}`}
            disabled={disableLogs}
            onClick={() =>
              onViewLogs?.({
                hostId,
                hostName,
                processName: identifier,
                displayName
              })
            }
          >
            View logs
          </button>
        </div>
        {actionError && <div className={dashboardStyles.actionError}>{actionError}</div>}
      </td>
    </tr>
  );
}

function HostPanel({ entry, onProcessAction, onViewLogs }) {
  const { hostId, host, processes, error } = entry;
  const hostName = host?.Name ?? hostId ?? 'Unknown host';
  const groupName = host?.GroupName ?? null;
  const hostUrl = isSafeUrl(host?.Url) ? host.Url : null;
  const summary = summarizeProcesses(processes);
  const summaryLabel = formatStatusLabel(summary.status);
  const hostProcessCount = processes.length;
  const processLabel =
    summary.status === 'CONERR'
      ? 'Unable to retrieve process list.'
      : hostProcessCount === 0
      ? 'No services reported.'
      : `${hostProcessCount} ${hostProcessCount === 1 ? 'service' : 'services'}`;

  return (
    <article className={dashboardStyles.hostCard}>
      <header className={dashboardStyles.hostHeader}>
        <div>
          <h3 className={dashboardStyles.hostTitle}>{hostName}</h3>
          <div className={dashboardStyles.hostMeta}>
            {groupName && <span>Group: {groupName}</span>}
            {hostUrl && (
              <a
                href={hostUrl}
                target="_blank"
                rel="noreferrer"
                className={dashboardStyles.hostMetaLink}
              >
                Open host
              </a>
            )}
          </div>
        </div>
        <div className={dashboardStyles.hostStats}>
          <StatusBadge status={summary.status}>{summaryLabel}</StatusBadge>
          <span className={dashboardStyles.hostProcessCount}>{processLabel}</span>
        </div>
      </header>
      <div className={dashboardStyles.hostBody}>
        {error && (
          <div className={`${ui.alert} ${ui.alertError} ${dashboardStyles.hostError}`} role="alert">
            {error.message ?? 'Failed to communicate with supervisor.'}
          </div>
        )}
        {processes.length === 0 ? (
          <p className={dashboardStyles.emptyState}>No supervisor processes available.</p>
        ) : (
          <div className={ui.tableWrapper}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">PID</th>
                  <th scope="col">Status</th>
                  <th scope="col">Uptime</th>
                  <th scope="col">Started</th>
                  <th scope="col" className={ui.tableCellNumeric}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process, index) => {
                  const identifier = formatProcessIdentifier(process);
                  const key = identifier || `${hostId}-${index}`;
                  return (
                    <ProcessRow
                      key={key}
                      hostId={hostId}
                      hostName={hostName}
                      process={process}
                      onProcessAction={onProcessAction}
                      onViewLogs={onViewLogs}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { hostEntries, error, loading } = useSupervisorData(10000);
  const [logViewer, setLogViewer] = useState(null);

  const handleProcessAction = async ({ hostId, processName, action }) => {
    if (!hostId || !processName || !action) {
      throw new Error('Missing host, process or action.');
    }

    await requestJson('/api/v1/supervisors/control', {
      method: 'POST',
      body: JSON.stringify({ host: hostId, process: processName, action })
    });
  };

  const handleViewLogs = (payload) => {
    setLogViewer(payload);
  };

  const closeLogViewer = () => {
    setLogViewer(null);
  };

  return (
    <section className={dashboardStyles.section} aria-labelledby="dashboard-heading">
      <header className={ui.sectionHeaderLarge}>
        <h2 id="dashboard-heading" className={dashboardStyles.sectionTitle}>
          Service dashboard
        </h2>
        <p className={dashboardStyles.sectionSubtitle}>
          Monitor Supervisor-managed services, restart processes, and inspect logs across every host.
        </p>
      </header>
      {loading && hostEntries.length === 0 && <p>Loading the latest supervisor information…</p>}
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      {!loading && hostEntries.length === 0 && !error && <p>No hosts available.</p>}
      {hostEntries.length > 0 && (
        <div className={dashboardStyles.hostList}>
          {hostEntries.map((entry) => (
            <HostPanel
              key={entry.hostId}
              entry={entry}
              onProcessAction={handleProcessAction}
              onViewLogs={handleViewLogs}
            />
          ))}
        </div>
      )}
      {logViewer && (
        <ProcessLogDialog
          open
          hostId={logViewer.hostId}
          hostName={logViewer.hostName}
          processName={logViewer.processName}
          displayName={logViewer.displayName}
          onClose={closeLogViewer}
        />
      )}
    </section>
  );
}
