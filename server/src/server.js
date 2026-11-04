import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { ensureRulesets } from './modules/tax/rulesets.js';
import { errorFields, logger } from './utils/logger.js';

try {
  await pool.query('SELECT 1');
} catch (err) {
  logger.error(`Cannot reach MySQL at ${env.db.host}:${env.db.port}. Start MySQL (XAMPP) and run: npm run db:init`, errorFields(err));
  process.exit(1);
}

await ensureRulesets();

if (env.scan.provider === 'none') {
  logger.warn('No malware scanner configured (SCAN_PROVIDER=none). Uploads are not scanned; set SCAN_PROVIDER=clamav before real use.');
}

const server = createApp().listen(env.port, () => logger.info(`Finora API listening on http://localhost:${env.port}`, { env: env.nodeEnv }));

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// A crashed process should be restarted by the supervisor, not limp on in an unknown state.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', errorFields(reason));
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception', errorFields(err));
  process.exit(1);
});
