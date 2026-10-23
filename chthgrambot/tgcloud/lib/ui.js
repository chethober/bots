import { PANEL_URL } from './config.js';

export function panelKeyboard(extraRows = []) {
  const rows = PANEL_URL ? [[{ text: '⚙️ Open panel', web_app: { url: PANEL_URL } }]] : [];
  return { inline_keyboard: [...rows, ...extraRows] };
}

export const setupButton = () => ({ text: '🔑 Connect Cloudflare AI', callback_data: 'setup' });

export function statusKeyboard(enabled) {
  return panelKeyboard([[enabled
    ? { text: '⏸ Pause auto-replies', callback_data: 'pause' }
    : { text: '▶️ Resume auto-replies', callback_data: 'resume' }]]);
}
