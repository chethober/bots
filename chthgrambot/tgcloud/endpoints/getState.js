// Everything the panel needs on load.
import { requireUser } from '../lib/auth.js';
import {
  loadSettingsRow, sanitize, resolveCredentials, VOICES, MODELS, MOODS, EMOJI_STYLES, LENGTHS, FORMALITY,
} from '../lib/settings.js';
import { getUserConnection, listChats, countRepliesToday, countSamples, countExamples } from '../lib/store.js';

const labels = (o) => Object.entries(o).map(([id, v]) => ({ id, label: v.label }));

export default async function (input, ctx) {
  const user = requireUser(ctx);
  const [row, conn, chats, repliesToday, sampleCount, exampleCount] = await Promise.all([
    loadSettingsRow(user.id), getUserConnection(user.id), listChats(user.id), countRepliesToday(user.id), countSamples(user.id), countExamples(user.id),
  ]);
  const creds = resolveCredentials(row, user.id);
  return {
    settings: sanitize(row?.data ?? {}),
    options: {
      voices: Object.entries(VOICES).map(([id, v]) => ({ id, label: v.label, hint: v.hint })),
      models: MODELS, moods: labels(MOODS), emojiStyles: labels(EMOJI_STYLES),
      lengths: labels(LENGTHS), formality: labels(FORMALITY),
    },
    connection: conn ? { enabled: conn.isEnabled, canReply: conn.canReply, canRead: conn.canRead } : null,
    credentials: {
      source: creds?.source ?? null,
      accountId: row?.cfAccountId ?? '',
      tokenHint: row?.cfApiToken ? `••••${row.cfApiToken.slice(-4)}` : '',
    },
    chats: chats.map((c) => ({
      chatId: c.chatId, title: c.title, username: c.username, muted: c.muted, note: c.note ?? '', pausedUntil: c.pausedUntil, lastAt: c.lastAt,
    })),
    repliesToday,
    sampleCount,
    exampleCount,
  };
}
