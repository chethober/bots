import { page } from '../base.js';

// 📂 A member's VPN like Screen Time / Fitness: a quota ring, days left counting down,
// devices and the account's status. Every word comes translated in the payload.
// Payload: { d?: 'rtl', g?: native digits, t: title, s: status, sl: status label,
//   u: '12 / 50 GB', ul: 'used', p: percent | null (no limit), pl: '24%' | 'no limit',
//   x: expiry (unix s, 0 = never), xl: 'until …' | 'never expires', dl: 'days left', tl: 'left',
//   el: 'expired', dv: 'up to 3 devices' }
export default page(
  `.pl{font-size:13px;font-weight:600;padding:3px 9px;border-radius:11px;white-space:nowrap}
.ok{color:var(--up);background:rgba(12,163,12,.1)}.bad{color:var(--dn);background:rgba(208,59,59,.1)}.off{color:var(--h);background:var(--b2)}.wn{color:#b85f00;background:rgba(230,130,0,.12)}
@media(prefers-color-scheme:dark){.wn{color:#ffa94d}}
.rg{position:relative;width:118px;height:118px;flex:none}.rg svg{width:118px;height:118px;transform:rotate(-90deg)}
.rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 16px}
.ar{stroke-dasharray:314.16;transition:none}.in .ar{animation:rs .6s var(--e) backwards}@keyframes rs{from{stroke-dashoffset:314.16}}
.sc{display:flex;flex-direction:column;gap:9px}.sc>div+div{border-top:1px solid var(--g);padding-top:9px}
[dir=rtl] *{letter-spacing:0!important}
@media(prefers-reduced-motion:reduce){.in .ar{animation:none}}`,
  '<div id=a></div>',
  `function G(s){s=String(s);return D.g?s.replace(/\\d/g,function(c){return D.g[c]}):s}
function Z(n){return G(('0'+n).slice(-2))}
var S={active:['ok','●'],disabled:['off','⏸'],expired:['bad','✕']};
function K(){var d=D,b=$('cd'),l=$('cl');if(!b)return;if(!d.x){b.textContent='∞';return}
var r=d.x-Date.now()/1e3;if(r<=0){b.textContent=G(0);l.textContent=d.el}
else if(r>=172800){b.textContent=G(Math.floor(r/86400));l.textContent=d.dl}
else{r=Math.floor(r);b.textContent=Z(Math.floor(r/3600))+':'+Z(Math.floor(r/60)%60)+':'+Z(r%60);l.textContent=d.tl}}
var R=go(function(){var d=D,s=S[d.s]||['wn','!'],p=d.p,c=p==null?'var(--h)':p>=100?'var(--dn)':p>=80?'#e68a00':'var(--um)',f=p==null?0:Math.min(100,p);
$('a').innerHTML='<div dir="'+(d.d||'ltr')+'"><div class=r style="margin-bottom:10px"><span class="f t1 e">'+E(d.t)+'</span><span class="pl '+s[0]+'">'+s[1]+' '+E(d.sl)+'</span></div>'+
'<div class=r style="gap:16px;align-items:center"><div class=rg><svg viewBox="0 0 120 120"><circle cx=60 cy=60 r=50 fill=none stroke-width=13 style="stroke:'+c+';opacity:.16"/>'+(f?'<circle class=ar cx=60 cy=60 r=50 fill=none stroke-width=13 stroke-linecap=round style="stroke:'+c+';stroke-dashoffset:'+(314.16*(1-f/100)).toFixed(1)+'"/>':'')+'</svg>'+
'<div class=rc><span class="big n" style="font-size:'+(p==null?'30px':'26px')+'">'+(p==null?'∞':E(d.pl))+'</span>'+(p==null?'<span class=h>'+E(d.pl)+'</span>':'')+'</div></div>'+
'<div class="f sc"><div class=sg><div class="t1 n e">'+E(d.u)+'</div><div class=h>'+E(d.ul)+'</div></div>'+
'<div class=sg style="animation-delay:60ms"><div class=e><span id=cd class="big n" style="font-size:22px"></span> <span id=cl class=h></span></div><div class="h e">'+E(d.xl)+'</div></div>'+
'<div class="sg e" style="animation-delay:120ms">📱 '+E(d.dv)+'</div></div></div></div>';K()});
boot(R);setInterval(K,1000)`,
);
