import { page } from '../base.js';

// 🚀 Crash result, replayed: the multiplier curve rising to the bust point (time on x,
// like the game itself), the cash-out marked on it, then the payout big. The round is
// already settled by the server (lib/crash.js); the widget only draws it.
// Plays once per viewer (≤3 s); reduced motion shows the final frame.
// Payload (lib/widgets/payloads.js): { k: round id, b: bet, a: auto cash-out|null,
//   x: crash point, co: cashed-out multiplier|null, po: payout, rt,
//   l: [title, Bet, Auto, Cashed out, Crashed at, Payout, Won, Lost, Stake back] }
export default page(
  `#c{position:relative;height:128px;margin:8px 0 4px;direction:ltr}#m{position:absolute;top:0;left:2px;font-size:30px}
.mk{position:absolute;font-size:12px;font-weight:600;white-space:nowrap;transform:translate(-50%,-150%)}.lt{direction:ltr;unicode-bidi:isolate}[dir=rtl] .h{letter-spacing:0}
.ft{display:flex;align-items:flex-end;gap:8px;padding-top:8px;margin-top:6px}.ft .s{text-align:end}.hd{opacity:0}.sh{animation:fi .3s var(--e) backwards}.so{animation:fo .3s backwards}`,
  '<div id=a></div>',
  `var G=7e-5,H=128;
function K(n){return String(Math.round(n||0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function M(m){return m.toFixed(2)+'×'}
function RM(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return 0}}
function once(k){try{var s=localStorage.getItem('rp')||'';if((','+s+',').indexOf(','+k+',')>=0)return 0;localStorage.setItem('rp',(k+','+s).slice(0,900));return 1}catch(e){return 1}}
var R=go(function(){var d=D,l=d.l,x=d.x,co=d.co,T=Math.log(x)/G,top=Math.max(x,1.2),
y=function(m){return(H-6-(m-1)/(top-1)*(H-20)).toFixed(1)},N=60,a=[],b=[],tc=co?Math.log(co)/G:T,i,t,net=d.po-d.b,lost=!co;
document.body.dir=d.rt?'rtl':'ltr';
for(i=0;i<=N;i++){t=i/N*T;var p=(i*300/N).toFixed(1)+','+y(Math.exp(G*t));if(t<=tc)a.push(p);if(t>=tc||i==N)b.push(p)}
if(co){var pc=(T?tc/T*300:0).toFixed(1)+','+y(co);a.push(pc);b.unshift(pc)}
$('a').innerHTML='<div class=r><span class=t1>'+E(l[0])+'</span><span class="h f e" style="text-align:end">'+E(l[1])+' <span class=lt>'+K(d.b)+'</span>'+(d.a?' · '+E(l[2])+' <span class=lt>'+M(d.a)+'</span>':'')+'</span></div>'
+'<div id=c><svg viewBox="0 0 300 '+H+'" preserveAspectRatio=none style="height:'+H+'px"><defs><clipPath id=k><rect id=kr x=-4 y=-20 width=0 height='+(H+40)+' /></clipPath></defs>'
+'<line x1=0 x2=300 y1='+y(1)+' y2='+y(1)+' stroke="var(--h)" stroke-opacity=".45" stroke-dasharray="2 3" vector-effect=non-scaling-stroke />'
+'<g clip-path="url(#k)"><polygon id=pw points="0,'+H+' '+a.join(' ')+' '+(T&&co?(tc/T*300).toFixed(1):300)+','+H+'" fill="var(--um)" fill-opacity=".1"/><polyline id=la points="'+a.join(' ')+'" fill=none stroke="var(--um)" stroke-width=2 vector-effect=non-scaling-stroke stroke-linejoin=round stroke-linecap=round />'
+(co?'<polyline points="'+b.join(' ')+'" fill=none stroke="var(--h)" stroke-width=2 stroke-dasharray="4 3" vector-effect=non-scaling-stroke />':'')+'</g></svg>'
+'<div id=hd class=dt style="background:var(--um)"></div>'
+(co?'<div id=cm class=hd><div class=dt style="left:'+(T?tc/T*100:0).toFixed(1)+'%;top:'+y(co)+'px;background:var(--um)"></div><div class="mk up" style="left:'+Math.min(88,Math.max(12,T?tc/T*100:0)).toFixed(1)+'%;top:'+y(co)+'px">✓ '+M(co)+'</div></div>':'')
+'<div id=bx class="mk dn hd" style="left:'+(T?88:12)+'%;top:'+Math.max(30,+y(x))+'px">✕ '+M(x)+'</div>'
+'<div id=m class="big lt">1.00×</div></div>'
+'<div id=ft class="ft ln hd"><div class=f><div class=h>'+E(l[5])+'</div><div class=big style="font-size:30px"><span class=lt>'+K(d.po)+'</span> <span style="font-size:22px">🪙</span></div></div><div class=s>'
+(net>0?'<b class=up>▲ '+E(l[6])+' <span class=lt>+'+K(net)+'</span></b>':net<0?'<b class=dn>▼ '+E(l[7])+' <span class=lt>'+K(-net)+'</span></b>':'<b>= '+E(l[8])+'</b>')
+'<div class=h>'+(co?E(l[3])+' <span class=lt>'+M(co)+'</span>':E(l[4])+' <span class=lt>'+M(x)+'</span>')+'</div></div></div>';
var dur=T?Math.min(2600,700+T*.07):400,t0=Date.now(),shown=0;
function fr(f){var tt=f*T,m=f<1?Math.min(x,Math.floor(Math.exp(G*tt)*100)/100):x,hd=$('hd');
$('kr').setAttribute('width',(f*300+4).toFixed(1));hd.style.left=(f*100)+'%';hd.style.top=y(m)+'px';$('m').textContent=M(m);
if(co&&!shown&&tt>=tc){shown=1;$('cm').className='so';hd.style.background='var(--h)'}
if(f>=1){hd.style.background=lost?'var(--dn)':'var(--h)';$('m').className='big lt '+(lost?'dn':'');$('m').style.color=lost?'':'var(--h)';$('bx').className='mk dn so';$('ft').className='ft ln sh';
if(lost){$('la').setAttribute('stroke','var(--dn)');$('pw').setAttribute('fill','var(--dn)')}if(co)$('cm').className='';}}
function step(){var f=Math.min(1,(Date.now()-t0)/dur);fr(f);if(f<1)setTimeout(step,33)}
if(F&&!RM()&&once(d.k))step();else{shown=1;fr(1);$('bx').className='mk dn';$('ft').className='ft ln'}});
boot(R)`,
);
