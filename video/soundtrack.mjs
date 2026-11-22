// Original synthesized score; no third-party samples.
// Bright major-key electronic bed at 120 BPM: one bar = 2 s, so every scene cut lands on a downbeat.
import {writeFileSync} from 'node:fs';

export function writeSoundtrack(path,duration=90){
 const rate=48000,N=Math.ceil(duration*rate);
 const L=new Float32Array(N),Rt=new Float32Array(N),send=new Float32Array(N);
 const bpm=120,beat=60/bpm,bar=beat*4;
 let seed=20261122;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
 const hz=m=>440*2**((m-69)/12);
 const add=(i,v,pan=0,rev=0)=>{if(i<0||i>=N)return;L[i]+=v*(1-pan)*.5*2;Rt[i]+=v*(1+pan)*.5*2;send[i]+=v*rev;};

 // Sections (seconds): intro, groove A, break, groove B, outro
 const intro=[0,6],breakdown=[48,52],outro=duration-6;
 const inSec=(t,[a,b])=>t>=a&&t<b;

 // D major: I – V – vi – IV  (D, A, Bm, G)
 const prog=[[62,66,69,74],[57,61,64,69],[59,62,66,71],[55,59,62,67]];
 const roots=[38,33,35,31];

 // --- voices ---
 function pad(start,len,notes,amp){
  const s0=Math.round(start*rate),n=Math.min(Math.round(len*rate),N-s0);
  for(const m of notes){const f=hz(m);
   for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.35)*Math.min(1,(len-t)/.45);
    let v=0;for(let h=1;h<=6;h++)v+=Math.sin(2*Math.PI*f*h*t*(1+.0015*(h%2?1:-1)))/(h*h*.9+.1);
    add(s0+i,v*env*amp,(m%3-1)*.3,.5);}}
 }
 function pluck(start,m,amp,pan=0,len=.42){
  const s0=Math.round(start*rate),n=Math.min(Math.round(len*rate),N-s0),f=hz(m);
  for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.003)*Math.exp(-t*9);
   const v=Math.sin(2*Math.PI*f*t)+.45*Math.sin(2*Math.PI*2*f*t)*Math.exp(-t*14)+.18*Math.sin(2*Math.PI*3*f*t)*Math.exp(-t*20);
   add(s0+i,v*env*amp,pan,.35);}
 }
 function bell(start,m,amp,pan=0,len=1.4){
  const s0=Math.round(start*rate),n=Math.min(Math.round(len*rate),N-s0),f=hz(m);
  for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.004)*Math.exp(-t*3.2);
   const v=Math.sin(2*Math.PI*f*t+1.2*Math.sin(2*Math.PI*f*2*t)*Math.exp(-t*5));
   add(s0+i,v*env*amp,pan,.55);}
 }
 function bass(start,m,amp,len=.45){
  const s0=Math.round(start*rate),n=Math.min(Math.round(len*rate),N-s0),f=hz(m);
  for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.006)*Math.min(1,(len-t)/.05)*(.75+.25*Math.exp(-t*8));
   const v=Math.sin(2*Math.PI*f*t)+.3*Math.sin(2*Math.PI*2*f*t)+.08*Math.sin(2*Math.PI*3*f*t);
   add(s0+i,v*env*amp,0,0);}
 }
 function kick(start,amp){
  const s0=Math.round(start*rate),n=Math.min(Math.round(.32*rate),N-s0);let ph=0;
  for(let i=0;i<n;i++){const t=i/rate,f=48+110*Math.exp(-t*32);ph+=2*Math.PI*f/rate;add(s0+i,Math.sin(ph)*Math.exp(-t*9)*amp,0,0);}
 }
 function clap(start,amp){
  const s0=Math.round(start*rate),n=Math.min(Math.round(.22*rate),N-s0);let lp=0,hp=0,prev=0;
  for(let i=0;i<n;i++){const t=i/rate,burst=t<.03?(Math.floor(t/.01)%2?.6:1):1;const x=rnd();lp+=.45*(x-lp);hp=lp-prev;prev=lp;
   add(s0+i,hp*Math.exp(-t*22)*burst*amp,.05,.6);}
 }
 function hat(start,amp,open=false){
  const s0=Math.round(start*rate),n=Math.min(Math.round((open?.18:.05)*rate),N-s0);let prev=0;
  for(let i=0;i<n;i++){const t=i/rate,x=rnd(),h=x-prev;prev=x;add(s0+i,h*Math.exp(-t*(open?24:70))*amp,.25,.1);}
 }
 function riser(start,len,amp){
  const s0=Math.round(start*rate),n=Math.min(Math.round(len*rate),N-s0);let lp=0;
  for(let i=0;i<n;i++){const t=i/rate,p=t/len,c=.02+.5*p*p;lp+=c*(rnd()-lp);add(s0+i,lp*p*p*amp,Math.sin(t*3)*.3,.6);}
 }
 function impact(start,amp){
  kick(start,amp*1.1);const s0=Math.round(start*rate),n=Math.min(Math.round(1.6*rate),N-s0);let lp=0;
  for(let i=0;i<n;i++){const t=i/rate;lp+=.08*(rnd()-lp);add(s0+i,lp*Math.exp(-t*2.6)*amp*.9,0,.9);}
 }

 // melody for groove B (scale degrees over each chord), 8th-note positions in a bar
 const hook=[[0,74],[3,76],[4,78],[6,76],[0,73],[3,76],[4,73],[6,69],[0,74],[2,73],[4,71],[6,69],[0,71],[3,74],[4,79],[6,78]];

 const bars=Math.ceil(duration/bar);
 for(let b=0;b<bars;b++){
  const t0=b*bar,ci=b%4,chord=prog[ci],root=roots[ci];
  if(t0>=duration)break;
  const isIntro=inSec(t0,intro),isBreak=inSec(t0,breakdown),isOut=t0>=outro,grooveB=t0>=52&&t0<outro;
  if(isOut){ // outro: resolve to D major and ring out
   if(t0===outro){impact(outro,.5);pad(outro,duration-outro,[50,57,62,66,69,74],.03);
    [74,78,81,86].forEach((m,i)=>bell(outro+.25+i*.32,m,.07,(i-1.5)*.25,2.6));bass(outro,38,.22,3.2);}
   continue;
  }
  pad(t0,bar+.2,chord,isIntro?.022:isBreak?.03:.02);
  // arpeggio (8ths); intro and break run at half density
  const pat=[0,2,1,3,2,1,3,2];
  for(let k=0;k<8;k++){
   if((isIntro||isBreak)&&k%2)continue;
   const m=chord[pat[k]]+12,amp=(isIntro?.05+.05*(t0/6):.075)*(k%2?.8:1);
   pluck(t0+k*beat/2,m,amp,k%2?-.35:.35);
  }
  if(isIntro){for(let k=0;k<4;k++)hat(t0+k*beat+beat/2,.05*(t0/6+.3));continue;}
  if(isBreak)continue;
  // groove
  for(let k=0;k<4;k++){
   kick(t0+k*beat,.42);
   if(k%2)clap(t0+k*beat,.17);
   hat(t0+k*beat+beat/2,.11,k===3&&b%4===3);
   hat(t0+k*beat,.05);
  }
  for(let k=0;k<8;k++){if(k===0||k%2)bass(t0+k*beat/2,root+(k===7?12:0),.19,k%2?.22:.4);}
  if(grooveB)hook.slice((ci)*4,(ci)*4+4).forEach(([pos,m])=>bell(t0+pos*beat/2,m,.05,.1,1.0));
 }

 // transitions
 riser(3,3,.22);impact(6,.42);
 riser(49.5,2.5,.2);impact(52,.38);
 [12,20,26,34,42,62,70,76].forEach(t=>hat(t-.06,.09,true));
 riser(outro-2,2,.14);

 // Schroeder reverb on the send bus
 const combs=[1557,1617,1491,1422].map(d=>({buf:new Float32Array(d),i:0,fb:.78,lp:0}));
 const aps=[225,556].map(d=>({buf:new Float32Array(d),i:0}));
 for(let i=0;i<N;i++){
  let x=send[i]*.12,y=0;
  for(const c of combs){const o=c.buf[c.i];c.lp=o*.7+c.lp*.3;c.buf[c.i]=x+c.lp*c.fb;c.i=(c.i+1)%c.buf.length;y+=o;}
  for(const a of aps){const o=a.buf[a.i];const v=y+o*.5;a.buf[a.i]=v;y=o-v*.5;a.i=(a.i+1)%a.buf.length;}
  L[i]+=y;Rt[i]+=y*.96;
 }

 // gentle master: normalize, soft-clip, fades
 let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(Rt[i]));
 const g=.85/Math.max(peak,1e-4),pcm=Buffer.alloc(N*4);
 for(let i=0;i<N;i++){const t=i/rate,f=Math.min(1,t/.4)*Math.min(1,(duration-t)/2.5);
  const l=Math.tanh(L[i]*g*1.1)*f,r=Math.tanh(Rt[i]*g*1.1)*f;
  pcm.writeInt16LE(Math.round(l*32767*.92),i*4);pcm.writeInt16LE(Math.round(r*32767*.92),i*4+2);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);
 writeFileSync(path,Buffer.concat([h,pcm]));
}
