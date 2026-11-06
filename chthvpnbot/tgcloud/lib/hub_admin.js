// What the CHTH hub can ask of this bot (see hub_command.js). Reports stay here: reviewing them
// needs a VPN's details, which don't leave the bot.

import { db } from 'sdk';
import { lt } from 'sdk/db';
import { hubCommands } from '../schema.js';
import { textsOf } from './chats.js';
import { stats } from './store.js';

const CLAIM_KEEP_SEC = 600; // commands older than 5 minutes are refused before they get here

// True the first time this command id is seen.
export async function claim(id) {
  const at = Math.floor(Date.now() / 1000);
  await db.delete(hubCommands).where(lt(hubCommands.at, at - CLAIM_KEEP_SEC));
  const [row] = await db.insert(hubCommands).values({ id, at }).onConflictDoNothing().returning();
  return Boolean(row);
}

export const handlers = {
  stats: async (args) => ({ text: (await textsOf(Number(args.admin) || 0)).adminStats(await stats()) }),
};
