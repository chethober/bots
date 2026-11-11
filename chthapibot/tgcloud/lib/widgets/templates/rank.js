import { page } from '../base.js';

// 🏁 A leaderboard for sports without two sides: a golf tournament, a race's running
// order, an F1 podium. Payload: { q, c: league code, lg, e: event name,
//   s: status line ("Round 2 - In Progress", "Final"), st: p|i|f, t: start (unix, shown when st is p),
//   r: [[position, name, value ("-12", "+5.3s"), small line under the name (a team)]],
//   nx: [label, event name, place, start (unix)] — what comes next, with a countdown,
//   u }. Row heights are fixed: lib/hubs/sports.js (rankHeight) computes the height.
export default page(
  `.ev{height:40px;margin-bottom:4px}.ev b{display:block;line-height:20px}.ev .h{line-height:18px}
.rw{height:36px;display:flex;align-items:center;gap:8px}.rw.tw{height:44px}.ps{width:30px;flex:none;text-align:center;font-size:13px;font-weight:600;color:var(--h)}.ps.md{font-size:19px}
.nm{display:block;line-height:19px}.sb{display:block;line-height:15px}.vl{flex:none;font-weight:600}
.nx{height:62px;margin-top:6px;padding-top:8px}.nx b{display:block;line-height:20px}.nx .h{line-height:17px}.cd{font-size:20px;font-weight:700;flex:none}`,
  '<div id=a></div>',
  `var M=['🥇','🥈','🥉'],Z;
function S(n){return(n<10?'0':'')+n}
function cd(){var e=$('cd');if(!e)return;var s=D.nx[3]-Date.now()/1e3|0;if(s<=0){e.textContent='';return}var n=s/86400|0;s%=86400;e.textContent=(n?n+'d ':'')+S(s/3600|0)+':'+S(s/60%60|0)+':'+S(s%60)}
var R=go(function(){var d=D,r=d.r||[],x=d.nx,h='<div class=r style="height:22px;margin-bottom:6px"><span class="f t1 e">'+E(d.lg)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
if(d.e)h+='<div class=ev><b class=e>'+E(d.e)+'</b><div class="e '+(d.st=='i'?'lv':'h')+'" style="font-size:12px">'+(d.st=='i'?'<i class=pd></i>':'')+E(d.st=='p'&&d.t?Y(d.t)+' '+T(d.t):d.s)+'</div></div>';
r.forEach(function(p,i){var m=/^\\d+$/.test(p[0])&&+p[0]<4;h+='<div class=ln><div class="rw sg'+(p[3]?' tw':'')+'" style="animation-delay:'+i*30+'ms"><span class="ps n'+(m?' md':'')+'">'+(m?M[p[0]-1]:E(p[0]))+'</span><div class=f><span class="nm e'+(i?'':' w')+'"'+(i?'':' style="font-weight:600"')+'>'+E(p[1])+'</span>'+(p[3]?'<span class="sb h e">'+E(p[3])+'</span>':'')+'</div><span class="vl n">'+E(p[2])+'</span></div></div>'});
if(!r.length&&!x)h+='<p class=h style="height:40px;padding-top:12px">Nothing on right now.</p>';
if(x)h+='<div class="nx ln r"><div class=f><div class=h>'+E(x[0])+'</div><b class=e>'+E(x[1])+'</b><div class="h e">'+E(x[2])+(x[3]?' · '+Y(x[3])+' '+T(x[3]):'')+'</div></div><span id=cd class="cd n"></span></div>';
$('a').innerHTML=h;clearInterval(Z);if(x&&x[3]){cd();Z=setInterval(cd,1e3)}});
boot(R)`,
);
