/**
 * Posts a sample "schedule changes synced" message through DISCORD_WEBHOOK_URL,
 * built the same way sync.js builds a real one — so you can preview exactly what
 * a created/updated/deleted notification looks like and confirm the webhook works.
 * Run: node test-discord.js
 */
require('dotenv').config();
const { notifySyncChanges } = require('./src/discord');

// Mirrors formatRange() in src/sync.js — e.g. "Antradienis, 09/06/2026, 09:00–10:30"
function formatRange(start, end) {
  const weekday = new Intl.DateTimeFormat('lt-LT', { weekday: 'long' }).format(start);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const time = (d) => d.toTimeString().slice(0, 5);
  return `${capitalized}, ${dd}/${mm}/${start.getFullYear()}, ${time(start)}–${time(end)}`;
}

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
      { title: 'Linear Algebra', time: formatRange(at(1, 10), at(1, 11, 30)) },
    ],
    updated: [
      {
        title: 'Database Systems',
        oldTime: formatRange(at(2, 9), at(2, 10, 30)),
        newTime: formatRange(at(2, 14), at(2, 15, 30)),
      },
    ],
    deleted: [
      { title: 'Old Seminar', time: formatRange(at(3, 12), at(3, 13)) },
    ],
  });

  console.log('Done. Check the Discord channel — it should look exactly like a real sync notification.');
}

main();
