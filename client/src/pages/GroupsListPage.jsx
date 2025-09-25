import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

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
      <header className="d-flex justify-content-between align-items-center mb-3">
        <h2 id="groups-heading">Groups</h2>
        <Link className="btn btn-primary" to="/groups/new">
          Add group
        </Link>
      </header>
      {loading && <p>Loading groups…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {!loading && groups.length === 0 && <p>No groups defined.</p>}
      {groups.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <th scope="row">{group.name}</th>
                  <td className="text-end">
                    <div className="btn-group" role="group">
                      <Link className="btn btn-secondary" to={`/groups/${group.id}`}>
                        Edit
                      </Link>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(group.id)}>
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
