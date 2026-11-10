import { page } from '../base.js';

// 🖥 A managed xtune server like a status page: Xray and the subscription server up
// or down, the users at a glance, total traffic and one row per config. A config
// quiet for 2 hours while others carry traffic is "probably blocked" (xtune decides).
// Payload: { d?: 'rtl', t: address, v: version, ib?: 'IP looks blocked',
//   st?: [[name, 1 up | 0 down | null, detail]], sl: [running, down, unknown],
//   k: [[label, value]] (users, active, online, traffic), o: online count,
//   ch?: 'Configs', c?: [[id, 'a'|'q'|'i'|'f', when or host]], cl: {a, q, i}, m?: '+3 more' }
export default page(
  `.tl{display:flex;gap:8px;margin-top:10px}.tl>div{flex:1;min-width:0;background:var(--b2);border-radius:10px;padding:7px 10px}
.ok{color:var(--up)}.no{color:var(--dn)}.wn{color:#b85f00}@media(prefers-color-scheme:dark){.wn{color:#ffa94d}}
.k{display:flex;margin-top:10px}.k>div{flex:1;min-width:0}.k .big{font-size:22px}
.cf{display:flex;align-items:center;gap:8px;height:30px}.cf i{font-style:normal;width:14px;text-align:center;flex:none}.cf .w{flex:none;font-size:13px}
.q{background:rgba(208,59,59,.1);border-radius:6px;margin:0 -6px;padding:0 6px}
.ib{margin-top:10px;padding:6px 10px;border-radius:10px;background:rgba(208,59,59,.1);font-size:13px;font-weight:600}
[dir=rtl] *{letter-spacing:0!important}`,
  '<div id=a></div>',
  `var R=go(function(){var d=D,h='<div dir="'+(d.d||'ltr')+'"><div class=r><span class="f t1 e">🖥 '+E(d.t)+'</span><span class=h>xtune '+E(d.v)+'</span></div>';
if(d.ib)h+='<div class="ib no sg">⛔ '+E(d.ib)+'</div>';
if(d.st)h+='<div class=tl>'+d.st.map(function(x,i){var u=x[1],c=u==1?'ok':u===0?'no':'h';return'<div class=sg style="animation-delay:'+i*40+'ms"><div class=h>'+E(x[0])+'</div><b class="'+c+'">'+(u==1?'● ':u===0?'✕ ':'? ')+E(d.sl[u==1?0:u===0?1:2])+'</b><div class="h e" style="font-size:11px">'+E(x[2]||'')+'</div></div>'}).join('')+'</div>';
h+='<div class=k>'+d.k.map(function(x,i){return'<div class=sg style="animation-delay:'+(80+i*40)+'ms"><div class="big n e">'+(i==2&&d.o>0?'<span class="pd ok" style="vertical-align:4px"></span>':'')+E(x[1])+'</div><div class="h e">'+E(x[0])+'</div></div>'}).join('')+'</div>';
if(d.c&&d.c.length){h+='<div class=ln style="margin-top:10px;padding-top:6px"><div class=h style="padding-bottom:2px">'+E(d.ch)+'</div>'+d.c.map(function(x,i){var s=x[1],c=s=='a'?'ok':s=='q'?'no':'h';
return'<div class="cf sg'+(s=='q'?' q':'')+'" style="animation-delay:'+(240+i*40)+'ms"><i class="'+c+'">'+(s=='a'?'●':s=='q'?'⚠':s=='f'?'↪':'○')+'</i><b class="f e n" style="font-weight:'+(s=='i'?400:600)+'">'+E(x[0])+'</b><span class="w '+c+'">'+(s=='f'?'':E(d.cl[s]))+'</span>'+(x[2]?'<span class="h w">'+E(x[2])+'</span>':'')+'</div>'}).join('')+'</div>'}
if(d.m)h+='<p class=h style="padding-top:2px">'+E(d.m)+'</p>';
$('a').innerHTML=h+'</div>'});
boot(R)`,
);
