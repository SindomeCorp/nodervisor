import { Link } from 'react-router-dom';

export default function AuthPageLayout({ title, children, footer }) {
  return (
    <div className="auth-layout">
      <header className="header-container">
        <div className="header-wrapper">
          <h1 className="title mb-0">
            <Link to="/" className="app-brand-link">
              Nodervisor
            </Link>
          </h1>
        </div>
      </header>
      <main className="auth-main">
        <div className="card auth-card shadow-sm">
          <div className="card-body">
            <h2 className="h4 text-center mb-4">{title}</h2>
            {children}
          </div>
          {footer && <div className="card-footer text-center">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
