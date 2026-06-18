const axios = require('axios');
const logger = require('./logger');

const WEEKDAY_FMT = new Intl.DateTimeFormat('lt-LT', { weekday: 'long' });

// e.g. "Antradienis, 09/06/2026, 09:00–10:30"
function formatRange(start, end) {
  const weekday = WEEKDAY_FMT.format(start);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const hhmm = (d) => d.toTimeString().slice(0, 5);
  return `${capitalized}, ${dd}/${mm}/${start.getFullYear()}, ${hhmm(start)}–${hhmm(end)}`;
}

async function postMessage(content) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    await axios.post(url, { content });
  } catch (err) {
    logger.error(`Discord notification failed: ${err.message}`);
  }
}

function formatSection(title, lines) {
  if (!lines.length) return '';
  return `\n\n**${title} (${lines.length})**\n` + lines.join('\n');
}

async function notifySyncChanges({ created, updated, deleted }) {
  if (!created.length && !updated.length && !deleted.length) return;

  // <t:unix:f> renders as a localized date/time in each viewer's own timezone
  const syncedAt = `<t:${Math.floor(Date.now() / 1000)}:f>`;

  let message = `**Tvarkaraščio pakeitimai**\nSinchronizuota ${syncedAt}`
    + formatSection('Sukurti įvykiai',   created.map(({ title, start, end }) =>
        `„${title}" — ${formatRange(start, end)}`))
    + formatSection('Atnaujinti įvykiai', updated.map(({ title, oldStart, oldEnd, newStart, newEnd }) =>
        `„${title}"\n  Buvo: ${formatRange(oldStart, oldEnd)}\n  Dabar: ${formatRange(newStart, newEnd)}`))
    + formatSection('Pašalinti įvykiai',  deleted.map(({ title, start, end }) =>
        `„${title}" — ${formatRange(start, end)}`));

  // Discord caps message content at 2000 characters
  if (message.length > 1900) {
    message = `${message.slice(0, 1900)}\n…(sutrumpinta)`;
  }

  await postMessage(message);
}

module.exports = { postMessage, notifySyncChanges, formatRange };
