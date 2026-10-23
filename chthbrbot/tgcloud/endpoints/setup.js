// endpoints/setup.js — one-off: applies the bot profile from lib/texts.js (BOT_PROFILE):
// description, short description, command menu (plus the admin commands in each
// admin's chat, see ADMIN_IDS) and, optionally, the profile photo.
//
//   npx tgcloud run endpoints/setup '{}'
//   npx tgcloud run endpoints/setup "{ photo: '$(base64 -w0 assets/avatar.jpg)' }"
//
// Only for `tgcloud run`: a real call from a Mini App always carries verified
// initData, and those are refused so nobody else can change the bot's profile.

import { api, InputFile, EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { BOT_PROFILE } from '../lib/texts.js';

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
  await api.setMyDescription({ description: BOT_PROFILE.description });
  done.push('description');
  await api.setMyShortDescription({ short_description: BOT_PROFILE.shortDescription });
  done.push('short description');
  await api.setMyCommands({ commands: BOT_PROFILE.commands });
  done.push('commands');
  for (const chat_id of ADMIN_IDS) {
    try {
      await api.setMyCommands({
        commands: [...BOT_PROFILE.adminCommands, ...BOT_PROFILE.commands],
        scope: { type: 'chat', chat_id },
      });
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
