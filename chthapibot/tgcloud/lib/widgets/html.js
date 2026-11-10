// HTML for the message widgets (Bot API 10.4, sendWidget). Each template is a
// self-contained page drawn by its own inline script from a small JSON payload
// that the bot puts in chat_data (one message) or public_data (a shared widget).
//
// Limits (checked by scripts/check-widgets.js): at most 32 KB raw and 4 KB
// zlib-compressed at the maximum level. Widgets have no network, no external
// scripts, fonts or images, so charts are inline SVG and fonts are generic.
//
// Every payload carries `q`, the query that refreshes it: the widget sends it
// with TelegramWidget.request() and redraws from the bot's answer.
//
// Familiar on purpose: the coin card and lists follow Apple Stocks (segmented
// range control, scrub dot, change pill), the weather follows Apple Weather
// (hourly strip, gradient range bars) and the match card a Live Activity.
// Look: 2px lines over a ~10% wash, 1px hairlines, a sign or ▲/▼ always next to
// the up/down colour. Big numbers: proportional figures and tight tracking;
// numbers in columns: tabular (.n).
// Feel: rows and controls highlight on press-down; scrubbing captures the pointer.
// Motion only on first render (or a new range): charts sweep in from the left,
// rows fade up 40 ms apart. A refresh never moves anything; a changed value
// flashes once. The live dot pulses. Reduced motion keeps the flash only.

const CSS = `:root{--up:#006300;--dn:#d03b3b;--um:#0ca30c;--s:var(--tg-theme-bg-color,#fff);--t:var(--tg-theme-text-color,#111);--b2:var(--tg-theme-secondary-bg-color,#eeeef0);--g:var(--tg-theme-section-separator-color,rgba(127,127,127,.2));--h:var(--tg-theme-hint-color,#8a8a8e);--e:cubic-bezier(.23,1,.32,1)}
@media(prefers-color-scheme:dark){:root{--up:#0ca30c}}
*{box-sizing:border-box;margin:0}body{font:15px/1.3 system-ui,sans-serif;color:var(--t);background:var(--s);padding:10px 12px;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.h{color:var(--h);font-size:12px;letter-spacing:.01em}.up{color:var(--up)}.dn{color:var(--dn)}.lv{color:var(--dn);font-weight:600}
.r{display:flex;align-items:center;gap:8px}.f{flex:1;min-width:0}.e{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}b{font-weight:600}.n{font-variant-numeric:tabular-nums}
.ln{border-top:1px solid var(--g)}svg{display:block;width:100%;overflow:visible}.t1{font-size:17px;font-weight:700;letter-spacing:-.01em}
.big{font-weight:700;letter-spacing:-.02em;line-height:1.05}.cv{color:var(--h);font-size:18px;line-height:1}
.tp{cursor:pointer;border-radius:8px;margin:0 -6px;padding-left:6px;padding-right:6px;transition:background-color .15s}.tp:active{background:var(--g);transition:none}
.pd{display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px;animation:pu 1.6s ease-in-out infinite}
.dt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;box-shadow:0 0 0 2px var(--s)}
.fu,.fd{border-radius:4px;animation:fl 1.4s ease-out}.fu{--fc:rgba(12,163,12,.25)}.fd{--fc:rgba(208,59,59,.25)}
.in .rv{animation:rv .6s var(--e) backwards}.in .sg{animation:fi .24s var(--e) backwards}.in .dt{animation:fo .2s .45s ease-out backwards}
@keyframes rv{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}@keyframes fi{from{opacity:0;transform:translateY(4px)}}@keyframes fo{from{opacity:0}}
@keyframes fl{from{background:var(--fc)}to{background:transparent}}@keyframes pu{50%{opacity:.3}}
@media(prefers-reduced-motion:reduce){.in .rv,.in .sg,.in .dt,.pd{animation:none}}`;

// Helpers: J parse, E escape, N number, P ▲/▼ percent, C up/down class, T hh:mm,
// Y weekday, V unpack a base36 series (0..1), Q polyline points, X flash class for
// a changed value, ask() a query, go() render wrapper, tap() press-to-open rows,
// scrub() drag-to-read on a chart, boot().
const JS = `var W=window.TelegramWidget||{},D=null,O=null,F=1;
function $(i){return document.getElementById(i)}
function J(s){try{return JSON.parse(s)}catch(e){return null}}
function E(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return'&#'+c.charCodeAt(0)+';'})}
function N(n){if(n==null)return'—';var a=Math.abs(n),s=a>=100?a.toFixed(0):a>=1?a.toFixed(2):a.toPrecision(3),p=s.split('.');p[0]=p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');return(n<0?'-':'')+p.join('.')}
function P(n){return n==null?'':(n>=0?'▲ ':'▼ ')+Math.abs(n).toFixed(2)+'%'}
function C(n){return n==null?'h':n>=0?'up':'dn'}
function T(t){var d=new Date(t*1e3);return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function Y(t){var d=new Date(t*1e3),n=new Date();return d.toDateString()==n.toDateString()?'Today':'Sun Mon Tue Wed Thu Fri Sat'.split(' ')[d.getDay()]}
function V(s,k){var o=[],m=Math.pow(36,k)-1;for(var i=0;i<s.length;i+=k)o.push(parseInt(s.substr(i,k),36)/m);return o}
function Q(a,w,h,p){return a.map(function(v,i){return(i*w/(a.length-1||1)).toFixed(1)+','+(p+(h-2*p)*(1-v)).toFixed(1)}).join(' ')}
function X(o,n){return F||o==null||n==null||o==n?'':+n>+o?' fu':' fd'}
function ask(q,f,x){if(!q||!W.request)return x&&x();try{W.request(q).then(function(a){var d=J(a&&a.result);if(d){D=d;f()}else x&&x()},function(){x&&x()})}catch(e){x&&x()}}
function go(f){return function(){if(!D)return;document.body.className=F?'in':'';f();F=0;O=D}}
function tap(sel,q){[].forEach.call(document.querySelectorAll(sel),function(e){e.addEventListener('click',function(){e.style.opacity=.5;ask(q(e.getAttribute('data-i')),function(){e.style.opacity=1},function(){e.style.opacity=1})})})}
function scrub(el,fn){var on=0,m=function(e){if(!on||!el.getBoundingClientRect)return;var b=el.getBoundingClientRect();fn(Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)))},end=function(){if(on){on=0;fn(-1)}};
el.addEventListener('pointerdown',function(e){on=1;try{el.setPointerCapture(e.pointerId)}catch(x){}m(e)});el.addEventListener('pointermove',m);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}
function boot(f,poll,ms){D=J(W.chatData)||J(W.publicData)||D;f();
if(W.onEvent){W.onEvent('chatDataChanged',function(){var d=J(W.chatData);if(d){D=d;f()}});W.onEvent('publicDataChanged',function(){var d=J(W.publicData);if(d){D=d;f()}})}
if(W.watchPublicData&&W.publicData!=null)W.watchPublicData();
if(poll){var g=function(){ask(D&&poll(),f)};g();if(ms)setInterval(g,ms)}}`;

const page = (css, body, script) => `<!doctype html><meta charset=utf-8><style>${CSS}${css}</style>${body}<script>${JS}\n${script}</script>`;

// ⚽️ One match, laid out like a Live Activity: crests either side, the score and
// the clock in the middle. Payload: { q, lg, st: pre|in|post, dt, t, h:[abbr,name,score,bg,fg], a:[…], u }
const GAME = page(
  `.t{display:flex;align-items:center;margin-top:6px}.tm{flex:1;text-align:center;min-width:0}.ab{width:44px;height:44px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font:700 13px system-ui}.mid{min-width:116px;text-align:center}.sc{font-size:38px}.sc span{display:inline-block;padding:0 3px}.in .sc,.pp{animation:pp .32s var(--e) both}@keyframes pp{from{opacity:0;transform:translateY(-30%)}}`,
  '<div id=a></div>',
  `function S(s){return'<div class=tm><div class=ab style="background:#'+s[3]+';color:#'+s[4]+'">'+E(s[0])+'</div><b class=e style="display:block;font-size:14px">'+E(s[1])+'</b></div>'}
function sc(i,v){var o=O&&!F&&O[i][2];return'<span class="'+(o!=null&&o!=v?'pp':'')+'">'+E(v)+'</span>'}
var R=go(function(){var d=D,st=d.st=='in'?'<span class=lv><i class=pd></i>'+E(d.dt)+'</span>':d.st=='post'?'<b class=h>'+E(d.dt||'FT')+'</b>':'<span class=h>'+Y(d.t)+' '+T(d.t)+'</span>';
$('a').innerHTML='<div class="r h"><span class="f e">'+E(d.lg)+'</span>'+(d.st=='in'?'Updated '+T(d.u):'')+'</div><div class=t>'+S(d.h)+'<div class=mid><div class="sc big">'+(d.st=='pre'?'<span class=h style="font-size:20px;font-weight:600">vs</span>':sc('h',d.h[2])+'<span style="color:var(--h);font-weight:400">–</span>'+sc('a',d.a[2]))+'</div>'+st+'</div>'+S(d.a)+'</div>'});
boot(R,function(){return(D.st=='in'||D.st=='pre'&&D.t-Date.now()/1e3<900)&&D.q},45000)`,
);

// 📺 A league scoreboard. Payload: { q, c: league code, lg, g:[[id,home,away,hs,as,st,detail,t]], u }
const BOARD = page(
  `.g{padding:6px 0}.s{width:54px;flex:none;font-size:12px;text-align:center}.w{font-weight:600}.x{text-align:right;min-width:30px;padding:0 3px}`,
  '<div id=a></div>',
  `function sx(g,i){var o=O&&!F&&O.g.filter(function(x){return x[0]==g[0]})[0];return X(o&&o[i],g[i])}
var R=go(function(){var d=D,h='<div class=r style="padding-bottom:6px"><span class="f t1 e">'+E(d.lg)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
d.g.forEach(function(g,i){var s=g[5],a=+g[3],b=+g[4],p=s=='p';
h+='<div class="ln"><div class="g r tp sg" style="animation-delay:'+i*40+'ms" data-i="'+E(g[0])+'"><div class="s '+(s=='i'?'lv':'h')+'">'+(p?(Y(g[7])=='Today'?'':Y(g[7])+'<br>')+T(g[7]):(s=='i'?'<i class=pd></i>':'')+E(g[6]))+'</div><div class=f><div class=r><span class="f e'+(s=='f'&&a>b?' w':'')+'">'+E(g[1])+'</span><b class="x n'+sx(g,3)+'">'+(p?'':E(g[3]))+'</b></div><div class=r><span class="f e'+(s=='f'&&b>a?' w':'')+'">'+E(g[2])+'</span><b class="x n'+sx(g,4)+'">'+(p?'':E(g[4]))+'</b></div></div><span class=cv>›</span></div></div>'});
if(!d.g.length)h+='<p class=h style="padding:12px 0">Nothing on right now.</p>';
$('a').innerHTML=h;tap('.g',function(i){return'o:g:'+D.c+':'+i})});
boot(R,function(){return D.g.some(function(g){return g[5]=='i'})&&D.q},60000)`,
);

// 🪙 One coin, like a Stocks detail view. Payload:
// { q, id, s, n, rk, p, ch:[1h,24h,7d], d: days, dc: change over d, lo, hi, v: base36×2 series, mc, u }
// Drag across the chart to read the price at any point.
const COIN = page(
  `#c{position:relative;height:124px;margin-top:8px;touch-action:none;transition:opacity .2s}#c.ld{opacity:.4}#x{position:absolute;top:0;bottom:0;border-left:1px solid var(--h);display:none}#x .dt{left:0}
.sgm{position:relative;display:flex;background:var(--b2);border-radius:9px;padding:2px;margin-top:10px}.sgm div{flex:1;text-align:center;padding:5px 0;font-size:13px;font-weight:600;position:relative;z-index:1;cursor:pointer}.sgm .th{position:absolute;z-index:0;top:2px;bottom:2px;left:2px;width:calc((100% - 4px)/4);background:var(--s);border-radius:7px;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:transform .3s var(--e);padding:0}
.st{display:flex;margin-top:10px;padding-top:8px}.st>div{flex:1}.st b{display:block;font-size:14px}`,
  '<div id=a></div>',
  `var RG=[[1,'1D'],[7,'1W'],[30,'1M'],[90,'3M']],A=[];
function at(i){var d=D;return{v:d.lo+(d.hi-d.lo)*A[i],t:d.u-d.d*86400*(1-i/(A.length-1))}}
function M(t){var d=new Date(t*1e3);return d.getDate()+' '+'JanFebMarAprMayJunJulAugSepOctNovDec'.substr(d.getMonth()*3,3)}
function head(v,c,lb){var a=v-v/(1+c/100);$('p').innerHTML='$'+N(v);$('k').innerHTML=c==null?'':'<b class='+C(c)+'>'+(c>=0?'+':'−')+'$'+N(Math.abs(a))+' ('+Math.abs(c).toFixed(2)+'%)</b> <span class=h>'+lb+'</span>'}
function sel(i){var t=document.querySelector('.th');if(t)t.style.transform='translateX('+i*100+'%)'}
var R=go(function(){var d=D,col=(d.dc==null?d.ch[1]:d.dc)>=0?'var(--um)':'var(--dn)',ch='',ri=0,lb,y=function(v){return(6+112*(1-v)).toFixed(1)};A=d.v?V(d.v,2):[];
RG.forEach(function(r,i){if(r[0]==d.d)ri=i});lb={1:'Today',7:'Past week',30:'Past month',90:'Past 3 months'}[d.d];
if(A.length>1){var pts=Q(A,300,124,6);
ch='<svg class=rv viewBox="0 0 300 124" preserveAspectRatio=none style="height:124px"><line x1=0 x2=300 y1='+y(A[0])+' y2='+y(A[0])+' stroke="var(--h)" stroke-opacity=".45" stroke-dasharray="2 3" vector-effect=non-scaling-stroke /><polygon points="0,124 '+pts+' 300,124" fill="'+col+'" fill-opacity=".1"/><polyline points="'+pts+'" fill=none stroke="'+col+'" stroke-width=2 vector-effect=non-scaling-stroke stroke-linejoin=round stroke-linecap=round /></svg><div class=dt style="left:100%;top:'+y(A[A.length-1])+'px;background:'+col+'"></div><div id=x><div class=dt style="background:'+col+'"></div></div>'}else ch='<p class=h style="padding-top:52px;text-align:center">Chart unavailable right now</p>';
$('a').innerHTML='<div class=r><span class="t1">'+E(d.s)+'</span><span class="h f e">'+E(d.n)+'</span>'+(d.rk?'<span class=h>#'+d.rk+'</span>':'')+'</div><div id=p class="big'+X(O&&O.p,d.p)+'" style="font-size:32px;margin-top:4px"></div><div id=k style="font-size:14px;margin-top:2px;height:18px"></div><div id=c>'+ch+'</div><div class=sgm><div class=th></div>'+RG.map(function(r){return'<div data-d='+r[0]+'>'+r[1]+'</div>'}).join('')+'</div><div class="st ln">'+[['High','$'+N(d.hi)],['Low','$'+N(d.lo)],['24h','<span class='+C(d.ch[1])+'>'+P(d.ch[1])+'</span>'],['Mkt cap',d.mc?'$'+E(d.mc):'—']].map(function(s){return'<div><span class=h>'+s[0]+'</span><b class=n>'+s[1]+'</b></div>'}).join('')+'</div>';
var tr=document.querySelector('.th');tr.style.transition='none';sel(ri);tr.offsetWidth;tr.style.transition='';
head(d.p,d.dc,lb);
if(A.length>1)scrub($('c'),function(x){var xl=$('x');if(x<0){xl.style.display='none';return head(D.p,D.dc,lb)}var i=Math.round(x*(A.length-1)),q=at(i);xl.style.display='block';xl.style.left=(i*100/(A.length-1))+'%';xl.firstChild.style.top=y(A[i])+'px';head(q.v,(q.v/at(0).v-1)*100,D.d<=7?Y(q.t)+' '+T(q.t):M(q.t))});
[].forEach.call(document.querySelectorAll('.sgm div[data-d]'),function(e,i){e.addEventListener('pointerdown',function(){sel(i)});e.addEventListener('click',function(){var n=+e.getAttribute('data-d');if(n==D.d)return;$('c').className='ld';ask('c:'+D.id+':'+n,function(){F=1;R()},function(){F=1;R()})})})});
boot(R,function(){return'c:'+D.id+':'+D.d},60000)`,
);

// 📊 A watchlist like Stocks: symbol over name, sparkline, price over a change pill.
// Payload: { q, t: title, r:[[id,sym,name,price,ch24,spark base36×1]], more, u }
const LIST = page(
  `.c{padding:4px 0}.y{width:96px;flex:none}.y b{display:block;font-size:16px}.k{width:64px;flex:none;position:relative;height:28px}.k svg{height:28px}.k .dt{width:6px;height:6px;margin:-3px 0 0 -3px}.v{text-align:right;flex:none;min-width:84px}.pl{display:inline-block;margin-top:3px;min-width:70px;padding:2px 6px;border-radius:6px;color:#fff;font-size:13px;font-weight:600;text-align:right}`,
  '<div id=a></div>',
  `function px(c){var o=O&&!F&&O.r.filter(function(x){return x[0]==c[0]})[0];return X(o&&o[3],c[3])}
var R=go(function(){var d=D,h='<div class=r style="padding-bottom:6px"><span class="f t1 e">'+E(d.t)+'</span><span class=h>Updated '+T(d.u)+'</span></div>';
d.r.forEach(function(c,i){var col=c[4]==null?'var(--h)':c[4]>=0?'var(--um)':'var(--dn)',a=c[5]?V(c[5],1):[];
h+='<div class=ln><div class="c r tp sg" style="animation-delay:'+i*40+'ms" data-i="'+E(c[0])+'"><div class="y e"><b class=e>'+E(c[1])+'</b><span class="h e" style="display:block">'+E(c[2])+'</span></div><span class=f></span>'+(a.length>1?'<div class=k><svg class=rv style="animation-delay:'+(i*40+80)+'ms" viewBox="0 0 64 28" preserveAspectRatio=none><polyline points="'+Q(a,64,28,3)+'" fill=none stroke="'+col+'" stroke-width=1.5 vector-effect=non-scaling-stroke stroke-linejoin=round /></svg><div class=dt style="left:100%;top:'+(3+22*(1-a[a.length-1])).toFixed(1)+'px;background:'+col+'"></div></div>':'')+'<span class=f></span><div class="v n"><div class="'+px(c)+'" style="font-weight:600">$'+N(c[3])+'</div><span class=pl style="background:'+col+'">'+(c[4]==null?'—':(c[4]>=0?'+':'−')+Math.abs(c[4]).toFixed(2)+'%')+'</span></div></div></div>'});
if(d.more)h+='<p class=h style="padding-top:6px">+'+d.more+' more</p>';
$('a').innerHTML=h;tap('.c',function(i){return'o:c:'+i})});
boot(R,function(){return D.q},60000)`,
);

// 🌤 Weather like Apple Weather: big temperature, an hourly strip, 5-day range bars.
// Payload: { q, t, c: code, l: label, mx, mn, o: UTC offset (s),
//   hs:[[t,code,temp,rain%,night]] (7 slots, 3 h apart), d:[[day,code,min,max]], u }
const WEATHER = page(
  `.hs{display:flex;padding:8px 0 6px;margin-top:8px}.hs>div{flex:1;text-align:center;font-size:13px}.hs i{display:block;font-style:normal;font-size:20px;line-height:26px}.hs u{display:block;text-decoration:none;font-size:11px;font-weight:600;color:#3d8bfd;height:13px}
.dy{display:flex;align-items:center;gap:8px;height:29px}.dy .w{width:46px}.dy .i{width:26px;text-align:center;font-size:18px}.dy .m{width:30px;text-align:right}.br{flex:1;height:5px;border-radius:3px;background:var(--b2);position:relative}.br div{position:absolute;top:0;bottom:0;border-radius:3px}.br .dt{width:7px;height:7px;margin:-1px 0 0 -3.5px;background:var(--t);top:0;bottom:auto}`,
  '<div id=a></div>',
  `function I(c,nt){return c<1?(nt?'🌙':'☀️'):c<2?(nt?'🌙':'🌤'):c<3?(nt?'☁️':'⛅'):c<4?'☁️':c<50?'🌫':c<60?(nt?'🌧':'🌦'):c<70?'🌧':c<80?'🌨':c<83?(nt?'🌧':'🌦'):c<90?'🌨':'⛈'}
function H(t){return('0'+new Date(t*1e3).getUTCHours()).slice(-2)}
function TC(t){return'hsl('+(200-(Math.max(-5,Math.min(35,t))+5)*4.25).toFixed(0)+',85%,55%)'}
var R=go(function(){var d=D,lo=Math.min.apply(0,d.d.map(function(x){return x[2]})),hi=Math.max.apply(0,d.d.map(function(x){return x[3]})),sp=hi-lo||1,ps=function(v){return(v-lo)/sp*100};
$('a').innerHTML='<div class=r><span class=big style="font-size:46px;font-weight:300">'+Math.round(d.t)+'°</span><div class=f><b>'+E(d.l)+'</b><div class=h>H:'+Math.round(d.mx)+'°  L:'+Math.round(d.mn)+'°</div></div><span style="font-size:40px;line-height:1">'+I(d.c,d.hs[0]&&d.hs[0][4])+'</span></div><div class="hs ln">'+d.hs.map(function(x,i){return'<div class=sg style="animation-delay:'+i*40+'ms"><span class=h>'+(i?H(x[0]+(d.o||0)):'Now')+'</span><i>'+I(x[1],x[4])+'</i><u>'+(x[3]>=20?x[3]+'%':'')+'</u><b>'+Math.round(x[2])+'°</b></div>'}).join('')+'</div><div class=ln style="padding-top:4px">'+d.d.map(function(x,i){return'<div class="dy sg" style="animation-delay:'+(200+i*40)+'ms"><b class=w>'+E(x[0])+'</b><span class=i>'+I(x[1])+'</span><span class="m h n">'+Math.round(x[2])+'°</span><div class=br><div class=rv style="left:'+ps(x[2]).toFixed(1)+'%;right:'+(100-ps(x[3])).toFixed(1)+'%;background:linear-gradient(90deg,'+TC(x[2])+','+TC(x[3])+');animation-delay:'+(240+i*40)+'ms"></div>'+(i?'':'<div class=dt style="left:'+ps(Math.max(x[2],Math.min(x[3],d.t))).toFixed(1)+'%"></div>')+'</div><b class="m n">'+Math.round(x[3])+'°</b></div>'}).join('')+'</div>'});
boot(R,function(){return Date.now()/1e3-D.u>900&&D.q},0)`,
);

export const TEMPLATES = { game: GAME, board: BOARD, coin: COIN, list: LIST, weather: WEATHER };

// Small stable hash of a template: a changed template gets new shared widgets,
// since a shared widget's HTML is fixed when it is created.
export function templateVersion(kind) {
  const s = TEMPLATES[kind];
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
