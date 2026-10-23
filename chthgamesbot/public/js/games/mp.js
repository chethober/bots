// Helpers shared by the multiplayer screens.
import { h, lobbyButtons, busy, playerRow, fmt } from '../kit.js';

// Lobby before the first press: who's hosting, and the signed lobby buttons that apply to me.
export function lobby(root, info, ctx, { ico, text, filter }) {
  const isHost = info.me === info.creator.id;
  root.replaceChildren(
    h('div.waiting', h('span.big-ico', ico), text(isHost)),
    lobbyButtons(info, ctx, (b) => filter(b.data.split(':')[1], isHost)),
  );
}

export function actBtn(label, data, ctx, cls = '') {
  const b = h(`button.big${cls ? '.' + cls : ''}`, { onclick: () => busy(b, () => ctx.act(data)) }, label);
  return b;
}

export const htmlLines = (lines) => h('div.log', (lines ?? []).map((l) => h('div', { html: l })));

export { playerRow, fmt, h };
