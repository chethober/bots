import { page } from '../base.js';

// 🏆 The leaderboard, like a Game Center board: medals for the first three, a bar
// under each name as long as its share of the leader's chips, the viewer's own row
// tinted. A viewer outside the list gets their row and rank under a divider.
// Payload (lib/widgets/payloads.js topWidget): { t: title, r: [[name, chips]…] richest first,
//   me: index of the viewer in r or -1, my: [rank, name, chips] when outside r,
//   rt: right-to-left, l: [You, empty] }
export default page(
  `.lt{direction:ltr;unicode-bidi:isolate}[dir=rtl] *{letter-spacing:0!important}
.rw{position:relative;display:flex;align-items:center;gap:8px;height:38px;padding:0 6px;border-radius:8px}
.rw.me{background:var(--b2)}.rk{width:26px;flex:none;text-align:center;font-size:13px;color:var(--h);font-weight:600}.rk.md{font-size:19px}
.nm{flex:1;min-width:0}.nm b{display:block;line-height:19px}.br{height:3px;border-radius:2px;background:var(--b2);margin-top:3px;overflow:hidden}.me .br{background:var(--g)}
.br i{display:block;height:100%;border-radius:2px;background:var(--tg-theme-button-color,#2481cc);opacity:.55}.r1 .br i{background:#d9a400;opacity:1}
.cp{flex:none;font-weight:600}.yu{font-size:11px;font-weight:600;color:var(--tg-theme-button-color,#2481cc);margin-inline-start:6px}
.dv{height:13px;display:flex;align-items:center}.dv:before{content:'';flex:1;border-top:1px dashed var(--g)}
.in .br i{animation:gr .5s var(--e) backwards}@keyframes gr{from{width:0}}
@media(prefers-reduced-motion:reduce){.in .br i{animation:none}}`,
  '<div id=a></div>',
  `var M=['🥇','🥈','🥉'];
function K(n){return String(Math.round(n||0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function rw(k,x,me,top,i){var o=O&&!F&&O.r[k-1];return'<div class="rw sg'+(me?' me':'')+(k==1?' r1':'')+'" style="animation-delay:'+i*30+'ms"><span class="rk n'+(k<4?' md':'')+'">'+(M[k-1]||k)+'</span><div class=nm><b class=e><bdi>'+E(x[0])+'</bdi>'+(me?'<span class=yu>'+E(D.l[0])+'</span>':'')+'</b><div class=br><i style="width:'+Math.max(2,100*x[1]/top).toFixed(1)+'%;animation-delay:'+(i*30+60)+'ms"></i></div></div><span class="cp n lt'+(o&&o[0]==x[0]?X(o[1],x[1]):'')+'">'+K(x[1])+' 🪙</span></div>'}
var R=go(function(){var d=D,r=d.r||[],top=r.length&&r[0][1]>0?r[0][1]:1,h='<div class="t1 e" style="height:22px;margin-bottom:8px">'+E(d.t)+'</div>';
document.documentElement.dir=d.rt?'rtl':'ltr';
r.forEach(function(x,i){h+=rw(i+1,x,i==d.me,top,i)});
if(!r.length)h+='<p class=h style="line-height:38px">'+E(d.l[1])+'</p>';
if(d.my)h+='<div class=dv></div>'+rw(d.my[0],[d.my[1],d.my[2]],1,top,r.length);
$('a').innerHTML=h});
boot(R)`,
);
