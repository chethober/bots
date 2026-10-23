import { EndpointError } from 'sdk';
import { isAllowed } from './config.js';

// The platform already verified ctx.initData; this only enforces the allow-list.
export function requireUser(ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open the panel from Telegram', { code: 'NO_USER' });
  if (!isAllowed(user.id)) throw new EndpointError('This bot is private', { code: 'FORBIDDEN' });
  return user;
}
