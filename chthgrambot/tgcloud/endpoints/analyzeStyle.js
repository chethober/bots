// Generates a style guide from the samples; the panel shows it for review before saving.
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { buildStyleProfile } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  try {
    return { profile: await buildStyleProfile(user.id, input.settings, user.first_name) };
  } catch (e) {
    throw new EndpointError(describeAiError(e), { code: 'AI_ERROR' });
  }
}
