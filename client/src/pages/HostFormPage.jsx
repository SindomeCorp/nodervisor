import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

export default function HostFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { hostId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', url: '', groupId: '' });
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [groupData, hostData] = await Promise.all([
          requestJson('/api/v1/groups'),
          isEdit && hostId ? requestJson(`/api/v1/hosts/${hostId}`) : Promise.resolve(null)
        ]);
        if (cancelled) {
          return;
        }
        setGroups(Array.isArray(groupData) ? groupData : []);
        if (isEdit && hostData) {
          setForm({
            name: hostData.name ?? '',
            url: hostData.url ?? '',
            groupId: hostData.groupId != null ? String(hostData.groupId) : ''
          });
        } else {
          setForm({ name: '', url: '', groupId: '' });
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load host');
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
  }, [hostId, isEdit]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        groupId: form.groupId ? Number(form.groupId) : null
      };

      if (!payload.name || !payload.url) {
        setError('Name and URL are required.');
        setSaving(false);
        return;
      }

      if (isEdit && hostId) {
        await requestJson(`/api/v1/hosts/${hostId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson('/api/v1/hosts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      navigate('/hosts');
    } catch (err) {
      setError(err.message ?? 'Failed to save host');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="host-form-heading">
      <header className="mb-3">
        <h2 id="host-form-heading">{isEdit ? 'Edit host' : 'Add host'}</h2>
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
            <label className="form-label" htmlFor="url">
              URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className="form-control"
              value={form.url}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="groupId">
              Group
            </label>
            <select
              id="groupId"
              name="groupId"
              className="form-select"
              value={form.groupId}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/hosts')}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
