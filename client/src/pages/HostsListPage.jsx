import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';

export default function HostsListPage() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await requestJson('/api/v1/hosts');
        if (!mounted) {
          return;
        }
        setHosts(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err.message ?? 'Failed to load hosts');
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
    if (!window.confirm('Delete this host?')) {
      return;
    }

    try {
      await requestJson(`/api/v1/hosts/${id}`, { method: 'DELETE' });
      setHosts((current) => current.filter((host) => host.id !== id));
    } catch (err) {
      setError(err.message ?? 'Failed to delete host');
    }
  }

  return (
    <section aria-labelledby="hosts-heading">
      <header className="d-flex justify-content-between align-items-center mb-3">
        <h2 id="hosts-heading">Hosts</h2>
        <Link className="btn btn-primary" to="/hosts/new">
          Add host
        </Link>
      </header>
      {loading && <p>Loading hosts…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {!loading && hosts.length === 0 && <p>No hosts configured.</p>}
      {hosts.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">URL</th>
                <th scope="col">Group</th>
                <th scope="col" className="text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((host) => (
                <tr key={host.id}>
                  <th scope="row">{host.name}</th>
                  <td>
                    <a href={host.url} target="_blank" rel="noreferrer">
                      {host.url}
                    </a>
                  </td>
                  <td>{host.groupName ?? '—'}</td>
                  <td className="text-end">
                    <div className="btn-group" role="group">
                      <Link className="btn btn-secondary" to={`/hosts/${host.id}`}>
                        Edit
                      </Link>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(host.id)}>
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
