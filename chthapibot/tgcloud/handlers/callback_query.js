// Inline buttons. Payload is the CallbackQuery; routing lives in lib/hubs/index.js.
import { api } from 'sdk';
import { runCallback } from '../lib/hubs/index.js';
import { getPrefs } from '../lib/store.js';
import { normalizeLocale } from '../lib/i18n.js';

export default async function (q) {
  let answered = false;
  const chatId = q.message?.chat.id ?? q.from.id;
  const ctx = {
    chatId,
    chatType: q.message?.chat.type ?? 'private',
    userId: q.from.id,
    userName: q.from.first_name,
    locale: (await getPrefs(chatId)).locale || normalizeLocale(q.from.language_code),
    message: q.message ?? null,
    // Telegram accepts one answer per query; later calls are ignored.
    get answered() { return answered; },
    answer: async (text) => {
      if (answered) return;
      answered = true;
      await api.answerCallbackQuery({ callback_query_id: q.id, text }).catch(() => {});
    },
  };
  try {
    await runCallback(ctx, q.data);
  } catch (e) {
    console.error(`callback ${q.data} failed`, e);
    await ctx.answer('⚠️ Something went wrong');
  } finally {
    await ctx.answer();
  }
}
