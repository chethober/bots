import { page } from '../base.js';

// 🏷 A product's Nutri-Score and NOVA badges, then nutrition per 100 g as bars against
// the reference daily intake, each with its low/med/high level written out.
// Payload: { n: name, b: brand, q: quantity, ns: a–e|null, nv: 1–4|null, ml: per 100 ml,
//   v:[kcal, fat, sat, sugars, salt, protein, fibre] (null = not given), l: levels of
//   fat/sat/sugars/salt as l|m|h|-, al: allergens }
export default page(
  `.bd{display:flex;align-items:flex-start;gap:16px;margin:10px 0 12px}.ns{display:flex;align-items:center;gap:2px}
.ns i{font:700 15px system-ui;font-style:normal;color:#fff;width:26px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:5px;opacity:.38}
.ns i.on{width:38px;height:44px;font-size:24px;border-radius:8px;opacity:1;box-shadow:0 0 0 2px var(--s),0 0 0 3px currentColor}
.nv{width:34px;height:44px;border-radius:7px;color:#fff;font:700 22px system-ui;display:flex;align-items:center;justify-content:center;flex:none}
.cp{font-size:12px;margin-top:4px}.nr{display:flex;align-items:center;gap:8px;height:29px}.nr .k{width:72px}.nr .v{width:66px;text-align:right}.nr .p{width:34px;text-align:right;font-size:12px}
.nr .l{width:38px;text-align:center;font-size:11px;font-weight:600;border-radius:5px;padding:1px 0}.br{flex:1;height:6px;border-radius:3px;background:var(--b2);overflow:hidden}.br div{height:100%;border-radius:3px}`,
  '<div id=a></div>',
  `var NC=['#038141','#85bb2f','#e3b800','#ee8100','#e63e11'],VC=['#00aa00','#d4a900','#ff6600','#e8000b'],LC={l:'#1f9d3a',m:'#d98200',h:'#e5484d'},LN={l:'Low',m:'Med',h:'High'};
var RI=[['Energy',2000,' kcal'],['Fat',70],['Saturates',20],['Sugars',90],['Salt',6],['Protein',50],['Fibre',30]];
function g(x){return x==null?'—':x<100?Math.round(x*10)/10:Math.round(x)}
var R=go(function(){var d=D,s='abcde'.indexOf(d.ns),v=d.v||[],l=d.l||'',any=0;
var h='<div class="t1 e">'+E(d.n)+'</div><div class="h e">'+E([d.b,d.q].filter(Boolean).join(' · '))+'</div>';
h+='<div class=bd><div><div class=ns>'+'ABCDE'.split('').map(function(c,i){return'<i class="'+(i==s?'on':'')+'" style="background:'+(s<0?'var(--h)':NC[i])+';color:'+(s<0?'var(--h)':NC[i])+'"><span style="color:#fff">'+c+'</span></i>'}).join('')+'</div><div class="cp h">Nutri-Score'+(s<0?' · not rated':' <b style="color:var(--t)">'+'ABCDE'[s]+'</b>')+'</div></div><span class=f></span>';
h+='<div class=r style="gap:8px"><div class=nv style="background:'+(d.nv?VC[d.nv-1]:'var(--h)')+'">'+(d.nv||'?')+'</div><div class=h style="font-size:12px;line-height:1.25"><b style="color:var(--t)">NOVA'+(d.nv?' '+d.nv:'')+'</b><br>'+(d.nv?['Unprocessed','Culinary','Processed','Ultra-processed'][d.nv-1]:'not rated')+'</div></div></div>';
var rows=RI.map(function(r,i){var x=v[i],c=i&&i<5?l[i-1]:'',p=x==null?null:Math.round(x/r[1]*100);if(x!=null)any=1;
return'<div class="nr sg" style="animation-delay:'+i*40+'ms"><span class=k>'+r[0]+'</span><b class="v n">'+g(x)+(x==null?'':r[2]||' g')+'</b>'+(p==null?'<span class=f></span>':'<div class=br><div class=rv style="width:'+Math.min(100,Math.max(p,1))+'%;background:'+(LC[c]||'var(--h)')+';animation-delay:'+(80+i*40)+'ms"></div></div>')+'<span class="p h n">'+(p==null?'':p+'%')+'</span><span class=l style="'+(LC[c]?'color:'+LC[c]+';background:'+LC[c]+'1f':'')+'">'+(LN[c]||'')+'</span></div>'}).join('');
h+='<div class="ln r" style="padding:8px 0 2px"><b class=f>Per 100 '+(d.ml?'ml':'g')+'</b><span class=h style="font-size:12px">'+(any?'% of daily intake':'')+'</span></div>'+(any?rows:'<p class=h style="padding:6px 0">No nutrition facts on Open Food Facts yet.</p>');
if(d.al)h+='<div class="ln" style="margin-top:6px;padding-top:8px;font-size:14px">⚠️ Contains: '+E(d.al)+'</div>';
$('a').innerHTML=h});
boot(R)`,
);
