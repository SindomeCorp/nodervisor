import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../App.jsx';
import AuthPageLayout from './AuthPageLayout.jsx';
import ui from '../styles/ui.module.css';

export default function LoginPage() {
  const { login, allowSelfRegistration } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname ?? '/dashboard';

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const user = await login({ email: email.trim(), password });
      if (user) {
        navigate(from, { replace: true });
      } else {
        setError('Unable to sign in with those credentials.');
      }
    } catch (err) {
      setError(err.message ?? 'Unable to sign in with those credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      title="Sign in"
      footer={
        allowSelfRegistration ? (
          <span>
            Need an account? <Link to="/auth/register">Create one</Link>
          </span>
        ) : (
          <span>Need access? Ask an administrator to create an account.</span>
        )
      }
    >
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            className={ui.formControl}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
            disabled={submitting}
          />
        </div>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className={ui.formControl}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          className={`${ui.button} ${ui.buttonPrimary} ${ui.buttonBlock}`}
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthPageLayout>
  );
}
