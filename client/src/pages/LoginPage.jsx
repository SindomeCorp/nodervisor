import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../App.jsx';
import AuthPageLayout from './AuthPageLayout.jsx';

export default function LoginPage() {
  const { login } = useSession();
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
        <span>
          Need an account? <Link to="/auth/register">Create one</Link>
        </span>
      }
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            className="form-control"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
            disabled={submitting}
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className="form-control"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting}
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthPageLayout>
  );
}
