import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { requestJson } from '../apiClient.js';
import ui from '../styles/ui.module.css';

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
      <header className={ui.pageHeader}>
        <h2 id="hosts-heading" className={ui.pageTitle}>
          Hosts
        </h2>
        <Link className={`${ui.button} ${ui.buttonPrimary}`} to="/hosts/new">
          Add host
        </Link>
      </header>
      {loading && <p>Loading hosts…</p>}
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          {error}
        </div>
      )}
      {!loading && hosts.length === 0 && <p>No hosts configured.</p>}
      {hosts.length > 0 && (
        <div className={ui.tableWrapper}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">URL</th>
                <th scope="col">Group</th>
                <th scope="col" className={ui.tableCellNumeric}>
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
                  <td className={ui.tableCellNumeric}>
                    <div className={ui.buttonGroup} role="group">
                      <Link className={`${ui.button} ${ui.buttonSecondary}`} to={`/hosts/${host.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={`${ui.button} ${ui.buttonDanger}`}
                        onClick={() => handleDelete(host.id)}
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
