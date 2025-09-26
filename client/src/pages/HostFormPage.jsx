import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';
import { HOST_URL_MAX_LENGTH, NAME_MAX_LENGTH } from '../../shared/validationLimits.js';

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
    const trimmedName = form.name.trim();
    const trimmedUrl = form.url.trim();

    if (!trimmedName || !trimmedUrl) {
      setError('Name and URL are required.');
      return;
    }

    if (trimmedName.length > NAME_MAX_LENGTH) {
      setError(`Name must be at most ${NAME_MAX_LENGTH} characters.`);
      return;
    }

    if (trimmedUrl.length > HOST_URL_MAX_LENGTH) {
      setError(`URL must be at most ${HOST_URL_MAX_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        url: trimmedUrl,
        groupId: form.groupId ? Number(form.groupId) : null
      };

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
      <header className={ui.sectionHeader}>
        <h2 id="host-form-heading" className={ui.pageTitle}>
          {isEdit ? 'Edit host' : 'Add host'}
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
              maxLength={NAME_MAX_LENGTH}
            />
          </div>
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="url">
              URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className={ui.formControl}
              value={form.url}
              onChange={handleChange}
              required
              maxLength={HOST_URL_MAX_LENGTH}
            />
          </div>
          <div className={ui.formField}>
            <label className={ui.formLabel} htmlFor="groupId">
              Group
            </label>
            <select
              id="groupId"
              name="groupId"
              className={ui.formControl}
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
          <div className={ui.formActions}>
            <button type="submit" className={`${ui.button} ${ui.buttonPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSecondary}`}
              onClick={() => navigate('/hosts')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
