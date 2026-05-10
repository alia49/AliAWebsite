import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the server/ directory. Relative paths in config resolve against it. */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULTS = Object.freeze({
  port: 8787,
  allowedOrigins: ['http://localhost:3000', 'https://alia49.github.io'],
  dbPath: './data/site.db',
  profilePath: '../src/content/profile.json',
  // Per the claude-api skill guidance. Override with ANTHROPIC_MODEL (e.g. claude-haiku-4-5
  // or claude-sonnet-5) if you want a cheaper model; see README "Cost".
  anthropicModel: 'claude-opus-5',
  askDailyLimit: 300,
});

function blankToUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseInteger(raw, fallback, name, { min, max }) {
  const value = blankToUndefined(raw);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number, got "${value}"`);
  const n = Number(value);
  if (n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}, got ${n}`);
  return n;
}

/** Mirrors Express's "trust proxy" setting: true/false, a hop count, or an address/subnet list. */
export function parseTrustProxy(raw) {
  const value = blankToUndefined(raw);
  if (value === undefined) return false;
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function parseOrigins(raw) {
  const value = blankToUndefined(raw);
  if (value === undefined) return [...DEFAULTS.allowedOrigins];
  return value
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function resolveFromServerRoot(p) {
  if (p === ':memory:') return p;
  return path.resolve(SERVER_ROOT, p);
}

export function loadConfig(env = process.env) {
  return {
    port: parseInteger(env.PORT, DEFAULTS.port, 'PORT', { min: 0, max: 65535 }),
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    dbPath: resolveFromServerRoot(blankToUndefined(env.DB_PATH) ?? DEFAULTS.dbPath),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    clientIdSalt: blankToUndefined(env.CLIENT_ID_SALT) ?? null,
    profilePath: resolveFromServerRoot(blankToUndefined(env.PROFILE_PATH) ?? DEFAULTS.profilePath),
    anthropicApiKey: blankToUndefined(env.ANTHROPIC_API_KEY) ?? null,
    anthropicModel: blankToUndefined(env.ANTHROPIC_MODEL) ?? DEFAULTS.anthropicModel,
    askDailyLimit: parseInteger(env.ASK_DAILY_LIMIT, DEFAULTS.askDailyLimit, 'ASK_DAILY_LIMIT', {
      min: 0,
      max: 1_000_000,
    }),
  };
}
