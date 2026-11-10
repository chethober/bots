import { page } from '../base.js';

// 🪙 One coin, like a Stocks detail view. Payload:
// { q, id, s, n, rk, p, ch:[1h,24h,7d], d: days, dc: change over d, lo, hi, v: base36×2 series, mc, u }
// Drag across the chart to read the price at any point.
export default page(
  `#c{position:relative;height:124px;margin:8px 0 4px;touch-action:none}#x{position:absolute;top:0;bottom:0;border-left:1px solid var(--h);display:none}#x .dt{left:0}
.st{display:flex;margin-top:10px;padding-top:8px}.st>div{flex:1}.st b{display:block;font-size:14px}`,
  '<div id=a></div>',
  `var A=[];
function at(i){var d=D;return{v:d.lo+(d.hi-d.lo)*A[i],t:d.u-d.d*86400*(1-i/(A.length-1))}}
function M(t){var d=new Date(t*1e3);return d.getDate()+' '+'JanFebMarAprMayJunJulAugSepOctNovDec'.substr(d.getMonth()*3,3)}
function head(v,c,lb){var a=v-v/(1+c/100);$('p').innerHTML='$'+N(v);$('k').innerHTML=c==null?'':'<b class='+C(c)+'>'+(c>=0?'+':'−')+'$'+N(Math.abs(a))+' ('+Math.abs(c).toFixed(2)+'%)</b> <span class=h>'+lb+'</span>'}
var R=go(function(){var d=D,col=(d.dc==null?d.ch[1]:d.dc)>=0?'var(--um)':'var(--dn)',ch='',lb,y=function(v){return(6+112*(1-v)).toFixed(1)};A=d.v?V(d.v,2):[];
lb={1:'Today',7:'Past week',30:'Past month',90:'Past 3 months'}[d.d];
if(A.length>1){var pts=Q(A,300,124,6);
ch='<svg class=rv viewBox="0 0 300 124" preserveAspectRatio=none style="height:124px"><line x1=0 x2=300 y1='+y(A[0])+' y2='+y(A[0])+' stroke="var(--h)" stroke-opacity=".45" stroke-dasharray="2 3" vector-effect=non-scaling-stroke /><polygon points="0,124 '+pts+' 300,124" fill="'+col+'" fill-opacity=".1"/><polyline points="'+pts+'" fill=none stroke="'+col+'" stroke-width=2 vector-effect=non-scaling-stroke stroke-linejoin=round stroke-linecap=round /></svg><div class=dt style="left:100%;top:'+y(A[A.length-1])+'px;background:'+col+'"></div><div id=x><div class=dt style="background:'+col+'"></div></div>'}else ch='<p class=h style="padding-top:52px;text-align:center">Chart unavailable right now</p>';
$('a').innerHTML='<div class=r><span class="t1">'+E(d.s)+'</span><span class="h f e">'+E(d.n)+'</span>'+(d.rk?'<span class=h>#'+d.rk+'</span>':'')+'</div><div id=p class="big'+X(O&&O.p,d.p)+'" style="font-size:32px;margin-top:4px"></div><div id=k style="font-size:14px;margin-top:2px;height:18px"></div><div id=c>'+ch+'</div><div class="st ln">'+[['High','$'+N(d.hi)],['Low','$'+N(d.lo)],['24h','<span class='+C(d.ch[1])+'>'+P(d.ch[1])+'</span>'],['Mkt cap',d.mc?'$'+E(d.mc):'—']].map(function(s){return'<div><span class=h>'+s[0]+'</span><b class=n>'+s[1]+'</b></div>'}).join('')+'</div>';
head(d.p,d.dc,lb);
if(A.length>1)scrub($('c'),function(x){var xl=$('x');if(x<0){xl.style.display='none';return head(D.p,D.dc,lb)}var i=Math.round(x*(A.length-1)),q=at(i);xl.style.display='block';xl.style.left=(i*100/(A.length-1))+'%';xl.firstChild.style.top=y(A[i])+'px';head(q.v,(q.v/at(0).v-1)*100,D.d<=7?Y(q.t)+' '+T(q.t):M(q.t))});});
boot(R)`,
);
