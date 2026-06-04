require('dotenv').config();
const { runSync } = require('./sync');
const logger = require('./logger');

const INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function validateEnv() {
  const required = [
    'KU_USERNAME',
    'KU_PASSWORD',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function tick() {
  try {
    await runSync();
  } catch (err) {
    logger.error(`Sync failed: ${err.message}`);
    if (err.response?.data) {
      logger.error(`API response: ${JSON.stringify(err.response.data)}`);
    }
  }
}

async function main() {
  logger.info('KU Calendar Sync starting...');
  validateEnv();
  logger.info(`Sync interval: every ${INTERVAL_MINUTES} minute(s)`);

  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
