// Client for the optional backend (see docs/redesign-plan.md §3).
// Every feature that uses it must degrade gracefully when REACT_APP_API_URL is
// unset or the API is unreachable.
import { readStore, writeStore } from './storage';

const VISITOR_KEY = 'visitorId';
const DEFAULT_TIMEOUT = 10000;

/** `${REACT_APP_API_URL}/api`, or '' when no backend is configured. Read at call time. */
export function apiBase() {
  const raw = (process.env.REACT_APP_API_URL || '').trim();
  return raw ? `${raw.replace(/\/+$/, '')}/api` : '';
}

export const hasApi = () => apiBase() !== '';

function randomUUID() {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let memoryVisitorId = null;

/** Random per-browser id, stored in localStorage and sent as X-Client-Id. */
export function getVisitorId() {
  const stored = readStore(VISITOR_KEY);
  if (stored && /^[0-9a-f-]{16,64}$/i.test(stored)) return stored;
  if (!memoryVisitorId) memoryVisitorId = randomUUID();
  writeStore(VISITOR_KEY, memoryVisitorId);
  return memoryVisitorId;
}

export class ApiError extends Error {
  constructor(status, code, data = {}) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * fetch wrapper: JSON in/out, X-Client-Id header, timeout, and uniform errors.
 * Throws ApiError with code 'offline' (no API configured), 'network', 'timeout',
 * or the server's `{ error }` code.
 */
export async function apiFetch(path, { method = 'GET', body, signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError(0, 'offline');
  if (typeof fetch !== 'function') throw new ApiError(0, 'network');

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const headers = { 'X-Client-Id': getVisitorId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
    });
  } catch {
    if (signal && signal.aborted) throw new ApiError(0, 'aborted');
    throw new ApiError(0, timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const code = (data && typeof data.error === 'string' && data.error) || `http_${res.status}`;
    throw new ApiError(res.status, code, data || {});
  }
  return data;
}

// ---- endpoints -------------------------------------------------------------

export const getHealth = (opts) => apiFetch('/health', { timeout: 6000, ...opts });

export const getChat = (after, opts) =>
  apiFetch(after ? `/chat?after=${encodeURIComponent(after)}` : '/chat', opts);
export const postChat = (name, body) => apiFetch('/chat', { method: 'POST', body: { name, body } });
export const patchChat = (id, body) =>
  apiFetch(`/chat/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body } });
export const deleteChat = (id) => apiFetch(`/chat/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getChatIdentity = (opts) => apiFetch('/chat/identity', opts);

export const postPresence = (opts) => apiFetch('/presence', { method: 'POST', ...opts });

export const postAsk = (question, history, opts) =>
  apiFetch('/ask', { method: 'POST', body: { question, history }, timeout: 30000, ...opts });

// ---- health (cached for the session) --------------------------------------

const OFFLINE = Object.freeze({ ok: false, features: {} });
let healthPromise = null;

/** Resolves to { ok, features: { chat, presence, ask } }; never rejects. */
export function fetchHealth({ force = false } = {}) {
  if (!hasApi()) return Promise.resolve(OFFLINE);
  if (!healthPromise || force) {
    healthPromise = getHealth()
      .then((data) => ({
        ok: Boolean(data && data.ok),
        features: (data && data.features) || {},
      }))
      .catch(() => {
        healthPromise = null; // allow a retry next time
        return OFFLINE;
      });
  }
  return healthPromise;
}

export function resetHealthCache() {
  healthPromise = null;
}
