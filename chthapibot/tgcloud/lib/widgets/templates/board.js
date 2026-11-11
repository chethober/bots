import { page } from '../base.js';

// 📺 A scoreboard for any two-sided sport: league games, tennis matches, MMA fights,
// cricket. Payload: { q, c: league code, lg, g: rows, u }. A row is a game
//   [id, home, away, home score, away score, st: p|i|f, detail, t (unix, 0 = unknown),
//    winner (1 home, 2 away; else told from numeric scores), note (a line under the game)]
// or a string: a section title (a tournament, a fight card, a cricket competition).
// Scores are shown as sent ("3", "6 4 7", "287/6 (50)"). Row heights are fixed:
// lib/hubs/sports.js (boardHeight) computes the widget's height from them.
export default page(
  `.g{padding:6px 0}.s{width:54px;flex:none;font-size:12px;line-height:16px;max-height:32px;overflow:hidden;text-align:center;overflow-wrap:anywhere}.w{font-weight:600}.x{text-align:right;min-width:30px;padding:0 3px;flex:none;white-space:nowrap}.g .r{height:20px}
.sh{height:26px;line-height:18px;padding-top:8px;font-weight:600}.nt{height:16px;line-height:14px;margin-top:-4px;padding-inline-start:62px}`,
  '<div id=a></div>',
  `function sx(g,i){var o=O&&!F&&O.g.filter(function(x){return x[0]==g[0]})[0];return X(o&&o[i],g[i])}
var R=go(function(){var d=D,k=0,h='<div class=r style="height:22px;margin-bottom:6px"><span class="f t1 e">'+E(d.lg)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
d.g.forEach(function(g){if(typeof g=='string'){h+='<div class="ln sh h e">'+E(g)+'</div>';return}
var s=g[5],a=+g[3],b=+g[4],p=s=='p',w=g[8]||(s=='f'?a>b?1:b>a?2:0:0),i=k++;
h+='<div class="ln"><div class="g r sg" style="animation-delay:'+i*40+'ms" data-i="'+E(g[0])+'"><div class="s '+(s=='i'?'lv':'h')+'">'+(p?g[7]?(Y(g[7])=='Today'?'':Y(g[7])+'<br>')+T(g[7]):E(g[6]):(s=='i'?'<i class=pd></i>':'')+E(g[6]))+'</div><div class=f><div class=r><span class="f e'+(w==1?' w':'')+'">'+E(g[1])+'</span><b class="x n'+sx(g,3)+'">'+(p?'':E(g[3]))+'</b></div><div class=r><span class="f e'+(w==2?' w':'')+'">'+E(g[2])+'</span><b class="x n'+sx(g,4)+'">'+(p?'':E(g[4]))+'</b></div></div></div>'+(g[9]?'<div class="nt h e">'+E(g[9])+'</div>':'')+'</div>'});
if(!k)h+='<p class=h style="height:40px;padding-top:12px">Nothing on right now.</p>';
$('a').innerHTML=h});
boot(R)`,
);
