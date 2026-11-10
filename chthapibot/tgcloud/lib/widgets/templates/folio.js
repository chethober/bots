import { page } from '../base.js';

// 💼 Portfolio, like a brokerage account screen: total value big with total P/L,
// an allocation donut (top 4 holdings + Other, fixed hue order) with a legend, and
// one Stocks-style row per holding. Payload:
// { t: total $, pl: P/L $|null, pp: P/L %|null, d: 24h %|null, ot: $ of holdings not in r,
//   r:[[sym, amount, value|null, P/L %|null, avg buy|null]] (by value, largest first), more, u }
export default page(
  `#hd{display:flex;align-items:center;gap:12px;margin-top:2px}.dg{width:88px;height:88px;flex:none;position:relative}.dg svg{transform:rotate(-90deg)}.dg div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.lg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 10px;margin:8px 0 6px;font-size:12px;line-height:16px}.lg i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-inline-end:4px}
.c{padding:4px 0}.y{width:104px;flex:none}.y b{display:block;font-size:16px}.m{text-align:end;flex:1;min-width:0}.v{text-align:end;flex:none;min-width:92px}.L{direction:ltr;unicode-bidi:isolate}.pl{display:inline-block;margin-top:3px;min-width:70px;padding:2px 6px;border-radius:6px;color:#fff;font-size:13px;font-weight:600;text-align:end}`,
  '<div id=a></div>',
  `var HU=['#3478f6','#f0912f','#9a5bd6','#1fa595'];
function A(n){return n>=1e3?N(n):String(+(+n).toPrecision(6))}
function S(n){return(n>=0?'+':'−')}
var R=go(function(){var k,d=D,seg=[],oth=d.ot||0,sum,off=0,arcs='',h;
d.r.forEach(function(x){if(x[2]==null)return;if(seg.length<4)seg.push([x[0],x[2],HU[seg.length]]);else oth+=x[2]});
if(oth>0)seg.push(['Other',oth,'var(--h)']);
sum=seg.reduce(function(s,x){return s+x[1]},0)||1;
seg.forEach(function(x){var p=x[1]/sum*100,g=seg.length>1?Math.min(.9,p/3):0,l=Math.max(.01,p-g);arcs+='<circle r=15.915 cx=18 cy=18 fill=none stroke="'+x[2]+'" stroke-width=4 stroke-dasharray="'+l.toFixed(2)+' '+(100-l).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"/>';x[3]=p;off+=p});
h='<div class=r><span class="f t1 e">Portfolio</span><span class=h>Updated '+T(d.u)+'</span></div>';
h+='<div id=hd><div class=f><div class="big n'+X(O&&O.t,d.t)+'" style="font-size:32px">$'+N(d.t)+'</div>';
if(d.pl!=null)h+='<div style="font-size:14px;margin-top:3px"><b class="L '+C(d.pl)+'">'+S(d.pl)+'$'+N(Math.abs(d.pl))+' ('+S(d.pp)+Math.abs(d.pp).toFixed(2)+'%)</b> <span class=h>Total P/L</span></div>';
if(d.d!=null)h+='<div style="font-size:13px;margin-top:2px"><span class="L '+C(d.d)+'">'+P(d.d)+'</span> <span class=h>24h</span></div>';
h+='</div>'+(seg.length?'<div class="dg sg"><svg viewBox="0 0 36 36">'+arcs+'</svg><div><b>'+(k=d.r.length+(d.more||0))+'</b><span class=h style="font-size:11px">'+(k==1?'coin':'coins')+'</span></div></div>':'')+'</div>';
if(seg.length)h+='<div class=lg>'+seg.map(function(x){return'<span class=e style="display:block"><i style="background:'+x[2]+'"></i>'+E(x[0])+' <span class="h n">'+(x[3]<1?'<1':Math.round(x[3]))+'%</span></span>'}).join('')+'</div>';
d.r.forEach(function(x,i){var c=x[3]==null?'var(--h)':x[3]>=0?'var(--um)':'var(--dn)';
h+='<div class=ln><div class="c r sg" style="animation-delay:'+i*40+'ms"><div class="y"><b class=e>'+E(x[0])+'</b><span class="h n e" style="display:block">'+A(x[1])+'</span></div><div class="m h"><div style="font-size:11px">Avg buy</div><div class=n>'+(x[4]==null?'—':'$'+N(x[4]))+'</div></div><div class="v n"><div style="font-weight:600">'+(x[2]==null?'—':'$'+N(x[2]))+'</div><span class="pl L" style="background:'+c+'">'+(x[3]==null?'—':S(x[3])+Math.abs(x[3]).toFixed(2)+'%')+'</span></div></div></div>'});
if(d.more)h+='<p class=h style="padding-top:6px">+'+d.more+' more</p>';
$('a').innerHTML=h});
boot(R)`,
);
