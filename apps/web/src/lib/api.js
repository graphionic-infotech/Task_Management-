// Token is kept in localStorage and sent as Authorization header on every
// request. This works even where third-party cookies are blocked (embedded
// previews/iframes). The httpOnly cookie session still works as a fallback.
export function getToken() { try { return localStorage.getItem('gt_token'); } catch { return null; } }
export function setToken(t) { try { t ? localStorage.setItem('gt_token', t) : localStorage.removeItem('gt_token'); } catch {} }

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const tok = getToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const res = await fetch(path, {
    credentials: 'include',
    ...opts,
    headers,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401) {
    setToken(null);
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data?.data;
}
export const fmtUser = (u) => u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : '—';

export async function downloadFile(url, defaultFilename = 'document.pdf') {
  const tok = getToken();
  const headers = {};
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to download document');
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}
