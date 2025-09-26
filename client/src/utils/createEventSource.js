export function createEventSource(url) {
  if (typeof EventSource !== 'function') {
    throw new Error('EventSource is not supported in this environment');
  }

  try {
    return new EventSource(url, { withCredentials: true });
  } catch (_err) {
    return new EventSource(url);
  }
}
