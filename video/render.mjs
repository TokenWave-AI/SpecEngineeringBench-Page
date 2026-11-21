// Editable, deterministic SVG motion graphics. ffmpeg encodes the final film.
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeSoundtrack} from './soundtrack.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const width=1920,height=1080,fps=24,duration=92;
const colors={paper:'#F6F8FE',ink:'#111C33',muted:'#56637D',line:'#DFE5F2',blue:'#1D73FF',red:'#710120',paleRed:'#F2E1E5',indigo:'#475CFF',violet:'#8054FF'};
const fonts={regular:fontkit.openSync(resolve(here,'fonts/NotoSansSC-Regular.ttf')),bold:fontkit.openSync(resolve(here,'fonts/NotoSansSC-SemiBold.ttf'))};
const pathCache=new Map();
function text(value,x,y,size=32,color=colors.ink,weight='regular',align='left'){
 const cacheKey=weight+'|'+value;let shaped=pathCache.get(cacheKey);
 if(!shaped){const f=fonts[weight],run=f.layout(value);let dx=0,parts=[];for(let i=0;i<run.glyphs.length;i++){const p=run.positions[i];parts.push(`<path transform="translate(${dx+p.xOffset} ${p.yOffset})" d="${run.glyphs[i].path.toSVG()}"/>`);dx+=p.xAdvance;}shaped={html:parts.join(''),advance:dx,units:f.unitsPerEm};pathCache.set(cacheKey,shaped);}
 const s=size/shaped.units,offset=align==='center'?shaped.advance*s/2:align==='right'?shaped.advance*s:0;
 return `<g fill="${color}" transform="translate(${x-offset} ${y}) scale(${s} ${-s})">${shaped.html}</g>`;
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>1-(1-clamp(v))**3;
const opacity=(u,start=0,speed=.5)=>ease((u-start)/speed);
const group=(content,alpha=1,dx=0,dy=0,scale=1,cx=960,cy=540)=>`<g opacity="${clamp(alpha)}" transform="translate(${dx} ${dy}) translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">${content}</g>`;
function box(x,y,w,h,fill='#fff',stroke=colors.line,r=20,shadow=false){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${shadow?'filter="url(#shadow)"':''}/>`;}
const line=(x1,y1,x2,y2,color=colors.line,thickness=1.5)=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${thickness}"/>`;
function label(value,x,y,w,fill='#F2F5FA',color=colors.muted){return box(x,y,w,42,fill,'none',10)+text(value,x+w/2,y+28,21,color,'regular','center');}
const code=(s,x,y,size=26,color='#334866')=>text(s,x,y,size,color);
const imageURI=(buffer,mime='image/png')=>`data:${mime};base64,${buffer.toString('base64')}`;
const wordmark=imageURI(readFileSync(resolve(root,'assets/logo.png')));
const mascot=imageURI(readFileSync(resolve(root,'assets/mascot.png')));
const tokenwave=imageURI(await sharp(readFileSync(resolve(root,'assets/tokenwave.svg'))).resize({width:440}).png().toBuffer());
const image=(url,x,y,w,h)=>`<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
const cursor=(x,y,alpha=1)=>group(`<path d="M${x} ${y}l0 29 8-8 7 14 6-3-7-14 12 0Z" fill="#111318" stroke="white" stroke-width="2"/>`,alpha);
function shell(title,subtitle=''){
 return box(230,220,1460,650,'#fff','#E1E3E8',24,true)+box(230,220,1460,68,'#F7F8FA','none',24)+`<rect x="230" y="257" width="1460" height="31" fill="#F7F8FA"/>`+[0,1,2].map((i)=>`<circle cx="${268+i*25}" cy="254" r="6.5" fill="${['#EFA59B','#E5D495','#B3CFA9'][i]}"/>`).join('')+text(title,960,263,23,'#596170','regular','center')+(subtitle?text(subtitle,290,330,24,colors.muted):'');
}
function footer(source=''){return image(tokenwave,88,990,200,48)+text(source,1830,1020,18,colors.muted,'regular','right');}
function cover(u,ending=false){
 const p=opacity(u,0,.9);
 let out=box(0,0,1920,1080,'#F8FAFE','none',0);
 out+=text('SOFTWARE ENGINEERING / BENCHMARK',100,98,20,'#5276AC','bold');
 out+=image(tokenwave,1510,54,300,72)+line(100,133,1820,133,'#DDE5F2');
 out+=group(image(wordmark,115,220,1680,562),p,0,18*(1-p));
 out+=group(text(ending?'Explore the benchmark. Inspect the evidence.':'From product specifications to reproducible defects.',100,824,39,colors.ink,'bold'),opacity(u,.65));
 if(ending){
  out+=group(text('tokenwave-ai.github.io/SpecEngineeringBench-Page',100,902,28,colors.blue,'bold'),opacity(u,1.3));
 }else{
  const labels=['Real Python repositories','Requirements-driven tests','Independent verification'];
  labels.forEach((value,i)=>{const x=100+i*575;out+=group(line(x,915,x+500,915,'#D8E2F1')+box(x,947,8,8,i===2?'#22B6B0':colors.blue,'none',0)+text(value,x+22,963,23,colors.ink,'bold'),opacity(u,1.3+i*.2));});
 }
 return out;
}
function scene0(u){
 const query='What should an AI test engineer test?';const chars=Math.floor(clamp((u-.65)/2)*query.length);
 let content=image(mascot,865,112,190,198)+text('Before a software release',960,350,27,colors.muted,'regular','center');
 content+=box(330,420,1260,110,'#fff','#DEDDE0',18,true);
 content+=`<circle cx="382" cy="472" r="15" fill="none" stroke="#747B86" stroke-width="3"/>`+line(393,483,405,495,'#747B86',3);
 content+=text(query.slice(0,chars),438,487,32);
 if(u<3.3&&Math.floor(u*3)%2===0)content+=`<rect x="${438+(pathCache.get('regular|'+query.slice(0,chars))?.advance||0)*32/fonts.regular.unitsPerEm}" y="455" width="2" height="38" fill="#1D73FF"/>`;
 ['Requirements','Repository','Runtime'].forEach((v,i)=>{content+=group(label(v,630+i*225,590,210),opacity(u,2.8+i*.1,.4),0,12*(1-opacity(u,2.8+i*.1,.4)));});
 return group(content,opacity(u),0,10*(1-opacity(u)))+footer();
}
function scene1(u){
 return cover(u);
}
function scene2(u){
 let out=text('From requirements to executable evidence.',960,168,46,colors.ink,'bold','center');
 const cards=[['01','Product requirements','Expected behavior','Boundaries and error handling'],['02','Pre-release repository','Multiple unknown defects','No issue or location hints'],['03','Docker environment','Dependencies configured','Ready to execute']];
 cards.forEach((c,i)=>{let p=opacity(u,.2+i*.18);const x=230+i*500;let inner=box(x,290,460,280,'#fff','#E1E3E8',20,true)+text(c[0],x+30,341,20,colors.blue,'bold')+text(c[1],x+30,405,29,colors.ink,'bold')+text(c[2],x+30,470,25,colors.muted)+text(c[3],x+30,512,23,colors.muted);out+=group(inner,p,0,28*(1-p));});
 const p=opacity(u,1.25);out+=group(line(460,600,460,640,'#BAC6DB',2)+line(960,600,960,640,'#BAC6DB',2)+line(1460,600,1460,640,'#BAC6DB',2)+line(460,640,1460,640,'#BAC6DB',2)+line(960,640,960,696,'#BAC6DB',2),p);
 out+=group(label('Task 1 · Test generation',390,750,530,'#E8F0FF',colors.blue)+label('Task 2 · Defect reporting',1000,750,530,'#EEE8FF',colors.violet)+text('Two independent tasks',960,858,25,colors.muted,'regular','center'),opacity(u,1.6));
 return group(out,opacity(u))+footer('Paper · Task formulation');
}
function scene3(u){
 let out=text('Does this test expose the defect?',960,153,44,colors.ink,'bold','center');
 out+=shell('Folium / episode-0001   ·   GPT-6-Astra with Codex');
 out+=label('PRD / Test / Evaluator replay',290,313,440,'#E8F0FF',colors.blue);
 out+=group(label('Replay both snapshots',1320,313,310,'#111318','#fff'),opacity(u,5.1));
 if(u>5.3&&u<8){const p=ease((u-5.3)/1.0);out+=cursor(1740-220*p,790-450*p,opacity(u,5.3));}
 out+=text('Leaflet path option forwarding',290,414,30,colors.ink,'bold');
 const prd=['Unrecognised but valid Leaflet path options are retained','and emitted to the browser instead of being discarded.'];
 prd.forEach((v,i)=>out+=text(v,290,461+i*38,27,colors.muted));
 out+=line(290,532,1630,532);
 const lines=['def test_additional_leaflet_path_options_survive(key, value, normalized):','    assert path_options(**{key: value})[normalized] == value'];
 const charCount=Math.floor(clamp((u-1.8)/3.5)*lines.join('\n').length);let chars=charCount;
 lines.forEach((v,i)=>{const n=Math.min(v.length,Math.max(0,chars));out+=code(v.slice(0,n),290,591+i*43,25,i===0?'#475CFF':'#263D60');chars-=v.length+1;});
 out+=group(label("key='pane'",290,700,185)+label("value='customPane'",490,700,290)+label("normalized='pane'",795,700,265),opacity(u,4.7));
 if(u>6.1){
  const p=opacity(u,6.1,.4);out+=group(box(290,781,1340,54,colors.paleRed,'none',9)+text("Defective snapshot: fail · KeyError: 'pane'",320,817,24,colors.red,'bold'),p);
 }
 // After the assertion appears, the verifier board slides over the original test.
 if(u>8.0){const p=opacity(u,8,.65);let board=box(410,362,1100,430,'url(#cover)','#3B5390',24,true)+text('EVALUATOR REPLAY',960,422,22,'#B7CAE8','bold','center');
  board+=box(450,454,490,230,'#111926','#35445C',12)+box(980,454,490,230,'#111926','#35445C',12);
  board+=text('DEFECTIVE',695,498,21,'#AEBBD0','bold','center')+text('REPAIRED',1225,498,21,'#AEBBD0','bold','center');
  board+=text('FAIL',695,602,72,'#F595A5','bold','center');
  board+=text(u>9.5?'PASS':'REPLAY',1225,602,u>9.5?72:48,u>9.5?'#B2EAA9':'#AEBBD0','bold','center');
  board+=text(u>10?'Fail-to-Pass: yes':'Same submitted test · Two snapshots',960,744,27,u>10?'#C8F3C3':'#C2CBE0','bold','center');
  out+=group(`<rect width="1920" height="1080" fill="${colors.paper}" opacity=".88"/>`+board,p,0,24*(1-p));
 }
 return group(out,opacity(u))+footer('Paper · Appendix C · Verbatim assertion and evaluator outcomes');
}
function scene4(u){
 let out=text('Test validity decouples from defect detection.',960,180,43,colors.ink,'bold','center');
 out+=text('Across seven frontier coding agents',960,243,27,colors.muted,'regular','center');
 const rows=[['Head Pass Rate',91.47,colors.blue],['Change-focused Coverage',80.48,colors.indigo],['Fail-to-Pass Rate',26.36,colors.violet]];
 out+=box(232,295,1456,520,'#fff',colors.line,24,true);
 rows.forEach(([name,value,color],i)=>{
  const y=374+i*146,p=ease((u-.4-i*.18)/1.3);
  out+=text(name,310,y,26,colors.ink,'bold')+box(310,y+27,1090,26,'#ECF0F8','none',8);
  out+=box(310,y+27,Math.max(.1,1090*value/100*p),26,`url(#metric-${i})`,'none',8);
  out+=group(text(value.toFixed(2)+'%',1600,y+49,44,color,'bold','right'),p);
 });
 out+=group(text('Reaching patched code does not ensure behavioral discrimination.',960,895,29,colors.muted,'regular','center'),opacity(u,2.6));
 return group(out,opacity(u))+footer('Table 3 · Seven-agent means · All measures shown as percentages');
}
const palette=['#1D73FF','#475CFF','#8054FF','#124A09','#839800','#85EA00','#710120','#C51354','#DF3FD3','#F5580B','#FFA222','#FDDC24','#D9DDFF','#EEE8FF','#FFE4EE','#FFDECE'];
function scene5(u){
 let out=text('A benchmark built from real Python repositories.',960,174,43,colors.ink,'bold','center');
 const stats=[['100','instances'],['78','repositories'],['531','recorded defect occurrences'],['16','application categories']];
 stats.forEach(([value,name],i)=>{const x=300+i*425,p=opacity(u,.2+i*.14);out+=group(text(value,x,376,88,colors.blue,'bold','center')+text(name,x,425,i===2?22:25,colors.muted,'regular','center'),p,0,18*(1-p));});
 const values=[17,15,14,10,8,7,6,6,4,3,2,2,2,2,1,1];let angle=-Math.PI/2;
 values.forEach((n,i)=>{const a=angle+.009,b=angle+Math.PI*2*n/100-.009;angle+=Math.PI*2*n/100;const r=133,point=t=>[640+r*Math.cos(t),680+r*Math.sin(t)];const p1=point(a),p2=point(b);out+=group(`<path d="M${p1} A${r} ${r} 0 0 1 ${p2}" fill="none" stroke="${palette[i]}" stroke-width="42"/>`,opacity(u,.8+i*.055));});
 out+=text('16',640,685,69,colors.ink,'bold','center')+text('categories',640,725,24,colors.muted,'regular','center');
 const cats=['Database','Software development','Data analysis','Internet','Security','Multimedia'];cats.forEach((c,i)=>out+=group(`<circle cx="1000" cy="${560+i*58}" r="7" fill="${palette[i]}"/>`+text(c,1023,570+i*58,25,colors.muted)+text(String(values[i]),1510,570+i*58,25,colors.ink,'bold','right'),opacity(u,1+i*.12)));
 out+=group(text('+ 10 other application categories',1000,941,22,colors.muted),opacity(u,2));
 return group(out,opacity(u))+footer('Figure 2 · Current benchmark inventory');
}
function scene6(u){
 return cover(u,true);
}
function heading(kicker,title,subtitle){
 return image(tokenwave,1550,47,270,64)+text('SpecEngineeringBench',100,87,21,colors.ink,'bold')+
 line(100,123,1820,123,'#DBE3EF')+text(kicker,100,190,20,'#5276AC','bold')+
 text(title,100,270,57,colors.ink,'bold')+text(subtitle,100,325,27,colors.muted);
}
function requirements(u){
 let out=heading('READ THE SPECIFICATION','Start with expected behavior.','Folium / episode-0001 · Paper walkthrough');
 out+=box(100,390,700,480,'#FFFFFF',colors.line,18,true);
 out+=text('PRODUCT REQUIREMENTS',140,448,20,colors.blue,'bold');
 ['Leaflet path options','Additional valid options must be retained','and emitted to the browser.'].forEach((v,i)=>out+=text(v,140,520+i*49,i===0?35:27,i===0?colors.ink:colors.muted,i===0?'bold':'regular'));
 out+=box(140,692,605,113,'#EAF4FF','none',12)+text("Example: pane = 'customPane'",167,758,28,colors.blue,'bold');
 let right=text('What the agent needs to decide',930,429,30,colors.ink,'bold');
 const rows=[['Locate','Find the option-normalization code.'],['Exercise','Pass an additional valid option.'],['Assert','Check that its value survives.']];
 rows.forEach(([title,detail],i)=>{
  const y=492+i*121,p=opacity(u,.8+i*.9);
  right+=group(box(930,y,870,98,'#FFFFFF',colors.line,12)+box(954,y+28,8,42,i===2?'#20B6B0':colors.blue,'none',3)+text(title,987,y+40,26,colors.ink,'bold')+text(detail,987,y+76,24,colors.muted),p,20*(1-p));
 });
 return out+right+footer('Illustrated from the paper PRD · The agent chooses its own test scope');
}
function localization(u){
 let out=heading('TASK 2 / DEFECT REPORTING','Trace a failure to its source.','Reports identify files, functions, and source-coordinate hunks.');
 const cards=[
  ['FILE','Repository-relative path',['Affected source file','Recover the relevant module.'],78.11],
  ['FUNCTION','path_options(...)',['Responsible function','Separate the root cause from callers.'],51.29],
  ['HUNK','Changed source lines',['Precise edit region','Three-line tolerance for matching.'],51.88]
 ];
 cards.forEach(([level,name,details,value],i)=>{
  const x=100+i*588,p=opacity(u,.4+i*.7);
  let card=box(x,415,548,443,'#FFFFFF',colors.line,18,true)+text(level,x+32,470,20,colors.blue,'bold');
  card+=text(name,x+32,536,32,colors.ink,'bold')+line(x+32,572,x+516,572,'#E1E7F1');
  details.forEach((v,j)=>card+=text(v,x+32,623+j*43,j===0?27:23,colors.muted));
  card+=text(value.toFixed(2)+'%',x+32,790,62,i===0?colors.blue:'#536DE0','bold')+text('mean localization recall',x+32,829,21,colors.muted);
  out+=group(card,p,0,24*(1-p));
 });
 out+=group(text('Finding the file is only the first step.',100,941,35,colors.ink,'bold'),opacity(u,3));
 return out+footer('Table 3 · Means across seven agents · Diagram illustrates reporting granularity');
}
function activeTesting(u){
 let out=heading('TEST AUTHORING / PAIRED COMPARISON','New tests recover more defect locations.','GPT-5.6-Sol · Same 100 instances · Agent-authored vs. repository-provided tests');
 const gains=[['FILE RECALL','+4.99'],['FUNCTION RECALL','+2.77'],['HUNK RECALL','+2.69']];
 gains.forEach(([label,value],i)=>{
  const x=100+i*588,p=opacity(u,.4+i*.6);
  out+=group(line(x,450,x+548,450,'#A6C8FB',3)+text(label,x,510,23,colors.muted,'bold')+text(value,x,665,108,colors.blue,'bold')+text('percentage points',x,722,26,colors.muted),p,0,18*(1-p));
 });
 out+=group(box(100,816,1720,120,'#EBF2FF','none',16)+text('Recall improves. Mean precision decreases at all three granularities.',140,886,30,colors.ink,'bold'),opacity(u,2.5));
 return out+footer('Table 7 · Paired comparison · Recall differences computed before rounding');
}
const scenes=[
 {start:0,end:8,fn:scene1},
 {start:8,end:15,fn:scene0},
 {start:15,end:24,fn:scene2},
 {start:24,end:34,fn:requirements},
 {start:34,end:49,fn:scene3},
 {start:49,end:61,fn:scene4},
 {start:61,end:72,fn:localization},
 {start:72,end:81,fn:activeTesting},
 {start:81,end:87,fn:scene5},
 {start:87,end:92,fn:scene6}
];
function frame(t){
 let body=`<rect width="1920" height="1080" fill="${colors.paper}"/><rect width="1920" height="1080" fill="url(#paper-grid)"/><ellipse cx="960" cy="535" rx="990" ry="515" fill="url(#wash)"/>`;
 for(const scene of scenes){if(t<scene.start-.3||t>=scene.end)continue;const u=t-scene.start;const outFade=scene.end<duration?clamp((scene.end-t)/.45):1;body+=group(scene.fn(Math.max(0,u)),outFade);}
 body+=`<rect x="88" y="1055" width="1744" height="2" fill="#8DA7DC" opacity=".35"/><rect x="88" y="1055" width="${1744*clamp(t/duration)}" height="2" fill="#438DFF"/>`;
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1920 1080"><defs>
 <filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#142A5A" flood-opacity=".1"/></filter>
 <linearGradient id="cover" x2="1" y2="1"><stop stop-color="#0B1428"/><stop offset="1" stop-color="#162A54"/></linearGradient>
 <radialGradient id="glow"><stop stop-color="#3B6AFE" stop-opacity=".38"/><stop offset="1" stop-color="#3B6AFE" stop-opacity="0"/></radialGradient>
 <radialGradient id="wash"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
 <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#7798DD" stroke-opacity=".14"/></pattern>
 <pattern id="paper-grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#6081BA" stroke-opacity=".10"/></pattern>
 <linearGradient id="metric-0"><stop stop-color="#76B1FF"/><stop offset="1" stop-color="#1D73FF"/></linearGradient>
 <linearGradient id="metric-1"><stop stop-color="#8999FF"/><stop offset="1" stop-color="#475CFF"/></linearGradient>
 <linearGradient id="metric-2"><stop stop-color="#AE91FF"/><stop offset="1" stop-color="#8054FF"/></linearGradient>
 </defs>${body}</svg>`);
}
const stillsIndex=process.argv.indexOf('--stills');
if(stillsIndex>=0){const dir=resolve(process.argv[stillsIndex+1]||resolve(tmpdir(),'teb-video-preview'));mkdirSync(dir,{recursive:true});for(const t of [0,3,12,20,29,40,45,55,66,77,84,90])await sharp(frame(t)).resize(1280,720).png().toFile(resolve(dir,`frame-${t}.png`));console.log('Stills: '+dir);}
else{
 const scratch=mkdtempSync(resolve(tmpdir(),'teb-video-'));const audio=resolve(scratch,'score.wav');writeSoundtrack(audio,duration);let encoder;
 try{
  const output=resolve(here,'SpecEngineeringBench-promo.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-i',audio,'-c:v','libx264','-preset','medium','-crf','18','-threads','4','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',String(duration),output],{stdio:['pipe','ignore','inherit']});
  const completion=once(encoder,'close');
  encoder.stdin.on('error',error=>{if(error.code!=='EPIPE')console.error(error);});
  for(let n=0;n<duration*fps;n++){
   const raw=await sharp(frame(n/fps)).ensureAlpha().raw().toBuffer();if(!encoder.stdin.write(raw))await once(encoder.stdin,'drain');
   if(n%(fps*3)===0)console.log(`Rendered ${n/fps}/${duration}s`);
  }
  encoder.stdin.end();const [status]=await completion;if(status!==0)throw new Error(`ffmpeg failed with status ${status}`);
  await sharp(frame(3)).png().toFile(resolve(here,'promo-poster.png'));console.log('Rendered '+output);
 }finally{if(encoder&&!encoder.killed)encoder.kill();rmSync(scratch,{recursive:true,force:true});}
}
