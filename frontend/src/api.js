export async function api(path, { signal, method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: 'same-origin',
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The server is unavailable. Please try again.' }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw Object.assign(new Error(data.error || 'Request failed'), { status: response.status });
  }
  return data;
}
