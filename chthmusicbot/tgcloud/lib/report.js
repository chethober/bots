// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Events for the CHTH hub, the private admin bot: new users (with the ?start=src_ tag that
// brought them), tips, chats the bot joins or leaves, and errors. Only counts and
// pseudonymous ids leave the bot; never message contents.
//
// HUB_URL and HUB_SECRET live in the git-ignored hub.secrets.js (CI writes it; copy
// hub.secrets.example.js for a local deploy). Empty values switch reporting off, and a hub
// that is down never breaks the bot: report() only logs a warning.

import { fetch } from 'sdk';
import { createReporter, startSource } from './chth-hub.js';
import { HUB_URL, HUB_SECRET, HUB_SOURCE } from './hub.secrets.js';

const reporter = createReporter({ url: HUB_URL, secret: HUB_SECRET, source: HUB_SOURCE, fetch });

/** Sends one event to the hub. `user` is a Telegram user id, sent as a pseudonym. */
export const report = (type, data, user) => reporter.track(type, data, user);

const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;

/**
 * Call first thing in handlers/message.js with every message. For a /start in a private chat
 * it reports the user (and the CHTH link they came from), and turns `/start src_<tag>` into a
 * plain `/start` so the bot's own deep links (invite codes, anonymous links) never see a tag.
 * Anything else passes through untouched.
 */
export async function reportStart(message) {
  const m = START.exec(String(message?.text ?? ''));
  if (!m || message?.chat?.type !== 'private') return false;
  const src = startSource(m[1]);
  if (src) message.text = '/start';
  return report('start', { src, lang: message.from?.language_code ?? null }, message.from?.id);
}

/** Reports the bot being added to or removed from a group or channel (a my_chat_member update). */
export function reportChatMember(update) {
  const was = update?.old_chat_member?.status;
  const now = update?.new_chat_member?.status;
  const inChat = (s) => s === 'member' || s === 'administrator';
  const type = update?.chat?.type;
  if (type === 'private' || inChat(was) === inChat(now)) return Promise.resolve(false);
  return report(inChat(now) ? 'chat.added' : 'chat.removed', { kind: type });
}

/** Reports a handler error (the message only, not the update that caused it). */
export const reportError = (where, error) =>
  report('error', { where, message: String(error?.message ?? error).slice(0, 300) });

export { startSource };
