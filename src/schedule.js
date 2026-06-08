const { client, ensureAuthenticated } = require('./auth');
const logger = require('./logger');

const TIMEZONE = process.env.TZ || 'Europe/Vilnius';

// Format a Date as YYYY-MM-DDTHH:mm:ss±HH:MM (required by the KU API)
function toLocalISOString(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value])
  );

  const offsetPart = new Intl.DateTimeFormat('en', {
    timeZone: TIMEZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value || 'GMT+3';

  const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offset = '+03:00';
  if (match) {
    const sign = match[1];
    const h = String(parseInt(match[2])).padStart(2, '0');
    const m = String(parseInt(match[3] || '0')).padStart(2, '0');
    offset = `${sign}${h}:${m}`;
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

async function fetchReservations(startDate, endDate) {
  await ensureAuthenticated();

  const startStr = toLocalISOString(startDate);
  const endStr = toLocalISOString(endDate);

  let allReservations = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      start: startStr,
      end: endStr,
      showUserReservations: '0',
      page: String(page),
      per_page: '100',
    });

    logger.debug(`Fetching reservations page ${page}...`);
    const { data } = await client.get(`/api/reservations?${params.toString()}`);

    // Handle both plain array and paginated object responses
    const items = Array.isArray(data)
      ? data
      : data.data ?? data.items ?? data.reservations ?? [];

    allReservations = allReservations.concat(items);

    const total = data.total ?? data.count ?? null;
    const perPage = data.per_page ?? 100;

    if (Array.isArray(data) || items.length < perPage || (total !== null && allReservations.length >= total)) {
      break;
    }
    page++;
  }

  logger.info(`Fetched ${allReservations.length} reservation(s)`);
  return allReservations;
}

function mapReservationToEvent(r) {
  const id = String(r.id ?? r.reservationId ?? r._id ?? '');
  const title =
    r.title ?? r.name ?? r.subject ?? r.courseName ?? r.eventName ?? 'University Event';
  const start = new Date(r.start ?? r.startTime ?? r.startDate ?? r.from);
  const end = new Date(r.end ?? r.endTime ?? r.endDate ?? r.to);
  const location = r.location ?? r.reservable_name ?? r.reservable?.name ?? r.room ?? r.roomName ?? r.place ?? '';

  const descLines = [];
  if (r.type) descLines.push(`Type: ${r.type}`);
  if (r.lecturer ?? r.teacher) descLines.push(`Lecturer: ${r.lecturer ?? r.teacher}`);
  if (r.group ?? r.groups) descLines.push(`Group: ${r.group ?? r.groups}`);
  if (r.description) descLines.push(r.description);

  return { id, title, start, end, location, description: descLines.join('\n') };
}

module.exports = { fetchReservations, mapReservationToEvent };
