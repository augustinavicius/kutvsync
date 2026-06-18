const { fetchReservations, mapReservationToEvent } = require('./schedule');
const {
  listManagedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  hasChanged,
  RESERVATION_ID_KEY,
} = require('./calendar');
const { notifySyncChanges } = require('./discord');
const logger = require('./logger');

// Sync window: 1 week back → 4 weeks ahead
function getSyncWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 35);

  return { start, end };
}

async function runSync() {
  const { start, end } = getSyncWindow();
  logger.info(`Sync window: ${start.toDateString()} → ${end.toDateString()}`);

  const [rawReservations, gcalEvents] = await Promise.all([
    fetchReservations(start, end),
    listManagedEvents(start, end),
  ]);

  const reservations = rawReservations.map(mapReservationToEvent);

  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const gcalByReservationId = new Map(
    gcalEvents
      .filter((e) => e.extendedProperties?.private?.[RESERVATION_ID_KEY])
      .map((e) => [e.extendedProperties.private[RESERVATION_ID_KEY], e])
  );

  const created = [], updated = [], deleted = [];

  for (const [id, reservation] of reservationById) {
    const existing = gcalByReservationId.get(id);
    if (!existing) {
      await createEvent(reservation);
      created.push({ title: reservation.title, start: reservation.start, end: reservation.end });
    } else if (hasChanged(existing, reservation)) {
      await updateEvent(existing.id, reservation);
      updated.push({
        title: reservation.title,
        oldStart: new Date(existing.start?.dateTime ?? existing.start?.date),
        oldEnd:   new Date(existing.end?.dateTime   ?? existing.end?.date),
        newStart: reservation.start,
        newEnd:   reservation.end,
      });
    }
  }

  for (const [id, gcalEvent] of gcalByReservationId) {
    if (!reservationById.has(id)) {
      await deleteEvent(gcalEvent.id, gcalEvent.summary);
      deleted.push({
        title: gcalEvent.summary,
        start: new Date(gcalEvent.start?.dateTime ?? gcalEvent.start?.date),
        end:   new Date(gcalEvent.end?.dateTime   ?? gcalEvent.end?.date),
      });
    }
  }

  logger.info(`Sync complete — created: ${created.length}, updated: ${updated.length}, deleted: ${deleted.length}`);

  await notifySyncChanges({ created, updated, deleted });
}

module.exports = { runSync };
