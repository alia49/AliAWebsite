import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { clientIp, isPlainObject, jsonBody, sendError } from './http.js';
import { charLength } from './moderation.js';
import { createRateLimiter } from './rateLimit.js';

export const ASK_LIMITS = Object.freeze({
  questionMax: 500,
  historyTurns: 6,
  historyContentMax: 1000,
  // Hard cap on thinking + answer tokens per request. Answers are asked to stay under ~120 words
  // (~200 tokens); the headroom covers the model's brief adaptive thinking at low effort.
  maxTokens: 1024,
});

// Server-side refusal fallbacks ("default" routes by refusal category). Only sent for models
// documented to accept it; other models are called without it.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MODELS_WITH_DEFAULT_FALLBACKS = new Set(['claude-opus-5', 'claude-fable-5-1']);

/** `output_config.effort` errors on Haiku 4.5, Sonnet 4.5 and older models; omit it there. */
export function supportsEffort(model) {
  return !/haiku|claude-3|^claude-(?:sonnet|opus)-4(?:-[01])?(?:-\d{8})?$|^claude-sonnet-4-5/.test(model);
}

export function supportsDefaultFallbacks(model) {
  return MODELS_WITH_DEFAULT_FALLBACKS.has(model);
}

/** Returns { question, history } or null (→ 400 bad_question). */
export function validateAskInput(input) {
  if (!isPlainObject(input)) return null;
  if (typeof input.question !== 'string') return null;
  const question = input.question.trim();
  const qLen = charLength(question);
  if (qLen < 1 || qLen > ASK_LIMITS.questionMax) return null;

  const rawHistory = input.history ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > ASK_LIMITS.historyTurns) return null;
  const history = [];
  for (const turn of rawHistory) {
    if (!isPlainObject(turn)) return null;
    if (turn.role !== 'user' && turn.role !== 'assistant') return null;
    if (typeof turn.content !== 'string') return null;
    const content = turn.content.trim();
    const len = charLength(content);
    if (len < 1 || len > ASK_LIMITS.historyContentMax) return null;
    history.push({ role: turn.role, content });
  }
  return { question, history };
}

/** Builds the Messages API request. Exported for tests. */
export function buildAskRequest({ model, systemPrompt, history, question }) {
  const messages = [...history, { role: 'user', content: question }];
  // The API requires the first message to be from the user; drop a leading greeting etc.
  while (messages[0].role !== 'user') messages.shift();

  const params = {
    model,
    max_tokens: ASK_LIMITS.maxTokens,
    // The system prompt is identical across requests for a given profile, so cache it.
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  // Short, grounded Q&A doesn't need deep thinking; low effort is the main cost/latency lever.
  if (supportsEffort(model)) params.output_config = { effort: 'low' };
  return params;
}

function describeUpstreamError(err) {
  const id = err?.requestID ? ` request_id=${err.requestID}` : '';
  if (err instanceof Anthropic.AuthenticationError) return `authentication failed; check ANTHROPIC_API_KEY${id}`;
  if (err instanceof Anthropic.PermissionDeniedError) return `permission denied${id}`;
  if (err instanceof Anthropic.NotFoundError) return `not found; check ANTHROPIC_MODEL${id}`;
  if (err instanceof Anthropic.BadRequestError) return `bad request: ${err.message}${id}`;
  if (err instanceof Anthropic.RateLimitError) return `rate limited by Anthropic${id}`;
  if (err instanceof Anthropic.InternalServerError) return `Anthropic server error ${err.status}${id}`;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'request timed out';
  if (err instanceof Anthropic.APIConnectionError) return 'network error reaching the API';
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}${id}`;
  return err?.message ?? String(err);
}

function secondsUntilNextUtcMidnight(t) {
  const d = new Date(t);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - t) / 1000));
}

export function createAskRouter({
  db,
  anthropic,
  model,
  dailyLimit,
  profileSource,
  now,
  logger,
  ipLimit = { limit: 10, windowMs: 10 * 60_000 },
}) {
  const router = express.Router();
  const ipLimiter = createRateLimiter({ ...ipLimit, now });
  const parseJson = jsonBody({ limit: '32kb', tooLargeCode: 'bad_question' });

  // Global daily budget, persisted so restarts (or a sleeping free-tier dyno) don't reset it.
  const usage = {
    get: db.prepare('SELECT count FROM ask_usage WHERE day = ?'),
    bump: db.prepare(
      'INSERT INTO ask_usage (day, count) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET count = count + 1',
    ),
    prune: db.prepare('DELETE FROM ask_usage WHERE day < ?'),
  };

  function consumeDaily(t) {
    const day = new Date(t).toISOString().slice(0, 10);
    const used = usage.get.get(day)?.count ?? 0;
    if (used >= dailyLimit) return false;
    usage.bump.run(day);
    usage.prune.run(new Date(t - 30 * 86_400_000).toISOString().slice(0, 10));
    return true;
  }

  router.post('/ask', parseJson, async (req, res) => {
    const grounding = anthropic ? profileSource.get() : null;
    if (!anthropic || !grounding) return sendError(res, 503, 'ask_disabled');

    const input = validateAskInput(req.body);
    if (!input) return sendError(res, 400, 'bad_question');

    const perIp = ipLimiter.consume(clientIp(req));
    if (!perIp.ok) return sendError(res, 429, 'rate_limited', { retryAfter: perIp.retryAfter });
    const t = now();
    if (!consumeDaily(t)) {
      return sendError(res, 429, 'rate_limited', { retryAfter: secondsUntilNextUtcMidnight(t) });
    }

    const params = buildAskRequest({ model, systemPrompt: grounding.systemPrompt, ...input });
    let response;
    try {
      response = supportsDefaultFallbacks(model)
        ? await anthropic.beta.messages.create({ ...params, betas: [FALLBACK_BETA], fallbacks: 'default' })
        : await anthropic.messages.create(params);
    } catch (err) {
      logger.error(`[ask] upstream failure: ${describeUpstreamError(err)}`);
      return sendError(res, 502, 'upstream');
    }

    const u = response?.usage;
    if (u) {
      logger.info(
        `[ask] ok model=${response.model ?? model} stop=${response.stop_reason} in=${u.input_tokens} ` +
          `out=${u.output_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0}`,
      );
    }

    // Classifier or model refusal (after any server-side fallback): answer politely, don't fail.
    if (response?.stop_reason === 'refusal') {
      const { profile } = grounding;
      const first = String(profile.name).trim().split(/\s+/)[0];
      const email = typeof profile.email === 'string' && profile.email.trim() ? ` or email ${profile.email.trim()}` : '';
      return res.json({
        answer: `Sorry, I can't help with that one. Try asking about ${first}'s projects or experience${email}.`,
      });
    }

    const answer = (Array.isArray(response?.content) ? response.content : [])
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!answer) {
      logger.error(`[ask] upstream returned no text (stop_reason=${response?.stop_reason})`);
      return sendError(res, 502, 'upstream');
    }
    if (response.stop_reason === 'max_tokens') logger.warn('[ask] answer hit max_tokens and may be cut short');
    res.json({ answer });
  });

  return router;
}
