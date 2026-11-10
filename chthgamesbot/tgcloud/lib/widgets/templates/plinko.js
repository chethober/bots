import { page } from '../base.js';

// 🔴 Plinko result, replayed: the ball bounces down the 12 rows of pegs along the path
// the server already drew (lib/plinko.js) into its slot, then the payout shows big.
// Plays once per viewer (≤3 s); reduced motion shows the final frame.
// Payload (lib/widgets/payloads.js): { k: drop id, b: bet, p: path ('0' left, '1' right),
//   s: slot, m: multiplier, t: the risk's 13 multipliers, po: payout, rt,
//   l: [title, risk, Bet, Payout, Won, Lost, Stake back] }
export default page(
  `#c{margin:6px 0 2px;direction:ltr}.lt{direction:ltr;unicode-bidi:isolate}[dir=rtl] .h{letter-spacing:0}
.ft{display:flex;align-items:flex-end;gap:8px;padding-top:8px;margin-top:4px}.ft .s{text-align:end}.hd{opacity:0}.sh{animation:fi .3s var(--e) backwards}`,
  '<div id=a></div>',
  `var S=300/14,Y0=9,DY=11.4,SY=147;
function K(n){return String(Math.round(n||0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function RM(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return 0}}
function once(k){try{var s=localStorage.getItem('rp')||'';if((','+s+',').indexOf(','+k+',')>=0)return 0;localStorage.setItem('rp',(k+','+s).slice(0,900));return 1}catch(e){return 1}}
function px(r,k){return 150+(r-k/2)*S}
var R=go(function(){var d=D,l=d.l,i,j,o='',P=[],r=0,net=d.po-d.b,n=d.p.length;
document.body.dir=d.rt?'rtl':'ltr';
for(i=0;i<n;i++)for(j=0;j<i+3;j++)o+='<circle cx="'+(150+(j-(i+2)/2)*S).toFixed(1)+'" cy="'+(Y0+i*DY).toFixed(1)+'" r=2.2 fill="var(--h)"/>';
for(j=0;j<d.t.length;j++){var cx=px(j,12),w=d.t[j]>=1;
o+='<g id=s'+j+'><rect x="'+(cx-S/2+1).toFixed(1)+'" y='+SY+' width="'+(S-2).toFixed(1)+'" height=17 rx=3 fill="'+(w?'var(--um)':'var(--h)')+'" fill-opacity="'+(w?.14:.16)+'"/><text x="'+cx.toFixed(1)+'" y='+(SY+11.6)+' text-anchor=middle font-size=7.6 font-weight=600 fill="var(--t)">'+d.t[j]+'</text></g>'}
for(i=0;i<=n;i++){P.push([px(r,i),i<n?Y0+i*DY-5.6:SY-5.5]);if(i<n)r+=+d.p[i]}
$('a').innerHTML='<div class=r><span class=t1>'+E(l[0])+'</span><span class="h f e" style="text-align:end">'+E(l[1])+' · '+E(l[2])+' <span class=lt>'+K(d.b)+'</span></span></div>'
+'<div id=c><svg viewBox="0 0 300 '+(SY+18)+'">'+o+'<polyline id=tr fill=none stroke="#e5484d" stroke-opacity=".35" stroke-width=1.5 stroke-linejoin=round points=""/><circle id=bl r=5 fill="#e5484d" stroke="var(--s)" stroke-width=1.2 /></svg></div>'
+'<div id=ft class="ft ln hd"><div class=f><div class=h>'+E(l[3])+'</div><div class=big style="font-size:30px"><span class=lt>'+K(d.po)+'</span> <span style="font-size:22px">🪙</span></div></div><div class=s>'
+(net>0?'<b class=up>▲ '+E(l[4])+' <span class=lt>+'+K(net)+'</span></b>':net<0?'<b class=dn>▼ '+E(l[5])+' <span class=lt>'+K(-net)+'</span></b>':'<b>= '+E(l[6])+'</b>')
+'<div class="h lt">'+d.m+'×</div></div></div>';
var bl=$('bl'),tr=[],seg=0,fi=0,FR=6;
function at(x,y){bl.setAttribute('cx',x.toFixed(1));bl.setAttribute('cy',y.toFixed(1))}
function land(){var g=$('s'+d.s),w=d.m>=1;at(P[n][0],P[n][1]);$('tr').setAttribute('points',P.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' '));
g.firstChild.setAttribute('fill-opacity','1');g.lastChild.setAttribute('fill',w?'#fff':'var(--s)')}
function step(){var a=P[seg],b=P[seg+1],s=++fi/FR;at(a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s-5*Math.sin(Math.PI*s));
if(fi>=FR){fi=0;tr.push(a[0].toFixed(1)+','+a[1].toFixed(1));$('tr').setAttribute('points',tr.concat([b[0].toFixed(1)+','+b[1].toFixed(1)]).join(' '));seg++}
if(seg<n)setTimeout(step,30);else{land();$('ft').className='ft ln sh'}}
if(F&&!RM()&&once(d.k)){at(P[0][0],P[0][1]-4);setTimeout(step,250)}else{land();$('ft').className='ft ln'}});
boot(R)`,
);
