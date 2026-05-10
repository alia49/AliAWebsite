import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createProfileSource } from './profile.js';

// Plain line logger. Request logs are intentionally absent: we don't record visitor IPs.
const logger = {
  info: (msg) => console.log(`${new Date().toISOString()} INFO  ${msg}`),
  warn: (msg) => console.warn(`${new Date().toISOString()} WARN  ${msg}`),
  error: (msg) => console.error(`${new Date().toISOString()} ERROR ${msg}`),
};

let config;
try {
  config = loadConfig();
} catch (err) {
  logger.error(`invalid configuration: ${err.message}`);
  process.exit(1);
}

const db = openDatabase(config.dbPath);
const anthropic = config.anthropicApiKey
  ? // The frontend gives up on /api/ask after 30 s; typical answers take a few seconds.
    new Anthropic({ apiKey: config.anthropicApiKey, timeout: 20_000, maxRetries: 1 })
  : null;
const profileSource = createProfileSource({ path: config.profilePath, logger });
const app = createApp({ config, db, anthropic, profileSource, logger });

const server = app.listen(config.port, () => {
  const { port } = server.address();
  const askState = !anthropic
    ? 'disabled (no ANTHROPIC_API_KEY)'
    : profileSource.get()
      ? `enabled (model ${config.anthropicModel}, ${config.askDailyLimit}/day)`
      : 'disabled (profile not available)';
  logger.info(`listening on http://localhost:${port}/api`);
  logger.info(`database: ${config.dbPath}`);
  logger.info(`allowed origins: ${config.allowedOrigins.join(', ') || '(none)'}`);
  logger.info(`ask: ${askState}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  const force = setTimeout(() => {
    logger.warn('forcing exit after 10s');
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close(() => {
    try {
      db.close();
    } catch (err) {
      logger.warn(`closing database: ${err.message}`);
    }
    logger.info('bye');
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
