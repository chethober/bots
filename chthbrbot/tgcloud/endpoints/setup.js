// endpoints/setup.js — one-off: applies the bot profile: description and short
// description in every language (lib/texts.js), the command menu — empty for
// users, who have the reply keyboard; the admin commands in each admin's chat
// (ADMIN_IDS) — and, optionally, the profile photo.
//
//   npx tgcloud run endpoints/setup '{}'
//   npx tgcloud run endpoints/setup "{ photo: '$(base64 -w0 assets/avatar.jpg)' }"
//
// Only for `tgcloud run`: a real call from a Mini App always carries verified
// initData, and those are refused so nobody else can change the bot's profile.

import { api, InputFile, EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { LOCALES } from '../lib/i18n.js';
import { texts } from '../lib/texts.js';

const ADMIN_COMMANDS = [
  { command: 'admin',     description: '🛠 Admin panel and bot stats' },
  { command: 'reports',   description: '🛠 Open reports' },
  { command: 'bans',      description: '🛠 Banned senders' },
  { command: 'ban',       description: '🛠 Ban by id' },
  { command: 'unban',     description: '🛠 Unban by id' },
  { command: 'broadcast', description: '🛠 Broadcast a message' },
];

// The runtime has no atob/Buffer.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fromBase64(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0, bits = 0, n = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[n++] = (buf >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, n);
}

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });

  const done = [];
  // English is also the default, for languages without their own.
  for (const locale of [null, ...LOCALES]) {
    const { profile } = texts(locale ?? 'en');
    const language_code = locale ?? undefined;
    await api.setMyDescription({ description: profile.description, language_code });
    await api.setMyShortDescription({ short_description: profile.shortDescription, language_code });
    done.push(`description (${locale ?? 'default'})`);
  }
  await api.deleteMyCommands({});
  done.push('user commands removed');
  for (const chat_id of ADMIN_IDS) {
    try {
      await api.setMyCommands({ commands: ADMIN_COMMANDS, scope: { type: 'chat', chat_id } });
      done.push(`admin commands for ${chat_id}`);
    } catch (e) {
      done.push(`admin commands for ${chat_id} failed (has the admin pressed Start?): ${e.description ?? e.message}`);
    }
  }

  if (input.photo) {
    await api.setMyProfilePhoto({
      photo: { type: 'static', photo: new InputFile(fromBase64(input.photo), 'avatar.jpg', { type: 'image/jpeg' }) },
    });
    done.push('profile photo');
  }
  return { done };
}
