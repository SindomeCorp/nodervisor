import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';

export default function UsersListPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await requestJson('/api/v1/users');
        if (!mounted) {
          return;
        }
        setUsers(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err.message ?? 'Failed to load users');
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
    if (!window.confirm('Delete this user?')) {
      return;
    }

    try {
      await requestJson(`/api/v1/users/${id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((user) => user.id !== id));
    } catch (err) {
      setError(err.message ?? 'Failed to delete user');
    }
  }

  return (
    <section aria-labelledby="users-heading">
      <header className={ui.pageHeader}>
        <h2 id="users-heading" className={ui.pageTitle}>
          Users
        </h2>
        <Link className={`${ui.button} ${ui.buttonPrimary}`} to="/users/new">
          Add user
        </Link>
      </header>
      {loading && <p>Loading users…</p>}
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      {!loading && users.length === 0 && <p>No users found.</p>}
      {users.length > 0 && (
        <div className={ui.tableWrapper}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col" className={ui.tableCellNumeric}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <th scope="row">{user.name}</th>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td className={ui.tableCellNumeric}>
                    <div className={ui.buttonGroup} role="group">
                      <Link className={`${ui.button} ${ui.buttonSecondary}`} to={`/users/${user.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={`${ui.button} ${ui.buttonDanger}`}
                        onClick={() => handleDelete(user.id)}
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
