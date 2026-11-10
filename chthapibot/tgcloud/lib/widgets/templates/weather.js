import { page } from '../base.js';

// 🌤 Weather like Apple Weather: big temperature, an hourly strip, 5-day range bars.
// Payload: { q, t, c: code, l: label, mx, mn, o: UTC offset (s),
//   hs:[[t,code,temp,rain%,night]] (7 slots, 3 h apart), d:[[day,code,min,max]], u }
export default page(
  `.hs{display:flex;padding:8px 0 6px;margin-top:8px}.hs>div{flex:1;text-align:center;font-size:13px}.hs i{display:block;font-style:normal;font-size:20px;line-height:26px}.hs u{display:block;text-decoration:none;font-size:11px;font-weight:600;color:#3d8bfd;height:13px}
.dy{display:flex;align-items:center;gap:8px;height:29px}.dy .w{width:46px}.dy .i{width:26px;text-align:center;font-size:18px}.dy .m{width:30px;text-align:right}.br{flex:1;height:5px;border-radius:3px;background:var(--b2);position:relative}.br div{position:absolute;top:0;bottom:0;border-radius:3px}.br .dt{width:7px;height:7px;margin:-1px 0 0 -3.5px;background:var(--t);top:0;bottom:auto}`,
  '<div id=a></div>',
  `function I(c,nt){return c<1?(nt?'🌙':'☀️'):c<2?(nt?'🌙':'🌤'):c<3?(nt?'☁️':'⛅'):c<4?'☁️':c<50?'🌫':c<60?(nt?'🌧':'🌦'):c<70?'🌧':c<80?'🌨':c<83?(nt?'🌧':'🌦'):c<90?'🌨':'⛈'}
function H(t){return('0'+new Date(t*1e3).getUTCHours()).slice(-2)}
function TC(t){return'hsl('+(200-(Math.max(-5,Math.min(35,t))+5)*4.25).toFixed(0)+',85%,55%)'}
var R=go(function(){var d=D,lo=Math.min.apply(0,d.d.map(function(x){return x[2]})),hi=Math.max.apply(0,d.d.map(function(x){return x[3]})),sp=hi-lo||1,ps=function(v){return(v-lo)/sp*100};
$('a').innerHTML='<div class=r><span class=big style="font-size:46px;font-weight:300">'+Math.round(d.t)+'°</span><div class=f><b>'+E(d.l)+'</b><div class=h>H:'+Math.round(d.mx)+'°  L:'+Math.round(d.mn)+'°</div></div><span style="font-size:40px;line-height:1">'+I(d.c,d.hs[0]&&d.hs[0][4])+'</span></div><div class="hs ln">'+d.hs.map(function(x,i){return'<div class=sg style="animation-delay:'+i*40+'ms"><span class=h>'+(i?H(x[0]+(d.o||0)):'Now')+'</span><i>'+I(x[1],x[4])+'</i><u>'+(x[3]>=20?x[3]+'%':'')+'</u><b>'+Math.round(x[2])+'°</b></div>'}).join('')+'</div><div class=ln style="padding-top:4px">'+d.d.map(function(x,i){return'<div class="dy sg" style="animation-delay:'+(200+i*40)+'ms"><b class=w>'+E(x[0])+'</b><span class=i>'+I(x[1])+'</span><span class="m h n">'+Math.round(x[2])+'°</span><div class=br><div class=rv style="left:'+ps(x[2]).toFixed(1)+'%;right:'+(100-ps(x[3])).toFixed(1)+'%;background:linear-gradient(90deg,'+TC(x[2])+','+TC(x[3])+');animation-delay:'+(240+i*40)+'ms"></div>'+(i?'':'<div class=dt style="left:'+ps(Math.max(x[2],Math.min(x[3],d.t))).toFixed(1)+'%"></div>')+'</div><b class="m n">'+Math.round(x[3])+'°</b></div>'}).join('')+'</div>'});
boot(R)`,
);
