import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Valores de respaldo para que la app funcione aunque Vercel no inyecte las variables.
// La anon key es pública en apps frontend; lo que nunca debe ponerse aquí es la service_role/secret key.
const FALLBACK_SUPA_URL = "https://uetuoxtfccrbymwlsssx.supabase.co";
const FALLBACK_SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldHVveHRmY2NyYnltd2xzc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjExMDIsImV4cCI6MjA5NTE5NzEwMn0.-A_cY0w1_V4UPeMXmFWStJ52xhWvHL5ecGtEEcBd1XA";

const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPA_URL).trim();
const SUPA_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPA_KEY).trim();
const supabase = createClient(SUPA_URL, SUPA_KEY);

async function db(table, method="GET", body=null, query="") {
  const url = `${SUPA_URL}/rest/v1/${table}${query}`;
  let token = SUPA_KEY;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || SUPA_KEY;
  } catch {}

  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: method==="POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (method==="GET" || (method==="POST" && res.ok)) {
    try { return await res.json(); } catch { return []; }
  }

  return res.ok;
}
const dbGet   = (t,q="") => db(t,"GET",null,q);
const dbPost  = (t,b)    => db(t,"POST",b,"");
const dbPatch = (t,q,b)  => db(t,"PATCH",b,q);

const T = {
  // Paleta mate pirata/rasta: menos brillo, más lectura y contraste cálido.
  g900:"#130B06",g800:"#21140C",g700:"#332013",g600:"#4B301B",
  g500:"#6B4524",g400:"#8A5A2E",g300:"#A87945",g200:"#C6A06A",
  g150:"#D8BE87",g100:"#C7A66B",g50:"#E8D3A2",
  pink:"#8F2E24",gold:"#B99A45",orange:"#A8662B",red:"#672018",blue:"#263F4D",
  ink:"#120806",panel:"#E6CF9B",panel2:"#D8BE87",
  text:"#1A0F08",textSub:"#5B3A20",white:"#F0E0B8",
  gradAdmin:"linear-gradient(135deg,#130B06,#21140C 62%,#3A2414)",
  gradStaff:"linear-gradient(135deg,#21140C,#4B301B 62%,#6B4524)",
  gradClient:"linear-gradient(135deg,#26331D,#4F602D 58%,#7C6A35)",
  gradGold:"linear-gradient(135deg,#6B4D1F,#B99A45 62%,#D8BE87)",
  gradPink:"linear-gradient(135deg,#42130F,#7A241B 62%,#A24A2D)",
};

const ROLES = { ADMIN:"admin", STAFF:"staff", CLIENT:"client" };

function normalizeRole(value){
  const role = String(value || "").trim().toLowerCase();
  if(["admin","administrador","administrator"].includes(role)) return ROLES.ADMIN;
  if(["staff","empleado","trabajador","worker"].includes(role)) return ROLES.STAFF;
  return ROLES.CLIENT;
}
function normalizeText(text=""){
  return String(text||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();
}

const BRAND = {
  name:"Rasta Cuts",
  tagline:"Cortes, rastas y estilo urbano",
  subtagline:"Reserva, juega y gana recompensas",
};

let audioCtx=null,musicInterval=null,musicPlaying=false,globalMuted=true;
let currentMusicTrack=0,musicStep=0;
const PENTA=[261.63,293.66,329.63,392.0,440.0,523.25,587.33,659.25];
const NOTE_FREQ={
  C2:65.41,Cs2:69.30,Db2:69.30,D2:73.42,Ds2:77.78,Eb2:77.78,E2:82.41,F2:87.31,Fs2:92.50,Gb2:92.50,G2:98,Ab2:103.83,Gs2:103.83,A2:110,As2:116.54,Bb2:116.54,B2:123.47,
  C3:130.81,Cs3:138.59,Db3:138.59,D3:146.83,Ds3:155.56,Eb3:155.56,E3:164.81,F3:174.61,Fs3:185.00,Gb3:185.00,G3:196,Ab3:207.65,Gs3:207.65,A3:220,As3:233.08,Bb3:233.08,B3:246.94,
  C4:261.63,Cs4:277.18,Db4:277.18,D4:293.66,Ds4:311.13,Eb4:311.13,E4:329.63,F4:349.23,Fs4:369.99,Gb4:369.99,G4:392,Ab4:415.30,Gs4:415.30,A4:440,As4:466.16,Bb4:466.16,B4:493.88,
  C5:523.25,Cs5:554.37,Db5:554.37,D5:587.33,Ds5:622.25,Eb5:622.25,E5:659.25,F5:698.46,Fs5:739.99,Gb5:739.99,G5:783.99,Ab5:830.61,Gs5:830.61,A5:880,As5:932.33,Bb5:932.33,B5:987.77,
  C6:1046.5,Cs6:1108.73,Db6:1108.73,D6:1174.66,Ds6:1244.51,Eb6:1244.51,E6:1318.51,F6:1396.91,Fs6:1479.98,Gb6:1479.98,G6:1567.98,Ab6:1661.22,Gs6:1661.22,A6:1760,As6:1864.66,Bb6:1864.66,B6:1975.53
};
const REGGAE_LOFI_TRACKS=[
  {
    name:"Brisa Dub de Pueblo",tickMs:430,length:704,accent:"pan",
    bass:["A2",null,"A2","C3","E2",null,"G2","E2","F2",null,"F2","A2","G2",null,"E2","G2"],
    chords:[["A3","C4","E4"],["G3","B3","D4"],["F3","A3","C4"],["E3","G3","B3"]],
    melody:["E5",null,"G5","A5","C6",null,"B5","A5","G5",null,"E5","D5","E5",null,"G5",null,"A5",null,"C6","E6","D6",null,"C6","A5","G5",null,"A5","G5","E5",null,"D5",null],
    counter:["A4",null,"C5",null,"E5",null,"C5",null,"G4",null,"B4",null,"D5",null,"B4",null],
    groove:{kick:[0,8],snare:[4,12],hat:[2,6,10,14],bass:[0,3,8,11,14],skank:[5,13],ghost:[7,15],melody:[1,5,9,13],counter:[6,10,14],padEvery:32,arp:30}
  },
  {
    name:"Skank de Mercado",tickMs:385,length:784,accent:"piano",
    bass:["D2",null,"D2","F2","A2",null,"C3","A2","Bb2",null,"Bb2","D3","C3",null,"A2","C3"],
    chords:[["D3","F3","A3"],["C3","E3","G3"],["Bb2","D3","F3"],["A2","C3","E3"]],
    melody:["A4","D5",null,"F5","E5",null,"D5",null,"C5","E5",null,"G5","F5",null,"E5",null,"D5",null,"F5","A5",null,"G5","E5",null,"F5",null,"E5","D5",null,"C5",null,null],
    counter:["D4",null,"F4",null,"A4",null,"F4",null,"C4",null,"E4",null,"G4",null,"E4",null],
    groove:{kick:[0,6,10],snare:[4,12],rim:[15],hat:[2,5,8,11,14],bass:[0,2,6,8,10,13],skank:[3,7,11,15],ghost:[5,13],melody:[0,3,6,10,12],counter:[5,9,14],padEvery:64,arp:31}
  },
  {
    name:"Noche Lofi en Tagor",tickMs:470,length:640,accent:"violin",
    bass:["G2",null,null,"Bb2","D2",null,"F2",null,"Eb2",null,null,"G2","F2",null,"D2",null],
    chords:[["G3","Bb3","D4"],["F3","A3","C4"],["Eb3","G3","Bb3"],["D3","F3","A3"]],
    melody:["D5",null,null,"F5","G5",null,"Bb5",null,"A5",null,"G5","F5",null,"D5",null,null,"C5",null,"D5","F5",null,"G5",null,"Bb5","D6",null,"C6","Bb5",null,"G5",null,null],
    counter:["G4",null,null,"Bb4",null,"D5",null,null,"F4",null,"A4",null,"C5",null,null,null],
    groove:{kick:[0,9],snare:[4,12],hat:[3,7,11,15],bass:[0,4,9,12],skank:[6,14],ghost:[10],melody:[3,7,11,15],counter:[5,13],padEvery:16,arp:46}
  },
  {
    name:"Costa One Drop",tickMs:410,length:736,accent:"pan",
    bass:["C2",null,"C3",null,"G2",null,"Bb2","G2","F2",null,"F3",null,"G2",null,"Bb2","G2"],
    chords:[["C3","E3","G3"],["Bb2","D3","F3"],["F3","A3","C4"],["G3","B3","D4"]],
    melody:["G4","C5",null,"E5",null,"G5","E5",null,"Bb4","D5",null,"F5",null,"D5",null,null,"A4","C5",null,"F5","E5",null,"C5",null,"D5",null,"G5",null,"F5","D5",null,null],
    counter:["C4",null,"E4",null,"G4",null,"E4",null,"F4",null,"A4",null,"C5",null,"A4",null],
    groove:{kick:[0],snare:[4,12],rim:[8],hat:[2,6,10,14],bass:[0,1,7,8,9,15],skank:[2,6,10,14],ghost:[3,11],melody:[0,3,5,8,11,14],counter:[7,15],padEvery:48,arp:63}
  },
  {
    name:"Ruta Rasta RPG",tickMs:360,length:848,accent:"piano",
    bass:["E2",null,"E2","G2","B2",null,"D3","B2","C3",null,"C3","E3","D3",null,"B2","D3"],
    chords:[["E3","G3","B3"],["D3","Fs3","A3"],["C3","E3","G3"],["B2","D3","Fs3"]],
    melody:["B4","E5","G5","B5",null,"A5","G5","E5","D5",null,"E5","G5","A5",null,"B5",null,"C6","B5","A5","G5",null,"E5",null,"D5","E5","G5",null,"A5","G5","E5",null,null],
    counter:["E4",null,"G4",null,"B4",null,"G4",null,"D4",null,"Fs4",null,"A4",null,"Fs4",null],
    groove:{kick:[0,4,8,12],snare:[6,14],hat:[1,3,5,7,9,11,13,15],bass:[0,2,4,7,8,10,12,15],skank:[5,9,13],ghost:[3,11,15],melody:[0,2,4,6,8,10,12,14],counter:[7,15],padEvery:64,arp:30}
  },
  {
    name:"Dub Espacial de Taller",tickMs:520,length:592,accent:"violin",
    bass:["F2",null,null,null,"F2",null,"A2",null,"C3",null,null,"A2","Bb2",null,"C3",null],
    chords:[["F3","A3","C4"],["C3","E3","G3"],["Bb2","D3","F3"],["C3","E3","G3"]],
    melody:["C5",null,null,"F5",null,"A5",null,null,"G5",null,"F5",null,"E5",null,null,null,"D5",null,"F5",null,"G5",null,"A5",null,"C6",null,"A5","G5",null,"F5",null,null],
    counter:["F4",null,null,null,"A4",null,null,null,"C5",null,null,null,"A4",null,null,null],
    groove:{kick:[0,10],snare:[4,12],hat:[6,14],bass:[0,4,10,12],skank:[7,15],ghost:[3,11],melody:[3,5,9,13],counter:[8],padEvery:16,arp:62}
  },
  {
    name:"Tauste Sunshine Ska",tickMs:330,length:912,accent:"pan",
    bass:["A2","C3","E3",null,"G2","E2","C3",null,"F2","A2","C3",null,"E2","G2","B2",null],
    chords:[["A3","C4","E4"],["G3","B3","D4"],["F3","A3","C4"],["E3","G3","B3"]],
    melody:["A5",null,"C6","E6","D6",null,"C6","A5","G5",null,"A5","C6","B5",null,"A5",null,"E5","G5","A5","C6",null,"B5","G5",null,"A5",null,"E5",null,"G5","A5",null,null],
    counter:["A4","C5",null,"E5",null,"C5",null,"A4","G4","B4",null,"D5",null,"B4",null,"G4"],
    groove:{kick:[0,4,8,12],snare:[2,6,10,14],hat:[1,3,5,7,9,11,13,15],bass:[0,1,4,5,8,9,12,13],skank:[1,3,5,7,9,11,13,15],ghost:[],melody:[0,2,4,6,8,10,12,14],counter:[3,7,11,15],padEvery:96,arp:47}
  },
  {
    name:"Meditación con Dreadlocks",tickMs:560,length:544,accent:"violin",
    bass:["D2",null,null,null,"A2",null,null,null,"Bb2",null,null,null,"F2",null,"A2",null],
    chords:[["D3","F3","A3"],["A2","C3","E3"],["Bb2","D3","F3"],["F3","A3","C4"]],
    melody:["A4",null,null,null,"D5",null,"F5",null,"E5",null,null,"D5",null,"C5",null,null,"Bb4",null,"D5",null,"F5",null,null,"A5",null,"G5",null,"F5",null,null,null,null],
    counter:["D4",null,null,null,"F4",null,null,null,"A4",null,null,null,"F4",null,null,null],
    groove:{kick:[0],snare:[8],hat:[4,12],bass:[0,8,12],skank:[6,14],ghost:[],melody:[4,7,11,14],counter:[10],padEvery:16,arp:126}
  },
  {
    name:"Barrio Old School",tickMs:395,length:768,accent:"piano",
    bass:["B2",null,"B2","D3","Fs2",null,"A2","Fs2","G2",null,"G2","B2","A2",null,"Fs2","A2"],
    chords:[["B2","D3","Fs3"],["A2","Cs3","E3"],["G2","B2","D3"],["Fs2","A2","Cs3"]],
    melody:["Fs4",null,"B4","D5",null,"E5","D5","B4","A4",null,"Cs5","E5",null,"D5","Cs5",null,"B4","D5","Fs5",null,"E5","D5",null,"B4","A4",null,"B4","D5","Cs5",null,"A4",null],
    counter:["B3",null,"D4",null,"Fs4",null,"D4",null,"A3",null,"Cs4",null,"E4",null,"Cs4",null],
    groove:{kick:[0,7,8],snare:[4,12],rim:[10,15],hat:[2,5,6,9,11,14],bass:[0,3,7,8,11,15],skank:[5,13],ghost:[2,10,14],melody:[1,4,7,9,12,15],counter:[6,10,14],padEvery:64,arp:31}
  },
  {
    name:"Isla de Vinilo",tickMs:445,length:688,accent:"pan",
    bass:["C2",null,"Eb2",null,"G2",null,"Bb2",null,"Ab2",null,"C3",null,"Bb2",null,"G2",null],
    chords:[["C3","Eb3","G3"],["Bb2","D3","F3"],["Ab2","C3","Eb3"],["G2","Bb2","D3"]],
    melody:["G4",null,"C5",null,"Eb5","G5",null,"Bb5","Ab5",null,"G5","Eb5",null,"C5",null,null,"Bb4",null,"D5","F5",null,"G5",null,"F5","Eb5",null,"C5",null,"Bb4",null,"G4",null],
    counter:["C4",null,null,"Eb4",null,"G4",null,null,"Ab4",null,null,"C5",null,"Bb4",null,null],
    groove:{kick:[0,8,11],snare:[4,12],hat:[2,6,9,14],bass:[0,2,4,8,11,12,14],skank:[3,7,13],ghost:[5,15],melody:[2,5,8,10,13],counter:[7,15],padEvery:32,arp:30}
  }
];
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function resolveFreq(value){return typeof value==="number"?value:(NOTE_FREQ[value]||PENTA[0]);}
function softWave(type="sine"){
  // Evitamos ondas duras que en móviles pueden sonar a altavoz roto.
  if(type==="square"||type==="sawtooth") return "triangle";
  return type||"sine";
}
function playTone(freq,type="sine",dur=0.12,vol=0.15,delay=0){
  if(globalMuted)return;
  try{
    const ctx=getCtx(),osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
    osc.connect(filter);filter.connect(g);g.connect(ctx.destination);
    osc.type=softWave(type);
    filter.type="lowpass";
    filter.frequency.setValueAtTime(type==="bass"?520:1650,ctx.currentTime+delay);
    filter.Q.setValueAtTime(0.55,ctx.currentTime+delay);
    const start=ctx.currentTime+delay;
    const cleanVol=Math.min(vol*.55,0.045);
    osc.frequency.setValueAtTime(resolveFreq(freq),start);
    g.gain.setValueAtTime(0,start);
    g.gain.linearRampToValueAtTime(cleanVol,start+0.045);
    g.gain.setValueAtTime(cleanVol*.72,start+Math.max(0.06,dur*.55));
    g.gain.exponentialRampToValueAtTime(0.001,start+dur+0.18);
    osc.start(start);osc.stop(start+dur+0.24);
  }catch(e){}
}
function playNoise(dur=0.05,vol=0.02,delay=0,type="highpass",freq=1800){
  if(globalMuted)return;
  try{
    const ctx=getCtx();
    const buffer=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*dur)),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length)*0.35;
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
    src.buffer=buffer;filter.type="lowpass";filter.frequency.value=Math.min(freq,1400);filter.Q.value=.42;
    src.connect(filter);filter.connect(g);g.connect(ctx.destination);
    g.gain.setValueAtTime(0,ctx.currentTime+delay);
    g.gain.linearRampToValueAtTime(Math.min(vol*.35,.006),ctx.currentTime+delay+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur+0.08);
    src.start(ctx.currentTime+delay);src.stop(ctx.currentTime+delay+dur+0.12);
  }catch(e){}
}
function playLofiPerc(kind="hat",delay=0){
  // Percusión muy suave: más brush/jazz que golpe seco.
  if(kind==="kick"){
    playTone("C2","sine",.22,.030,delay);
    return;
  }
  if(kind==="rim"){
    playTone("G4","triangle",.045,.010,delay);
    return;
  }
  if(kind==="snare"){
    playNoise(.09,.010,delay,"lowpass",1050);
    playTone("D3","sine",.055,.006,delay+.01);
    return;
  }
  playNoise(.045,.006,delay,"lowpass",1250);
}
function playInstrument(note,kind="piano",dur=0.35,vol=0.04,delay=0){
  if(!note||globalMuted)return;
  const f=resolveFreq(note);
  if(kind==="bass"){
    playTone(f,"sine",dur*.95,vol*.58,delay);
    playTone(f/2,"sine",dur*1.25,vol*.20,delay+.01);
    return;
  }
  if(kind==="piano"){
    playTone(f,"triangle",dur*1.05,vol*.62,delay);
    playTone(f*2,"sine",dur*.75,vol*.08,delay+.025);
    return;
  }
  if(kind==="pan"){
    playTone(f,"sine",dur*1.15,vol*.50,delay);
    playTone(f*1.003,"sine",dur*1.05,vol*.12,delay+.02);
    return;
  }
  if(kind==="violin"){
    playTone(f,"triangle",dur*1.2,vol*.38,delay);
    playTone(f*1.002,"sine",dur*1.15,vol*.12,delay+.04);
    return;
  }
  playTone(f,"sine",dur,vol*.5,delay);
}
function playChord(notes,kind="piano",dur=0.22,vol=0.026,delay=0){
  notes.forEach((n,i)=>playInstrument(n,kind,dur*1.18,vol*.60,delay+i*.032));
}
const SFX={
  nav:()=>{playTone(430,"sine",0.08,0.075);playTone(560,"sine",0.09,0.055,0.055);},
  navBack:()=>{playTone(360,"sine",0.08,0.06);playTone(300,"sine",0.09,0.045,0.055);},
  tab:()=>{playTone(520,"sine",0.055,0.06);playTone(660,"sine",0.06,0.045,0.045);},
  click:()=>{playTone(440,"sine",0.045,0.045);},
  action:()=>{playTone(520,"sine",0.08,0.07);playTone(690,"sine",0.08,0.05,0.06);},
  coins:()=>{[659,784,988,1175].forEach((f,i)=>playTone(f,"sine",0.11,0.075,i*0.055));},
  success:()=>{[523,659,784].forEach((f,i)=>playTone(f,"sine",0.12,0.075,i*0.07));},
  error:()=>{playTone(246,"sine",0.16,0.055);playTone(220,"sine",0.15,0.04,0.10);},
};
function beatHit(list,beat){return Array.isArray(list)&&list.includes(beat);}
function trackIntervalMs(){
  const tr=REGGAE_LOFI_TRACKS[currentMusicTrack%REGGAE_LOFI_TRACKS.length];
  return Math.max(300,Math.min(620,Number(tr?.tickMs)||430));
}
function setupMusicInterval(){
  if(musicInterval) clearInterval(musicInterval);
  musicInterval=setInterval(tickLofiTrack,trackIntervalMs());
}
function tickLofiTrack(){
  if(!musicPlaying||globalMuted)return;
  try{
    const ctx=getCtx();if(ctx.state==="suspended")ctx.resume();
    const tr=REGGAE_LOFI_TRACKS[currentMusicTrack%REGGAE_LOFI_TRACKS.length];
    const trackLength=Number(tr.length)||704;
    const step=musicStep%trackLength;
    const beat=step%16;
    const bar=Math.floor(step/16);
    const chord=tr.chords[bar%tr.chords.length];
    const bassNote=tr.bass[step%tr.bass.length];
    const melodyNote=tr.melody[step%tr.melody.length];
    const counterNote=tr.counter[step%tr.counter.length];
    const leadKind=tr.accent==="violin"?"violin":tr.accent==="piano"?"piano":"pan";
    const g=tr.groove||{};
    const swing=(beat%2===1)?0.035:0;

    // Patrones suaves: reggae/jazz lofi sin golpes agresivos.
    if(beatHit(g.kick,beat)) playLofiPerc("kick",swing*.35);
    if(beatHit(g.snare,beat)) playLofiPerc(beat===12?"snare":"rim",0.01+swing*.25);
    if(beatHit(g.rim,beat)) playLofiPerc("rim",0.02+swing);
    if(beatHit(g.hat,beat)) playLofiPerc("hat",0.02+swing);

    if(bassNote && beatHit(g.bass,beat)){
      playInstrument(bassNote,"bass",.56,beat===0?.036:.026,swing*.6);
    }

    if(beatHit(g.skank,beat)){
      playChord(chord,"piano",.28,.016,0.02+swing);
      if((bar+beat)%4===0) playChord(chord,"piano",.18,.006,0.24+swing);
    }
    if(beatHit(g.ghost,beat) && bar%2===0) playChord(chord,"piano",.14,.005,0.04+swing);

    if(melodyNote && beatHit(g.melody,beat)){
      const strong=[0,1,4,8,12,13].includes(beat);
      playInstrument(melodyNote,leadKind,strong?.48:.34,strong?.023:.016,0.045+swing);
      const nextNote=tr.melody[(step+1)%tr.melody.length];
      if(nextNote && (beat===3||beat===11) && bar%2===0) playInstrument(nextNote,leadKind,.28,.009,0.24+swing);
    }

    if(counterNote && beatHit(g.counter,beat)) playInstrument(counterNote,"piano",.34,.009,0.10+swing);

    if(g.padEvery && step%g.padEvery===0){
      chord.forEach((n,i)=>playInstrument(n,"violin",1.45,.005,0.08+i*.055));
    }

    if(Number.isFinite(g.arp) && step%64===g.arp){
      [...chord].reverse().forEach((n,i)=>playInstrument(n,"pan",.22,.007,0.06+i*.08));
    }

    // Pequeños detalles dub/lofi muy suaves para que el bucle de 5 minutos respire.
    if(step%128===16) playNoise(.08,.003,0,"lowpass",900);
    if(step%128===64) playChord(chord,"piano",.32,.0045,0.34);

    musicStep++;
    // Cada tema dura alrededor de 5 minutos o más, según su tickMs y length.
    if(musicStep>=trackLength){
      musicStep=0;
      currentMusicTrack=(currentMusicTrack+1)%REGGAE_LOFI_TRACKS.length;
      if(musicPlaying && musicInterval) setupMusicInterval();
    }
  }catch(e){}
}

function startMusic(){
  if(musicPlaying)return;
  musicPlaying=true;
  if(!musicInterval){musicStep=0;setupMusicInterval();}
  tickLofiTrack();
}
function stopMusic(){musicPlaying=false;if(musicInterval){clearInterval(musicInterval);musicInterval=null;}}
function nextMusicTrack(){
  currentMusicTrack=(currentMusicTrack+1)%REGGAE_LOFI_TRACKS.length;
  musicStep=0;
  if(musicPlaying){setupMusicInterval();tickLofiTrack();}
}

let gameMusicInterval=null, resumeMainAfterGame=false;
const GAME_MUSIC={
  sopa:[392,440,494,587],
  memoria:[330,392,440,494],
  trivia:[349,392,440,523],
  runner:[330,392,440,523],
  jump:[392,494,587,659],
  stitch:[349,440,523,659],
  gacha:[196,247,294,330,392,494],
};
function startGameMusic(gameId){
  if(globalMuted)return;
  stopGameMusic(false);
  resumeMainAfterGame=musicPlaying;
  stopMusic();
  const notes=GAME_MUSIC[gameId]||GAME_MUSIC.sopa;
  let i=0;
  gameMusicInterval=setInterval(()=>{
    if(globalMuted){stopGameMusic(false);return;}
    playTone(notes[i%notes.length],"sine",0.24,0.035,0);
    playTone(notes[(i+2)%notes.length],"sine",0.32,0.018,0.11);
    i++;
  },720);
}
function stopGameMusic(restoreMain=true){
  if(gameMusicInterval){clearInterval(gameMusicInterval);gameMusicInterval=null;}
  if(restoreMain && resumeMainAfterGame && !globalMuted && !musicPlaying){
    resumeMainAfterGame=false;
    startMusic();
  }else if(!restoreMain){
    resumeMainAfterGame=false;
  }
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Rubik+Wet+Paint&family=Bangers&display=swap');
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#8A5A2E;border-radius:4px}
body{margin:0;background-color:#160B07;background-image:repeating-linear-gradient(0deg,rgba(232,211,162,.035) 0 1px,transparent 1px 6px),linear-gradient(160deg,#120806 0%,#21140C 48%,#2E1C10 100%)}
input,select,button,textarea{font-family:'Crimson Text',serif}
@keyframes popIn{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes floatUp{0%{transform:translateY(110vh) rotate(0deg);opacity:0}10%{opacity:.3}90%{opacity:.15}100%{transform:translateY(-10vh) rotate(360deg);opacity:0}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes ptsFloat{0%{opacity:0;transform:translateY(0) scale(0.7)}20%{opacity:1;transform:translateY(-10px) scale(1.1)}80%{opacity:1;transform:translateY(-40px)}100%{opacity:0;transform:translateY(-60px) scale(0.9)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes logoPulse{0%,100%{transform:translateY(0) scale(1) rotateX(0deg)}50%{transform:translateY(-7px) scale(1.05) rotateX(6deg)}}
@keyframes bladeGlint{0%,100%{opacity:.35;transform:translateX(-20px) rotate(-18deg)}50%{opacity:.9;transform:translateX(20px) rotate(-18deg)}}
@keyframes cardLift{0%{transform:translateY(8px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes softPop3d{0%{transform:scale(.96) rotateX(8deg);opacity:.75}100%{transform:scale(1) rotateX(0);opacity:1}}
@keyframes wiggle3d{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}
@keyframes shineLine{0%{left:-135%;opacity:0}28%{opacity:.42}55%{opacity:.20}100%{left:140%;opacity:0}}
@keyframes hookMove{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(10px,-8px) rotate(18deg)}}
@keyframes dreadSwing{0%,100%{transform:rotate(0deg)}50%{transform:rotate(5deg)}}
@keyframes dreadSwing2{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-6deg)}}
@keyframes eyeBlink{0%,46%,100%{transform:scaleY(1)}48%,52%{transform:scaleY(.12)}}
@keyframes mascotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bubblePop{0%{transform:scale(.9) translateY(8px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes helperBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes avatarIdlePro{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-2px) rotate(.4deg)}}
@keyframes avatarBreathPro{0%,100%{transform:scale(1)}50%{transform:scale(1.018)}}
@keyframes avatarShinePro{0%{transform:translateX(-120%) skewX(-18deg);opacity:0}35%{opacity:.55}100%{transform:translateX(140%) skewX(-18deg);opacity:0}}
@keyframes rewardPulsePro{0%,100%{box-shadow:0 0 0 rgba(212,175,55,0)}50%{box-shadow:0 0 28px rgba(212,175,55,.42)}}


@keyframes winkPulse{0%,78%,100%{transform:scaleY(1)}84%{transform:scaleY(.72)}}
@keyframes hookShoulderMove{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(8px) rotate(3deg)}}

.bp:active{transform:scale(0.94)!important}
.ch:hover{transform:translateY(-2px) scale(1.005);box-shadow:0 10px 22px rgba(18,8,4,0.26)!important}
.app-shell{isolation:isolate;transition:background .35s ease, box-shadow .35s ease}
.app-shell:before{content:"";position:absolute;inset:54px 0 82px;pointer-events:none;z-index:0;background:radial-gradient(circle at 18% 14%,var(--pageGlowA,rgba(185,154,69,.14)),transparent 28%),radial-gradient(circle at 86% 8%,var(--pageGlowB,rgba(79,96,45,.10)),transparent 26%),linear-gradient(180deg,rgba(232,211,162,.055),transparent 34%);opacity:.95}
.app-shell:after{content:var(--pageMark,"✂");position:fixed;right:calc(50% - 214px);top:86px;z-index:0;pointer-events:none;font-family:'Pirata One',cursive;font-size:7rem;line-height:1;color:var(--pageMarkColor,rgba(216,190,135,.045));transform:rotate(-12deg);text-shadow:0 8px 20px rgba(0,0,0,.14)}
.app-shell>*{position:relative;z-index:1}
.studio-panel{position:relative;overflow:hidden}
.studio-panel>*{position:relative;z-index:2}
.studio-panel:after{content:"";position:absolute;top:0;bottom:0;width:96px;left:-135%;z-index:1;pointer-events:none;background:linear-gradient(90deg,transparent,var(--shineA,rgba(232,211,162,.13)),var(--shineB,rgba(255,255,255,.08)),transparent);transform:skewX(-18deg);animation:shineLine var(--shineSpeed,7.2s) ease-in-out infinite}
.studio-panel:nth-of-type(2n):after{animation-delay:1.35s}.studio-panel:nth-of-type(3n):after{animation-delay:2.4s}
.news-reel{scroll-snap-type:y mandatory;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.news-reel::-webkit-scrollbar{display:none}
.news-short{scroll-snap-align:start;scroll-snap-stop:always}
.news-short-title{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.news-short-summary{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.icon3d{filter:drop-shadow(0 4px 5px rgba(0,0,0,.24));text-shadow:0 2px 5px rgba(0,0,0,.22);animation:wiggle3d 3.2s ease-in-out infinite}
@keyframes pageEnterPro{0%{opacity:0;transform:translateY(18px) scale(.985);filter:blur(4px)}58%{opacity:1;filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes pageGlowSweep{0%{transform:translateX(-120%) skewX(-18deg);opacity:0}35%{opacity:.38}100%{transform:translateX(140%) skewX(-18deg);opacity:0}}
@keyframes navBouncePro{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.08)}}
@keyframes rastaSpeechIn{0%{opacity:0;transform:translateY(10px) scale(.92)}100%{opacity:1;transform:translateY(0) scale(1)}}

@keyframes proCardBreathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.landing-nav-card:hover,.studio-panel:hover{transform:translateY(-3px) scale(1.015);filter:brightness(1.06)}
@supports (height:100dvh){.app-shell{min-height:100dvh!important}}

@keyframes signalPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
@keyframes chipFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(.7deg)}}
@keyframes bgDriftPro{0%{transform:translate3d(0,0,0) rotate(0deg)}50%{transform:translate3d(12px,-10px,0) rotate(2deg)}100%{transform:translate3d(0,0,0) rotate(0deg)}}
.page-content-pro{animation:pageEnterPro .42s cubic-bezier(.19,1,.22,1);transform-origin:center top}
.page-content-pro:before{content:"";position:absolute;left:-80px;right:-80px;top:-16px;height:90px;pointer-events:none;background:linear-gradient(90deg,transparent,var(--pageAccent,#D4AF37),transparent);opacity:.10;filter:blur(18px);animation:bgDriftPro 9s ease-in-out infinite}
.motion-strip{height:4px;border-radius:999;position:relative;overflow:hidden}
.motion-strip:after{content:"";position:absolute;top:0;bottom:0;width:90px;background:linear-gradient(90deg,transparent,rgba(255,244,214,.95),transparent);animation:pageGlowSweep 2.8s ease-in-out infinite}
.landing-nav-card{position:relative;overflow:hidden;transition:transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease, background .22s ease!important}
.landing-nav-card:before{content:"";position:absolute;inset:-2px;background:radial-gradient(circle at 50% -20%,rgba(255,214,107,.34),transparent 42%);opacity:0;transition:opacity .22s ease;pointer-events:none}
.landing-nav-card:hover,.landing-nav-card:focus-visible{transform:translateY(-5px) scale(1.035);box-shadow:0 16px 30px rgba(0,0,0,.32),0 0 24px rgba(212,175,55,.22)!important;background:rgba(255,244,214,.14)!important}
.landing-nav-card:hover:before,.landing-nav-card:focus-visible:before{opacity:1}
.landing-feature-pro{transition:transform .24s cubic-bezier(.34,1.56,.64,1), box-shadow .24s ease, filter .24s ease}
.landing-feature-pro:hover{transform:translateY(-7px) rotate(-.4deg);filter:saturate(1.12);box-shadow:0 18px 34px rgba(0,0,0,.34), inset 0 -2px 0 rgba(212,175,55,.55)!important}
.rasta-speech-bubble{animation:rastaSpeechIn .35s ease, chipFloat 4s ease-in-out infinite;transition:transform .22s ease, box-shadow .22s ease}
.rasta-speech-bubble:hover{transform:translateY(-3px) scale(1.015);box-shadow:0 16px 30px rgba(0,0,0,.32)!important}
.nav-tab-pro{position:relative;transition:transform .20s cubic-bezier(.34,1.56,.64,1), background .2s ease, filter .2s ease}
.nav-tab-pro:hover,.nav-tab-pro:focus-visible{transform:translateY(-6px);filter:saturate(1.22)}
.nav-tab-pro:hover .nav-icon-pro{animation:navBouncePro .55s ease}
.nav-tab-pro:after{content:"";position:absolute;left:50%;bottom:-1px;width:4px;height:4px;border-radius:50%;background:#F5E6C8;opacity:0;transform:translateX(-50%);transition:opacity .2s ease, width .2s ease}
.nav-tab-pro:hover:after{opacity:.85;width:18px}
.header-action-pro{transition:transform .2s ease, background .2s ease, box-shadow .2s ease}
.header-action-pro:hover{transform:translateY(-2px) scale(1.03);background:rgba(255,255,255,.26)!important;box-shadow:0 8px 18px rgba(0,0,0,.18)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}

`;

function Btn({children,onClick,col="green",full=false,small=false,disabled=false,style:sx={}}){
  const C={green:{bg:T.gradClient,sh:"rgba(64,145,108,0.35)"},dark:{bg:T.gradAdmin,sh:"rgba(27,67,50,0.35)"},pink:{bg:T.gradPink,sh:"rgba(233,30,140,0.3)"},gold:{bg:T.gradGold,sh:"rgba(255,183,3,0.35)"},red:{bg:"linear-gradient(135deg,#E53935,#EF5350)",sh:"rgba(229,57,53,0.3)"},ghost:{bg:"transparent",sh:"none"}};
  const c=C[col]||C.green;
  return <button onClick={disabled?undefined:(e)=>{col==="ghost"?SFX.click():SFX.action();onClick?.(e);}} className="bp" style={{background:col==="ghost"?"rgba(255,244,214,.72)":c.bg,color:col==="ghost"?T.g700:T.white,border:col==="ghost"?`2px solid ${T.g300}`:"1px solid rgba(255,255,255,.22)",borderRadius:16,padding:small?"8px 14px":"12px 20px",fontWeight:900,fontSize:small?"0.78rem":"0.9rem",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,width:full?"100%":"auto",boxShadow:col==="ghost"?"0 6px 16px rgba(20,8,4,.12)":`0 8px 22px ${c.sh}`,transition:"all 0.18s ease",letterSpacing:".2px",...sx}}>{children}</button>;
}
function Card({children,style:sx={},onClick,hover=false}){
  return <div onClick={onClick?(e)=>{SFX.click();onClick(e);}:undefined} className={`${hover?"ch":""} studio-panel`} style={{background:T.panel,borderRadius:20,padding:"16px",boxShadow:"0 8px 18px rgba(18,8,4,0.24)",border:`2px solid ${T.g300}`,transition:"all 0.22s ease",cursor:onClick?"pointer":"default",animation:"cardLift .35s ease",...sx}}>{children}</div>;
}
function Input({label,value,onChange,type="text",placeholder="",style:sx={}}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)",...sx}} onFocus={e=>e.target.style.border=`1.5px solid ${T.g500}`} onBlur={e=>e.target.style.border=`1.5px solid ${T.g200}`}/></div>;
}
function Select({label,value,onChange,options=[]}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Badge({children,col="green"}){
  const C={green:{bg:T.g150,c:T.g700},pink:{bg:"#FCE4EC",c:T.pink},gold:{bg:"#FFF8E1",c:"#E65100"},red:{bg:"#FFEBEE",c:T.red},blue:{bg:"#E3F2FD",c:T.blue}};
  const cc=C[col]||C.green;
  return <span style={{background:cc.bg,color:cc.c,borderRadius:50,padding:"3px 10px",fontSize:"0.72rem",fontWeight:800}}>{children}</span>;
}
function Modal({show,onClose,title,children}){
  if(!show)return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,0.62)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:24}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:"24px 24px 0 0",padding:"18px 16px calc(112px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.28s ease",maxHeight:"calc(100dvh - 24px)",overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",boxShadow:"0 -18px 42px rgba(0,0,0,.28)"}}>
      <div style={{position:"sticky",top:-18,zIndex:5,display:"flex",justifyContent:"space-between",alignItems:"center",margin:"-18px -16px 16px",padding:"14px 16px 12px",background:"linear-gradient(180deg,#FFF8E6,#FFF4D6)",borderBottom:`1px solid ${T.g200}`,boxShadow:"0 8px 18px rgba(20,8,4,.08)"}}>
        <div style={{fontWeight:950,fontSize:"1.08rem",color:T.text}}>{title}</div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:"1rem",color:T.g700,fontWeight:950}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
function Spinner(){return <div style={{width:28,height:28,border:`3px solid ${T.g200}`,borderTop:`3px solid ${T.g600}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"20px auto"}}/>;}
function EmptyState({icon,title,sub}){return <div style={{textAlign:"center",padding:"40px 20px",color:T.textSub}}><div style={{fontSize:"2.8rem",marginBottom:10}}>{icon}</div><div style={{fontWeight:800,fontSize:"1rem",color:T.g700,marginBottom:6}}>{title}</div><div style={{fontSize:"0.83rem"}}>{sub}</div></div>;}
function PublicProfileModal({profile,onClose}){
  if(!profile)return null;
  const hidden=isPrivateProfile(profile);
  const cfg=normalizeAvatarConfig(profile.avatar_config||profile.avatarConfig,profile.avatar);
  const pts=Number(profile.puntos||0);
  const nivel=pts>=1000?"VIP":pts>=500?"Gold":pts>=200?"Silver":"Bronze";
  if(hidden){
    return <Modal show={!!profile} onClose={onClose} title="Perfil privado">
      <div style={{textAlign:"center",padding:"8px 0 4px"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><IncognitoAvatar size={104}/></div>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",color:T.g800}}>xxxxxx</div>
        <div style={{display:"inline-flex",marginTop:8}}><Badge col="blue">Modo incógnito</Badge></div>
        <Card style={{marginTop:14,textAlign:"left",background:"linear-gradient(180deg,#E6CF9B,#D8BE87)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:6}}>🕶️ Perfil oculto</div>
          <div style={{fontSize:".88rem",fontWeight:800,color:T.textSub,lineHeight:1.45}}>Este usuario ha elegido no mostrar su nombre, avatar ni datos públicos. En rankings y comentarios aparecerá como xxxxxx.</div>
        </Card>
      </div>
    </Modal>;
  }
  return <Modal show={!!profile} onClose={onClose} title="Perfil público">
    <div style={{textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Av av={profile.avatar} config={cfg} size={96}/></div>
      <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.55rem",color:T.g800}}>{profile.nombre||"Cliente Rasta"}</div>
      <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:10}}>
        <Badge col="gold">{nivel}</Badge><Badge col="green">{pts} pts</Badge>
      </div>
      <Card style={{marginTop:14,textAlign:"left",background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
        <div style={{fontWeight:900,color:T.g800,marginBottom:8}}>🎭 Estilo</div>
        <div style={{fontSize:".86rem",fontWeight:800,color:T.textSub}}>{avatarStyleName(cfg)}</div>
      </Card>
      <Card style={{marginTop:10,textAlign:"left",background:"linear-gradient(180deg,#F6E5BE,#E6C27A)"}}>
        <div style={{fontWeight:900,color:T.g800,marginBottom:8}}>🏆 Resumen público</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
          <div><div style={{fontSize:"1.4rem"}}>💎</div><b>{pts}</b><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>Puntos</div></div>
          <div><div style={{fontSize:"1.4rem"}}>🔥</div><b>{profile.visitas||0}</b><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>Visitas</div></div>
          <div><div style={{fontSize:"1.4rem"}}>🎮</div><b>{profile.records||0}</b><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>Récords</div></div>
        </div>
      </Card>
    </div>
  </Modal>;
}

function SectionHeader({icon,title,sub,action}){return <div style={{marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.3rem",color:T.g800}}>{icon} {title}</div>{sub&&<div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{sub}</div>}</div>{action}</div>;}
function StatCard({icon,label,value,col="green"}){
  const C={green:{bg:T.g150,ac:T.g600},gold:{bg:"#FFF8E1",ac:T.orange},pink:{bg:"#FCE4EC",ac:T.pink},blue:{bg:"#E3F2FD",ac:T.blue}};
  const c=C[col]||C.green;
  return <Card style={{background:c.bg,border:"none",padding:"14px 16px"}} hover><div style={{fontSize:"1.5rem",marginBottom:4}}>{icon}</div><div style={{fontSize:"0.72rem",fontWeight:700,color:T.textSub,marginBottom:2}}>{label}</div><div style={{fontWeight:900,fontSize:"1.4rem",color:c.ac}}>{value}</div></Card>;
}
const AVATARS=["🧑","👩","👨","👱","👩‍🦱","👨‍🦱","🧔","👩‍🦰","👨‍🦰","👩‍🦳","👨‍🦳","🧑🏾‍🎤","👩🏽‍🎤","👨🏽‍🎤","👩🏽‍🦱","👨🏽‍🦱"];
const AVATAR_STYLES=[
  {emoji:"🧑🏽‍🎤",name:"Rasta Neo",tag:"rastas marcadas",bg:"linear-gradient(145deg,#3A1E10,#D4AF37)"},
  {emoji:"👩🏽‍🎤",name:"Punk Queen",tag:"undercut rebelde",bg:"linear-gradient(145deg,#5C0F0F,#F06A3B)"},
  {emoji:"🧔🏽‍♂️",name:"Barber Boss",tag:"barba pro",bg:"linear-gradient(145deg,#130906,#8B4513)"},
  {emoji:"👨🏽‍🦱",name:"Afro Pop",tag:"volumen 3D",bg:"linear-gradient(145deg,#1A3A5C,#E1A85D)"},
  {emoji:"👩🏽‍🦱",name:"Curl Star",tag:"rizos grandes",bg:"linear-gradient(145deg,#6E3518,#FFF1A8)"},
  {emoji:"👩🏼‍🎨",name:"Color Splash",tag:"mechas fantasía",bg:"linear-gradient(145deg,#C0392B,#D4AF37)"},
  {emoji:"🧑🏾‍🦱",name:"Dread Master",tag:"rastas largas",bg:"linear-gradient(145deg,#24110A,#9A4F22)"},
  {emoji:"👱🏽‍♀️",name:"Blonde Blade",tag:"bob luminoso",bg:"linear-gradient(145deg,#D4AF37,#FFF4D6)"},
  {emoji:"🧑🏻‍🎤",name:"Cyber Punk",tag:"neón urbano",bg:"linear-gradient(145deg,#150B07,#C0392B)"},
  {emoji:"👩🏾‍🦳",name:"Silver Flow",tag:"plata premium",bg:"linear-gradient(145deg,#6E3518,#EDE1C8)"},
  {emoji:"🧑🏽",name:"Fresh Cut",tag:"degradado limpio",bg:"linear-gradient(145deg,#3A1E10,#C97934)"},
  {emoji:"👨🏾‍🎤",name:"Rock Fade",tag:"crestón punk",bg:"linear-gradient(145deg,#8B0000,#2C1810)"},
];

const MALE_HAIR=["buzzFade","texturedCrop","sharpFade","dreadsLong","dreadsBun","dreadsTop","afro","mohawk","undercut"];
const FEMALE_HAIR=["longWaves","braidsLong","curlyBob","highPonytail","bob","pixie","afroPuff","dreadsLong","dreadsBun","undercut"];
const BEARD_VALUES=["stubble","moustache","goatee","shortBeard","beard","full"];
const BASIC_ACCESSORIES=["none","earring","hoopGold","glasses","bandana","cap","piercing","flowers","headphones"];

const AVATAR_OPTIONS={
  gender:["male","female"],
  skin:["#F7C79C","#E9A578","#C98258","#9B5A38","#6E3B24","#4B2719"],
  hairColor:["#14100C","#3B2414","#6A3B1F","#B86A2E","#D4AF37","#8B0000","#145C8A","#663399","#EDE1C8","#E66A9A","#21A35B"],
  eyeColor:["#1A120C","#5B341A","#1A3A5C","#2F6B42","#7B3FA1","#D4AF37"],
  face:["oval","round","sharp","square","heart","long"],
  hair:[...new Set([...MALE_HAIR,...FEMALE_HAIR])],
  brows:["soft","strong","angry","thin","arched"],
  eyes:["anime","sleepy","sharp","round","smile","glam"],
  facial:["none",...BEARD_VALUES],
  accessory:["none","earring","hoopGold","glasses","glassesGold","bandana","bandanaGreen","cap","capBlack","capGold","piercing","flowers","headphones","crown"],
  bg:["gold","dark","red","blue","paper","studio","street","royal"],
  frame:["none","bronze","gold","neon","legend"],
  aura:["none","warm","flame","ocean","vip"]
};

const DEFAULT_AVATAR_CONFIG={version:"fase12",gender:"male",skin:2,hair:"sharpFade",hairColor:0,face:"square",eyes:"sharp",eyeColor:0,brows:"strong",facial:"shortBeard",accessory:"none",bg:"gold",frame:"none",aura:"none"};
const DEFAULT_MALE_AVATAR={version:"fase12",gender:"male",skin:2,hair:"sharpFade",hairColor:0,face:"square",eyes:"sharp",eyeColor:0,brows:"strong",facial:"shortBeard",accessory:"none",bg:"street",frame:"none",aura:"none"};
const DEFAULT_FEMALE_AVATAR={version:"fase12",gender:"female",skin:1,hair:"longWaves",hairColor:9,face:"heart",eyes:"glam",eyeColor:2,brows:"arched",facial:"none",accessory:"hoopGold",bg:"paper",frame:"none",aura:"none"};
const AVATAR_PRESETS=[
  {gender:"male",skin:3,hair:"sharpFade",hairColor:0,face:"square",eyes:"sharp",eyeColor:1,brows:"strong",facial:"shortBeard",accessory:"none",bg:"street"},
  {gender:"female",skin:1,hair:"longWaves",hairColor:9,face:"heart",eyes:"glam",eyeColor:2,brows:"arched",facial:"none",accessory:"hoopGold",bg:"paper"},
  {gender:"male",skin:2,hair:"dreadsLong",hairColor:1,face:"oval",eyes:"anime",eyeColor:0,brows:"strong",facial:"goatee",accessory:"earring",bg:"gold"},
  {gender:"female",skin:2,hair:"braidsLong",hairColor:2,face:"oval",eyes:"round",eyeColor:3,brows:"soft",facial:"none",accessory:"flowers",bg:"red"},
  {gender:"male",skin:4,hair:"afro",hairColor:0,face:"long",eyes:"sleepy",eyeColor:0,brows:"soft",facial:"full",accessory:"glasses",bg:"blue"},
  {gender:"female",skin:3,hair:"afroPuff",hairColor:7,face:"round",eyes:"smile",eyeColor:5,brows:"strong",facial:"none",accessory:"piercing",bg:"royal"},
  {gender:"male",skin:1,hair:"texturedCrop",hairColor:3,face:"sharp",eyes:"glam",eyeColor:4,brows:"thin",facial:"stubble",accessory:"cap",bg:"dark"},
  {gender:"female",skin:0,hair:"curlyBob",hairColor:4,face:"heart",eyes:"anime",eyeColor:4,brows:"arched",facial:"none",accessory:"glasses",bg:"studio"},
  {gender:"male",skin:5,hair:"dreadsBun",hairColor:2,face:"square",eyes:"round",eyeColor:2,brows:"angry",facial:"beard",accessory:"bandana",bg:"studio"},
  {gender:"female",skin:4,hair:"highPonytail",hairColor:8,face:"long",eyes:"sharp",eyeColor:1,brows:"strong",facial:"none",accessory:"headphones",bg:"blue"},
  {gender:"male",skin:2,hair:"mohawk",hairColor:5,face:"round",eyes:"sharp",eyeColor:3,brows:"angry",facial:"moustache",accessory:"piercing",bg:"red"},
  {gender:"female",skin:2,hair:"bob",hairColor:6,face:"square",eyes:"sleepy",eyeColor:2,brows:"thin",facial:"none",accessory:"earring",bg:"gold"},
  {gender:"male",skin:1,hair:"buzzFade",hairColor:0,face:"heart",eyes:"anime",eyeColor:5,brows:"arched",facial:"none",accessory:"capBlack",bg:"royal"},
  {gender:"female",skin:1,hair:"pixie",hairColor:10,face:"sharp",eyes:"glam",eyeColor:3,brows:"angry",facial:"none",accessory:"capGold",bg:"street"},
  {gender:"male",skin:3,hair:"dreadsTop",hairColor:4,face:"oval",eyes:"round",eyeColor:4,brows:"strong",facial:"shortBeard",accessory:"glassesGold",bg:"dark"},
  {gender:"female",skin:5,hair:"undercut",hairColor:5,face:"oval",eyes:"sharp",eyeColor:0,brows:"strong",facial:"none",accessory:"bandanaGreen",bg:"red"},
];
const AVATAR_LABELS={
  gender:"Sexo",male:"Masculino",female:"Femenino",skin:"Piel",hair:"Peinado",hairColor:"Color pelo",face:"Cara",eyes:"Ojos",eyeColor:"Color ojos",brows:"Cejas",facial:"Barba/bigote",accessory:"Complemento",bg:"Fondo",
  oval:"Ovalada",square:"Cuadrada",heart:"Corazón",long:"Alargada",
  buzzFade:"Rapado fade",texturedCrop:"Crop texturizado",sharpFade:"Degradado limpio",dreadsLong:"Rastas largas",dreadsBun:"Nudo rasta",dreadsTop:"Rastas arriba",afro:"Afro redondo",afroPuff:"Afro puff",braidsLong:"Trenzas largas",curlyBob:"Rizos bob",longWaves:"Melena ondas",highPonytail:"Coleta alta",bob:"Bob liso",pixie:"Pixie corto",mohawk:"Cresta punk",undercut:"Undercut",
  soft:"Suaves",strong:"Marcadas",angry:"Intensas",thin:"Finas",arched:"Arqueadas",anime:"Anime",sleepy:"Relajados",smile:"Sonrientes",glam:"Glam",
  none:"Nada",stubble:"Sombra",moustache:"Bigote",goatee:"Perilla",shortBeard:"Barba corta",beard:"Barba",full:"Barba completa",
  earring:"Pendiente",glasses:"Gafas",bandana:"Bandana",cap:"Gorra",piercing:"Piercing",capBlack:"Gorra negra",capGold:"Gorra dorada",glassesGold:"Gafas doradas",bandanaGreen:"Bandana verde",crown:"Corona barber",hoopGold:"Aros dorados",flowers:"Flores",headphones:"Cascos",
  gold:"Dorado",dark:"Oscuro",red:"Rojo",blue:"Azul",paper:"Papiro",studio:"Estudio",street:"Calle",royal:"VIP",bronze:"Bronce",neon:"Neón",legend:"Leyenda",warm:"Brillo cálido",flame:"Aura fuego",ocean:"Aura mar",vip:"Aura VIP"
};
function avatarLabel(value,kind=null){
  if(kind==="face") return {oval:"Ovalada",round:"Redonda",sharp:"Afilada anime",square:"Cuadrada",heart:"Corazón",long:"Alargada"}[value]||AVATAR_LABELS[value]||value;
  if(kind==="eyes") return {anime:"Anime",sleepy:"Relajados",round:"Redondos",sharp:"Afilados",smile:"Sonrientes",glam:"Glam"}[value]||AVATAR_LABELS[value]||value;
  return AVATAR_LABELS[value]||value;
}
function safeJsonParse(value){
  if(!value) return null;
  if(typeof value==="object") return value;
  try{return JSON.parse(value);}catch{return null;}
}
function normalizeAvatarConfig(value, legacyAvatar=0){
  const parsed=safeJsonParse(value);
  const fallback=AVATAR_PRESETS[(Number(legacyAvatar)||0)%AVATAR_PRESETS.length]||DEFAULT_AVATAR_CONFIG;
  const cfg={...DEFAULT_AVATAR_CONFIG,...fallback,...(parsed||{})};
  const clamp=(n,max)=>Math.max(0,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
  cfg.version="fase12";
  cfg.skin=clamp(cfg.skin,AVATAR_OPTIONS.skin.length-1);
  cfg.hairColor=clamp(cfg.hairColor,AVATAR_OPTIONS.hairColor.length-1);
  cfg.eyeColor=clamp(cfg.eyeColor,AVATAR_OPTIONS.eyeColor.length-1);
  if(!AVATAR_OPTIONS.gender.includes(cfg.gender)) cfg.gender=BEARD_VALUES.includes(cfg.facial)?"male":"female";
  if(!AVATAR_OPTIONS.face.includes(cfg.face)) cfg.face="oval";
  const legacyHair={fade:"sharpFade",punk:"mohawk"};
  cfg.hair=legacyHair[cfg.hair]||cfg.hair;
  if(cfg.gender==="female" && !FEMALE_HAIR.includes(cfg.hair)) cfg.hair="longWaves";
  if(cfg.gender==="male" && !MALE_HAIR.includes(cfg.hair)) cfg.hair="sharpFade";
  if(!AVATAR_OPTIONS.eyes.includes(cfg.eyes)) cfg.eyes=cfg.gender==="female"?"glam":"sharp";
  if(!AVATAR_OPTIONS.brows.includes(cfg.brows)) cfg.brows=cfg.gender==="female"?"arched":"strong";
  if(!AVATAR_OPTIONS.facial.includes(cfg.facial)) cfg.facial="none";
  if(cfg.gender==="female") cfg.facial="none";
  if(!AVATAR_OPTIONS.accessory.includes(cfg.accessory)) cfg.accessory="none";
  if(cfg.gender==="male" && cfg.accessory==="flowers") cfg.accessory="earring";
  if(!AVATAR_OPTIONS.bg.includes(cfg.bg)) cfg.bg="gold";
  if(!AVATAR_OPTIONS.frame.includes(cfg.frame)) cfg.frame="none";
  if(!AVATAR_OPTIONS.aura.includes(cfg.aura)) cfg.aura="none";
  return cfg;
}
function avatarStyleName(cfg){const clean=normalizeAvatarConfig(cfg);return `${AVATAR_LABELS[clean.gender]} · ${AVATAR_LABELS[clean.hair]||"Estilo"} · ${avatarLabel(clean.face,"face")||"Cara"}`;}
function avatarStorageKey(user){return `avatar_config_${String(user?.email||user?.id||"anon").toLowerCase()}`;}
function getLocalAvatarConfig(user, legacyAvatar=0){return normalizeAvatarConfig(localStorage.getItem(avatarStorageKey(user)), legacyAvatar);}
function setLocalAvatarConfig(user, cfg){try{localStorage.setItem(avatarStorageKey(user),JSON.stringify(cfg));}catch{}}
async function getAvatarConfigForProfile(profile){
  if(!profile) return DEFAULT_AVATAR_CONFIG;
  try{
    const local=localStorage.getItem(avatarStorageKey(profile));
    if(local) return normalizeAvatarConfig(local, profile.avatar);
  }catch{}
  try{
    const {data,error}=await supabase.from("avatar_profiles").select("avatar_config").eq("usuario_id",String(profile.id)).maybeSingle();
    if(!error && data?.avatar_config){
      const cfg=normalizeAvatarConfig(data.avatar_config, profile.avatar);
      setLocalAvatarConfig(profile,cfg);
      return cfg;
    }
  }catch{}
  return normalizeAvatarConfig(null, profile.avatar);
}
async function saveAvatarConfigForUser(user,cfg){
  const clean=normalizeAvatarConfig(cfg,user?.avatar);
  setLocalAvatarConfig(user,clean);
  try{await supabase.from("avatar_profiles").upsert({usuario_id:String(user.id),email:user.email,avatar_config:clean,updated_at:new Date().toISOString()},{onConflict:"usuario_id"});}catch{}
  return clean;
}
async function enrichProfilesWithAvatarConfigs(list=[]){
  const arr=Array.isArray(list)?list:[];
  if(!arr.length || !supabase) return arr;
  const ids=arr.map(u=>String(u.id)).filter(Boolean);
  try{
    const {data,error}=await supabase.from("avatar_profiles").select("usuario_id,avatar_config").in("usuario_id",ids);
    if(error) return arr;
    const map=new Map((data||[]).map(r=>[String(r.usuario_id),r.avatar_config]));
    return arr.map(u=>{
      const cfg=map.get(String(u.id));
      return cfg?{...u,avatar_config:normalizeAvatarConfig(cfg,u.avatar),avatarConfig:normalizeAvatarConfig(cfg,u.avatar)}:u;
    });
  }catch(e){return arr;}
}
function randomAvatarConfig(gender=null){
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  const selectedGender=gender&&AVATAR_OPTIONS.gender.includes(gender)?gender:pick(AVATAR_OPTIONS.gender);
  const base=selectedGender==="female"?DEFAULT_FEMALE_AVATAR:DEFAULT_MALE_AVATAR;
  return normalizeAvatarConfig({...base,skin:Math.floor(Math.random()*AVATAR_OPTIONS.skin.length),hair:pick(selectedGender==="female"?FEMALE_HAIR:MALE_HAIR),hairColor:Math.floor(Math.random()*AVATAR_OPTIONS.hairColor.length),face:pick(AVATAR_OPTIONS.face),eyes:pick(AVATAR_OPTIONS.eyes),eyeColor:Math.floor(Math.random()*AVATAR_OPTIONS.eyeColor.length),brows:pick(AVATAR_OPTIONS.brows),facial:selectedGender==="female"?"none":pick(AVATAR_OPTIONS.facial),accessory:pick(BASIC_ACCESSORIES),bg:pick(["gold","dark","red","blue","paper","studio","street"])});
}
function bgGradient(bg){
  const b={gold:"linear-gradient(145deg,#3A1E10,#D4AF37)",dark:"linear-gradient(145deg,#130906,#8B4513)",red:"linear-gradient(145deg,#5C0F0F,#F06A3B)",blue:"linear-gradient(145deg,#1A3A5C,#E1A85D)",paper:"linear-gradient(145deg,#6E3518,#FFF4D6)",studio:"linear-gradient(145deg,#24110A,#9A4F22 58%,#FFF4D6)",street:"linear-gradient(145deg,#120806,#1A3A5C 58%,#C97934)",royal:"linear-gradient(145deg,#150B07,#8B0000 45%,#D4AF37)"};
  return b[bg]||b.gold;
}

const COSMETIC_CATALOG_FALLBACK=[
  {item_key:"cap_black",nombre:"Gorra negra Rasta Cuts",descripcion:"Gorra urbana mejor encajada para el avatar.",categoria:"gorras",slot:"accessory",valor:"capBlack",puntos_precio:120,rareza:"comun",activo:true},
  {item_key:"cap_gold",nombre:"Gorra dorada",descripcion:"Accesorio premium con brillo dorado.",categoria:"gorras",slot:"accessory",valor:"capGold",puntos_precio:260,rareza:"raro",activo:true},
  {item_key:"glasses_gold",nombre:"Gafas doradas",descripcion:"Gafas estilo barber con marco dorado.",categoria:"gafas",slot:"accessory",valor:"glassesGold",puntos_precio:180,rareza:"raro",activo:true},
  {item_key:"bandana_green",nombre:"Bandana verde",descripcion:"Detalle verde para looks rasta más marcados.",categoria:"extras",slot:"accessory",valor:"bandanaGreen",puntos_precio:160,rareza:"comun",activo:true},
  {item_key:"crown_barber",nombre:"Corona barber",descripcion:"Recompensa especial para perfiles con estilo leyenda.",categoria:"extras",slot:"accessory",valor:"crown",puntos_precio:700,rareza:"epico",activo:true},
  {item_key:"frame_bronze",nombre:"Marco bronce",descripcion:"Marco de perfil desbloqueable.",categoria:"marcos",slot:"frame",valor:"bronze",puntos_precio:100,rareza:"comun",activo:true},
  {item_key:"frame_gold",nombre:"Marco dorado",descripcion:"Marco brillante para destacar tu personaje.",categoria:"marcos",slot:"frame",valor:"gold",puntos_precio:350,rareza:"raro",activo:true},
  {item_key:"frame_neon",nombre:"Marco neón",descripcion:"Marco urbano para destacar en la comunidad.",categoria:"marcos",slot:"frame",valor:"neon",puntos_precio:520,rareza:"epico",activo:true},
  {item_key:"aura_warm",nombre:"Brillo cálido",descripcion:"Aura suave alrededor del avatar.",categoria:"auras",slot:"aura",valor:"warm",puntos_precio:220,rareza:"raro",activo:true},
  {item_key:"aura_flame",nombre:"Aura fuego",descripcion:"Efecto intenso para perfiles activos.",categoria:"auras",slot:"aura",valor:"flame",puntos_precio:650,rareza:"epico",activo:true},
  {item_key:"aura_ocean",nombre:"Aura mar",descripcion:"Efecto azul para perfiles raros.",categoria:"auras",slot:"aura",valor:"ocean",puntos_precio:650,rareza:"epico",activo:true},
  {item_key:"aura_vip",nombre:"Aura VIP",descripcion:"Brillo legendario de perfil premium.",categoria:"auras",slot:"aura",valor:"vip",puntos_precio:1100,rareza:"legendario",activo:true},
  {item_key:"bg_studio",nombre:"Fondo estudio",descripcion:"Fondo de barber shop para el avatar.",categoria:"fondos",slot:"bg",valor:"studio",puntos_precio:200,rareza:"comun",activo:true},
  {item_key:"bg_street",nombre:"Fondo calle",descripcion:"Fondo urbano para perfiles de comunidad.",categoria:"fondos",slot:"bg",valor:"street",puntos_precio:280,rareza:"raro",activo:true},
  {item_key:"bg_royal",nombre:"Fondo VIP",descripcion:"Fondo legendario para perfiles premium.",categoria:"fondos",slot:"bg",valor:"royal",puntos_precio:900,rareza:"legendario",activo:true},
];
function rarityLabel(r){return {comun:"Común",raro:"Raro",epico:"Épico",legendario:"Legendario"}[r]||"Especial";}
function rarityColor(r){return {comun:"green",raro:"blue",epico:"pink",legendario:"gold"}[r]||"green";}
function cosmeticPatch(item){return item?.slot?{[item.slot]:item.valor}:{};}
function ownedCosmeticKey(user){return `owned_cosmetics_${String(user?.id||user?.email||"anon")}`;}
function localOwnedCosmetics(user){try{return JSON.parse(localStorage.getItem(ownedCosmeticKey(user))||"[]");}catch{return []}}
function saveLocalOwnedCosmetics(user,keys){try{localStorage.setItem(ownedCosmeticKey(user),JSON.stringify([...new Set(keys)]));}catch{}}
function makeId(value=""){let hash=0;for(const ch of String(value||"")){hash=(hash*31+ch.charCodeAt(0))>>>0;}return hash.toString(16);}
function shadeHex(hex,percent=0){
  const raw=String(hex||"#000").replace("#","");
  if(raw.length!==6)return hex;
  const num=parseInt(raw,16),amt=Math.round(2.55*percent);
  const r=Math.max(0,Math.min(255,(num>>16)+amt));
  const g=Math.max(0,Math.min(255,((num>>8)&255)+amt));
  const b=Math.max(0,Math.min(255,(num&255)+amt));
  return `#${(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
}

function AvatarFigure({config,size=80,animated=false}){
  const cfg=normalizeAvatarConfig(config);
  const female=cfg.gender==="female";
  const skin=AVATAR_OPTIONS.skin[cfg.skin]||"#C98258";
  const hair=AVATAR_OPTIONS.hairColor[cfg.hairColor]||"#14100C";
  const eye=AVATAR_OPTIONS.eyeColor[cfg.eyeColor]||"#1A120C";
  const uid=`av12-${String(size).replace(/\W/g,"")}-${cfg.gender}-${cfg.skin}-${cfg.hair}-${cfg.hairColor}-${cfg.face}-${cfg.eyes}-${cfg.facial}-${cfg.accessory}`;
  const hairHi=shadeHex(hair,42), hairLo=shadeHex(hair,-34), skinHi=shadeHex(skin,20), skinLo=shadeHex(skin,-22);
  const hasCap=["cap","capBlack","capGold"].includes(cfg.accessory);
  const hasBandana=["bandana","bandanaGreen"].includes(cfg.accessory);
  const capColor=cfg.accessory==="capGold"?"#D4AF37":cfg.accessory==="capBlack"?"#101010":"#1D4B78";
  const bandanaColor=cfg.accessory==="bandanaGreen"?"#2F6B42":"#C0392B";
  const auraColor=cfg.aura==="vip"?"rgba(255,241,168,.78)":cfg.aura==="flame"?"rgba(240,106,59,.68)":cfg.aura==="ocean"?"rgba(95,215,255,.58)":"rgba(212,175,55,.46)";
  const faceMale={
    oval:"M64 101 C64 61 78 39 100 39 C122 39 136 61 136 101 C136 137 122 164 100 171 C78 164 64 137 64 101Z",
    round:"M60 103 C60 70 76 49 100 49 C124 49 140 70 140 103 C140 135 124 158 100 163 C76 158 60 135 60 103Z",
    sharp:"M64 99 C64 62 78 38 100 38 C122 38 136 62 136 99 C136 131 122 154 100 178 C78 154 64 131 64 99Z",
    square:"M59 98 C59 61 76 42 100 42 C124 42 141 61 141 98 L134 152 C124 172 76 172 66 152Z",
    heart:"M61 99 C61 60 78 39 100 45 C122 39 139 60 139 99 C139 132 121 157 100 171 C79 157 61 132 61 99Z",
    long:"M68 94 C68 55 81 33 100 33 C119 33 132 55 132 94 C132 136 120 166 100 178 C80 166 68 136 68 94Z"
  };
  const faceFemale={
    oval:"M69 100 C69 61 82 38 100 38 C118 38 131 61 131 100 C131 132 119 157 100 168 C81 157 69 132 69 100Z",
    round:"M64 103 C64 71 79 49 100 49 C121 49 136 71 136 103 C136 132 121 155 100 160 C79 155 64 132 64 103Z",
    sharp:"M68 97 C68 59 82 36 100 36 C118 36 132 59 132 97 C132 128 119 151 100 177 C81 151 68 128 68 97Z",
    square:"M65 99 C65 62 80 43 100 43 C120 43 135 62 135 99 L130 148 C121 165 79 165 70 148Z",
    heart:"M62 99 C62 60 79 36 100 44 C121 36 138 60 138 99 C138 130 119 154 100 174 C81 154 62 130 62 99Z",
    long:"M72 94 C72 54 83 32 100 32 C117 32 128 54 128 94 C128 135 118 165 100 177 C82 165 72 135 72 94Z"
  };
  const facePath=(female?faceFemale:faceMale)[cfg.face]||(female?faceFemale.heart:faceMale.square);
  const bodyPath=female
    ? "M37 218 C47 179 70 160 100 160 C130 160 153 179 163 218 C136 231 64 231 37 218Z"
    : "M31 218 C43 177 69 160 100 160 C131 160 157 177 169 218 C139 233 61 233 31 218Z";
  const neckline=female
    ? "M78 166 C86 178 114 178 122 166 L113 198 C106 207 94 207 87 198Z"
    : "M76 166 C84 178 116 178 124 166 L119 194 C108 203 92 203 81 194Z";
  const browPath=cfg.brows==="angry"?"M70 87 L87 93 M113 93 L130 87":cfg.brows==="thin"?"M70 86 Q80 82 88 85 M112 85 Q120 82 130 86":cfg.brows==="arched"?"M69 87 Q80 77 90 86 M110 86 Q120 77 131 87":cfg.brows==="soft"?"M70 88 Q80 84 89 87 M111 87 Q120 84 130 88":"M69 87 Q80 80 90 86 M110 86 Q120 80 131 87";
  const eyeShape={anime:{rx:female?9.5:8,ry:female?9:7.8,y:104},sleepy:{rx:9,ry:3,y:105},sharp:{rx:9,ry:4.7,y:104},round:{rx:7.2,ry:7.2,y:104},smile:{rx:9,ry:3,y:105},glam:{rx:female?10.5:8.8,ry:female?6.7:5.5,y:104}}[cfg.eyes]||{rx:8,ry:6,y:104};
  const shirtA=female?"#C1446B":"#7A3B1D";
  const shirtB=female?"#661A3A":"#24110A";

  function hairStroke(d,w=10,extra={}){return <path d={d} stroke={hair} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" {...extra}/>;}
  function beads(){return <g fill="#D4AF37"><circle cx="54" cy="177" r="3"/><circle cx="146" cy="177" r="3"/><circle cx="66" cy="188" r="2.5"/><circle cx="134" cy="188" r="2.5"/></g>;}
  function locks(long=true){return <g>{hairStroke("M56 79 C34 104 39 154 54 196",long?13:10)}{hairStroke("M70 71 C52 101 57 153 69 202",long?12:9)}{hairStroke("M130 71 C148 101 143 153 131 202",long?12:9)}{hairStroke("M144 79 C166 104 161 154 146 196",long?13:10)}{long&&beads()}</g>;}
  function backHair(){
    if(hasCap||hasBandana){
      if(["dreadsLong","dreadsBun","dreadsTop","braidsLong"].includes(cfg.hair)) return locks(true);
      if(female && ["longWaves","highPonytail","bob"].includes(cfg.hair)) return <path d="M42 100 C40 62 61 38 100 36 C139 38 160 62 158 100 C155 151 136 194 119 213 C116 171 84 171 81 213 C64 194 45 151 42 100Z" fill={hair} opacity=".94"/>;
      return null;
    }
    switch(cfg.hair){
      case "longWaves":return <g><path d="M35 105 C31 55 58 25 100 24 C142 25 169 55 165 105 C162 154 142 197 123 217 C120 174 80 174 77 217 C58 197 38 154 35 105Z" fill={hair}/><path d="M50 99 C40 136 51 173 70 205 M150 99 C160 136 149 173 130 205" stroke={hairHi} strokeWidth="5" strokeLinecap="round" opacity=".35" fill="none"/></g>;
      case "highPonytail":return <g><path d="M64 63 C56 25 144 25 136 63 C153 77 158 110 145 132 C122 111 78 111 55 132 C42 110 47 77 64 63Z" fill={hair}/><path d="M124 39 C178 34 188 91 139 132 C158 82 143 55 124 39Z" fill={hair}/><path d="M132 53 C157 54 171 76 159 101" stroke={hairHi} strokeWidth="5" strokeLinecap="round" opacity=".35" fill="none"/></g>;
      case "braidsLong":return <g>{locks(true)}<path d="M45 91 C51 50 72 30 100 30 C128 30 149 50 155 91 C128 70 72 70 45 91Z" fill={hair}/><g stroke={hairLo} strokeWidth="4" strokeLinecap="round" opacity=".5"><path d="M56 103 C66 126 65 156 55 189"/><path d="M144 103 C134 126 135 156 145 189"/></g></g>;
      case "curlyBob":return <g fill={hair}>{[[52,82,23],[67,57,22],[100,48,29],[133,57,22],[148,82,23],[55,112,21],[145,112,21],[78,133,17],[122,133,17]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r}/>)}</g>;
      case "bob":return <path d="M42 101 C38 59 61 33 100 32 C139 33 162 59 158 101 C154 144 136 177 116 190 C113 151 87 151 84 190 C64 177 46 144 42 101Z" fill={hair}/>;
      case "pixie":return <path d="M51 94 C52 55 76 34 100 35 C127 36 148 57 151 94 C130 82 114 80 99 88 C84 80 68 82 51 94Z" fill={hair}/>;
      case "afroPuff":return <g fill={hair}><circle cx="57" cy="67" r="32"/><circle cx="143" cy="67" r="32"/><circle cx="100" cy="52" r="31"/></g>;
      case "afro":return <g fill={hair}>{[[52,77,30],[72,50,31],[100,40,36],[128,50,31],[148,77,30],[48,108,26],[152,108,26]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r}/>)}</g>;
      case "dreadsLong":return <g>{locks(true)}<path d="M47 91 C54 51 73 34 100 34 C127 34 146 51 153 91 C130 73 70 73 47 91Z" fill={hair}/></g>;
      case "dreadsBun":return <g>{locks(false)}<ellipse cx="100" cy="31" rx="38" ry="25" fill={hair}/><path d="M51 92 C58 55 76 38 100 38 C124 38 142 55 149 92 C127 76 73 76 51 92Z" fill={hair}/></g>;
      case "dreadsTop":return <g>{locks(false)}<g stroke={hair} strokeWidth="13" strokeLinecap="round" fill="none"><path d="M75 50 C58 20 85 9 96 39"/><path d="M100 38 C109 6 134 18 121 54"/><path d="M122 58 C145 29 162 55 134 74"/></g></g>;
      case "mohawk":return <path d="M51 95 C54 54 75 15 100 3 C125 15 146 54 149 95 C126 76 74 76 51 95Z" fill={hair}/>;
      case "undercut":return <path d={female?"M50 96 C54 55 80 28 109 35 C133 42 148 63 151 95 C124 80 91 82 50 96Z":"M52 95 C57 57 76 39 100 39 C126 39 145 60 149 95 C124 80 91 82 52 95Z"} fill={hair}/>;
      default:return <path d="M52 94 C58 57 76 39 100 39 C124 39 142 57 148 94 C126 80 74 80 52 94Z" fill={hair}/>;
    }
  }
  function hairline(){
    if(hasCap||hasBandana) return <path d={female?"M55 91 C72 78 128 78 145 91 C122 85 78 85 55 91Z":"M58 91 C75 82 125 82 142 91 C123 87 77 87 58 91Z"} fill={hair}/>;
    switch(cfg.hair){
      case "buzzFade":return <path d="M58 91 C64 65 78 51 100 51 C122 51 136 65 142 91 C122 82 78 82 58 91Z" fill={hair}/>;
      case "texturedCrop":return <g><path d="M52 90 C59 57 77 38 100 38 C123 38 141 57 148 90 C126 77 113 87 99 80 C84 89 70 77 52 90Z" fill={hair}/><path d="M71 75 L80 42 L90 79 M97 75 L108 39 L118 81" stroke={hairHi} strokeWidth="5" strokeLinecap="round" opacity=".5" fill="none"/></g>;
      case "sharpFade":return <path d="M53 91 C60 60 78 42 100 42 C122 42 140 60 147 91 C126 81 113 83 100 89 C87 83 74 81 53 91Z" fill={hair}/>;
      case "mohawk":return <path d="M54 91 C61 62 79 51 100 51 C121 51 139 62 146 91 C124 82 76 82 54 91Z" fill={hair}/>;
      case "dreadsLong":return <g><path d="M47 92 C55 54 75 38 100 38 C125 38 145 54 153 92 C129 76 115 84 100 79 C84 87 70 76 47 92Z" fill={hair}/><path d="M69 82 C83 70 117 70 131 82" stroke={hairHi} strokeWidth="4" strokeLinecap="round" opacity=".35" fill="none"/></g>;
      case "dreadsBun":return <path d="M51 92 C59 57 77 43 100 43 C123 43 141 57 149 92 C127 80 73 80 51 92Z" fill={hair}/>;
      case "dreadsTop":return <path d="M51 91 C59 59 78 44 100 44 C122 44 141 59 149 91 C126 80 74 80 51 91Z" fill={hair}/>;
      case "afro":return <path d="M48 89 C57 61 74 48 100 46 C126 48 143 61 152 89 C128 75 72 75 48 89Z" fill={hair}/>;
      case "afroPuff":return <path d="M55 90 C61 64 78 51 100 51 C122 51 139 64 145 90 C125 80 75 80 55 90Z" fill={hair}/>;
      case "braidsLong":return <g><path d="M46 93 C55 55 75 38 100 38 C125 38 145 55 154 93 C130 72 70 72 46 93Z" fill={hair}/><path d="M69 82 C83 66 94 70 100 82 C107 66 123 70 133 84" stroke={hairHi} strokeWidth="4" strokeLinecap="round" opacity=".38" fill="none"/></g>;
      case "curlyBob":return <g fill={hair}>{[[58,91,18],[75,72,20],[100,63,22],[125,72,20],[142,91,18]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r}/>)}</g>;
      case "longWaves":return <g><path d="M43 95 C51 53 73 30 100 30 C127 30 149 53 157 95 C132 72 114 82 100 91 C86 82 68 72 43 95Z" fill={hair}/><path d="M63 87 C79 69 91 72 100 86 C111 67 130 75 142 91" stroke={hairHi} strokeWidth="4" strokeLinecap="round" opacity=".42" fill="none"/></g>;
      case "highPonytail":return <g><path d="M45 93 C55 54 76 32 100 32 C124 32 145 54 155 93 C130 72 70 72 45 93Z" fill={hair}/><path d="M65 75 C84 56 118 56 135 75" stroke={hairHi} strokeWidth="5" strokeLinecap="round" opacity=".35" fill="none"/></g>;
      case "bob":return <path d="M44 93 C52 55 73 36 100 36 C127 36 148 55 156 93 C132 73 68 73 44 93Z" fill={hair}/>;
      case "pixie":return <g><path d="M51 91 C58 59 77 41 100 41 C126 42 144 60 150 91 C128 80 114 82 100 89 C86 80 70 82 51 91Z" fill={hair}/><path d="M63 85 L85 58 M96 87 L119 57" stroke={hairHi} strokeWidth="5" strokeLinecap="round" opacity=".45" fill="none"/></g>;
      case "undercut":return <g><path d={female?"M51 91 C62 57 85 39 111 43 C132 47 146 62 151 91 C122 79 92 80 51 91Z":"M53 91 C60 59 78 43 100 43 C126 43 143 61 148 91 C123 80 91 82 53 91Z"} fill={hair}/><path d="M57 96 C68 92 78 91 88 92" stroke={hairHi} strokeWidth="3.2" strokeLinecap="round" opacity=".48" fill="none"/></g>;
      default:return <path d="M53 92 C61 59 78 43 100 43 C122 43 139 59 147 92 C125 80 75 80 53 92Z" fill={hair}/>;
    }
  }
  function headwear(){
    if(hasBandana) return <g><path d="M48 78 C62 59 138 59 152 78 L147 99 C123 86 77 86 53 99Z" fill={bandanaColor}/><path d="M58 78 C77 68 123 68 142 78" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round"/><path d="M147 80 L176 70 L158 105Z" fill={bandanaColor}/></g>;
    if(hasCap) return <g><path d="M47 82 C51 44 72 24 100 24 C128 24 149 44 153 82 L148 101 C123 88 77 88 52 101Z" fill={capColor}/><path d="M58 78 C75 67 125 67 142 78" stroke="rgba(255,255,255,.34)" strokeWidth="5" strokeLinecap="round"/><path d="M118 83 C150 78 181 88 194 104" stroke={capColor} strokeWidth="14" strokeLinecap="round" fill="none"/><path d="M52 94 C74 84 126 84 148 94" stroke="rgba(0,0,0,.22)" strokeWidth="4" strokeLinecap="round"/></g>;
    if(cfg.accessory==="crown") return <g><path d="M58 80 L69 45 L88 72 L100 38 L112 72 L131 45 L142 80 Z" fill="#D4AF37"/><path d="M60 80 L140 80" stroke="#FFF1A8" strokeWidth="6" strokeLinecap="round"/><circle cx="100" cy="48" r="5" fill="#FFF1A8"/></g>;
    if(cfg.accessory==="flowers") return <g>{[[58,86],[70,70],[129,72],[141,88]].map(([cx,cy],i)=><g key={i}><circle cx={cx} cy={cy} r="5" fill="#E66A9A"/><circle cx={cx-4} cy={cy} r="4" fill="#F6E5BE"/><circle cx={cx+4} cy={cy} r="4" fill="#F6E5BE"/><circle cx={cx} cy={cy-4} r="4" fill="#F6E5BE"/></g>)}</g>;
    return null;
  }
  function eyes(){
    const lash=female||cfg.eyes==="glam";
    if(cfg.eyes==="smile") return <g><path d="M70 104 Q80 112 90 104" stroke="#1A0C06" strokeWidth="4" strokeLinecap="round" fill="none"/><path d="M110 104 Q120 112 130 104" stroke="#1A0C06" strokeWidth="4" strokeLinecap="round" fill="none"/>{lash&&<g stroke="#1A0C06" strokeWidth="2" strokeLinecap="round"><path d="M70 101 L64 96"/><path d="M130 101 L136 96"/></g>}</g>;
    return <g style={animated?{animation:"eyeBlink 5.2s ease-in-out infinite",transformOrigin:"100px 104px"}:null}><ellipse cx="80" cy={eyeShape.y} rx={eyeShape.rx} ry={eyeShape.ry} fill="#fff"/><ellipse cx="120" cy={eyeShape.y} rx={eyeShape.rx} ry={eyeShape.ry} fill="#fff"/><ellipse cx="80" cy={eyeShape.y} rx="4.7" ry="6" fill={eye}/><ellipse cx="120" cy={eyeShape.y} rx="4.7" ry="6" fill={eye}/><circle cx="78" cy={eyeShape.y-2} r="1.7" fill="#fff"/><circle cx="118" cy={eyeShape.y-2} r="1.7" fill="#fff"/>{lash&&<g stroke="#1A0C06" strokeWidth="2" strokeLinecap="round"><path d="M68 99 L61 93"/><path d="M91 99 L97 93"/><path d="M109 99 L103 93"/><path d="M132 99 L139 93"/></g>}</g>;
  }
  function facialHair(){
    if(female) return null;
    if(cfg.facial==="stubble") return <path d="M65 126 C73 151 127 151 135 126 C125 158 75 158 65 126Z" fill={hair} opacity=".25"/>;
    if(cfg.facial==="moustache") return <path d="M77 126 C88 119 96 123 100 129 C104 123 112 119 123 126" stroke={hair} strokeWidth="6" strokeLinecap="round" fill="none"/>;
    if(cfg.facial==="goatee") return <g><path d="M79 126 C89 122 111 122 121 126" stroke={hair} strokeWidth="4.5" strokeLinecap="round" fill="none"/><path d="M95 142 Q100 158 105 142" stroke={hair} strokeWidth="6" strokeLinecap="round" fill="none"/></g>;
    if(cfg.facial==="shortBeard") return <path d="M65 124 C72 154 128 154 135 124 C124 150 76 150 65 124Z" fill={hair} opacity=".75"/>;
    if(cfg.facial==="beard") return <path d="M61 121 C70 165 130 165 139 121 C126 158 74 158 61 121Z" fill={hair} opacity=".92"/>;
    if(cfg.facial==="full") return <path d="M56 112 C62 171 138 171 144 112 C126 162 74 162 56 112Z" fill={hair} opacity=".96"/>;
    return null;
  }
  function mouth(){return female?<g><path d="M84 136 C93 144 107 144 116 136 C107 143 93 143 84 136Z" fill="#B0415B"/><path d="M88 137 C96 140 104 140 112 137" stroke="rgba(255,255,255,.4)" strokeWidth="1.8" strokeLinecap="round"/></g>:<g><path d="M82 137 C93 146 107 146 118 137" stroke="#7F2B1A" strokeWidth="4" strokeLinecap="round" fill="none"/><path d="M88 143 C96 147 106 147 113 143" stroke="rgba(255,255,255,.36)" strokeWidth="2" strokeLinecap="round"/></g>;}
  return <svg viewBox="0 0 200 230" width={size} height={size} style={{display:"block",overflow:"visible",filter:"drop-shadow(0 16px 16px rgba(0,0,0,.34))"}}>
    <defs>
      <linearGradient id={`${uid}-skin`} x1="60" y1="38" x2="137" y2="176"><stop offset="0%" stopColor={skinHi}/><stop offset="58%" stopColor={skin}/><stop offset="100%" stopColor={skinLo}/></linearGradient>
      <linearGradient id={`${uid}-shirt`} x1="37" y1="160" x2="163" y2="230"><stop offset="0%" stopColor={shirtA}/><stop offset="65%" stopColor={shirtB}/><stop offset="100%" stopColor="#070302"/></linearGradient>
      <radialGradient id={`${uid}-soft`} cx="38%" cy="18%" r="78%"><stop offset="0%" stopColor="rgba(255,255,255,.48)"/><stop offset="52%" stopColor="rgba(255,255,255,.08)"/><stop offset="100%" stopColor="rgba(0,0,0,.16)"/></radialGradient>
    </defs>
    <g style={animated?{animation:"avatarIdlePro 3.3s ease-in-out infinite",transformOrigin:"100px 116px"}:null}>
      <ellipse cx="100" cy="214" rx="62" ry="13" fill="rgba(0,0,0,.25)"/>
      <circle cx="100" cy="104" r="88" fill={`url(#${uid}-soft)`}/>
      <circle cx="69" cy="38" r="42" fill="rgba(255,255,255,.10)"/>
      {cfg.aura!=="none"&&<circle cx="100" cy="104" r="90" fill="none" stroke={auraColor} strokeWidth="5" opacity=".78"/>}
      {backHair()}
      <path d={bodyPath} fill={`url(#${uid}-shirt)`}/>
      <path d={neckline} fill={`url(#${uid}-skin)`}/>
      <circle cx="62" cy="109" r={female?7:8} fill={skin}/><circle cx="138" cy="109" r={female?7:8} fill={skin}/>
      <path d={facePath} fill={`url(#${uid}-skin)`}/>
      <path d={female?"M77 143 C88 157 112 157 123 143 C116 164 84 164 77 143Z":"M73 143 C84 161 116 161 127 143 C119 169 81 169 73 143Z"} fill="rgba(80,35,20,.10)"/>
      {hairline()}
      {headwear()}
      <path d={browPath} stroke="#160A05" strokeWidth={cfg.brows==="thin"?2.8:5} strokeLinecap="round" fill="none"/>
      {eyes()}
      <path d="M98 111 C101 121 100 127 94 131" stroke={shadeHex(skin,-35)} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity=".72"/>
      {facialHair()}
      {female&&<g fill="#D96583" opacity=".28"><ellipse cx="69" cy="126" rx="8" ry="4"/><ellipse cx="131" cy="126" rx="8" ry="4"/></g>}
      {mouth()}
      {cfg.accessory==="earring"&&<g fill="#FFD66B"><circle cx="60" cy="116" r="4"/><circle cx="140" cy="116" r="4"/></g>}
      {cfg.accessory==="hoopGold"&&<g stroke="#FFD66B" strokeWidth="3" fill="none"><circle cx="60" cy="116" r="7"/><circle cx="140" cy="116" r="7"/></g>}
      {(cfg.accessory==="glasses"||cfg.accessory==="glassesGold")&&<g stroke={cfg.accessory==="glassesGold"?"#D4AF37":"#1A120C"} strokeWidth="4" fill="rgba(255,255,255,.10)"><circle cx="80" cy="104" r="14"/><circle cx="120" cy="104" r="14"/><path d="M94 104 L106 104"/><path d="M66 101 L58 97 M134 101 L142 97" strokeLinecap="round"/></g>}
      {cfg.accessory==="piercing"&&<circle cx="112" cy="130" r="3" fill="#D4AF37"/>}
      {cfg.accessory==="headphones"&&<g stroke="#17100A" strokeWidth="7" fill="none" strokeLinecap="round"><path d="M59 105 C59 58 141 58 141 105"/><rect x="43" y="101" width="17" height="31" rx="8" fill="#17100A" stroke="none"/><rect x="140" y="101" width="17" height="31" rx="8" fill="#17100A" stroke="none"/></g>}
      <path d={female?"M71 65 C85 47 118 47 130 65":"M70 66 C85 49 117 49 130 66"} stroke="rgba(255,255,255,.16)" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </g>
  </svg>;
}

function Av({av=0,config=null,size=36}){
  const cfg=normalizeAvatarConfig(config,av);
  const frame={none:`2px solid rgba(255,244,214,.9)`,bronze:`3px solid #C97934`,gold:`3px solid #D4AF37`,neon:`3px solid #5FD7FF`,legend:`3px solid #FFF1A8`}[cfg.frame]||`2px solid rgba(255,244,214,.9)`;
  const aura={none:"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)",warm:"0 0 22px rgba(212,175,55,.45), 0 8px 18px rgba(20,8,4,.28)",flame:"0 0 26px rgba(240,106,59,.55), 0 8px 18px rgba(20,8,4,.28)",ocean:"0 0 26px rgba(95,215,255,.45), 0 8px 18px rgba(20,8,4,.28)",vip:"0 0 30px rgba(255,241,168,.7), 0 8px 18px rgba(20,8,4,.28)"}[cfg.aura]||"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)";
  return <div title={avatarStyleName(cfg)} style={{width:size,height:size,borderRadius:"50%",background:bgGradient(cfg.bg),display:"flex",alignItems:"center",justifyContent:"center",border:frame,boxShadow:aura,position:"relative",overflow:"hidden",perspective:500}}>{cfg.aura!=="none"&&<span style={{position:"absolute",inset:3,borderRadius:"50%",background:"radial-gradient(circle at 35% 18%,rgba(255,255,255,.28),transparent 42%)",pointerEvents:"none"}}/>}<span style={{position:"absolute",top:0,bottom:0,width:"38%",left:"-45%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)",animation:size>70?"avatarShinePro 5.2s ease-in-out infinite":"none"}}/><AvatarFigure config={cfg} size={size*1.22} animated={size>=70}/></div>;
}
function CharacterCard({idx,selected,onPick,compact=false}){
  const cfg=normalizeAvatarConfig(AVATAR_PRESETS[idx%AVATAR_PRESETS.length],idx);
  return <button type="button" onClick={()=>{SFX.tab();onPick(idx);}} style={{background:selected?"linear-gradient(180deg,#FFF4D6,#F6E5BE)":"rgba(255,244,214,.72)",border:`2px solid ${selected?T.gold:T.g200}`,borderRadius:18,padding:compact?8:10,cursor:"pointer",boxShadow:selected?"0 10px 24px rgba(212,175,55,.3)":"0 6px 16px rgba(20,8,4,.12)",textAlign:"center",transition:"all .18s ease"}}><div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Av av={idx} config={cfg} size={compact?52:72}/></div><div style={{fontWeight:950,fontSize:compact?".7rem":".78rem",color:T.g800,lineHeight:1.05}}>{AVATAR_LABELS[cfg.hair]}</div>{!compact&&<div style={{fontSize:".66rem",fontWeight:850,color:T.textSub,marginTop:2}}>{AVATAR_LABELS[cfg.gender]} · {avatarLabel(cfg.face,"face")}</div>}</button>;
}
function PickerButton({active,children,onClick,locked=false}){return <button type="button" onClick={()=>{if(locked){SFX.error();return;}SFX.tab();onClick?.();}} style={{border:`2px solid ${active?T.gold:T.g200}`,background:active?T.gradGold:locked?"rgba(60,40,25,.18)":"rgba(255,244,214,.72)",color:active?T.g900:locked?T.textSub:T.g700,borderRadius:12,padding:"8px 9px",fontWeight:900,fontSize:".72rem",cursor:locked?"not-allowed":"pointer",boxShadow:active?"0 8px 18px rgba(212,175,55,.25)":"0 5px 12px rgba(20,8,4,.1)"}}>{locked?"🔒 ":""}{children}</button>;}
function ColorDot({color,active,onClick}){return <button type="button" onClick={()=>{SFX.tab();onClick?.();}} style={{width:32,height:32,borderRadius:"50%",background:color,border:`3px solid ${active?T.gold:"rgba(255,244,214,.9)"}`,boxShadow:active?"0 0 0 3px rgba(212,175,55,.25)":"0 4px 10px rgba(20,8,4,.18)",cursor:"pointer"}}/>;}
function EditorTabButton({active,icon,label,onClick}){return <button type="button" onClick={()=>{SFX.tab();onClick?.();}} style={{border:`2px solid ${active?T.gold:T.g200}`,background:active?"linear-gradient(180deg,#FFF8E1,#E6C27A)":"rgba(255,248,225,.9)",color:active?T.g900:T.g700,borderRadius:18,padding:"8px 10px",minWidth:0,cursor:"pointer",boxShadow:active?"0 12px 24px rgba(212,175,55,.26)":"0 6px 14px rgba(20,8,4,.10)",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontWeight:950}}><div style={{fontSize:"1.08rem",lineHeight:1}}>{icon}</div><div style={{fontSize:".68rem",whiteSpace:"nowrap"}}>{label}</div></button>;}
function VisualOption({label,active,onClick,locked=false,children,sub=null}){return <button type="button" onClick={()=>{if(locked){SFX.error();return;}SFX.tab();onClick?.();}} style={{position:"relative",border:`2px solid ${active?T.gold:T.g200}`,background:active?"linear-gradient(180deg,#FFF8E5,#F6E5BE)":"rgba(255,248,225,.88)",borderRadius:18,padding:8,cursor:locked?"not-allowed":"pointer",boxShadow:active?"0 12px 24px rgba(212,175,55,.22)":"0 6px 14px rgba(20,8,4,.10)",textAlign:"center",opacity:locked?0.72:1,minWidth:0}}>{locked&&<div style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.62)",color:T.white,borderRadius:999,padding:"2px 6px",fontSize:".62rem",fontWeight:950,zIndex:4}}>🔒</div>}<div style={{height:148,borderRadius:16,display:"grid",placeItems:"center",background:"radial-gradient(circle at 50% 20%,rgba(255,241,168,.22),transparent 35%),linear-gradient(160deg,#1B0D07,#5C3317 60%,#D4AF37)",overflow:"hidden",marginBottom:7}}>{children}</div><div style={{fontSize:".73rem",fontWeight:950,color:active?T.g900:T.g800,lineHeight:1.12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>{sub&&<div style={{fontSize:".62rem",fontWeight:800,color:T.textSub,marginTop:2,lineHeight:1.05}}>{sub}</div>}</button>;}
function LargeSwatch({color,active,onClick}){return <button type="button" onClick={()=>{SFX.tab();onClick?.();}} style={{width:46,height:46,borderRadius:"50%",border:`4px solid ${active?T.gold:"rgba(110,53,24,.16)"}`,boxShadow:active?"0 0 0 4px rgba(212,175,55,.18),0 8px 14px rgba(20,8,4,.12)":"0 6px 12px rgba(20,8,4,.1)",background:color,cursor:"pointer"}}/>;}
function MiniSectionTitle({emoji,title,sub}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:8,margin:"6px 0 8px"}}><div style={{fontWeight:950,color:T.g800}}>{emoji} {title}</div>{sub&&<div style={{fontSize:".68rem",fontWeight:850,color:T.textSub,textAlign:"right"}}>{sub}</div>}</div>;}
function AvatarEditor({form,setForm,ownedKeys=[]}){
  const [panel,setPanel]=useState("base");
  const cfg=normalizeAvatarConfig(form.avatarConfig,form.avatar);
  const premiumKeys=new Set(ownedKeys||[]);
  const isLocked=(slot,value)=>COSMETIC_CATALOG_FALLBACK.some(c=>c.slot===slot&&c.valor===value&&!premiumKeys.has(c.item_key));
  const applyConfig=(next)=>setForm(f=>({...f,avatarConfig:normalizeAvatarConfig(next,f.avatar)}));
  const patch=(key,value)=>{
    if(isLocked(key,value)){SFX.error();return;}
    setForm(f=>{
      const current=normalizeAvatarConfig(f.avatarConfig,f.avatar);
      let next={...current,[key]:value};
      if(key==="gender"){
        const base=value==="female"?DEFAULT_FEMALE_AVATAR:DEFAULT_MALE_AVATAR;
        next={...base,skin:current.skin,hairColor:current.hairColor,eyeColor:current.eyeColor,bg:current.bg,frame:current.frame,aura:current.aura,accessory:current.accessory};
        if(value==="female") next={...next,facial:"none",hair:"longWaves",face:"heart",eyes:"glam",brows:"arched",accessory:current.accessory==="crown"?"hoopGold":current.accessory};
        if(value==="male") next={...next,hair:"sharpFade",face:"square",eyes:"sharp",brows:"strong",facial:current.facial==="none"?"shortBeard":current.facial,accessory:current.accessory==="flowers"?"earring":current.accessory};
      }
      return {...f,avatarConfig:normalizeAvatarConfig(next,f.avatar)};
    });
  };
  const randomize=()=>applyConfig(randomAvatarConfig(cfg.gender));
  const preset=(idx)=>setForm(f=>({...f,avatar:idx,avatarConfig:normalizeAvatarConfig(AVATAR_PRESETS[idx],idx)}));
  const visibleHair=cfg.gender==="female"?FEMALE_HAIR:MALE_HAIR;
  const panels=[{id:"base",label:"Base",icon:"👤"},{id:"pelo",label:"Pelo",icon:"💇"},{id:"cara",label:"Cara",icon:"🙂"},{id:"extras",label:"Extras",icon:"🎒"}];
  const hairPreviewBase=normalizeAvatarConfig({...cfg,accessory:"none",aura:"none",frame:"none"},form.avatar);
  const facePreviewBase=normalizeAvatarConfig({...cfg,accessory:"none",aura:"none",frame:"none",facial:"none"},form.avatar);
  return <div>
    <Card style={{padding:0,overflow:"hidden",background:"linear-gradient(180deg,#FFF8E8,#F5E1B6)",border:`2px solid ${T.gold}`,marginBottom:14}}>
      <div style={{padding:12,background:"radial-gradient(circle at 50% 14%,rgba(255,241,168,.26),transparent 38%),linear-gradient(160deg,#160B07,#3A1E10 55%,#D4AF37)",color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}><div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.25rem",letterSpacing:".4px"}}>Creador de personaje</div><div style={{fontSize:".72rem",fontWeight:850,opacity:.82}}>Modelo nuevo: masculino y femenino separados, colores reales y miniaturas visuales.</div></div><Btn small col="gold" onClick={randomize}>🎲 Aleatorio</Btn></div>
        <div style={{display:"grid",gridTemplateColumns:"184px 1fr",gap:12,alignItems:"center"}}><div style={{display:"flex",justifyContent:"center"}}><Av av={form.avatar} config={cfg} size={172}/></div><div><div style={{fontWeight:950,fontSize:"1rem",lineHeight:1.05,marginBottom:4}}>{avatarStyleName(cfg)}</div><div style={{fontSize:".72rem",fontWeight:800,opacity:.86,marginBottom:8}}>Toca cualquier miniatura: debe cambiar arriba al instante.</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{[{v:cfg.gender},{v:cfg.hair},{v:cfg.face,k:"face"},{v:cfg.accessory}].map(x=><span key={`${x.v}-${x.k||""}`} style={{background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",padding:"4px 8px",borderRadius:999,fontSize:".64rem",fontWeight:900}}>{avatarLabel(x.v,x.k)}</span>)}</div></div></div>
      </div>
      <div style={{padding:12}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>{panels.map(p=><EditorTabButton key={p.id} active={panel===p.id} icon={p.icon} label={p.label} onClick={()=>setPanel(p.id)}/>)}</div></div>
    </Card>
    {panel==="base"&&<>
      <MiniSectionTitle emoji="⚧" title="Sexo del personaje" sub="Cambia el modelo entero"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}><VisualOption label="Masculino" active={cfg.gender==="male"} onClick={()=>patch("gender","male")}><Av av={form.avatar} config={{...DEFAULT_MALE_AVATAR,skin:cfg.skin,hairColor:cfg.hairColor,eyeColor:cfg.eyeColor,bg:cfg.bg}} size={108}/></VisualOption><VisualOption label="Femenino" active={cfg.gender==="female"} onClick={()=>patch("gender","female")}><Av av={form.avatar} config={{...DEFAULT_FEMALE_AVATAR,skin:cfg.skin,hairColor:cfg.hairColor,eyeColor:cfg.eyeColor,bg:cfg.bg}} size={108}/></VisualOption></div>
      <MiniSectionTitle emoji="🎭" title="Presets de personaje" sub="Modelos muy distintos"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{AVATAR_PRESETS.map((_,i)=><CharacterCard key={i} idx={i} selected={Number(form.avatar)===i} onPick={preset}/>)}</div>
      <MiniSectionTitle emoji="🖼️" title="Fondos" sub="Escenario"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>{AVATAR_OPTIONS.bg.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.bg===v} locked={isLocked("bg",v)} onClick={()=>patch("bg",v)}><div style={{width:66,height:66,borderRadius:"50%",background:bgGradient(v),border:"3px solid rgba(255,255,255,.82)",boxShadow:"0 10px 18px rgba(0,0,0,.18)"}}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="✨" title="Marcos" sub="Borde del avatar"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{AVATAR_OPTIONS.frame.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]||v} active={cfg.frame===v} locked={isLocked("frame",v)} onClick={()=>patch("frame",v)}><Av av={form.avatar} config={{...cfg,frame:v,aura:"none"}} size={92}/></VisualOption>)}</div>
    </>}
    {panel==="pelo"&&<>
      <MiniSectionTitle emoji="💇" title={`Peinados ${AVATAR_LABELS[cfg.gender].toLowerCase()}`} sub="El color debe notarse"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{visibleHair.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.hair===v} locked={isLocked("hair",v)} onClick={()=>patch("hair",v)}><Av av={form.avatar} config={{...hairPreviewBase,hair:v,gender:cfg.gender,facial:cfg.gender==="female"?"none":cfg.facial}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🎨" title="Color de pelo" sub="Color directo, sin camuflar"/>
      <Card style={{marginBottom:14,background:"rgba(255,248,225,.75)",border:`2px solid ${T.g200}`}}><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>{AVATAR_OPTIONS.hairColor.map((c,i)=><LargeSwatch key={`${c}-${i}`} color={c} active={cfg.hairColor===i} onClick={()=>patch("hairColor",i)}/>)}</div></Card>
      {cfg.gender==="male"&&<><MiniSectionTitle emoji="🧔" title="Barba y bigote" sub="Solo masculino"/><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{AVATAR_OPTIONS.facial.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.facial===v} onClick={()=>patch("facial",v)}><Av av={form.avatar} config={{...hairPreviewBase,gender:"male",facial:v}} size={108}/></VisualOption>)}</div></>}
    </>}
    {panel==="cara"&&<>
      <MiniSectionTitle emoji="🙂" title="Forma de cara" sub="Silueta y mandíbula"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{AVATAR_OPTIONS.face.map(v=><VisualOption key={v} label={avatarLabel(v,"face")} active={cfg.face===v} onClick={()=>patch("face",v)}><Av av={form.avatar} config={{...facePreviewBase,face:v,gender:cfg.gender}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🧑" title="Tono de piel"/>
      <Card style={{marginBottom:14,background:"rgba(255,248,225,.75)",border:`2px solid ${T.g200}`}}><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>{AVATAR_OPTIONS.skin.map((c,i)=><LargeSwatch key={`${c}-${i}`} color={c} active={cfg.skin===i} onClick={()=>patch("skin",i)}/>)}</div></Card>
      <MiniSectionTitle emoji="👀" title="Ojos"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{AVATAR_OPTIONS.eyes.map(v=><VisualOption key={v} label={avatarLabel(v,"eyes")} active={cfg.eyes===v} onClick={()=>patch("eyes",v)}><Av av={form.avatar} config={{...facePreviewBase,eyes:v,eyeColor:cfg.eyeColor,brows:cfg.brows,gender:cfg.gender}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🖋️" title="Cejas"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{AVATAR_OPTIONS.brows.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.brows===v} onClick={()=>patch("brows",v)}><Av av={form.avatar} config={{...facePreviewBase,brows:v,eyes:cfg.eyes,eyeColor:cfg.eyeColor,gender:cfg.gender}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🌈" title="Color de ojos"/>
      <Card style={{background:"rgba(255,248,225,.75)",border:`2px solid ${T.g200}`}}><div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>{AVATAR_OPTIONS.eyeColor.map((c,i)=><LargeSwatch key={`${c}-${i}`} color={c} active={cfg.eyeColor===i} onClick={()=>patch("eyeColor",i)}/>)}</div></Card>
    </>}
    {panel==="extras"&&<>
      <MiniSectionTitle emoji="🎒" title="Complementos básicos" sub="Gafas, gorra, pendientes, flores..."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{BASIC_ACCESSORIES.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.accessory===v} onClick={()=>patch("accessory",v)}><Av av={form.avatar} config={{...cfg,accessory:v,frame:"none",aura:"none"}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🔓" title="Desbloqueables" sub="Negro con candado si no están comprados"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{["capBlack","capGold","glassesGold","bandanaGreen","crown"].map(v=><VisualOption key={v} label={AVATAR_LABELS[v]} active={cfg.accessory===v} locked={isLocked("accessory",v)} onClick={()=>patch("accessory",v)}><Av av={form.avatar} config={{...cfg,accessory:v,frame:"none",aura:"none"}} size={108}/></VisualOption>)}</div>
      <MiniSectionTitle emoji="🌟" title="Aura" sub="Brillo y rareza"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{AVATAR_OPTIONS.aura.map(v=><VisualOption key={v} label={AVATAR_LABELS[v]||v} active={cfg.aura===v} locked={isLocked("aura",v)} onClick={()=>patch("aura",v)}><Av av={form.avatar} config={{...cfg,aura:v}} size={108}/></VisualOption>)}</div>
    </>}
  </div>;
}

function Toast({msg,show}){if(!show)return null;return <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:T.g800,color:T.white,padding:"12px 22px",borderRadius:50,fontWeight:700,fontSize:"0.88rem",zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 6px 24px rgba(27,67,50,0.35)",animation:"toastIn 0.3s ease"}}>{msg}</div>;}
function PtsPopup({pts,show}){if(!show||!pts)return null;return <div style={{position:"fixed",top:"35%",left:"50%",transform:"translateX(-50%)",zIndex:9999,animation:"ptsFloat 1.8s ease forwards",pointerEvents:"none"}}><div style={{background:T.gradGold,color:T.white,borderRadius:50,padding:"10px 24px",fontWeight:900,fontSize:"1.4rem",boxShadow:"0 6px 24px rgba(255,183,3,0.5)"}}>+{pts} pts</div></div>;}
function Particles(){
  const items=["✂","〰","◆","✦","•","⟡"];
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>{[...Array(10)].map((_,i)=><div key={i} style={{position:"absolute",left:`${6+i*10}%`,bottom:"-10%",fontSize:i%3===0?"1.35rem":"1rem",opacity:0.1,animation:`floatUp ${13+i*2}s linear ${i*1.4}s infinite`}}>{items[i%items.length]}</div>)}</div>;
}
function BrandLogo(){
  return (
    <div style={{width:94,height:94,margin:"0 auto 14px",position:"relative",animation:"logoPulse 2.4s ease infinite"}}>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"linear-gradient(135deg,#1F120B,#5C3317 52%,#D4AF37)",boxShadow:"0 10px 30px rgba(0,0,0,0.35)",border:"3px solid rgba(245,230,200,0.7)"}}/>
      <div style={{position:"absolute",inset:8,borderRadius:"50%",border:"2px solid rgba(212,175,55,0.55)"}}/>
      {[0,1,2,3,4].map(i=><span key={i} style={{position:"absolute",left:24+i*9,top:16,width:4,height:50,borderRadius:8,background:"linear-gradient(180deg,#F5E6C8,#8B4513)",transform:`rotate(${i%2===0?-12:12}deg)`,boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}/>)}
      <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",fontSize:"2.3rem",filter:"drop-shadow(0 3px 3px rgba(0,0,0,0.45))"}}>✂️</div>
      <div style={{position:"absolute",left:18,right:18,bottom:15,height:2,background:"rgba(245,230,200,0.8)",animation:"bladeGlint 2.6s ease infinite"}}/>
    </div>
  );
}


function HeroMascot(){
  return (
    <div style={{width:"100%",maxWidth:382,margin:"0 auto 10px",position:"relative",animation:"mascotFloat 3.2s ease-in-out infinite"}}>
      <div style={{position:"absolute",inset:"2% 4% auto 4%",height:240,background:"radial-gradient(circle at 50% 18%, rgba(255,214,107,.34), transparent 34%), radial-gradient(circle at 50% 50%, rgba(255,255,255,.14), transparent 46%)",filter:"blur(22px)",zIndex:0}}/>
      <svg viewBox="0 0 380 285" style={{width:"100%",height:"auto",display:"block",filter:"drop-shadow(0 20px 26px rgba(0,0,0,.30))",position:"relative",zIndex:1}}>
        <ellipse cx="190" cy="252" rx="126" ry="18" fill="rgba(0,0,0,.24)" />

        {/* Dreadlocks left */}
        <g>
          <path d="M82 86 C48 94, 38 130, 55 160 C70 186, 84 208, 106 234" fill="none" stroke="#25140B" strokeWidth="18" strokeLinecap="round" style={{animation:"dreadSwing 2.8s ease-in-out infinite",transformOrigin:"96px 92px"}}/>
          <path d="M100 60 C68 76, 58 108, 72 136 C86 166, 102 192, 118 220" fill="none" stroke="#3A2113" strokeWidth="18" strokeLinecap="round" style={{animation:"dreadSwing2 2.9s ease-in-out infinite",transformOrigin:"108px 72px"}}/>
          <path d="M123 46 C103 61, 96 90, 102 116 C108 142, 118 170, 126 196" fill="none" stroke="#512D18" strokeWidth="16" strokeLinecap="round" style={{animation:"dreadSwing 2.5s ease-in-out infinite",transformOrigin:"130px 56px"}}/>
          <path d="M140 40 C125 56, 122 80, 126 103 C130 128, 138 149, 145 170" fill="none" stroke="#6A3B1F" strokeWidth="13" strokeLinecap="round" style={{animation:"dreadSwing2 2.4s ease-in-out infinite",transformOrigin:"144px 52px"}}/>
        </g>

        {/* Dreadlocks right */}
        <g>
          <path d="M298 86 C332 94, 342 130, 325 160 C310 186, 296 208, 274 234" fill="none" stroke="#25140B" strokeWidth="18" strokeLinecap="round" style={{animation:"dreadSwing2 2.8s ease-in-out infinite",transformOrigin:"284px 92px"}}/>
          <path d="M280 60 C312 76, 322 108, 308 136 C294 166, 278 192, 262 220" fill="none" stroke="#3A2113" strokeWidth="18" strokeLinecap="round" style={{animation:"dreadSwing 2.9s ease-in-out infinite",transformOrigin:"272px 72px"}}/>
          <path d="M257 46 C277 61, 284 90, 278 116 C272 142, 262 170, 254 196" fill="none" stroke="#512D18" strokeWidth="16" strokeLinecap="round" style={{animation:"dreadSwing2 2.5s ease-in-out infinite",transformOrigin:"250px 56px"}}/>
          <path d="M240 40 C255 56, 258 80, 254 103 C250 128, 242 149, 235 170" fill="none" stroke="#6A3B1F" strokeWidth="13" strokeLinecap="round" style={{animation:"dreadSwing 2.4s ease-in-out infinite",transformOrigin:"236px 52px"}}/>
        </g>

        {/* Top knot / tied braids */}
        <g>
          <path d="M168 34 C161 18, 166 6, 182 7 C194 8, 201 18, 199 33" fill="#2A180D" />
          <path d="M181 8 C197 8, 211 16, 217 30 C221 40, 219 52, 212 61" fill="none" stroke="#2A180D" strokeWidth="12" strokeLinecap="round" />
          <path d="M165 62 C171 39, 183 25, 191 25 C199 25, 211 39, 217 62" fill="none" stroke="#3E2313" strokeWidth="16" strokeLinecap="round" />
          <path d="M173 60 C178 47, 185 41, 191 41 C197 41, 204 47, 209 60" fill="none" stroke="#7C4927" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="191" cy="30" rx="26" ry="13" fill="#2A180D" />
          <path d="M175 30 C178 24, 185 22, 191 25 C197 22, 204 24, 207 30" fill="none" stroke="#8C5A31" strokeWidth="4" strokeLinecap="round" />
          <rect x="174" y="50" width="34" height="9" rx="5" fill="#C0392B" opacity=".92" />
        </g>

        {/* Head band and crown hair */}
        <path d="M119 94 C130 63, 159 44, 191 44 C223 44, 252 62, 264 95 L264 105 C250 92, 227 82, 191 82 C155 82, 132 92, 119 105 Z" fill="#24140C" />
        <path d="M123 98 C138 70, 164 56, 191 56 C218 56, 244 70, 259 98" fill="none" stroke="#6C3D20" strokeWidth="4" opacity=".35" />
        <path d="M128 95 C146 86, 166 82, 191 82 C216 82, 236 86, 254 95 L251 109 C234 100, 214 96, 191 96 C168 96, 148 100, 131 109 Z" fill="#A72822" />
        <path d="M164 93 C171 88, 180 86, 191 86 C202 86, 211 88, 218 93" fill="none" stroke="#F2C27E" strokeWidth="3" strokeLinecap="round" opacity=".7" />

        {/* Face less round, more anime */}
        <path d="M123 120 C123 86, 153 64, 191 64 C229 64, 259 86, 259 120 C259 160, 241 209, 191 217 C141 209, 123 160, 123 120 Z" fill="#F0B37E" />
        <path d="M142 206 C156 215, 172 220, 191 222 C210 220, 226 215, 240 206" fill="none" stroke="#C98A62" strokeWidth="3" opacity=".45" />

        {/* Ears + blush */}
        <ellipse cx="122" cy="145" rx="8" ry="15" fill="#E9A578" />
        <ellipse cx="260" cy="145" rx="8" ry="15" fill="#E9A578" />
        <ellipse cx="145" cy="157" rx="12" ry="8" fill="#E69C7F" opacity=".62" />
        <ellipse cx="237" cy="157" rx="12" ry="8" fill="#E69C7F" opacity=".62" />

        {/* Brows */}
        <path d="M147 113 C158 104, 170 101, 181 106" fill="none" stroke="#26160D" strokeWidth="5" strokeLinecap="round" />
        <path d="M201 106 C212 101, 224 104, 235 113" fill="none" stroke="#26160D" strokeWidth="5" strokeLinecap="round" />

        {/* Eyes: one open, one wink */}
        <ellipse cx="158" cy="136" rx="24" ry="24" fill="#FFF" />
        <ellipse cx="224" cy="136" rx="23" ry="21" fill="#FFF" />
        <g style={{transformOrigin:"158px 136px",animation:"eyeBlink 5.4s ease-in-out infinite"}}>
          <ellipse cx="158" cy="136" rx="14" ry="16" fill="#112435" />
          <ellipse cx="154" cy="131" rx="4" ry="4.5" fill="#fff" />
        </g>
        <path d="M209 136 C218 128, 232 128, 239 136" fill="none" stroke="#17110D" strokeWidth="7" strokeLinecap="round" style={{animation:"winkPulse 3.4s ease-in-out infinite",transformOrigin:"224px 136px"}}/>

        {/* Nose and mouth */}
        <path d="M185 149 C189 161, 189 169, 183 174" fill="none" stroke="#CF8B61" strokeWidth="4" strokeLinecap="round" />
        <path d="M178 156 Q191 165 204 156" fill="none" stroke="#A55A45" strokeWidth="4" strokeLinecap="round" />
        <path d="M159 184 C173 199, 210 199, 224 184" fill="none" stroke="#8B2F1C" strokeWidth="7" strokeLinecap="round" />
        <path d="M168 188 C178 196, 203 196, 215 188" fill="#FFF2F2" opacity=".42" />

        {/* Crochet hook held by hand, away from the face */}
        <g style={{animation:"hookShoulderMove 2.2s ease-in-out infinite",transformOrigin:"287px 204px"}}>
          <path d="M274 206 C286 199, 300 201, 306 212 C312 224, 302 238, 287 235 C275 232, 268 216, 274 206Z" fill="#F0B37E" stroke="#D18B5F" strokeWidth="2"/>
          <path d="M285 214 L316 176" stroke="#8B5529" strokeWidth="8" strokeLinecap="round"/>
          <path d="M314 177 C321 168, 333 170, 332 181 C331 188, 324 190, 320 186" fill="none" stroke="#E2D6C2" strokeWidth="6" strokeLinecap="round"/>
          <path d="M305 186 L319 169" stroke="#F5EFE3" strokeWidth="3" strokeLinecap="round" opacity=".85"/>
          <path d="M279 211 C285 209, 292 212, 296 218" fill="none" stroke="#C9855C" strokeWidth="3" strokeLinecap="round"/>
        </g>

        {/* Neck / shoulders */}
        <path d="M132 232 C152 210, 229 210, 249 232" fill="#2E1B12" />
        <path d="M144 225 C161 208, 221 208, 238 225" fill="none" stroke="#FFD26B" strokeWidth="12" strokeLinecap="round" />
        <path d="M140 236 C162 249, 220 249, 242 236" fill="none" stroke="#402319" strokeWidth="8" strokeLinecap="round" />

        {/* Sparkles */}
        <g opacity=".9">
          <circle cx="84" cy="72" r="4" fill="rgba(255,214,107,.78)" />
          <circle cx="278" cy="67" r="3.5" fill="rgba(255,214,107,.74)" />
          <circle cx="305" cy="115" r="3" fill="rgba(255,255,255,.45)" />
          <circle cx="73" cy="131" r="3" fill="rgba(255,255,255,.42)" />
        </g>
      </svg>
    </div>
  );
}


function privacyStorageKey(user){return `privacy_${String(user?.email||user?.id||"anon").toLowerCase()}`;}
function localPrivacy(user){
  try{
    const saved=JSON.parse(localStorage.getItem(privacyStorageKey(user))||"{}");
    return {perfil_publico:saved.perfil_publico!==false,modo_incognito:!!saved.modo_incognito};
  }catch{return {perfil_publico:true,modo_incognito:false};}
}
function normalizePrivacy(user={}){
  const local=localPrivacy(user);
  const publico=user.perfil_publico===undefined&&user.profile_public===undefined?local.perfil_publico:(user.perfil_publico!==false && user.profile_public!==false);
  const incognito=user.modo_incognito===undefined&&user.incognito_mode===undefined?local.modo_incognito:(!!user.modo_incognito || !!user.incognito_mode);
  return {perfil_publico:publico,modo_incognito:incognito};
}
function isSameUser(a,b){return !!(a&&b) && String(a.id||a.usuario_id||a.email||"").toLowerCase()===String(b.id||b.usuario_id||b.email||"").toLowerCase();}
function isPrivateProfile(profile,currentUser=null){
  const p=normalizePrivacy(profile||{});
  if(currentUser && isSameUser(profile,currentUser)) return false;
  return p.perfil_publico===false || p.modo_incognito===true;
}
function publicName(profile,currentUser=null){return isPrivateProfile(profile,currentUser)?"xxxxxx":(profile?.nombre||profile?.usuario_nombre||profile?.autor_nombre||"Usuario");}
function publicRoleLabel(profile,currentUser=null){return isPrivateProfile(profile,currentUser)?"modo incógnito":(normalizeRole(profile?.role||profile?.rol)==='client'?'cliente':normalizeRole(profile?.role||profile?.rol));}
function saveLocalPrivacy(user,privacy){try{localStorage.setItem(privacyStorageKey(user),JSON.stringify(normalizePrivacy(privacy)));}catch{}}
async function loadPrivacyForUser(profile){
  const base=normalizePrivacy(profile);
  if(!profile?.id) return base;
  try{
    const {data,error}=await supabase.from("usuarios").select("perfil_publico,modo_incognito").eq("id",String(profile.id)).maybeSingle();
    if(!error && data){
      const merged={perfil_publico:data.perfil_publico!==false,modo_incognito:!!data.modo_incognito};
      saveLocalPrivacy(profile,merged);
      return merged;
    }
  }catch{}
  return base;
}
async function savePrivacyForUser(user,privacy){
  const clean=normalizePrivacy(privacy);
  saveLocalPrivacy(user,clean);
  try{await supabase.from("usuarios").update(clean).eq("id",String(user.id));}catch{}
  return clean;
}
function IncognitoAvatar({size=40}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(145deg,#050505,#242424)",border:"2px solid rgba(240,224,184,.55)",display:"grid",placeItems:"center",boxShadow:"0 8px 18px rgba(0,0,0,.32)",overflow:"hidden",flexShrink:0}}>
    <svg viewBox="0 0 100 100" width={size*.8} height={size*.8} aria-hidden="true">
      <circle cx="50" cy="34" r="18" fill="#0A0A0A" stroke="#3A3A3A" strokeWidth="3"/>
      <path d="M20 92 C24 66 36 55 50 55 C64 55 76 66 80 92Z" fill="#050505" stroke="#3A3A3A" strokeWidth="3"/>
      <rect x="18" y="28" width="64" height="9" rx="5" fill="#111" stroke="#444" strokeWidth="2"/>
    </svg>
  </div>;
}
function PublicAvatar({profile,currentUser=null,size=40}){
  return isPrivateProfile(profile,currentUser)?<IncognitoAvatar size={size}/>:<Av av={profile?.avatar||profile?.usuario_avatar||profile?.autor_avatar||0} config={profile?.avatar_config||profile?.avatarConfig||profile?.usuario_avatar_config||profile?.autor_avatar_config} size={size}/>;
}

function toAppUser(u){
  const avatarConfig=normalizeAvatarConfig(u.avatar_config || u.avatarConfig, u.avatar);
  const privacy=normalizePrivacy(u);
  return {
    id:u.id,
    nombre:u.nombre,
    email:u.email,
    rol:normalizeRole(u.role || u.rol),
    puntos:u.puntos||0,
    avatar:u.avatar||0,
    avatarConfig,
    avatar_config:avatarConfig,
    perfil_publico:privacy.perfil_publico,
    modo_incognito:privacy.modo_incognito,
    fecha_registro:u.created_at
  };
}
async function getUserProfileByEmail(email){
  if(!supabase || !email) return null;
  const {data,error}=await supabase
    .from("usuarios")
    .select("id,nombre,email,role,puntos,avatar,created_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if(error) return null;
  if(data){
    data.avatar_config=await getAvatarConfigForProfile(data);
    Object.assign(data, await loadPrivacyForUser(data));
  }
  return data;
}
async function createUserProfile({nombre,email}){
  if(!supabase || !email) return null;
  const {data,error}=await supabase
    .from("usuarios")
    .insert({nombre,email:email.toLowerCase(),role:"client",puntos:0,avatar:Math.floor(Math.random()*AVATARS.length)})
    .select("id,nombre,email,role,puntos,avatar,created_at")
    .maybeSingle();
  if(error){ console.error("Error creando perfil en usuarios:", error); return null; }
  if(data){
    const cfg=normalizeAvatarConfig(null,data.avatar);
    data.avatar_config=cfg;
    data.perfil_publico=true;
    data.modo_incognito=false;
    await saveAvatarConfigForUser(data,cfg);
    saveLocalPrivacy(data,{perfil_publico:true,modo_incognito:false});
  }
  return data;
}


function LandingFeature({icon,title,sub,accent="#D4AF37"}){
  return(
    <div className="studio-panel landing-feature-pro" style={{
      border:`1px solid ${accent}55`,
      borderRadius:18,
      padding:"12px 10px",
      background:"linear-gradient(180deg,rgba(24,15,8,.82),rgba(10,7,4,.92))",
      boxShadow:`0 12px 26px rgba(0,0,0,.28), inset 0 -2px 0 ${accent}55`,
      minHeight:96,
      position:"relative",
      overflow:"hidden"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="icon3d" style={{fontSize:"1.65rem",filter:`drop-shadow(0 0 10px ${accent}66)`}}>{icon}</div>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.05rem",color:"#FFF4D6",lineHeight:1}}>{title}</div>
          <div style={{fontSize:".72rem",fontWeight:800,color:"rgba(255,244,214,.72)",lineHeight:1.25,marginTop:4}}>{sub}</div>
        </div>
      </div>
      <div style={{position:"absolute",left:12,right:12,bottom:8,height:3,borderRadius:999,background:`linear-gradient(90deg,#2F6B42,#D4AF37,#A72822)`,opacity:.85}}/>
    </div>
  );
}

function RastaLandingHero({compact=false,onNavigate=null,user=null}){
  return(
    <div style={{
      position:"relative",
      overflow:"hidden",
      borderRadius:28,
      padding:compact?"18px 14px 16px":"22px 16px 18px",
      background:"radial-gradient(circle at 50% 20%,rgba(255,214,107,.24),transparent 38%),linear-gradient(180deg,#1A1008,#070503 72%,#100905)",
      border:"1.5px solid rgba(212,175,55,.42)",
      boxShadow:"0 22px 44px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,244,214,.12)",
      marginBottom:16
    }}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 12% 78%,rgba(47,107,66,.24),transparent 26%),radial-gradient(circle at 88% 84%,rgba(167,40,34,.18),transparent 24%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",right:-28,top:90,fontSize:"9rem",opacity:.07,transform:"rotate(-10deg)"}}>✂️</div>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <div style={{
          fontFamily:"'Rubik Wet Paint','Bangers',cursive",
          fontSize:compact?"2.45rem":"3.25rem",
          lineHeight:.86,
          letterSpacing:"1px",
          color:"#FFD66B",
          textShadow:"0 4px 0 #3A1607,0 10px 22px rgba(0,0,0,.54)",
          transform:"rotate(-1deg)",
          marginBottom:compact?-4:-2
        }}>{BRAND.name}</div>
        <div style={{
          display:"inline-flex",
          alignItems:"center",
          gap:8,
          marginTop:10,
          padding:"6px 13px",
          background:"rgba(255,244,214,.08)",
          border:"1px solid rgba(212,175,55,.28)",
          borderRadius:999,
          color:"#F5E6C8",
          fontWeight:950,
          fontSize:".75rem",
          letterSpacing:".08em",
          textTransform:"uppercase"
        }}>✂️ Cortes, rastas y estilo urbano ✂️</div>
        <div style={{marginTop:compact?4:8,position:"relative"}}>
          <HeroMascot/>
        </div>
        <div style={{
          margin:"-10px auto 12px",
          maxWidth:360,
          background:"rgba(10,7,4,.72)",
          border:"1px solid rgba(212,175,55,.32)",
          borderRadius:22,
          padding:"12px 14px",
          color:"#FFF4D6",
          boxShadow:"0 12px 24px rgba(0,0,0,.25)"
        }}>
          <div style={{fontWeight:950,fontSize:compact?".94rem":"1.05rem",color:"#FFD66B"}}>Reserva, juega, descubre música y canjea recompensas.</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.32}}>Citas, tienda, arcade, rankings, noticias, música y avatar en una experiencia más viva.</div>
        </div>
        {user&&(
          <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <Badge col="gold">👑 {user.puntos||0} pts</Badge>
            <Badge col="green">🎮 Arcade activo</Badge>
          </div>
        )}
        {onNavigate&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            <button className="landing-nav-card" onClick={()=>onNavigate("citas")} style={{border:"1px solid rgba(212,175,55,.35)",borderRadius:18,padding:"11px 6px",background:"rgba(255,244,214,.08)",color:"#FFF4D6",fontWeight:950,cursor:"pointer"}}>
              <div style={{fontSize:"1.45rem"}}>📅</div><div style={{fontSize:".72rem"}}>Reserva</div>
            </button>
            <button className="landing-nav-card" onClick={()=>onNavigate("juegos")} style={{border:"1px solid rgba(212,175,55,.35)",borderRadius:18,padding:"11px 6px",background:"rgba(255,244,214,.08)",color:"#FFF4D6",fontWeight:950,cursor:"pointer"}}>
              <div style={{fontSize:"1.45rem"}}>🎮</div><div style={{fontSize:".72rem"}}>Juega</div>
            </button>
            <button className="landing-nav-card" onClick={()=>onNavigate("tienda")} style={{border:"1px solid rgba(212,175,55,.35)",borderRadius:18,padding:"11px 6px",background:"rgba(255,244,214,.08)",color:"#FFF4D6",fontWeight:950,cursor:"pointer"}}>
              <div style={{fontSize:"1.45rem"}}>🎁</div><div style={{fontSize:".72rem"}}>Premios</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// AUTH
function Auth({onLogin,showToast}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [formError,setFormError]=useState("");

  function showAuthError(msg){
    setFormError(msg);
    showToast(msg);
  }

  async function handleLogin(){
    if(!email||!pass){showAuthError("Rellena todos los campos");SFX.error();return;}
    if(!supabase){showAuthError("No se pudo conectar con Supabase");SFX.error();return;}
    setLoading(true);
    const cleanEmail=email.trim().toLowerCase();
    const {data,error}=await supabase.auth.signInWithPassword({email:cleanEmail,password:pass});
    if(error){setLoading(false);showAuthError(error.message || "Email o contraseña incorrectos");SFX.error();return;}
    let perfil=await getUserProfileByEmail(data.user?.email||cleanEmail);
    if(!perfil){
      perfil=await createUserProfile({nombre:data.user?.user_metadata?.nombre||cleanEmail.split("@")[0],email:cleanEmail});
    }
    setLoading(false);
    if(!perfil){showAuthError("No se pudo cargar tu perfil");SFX.error();return;}
    SFX.success();
    onLogin(toAppUser(perfil));
  }

  async function handleRegister(){
    if(!email||!pass||!name){showAuthError("Rellena todos los campos");SFX.error();return;}
    if(pass.length<6){showAuthError("La contraseña debe tener al menos 6 caracteres");SFX.error();return;}
    if(!supabase){showAuthError("No se pudo conectar con Supabase");SFX.error();return;}
    setLoading(true);
    const cleanEmail=email.trim().toLowerCase();
    const cleanName=name.trim();
    const {data,error}=await supabase.auth.signUp({
      email:cleanEmail,
      password:pass,
      options:{data:{nombre:cleanName}}
    });
    if(error){setLoading(false);showAuthError(error.message||"No se pudo registrar la cuenta");SFX.error();return;}
    let perfil=await getUserProfileByEmail(cleanEmail);
    if(!perfil){
      perfil=await createUserProfile({nombre:cleanName,email:cleanEmail});
    }
    setLoading(false);
    if(!perfil){showAuthError("Cuenta creada, pero no se pudo crear el perfil");SFX.error();return;}
    SFX.success();showToast(`Bienvenido a ${BRAND.name}!`);
    onLogin(toAppUser(perfil));
  }

  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(circle at 50% 12%,rgba(212,175,55,.22),transparent 30%),radial-gradient(circle at 12% 80%,rgba(47,107,66,.22),transparent 28%),radial-gradient(circle at 88% 76%,rgba(167,40,34,.18),transparent 26%),linear-gradient(180deg,#050403,#130B06 48%,#080604)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"18px 14px 28px",overflowX:"hidden"}}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480}}>
        <RastaLandingHero compact={false}/>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
          <LandingFeature icon="📅" title="Reservas" sub="Elige tratamientos y guarda tu cita." accent="#D4AF37"/>
          <LandingFeature icon="🎮" title="Juegos" sub="Arcade, récords, Top 10 y puntos." accent="#4F602D"/>
          <LandingFeature icon="🛍️" title="Tienda" sub="Canjea puntos por premios y extras." accent="#B99A45"/>
          <LandingFeature icon="🌐" title="Actualidad" sub="Noticias tipo shorts, debate y comunidad." accent="#263F4D"/>
          <div style={{gridColumn:"1 / -1"}}>
            <LandingFeature icon="🎧" title="Música" sub="Reggae, rap clásico, ska y rock para descubrir sin ruido comercial." accent="#4E3A76"/>
          </div>
        </div>

        <Card style={{padding:"22px 18px",animation:"softPop3d 0.42s ease",background:"linear-gradient(180deg,#FFF4D6 0%,#F0D69C 100%)",border:"2px solid #B99A45",boxShadow:"0 18px 40px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.75)"}}>
          <div style={{display:"flex",background:"rgba(36,17,10,.08)",borderRadius:14,padding:4,marginBottom:18}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setFormError("");}} style={{flex:1,padding:"10px 8px",borderRadius:12,border:"none",background:mode===m?"linear-gradient(180deg,#24110A,#6E3518)": "transparent",color:mode===m?T.white:T.g800,fontWeight:950,fontSize:"0.86rem",cursor:"pointer",transition:"all 0.2s"}}>
                {m==="login"?"Entrar":"Registrarse"}
              </button>
            ))}
          </div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800,marginBottom:4}}>{mode==="login"?"Entra al estudio":"Crea tu ficha de cliente"}</div>
          <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginBottom:14}}>
            {mode==="login"?"Vuelve a tus puntos, citas, juegos y comunidad.":"Regístrate para reservar, jugar, leer actualidad y desbloquear recompensas."}
          </div>
          {formError&&(
            <div style={{background:"#FFEBEE",border:"1.5px solid #8B0000",color:"#8B0000",borderRadius:12,padding:"10px 12px",fontWeight:800,fontSize:"0.82rem",marginBottom:14}}>
              {formError}
            </div>
          )}
          {mode==="login"?(
            <div>
              <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com"/>
              <Input label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••"/>
              <Btn full col="dark" onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar al estudio"}</Btn>
            </div>
          ):(
            <div>
              <Input label="Nombre completo" value={name} onChange={setName} placeholder="Tu nombre"/>
              <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com"/>
              <Input label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres"/>
              <Btn full col="green" onClick={handleRegister} disabled={loading}>{loading?"Registrando...":"Crear cuenta y entrar"}</Btn>
            </div>
          )}
        </Card>

        <div style={{textAlign:"center",color:"rgba(255,244,214,.84)",fontSize:".82rem",fontWeight:950,lineHeight:1.35,marginTop:16,padding:"12px 14px",border:"1px solid rgba(212,175,55,.25)",borderRadius:18,background:"rgba(255,244,214,.06)",boxShadow:"0 10px 22px rgba(0,0,0,.18)"}}>
          Forma parte de la comunidad Rasta Cuts: reserva, juega, participa y desbloquea recompensas.
        </div>
      </div>
    </div>
  );
}

function DashboardAdmin({user,showToast}){
  const [stats,setStats]=useState({citas:0,clientes:0,ingresos:0,stockBajo:0,pendientes:0,confirmadas:0});
  const [citasHoy,setCitasHoy]=useState([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const today=new Date().toISOString().split("T")[0];
    const [citas,clientes,ventas,stock]=await Promise.all([
      dbGet("citas",`?fecha=gte.${today}&order=fecha.asc,hora.asc&select=*`),
      dbGet("usuarios","?role=eq.client&select=id"),
      dbGet("cobros",`?fecha=gte.${today}&select=importe,estado`),
      dbGet("inventario","?stock=lte.5&select=id"),
    ]);
    const list=citas||[];
    setStats({
      citas:list.length,
      pendientes:list.filter(c=>String(c.estado||"pendiente").toLowerCase()==="pendiente").length,
      confirmadas:list.filter(c=>String(c.estado||"pendiente").toLowerCase()==="confirmada").length,
      clientes:(clientes||[]).length,
      ingresos:(ventas||[]).filter(v=>String(v.estado||"pagado").toLowerCase()!=="anulado").reduce((sum,v)=>sum+(Number(v.importe)||0),0),
      stockBajo:(stock||[]).length
    });
    setCitasHoy(list.slice(0,8));
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  async function updateCita(cita,patch,msg){
    const ok=await dbPatch("citas",`?id=eq.${cita.id}`,patch);
    if(ok){showToast?.(msg);SFX.success();await load();}
    else{showToast?.("No se pudo actualizar la cita");SFX.error();}
  }

  if(loading)return <Spinner/>;
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏠" title={`Resumen de gestión`} sub={new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <StatCard icon="📅" label="Próximas citas" value={stats.citas} col="green"/>
        <StatCard icon="🟡" label="Pendientes" value={stats.pendientes} col="gold"/>
        <StatCard icon="✅" label="Confirmadas" value={stats.confirmadas} col="blue"/>
        <StatCard icon="💰" label="Ingresos hoy" value={`${stats.ingresos.toFixed(2)}€`} col="gold"/>
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.2rem"}}>🧾</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1.02rem"}}>Inicio interno de gestión</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Aquí va el resumen que antes estaba en Inicio: próximas citas, estado, hora, precio y acciones rápidas.</div>
          </div>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:950,fontSize:"1rem",color:T.g800}}>📅 Próximas citas</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Fecha, hora, tratamientos, precio y gestión rápida.</div>
          </div>
          <Badge col={(stats.pendientes||0)?"gold":"green"}>{stats.pendientes||0} pendientes</Badge>
        </div>

        {citasHoy.length===0?<EmptyState icon="📅" title="Sin próximas citas" sub="No hay citas pendientes en la agenda próxima."/>
          :citasHoy.map(c=>{
            const st=String(c.estado||"pendiente").toLowerCase();
            const list=citaServices(c);
            const dur=citaDuration(list);
            const precio=Number(c.servicio_precio)||citaTotal(list);
            const fin=dur?endTime(c.hora,dur):"";
            const badgeCol=st==="pendiente"?"gold":st==="confirmada"?"green":st==="cancelada"?"red":"blue";
            return <div key={c.id} style={{padding:"12px 0",borderBottom:`1px solid ${T.g200}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:7}}>
                    <Badge col={badgeCol}>{st==="completada"?"realizada":st}</Badge>
                    <span style={{fontWeight:950,color:T.g800}}>👤 {c.cliente_nombre||"Cliente"}</span>
                  </div>
                  <div style={{fontSize:".86rem",fontWeight:950,color:T.g800}}>📆 {c.fecha||"sin fecha"} · 🕒 {c.hora||"sin hora"}{fin?` - ${fin}`:""}</div>
                  <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:5,lineHeight:1.35}}>✂️ {c.servicio_label||c.servicio||"Tratamiento"}{dur?` · ${formatDuration(dur)}`:""}{!!precio?` · ${precio}€`:""}</div>
                  {c.notas&&<div style={{marginTop:6,fontSize:".72rem",fontWeight:750,color:T.textSub,whiteSpace:"pre-wrap",lineHeight:1.35,maxHeight:54,overflow:"hidden"}}>{String(c.notas)}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                {st==="pendiente"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"confirmada"},"Cita confirmada")}>✅ Confirmar</Btn>}
                {["pendiente","confirmada","propuesta"].includes(st)&&<Btn small col="red" onClick={()=>updateCita(c,{estado:"cancelada"},"Cita cancelada")}>❌ Cancelar</Btn>}
                {["confirmada","propuesta"].includes(st)&&<Btn small col="dark" onClick={()=>updateCita(c,{estado:"completada"},"Cita marcada como realizada")}>🏁 Realizada</Btn>}
                {st==="cancelada"&&<Btn small col="gold" onClick={()=>updateCita(c,{estado:"pendiente"},"Cita reabierta")}>↩️ Reabrir</Btn>}
              </div>
            </div>;
          })
        }
      </Card>
    </div>
  );
}

// DASHBOARD CLIENTE
function ClientDashboard({user,onNavigate}){
  const [proxCita,setProxCita]=useState(null);
  const [noticias,setNoticias]=useState([]);
  useEffect(()=>{
    async function load(){
      const today=new Date().toISOString().split("T")[0];
      const [citas,news]=await Promise.all([
        dbGet("citas",`?usuario_id=eq.${user.id}&fecha=gte.${today}&order=fecha.asc&limit=1&select=*`),
        dbGet("publicaciones","?tipo=eq.correo&order=created_at.desc&limit=3&select=*"),
      ]);
      setProxCita(citas?.[0]||null);setNoticias(news||[]);
    }
    load();
  },[user.id]);
  const nivel=user.puntos>=1000?"VIP":user.puntos>=500?"Gold":user.puntos>=200?"Silver":"Bronze";
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <RastaLandingHero compact user={user} onNavigate={onNavigate}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        <LandingFeature icon="📰" title="Actualidad" sub="Noticias rápidas tipo shorts." accent="#263F4D"/>
        <LandingFeature icon="🎧" title="Música" sub="Reggae, rap clásico y novedades." accent="#4E3A76"/>
        <LandingFeature icon="🏆" title="Tops" sub="Rankings semanales y generales." accent="#D4AF37"/>
        <LandingFeature icon="💬" title="Comunidad" sub="Foro, tablón y comentarios." accent="#4F602D"/>
      </div>

      <Card style={{background:"linear-gradient(135deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.4)",marginBottom:16,padding:"18px",color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.78rem",fontWeight:800}}>Hola de nuevo</div>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.45rem",color:T.white}}>{user.nombre?.split(" ")[0]}</div>
            <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}><Badge col="gold">{nivel}</Badge><Badge col="green">{user.puntos||0} pts</Badge></div>
          </div>
          <Av av={user.avatar} config={user.avatarConfig||user.avatar_config} size={58}/>
        </div>
        <div style={{marginTop:14,height:8,background:"rgba(255,255,255,0.25)",borderRadius:50,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(((user.puntos||0)/1000)*100,100)}%`,background:"linear-gradient(90deg,#2F6B42,#D4AF37,#A72822)",borderRadius:50,transition:"width 0.6s ease"}}/>
        </div>
      </Card>

      {proxCita?(
        <Card style={{marginBottom:16,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div>
              <div style={{fontWeight:950,color:T.g800,marginBottom:6}}>📅 Tu próxima cita</div>
              <div style={{fontWeight:900,color:T.g700}}>{proxCita.servicio_label||proxCita.servicio}</div>
              <div style={{fontSize:"0.82rem",color:T.textSub,fontWeight:800,marginTop:2}}>{proxCita.fecha}</div>
            </div>
            <Badge col="green">{proxCita.hora}</Badge>
          </div>
        </Card>
      ):(
        <Card style={{marginBottom:16,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}} hover onClick={()=>onNavigate?.("citas")}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:"2rem"}}>📅</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:950,color:T.g800}}>Reserva tu próxima visita</div>
              <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub}}>Elige varios tratamientos y guarda tu cita en segundos.</div>
            </div>
            <Btn small col="gold" onClick={()=>onNavigate?.("citas")}>Reservar</Btn>
          </div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
        {[["📅","Cita","citas"],["🎮","Arcade","juegos"],["🎁","Tienda","tienda"]].map(([icon,lbl,id])=>(
          <Card key={lbl} onClick={()=>onNavigate?.(id)} style={{textAlign:"center",padding:"14px 8px",background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",minHeight:92,border:`1.5px solid ${T.g300}`}} hover>
            <div className="icon3d" style={{fontSize:"2rem"}}>{icon}</div>
            <div style={{fontSize:"0.75rem",fontWeight:950,color:T.g700,marginTop:6}}>{lbl}</div>
          </Card>
        ))}
      </div>

      <ActualidadMini onNavigate={onNavigate}/>

      {noticias.length>0&&(
        <div>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>Novedades de la tienda</div>
          {noticias.map(n=>(
            <Card key={n.id} style={{marginBottom:10,background:"linear-gradient(180deg,#FFF4D6,#F0D69C)"}} hover>
              <div style={{fontWeight:900,color:T.g800}}>{n.emoji} {n.titulo||n.contenido?.slice(0,40)}</div>
              <div style={{fontSize:"0.8rem",color:T.textSub,marginTop:4,fontWeight:800}}>{n.contenido}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// ACTUALIDAD MAGAZINE + COMUNIDAD
const NEWS_CATEGORIES=[
  {id:"todo",label:"Selección editorial",short:"Selección",icon:"✨",desc:"lo mejor para leer hoy"},
  {id:"curiosidades",label:"Curiosidades",short:"Curiosidades",icon:"💡",desc:"datos rápidos y sorprendentes"},
  {id:"rural",label:"Vida rural",short:"Rural",icon:"🌾",desc:"campo, granjas y producto local"},
  {id:"comer",label:"Comer bien",short:"Comer",icon:"🍽️",desc:"bares, restaurantes y gastronomía"},
  {id:"sitios",label:"Sitios con encanto",short:"Sitios",icon:"🏞️",desc:"planes, rutas y lugares bonitos"},
  {id:"estilo",label:"Pelo & rastas",short:"Estilo",icon:"✂️",desc:"peluquería, barbería y cuidado"},
  {id:"musica",label:"Reggae & rap clásico",short:"Música",icon:"🎧",desc:"Morodo, Pure Negga, Kase.O y rap de verdad"},
  {id:"negocios",label:"Negocios locales",short:"Negocios",icon:"💼",desc:"ideas, emprender y comercio cercano"},
];
const CATEGORY_COLORS={
  todo:{accent:"#B99A45",bg:"#E6CF9B",dark:"#4B301B"},
  curiosidades:{accent:"#6B4D8A",bg:"#D9C9A3",dark:"#332013"},
  rural:{accent:"#4F602D",bg:"#D8BE87",dark:"#26331D"},
  comer:{accent:"#8A5A2E",bg:"#E0C486",dark:"#4B301B"},
  sitios:{accent:"#3F6B3B",bg:"#D6C996",dark:"#26331D"},
  estilo:{accent:"#7A241B",bg:"#D8B58C",dark:"#42130F"},
  musica:{accent:"#4E3A76",bg:"#D2C292",dark:"#24110A"},
  negocios:{accent:"#263F4D",bg:"#D3C195",dark:"#17252D"},
};
const DAILY_CURIOSITIES=[
  {title:"Las rastas necesitan secado real",text:"Después de lavar, lo importante no es solo que se vean secas por fuera: si queda humedad dentro, pueden coger mal olor. Mejor secar con calma y sin prisas.",tag:"Rastas"},
  {title:"Un fade bueno se nota al crecer",text:"Un degradado bien hecho no solo queda limpio el primer día: al crecer durante la semana mantiene mejor la forma y evita saltos raros.",tag:"Barbería"},
  {title:"Un bar pequeño también puede ser marca",text:"Una carta corta, buen producto y una historia clara pueden hacer que un sitio de pueblo o barrio sea más recordable que un local enorme sin alma.",tag:"Negocio"},
  {title:"El producto local vende historia",text:"Un queso, un aceite, unos huevos o una conserva no son solo comida: también son zona, oficio, familia, paisaje y confianza.",tag:"Rural"},
  {title:"Los sitios bonitos enganchan más si son útiles",text:"Una ruta gana mucho si incluye dónde aparcar, dónde comer cerca y cuánto se tarda de verdad. Esa es la diferencia entre noticia y guía útil.",tag:"Planes"},
  {title:"La textura manda más que la moda",text:"Un corte que respeta la textura natural suele quedar mejor que copiar una tendencia que no encaja con tu pelo.",tag:"Estilo"},
  {title:"Comer bien también es descubrir barrio",text:"Muchas veces el sitio más interesante no es el más famoso, sino el bar pequeño donde hay buen producto y clientela de siempre.",tag:"Comer"},
  {title:"El campo también es negocio moderno",text:"Pequeñas granjas, huertos, obradores, venta directa y turismo rural pueden tener mucha fuerza si se cuentan bien y se mueven con una marca clara.",tag:"Rural"},
  {title:"El mantenimiento vende más que el cambio radical",text:"Muchos clientes no necesitan cambiar de estilo, sino mantenerlo bien: contornos, hidratación, limpieza y forma.",tag:"Marketing"},
  {title:"Un buen resumen no cuenta todo",text:"Para una noticia en una app, lo ideal es despertar interés, dar contexto rápido y mandar a la fuente original si quieres leer más.",tag:"Lectura"},
];
const NEWS_FALLBACK=[
  {id:"fallback-sitios-1",title:"Sitios con encanto para guardar y visitar sin complicarse",summary:"Miradores, pueblos bonitos, rutas cortas y paradas con buen ambiente. Una sección pensada para encontrar planes reales, no solo titulares.",url:"https://www.google.com/search?q=sitios+con+encanto+Arag%C3%B3n+Navarra+rutas+pueblos+bonitos",image:"",source:"Selección",category:"sitios",date:new Date().toISOString()},
  {id:"fallback-comer-1",title:"Bares y restaurantes con producto local que merecen ficha",summary:"Ideas para descubrir sitios donde comer bien: tapas, menús, cocina de cercanía, terrazas y lugares con historia.",url:"https://www.google.com/search?q=bares+restaurantes+producto+local+Zaragoza+Navarra+Arag%C3%B3n",image:"",source:"Selección",category:"comer",date:new Date().toISOString()},
  {id:"fallback-rural-1",title:"Pequeñas granjas, huertos y negocios de pueblo con futuro",summary:"Campo, agricultura, venta directa, obradores y proyectos rurales contados desde una mirada útil e inspiradora.",url:"https://www.google.com/search?q=agricultura+granjas+negocios+rurales+Arag%C3%B3n+Navarra",image:"",source:"Selección rural",category:"rural",date:new Date().toISOString()},
  {id:"fallback-estilo-1",title:"Rastas, barba y corte: mantenimiento que se nota",summary:"Consejos e ideas de estilo para que el pelo, la barba o las rastas no dependan solo del primer día de peluquería.",url:"https://www.google.com/search?q=cuidados+rastas+barba+corte+pelo",image:"",source:"Selección estilo",category:"estilo",date:new Date().toISOString()},
  {id:"fallback-negocios-1",title:"Ideas de negocio local que pueden inspirar a pequeños comercios",summary:"Marketing sencillo, comunidad, reservas, fidelización y contenido útil para que un negocio pequeño parezca más vivo y cercano.",url:"https://www.google.com/search?q=ideas+negocio+local+peque%C3%B1o+comercio+marketing",image:"",source:"Selección negocios",category:"negocios",date:new Date().toISOString()},
];
function getDailyCuriosity(){
  const day=Math.floor(Date.now()/86400000);
  return DAILY_CURIOSITIES[day%DAILY_CURIOSITIES.length];
}
function formatNewsDate(date){
  try{return new Date(date).toLocaleDateString("es-ES",{day:"2-digit",month:"short"});}catch{return "";}
}
function categoryInfo(id){return NEWS_CATEGORIES.find(c=>c.id===id)||NEWS_CATEGORIES[0];}
function categoryVisual(id){return CATEGORY_COLORS[id]||CATEGORY_COLORS.todo;}
function lightHash(str=""){
  let h=2166136261;
  for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function dailyOrderedList(list=[],key="daily",extra=0){
  const day=new Date().toISOString().split("T")[0];
  return [...(Array.isArray(list)?list:[])]
    .map((item,i)=>({item,sort:lightHash(`${day}_${key}_${extra}_${item?.id||item?.artist||i}`)}))
    .sort((a,b)=>a.sort-b.sort)
    .map(x=>x.item);
}

function newsTimeSlot(){
  const h=new Date().getHours();
  if(h<7)return "madrugada";
  if(h<13)return "mañana";
  if(h<18)return "tarde";
  return "noche";
}
async function fetchNews(category="todo",seed=0,slot=newsTimeSlot()){
  const day=new Date().toISOString().split("T")[0];
  const res=await fetch(`/api/news?category=${encodeURIComponent(category)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}&seed=${encodeURIComponent(seed)}&limit=28`);
  const data=await res.json();
  const items=Array.isArray(data.news)?data.news:[];
  const fallback=category==="todo"?NEWS_FALLBACK:NEWS_FALLBACK.filter(n=>n.category===category);
  return items.length?dailyOrderedList(items,`news_${category}_${slot}`,seed):dailyOrderedList(fallback.length?fallback:NEWS_FALLBACK,`fallback_news_${category}_${slot}`,seed);
}
function trimSummary(text=""){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  if(!clean)return "Resumen breve no disponible. Pulsa para leer la fuente original.";
  return clean.length>185?`${clean.slice(0,182).trim()}...`:clean;
}
function newsIconFor(cat){return categoryInfo(cat).icon;}
const NEWS_POSTERS={
  todo:{title:"Selección",sub:"Lo mejor para leer hoy",icons:["✨","📰","🧭"]},
  curiosidades:{title:"Curiosidad",sub:"Algo rápido para aprender",icons:["💡","🔎","📜"]},
  rural:{title:"Vida rural",sub:"Campo, oficio y producto local",icons:["🌾","🥚","🧀"]},
  comer:{title:"Comer bien",sub:"Bares, tapas y producto cercano",icons:["🍽️","🔥","🍷"]},
  sitios:{title:"Sitios",sub:"Rutas, pueblos y escapadas",icons:["🏞️","🧭","🏰"]},
  estilo:{title:"Estilo",sub:"Pelo, barba y rastas",icons:["✂️","🪮","🧔"]},
  musica:{title:"Reggae & rap",sub:"Temas, videoclips y directos",icons:["🎧","🎤","▶️"]},
  negocios:{title:"Negocio local",sub:"Ideas para vender mejor",icons:["💼","📣","🤝"]},
};
function CategoryNewsPoster({catId,featured=false}){
  const cat=categoryInfo(catId),visual=categoryVisual(catId),poster=NEWS_POSTERS[catId]||NEWS_POSTERS.todo;
  return <div style={{height:featured?210:178,position:"relative",overflow:"hidden",borderRadius:"18px 18px 0 0",background:`radial-gradient(circle at 18% 16%,rgba(240,224,184,.34),transparent 30%),radial-gradient(circle at 86% 18%,rgba(19,11,6,.18),transparent 28%),linear-gradient(145deg,${visual.bg},${T.panel2})`,borderBottom:`1px solid ${T.g300}`}}>
    <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,rgba(19,11,6,.035) 0 1px,transparent 1px 7px)"}}/>
    <div style={{position:"absolute",right:-16,top:-18,fontSize:featured?"6.8rem":"5.3rem",opacity:.12,transform:"rotate(-10deg)"}}>{poster.icons[0]}</div>
    <div style={{position:"absolute",left:18,top:18,display:"flex",gap:8}}>{poster.icons.map((ic,i)=><span key={ic+i} style={{width:i===0?48:38,height:i===0?48:38,borderRadius:16,display:"grid",placeItems:"center",background:i===0?visual.accent:"rgba(255,244,214,.62)",color:"#FFF8E5",fontSize:i===0?"1.55rem":"1.15rem",boxShadow:"0 8px 16px rgba(18,8,4,.18)",border:"1px solid rgba(255,244,214,.35)"}}>{ic}</span>)}</div>
    <div style={{position:"absolute",left:18,right:18,bottom:18}}>
      <div style={{fontFamily:"'Pirata One',cursive",fontSize:featured?"1.55rem":"1.28rem",lineHeight:1,color:visual.dark,textShadow:"0 1px 0 rgba(255,244,214,.55)"}}>{poster.title}</div>
      <div style={{fontSize:".78rem",fontWeight:950,color:T.textSub,marginTop:4}}>{poster.sub}</div>
      <div style={{marginTop:9,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(19,11,6,.12)",border:`1px solid ${T.g300}`,borderRadius:999,padding:"5px 10px",fontSize:".7rem",fontWeight:950,color:visual.dark}}>{cat.icon} {cat.label}</div>
    </div>
  </div>;
}
function safeAvatarJson(cfg){try{return cfg?JSON.parse(JSON.stringify(cfg)):null;}catch{return null;}}
async function grantNewsPoints({user,setUser,showToast,showPoints,eventKey,points,description}){
  if(!user?.id||!points)return false;
  try{
    const {error:evError}=await supabase.from("news_point_events").insert({usuario_id:String(user.id),event_key:eventKey,puntos:points,descripcion:description});
    if(evError){
      if(String(evError.code)==="23505") return false;
      console.warn("news_point_events error",evError);
      return false;
    }
    const nuevos=(user.puntos||0)+points;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser?.(u=>({...u,puntos:nuevos}));
    showPoints?.(points);SFX.coins();showToast?.(`${description} +${points} pts`);
    return true;
  }catch(e){console.warn("No se pudieron dar puntos de actualidad",e);return false;}
}
function NewsCard({item,compact=false,featured=false,onOpen,stats=null}){
  const openNews=()=>{SFX.click();onOpen?.(item);};
  const cat=categoryInfo(item?.category);
  const visual=categoryVisual(item?.category);
  const hasImage=Boolean(item?.image);
  const title=item?.title||"Contenido destacado";
  const summary=trimSummary(item?.summary);
  const showYoutube=Boolean(item?.youtubeUrl||item?.category==="musica");
  const ytUrl=item?.youtubeUrl||`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} oficial`)}`;
  const openSource=(e)=>{e.stopPropagation();SFX.action();if(item?.url)window.open(item.url,"_blank","noopener,noreferrer");else openNews();};
  const openYoutube=(e)=>{e.stopPropagation();SFX.action();window.open(ytUrl,"_blank","noopener,noreferrer");};
  const poster=hasImage?(
    <div style={{height:featured?218:188,position:"relative",overflow:"hidden",borderRadius:"18px 18px 0 0",backgroundImage:`linear-gradient(180deg,rgba(19,11,6,.02) 0%,rgba(19,11,6,.08) 48%,rgba(19,11,6,.62) 100%), url(${item.image})`,backgroundSize:"cover",backgroundPosition:"center",borderBottom:`1px solid ${T.g300}`}}>
      <div style={{position:"absolute",left:12,top:12,display:"flex",gap:6,flexWrap:"wrap"}}>
        <span style={{background:visual.accent,color:"#FFF8E5",borderRadius:999,padding:"5px 10px",fontSize:".7rem",fontWeight:950,boxShadow:"0 8px 16px rgba(18,8,4,.24)"}}>{cat.icon} {cat.short}</span>
        <span style={{background:"rgba(19,11,6,.58)",color:T.white,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:950,backdropFilter:"blur(4px)"}}>{formatNewsDate(item?.date)}</span>
      </div>
      <div style={{position:"absolute",left:12,right:12,bottom:12,display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:8}}>
        <div style={{maxWidth:"70%",fontSize:".72rem",fontWeight:950,color:T.white,textShadow:"0 2px 8px rgba(0,0,0,.45)",lineHeight:1.15}}>{item?.source||"Fuente"}</div>
        <div style={{display:"flex",gap:6}}><span style={{background:"rgba(255,244,214,.84)",color:T.g800,borderRadius:999,padding:"5px 8px",fontSize:".7rem",fontWeight:950}}>👍 {stats?.likes||0}</span><span style={{background:"rgba(255,244,214,.84)",color:T.g800,borderRadius:999,padding:"5px 8px",fontSize:".7rem",fontWeight:950}}>💬 {stats?.comments||0}</span></div>
      </div>
    </div>
  ):<CategoryNewsPoster catId={item?.category||"todo"} featured={featured}/>;
  return <Card onClick={openNews} hover style={{marginBottom:14,padding:0,overflow:"hidden",background:T.panel,border:`2px solid ${featured?visual.accent:T.g300}`,boxShadow:featured?"0 16px 34px rgba(18,8,4,.26)":"0 10px 22px rgba(18,8,4,.20)",borderRadius:22}}>
    {poster}
    <div style={{padding:"13px 14px 14px"}}>
      {!hasImage&&<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
        <span style={{background:visual.accent,color:"#FFF8E5",borderRadius:999,padding:"4px 9px",fontSize:".66rem",fontWeight:950}}>{cat.icon} {cat.short}</span>
        <span style={{background:"rgba(19,11,6,.08)",color:T.g700,border:`1px solid ${T.g200}`,borderRadius:999,padding:"4px 8px",fontSize:".66rem",fontWeight:900}}>{item?.source||"Fuente"}</span>
        <span style={{fontSize:".68rem",fontWeight:900,color:T.textSub,marginLeft:"auto"}}>{formatNewsDate(item?.date)}</span>
      </div>}
      <div style={{fontWeight:950,color:T.g900,fontSize:featured?"1.18rem":"1rem",lineHeight:1.17,letterSpacing:"-.12px",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{title}</div>
      <div style={{fontSize:".84rem",fontWeight:750,color:T.textSub,lineHeight:1.42,marginTop:8,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{summary}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <button onClick={openNews} style={{border:"none",background:visual.accent,color:"#FFF8E5",borderRadius:999,padding:"8px 12px",fontWeight:950,fontSize:".78rem",cursor:"pointer",boxShadow:"0 7px 14px rgba(18,8,4,.18)"}}>Leer</button>
          {showYoutube&&<button onClick={openYoutube} style={{border:`1px solid ${T.g300}`,background:"#7A241B",color:"#FFF8E5",borderRadius:999,padding:"8px 11px",fontWeight:950,fontSize:".78rem",cursor:"pointer"}}>▶ YouTube</button>}
          {item?.url&&<button onClick={openSource} style={{border:`1px solid ${T.g300}`,background:"rgba(255,244,214,.52)",color:T.g800,borderRadius:999,padding:"8px 10px",fontWeight:950,fontSize:".76rem",cursor:"pointer"}}>Fuente ↗</button>}
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",marginLeft:"auto"}}>
          <span style={{fontSize:".72rem",fontWeight:950,color:T.g700}}>👍 {stats?.likes||0}</span>
          <span style={{fontSize:".72rem",fontWeight:950,color:T.g700}}>💬 {stats?.comments||0}</span>
        </div>
      </div>
    </div>
  </Card>;
}

function NewsShortCard({item,index=0,total=0,onOpen,stats=null}){
  const cat=categoryInfo(item?.category);
  const visual=categoryVisual(item?.category);
  const poster=NEWS_POSTERS[item?.category]||NEWS_POSTERS.todo;
  const title=item?.title||"Contenido destacado";
  const summary=trimSummary(item?.summary);
  const hasImage=Boolean(item?.image);
  const showYoutube=Boolean(item?.youtubeUrl||item?.category==="musica");
  const ytUrl=item?.youtubeUrl||`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} oficial`)}`;
  const openDetail=(e)=>{e?.stopPropagation?.();SFX.click();onOpen?.(item);};
  const openSource=(e)=>{e.stopPropagation();SFX.action();if(item?.url)window.open(item.url,"_blank","noopener,noreferrer");else openDetail(e);};
  const openYoutube=(e)=>{e.stopPropagation();SFX.action();window.open(ytUrl,"_blank","noopener,noreferrer");};
  const bg=hasImage
    ? `linear-gradient(180deg,rgba(12,6,3,.08) 0%,rgba(12,6,3,.16) 36%,rgba(12,6,3,.88) 100%), url(${item.image})`
    : `radial-gradient(circle at 18% 10%,rgba(240,224,184,.32),transparent 30%),radial-gradient(circle at 86% 18%,${visual.accent}44,transparent 34%),linear-gradient(160deg,${visual.dark},#130B06 52%,${visual.bg})`;
  return <div className="news-short studio-panel" onClick={openDetail} style={{height:"100%",minHeight:"100%",maxHeight:"none",borderRadius:0,overflow:"hidden",position:"relative",backgroundImage:bg,backgroundSize:"cover",backgroundPosition:"center",border:"none",boxShadow:"none",marginBottom:0,cursor:"pointer"}}>
    {!hasImage&&<>
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,rgba(240,224,184,.055) 0 1px,transparent 1px 7px)"}}/>
      <div style={{position:"absolute",right:-12,top:56,fontSize:"9.2rem",opacity:.14,filter:"drop-shadow(0 10px 14px rgba(0,0,0,.35))",transform:"rotate(-8deg)"}}>{poster.icons?.[0]||cat.icon}</div>
      <div style={{position:"absolute",left:22,top:108,width:128,height:128,borderRadius:32,display:"grid",placeItems:"center",fontSize:"4.4rem",background:"rgba(240,224,184,.18)",border:"1px solid rgba(240,224,184,.24)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.16),0 18px 30px rgba(0,0,0,.22)"}}>{poster.icons?.[0]||cat.icon}</div>
    </>}
    <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,.10) 0%,rgba(0,0,0,.08) 38%,rgba(0,0,0,.54) 68%,rgba(0,0,0,.82) 100%)"}}/>
    <div style={{position:"absolute",left:14,right:14,top:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:7,background:visual.accent,color:"#FFF8E5",borderRadius:999,padding:"8px 12px",fontSize:".78rem",fontWeight:950,boxShadow:"0 10px 20px rgba(0,0,0,.28)",border:"1px solid rgba(255,244,214,.24)"}}>{cat.icon} {cat.short}</span>
      <span style={{background:"rgba(12,6,3,.55)",color:T.white,border:"1px solid rgba(255,244,214,.18)",borderRadius:999,padding:"7px 10px",fontSize:".72rem",fontWeight:950,backdropFilter:"blur(5px)"}}>{index+1}/{total}</span>
    </div>
    <div style={{position:"absolute",right:12,bottom:170,display:"grid",gap:10,justifyItems:"center"}}>
      <button onClick={openDetail} style={{width:48,height:48,borderRadius:"50%",border:"1px solid rgba(255,244,214,.35)",background:"rgba(240,224,184,.88)",color:T.g900,fontSize:"1rem",fontWeight:950,boxShadow:"0 8px 18px rgba(0,0,0,.26)",cursor:"pointer"}}>💬</button>
      <div style={{fontSize:".72rem",fontWeight:950,color:T.white,textShadow:"0 2px 8px rgba(0,0,0,.75)"}}>{stats?.comments||0}</div>
      <div style={{width:48,height:48,borderRadius:"50%",display:"grid",placeItems:"center",border:"1px solid rgba(255,244,214,.35)",background:"rgba(240,224,184,.88)",color:T.g900,fontSize:"1rem",fontWeight:950,boxShadow:"0 8px 18px rgba(0,0,0,.26)"}}>👍</div>
      <div style={{fontSize:".72rem",fontWeight:950,color:T.white,textShadow:"0 2px 8px rgba(0,0,0,.75)"}}>{stats?.likes||0}</div>
    </div>
    <div style={{position:"absolute",left:15,right:15,bottom:38,color:T.white}}>
      {index===0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(240,224,184,.16)",border:"1px solid rgba(240,224,184,.22)",borderRadius:999,padding:"6px 10px",fontSize:".72rem",fontWeight:950,marginBottom:10,backdropFilter:"blur(4px)"}}>⬆️ Desliza para pasar noticia</div>}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,opacity:.9}}>
        <span style={{fontSize:".72rem",fontWeight:950,textTransform:"uppercase",letterSpacing:".45px",color:"rgba(255,244,214,.86)"}}>{item?.source||cat.label}</span>
        <span style={{width:5,height:5,borderRadius:"50%",background:"rgba(255,244,214,.6)"}}/>
        <span style={{fontSize:".72rem",fontWeight:900,color:"rgba(255,244,214,.78)"}}>{formatNewsDate(item?.date)}</span>
      </div>
      <div className="news-short-title" style={{fontFamily:"'Pirata One',cursive",fontSize:"2.05rem",lineHeight:.96,textShadow:"0 3px 12px rgba(0,0,0,.72)",paddingRight:54}}>{title}</div>
      <div className="news-short-summary" style={{fontSize:".96rem",fontWeight:820,lineHeight:1.34,color:"rgba(255,244,214,.9)",marginTop:9,paddingRight:46,textShadow:"0 2px 9px rgba(0,0,0,.7)"}}>{summary}</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:12,paddingRight:10}}>
        <button onClick={openDetail} style={{border:"none",borderRadius:999,padding:"10px 14px",fontWeight:950,fontSize:".82rem",color:"#FFF8E5",background:visual.accent,boxShadow:"0 9px 18px rgba(0,0,0,.28)",cursor:"pointer"}}>Abrir debate</button>
        {showYoutube&&<button onClick={openYoutube} style={{border:"1px solid rgba(255,244,214,.28)",borderRadius:999,padding:"10px 13px",fontWeight:950,fontSize:".82rem",color:"#FFF8E5",background:"#7A241B",boxShadow:"0 8px 16px rgba(0,0,0,.24)",cursor:"pointer"}}>▶ YouTube</button>}
        {item?.url&&<button onClick={openSource} style={{border:"1px solid rgba(255,244,214,.30)",borderRadius:999,padding:"10px 12px",fontWeight:950,fontSize:".8rem",color:T.g900,background:"rgba(240,224,184,.90)",boxShadow:"0 8px 16px rgba(0,0,0,.22)",cursor:"pointer"}}>Fuente ↗</button>}
      </div>
    </div>
  </div>;
}

function NewsDetailModal({item,user,setUser,showToast,showPoints,onClose,onChanged}){
  const [comments,setComments]=useState([]);
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const cat=categoryInfo(item?.category);
  const visual=categoryVisual(item?.category);
  useEffect(()=>{if(item)load();},[item?.id]);
  async function load(){
    if(!item?.id)return;
    try{
      const [{data:cs},{data:ls},{data:mine}]=await Promise.all([
        supabase.from("news_comments").select("*").eq("news_id",String(item.id)).order("created_at",{ascending:true}),
        supabase.from("news_likes").select("id",{count:"exact"}).eq("news_id",String(item.id)),
        supabase.from("news_likes").select("id").eq("news_id",String(item.id)).eq("usuario_id",String(user.id)).maybeSingle()
      ]);
      setComments(Array.isArray(cs)?cs:[]);setLikes(Array.isArray(ls)?ls.length:0);setLiked(Boolean(mine));
    }catch(e){console.warn(e);}
  }
  async function like(){
    if(!item?.id||liked)return;
    setLoading(true);
    try{
      const {error}=await supabase.from("news_likes").insert({news_id:String(item.id),news_title:item.title,news_url:item.url,news_category:item.category,usuario_id:String(user.id),usuario_nombre:user.nombre});
      if(error){showToast?.("Ya habías marcado esta noticia o falta ejecutar el SQL.");setLoading(false);return;}
      setLiked(true);setLikes(n=>n+1);onChanged?.(item.id,"like");
      await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:`news_like:${item.id}`,points:1,description:"Primer like en esta noticia"});
    }finally{setLoading(false);}
  }
  async function sendComment(){
    const clean=text.trim();
    if(!clean){showToast?.("Escribe un comentario");return;}
    setLoading(true);
    try{
      const hadComment=comments.some(c=>String(c.usuario_id)===String(user.id));
      const row={news_id:String(item.id),news_title:item.title,news_url:item.url,news_category:item.category,usuario_id:String(user.id),usuario_nombre:user.nombre,usuario_avatar:user.avatar||0,usuario_avatar_config:safeAvatarJson(user.avatarConfig||user.avatar_config),contenido:clean};
      const {data,error}=await supabase.from("news_comments").insert(row).select("*").single();
      if(error){showToast?.("No se pudo comentar. Revisa que hayas ejecutado el SQL de actualidad.");setLoading(false);return;}
      setComments(c=>[...c,data]);setText("");onChanged?.(item.id,"comment");SFX.success();showToast?.("Comentario publicado");
      if(!hadComment){
        await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:`news_comment:${item.id}`,points:3,description:"Primer comentario en esta noticia"});
        const {data:mine}=await supabase.from("news_comments").select("news_id").eq("usuario_id",String(user.id));
        const distinct=new Set((mine||[]).map(x=>String(x.news_id))).size;
        if(distinct>=3) await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:"news_comment_milestone_3",points:8,description:"Has comentado 3 noticias distintas"});
        if(distinct>=10) await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:"news_comment_milestone_10",points:20,description:"Has comentado 10 noticias distintas"});
      }
    }finally{setLoading(false);}
  }
  if(!item)return null;
  return <Modal show={!!item} onClose={onClose} title="Detalle de actualidad">
    <div>
      <div style={{background:visual.bg,border:`2px solid ${visual.accent}`,borderRadius:22,padding:14,marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><Badge col="gold">{cat.icon} {cat.label}</Badge><Badge col="green">{item.source||"Fuente"}</Badge></div>
        <div style={{fontWeight:950,color:T.g900,fontSize:"1.2rem",lineHeight:1.18}}>{item.title}</div>
        <div style={{fontSize:".86rem",fontWeight:750,color:T.textSub,lineHeight:1.42,marginTop:8}}>{trimSummary(item.summary)}</div>
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          <Btn small col="gold" onClick={()=>window.open(item.url,"_blank","noopener,noreferrer")}>Leer fuente original ↗</Btn>
          {item?.youtubeUrl&&<Btn small col="red" onClick={()=>window.open(item.youtubeUrl,"_blank","noopener,noreferrer")}>▶ Buscar en YouTube</Btn>}
          <Btn small col={liked?"ghost":"dark"} disabled={loading||liked} onClick={like}>{liked?"👍 Te gusta":"👍 Me gusta"}</Btn>
        </div>
        <div style={{display:"flex",gap:10,marginTop:10,fontSize:".75rem",fontWeight:900,color:T.g700}}><span>👍 {likes}</span><span>💬 {comments.length}</span><span>{formatNewsDate(item.date)}</span></div>
      </div>
      <Card style={{marginBottom:12,background:T.panel}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:7}}>Unirse al hilo</div>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Comenta algo útil: recomendación, experiencia, sitio parecido, opinión o dato que ayude a otros." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"11px 12px",background:T.g50,resize:"none",outline:"none",fontSize:".9rem",fontWeight:750,color:T.text}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:9}}><div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>+5 pts por tu primer comentario en esta noticia. Bonos al comentar 3 y 10 noticias distintas.</div><Btn small onClick={sendComment} disabled={loading}>Comentar</Btn></div>
      </Card>
      <div style={{fontWeight:950,color:T.g800,margin:"4px 0 10px"}}>Comentarios</div>
      {comments.length===0?<EmptyState icon="💬" title="Sin comentarios todavía" sub="Sé el primero en abrir el hilo."/>:comments.map(c=><Card key={c.id} style={{marginBottom:9,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)"}}>
        <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:7}}><PublicAvatar profile={{...c,nombre:c.usuario_nombre,avatar:c.usuario_avatar,avatar_config:c.usuario_avatar_config,perfil_publico:c.perfil_publico,modo_incognito:c.modo_incognito}} size={32}/><div><div style={{fontWeight:950,color:T.g800,fontSize:".86rem"}}>{publicName({nombre:c.usuario_nombre,perfil_publico:c.perfil_publico,modo_incognito:c.modo_incognito})}</div><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>{formatNewsDate(c.created_at)}</div></div></div>
        <div style={{fontSize:".88rem",fontWeight:750,color:T.text,lineHeight:1.45,whiteSpace:"pre-wrap"}}>{c.contenido}</div>
      </Card>)}
    </div>
  </Modal>;
}
function ActualidadMini({onNavigate}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const curiosity=getDailyCuriosity();
  useEffect(()=>{
    let alive=true;
    async function load(){
      setLoading(true);
      try{const list=await fetchNews("todo",0,"mini");if(alive)setItems(list.slice(0,3));}
      catch(e){if(alive)setItems(NEWS_FALLBACK);}
      finally{if(alive)setLoading(false);}
    }
    load();return()=>{alive=false;};
  },[]);
  const first=items[0];
  const rest=items.slice(1,3);
  return <Card style={{marginBottom:16,padding:0,overflow:"hidden",background:"linear-gradient(160deg,#FFF8E5,#F6E5BE 62%,#E6C27A)",border:`2px solid ${T.g300}`}}>
    <div style={{padding:"16px",background:"radial-gradient(circle at 8% 10%,rgba(212,175,55,.30),transparent 30%),linear-gradient(135deg,rgba(36,17,10,.08),rgba(255,244,214,.58))"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div>
          <div style={{fontSize:".72rem",fontWeight:950,color:T.g600,letterSpacing:".5px",textTransform:"uppercase"}}>Magazine de comunidad</div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800,lineHeight:1}}>📰 Actualidad</div>
          <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.32}}>Curiosidades, rural, comer, sitios, estilo y negocios. Para leer, comentar y guardar ideas.</div>
        </div>
        <Btn small col="ghost" onClick={()=>onNavigate?.("noticias")}>Ver más</Btn>
      </div>
    </div>
    <div style={{padding:"12px 14px 6px"}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",background:"rgba(255,248,225,.78)",border:`1px dashed ${T.g400}`,borderRadius:18,padding:12,marginBottom:12}}>
        <div style={{fontSize:"1.45rem",lineHeight:1}}>💡</div>
        <div><div style={{fontWeight:950,color:T.g800,fontSize:".9rem"}}>{curiosity.title}</div><div style={{fontSize:".78rem",fontWeight:750,color:T.textSub,lineHeight:1.35,marginTop:3}}>{curiosity.text}</div></div>
      </div>
      {loading?<Spinner/>:<>
        {first&&<NewsCard item={first} compact featured onOpen={()=>onNavigate?.("noticias")}/>} 
        {rest.map(n=><NewsCard key={n.id} item={n} compact onOpen={()=>onNavigate?.("noticias")}/>)}</>}
    </div>
  </Card>;
}

function Noticias({user,setUser,showToast,showPoints}){
  const [category,setCategory]=useState("todo");
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(null);
  const [stats,setStats]=useState({});
  const [refreshSeed,setRefreshSeed]=useState(0);

  useEffect(()=>{
    let alive=true;
    async function load(){
      setLoading(true);setError("");
      try{
        const list=await fetchNews(category,refreshSeed);
        if(alive){setItems(list);loadStats(list);}
      }catch(e){
        const fallback=category==="todo"?NEWS_FALLBACK:NEWS_FALLBACK.filter(n=>n.category===category);
        if(alive){const final=dailyOrderedList(fallback.length?fallback:NEWS_FALLBACK,`fallback_news_${category}_${newsTimeSlot()}`,refreshSeed);setItems(final);loadStats(final);setError("No se han podido cargar todas las fuentes. Te dejo una selección de respaldo.");}
      }finally{if(alive)setLoading(false);}
    }
    load();return()=>{alive=false;};
  },[category,refreshSeed]);

  async function loadStats(list=items){
    const ids=[...new Set((list||[]).map(n=>String(n.id)).filter(Boolean))];
    if(!ids.length)return;
    try{
      const [{data:cs},{data:ls}]=await Promise.all([
        supabase.from("news_comments").select("news_id").in("news_id",ids),
        supabase.from("news_likes").select("news_id").in("news_id",ids)
      ]);
      const next={};ids.forEach(id=>next[id]={comments:0,likes:0});
      (cs||[]).forEach(c=>{const id=String(c.news_id);next[id]={...(next[id]||{}),comments:(next[id]?.comments||0)+1,likes:next[id]?.likes||0};});
      (ls||[]).forEach(l=>{const id=String(l.news_id);next[id]={...(next[id]||{}),likes:(next[id]?.likes||0)+1,comments:next[id]?.comments||0};});
      setStats(next);
    }catch(e){console.warn("stats actualidad",e);}
  }

  function reload(){
    SFX.action();
    showToast?.("Buscando selección nueva...");
    setRefreshSeed(v=>v+1);
  }

  function bumpStat(newsId,type){
    setStats(s=>({...s,[newsId]:{comments:(s[newsId]?.comments||0)+(type==="comment"?1:0),likes:(s[newsId]?.likes||0)+(type==="like"?1:0)}}));
  }

  const active=categoryInfo(category);
  const visual=categoryVisual(category);
  const reelItems=items.slice(0,24);

  return <div style={{animation:"fadeSlide .25s ease",margin:"-18px -14px -18px",height:"calc(100dvh - 126px)",minHeight:560,position:"relative",overflow:"hidden",background:`linear-gradient(180deg,${visual.dark},#120806 52%,#0B0503)`,borderTop:`1px solid ${visual.accent}66`}}>
    <div style={{position:"absolute",left:0,right:0,top:0,zIndex:20,padding:"10px 10px 8px",background:"linear-gradient(180deg,rgba(8,4,2,.82),rgba(8,4,2,.42),transparent)",pointerEvents:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8,pointerEvents:"auto"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:".62rem",fontWeight:950,letterSpacing:".8px",textTransform:"uppercase",color:"rgba(240,224,184,.72)"}}>Actualidad · desliza arriba</div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.32rem",lineHeight:1,color:T.white,textShadow:"0 3px 10px rgba(0,0,0,.55)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{active.icon} {active.short}</div>
        </div>
        <button onClick={reload} style={{border:"1px solid rgba(240,224,184,.30)",background:"rgba(240,224,184,.16)",color:T.white,borderRadius:999,padding:"8px 11px",fontWeight:950,fontSize:".78rem",backdropFilter:"blur(8px)",cursor:"pointer"}}>🔄</button>
      </div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:3,scrollbarWidth:"none",pointerEvents:"auto"}}>
        {NEWS_CATEGORIES.map(c=>{
          const selectedCat=category===c.id,cv=categoryVisual(c.id);
          return <button key={c.id} onClick={()=>{SFX.tab();setCategory(c.id);}} style={{flex:"0 0 auto",whiteSpace:"nowrap",border:`1.5px solid ${selectedCat?cv.accent:"rgba(240,224,184,.20)"}`,background:selectedCat?cv.accent:"rgba(12,6,3,.48)",color:T.white,borderRadius:999,padding:"7px 9px",fontWeight:950,fontSize:".74rem",cursor:"pointer",boxShadow:selectedCat?"0 8px 18px rgba(0,0,0,.28)":"none",backdropFilter:"blur(8px)"}}>
            <span style={{fontSize:".95rem",marginRight:4}}>{c.icon}</span>{c.short}
          </button>;
        })}
      </div>
    </div>

    {error&&<div style={{position:"absolute",left:12,right:12,top:104,zIndex:25,background:"rgba(232,211,162,.92)",border:`1px solid ${T.orange}`,borderRadius:16,padding:10,boxShadow:"0 10px 24px rgba(0,0,0,.25)"}}><div style={{fontWeight:950,color:T.g800,fontSize:".82rem"}}>Aviso</div><div style={{fontSize:".76rem",fontWeight:750,color:T.textSub}}>{error}</div></div>}

    {loading?<div style={{height:"100%",display:"grid",placeItems:"center"}}><Spinner/></div>:reelItems.length===0?<div style={{height:"100%",display:"grid",placeItems:"center",padding:20}}><EmptyState icon="📰" title="No hay selección ahora" sub="Prueba otra categoría o actualiza en unos minutos."/></div>:
      <div className="news-reel" style={{height:"100%",width:"100%"}}>
        {reelItems.map((n,i)=><NewsShortCard key={n.id||i} item={n} index={i} total={reelItems.length} stats={stats[String(n.id)]} onOpen={setSelected}/>) }
      </div>
    }

    {!loading&&reelItems.length>0&&<div style={{position:"absolute",left:0,right:0,bottom:8,zIndex:18,textAlign:"center",fontSize:".72rem",fontWeight:950,color:"rgba(240,224,184,.78)",textShadow:"0 2px 8px rgba(0,0,0,.7)",pointerEvents:"none"}}>⬆️ Desliza para pasar noticia</div>}

    <NewsDetailModal item={selected} user={user} setUser={setUser} showToast={showToast} showPoints={showPoints} onClose={()=>setSelected(null)} onChanged={bumpStat}/>
  </div>;
}

// CITAS
const SERVICIOS=[
  {id:"rastas_mantenimiento",icon:"🪮",label:"Mantenimiento de rastas",precio:35,duracion:90,grupo:"Rastas"},
  {id:"rastas_ganchillo",icon:"🧶",label:"Rastas con ganchillo",precio:45,duracion:120,grupo:"Rastas"},
  {id:"rastas_arreglo",icon:"🧑🏾‍🦱",label:"Arreglo de raíces",precio:30,duracion:75,grupo:"Rastas"},
  {id:"corte",icon:"✂️",label:"Corte",precio:15,duracion:30,grupo:"Pelo"},
  {id:"degradado",icon:"💈",label:"Degradado",precio:18,duracion:35,grupo:"Pelo"},
  {id:"barba",icon:"🧔",label:"Barba",precio:12,duracion:20,grupo:"Barber"},
  {id:"lavado",icon:"🫧",label:"Lavado",precio:12,duracion:20,grupo:"Extras"},
  {id:"tratamiento",icon:"✨",label:"Tratamiento hidratante",precio:25,duracion:35,grupo:"Extras"},
  {id:"color",icon:"🎨",label:"Coloración",precio:45,duracion:90,grupo:"Color"},
  {id:"mechas",icon:"🌗",label:"Mechas",precio:60,duracion:120,grupo:"Color"},
  {id:"alisado",icon:"🌊",label:"Alisado",precio:55,duracion:110,grupo:"Pelo"},
  {id:"recogido",icon:"👑",label:"Recogido",precio:30,duracion:45,grupo:"Pelo"},
];
const HORARIOS=["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"];
function formatDuration(min=0){
  const n=Number(min)||0;
  const h=Math.floor(n/60),m=n%60;
  if(!h)return `${m} min`;
  return m?`${h}h ${m}min`:`${h}h`;
}
function selectedServices(ids=[]){
  const list=Array.isArray(ids)?ids:String(ids||"").split(",").filter(Boolean);
  return list.map(id=>SERVICIOS.find(s=>s.id===id)).filter(Boolean);
}
function citaServices(cita={}){
  const ids=String(cita.servicio||"").split(",").filter(Boolean);
  const fromIds=selectedServices(ids);
  if(fromIds.length)return fromIds;
  if(cita.servicio_label){
    return String(cita.servicio_label).split(" + ").map((label,i)=>({id:`legacy-${i}`,label,precio:i===0?Number(cita.servicio_precio)||0:0,duracion:0,icon:"✂️"}));
  }
  return [];
}
function citaTotal(list=[]){return list.reduce((acc,s)=>acc+Number(s.precio||0),0);}
function citaDuration(list=[]){return list.reduce((acc,s)=>acc+Number(s.duracion||0),0);}
function endTime(start,duration){
  if(!start||!duration)return "";
  const [hh,mm]=String(start).split(":").map(Number);
  if(!Number.isFinite(hh)||!Number.isFinite(mm))return "";
  const total=hh*60+mm+duration;
  const h=String(Math.floor(total/60)%24).padStart(2,"0");
  const m=String(total%60).padStart(2,"0");
  return `${h}:${m}`;
}
function serviceGroups(){
  return [...new Set(SERVICIOS.map(s=>s.grupo))];
}

function Citas({user,showToast}){
  const [citas,setCitas]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({servicios:["corte"],fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});
  const [ocupados,setOcupados]=useState([]);
  const [view,setView]=useState(user?.rol!==ROLES.CLIENT?"pendiente":"todas");
  const [proposal,setProposal]=useState(null);
  const isAdmin=user?.rol!==ROLES.CLIENT;
  useEffect(()=>{loadCitas();},[]);
  async function loadCitas(){
    setLoading(true);
    const q=isAdmin?"?order=fecha.asc,hora.asc&select=*":`?usuario_id=eq.${user.id}&order=fecha.asc,hora.asc&select=*`;
    setCitas(await dbGet("citas",q)||[]);setLoading(false);
  }
  async function checkHorarios(fecha){if(!fecha)return;const data=await dbGet("citas",`?fecha=eq.${fecha}&select=hora`);setOcupados((data||[]).map(c=>c.hora));}
  function toggleService(id){
    setForm(f=>{
      const current=Array.isArray(f.servicios)?f.servicios:[];
      const exists=current.includes(id);
      const next=exists?current.filter(x=>x!==id):[...current,id];
      return {...f,servicios:next.length?next:current};
    });
  }
  async function saveCita(){
    if(!form.servicios?.length){showToast("Elige al menos un tratamiento");return;}
    if(!form.fecha||!form.hora){showToast("Selecciona fecha y hora");return;}
    const servicios=selectedServices(form.servicios);
    const total=citaTotal(servicios);
    const duracion=citaDuration(servicios);
    const fin=endTime(form.hora,duracion);
    const notasLimpias=String(form.notas||"").trim();
    const resumenDuracion=`Duración estimada: ${formatDuration(duracion)}${fin?` · Hasta aprox. ${fin}`:""}`;
    await dbPost("citas",{
      servicio:servicios.map(s=>s.id).join(","),
      servicio_label:servicios.map(s=>s.label).join(" + "),
      servicio_precio:total,
      fecha:form.fecha,
      hora:form.hora,
      notas:notasLimpias?`${resumenDuracion}\n${notasLimpias}`:resumenDuracion,
      cliente_nombre:form.cliente_nombre||user?.nombre||user?.email||"Cliente",
      usuario_id:user.id,
      estado:"pendiente"
    });
    showToast("Cita enviada y pendiente de confirmar");SFX.success();setShowNew(false);setForm({servicios:["corte"],fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});loadCitas();
  }
  async function updateCita(cita,patch,msg){
    const ok=await dbPatch("citas",`?id=eq.${cita.id}`,patch);
    if(ok){showToast(msg);SFX.success();await loadCitas();}
    else{showToast("No se pudo actualizar la cita");SFX.error();}
  }
  function openProposal(cita){
    setProposal({cita,fecha:cita.fecha||"",hora:cita.hora||"",nota:""});
    checkHorarios(cita.fecha||"");
  }
  async function sendProposal(){
    if(!proposal?.fecha||!proposal?.hora){showToast("Elige fecha y hora para la propuesta");return;}
    const old=String(proposal.cita.notas||"").trim();
    const extra=`Propuesta de nueva hora: ${proposal.fecha} a las ${proposal.hora}${proposal.nota?` · ${proposal.nota}`:""}`;
    await updateCita(proposal.cita,{fecha:proposal.fecha,hora:proposal.hora,estado:"propuesta",notas:old?`${old}\n\n${extra}`:extra},"Propuesta enviada");
    setProposal(null);
  }
  const currentServices=selectedServices(form.servicios);
  const currentTotal=citaTotal(currentServices);
  const currentDuration=citaDuration(currentServices);
  const statusOf=c=>String(c.estado||"pendiente").toLowerCase();
  const counts=citas.reduce((acc,c)=>{const st=statusOf(c);acc[st]=(acc[st]||0)+1;acc.todas=(acc.todas||0)+1;return acc;},{todas:citas.length});
  const statusTabs=isAdmin?[
    {id:"pendiente",label:"Pendientes",icon:"🟡"},
    {id:"propuesta",label:"Propuestas",icon:"🔁"},
    {id:"confirmada",label:"Confirmadas",icon:"✅"},
    {id:"completada",label:"Realizadas",icon:"🏁"},
    {id:"cancelada",label:"Canceladas",icon:"❌"},
    {id:"todas",label:"Todas",icon:"📚"},
  ]:[
    {id:"todas",label:"Todas",icon:"📚"},
    {id:"pendiente",label:"Pendientes",icon:"🟡"},
    {id:"propuesta",label:"Propuestas",icon:"🔁"},
    {id:"confirmada",label:"Confirmadas",icon:"✅"},
  ];
  const citasVisibles=view==="todas"?citas:citas.filter(c=>statusOf(c)===view);
  const eColor={pendiente:"gold",propuesta:"blue",confirmada:"green",cancelada:"red",completada:"blue"};
  const eLabel={pendiente:"pendiente",propuesta:"propuesta",confirmada:"confirmada",cancelada:"cancelada",completada:"realizada"};
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📅" title="Citas" sub={isAdmin?"Panel de reservas pendientes":"Tus reservas"} action={<Btn small onClick={()=>setShowNew(true)}>+ Nueva</Btn>}/>

      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{isAdmin?"☕ Panel de citas":"🧾 Estado de tus citas"}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>{isAdmin?"Acepta, cancela, propone otra hora o marca citas realizadas.":"Aquí verás si tu reserva está pendiente, confirmada o con propuesta de cambio."}</div>
          </div>
          <Badge col={(counts.pendiente||0)?"gold":"green"}>{counts.pendiente||0} pendientes</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.pendiente||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Pendientes</div></div>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.confirmada||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Confirmadas</div></div>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.completada||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Realizadas</div></div>
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {statusTabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setView(t.id);}} style={{flex:"0 0 auto",border:"none",borderRadius:999,padding:"8px 12px",background:view===t.id?T.gradGold:"rgba(255,244,214,.62)",color:view===t.id?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:view===t.id?"0 8px 18px rgba(18,8,4,.16)":"none"}}>{t.icon} {t.label} <span style={{opacity:.75}}>({counts[t.id]||0})</span></button>)}
        </div>
      </Card>

      {loading?<Spinner/>:citasVisibles.length===0?<EmptyState icon="📅" title="Sin citas" sub={view==="todas"?"Todavía no hay citas en esta vista":"No hay citas con este estado"}/>
        :citasVisibles.map(c=>{
          const list=citaServices(c);
          const dur=citaDuration(list);
          const precio=Number(c.servicio_precio)||citaTotal(list);
          const st=statusOf(c);
          return <Card key={c.id} style={{marginBottom:12,background:st==="pendiente"?"linear-gradient(180deg,#F0E0B8,#E6CF9B)":st==="confirmada"?"linear-gradient(180deg,#E4E8C6,#D8BE87)":T.panel}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,flexWrap:"wrap"}}>
                  <Badge col={eColor[st]||"green"}>{eLabel[st]||st}</Badge>
                  <span style={{fontSize:".78rem",fontWeight:950,color:T.g700}}>👤 {c.cliente_nombre||"Cliente"}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {list.length?list.map(s=><span key={s.id} style={{background:"rgba(75,48,27,.1)",border:`1px solid ${T.g300}`,borderRadius:999,padding:"4px 9px",fontWeight:900,fontSize:".72rem",color:T.g800}}>{s.icon||"✂️"} {s.label}</span>):<b>{c.servicio_label||c.servicio}</b>}
                </div>
                <div style={{fontSize:"0.86rem",fontWeight:950,color:T.g800}}>📆 {c.fecha} · {c.hora}{dur?` - ${endTime(c.hora,dur)}`:""}</div>
                {c.notas&&<div style={{marginTop:8,fontSize:".76rem",lineHeight:1.38,color:T.textSub,whiteSpace:"pre-wrap",fontWeight:750,maxHeight:86,overflow:"hidden"}}>{String(c.notas)}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                {!!precio&&<span style={{fontWeight:950,color:T.g600,fontSize:"1rem"}}>{precio}€</span>}
                {!!dur&&<span style={{fontWeight:850,color:T.textSub,fontSize:"0.72rem"}}>⏱️ {formatDuration(dur)}</span>}
              </div>
            </div>
            <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              {isAdmin&&st==="pendiente"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"confirmada"},"Cita confirmada")}>✅ Aceptar</Btn>}
              {isAdmin&&["pendiente","confirmada","propuesta"].includes(st)&&<Btn small col="gold" onClick={()=>openProposal(c)}>🔁 Proponer otra hora</Btn>}
              {isAdmin&&["confirmada","propuesta"].includes(st)&&<Btn small col="dark" onClick={()=>updateCita(c,{estado:"completada"},"Cita marcada como realizada")}>🏁 Realizada</Btn>}
              {isAdmin&&st==="cancelada"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"pendiente"},"Cita reabierta")}>↩️ Reabrir</Btn>}
              {!isAdmin&&st==="propuesta"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"confirmada"},"Propuesta aceptada")}>✅ Aceptar propuesta</Btn>}
              {["pendiente","propuesta","confirmada"].includes(st)&&<Btn small col="red" onClick={()=>updateCita(c,{estado:"cancelada"},"Cita cancelada")}>❌ Cancelar</Btn>}
            </div>
          </Card>;
        })
      }

      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nueva cita">
        {isAdmin&&<Input label="Nombre del cliente" value={form.cliente_nombre} onChange={v=>setForm(f=>({...f,cliente_nombre:v}))}/>} 
        <div style={{marginBottom:14}}>
          <div style={{fontSize:"0.82rem",fontWeight:950,color:T.g800,marginBottom:7}}>Tratamientos</div>
          <div style={{fontSize:"0.76rem",fontWeight:750,color:T.textSub,marginBottom:10}}>Puedes elegir varios. La app suma el precio y el tiempo aproximado.</div>
          {serviceGroups().map(grupo=><div key={grupo} style={{marginBottom:10}}>
            <div style={{fontSize:".72rem",fontWeight:950,color:T.g600,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>{grupo}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {SERVICIOS.filter(s=>s.grupo===grupo).map(s=>{
                const active=form.servicios.includes(s.id);
                return <button key={s.id} onClick={()=>toggleService(s.id)} style={{textAlign:"left",border:`2px solid ${active?T.g600:T.g300}`,background:active?"linear-gradient(180deg,#D8BE87,#C7A66B)":T.g50,borderRadius:16,padding:"10px",cursor:"pointer",boxShadow:active?"0 8px 18px rgba(18,8,4,.18)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:"1.25rem"}}>{s.icon}</span><b style={{fontSize:".78rem",color:T.text,lineHeight:1.1}}>{s.label}</b></div>
                  <div style={{marginTop:6,fontSize:".72rem",fontWeight:850,color:T.textSub}}>{s.precio}€ · {formatDuration(s.duracion)}</div>
                </button>;
              })}
            </div>
          </div>)}
        </div>
        <Card style={{marginBottom:14,background:"linear-gradient(180deg,#D8BE87,#C7A66B)",padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
            <div><div style={{fontWeight:950,color:T.g800}}>Resumen</div><div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>{currentServices.length} tratamiento{currentServices.length===1?"":"s"} seleccionado{currentServices.length===1?"":"s"}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:950,fontSize:"1.15rem",color:T.g800}}>{currentTotal}€</div><div style={{fontSize:".76rem",fontWeight:900,color:T.textSub}}>⏱️ {formatDuration(currentDuration)}</div></div>
          </div>
          {form.hora&&currentDuration>0&&<div style={{marginTop:8,fontSize:".76rem",fontWeight:850,color:T.textSub}}>Si empieza a las {form.hora}, terminaría aprox. a las {endTime(form.hora,currentDuration)}.</div>}
        </Card>
        <Input label="Fecha" value={form.fecha} onChange={v=>{setForm(f=>({...f,fecha:v,hora:""}));checkHorarios(v);}} type="date"/>
        {form.fecha&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:8}}>Hora disponible</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {HORARIOS.map(h=>{
                const busy=ocupados.includes(h);
                return <button key={h} disabled={busy} onClick={()=>setForm(f=>({...f,hora:h}))} style={{padding:"7px 12px",borderRadius:10,border:`2px solid ${form.hora===h?T.g600:busy?T.g200:T.g300}`,background:form.hora===h?T.g600:busy?T.g100:T.white,color:form.hora===h?T.white:busy?T.textSub:T.text,fontWeight:700,fontSize:"0.8rem",cursor:busy?"not-allowed":"pointer",opacity:busy?0.5:1}}>{h}</button>;
              })}
            </div>
          </div>
        )}
        <Input label="Notas" value={form.notas} onChange={v=>setForm(f=>({...f,notas:v}))} placeholder="Ej: quiero revisar raíces, pelo sensible, voy con prisa..."/>
        <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)",boxShadow:"0 -10px 22px rgba(255,248,230,.9)"}}>
          <Btn full onClick={saveCita}>Enviar cita pendiente</Btn>
        </div>
      </Modal>

      <Modal show={!!proposal} onClose={()=>setProposal(null)} title="Proponer otra hora">
        {proposal&&<>
          <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>Cita de {proposal.cita.cliente_nombre||"cliente"}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>Actual: {proposal.cita.fecha} · {proposal.cita.hora}</div>
          </Card>
          <Input label="Nueva fecha" value={proposal.fecha} onChange={v=>{setProposal(p=>({...p,fecha:v,hora:""}));checkHorarios(v);}} type="date"/>
          {proposal.fecha&&<div style={{marginBottom:14}}>
            <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:8}}>Nueva hora</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{HORARIOS.map(h=>{
              const busy=ocupados.includes(h)&&!(proposal.cita.fecha===proposal.fecha&&proposal.cita.hora===h);
              return <button key={h} disabled={busy} onClick={()=>setProposal(p=>({...p,hora:h}))} style={{padding:"7px 12px",borderRadius:10,border:`2px solid ${proposal.hora===h?T.g600:busy?T.g200:T.g300}`,background:proposal.hora===h?T.g600:busy?T.g100:T.white,color:proposal.hora===h?T.white:busy?T.textSub:T.text,fontWeight:700,fontSize:"0.8rem",cursor:busy?"not-allowed":"pointer",opacity:busy?0.5:1}}>{h}</button>;
            })}</div>
          </div>}
          <Input label="Mensaje opcional" value={proposal.nota} onChange={v=>setProposal(p=>({...p,nota:v}))} placeholder="Ej: esa hora está ocupada, te propongo esta alternativa."/>
          <Btn full col="gold" onClick={sendProposal}>Enviar propuesta</Btn>
        </>}
      </Modal>
    </div>
  );
}
// CLIENTES
function Clientes({showToast}){
  const [clientes,setClientes]=useState([]);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [historial,setHistorial]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){
    setLoading(true);
    const raw=await dbGet("usuarios","?role=eq.client&order=nombre.asc&select=*")||[];
    setClientes(await enrichProfilesWithAvatarConfigs(raw));
    setLoading(false);
  }
  async function selectCliente(c){setSelected(c);setHistorial(await dbGet("citas",`?usuario_id=eq.${c.id}&order=fecha.desc&limit=10&select=*`)||[]);}
  const filtered=clientes.filter(c=>(c.nombre||"").toLowerCase().includes(search.toLowerCase())||(c.email||"").toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👥" title="Clientes" sub={`${clientes.length} clientes reales de la app`}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#0E2F3A,#1A5261 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>👥</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Clientes</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Aquí ves sólo clientes: puntos, citas, historial y ficha pública. No sirve para cambiar roles.</div>
          </div>
        </div>
      </Card>
      <Input value={search} onChange={setSearch} placeholder="Buscar cliente por nombre o email..."/>
      {loading?<Spinner/>:filtered.map(c=>(
        <Card key={c.id} style={{marginBottom:10}} hover onClick={()=>selectCliente(c)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <PublicAvatar profile={c} currentUser={null} size={44}/>
            <div style={{flex:1}}><div style={{fontWeight:800}}>{c.nombre}</div><div style={{fontSize:"0.78rem",color:T.textSub}}>{c.email}</div></div>
            <div style={{fontWeight:900,color:T.g600}}>pts {c.puntos||0}</div>
          </div>
        </Card>
      ))}
      <Modal show={!!selected} onClose={()=>setSelected(null)} title={selected?.nombre||""}>
        {selected&&(
          <div>
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
              <PublicAvatar profile={selected} currentUser={null} size={56}/>
              <div><div style={{fontWeight:800}}>{selected.nombre}</div><div style={{fontSize:"0.82rem",color:T.textSub}}>{selected.email}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <StatCard icon="⭐" label="Puntos" value={selected.puntos||0} col="gold"/>
              <StatCard icon="📅" label="Citas" value={historial.length} col="green"/>
            </div>
            {historial.map(h=><div key={h.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.g100}`,fontSize:"0.83rem"}}><span>{h.servicio_label||h.servicio}</span><span style={{color:T.textSub}}>{h.fecha}</span></div>)}
          </div>
        )}
      </Modal>
    </div>
  );
}

// INVENTARIO
function Inventario({showToast}){
  const [items,setItems]=useState([]);const [showNew,setShowNew]=useState(false);const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({nombre:"",categoria:"coloracion",stock:0,stock_min:5,precio_compra:0,precio_venta:0});
  const CATS=["coloracion","tratamiento","herramientas","consumibles","styling"];
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setItems(await dbGet("inventario","?order=nombre.asc&select=*")||[]);setLoading(false);}
  async function saveItem(){if(!form.nombre){showToast("Escribe un nombre");return;}await dbPost("inventario",form);showToast("Producto añadido");setShowNew(false);setForm({nombre:"",categoria:"coloracion",stock:0,stock_min:5,precio_compra:0,precio_venta:0});load();}
  async function updateStock(id,delta){const item=items.find(i=>i.id===id);if(!item)return;await dbPatch("inventario",`?id=eq.${id}`,{stock:Math.max(0,item.stock+delta)});load();}
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📦" title="Inventario" sub={`${items.length} productos`} action={<Btn small onClick={()=>setShowNew(true)}>+ Añadir</Btn>}/>
      {items.filter(i=>i.stock<=i.stock_min).length>0&&<Card style={{background:"#FFEBEE",border:`1px solid ${T.red}`,marginBottom:14}}><div style={{fontWeight:800,color:T.red,fontSize:"0.88rem"}}>Stock bajo en {items.filter(i=>i.stock<=i.stock_min).length} productos</div></Card>}
      {loading?<Spinner/>:items.map(item=>(
        <Card key={item.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}><div style={{fontWeight:800}}>{item.nombre}</div><div style={{fontSize:"0.75rem",color:T.textSub}}>{item.categoria}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>updateStock(item.id,-1)} style={{width:28,height:28,borderRadius:"50%",border:`1.5px solid ${T.g300}`,background:T.white,cursor:"pointer",fontWeight:900,color:T.red}}>-</button>
              <span style={{fontWeight:900,fontSize:"1.1rem",color:item.stock<=item.stock_min?T.red:T.g600,minWidth:28,textAlign:"center"}}>{item.stock}</span>
              <button onClick={()=>updateStock(item.id,1)} style={{width:28,height:28,borderRadius:"50%",border:`1.5px solid ${T.g300}`,background:T.white,cursor:"pointer",fontWeight:900,color:T.g600}}>+</button>
              <Badge col={item.stock<=item.stock_min?"red":"green"}>{item.stock<=item.stock_min?"Bajo":"OK"}</Badge>
            </div>
          </div>
        </Card>
      ))}
      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nuevo producto">
        <Input label="Nombre" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/>
        <Select label="Categoria" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={CATS.map(c=>({value:c,label:c.charAt(0).toUpperCase()+c.slice(1)}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Stock" value={form.stock} onChange={v=>setForm(f=>({...f,stock:+v}))} type="number"/>
          <Input label="Minimo" value={form.stock_min} onChange={v=>setForm(f=>({...f,stock_min:+v}))} type="number"/>
          <Input label="Precio compra €" value={form.precio_compra} onChange={v=>setForm(f=>({...f,precio_compra:+v}))} type="number"/>
          <Input label="Precio venta €" value={form.precio_venta} onChange={v=>setForm(f=>({...f,precio_venta:+v}))} type="number"/>
        </div>
        <Btn full onClick={saveItem}>Guardar</Btn>
      </Modal>
    </div>
  );
}

// CAJA
function Caja({user,showToast}){
  const [cobros,setCobros]=useState([]);
  const [citasRealizadas,setCitasRealizadas]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [carrito,setCarrito]=useState([]);
  const [metodo,setMetodo]=useState("efectivo");
  const [clienteNombre,setClienteNombre]=useState("");
  const [citaCobro,setCitaCobro]=useState(null);
  const [cobroForm,setCobroForm]=useState({metodo_pago:"efectivo",importe:"",puntos_generados:"10",descripcion:""});

  const today=()=>new Date().toISOString().split("T")[0];
  const monthStart=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  };
  const money=n=>`${(Number(n)||0).toFixed(2)}€`;
  const metodoLabel=m=>({efectivo:"Efectivo",tarjeta:"Tarjeta",bizum:"Bizum",puntos:"Puntos",mixto:"Mixto"})[m]||m||"Sin método";

  async function sumarPuntosFidelidad(usuarioId,puntos=0){
    if(!usuarioId)return false;
    const add=Math.max(0,parseInt(puntos||0,10)||0);
    if(!add)return true;
    try{
      const rows=await dbGet("usuarios",`?id=eq.${usuarioId}&select=id,puntos&limit=1`);
      const actual=Number(rows?.[0]?.puntos||0);
      const nuevos=Math.max(0,actual + add);
      const ok=await dbPatch("usuarios",`?id=eq.${usuarioId}`,{puntos:nuevos});
      return Boolean(ok);
    }catch(e){
      console.warn("No se pudieron sumar puntos de fidelidad",e);
      return false;
    }
  }

  useEffect(()=>{loadCaja();},[]);

  async function loadCaja(){
    setLoading(true);
    const [cobs,citas]=await Promise.all([
      dbGet("cobros",`?fecha=gte.${monthStart()}&order=created_at.desc&select=*`),
      dbGet("citas",`?estado=eq.completada&order=fecha.desc,hora.desc&select=*`)
    ]);
    const cleanCobros=Array.isArray(cobs)?cobs:[];
    setCobros(cleanCobros);
    const cobradas=new Set(cleanCobros.map(c=>String(c.cita_id||"")).filter(Boolean));
    setCitasRealizadas((Array.isArray(citas)?citas:[]).filter(c=>!cobradas.has(String(c.id))));
    setLoading(false);
  }

  function addToCarrito(servicio){
    setCarrito(c=>{
      const ex=c.find(i=>i.id===servicio.id);
      if(ex)return c.map(i=>i.id===servicio.id?{...i,qty:i.qty+1}:i);
      return[...c,{...servicio,qty:1}];
    });
  }

  function removeFromCarrito(id){
    setCarrito(c=>c.map(i=>i.id===id?{...i,qty:i.qty-1}:i).filter(i=>i.qty>0));
  }

  const total=carrito.reduce((sum,i)=>sum+(Number(i.precio)||0)*(Number(i.qty)||1),0);
  const cobrosValidos=cobros.filter(c=>String(c.estado||"pagado").toLowerCase()!=="anulado");
  const cobrosHoy=cobrosValidos.filter(c=>String(c.fecha)===today());
  const totalHoy=cobrosHoy.reduce((sum,c)=>sum+(Number(c.importe)||0),0);
  const totalMes=cobrosValidos.reduce((sum,c)=>sum+(Number(c.importe)||0),0);
  const porMetodo=m=>cobrosHoy.filter(c=>c.metodo_pago===m).reduce((sum,c)=>sum+(Number(c.importe)||0),0);

  async function cobrarVentaManual(){
    if(!carrito.length){showToast?.("Añade al menos un servicio o producto");return;}
    const descripcion=carrito.map(i=>`${i.label} x${i.qty}`).join(" · ");
    const ok=await dbPost("cobros",{
      cita_id:null,
      usuario_id:null,
      cliente_nombre:clienteNombre||"Cliente mostrador",
      concepto:"Venta manual",
      descripcion,
      importe:Number(total.toFixed(2)),
      metodo_pago:metodo,
      puntos_usados:0,
      puntos_generados:0,
      estado:"pagado",
      fecha:today(),
      creado_por:user?.id||user?.email||"app"
    });
    if(ok){
      SFX.coins();
      showToast?.(`Cobrado ${money(total)}`);
      setCarrito([]);
      setClienteNombre("");
      setMetodo("efectivo");
      setShowNew(false);
      await loadCaja();
    }else{
      showToast?.("No se pudo guardar el cobro");
      SFX.error();
    }
  }

  function openCobrarCita(cita){
    const list=citaServices(cita);
    const precio=Number(cita.servicio_precio)||citaTotal(list);
    setCitaCobro(cita);
    setCobroForm({
      metodo_pago:"efectivo",
      importe:String(precio||0),
      puntos_generados:"10",
      descripcion:cita.servicio_label||cita.servicio||"Servicio de peluquería"
    });
  }

  async function cobrarCita(){
    if(!citaCobro)return;
    const importe=Number(String(cobroForm.importe||"0").replace(",","."));
    if(!(importe>=0)){showToast?.("Importe no válido");return;}
    const puntosGenerados=Math.max(0,parseInt(cobroForm.puntos_generados||"0",10)||0);
    const ok=await dbPost("cobros",{
      cita_id:citaCobro.id,
      usuario_id:citaCobro.usuario_id||null,
      cliente_nombre:citaCobro.cliente_nombre||"Cliente",
      concepto:"Cita cobrada",
      descripcion:cobroForm.descripcion||citaCobro.servicio_label||citaCobro.servicio||"Servicio de peluquería",
      importe:Number(importe.toFixed(2)),
      metodo_pago:cobroForm.metodo_pago,
      puntos_usados:0,
      puntos_generados:puntosGenerados,
      estado:"pagado",
      fecha:today(),
      creado_por:user?.id||user?.email||"app"
    });
    if(ok){
      const puntosOk=await sumarPuntosFidelidad(citaCobro.usuario_id,puntosGenerados);
      SFX.coins();
      showToast?.(`Cita cobrada: ${money(importe)}${puntosGenerados?` · +${puntosGenerados} pts de fidelidad`:""}${!puntosOk?" · revisa puntos":""}`);
      setCitaCobro(null);
      await loadCaja();
    }else{
      showToast?.("No se pudo guardar el cobro de la cita");
      SFX.error();
    }
  }

  async function anularCobro(cobro){
    const ok=await dbPatch("cobros",`?id=eq.${cobro.id}`,{estado:"anulado"});
    if(ok){showToast?.("Cobro anulado");SFX.success();await loadCaja();}
    else{showToast?.("No se pudo anular el cobro");SFX.error();}
  }

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="💰" title="Facturación" sub={`Hoy: ${money(totalHoy)} · Mes: ${money(totalMes)}`} action={<Btn small onClick={()=>setShowNew(true)}>+ Venta</Btn>}/>

      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🧾</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Caja y cobros reales</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Registra ventas manuales y cobra citas realizadas. Los puntos son fidelidad, no dinero ni método de pago.</div>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <StatCard icon="💶" label="Hoy" value={money(totalHoy)} col="green"/>
        <StatCard icon="📆" label="Mes" value={money(totalMes)} col="gold"/>
        <StatCard icon="💵" label="Efectivo hoy" value={money(porMetodo("efectivo"))} col="green"/>
        <StatCard icon="💳" label="Tarjeta hoy" value={money(porMetodo("tarjeta"))} col="blue"/>
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>🏁 Citas realizadas pendientes de cobrar</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Cuando marques una cita como realizada, aparecerá aquí para cobrarla.</div>
          </div>
          <Badge col={citasRealizadas.length?"gold":"green"}>{citasRealizadas.length}</Badge>
        </div>
        {loading?<Spinner/>:citasRealizadas.length===0?<EmptyState icon="✅" title="Nada pendiente de cobrar" sub="Las citas realizadas sin cobro aparecerán aquí."/>:
          citasRealizadas.map(c=>{
            const list=citaServices(c);
            const precio=Number(c.servicio_precio)||citaTotal(list);
            const dur=citaDuration(list);
            return <div key={c.id} style={{padding:"11px 0",borderBottom:`1px solid ${T.g200}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:950,color:T.g800}}>👤 {c.cliente_nombre||"Cliente"}</div>
                  <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3}}>📆 {c.fecha||"sin fecha"} · 🕒 {c.hora||"sin hora"}{dur?` · ${formatDuration(dur)}`:""}</div>
                  <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3}}>✂️ {c.servicio_label||c.servicio||"Servicio"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:950,color:T.g600,fontSize:"1.05rem"}}>{money(precio)}</div>
                  <Btn small col="gold" onClick={()=>openCobrarCita(c)}>Cobrar</Btn>
                </div>
              </div>
            </div>;
          })
        }
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>📜 Últimos cobros</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Historial del mes actual.</div>
          </div>
          <Badge col="gold">{cobrosValidos.length}</Badge>
        </div>
        {loading?<Spinner/>:cobros.length===0?<EmptyState icon="💰" title="Sin cobros todavía" sub="Cuando cobres una cita o venta, aparecerá aquí."/>:
          cobros.map(v=>{
            const anulado=String(v.estado||"pagado").toLowerCase()==="anulado";
            return <Card key={v.id} style={{marginBottom:8,opacity:anulado?.55:1,background:anulado?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"rgba(255,248,230,.72)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <b style={{color:T.g800}}>{v.cliente_nombre||"Cliente"}</b>
                    {anulado&&<Badge col="red">anulado</Badge>}
                  </div>
                  <div style={{fontSize:".75rem",fontWeight:850,color:T.textSub,marginTop:3}}>{v.fecha} · {metodoLabel(v.metodo_pago)} · {v.concepto||"Cobro"}</div>
                  {v.descripcion&&<div style={{fontSize:".72rem",fontWeight:750,color:T.textSub,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.descripcion}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:950,fontSize:"1.05rem",color:anulado?T.textSub:T.g600}}>{money(v.importe)}</div>
                  {!anulado&&<button onClick={()=>anularCobro(v)} style={{border:"none",background:"transparent",color:T.red,fontSize:".7rem",fontWeight:950,cursor:"pointer",padding:0}}>Anular</button>}
                </div>
              </div>
            </Card>;
          })
        }
      </Card>

      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nueva venta">
        <Input label="Cliente (opcional)" value={clienteNombre} onChange={setClienteNombre} placeholder="Nombre del cliente o venta mostrador"/>
        <div style={{fontWeight:950,color:T.g700,marginBottom:8,fontSize:"0.85rem"}}>Servicios / productos rápidos</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {SERVICIOS.map(s=><button key={s.id} onClick={()=>addToCarrito(s)} style={{padding:"8px 12px",borderRadius:12,border:`1.5px solid ${T.g300}`,background:T.g50,cursor:"pointer",fontSize:"0.78rem",fontWeight:850}}>{s.icon} {s.label} {s.precio}€</button>)}
        </div>
        {carrito.length>0&&(
          <div style={{background:T.g50,borderRadius:14,padding:12,marginBottom:14,border:`1px solid ${T.g300}`}}>
            {carrito.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"0.85rem",marginBottom:6,gap:8}}>
              <span>{i.label} x{i.qty}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>removeFromCarrito(i.id)} style={{border:"none",background:T.g150,borderRadius:8,padding:"2px 7px",fontWeight:950,cursor:"pointer"}}>-</button>
                <b>{money((Number(i.precio)||0)*(Number(i.qty)||1))}</b>
              </div>
            </div>)}
            <div style={{borderTop:`1px solid ${T.g200}`,marginTop:8,paddingTop:8,fontWeight:950,display:"flex",justifyContent:"space-between"}}><span>TOTAL</span><span style={{color:T.g600}}>{money(total)}</span></div>
          </div>
        )}
        <Select label="Método de pago" value={metodo} onChange={setMetodo} options={[{value:"efectivo",label:"Efectivo"},{value:"tarjeta",label:"Tarjeta"},{value:"bizum",label:"Bizum"},{value:"mixto",label:"Mixto"}]}/>
        <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)"}}>
          <Btn full col="gold" onClick={cobrarVentaManual} disabled={!carrito.length}>Cobrar {money(total)}</Btn>
        </div>
      </Modal>

      <Modal show={!!citaCobro} onClose={()=>setCitaCobro(null)} title="Cobrar cita realizada">
        {citaCobro&&(
          <div>
            <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
              <div style={{fontWeight:950,color:T.g800}}>👤 {citaCobro.cliente_nombre||"Cliente"}</div>
              <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,marginTop:4}}>📆 {citaCobro.fecha} · 🕒 {citaCobro.hora}</div>
              <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,marginTop:4}}>✂️ {citaCobro.servicio_label||citaCobro.servicio}</div>
            </Card>
            <Input label="Importe final" value={cobroForm.importe} onChange={v=>setCobroForm(f=>({...f,importe:v}))} type="number"/>
            <Select label="Método de pago" value={cobroForm.metodo_pago} onChange={v=>setCobroForm(f=>({...f,metodo_pago:v}))} options={[{value:"efectivo",label:"Efectivo"},{value:"tarjeta",label:"Tarjeta"},{value:"bizum",label:"Bizum"},{value:"mixto",label:"Mixto"}]}/>
            <Input label="Puntos de fidelidad a sumar" value={cobroForm.puntos_generados} onChange={v=>setCobroForm(f=>({...f,puntos_generados:v}))} type="number"/>
            <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`1.5px solid ${T.gold}`,padding:12}}>
              <div style={{fontWeight:950,color:T.g800}}>⭐ Puntos de fidelidad</div>
              <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>
                Los puntos no equivalen a euros y no se usan como método de pago. Sólo se suman como fidelidad y luego se canjean por cupones, avatar, juegos o premios de tienda.
              </div>
            </Card>
            <Input label="Descripción" value={cobroForm.descripcion} onChange={v=>setCobroForm(f=>({...f,descripcion:v}))}/>
            <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)"}}>
              <Btn full col="gold" onClick={cobrarCita}>Guardar cobro</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ADMIN USUARIOS
function AdminUsuarios({user,showToast}){
  const canManageUsers=user?.rol===ROLES.ADMIN;
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{if(canManageUsers) load(); else setLoading(false);},[canManageUsers]);
  async function load(){
    setLoading(true);
    const raw=await dbGet("usuarios","?order=nombre.asc&select=*")||[];
    setUsers(await enrichProfilesWithAvatarConfigs(raw));
    setLoading(false);
  }
  async function changeRole(id,rol){if(!canManageUsers)return;await dbPatch("usuarios",`?id=eq.${id}`,{role:rol});showToast("Rol actualizado");load();}
  if(!canManageUsers){
    return <EmptyState icon="🔒" title="Solo administradores" sub="Esta sección permite cambiar roles y gestionar usuarios."/>;
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👑" title="Usuarios y permisos" sub={`${users.length} cuentas registradas`}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🔐</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Usuarios</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Esta pestaña es para permisos: cliente, staff o admin. No es la ficha comercial del cliente.</div>
          </div>
        </div>
      </Card>
      {loading?<Spinner/>:users.map(u=>(
        <Card key={u.id} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <PublicAvatar profile={u} currentUser={user} size={40}/>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:"0.9rem"}}>{u.nombre}</div><div style={{fontSize:"0.75rem",color:T.textSub}}>{u.email}</div></div>
            <select value={u.role||"client"} onChange={e=>changeRole(u.id,e.target.value)} style={{padding:"5px 8px",borderRadius:8,border:`1.5px solid ${T.g300}`,background:T.g50,fontSize:"0.78rem",fontWeight:700,cursor:"pointer"}}>
              <option value="client">Cliente</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </Card>
      ))}
    </div>
  );
}

// FEED / TABLON
function SocialFeed({user,setUser,showToast,showPoints}){
  const [posts,setPosts]=useState([]);const [newPost,setNewPost]=useState("");const [loading,setLoading]=useState(true);const [profiles,setProfiles]=useState([]);const [selectedProfile,setSelectedProfile]=useState(null);
  const canPost=normalizeRole(user.rol||user.role)!==ROLES.CLIENT;
  useEffect(()=>{load();},[]);
  async function load(){
    setLoading(true);
    const [raw,users]=await Promise.all([
      dbGet("publicaciones","?tipo=neq.foro&order=created_at.desc&limit=30&select=*"),
      dbGet("usuarios","?select=*")
    ]);
    setPosts(Array.isArray(raw)?raw:[]);setProfiles(await enrichProfilesWithAvatarConfigs(Array.isArray(users)?users:[]));setLoading(false);
  }
  function authorOf(post){return profiles.find(u=>String(u.id)===String(post.autor_id))||user;}
  async function publish(){
    if(!canPost){showToast("Solo admin y staff pueden publicar en el tablón");SFX.error();return;}
    if(!newPost.trim())return;
    await dbPost("publicaciones",{contenido:newPost.trim(),autor_id:user.id,tipo:"anuncio",likes_count:0});
    setNewPost("");SFX.success();showToast("Anuncio publicado");load();
  }
  async function likePost(post){ await dbPatch("publicaciones",`?id=eq.${post.id}`,{likes_count:(post.likes_count||0)+1});load(); }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📌" title="Tablón de anuncios" sub="Noticias, promociones y avisos oficiales de la tienda"/>
      <Card style={{marginBottom:16,background:'linear-gradient(180deg,#E9D9B7 0%,#DEC79A 100%)',border:`2px solid ${T.g300}`,boxShadow:'0 10px 24px rgba(20,8,4,.16)'}}>
        <div style={{fontWeight:900,fontSize:'.92rem',color:T.g800,marginBottom:8}}>📣 Nuevo anuncio</div>
        {canPost? <>
          <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Escribe una promoción, aviso, norma, actualización o evento..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:T.g150,resize:"none",outline:"none",boxShadow:'inset 0 2px 8px rgba(20,8,4,.06)'}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:8}}>
            <span style={{fontSize:"0.8rem",color:T.g700,fontWeight:900}}>Solo admin/staff pueden publicar y comentar aquí</span>
            <Btn small col="dark" onClick={publish} style={{fontWeight:900,letterSpacing:'.4px'}}>📌 Publicar</Btn>
          </div>
        </> : <div style={{fontSize:".86rem",fontWeight:800,color:T.textSub,lineHeight:1.45}}>Este feed ahora funciona como tablón oficial. Puedes leer anuncios y dar me gusta; para debatir o abrir temas usa la pestaña Foro.</div>}
      </Card>
      {loading?<Spinner/>:posts.length===0?<EmptyState icon="📌" title="Sin anuncios" sub="Cuando el equipo publique novedades aparecerán aquí."/>:posts.map(p=>{
        const a=authorOf(p);
        return <Card key={p.id} style={{marginBottom:12,background:'linear-gradient(180deg,#EFE0BE 0%,#E4CFAB 100%)',border:`1.5px solid ${T.g200}`,boxShadow:'0 8px 18px rgba(20,8,4,.12)'}}>
          {p.imagen_url&&<img src={p.imagen_url} alt="" style={{width:"100%",borderRadius:14,marginBottom:10,objectFit:"cover",maxHeight:200}}/>}
          <div onClick={()=>setSelectedProfile(a)} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,cursor:'pointer'}}><PublicAvatar profile={a} size={34}/><div><div style={{fontWeight:900,color:T.g800,fontSize:'.86rem'}}>{publicName(a)}</div><div style={{fontSize:'.68rem',fontWeight:800,color:T.textSub,textTransform:'uppercase'}}>{publicRoleLabel(a)}</div></div></div>
          <div style={{fontSize:"0.93rem",fontWeight:700,color:T.text,lineHeight:1.55,whiteSpace:'pre-wrap'}}>{p.contenido}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <span style={{fontSize:"0.76rem",color:T.textSub,fontWeight:800}}>{p.created_at?new Date(p.created_at).toLocaleDateString("es-ES"):""}</span>
            <button onClick={()=>likePost(p)} style={{background:T.g150,border:`1.5px solid ${T.g200}`,cursor:"pointer",fontSize:"0.8rem",color:T.g700,fontWeight:900,padding:'7px 12px',borderRadius:999}}>❤️ {p.likes_count||0}</button>
          </div>
        </Card>;
      })}
      <PublicProfileModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)}/>
    </div>
  );
}

// FORO
function Foro({user,showToast}){
  const [topics,setTopics]=useState([]);
  const [repliesMap,setRepliesMap]=useState({});
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [active,setActive]=useState(null);
  const [reply,setReply]=useState("");
  const [selectedProfile,setSelectedProfile]=useState(null);
  const [profiles,setProfiles]=useState([]);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [raw,users,replies]=await Promise.all([
      dbGet("publicaciones","?tipo=eq.foro&order=created_at.desc&limit=40&select=*"),
      dbGet("usuarios","?select=*"),
      dbGet("foro_respuestas","?order=created_at.asc&limit=500&select=*")
    ]);
    const safeTopics=Array.isArray(raw)?raw:[];
    const grouped={};
    (Array.isArray(replies)?replies:[]).forEach(r=>{
      const key=String(r.tema_id);
      if(!grouped[key]) grouped[key]=[];
      grouped[key].push(r);
    });
    setTopics(safeTopics);
    setProfiles(Array.isArray(users)?users:[]);
    setRepliesMap(grouped);
    setLoading(false);
  }

  function authorOf(item){return profiles.find(u=>String(u.id)===String(item.autor_id))||user;}
  function getReplies(id){return repliesMap[String(id)]||[];}

  async function createTopic(){
    if(!title.trim()||!body.trim()){showToast("Pon título y texto");return;}
    const created=await dbPost("publicaciones",{titulo:title.trim(),contenido:body.trim(),autor_id:user.id,tipo:"foro",likes_count:0});
    setTitle("");setBody("");SFX.success();showToast("Tema creado");
    if(Array.isArray(created)&&created[0]) setActive(created[0]);
    load();
  }

  async function addReply(topic){
    if(!reply.trim())return;
    await dbPost("foro_respuestas",{
      tema_id:topic.id,
      autor_id:user.id,
      autor_nombre:user.nombre,
      autor_avatar:user.avatar,
      autor_avatar_config:user.avatarConfig||user.avatar_config||null,
      contenido:reply.trim()
    });
    setReply("");
    SFX.success();
    showToast("Respuesta publicada");
    await load();
    setActive(a=>a?{...a,_tick:Date.now()}:topic);
  }

  async function vote(topic){
    const nextLikes=(topic.likes_count||0)+1;
    await dbPatch("publicaciones",`?id=eq.${topic.id}`,{likes_count:nextLikes});
    setTopics(ts=>ts.map(t=>t.id===topic.id?{...t,likes_count:nextLikes}:t));
    setActive(a=>a?.id===topic.id?{...a,likes_count:nextLikes}:a);
  }

  const shown=active||null;
  return <div style={{animation:"fadeSlide .4s ease"}}>
    <SectionHeader icon="🗣️" title="Foro Rasta" sub="Temas, dudas, votaciones y conversación entre clientes"/>
    {!shown&&<Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
      <div style={{fontWeight:900,color:T.g800,marginBottom:8}}>Abrir nuevo tema</div>
      <Input label="Título" value={title} onChange={setTitle} placeholder="Ej: ¿Qué cuidados necesita una rasta nueva?"/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe tu duda, idea o propuesta..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:T.g150,resize:"none",outline:"none"}}/>
      <div style={{marginTop:10}}><Btn full col="gold" onClick={createTopic}>➕ Crear tema</Btn></div>
    </Card>}
    {shown? <div>
      <Btn small col="ghost" onClick={()=>setActive(null)} style={{marginBottom:10}}>← Volver al foro</Btn>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>{shown.titulo||"Tema del foro"}</div>
        <div style={{fontSize:".9rem",fontWeight:700,lineHeight:1.5,whiteSpace:'pre-wrap',marginTop:8}}>{shown.contenido}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,alignItems:"center"}}><Badge col="blue">{getReplies(shown.id).length} respuestas</Badge><Btn small col="gold" onClick={()=>vote(shown)}>👍 Votar {shown.likes_count||0}</Btn></div>
      </Card>
      {getReplies(shown.id).map(r=><Card key={r.id} style={{marginBottom:8,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)"}}><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,cursor:"pointer"}} onClick={()=>setSelectedProfile({id:r.autor_id,nombre:r.autor_nombre,avatar:r.autor_avatar,avatar_config:r.autor_avatar_config,puntos:0})}><PublicAvatar profile={{nombre:r.autor_nombre,avatar:r.autor_avatar,avatar_config:r.autor_avatar_config,perfil_publico:r.perfil_publico,modo_incognito:r.modo_incognito}} size={30}/><b>{publicName({nombre:r.autor_nombre,perfil_publico:r.perfil_publico,modo_incognito:r.modo_incognito})}</b></div><div style={{fontSize:".86rem",fontWeight:700,lineHeight:1.45,whiteSpace:'pre-wrap'}}>{r.contenido}</div></Card>)}
      <Card><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Responder al tema..." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:T.g150,resize:"none"}}/><div style={{marginTop:8}}><Btn full onClick={()=>addReply(shown)}>Responder</Btn></div></Card>
    </div> : loading?<Spinner/>:topics.length===0?<EmptyState icon="🗣️" title="Foro vacío" sub="Sé el primero en abrir un tema."/>:topics.map(t=>{const a=authorOf(t);return <Card key={t.id} hover onClick={()=>setActive(t)} style={{marginBottom:10}}><div style={{display:"flex",gap:10,alignItems:"center"}}><PublicAvatar profile={a} size={36}/><div style={{flex:1}}><div style={{fontWeight:900,color:T.g800}}>{t.titulo||t.contenido?.slice(0,48)||"Tema"}</div><div style={{fontSize:".75rem",fontWeight:800,color:T.textSub}}>{publicName(a)} · 👍 {t.likes_count||0} · 💬 {getReplies(t.id).length}</div></div></div></Card>;})}
    <PublicProfileModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)}/>
  </div>;
}

// TIENDA
function Tienda({user,setUser,showToast,showPoints}){
  const [productos,setProductos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState("todo");
  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    let data=await dbGet("tienda_items","?activo=eq.true&order=puntos_precio.asc&select=*");
    if(!Array.isArray(data)||!data.length){
      data=await dbGet("premios","?activo=eq.true&order=puntos_precio.asc&select=*");
    }
    setProductos(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  async function canjear(p){
    const precio=Number(p.puntos_precio)||0;
    const stockLimitado=p.stock!==null && p.stock!==undefined && String(p.stock)!=="";
    if((user.puntos||0)<precio){showToast("No tienes suficientes puntos");SFX.error();return;}
    if(stockLimitado && Number(p.stock)<=0){showToast("Este premio está agotado");SFX.error();return;}
    const nuevos=Math.max(0,(user.puntos||0)-precio);
    const okUser=await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    await dbPost("canjes",{
      usuario_id:user.id,
      premio_id:p.id,
      premio_nombre:p.nombre,
      puntos_gastados:precio,
      item_key:p.item_key||null,
      categoria:p.categoria||"premios",
      tipo:p.tipo||"canje"
    });
    if(stockLimitado){
      await dbPatch("tienda_items",`?id=eq.${p.id}`,{stock:Math.max(0,Number(p.stock)-1)});
    }
    if(okUser){
      setUser(u=>({...u,puntos:nuevos}));
      SFX.coins();
      showToast(`${p.nombre} canjeado`);
      await load();
    }else{
      showToast("Canje guardado, pero revisa los puntos del usuario");
    }
  }

  const cats=[
    {id:"todo",label:"Todo",icon:"✨"},
    {id:"cupones",label:"Cupones",icon:"🎟️"},
    {id:"avatar",label:"Avatar",icon:"🎭"},
    {id:"juegos",label:"Juegos",icon:"🎮"},
    {id:"premios",label:"Premios",icon:"🎁"}
  ];
  const visibles=cat==="todo"?productos:productos.filter(p=>String(p.categoria||"premios")===cat);

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🛍️" title="Tienda" sub={`Tienes ${user.puntos||0} pts`}/>
      <Card style={{background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",marginBottom:16,padding:"14px 16px",color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div><div style={{fontSize:"0.72rem",fontWeight:950,opacity:0.78,letterSpacing:".08em",textTransform:"uppercase"}}>Puntos de fidelidad</div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"2rem",lineHeight:1}}>{user.puntos||0}</div><div style={{fontSize:".78rem",fontWeight:800,opacity:.82,marginTop:3}}>Canjea por cupones, avatar, juegos y premios. No equivalen a euros.</div></div>
          <div className="icon3d" style={{fontSize:"2.8rem"}}>🎁</div>
        </div>
      </Card>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=><button key={c.id} onClick={()=>{SFX.tab();setCat(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${cat===c.id?T.gold:T.g300}`,background:cat===c.id?T.gradGold:"rgba(255,244,214,.84)",color:cat===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>
          {c.icon} {c.label}
        </button>)}
      </div>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin premios todavía" sub="Pronto habrá novedades en esta categoría."/>
        :visibles.map(p=>{
          const precio=Number(p.puntos_precio)||0;
          const ok=(user.puntos||0)>=precio;
          const stockLimitado=p.stock!==null && p.stock!==undefined && String(p.stock)!=="";
          const agotado=stockLimitado && Number(p.stock)<=0;
          return(
            <Card key={p.id} style={{marginBottom:12,border:ok&&!agotado?`2px solid ${T.g400}`:`1px solid ${T.g150}`,opacity:ok&&!agotado?1:0.78,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{display:"flex",gap:10,flex:1,minWidth:0}}>
                  <div className="icon3d" style={{fontSize:"2rem"}}>{p.icono||"🎁"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:950,color:T.g800}}>{p.nombre}</div>
                    <div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2,fontWeight:800,lineHeight:1.35}}>{p.descripcion}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                      <Badge col="gold">{p.categoria||"premios"}</Badge>
                      <Badge col={p.rareza==="epico"?"pink":p.rareza==="raro"?"blue":p.rareza==="legendario"?"gold":"green"}>{rarityLabel(p.rareza||"comun")}</Badge>
                      {stockLimitado&&<Badge col={agotado?"red":"green"}>Stock {Number(p.stock)||0}</Badge>}
                    </div>
                  </div>
                </div>
                <div style={{fontWeight:950,color:T.orange,fontSize:"1.08rem",whiteSpace:"nowrap"}}>{precio} pts</div>
              </div>
              <div style={{marginTop:12}}>
                {agotado?<div style={{textAlign:"center",fontSize:"0.78rem",color:T.red,fontWeight:950}}>Agotado</div>:
                ok?<Btn full small col="gold" onClick={()=>canjear(p)}>Canjear</Btn>:<div style={{textAlign:"center",fontSize:"0.78rem",color:T.textSub,fontWeight:850}}>Faltan {precio-(user.puntos||0)} pts</div>}
              </div>
            </Card>
          );
        })
      }
    </div>
  );
}

// CUPONES
function Cupones({user,showToast}){
  const [cupones,setCupones]=useState([]);const [code,setCode]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setCupones(await dbGet("cupones","?activo=eq.true&order=created_at.desc&select=*")||[]);setLoading(false);}
  async function validar(){
    if(!code.trim())return;
    const found=cupones.find(c=>c.codigo?.toLowerCase()===code.toLowerCase());
    if(!found){showToast("Cupon no valido");SFX.error();return;}
    if(new Date(found.fecha_fin)<new Date()){showToast("Cupon caducado");SFX.error();return;}
    SFX.coins();showToast(`${found.descuento}% de descuento - valido!`);
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏷️" title="Cupones" sub="Descuentos exclusivos"/>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:800,color:T.g700,marginBottom:10}}>Validar cupon</div>
        <div style={{display:"flex",gap:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: BIENVENIDA10" style={{flex:1,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.88rem",outline:"none",fontWeight:700}}/>
          <Btn small onClick={validar}>Validar</Btn>
        </div>
      </Card>
      {loading?<Spinner/>:cupones.map(c=>(
        <Card key={c.id} style={{marginBottom:10,background:T.g50}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.2rem",color:T.g800}}>{c.codigo}</div><div style={{fontSize:"0.8rem",color:T.textSub}}>{c.servicio||"Cualquier servicio"}</div></div>
            <div style={{background:T.gradPink,color:T.white,borderRadius:12,padding:"8px 14px",fontWeight:900,fontSize:"1.1rem"}}>-{c.descuento}%</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// JUEGOS
const TODAY_KEY=()=>new Date().toISOString().split("T")[0];
function getPlayedToday(gid,uid){return localStorage.getItem(`played_${gid}_${uid}_${TODAY_KEY()}`)==="1";}
function markPlayedToday(gid,uid){localStorage.setItem(`played_${gid}_${uid}_${TODAY_KEY()}`,"1");}
const GAME_DAILY_REWARDS={stitch:15,runner:12,jump:12,memoria:15,sopa:15,trivia:8,gacha:50};
const ARCADE_GAMES=[
  {id:"gacha",icon:"🎰",title:"Gacha Barber",desc:"Máquina de premios: 50 tiradas al día",pts:GAME_DAILY_REWARDS.gacha},
  {id:"stitch",icon:"🪝",title:"Gancho Ninja",desc:"Rondas de 100 puntos",pts:GAME_DAILY_REWARDS.stitch},
  {id:"runner",icon:"✂️",title:"Rasta Runner",desc:"Salta tijeras hasta chocar",pts:GAME_DAILY_REWARDS.runner},
  {id:"jump",icon:"🌤️",title:"Rasta Jump",desc:"Recoge utensilios y evita tijeras",pts:GAME_DAILY_REWARDS.jump},
  {id:"memoria",icon:"🧠",title:"Memoria Pro",desc:"12 parejas de peluquería",pts:GAME_DAILY_REWARDS.memoria},
  {id:"sopa",icon:"🔤",title:"Sopa diaria",desc:"Sopa 14x14 que cambia cada día",pts:GAME_DAILY_REWARDS.sopa},
  {id:"trivia",icon:"💈",title:"Trivia Barber",desc:"Preguntas capilares",pts:GAME_DAILY_REWARDS.trivia}
];
const GAME_DAILY_CAP=75;
const GACHA_DAILY_PULL_LIMIT=50;
function gachaPullsKey(uid){return `gacha_pulls_${uid||"anon"}_${TODAY_KEY()}`;}
function getGachaPullsToday(uid){try{return Number(localStorage.getItem(gachaPullsKey(uid))||0);}catch{return 0;}}
function setGachaPullsToday(uid,value){try{localStorage.setItem(gachaPullsKey(uid),String(Math.max(0,Number(value)||0)));}catch{}}
function dailyGamePointsKey(uid){return `game_points_total_${uid}_${TODAY_KEY()}`;}
function getDailyGamePointsTotal(uid){return Number(localStorage.getItem(dailyGamePointsKey(uid))||0);}
function addDailyGamePointsTotal(uid,pts){const next=getDailyGamePointsTotal(uid)+(Number(pts)||0);localStorage.setItem(dailyGamePointsKey(uid),String(next));return next;}
function gameRewardFor(gameId,score,uid){
  const maxReward=GAME_DAILY_REWARDS[gameId]||10;
  const performance=Math.max(0,Number(score)||0);
  const remaining=Math.max(0,GAME_DAILY_CAP-getDailyGamePointsTotal(uid));
  return Math.min(maxReward,performance,remaining);
}
function weekKey(){
  const d=new Date();
  const first=new Date(d.getFullYear(),0,1);
  const week=Math.ceil((((d-first)/86400000)+first.getDay()+1)/7);
  return `${d.getFullYear()}-W${String(week).padStart(2,"0")}`;
}
function saveLocalGameScore(gameId,user,score){
  try{
    const key=`leader_${gameId}_${weekKey()}`;
    const list=JSON.parse(localStorage.getItem(key)||"[]");
    const privacy=normalizePrivacy(user);
    const entry={user_id:user.id,nombre:user.nombre||"Jugador",avatar:user.avatar||0,avatar_config:user.avatarConfig||user.avatar_config||null,perfil_publico:privacy.perfil_publico,modo_incognito:privacy.modo_incognito,score:Number(score)||0,created_at:new Date().toISOString()};
    const next=[entry,...list].sort((a,b)=>b.score-a.score).slice(0,10);
    localStorage.setItem(key,JSON.stringify(next));
  }catch{}
}
function getLocalGameLeaderboard(gameId){
  try{return JSON.parse(localStorage.getItem(`leader_${gameId}_${weekKey()}`)||"[]");}catch{return [];}
}
function getMyBestScore(gameId,uid){
  try{
    const list=JSON.parse(localStorage.getItem(`leader_${gameId}_${weekKey()}`)||"[]");
    return list.filter(x=>String(x.user_id)===String(uid)).sort((a,b)=>b.score-a.score)[0]?.score||0;
  }catch{return 0;}
}
const GAME_META={
  gacha:{icon:"🎰",title:"Gacha Barber",short:"Gacha"},
  stitch:{icon:"🪝",title:"Gancho Ninja",short:"Gancho"},
  runner:{icon:"✂️",title:"Rasta Runner",short:"Runner"},
  jump:{icon:"🌤️",title:"Rasta Jump",short:"Jump"},
  memoria:{icon:"🧠",title:"Memoria Pro",short:"Memoria"},
  sopa:{icon:"🔤",title:"Sopa diaria",short:"Sopa"},
  trivia:{icon:"💈",title:"Trivia Barber",short:"Trivia"}
};
function gameMeta(gameId){return GAME_META[gameId]||{icon:"🎮",title:gameId||"Juego",short:gameId||"Juego"};}
function dedupeBestScores(rows=[]){
  const byUser={};
  for(const r of rows){
    const key=String(r.user_id||r.usuario_id||r.email||r.nombre||Math.random());
    const score=Number(r.score)||0;
    if(!byUser[key]||score>Number(byUser[key].score||0)) byUser[key]={...r,user_id:key,score};
  }
  return Object.values(byUser).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,10);
}
async function loadSupabaseGameLeaderboard(gameId,mode="weekly"){
  try{
    const g=encodeURIComponent(String(gameId));
    const query=mode==="weekly"
      ? `?game_id=eq.${g}&week=eq.${encodeURIComponent(weekKey())}&order=score.desc&limit=80&select=*`
      : `?game_id=eq.${g}&order=score.desc&limit=120&select=*`;
    const rows=await safeList("game_scores",query);
    if(!rows.length)return[];
    const ids=[...new Set(rows.map(r=>r.usuario_id).filter(Boolean).map(String))];
    let userMap={};
    if(ids.length){
      const usersRaw=await safeList("usuarios",`?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,nombre,avatar,perfil_publico,modo_incognito`);
      const users=await enrichProfilesWithAvatarConfigs(usersRaw||[]);
      userMap=Object.fromEntries((users||[]).map(u=>[String(u.id),u]));
    }
    return dedupeBestScores(rows.map(r=>{
      const u=userMap[String(r.usuario_id)]||{};
      const privacy=normalizePrivacy({...u,perfil_publico:u.perfil_publico,modo_incognito:u.modo_incognito});
      return {
        ...r,
        user_id:r.usuario_id,
        nombre:u.nombre||r.usuario_nombre||"Jugador",
        avatar:u.avatar??r.usuario_avatar??0,
        avatar_config:u.avatar_config||r.usuario_avatar_config||null,
        perfil_publico:privacy.perfil_publico,
        modo_incognito:privacy.modo_incognito
      };
    }));
  }catch{return [];}
}

const SOPA_WORD_BANK=[
  "TIJERA","NAVAJA","PEINE","COLOR","BRILLO","CORTE","MECHAS","RIZOS","SECADOR","GANCHILLO","RASTAS","BARBA",
  "FADE","TRENZA","CREMA","ACEITE","LAVADO","FIBRA","CURLY","MOÑO","LACA","CEPILLO","BIGOTE","FLEQUILLO",
  "RAPADO","TINTURA","ONDAS","NUTRIR","BRUSHING","AFRO","MELENA","DISEÑO","PERFILAR","RAIZ","TRATAMIENTO","PEINADO"
];
function gameTodayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function seedFromString(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function seededRand(seed){
  let t=seed>>>0;
  return function(){
    t+=0x6D2B79F5;
    let r=Math.imul(t^(t>>>15),1|t);
    r^=r+Math.imul(r^(r>>>7),61|r);
    return ((r^(r>>>14))>>>0)/4294967296;
  };
}
function pickDailySopaWords(seed,count=14){
  const rng=seededRand(seed);
  return [...SOPA_WORD_BANK]
    .map(w=>({w,k:rng()}))
    .sort((a,b)=>a.k-b.k)
    .slice(0,count)
    .map(x=>x.w);
}
function generateGrid(words,seed=Date.now()){
  const SIZE=14,grid=Array(SIZE).fill(null).map(()=>Array(SIZE).fill(""));
  const rng=seededRand(seed);
  const placed=[],DIRS=[[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
  for(const word of words){
    let tries=0;
    while(tries<320){
      tries++;
      const dir=DIRS[Math.floor(rng()*DIRS.length)];
      const r=Math.floor(rng()*SIZE),c=Math.floor(rng()*SIZE);
      let ok=true;
      for(let i=0;i<word.length;i++){const nr=r+dir[0]*i,nc=c+dir[1]*i;if(nr<0||nr>=SIZE||nc<0||nc>=SIZE||(grid[nr][nc]!==""&&grid[nr][nc]!==word[i])){ok=false;break;}}
      if(ok){const cells=[];for(let i=0;i<word.length;i++){const nr=r+dir[0]*i,nc=c+dir[1]*i;grid[nr][nc]=word[i];cells.push(`${nr}-${nc}`);}placed.push({word,cells});break;}
    }
  }
  const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(grid[r][c]==="")grid[r][c]=L[Math.floor(rng()*L.length)];
  return{grid,placed};
}

function SopaLetras({onWin,user}){
  const [puzzle]=useState(()=>{
    const day=gameTodayKey();
    const seed=seedFromString(`${day}-sopa-rasta`);
    const words=pickDailySopaWords(seed,14);
    return {day,words,...generateGrid(words,seed)};
  });
  const {grid,placed,words,day}=puzzle;
  const [found,setFound]=useState([]);
  const [selected,setSelected]=useState([]);
  const [start,setStart]=useState(null);
  const [wrong,setWrong]=useState(false);
  const isSelecting=useRef(false);
  const SIZE=grid.length;

  function ck(r,c){return `${r}-${c}`;}

  function getCells(r1,c1,r2,c2){
    const dr=r2-r1,dc=c2-c1,len=Math.max(Math.abs(dr),Math.abs(dc));
    if(len===0)return[ck(r1,c1)];
    if(dr!==0&&dc!==0&&Math.abs(dr)!==Math.abs(dc))return[ck(r1,c1)];
    const sr=dr===0?0:dr/Math.abs(dr),sc=dc===0?0:dc/Math.abs(dc);
    return[...Array(len+1)].map((_,i)=>ck(r1+sr*i,c1+sc*i));
  }

  function handleStart(r,c){
    isSelecting.current=true;
    setStart({r,c});
    setSelected([ck(r,c)]);
    setWrong(false);
  }

  function handleMove(r,c){
    if(!isSelecting.current||!start)return;
    setSelected(getCells(start.r,start.c,r,c));
  }

  function handleEnd(){
    if(!isSelecting.current)return;
    isSelecting.current=false;
    for(const p of placed){
      if(p.cells.join(",")===selected.join(",")||[...p.cells].reverse().join(",")===selected.join(",")){
        if(!found.includes(p.word)){
          const nf=[...found,p.word];
          setFound(nf);
          if(nf.length===placed.length)setTimeout(()=>onWin(Math.min(35,nf.length*3)),300);
        }
        setSelected([]);setStart(null);return;
      }
    }
    setWrong(true);
    setTimeout(()=>{setWrong(false);setSelected([]);setStart(null);},700);
  }

  const foundCells=new Set(found.flatMap(w=>placed.find(p=>p.word===w)?.cells||[]));

  return(
    <div>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#EFE0BE,#E2CAA0)",border:`1.5px solid ${T.g300}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={38}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,color:T.g800}}>🔤 Sopa diaria 14x14</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>Cada día cambia la sopa. Hoy: {day} · {found.length}/{placed.length} palabras.</div>
          </div>
        </div>
      </Card>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {words.map(w=><Badge key={w} col={found.includes(w)?"green":"gold"}>{found.includes(w)?"OK ":""}{w}</Badge>)}
      </div>
      <div
        style={{userSelect:"none",touchAction:"none",display:"inline-block",maxWidth:"100%",overflowX:"auto",background:"#F5E6C8",borderRadius:12,padding:8,border:`2px solid ${T.g400}`,cursor:"crosshair"}}
        onMouseLeave={handleEnd}
      >
        {Array(SIZE).fill(null).map((_,r)=>(
          <div key={r} style={{display:"flex"}}>
            {Array(SIZE).fill(null).map((_,c)=>{
              const key=ck(r,c),isSel=selected.includes(key),isF=foundCells.has(key);
              return(
                <div key={c}
                  onMouseDown={e=>{e.preventDefault();handleStart(r,c);}}
                  onMouseEnter={()=>handleMove(r,c)}
                  onMouseUp={handleEnd}
                  onTouchStart={e=>{e.preventDefault();handleStart(r,c);}}
                  onTouchMove={e=>{
                    e.preventDefault();
                    const t=e.touches[0];
                    const el=document.elementFromPoint(t.clientX,t.clientY);
                    if(el&&el.dataset.row&&el.dataset.col){
                      handleMove(parseInt(el.dataset.row),parseInt(el.dataset.col));
                    }
                  }}
                  onTouchEnd={e=>{e.preventDefault();handleEnd();}}
                  data-row={r} data-col={c}
                  style={{
                    width:"clamp(21px,6.05vw,27px)",height:"clamp(21px,6.05vw,27px)",display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"clamp(0.62rem,2.65vw,0.82rem)",fontWeight:900,cursor:"crosshair",borderRadius:6,
                    background:isF?"#8B4513":isSel?(wrong?"#FFCDD2":"#D4AF37"):"transparent",
                    color:isF?"#F5E6C8":isSel?(wrong?"#8B0000":"#2C1810"):"#2C1810",
                    border:isSel&&!wrong?`2px solid #8B4513`:"2px solid transparent",
                    transition:"background 0.08s",
                    fontFamily:"'Crimson Text',serif",
                  }}>
                  {grid[r][c]}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{marginTop:10,fontSize:"0.82rem",color:T.textSub,fontWeight:800,lineHeight:1.45}}>Arrastra letras en línea recta: horizontal, vertical o diagonal. Mañana aparecerá una sopa distinta automáticamente.</div>
    </div>
  );
}


const MEMO_ITEMS=[
  {id:"tijera",emoji:"✂️",label:"Tijera"},
  {id:"peine",emoji:"🪮",label:"Peine"},
  {id:"secador",emoji:"🌬️",label:"Secador"},
  {id:"navaja",emoji:"🪒",label:"Navaja"},
  {id:"rastas",emoji:"〰️",label:"Rastas"},
  {id:"color",emoji:"🎨",label:"Color"},
  {id:"barba",emoji:"🧔",label:"Barba"},
  {id:"brillo",emoji:"✨",label:"Brillo"},
  {id:"champu",emoji:"🧴",label:"Champú"},
  {id:"pinza",emoji:"📎",label:"Pinza"},
  {id:"espejo",emoji:"🪞",label:"Espejo"},
  {id:"ganchillo",emoji:"🪝",label:"Gancho"},
];
function MemoryGame({onWin}){
  const build=()=>{const base=MEMO_ITEMS.slice(0,12);return [...base,...base].map((e,i)=>({id:i,pair:e.id,item:e,flipped:false,matched:false})).sort(()=>Math.random()-0.5);};
  const [cards,setCards]=useState(build);
  const [flipped,setFlipped]=useState([]);
  const [moves,setMoves]=useState(0);
  const [lock,setLock]=useState(false);
  function restart(){setCards(build());setFlipped([]);setMoves(0);setLock(false);}
  function flip(id){
    if(lock)return;
    const card=cards.find(c=>c.id===id);
    if(!card||card.flipped||card.matched)return;
    SFX.click();
    const nc=cards.map(c=>c.id===id?{...c,flipped:true}:c);
    const nf=[...flipped,id];
    setCards(nc);setFlipped(nf);
    if(nf.length===2){
      setLock(true);setMoves(m=>m+1);
      const [a,b]=nf.map(fid=>nc.find(c=>c.id===fid));
      setTimeout(()=>{
        if(a.pair===b.pair){
          const m=nc.map(c=>nf.includes(c.id)?{...c,matched:true}:c);
          setCards(m);setFlipped([]);setLock(false);
          if(m.every(c=>c.matched))onWin(Math.max(36-moves,8));
        }else{
          setCards(nc.map(c=>nf.includes(c.id)?{...c,flipped:false}:c));
          setFlipped([]);setLock(false);
        }
      },760);
    }
  }
  return(
    <div>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#EFE0BE,#E2CAA0)",border:`1.5px solid ${T.g300}`}}>
        <div style={{fontWeight:900,color:T.g800,marginBottom:4}}>🧠 Memoria Pro</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.45}}>Encuentra las 12 parejas. Recuperamos la dificultad buena: 24 tarjetas y puntuación por eficiencia.</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <span style={{fontSize:"0.82rem",color:T.g700,fontWeight:900}}>Movimientos: {moves}</span>
          <Btn small col="ghost" onClick={restart}>🔁 Reiniciar</Btn>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
        {cards.map(c=><button key={c.id} onClick={()=>flip(c.id)} style={{height:66,borderRadius:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:"1.25rem",fontWeight:900,cursor:"pointer",background:c.flipped||c.matched?"linear-gradient(180deg,#FFF4D6,#E6C27A)":"linear-gradient(180deg,#6E3518,#24110A)",color:c.flipped||c.matched?T.g800:T.g600,border:`2px solid ${c.matched?T.gold:T.g500}`,transition:"all 0.2s",boxShadow:"0 6px 14px rgba(20,8,4,.18)"}}>
          {(c.flipped||c.matched)?<><span>{c.item.emoji}</span><span style={{fontSize:".55rem",marginTop:2}}>{c.item.label}</span></>:<span style={{color:T.g200}}>?</span>}
        </button>)}
      </div>
    </div>
  );
}

const TRIVIA_QS=[
  {q:"Cuantos volumenes tiene el tinte permanente mas comun?",opts:["20 vol","30 vol","10 vol","40 vol"],a:1},
  {q:"Que vitamina es esencial para el cabello sano?",opts:["Vitamina C","Vitamina K","Biotina B7","Vitamina D"],a:2},
  {q:"Cual es el pH ideal del cabello?",opts:["4.5-5.5","7-8","2-3","6-7"],a:0},
  {q:"Que es la queratina?",opts:["Un tinte","Una proteina capilar","Un champu","Una vitamina"],a:1},
  {q:"Cada cuanto se recomienda cortar las puntas?",opts:["Cada año","Cada 6-8 semanas","Cada semana","Cada 6 meses"],a:1},
];
function TriviaGame({onWin}){
  const [idx,setIdx]=useState(0);const [score,setScore]=useState(0);const [answered,setAnswered]=useState(null);
  const q=TRIVIA_QS[idx];
  function answer(i){
    if(answered!==null)return;setAnswered(i);const correct=i===q.a;
    if(correct){SFX.success();setScore(s=>s+1);}else SFX.error();
    setTimeout(()=>{if(idx+1>=TRIVIA_QS.length)onWin(score+(correct?1:0));else{setIdx(x=>x+1);setAnswered(null);}},1200);
  }
  return(
    <div>
      <div style={{fontSize:"0.78rem",color:T.textSub,fontWeight:700,marginBottom:12}}>Pregunta {idx+1}/{TRIVIA_QS.length} - Puntos: {score}</div>
      <div style={{fontWeight:800,fontSize:"0.95rem",color:T.g800,marginBottom:16,lineHeight:1.5}}>{q.q}</div>
      {q.opts.map((o,i)=><button key={i} onClick={()=>answer(i)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",borderRadius:12,marginBottom:8,border:"2px solid",borderColor:answered!==null?(i===q.a?T.g500:i===answered?T.red:T.g200):T.g200,background:answered!==null?(i===q.a?T.g150:i===answered?"#FFEBEE":T.white):T.white,fontSize:"0.88rem",fontWeight:700,cursor:answered!==null?"default":"pointer",transition:"all 0.2s"}}>{answered!==null&&i===q.a?"OK ":answered===i&&i!==q.a?"X ":""}{o}</button>)}
    </div>
  );
}



function RastaRunnerGame({onWin,user}){
  const [running,setRunning]=useState(false);
  const [score,setScore]=useState(0);
  const [obstacles,setObstacles]=useState([]);
  const [gameOver,setGameOver]=useState(false);
  const [y,setY]=useState(0);
  const [jumpsLeft,setJumpsLeft]=useState(2);
  const [holding,setHolding]=useState(false);
  const yRef=useRef(0),vyRef=useRef(0),jumpRef=useRef(2),holdRef=useRef(false),holdMsRef=useRef(0),runningRef=useRef(false);

  function resetAndStart(){
    yRef.current=0;vyRef.current=0;jumpRef.current=2;holdRef.current=false;holdMsRef.current=0;runningRef.current=true;
    setY(0);setJumpsLeft(2);setHolding(false);setScore(0);setObstacles([{x:115,id:Date.now(),type:'scissor'}]);setGameOver(false);setRunning(true);
  }
  function pressJump(){
    if(!runningRef.current||gameOver) return;
    if(jumpRef.current<=0) return;
    SFX.tab();
    vyRef.current=jumpRef.current===2?13.8:12.4;
    jumpRef.current-=1;
    holdRef.current=true;
    holdMsRef.current=0;
    setHolding(true);setJumpsLeft(jumpRef.current);
  }
  function releaseJump(){holdRef.current=false;holdMsRef.current=0;setHolding(false);}

  useEffect(()=>{runningRef.current=running;},[running]);
  useEffect(()=>{
    if(!running) return;
    const down=e=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();pressJump();}};
    const up=e=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();releaseJump();}};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[running,gameOver]);
  useEffect(()=>{
    if(!running) return;
    const timer=setInterval(()=>{
      setScore(s=>s+1);
      let vy=vyRef.current;
      let yy=yRef.current;
      if(holdRef.current && holdMsRef.current<860 && vy>0){vy+=0.42;holdMsRef.current+=45;}
      vy-=1.05;
      yy+=vy;
      if(yy<=0){yy=0;vy=0;jumpRef.current=2;setJumpsLeft(2);}
      yRef.current=yy;vyRef.current=vy;setY(yy);
      setObstacles(prev=>{
        const dynamicSpeed=Math.min(2.95,1.45+score/210);
        let next=prev.map(o=>({...o,x:o.x-dynamicSpeed})).filter(o=>o.x>-18);
        const last=next[next.length-1];
        if(!last || last.x<55+Math.random()*22){
          next=[...next,{x:112+Math.random()*28,id:Date.now()+Math.random(),type:Math.random()<.82?'scissor':'comb'}];
        }
        const hit=next.some(o=>o.x<24 && o.x>9 && yRef.current<27);
        if(hit){setRunning(false);runningRef.current=false;setGameOver(true);SFX.error();}
        return next;
      });
    },45);
    return()=>clearInterval(timer);
  },[running,score,gameOver]);
  const pts=Math.max(1,Math.min(12,Math.floor(score/30)));
  const jumpTxt=running?`Saltos: ${jumpsLeft} · ${holding?'manteniendo':'toca para saltar'}`:'Doble salto y salto sostenido';
  return <Card style={{background:'linear-gradient(180deg,#F4E5BE,#E7CA8A)',border:`2px solid ${T.g300}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:8}}><div style={{fontWeight:900,color:T.g800}}>🦖✂️ Rasta Runner</div><Badge col='gold'>Doble salto</Badge></div>
    <div
      onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);pressJump();}}
      onPointerUp={releaseJump}
      onPointerCancel={releaseJump}
      onPointerLeave={releaseJump}
      style={{position:'relative',height:205,borderRadius:20,overflow:'hidden',background:'linear-gradient(180deg,#DDEBFF,#FFF0C9 72%,#C7A25C 72%)',border:'2px solid rgba(62,35,18,.15)',touchAction:'none',cursor:running?'pointer':'default'}}
    >
      <div style={{position:'absolute',left:0,right:0,bottom:28,height:4,background:'#6E3518'}}/>
      <div style={{position:'absolute',left:14,bottom:32+y,transition:'none'}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={44}/></div>
      <div style={{position:'absolute',left:10,bottom:8,fontSize:'.76rem',fontWeight:900,color:T.g700}}>Distancia: {score}</div>
      <div style={{position:'absolute',right:10,bottom:8,fontSize:'.72rem',fontWeight:900,color:T.g700}}>{jumpTxt}</div>
      {obstacles.map((o,i)=><div key={o.id||i} style={{position:'absolute',left:`${o.x}%`,bottom:22,fontSize:o.type==='comb'?'1.35rem':'1.55rem',filter:'drop-shadow(0 3px 4px rgba(0,0,0,.22))'}}>{o.type==='comb'?'🪮':'✂️'}</div>)}
      {!running && !gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,248,230,.42)',padding:18}}><div style={{textAlign:'center'}}><div style={{fontWeight:900,color:T.g800,marginBottom:10}}>Más rápido, salto largo y doble salto.</div><Btn col='gold' onClick={resetAndStart}>▶ Empezar</Btn></div></div>}
      {gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(40,20,10,.56)',padding:16}}><div style={{textAlign:'center',color:T.white}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.45rem'}}>¡Tijera esquivada hasta {score}!</div><div style={{fontWeight:800,margin:'8px 0 12px'}}>Récord de ronda: {pts} pts</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><Btn col='gold' onClick={()=>onWin(pts)}>Guardar récord</Btn><Btn col='ghost' onClick={resetAndStart}>🔁 Reintentar</Btn></div></div></div>}
    </div>
    <div style={{marginTop:10,fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45}}>Controles: toca y mantén para saltar más tiempo, suelta para caer antes. Puedes pulsar dos veces para doble salto. Teclado: espacio/flecha arriba.</div>
  </Card>;
}


function PlatformJumpGame({onWin,user}){
  const [running,setRunning]=useState(false);
  const [lane,setLane]=useState(1);
  const [items,setItems]=useState([]);
  const [score,setScore]=useState(0);
  const [gameOver,setGameOver]=useState(false);
  const [speed,setSpeed]=useState(1);
  const lanes=[18,50,82];
  const GOOD=[{icon:'🪝',pts:10,name:'ganchillo'},{icon:'🪮',pts:8,name:'peine'},{icon:'🧵',pts:12,name:'goma'},{icon:'💈',pts:6,name:'barber'}];
  function resetAndStart(){setLane(1);setItems([]);setScore(0);setSpeed(1);setGameOver(false);setRunning(true);}
  function move(dir){setLane(l=>Math.max(0,Math.min(2,l+dir)));SFX.click();}
  useEffect(()=>{
    if(!running) return;
    const onKey=e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[running]);
  useEffect(()=>{
    if(!running) return;
    const timer=setInterval(()=>{
      setSpeed(v=>Math.min(3.8,v+0.008));
      setItems(prev=>{
        let next=prev.map(it=>({...it,y:it.y+(1.15*speed)}));
        next.forEach(it=>{
          if(!it.done && it.y>78 && it.y<96 && it.lane===lane){
            it.done=true;
            if(it.bad){setRunning(false);setGameOver(true);SFX.error();}
            else{setScore(s=>s+it.pts);SFX.coins();}
          }
        });
        next=next.filter(it=>!it.done && it.y<112);
        const last=next[next.length-1];
        const spawnGap=Math.max(23,44-speed*4);
        if(!last || last.y>spawnGap){
          const bad=Math.random()<Math.min(.26,.10+score/450);
          const good=GOOD[Math.floor(Math.random()*GOOD.length)];
          next=[...next,{id:Date.now()+Math.random(),lane:Math.floor(Math.random()*3),y:-10,bad,icon:bad?'✂️':good.icon,pts:good.pts}];
        }
        return next;
      });
    },70);
    return()=>clearInterval(timer);
  },[running,lane,speed,score]);
  const pts=Math.max(1,Math.min(12,Math.floor(score/25)));
  return <Card style={{background:'linear-gradient(180deg,#F0E3C1,#E4C88F)',border:`2px solid ${T.g300}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontWeight:900,color:T.g800}}>🌤️ Rasta Jump</div><Badge col='pink'>Velocidad gradual</Badge></div>
    <div style={{position:'relative',height:300,borderRadius:20,overflow:'hidden',background:'linear-gradient(180deg,#D8ECFF,#F7F1DA 72%,#B9863D 72%)',border:'2px solid rgba(62,35,18,.15)',touchAction:'manipulation'}}>
      <div style={{position:'absolute',top:10,left:12,right:12,display:'flex',justifyContent:'space-between',fontWeight:900,color:T.g800,fontSize:'.8rem'}}><span>Score {score}</span><span>Vel. {speed.toFixed(1)}x</span></div>
      {lanes.map((x,i)=><div key={i} onClick={()=>setLane(i)} style={{position:'absolute',left:`${x}%`,top:0,bottom:0,width:2,background:'rgba(110,53,24,.08)',cursor:'pointer'}}/>)}
      {items.map(it=><div key={it.id} style={{position:'absolute',left:`${lanes[it.lane]}%`,top:`${it.y}%`,transform:'translate(-50%,-50%)',fontSize:'2rem',filter:'drop-shadow(0 6px 8px rgba(0,0,0,.24))'}}>{it.icon}</div>)}
      <div style={{position:'absolute',left:`${lanes[lane]}%`,bottom:28,transform:'translateX(-50%)'}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={52}/></div>
      <div style={{position:'absolute',left:0,right:0,bottom:18,height:4,background:'#6E3518'}}/>
      {!running && !gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,248,230,.50)',padding:16}}><div style={{textAlign:'center'}}><div style={{fontWeight:900,color:T.g800,marginBottom:8}}>Recoge ganchillos, peines y gomas. Evita tijeras.</div><Btn col='gold' onClick={resetAndStart}>▶ Empezar</Btn></div></div>}
      {gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(40,20,10,.58)',padding:16}}><div style={{textAlign:'center',color:T.white}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.45rem'}}>¡Te cortaron la racha!</div><div style={{fontWeight:800,margin:'8px 0 12px'}}>Score {score} · récord {pts}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><Btn col='gold' onClick={()=>onWin(pts)}>Guardar récord</Btn><Btn col='ghost' onClick={resetAndStart}>🔁 Reintentar</Btn></div></div></div>}
    </div>
    {running&&<div style={{display:'flex',gap:8,marginTop:12}}><Btn full col='ghost' onClick={()=>move(-1)}>⬅️ Izq.</Btn><Btn full col='dark' onClick={()=>setLane(1)}>Centro</Btn><Btn full col='ghost' onClick={()=>move(1)}>Der. ➡️</Btn></div>}
    <div style={{marginTop:10,fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45}}>El ritmo sube poco a poco hasta una velocidad alta. Cada objeto aparece en carriles aleatorios.</div>
  </Card>;
}


function DreadStitchGame({onWin,user}){
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [items,setItems]=useState([]);
  const [round,setRound]=useState(1);
  const [completed,setCompleted]=useState(0);
  const [hits,setHits]=useState(0);
  const [scissors,setScissors]=useState(0);
  const [roundPoints,setRoundPoints]=useState(0);
  const [bonusHits,setBonusHits]=useState(0);
  const [message,setMessage]=useState('Llega a 100 puntos con 81 o más aciertos. Si tocas 20 tijeras, pierdes.');
  const [lastAccuracy,setLastAccuracy]=useState(100);
  const areaRef=useRef(null);
  const accuracy=Math.round((hits/Math.max(1,hits+scissors))*100);
  const spawnMs=Math.max(330,760-round*38);
  const lifeMs=Math.max(780,1750-round*55);
  const scissorChance=Math.min(.42,.13+round*.025);
  function resetRound(){setItems([]);setHits(0);setScissors(0);setRoundPoints(0);setBonusHits(0);}
  function start(){resetRound();setRound(1);setCompleted(0);setLastAccuracy(100);setMessage('Ronda 1: llega a 100 puntos. El dorado vale +5 y sale muy poco.');setFinished(false);setRunning(true);}
  function finish(done=false){setRunning(false);setFinished(true);setItems([]);setLastAccuracy(accuracy);setMessage(done?`Has cerrado ${completed} ronda${completed===1?'':'s'}.`:`Ronda perdida: ${hits} aciertos y ${scissors} tijeras.`);}
  function passRound(){const next=completed+1;setCompleted(next);setRound(r=>r+1);setLastAccuracy(accuracy);setMessage(`Ronda ${round} superada con ${accuracy}%. Ahora irá más rápido y habrá más tijeras.`);SFX.success();resetRound();}
  useEffect(()=>{
    if(!running)return;
    if(scissors>=20){finish(false);SFX.error();return;}
    if(roundPoints>=100){
      if(hits>=81 && scissors<20) passRound();
      else {finish(false);SFX.error();}
    }
  },[running,roundPoints,hits,scissors]);
  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(()=>{
      setItems(prev=>{
        const now=Date.now();
        let next=prev.filter(it=>now-it.created<lifeMs);
        const r=Math.random();
        const kind=r<0.026?'bonus':r<0.026+scissorChance?'scissor':'good';
        const icon=kind==='bonus'?'🎟️':kind==='scissor'?'✂️':(['🪝','〰️','🧵'][Math.floor(Math.random()*3)]);
        next=[...next,{id:now+Math.random(),kind,icon,x:9+Math.random()*82,y:16+Math.random()*66,created:now}];
        return next.slice(-Math.min(8,3+round));
      });
    },spawnMs);
    return()=>clearInterval(timer);
  },[running,round,spawnMs,lifeMs,scissorChance]);
  function tapItem(item){
    if(!running)return;
    setItems(prev=>prev.filter(i=>i.id!==item.id));
    if(item.kind==='scissor'){setScissors(s=>s+1);SFX.error();return;}
    if(item.kind==='bonus'){setBonusHits(b=>b+1);setHits(h=>h+5);setRoundPoints(p=>Math.min(105,p+5));SFX.coins();return;}
    setHits(h=>h+1);setRoundPoints(p=>Math.min(105,p+1));SFX.click();
  }
  const finalPts=Math.min(15,Math.max(0,completed*5+Math.floor(lastAccuracy/20)));
  return <Card style={{background:'linear-gradient(180deg,#F5E6C8,#E6C27A)',border:`2px solid ${T.gold}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:8,fontWeight:900,color:T.g800}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={36}/> Gancho Ninja</div><Badge col={accuracy>=81?'green':'gold'}>{accuracy}%</Badge></div>
    <div style={{fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45,marginBottom:10}}>Objetivo: <b>100 puntos</b>. Con <b>20 tijeras</b> pierdes. Para pasar necesitas <b>81 aciertos o más</b>. El ticket dorado vale <b>+5</b> y sale muy poco.</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10,textAlign:'center'}}>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Ronda</div>{round}</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Puntos</div>{roundPoints}/100</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Tijeras</div>{scissors}/20</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Dorados</div>{bonusHits}</div>
    </div>
    <div ref={areaRef} style={{height:280,position:'relative',overflow:'hidden',borderRadius:20,border:'2px solid rgba(62,35,18,.18)',background:'radial-gradient(circle at 25% 18%,rgba(255,214,107,.34),transparent 28%),linear-gradient(160deg,#24110A,#6E3518)',touchAction:'none',cursor:running?'crosshair':'default'}}>
      <div style={{position:'absolute',top:12,left:12,right:12,zIndex:2,height:9,borderRadius:999,background:'rgba(255,244,214,.18)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,roundPoints)}%`,background:roundPoints>=100?'linear-gradient(90deg,#2F6B42,#9BE7B0)':'linear-gradient(90deg,#D4AF37,#FFF1A8)',transition:'width .2s ease'}}/></div>
      {items.map(it=><button key={it.id} onClick={()=>tapItem(it)} style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,transform:'translate(-50%,-50%)',width:it.kind==='bonus'?62:54,height:it.kind==='bonus'?62:54,borderRadius:'50%',border:'2px solid rgba(255,244,214,.82)',background:it.kind==='bonus'?'linear-gradient(180deg,#FFF8C8,#D4AF37)':it.kind==='scissor'?'linear-gradient(180deg,#FFEBEE,#C0392B)':'linear-gradient(180deg,#FFF4D6,#D4AF37)',boxShadow:'0 10px 20px rgba(0,0,0,.28)',fontSize:it.kind==='bonus'?'1.8rem':'1.6rem',display:'grid',placeItems:'center',cursor:'pointer',animation:it.kind==='bonus'?'rewardPulsePro 1.2s infinite':'none'}}>{it.icon}</button>)}
      {!running && !finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,244,214,.16)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:300}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem',marginBottom:8}}>100 puntos para cerrar la rasta</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.86,marginBottom:12}}>{message}</div><Btn col='gold' onClick={start}>▶ Empezar</Btn></div></div>}
      {finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(20,8,4,.72)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:300}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem'}}>{completed>0?'Partida terminada':'Ronda perdida'}</div><div style={{fontWeight:900,margin:'8px 0'}}>Rondas {completed} · precisión {lastAccuracy}%</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.85,marginBottom:12}}>{message}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>{finalPts>0&&<Btn col='gold' onClick={()=>onWin(finalPts)}>Guardar récord · {finalPts}</Btn>}<Btn col='ghost' onClick={start}>🔁 Reintentar</Btn></div></div></div>}
    </div>
  </Card>;
}


function GachaSlotsGame({user,onWin}){
  const uid=user?.id||"anon";
  const SYMBOLS={scissors:{icon:'✂️',name:'Tijeras'},comb:{icon:'🪮',name:'Peines'},hook:{icon:'🪝',name:'Ganchillos'},band:{icon:'🧵',name:'Gomas'},ticket:{icon:'🎟️',name:'Ticket dorado'},gem:{icon:'💎',name:'Cristal'},coin:{icon:'🪙',name:'Moneda'}};
  const normal=['scissors','comb','hook','band','coin'];
  const [reels,setReels]=useState(['scissors','comb','hook']);
  const [spinning,setSpinning]=useState(false);
  const [result,setResult]=useState(null);
  const [pulls,setPulls]=useState(()=>getGachaPullsToday(uid));
  const pullsLeft=Math.max(0,GACHA_DAILY_PULL_LIMIT-pulls);
  function pickPrize(){
    const r=Math.random();
    if(r<1/5000)return{pts:50,key:'ticket',label:'Premio gordo: 3 tickets dorados'};
    if(r<1/5000+1/500)return{pts:20,key:'gem',label:'Premio raro: 3 cristales'};
    if(r<1/5000+1/500+1/200)return{pts:10,key:'hook',label:'Premio bueno: 3 ganchillos'};
    if(r<1/5000+1/500+1/200+1/100)return{pts:5,key:'band',label:'Premio: 3 gomas'};
    if(r<1/5000+1/500+1/200+1/100+1/30)return{pts:2,key:'comb',label:'Premio pequeño: 3 peines'};
    if(r<1/5000+1/500+1/200+1/100+1/30+1/10)return{pts:1,key:'scissors',label:'Mini premio: 3 tijeras'};
    return{pts:0,key:null,label:'Sin premio esta vez'};
  }
  function randomReels(){return [0,1,2].map(()=>normal[Math.floor(Math.random()*normal.length)]);}
  function spin(){
    if(spinning)return;
    if(pullsLeft<=0){
      SFX.error();
      setResult({pts:0,key:null,label:'Límite diario alcanzado'});
      return;
    }
    const nextPulls=pulls+1;
    setPulls(nextPulls);
    setGachaPullsToday(uid,nextPulls);
    setSpinning(true);setResult(null);
    let ticks=0;
    const final=pickPrize();
    const spinTimer=setInterval(()=>{
      ticks++;
      setReels(randomReels());
      playTone(220+ticks*16,'square',0.045,0.035);
      if(ticks>=18){
        clearInterval(spinTimer);
        let out;
        if(final.pts>0) out=[final.key,final.key,final.key];
        else{
          out=randomReels();
          if(out[0]===out[1]&&out[1]===out[2]) out[2]=normal[(normal.indexOf(out[2])+1)%normal.length];
        }
        setReels(out);setResult(final);setSpinning(false);
        final.pts>0?SFX.coins():SFX.error();
      }
    },90);
  }
  return <Card style={{background:'linear-gradient(180deg,#271006,#5C3317 55%,#D4AF37)',border:`2px solid ${T.gold}`,color:T.white}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12}}>
      <div>
        <div style={{fontWeight:950,fontSize:'1.05rem'}}>🎰 Gacha Barber</div>
        <div style={{fontSize:'.7rem',fontWeight:850,opacity:.78,marginTop:2}}>Máximo {GACHA_DAILY_PULL_LIMIT} tiradas al día</div>
      </div>
      <Badge col={pullsLeft>0?'gold':'red'}>{pullsLeft}/{GACHA_DAILY_PULL_LIMIT}</Badge>
    </div>
    <div style={{fontSize:'.82rem',fontWeight:800,opacity:.86,lineHeight:1.45,marginBottom:12}}>Junta 3 símbolos iguales. Puedes tirar varias veces, pero el contador diario evita que se abuse de la máquina.</div>
    <div style={{height:8,background:'rgba(255,244,214,.22)',borderRadius:999,overflow:'hidden',marginBottom:14}}>
      <div style={{height:'100%',width:`${Math.min(100,(pulls/GACHA_DAILY_PULL_LIMIT)*100)}%`,background:T.gradGold,borderRadius:999,transition:'width .25s ease'}}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
      {reels.map((key,i)=><div key={i} style={{height:106,borderRadius:22,display:'grid',placeItems:'center',background:'linear-gradient(180deg,#FFF8E6,#E8C477)',border:'3px solid rgba(255,244,214,.75)',boxShadow:'inset 0 8px 18px rgba(0,0,0,.16),0 10px 20px rgba(0,0,0,.22)',fontSize:'2.6rem',animation:spinning?'rewardPulsePro .38s infinite':'none'}}>{SYMBOLS[key]?.icon}</div>)}
    </div>
    {result&&<Card style={{background:'rgba(255,248,230,.9)',border:`2px solid ${result.pts?T.gold:T.g300}`,marginBottom:12}}><div style={{fontWeight:950,color:T.g800}}>{result.label}</div><div style={{fontSize:'.82rem',fontWeight:800,color:T.textSub,marginTop:4}}>{pullsLeft<=0&&result.label==='Límite diario alcanzado'?'Vuelve mañana para tirar otra vez.':result.pts>0?`Premio: ${result.pts} puntos reales si lo cobras hoy.`:'Lo normal es que salga 0. Puedes volver a tirar mientras te queden tiradas.'}</div>{result.pts>0&&<div style={{marginTop:10}}><Btn full col='gold' onClick={()=>onWin(result.pts)}>Cobrar {result.pts} puntos</Btn></div>}</Card>}
    <Btn full col={pullsLeft>0?'gold':'ghost'} disabled={spinning||pullsLeft<=0} onClick={spin}>{spinning?'Girando...':pullsLeft>0?'🎰 Tirar':'Límite diario alcanzado'}</Btn>
    <div style={{marginTop:10,fontSize:'.72rem',fontWeight:800,opacity:.78,lineHeight:1.35}}>Tiradas usadas hoy: {pulls}/{GACHA_DAILY_PULL_LIMIT}. Probabilidades: 50 pts 1/5000 · 20 pts 1/500 · 10 pts 1/200 · 5 pts 1/100 · 2 pts 1/30 · 1 pt 1/10.</div>
  </Card>;
}


function ArcadeInfoPanel({onOpenGacha}){
  const [open,setOpen]=useState(false);
  return <div style={{marginBottom:14}}>
    <div style={{
      background:"#FFF8E6",
      border:`1px solid ${T.g200}`,
      borderRadius:22,
      padding:"13px 14px",
      boxShadow:"0 8px 20px rgba(20,8,4,.10)",
      color:T.text
    }}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div style={{fontSize:".88rem",fontWeight:850,lineHeight:1.42,color:T.g800}}>
          Este es el espacio para jugar, mejorar récords y conseguir puntos diarios para avanzar en recompensas, avatar y descuentos de la tienda.
        </div>
        <button
          onClick={()=>{SFX.tab();setOpen(v=>!v);}}
          style={{
            border:`1px solid ${T.g200}`,
            background:"#FFFFFF",
            borderRadius:999,
            padding:"7px 11px",
            fontWeight:900,
            color:T.g800,
            cursor:"pointer",
            whiteSpace:"nowrap",
            boxShadow:"0 4px 10px rgba(20,8,4,.08)"
          }}
        >
          {open?"Cerrar":"Detalles"}
        </button>
      </div>

      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
        <span style={{background:"#F3E2B5",color:T.g800,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:900}}>récord semanal</span>
        <span style={{background:"#F3E2B5",color:T.g800,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:900}}>puntos diarios</span>
        <span style={{background:"#F3E2B5",color:T.g800,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:900}}>premios y avatar</span>
      </div>

      {open&&<div style={{
        marginTop:12,
        borderTop:`1px solid ${T.g200}`,
        paddingTop:11,
        animation:"fadeSlide .22s ease"
      }}>
        <div style={{display:"grid",gap:8,fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.42}}>
          <div>Los récords sirven para competir y volver a intentarlo. Los puntos reales, en cambio, se cobran de forma limitada para que la tienda y los desbloqueos sigan teniendo valor.</div>
          <div>Cada juego puede entregar puntos una vez al día. Después puedes rejugar para mejorar marca, pero no para farmear puntos sin límite.</div>
          <div>El Gacha Barber es la máquina de premios: casi siempre no toca nada, pero puede soltar recompensas raras si juntas tres símbolos iguales.</div>
        </div>
        <div style={{marginTop:11,display:"flex",justifyContent:"flex-start"}}>
          <Btn small col="gold" onClick={onOpenGacha}>🎰 Abrir Gacha Barber</Btn>
        </div>
      </div>}
    </div>
  </div>;
}


function Juegos({user,setUser,showToast,showPoints,setHelperPage,onOpenTops}){
  const [activeGame,setActiveGame]=useState(null);
  const [boardGame,setBoardGame]=useState("runner");
  const [topMode,setTopMode]=useState("weekly");
  const [leaderboard,setLeaderboard]=useState([]);
  const [lbLoading,setLbLoading]=useState(false);
  const [boardTick,setBoardTick]=useState(0);
  const GAMES=ARCADE_GAMES;
  useEffect(()=>{
    if(activeGame) startGameMusic(activeGame);
    else stopGameMusic();
    return ()=>stopGameMusic();
  },[activeGame]);

  useEffect(()=>{
    setHelperPage?.(activeGame?`game_${activeGame}`:"arcade");
    return ()=>setHelperPage?.(null);
  },[activeGame,setHelperPage]);

  useEffect(()=>{
    let alive=true;
    async function loadBoard(){
      setLbLoading(true);
      const remote=await loadSupabaseGameLeaderboard(boardGame,topMode);
      const local=getLocalGameLeaderboard(boardGame);
      const rows=remote.length?remote:dedupeBestScores(local);
      if(alive){setLeaderboard(rows);setLbLoading(false);}
    }
    loadBoard();
    return()=>{alive=false;};
  },[boardGame,topMode,boardTick,user?.id]);

  async function handleWin(gameId,score){
    const alreadyPlayed=getPlayedToday(gameId,user.id);
    const rawScore=Math.max(0,Number(score)||0);
    const reward=gameRewardFor(gameId,rawScore,user.id);
    saveLocalGameScore(gameId,user,rawScore);
    try{ await dbPost("game_scores",{usuario_id:user.id,usuario_nombre:user.nombre,usuario_avatar:user.avatar,usuario_avatar_config:user.avatarConfig||user.avatar_config||null,game_id:gameId,score:rawScore,week:weekKey()}); }catch{}
    setBoardGame(gameId);
    setBoardTick(t=>t+1);
    if(alreadyPlayed){
      SFX.success();
      showToast(`Récord guardado. Los puntos de ${gameMeta(gameId).short} ya estaban cobrados hoy.`);
      setActiveGame(null);
      return;
    }
    markPlayedToday(gameId,user.id);
    if(reward<=0){
      SFX.success();
      showToast(`Récord guardado. Límite diario de ${GAME_DAILY_CAP} pts alcanzado.`);
      setActiveGame(null);
      return;
    }
    addDailyGamePointsTotal(user.id,reward);
    const nuevos=(user.puntos||0)+reward;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser(u=>({...u,puntos:nuevos}));
    showPoints(reward);SFX.coins();showToast(`+${reward} puntos reales!`);
    setActiveGame(null);
  }

  if(activeGame){
    const g=GAMES.find(x=>x.id===activeGame);
    return(
      <div style={{animation:"fadeSlide 0.4s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>{SFX.navBack();setActiveGame(null);}} style={{background:T.g150,border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",fontWeight:900,fontSize:"1rem",color:T.g700,boxShadow:"0 8px 18px rgba(20,8,4,.2)"}}>{"<"}</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={38}/><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>{g?.title}</div></div>
        </div>
        {activeGame==="sopa"&&<SopaLetras user={user} onWin={pts=>handleWin("sopa",pts)}/>} 
        {activeGame==="memoria"&&<MemoryGame onWin={pts=>handleWin("memoria",pts)}/>} 
        {activeGame==="trivia"&&<TriviaGame onWin={pts=>handleWin("trivia",pts)}/>} 
        {activeGame==="runner"&&<RastaRunnerGame user={user} onWin={pts=>handleWin("runner",pts)}/>} 
        {activeGame==="jump"&&<PlatformJumpGame user={user} onWin={pts=>handleWin("jump",pts)}/>} 
        {activeGame==="stitch"&&<DreadStitchGame user={user} onWin={pts=>handleWin("stitch",pts)}/>} 
        {activeGame==="gacha"&&<GachaSlotsGame user={user} onWin={pts=>handleWin("gacha",pts)}/>} 
      </div>
    );
  }

  const selectedMeta=gameMeta(boardGame);
  const weeklySelected=topMode==="weekly";
  const myBest=getMyBestScore(boardGame,user.id);
  const todayTotal=getDailyGamePointsTotal(user.id);
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎮" title="Rasta Arcade" sub="Elige un juego, mejora tu marca y entra en los rankings del estudio"/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#201208,#4F351B 56%,#B99A45)",border:`2px solid ${T.gold}`,color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-18,top:-30,fontSize:"7rem",opacity:.12,transform:"rotate(-10deg)"}}>🏆</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.45rem",lineHeight:1}}>Rankings de clientes</div>
          <div style={{fontSize:".8rem",fontWeight:800,opacity:.82,lineHeight:1.35,marginTop:3}}>Aquí están las estadísticas públicas de la comunidad: récords de juegos, puntos, tienda y participación.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
            <button onClick={()=>onOpenTops?.("games")} style={{border:"2px solid rgba(255,244,214,.42)",borderRadius:18,padding:"13px 10px",background:"rgba(255,244,214,.16)",color:T.white,fontWeight:950,cursor:"pointer",textAlign:"left",boxShadow:"0 10px 22px rgba(0,0,0,.18)"}}>
              <div style={{fontSize:"1.75rem",lineHeight:1}}>🏆</div>
              <div style={{fontSize:"1rem",marginTop:5}}>Top 10</div>
              <div style={{fontSize:".68rem",opacity:.78,lineHeight:1.25}}>Récords por minijuego</div>
            </button>
            <button onClick={()=>onOpenTops?.("general")} style={{border:"2px solid rgba(255,244,214,.42)",borderRadius:18,padding:"13px 10px",background:"rgba(255,244,214,.16)",color:T.white,fontWeight:950,cursor:"pointer",textAlign:"left",boxShadow:"0 10px 22px rgba(0,0,0,.18)"}}>
              <div style={{fontSize:"1.75rem",lineHeight:1}}>👑</div>
              <div style={{fontSize:"1rem",marginTop:5}}>Top general</div>
              <div style={{fontSize:".68rem",opacity:.78,lineHeight:1.25}}>Clientes y actividad</div>
            </button>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:16}}>
        {GAMES.map(g=>{
          const played=getPlayedToday(g.id,user.id);
          const best=getMyBestScore(g.id,user.id);
          return(
            <Card key={g.id} style={{opacity:played?0.76:1,background:played?"linear-gradient(180deg,#EBD8A8,#D7B777)":"linear-gradient(135deg,#FFF4D6,#F6E5BE)",border:played?`1px solid ${T.g300}`:`2px solid ${T.gold}`}} hover>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div className="icon3d" style={{fontSize:"2.55rem"}}>{g.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:950,fontSize:"1rem",color:T.g800}}>{g.title}</div>
                  <div style={{fontSize:"0.78rem",color:T.textSub,fontWeight:800,lineHeight:1.35}}>{g.desc}</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:5}}>
                    <span style={{fontSize:"0.74rem",color:T.orange,fontWeight:950}}>🏅 máx. +{g.pts} pts/día</span>
                    <span style={{fontSize:"0.74rem",color:T.g700,fontWeight:950}}>📈 tu récord semana: {best}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  {played&&<Badge col="green">✅ cobrado hoy</Badge>}
                  <Btn small col="gold" onClick={()=>setActiveGame(g.id)}>{played?"🔁 Rejugar":"▶ Jugar"}</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}

// TOPS DE JUEGOS Y TOP GENERAL
function GameTopsPage({user,onBack,onPlay,initialTab="games"}){
  const [section,setSection]=useState(initialTab||"games");
  const [game,setGame]=useState("runner");
  const [mode,setMode]=useState("weekly");
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [lastUpdate,setLastUpdate]=useState(null);
  const [livePulse,setLivePulse]=useState(0);
  const [generalKind,setGeneralKind]=useState("total");
  const [generalRows,setGeneralRows]=useState([]);
  const [generalLoading,setGeneralLoading]=useState(false);
  const selected=gameMeta(game);
  const weekly=mode==="weekly";
  const GENERAL_KINDS=[
    {id:"total",icon:"💎",title:"General",sub:"Puntos totales actuales",unit:"pts"},
    {id:"games",icon:"🎮",title:"Juegos",sub:"Puntos/récords acumulados en Arcade",unit:"pts"},
    {id:"shop",icon:"🛍️",title:"Tienda",sub:"Puntos canjeados por cupones, avatar, juegos y premios",unit:"pts"},
    {id:"community",icon:"🌐",title:"Comunidad",sub:"Comentarios, likes y participación",unit:"pts"},
  ];
  const generalMeta=GENERAL_KINDS.find(x=>x.id===generalKind)||GENERAL_KINDS[0];

  useEffect(()=>{setSection(initialTab||"games");},[initialTab]);

  const loadBoard=useCallback(async()=>{
    if(section!=="games")return;
    setLoading(true);
    const remote=await loadSupabaseGameLeaderboard(game,mode);
    setRows(remote||[]);
    setLastUpdate(new Date());
    setLoading(false);
  },[game,mode,section]);

  async function loadGeneralBoard(kind=generalKind){
    setGeneralLoading(true);
    try{
      const usersRaw=await safeList("usuarios","?select=id,nombre,email,puntos,avatar,perfil_publico,modo_incognito,role&limit=500");
      const usersFull=await enrichProfilesWithAvatarConfigs(usersRaw||[]);
      const users=(usersFull||[]).filter(u=>{
        const r=normalizeRole(u.role||u.rol);
        return r!==ROLES.ADMIN && r!==ROLES.STAFF;
      });
      const values={};
      users.forEach(u=>{values[String(u.id)]=kind==="total"?Number(u.puntos||0):0;});

      if(kind==="games"){
        const scores=await safeList("game_scores","?select=usuario_id,score&limit=3000");
        (scores||[]).forEach(r=>{const id=String(r.usuario_id||""); if(id) values[id]=(values[id]||0)+Number(r.score||0);});
      }
      if(kind==="shop"){
        const canjes=await safeList("canjes","?select=usuario_id,puntos_gastados&limit=3000");
        (canjes||[]).forEach(r=>{const id=String(r.usuario_id||""); if(id) values[id]=(values[id]||0)+Number(r.puntos_gastados||0);});
      }
      if(kind==="community"){
        let found=false;
        const events=await safeList("news_point_events","?select=usuario_id,puntos&limit=3000");
        if(events.length){found=true;(events||[]).forEach(r=>{const id=String(r.usuario_id||""); if(id) values[id]=(values[id]||0)+Number(r.puntos||0);});}
        if(!found){
          const [comments,likes,topics,replies]=await Promise.all([
            safeList("news_comments","?select=usuario_id&limit=3000"),
            safeList("news_likes","?select=usuario_id&limit=3000"),
            safeList("publicaciones","?select=autor_id,likes_count,tipo&limit=3000"),
            safeList("foro_respuestas","?select=autor_id&limit=3000"),
          ]);
          (comments||[]).forEach(r=>{const id=String(r.usuario_id||""); if(id) values[id]=(values[id]||0)+3;});
          (likes||[]).forEach(r=>{const id=String(r.usuario_id||""); if(id) values[id]=(values[id]||0)+1;});
          (topics||[]).forEach(r=>{const id=String(r.autor_id||""); if(id) values[id]=(values[id]||0)+5+Number(r.likes_count||0);});
          (replies||[]).forEach(r=>{const id=String(r.autor_id||""); if(id) values[id]=(values[id]||0)+2;});
        }
      }

      const list=users.map(u=>{
        const privacy=normalizePrivacy(u);
        return {
          ...u,
          user_id:String(u.id),
          nombre:u.nombre||"Cliente",
          avatar:u.avatar||0,
          avatar_config:u.avatar_config||null,
          perfil_publico:privacy.perfil_publico,
          modo_incognito:privacy.modo_incognito,
          score:Math.round(Number(values[String(u.id)]||0)),
        };
      }).filter(r=>kind==="total"?true:r.score>0).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,10);
      setGeneralRows(list);
      setLastUpdate(new Date());
    }catch(e){
      console.warn("top general",e);
      setGeneralRows([]);
    }
    setGeneralLoading(false);
  }

  useEffect(()=>{loadBoard();},[loadBoard,livePulse]);
  useEffect(()=>{if(section==="general")loadGeneralBoard(generalKind);},[section,generalKind,livePulse]);

  useEffect(()=>{
    if(!supabase) return;
    let alive=true;
    const channel=supabase
      .channel(`tops_live_${section}_${game}_${mode}_${generalKind}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"game_scores"},payload=>{
        const r=payload?.new||{};
        if(section==="games"&&String(r.game_id)===String(game)){
          if(mode==="historic" || String(r.week)===String(weekKey())) if(alive) setLivePulse(x=>x+1);
        }
        if(section==="general"&&generalKind==="games") if(alive) setLivePulse(x=>x+1);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"canjes"},()=>{if(section==="general"&&generalKind==="shop"&&alive)setLivePulse(x=>x+1);})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"news_point_events"},()=>{if(section==="general"&&generalKind==="community"&&alive)setLivePulse(x=>x+1);})
      .subscribe();
    const poll=setInterval(()=>{if(alive) setLivePulse(x=>x+1);},18000);
    return()=>{alive=false;clearInterval(poll);try{supabase.removeChannel(channel);}catch{}};
  },[section,game,mode,generalKind]);

  const gameMyRow=(rows||[]).find(r=>String(r.user_id||r.usuario_id)===String(user?.id));
  const generalMyRow=(generalRows||[]).find(r=>String(r.user_id||r.usuario_id)===String(user?.id));
  const reload=()=>section==="games"?loadBoard():loadGeneralBoard(generalKind);

  function RankRow({r,i,unit="pts"}){
    return <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 0",borderBottom:i<9?"1px solid rgba(255,244,214,.16)":"none"}}>
      <div style={{width:36,fontWeight:950,fontSize:"1.05rem",color:i<3?T.gold:T.white}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
      <PublicAvatar profile={r} currentUser={user} size={40}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:950,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(r,user)}</div>
        <div style={{fontSize:".68rem",fontWeight:800,opacity:.68}}>{r.created_at?new Date(r.created_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):section==="general"?generalMeta.sub:"marca guardada"}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{color:T.gold,fontWeight:950,fontSize:"1.12rem"}}>{Number(r.score)||0}</div>
        <div style={{fontSize:".62rem",fontWeight:800,opacity:.72}}>{unit}</div>
      </div>
    </div>;
  }

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button onClick={()=>{SFX.navBack();onBack?.();}} style={{background:T.g150,border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",fontWeight:950,fontSize:"1rem",color:T.g700,boxShadow:"0 8px 18px rgba(20,8,4,.2)"}}>{"<"}</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.5rem",color:T.g800}}>Rankings Rasta Cuts</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Estadísticas públicas de todos los clientes.</div>
        </div>
        <Btn small col="gold" onClick={reload}>Actualizar</Btn>
      </div>

      <Card style={{marginBottom:12,background:"linear-gradient(145deg,#24110A,#563519 58%,#B99A45)",border:`2px solid ${T.gold}`,color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-22,top:-28,fontSize:"7.4rem",opacity:.12}}>♛</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={()=>{SFX.tab();setSection("games");}} style={{border:`2px solid ${section==="games"?T.gold:"rgba(255,244,214,.28)"}`,borderRadius:18,padding:"13px 10px",background:section==="games"?"rgba(255,244,214,.22)":"rgba(255,244,214,.10)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:section==="games"?"0 10px 24px rgba(185,154,69,.24)":"none"}}>
              <div style={{fontSize:"1.75rem",lineHeight:1}}>🏆</div>
              <div style={{fontSize:"1.05rem",marginTop:5}}>Top 10</div>
              <div style={{fontSize:".68rem",opacity:.76,lineHeight:1.25}}>récords por juego</div>
            </button>
            <button onClick={()=>{SFX.tab();setSection("general");}} style={{border:`2px solid ${section==="general"?T.gold:"rgba(255,244,214,.28)"}`,borderRadius:18,padding:"13px 10px",background:section==="general"?"rgba(255,244,214,.22)":"rgba(255,244,214,.10)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:section==="general"?"0 10px 24px rgba(185,154,69,.24)":"none"}}>
              <div style={{fontSize:"1.75rem",lineHeight:1}}>👑</div>
              <div style={{fontSize:"1.05rem",marginTop:5}}>Top general</div>
              <div style={{fontSize:".68rem",opacity:.76,lineHeight:1.25}}>clientes y actividad</div>
            </button>
          </div>
          <div style={{fontSize:".76rem",fontWeight:800,opacity:.82,lineHeight:1.35,marginTop:10}}>
            {section==="games"?"Top 10 de récords del Arcade: semanal, histórico y por minijuego.":"Top general dividido en puntos totales, juegos, tienda y comunidad."}
          </div>
        </div>
      </Card>

      {section==="games"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
          <button onClick={()=>{SFX.tab();setMode("weekly");}} style={{border:"none",borderRadius:15,padding:"11px 8px",background:weekly?T.gradGold:T.panel,color:weekly?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 16px rgba(20,8,4,.13)"}}>🔥 Semanal</button>
          <button onClick={()=>{SFX.tab();setMode("historic");}} style={{border:"none",borderRadius:15,padding:"11px 8px",background:!weekly?T.gradGold:T.panel,color:!weekly?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 16px rgba(20,8,4,.13)"}}>👑 Histórico</button>
        </div>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>Selecciona minijuego</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {ARCADE_GAMES.filter(g=>g.id!=="gacha").map(g=>{
              const active=game===g.id;
              return <button key={g.id} onClick={()=>{SFX.tab();setGame(g.id);}} style={{border:`2px solid ${active?T.gold:T.g200}`,borderRadius:16,padding:"10px 8px",background:active?T.gradGold:T.g50,color:active?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:active?"0 10px 20px rgba(185,154,69,.22)":"0 6px 14px rgba(20,8,4,.10)"}}>
                <div style={{fontSize:"1.55rem"}}>{g.icon}</div>
                <div style={{fontSize:".78rem"}}>{gameMeta(g.id).short}</div>
              </button>;
            })}
          </div>
        </Card>
        <Card style={{background:"linear-gradient(160deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
            <div><div style={{fontWeight:950,fontSize:"1.05rem"}}>{selected.icon} Top 10 · {selected.title}</div><div style={{fontSize:".74rem",opacity:.78,fontWeight:800}}>{weekly?`Semana ${weekKey()}`:"Mejor marca histórica por jugador"}</div></div>
            <Badge col="gold">{rows.length}/10</Badge>
          </div>
          {loading?<Spinner/>:rows.length===0?<EmptyState icon="🏆" title="Sin puntuaciones todavía" sub={`Juega a ${selected.short} y estrena este ranking.`}/>:rows.map((r,i)=><RankRow key={`${r.user_id}-${r.created_at||i}-${livePulse}`} r={r} i={i}/>)}
        </Card>
        {gameMyRow&&<Card style={{marginTop:12,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`2px solid ${T.gold}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><PublicAvatar profile={gameMyRow} currentUser={user} size={40}/><div style={{flex:1}}><div style={{fontWeight:950,color:T.g800}}>Tu marca en este top</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Estás dentro del Top 10 de {selected.short}.</div></div><div style={{fontWeight:950,color:T.orange,fontSize:"1.2rem"}}>{gameMyRow.score}</div></div>
        </Card>}
      </>}

      {section==="general"&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>Top general por categoría</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {GENERAL_KINDS.map(k=>{
              const active=generalKind===k.id;
              return <button key={k.id} onClick={()=>{SFX.tab();setGeneralKind(k.id);}} style={{border:`2px solid ${active?T.gold:T.g200}`,borderRadius:16,padding:"10px 8px",background:active?T.gradGold:T.g50,color:active?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:active?"0 10px 20px rgba(185,154,69,.22)":"0 6px 14px rgba(20,8,4,.10)",textAlign:"left"}}>
                <div style={{fontSize:"1.45rem",lineHeight:1}}>{k.icon}</div>
                <div style={{fontSize:".86rem",marginTop:5}}>{k.title}</div>
                <div style={{fontSize:".64rem",opacity:.75,lineHeight:1.25}}>{k.sub}</div>
              </button>;
            })}
          </div>
        </Card>
        <Card style={{background:"linear-gradient(160deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
            <div><div style={{fontWeight:950,fontSize:"1.05rem"}}>{generalMeta.icon} Top general · {generalMeta.title}</div><div style={{fontSize:".74rem",opacity:.78,fontWeight:800}}>{generalMeta.sub}</div></div>
            <Badge col="gold">{generalRows.length}/10</Badge>
          </div>
          {generalLoading?<Spinner/>:generalRows.length===0?<EmptyState icon="👑" title="Sin datos todavía" sub="Cuando los clientes participen, jueguen o canjeen puntos aparecerán aquí."/>:generalRows.map((r,i)=><RankRow key={`${r.user_id}-${generalKind}-${i}-${livePulse}`} r={r} i={i} unit={generalMeta.unit}/>)}
        </Card>
        {generalMyRow&&<Card style={{marginTop:12,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`2px solid ${T.gold}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><PublicAvatar profile={generalMyRow} currentUser={user} size={40}/><div style={{flex:1}}><div style={{fontWeight:950,color:T.g800}}>Tu posición en {generalMeta.title}</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>{generalMeta.sub}</div></div><div style={{fontWeight:950,color:T.orange,fontSize:"1.2rem"}}>{generalMyRow.score}</div></div>
        </Card>}
      </>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
        <Btn full col="ghost" onClick={onBack}>Volver</Btn>
        <Btn full col="gold" onClick={onPlay}>Jugar ahora</Btn>
      </div>
    </div>
  );
}

// RETOS
function Retos({user,setUser,showToast,showPoints}){
  const [retos,setRetos]=useState([]);const [progresos,setProgresos]=useState({});const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[user.id]);
  async function load(){
    setLoading(true);
    const today=new Date().toISOString().split("T")[0];
    const [r,p]=await Promise.all([
      dbGet("retos",`?activo=eq.true&fecha_fin=gte.${today}&select=*`),
      dbGet("retos_progreso",`?usuario_id=eq.${user.id}&select=*`),
    ]);
    setRetos(r||[]);
    const pm={};(p||[]).forEach(x=>{pm[x.reto_id]=x;});
    setProgresos(pm);setLoading(false);
  }
  async function reclamar(reto){
    const prog=progresos[reto.id];if(!prog||prog.completado)return;
    await dbPatch("retos_progreso",`?id=eq.${prog.id}`,{completado:true});
    const nuevos=(user.puntos||0)+reto.puntos_premio;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser(u=>({...u,puntos:nuevos}));showPoints(reto.puntos_premio);SFX.coins();showToast(`+${reto.puntos_premio} puntos!`);load();
  }
  function daysLeft(f){const d=Math.ceil((new Date(f)-new Date())/86400000);return d<=0?"Vence hoy":`${d} dias`;}
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎯" title="Retos" sub="Completa retos y gana puntos"/>
      {loading?<Spinner/>:retos.length===0?<EmptyState icon="🎯" title="Sin retos activos" sub="Vuelve pronto"/>
        :retos.map(r=>{
          const prog=progresos[r.id];
          const pv=prog?.progreso||0,pct=Math.min((pv/r.meta)*100,100);
          const canClaim=pv>=r.meta&&prog&&!prog.completado,done=prog?.completado;
          return(
            <Card key={r.id} style={{marginBottom:12,border:canClaim?`2px solid ${T.g400}`:done?`2px solid ${T.g300}`:`1px solid ${T.g150}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{flex:1}}><div style={{fontWeight:800}}>{r.titulo}</div><div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{r.descripcion}</div></div>
                <div style={{textAlign:"right",marginLeft:10}}><div style={{fontWeight:900,color:T.pink,fontSize:"1rem"}}>+{r.puntos_premio} pts</div><div style={{fontSize:"0.7rem",color:T.textSub}}>{daysLeft(r.fecha_fin)}</div></div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{fontSize:"0.75rem",fontWeight:700,color:T.textSub}}>Progreso</div><div style={{fontSize:"0.75rem",fontWeight:800,color:T.g600}}>{pv}/{r.meta}</div></div>
                <div style={{height:8,background:T.g150,borderRadius:50,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:done?T.gradAdmin:canClaim?T.gradPink:T.gradClient,borderRadius:50,transition:"width 0.6s ease"}}/></div>
              </div>
              {done?<div style={{background:T.g100,borderRadius:10,padding:"8px 12px",fontSize:"0.82rem",fontWeight:700,color:T.g700}}>Reto completado</div>
                :canClaim?<Btn full small col="gold" onClick={()=>reclamar(r)}>Reclamar {r.puntos_premio} puntos!</Btn>
                :<div style={{fontSize:"0.78rem",color:T.textSub,fontWeight:600}}>{r.meta-pv} mas para completarlo</div>}
            </Card>
          );
        })
      }
    </div>
  );
}

// RANKING
function Ranking({user}){
  const [lista,setLista]=useState([]);const [loading,setLoading]=useState(true);const [tab,setTab]=useState("global");const [selectedProfile,setSelectedProfile]=useState(null);
  useEffect(()=>{load();},[]);
  async function load(){
    setLoading(true);
    const data=await dbGet("usuarios","?or=(role.eq.cliente,role.eq.client,role.is.null)&order=puntos.desc&limit=50&select=*");
    let avatars=[];
    try{
      const {data:av}=await supabase.from("avatar_profiles").select("usuario_id,email,avatar_config");
      avatars=Array.isArray(av)?av:[];
    }catch{}
    const merged=(Array.isArray(data)?data:[]).map(u=>{
      const hit=avatars.find(a=>String(a.usuario_id)===String(u.id)||String(a.email||"").toLowerCase()===String(u.email||"").toLowerCase());
      return {...u,avatarConfig:normalizeAvatarConfig(hit?.avatar_config,u.avatar),avatar_config:normalizeAvatarConfig(hit?.avatar_config,u.avatar)};
    });
    setLista(merged);setLoading(false);
  }
  function score(u){
    if(tab==="semana") return Number(u.puntos_semana||u.weekly_points||u.puntos_week||0);
    if(tab==="compras") return Number(u.puntos_compras||u.purchase_points||u.compras_puntos||0);
    return Number(u.puntos||0);
  }
  const cfg={
    global:{icon:"🏆",title:"Top general",sub:"Puntos acumulados"},
    semana:{icon:"⚡",title:"Top semana",sub:"Se reinicia semanalmente si guardas puntos_semana"},
    compras:{icon:"🛒",title:"Top compras",sub:"Puntos generados por compras"},
  };
  const ranked=[...lista].map(u=>({...u,score:score(u)})).sort((a,b)=>b.score-a.score).slice(0,10);
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏆" title="Rankings" sub="Top 10 estilo liga"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {Object.entries(cfg).map(([id,c])=><button key={id} onClick={()=>{SFX.tab();setTab(id);}} style={{border:`2px solid ${tab===id?T.gold:T.g200}`,background:tab===id?T.gradGold:"rgba(255,244,214,.82)",color:tab===id?T.g900:T.g700,borderRadius:16,padding:"9px 6px",fontWeight:900,cursor:"pointer",boxShadow:tab===id?"0 8px 20px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.12)"}}><div className="icon3d" style={{fontSize:"1.35rem"}}>{c.icon}</div><div style={{fontSize:".68rem"}}>{c.title}</div></button>)}
      </div>
      <Card style={{marginBottom:12,background:"linear-gradient(135deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><div className="icon3d" style={{fontSize:"2.1rem"}}>{cfg[tab].icon}</div><div><div style={{fontWeight:900}}>{cfg[tab].title}</div><div style={{fontSize:".75rem",opacity:.78,fontWeight:700}}>{cfg[tab].sub}</div></div></div>
      </Card>
      {loading?<Spinner/>:ranked.length===0?<EmptyState icon="🏆" title="Sin datos" sub="Todavía no hay puntuaciones"/>:ranked.map((u,i)=>{
        const isMe=u.id===user.id;
        const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
        return(
          <Card key={u.id} onClick={()=>setSelectedProfile(u)} style={{marginBottom:8,background:isMe?"linear-gradient(180deg,#FFF1A8,#F6E5BE)":"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:isMe?`2px solid ${T.gold}`:`1px solid ${T.g300}`}} hover>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div className="icon3d" style={{fontSize:i<3?"1.7rem":"1.1rem",minWidth:38,textAlign:"center",fontWeight:900}}>{medal}</div>
              <PublicAvatar profile={u} currentUser={user} size={42}/>
              <div style={{flex:1}}><div style={{fontWeight:900}}>{publicName(u,user)}{isMe?" · tú":""}</div><div style={{fontSize:".72rem",color:T.textSub,fontWeight:800}}>{isPrivateProfile(u,user)?"Perfil en modo incógnito":avatarStyleName(normalizeAvatarConfig(u.avatar_config||u.avatarConfig,u.avatar))}</div></div>
              <div style={{fontWeight:900,color:T.orange,fontSize:"1.02rem"}}>{u.score||0} pts</div>
            </div>
          </Card>
        );
      })}
      <PublicProfileModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)}/>
    </div>
  );
}

// GALERIA
function Galeria({showToast,isAdmin=false}){
  const [fotos,setFotos]=useState([]);const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({titulo:"",url:"",categoria:"corte",antes_url:""});
  const CATS=["corte","color","mechas","recogido","tratamiento"];
  useEffect(()=>{load();},[]);
  async function load(){setFotos(await dbGet("galeria","?activo=eq.true&order=created_at.desc&select=*")||[]);}
  async function save(){if(!form.url){showToast("Añade una URL");return;}await dbPost("galeria",{...form,activo:true});showToast("Foto añadida");setShowNew(false);setForm({titulo:"",url:"",categoria:"corte",antes_url:""});load();}
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🖼️" title="Galeria" sub="Nuestros mejores trabajos" action={isAdmin&&<Btn small onClick={()=>setShowNew(true)}>+ Añadir</Btn>}/>
      {fotos.length===0?<EmptyState icon="🖼️" title="Sin fotos aun" sub="Añade los primeros trabajos"/>:(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {fotos.map(f=><Card key={f.id} style={{padding:0,overflow:"hidden"}}><img src={f.url} alt={f.titulo} style={{width:"100%",height:140,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/><div style={{padding:"10px"}}><div style={{fontWeight:800,fontSize:"0.82rem"}}>{f.titulo}</div><Badge col="green">{f.categoria}</Badge></div></Card>)}
        </div>
      )}
      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Añadir trabajo">
        <Input label="URL imagen" value={form.url} onChange={v=>setForm(f=>({...f,url:v}))} placeholder="https://..."/>
        <Input label="URL antes (opcional)" value={form.antes_url} onChange={v=>setForm(f=>({...f,antes_url:v}))} placeholder="https://..."/>
        <Input label="Titulo" value={form.titulo} onChange={v=>setForm(f=>({...f,titulo:v}))}/>
        <Select label="Categoria" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={CATS.map(c=>({value:c,label:c.charAt(0).toUpperCase()+c.slice(1)}))}/>
        <Btn full onClick={save}>Guardar</Btn>
      </Modal>
    </div>
  );
}

// REVIEWS
function Reviews({user,setUser,showToast,showPoints}){
  const [reviews,setReviews]=useState([]);const [showNew,setShowNew]=useState(false);
  const [rating,setRating]=useState(5);const [comment,setComment]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setReviews(await dbGet("reviews","?order=created_at.desc&limit=20&select=*")||[]);setLoading(false);}
  async function submit(){
    if(!comment.trim()){showToast("Escribe un comentario");return;}
    await dbPost("reviews",{usuario_id:user.id,autor_nombre:user.nombre,autor_avatar:user.avatar,rating,comentario:comment});
    const nuevos=(user.puntos||0)+10;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser(u=>({...u,puntos:nuevos}));showPoints(10);showToast("Gracias por tu resena! +10 pts");
    setShowNew(false);setComment("");setRating(5);SFX.success();load();
  }
  const avg=reviews.length>0?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):"--";
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="⭐" title="Resenas" sub={`${avg} estrellas - ${reviews.length} valoraciones`} action={user.rol===ROLES.CLIENT&&<Btn small onClick={()=>setShowNew(true)}>+ Resena</Btn>}/>
      {loading?<Spinner/>:reviews.map(r=>(
        <Card key={r.id} style={{marginBottom:10}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
            <Av av={r.autor_avatar} size={36}/>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:"0.88rem"}}>{r.autor_nombre}</div></div>
            <div style={{fontWeight:900,color:T.gold}}>{"*".repeat(r.rating)}</div>
          </div>
          <div style={{fontSize:"0.88rem",color:T.text}}>{r.comentario}</div>
        </Card>
      ))}
      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nueva resena">
        <div style={{marginBottom:16}}>
          <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:8}}>Tu puntuacion</div>
          <div style={{display:"flex",gap:8}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setRating(n)} style={{fontSize:"1.8rem",background:"none",border:"none",cursor:"pointer",opacity:n<=rating?1:0.3}}>*</button>)}</div>
        </div>
        <Input label="Comentario" value={comment} onChange={setComment} placeholder="Cuentanos tu experiencia..."/>
        <Btn full onClick={submit}>Enviar (+10 pts)</Btn>
      </Modal>
    </div>
  );
}

// CHAT
function Chat({user,showToast}){
  const [messages,setMessages]=useState([]);const [text,setText]=useState("");const [loading,setLoading]=useState(true);
  const bottomRef=useRef(null);
  useEffect(()=>{load();const iv=setInterval(load,8000);return()=>clearInterval(iv);},[]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  async function load(){setMessages(await dbGet("mensajes","?order=created_at.asc&limit=50&select=*")||[]);setLoading(false);}
  async function send(){
    if(!text.trim())return;
    await dbPost("mensajes",{contenido:text,usuario_id:user.id,autor_nombre:user.nombre,autor_avatar:user.avatar,autor_rol:user.rol});
    setText("");SFX.click();load();
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease",display:"flex",flexDirection:"column",height:"calc(100vh - 200px)"}}>
      <SectionHeader icon="💬" title="Chat" sub={user.rol!==ROLES.CLIENT?"Habla con tus clientes":"Habla con nosotros"}/>
      <div style={{flex:1,overflowY:"auto",marginBottom:12}}>
        {loading?<Spinner/>:messages.map(m=>{
          const mine=m.usuario_id===user.id;
          return(
            <div key={m.id} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",marginBottom:8}}>
              {!mine&&<Av av={m.autor_avatar} size={28}/>}
              <div style={{maxWidth:"70%",marginLeft:mine?0:8}}>
                {!mine&&<div style={{fontSize:"0.7rem",fontWeight:700,color:T.textSub,marginBottom:2,marginLeft:4}}>{m.autor_nombre}</div>}
                <div style={{background:mine?T.gradClient:T.white,color:mine?T.white:T.text,padding:"9px 14px",borderRadius:mine?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:"0.88rem",border:mine?"none":`1px solid ${T.g150}`}}>{m.contenido}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..." style={{flex:1,padding:"10px 14px",borderRadius:50,border:`1.5px solid ${T.g200}`,background:T.white,fontSize:"0.88rem",outline:"none"}}/>
        <button onClick={send} style={{width:44,height:44,borderRadius:"50%",background:T.gradClient,border:"none",cursor:"pointer",fontSize:"1.1rem"}}>{">"}</button>
      </div>
    </div>
  );
}


function PerfilNewsActivity({user}){
  const [items,setItems]=useState([]);
  const [likes,setLikes]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[user.id]);
  async function load(){
    setLoading(true);
    try{
      const [{data:cs},{data:ls}]=await Promise.all([
        supabase.from("news_comments").select("*").eq("usuario_id",String(user.id)).order("created_at",{ascending:false}).limit(8),
        supabase.from("news_likes").select("*").eq("usuario_id",String(user.id)).order("created_at",{ascending:false}).limit(8)
      ]);
      setItems(Array.isArray(cs)?cs:[]);setLikes(Array.isArray(ls)?ls:[]);
    }catch(e){setItems([]);setLikes([]);}finally{setLoading(false);}
  }
  const total=items.length+likes.length;
  return <Card style={{marginBottom:16,background:T.panel,border:`2px solid ${T.g300}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10}}>
      <div><div style={{fontWeight:950,color:T.g800}}>📰 Mi actividad en Actualidad</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Tus comentarios y likes quedan aquí para seguir los hilos.</div></div>
      <Badge col="gold">{total}</Badge>
    </div>
    {loading?<Spinner/>:total===0?<div style={{fontSize:".84rem",fontWeight:800,color:T.textSub,lineHeight:1.4}}>Todavía no has comentado ni dado like en Actualidad. Abre una noticia, aporta algo útil y empieza a sumar puntos.</div>:<>
      {items.length>0&&<div style={{fontWeight:950,color:T.g800,fontSize:".86rem",margin:"4px 0 8px"}}>Comentarios recientes</div>}
      {items.map(c=><div key={c.id} onClick={()=>c.news_url&&window.open(c.news_url,"_blank","noopener,noreferrer")} style={{background:"rgba(255,244,214,.72)",border:`1px solid ${T.g200}`,borderRadius:14,padding:"9px 10px",marginBottom:8,cursor:c.news_url?"pointer":"default"}}>
        <div style={{fontWeight:950,color:T.g800,fontSize:".82rem",lineHeight:1.18}}>{c.news_title||"Noticia"}</div>
        <div style={{fontSize:".76rem",fontWeight:750,color:T.textSub,lineHeight:1.35,marginTop:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>“{c.contenido}”</div>
      </div>)}
      {likes.length>0&&<div style={{fontWeight:950,color:T.g800,fontSize:".86rem",margin:"10px 0 8px"}}>Últimos likes</div>}
      {likes.slice(0,4).map(l=><div key={l.id} onClick={()=>l.news_url&&window.open(l.news_url,"_blank","noopener,noreferrer")} style={{fontSize:".78rem",fontWeight:850,color:T.textSub,background:"rgba(255,244,214,.48)",borderRadius:12,padding:"7px 9px",marginBottom:6,cursor:l.news_url?"pointer":"default"}}>👍 {l.news_title||"Noticia"}</div>)}
    </>}
  </Card>;

}

// MISIONES Y TROFEOS
const MISSION_DEFS=[
  {key:"daily_game",period:"day",icon:"🎮",title:"Una partida al día",desc:"Guarda una partida de Arcade hoy",goal:1,points:3,type:"gamesToday"},
  {key:"daily_news_comment",period:"day",icon:"💬",title:"Opina en Actualidad",desc:"Comenta una noticia hoy",goal:1,points:3,type:"commentsToday"},
  {key:"daily_news_like",period:"day",icon:"👍",title:"Marca algo útil",desc:"Da un like en Actualidad hoy",goal:1,points:1,type:"likesToday"},
  {key:"weekly_arcade_3",period:"week",icon:"🕹️",title:"Rutina Arcade",desc:"Guarda 3 partidas esta semana",goal:3,points:8,type:"gamesWeek"},
  {key:"weekly_comments_5",period:"week",icon:"🗣️",title:"Conversador semanal",desc:"Comenta 5 noticias esta semana",goal:5,points:10,type:"commentsWeek"},
  {key:"weekly_mixed",period:"week",icon:"🌐",title:"Comunidad viva",desc:"Haz 1 partida, 1 comentario y 1 like esta semana",goal:3,points:8,type:"mixedWeek"},
];
const TROPHY_DEFS=[
  {key:"first_game",icon:"🎮",title:"Primer arcade",desc:"Guarda tu primera partida",condition:s=>s.gamesAll>=1},
  {key:"first_comment",icon:"💬",title:"Primera opinión",desc:"Deja tu primer comentario en Actualidad",condition:s=>s.commentsAll>=1},
  {key:"news_liker",icon:"👍",title:"Buen radar",desc:"Da 5 likes a contenidos útiles",condition:s=>s.likesAll>=5},
  {key:"weekly_player",icon:"🔥",title:"Semana activa",desc:"Guarda 3 partidas en una misma semana",condition:s=>s.gamesWeek>=3},
  {key:"commentator",icon:"🗣️",title:"Voz de la comunidad",desc:"Acumula 5 comentarios en Actualidad",condition:s=>s.commentsAll>=5},
  {key:"stitch_apprentice",icon:"🪝",title:"Aprendiz del gancho",desc:"Guarda 3 partidas de Gancho Ninja",condition:s=>s.stitchAll>=3},
  {key:"category_explorer",icon:"🧭",title:"Explorador de temas",desc:"Comenta en 3 categorías distintas",condition:s=>s.categoriesAll>=3},
  {key:"arcade_regular",icon:"🏆",title:"Cliente de arcade",desc:"Guarda 15 partidas en total",condition:s=>s.gamesAll>=15},
];
function startOfDayISO(){const d=new Date();d.setHours(0,0,0,0);return d.toISOString();}
function startOfWeekISO(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d.toISOString();}
function missionPeriodKey(def){return def.period==="week"?weekKey():TODAY_KEY();}
function countUnique(arr,field){return new Set((arr||[]).map(x=>x?.[field]).filter(Boolean)).size;}
function missionValue(def,stats){
  if(def.type==="mixedWeek") return Math.min(1,stats.gamesWeek)*1+Math.min(1,stats.commentsWeek)*1+Math.min(1,stats.likesWeek)*1;
  return Number(stats[def.type]||0);
}
function clampPct(v,g){return Math.max(0,Math.min(100,(Number(v||0)/Math.max(1,g))*100));}
async function safeList(table,query){try{const r=await dbGet(table,query);return Array.isArray(r)?r:[];}catch{return [];}}
function MissionCard({m,value,claimed,onClaim}){
  const done=value>=m.goal;
  const pct=clampPct(value,m.goal);
  return <Card style={{marginBottom:10,padding:12,background:done?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"linear-gradient(180deg,#FFF4D6,#F5E6C8)",border:`2px solid ${done?T.gold:T.g200}`}}>
    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
      <div style={{width:42,height:42,borderRadius:16,display:"grid",placeItems:"center",fontSize:"1.35rem",background:done?T.gradGold:"rgba(255,244,214,.82)",boxShadow:"0 8px 16px rgba(20,8,4,.14)"}}>{m.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}><div style={{fontWeight:950,color:T.g800,lineHeight:1.1}}>{m.title}</div><div style={{fontWeight:950,color:done?T.orange:T.g600,fontSize:".82rem"}}>+{m.points} pts</div></div>
        <div style={{fontSize:".78rem",fontWeight:750,color:T.textSub,marginTop:3}}>{m.desc}</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",fontWeight:900,color:T.g700,marginTop:8}}><span>Progreso</span><span>{Math.min(value,m.goal)}/{m.goal}</span></div>
        <div style={{height:8,background:"rgba(110,53,24,.16)",borderRadius:999,overflow:"hidden",marginTop:4}}><div style={{height:"100%",width:`${pct}%`,background:done?T.gradGold:T.gradClient,borderRadius:999,transition:"width .3s ease"}}/></div>
      </div>
    </div>
    {claimed?<div style={{marginTop:9,fontSize:".78rem",fontWeight:900,color:T.g700,background:"rgba(255,244,214,.72)",borderRadius:12,padding:"8px 10px"}}>Reclamado</div>
      :done?<div style={{marginTop:9}}><Btn full small col="gold" onClick={onClaim}>Reclamar +{m.points}</Btn></div>
      :<div style={{marginTop:9,fontSize:".76rem",fontWeight:800,color:T.textSub}}>Completa el objetivo para reclamarlo.</div>}
  </Card>;
}
function ObjetivosTrofeos({user,setUser,showToast,showPoints}){
  const [loading,setLoading]=useState(true);
  const [stats,setStats]=useState({});
  const [claimed,setClaimed]=useState({});
  const [trophies,setTrophies]=useState({});
  const [tab,setTab]=useState("missions");
  useEffect(()=>{load();},[user?.id]);
  async function load(){
    if(!user?.id)return;
    setLoading(true);
    const uid=encodeURIComponent(String(user.id));
    const day=startOfDayISO(),week=startOfWeekISO();
    const [gamesAll,gamesToday,gamesWeek,commentsAll,commentsToday,commentsWeek,likesAll,likesToday,likesWeek,claims,trophyRows]=await Promise.all([
      safeList("game_scores",`?usuario_id=eq.${uid}&select=game_id,score,created_at`),
      safeList("game_scores",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=game_id,score,created_at`),
      safeList("game_scores",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=game_id,score,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&select=news_category,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=news_category,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=news_category,created_at`),
      safeList("user_mission_claims",`?usuario_id=eq.${uid}&select=mission_key,period_key`),
      safeList("user_trophies",`?usuario_id=eq.${uid}&select=trophy_key`),
    ]);
    const nextStats={
      gamesAll:gamesAll.length,gamesToday:gamesToday.length,gamesWeek:gamesWeek.length,
      commentsAll:commentsAll.length,commentsToday:commentsToday.length,commentsWeek:commentsWeek.length,
      likesAll:likesAll.length,likesToday:likesToday.length,likesWeek:likesWeek.length,
      stitchAll:(gamesAll||[]).filter(g=>g.game_id==="stitch").length,
      categoriesAll:countUnique(commentsAll,"news_category"),
    };
    const c={};(claims||[]).forEach(x=>{c[`${x.mission_key}_${x.period_key}`]=true;});
    const tr={};(trophyRows||[]).forEach(x=>{tr[x.trophy_key]=true;});
    setStats(nextStats);setClaimed(c);setTrophies(tr);setLoading(false);
    unlockTrophies(nextStats,tr);
  }
  async function unlockTrophies(nextStats,current){
    for(const t of TROPHY_DEFS){
      if(current[t.key])continue;
      if(!t.condition(nextStats))continue;
      try{
        const {error}=await supabase.from("user_trophies").insert({usuario_id:String(user.id),trophy_key:t.key,titulo:t.title,descripcion:t.desc,icono:t.icon});
        if(!error){setTrophies(v=>({...v,[t.key]:true}));showToast?.(`Trofeo desbloqueado: ${t.title}`);SFX.success();}
      }catch{}
    }
  }
  async function claimMission(m){
    const period=missionPeriodKey(m);
    const key=`${m.key}_${period}`;
    if(claimed[key])return;
    const value=missionValue(m,stats);
    if(value<m.goal){showToast?.("Todavía falta progreso para este objetivo");return;}
    try{
      const {error}=await supabase.from("user_mission_claims").insert({usuario_id:String(user.id),mission_key:m.key,period_key:period,puntos:m.points});
      if(error){showToast?.("Objetivo ya reclamado o no disponible");return;}
      const nuevos=(user.puntos||0)+m.points;
      await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
      setUser?.(u=>({...u,puntos:nuevos}));
      setClaimed(v=>({...v,[key]:true}));
      showPoints?.(m.points);SFX.coins();showToast?.(`Objetivo reclamado: +${m.points} pts`);
    }catch{showToast?.("No se pudo reclamar el objetivo");}
  }
  const unlockedCount=Object.values(trophies).filter(Boolean).length;
  const available=MISSION_DEFS.filter(m=>missionValue(m,stats)>=m.goal&&!claimed[`${m.key}_${missionPeriodKey(m)}`]).length;
  return <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${available?T.gold:T.g300}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
      <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🎯 Objetivos y trofeos</div><div style={{fontSize:".8rem",fontWeight:800,color:T.textSub}}>Motivos claros para volver cada día sin regalar puntos infinitos.</div></div>
      <Badge col={available?"gold":"green"}>{available} listos</Badge>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      <button onClick={()=>setTab("missions")} style={{border:`2px solid ${tab==="missions"?T.gold:T.g200}`,borderRadius:14,padding:"9px 10px",fontWeight:950,cursor:"pointer",background:tab==="missions"?T.gradGold:"rgba(255,244,214,.72)",color:tab==="missions"?T.g900:T.g700}}>Objetivos</button>
      <button onClick={()=>setTab("trophies")} style={{border:`2px solid ${tab==="trophies"?T.gold:T.g200}`,borderRadius:14,padding:"9px 10px",fontWeight:950,cursor:"pointer",background:tab==="trophies"?T.gradGold:"rgba(255,244,214,.72)",color:tab==="trophies"?T.g900:T.g700}}>Trofeos {unlockedCount}/{TROPHY_DEFS.length}</button>
    </div>
    {loading?<Spinner/>:tab==="missions"?<div>{MISSION_DEFS.map(m=><MissionCard key={m.key} m={m} value={missionValue(m,stats)} claimed={!!claimed[`${m.key}_${missionPeriodKey(m)}`]} onClaim={()=>claimMission(m)}/>)}</div>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{TROPHY_DEFS.map(t=>{const on=!!trophies[t.key];return <div key={t.key} style={{border:`2px solid ${on?T.gold:T.g200}`,borderRadius:18,padding:12,background:on?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"rgba(255,244,214,.58)",opacity:on?1:.55,textAlign:"center"}}><div style={{fontSize:"2rem",filter:on?"drop-shadow(0 6px 8px rgba(212,175,55,.35))":"grayscale(1)"}}>{t.icon}</div><div style={{fontWeight:950,color:T.g800,fontSize:".86rem",lineHeight:1.1}}>{t.title}</div><div style={{fontSize:".7rem",fontWeight:800,color:T.textSub,marginTop:4,lineHeight:1.25}}>{t.desc}</div></div>})}</div>}
  </Card>;
}


function AvatarCosmeticShop({user,setUser,currentConfig,onApply,showToast,showPoints}){
  const [items,setItems]=useState(COSMETIC_CATALOG_FALLBACK);
  const [owned,setOwned]=useState([]);
  const [cat,setCat]=useState("todos");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[user.id]);
  async function load(){
    setLoading(true);
    let catalog=COSMETIC_CATALOG_FALLBACK;
    try{
      const {data,error}=await supabase.from("avatar_cosmetics").select("*").eq("activo",true).order("puntos_precio",{ascending:true});
      if(!error && data?.length) catalog=data;
    }catch{}
    let keys=localOwnedCosmetics(user);
    try{
      const {data,error}=await supabase.from("user_cosmetics").select("item_key").eq("usuario_id",String(user.id));
      if(!error && data){keys=[...new Set([...keys,...data.map(x=>x.item_key)])];saveLocalOwnedCosmetics(user,keys);}
    }catch{}
    setItems(catalog);setOwned(keys);setLoading(false);
  }
  async function unlock(item){
    if(owned.includes(item.item_key)){apply(item);return;}
    if((user.puntos||0)<Number(item.puntos_precio||0)){showToast?.("No tienes puntos suficientes");SFX.error();return;}
    const nuevos=(user.puntos||0)-Number(item.puntos_precio||0);
    try{
      await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
      await supabase.from("user_cosmetics").upsert({usuario_id:String(user.id),item_key:item.item_key,created_at:new Date().toISOString()},{onConflict:"usuario_id,item_key"});
    }catch{}
    const keys=[...new Set([...owned,item.item_key])];
    saveLocalOwnedCosmetics(user,keys);setOwned(keys);setUser?.(u=>({...u,puntos:nuevos}));showPoints?.(0);SFX.coins();showToast?.(`${item.nombre} desbloqueado`);
    apply(item,true);
  }
  async function apply(item,skipToast=false){
    const cfg=normalizeAvatarConfig({...currentConfig,...cosmeticPatch(item)},user.avatar);
    await saveAvatarConfigForUser(user,cfg);
    setUser?.(u=>({...u,avatarConfig:cfg,avatar_config:cfg}));
    onApply?.(cfg);
    if(!skipToast){SFX.success();showToast?.(`${item.nombre} aplicado`);}
  }
  const cats=[{id:"todos",label:"Todo"},{id:"gorras",label:"Gorras"},{id:"gafas",label:"Gafas"},{id:"marcos",label:"Marcos"},{id:"auras",label:"Auras"},{id:"fondos",label:"Fondos"},{id:"extras",label:"Extras"}];
  const shown=items.filter(i=>cat==="todos"||i.categoria===cat);
  return <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.gold}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
      <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🧢 Tienda de estilo</div><div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>Canjea puntos por cosméticos del perfil. Se desbloquean para siempre.</div></div>
      <Badge col="gold">{user.puntos||0} pts</Badge>
    </div>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:8}}>{cats.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{whiteSpace:"nowrap",border:`2px solid ${cat===c.id?T.gold:T.g200}`,background:cat===c.id?T.gradGold:"rgba(255,244,214,.8)",borderRadius:999,padding:"7px 12px",fontWeight:950,color:cat===c.id?T.g900:T.g700,cursor:"pointer"}}>{c.label}</button>)}</div>
    {loading?<Spinner/>:<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{shown.map(item=>{const has=owned.includes(item.item_key);const active=normalizeAvatarConfig(currentConfig,user.avatar)[item.slot]===item.valor;return <div key={item.item_key} style={{background:active?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"rgba(255,244,214,.72)",border:`2px solid ${active?T.gold:T.g200}`,borderRadius:18,padding:10,boxShadow:"0 8px 18px rgba(20,8,4,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:6,alignItems:"center",marginBottom:8}}><Badge col={rarityColor(item.rareza)}>{rarityLabel(item.rareza)}</Badge><b style={{color:T.orange,fontSize:".78rem"}}>{item.puntos_precio} pts</b></div>
      <div style={{display:"flex",justifyContent:"center",margin:"4px 0 8px"}}><Av av={user.avatar} config={{...currentConfig,...cosmeticPatch(item)}} size={92}/></div>
      <div style={{fontWeight:950,color:T.g800,fontSize:".84rem",lineHeight:1.1}}>{item.nombre}</div>
      <div style={{fontSize:".68rem",fontWeight:800,color:T.textSub,lineHeight:1.25,minHeight:34,marginTop:4}}>{item.descripcion}</div>
      <div style={{marginTop:9}}>{has?<Btn full small col={active?"ghost":"gold"} onClick={()=>apply(item)}>{active?"Equipado":"Equipar"}</Btn>:<Btn full small col="gold" onClick={()=>unlock(item)}>Desbloquear</Btn>}</div>
    </div>})}</div>}
  </Card>;
}

// PERFIL

function levelFromPoints(points=0){
  const xp=Math.max(0,Number(points)||0);
  const levels=[
    {level:1,min:0,name:"Aprendiz"},
    {level:2,min:50,name:"Primer corte"},
    {level:3,min:120,name:"Manos firmes"},
    {level:4,min:220,name:"Estilo propio"},
    {level:5,min:360,name:"Rasta Pro"},
    {level:6,min:550,name:"Barber urbano"},
    {level:7,min:800,name:"Maestro del gancho"},
    {level:8,min:1100,name:"Leyenda local"},
    {level:9,min:1500,name:"Icono Rasta"},
    {level:10,min:2000,name:"VIP de la casa"}
  ];
  let current=levels[0],next=levels[levels.length-1];
  for(let i=0;i<levels.length;i++){
    if(xp>=levels[i].min){current=levels[i];next=levels[i+1]||levels[i];}
  }
  const span=Math.max(1,(next.min-current.min));
  const pct=current.level===next.level?100:Math.max(0,Math.min(100,((xp-current.min)/span)*100));
  return {...current,next,progress:pct,xp};
}
function rewardLevelFor(points=0){return levelFromPoints(points).level;}
function RewardSilhouette({item,user,currentConfig,owned,reached,active,onClick}){
  const preview=normalizeAvatarConfig({...currentConfig,...cosmeticPatch(item)},user.avatar);
  const locked=!owned&&!reached;
  return <button type="button" onClick={onClick} style={{
    minWidth:88,
    maxWidth:88,
    border:"none",
    background:"transparent",
    padding:0,
    cursor:"pointer",
    position:"relative"
  }}>
    <div style={{
      height:76,
      width:76,
      margin:"0 auto",
      borderRadius:"50%",
      display:"grid",
      placeItems:"center",
      background:active?"linear-gradient(145deg,#FFF8E1,#E6C27A)":reached?"linear-gradient(145deg,#FFF4D6,#F0D39B)":"linear-gradient(145deg,#16100C,#3A2A1D)",
      border:`3px solid ${active?T.gold:owned?T.g300:reached?T.gold:"rgba(255,244,214,.22)"}`,
      boxShadow:active?"0 0 24px rgba(212,175,55,.55)":reached?"0 8px 18px rgba(212,175,55,.25)":"inset 0 10px 22px rgba(0,0,0,.35),0 8px 14px rgba(20,8,4,.18)",
      overflow:"hidden",
      animation:reached&&!owned?"rewardPulsePro 2.2s ease-in-out infinite":"none"
    }}>
      <div style={{filter:locked?"grayscale(1) brightness(0)":"none",opacity:locked?0.78:1,transform:"scale(.92)"}}>
        {locked?<Av av={user.avatar} config={preview} size={62}/>:<Av av={user.avatar} config={preview} size={62}/>}
      </div>
      {owned&&<div style={{position:"absolute",right:8,top:4,background:T.gradGold,color:T.g900,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontWeight:950,fontSize:".68rem"}}>✓</div>}
      {locked&&<div style={{position:"absolute",right:8,top:4,background:"rgba(0,0,0,.58)",color:T.white,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontSize:".68rem"}}>🔒</div>}
      {reached&&!owned&&<div style={{position:"absolute",right:7,top:4,background:T.gold,color:T.g900,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontWeight:950,fontSize:".68rem"}}>!</div>}
    </div>
    <div style={{height:18,width:3,background:owned||reached?T.gold:"rgba(255,244,214,.35)",margin:"-1px auto 0"}}/>
    <div style={{fontSize:".68rem",fontWeight:950,color:owned||reached?T.g800:T.textSub,lineHeight:1.05}}>
      Nv. {rewardLevelFor(item.puntos_precio)}
    </div>
    <div style={{fontSize:".63rem",fontWeight:850,color:T.textSub,lineHeight:1.05,marginTop:2}}>
      {item.puntos_precio} XP
    </div>
  </button>;
}
function AvatarRewardPath({user,setUser,currentConfig,onApply,showToast}){
  const [items,setItems]=useState(COSMETIC_CATALOG_FALLBACK);
  const [owned,setOwned]=useState(localOwnedCosmetics(user));
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);

  useEffect(()=>{load();},[user.id]);

  async function load(){
    setLoading(true);
    let catalog=COSMETIC_CATALOG_FALLBACK;
    try{
      const {data,error}=await supabase.from("avatar_cosmetics").select("*").eq("activo",true).order("puntos_precio",{ascending:true});
      if(!error && data?.length) catalog=data;
    }catch{}
    let keys=localOwnedCosmetics(user);
    try{
      const {data,error}=await supabase.from("user_cosmetics").select("item_key").eq("usuario_id",String(user.id));
      if(!error && data){keys=[...new Set([...keys,...data.map(x=>x.item_key)])];saveLocalOwnedCosmetics(user,keys);}
    }catch{}
    const sorted=catalog.sort((a,b)=>Number(a.puntos_precio||0)-Number(b.puntos_precio||0));
    setItems(sorted);
    setOwned(keys);
    setSelected(s=>s||sorted.find(i=>(user.puntos||0)>=Number(i.puntos_precio||0)&&!keys.includes(i.item_key))||sorted[0]||null);
    setLoading(false);
  }

  async function reveal(item){
    if(!item)return;
    if(owned.includes(item.item_key)){apply(item);return;}
    if((user.puntos||0)<Number(item.puntos_precio||0)){
      showToast?.(`Necesitas ${item.puntos_precio} XP para desbloquear esta silueta`);
      SFX.error();
      return;
    }
    try{
      await supabase.from("user_cosmetics").upsert({usuario_id:String(user.id),item_key:item.item_key,created_at:new Date().toISOString()},{onConflict:"usuario_id,item_key"});
    }catch{}
    const keys=[...new Set([...owned,item.item_key])];
    saveLocalOwnedCosmetics(user,keys);
    setOwned(keys);
    SFX.success();
    showToast?.(`${item.nombre} desbloqueado`);
    apply(item,true);
  }

  async function apply(item,skipToast=false){
    const cfg=normalizeAvatarConfig({...currentConfig,...cosmeticPatch(item)},user.avatar);
    await saveAvatarConfigForUser(user,cfg);
    setUser?.(u=>({...u,avatarConfig:cfg,avatar_config:cfg}));
    onApply?.(cfg);
    if(!skipToast){SFX.success();showToast?.(`${item.nombre} equipado`);}
  }

  const lvl=levelFromPoints(user.puntos||0);
  const selectedItem=selected||items[0];
  const selectedOwned=selectedItem?owned.includes(selectedItem.item_key):false;
  const selectedReached=selectedItem?(user.puntos||0)>=Number(selectedItem.puntos_precio||0):false;
  const selectedActive=selectedItem?normalizeAvatarConfig(currentConfig,user.avatar)[selectedItem.slot]===selectedItem.valor:false;
  const next=items.find(i=>!owned.includes(i.item_key) && Number(i.puntos_precio||0)>(user.puntos||0)) || items.find(i=>!owned.includes(i.item_key));

  return <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.gold}`,overflow:"hidden",padding:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10}}>
      <div style={{minWidth:0}}>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.34rem",color:T.g800}}>🎁 Camino de recompensas</div>
        <div style={{fontSize:".76rem",fontWeight:850,color:T.textSub,lineHeight:1.25}}>Sistema por nivel: los puntos de juego funcionan como XP y no se gastan.</div>
      </div>
      <div style={{textAlign:"right"}}>
        <Badge col="gold">Nv. {lvl.level}</Badge>
        <div style={{fontSize:".66rem",fontWeight:850,color:T.textSub,marginTop:4}}>{lvl.xp} XP</div>
      </div>
    </div>

    <div style={{background:"rgba(110,53,24,.12)",borderRadius:16,padding:10,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:".72rem",fontWeight:950,color:T.g800,marginBottom:6}}>
        <span>{lvl.name}</span>
        <span>{lvl.next.level===lvl.level?"Nivel máximo":`Siguiente: Nv. ${lvl.next.level}`}</span>
      </div>
      <div style={{height:12,background:"rgba(110,53,24,.18)",borderRadius:999,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${lvl.progress}%`,background:T.gradGold,borderRadius:999,transition:"width .35s ease"}}/>
      </div>
      {next&&<div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,marginTop:7}}>Próxima silueta: <b style={{color:T.g800}}>{next.puntos_precio} XP</b></div>}
    </div>

    {loading?<Spinner/>:<>
      <div style={{position:"relative",padding:"12px 0 8px",marginBottom:10}}>
        <div style={{position:"absolute",left:38,right:38,top:49,height:5,background:"linear-gradient(90deg,rgba(58,30,16,.25),rgba(212,175,55,.85),rgba(58,30,16,.25))",borderRadius:999}}/>
        <div style={{display:"flex",gap:4,overflowX:"auto",padding:"0 4px 8px",position:"relative",zIndex:2}}>
          {items.map((item)=>{
            const reached=(user.puntos||0)>=Number(item.puntos_precio||0);
            const has=owned.includes(item.item_key);
            const active=normalizeAvatarConfig(currentConfig,user.avatar)[item.slot]===item.valor;
            return <RewardSilhouette key={item.item_key} item={item} user={user} currentConfig={currentConfig} owned={has} reached={reached} active={active} onClick={()=>{SFX.tab();setSelected(item);}}/>;
          })}
        </div>
      </div>

      {selectedItem&&<div style={{display:"grid",gridTemplateColumns:"74px 1fr",gap:10,alignItems:"center",background:"rgba(255,248,225,.72)",border:`2px solid ${selectedReached?T.gold:T.g200}`,borderRadius:18,padding:10}}>
        <div style={{width:68,height:68,borderRadius:"50%",display:"grid",placeItems:"center",background:selectedReached?"linear-gradient(145deg,#FFF4D6,#E6C27A)":"linear-gradient(145deg,#16100C,#3A2A1D)",overflow:"hidden",boxShadow:"inset 0 8px 18px rgba(0,0,0,.18)"}}>
          <div style={{filter:selectedReached||selectedOwned?"none":"grayscale(1) brightness(0)",opacity:selectedReached||selectedOwned?1:.78}}>
            <Av av={user.avatar} config={{...currentConfig,...cosmeticPatch(selectedItem)}} size={62}/>
          </div>
        </div>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
            <div style={{fontWeight:950,color:T.g800,fontSize:".9rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {selectedReached||selectedOwned?selectedItem.nombre:"Premio oculto"}
            </div>
            <Badge col={selectedOwned?"green":selectedReached?"gold":"red"}>{selectedOwned?"Desbloqueado":selectedReached?"Listo":"Bloqueado"}</Badge>
          </div>
          <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,margin:"4px 0 8px",lineHeight:1.2}}>
            Nivel {rewardLevelFor(selectedItem.puntos_precio)} · {selectedItem.puntos_precio} XP
          </div>
          {selectedOwned?<Btn small full col={selectedActive?"ghost":"gold"} onClick={()=>apply(selectedItem)}>{selectedActive?"Equipado":"Equipar"}</Btn>:
            <Btn small full col={selectedReached?"gold":"ghost"} disabled={!selectedReached} onClick={()=>reveal(selectedItem)}>{selectedReached?"Revelar recompensa":"Silueta bloqueada"}</Btn>}
        </div>
      </div>}
    </>}
  </Card>;
}


function Perfil({user,setUser,onLogout,showToast,showPoints}){
  const [tab,setTab]=useState("resumen");
  const [ownedCosmetics,setOwnedCosmetics]=useState(localOwnedCosmetics(user));
  const [privacy,setPrivacy]=useState(normalizePrivacy(user));
  const [form,setForm]=useState({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarConfig(user.avatarConfig||user.avatar_config,user.avatar)});
  useEffect(()=>{setForm({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarConfig(user.avatarConfig||user.avatar_config,user.avatar)});setOwnedCosmetics(localOwnedCosmetics(user));setPrivacy(normalizePrivacy(user));},[user.id,user.nombre,user.avatar,user.avatarConfig,user.perfil_publico,user.modo_incognito]);
  async function save(){
    const cfg=normalizeAvatarConfig(form.avatarConfig,form.avatar);
    await dbPatch("usuarios",`?id=eq.${user.id}`,{nombre:form.nombre,avatar:form.avatar});
    await saveAvatarConfigForUser({...user,nombre:form.nombre,avatar:form.avatar},cfg);
    setUser(u=>({...u,nombre:form.nombre,avatar:form.avatar,avatarConfig:cfg,avatar_config:cfg}));
    SFX.success();showToast("Personaje actualizado");
  }
  async function updatePrivacy(nextPatch){
    const next=normalizePrivacy({...privacy,...nextPatch});
    setPrivacy(next);
    saveLocalPrivacy(user,next);
    await savePrivacyForUser(user,next);
    setUser(u=>({...u,...next}));
    SFX.success();showToast(next.modo_incognito?"Modo incógnito activado":"Privacidad actualizada");
  }
  const nivel=user.puntos>=1000?"VIP":user.puntos>=500?"Gold":user.puntos>=200?"Silver":"Bronze";
  const cfg=normalizeAvatarConfig(form.avatarConfig,form.avatar);
  const tabs=[
    {id:"resumen",icon:"👤",label:"Resumen"},
    {id:"editar",icon:"🎨",label:"Editor"},
    {id:"camino",icon:"🎁",label:"Camino"},
    {id:"logros",icon:"🏆",label:"Logros"},
  ];
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <Card style={{marginBottom:12,background:"linear-gradient(160deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.72)",color:T.white,padding:"14px 14px"}}>
        <div style={{display:"flex",gap:13,alignItems:"center"}}>
          <Av av={form.avatar} config={cfg} size={86}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.45rem",color:T.white,lineHeight:1}}>{user.nombre}</div>
            <div style={{fontSize:".74rem",color:"rgba(255,244,214,.82)",fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
              <Badge col="gold">{nivel}</Badge>
              <Badge col="green">{user.puntos||0} pts</Badge>
            </div>
            <div style={{fontSize:".72rem",fontWeight:800,color:"rgba(255,244,214,.82)",marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{avatarStyleName(cfg)}</div>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setTab(t.id);}} style={{border:`2px solid ${tab===t.id?T.gold:T.g300}`,background:tab===t.id?T.gradGold:"rgba(255,244,214,.82)",color:tab===t.id?T.g900:T.g700,borderRadius:16,padding:"9px 4px",fontWeight:950,cursor:"pointer",boxShadow:tab===t.id?"0 10px 22px rgba(212,175,55,.24)":"0 5px 12px rgba(20,8,4,.1)"}}>
          <div style={{fontSize:"1.1rem",lineHeight:1}}>{t.icon}</div>
          <div style={{fontSize:".68rem",marginTop:3}}>{t.label}</div>
        </button>)}
      </div>

      {tab==="resumen"&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
            <div><div style={{fontSize:"1.35rem"}}>💎</div><div style={{fontWeight:950,color:T.g800}}>{user.puntos||0}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>puntos</div></div>
            <div><div style={{fontSize:"1.35rem"}}>🏆</div><div style={{fontWeight:950,color:T.g800}}>{nivel}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>nivel</div></div>
            <div><div style={{fontSize:"1.35rem"}}>🎁</div><div style={{fontWeight:950,color:T.g800}}>Camino</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>recompensas</div></div>
          </div>
        </Card>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${privacy.modo_incognito?T.blue:T.g300}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
            <div><div style={{fontWeight:950,color:T.g800}}>🕶️ Privacidad del perfil</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>Controla cómo te ven otros clientes en rankings, foro y comentarios.</div></div>
            {privacy.modo_incognito?<IncognitoAvatar size={48}/>:<Av av={form.avatar} config={cfg} size={48}/>}          
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
            <button onClick={()=>updatePrivacy({perfil_publico:!privacy.perfil_publico,modo_incognito:privacy.modo_incognito && !privacy.perfil_publico?false:privacy.modo_incognito})} style={{border:`2px solid ${privacy.perfil_publico?T.g300:T.blue}`,background:privacy.perfil_publico?"rgba(255,244,214,.72)":"linear-gradient(135deg,#1B1B1B,#3A3A3A)",color:privacy.perfil_publico?T.g800:T.white,borderRadius:16,padding:"11px 12px",fontWeight:950,cursor:"pointer",textAlign:"left"}}>{privacy.perfil_publico?"👁️ Perfil público activado":"🚫 Perfil público oculto"}<div style={{fontSize:".72rem",fontWeight:800,opacity:.8,marginTop:2}}>{privacy.perfil_publico?"Otros usuarios pueden abrir tu perfil público.":"Otros usuarios no verán tu ficha pública."}</div></button>
            <button onClick={()=>updatePrivacy({modo_incognito:!privacy.modo_incognito,perfil_publico:privacy.modo_incognito?privacy.perfil_publico:false})} style={{border:`2px solid ${privacy.modo_incognito?T.blue:T.g300}`,background:privacy.modo_incognito?"linear-gradient(135deg,#050505,#242424)":"rgba(255,244,214,.72)",color:privacy.modo_incognito?T.white:T.g800,borderRadius:16,padding:"11px 12px",fontWeight:950,cursor:"pointer",textAlign:"left"}}>{privacy.modo_incognito?"🕶️ Modo incógnito activado":"👤 Modo incógnito desactivado"}<div style={{fontSize:".72rem",fontWeight:800,opacity:.8,marginTop:2}}>{privacy.modo_incognito?"En rankings y comunidad aparecerás como xxxxxx con silueta negra.":"Se mostrará tu nombre y tu avatar público."}</div></button>
          </div>
        </Card>
        <PerfilNewsActivity user={user}/>
      </>}

      {tab==="editar"&&<Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div><div style={{fontWeight:900,color:T.g800}}>Editor de personaje</div><div style={{fontSize:".78rem",color:T.textSub,fontWeight:700}}>El editor queda arriba, sin bajar media página.</div></div>
          <div className="icon3d" style={{fontSize:"2rem"}}>🎮</div>
        </div>
        <Input label="Nombre" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/>
        <AvatarEditor form={form} setForm={setForm} ownedKeys={ownedCosmetics}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <Btn full onClick={save}>💾 Guardar personaje</Btn>
          <Btn full col="ghost" onClick={()=>setForm({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarConfig(user.avatarConfig||user.avatar_config,user.avatar)})}>Restaurar</Btn>
        </div>
      </Card>}

      {tab==="camino"&&<AvatarRewardPath user={user} setUser={setUser} currentConfig={cfg} onApply={(newCfg)=>{setForm(f=>({...f,avatarConfig:newCfg}));setOwnedCosmetics(localOwnedCosmetics(user));}} showToast={showToast} showPoints={showPoints}/>}

      {tab==="logros"&&<ObjetivosTrofeos user={user} setUser={setUser} showToast={showToast} showPoints={showPoints}/>}

      <Btn full col="red" onClick={onLogout}>🚪 Cerrar sesión</Btn>
    </div>
  );
}



const MUSIC_LIBRARY=[
  {id:"kaseo",artist:"Kase.O",emoji:"🎤",genre:"Rap clásico",mood:"letra, técnica y calma",desc:"Rap español de alto nivel, ideal para escuchar con atención. Buen punto de entrada para quien quiere rap con letras trabajadas.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Kase.O+oficial"},
    {label:"Temas clásicos",url:"https://www.youtube.com/results?search_query=Kase.O+mejores+canciones"}
  ]},
  {id:"morodo",artist:"Morodo",emoji:"🟢",genre:"Reggae español",mood:"raíz, barrio y buen ritmo",desc:"Reggae nacional muy reconocible, con temas perfectos para ambiente tranquilo y letras directas.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Morodo+oficial"},
    {label:"Nuevos temas",url:"https://www.youtube.com/results?search_query=Morodo+nuevo+tema"}
  ]},
  {id:"purenegga",artist:"Pure Negga",emoji:"🎧",genre:"Reggae / rap melódico",mood:"voz suave y ambiente",desc:"Muy buena opción para quien busca algo más melódico, con vibra tranquila y fácil de escuchar.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Pure+Negga+oficial"},
    {label:"Novedades",url:"https://www.youtube.com/results?search_query=Pure+Negga+nuevo+tema"}
  ]},
  {id:"fyahbwoy",artist:"Fyahbwoy",emoji:"🔥",genre:"Dancehall / reggae",mood:"energía y flow",desc:"Para momentos con más fuerza: dancehall, reggae y ritmo con más pegada para entrar al Arcade con energía.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Fyahbwoy+oficial"},
    {label:"Directos y temas",url:"https://www.youtube.com/results?search_query=Fyahbwoy+mejores+temas"}
  ]},
  {id:"rapsusklei",artist:"Rapsusklei",emoji:"🌙",genre:"Rap / reggae",mood:"letra y sensibilidad",desc:"Rap con mucha personalidad, buen equilibrio entre calma, reflexión y musicalidad.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Rapsusklei+oficial"},
    {label:"Temas recomendados",url:"https://www.youtube.com/results?search_query=Rapsusklei+mejores+canciones"}
  ]},
  {id:"bobmarley",artist:"Bob Marley",emoji:"🇯🇲",genre:"Reggae clásico",mood:"clásico imprescindible",desc:"Base obligatoria para quien quiera entender el reggae. Música reconocible, positiva y con historia.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Bob+Marley+official"},
    {label:"Clásicos",url:"https://www.youtube.com/results?search_query=Bob+Marley+greatest+hits"}
  ]},
  {id:"skap",artist:"Ska-P",emoji:"🎺",genre:"Ska punk",mood:"fiesta y crítica",desc:"Ska rápido, guitarras, metales y energía. Perfecto para una sección más cañera sin caer en música comercial.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Ska-P+oficial"},
    {label:"Clásicos",url:"https://www.youtube.com/results?search_query=Ska-P+mejores+canciones"}
  ]},
  {id:"nirvana",artist:"Nirvana",emoji:"🎸",genre:"Rock / grunge",mood:"crudo y mítico",desc:"Rock alternativo/grunge para meter variedad en la biblioteca. Sonido más duro, clásico y muy reconocible.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Nirvana+official"},
    {label:"Clásicos",url:"https://www.youtube.com/results?search_query=Nirvana+greatest+hits"}
  ]},
  {id:"violadores",artist:"Violadores del Verso",emoji:"🏙️",genre:"Rap clásico",mood:"Zaragoza y barras",desc:"Rap de Zaragoza con peso histórico. Encaja muy bien para una app con identidad local y cultura urbana.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Violadores+del+Verso+oficial"},
    {label:"Temas clásicos",url:"https://www.youtube.com/results?search_query=Violadores+del+Verso+mejores+temas"}
  ]},
  {id:"nach",artist:"Nach",emoji:"📖",genre:"Rap lírico",mood:"letra y mensaje",desc:"Rap español con letras muy cuidadas. Buena opción para escuchar con calma y descubrir temas con mensaje.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Nach+oficial"},
    {label:"Temas recomendados",url:"https://www.youtube.com/results?search_query=Nach+mejores+canciones"}
  ]},
  {id:"culturaprofetica",artist:"Cultura Profética",emoji:"🌊",genre:"Reggae latino",mood:"suave y elegante",desc:"Reggae latino con sonido muy agradable, ideal para relajar el ambiente sin perder calidad.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Cultura+Profetica+oficial"},
    {label:"Clásicos",url:"https://www.youtube.com/results?search_query=Cultura+Profetica+mejores+canciones"}
  ]},
  {id:"mano_negra",artist:"Mano Negra",emoji:"🚐",genre:"Rock / ska / mestizaje",mood:"callejero y viajero",desc:"Sonido callejero, mezcla de estilos y energía de ruta. Buena puerta a rock, ska y mestizaje.",links:[
    {label:"YouTube",url:"https://www.youtube.com/results?search_query=Mano+Negra+mejores+canciones"},
    {label:"Directos",url:"https://www.youtube.com/results?search_query=Mano+Negra+live"}
  ]}
];


function dailyMusicSelection(filter="todo",seed=0){
  const base=Array.isArray(MUSIC_LIBRARY)?MUSIC_LIBRARY:[];
  const ordered=dailyOrderedList(base,`music_${filter}`,seed);
  // En "Todo" se muestra una selección diaria para que no parezca una lista fija.
  // En filtros concretos se muestra todo ese estilo, pero rotado cada día.
  return filter==="todo"?ordered.slice(0,8):ordered;
}

function MusicaComunidad({showToast}){
  const [filter,setFilter]=useState("todo");
  const [musicSeed,setMusicSeed]=useState(0);
  const filters=[
    {id:"todo",label:"Todo",icon:"✨"},
    {id:"reggae",label:"Reggae",icon:"🟢"},
    {id:"rap",label:"Rap",icon:"🎤"},
    {id:"ska",label:"Ska",icon:"🎺"},
    {id:"rock",label:"Rock",icon:"🎸"}
  ];
  function matches(item){
    const g=normalizeText(`${item?.genre||""} ${item?.artist||""} ${item?.desc||""}`);
    if(filter==="todo")return true;
    if(filter==="reggae")return g.includes("reggae")||g.includes("dancehall");
    if(filter==="rap")return g.includes("rap");
    if(filter==="ska")return g.includes("ska");
    if(filter==="rock")return g.includes("rock")||g.includes("grunge");
    return true;
  }
  const list=dailyMusicSelection(filter,musicSeed).filter(matches);
  function reloadMusic(){
    SFX.action();
    setMusicSeed(v=>v+1);
    showToast?.("Cambiando selección musical...");
  }
  function openLink(link){
    SFX.action();
    showToast?.(`Abriendo ${link.label}`);
    window.open(link.url,"_blank","noopener,noreferrer");
  }
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{marginBottom:14,padding:0,overflow:"hidden",background:"linear-gradient(160deg,#120806,#24110A 48%,#4E3A76)",border:"2px solid rgba(255,244,214,.5)",color:T.white}}>
      <div style={{padding:"18px 16px",position:"relative"}}>
        <div style={{position:"absolute",right:-18,top:-28,fontSize:"7rem",opacity:.10,transform:"rotate(-12deg)"}}>🎧</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:".72rem",fontWeight:950,letterSpacing:".08em",textTransform:"uppercase",color:"rgba(255,244,214,.72)"}}>Biblioteca Rasta Cuts</div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.75rem",lineHeight:1,color:"#FFD66B",textShadow:"0 4px 12px rgba(0,0,0,.35)"}}>Música buena</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35,marginTop:4}}>Selección diaria de reggae, rap clásico, ska y rock. Cada día cambia el orden y puedes refrescar propuestas.</div>
          <button onClick={reloadMusic} style={{marginTop:11,border:"1px solid rgba(255,244,214,.35)",background:"rgba(255,244,214,.12)",color:T.white,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>🔄 Cambiar selección</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,padding:"0 12px 14px"}}>
        {filters.map(f=><button key={f.id} onClick={()=>{SFX.tab();setFilter(f.id);setMusicSeed(0);}} style={{border:`1.5px solid ${filter===f.id?T.gold:"rgba(255,244,214,.25)"}`,borderRadius:14,padding:"8px 4px",background:filter===f.id?"rgba(255,214,107,.22)":"rgba(255,244,214,.08)",color:T.white,fontWeight:950,cursor:"pointer",fontSize:".68rem"}}>
          <div style={{fontSize:"1.1rem",lineHeight:1}}>{f.icon}</div>
          <div style={{marginTop:3}}>{f.label}</div>
        </button>)}
      </div>
    </Card>

    <div style={{display:"grid",gap:12}}>
      {list.map(item=><Card key={item.id} style={{padding:0,overflow:"hidden",background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}} hover>
        <div style={{display:"grid",gridTemplateColumns:"88px 1fr",gap:0}}>
          <div style={{minHeight:142,background:"radial-gradient(circle at 40% 25%,rgba(255,255,255,.28),transparent 32%),linear-gradient(160deg,#24110A,#4E3A76 60%,#D4AF37)",display:"grid",placeItems:"center",position:"relative"}}>
            <div className="icon3d" style={{fontSize:"2.9rem"}}>{item.emoji}</div>
            <div style={{position:"absolute",bottom:8,left:8,right:8,textAlign:"center",fontSize:".62rem",fontWeight:950,color:"rgba(255,244,214,.8)"}}>{item.genre}</div>
          </div>
          <div style={{padding:"13px 13px 12px",minWidth:0}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.32rem",lineHeight:1,color:T.g800}}>{item.artist}</div>
                <div style={{fontSize:".72rem",fontWeight:950,color:"#4E3A76",textTransform:"uppercase",letterSpacing:".05em",marginTop:2}}>{item.mood}</div>
              </div>
              <Badge col="gold">{String(item.genre||"Música").split("/")[0].trim()}</Badge>
            </div>
            <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:8}}>{item.desc}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:11}}>
              {(item.links||[]).map(link=><button key={link.label} onClick={()=>openLink(link)} style={{border:"none",borderRadius:999,padding:"8px 11px",background:link.label==="YouTube"?"linear-gradient(180deg,#A72822,#6E1B14)":"linear-gradient(180deg,#24110A,#6E3518)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 14px rgba(20,8,4,.18)"}}>
                {link.label==="YouTube"?"▶️ ":"🔎 "}{link.label}
              </button>)}
            </div>
          </div>
        </div>
      </Card>)}
    </div>

    <Card style={{marginTop:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
      <div style={{fontWeight:950,color:T.g800}}>📌 Idea para más adelante</div>
      <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Podemos convertir esta sección en editable desde admin para añadir artistas, canciones concretas, playlists y novedades sin tocar código.</div>
    </Card>
  </div>;
}


function Comunidad(props){
  const {initialTab="feed",showToast}=props;
  const [sub,setSub]=useState(initialTab||"feed");
  useEffect(()=>{setSub(initialTab||"feed");},[initialTab]);
  const tabs=[
    {id:"feed",icon:"📌",label:"Tablón",sub:"Anuncios oficiales, promociones y novedades de la tienda."},
    {id:"foro",icon:"🗣️",label:"Foro",sub:"Temas abiertos, dudas, votaciones y conversación entre usuarios."},
    {id:"noticias",icon:"📰",label:"Actualidad",sub:"Curiosidades, rural, comida, sitios, peluquería y negocios locales."},
    {id:"musica",icon:"🎧",label:"Música",sub:"Reggae, rap clásico, ska y rock con enlaces rápidos para descubrir buena música."},
  ];
  const active=tabs.find(t=>t.id===sub)||tabs[0];
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{marginBottom:14,background:"linear-gradient(160deg,#24110A,#5C3317 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.6)",color:T.white,padding:"18px 16px"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.8rem",lineHeight:1}}>Comunidad</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.82)",lineHeight:1.35}}>Un solo sitio para leer, participar, descubrir música y volver a tus hilos sin perderte entre pestañas.</div>
        </div>
        <div className="icon3d" style={{fontSize:"2.1rem"}}>🌐</div>
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
      {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setSub(t.id);}} style={{border:`2px solid ${active.id===t.id?T.gold:T.g300}`,background:active.id===t.id?T.gradGold:"rgba(255,244,214,.82)",color:active.id===t.id?T.g900:T.g700,borderRadius:16,padding:"10px 6px",fontWeight:950,cursor:"pointer",boxShadow:active.id===t.id?"0 10px 24px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.1)"}}>
        <div style={{fontSize:"1.28rem",lineHeight:1}}>{t.icon}</div>
        <div style={{fontSize:".75rem",marginTop:3}}>{t.label}</div>
      </button>)}
    </div>
    <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",padding:"12px 14px"}}>
      <div style={{fontWeight:950,color:T.g800}}>{active.icon} {active.label}</div>
      <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{active.sub}</div>
    </Card>
    {sub==="feed"&&<SocialFeed {...props}/>} 
    {sub==="foro"&&<Foro {...props}/>} 
    {sub==="noticias"&&<Noticias {...props}/>} 
    {sub==="musica"&&<MusicaComunidad {...props}/>} 
  </div>;
}



function GestionTienda({showToast}){
  const empty={id:null,item_key:"",nombre:"",descripcion:"",categoria:"premios",tipo:"canje",icono:"🎁",puntos_precio:"100",stock:"",activo:"true",rareza:"comun",slot:"",valor:""};
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showEdit,setShowEdit]=useState(false);
  const [form,setForm]=useState(empty);
  const [filter,setFilter]=useState("todo");

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("tienda_items","?order=created_at.desc&select=*");
    setItems(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  function openNew(){
    setForm({...empty,item_key:`item_${Date.now()}`});
    setShowEdit(true);
  }

  function openEdit(item){
    setForm({
      id:item.id,
      item_key:item.item_key||"",
      nombre:item.nombre||"",
      descripcion:item.descripcion||"",
      categoria:item.categoria||"premios",
      tipo:item.tipo||"canje",
      icono:item.icono||"🎁",
      puntos_precio:String(item.puntos_precio??0),
      stock:item.stock===null||item.stock===undefined?"":String(item.stock),
      activo:String(item.activo!==false),
      rareza:item.rareza||"comun",
      slot:item.slot||"",
      valor:item.valor||""
    });
    setShowEdit(true);
  }

  async function saveItem(){
    if(!form.nombre.trim()){showToast?.("Pon un nombre");return;}
    const payload={
      item_key:form.item_key.trim()||`item_${Date.now()}`,
      nombre:form.nombre.trim(),
      descripcion:form.descripcion.trim(),
      categoria:form.categoria,
      tipo:form.tipo,
      icono:form.icono||"🎁",
      puntos_precio:Math.max(0,parseInt(form.puntos_precio||"0",10)||0),
      stock:form.stock===""?null:Math.max(0,parseInt(form.stock||"0",10)||0),
      activo:form.activo==="true",
      rareza:form.rareza,
      slot:form.slot.trim()||null,
      valor:form.valor.trim()||null,
      visible_para:"clientes",
      updated_at:new Date().toISOString()
    };
    const ok=form.id
      ? await dbPatch("tienda_items",`?id=eq.${form.id}`,payload)
      : await dbPost("tienda_items",payload);
    if(ok){
      showToast?.(form.id?"Producto actualizado":"Producto creado");
      SFX.success();
      setShowEdit(false);
      await load();
    }else{
      showToast?.("No se pudo guardar el producto");
      SFX.error();
    }
  }

  async function toggleActive(item){
    const ok=await dbPatch("tienda_items",`?id=eq.${item.id}`,{activo:!item.activo,updated_at:new Date().toISOString()});
    if(ok){showToast?.(!item.activo?"Producto activado":"Producto desactivado");await load();}
    else{showToast?.("No se pudo cambiar el estado");SFX.error();}
  }

  const cats=[
    {id:"todo",label:"Todo"},
    {id:"cupones",label:"Cupones"},
    {id:"avatar",label:"Avatar"},
    {id:"juegos",label:"Juegos"},
    {id:"premios",label:"Premios"}
  ];
  const visibles=filter==="todo"?items:items.filter(i=>String(i.categoria||"premios")===filter);

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="🛍️" title="Tienda editable" sub={`${items.length} productos configurados`} action={<Btn small col="gold" onClick={openNew}>+ Producto</Btn>}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🛠️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Administra premios sin tocar código</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Crea cupones, objetos de avatar, extras de juegos o premios. La tienda del cliente lee desde Supabase.</div>
          </div>
        </div>
      </Card>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=><button key={c.id} onClick={()=>{SFX.tab();setFilter(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===c.id?T.gold:T.g300}`,background:filter===c.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{c.label}</button>)}
      </div>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin productos" sub="Crea el primer producto de tienda."/>:
        visibles.map(item=><Card key={item.id} style={{marginBottom:10,background:item.activo?"linear-gradient(180deg,#FFF4D6,#E9D9B7)":"linear-gradient(180deg,#E6CF9B,#D8BE87)",opacity:item.activo?1:.72}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div className="icon3d" style={{fontSize:"2rem"}}>{item.icono||"🎁"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <b style={{color:T.g800}}>{item.nombre}</b>
                <Badge col={item.activo?"green":"red"}>{item.activo?"activo":"oculto"}</Badge>
              </div>
              <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:3}}>{item.descripcion}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                <Badge col="gold">{item.puntos_precio} pts</Badge>
                <Badge col="blue">{item.categoria}</Badge>
                <Badge col={item.rareza==="epico"?"pink":item.rareza==="raro"?"blue":item.rareza==="legendario"?"gold":"green"}>{rarityLabel(item.rareza||"comun")}</Badge>
                {item.stock!==null&&item.stock!==undefined&&<Badge col={Number(item.stock)>0?"green":"red"}>Stock {item.stock}</Badge>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <Btn small col="dark" onClick={()=>openEdit(item)}>Editar</Btn>
            <Btn small col={item.activo?"red":"green"} onClick={()=>toggleActive(item)}>{item.activo?"Desactivar":"Activar"}</Btn>
          </div>
        </Card>)
      }

      <Modal show={showEdit} onClose={()=>setShowEdit(false)} title={form.id?"Editar producto":"Nuevo producto"}>
        <Input label="Clave interna" value={form.item_key} onChange={v=>setForm(f=>({...f,item_key:v}))} placeholder="cupon_5_descuento"/>
        <Input label="Nombre" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/>
        <Input label="Descripción" value={form.descripcion} onChange={v=>setForm(f=>({...f,descripcion:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Icono" value={form.icono} onChange={v=>setForm(f=>({...f,icono:v}))}/>
          <Input label="Precio puntos" value={form.puntos_precio} onChange={v=>setForm(f=>({...f,puntos_precio:v}))} type="number"/>
        </div>
        <Select label="Categoría" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={[
          {value:"cupones",label:"Cupones"},
          {value:"avatar",label:"Avatar"},
          {value:"juegos",label:"Juegos"},
          {value:"premios",label:"Premios"}
        ]}/>
        <Select label="Tipo" value={form.tipo} onChange={v=>setForm(f=>({...f,tipo:v}))} options={[
          {value:"cupon",label:"Cupón"},
          {value:"avatar",label:"Avatar"},
          {value:"bonus",label:"Bonus juego"},
          {value:"canje",label:"Canje/premio"}
        ]}/>
        <Select label="Rareza" value={form.rareza} onChange={v=>setForm(f=>({...f,rareza:v}))} options={[
          {value:"comun",label:"Común"},
          {value:"raro",label:"Raro"},
          {value:"epico",label:"Épico"},
          {value:"legendario",label:"Legendario"}
        ]}/>
        <Input label="Stock vacío = ilimitado" value={form.stock} onChange={v=>setForm(f=>({...f,stock:v}))} type="number"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Slot avatar/opcional" value={form.slot} onChange={v=>setForm(f=>({...f,slot:v}))} placeholder="aura, bg, frame..."/>
          <Input label="Valor/opcional" value={form.valor} onChange={v=>setForm(f=>({...f,valor:v}))} placeholder="warm, flame..."/>
        </div>
        <Select label="Estado" value={form.activo} onChange={v=>setForm(f=>({...f,activo:v}))} options={[{value:"true",label:"Activo"},{value:"false",label:"Oculto"}]}/>
        <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)"}}>
          <Btn full col="gold" onClick={saveItem}>Guardar producto</Btn>
        </div>
      </Modal>
    </div>
  );
}

function GestionAdmin({user,setUser,showToast,showPoints}){
  const role=normalizeRole(user?.rol||user?.role);
  const isAdmin=role===ROLES.ADMIN;
  const isStaff=role===ROLES.STAFF;
  const canAccess=isAdmin||isStaff;
  const [tab,setTab]=useState("resumen");
  const tabs=[
    {id:"resumen",icon:"🏠",label:"Resumen",sub:"Inicio interno con próximas citas y acciones rápidas",staff:true},
    {id:"facturacion",icon:"💰",label:"Facturación",sub:"Caja, cobros y ventas del día",staff:true},
    {id:"citas",icon:"📅",label:"Citas",sub:"Reservas pendientes y confirmadas",staff:true},
    {id:"clientes",icon:"👥",label:"Clientes",sub:"Fichas e historial de clientes",staff:true},
    {id:"stock",icon:"📦",label:"Stock",sub:"Inventario y productos",staff:true},
    {id:"tienda",icon:"🛍️",label:"Tienda",sub:"Premios, cupones y objetos editables",staff:false},
    {id:"usuarios",icon:"👑",label:"Usuarios",sub:"Roles y permisos",staff:false},
    {id:"ajustes",icon:"⚙️",label:"Ajustes",sub:"Configuración interna",staff:false},
  ].filter(t=>isAdmin||t.staff);
  const active=tabs.find(t=>t.id===tab)||tabs[0];

  useEffect(()=>{
    if(!tabs.find(t=>t.id===tab)) setTab(tabs[0]?.id||"facturacion");
  },[role]);

  if(!canAccess){
    return <EmptyState icon="🔒" title="Zona interna" sub="Sólo admin y staff pueden entrar en gestión."/>;
  }

  function RestrictedCard({title,sub,icon="🔒"}){
    return <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:"2rem"}}>{icon}</div>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>{title}</div>
          <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{sub}</div>
        </div>
      </div>
    </Card>;
  }

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#120806,#2B1A0D 48%,#D4AF37)",border:"2px solid rgba(255,244,214,.52)",color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-18,top:-28,fontSize:"7rem",opacity:.10}}>⚙️</div>
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.4rem"}}>🧾</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.75rem",lineHeight:1}}>Gestión</div>
            <div style={{fontSize:".82rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
              Panel interno para caja, citas, clientes, stock y administración. Staff ve herramientas de trabajo; admin ve permisos y ajustes.
            </div>
          </div>
          <Badge col={isAdmin?"gold":"green"}>{isAdmin?"ADMIN":"STAFF"}</Badge>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setTab(t.id);}} style={{border:`2px solid ${active.id===t.id?T.gold:T.g300}`,background:active.id===t.id?T.gradGold:"rgba(255,244,214,.84)",color:active.id===t.id?T.g900:T.g700,borderRadius:16,padding:"10px 6px",fontWeight:950,cursor:"pointer",boxShadow:active.id===t.id?"0 10px 24px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.1)"}}>
          <div style={{fontSize:"1.28rem",lineHeight:1}}>{t.icon}</div>
          <div style={{fontSize:".68rem",marginTop:3}}>{t.label}</div>
        </button>)}
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",padding:"12px 14px"}}>
        <div style={{fontWeight:950,color:T.g800}}>{active.icon} {active.label}</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{active.sub}</div>
      </Card>

      {tab==="resumen"&&<DashboardAdmin user={user} showToast={showToast}/>} 
      {tab==="facturacion"&&<Caja user={user} showToast={showToast}/>}
      {tab==="citas"&&<Citas user={user} showToast={showToast}/>}
      {tab==="clientes"&&<Clientes showToast={showToast}/>}
      {tab==="stock"&&<Inventario showToast={showToast}/>}
      {tab==="tienda"&&(isAdmin?<GestionTienda showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El staff puede trabajar con caja, citas, clientes y stock, pero no editar la tienda."/> )}
      {tab==="usuarios"&&(isAdmin?<AdminUsuarios user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El staff puede trabajar con caja, citas, clientes y stock, pero no cambiar roles ni permisos."/> )}
      {tab==="ajustes"&&(isAdmin?<Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>⚙️ Ajustes internos</div>
        <div style={{fontSize:".84rem",fontWeight:800,color:T.textSub,lineHeight:1.4}}>
          Esta zona queda preparada para el final: nombre de la tienda, puntos por acciones, frases del Rasta, recompensas, horarios y enlaces destacados.
        </div>
      </Card>:<RestrictedCard title="Ajustes bloqueados" sub="Los ajustes globales sólo deberían tocarlos administradores."/> )}
    </div>
  );
}


const NAV_CFG={
  admin:[{id:"juegos",icon:"🎮",label:"Arcade"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"perfil",icon:"👤",label:"Perfil"}],
  staff:[{id:"juegos",icon:"🎮",label:"Arcade"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"perfil",icon:"👤",label:"Perfil"}],
  client:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"perfil",icon:"👤",label:"Perfil"}],
};
const GRAD_ROLE={admin:T.gradAdmin,staff:T.gradStaff,client:T.gradClient};

const HELP_TEXTS={
  dashboard:"Aquí ves tu resumen principal: puntos, próxima cita y accesos rápidos.",
  comunidad:"Aquí están Tablón, Foro, Actualidad y Música: lee anuncios, abre temas, comenta noticias y descubre enlaces recomendados.",
  musica:"Biblioteca de música con reggae, rap clásico, ska y rock. Entra a enlaces rápidos y descubre artistas sin música comercial.",
  noticias:"Magazine de comunidad: lee noticias útiles, comenta, da likes y gana puntos por participar sin ruido político.",
  feed:"El tablón es para anuncios oficiales de la tienda. Los clientes leen y reaccionan; admin y staff publican.",
  foro:"En el Foro puedes abrir temas, responder, votar ideas y hablar con otros usuarios.",
  tienda:"Aquí canjeas tus puntos por premios, descuentos o regalos.",
  juegos:"En Arcade tienes juegos diarios, récords y retos para ganar puntos sin romper la economía.",
  retos:"Los retos te dan objetivos para ganar más puntos de forma divertida.",
  ranking:"En Ranking comparas tu progreso con otros clientes.",
  perfil:"En Perfil editas tu personaje, tu nombre y tu estilo.",
  citas:"Aquí se gestionan las reservas y el calendario.",
  clientes:"Sección para revisar fichas y datos de clientes.",
  inventario:"Aquí controlas productos y stock.",
  caja:"Sección para cobros e ingresos.",
  usuarios:"Aquí un admin puede cambiar roles y permisos.",
  gestion:"Panel interno para facturación, caja, citas, clientes, stock y herramientas de administración."
};

function LoginHelperAvatar({size=46,speaking=false}={}){
  const wrapStyle={
    width:size,
    height:size,
    borderRadius:"50%",
    overflow:"hidden",
    display:"grid",
    placeItems:"center",
    background:"radial-gradient(circle at 30% 20%,#FFF5D8 0%,#E9D09A 42%,#C98B35 100%)",
    border:`2px solid ${T.g300}`,
    boxShadow:speaking?"0 10px 24px rgba(20,8,4,.24), 0 0 0 6px rgba(255,215,102,.16)":"0 8px 16px rgba(20,8,4,.18)",
    animation:"avatarIdlePro 3.2s ease-in-out infinite"
  };
  return (
    <div style={wrapStyle}>
      <svg viewBox="0 0 120 120" style={{width:"100%",height:"100%",display:"block"}}>
        <defs>
          <linearGradient id="helperBgPro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6E3C21"/>
            <stop offset="60%" stopColor="#B86C2F"/>
            <stop offset="100%" stopColor="#E0B146"/>
          </linearGradient>
          <radialGradient id="helperGlowPro" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,.55)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <linearGradient id="skinHelperPro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5C89A"/>
            <stop offset="100%" stopColor="#E7AB77"/>
          </linearGradient>
          <linearGradient id="clothHelperPro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5D3317"/>
            <stop offset="100%" stopColor="#8F4D22"/>
          </linearGradient>
          <linearGradient id="bandanaPro" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A62A25"/>
            <stop offset="100%" stopColor="#E36C47"/>
          </linearGradient>
          <linearGradient id="dreadPro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A2B14"/>
            <stop offset="100%" stopColor="#C08A3D"/>
          </linearGradient>
        </defs>

        <circle cx="60" cy="60" r="60" fill="url(#helperBgPro)" />
        <circle cx="44" cy="28" r="34" fill="url(#helperGlowPro)" />
        <ellipse cx="60" cy="104" rx="25" ry="7" fill="rgba(20,8,4,.18)"/>

        <g style={{transformOrigin:"60px 56px",animation:"avatarBreathPro 3s ease-in-out infinite"}}>
          <path d="M18 46 C18 60 22 76 28 90" fill="none" stroke="#3C2413" strokeWidth="8" strokeLinecap="round"/>
          <path d="M26 36 C24 52 28 72 34 92" fill="none" stroke="url(#dreadPro)" strokeWidth="8" strokeLinecap="round"/>
          <path d="M33 30 C32 50 37 72 40 92" fill="none" stroke="#D4A24E" strokeWidth="8" strokeLinecap="round"/>
          <path d="M102 46 C102 60 98 76 92 90" fill="none" stroke="#3C2413" strokeWidth="8" strokeLinecap="round"/>
          <path d="M94 36 C96 52 92 72 86 92" fill="none" stroke="url(#dreadPro)" strokeWidth="8" strokeLinecap="round"/>
          <path d="M87 30 C88 50 83 72 80 92" fill="none" stroke="#D4A24E" strokeWidth="8" strokeLinecap="round"/>

          <path d="M38 42 C40 25 49 18 60 18 C71 18 80 25 82 42 L81 48 C75 44 67 42 60 42 C53 42 45 44 39 48 Z" fill="#342013"/>
          <path d="M37 45 C44 37 52 33 60 33 C68 33 76 37 83 45 L80 55 C74 50 67 48 60 48 C53 48 46 50 40 55 Z" fill="url(#bandanaPro)"/>
          <path d="M53 23 C55 18 58 16 60 16 C62 16 65 18 67 23" fill="none" stroke="#5B351A" strokeWidth="6" strokeLinecap="round"/>
          <ellipse cx="60" cy="19" rx="12" ry="5" fill="#5B351A" opacity=".85"/>

          <path d="M39 54 C39 39 48 28 60 28 C72 28 81 39 81 54 C81 75 72 92 60 96 C48 92 39 75 39 54 Z" fill="url(#skinHelperPro)"/>
          <ellipse cx="38" cy="61" rx="4" ry="7" fill="#E5A06F"/>
          <ellipse cx="82" cy="61" rx="4" ry="7" fill="#E5A06F"/>

          <path d="M47 49 C51 46 55 46 58 47" fill="none" stroke="#301B10" strokeWidth="2.6" strokeLinecap="round"/>
          <path d="M62 47 C65 46 69 46 73 49" fill="none" stroke="#301B10" strokeWidth="2.6" strokeLinecap="round"/>

          <g style={{transformOrigin:"51px 59px",animation:"eyeBlink 4.4s infinite"}}>
            <ellipse cx="51" cy="58" rx="3.3" ry="4.2" fill="#17110D"/>
            <circle cx="50" cy="57" r="1" fill="#fff"/>
          </g>
          <g style={{transformOrigin:"69px 59px",animation:"eyeBlink 4.4s infinite"}}>
            <ellipse cx="69" cy="58" rx="3.3" ry="4.2" fill="#17110D"/>
            <circle cx="68" cy="57" r="1" fill="#fff"/>
          </g>

          <path d="M59 60 C60 65 59 68 56.5 70" fill="none" stroke="#C9855C" strokeWidth="2" strokeLinecap="round"/>
          <path d="M50 74 C55 78 65 78 70 74" fill="none" stroke="#8E3826" strokeWidth="3" strokeLinecap="round"/>

          <path d="M47 70 C51 68 56 68 60 69 C64 68 69 68 73 70" fill="none" stroke="#3A2314" strokeWidth="4" strokeLinecap="round"/>
          <path d="M49 78 C53 82 67 82 71 78" fill="none" stroke="#3A2314" strokeWidth="3" strokeLinecap="round"/>
          <path d="M56 76 L60 84 L64 76" fill="#3A2314"/>

          <path d="M44 106 C49 97 71 97 76 106" fill="url(#clothHelperPro)"/>
          <path d="M52 96 C56 93 64 93 68 96" fill="none" stroke="#F4D27E" strokeWidth="4" strokeLinecap="round"/>
        </g>

        {speaking && <g style={{animation:"softPop3d .25s ease"}}>
          <circle cx="96" cy="22" r="12" fill="#FFF7E0" stroke="#D4AF37" strokeWidth="3"/>
          <path d="M93 18 H99 M96 15 V21" stroke="#8A5A1D" strokeWidth="2.2" strokeLinecap="round"/>
        </g>}
      </svg>
    </div>
  );
}

const HELP_TIPS = {
  dashboard:[
    "Ey, mi gente. Aquí tienes el campamento base: entrar a jugar, mirar novedades, pasar por la comunidad o revisar tu perfil sin perderte por los menús.",
    "Si vienes con prisa, tira de los botones grandes. Si vienes con calma, date una vuelta por Actualidad; siempre hay alguna historia curiosa, rural o de buen comer.",
    "Los puntos son como cuidar unas rastas: poquito a poco, con constancia y sin tirones raros.",
    "Consejo de tienda: juega, comenta con cabeza y vuelve mañana. El buen flow se desbloquea por costumbre, no por machacar botones como loco."
  ],
  arcade:[
    "Bienvenido al Arcade, brother. Aquí se juega por récord, por pique sano y por puntos para avatares, premios o descuentos.",
    "Puedes rejugar para mejorar marca, pero los puntos reales no son barra libre. Si no, la tienda acaba más desplumada que un peine viejo.",
    "Cada juego tiene su truco. Si dudas, tócame y te explico la jugada antes de que las tijeras te hagan un corte gratis.",
    "Para jugar con flow: una partida, buen ritmo y sin ponerse nervioso. Como en reggae: tempo firme y cabeza fría."
  ],
  game_stitch:[
    "Gancho Ninja va de precisión. Cose las rastas buenas, evita tijeras y no te emociones con el dedo, que aquí el pulso manda.",
    "Objetivo claro: llegar a 100 puntos. Si juntas 20 tijeras, se acabó la ronda, mi pana.",
    "Para pasar necesitas 81 aciertos o más. Menos de eso y esa rasta queda como hecha en una tormenta.",
    "Si sale el ticket dorado, píllalo. Suma +5 y aparece poco, como aparcar bien a la primera en día de mercado."
  ],
  game_runner:[
    "Rasta Runner es correr y saltar sin comerte las tijeras. Fácil de entender, peligroso cuando sube el ritmo.",
    "Toca una vez para saltar. Toca dos veces para doble salto. Mantén pulsado un poco para alargarlo, pero no flotas como en One Piece.",
    "El truco es no saltar tarde. Las tijeras no perdonan, y este rasta no hace injertos de emergencia.",
    "Cuanta más distancia aguantes, mejor récord. Los puntos reales se cobran una vez al día, así la cosa mantiene valor."
  ],
  game_jump:[
    "Rasta Jump es recoger herramientas y aguantar cuando la velocidad empieza a ponerse seria.",
    "Peines, ganchillos y objetos de peluquería son tu tesoro. Las tijeras mal cogidas son el villano del capítulo.",
    "Al principio parece paseo rural; luego se acelera y toca moverse con reflejos de tripulación pirata.",
    "Mira el patrón, no persigas todo. A veces dejar pasar un objeto salva la partida."
  ],
  game_gacha:[
    "Gacha Barber es la máquina de premios. Tiras, salen símbolos y si juntas tres iguales puede caer premio.",
    "El ticket dorado es el tesoro grande: 50 puntos, pero sale rarísimo. Nivel encontrar el One Piece en la primera isla.",
    "Lo normal es sacar 0. No te enfades; está pensado para emoción, no para imprimir puntos.",
    "Cuando suene la máquina, deja que entre el rollo casino-reggae: una tirada, una sonrisa y seguimos."
  ],
  game_memoria:[
    "Memoria Pro es de mirar bien, no de darle a lo loco. Aquí gana quien tiene calma de peluquero con cita complicada.",
    "Encuentra parejas y no pierdas el hilo. Si te aceleras, el tablero te peina hacia atrás.",
    "Buen juego para descansar de los reflejos. Ponte un tema tranquilo y trabaja la cabeza.",
    "Repetir mejora récord, pero los puntos diarios solo se cobran una vez. Flow justo para todos."
  ],
  game_sopa:[
    "La Sopa diaria es para buscar palabras sin presión. Ideal para jugar con café, perro al lado y cero estrés.",
    "Cada día debería sentirse distinta. Si ves una palabra de peluquería, estilo o comunidad, márcala sin miedo.",
    "Este juego es más de calma rural que de arcade loco. Aquí gana el ojo fino.",
    "Completar la sopa guarda marca y puede dar puntos si aún no los cobraste hoy."
  ],
  game_trivia:[
    "Trivia Barber es para aprender y picarse un poco. Pelo, estilo, rastas y cuidados con preguntas rápidas.",
    "No pulses por impulso. Lee bien, que una respuesta rápida mal dada corta más que tijera sin afilar.",
    "Esto puede servir para enseñar consejos reales de la tienda sin parecer clase aburrida.",
    "Buen sitio para meter preguntas nuevas con el tiempo: cortes, cuidados, productos y cultura de la casa."
  ],
  tienda:[
    "La tienda es la vitrina. Aquí los puntos tienen que oler a recompensa buena, no a saldo sin control.",
    "Un descuento bien puesto vale más que veinte premios confusos. Claro, bonito y fácil de canjear.",
    "Los cosméticos deberían apetecer antes de desbloquearlos. Silueta, misterio y premio: ahí está el pique.",
    "Consejo de rasta: no llenes esto de texto. Que se vea limpio, como escaparate recién montado."
  ],
  comunidad:[
    "Comunidad es la plaza del pueblo digital: tablón para avisos, foro para hablar y actualidad para leer algo con sentido.",
    "Aquí no hace falta gritar. Buen comentario, buen like y buen debate. Flow de barrio, no gallinero.",
    "Si alguien participa en un hilo, debería poder volver fácil desde su perfil. La conversación no se abandona en mitad del camino.",
    "Para animarse: un poco de reggae, una noticia curiosa y a comentar con respeto."
  ],
  noticias:[
    "Actualidad debe parecer revista, no teletexto. Pocas tarjetas buenas, categorías claras y cero ruido pesado.",
    "Curiosidades, rural, comer, sitios, estilo y negocios: ese es el mapa. Política densa, a remar lejos.",
    "Cada noticia puede abrir debate dentro de la app y también mandar a la fuente original.",
    "Si sale un sitio bonito o un bar con buena pinta, guárdalo. Eso también es comunidad."
  ],
  perfil:[
    "Perfil es tu guarida: avatar, nivel, recompensas, logros y tu rastro dentro de la app.",
    "El editor tiene que ser visual. Ver el peinado antes de elegirlo, como creador de personaje de videojuego.",
    "Los puntos funcionan mejor como progreso. Subes nivel, desbloqueas siluetas y el avatar va cogiendo personalidad.",
    "Guarda el look cuando te guste. No queremos que el rasta salga al foro con la gorra atravesada, mi hermano."
  ],
  foro:[
    "El foro es para conversaciones con sustancia: preguntas, ideas, votaciones y temas de la comunidad.",
    "Premia calidad, no spam. Un buen comentario vale más que diez mensajes escritos con el peine en la boca.",
    "Las encuestas pueden servir para elegir eventos, peinados, promos o ideas de la tienda.",
    "Si el hilo se mueve, que vuelva arriba. Así la conversación respira."
  ],
  feed:[
    "El tablón es la voz oficial: novedades, promos, avisos y cosas importantes de la tienda.",
    "El cliente lee y reacciona; staff y admin publican. Ordenado, limpio y sin convertirlo en chat loco.",
    "Un aviso bien puesto evita veinte preguntas repetidas. Eso es magia sin IA, mi pana.",
    "Los posts importantes deberían poder fijarse arriba como cartel de barbería."
  ]
};

const RASTA_GENERAL_TIPS=[
  "Pulsa Activar ayuda y toca cualquier botón para saber qué hace sin ejecutar la acción.",
  "Los puntos se ganan poco a poco: juegos, participación y actividad real en la app.",
  "En Perfil puedes ajustar tu avatar, tu privacidad y cómo apareces en rankings.",
  "Comunidad reúne tablón, foro, actualidad y música para no perderse entre pestañas.",
  "En Arcade puedes repetir partidas para mejorar récord, aunque los puntos diarios tienen límite.",
  "Top 10 enseña marcas por juego; Top general resume actividad global de clientes.",
  "Si una sección no queda clara, abre el modo ayuda y toca justo esa zona.",
  "La tienda tiene más sentido cuando los puntos se convierten en premios visibles.",
  "En Citas puedes elegir varios tratamientos y ver tiempo y precio aproximado.",
  "Gestión es la zona interna para caja, citas, clientes, stock y permisos.",
  "El modo incógnito oculta nombre y avatar público, pero mantiene tu personalización privada.",
  "Las noticias funcionan mejor cuando se leen rápido y se puede debatir sin salir de la app.",
  "El perfil público debe mostrar lo justo: avatar, nombre, puntos y actividad sin datos personales.",
  "El ranking semanal sirve para picarse esta semana; el histórico guarda las mejores marcas.",
  "Si el menú parece cargado, entra por Gestión: ahí está ordenado lo interno.",
  "Cuando termines una cita, márcala como realizada para que luego cuente en historial y facturación.",
  "Los juegos deben divertir y motivar, no regalar puntos sin control.",
  "Una app útil se entiende tocando: reserva, juega, lee, participa y canjea.",
  "El avatar debe verse igual en Perfil, rankings, comunidad y clientes.",
  "Música es una biblioteca rápida para descubrir reggae, rap clásico, ska y rock sin ruido comercial.",
  "El tablón es para avisos oficiales; el foro es para conversar.",
  "Si una noticia merece conversación, abre debate y deja un comentario útil.",
  "Los premios de tienda deben tener valor real para que los puntos importen.",
  "El botón de Sonido activa música suave; con doble toque puedes cambiar el tema.",
  "Las citas pendientes necesitan respuesta: confirmar, proponer hora o cancelar.",
  "El resumen de Gestión muestra lo importante sin entrar en cada pestaña.",
  "La comunidad funciona mejor si cada acción tiene sentido: like, comentario, debate o tema.",
  "El cliente sólo debería ver su parte; admin y staff ven herramientas de trabajo.",
  "Una pantalla limpia vale más que diez textos largos.",
  "Los botones importantes deben quedar siempre visibles en móvil."
];

const RASTA_RARE_CULTURE_TIPS=[
  "Tip musical: Morodo encaja muy bien para una sesión tranquila con ritmo reggae.",
  "Tip musical: Kase.O es buena puerta de entrada para rap español con letra cuidada.",
  "Tip musical: Pure Negga funciona bien para ambiente suave y melódico.",
  "Tip musical: Bob Marley es base obligatoria si alguien quiere empezar con reggae clásico.",
  "Tip musical: Ska-P mete energía para quienes prefieren ska con más caña.",
  "Tip musical: Nirvana aporta variedad rock sin perder una vibra clásica.",
  "Tip musical: Rapsusklei encaja en tardes tranquilas y letras con más fondo.",
  "Tip musical: Violadores del Verso tiene sentido aquí por cultura urbana y toque zaragozano.",
  "Tip musical: Cultura Profética va perfecto para una sección más elegante y relajada.",
  "Tip musical: Fyahbwoy tiene más energía para entrar al Arcade con ritmo.",
  "Tip de comunidad: un buen comentario aporta una idea, una pregunta o una experiencia.",
  "Tip de noticias: mejor pocas noticias buenas que mucho contenido de relleno.",
  "Tip de juegos: si ya cobraste puntos hoy, aún puedes jugar para mejorar récord.",
  "Tip de perfil: cuanto más reconocible sea el avatar, más vivos se sienten los rankings.",
  "Tip de tienda: los canjes deberían ser claros, deseables y fáciles de entender.",
  "Tip de reservas: varios tratamientos juntos deben sumar precio y duración automáticamente.",
  "Tip de gestión: staff puede trabajar; admin puede tocar permisos y ajustes.",
  "Tip de privacidad: incógnito no borra al usuario, sólo oculta cómo se muestra al público.",
  "Tip de rankings: el top semanal mantiene movimiento; el histórico da prestigio.",
  "Tip de sonido: música suave mejor que melodías chillones en móvil.",
  "Tip de diseño: si algo tapa un botón en Android, hay que darle más margen inferior.",
  "Tip de citas: una cita sin estado claro genera confusión; pendiente, confirmada o cancelada.",
  "Tip de facturación: primero control interno; luego ya se puede hacer más legal/formal.",
  "Tip de admin: Usuarios es permisos; Clientes es historial y ficha comercial.",
  "Tip de foro: temas cortos y claros consiguen más respuestas.",
  "Tip de premios: personalización del avatar puede ser una recompensa muy buena.",
  "Tip de actualidad: el formato tipo shorts funciona mejor si la tarjeta respira.",
  "Tip de música: los enlaces a búsquedas oficiales evitan links rotos al principio.",
  "Tip de app: menos texto, más iconos claros y explicaciones bajo demanda.",
  "Tip de Rasta: el modo ayuda debe explicar, no molestar."
];

const RASTA_DAILY_FUN_TIPS=[
  "Hoy puedes probar una partida, mirar una noticia y revisar si tu avatar sigue como quieres.",
  "Una app clara se entiende en pocos toques: reserva, juega, participa y canjea.",
  "Actualidad funciona mejor con titulares cortos, imagen clara y resumen útil.",
  "El Arcade tiene que picar sin regalar puntos infinitos: récord sí, abuso no.",
  "Una buena pantalla de inicio enseña rápido qué se puede hacer dentro.",
  "Los clientes deberían reconocer su avatar igual en Perfil, Comunidad y rankings.",
  "Si algo aparece raro en móvil, se corrige en diseño antes de seguir acumulando funciones.",
  "Los mensajes del asistente deben ayudar, no molestar ni tapar botones importantes.",
  "La tienda gana valor cuando los puntos sirven para cosas visibles y deseables.",
  "El perfil público debe enseñar lo justo: avatar, nombre, puntos y actividad sin datos privados.",
  "Hoy toca revisar si Gestión resume bien citas, caja y clientes.",
  "Un ranking bueno da ganas de volver sin hacer trampas con puntos.",
  "Una cita bien creada debe enseñar fecha, hora, tratamientos, duración y precio.",
  "La música de fondo debe acompañar, no competir con la app.",
  "La comunidad necesita ritmo: novedades, juego, conversación y algún premio.",
  "Si el usuario no sabe qué tocar, el modo ayuda tiene que salvarlo.",
  "El mejor botón es el que se entiende antes de pulsarlo.",
  "Un cliente vuelve más si siente que tiene perfil, puntos y progreso.",
  "Los avisos oficiales van al tablón; las dudas y debates van al foro.",
  "Hoy puede ser buen día para descubrir un artista nuevo en Música.",
  "Un diseño moderno no es llenar de efectos, es que todo fluya mejor.",
  "Si algo se repite demasiado, hay que convertirlo en rotación diaria.",
  "La app debería sentirse viva sin parecer una feria de luces.",
  "Un admin necesita ver rápido qué citas requieren acción.",
  "Un staff no debería tener que tocar permisos para hacer su trabajo.",
  "El cliente no debe ver paneles internos ni información de gestión.",
  "Las recompensas pequeñas mantienen movimiento si están bien equilibradas.",
  "El Gacha tiene sentido si es divertido, limitado y no rompe la economía.",
  "Los tops por juego motivan más cuando cada juego tiene identidad propia.",
  "Una ficha de cliente debe servir para recordar historial, no para cambiar roles."
];



function rastaHash(str=""){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}

function getDailyRastaTip(key){
  const pool=[...RASTA_RARE_CULTURE_TIPS,...RASTA_DAILY_FUN_TIPS,...RASTA_GENERAL_TIPS].filter(Boolean);
  if(!pool.length)return "";
  const day=TODAY_KEY();
  const storageKey=`rasta_daily_fun_v2_${key}_${day}`;
  try{
    const saved=localStorage.getItem(storageKey);
    if(saved && pool.includes(saved))return saved;
    const index=rastaHash(`${day}_${key}_${pool.length}`)%pool.length;
    const tip=pool[index]||pool[0]||"";
    localStorage.setItem(storageKey,tip);
    return tip;
  }catch{
    const index=rastaHash(`${TODAY_KEY()}_${key}`)%pool.length;
    return pool[index]||pool[0]||"";
  }
}

const RASTA_RARE_CHANCE=1/42;

function pickRastaUnique(pool,storageKey,recentLimit=18){
  const list=(pool||[]).filter(Boolean);
  if(!list.length)return "";
  try{
    const raw=localStorage.getItem(storageKey);
    const recent=raw?JSON.parse(raw):[];
    let available=list.filter(t=>!recent.includes(t));
    if(!available.length)available=list;
    const picked=available[Math.floor(Math.random()*available.length)];
    const next=[picked,...recent.filter(t=>t!==picked)].slice(0,Math.min(recentLimit,Math.max(1,list.length-1)));
    localStorage.setItem(storageKey,JSON.stringify(next));
    return picked;
  }catch{
    return list[Math.floor(Math.random()*list.length)];
  }
}

function helperPageKey(page){
  if(HELP_TIPS[page]) return page;
  if(page==="dashboard")return "dashboard";
  if(page==="arcade"||page==="juegos"||page==="tops")return "arcade";
  if(page==="tienda")return "tienda";
  if(page==="perfil")return "perfil";
  if(page==="foro")return "foro";
  if(page==="feed")return "feed";
  if(page==="noticias")return "noticias";
  if(page==="comunidad")return "comunidad";
  return "dashboard";
}
function helperMood(page){
  if(page==="dashboard")return "welcome";
  if(page==="arcade"||page==="tops"||String(page).startsWith("game_"))return "arcade";
  if(page==="noticias"||page==="comunidad"||page==="feed"||page==="foro")return "noticias";
  if(page==="perfil")return "success";
  return "idle";
}
function helperTitle(page){
  if(page==="game_stitch")return "Rasta al gancho";
  if(page==="game_runner")return "Rasta Runner te avisa";
  if(page==="game_jump")return "Salta con flow";
  if(page==="game_gacha")return "La máquina del rasta";
  if(page==="game_memoria")return "Memoria con calma";
  if(page==="game_sopa")return "Sopa del día";
  if(page==="game_trivia")return "Trivia con estilo";
  if(page==="arcade"||page==="juegos")return "Rasta Arcade";
  if(page==="tienda")return "Rasta en tienda";
  if(page==="perfil")return "Tu estilo, mi pana";
  if(page==="comunidad"||page==="foro"||page==="feed")return "Rasta comunidad";
  if(page==="noticias")return "Rasta magazine";
  return "Rasta al habla";
}

function rastaPageHelpIntro(page){
  const key=helperPageKey(page);
  const base={
    dashboard:"Estás en Inicio. Aquí se ve el resumen principal: citas, clientes, puntos, próximas reservas y accesos rápidos.",
    arcade:"Estás en Arcade. Aquí juegas, mejoras récords y entras a los tops. Los puntos reales tienen límite diario.",
    juegos:"Estás en Arcade. Pulsa un juego para jugar o Top 10 para ver clasificaciones.",
    tops:"Estás en Tops. Aquí se ven rankings de juegos y estadísticas generales de clientes.",
    tienda:"Estás en Tienda. Aquí se canjean puntos por premios, productos, bonos o personalizaciones.",
    comunidad:"Estás en Comunidad. Aquí están tablón, foro y actualidad.",
    feed:"Estás en Tablón. Sirve para anuncios oficiales, promociones y novedades de la tienda.",
    foro:"Estás en Foro. Aquí los usuarios pueden abrir temas, comentar y debatir.",
    noticias:"Estás en Actualidad. Desliza noticias, abre debate, mira fuentes o enlaces de YouTube.",
    citas:"Estás en Citas. Aquí se piden, confirman o cancelan reservas.",
    clientes:"Estás en Clientes. Aquí se revisa información de clientes y actividad.",
    usuarios:"Estás en Usuarios. Aquí el admin gestiona perfiles, roles y datos básicos.",
    perfil:"Estás en Perfil. Aquí editas avatar, privacidad, nombre y opciones de cuenta.",
    inventario:"Estás en Stock. Aquí se revisa inventario y productos.",
    caja:"Estás en Caja. Aquí se revisan ingresos, ventas y actividad económica.",
    ranking:"Estás en Ranking. Aquí se comparan puntos y progreso entre clientes."
  };
  return base[key]||HELP_TEXTS[key]||"Pulsa una zona de la app y te explicaré para qué sirve.";
}

function rastaElementHelp(target,page){
  const el=target?.closest?.("button,a,input,textarea,select,[role='button'],.ch,.bp,.studio-panel,.card")||target;
  if(!el)return rastaPageHelpIntro(page);
  const tag=String(el.tagName||"").toLowerCase();
  const raw=[
    el.getAttribute?.("aria-label"),
    el.getAttribute?.("title"),
    el.getAttribute?.("placeholder"),
    el.textContent
  ].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
  const t=raw.toLowerCase();

  if(tag==="input"){
    const type=(el.getAttribute("type")||"").toLowerCase();
    if(type==="date")return "Esto sirve para elegir la fecha. Toca el calendario y selecciona el día que quieres.";
    if(type==="time")return "Esto sirve para elegir la hora. Cambia la hora y la app la usará para la cita o el registro.";
    if(type==="password")return "Aquí se escribe la contraseña. No se muestra en pantalla por seguridad.";
    if(type==="email")return "Aquí se escribe el correo de acceso o de contacto.";
    return "Este campo sirve para escribir información. Toca dentro, escribe y después guarda o confirma.";
  }
  if(tag==="textarea")return "Este cuadro es para escribir un mensaje, nota o comentario más largo.";
  if(tag==="select")return "Este desplegable sirve para elegir una opción de la lista.";

  if(t.includes("sonido")||t.includes("silenciar"))return "Activa o silencia la música y los efectos. Si haces doble toque en Sonido, cambia el tema musical.";
  if(t.includes("top 10"))return "Top 10 abre los rankings de minijuegos: semanal e histórico por cada juego.";
  if(t.includes("top general"))return "Top general muestra estadísticas globales de clientes: puntos, juegos, tienda y comunidad.";
  if(t.includes("ver top")||t.includes("abrir top"))return "Este botón abre la página de rankings para ver los mejores jugadores y estadísticas.";
  if(t.includes("jugar ahora")||t==="jugar"||t.includes("▶ jugar")||t.includes("rejugar"))return "Abre el juego seleccionado. Puedes repetir para mejorar récord, aunque los puntos sólo se cobran una vez al día.";
  if(t.includes("gacha"))return "Gacha Barber es una máquina de tiradas con límite diario. Sirve para premios, suerte y recompensas controladas.";
  if(t.includes("guardar récord")||t.includes("guardar record"))return "Guarda tu puntuación para que aparezca en los rankings. Si ya cobraste hoy, sólo mejora la marca.";
  if(t.includes("nueva")||t.includes("+ nueva")||t.includes("nueva cita"))return "Crea una cita nueva. Puedes elegir varios tratamientos y la app suma duración y precio.";
  if(t.includes("confirmar"))return "Confirma esta cita. Pasará de pendiente a confirmada para que el cliente sepa que queda aceptada.";
  if(t.includes("cancelar"))return "Cancela esta acción o cita. Úsalo si no se puede aceptar o si quieres cerrar sin guardar.";
  if(t.includes("realizada"))return "Marca la cita como realizada. Esto servirá más adelante para historial, facturación y estadísticas.";
  if(t.includes("proponer"))return "Permite sugerir otra fecha u hora al cliente en vez de aceptar la reserva tal cual.";
  if(t.includes("publicar"))return "Publica el texto en el tablón, foro o comunidad según la sección donde estés.";
  if(t.includes("responder"))return "Añade una respuesta al tema o conversación actual.";
  if(t.includes("comentar")||t.includes("comentario"))return "Abre o añade comentarios. Participar en comunidad puede servir para puntos y actividad.";
  if(t.includes("me gusta")||t.includes("like")||t.includes("👍"))return "Marca que te gusta esta publicación o noticia. Sirve para participación y estadísticas.";
  if(t.includes("youtube"))return "Abre una búsqueda o enlace de YouTube relacionado, normalmente para música o vídeos oficiales.";
  if(t.includes("fuente")||t.includes("leer fuente"))return "Abre la fuente original de la noticia fuera de la app.";
  if(t.includes("abrir debate"))return "Abre la conversación de esa noticia para poder leer o comentar.";
  if(t.includes("actualizar"))return "Actualiza los datos de esta sección para traer contenido o rankings más recientes.";
  if(t.includes("perfil"))return "Entra en tu perfil para editar avatar, privacidad, nombre y opciones de cuenta.";
  if(t.includes("comunidad"))return "Abre Comunidad: tablón, foro y actualidad.";
  if(t.includes("inicio"))return "Vuelve al inicio, donde se ve el resumen general de la app.";
  if(t.includes("citas"))return "Abre la sección de citas para reservar o gestionar reservas.";
  if(t.includes("clientes"))return "Abre el panel de clientes, visible para admin o staff.";
  if(t.includes("usuarios"))return "Abre el panel de usuarios, normalmente sólo para admin.";
  if(t.includes("tienda"))return "Abre la tienda de puntos, premios y canjes.";
  if(t.includes("arcade"))return "Abre los juegos y rankings.";
  if(t.includes("guardar"))return "Guarda los cambios que has hecho.";
  if(t.includes("editar"))return "Permite modificar esta información.";
  if(t.includes("eliminar")||t.includes("borrar"))return "Borra este elemento. Úsalo con cuidado.";
  if(t.includes("privacidad")||t.includes("incógnito")||t.includes("incognito"))return "Controla si tu perfil se muestra al público o aparece oculto como xxxxxx con silueta negra.";

  if(page==="arcade"||page==="juegos")return "Esto pertenece al Arcade. Sirve para jugar, abrir tops o revisar tus récords.";
  if(page==="comunidad")return "Esto pertenece a Comunidad. Aquí puedes leer, participar o cambiar entre Tablón, Foro y Actualidad.";
  if(page==="citas")return "Esto pertenece a Citas. Sirve para crear, revisar o gestionar reservas.";
  if(page==="perfil")return "Esto pertenece a Perfil. Sirve para personalizar tu cuenta o tu avatar.";
  return rastaPageHelpIntro(page);
}

function HelperMascot({page}){
  const key=helperPageKey(page);
  const baseTips=HELP_TIPS[key]||HELP_TIPS.dashboard;
  const dailyTip=getDailyRastaTip(key);
  const tips=Array.from(new Set([
    dailyTip,
    ...baseTips,
    ...RASTA_GENERAL_TIPS,
    ...RASTA_DAILY_FUN_TIPS,
    ...RASTA_RARE_CULTURE_TIPS
  ].filter(Boolean)));
  const [open,setOpen]=useState(false);
  const [helpMode,setHelpMode]=useState(false);
  const [tipIndex,setTipIndex]=useState(0);
  const [rareTip,setRareTip]=useState(null);
  const [contextTip,setContextTip]=useState(null);
  const dragRef=useRef({down:false,moved:false,startX:0,startY:0,baseX:0,baseY:0});
  const [pos,setPos]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("rasta_helper_pos")||"null");
      if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)) return saved;
    }catch{}
    if(typeof window==="undefined") return {x:360,y:620};
    return {x:Math.max(12,Math.min(window.innerWidth-82,window.innerWidth-92)),y:Math.max(90,window.innerHeight-170)};
  });

  const mood=helperMood(page);
  const helpIntro=`Modo ayuda activado. Pulsa cualquier botón, campo o tarjeta de esta pantalla y te diré para qué sirve. Mientras esté activado, ese toque sólo explica: no ejecuta la acción.`;
  const shownTip=helpMode
    ? (contextTip||helpIntro)
    : (rareTip||tips[tipIndex%Math.max(1,tips.length)]||"");
  const isRight=typeof window!=="undefined"?pos.x>(window.innerWidth/2):true;

  useEffect(()=>{
    setTipIndex(0);
    setRareTip(null);
    setContextTip(null);
  },[page]);

  useEffect(()=>{
    const onResize=()=>{
      if(typeof window==="undefined")return;
      setPos(p=>{
        const next={x:Math.max(8,Math.min(window.innerWidth-78,p.x)),y:Math.max(72,Math.min(window.innerHeight-94,p.y))};
        try{localStorage.setItem("rasta_helper_pos",JSON.stringify(next));}catch{}
        return next;
      });
    };
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[]);

  useEffect(()=>{
    if(!helpMode)return;
    const onHelpClick=(e)=>{
      if(e.target?.closest?.("[data-rasta-helper='1']"))return;
      const explainTarget=e.target?.closest?.("button,a,input,textarea,select,[role='button'],.ch,.bp,.studio-panel,.card");
      if(!explainTarget)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      setContextTip(rastaElementHelp(explainTarget,page));
      setRareTip(null);
      setOpen(true);
      SFX.click();
    };
    document.addEventListener("click",onHelpClick,true);
    document.addEventListener("pointerup",onHelpClick,true);
    return()=>{
      document.removeEventListener("click",onHelpClick,true);
      document.removeEventListener("pointerup",onHelpClick,true);
    };
  },[helpMode,page]);

  function goTip(dir){
    setRareTip(null);
    setContextTip(null);
    setTipIndex(i=>{
      const len=Math.max(1,tips.length);
      return (i+dir+len)%len;
    });
  }

  function rareToday(e){
    e?.stopPropagation?.();
    setHelpMode(false);
    setContextTip(null);
    const rare=pickRastaUnique([...RASTA_RARE_CULTURE_TIPS,...RASTA_DAILY_FUN_TIPS,...RASTA_GENERAL_TIPS],`rasta_manual_tip_${TODAY_KEY()}`,45);
    setRareTip(rare);
  }

  function toggleHelp(e){
    e?.stopPropagation?.();
    setRareTip(null);
    setContextTip(null);
    setHelpMode(v=>!v);
    setOpen(true);
    SFX.tab();
  }

  function pointerDown(e){
    dragRef.current={down:true,moved:false,startX:e.clientX,startY:e.clientY,baseX:pos.x,baseY:pos.y};
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
  }

  function pointerMove(e){
    const d=dragRef.current;
    if(!d.down)return;
    const dx=e.clientX-d.startX;
    const dy=e.clientY-d.startY;
    if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;
    if(typeof window==="undefined")return;
    const next={
      x:Math.max(8,Math.min(window.innerWidth-78,d.baseX+dx)),
      y:Math.max(72,Math.min(window.innerHeight-94,d.baseY+dy))
    };
    setPos(next);
  }

  function pointerUp(e){
    const d=dragRef.current;
    dragRef.current={...d,down:false};
    try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    try{localStorage.setItem("rasta_helper_pos",JSON.stringify(pos));}catch{}
    if(!d.moved){
      SFX.click();
      setOpen(v=>!v);
    }
  }

  const closeBubble=(e)=>{
    e.stopPropagation();
    setOpen(false);
  };

  const bubbleSideStyle=isRight
    ? {right:78,bottom:8}
    : {left:78,bottom:8};

  const arrowStyle=isRight
    ? {right:-10,bottom:18,borderRight:`2px solid ${T.g200}`,borderBottom:`2px solid ${T.g200}`}
    : {left:-10,bottom:18,borderLeft:`2px solid ${T.g200}`,borderTop:`2px solid ${T.g200}`};

  return (
    <div
      data-rasta-helper="1"
      style={{
        position:"fixed",
        left:pos.x,
        top:pos.y,
        zIndex:9996,
        pointerEvents:"none",
        touchAction:"none"
      }}
    >
      {helpMode&&(
        <div style={{
          position:"fixed",
          left:12,
          right:12,
          top:64,
          zIndex:9995,
          pointerEvents:"none",
          display:"flex",
          justifyContent:"center"
        }}>
          <div style={{
            background:"rgba(36,17,10,.88)",
            color:T.white,
            border:`1px solid ${T.gold}`,
            borderRadius:999,
            padding:"7px 12px",
            fontSize:".76rem",
            fontWeight:950,
            boxShadow:"0 8px 18px rgba(0,0,0,.25)"
          }}>🧭 Modo ayuda activo · toca algo para explicarlo</div>
        </div>
      )}
      <div
        style={{
          position:"relative",
          display:"inline-flex",
          alignItems:"flex-end",
          gap:10,
          pointerEvents:"auto",
          touchAction:"none"
        }}
      >
        {open&&(
          <div style={{
            position:"absolute",
            ...bubbleSideStyle,
            width:"min(318px, calc(100vw - 112px))",
            maxWidth:318,
            background:helpMode?"linear-gradient(180deg,#FFF6CF,#F3E0A8)":"linear-gradient(180deg,#FFF8E6,#FFF1C8)",
            border:`2px solid ${helpMode?T.gold:T.g200}`,
            borderRadius:22,
            padding:"12px 14px",
            boxShadow:"0 14px 28px rgba(20,8,4,.22)",
            animation:"bubblePop .22s ease",
            zIndex:3
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:4}}>
              <div style={{fontWeight:950,color:T.g800,fontSize:".88rem"}}>{helpMode?"Rasta modo ayuda":helperTitle(page)}</div>
              <button onClick={closeBubble} style={{border:"none",background:"transparent",color:T.textSub,fontWeight:900,cursor:"pointer",fontSize:"1rem",padding:0}}>×</button>
            </div>
            <div style={{fontSize:".66rem",fontWeight:900,color:helpMode?T.g700:T.orange,letterSpacing:".04em",textTransform:"uppercase",marginBottom:6}}>
              {helpMode?"ayuda interactiva":rareTip?"tip diario":"guía rápida de la app"}
            </div>
            <div style={{fontSize:".84rem",fontWeight:800,color:T.text,lineHeight:1.45,minHeight:70}}>{shownTip}</div>

            {!helpMode&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,gap:8}}>
                <button onClick={(e)=>{e.stopPropagation();goTip(-1);}} style={{border:`1px solid ${T.g200}`,background:"#fff7e2",color:T.g800,borderRadius:999,padding:"6px 10px",fontWeight:950,cursor:"pointer"}}>← Atrás</button>
                <div style={{fontSize:".72rem",fontWeight:900,color:T.textSub,whiteSpace:"nowrap"}}>{rareTip?"tip diario":"guía"}</div>
                <button onClick={(e)=>{e.stopPropagation();goTip(1);}} style={{border:`1px solid ${T.g200}`,background:"#fff7e2",color:T.g800,borderRadius:999,padding:"6px 10px",fontWeight:950,cursor:"pointer"}}>Siguiente →</button>
              </div>
            )}

            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,gap:8,flexWrap:"wrap"}}>
              <button onClick={toggleHelp} style={{border:"none",background:helpMode?"linear-gradient(180deg,#4F602D,#26331D)":"linear-gradient(180deg,#D4AF37,#A8662B)",color:helpMode?T.white:T.g900,borderRadius:999,padding:"7px 11px",fontWeight:950,cursor:"pointer",boxShadow:"0 6px 12px rgba(20,8,4,.16)"}}>
                {helpMode?"✅ Ayuda ON":"🧭 Activar ayuda"}
              </button>
              {!helpMode&&<button onClick={rareToday} style={{border:"none",background:"linear-gradient(180deg,#24110A,#6E3518)",color:T.white,borderRadius:999,padding:"7px 11px",fontWeight:950,cursor:"pointer",boxShadow:"0 6px 12px rgba(20,8,4,.16)"}}>💡 Tip diario</button>}
              {helpMode&&<button onClick={(e)=>{e.stopPropagation();setContextTip(rastaPageHelpIntro(page));}} style={{border:`1px solid ${T.g200}`,background:"#fff7e2",color:T.g800,borderRadius:999,padding:"7px 11px",fontWeight:950,cursor:"pointer"}}>Esta página</button>}
            </div>

            <div style={{
              position:"absolute",
              width:18,
              height:18,
              background:helpMode?"linear-gradient(180deg,#FFF6CF,#F3E0A8)":"linear-gradient(180deg,#FFF8E6,#FFF1C8)",
              transform:"rotate(-45deg)",
              ...arrowStyle
            }}/>
          </div>
        )}

        <button
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={()=>{dragRef.current.down=false;}}
          aria-label={open?"Ocultar consejos del rasta":"Abrir consejos del rasta"}
          title="Toca para abrir · mantén y arrastra para mover"
          style={{
            border:"none",
            background:"transparent",
            cursor:"grab",
            padding:0,
            display:"flex",
            alignItems:"center",
            gap:10,
            WebkitTapHighlightColor:"transparent",
            touchAction:"none"
          }}
        >
          <div style={{position:"relative",animation:"helperBob 2.4s ease-in-out infinite"}}>
            <LoginHelperAvatar size={66} speaking={open} mood={helpMode?"success":mood}/>
            <div style={{
              position:"absolute",
              right:-2,
              bottom:2,
              minWidth:24,
              height:24,
              borderRadius:999,
              background:helpMode?"linear-gradient(180deg,#4F602D,#26331D)":open?"linear-gradient(180deg,#E15B44,#A72822)":"linear-gradient(180deg,#F7D76D,#D99E22)",
              border:`2px solid ${T.paper}`,
              color:helpMode||open?T.white:T.g800,
              display:"grid",
              placeItems:"center",
              fontWeight:1000,
              fontSize:".86rem",
              boxShadow:"0 6px 12px rgba(20,8,4,.18)"
            }}>{helpMode?"i":open?"×":"?"}</div>
          </div>
        </button>
      </div>
    </div>
  );
}

const PAGE_THEMES={
  dashboard:{mark:'"✂"',accent:'#B99A45',shell:'linear-gradient(180deg,rgba(216,190,135,.06),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 56%,#2E1C10)',header:'linear-gradient(135deg,#130B06,#2A1B0F 58%,#4B301B)',nav:'#6B4524',shineA:'rgba(216,190,135,.16)',shineB:'rgba(255,238,190,.10)',glowA:'rgba(185,154,69,.16)',glowB:'rgba(79,96,45,.10)'},
  citas:{mark:'"☕"',accent:'#A8662B',shell:'linear-gradient(180deg,rgba(168,102,43,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 54%,#352012)',header:'linear-gradient(135deg,#130B06,#3A2414 58%,#6B4524)',nav:'#6B4524',shineA:'rgba(230,190,125,.15)',shineB:'rgba(255,230,170,.10)',glowA:'rgba(168,102,43,.18)',glowB:'rgba(185,154,69,.11)'},
  tienda:{mark:'"◆"',accent:'#B99A45',shell:'linear-gradient(180deg,rgba(185,154,69,.08),rgba(50,32,19,.018)),linear-gradient(160deg,#100704,#21140C 48%,#3A2A14)',header:'linear-gradient(135deg,#21140C,#4B301B 58%,#6B4D1F)',nav:'#725021',shineA:'rgba(226,196,125,.18)',shineB:'rgba(255,235,170,.11)',glowA:'rgba(185,154,69,.20)',glowB:'rgba(124,106,53,.12)'},
  juegos:{mark:'"★"',accent:'#7E6A2B',shell:'linear-gradient(180deg,rgba(79,96,45,.075),rgba(185,154,69,.025)),linear-gradient(160deg,#101008,#1C2112 52%,#332B13)',header:'linear-gradient(135deg,#101008,#26331D 56%,#4F602D)',nav:'#4B562A',shineA:'rgba(184,190,110,.17)',shineB:'rgba(255,238,170,.10)',glowA:'rgba(79,96,45,.22)',glowB:'rgba(185,154,69,.14)'},
  retos:{mark:'"⚑"',accent:'#7A241B',shell:'linear-gradient(180deg,rgba(122,36,27,.07),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 48%,#351510)',header:'linear-gradient(135deg,#130B06,#42130F 58%,#7A241B)',nav:'#672018',shineA:'rgba(216,150,110,.15)',shineB:'rgba(255,230,170,.09)',glowA:'rgba(122,36,27,.20)',glowB:'rgba(185,154,69,.10)'},
  ranking:{mark:'"♛"',accent:'#B99A45',shell:'linear-gradient(180deg,rgba(185,154,69,.09),rgba(232,211,162,.02)),linear-gradient(160deg,#120806,#21140C 50%,#30220F)',header:'linear-gradient(135deg,#130B06,#4B301B 58%,#B99A45)',nav:'#725021',shineA:'rgba(235,203,130,.20)',shineB:'rgba(255,243,200,.12)',glowA:'rgba(185,154,69,.24)',glowB:'rgba(122,36,27,.10)'},
  perfil:{mark:'"☻"',accent:'#A87945',shell:'linear-gradient(180deg,rgba(168,121,69,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 54%,#312012)',header:'linear-gradient(135deg,#130B06,#332013 56%,#8A5A2E)',nav:'#6B4524',shineA:'rgba(220,180,115,.16)',shineB:'rgba(255,236,185,.10)',glowA:'rgba(168,121,69,.20)',glowB:'rgba(79,96,45,.10)'},
  comunidad:{mark:'"☷"',accent:'#4F602D',shell:'linear-gradient(180deg,rgba(79,96,45,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#0F0D07,#1C2112 49%,#2D2411)',header:'linear-gradient(135deg,#111006,#26331D 58%,#4F602D)',nav:'#4B562A',shineA:'rgba(190,205,125,.16)',shineB:'rgba(255,235,176,.09)',glowA:'rgba(79,96,45,.22)',glowB:'rgba(185,154,69,.11)'},
  feed:{mark:'"☷"',accent:'#4F602D',shell:'linear-gradient(180deg,rgba(79,96,45,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#0F0D07,#1C2112 49%,#2D2411)',header:'linear-gradient(135deg,#111006,#26331D 58%,#4F602D)',nav:'#4B562A',shineA:'rgba(190,205,125,.16)',shineB:'rgba(255,235,176,.09)',glowA:'rgba(79,96,45,.22)',glowB:'rgba(185,154,69,.11)'},
  foro:{mark:'"✎"',accent:'#263F4D',shell:'linear-gradient(180deg,rgba(38,63,77,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#0A0D0E,#17252D 50%,#21140C)',header:'linear-gradient(135deg,#0A0D0E,#17252D 58%,#263F4D)',nav:'#263F4D',shineA:'rgba(155,190,200,.14)',shineB:'rgba(232,211,162,.09)',glowA:'rgba(38,63,77,.22)',glowB:'rgba(185,154,69,.10)'},
  noticias:{mark:'"☀"',accent:'#B99A45',shell:'linear-gradient(180deg,rgba(185,154,69,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 50%,#352816)',header:'linear-gradient(135deg,#130B06,#3A2A14 58%,#6B4D1F)',nav:'#6B4524',shineA:'rgba(235,203,130,.16)',shineB:'rgba(255,244,214,.10)',glowA:'rgba(185,154,69,.21)',glowB:'rgba(38,63,77,.10)'},
  galeria:{mark:'"▣"',accent:'#8A5A2E',shell:'linear-gradient(180deg,rgba(138,90,46,.075),rgba(216,190,135,.018)),linear-gradient(160deg,#120806,#21140C 52%,#392314)',header:'linear-gradient(135deg,#130B06,#332013 58%,#8A5A2E)',nav:'#6B4524',shineA:'rgba(220,180,115,.16)',shineB:'rgba(255,236,185,.10)',glowA:'rgba(138,90,46,.22)',glowB:'rgba(185,154,69,.10)'},
  admin:{mark:'"⚙"',accent:'#263F4D',shell:'linear-gradient(180deg,rgba(38,63,77,.065),rgba(216,190,135,.018)),linear-gradient(160deg,#0A0D0E,#17252D 50%,#21140C)',header:'linear-gradient(135deg,#0A0D0E,#17252D 58%,#263F4D)',nav:'#263F4D',shineA:'rgba(155,190,200,.14)',shineB:'rgba(232,211,162,.09)',glowA:'rgba(38,63,77,.20)',glowB:'rgba(185,154,69,.10)'}
};
function pageTheme(page,communityTab,role){
  const key=page==="comunidad"?(communityTab||"comunidad"):page;
  if(["clientes","inventario","caja","usuarios","gestion"].includes(key)) return PAGE_THEMES.admin;
  if(key==="tops") return PAGE_THEMES.ranking||PAGE_THEMES.juegos;
  if(key==="musica") return PAGE_THEMES.noticias||PAGE_THEMES.comunidad;
  return PAGE_THEMES[key]||PAGE_THEMES[page]||PAGE_THEMES.dashboard;
}
export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [communityTab,setCommunityTab]=useState("feed");
  const [toast,setToast]=useState({show:false,msg:""});
  const [ptsPopup,setPtsPopup]=useState({show:false,pts:0});
  const [musicOn,setMusicOn]=useState(false);
  const [checkingSession,setCheckingSession]=useState(true);
  const [helperPage,setHelperPage]=useState(null);
  const [topsInitial,setTopsInitial]=useState("games");

  useEffect(()=>{
    async function restoreSession(){
      if(!supabase){setCheckingSession(false);return;}
      const {data}=await supabase.auth.getSession();
      const sessionUser=data.session?.user;
      if(sessionUser?.email){
        let perfil=await getUserProfileByEmail(sessionUser.email);
        if(!perfil){
          perfil=await createUserProfile({nombre:sessionUser.user_metadata?.nombre||sessionUser.email.split("@")[0],email:sessionUser.email});
        }
        if(perfil) setUser(toAppUser(perfil));
      }
      setCheckingSession(false);
    }
    restoreSession();
  },[]);

  const showToast=useCallback(msg=>{setToast({show:true,msg});setTimeout(()=>setToast({show:false,msg:""}),3200);},[]);
  const showPoints=useCallback(pts=>{setPtsPopup({show:true,pts});setTimeout(()=>setPtsPopup({show:false,pts:0}),1800);},[]);
  function toggleMusic(){globalMuted=!globalMuted;if(globalMuted){stopMusic();stopGameMusic();setMusicOn(false);}else{startMusic();setMusicOn(true);}}
  function changeMusicTrack(){nextMusicTrack();SFX.tab();showToast(`Tema: ${REGGAE_LOFI_TRACKS[currentMusicTrack]?.name||"Lofi Rasta"}`);}
  const navTo=id=>{
    setHelperPage(null);
    const communityMap={feed:"feed",foro:"foro",noticias:"noticias",musica:"musica",comunidad:communityTab||"feed"};
    const target=communityMap[id]?"comunidad":id;
    if(communityMap[id]) setCommunityTab(communityMap[id]);
    target===page?SFX.tab():(target==="dashboard"?SFX.navBack():SFX.nav());
    setPage(target);
  };
  const logout=()=>{supabase?.auth.signOut();setUser(null);setPage("dashboard");};

  if(checkingSession)return <div style={{fontFamily:"sans-serif",minHeight:"100vh",display:"grid",placeItems:"center",background:T.g100}}><Spinner/></div>;
  if(!user)return (
    <>
      <Auth onLogin={u=>{setUser(u);setPage(normalizeRole(u.rol||u.role)===ROLES.CLIENT?"dashboard":"gestion");}} showToast={showToast}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  const role=normalizeRole(user.rol || user.role);
  const nav=NAV_CFG[role]||NAV_CFG.client;
  const grad=GRAD_ROLE[role]||GRAD_ROLE.client;
  const ap=(role!==ROLES.CLIENT && page==="dashboard")?"gestion":page;
  const theme=pageTheme(ap,communityTab,role);
  const currentUser={...user,rol:role};
  const sp={showToast,showPoints,user:currentUser,setUser};
  const isAdmin=role===ROLES.ADMIN || role===ROLES.STAFF;

  const pages={
    dashboard:role===ROLES.CLIENT?<ClientDashboard user={currentUser} onNavigate={navTo}/>:<GestionAdmin {...sp}/>,
    citas:<Citas {...sp}/>,clientes:<Clientes {...sp}/>,inventario:<Inventario {...sp}/>,
    gestion:<GestionAdmin {...sp}/>,caja:<Caja {...sp}/>,usuarios:<AdminUsuarios {...sp}/>,feed:<SocialFeed {...sp}/>,foro:<Foro {...sp}/>,
    noticias:<Noticias {...sp}/>,musica:<Comunidad {...sp} initialTab="musica"/>,comunidad:<Comunidad {...sp} initialTab={communityTab}/>,
    tienda:<Tienda {...sp}/>,juegos:<Juegos {...sp} setHelperPage={setHelperPage} onOpenTops={(tab)=>{setTopsInitial(tab||"games");navTo("tops");}}/>,tops:<GameTopsPage user={currentUser} initialTab={topsInitial} onBack={()=>navTo("juegos")} onPlay={()=>navTo("juegos")}/>,retos:<Retos {...sp}/>,
    ranking:<Ranking user={currentUser}/>,perfil:<Perfil {...sp} onLogout={logout}/>,
    galeria:<Galeria showToast={showToast} isAdmin={isAdmin}/>,
    reviews:<Reviews {...sp}/>,chat:<Chat user={currentUser} showToast={showToast}/>,
    cupones:<Cupones user={currentUser} showToast={showToast}/>,
  };

  return(
    <div className={`app-shell page-${ap} theme-${ap==="comunidad"?communityTab:ap}`} data-page={ap} data-community={communityTab} style={{fontFamily:"'Crimson Text',serif",background:theme.shell,minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:82,position:"relative",boxShadow:`0 0 0 1px rgba(232,211,162,.10),0 0 42px rgba(0,0,0,.42),0 0 36px ${theme.accent}22`,"--shineA":theme.shineA,"--shineB":theme.shineB,"--shineSpeed":"7.2s","--pageGlowA":theme.glowA,"--pageGlowB":theme.glowB,"--pageMark":theme.mark,"--pageMarkColor":`${theme.accent}12`,"--pageAccent":theme.accent}}>
      <style>{CSS}</style>
      <Particles/>
      <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
      <div style={{background:role===ROLES.CLIENT?theme.header:grad,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50,boxShadow:`0 4px 20px rgba(0,0,0,0.26), inset 0 -1px 0 ${theme.accent}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.white,textShadow:"0 4px 10px rgba(0,0,0,.35)"}}>✂️ {BRAND.name}</div>
          {role!==ROLES.CLIENT&&<span style={{background:"rgba(255,255,255,0.22)",color:T.white,borderRadius:50,padding:"2px 8px",fontSize:"0.68rem",fontWeight:800,textTransform:"uppercase"}}>{role}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="header-action-pro" onClick={toggleMusic} onDoubleClick={changeMusicTrack} title={musicOn?`Doble toque: cambiar tema (${REGGAE_LOFI_TRACKS[currentMusicTrack]?.name||"Lofi Rasta"})`:"Activar música"} style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 10px",cursor:"pointer",color:T.white,fontWeight:800,fontSize:"0.72rem"}}>{musicOn?"🔇 Silenciar":"🔊 Sonido"}</button>
          {role===ROLES.CLIENT&&<div style={{background:"rgba(255,255,255,0.2)",borderRadius:50,padding:"4px 12px",color:T.white,fontWeight:900,fontSize:"0.84rem"}}>{currentUser.puntos||0} pts</div>}
          <div className="header-action-pro" onClick={()=>navTo("perfil")} style={{cursor:"pointer",padding:2,background:"rgba(255,255,255,0.18)",borderRadius:"50%"}}>
            <Av av={currentUser.avatar} config={currentUser.avatarConfig} size={32}/>
          </div>
        </div>
      </div>
      <div key={`${ap}-${communityTab}`} className="page-content-pro" style={{padding:"18px 14px",position:"relative"}}>
        <div className="motion-strip" style={{background:`linear-gradient(90deg,transparent,${theme.accent}99,transparent)`,margin:"0 18px 16px",boxShadow:`0 0 18px ${theme.accent}33`,opacity:.78}}/>
        {pages[ap]||pages["dashboard"]}
        <HelperMascot page={helperPage || (ap==="comunidad"?communityTab:ap)}/>
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:theme.nav,borderTop:`2px solid ${theme.accent}`,display:"flex",justifyContent:"space-around",padding:"6px 2px 10px",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.18)"}}>
        {nav.map(n=>(
          <button className="nav-tab-pro" key={n.id} onClick={()=>navTo(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",minWidth:38}}>
            <div className="nav-icon-pro" style={{fontSize:"1.1rem",background:ap===n.id?theme.header:"transparent",borderRadius:10,padding:"4px 7px",transform:ap===n.id?"scale(1.18)":"scale(1)",transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:ap===n.id?`0 3px 12px ${theme.accent}44`:"none"}}>{n.icon}</div>
            <span style={{fontSize:"0.52rem",fontWeight:800,color:ap===n.id?"#F5E6C8":"#DEB887",transition:"color 0.2s"}}>{n.label}</span>
          </button>
        ))}
      </div>
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}
