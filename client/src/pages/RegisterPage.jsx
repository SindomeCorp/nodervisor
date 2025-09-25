import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../App.jsx';
import AuthPageLayout from './AuthPageLayout.jsx';
import ui from '../styles/ui.module.css';

export default function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname ?? '/dashboard';

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const user = await register({ name: name.trim(), email: email.trim(), password });
      if (user) {
        navigate(from, { replace: true });
      } else {
        setError('Unable to create an account with the provided details.');
      }
    } catch (err) {
      setError(err.message ?? 'Unable to create an account with the provided details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      title="Create an account"
      footer={
        <span>
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </span>
      }
    >
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="register-name">
            Name
          </label>
          <input
            id="register-name"
            type="text"
            className={ui.formControl}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            autoFocus
            required
            disabled={submitting}
          />
        </div>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="register-email">
            Email address
          </label>
          <input
            id="register-email"
            type="email"
            className={ui.formControl}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={submitting}
          />
        </div>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            className={ui.formControl}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </div>
        <div className={ui.formField}>
          <label className={ui.formLabel} htmlFor="register-confirm">
            Confirm password
          </label>
          <input
            id="register-confirm"
            type="password"
            className={ui.formControl}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          className={`${ui.button} ${ui.buttonSuccess} ${ui.buttonBlock}`}
          disabled={submitting}
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthPageLayout>
  );
}
