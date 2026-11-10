import { page } from '../base.js';

// ☕️ Brew timer, like the Clock timer: the recipe up top, a ring you tap to start or
// pause, the step to do now with a countdown to the next, and the step list. It runs
// in the widget alone; its state is kept in localStorage, so it survives scrolling away.
// Cold brew steeps for hours: the ring shows the steep window and when it's ready.
// Payload: { m: method, k, c: dose g, w: water g, r: ratio, tp: temp, g: grind,
//   s:[[start s|null, label, pour to g|null]], e: total s | h:[min h, max h] }
export default page(
  `:root{--o:#c25e00;--or:#ff9500}@media(prefers-color-scheme:dark){:root{--o:#ff9f0a;--or:#ff9f0a}}
.st{display:flex;margin-top:8px}.st>div{flex:1}.st b{display:block;font-size:20px}
.tm{gap:14px;padding:10px 0;margin-top:8px}
#rg,#rg svg{position:relative;width:124px;height:124px;flex:none;cursor:pointer}#rg svg{transform:rotate(-90deg)}
#rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
#t{font-size:30px}.c #t{font-size:25px}#u{font-size:12px;font-weight:600;color:var(--o);margin-top:2px}#p{font-size:21px}#q{margin-top:2px}#x{margin-top:6px;font-size:14px}
.rs{display:none;margin-top:8px;padding:4px 12px;border-radius:14px;background:var(--b2);font-size:13px;font-weight:600;cursor:pointer}
.sp{gap:10px;height:32px;padding:0 8px;margin:0 -8px;border-radius:8px}.sp .tt{width:34px;flex:none}
.sp.on{background:rgba(255,149,0,.13)}.sp.on span{font-weight:600}.sp.on .tt{color:var(--o)}.sp.dn{color:var(--h)}.sp.dn b:after{content:' ✓'}`,
  '<div id=a></div>',
  `var K,S={},I=0,L=351.86;
function ld(){try{return J(localStorage.getItem(K))||{}}catch(e){return{}}}
function sv(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
function el(){return((S.e||0)+(S.s?Date.now()-S.s:0))/1e3}
function ms(x){x=Math.max(0,Math.ceil(x-.001));return Math.floor(x/60)+':'+('0'+x%60).slice(-2)}
function A(i,v){$(i).innerHTML=v}
function lc(s){return E(s.charAt(0).toLowerCase()+s.slice(1))}
function du(h){var m=Math.max(0,Math.round(h*60));return(m>=60?Math.floor(m/60)+' h ':'')+(m%60?m%60+' m':'')}
function pt(f,r){var a=2*Math.PI*f;return'<circle cx="'+(62+56*Math.cos(a)).toFixed(1)+'" cy="'+(62+56*Math.sin(a)).toFixed(1)+'" r='+r+' fill="var(--s)"/>'}
function rs(v){$('r').style.display=v?'inline-block':'none'}
function run(on){clearInterval(I);I=on?setInterval(tick,D.h?3e4:250):0}
function st(i,all){for(var j=0;j<D.s.length;j++)$('s'+j).className='r sp'+(all||j<i?' dn':j==i?' on':'')}
function tick(){var d=D,x=el(),f,i=0,h='',p,q='',u;
if(d.h){var H=x/3600,on=S.s>0,b=on?S.s:Date.now();f=Math.min(1,H/d.h[1]);i=!on?0:H<d.h[0]?1:2;
A('t',on?(H>=1?Math.floor(H)+'h ':'')+Math.floor(H*60%60)+'m':d.h[0]+'–'+d.h[1]+' h');u=on?(H<d.h[0]?'steeping':'ready'):'▶︎ Start steep';
p='Ready '+T(b/1e3+d.h[0]*3600)+'–'+T(b/1e3+d.h[1]*3600);q=on?'Started '+T(S.s/1e3):'If you start now';
if(on)h=H<d.h[0]?'Filter in <b>'+du(d.h[0]-H)+'</b>':H<d.h[1]?'Filter within <b>'+du(d.h[1]-H)+'</b>':'Filter now';
rs(on);st(i)}
else{var e=d.e,dn=x>=e;if(dn&&S.s){S={e:e*1e3};sv();run(0)}x=Math.min(x,e);f=x/e;
for(var j=0;j<d.s.length;j++)if(d.s[j][0]<=x)i=j;var c=d.s[i],n=d.s[i+1];
A('t',ms(Math.floor(x)));u=dn?'✓ Done':S.s?'of '+ms(e):x>0?'▶︎ Resume':'▶︎ Start';
p=dn?'Enjoy ☕️':c[2]!=null?'Pour to '+c[2]+' g':E(c[1]);if(!dn&&c[2]!=null&&c[1]!='Pour')q=E(c[1]);
if(!dn)h=n?'Next in <b class=n>'+ms(n[0]-x)+'</b> · '+(n[2]!=null?'pour to '+n[2]+' g':lc(n[1])):'Done in <b class=n>'+ms(e-x)+'</b>';
rs(!S.s&&x>0);st(i,dn)}
A('u',u);A('p',p);A('q',q);A('x',h);$('f').setAttribute('stroke-dashoffset',(L*(1-f)).toFixed(1))}
var R=go(function(){var d=D,tk='';document.body.className+=d.h?' c':'';K='brew:'+d.k+':'+d.c+':'+d.w;S=ld();
if(d.h)tk=pt(d.h[0]/d.h[1],3);else d.s.forEach(function(s){if(s[0])tk+=pt(s[0]/d.e,2.5)});
$('a').innerHTML='<div class="t1 e">☕️ '+E(d.m)+'</div><div class=st>'+[['Dose',d.c+' g'],['Water',d.w+' g'],['Ratio','1:'+d.r]].map(function(s){return'<div><span class=h>'+s[0]+'</span><b class="big n">'+s[1]+'</b></div>'}).join('')+'</div><div class="h e" style="margin-top:4px">Grind: '+E(d.g)+' · '+E(d.tp)+'</div>'
+'<div class="r tm ln"><div id=rg><svg viewBox="0 0 124 124"><circle cx=62 cy=62 r=56 fill=none stroke="var(--b2)" stroke-width=8 /><circle id=f cx=62 cy=62 r=56 fill=none stroke="var(--or)" stroke-width=8 stroke-linecap=round stroke-dasharray="'+L+'" stroke-dashoffset="'+L+'"/>'+tk+'</svg><div id=rc><b id=t class="big n"></b><span id=u></span></div></div><div class=f><b id=p class=big></b><div id=q class=h></div><div id=x></div><span id=r class=rs>↺ Reset</span></div></div>'
+'<div class=ln style="padding-top:4px">'+d.s.map(function(s,j){return'<div id=s'+j+' class="r sp sg" style="animation-delay:'+j*40+'ms"><span class="tt h n">'+(s[0]==null?j+1+'.':ms(s[0]))+'</span><span class="f e">'+E(s[1])+'</span><b class=n>'+(s[2]!=null?s[2]+' g':'')+'</b></div>'}).join('')+'</div>';
$('rg').addEventListener('click',function(){if(D.h){if(!S.s){S={s:Date.now()};sv();run(1)}}else{var x=el();if(x>=D.e)return;S=S.s?{e:x*1e3}:{s:Date.now(),e:S.e||0};sv();run(S.s)}tick()});
$('r').addEventListener('click',function(){S={};sv();run(0);tick()});
run(S.s>0);tick()});
boot(R)`,
);
