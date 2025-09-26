import { useSession } from '../sessionContext.jsx';
import ui from '../styles/ui.module.css';

export default function RequestAccessPage() {
  const { user } = useSession();

  return (
    <section aria-labelledby="request-access-heading">
      <header className={ui.sectionHeader}>
        <h2 id="request-access-heading" className={ui.pageTitle}>
          Access required
        </h2>
      </header>
      <div className={ui.alert} role="status">
        <p>Hi {user?.name ?? 'there'}!</p>
        <p>
          Your account is active, but no roles have been assigned yet. Please reach out to an administrator to request
          viewer, manager, or admin access so you can use the dashboard.
        </p>
      </div>
    </section>
  );
}
