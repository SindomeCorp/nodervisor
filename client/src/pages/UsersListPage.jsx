import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

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
      <header className="d-flex justify-content-between align-items-center mb-3">
        <h2 id="users-heading">Users</h2>
        <Link className="btn btn-primary" to="/users/new">
          Add user
        </Link>
      </header>
      {loading && <p>Loading users…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {!loading && users.length === 0 && <p>No users found.</p>}
      {users.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col" className="text-end">
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
                  <td className="text-end">
                    <div className="btn-group" role="group">
                      <Link className="btn btn-secondary" to={`/users/${user.id}`}>
                        Edit
                      </Link>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(user.id)}>
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
