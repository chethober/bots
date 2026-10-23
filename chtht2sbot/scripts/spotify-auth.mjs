#!/usr/bin/env node
// One-time Spotify login. Prints the /spotify command to send to the bot in DM.
//
//   node scripts/spotify-auth.mjs
// (uses the app in tgcloud/lib/config.js; override with SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)
//
// In the Spotify developer dashboard, add this Redirect URI to the app:
//   http://127.0.0.1:8888/callback

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../tgcloud/lib/config.js', import.meta.url), 'utf8');
const fromConfig = (name) => new RegExp(`${name} = '([^']+)'`).exec(config)?.[1];
const id = process.env.SPOTIFY_CLIENT_ID || fromConfig('SPOTIFY_CLIENT_ID');
const secret = process.env.SPOTIFY_CLIENT_SECRET || fromConfig('SPOTIFY_CLIENT_SECRET');
const custom = Boolean(process.env.SPOTIFY_CLIENT_ID);

const REDIRECT = 'http://127.0.0.1:8888/callback';
const SCOPES = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
const state = randomBytes(12).toString('hex');

const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  response_type: 'code', client_id: id, scope: SCOPES, redirect_uri: REDIRECT, state,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') return res.writeHead(404).end();
  if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
    res.writeHead(400).end('Login failed: ' + (url.searchParams.get('error') ?? 'bad state'));
    return;
  }
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT }),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) {
    res.writeHead(500).end('Token exchange failed: ' + JSON.stringify(data));
    console.error(data);
  } else {
    res.end('Done — you can close this tab and go back to the terminal.');
    console.log('\nSend this to the bot in a private chat (it deletes the message after saving):\n');
    console.log(custom ? `/spotify ${id} ${secret} ${data.refresh_token}\n` : `/spotify ${data.refresh_token}\n`);
  }
  server.close();
});

server.listen(8888, '127.0.0.1', () => {
  console.log('Open this URL in your browser and approve access:\n\n' + authUrl + '\n');
});
