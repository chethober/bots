import { page } from '../base.js';

// 📊 A watchlist like Stocks: symbol over name, sparkline, price over a change pill.
// Payload: { q, t: title, r:[[id,sym,name,price,ch24,spark base36×1]], more, u }
export default page(
  `.c{padding:4px 0}.y{width:96px;flex:none}.y b{display:block;font-size:16px}.k{width:64px;flex:none;position:relative;height:28px}.k svg{height:28px}.k .dt{width:6px;height:6px;margin:-3px 0 0 -3px}.v{text-align:right;flex:none;min-width:84px}.pl{display:inline-block;margin-top:3px;min-width:70px;padding:2px 6px;border-radius:6px;color:#fff;font-size:13px;font-weight:600;text-align:right}`,
  '<div id=a></div>',
  `function px(c){var o=O&&!F&&O.r.filter(function(x){return x[0]==c[0]})[0];return X(o&&o[3],c[3])}
var R=go(function(){var d=D,h='<div class=r style="padding-bottom:6px"><span class="f t1 e">'+E(d.t)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
d.r.forEach(function(c,i){var col=c[4]==null?'var(--h)':c[4]>=0?'var(--um)':'var(--dn)',a=c[5]?V(c[5],1):[];
h+='<div class=ln><div class="c r sg" style="animation-delay:'+i*40+'ms" data-i="'+E(c[0])+'"><div class="y e"><b class=e>'+E(c[1])+'</b><span class="h e" style="display:block">'+E(c[2])+'</span></div><span class=f></span>'+(a.length>1?'<div class=k><svg class=rv style="animation-delay:'+(i*40+80)+'ms" viewBox="0 0 64 28" preserveAspectRatio=none><polyline points="'+Q(a,64,28,3)+'" fill=none stroke="'+col+'" stroke-width=1.5 vector-effect=non-scaling-stroke stroke-linejoin=round /></svg><div class=dt style="left:100%;top:'+(3+22*(1-a[a.length-1])).toFixed(1)+'px;background:'+col+'"></div></div>':'')+'<span class=f></span><div class="v n"><div class="'+px(c)+'" style="font-weight:600">$'+N(c[3])+'</div><span class=pl style="background:'+col+'">'+(c[4]==null?'—':(c[4]>=0?'+':'−')+Math.abs(c[4]).toFixed(2)+'%')+'</span></div></div></div>'});
if(d.more)h+='<p class=h style="padding-top:6px">+'+d.more+' more</p>';
$('a').innerHTML=h});
boot(R)`,
);
