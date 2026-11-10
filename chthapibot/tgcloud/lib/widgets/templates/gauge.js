import { page } from '../base.js';

// 🌍 Fear & Greed dial like CNN's index page (half dial, five labelled bands, the
// value marked on the arc, previous values beside it as round badges), then the
// global market stats in Stocks-style columns. Also the Fear & Greed alert card.
// Payload: { f: 0–100, l: label, y: yesterday, w: a week ago, a: alert line?,
//   mc: "2.41T", mx: market cap 24h %, bd: BTC dominance %, fe:[fast, medium, slow] sat/vB (≈10 min, 30 min, 1 h), u }
// Every field but f is optional; the stats rows only show when present.
export default page(
  `#g{max-width:280px;margin:2px auto 0}.hs{display:flex;gap:10px;margin-top:6px}.hs>div{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
.bd{flex:none;width:34px;height:34px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.st{display:flex;margin-top:10px;padding-top:8px;gap:8px}.st>div{flex:1;min-width:0}.st b{display:block;font-size:15px}.br{height:4px;border-radius:2px;background:var(--g);margin-top:4px;overflow:hidden}.br i{display:block;height:100%;background:#f0912f}`,
  '<div id=a></div>',
  `var BA=[[0,25,'Extreme fear','#d03b3b'],[25,45,'Fear','#ec7a2c'],[45,55,'Neutral','#c99a06'],[55,75,'Greed','#6aae2c'],[75,100,'Extreme greed','#0ca30c']];
function B(v){for(var i=0;i<5;i++)if(v<BA[i][1]+(i==2||i==3?1:0)||i==4)return BA[i]}
function pt(v,r){var t=Math.PI*(1-v/100);return(130+r*Math.cos(t)).toFixed(1)+' '+(132-r*Math.sin(t)).toFixed(1)}
function arc(a,b,r){return'M'+pt(a,r)+'A'+r+' '+r+' 0 0 1 '+pt(b,r)}
function hb(lb,v){if(v==null)return'';var b=B(v);return'<div><span class=bd style="border-color:'+b[3]+';color:'+b[3]+'">'+v+'</span><div class=e><span class=h>'+lb+'</span><br><b style="font-size:13px">'+b[2]+'</b></div></div>'}
var R=go(function(){var d=D,v=Math.max(0,Math.min(100,d.f)),b=B(v),s='',h;
BA.forEach(function(x,i){var on=x==b;s+='<path d="'+arc(x[0]+(i?.7:0),x[1]-(i<4?.7:0),96)+'" fill=none stroke="'+x[3]+'" stroke-width=12 stroke-opacity="'+(on?1:.28)+'"/><path id=p'+i+' d="'+arc(x[0],x[1],108)+'" fill=none /><text font-size="'+(i==2?8.5:9.5)+'" fill="'+(on?x[3]:'var(--h)')+'"'+(on?' font-weight=700':'')+'><textPath href="#p'+i+'" startOffset="50%" text-anchor=middle>'+x[2]+'</textPath></text>'});
var m=pt(v,96).split(' ');
s+='<circle cx='+m[0]+' cy='+m[1]+' r=8 fill="var(--s)" stroke="'+b[3]+'" stroke-width=3 /><text x=130 y=114 text-anchor=middle font-size=42 font-weight=700 letter-spacing=-1 fill="var(--t)">'+v+'</text><text x=130 y=133 text-anchor=middle font-size=14 font-weight=600 fill="'+b[3]+'">'+E(d.l||b[2])+'</text><text x=34 y=147 text-anchor=middle font-size=9 fill="var(--h)">0</text><text x=226 y=147 text-anchor=middle font-size=9 fill="var(--h)">100</text>';
h=d.a?'<div class=r><b class="f e">🚨 '+E(d.a)+'</b><span class=h>'+T(d.u)+'</span></div>':'<div class=r><span class="f t1 e">Fear &amp; Greed</span><span class=h>Updated '+T(d.u)+'</span></div>';
h+='<svg id=g class=sg viewBox="0 0 260 150">'+s+'</svg>';
if(d.y!=null||d.w!=null)h+='<div class=hs>'+hb('Yesterday',d.y)+hb('Last week',d.w)+'</div>';
var st=[];
if(d.mc)st.push(['Market cap','$'+E(d.mc),d.mx==null?'':'<span class="'+C(d.mx)+'" style="font-size:12px">'+P(d.mx)+' 24h</span>']);
if(d.bd!=null)st.push(['BTC dominance',d.bd.toFixed(1)+'%','<div class=br><i style="width:'+d.bd+'%"></i></div>']);
if(st.length)h+='<div class="st ln">'+st.map(function(x){return'<div><span class=h>'+x[0]+'</span><b class=n>'+x[1]+'</b>'+x[2]+'</div>'}).join('')+'</div>';
if(d.fe)h+='<div class="st ln"><div><b>BTC fees</b><span class=h>sat/vB</span></div>'+[['Fast',d.fe[0]],['Medium',d.fe[1]],['Slow',d.fe[2]]].map(function(x){return'<div><span class=h>'+x[0]+'</span><b class=n>'+(x[1]==null?'—':x[1])+'</b></div>'}).join('')+'</div>';
$('a').innerHTML=h});
boot(R)`,
);
