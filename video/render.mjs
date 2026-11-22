// Editable, deterministic SVG motion graphics. ffmpeg encodes the final film.
// Every number shown on screen is taken from the paper (main.tex); scene footers cite the source.
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeSoundtrack} from './soundtrack.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const W=1920,H=1080,fps=30;
const C={bg:'#F4F7FC',ink:'#0F1A2E',body:'#2B3650',muted:'#5A6782',faint:'#8A96AD',line:'#DCE3EF',card:'#FFFFFF',
 blue:'#1D73FF',blueDeep:'#0B4FD1',pale:'#E8F0FF',teal:'#14A89F',red:'#D2345A',paleRed:'#FDE8EE',green:'#16935A',paleGreen:'#E3F6EB',
 lime:'#E4FF5C',dark:'#0C1529',darkLine:'#24314D',gray:'#C9D3E6'};
const syn={code:'#C9D4EA',kw:'#C792EA',str:'#A5E07A',fn:'#7FB4FF',dec:'#F7C76B',dim:'#6C7A96'};

// ---------- typography ----------
const F={
 regular:fontkit.openSync(resolve(here,'fonts/inter-400.woff2')),
 medium:fontkit.openSync(resolve(here,'fonts/inter-500.woff2')),
 semibold:fontkit.openSync(resolve(here,'fonts/inter-600.woff2')),
 bold:fontkit.openSync(resolve(here,'fonts/inter-700.woff2')),
 mono:fontkit.openSync(resolve(here,'fonts/jbm-400.woff2')),
 monoBold:fontkit.openSync(resolve(here,'fonts/jbm-600.woff2'))
};
const cache=new Map();
function shape(str,font){
 const key=font+'|'+str;let s=cache.get(key);
 if(!s){const f=F[font],run=/^[\d.,%+−–\s-]+$/.test(str)&&!font.startsWith('mono')?f.layout(str,['tnum','kern']):f.layout(str);let dx=0;const parts=[];
  run.glyphs.forEach((g,i)=>{const p=run.positions[i],d=g.path.toSVG();if(d)parts.push(`<path transform="translate(${(dx+p.xOffset).toFixed(1)} ${p.yOffset})" d="${d}"/>`);dx+=p.xAdvance;});
  s={html:parts.join(''),adv:dx,upm:f.unitsPerEm};cache.set(key,s);}
 return s;
}
const measure=(str,size,font='regular')=>str?shape(str,font).adv*size/F[font].unitsPerEm:0;
function T(str,x,y,size=32,color=C.ink,font='regular',align='left',op=1){
 if(!str)return '';const s=shape(str,font),sc=size/s.upm,w=s.adv*sc,ox=align==='center'?w/2:align==='right'?w:0;
 return `<g fill="${color}"${op<1?` opacity="${Math.max(0,op).toFixed(3)}"`:''} transform="translate(${(x-ox).toFixed(1)} ${y}) scale(${sc.toFixed(5)} ${(-sc).toFixed(5)})">${s.html}</g>`;
}
function rich(parts,x,y,size,font='bold',align='left'){
 const total=parts.reduce((a,[s])=>a+measure(s,size,font),0);let cx=align==='center'?x-total/2:x,out='';
 for(const [s,c] of parts){out+=T(s,cx,y,size,c,font);cx+=measure(s,size,font);}return out;
}
const monoW=size=>measure('M',size,'mono');

// ---------- motion ----------
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v);return 1-(1-v)**3;};
const easeIO=v=>{v=clamp(v);return v<.5?4*v*v*v:1-(-2*v+2)**3/2;};
const inn=(u,d=0,len=.55)=>ease((u-d)/len);
const G=(content,a=1,dx=0,dy=0,s=1,cx=960,cy=540)=>a<=0.001?'':`<g opacity="${clamp(a).toFixed(3)}" transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})${s!==1?` translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`:''}">${content}</g>`;
const rise=(content,u,d=0,dist=22,len=.55)=>{const p=inn(u,d,len);return G(content,p,0,dist*(1-p));};
const slide=(content,u,d=0,dist=40,len=.6)=>{const p=inn(u,d,len);return G(content,p,dist*(1-p),0);};

// ---------- primitives ----------
const R=(x,y,w,h,fill,r=0,extra='')=>`<rect x="${x.toFixed?x.toFixed(1):x}" y="${y.toFixed?y.toFixed(1):y}" width="${Math.max(0,w).toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="${r}" fill="${fill}" ${extra}/>`;
const card=(x,y,w,h,fill=C.card,stroke=C.line,r=18,shadow=true)=>R(x,y,w,h,fill,r,`stroke="${stroke}" stroke-width="1.5"${shadow?' filter="url(#shadow)"':''}`);
const L=(x1,y1,x2,y2,color=C.line,w=1.5,extra='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${w}" fill="none" ${extra}/>`;
function pill(label,x,y,{fill=C.pale,color=C.blue,font='semibold',size=20,pad=16,h=40,align='left',r=10,stroke='none'}={}){
 const w=measure(label,size,font)+pad*2,x0=align==='center'?x-w/2:align==='right'?x-w:x;
 return {w,svg:R(x0,y,w,h,fill,r,stroke!=='none'?`stroke="${stroke}" stroke-width="1.5"`:'')+T(label,x0+pad,y+h/2+size*.36,size,color,font)};
}
const check=(cx,cy,r=14,bg=C.green,fg='#fff')=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/><path d="M${cx-r*.42} ${cy+r*.02}l${r*.3} ${r*.32} ${r*.56}-${r*.62}" stroke="${fg}" stroke-width="${r*.2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const cross=(cx,cy,r=14,bg=C.red,fg='#fff')=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/><path d="M${cx-r*.36} ${cy-r*.36}l${r*.72} ${r*.72}M${cx+r*.36} ${cy-r*.36}l${-r*.72} ${r*.72}" stroke="${fg}" stroke-width="${r*.2}" stroke-linecap="round"/>`;
const arrowR=(x,y,len,color=C.blue,w=3)=>L(x,y,x+len-2,y,color,w,'stroke-linecap="round"')+`<path d="M${x+len-12} ${y-8}L${x+len} ${y}L${x+len-12} ${y+8}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const arrowUp=(x,y,s=24,color=C.green)=>`<path d="M${x} ${y-s}L${x+s*.75} ${y-s*.2}H${x+s*.3}V${y+s*.55}H${x-s*.3}V${y-s*.2}H${x-s*.75}Z" fill="${color}"/>`;
const dots=(x,y)=>[0,1,2].map(i=>`<circle cx="${x+i*24}" cy="${y}" r="7" fill="${['#F0A39A','#EBCF7E','#9FCC8F'][i]}"/>`).join('');
const img=(href,x,y,w,h)=>`<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
const uri=(buf,mime='image/png')=>`data:${mime};base64,${buf.toString('base64')}`;
const count=(v,p,dec=2)=>(v*ease(p)).toFixed(dec);

// ---------- assets ----------
const wordmark=uri(readFileSync(resolve(root,'assets/logo.png')));
const twSvg=readFileSync(resolve(root,'assets/tokenwave.svg'),'utf8');
const tw=uri(await sharp(Buffer.from(twSvg)).resize({width:560}).png().toBuffer());
const twWhite=uri(await sharp(Buffer.from(twSvg.replaceAll('fill="black"','fill="white"').replaceAll('#1D73FF','#FFFFFF'))).resize({width:560}).png().toBuffer());
const icon={};for(const n of ['claude','deepseek','glm','gpt','kimi'])icon[n]=uri(await sharp(readFileSync(resolve(here,`icons/icon-${n}.png`))).resize(96,96,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer());

// Table 3 (main results) — HP, F2P, CFG, LR(file/function/hunk); Table 4 F2P in the 80–100% CFG interval.
const models=[
 {name:'DeepSeek-V4.1-Flash',icon:'deepseek',harness:'Claude Code',hp:92.25,f2p:27.69,cfg:76.89,flr:76.97,fnlr:48.26,hlr:51.36,hi:30.06},
 {name:'Kimi-K3',icon:'kimi',harness:'Claude Code',hp:93.48,f2p:25.00,cfg:81.20,flr:80.64,fnlr:51.60,hlr:51.98,hi:26.75},
 {name:'GLM-5.3',icon:'glm',harness:'Claude Code',hp:94.40,f2p:21.33,cfg:80.58,flr:79.78,fnlr:49.39,hlr:51.57,hi:24.40},
 {name:'Claude-Sonnet-5',icon:'claude',harness:'Claude Code',hp:90.65,f2p:21.78,cfg:72.88,flr:62.89,fnlr:40.08,hlr:41.20,hi:24.24},
 {name:'Claude-Opus-5',icon:'claude',harness:'Claude Code',hp:93.16,f2p:27.07,cfg:83.39,flr:80.80,fnlr:56.55,hlr:55.11,hi:29.90},
 {name:'GPT-5.6-Sol',icon:'gpt',harness:'Codex',hp:86.02,f2p:34.09,cfg:81.41,flr:79.80,fnlr:52.59,hlr:52.22,hi:37.82},
 {name:'GPT-6-Astra',icon:'gpt',harness:'Codex',hp:90.37,f2p:27.56,cfg:87.01,flr:85.85,fnlr:60.56,hlr:59.72,hi:29.77}
];

// ---------- shared chrome ----------
function chrome(dark=false){
 return T('SpecEngineeringBench',96,76,26,dark?'#FFFFFF':C.ink,'semibold')+img(dark?twWhite:tw,1588,44,236,56)+R(96,108,1728,1.5,dark?'#FFFFFF3A':C.line);
}
function heading(u,kicker,parts,sub,dark=false){
 let out=rise(T(kicker,96,170,22,dark?C.lime:C.blue,'mono'),u,.05,14);
 out+=rise(rich(parts,96,254,74,'bold'),u,.15,22);
 if(sub)out+=rise(T(sub,96,308,30,dark?'#FFFFFFCC':C.muted,'regular'),u,.32,16);
 return out;
}
const source=(s,dark=false)=>T(s,96,1040,16,dark?'#FFFFFFAA':C.faint,'mono');

// ---------- scenes ----------
function hook(u){
 let out=R(0,0,W,H,'url(#blueGrad)')+R(0,0,W,H,'url(#dotsWhite)')+chrome(true);
 out+=rise(T('00 / THE PROBLEM',96,170,22,C.lime,'mono'),u,.05,14);
 out+=rise(T('3,448 tests passed.',96,300,104,'#FFFFFF','bold'),u,.2,26);
 out+=rise(T('Zero defects located.',96,420,104,C.lime,'bold'),u,3.1,26);
 // terminal
 let term=R(96,488,1000,400,C.dark,20,'filter="url(#shadowDark)"')+dots(130,522)+T('textual / episode-0001',596,529,18,'#8090B0','mono','center');
 const cmd='$ env -u NO_COLOR TERM=xterm-256color python -m pytest -q',n=Math.floor(clamp((u-.6)/1.0)*cmd.length);
 term+=T(cmd.slice(0,n),132,590,21,'#E6ECF8','mono');
 const prog=clamp((u-1.7)/1.2),bar='.'.repeat(Math.floor(prog*52));
 if(u>1.7)term+=T(bar,132,634,21,C.green.replace('16935A','4BD48A'),'mono')+T(`[${String(Math.round(prog*100)).padStart(3)}%]`,1060,634,21,'#8090B0','mono','right');
 if(u>2.95)term+=T('445 snapshots passed.',132,690,21,'#9FB0CF','mono');
 if(u>3.05)term+=T('3448 passed, 3 skipped, 4 xfailed, 1 xpassed in 292.80s',132,734,21,'#5BE39A','monoBold');
 if(u>3.1)term+=G(R(132,780,250,52,'#123826',10)+T('EXIT 0  ·  ALL GREEN',150,814,19,'#5BE39A','monoBold'),inn(u,3.1,.3));
 out+=rise(term,u,.35,30);
 // report card
 let rep=card(1150,488,674,400,'#FFFFFF','#FFFFFF',20)+T('DEFECT REPORT  ·  LOCALIZATION RECALL',1186,540,18,C.muted,'mono');
 [['File',.2],['Function',.45],['Hunk',.7]].forEach(([k,d],i)=>{const y=600+i*92,p=inn(u,3.5+d,.4);
  rep+=G(R(1186,y,602,72,C.paleRed,12)+T(k,1214,y+46,28,C.ink,'semibold')+T('0.00%',1760,y+48,36,C.red,'bold','right'),p,0,10*(1-p));});
 out+=slide(rep,u,3.3,40);
 return out+source('Paper · Case 3 · Textual · GPT-5.6-Sol with repository-provided tests',true);
}
function title(u){
 let out=chrome();
 out+=rise(T('SOFTWARE ENGINEERING / BENCHMARK',96,170,22,C.blue,'mono'),u,.05,12);
 const p=inn(u,.15,.8);out+=G(img(wordmark,84,196,1170,391),p,0,24*(1-p));
 out+=rise(rich([['Can an AI agent test a release ',C.ink],['from its requirements?',C.blue]],96,668,48,'bold'),u,.9,18);
 const stats=[[100,'benchmark instances'],[78,'Python repositories'],[531,'recorded defect occurrences'],[16,'application categories']];
 stats.forEach(([v,l],i)=>{const x=96+i*438,q=clamp((u-1.4-i*.15)/1.4);
  out+=rise(R(x,742,400,2,C.line)+R(x,742,400*ease(q),2,C.blue)+T(String(Math.round(v*ease(q))),x,850,92,C.blue,'bold')+T(l,x,898,24,C.muted),u,1.35+i*.15,16);});
 return out;
}
function setting(u){
 let out=chrome()+heading(u,'01 / THE SETTING',[['No issue. No hints. ',C.ink],['Just the spec.',C.blue]],'Agents decide what to test and where to look.');
 const cw=548,ys=378,ch=390;
 // PRD
 let a=card(96,ys,cw,ch)+T('PRODUCT REQUIREMENTS',128,ys+48,18,C.blue,'mono')+T('prd.md',96+cw-32,ys+48,18,C.faint,'mono','right');
 a+=T('Vector layer options',128,ys+104,28,C.ink,'semibold');
 [380,300,420,250].forEach((w,i)=>a+=R(128,ys+136+i*30,w,12,'#E8ECF4',6));
 const hl=clamp((u-1.2)/.8);a+=R(118,ys+262,(cw-44)*ease(hl),84,'#FFF6C2',10);
 a+=T('Unrecognised but valid Leaflet path',132,ys+294,21,C.body,'medium')+T('options are retained and emitted.',132,ys+326,21,C.body,'medium');
 out+=rise(a,u,.45,30);
 // repo
 let b=card(96+cw+42,ys,cw,ch)+T('PRE-RELEASE REPOSITORY',128+cw+42,ys+48,18,C.blue,'mono');
 const tree=[['folium/',0],['map.py',1],['features.py',1],['vector_layers.py',1],['utilities.py',1],['plugins/',1],['tests/',0],['test_vector_layers.py',1]];
 const bx=128+cw+42;
 b+=L(bx+8,ys+112,bx+8,ys+284,'#CBD5E6',1.5)+L(bx+8,ys+328,bx+8,ys+356,'#CBD5E6',1.5);
 tree.forEach(([s,d],i)=>{const y=ys+104+i*36;if(d)b+=L(bx+8,y-7,bx+24,y-7,'#CBD5E6',1.5);b+=T(s,bx+(d?34:0),y,21,d?C.body:C.ink,'mono');});
 b+=G(pill('unrepaired',96+cw*2+42-24,ys+22,{fill:C.paleRed,color:C.red,size:17,h:36,align:'right'}).svg,inn(u,1.6));
 out+=rise(b,u,.65,30);
 // docker
 const x3=96+2*(cw+42);let c=R(x3,ys,cw,ch,C.dark,18,'filter="url(#shadow)"')+T('DOCKER RUNTIME',x3+32,ys+48,18,'#7FB4FF','mono');
 const lines=[['$ docker run specbench/folium:ep-0001','#E6ECF8'],['dependencies installed · ready to run','#9FB0CF'],['repository mounted at /workspace','#9FB0CF'],['agent tools: shell, editor, pytest','#9FB0CF']];
 lines.forEach(([s,col],i)=>{if(u>1.0+i*.35)c+=T(s,x3+32,ys+108+i*42,19,col,'mono');});
 if(u>2.6&&Math.floor(u*2.5)%2===0)c+=R(x3+32,ys+272,12,24,'#7FB4FF');
 out+=rise(c,u,.85,30);
 // what is NOT given
 ['No issue report','No target files or functions','No entry points'].forEach((s,i)=>{const x=96+i*420;out+=rise(cross(x+16,ys+ch+60,14,'#9AA6BD')+T(s,x+42,ys+ch+68,23,C.muted,'medium'),u,2.4+i*.2,10);});
 return out+source('Paper · Section 3 · Task inputs (illustrated)');
}
function bugs(u){
 let out=chrome()+heading(u,'01 / THE SETTING',[['Several bugs ',C.ink],['hide',C.blue],[' in every snapshot.',C.ink]],'Folium · episode-0001 · five recorded defects in one repository');
 const files=['map.py','features.py','vector_layers.py','utilities.py','elements.py','raster_layers.py','template.py','macros.py','heat_map.py','geo_json.py','folium.py','__init__.py'];
 const bugsAt={2:.9,1:1.5,8:2.1,5:2.7,9:3.3};
 files.forEach((f,i)=>{const col=i%4,row=Math.floor(i/4),x=96+col*254,y=378+row*174;
  let t=card(x,y,238,158,'#FFFFFF',C.line,14,false)+T(f,x+20,y+38,18,C.body,'mono');
  for(let k=0;k<4;k++)t+=R(x+20,y+62+k*20,[150,110,180,90][(k+i)%4],8,'#E8ECF4',4);
  if(bugsAt[i]!==undefined){const p=inn(u,bugsAt[i],.35),pulse=.5+.5*Math.sin((u-bugsAt[i])*5);
   t+=G(R(x,y,238,158,'none',14,`stroke="${C.red}" stroke-width="3"`)+`<circle cx="${x+210}" cy="${y+30}" r="${16+4*pulse}" fill="${C.red}" opacity=".18"/>`+`<circle cx="${x+210}" cy="${y+30}" r="9" fill="${C.red}"/>`,p);}
  out+=rise(t,u,.35+i*.05,18);});
 const stats=[['4–15','recorded defects per instance'],['531','defect occurrences in total'],['80.4k','median source lines per snapshot']];
 stats.forEach(([v,l],i)=>{const y=420+i*160;out+=slide(R(1150,y-40,674,1.5,C.line)+T(v,1150,y+52,76,i===0?C.red:C.ink,'bold')+T(l,1150,y+96,24,C.muted),u,1.0+i*.25,30);});
 return out+source('Paper · Table 2 · Dataset statistics · file grid illustrative');
}
function codeLines(lines,x,y,size,lh,chars){
 let out='',left=chars;const cw=monoW(size);
 lines.forEach((toks,i)=>{let cx=x;for(const [s,c] of toks){if(left<=0)break;const n=Math.min(s.length,left);out+=T(s.slice(0,n),cx,y+i*lh,size,c,'mono');cx+=n*cw;left-=n;}left-=1;});
 return out;
}
const testCode=[
 [['@pytest.mark.parametrize(',syn.dec]],
 [['    "key, value, normalized",',syn.str]],
 [['    [(',syn.code],['"pane"',syn.str],[', ',syn.code],['"customPane"',syn.str],[', ',syn.code],['"pane"',syn.str],[')],',syn.code]],
 [[')',syn.code]],
 [['def ',syn.kw],['test_additional_leaflet_path_options_survive',syn.fn],['(key, value, normalized):',syn.code]],
 [['    assert ',syn.kw],['path_options',syn.fn],['(**{key: value})[normalized] == value',syn.code]]
];
const testLen=testCode.reduce((a,l)=>a+l.reduce((b,[s])=>b+s.length,0)+1,0);
function authoring(u){
 let out=chrome()+heading(u,'02 / TASK 1 · TEST AUTHORING',[['Read',C.blue],[' the spec. ',C.ink],['Write',C.blue],[' the test.',C.ink]],'Folium · episode-0001 · GPT-6-Astra with Codex');
 let win=card(96,370,1728,500,'#FFFFFF',C.line,20)+R(96,370,1728,56,'#F3F6FB',20)+R(96,406,1728,20,'#F3F6FB')+dots(128,398)+T('Agent workspace',960,405,19,C.muted,'medium','center');
 win+=R(96,425,1728,1.5,C.line);
 // PRD pane
 win+=T('prd.md',128,468,18,C.faint,'mono')+T('Vector layer options',128,518,28,C.ink,'semibold');
 win+=T('Path options such as color and weight are',128,562,21,C.muted)+T('normalised to their Leaflet names.',128,594,21,C.muted);
 const hl=clamp((u-1.0)/1.0);
 [[630,'Unrecognised but valid Leaflet path'],[662,'options are retained and emitted to'],[694,'the browser instead of being discarded.']].forEach(([y,s],i)=>{const q=clamp(hl*3-i);win+=R(122,y-24,(measure(s,21,'medium')+14)*ease(q),32,'#FFF1A8',6)+T(s,129,y,21,C.ink,'medium');});
 const tags=[['Locate the normaliser',1.6],['Choose an extra option',2.2],['Assert it survives',2.8]];
 tags.forEach(([s,d],i)=>win+=G(check(140,752+i*40,11,C.blue)+T(s,162,759+i*40,20,C.body,'medium'),inn(u,d,.35)));
 // editor pane
 win+=R(690,426,1134,444,C.dark,0)+R(1804,426,20,444,C.dark,0)+`<path d="M1804 850a20 20 0 0 1-20 20V426h20z" fill="${C.dark}"/>`;
 win+=R(690,426,1134,46,'#121D35')+T('test_path_unit.py',720,456,18,'#9FB0CF','mono')+T('SUBMITTED TEST',1790,456,16,'#5C6C8C','mono','right');
 const chars=Math.floor(clamp((u-1.3)/4.2)*testLen);
 for(let i=0;i<6;i++)win+=T(String(i+1),730,524+i*44,19,syn.dim,'mono','right');
 win+=codeLines(testCode,760,524,19.5,44,chars);
 if(chars<testLen&&Math.floor(u*3)%2===0){let left=chars,line=0;for(const l of testCode){const len=l.reduce((a,[s])=>a+s.length,0);if(left<=len)break;left-=len+1;line++;}win+=R(760+left*monoW(19.5),504+line*44,2,26,'#7FB4FF');}
 if(u>5.8)win+=G(R(720,818,1070,36,'#13284A',8)+T('assertion derived from the requirement — not from the code',740,842,17,'#9CC2FF','mono'),inn(u,5.8,.4));
 out+=rise(win,u,.4,30);
 return out+source('Paper · Appendix C · Verbatim submitted test (GPT-6-Astra, Folium)');
}
function replay(u){
 let out=chrome()+heading(u,'02 / TASK 1 · TEST AUTHORING',[['Fail',C.red],[' before the fix. ',C.ink],['Pass',C.green],[' after it.',C.ink]],'The evaluator replays every submitted test on two snapshots.');
 out+=rise(pill('test_additional_leaflet_path_options_survive[pane]',960,368,{fill:'#FFFFFF',color:C.ink,font:'mono',size:20,h:46,align:'center',stroke:C.line}).svg,u,.4,12);
 const p=inn(u,.8,.6);
 out+=G(`<path d="M960 414V444M500 444H1420M500 444V470M1420 444V470" stroke="#AFC0DA" stroke-width="2" fill="none"/>`,p);
 const term=(x,label,lines,verdict,ok,d)=>{let t=R(x,470,824,290,C.dark,18,'filter="url(#shadow)"')+T(label,x+32,512,17,'#7FB4FF','mono')+R(x,530,824,1.5,C.darkLine);
  lines.forEach(([s,col],i)=>{if(u>d+.3+i*.35)t+=T(s,x+32,578+i*42,20,col,'mono');});
  if(u>d+1.6){const q=inn(u,d+1.6,.35);t+=G(R(x+824-210,486,178,46,ok?'#123826':'#3A1424',10)+(ok?check(x+824-182,509,12,'#3DD68C','#0C1529'):cross(x+824-182,509,12,'#FF6B8B','#0C1529'))+T(ok?'PASSED':'FAILED',x+824-160,517,21,ok?'#5BE39A':'#FF8FA8','monoBold'),q,0,0,.9+.1*q,x+824-121,509);}
  return t;};
 out+=rise(term(96,'DEFECTIVE SNAPSHOT',[['$ pytest test_path_unit.py -k pane','#E6ECF8'],['F','#FF8FA8'],["E   KeyError: 'pane'",'#FF8FA8'],['1 failed','#FF8FA8']],'FAIL',false,1.0),u,1.0,24);
 out+=rise(term(1000,'REPAIRED SNAPSHOT',[['$ pytest test_path_unit.py -k pane','#E6ECF8'],['.','#5BE39A'],['','#5BE39A'],['1 passed','#5BE39A']],'PASS',true,2.0),u,2.0,24);
 const metrics=[['HP','Head Pass','passes on repaired code'],['F2P','Fail-to-Pass','fails before, passes after'],['EC','Entry Coverage','target functionality executed'],['CFG','Change Coverage','reference fix lines executed']];
 metrics.forEach(([k,n,d],i)=>{const x=96+i*438,hot=k==='F2P'&&u>5;let m=R(x,786,416,96,hot?C.blue:'#FFFFFF',14,`stroke="${hot?C.blue:C.line}" stroke-width="1.5"`)+T(k,x+24,846,34,hot?'#FFFFFF':C.blue,'bold')+T(n,x+120,826,20,hot?'#FFFFFF':C.ink,'semibold')+T(d,x+120,856,18,hot?'#DCE8FF':C.muted);out+=rise(m,u,3.6+i*.18,16);});
 return out+source('Paper · Appendix C · Defective: KeyError: \'pane\' · Repaired: pass · F2P: yes');
}
const reportLines=[['{',syn.code],['  "file": ',syn.code,'"folium/vector_layers.py"'],['  "function": ',syn.code,'"path_options"'],['  "lines": ',syn.code,'[123, 125, 126]'],['  "evidence": ',syn.code,'"KeyError: \'pane\'"'],['}',syn.code]];
function report(u){
 let out=chrome()+heading(u,'03 / TASK 2 · DEFECT REPORTING',[['Pinpoint',C.blue],[' where the bug lives.',C.ink]],'Each report is matched against the reference fix at three granularities.');
 let j=R(96,378,820,420,C.dark,18,'filter="url(#shadow)"')+T('defect_report.json',128,420,18,'#9FB0CF','mono')+R(96,440,820,1.5,C.darkLine);
 const chars=Math.floor(clamp((u-.7)/1.8)*140);let left=chars;
 reportLines.forEach(([k,c,v],i)=>{const y=500+i*48;const s=k+(v||'');const n=Math.min(s.length,Math.max(0,left));left-=s.length;
  const kk=k.slice(0,n);j+=T(kk,128,y,21,c,'mono');if(v&&n>k.length)j+=T(v.slice(0,n-k.length),128+k.length*monoW(21),y,21,syn.str,'mono');});
 out+=rise(j,u,.35,24);
 const rows=[['FILE','folium/vector_layers.py','path matches reference'],['FUNCTION','path_options','function matches reference'],['HUNK','lines 123–126','within ±3 lines of the fix']];
 rows.forEach(([k,v,d],i)=>{const y=378+i*146,dl=2.4+i*.55,p=inn(u,dl,.4);
  out+=G(`<path d="M916 ${548+i*48}C990 ${548+i*48} 960 ${y+62} 1004 ${y+62}" stroke="#9CC2FF" stroke-width="2" fill="none" stroke-dasharray="6 6"/>`,p);
  out+=G(card(1004,y,820,124)+T(k,1036,y+44,18,C.blue,'mono')+T(v,1036,y+90,30,C.ink,'semibold')+T(d,1780,y+90,20,C.muted,'regular','right')+check(1780,y+40,15),p,24*(1-p));});
 out+=rise(rich([['Scored by ',C.muted],['localization recall',C.ink],[' (LR) and ',C.muted],['precision',C.ink],[' (LP).',C.muted]],96,862,26,'medium'),u,4.0,12);
 return out+source('Paper · Case 2 · path_options localization (illustrative report format)');
}
function results(u){
 let out=R(0,0,W,H,'url(#blueGrad)')+R(0,0,W,H,'url(#dotsWhite)')+chrome(true);
 out+=rise(T('04 / RESULTS',96,250,24,C.lime,'mono'),u,.05,12);
 out+=rise(T('Seven frontier agents.',96,372,96,'#FFFFFF','bold'),u,.15,24);
 out+=rise(T('100 instances. Two tasks.',96,484,96,C.lime,'bold'),u,.45,24);
 models.forEach((m,i)=>{const x=96+i*251,p=inn(u,.9+i*.1,.45);
  out+=G(R(x,600,235,220,'#FFFFFF',18,'filter="url(#shadowDark)"')+R(x+24,624,72,72,'#F3F6FB',14)+img(icon[m.icon],x+30,630,60,60)+T(m.name,x+24,748,m.name.length>14?19:22,C.ink,'semibold')+T(m.harness,x+24,786,18,C.muted,'mono'),p,0,30*(1-p));});
 return out;
}
function shades(key){const vals=[...new Set(models.map(m=>m[key]))].sort((a,b)=>b-a);return v=>vals.indexOf(v);}
function leaderboard(u){
 let out=chrome()+heading(u,'04 / RESULTS',[['Who ',C.ink],['exposes',C.blue],[' the most defects?',C.ink]],'Main results · ranked by Fail-to-Pass · mean over 100 instances');
 const cols=[{k:'hp',l:'HP',x:600,w:170},{k:'f2p',l:'F2P',x:770,w:330,bar:true},{k:'cfg',l:'CFG',x:1100,w:170},{k:'flr',l:'File LR',x:1290,w:178},{k:'fnlr',l:'Func. LR',x:1468,w:178},{k:'hlr',l:'Hunk LR',x:1646,w:178}];
 const sorted=[...models].sort((a,b)=>b.f2p-a.f2p);const top=48,y0=432,rh=62;
 let tb=card(96,360,1728,y0-360+rh*7+16,'#FFFFFF',C.line,18);
 // column highlight bands
 const phase=u<5.4?0:1,band=inn(u,phase?5.4:1.6,.5);
 const bandCols=phase?cols.slice(3):[cols[1]];
 bandCols.forEach(c=>tb+=G(R(c.x+4,364,c.w-8,y0-364+rh*7+8,C.pale,0),band));
 tb+=T('TASK 1 · TEST AUTHORING',600,392,15,C.faint,'mono')+T('TASK 2 · DEFECT REPORTING',1290,392,15,C.faint,'mono');
 tb+=T('#',122,420,17,C.faint,'mono','center')+T('MODEL',160,420,17,C.faint,'mono');
 cols.forEach(c=>tb+=T(c.l,c.x+c.w/2,420,18,C.muted,'semibold','center'));
 tb+=R(96,y0,1728,1.5,C.line);
 const rank=Object.fromEntries(cols.map(c=>[c.k,shades(c.k)]));
 const shade=['#B9D3FF','#D6E5FF','#EAF2FF'];
 sorted.forEach((m,i)=>{const y=y0+i*rh,p=inn(u,.7+i*.12,.45);let r='';
  if(i)r+=R(110,y,1700,1,'#EEF1F6');
  r+=T(String(i+1),122,y+39,20,C.muted,'semibold','center')+img(icon[m.icon],160,y+15,32,32)+T(m.name,206,y+30,21,C.ink,'semibold')+T(m.harness,206,y+52,15,C.faint,'mono');
  cols.forEach(c=>{const v=m[c.k],rk=rank[c.k](v),fill=rk<3?shade[rk]:'none',font=rk===0?'bold':'medium';
   if(c.bar){const g=clamp((u-.9-i*.12)/1.2),bw=190*v/34.09*ease(g);r+=R(c.x+20,y+20,190,22,'#EEF2F8',6)+R(c.x+20,y+20,bw,22,rk===0?C.blue:'#7FAEFF',6)+(fill!=='none'?R(c.x+222,y+12,92,38,fill,8):'')+T(v.toFixed(2),c.x+268,y+38,20,C.ink,font,'center');}
   else r+=(fill!=='none'?R(c.x+c.w/2-48,y+12,96,38,fill,8):'')+T(v.toFixed(2),c.x+c.w/2,y+38,20,C.ink,font,'center');});
  tb+=G(r,p,0,12*(1-p));});
 out+=rise(tb,u,.3,24);
 return out+source('Paper · Table 3 · Top three per column shaded, best in bold · all values in %');
}
function decouple(u){
 let out=chrome()+heading(u,'05 / FINDING 1',[['Tests ',C.ink],['run',C.blue],['. Defects stay ',C.ink],['hidden',C.blue],['.',C.ink]],'Mean over seven agents · Head Pass vs. Fail-to-Pass');
 const rows=[['HEAD PASS RATE',91.47,C.ink,'url(#barInk)'],['FAIL-TO-PASS RATE',26.36,C.blue,'url(#barBlue)']];
 rows.forEach(([k,v,col,grad],i)=>{const y=410+i*240,g=clamp((u-.6-i*.5)/1.4);
  out+=rise(T(k,96,y,20,C.muted,'mono')+T(count(v,g)+'%',96,y+118,124,col,'bold')+R(96,y+150,900,18,'#E3E8F1',9)+R(96,y+150,900*v/100*ease(g),18,grad,9),u,.5+i*.5,18);});
 // waffle: 49,317 registered tests (67.44% pass both, 24.17% F2P, 8.39% fail repaired)
 const x0=1110,y0=410,cs=36,gap=6;
 out+=rise(T('49,317 REGISTERED TESTS',x0,384,18,C.muted,'mono'),u,1.2,10);
 for(let k=0;k<100;k++){const col=k%10,row=Math.floor(k/10),cat=k<24?1:k<91?0:2,p=inn(u,1.5+k*.025,.25);
  out+=G(R(x0+col*(cs+gap),y0+row*(cs+gap),cs,cs,[C.gray,C.blue,C.red][cat],7),p,0,0,.6+.4*p,x0+col*(cs+gap)+cs/2,y0+row*(cs+gap)+cs/2);}
 const lg=[[C.blue,'24.17%','fail, then pass (F2P)'],[C.gray,'67.44%','pass on both snapshots'],[C.red,'8.39%','fail on repaired code']];
 lg.forEach(([c,v,l],i)=>{const y=432+i*140;out+=slide(R(1546,y-22,16,16,c,4)+T(v,1574,y,34,c===C.gray?C.ink:c,'bold')+T(l,1574,y+34,18,C.muted),u,3.8+i*.25,20);});
 return out+source('Paper · Table 3 and Sec. 5.1 · 500 evaluations across five systems');
}
function coverage(u){
 let out=chrome()+heading(u,'05 / FINDING 1',[['Coverage',C.blue],[' is not detection.',C.ink]],'F2P per model, using only instances where tests cover 80–100% of the fix');
 const x0=520,w=1040,y0=430,rh=62;
 out+=rise(pill('Only instances with change coverage of 80–100%',x0,y0-64,{size:18,h:38,font:'semibold'}).svg,u,.4,10);
 [0,20,40,60,80,100].forEach(t=>out+=G(L(x0+w*t/100,y0-8,x0+w*t/100,y0+rh*7-8,'#E3E8F1',1)+T(t+'%',x0+w*t/100,y0+rh*7+20,15,C.faint,'mono','center'),inn(u,.4)));
 models.forEach((m,i)=>{const y=y0+i*rh,g=clamp((u-.8-i*.12)/1.1);
  out+=rise(img(icon[m.icon],96,y+4,30,30)+T(m.name,140,y+27,21,C.ink,'semibold')+R(x0,y+6,w,24,'#EEF2F8',12)+R(x0,y+6,w*m.hi/100*ease(g),24,m.hi===37.82?C.blue:'#6EA2FF',12)+T(count(m.hi,g)+'%',x0+w*m.hi/100*ease(g)+14,y+26,20,C.ink,'bold'),u,.6+i*.12,10);});
 out+=slide(T('24–38%',1600,520,62,C.blue,'bold')+T('F2P range across agents,',1600,562,20,C.muted)+T('even when tests execute',1600,592,20,C.muted)+T('nearly all of the fix',1600,622,20,C.muted),u,2.6,24);
 return out+source('Paper · Table 4 · F2P by change-focused coverage interval (80–100%)');
}
function localize(u){
 let out=chrome()+heading(u,'05 / FINDING 2',[['Finding the file',C.blue],[' is the easy part.',C.ink]],'Mean localization recall across seven agents');
 const base=860,bars=[['FILE',78.11],['FUNCTION',51.29],['HUNK',51.88]];
 out+=G(R(96,base,900,2,C.line),inn(u,.3));
 bars.forEach(([k,v],i)=>{const x=150+i*280,g=clamp((u-.6-i*.35)/1.1),h=420*v/100*ease(g);
  out+=G(R(x,base-h,190,h,i?'url(#barBlueV)':'url(#barInkV)',10)+T(count(v,g)+'%',x+95,base-h-18,38,i?C.blue:C.ink,'bold','center')+T(k,x+95,base+34,18,C.muted,'mono','center'),inn(u,.5+i*.35,.3));});
 out+=G(`<path d="M340 ${base-330}C390 ${base-360} 400 ${base-300} 430 ${base-260}" stroke="${C.red}" stroke-width="2.5" fill="none" stroke-dasharray="5 6"/>`+R(392,base-404,150,40,C.paleRed,10)+T('−26.81 pts',467,base-377,20,C.red,'bold','center'),inn(u,2.0,.4));
 const st=[['33–49%','of distinct reference bugs are fully localized',C.blue],['2–8%','of bugs that span multiple files',C.red]];
 st.forEach(([v,l,c],i)=>{const y=470+i*210;out+=slide(R(1110,y-70,714,1.5,C.line)+T(v,1110,y+40,96,c,'bold')+T(l,1110,y+86,24,C.muted),u,2.4+i*.4,30);});
 return out+source('Paper · Table 3 and Table 5 · Distinct bug localization');
}
function authored(u){
 let out=chrome()+heading(u,'05 / FINDING 3',[['Writing tests',C.blue],[' finds more bugs.',C.ink]],'GPT-5.6-Sol · agent-authored vs. repository-provided tests · same 100 instances');
 const cols=[['FILE RECALL',74.81,79.80,'+4.99','−2.74'],['FUNCTION RECALL',49.82,52.59,'+2.77','−1.60'],['HUNK RECALL',49.53,52.22,'+2.69','−3.25']];
 cols.forEach(([k,a,b,d,lp],i)=>{const x=96+i*588,p=inn(u,.5+i*.4);
  let c=R(x,400,548,3,'#A6C8FB')+T(k,x,452,20,C.muted,'mono')+arrowUp(x+30,556,30,C.green)+T(d,x+80,592,120,C.blue,'bold')+T('percentage points',x,640,22,C.muted);
  c+=T(a.toFixed(2)+'%',x,712,28,C.faint,'semibold')+arrowR(x+120,703,60,C.faint,2.5)+T(b.toFixed(2)+'%',x+196,712,28,C.ink,'bold');
  c+=G(R(x,752,268,42,C.paleRed,10)+T('precision '+lp,x+16,780,19,C.red,'semibold'),inn(u,2.4+i*.2));
  out+=G(c,p,0,20*(1-p));});
 out+=rise(R(96,830,1728,64,C.pale,14)+T('Recall rises at every granularity; precision dips slightly.',128,872,26,C.ink,'semibold'),u,3.2,12);
 return out+source('Paper · Table 6 · Paired comparison · differences computed before rounding');
}
function ending(u){
 let out=R(0,0,W,H,C.bg);
 const p=inn(u,.1,.9);out+=G(img(wordmark,410,150,1100,368),p,0,0,.96+.04*p);
 out+=rise(T('From product requirements to reproducible defects.',960,610,44,C.ink,'semibold','center'),u,.6,16);
 const url='tokenwave-ai.github.io/SpecEngineeringBench-Page',uw=measure(url,26,'mono')+64;
 out+=rise(R(960-uw/2,664,uw,64,C.dark,32)+T(url,960,706,26,'#FFFFFF','mono','center'),u,1.0,14);
 ['Paper','Code','Data'].forEach((s,i)=>{const pl=pill(s,0,0,{size:22,h:46,fill:'#FFFFFF',color:C.blue,stroke:C.line});out+=rise(pill(s,960+(i-1)*150,770,{size:22,h:46,fill:'#FFFFFF',color:C.blue,stroke:C.line,align:'center'}).svg,u,1.4+i*.12,10);});
 out+=rise(img(tw,830,880,260,62),u,1.9,10);
 return out;
}

// ---------- timeline ----------
const scenes=[
 [6,hook],[6,title],[8,setting],[6,bugs],[8,authoring],[8,replay],[6,report],[4,results],[10,leaderboard],[8,decouple],[6,coverage],[8,localize],[6,authored],[6,ending]
];
let acc=0;const timeline=scenes.map(([d,fn])=>{const s={start:acc,end:acc+d,fn};acc+=d;return s;});
const duration=acc;
const captions=[
 [.4,5.8,'A passing test suite can still miss every bug.'],
 [6.6,11.8,'SpecEngineeringBench: testing a real release from its requirements.'],
 [12.6,19.8,'Agents get a PRD, an unrepaired repository and a ready Docker runtime.'],
 [20.4,25.8,'Each snapshot hides 4–15 coexisting defects.'],
 [26.6,33.8,'Task 1: turn written requirements into concrete assertions.'],
 [34.6,41.8,'A test counts only if it fails on the buggy code and passes on the fix.'],
 [42.6,47.8,'Task 2: report each defect’s file, function and edited lines.'],
 [48.4,51.8,'We evaluate seven agents in Claude Code and Codex.'],
 [52.6,57.2,'GPT-5.6-Sol leads Fail-to-Pass at 34.09%.'],
 [57.4,61.8,'GPT-6-Astra leads localization recall at every granularity.'],
 [62.6,69.8,'91% of tests pass — only about a quarter expose a defect.'],
 [70.4,75.8,'Executing the fixed lines does not mean checking the behavior.'],
 [76.6,83.8,'Agents fully localize under half of all bugs, and almost no multi-file bugs.'],
 [84.4,89.8,'Writing tests from the PRD raises recall at every granularity.']
];
function caption(t){
 for(const [a,b,s] of captions){if(t<a-.3||t>b+.3)continue;const o=clamp((t-a+.3)/.3)*clamp((b+.3-t)/.3);
  const w=measure(s,27,'medium')+56;return G(R(960-w/2,948,w,58,'#0F1A2EE6',12)+T(s,960,986,27,'#FFFFFF','medium','center'),o,0,6*(1-o));}
 return '';
}
const defs=`<defs>
 <filter id="shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#142A5A" flood-opacity=".09"/></filter>
 <filter id="shadowDark" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#04103A" flood-opacity=".28"/></filter>
 <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2A7DFF"/><stop offset="1" stop-color="#0F55E0"/></linearGradient>
 <linearGradient id="barBlue"><stop stop-color="#7FB0FF"/><stop offset="1" stop-color="#1D73FF"/></linearGradient>
 <linearGradient id="barInk"><stop stop-color="#5B6A88"/><stop offset="1" stop-color="#0F1A2E"/></linearGradient>
 <linearGradient id="barBlueV" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#7FB0FF"/><stop offset="1" stop-color="#1D73FF"/></linearGradient>
 <linearGradient id="barInkV" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#5B6A88"/><stop offset="1" stop-color="#0F1A2E"/></linearGradient>
 <radialGradient id="glow" cx="1" cy="0" r="1"><stop stop-color="#CFE0FF" stop-opacity=".7"/><stop offset="1" stop-color="#CFE0FF" stop-opacity="0"/></radialGradient>
 <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#9FB3D6" fill-opacity=".35"/></pattern>
 <pattern id="dotsWhite" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#FFFFFF" fill-opacity=".16"/></pattern>
</defs>`;
function frame(t,{captions:showCaptions=true}={}){
 const drift=(t*8)%32;
 let body=`<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#glow)"/><g transform="translate(${-drift} ${-drift/2})"><rect width="${W+64}" height="${H+64}" fill="url(#dots)"/></g>`;
 for(const s of timeline){
  if(t<s.start||t>=s.end+.45)continue;
  const u=t-s.start,out=t>=s.end?clamp(1-(t-s.end)/.45):1;
  body+=G(s.fn(u),easeIO(out),0,-14*(1-easeIO(out)));
 }
 if(showCaptions)body+=caption(t);
 body+=`<rect x="0" y="${H-5}" width="${W}" height="5" fill="#1D73FF" opacity=".12"/><rect x="0" y="${H-5}" width="${(W*clamp(t/duration)).toFixed(1)}" height="5" fill="#1D73FF"/>`;
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${body}</svg>`);
}

// ---------- output ----------
const posterTime=10.5;
const stillsIndex=process.argv.indexOf('--stills');
if(process.argv.includes('--poster')){await sharp(frame(posterTime,{captions:false})).png().toFile(resolve(here,'promo-poster.png'));console.log('Poster written');}
else if(stillsIndex>=0){
 const dir=resolve(process.argv[stillsIndex+1]||resolve(tmpdir(),'seb-video-preview'));mkdirSync(dir,{recursive:true});
 const times=process.argv[stillsIndex+2]?process.argv[stillsIndex+2].split(',').map(Number):timeline.map(s=>s.end-.6);
 for(const t of times)await sharp(frame(t)).png().toFile(resolve(dir,`frame-${String(t).padStart(5,'0')}.png`));
 console.log('Stills: '+dir+' · duration '+duration+'s');
}else{
 const scratch=mkdtempSync(resolve(tmpdir(),'seb-video-'));const audio=resolve(scratch,'score.wav');writeSoundtrack(audio,duration);let enc;
 try{
  const output=resolve(here,'SpecEngineeringBench-promo.mp4');
  enc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(fps),'-i','pipe:0','-i',audio,
   '-c:v','libx264','-preset','medium','-crf','20','-threads','6','-pix_fmt','yuv420p','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',String(duration),output],{stdio:['pipe','ignore','inherit']});
  const done=once(enc,'close');enc.stdin.on('error',e=>{if(e.code!=='EPIPE')console.error(e);});
  for(let n=0;n<duration*fps;n++){
   const raw=await sharp(frame(n/fps)).ensureAlpha().raw().toBuffer();if(!enc.stdin.write(raw))await once(enc.stdin,'drain');
   if(n%(fps*6)===0)console.log(`Rendered ${n/fps}/${duration}s`);
  }
  enc.stdin.end();const [status]=await done;if(status!==0)throw new Error(`ffmpeg failed with status ${status}`);
  await sharp(frame(posterTime,{captions:false})).png().toFile(resolve(here,'promo-poster.png'));console.log('Rendered '+output);
 }finally{if(enc&&!enc.killed)enc.kill();rmSync(scratch,{recursive:true,force:true});}
}
