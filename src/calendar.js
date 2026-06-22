const { google } = require('googleapis');
const gaxios = require('gaxios');
const logger = require('./logger');

// googleapis 144 ships node-fetch v2, which throws ERR_STREAM_PREMATURE_CLOSE
// decoding Google's gzip'd responses on modern Node. Use Node's native fetch
// (undici) instead, which decodes them correctly.
const nativeFetch = (...args) => fetch(...args);
gaxios.instance.defaults.fetchImplementation = nativeFetch;

const SYNC_TAG = 'ku-calendar-sync';
const RESERVATION_ID_KEY = 'kuReservationId';
const TIMEZONE = () => process.env.TZ || 'Europe/Vilnius';
const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID || 'primary';

function makeOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  client.transporter.defaults.fetchImplementation = nativeFetch;
  return client;
}

function cal() {
  return google.calendar({ version: 'v3', auth: makeOAuth2Client() });
}

async function listManagedEvents(startDate, endDate) {
  const events = [];
  let pageToken;

  do {
    const res = await cal().events.list({
      calendarId: CALENDAR_ID(),
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      privateExtendedProperty: `source=${SYNC_TAG}`,
      maxResults: 250,
      singleEvents: true,
      pageToken,
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
}

function buildResource(reservation) {
  return {
    summary: reservation.title,
    description: reservation.description || '',
    location: reservation.location || '',
    start: { dateTime: reservation.start.toISOString(), timeZone: TIMEZONE() },
    end: { dateTime: reservation.end.toISOString(), timeZone: TIMEZONE() },
    extendedProperties: {
      private: {
        [RESERVATION_ID_KEY]: reservation.id,
        source: SYNC_TAG,
      },
    },
  };
}

async function createEvent(reservation) {
  await cal().events.insert({
    calendarId: CALENDAR_ID(),
    requestBody: buildResource(reservation),
  });
  logger.info(`  + Created  "${reservation.title}" on ${reservation.start.toDateString()}`);
}

async function updateEvent(gcalEventId, reservation) {
  await cal().events.update({
    calendarId: CALENDAR_ID(),
    eventId: gcalEventId,
    requestBody: buildResource(reservation),
  });
  logger.info(`  ~ Updated  "${reservation.title}" on ${reservation.start.toDateString()}`);
}

async function deleteEvent(gcalEventId, summary) {
  await cal().events.delete({
    calendarId: CALENDAR_ID(),
    eventId: gcalEventId,
  });
  logger.info(`  - Deleted  "${summary}"`);
}

function hasChanged(gcalEvent, reservation) {
  const gcalStart = new Date(gcalEvent.start?.dateTime ?? gcalEvent.start?.date);
  const gcalEnd = new Date(gcalEvent.end?.dateTime ?? gcalEvent.end?.date);
  const MINUTE = 60_000;

  return (
    gcalEvent.summary !== reservation.title ||
    Math.abs(gcalStart - reservation.start) > MINUTE ||
    Math.abs(gcalEnd - reservation.end) > MINUTE ||
    (gcalEvent.location ?? '') !== (reservation.location ?? '') ||
    (gcalEvent.description ?? '') !== (reservation.description ?? '')
  );
}

module.exports = {
  listManagedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  hasChanged,
  RESERVATION_ID_KEY,
};
