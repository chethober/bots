// Admins (ADMIN_IDS): reports with Unlist / Delete / Ban owner / Dismiss buttons,
// /admin (stats) and /reports. Admins see a VPN's details but not who reported it.

import { ADMIN_IDS } from './config.js';
import { textsOf } from './chats.js';
import { getVpn, openReports, stats } from './store.js';
import { safeApi } from './util.js';

export const isAdmin = (userId) => ADMIN_IDS.includes(userId);

export function reportKeyboard(report, L) {
  const b = (text, op) => ({ text, callback_data: `${op}:${report.id}` });
  return {
    inline_keyboard: [
      [b(L.btnUnlist, 'au'), b(L.btnDelete, 'ad')],
      [b(L.btnBanOwner, 'ab'), b(L.btnDismiss, 'ax')],
    ],
  };
}

async function sendReportTo(chatId, report, vpn) {
  const L = await textsOf(chatId);
  return safeApi('sendMessage', {
    chat_id: chatId,
    text: L.adminReport(report, vpn),
    reply_markup: reportKeyboard(report, L),
    link_preview_options: { is_disabled: true },
  });
}

export async function sendReport(report, vpn) {
  for (const id of ADMIN_IDS) await sendReportTo(id, report, vpn);
}

export async function sendOpenReports(chatId, L) {
  const list = await openReports();
  if (!list.length) return safeApi('sendMessage', { chat_id: chatId, text: L.adminNoReports });
  for (const r of list) {
    const vpn = await getVpn(r.vpnId);
    if (vpn) await sendReportTo(chatId, r, vpn);
  }
}

export async function dashboardText(L) {
  return L.adminStats(await stats());
}
