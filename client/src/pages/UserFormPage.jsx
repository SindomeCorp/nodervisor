import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

const ROLES = ['Admin', 'User'];

export default function UserFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { userId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', role: ROLES[0], password: '' });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
        setForm({ name: data?.name ?? '', email: data?.email ?? '', role: data?.role ?? ROLES[0], password: '' });
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

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password || undefined
      };

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
      <header className="mb-3">
        <h2 id="user-form-heading">{isEdit ? 'Edit user' : 'Add user'}</h2>
      </header>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-control"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="role">
              Role
            </label>
            <select id="role" name="role" className="form-select" value={form.role} onChange={handleChange}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="password">
              Password{isEdit ? ' (leave blank to keep current password)' : ''}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              value={form.password}
              onChange={handleChange}
              aria-describedby="password-help"
              required={!isEdit}
            />
            {isEdit && (
              <div id="password-help" className="form-text">
                Leave blank to keep the existing password.
              </div>
            )}
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/users')}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
