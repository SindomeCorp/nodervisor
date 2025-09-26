import { StatusIcon, STATUS_META, summarizeProcesses, useSupervisorData } from '../supervisorData.jsx';
import styles from '../styles/OverviewPage.module.css';
import ui from '../styles/ui.module.css';

const STATUS_TONE_CLASS = {
  danger: styles.statusToneDanger,
  success: styles.statusToneSuccess,
  info: styles.statusToneInfo,
  warning: styles.statusToneWarning
};

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function HostCard({ host, processes }) {
  const summary = summarizeProcesses(processes);
  const meta = STATUS_META[summary.status] ?? STATUS_META.CONERR;
  const label = summary.count;
  const toneClass = STATUS_TONE_CLASS[meta.tone] ?? styles.statusToneInfo;

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{host?.Name ?? 'Unknown Host'}</h3>
        <div className={classNames(styles.statusLabel, toneClass)}>
          <StatusIcon name={meta.icon} className={styles.statusIcon} />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { groupedHosts, error, loading } = useSupervisorData(10000);
  const hasHosts = groupedHosts.length > 0;

  return (
    <section className={styles.section} aria-labelledby="overview-heading">
      <header className={ui.sectionHeaderLarge}>
        <h2 id="overview-heading" className={styles.sectionTitle}>
          Supervisor overview
        </h2>
      </header>
      {loading && groupedHosts.length === 0 && <p>Loading the latest supervisor information…</p>}
      {error && (
        <div className={`${ui.alert} ${ui.alertError} ${styles.error}`} role="alert">
          {error}
        </div>
      )}
      {!hasHosts && !loading && !error && <p>No hosts available.</p>}
      {hasHosts && (
        <div className={styles.grid}>
          {groupedHosts.map((entry, index) => (
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
