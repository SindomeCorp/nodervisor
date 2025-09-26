import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';
import { ALL_ROLES, ROLE_VIEWER } from '../../../shared/roles.js';
import { checkPasswordAgainstPolicy, PASSWORD_POLICY_SUMMARY } from '../../../shared/passwordPolicy.js';

const ROLE_OPTIONS = ALL_ROLES;
const DEFAULT_ROLE = ROLE_VIEWER;

export default function UserFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { userId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: ROLE_OPTIONS.includes(DEFAULT_ROLE) ? DEFAULT_ROLE : ROLE_OPTIONS[0],
    password: ''
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    if (!isEdit || !userId) {
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await requestJson(`/api/v1/users/${userId}`);
        if (cancelled) {
          return;
        }
        setForm({
          name: data?.name ?? '',
          email: data?.email ?? '',
          role: data?.role && ROLE_OPTIONS.includes(data.role) ? data.role : DEFAULT_ROLE,
          password: ''
        });
        setPasswordErrors([]);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load user');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, isEdit]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'password') {
      const errors = value ? checkPasswordAgainstPolicy(value) : [];
      setPasswordErrors(errors);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    if (!isEdit && !form.password) {
      setError('Password is required for new users.');
      return;
    }

    const passwordValidationErrors = form.password ? checkPasswordAgainstPolicy(form.password) : [];
    if ((!isEdit && passwordValidationErrors.length > 0) || (isEdit && form.password && passwordValidationErrors.length > 0)) {
      setPasswordErrors(passwordValidationErrors);
      setError(passwordValidationErrors[0]);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password || undefined
      };

      setPasswordErrors([]);

      if (isEdit && userId) {
        await requestJson(`/api/v1/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson('/api/v1/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      navigate('/users');
    } catch (err) {
      setError(err.message ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="user-form-heading">
      <header className={ui.sectionHeader}>
        <h2 id="user-form-heading" className={ui.pageTitle}>
          {isEdit ? 'Edit user' : 'Add user'}
        </h2>
      </header>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              {error}
            </div>
          )}
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className={ui.formControl}
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={ui.formControl}
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="role">
              Role
            </label>
            <select id="role" name="role" className={ui.formControl} value={form.role} onChange={handleChange}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="password">
              Password{isEdit ? ' (leave blank to keep current password)' : ''}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={ui.formControl}
              value={form.password}
              onChange={handleChange}
              aria-describedby="password-help"
              required={!isEdit}
            />
            {isEdit && (
              <div id="password-help" className={ui.formText}>
                Leave blank to keep the existing password.
              </div>
            )}
            {passwordErrors.length > 0 && (
              <div className={ui.formError} role="alert">
                {passwordErrors[0]}
              </div>
            )}
            <div className={ui.formText}>{PASSWORD_POLICY_SUMMARY}</div>
          </div>
          <div className={ui.formActions}>
            <button type="submit" className={`${ui.button} ${ui.buttonPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSecondary}`}
              onClick={() => navigate('/users')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
