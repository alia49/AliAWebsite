import express from 'express';

/** Every error response is `{ "error": code, ...extra }`. */
export function sendError(res, status, code, extra = {}) {
  if (typeof extra.retryAfter === 'number') res.set('Retry-After', String(extra.retryAfter));
  return res.status(status).json({ error: code, ...extra });
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * JSON body parser with a size limit whose failures map onto the API's error codes.
 * `tooLargeCode` lets each route report an oversized body with a code from its own contract
 * (e.g. "too_long" for chat, "bad_question" for ask).
 */
export function jsonBody({ limit, tooLargeCode }) {
  const parser = express.json({ limit });
  return (req, res, next) =>
    parser(req, res, (err) => {
      if (!err) return next();
      if (err.type === 'entity.too.large') return sendError(res, 400, tooLargeCode);
      if (err.type === 'entity.parse.failed') return sendError(res, 400, 'bad_json');
      return sendError(res, 400, 'bad_request');
    });
}

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=15552000',
    'Cache-Control': 'no-store',
  });
  next();
}

/** CORS for an allow-list of exact origins ("*" allows any). Answers preflights itself. */
export function cors(allowedOrigins) {
  const allowAny = allowedOrigins.includes('*');
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    const ok = typeof origin === 'string' && (allowAny || allowed.has(origin));
    res.vary('Origin');
    if (ok) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Expose-Headers', 'Retry-After');
    }
    if (req.method === 'OPTIONS' && req.get('access-control-request-method')) {
      if (!ok) return sendError(res, 403, 'origin_not_allowed');
      res.set({
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
        'Access-Control-Max-Age': '600',
      });
      return res.status(204).end();
    }
    next();
  };
}

/** Client IP for in-memory rate limiting only (never stored or logged). Honour TRUST_PROXY. */
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
