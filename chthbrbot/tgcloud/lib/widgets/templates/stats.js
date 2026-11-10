import { page } from '../base.js';

// 📊 An owner's stats, laid out like Screen Time's week view: two big totals, then
// daily bars with today highlighted, gridline values and a dashed average line in
// a gutter at the end, then a row of small figures. Only per-day counts, never
// senders or messages. Payload (lib/manage.js statsWidgetData):
// { l:[title,week,total,today,replies,rate,avg,status,empty], p: paused 0|1, r: rtl 0|1,
//   g: digits (fa/ar only), n: total received, c:[count per day, oldest → today],
//   s: UTC day number of c[0], rp: replies sent, rr: reply rate, ready to show (or '') }
// The gutter takes the width of its widest label (hidden copies in .sz), so long
// translations of "avg" and big counts never cover the bars.
export default page(
  `:root{--a:var(--tg-theme-button-color,#2481cc)}[dir=rtl] *{letter-spacing:0!important}
.hd{display:flex;gap:16px;margin-top:8px}.hd>div{flex:1;min-width:0}.hd .big{font-size:34px}
.cw{position:relative;display:flex;margin-top:12px}
.ch{height:112px;display:flex;align-items:flex-end;gap:4px;border-bottom:1px solid var(--g)}
.gu{position:relative;padding-inline-start:5px;font-size:10px;line-height:12px;color:var(--h)}.gu b{position:absolute;inset-inline-start:5px;font-weight:400;white-space:nowrap}.gu .ag{color:var(--um);font-weight:600}
.sz{display:block;height:0;overflow:hidden;visibility:hidden;font-weight:600;white-space:nowrap}
.gl,.av{position:absolute;inset-inline:0;border-top:1px solid var(--g)}.av{border-top:1px dashed var(--um);z-index:1}
.b{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end}.b i{display:block;width:100%;border-radius:3px 3px 1px 1px;background:var(--a);opacity:.38;transform-origin:bottom}.b.td i{opacity:1}
.dl{display:flex;gap:4px;margin-top:3px}.dl span{flex:1;min-width:0;text-align:center;font-size:10px;color:var(--h)}.dl .td{color:var(--a);font-weight:700}
.em{position:absolute;top:0;inset-inline:0;height:112px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;color:var(--h)}.em span{background:var(--s);padding:2px 6px}
.ft{display:flex;margin-top:10px;padding-top:8px}.ft>div{flex:1;min-width:0}.ft b{display:block;font-size:17px}
.in .b i{animation:gr .4s var(--e) backwards}@keyframes gr{from{transform:scaleY(0)}}
@media(prefers-reduced-motion:reduce){.in .b i{animation:none}}`,
  '<div id=a></div>',
  `function I(n){var s=String(Math.round(n||0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,D.g?'٬':','),g=D.g;return g?s.replace(/\\d/g,function(c){return g[c]}):s}
function nm(x){if(x<=4)return 4;var p=Math.pow(10,Math.floor(Math.log(x)/Math.LN10)),m=x/p;return(m<=2?2:m<=5?5:10)*p}
function sum(a){return a.reduce(function(s,x){return s+x},0)}
var R=go(function(){var d=D,l=d.l,c=d.c||[],k=c.length,mx=Math.max.apply(0,c.concat(0)),top=nm(mx),av=k?sum(c)/k:0,y=function(v){return Math.round(112*(1-v/top))},ya=y(av),yl=ya<13?ya+2:ya-13,bars='',dl='',gu='',ln='';
document.documentElement.dir=d.r?'rtl':'ltr';
c.forEach(function(v,i){var t=i==k-1?' td':'';bars+='<div class="b'+t+'"><i style="height:'+(100*v/top).toFixed(1)+'%;animation-delay:'+i*14+'ms"></i></div>';dl+='<span class="n'+t+'">'+I(new Date((d.s+i)*864e5).getUTCDate())+'</span>'});
[top,top/2].forEach(function(v){var t=y(v);ln+='<div class=gl style="top:'+t+'px"></div>';if(!mx||Math.abs(yl-t-2)>=12)gu+='<b class=n style="top:'+(t+2)+'px">'+I(v)+'</b>'});
if(mx){ln+='<div class=av style="top:'+ya+'px"></div>';gu+='<b class=ag style="top:'+yl+'px">'+E(l[6])+'</b>'}
$('a').innerHTML='<div class=r><span class="f t1 e">'+E(l[0])+'</span><span class="h e">'+(d.p?'⏸ ':'<i class=pd style="color:var(--um)"></i>')+E(l[7])+'</span></div>'+
'<div class=hd><div class=sg><div class="h e">'+E(l[1])+'</div><div class=big>'+I(sum(c.slice(-7)))+'</div></div><div class=sg style="animation-delay:40ms"><div class="h e">'+E(l[2])+'</div><div class=big>'+I(d.n)+'</div></div></div>'+
'<div class=cw><div class=f><div class=ch>'+bars+'</div><div class=dl>'+dl+'</div></div><div class=gu><span class=sz>'+E(l[6])+'</span><span class="sz n">'+I(top)+'</span>'+gu+'</div>'+ln+(mx?'':'<div class=em><span>'+E(l[8])+'</span></div>')+'</div>'+
'<div class="ft ln">'+[[l[3],I(c[k-1])],[l[4],I(d.rp)],[l[5],d.rr?E(d.rr):'—']].map(function(x,i){return'<div class=sg style="animation-delay:'+(120+i*40)+'ms"><div class="h e">'+E(x[0])+'</div><b class=n>'+x[1]+'</b></div>'}).join('')+'</div>'});
boot(R)`,
);
