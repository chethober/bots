import { page } from '../base.js';

// 📺 A league scoreboard. Payload: { q, c: league code, lg, g:[[id,home,away,hs,as,st,detail,t]], u }
export default page(
  `.g{padding:6px 0}.s{width:54px;flex:none;font-size:12px;text-align:center}.w{font-weight:600}.x{text-align:right;min-width:30px;padding:0 3px}`,
  '<div id=a></div>',
  `function sx(g,i){var o=O&&!F&&O.g.filter(function(x){return x[0]==g[0]})[0];return X(o&&o[i],g[i])}
var R=go(function(){var d=D,h='<div class=r style="padding-bottom:6px"><span class="f t1 e">'+E(d.lg)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
d.g.forEach(function(g,i){var s=g[5],a=+g[3],b=+g[4],p=s=='p';
h+='<div class="ln"><div class="g r sg" style="animation-delay:'+i*40+'ms" data-i="'+E(g[0])+'"><div class="s '+(s=='i'?'lv':'h')+'">'+(p?(Y(g[7])=='Today'?'':Y(g[7])+'<br>')+T(g[7]):(s=='i'?'<i class=pd></i>':'')+E(g[6]))+'</div><div class=f><div class=r><span class="f e'+(s=='f'&&a>b?' w':'')+'">'+E(g[1])+'</span><b class="x n'+sx(g,3)+'">'+(p?'':E(g[3]))+'</b></div><div class=r><span class="f e'+(s=='f'&&b>a?' w':'')+'">'+E(g[2])+'</span><b class="x n'+sx(g,4)+'">'+(p?'':E(g[4]))+'</b></div></div></div></div>'});
if(!d.g.length)h+='<p class=h style="padding:12px 0">Nothing on right now.</p>';
$('a').innerHTML=h});
boot(R)`,
);
