import { Link } from 'react-router-dom';

import layoutStyles from '../AppLayout.module.css';
import ui from '../styles/ui.module.css';

export default function AuthPageLayout({ title, children, footer }) {
  return (
    <div className={layoutStyles.authLayout}>
      <header className={layoutStyles.headerContainer}>
        <div className={layoutStyles.headerWrapper}>
          <h1 className={layoutStyles.headerTitle}>
            <Link to="/" className={layoutStyles.brandLink}>
              Nodervisor
            </Link>
          </h1>
        </div>
      </header>
      <main className={layoutStyles.authMain}>
        <div className={layoutStyles.authCard}>
          <div className={layoutStyles.authCardBody}>
            <h2 className={layoutStyles.authTitle}>{title}</h2>
            {children}
          </div>
          {footer && <div className={`${layoutStyles.authCardFooter} ${ui.textCenter}`}>{footer}</div>}
        </div>
      </main>
    </div>
  );
}
