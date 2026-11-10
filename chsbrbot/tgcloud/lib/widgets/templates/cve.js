import { page } from '../base.js';

// 🛡 One CVE, like a Fitness ring over a spec sheet: the CVSS score in a ring coloured
// by NVD's band (with its label), the eight CVSS metrics as segmented bars (worse
// values fill more, in red), EPSS as a bar, the KEV due date counting down, a
// timeline and the affected products. Every row has a fixed height:
// lib/cvewidget.js computes the widget's height from the same numbers.
// Payload: see lib/cvewidget.js (cveWidget).
export default page(
  `[dir=rtl] *{letter-spacing:0!important}
.tg{height:18px;line-height:18px;margin-bottom:6px;font-size:12px;font-weight:600;color:var(--h)}
.hd{display:flex;gap:12px;height:64px;align-items:center}.hd .t1{line-height:22px}.hd .f>div{line-height:18px}
.rg{position:relative;width:64px;height:64px;flex:none}.rg svg{width:64px;height:64px;transform:rotate(-90deg)}.rg circle{fill:none;stroke-width:6}.rg b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:21px}
.w{position:relative;border-radius:6px;padding:0 7px;font-size:12px;font-weight:600;line-height:18px}.w:before{content:'';position:absolute;inset:0;border-radius:inherit;background:currentColor;opacity:.13}
.ds{font-size:13px;line-height:18px;margin-top:6px}.sc{margin-top:8px;padding-top:8px}
.mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}.mg>div{height:28px;font-size:12px;line-height:16px;min-width:0}
.sb{display:flex;gap:2px;margin-top:5px;height:5px}.sb i{flex:1;border-radius:2px;background:var(--b2)}
.eb{height:6px;border-radius:3px;background:var(--b2);margin:4px 0 3px;overflow:hidden}.eb div{height:100%;border-radius:3px}
.kb{background:var(--dn);color:#fff;border-radius:5px;padding:0 6px;font-size:12px;font-weight:700;line-height:20px;flex:none}
.tl{position:relative;display:flex;justify-content:space-between;gap:8px;height:44px;font-size:12px;line-height:15px}.tl>.sg{display:flex;flex-direction:column;min-width:0;max-width:34%}.tl i{width:10px;height:10px;border-radius:50%;margin-bottom:4px;box-shadow:0 0 0 2px var(--s);position:relative}.tx{position:absolute;top:4px;left:5px;right:5px;height:2px;background:var(--g)}
.pc{display:flex;gap:4px;overflow:hidden}.pc span{background:var(--b2);border-radius:6px;padding:0 6px;font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:24px;flex:0 1 auto}
.rg .a{transition:none}.in .rg .a{animation:ar .6s var(--e) backwards}@keyframes ar{from{stroke-dasharray:0 176}}.in .eb div{animation:gr .6s var(--e) backwards}@keyframes gr{from{width:0}}
@media(prefers-reduced-motion:reduce){.in .rg .a,.in .eb div{animation:none}}`,
  '<div id=a></div>',
  `var K=['#8a8a8e','#2e9d4f','#c28c00','#ec6a12','#d03b3b'],Z;
function S(n){return(n<10?'0':'')+n}
function cd(){var e=$('cd'),d=D;if(!e)return;var s=d.k[0]-Date.now()/1e3|0;if(s<=0){e.className='h';e.textContent=d.kl[3];return}var n=s/86400|0;s%=86400;e.textContent=d.kl[2].replace('{t}',(n?n+d.kl[4]+' ':'')+S(s/3600|0)+':'+S(s/60%60|0)+':'+S(s%60))}
var R=go(function(){var d=D,c=d.b<0?'var(--h)':K[d.b],h='',n=d.tl?d.tl.length:0;document.documentElement.dir=d.r?'rtl':'ltr';
if(d.g)h+='<div class="tg e">'+E(d.g)+'</div>';
h+='<div class=hd><div class=rg><svg viewBox="0 0 64 64"><circle cx=32 cy=32 r=28 stroke="var(--b2)"/>'+(d.s?'<circle class=a cx=32 cy=32 r=28 stroke="'+c+'" stroke-linecap=round stroke-dasharray="'+(175.9*d.s/10).toFixed(1)+' 176"/>':'')+'</svg><b class="big n">'+(d.s==null?'—':d.s.toFixed(1))+'</b></div><div class=f><div class="t1 e"><bdi>'+E(d.i)+'</bdi></div><div class=e>'+E(d.t)+'</div><div class=r style="margin-top:3px"><span class=w style="color:'+c+'">'+E(d.bl)+'</span><span class=h>'+E(d.v)+'</span></div></div></div>';
if(d.d)h+='<div class="ds h e" dir=auto>'+E(d.d)+'</div>';
if(d.m)h+='<div class="sc ln mg">'+d.m.map(function(x,i){var w=x[2]==x[3]&&x[2]>0,col=w?'var(--dn)':x[2]*2>=x[3]?'#ec6a12':'var(--h)',s='';for(var j=0;j<x[3];j++)s+='<i'+(j<x[2]?' style="background:'+col+'"':'')+'></i>';return'<div class=sg style="animation-delay:'+i*30+'ms"><div class=e><span class=h>'+E(x[0])+':</span> <b'+(w?' class=dn':'')+'>'+E(x[1])+'</b></div><div class=sb>'+(x[3]?s:'<i></i>')+'</div></div>'}).join('')+'</div>';
if(d.e){var p=d.e[0],ec=p>=.5?'var(--dn)':p>=.1?'#ec6a12':'var(--tg-theme-button-color,#2481cc)';h+='<div class="sc ln"><div class=r style="line-height:18px"><b>EPSS</b><span class="h f e">'+E(d.el[0])+'</span><b class=n>'+(p*100).toFixed(p<.01?2:1)+'%</b></div><div class=eb><div style="width:'+Math.max(2,p*100).toFixed(1)+'%;background:'+ec+'"></div></div><div class="h e" style="font-size:12px;line-height:16px">'+E(d.el[1])+'</div></div>'}
if(d.k)h+='<div class="sc ln r" style="height:33px"><span class=kb>KEV</span><span class="f e">'+(d.kl[1]?'<b>'+E(d.kl[1])+'</b> <span class=h>· '+E(d.kl[0])+'</span>':E(d.kl[0]))+'</span>'+(d.k[0]?'<b id=cd class="n dn"></b>':'')+'</div>';
if(n)h+='<div class="sc ln"><div class=tl>'+(n>1?'<div class=tx></div>':'')+d.tl.map(function(x,i){var a=i==0?'start':i==n-1?'end':'center';return'<div class=sg style="align-items:'+(i==0?'flex-start':i==n-1?'flex-end':'center')+';text-align:'+a+';animation-delay:'+(120+i*60)+'ms"><i style="background:'+[c,'var(--dn)','#ec6a12'][x[0]]+'"></i><span class=e>'+E(x[1])+'</span><span class="h n">'+E(x[2])+'</span></div>'}).join('')+'</div></div>';
if(d.p)h+='<div class="sc ln r" style="height:31px"><span class=h style="flex:none">'+E(d.pl)+'</span><div class="f pc">'+d.p.map(function(x){return'<span dir=ltr>'+E(x)+'</span>'}).join('')+'</div>'+(d.pn?'<span class="h n" style="flex:none">+'+d.pn+'</span>':'')+'</div>';
$('a').innerHTML=h;clearInterval(Z);if(d.k&&d.k[0]){cd();Z=setInterval(cd,1e3)}});
boot(R)`,
);
