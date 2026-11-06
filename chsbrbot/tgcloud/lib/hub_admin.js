// What the CHTH hub can ask of this bot (see hub_command.js). The hub holds the admin screens and
// checks who is asking; this only touches the bot's own data.

import { db } from 'sdk';
import { lt } from 'sdk/db';
import { hubCommands } from '../schema.js';
import { chatsView, dashboardView, historyView, queueBroadcast, sendTestAlert, statsView, tickView } from './admin.js';
import { runTick } from './scheduler.js';

const CLAIM_KEEP_SEC = 600; // commands older than 5 minutes are refused before they get here

// True the first time this command id is seen.
export async function claim(id) {
  const at = Math.floor(Date.now() / 1000);
  await db.delete(hubCommands).where(lt(hubCommands.at, at - CLAIM_KEEP_SEC));
  const [row] = await db.insert(hubCommands).values({ id, at }).onConflictDoNothing().returning();
  return Boolean(row);
}

const html = (text) => ({ text, html: true });
const view = (build) => async () => html((await build()).text);

export const handlers = {
  dashboard: view(dashboardView),
  stats: view(statsView),
  history: view(historyView),
  chats: view(chatsView),
  tick: view(tickView),

  async test(args) {
    const sent = await sendTestAlert(Number(args.admin), 'en');
    return html(sent ? '🧪 Sent to your chat with this bot.' : 'No CVE stored yet. Run the scheduler first.');
  },

  async broadcast(args) {
    const reply = await queueBroadcast(String(args.input ?? ''));
    if (reply.startsWith('📢')) await runTick({ budgetMs: 15_000 });
    return html(reply);
  },
};
