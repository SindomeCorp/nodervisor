import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

export default function GroupFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit || !groupId) {
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await requestJson(`/api/v1/groups/${groupId}`);
        if (cancelled) {
          return;
        }
        setName(data?.name ?? '');
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load group');
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
  }, [groupId, isEdit]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim() };
      if (isEdit && groupId) {
        await requestJson(`/api/v1/groups/${groupId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson('/api/v1/groups', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      navigate('/groups');
    } catch (err) {
      setError(err.message ?? 'Failed to save group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="group-form-heading">
      <header className="mb-3">
        <h2 id="group-form-heading">{isEdit ? 'Edit group' : 'Add group'}</h2>
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
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/groups')}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
