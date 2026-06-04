# KU Calendar Sync

Syncs your Kaunas University timetable (`tvarkarasciai.ku.lt`) to Google Calendar automatically.

- Logs in and handles rotating session cookies
- Fetches reservations across a rolling 5-week window (1 week back, 4 weeks ahead)
- Creates, updates, and deletes Google Calendar events to match the timetable
- Runs forever, re-syncing on a configurable interval (default 60 min)

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose  
  *(or Node.js 20+ if you prefer running directly)*
- A Google Cloud project with the Calendar API enabled
- OAuth2 credentials for a **Desktop app** client

---

## Setup

### 1. Clone the repository

```bash
git clone <this-repo>
cd ku-calendar-sync
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Fill in your university credentials now — you'll add the Google tokens in the next step.

### 3. Create Google OAuth2 credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Library**
2. Search for **Google Calendar API** and enable it
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
4. Choose **Desktop app**, give it a name, click **Create**
5. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   ```
6. Under **OAuth consent screen**, add your Google account as a **Test user**

### 4. Get a refresh token

Run the one-time setup script (outside Docker so a browser can open):

```bash
npm install
npm run setup
```

A browser window opens. Authorize the app, then paste the printed `GOOGLE_REFRESH_TOKEN` into your `.env`.

> **Note:** If you see "Google hasn't verified this app", click **Advanced → Go to (app name)** — this is expected for personal OAuth2 apps.

### 5. (Optional) Pick a target calendar

By default events are written to your primary calendar. To use a dedicated calendar:

1. In Google Calendar, create a new calendar (e.g. "University")
2. Open its settings, copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`)
3. Add to `.env`:
   ```
   GOOGLE_CALENDAR_ID=abc123@group.calendar.google.com
   ```

---

## Running

### Docker (recommended)

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

### Without Docker

```bash
npm install
npm start
```

---

## Configuration reference

| Variable | Default | Description |
|---|---|---|
| `KU_USERNAME` | *(required)* | University portal username |
| `KU_PASSWORD` | *(required)* | University portal password |
| `GOOGLE_CLIENT_ID` | *(required)* | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | *(required)* | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | *(required)* | OAuth2 refresh token (from `npm run setup`) |
| `GOOGLE_CALENDAR_ID` | `primary` | Target Google Calendar ID |
| `TIMEZONE` | `Europe/Vilnius` | Timezone for formatting and calendar events |
| `SYNC_INTERVAL_MINUTES` | `60` | How often to sync |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |

---

## How it works

1. **Auth** — POSTs credentials to `/api/login`. The server rotates session cookies on every response; `tough-cookie` captures them automatically and replays them on every subsequent request. If a `401` is received mid-session, it re-authenticates transparently.

2. **Fetch** — Retrieves reservations for the sync window in paginated batches. Maps flexible field names (`title`/`name`/`subject`, `start`/`startTime`, etc.) so the code handles the API response regardless of exact key names.

3. **Sync** — Each Google Calendar event created by this tool carries a private extended property `kuReservationId`. At sync time:
   - Reservations missing from the calendar are **created**
   - Reservations where the title, time, or location changed are **updated**
   - Calendar events whose reservation no longer exists in the API window are **deleted**

---

## Troubleshooting

**Login fails** — Double-check `KU_USERNAME` / `KU_PASSWORD`. The API may use `email` instead of `username`; if needed, open `src/auth.js` and change the login payload keys.

**Google auth errors** — Re-run `npm run setup` to get a fresh refresh token. Make sure your account is listed as a test user on the OAuth consent screen.

**Events not appearing** — Set `LOG_LEVEL=debug` to see raw API responses and confirm the reservation fields are mapped correctly.

**Fields not mapped** — Open `src/schedule.js` → `mapReservationToEvent` and adjust the field name fallback chains to match the actual API response keys.
