import { page } from '../base.js';

// 🔥 A page of CVEs, like a Stocks watchlist: number, id over the product, an EPSS
// bar or a KEV badge, and the CVSS score in a pill coloured by NVD's band. Rows
// don't open anything (the list's buttons do). Fixed row heights: lib/cvewidget.js
// computes the widget's height from the same numbers.
// Payload: { r, t: title, pg: page label, r0: first row's number,
//   c: [[id, product, score, band, epss or null, in KEV 1/0]] }
export default page(
  `[dir=rtl] *{letter-spacing:0!important}
.lt{height:28px;padding-bottom:4px}.c{height:47px;gap:10px}.no{width:18px;flex:none;font-size:13px}.c b{font-size:15px;line-height:20px;display:block}.c .h{display:block;line-height:16px}
.x{width:84px;flex:none;font-size:11px;line-height:14px}.eb{height:4px;border-radius:2px;background:var(--b2);margin-top:3px;overflow:hidden}.eb div{height:100%;border-radius:2px}
.kb{display:inline-block;background:var(--dn);color:#fff;border-radius:5px;padding:0 6px;font-size:12px;font-weight:700;line-height:20px}
.sp{width:44px;flex:none;text-align:center;border-radius:7px;color:#fff;font-size:14px;font-weight:700;line-height:26px}
.in .eb div{animation:gr .6s var(--e) backwards}@keyframes gr{from{width:0}}@media(prefers-reduced-motion:reduce){.in .eb div{animation:none}}`,
  '<div id=a></div>',
  `var K=['#8a8a8e','#2e9d4f','#d99a00','#ec6a12','#d03b3b'];
var R=go(function(){var d=D,h='<div class="lt r"><span class="t1 f e">'+E(d.t)+'</span><span class=h>'+E(d.pg)+'</span></div>';document.documentElement.dir=d.r?'rtl':'ltr';
d.c.forEach(function(x,i){var p=x[4],ec=p>=.5?'var(--dn)':p>=.1?'#ec6a12':'var(--tg-theme-button-color,#2481cc)',m='';
if(x[5])m='<span class=kb>KEV</span>';else if(p!=null)m='<span class="h n" style="display:block">EPSS '+(p*100).toFixed(p<.01?2:1)+'%</span><div class=eb><div style="width:'+Math.max(3,p*100).toFixed(1)+'%;background:'+ec+'"></div></div>';
h+='<div class="ln c r sg" style="animation-delay:'+i*40+'ms"><span class="no h n">'+(d.r0+i)+'</span><div class=f><b class="e n"><bdi>'+E(x[0])+'</bdi></b><span class="h e"><bdi>'+E(x[1])+'</bdi></span></div><div class=x>'+m+'</div><span class="sp n" style="background:'+(x[3]<0?'var(--b2);color:var(--h)':K[x[3]]+(x[3]==2?';color:#1a1a1a':''))+'">'+(x[2]==null?'—':x[2].toFixed(1))+'</span></div>'});
$('a').innerHTML=h});
boot(R)`,
);
