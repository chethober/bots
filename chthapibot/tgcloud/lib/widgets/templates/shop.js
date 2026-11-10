import { page } from '../base.js';

// 🛒 Shopping list like Reminders: tap a row to tick it off. Ticks live in this
// viewer's localStorage, keyed by item, so they stay when the bot edits the list;
// an item ticked in the bot (✅ in a group's text card) starts ticked.
// Payload: { g:[recipe names], i:[[item, group index or -1, ticked in the bot 0|1]], more, u }
export default page(
  `:root{--a:var(--tg-theme-button-color,#007aff)}.hd{display:flex;align-items:baseline;gap:8px;padding-bottom:4px}.hd .t1{font-size:24px;color:var(--a)}
.gh{font-size:13px;font-weight:600;padding:10px 0 2px}.it{display:flex;align-items:center;gap:10px;min-height:38px;cursor:pointer}
.ck{width:22px;height:22px;flex:none;border-radius:50%;border:1.5px solid var(--h);display:flex;align-items:center;justify-content:center}
.ck svg{width:12px;height:12px;opacity:0}.tx{flex:1;min-width:0;align-self:stretch;display:flex;align-items:center;border-bottom:1px solid var(--g);padding:8px 0}
.it:last-child .tx{border-bottom:0}.ok .ck{background:var(--a);border-color:var(--a)}.ok .ck svg{opacity:1}.ok .tx{color:var(--h)}
.ck,.ck svg{transition:background .2s,border-color .2s,opacity .2s}@media(prefers-reduced-motion:reduce){.ck,.ck svg{transition:none}}`,
  '<div id=a></div>',
  `var M={};
function key(s){return String(s).toLowerCase().replace(/\\s+/g,' ').trim()}
function ld(){try{M=J(localStorage.getItem('shop'))||{}}catch(e){M={}}}
function sv(){try{localStorage.setItem('shop',JSON.stringify(M))}catch(e){}}
function on(x){var k=key(x[0]);return k in M?M[k]:x[2]}
function cnt(){var d=D,n=d.i.filter(function(x){return!on(x)}).length+(d.more||0);$('n').innerHTML=d.i.length?n?n+' left':'All done ✓':''}
var R=go(function(){var d=D,h='',gs=[],ks={};ld();
d.i.forEach(function(x){ks[key(x[0])]=1;if(gs.indexOf(x[1])<0)gs.push(x[1])});
if(!d.more)for(var k in M)if(!ks[k])delete M[k];sv();
gs.sort(function(a,b){return(a<0)-(b<0)});
gs.forEach(function(g){if(d.g.length)h+='<div class="gh e">'+(g<0?'Other':E(d.g[g]))+'</div>';
h+='<div>'+d.i.map(function(x,j){return x[1]!=g?'':'<div class="it sg'+(on(x)?' ok':'')+'" data-j='+j+' style="animation-delay:'+j*30+'ms"><span class=ck><svg viewBox="0 0 12 12"><path d="M2.5 6.3l2.4 2.4 4.6-5" fill=none stroke="#fff" stroke-width=2 stroke-linecap=round stroke-linejoin=round /></svg></span><span class=tx><span class=e>'+E(x[0])+'</span></span></div>'}).join('')+'</div>'});
if(!d.i.length)h='<p class=h style="padding:10px 0">Empty. Add items, or tap 🛒 on a recipe.</p>';
if(d.more)h+='<p class=h style="padding-top:6px">+'+d.more+' more in the list</p>';
$('a').innerHTML='<div class=hd><span class="t1 f">Shopping list</span><span id=n class="h n" style="font-size:15px"></span></div>'+h;cnt();
});
$('a').addEventListener('click',function(e){var el=e.target;while(el&&!(el.getAttribute&&el.getAttribute('data-j')))el=el.parentNode;if(!el)return;
var x=D.i[+el.getAttribute('data-j')],v=on(x)?0:1,k=key(x[0]);if(v==x[2])delete M[k];else M[k]=v;sv();el.className='it'+(v?' ok':'');cnt()});
boot(R)`,
);
