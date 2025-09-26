import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';
import { NAME_MAX_LENGTH } from '../../shared/validationLimits.js';

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (trimmedName.length > NAME_MAX_LENGTH) {
      setError(`Name must be at most ${NAME_MAX_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const payload = { name: trimmedName };
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
      <header className={ui.sectionHeader}>
        <h2 id="group-form-heading" className={ui.pageTitle}>
          {isEdit ? 'Edit group' : 'Add group'}
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
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={NAME_MAX_LENGTH}
            />
          </div>
          <div className={ui.formActions}>
            <button type="submit" className={`${ui.button} ${ui.buttonPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSecondary}`}
              onClick={() => navigate('/groups')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
