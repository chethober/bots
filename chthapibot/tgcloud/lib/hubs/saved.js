// ♥ Saved items, shared by every hub. Callback prefix `sv`.
//   sv:a:<kind>:<ref>              save the item shown on this card
//   sv:l:<category>:<page>         list
//   sv:o:<id>                      reopen as a card
//   sv:x:<id>:<category>:<page>    remove (from the list)
// A hub registers each savable kind:
//   registerSavedKind('recipe', { category: 'food', title(data), render(data) → card, fetch?(ref) → data })
// Cards call rememberItem() when they are shown, so a later ♥ can save without refetching.
import { saveItem, listSaved, getSaved, deleteSaved, putCache, getCache } from '../store.js';
import { btn, show, send, notice, requireManage, pagerRow } from '../ui.js';
import { CATEGORY_LABELS } from '../notify.js';
import { esc } from '../format.js';

const kinds = new Map();

export function registerSavedKind(kind, impl) {
  kinds.set(kind, impl);
}

export function rememberItem(kind, ref, data) {
  return putCache(`item:${kind}:${ref}`, data, 86400).catch(() => {});
}

export const saveBtn = (kind, ref) => {
  const data = `sv:a:${kind}:${ref}`;
  return data.length <= 64 ? btn('♥ Save', data) : null;
};

export const callbacks = {
  async sv(ctx, [op, a, b, c]) {
    if (op === 'a') return saveFromCard(ctx, a, b);
    await ctx.answer();
    if (op === 'l') return savedList(ctx, a, +b || 0);
    if (op === 'o') return reopen(ctx, +a);
    if (op === 'x') {
      if (!(await requireManage(ctx))) return;
      await deleteSaved(ctx.chatId, +a);
      return savedList(ctx, b, +c || 0);
    }
  },
};

async function saveFromCard(ctx, kind, ref) {
  const impl = kinds.get(kind);
  if (!impl) return ctx.answer('Can’t save this.');
  if (!(await requireManage(ctx))) return;
  const data = (await getCache(`item:${kind}:${ref}`)) ?? (impl.fetch ? await impl.fetch(ref) : null);
  if (!data) return ctx.answer('This card is too old to save — open it again.');
  const res = await saveItem(ctx.chatId, impl.category, kind, ref, impl.title(data).slice(0, 200), data);
  await ctx.answer(res === 'added' ? '♥ Saved' : res === 'exists' ? 'Already saved' : 'Saved list is full (200)');
}

export async function savedList(ctx, category, page) {
  const { rows, total, pages } = await listSaved(ctx.chatId, category, page);
  const label = CATEGORY_LABELS[category] ?? category;
  await show(ctx, {
    text: `♥ <b>Saved — ${esc(label)}</b>\n\n${total ? `${total} item${total === 1 ? '' : 's'}. Tap one to open it.` : '<i>Nothing saved yet. Tap ♥ Save on any card.</i>'}`,
    keyboard: [
      ...rows.map((r) => [btn(`${kinds.get(r.kind)?.icon ?? '•'} ${r.title.slice(0, 40)}`, `sv:o:${r.id}`), btn('🗑', `sv:x:${r.id}:${category}:${page}`)]),
      ...pagerRow(page, pages, (pg) => `sv:l:${category}:${pg}`),
      [btn('⬅️ Back', `m:${category}`)],
    ],
  });
}

async function reopen(ctx, id) {
  const row = await getSaved(ctx.chatId, id);
  if (!row) return notice(ctx, 'That item was removed.');
  const impl = kinds.get(row.kind);
  if (!impl) return notice(ctx, esc(row.title));
  const card = impl.render(row.data);
  // Already saved: drop the ♥ button from the reopened card.
  card.keyboard = card.keyboard?.map((r) => r.filter((b) => !b.callback_data?.startsWith('sv:a:'))).filter((r) => r.length);
  await send(ctx, card);
}
