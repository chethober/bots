import { page } from '../base.js';

// 💰 Player card, like an Apple Wallet pass: the chip balance big, three stats, and
// the daily bonus as a ticking timer that turns into "Ready" once claimable.
// Payload (lib/widgets/payloads.js): { n: name, c: chips, p: played, w: wins, b: best win,
//   nx: next bonus (unix s), cd: cooldown (s), rt: right-to-left,
//   l: [Balance, Games, Win rate, Biggest win, 🎁 Daily bonus, Ready] }
export default page(
  `.st{display:flex;margin-top:10px;padding-top:8px}.st>div{flex:1;min-width:0}.st b{display:block;font-size:17px}
.bn{margin-top:10px;padding-top:9px}.br{height:4px;border-radius:2px;background:var(--b2);margin-top:7px;overflow:hidden}#bf{height:100%;border-radius:2px;background:var(--tg-theme-button-color,#2481cc);transition:width .6s var(--e)}
.lt{direction:ltr;unicode-bidi:isolate}[dir=rtl] .h{letter-spacing:0}`,
  '<div id=a></div>',
  `var TI=0;
function K(n){return String(Math.round(n||0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function Z(n){return('0'+n).slice(-2)}
function tick(){var d=D,s=Math.ceil(d.nx-Date.now()/1e3),c=$('cd'),f=$('bf');if(!c)return;
if(s<=0){c.innerHTML='<span class=up>● '+E(d.l[5])+'</span>';f.style.width='100%';f.style.background='var(--um)';return}
c.innerHTML='<span class=lt>'+Math.floor(s/3600)+':'+Z(Math.floor(s%3600/60))+':'+Z(s%60)+'</span>';f.style.width=(Math.max(0,1-s/(d.cd||1))*100).toFixed(1)+'%';f.style.background=''}
var R=go(function(){var d=D,l=d.l;document.body.dir=d.rt?'rtl':'ltr';
$('a').innerHTML='<b class="e" style="display:block">'+E(d.n)+'</b><div class=h style="margin-top:8px">'+E(l[0])+'</div><div class="big sg" style="font-size:40px"><span class="lt'+X(O&&O.c,d.c)+'">'+K(d.c)+'</span> <span style="font-size:28px">🪙</span></div>'
+'<div class="st ln">'+[[l[1],K(d.p)],[l[2],d.p?Math.round(d.w*100/d.p)+'%':'—'],[l[3],d.b>0?'+'+K(d.b):'—']].map(function(x,i){return'<div class=sg style="animation-delay:'+(80+i*40)+'ms"><span class="h e" style="display:block">'+E(x[0])+'</span><b class=n><span class=lt>'+x[1]+'</span></b></div>'}).join('')+'</div>'
+'<div class="bn ln sg" style="animation-delay:200ms"><div class=r><span class="f e">'+E(l[4])+'</span><b id=cd class=n></b></div><div class=br><div id=bf style="width:0"></div></div></div>';
tick();if(!TI)TI=setInterval(tick,1000)});
boot(R)`,
);
