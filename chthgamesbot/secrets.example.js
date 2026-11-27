// Copy to tgcloud/lib/secrets.js (git-ignored) and fill in.
//   BUTTON_SECRET: random string that signs lobby buttons. Generate one with:
//     node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
//   ADMIN_IDS: Telegram user ids allowed to use /admin commands.
export const BUTTON_SECRET = 'change-me';
// Merged CHTH admins (same list as the hub and every other bot).
export const ADMIN_IDS = [6330862227, 8028710032];
