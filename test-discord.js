/**
 * Posts a sample "schedule changes synced" message through DISCORD_WEBHOOK_URL,
 * built the same way sync.js builds a real one — so you can preview exactly what
 * a created/updated/deleted notification looks like and confirm the webhook works.
 * Run: node test-discord.js
 */
require('dotenv').config();
const { notifySyncChanges } = require('./src/discord');

function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    console.error('Error: DISCORD_WEBHOOK_URL must be set in .env');
    process.exit(1);
  }

  console.log('Posting a sample "schedule changes synced" message to the configured Discord webhook...');

  await notifySyncChanges({
    created: [
      { title: 'Linear Algebra', start: at(1, 10), end: at(1, 11, 30) },
    ],
    updated: [
      {
        title: 'Database Systems',
        oldStart: at(2, 9),  oldEnd: at(2, 10, 30),
        newStart: at(2, 14), newEnd: at(2, 15, 30),
      },
    ],
    deleted: [
      { title: 'Old Seminar', start: at(3, 12), end: at(3, 13) },
    ],
  });

  console.log('Done. Check the Discord channel — it should look exactly like a real sync notification.');
}

main();
