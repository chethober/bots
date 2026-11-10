// Shared base for the message widget templates (Bot API 10.4, sendWidget): the CSS
// tokens, the JS helpers and page(). Each template in ./templates/ is a
// self-contained page drawn by its own inline script from a small JSON payload
// that the bot puts in chat_data (one message) or public_data (a shared widget).
//
// Limits (checked by scripts/check-widgets.js): at most 32 KB raw and 4 KB
// zlib-compressed at the maximum level. Widgets have no network, no external
// scripts, fonts or images, so charts are inline SVG and fonts are generic.
//
// Static for now: tgcloud can't receive widget_query updates, so widgets don't
// ask the bot for anything. They redraw when the bot edits their data (a 🔄 button,
// a reopened card, a shared widget refreshed by anyone in any chat). Payloads still
// carry `q` for when queries can be switched on (lib/widgets/index.js).
//
// Familiar on purpose: each widget copies the layout of an app people already
// read that data in (Apple Stocks, Weather, a Live Activity, a sports table…).
// Look: 2px lines over a ~10% wash, 1px hairlines, a sign or ▲/▼ always next to
// the up/down colour. Big numbers: proportional figures and tight tracking;
// numbers in columns: tabular (.n).
// Feel: scrubbing a chart captures the pointer; nothing else looks tappable.
// Motion only on first render: charts sweep in from the left, rows fade up 40 ms apart. A refresh never moves anything; a changed value
// flashes once. The live dot pulses. Reduced motion keeps the flash only.

export const CSS = `:root{--up:#006300;--dn:#d03b3b;--um:#0ca30c;--s:var(--tg-theme-bg-color,#fff);--t:var(--tg-theme-text-color,#111);--b2:var(--tg-theme-secondary-bg-color,#eeeef0);--g:var(--tg-theme-section-separator-color,rgba(127,127,127,.2));--h:var(--tg-theme-hint-color,#8a8a8e);--e:cubic-bezier(.23,1,.32,1)}
@media(prefers-color-scheme:dark){:root{--up:#0ca30c}}
*{box-sizing:border-box;margin:0}body{font:15px/1.3 system-ui,sans-serif;color:var(--t);background:var(--s);padding:10px 12px;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.h{color:var(--h);font-size:12px;letter-spacing:.01em}.up{color:var(--up)}.dn{color:var(--dn)}.lv{color:var(--dn);font-weight:600}
.r{display:flex;align-items:center;gap:8px}.f{flex:1;min-width:0}.e{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}b{font-weight:600}.n{font-variant-numeric:tabular-nums}
.ln{border-top:1px solid var(--g)}svg{display:block;width:100%;overflow:visible}.t1{font-size:17px;font-weight:700;letter-spacing:-.01em}
.big{font-weight:700;letter-spacing:-.02em;line-height:1.05}
.pd{display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px;animation:pu 1.6s ease-in-out infinite}
.dt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;box-shadow:0 0 0 2px var(--s)}
.fu,.fd{border-radius:4px;animation:fl 1.4s ease-out}.fu{--fc:rgba(12,163,12,.25)}.fd{--fc:rgba(208,59,59,.25)}
.in .rv{animation:rv .6s var(--e) backwards}.in .sg{animation:fi .24s var(--e) backwards}.in .dt{animation:fo .2s .45s ease-out backwards}
@keyframes rv{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}@keyframes fi{from{opacity:0;transform:translateY(4px)}}@keyframes fo{from{opacity:0}}
@keyframes fl{from{background:var(--fc)}to{background:transparent}}@keyframes pu{50%{opacity:.3}}
@media(prefers-reduced-motion:reduce){.in .rv,.in .sg,.in .dt,.pd{animation:none}}`;

// Helpers: J parse, E escape, N number, P ▲/▼ percent, C up/down class, T hh:mm,
// Y weekday, V unpack a base36 series (0..1), Q polyline points, X flash class for
// a changed value, go() render wrapper, scrub() drag-to-read on a chart, boot().
export const JS = `var W=window.TelegramWidget||{},D=null,O=null,F=1;
function $(i){return document.getElementById(i)}
function J(s){try{return JSON.parse(s)}catch(e){return null}}
function E(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return'&#'+c.charCodeAt(0)+';'})}
function N(n){if(n==null)return'—';var a=Math.abs(n),s=a>=100?a.toFixed(0):a>=1?a.toFixed(2):a.toPrecision(3),p=s.split('.');p[0]=p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');return(n<0?'-':'')+p.join('.')}
function P(n){return n==null?'':(n>=0?'▲ ':'▼ ')+Math.abs(n).toFixed(2)+'%'}
function C(n){return n==null?'h':n>=0?'up':'dn'}
function T(t){var d=new Date(t*1e3);return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function Y(t){var d=new Date(t*1e3),n=new Date();return d.toDateString()==n.toDateString()?'Today':'Sun Mon Tue Wed Thu Fri Sat'.split(' ')[d.getDay()]}
function V(s,k){var o=[],m=Math.pow(36,k)-1;for(var i=0;i<s.length;i+=k)o.push(parseInt(s.substr(i,k),36)/m);return o}
function Q(a,w,h,p){return a.map(function(v,i){return(i*w/(a.length-1||1)).toFixed(1)+','+(p+(h-2*p)*(1-v)).toFixed(1)}).join(' ')}
function X(o,n){return F||o==null||n==null||o==n?'':+n>+o?' fu':' fd'}
function go(f){return function(){if(!D)return;document.body.className=F?'in':'';f();F=0;O=D}}
function scrub(el,fn){var on=0,m=function(e){if(!on||!el.getBoundingClientRect)return;var b=el.getBoundingClientRect();fn(Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)))},end=function(){if(on){on=0;fn(-1)}};
el.addEventListener('pointerdown',function(e){on=1;try{el.setPointerCapture(e.pointerId)}catch(x){}m(e)});el.addEventListener('pointermove',m);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}
function boot(f){D=J(W.chatData)||J(W.publicData)||D;f();
if(W.onEvent){W.onEvent('chatDataChanged',function(){var d=J(W.chatData);if(d){D=d;f()}});W.onEvent('publicDataChanged',function(){var d=J(W.publicData);if(d){D=d;f()}})}
if(W.watchPublicData&&W.publicData!=null)W.watchPublicData()}`;

export const page = (css, body, script) => `<!doctype html><meta charset=utf-8><style>${CSS}${css}</style>${body}<script>${JS}\n${script}</script>`;

// Changing this file changes every template's version (new shared widgets for all),
// so add template-specific helpers in the template's own script instead.
