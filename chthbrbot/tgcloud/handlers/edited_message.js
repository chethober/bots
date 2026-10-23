// handlers/edited_message.js — a sender edited an anonymous message they sent: the
// bot edits its copy in the owner's chat too (text or caption; Telegram marks it
// "edited"). Only within EDIT_WINDOW_SEC, and edits go through the word filter
// again, so a harmless message can't be turned into a filtered one.

import { EDIT_WINDOW_SEC } from '../lib/config.js';
import { dropReason, findOriginal, ownerKeyboard } from '../lib/delivery.js';
import { isFiltered } from '../lib/filter.js';
import { textsFor, textsOf } from '../lib/chats.js';
import { now, safeApi } from '../lib/util.js';

export default async function (msg, ctx) {
  if (msg.chat?.type !== 'private' || !msg.from || msg.from.is_bot) return;
  try {
    const row = await findOriginal(msg.chat.id, msg.message_id);
    if (!row || !['delivered', 'blocked', 'banned'].includes(row.status)) return;

    const notify = (text) => safeApi('sendMessage', {
      chat_id: msg.chat.id,
      text,
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });
    const L = await textsFor(msg.from);
    if (now() - row.createdAt > EDIT_WINDOW_SEC) return await notify(L.editTooLate(Math.round(EDIT_WINDOW_SEC / 60)));
    if (isFiltered(msg.text ?? msg.caption)) return await notify(L.editFiltered);
    // Blocked or banned (then or since): ignored silently, after the same notices
    // anyone gets, so editing can't reveal a block.
    if (row.status !== 'delivered' || !row.ownerMsgId || await dropReason(row.ownerId, row.senderId)) return;

    // Editing drops the inline keyboard unless it's sent again.
    const target = { chat_id: row.ownerId, message_id: row.ownerMsgId, reply_markup: await ownerKeyboard(row.id, await textsOf(row.ownerId)) };
    if (msg.text !== undefined) {
      await safeApi('editMessageText', {
        ...target,
        text: msg.text,
        entities: msg.entities,
        link_preview_options: msg.link_preview_options,
      });
    } else {
      await safeApi('editMessageCaption', {
        ...target,
        caption: msg.caption ?? '',
        caption_entities: msg.caption_entities,
        show_caption_above_media: msg.show_caption_above_media,
      });
    }
  } catch (e) {
    console.error('edited_message handler failed', e);
  }
}
