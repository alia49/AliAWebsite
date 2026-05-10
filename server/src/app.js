import express from 'express';
import { createAskRouter } from './ask.js';
import { createChatRouter } from './chat.js';
import { resolveSalt } from './db.js';
import { cors, securityHeaders, sendError } from './http.js';
import { createIdentity } from './identity.js';
import { createPresence } from './presence.js';

export const silentLogger = { info() {}, warn() {}, error() {} };

/**
 * Builds the Express app. Everything with side effects is injected so tests can control it:
 *   config        - from loadConfig()
 *   db            - an open node:sqlite DatabaseSync (see openDatabase)
 *   anthropic     - an @anthropic-ai/sdk client (or a mock), or null to disable /api/ask
 *   profileSource - { get(): { profile, systemPrompt } | null }
 *   now           - clock in ms (defaults to Date.now)
 *   limits        - optional overrides: { chatIp, askIp, presenceTtlMs }
 */
export function createApp({ config, db, anthropic = null, profileSource, now = Date.now, logger = console, limits = {} }) {
  const salt = resolveSalt(db, config.clientIdSalt);
  const identity = createIdentity(salt);
  const presence = createPresence({ now, ttlMs: limits.presenceTtlMs ?? 45_000 });

  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders);
  app.use(cors(config.allowedOrigins));

  const api = express.Router();

  api.get('/health', (req, res) => {
    res.json({
      ok: true,
      features: { chat: true, presence: true, ask: Boolean(anthropic && profileSource.get()) },
    });
  });

  api.use(createChatRouter({ db, identity, now, ipLimit: limits.chatIp }));

  api.post('/presence', (req, res) => {
    const me = identity.fromRequest(req);
    if (!me) return sendError(res, 400, 'no_client');
    res.json(presence.heartbeat(me));
  });

  api.use(
    createAskRouter({
      db,
      anthropic,
      model: config.anthropicModel,
      dailyLimit: config.askDailyLimit,
      profileSource,
      now,
      logger,
      ipLimit: limits.askIp,
    }),
  );

  app.use('/api', api);

  app.use((req, res) => sendError(res, 404, 'not_found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return sendError(res, 400, 'bad_json');
    logger.error(`[http] unhandled error on ${req.method} ${req.path}: ${err?.stack ?? err}`);
    if (res.headersSent) return res.end();
    sendError(res, 500, 'internal');
  });

  return app;
}
