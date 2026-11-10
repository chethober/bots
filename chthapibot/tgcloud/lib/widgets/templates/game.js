import { page } from '../base.js';

// ⚽️ One match, laid out like a Live Activity: crests either side, the score and
// the clock in the middle. Payload: { q, lg, st: pre|in|post, dt, t, h:[abbr,name,score,bg,fg], a:[…], u }
export default page(
  `.t{display:flex;align-items:center;margin-top:6px}.tm{flex:1;text-align:center;min-width:0}.ab{width:44px;height:44px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font:700 13px system-ui}.mid{min-width:116px;text-align:center}.sc{font-size:38px}.sc span{display:inline-block;padding:0 3px}.in .sc,.pp{animation:pp .32s var(--e) both}@keyframes pp{from{opacity:0;transform:translateY(-30%)}}`,
  '<div id=a></div>',
  `function S(s){return'<div class=tm><div class=ab style="background:#'+s[3]+';color:#'+s[4]+'">'+E(s[0])+'</div><b class=e style="display:block;font-size:14px">'+E(s[1])+'</b></div>'}
function sc(i,v){var o=O&&!F&&O[i][2];return'<span class="'+(o!=null&&o!=v?'pp':'')+'">'+E(v)+'</span>'}
var R=go(function(){var d=D,st=d.st=='in'?'<span class=lv><i class=pd></i>'+E(d.dt)+'</span>':d.st=='post'?'<b class=h>'+E(d.dt||'FT')+'</b>':'<span class=h>'+Y(d.t)+' '+T(d.t)+'</span>';
$('a').innerHTML='<div class="r h"><span class="f e">'+E(d.lg)+'</span>'+(d.st=='in'?'Updated '+T(d.u):'')+'</div><div class=t>'+S(d.h)+'<div class=mid><div class="sc big">'+(d.st=='pre'?'<span class=h style="font-size:20px;font-weight:600">vs</span>':sc('h',d.h[2])+'<span style="color:var(--h);font-weight:400">–</span>'+sc('a',d.a[2]))+'</div>'+st+'</div>'+S(d.a)+'</div>'});
boot(R)`,
);
