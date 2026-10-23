// Forget stored conversation context for one chat, or all chats when chatId is omitted.
import { requireUser } from '../lib/auth.js';
import { clearHistory } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  await clearHistory(user.id, input.chatId == null ? null : Number(input.chatId));
  return { ok: true };
}
