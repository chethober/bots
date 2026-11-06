// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Commands from the CHTH hub. The admin bot sends them as private messages (bot-to-bot), signed
// with this bot's HUB_SECRET; the result goes back through report(), never over Telegram, so two
// bots can't end up answering each other in a loop.

import { verifyCommand } from './chth_hub.js';
import { HUB_SECRET } from './hub_secrets.js';
import { report } from './report.js';

const HUB_BOT = 'chesoberbot';

/**
 * Call first thing in handlers/message.js with every message. Resolves to true when the message
 * came from a bot, which the caller must then ignore. `handlers` maps a command to
 * `async (args) => result`; `ping` is built in.
 */
export async function hubCommand(message, handlers = {}) {
  if (!message?.from?.is_bot) return false;
  if (message.from.username !== HUB_BOT) return true;
  const command = await verifyCommand(HUB_SECRET, message.text);
  if (!command) {
    console.warn('chth hub: refused a command');
    return true;
  }
  const run = command.cmd === 'ping' ? async () => 'pong' : handlers[command.cmd];
  try {
    if (!run) throw new Error(`unknown command ${command.cmd}`);
    await report('admin.result', { id: command.id, cmd: command.cmd, ok: true, result: await run(command.args) });
  } catch (e) {
    await report('admin.result', { id: command.id, cmd: command.cmd, ok: false, error: String(e?.message ?? e).slice(0, 300) });
  }
  return true;
}
