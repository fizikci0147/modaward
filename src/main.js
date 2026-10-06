import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { createServer } from './bootstrap.js';

const config = loadConfig();
const log = createLogger({ level: config.production ? 'info' : 'debug' });

process.on('unhandledRejection', (reason) => log.error('unhandled_rejection', { message: String(reason?.message ?? reason) }));
process.on('uncaughtException', (err) => {
  log.error('uncaught_exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

const { app, deps } = await createServer(config, { log });

const server = app.listen(config.port, config.host, () => {
  log.info('server.started', {
    version: config.version,
    port: config.port,
    node: process.version,
    db: deps.db.driver,
    dataDir: config.dataDir,
    weather: config.weather.provider,
    ai: Boolean(config.ai.apiKey),
    stripe: Boolean(config.stripe.secretKey),
    smtp: deps.mailer.configured
  });
});

// housekeeping: expired sessions and AI cache
const sweep = setInterval(() => {
  try {
    deps.repos.sessions.purgeExpired();
    deps.codes.sweep();
    deps.db.run('DELETE FROM ai_cache WHERE expires_at < ?', Math.floor(Date.now() / 1000));
  } catch (e) {
    log.warn('sweep.failed', { message: e.message });
  }
}, 3_600_000);
sweep.unref();

function shutdown(signal) {
  log.info('server.stopping', { signal });
  server.close(() => {
    clearInterval(sweep);
    deps.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
