// 📖 How to connect: a page per device for the apps that take subscription and share links, a
// page on which config to pick, and a page per protocol that needs its own app (xtune servers
// give those as files on the member's usage page). The words are in texts.js (guide).

export const GUIDE_DEVICES = ['android', 'ios', 'windows', 'mac', 'linux'];

// xtune's protocol names (vpns.protocols) → the protocols with their own app
const OWN_APP = { WireGuard: 'wg', AmneziaWG: 'awg', OpenVPN: 'ovpn', IKEv2: 'ikev2', SSH: 'ssh', 'DNS tunnel': 'dns' };
export const GUIDE_OWN_APPS = [...new Set(Object.values(OWN_APP))];

export const GUIDE_PAGES = [...GUIDE_DEVICES, 'xray', ...GUIDE_OWN_APPS];

// The own-app protocols a VPN offers: all of them in the general guide (no VPN). Only xtune
// servers hand out their files; other VPNs' links all go in the usual apps.
export function ownApps(vpn) {
  if (!vpn) return GUIDE_OWN_APPS;
  if (vpn.kind !== 'xtune') return [];
  return GUIDE_OWN_APPS.filter((k) => (vpn.protocols ?? []).some((p) => OWN_APP[p] === k));
}
