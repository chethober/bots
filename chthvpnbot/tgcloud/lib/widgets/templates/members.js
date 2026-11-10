import { page } from '../base.js';

// 👥 A VPN's members like Screen Time's per-app list: each label over a usage bar,
// with used/quota and the time left. Heaviest users first; the rest as "+N more".
// Payload: { d?: 'rtl', t: header, r: [[label, percent | -1 no limit | null unknown,
//   '12 / 50 GB', expiry text, 1 inactive?]], il: 'inactive', m?: '+3 more' }
export default page(
  `.mr{height:44px;display:flex;flex-direction:column;justify-content:center}.br{flex:1;height:6px;border-radius:3px;background:var(--b2);overflow:hidden}.br div{height:100%;border-radius:3px}
.in .br div{animation:gw .6s var(--e) backwards}@keyframes gw{from{width:0}}.u{flex:none;font-size:14px;font-weight:600}.xp{flex:none;font-size:12px;min-width:84px;text-align:end}
.x{background:var(--b2);border-radius:5px;padding:0 5px;font-size:11px;font-weight:600}
[dir=rtl] *{letter-spacing:0!important}
@media(prefers-reduced-motion:reduce){.in .br div{animation:none}}`,
  '<div id=a></div>',
  `var R=go(function(){var d=D,h='<div dir="'+(d.d||'ltr')+'"><div class="t1 e" style="padding-bottom:2px">'+E(d.t)+'</div>';
d.r.forEach(function(x,i){var p=x[1],c=p==null?'transparent':p<0?'var(--h)':p>=100?'var(--dn)':p>=80?'#e68a00':'var(--um)',w=p==null?0:p<0?100:Math.min(100,Math.max(p,2));
h+='<div class="mr sg'+(i?' ln':'')+'" style="animation-delay:'+i*40+'ms"><div class=r><b class="f e n"><bdi dir=ltr>#'+E(x[0])+'</bdi>'+(x[4]?' <span class="x h">○ '+E(d.il)+'</span>':'')+'</b><span class="u n">'+E(x[2])+'</span></div>'+
'<div class=r style="margin-top:5px"><div class=br><div style="width:'+w+'%;background:'+c+(p!=null&&p<0?';opacity:.35':'')+';animation-delay:'+(i*40+60)+'ms"></div></div><span class="h e xp">'+E(x[3])+'</span></div></div>'});
if(d.m)h+='<p class="h ln" style="padding-top:6px">'+E(d.m)+'</p>';
$('a').innerHTML=h+'</div>'});
boot(R)`,
);
