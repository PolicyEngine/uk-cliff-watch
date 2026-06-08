export const API_ORIGIN =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_ORIGIN) ||
  'http://127.0.0.1:8000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getMetadata() {
  return apiFetch('/api/metadata');
}

export async function calculate(payload) {
  return apiFetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function series(payload) {
  return apiFetch('/api/series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function regions(payload) {
  return apiFetch('/api/regions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function households(payload) {
  return apiFetch('/api/households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
