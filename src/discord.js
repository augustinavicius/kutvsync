const axios = require('axios');
const logger = require('./logger');

function webhookUrl() {
  return process.env.DISCORD_WEBHOOK_URL;
}

async function postMessage(content) {
  const url = webhookUrl();
  if (!url) return;

  try {
    await axios.post(url, { content });
  } catch (err) {
    logger.error(`Discord notification failed: ${err.message}`);
  }
}

function formatSection(title, lines) {
  if (!lines.length) return '';
  return `\n\n**${title} (${lines.length})**\n` + lines.map((l) => `${l}`).join('\n');
}

async function notifySyncChanges({ created, updated, deleted }) {
  if (!created.length && !updated.length && !deleted.length) return;

  // <t:unix:f> renders as a localized date/time in each viewer's own timezone
  const syncedAt = `<t:${Math.floor(Date.now() / 1000)}:f>`;

  let message = `**Tvarkaraščio pakeitimai**\nSinchronizuota ${syncedAt}`
    + formatSection('Sukurti įvykiai', created.map(({ title, time }) => `„${title}" — ${time}`))
    + formatSection('Atnaujinti įvykiai', updated.map(({ title, oldTime, newTime }) => `„${title}"\n  Buvo: ${oldTime}\n  Dabar: ${newTime}`))
    + formatSection('Pašalinti įvykiai', deleted.map(({ title, time }) => `„${title}" — ${time}`));

  // Discord caps message content at 2000 characters
  if (message.length > 1900) {
    message = `${message.slice(0, 1900)}\n…(sutrumpinta)`;
  }

  await postMessage(message);
}

module.exports = { postMessage, notifySyncChanges };
