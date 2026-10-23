// Playground: answers a sample message with the (possibly unsaved) settings from the panel.
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { previewReply } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  const text = String(input.text ?? '').trim().slice(0, 1000);
  if (!text) throw new EndpointError('Type a message to test', { code: 'EMPTY' });
  try {
    return { replies: await previewReply(user.id, input.settings, text, user.first_name) };
  } catch (e) {
    throw new EndpointError(describeAiError(e), { code: 'AI_ERROR' });
  }
}
