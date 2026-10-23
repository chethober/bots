// Messages deleted in a business chat: drop them from the AI's context as well.
import { getConnection, deleteMessagesByTelegramId } from '../lib/store.js';

export default async function (deleted) {
  const conn = await getConnection(deleted.business_connection_id);
  if (conn) await deleteMessagesByTelegramId(conn.userId, deleted.chat.id, deleted.message_ids);
}
