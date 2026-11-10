import { page } from '../base.js';

// 🚨 A price alert that fired, like a Stocks alert notification opened up: what
// triggered it, the price big, and the last 24h with the alert level as a labelled
// dashed line and the crossing ringed. Payload:
// { s, n, p: price, c: 24h %, k: 'a' above | 'b' below | 'm' moved, lv: level $, pc: move %,
//   lo, hi, v: base36×2 series (24h, ends at p), u }
export default page(
  `#c{position:relative;height:112px;margin:10px 0 2px}.lb{position:absolute;inset-inline-start:0;font-size:11px;font-weight:600;padding:1px 5px;border-radius:5px;background:var(--b2);transform:translateY(-120%)}
.rg{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid;background:var(--s)}.in .rg{animation:fo .2s .45s ease-out backwards}@media(prefers-reduced-motion:reduce){.in .rg{animation:none}}.L{direction:ltr;unicode-bidi:isolate}#c,.ax{direction:ltr}.ax{display:flex;justify-content:space-between;font-size:11px}`,
  '<div id=a></div>',
  `var R=go(function(){var d=D,A=d.v?V(d.v,2):[],up=d.k=='a'||(d.k=='m'&&d.c>=0),col=up?'var(--um)':'var(--dn)',h,ch='',tr;
tr=d.k=='m'?'Moved '+(d.c>=0?'+':'−')+Math.abs(d.c).toFixed(2)+'% in 24h':'Crossed '+(up?'above':'below')+' $'+N(d.lv);
h='<div class=r><span class="lv">🚨 Price alert</span><span class=f></span><span class=h>'+T(d.u)+'</span></div><div class=r style="margin-top:4px"><span class=t1>'+E(d.s)+'</span><span class="h f e">'+E(d.n)+'</span></div>';
h+='<div class="big'+X(O&&O.p,d.p)+'" style="font-size:32px;margin-top:2px">$'+N(d.p)+'</div><div class=r style="font-size:14px;margin-top:2px"><b class="f e '+(up?'up':'dn')+'">'+(up?'▲ ':'▼ ')+tr+'</b>'+(d.k=='m'||d.c==null?'':'<span><span class="L '+C(d.c)+'">'+P(d.c)+'</span> <span class=h>24h</span></span>')+'</div>';
if(A.length>1){var lo=d.lo,hi=d.hi,l2=lo,h2=hi,L=d.lv,vals=A.map(function(a){return lo+(hi-lo)*a});
if(L!=null){l2=Math.min(lo,L);h2=Math.max(hi,L)}var sp=h2-l2||1,n=vals.map(function(x){return(x-l2)/sp}),y=function(t){return(6+100*(1-t)).toFixed(1)},pts=Q(n,300,112,6),xi=-1;
if(L!=null)for(var i=vals.length-1;i>0;i--)if((vals[i-1]-L)*(vals[i]-L)<=0&&vals[i-1]!=vals[i]){xi=i-1+(L-vals[i-1])/(vals[i]-vals[i-1]);break}
ch='<svg class=rv viewBox="0 0 300 112" preserveAspectRatio=none style="height:112px"><polygon points="0,112 '+pts+' 300,112" fill="'+col+'" fill-opacity=".1"/><polyline points="'+pts+'" fill=none stroke="'+col+'" stroke-width=2 vector-effect=non-scaling-stroke stroke-linejoin=round stroke-linecap=round />'+(L==null?'':'<line x1=0 x2=300 y1='+y((L-l2)/sp)+' y2='+y((L-l2)/sp)+' stroke="var(--t)" stroke-opacity=".55" stroke-dasharray="4 4" stroke-width=1.5 vector-effect=non-scaling-stroke />')+'</svg><div class=dt style="left:100%;top:'+y(n[n.length-1])+'px;background:'+col+'"></div>';
if(L!=null)ch+='<div class="lb n" style="top:'+y((L-l2)/sp)+'px'+(y((L-l2)/sp)<26?';transform:translateY(25%)':'')+'">Alert · '+(d.k=='m'?(d.c>=0?'+':'−')+d.pc+'% · ':'')+'$'+N(L)+'</div>';
if(xi>=0)ch+='<div class=rg style="left:'+(xi*100/(A.length-1)).toFixed(1)+'%;top:'+y((L-l2)/sp)+'px;border-color:'+col+'"></div>'}
else ch='<p class=h style="padding-top:46px;text-align:center">Chart unavailable right now</p>';
h+='<div id=c>'+ch+'</div><div class="ax h"><span>24h ago</span><span>Now</span></div>';
$('a').innerHTML=h});
boot(R)`,
);
