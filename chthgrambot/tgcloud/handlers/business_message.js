// A new message in one of the owner's private chats (Telegram Business secretary mode).
import { handleBusinessMessage } from '../lib/secretary.js';

export default async function (message) {
  await handleBusinessMessage(message);
}
