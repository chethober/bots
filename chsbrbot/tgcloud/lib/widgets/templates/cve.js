// 🛡 One CVE, like a Fitness ring over a spec sheet: the CVSS score in a ring coloured
// by NVD's band (with its label), the whole description, the eight CVSS metrics as
// segmented bars (worse values fill more, in red), EPSS as a bar, the KEV due date
// counting down, a timeline and the affected products.
// Payload: see lib/cvewidget.js (cveWidget).
//
// The description doesn't fit the 1 KB payload, so lib/cvewidget.js (cveHtml) writes
// it into this page for each message: `var DS=0` becomes `var DS=[id, text]`. It is
// shown when its id is the payload's, else the payload's one-line `d`. It takes the
// room the widget's height leaves; when that isn't enough (a very long text, a narrow
// screen) it is cut at a whole line and a "Show more" row opens it over the card,
// scrolling if it has to.
//
// This page doesn't use page() from ../base.js: it keeps only the styles and helpers
// it needs, which leaves more of the 4 KB (compressed) limit to the description.
const CSS = `:root{--dn:#d03b3b;--s:var(--tg-theme-bg-color,#fff);--t:var(--tg-theme-text-color,#111);--b2:var(--tg-theme-secondary-bg-color,#eeeef0);--g:var(--tg-theme-section-separator-color,rgba(127,127,127,.2));--h:var(--tg-theme-hint-color,#8a8a8e);--e:cubic-bezier(.23,1,.32,1)}
*{box-sizing:border-box;margin:0}body{font:15px/1.3 system-ui,sans-serif;color:var(--t);background:var(--s);padding:10px 12px;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#a{display:flex;flex-direction:column;height:calc(100vh - 20px)}#a>*{flex:none}
.h{color:var(--h);font-size:12px}.dn{color:var(--dn)}.r{display:flex;align-items:center;gap:8px}.f{flex:1;min-width:0}.e{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}b{font-weight:600}.n{font-variant-numeric:tabular-nums}
.ln{border-top:1px solid var(--g)}svg{display:block}.t1{font-size:17px;font-weight:700;line-height:22px}
[dir=rtl] *{letter-spacing:0!important}
.tg{height:18px;line-height:18px;margin-bottom:6px;font-size:12px;font-weight:600;color:var(--h)}
.hd{display:flex;gap:12px;height:64px;align-items:center}.hd .f>div{line-height:18px}
.rg{position:relative;width:64px;height:64px;flex:none}.rg svg{width:64px;height:64px;transform:rotate(-90deg)}.rg circle{fill:none;stroke-width:6}.rg b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700}
.w{position:relative;border-radius:6px;padding:0 7px;font-size:12px;font-weight:600;line-height:18px}.w:before{content:'';position:absolute;inset:0;border-radius:inherit;background:currentColor;opacity:.13}
#a>.ds{flex:0 1 auto;min-height:18px;font-size:13px;line-height:18px;margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.mr{height:24px;line-height:24px;font-size:12px;font-weight:600;color:var(--tg-theme-link-color,#2481cc)}
.x>.hx{display:none}#a.x>.ds{display:block;overflow-y:auto;height:auto!important}
.sc{margin-top:8px;padding-top:8px}
.mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}.mg>div{height:28px;font-size:12px;line-height:16px;min-width:0}
.sb{display:flex;gap:2px;margin-top:5px;height:5px}.sb i{flex:1;border-radius:2px;background:var(--b2)}
.eb{height:6px;border-radius:3px;background:var(--b2);margin:4px 0 3px;overflow:hidden}.eb div{height:100%;border-radius:3px}
.kb{background:var(--dn);color:#fff;border-radius:5px;padding:0 6px;font-size:12px;font-weight:700;line-height:20px;flex:none}
.tl{position:relative;display:flex;justify-content:space-between;gap:8px;height:44px;font-size:12px;line-height:15px}.tl>.sg{display:flex;flex-direction:column;min-width:0;max-width:34%}.tl i{width:10px;height:10px;border-radius:50%;margin-bottom:4px;box-shadow:0 0 0 2px var(--s);position:relative}.tx{position:absolute;top:4px;left:5px;right:5px;height:2px;background:var(--g)}
.pc{display:flex;gap:4px;overflow:hidden}.pc span{background:var(--b2);border-radius:6px;padding:0 6px;font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:24px;flex:0 1 auto}
.in .sg{animation:fi .24s var(--e) backwards}@keyframes fi{from{opacity:0;transform:translateY(4px)}}
.in .rg .a{animation:ar .6s var(--e) backwards}@keyframes ar{from{stroke-dasharray:0 176}}.in .eb div{animation:gr .6s var(--e) backwards}@keyframes gr{from{width:0}}
@media(prefers-reduced-motion:reduce){.in *{animation:none!important}}`;

// $ by id, J parse, E escape, S two digits; cd() ticks the KEV countdown; fd() fits
// the description to its room; tg() opens and closes it; R renders; then boot.
const JS = `var DS=0;
var W=window.TelegramWidget||{},D,F=1,XP=0,Z,K=['#8a8a8e','#2e9d4f','#c28c00','#ec6a12','#d03b3b'];
function $(i){return document.getElementById(i)}
function J(s){try{return JSON.parse(s)}catch(e){return null}}
function E(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return'&#'+c.charCodeAt(0)+';'})}
function S(n){return(n<10?'0':'')+n}
function cd(){var e=$('cd'),d=D;if(!e)return;var s=d.k[0]-Date.now()/1e3|0;if(s<=0){e.className='h';e.textContent=d.kl[3];return}var n=s/86400|0;s%=86400;e.textContent=d.kl[2].replace('{t}',(n?n+d.kl[4]+' ':'')+S(s/3600|0)+':'+S(s/60%60|0)+':'+S(s%60))}
function fd(){var e=$('ds'),m=$('mr'),l=D.ml||['',''];if(!e)return;$('a').className=XP?'x':'';e.style.height=e.style.webkitLineClamp='';m.textContent=l[XP];m.hidden=!XP;if(XP)return;
if(e.scrollHeight>e.clientHeight+1){m.hidden=0;var n=Math.max(1,e.clientHeight/18|0);e.style.height=n*18+'px';e.style.webkitLineClamp=n}}
function tg(){if(XP||!$('mr').hidden){XP=XP?0:1;$('ds').scrollTop=0;fd()}}
function R(){var d=D;if(!d)return;var c=d.b<0?'var(--h)':K[d.b],h='',n=d.tl?d.tl.length:0,t=DS&&DS[0]==d.i?DS[1]:d.d;document.documentElement.dir=d.r?'rtl':'ltr';document.body.className=F?'in':'';F=0;
if(d.g)h+='<div class="tg e hx">'+E(d.g)+'</div>';
h+='<div class=hd><div class=rg><svg viewBox="0 0 64 64"><circle cx=32 cy=32 r=28 stroke="var(--b2)"/>'+(d.s?'<circle class=a cx=32 cy=32 r=28 stroke="'+c+'" stroke-linecap=round stroke-dasharray="'+(175.9*d.s/10).toFixed(1)+' 176"/>':'')+'</svg><b class=n>'+(d.s==null?'—':d.s.toFixed(1))+'</b></div><div class=f><div class="t1 e"><bdi>'+E(d.i)+'</bdi></div><div class=e>'+E(d.t)+'</div><div class=r style="margin-top:3px"><span class=w style="color:'+c+'">'+E(d.bl)+'</span><span class=h>'+E(d.v)+'</span></div></div></div>';
if(t)h+='<div id=ds class=ds dir=auto onclick="tg()">'+E(t)+'</div><div id=mr class=mr hidden onclick="tg()"></div>';
if(d.m)h+='<div class="sc ln mg hx">'+d.m.map(function(x,i){var w=x[2]==x[3]&&x[2]>0,col=w?'var(--dn)':x[2]*2>=x[3]?'#ec6a12':'var(--h)',s='';for(var j=0;j<x[3];j++)s+='<i'+(j<x[2]?' style="background:'+col+'"':'')+'></i>';return'<div class=sg style="animation-delay:'+i*30+'ms"><div class=e><span class=h>'+E(x[0])+':</span> <b'+(w?' class=dn':'')+'>'+E(x[1])+'</b></div><div class=sb>'+(x[3]?s:'<i></i>')+'</div></div>'}).join('')+'</div>';
if(d.e){var p=d.e[0],ec=p>=.5?'var(--dn)':p>=.1?'#ec6a12':'var(--tg-theme-button-color,#2481cc)';h+='<div class="sc ln hx"><div class=r style="line-height:18px"><b>EPSS</b><span class="h f e">'+E(d.el[0])+'</span><b class=n>'+(p*100).toFixed(p<.01?2:1)+'%</b></div><div class=eb><div style="width:'+Math.max(2,p*100).toFixed(1)+'%;background:'+ec+'"></div></div><div class="h e" style="line-height:16px">'+E(d.el[1])+'</div></div>'}
if(d.k)h+='<div class="sc ln r hx" style="height:33px"><span class=kb>KEV</span><span class="f e">'+(d.kl[1]?'<b>'+E(d.kl[1])+'</b> <span class=h>· '+E(d.kl[0])+'</span>':E(d.kl[0]))+'</span>'+(d.k[0]?'<b id=cd class="n dn"></b>':'')+'</div>';
if(n)h+='<div class="sc ln hx"><div class=tl>'+(n>1?'<div class=tx></div>':'')+d.tl.map(function(x,i){var a=i==0?'start':i==n-1?'end':'center';return'<div class=sg style="align-items:'+(i==0?'flex-start':i==n-1?'flex-end':'center')+';text-align:'+a+';animation-delay:'+(120+i*60)+'ms"><i style="background:'+[c,'var(--dn)','#ec6a12'][x[0]]+'"></i><span class=e>'+E(x[1])+'</span><span class="h n">'+E(x[2])+'</span></div>'}).join('')+'</div></div>';
if(d.p)h+='<div class="sc ln r hx" style="height:31px"><span class=h style="flex:none">'+E(d.pl)+'</span><div class="f pc">'+d.p.map(function(x){return'<span dir=ltr>'+E(x)+'</span>'}).join('')+'</div>'+(d.pn?'<span class="h n" style="flex:none">+'+d.pn+'</span>':'')+'</div>';
$('a').innerHTML=h;fd();clearInterval(Z);if(d.k&&d.k[0]){cd();Z=setInterval(cd,1e3)}}
D=J(W.chatData);R();onresize=fd;
if(W.onEvent)W.onEvent('chatDataChanged',function(){var d=J(W.chatData);if(d){D=d;R()}})`;

export default `<!doctype html><meta charset=utf-8><style>${CSS}</style><div id=a></div><script>${JS}</script>`;
