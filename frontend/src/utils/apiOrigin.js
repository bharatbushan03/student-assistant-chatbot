/**
 * API origin for split deploys.
 * Empty during local Vite dev so requests stay relative and the dev proxy can forward them.
 * On Vercel, set VITE_API_URL to the Render service URL with no trailing slash.
 */
export function getApiOrigin() {
  const configured = import.meta.env.VITE_API_URL || '';
  return String(configured).trim().replace(/\/+$/, '');
}

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${normalized}`;
}
