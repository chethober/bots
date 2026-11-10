import { page } from '../base.js';

// 📊 Status, like a Live Activity: the on/off pill, the AI model, three counters
// (Fitness summary) and a Clock-style timer ring draining to the 00:00 UTC reset
// of Cloudflare's free daily quota, ticking every second inside the widget.
// Payload: { r: rtl?, on, m: model, w: warning, s: schedule note, rt: replies
//   today, rw: last 7 days, lr: last reply (unix s, 0 = none),
//   L: [title, pill, today, 7 days, last reply, resets in], dw: weekdays (Sun first, space-separated), u }
export default page(
  `.pl{font-size:13px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap}.pl.up{background:rgba(12,163,12,.12)}.pl.h{background:var(--b2)}
.wn{color:var(--dn);font-size:13px;margin-top:3px}.st{display:flex;margin:9px 0 8px;padding-top:9px}.st>div{flex:1;min-width:0}.st>div:last-child{flex:1.4}.st .big{font-size:26px;margin-top:2px}
.rs{padding-top:8px;gap:10px}.rg{width:26px;height:26px;flex:none}.ct{font-size:17px;font-weight:600}bdi{unicode-bidi:isolate;direction:ltr}[dir=rtl] *{letter-spacing:0!important}.wd{font-size:13px;font-weight:400;letter-spacing:0;color:var(--h)}`,
  '<div id=a></div>',
  `function Z(n){return('0'+n).slice(-2)}
function K(){var n=Date.now(),l=864e5-n%864e5,s=Math.floor(l/1e3),c=$('c'),g=$('g');if(!c)return;c.textContent=Math.floor(s/3600)+':'+Z(Math.floor(s%3600/60))+':'+Z(s%60);g.setAttribute('stroke-dashoffset',(62.83*(1-l/864e5)).toFixed(2))}
function LR(t){if(!t)return'—';var d=new Date(t*1e3);return(d.toDateString()==new Date().toDateString()?'':'<span class=wd>'+E((D.dw||'').split(' ')[d.getDay()]||'')+'</span> ')+'<bdi>'+T(t)+'</bdi>'}
function S(l,v,i){return'<div class=sg style="animation-delay:'+i*40+'ms"><div class="h e">'+E(l)+'</div><div class="big n e">'+v+'</div></div>'}
var R=go(function(){var d=D,L=d.L||[];document.documentElement.dir=d.r?'rtl':'ltr';
$('a').innerHTML='<div class=r><span class="t1 f e">'+E(L[0])+'</span><span class="pl '+(d.on?'up':'h')+'">'+(d.on?'● ':'❚❚ ')+E(L[1])+'</span></div>'
+'<div class="h e" style="margin-top:2px">'+E(d.m||'—')+(d.s?' · '+E(d.s):'')+'</div>'+(d.w?'<div class="wn e">⚠ '+E(d.w)+'</div>':'')
+'<div class="st ln">'+S(L[2],'<bdi>'+d.rt+'</bdi>',0)+S(L[3],'<bdi>'+d.rw+'</bdi>',1)+S(L[4],LR(d.lr),2)+'</div>'
+'<div class="r rs ln sg" style="animation-delay:120ms"><svg class=rg viewBox="0 0 26 26"><circle cx=13 cy=13 r=10 fill=none stroke="var(--b2)" stroke-width=3 /><circle id=g cx=13 cy=13 r=10 fill=none stroke="'+(d.on?'var(--tg-theme-button-color,#2481cc)':'var(--h)')+'" stroke-width=3 stroke-linecap=round stroke-dasharray=62.83 transform="rotate(-90 13 13)"/></svg><span class="f e h" style="font-size:14px">'+E(L[5])+'</span><bdi id=c class="ct n"></bdi></div>';K()});
boot(R);setInterval(K,1e3)`,
);
