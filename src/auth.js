const https = require('https');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const axios = require('axios');
const logger = require('./logger');

const BASE_URL = 'https://tvarkarasciai.ku.lt';

// KU's server omits its intermediate CA (GEANT TLS RSA 1); supply the chain explicitly.
const httpsAgent = new https.Agent({
  ca: [
    fs.readFileSync(path.join(__dirname, '..', 'certs', 'harica-chain.pem')),
    ...tls.rootCertificates,
  ],
});

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'KU-Calendar-Sync/1.0',
    // Laravel Sanctum requires Origin to treat requests as first-party (stateful session)
    Origin: BASE_URL,
    Referer: `${BASE_URL}/`,
  },
});

// Simple cookie jar: strips attributes, keeps name=value pairs, handles rotation.
let cookieJar = '';

function absorbSetCookie(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return;
  const incoming = (Array.isArray(raw) ? raw : [raw])
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean);
  if (!incoming.length) return;

  const jar = new Map(
    cookieJar
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => [c.split('=')[0].trim(), c])
  );
  incoming.forEach((c) => jar.set(c.split('=')[0].trim(), c));
  cookieJar = [...jar.values()].join('; ');
  logger.debug(`Cookie jar: ${cookieJar.substring(0, 80)}…`);
}

function getXsrfToken() {
  const entry = cookieJar
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('XSRF-TOKEN='));
  if (!entry) return null;
  return decodeURIComponent(entry.slice('XSRF-TOKEN='.length));
}

// Send cookies and XSRF token on every request.
client.interceptors.request.use((config) => {
  if (cookieJar) config.headers = { ...config.headers, Cookie: cookieJar };
  const xsrf = getXsrfToken();
  if (xsrf) config.headers = { ...config.headers, 'X-XSRF-TOKEN': xsrf };
  return config;
});

// Absorb cookies from every response.
client.interceptors.response.use(
  (res) => { absorbSetCookie(res.headers); return res; },
  async (err) => {
    if (err.response) absorbSetCookie(err.response.headers);
    if (err.response?.status === 401 && !err.config._retried) {
      logger.warn('Session expired — re-authenticating...');
      authenticated = false;
      err.config._retried = true;
      await login();
      return client.request(err.config);
    }
    return Promise.reject(err);
  }
);

let authenticated = false;

async function login() {
  const { KU_USERNAME, KU_PASSWORD } = process.env;
  if (!KU_USERNAME || !KU_PASSWORD) {
    throw new Error('KU_USERNAME and KU_PASSWORD environment variables are required');
  }

  logger.info('Authenticating with university API...');

  // Step 1: Fetch CSRF cookie — Laravel Sanctum requires this before login.
  await client.get('/sanctum/csrf-cookie');
  logger.debug(`XSRF token after csrf-cookie: ${getXsrfToken()?.substring(0, 20)}…`);

  // Step 2: Login — X-XSRF-TOKEN is injected automatically by the request interceptor.
  await client.post('/api/login', { uid: KU_USERNAME, password: KU_PASSWORD });

  authenticated = true;
  logger.info('Authentication successful');
}

async function ensureAuthenticated() {
  if (!authenticated) await login();
}

module.exports = { client, login, ensureAuthenticated };
