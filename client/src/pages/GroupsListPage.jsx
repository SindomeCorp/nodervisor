import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';

export default function GroupsListPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await requestJson('/api/v1/groups');
        if (!mounted) {
          return;
        }
        setGroups(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err.message ?? 'Failed to load groups');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this group?')) {
      return;
    }

    try {
      await requestJson(`/api/v1/groups/${id}`, { method: 'DELETE' });
      setGroups((current) => current.filter((group) => group.id !== id));
    } catch (err) {
      setError(err.message ?? 'Failed to delete group');
    }
  }

  return (
    <section aria-labelledby="groups-heading">
      <header className={ui.pageHeader}>
        <h2 id="groups-heading" className={ui.pageTitle}>
          Groups
        </h2>
        <Link className={`${ui.button} ${ui.buttonPrimary}`} to="/groups/new">
          Add group
        </Link>
      </header>
      {loading && <p>Loading groups…</p>}
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      {!loading && groups.length === 0 && <p>No groups defined.</p>}
      {groups.length > 0 && (
        <div className={ui.tableWrapper}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className={ui.tableCellNumeric}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <th scope="row">{group.name}</th>
                  <td className={ui.tableCellNumeric}>
                    <div className={ui.buttonGroup} role="group">
                      <Link className={`${ui.button} ${ui.buttonSecondary}`} to={`/groups/${group.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={`${ui.button} ${ui.buttonDanger}`}
                        onClick={() => handleDelete(group.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
