/**
 * One-time Google OAuth2 setup.
 * Run: node setup.js
 * Paste the printed GOOGLE_REFRESH_TOKEN into your .env file.
 */
require('dotenv').config();
const { google } = require('googleapis');
const gaxios = require('gaxios');
const http = require('http');

// node-fetch v2 (bundled with googleapis 144) throws ERR_STREAM_PREMATURE_CLOSE
// decoding Google's gzip'd responses on modern Node; use native fetch instead.
gaxios.instance.defaults.fetchImplementation = (...args) => fetch(...args);
const url = require('url');
const { exec } = require('child_process');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

async function main() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
  oauth2Client.transporter.defaults.fetchImplementation = (...args) => fetch(...args);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });

  console.log('\n=== Google OAuth2 Setup ===\n');
  console.log('Opening your browser. If it does not open, visit this URL manually:\n');
  console.log(authUrl + '\n');

  // Try to open the browser (Windows / macOS / Linux)
  const openCmd =
    process.platform === 'win32'
      ? `start "" "${authUrl}"`
      : process.platform === 'darwin'
      ? `open "${authUrl}"`
      : `xdg-open "${authUrl}"`;
  exec(openCmd);

  const refreshToken = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const { query } = url.parse(req.url, true);

      if (!query.code) {
        res.writeHead(400);
        res.end('Missing code parameter');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>Authorization successful — you can close this tab.</h2>');
      server.close();

      try {
        const { tokens } = await oauth2Client.getToken(query.code);
        if (!tokens.refresh_token) {
          reject(new Error('No refresh_token returned. Try revoking app access at myaccount.google.com/permissions and re-running setup.'));
          return;
        }
        resolve(tokens.refresh_token);
      } catch (e) {
        reject(e);
      }
    });

    server.listen(PORT, () => {
      console.log(`Waiting for Google redirect on http://localhost:${PORT}/callback ...\n`);
    });

    server.on('error', reject);
  });

  console.log('Success! Add this line to your .env file:\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}\n`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
