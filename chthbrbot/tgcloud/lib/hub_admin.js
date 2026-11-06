// What the CHTH hub can ask of this bot (see hub_command.js). Reports stay here: reviewing them
// needs message contents, which don't leave the bot. Bans are addressed by reference, so a
// sender's id never reaches the hub unless an admin typed it.

import { db } from 'sdk';
import { lt } from 'sdk/db';
import { hubCommands } from '../schema.js';
import { ban, bansView, dashboardView, runBroadcast, unban, unbanAt } from './admin.js';
import { textsOf } from './chats.js';

const CLAIM_KEEP_SEC = 600; // commands older than 5 minutes are refused before they get here

// True the first time this command id is seen.
export async function claim(id) {
  const at = Math.floor(Date.now() / 1000);
  await db.delete(hubCommands).where(lt(hubCommands.at, at - CLAIM_KEEP_SEC));
  const [row] = await db.insert(hubCommands).values({ id, at }).onConflictDoNothing().returning();
  return Boolean(row);
}

const textsFor = (args) => textsOf(Number(args.admin) || 0);

function userId(args) {
  const id = String(args.input ?? '').trim();
  if (!/^\d+$/.test(id)) throw new Error('Give a Telegram user id.');
  return Number(id);
}

const BROADCAST_MAX = 3000; // the hub's Continue button carries the text back
const BROADCAST_RUN = 150;  // per command, to stay inside the platform's run time

async function bans(args) {
  const { text, reply_markup } = await bansView(await textsFor(args));
  const buttons = (reply_markup?.inline_keyboard ?? []).flat().map((b) => ({
    text: b.text, cmd: 'unbanref', args: { ref: b.callback_data.slice(3) },
  }));
  return { text, buttons };
}

export const handlers = {
  dashboard: async (args) => ({ text: (await dashboardView(await textsFor(args))).text }),
  bans,

  async unbanref(args) {
    await unbanAt(String(args.ref ?? ''));
    return bans(args);
  },

  async ban(args) {
    const id = userId(args);
    const L = await textsFor(args);
    return { text: (await ban(id)) ? L.adminBanned(id) : L.adminAlreadyBanned(id) };
  },

  async unban(args) {
    const id = userId(args);
    const L = await textsFor(args);
    return { text: (await unban(id)) ? L.adminUnbanned(id) : L.adminNotBanned(id) };
  },

  async broadcast(args) {
    const text = String(args.input ?? '').trim();
    if (!text) throw new Error('The message is empty.');
    if (text.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
    const L = await textsFor(args);
    const admin = Number(args.admin);
    // A broadcast row is keyed by a number: the first time, the moment it started.
    const ref = Number(args.ref) || Math.floor(Date.now() / 1000);
    let summary = '';
    const state = await runBroadcast(admin, ref, async (line) => { summary = line; }, L, { text, limit: BROADCAST_RUN });
    if (state === 'more') {
      return { text: `${summary}\nMore people left.`, buttons: [{ text: '▶️ Continue', cmd: 'broadcast', args: { input: text, ref } }] };
    }
    return { text: summary || 'That broadcast has already finished.' };
  },
};
