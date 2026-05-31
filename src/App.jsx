import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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

async function createNotification(payload={}){
  try{
    if(!payload?.titulo)return null;
    return await dbPost("notificaciones",{
      usuario_id:payload.usuario_id?String(payload.usuario_id):null,
      rol_destino:payload.rol_destino||"admin",
      tipo:payload.tipo||"general",
      titulo:payload.titulo,
      mensaje:payload.mensaje||null,
      entidad_tipo:payload.entidad_tipo||null,
      entidad_id:payload.entidad_id?String(payload.entidad_id):null,
      leida:false,
      importante:Boolean(payload.importante)
    });
  }catch(e){console.warn("No se pudo crear notificación",e);return null;}
}
function notificationIcon(tipo="general"){
  const map={cita:"📅",cita_nueva:"📅",cita_cancelada:"❌",cita_propuesta:"🔁",cita_propuesta_aceptada:"✅",cita_propuesta_rechazada:"⚠️",mensaje:"📩",canje:"🎁",pedido:"🛍️",cobro:"💰",reporte:"🚩",moderacion:"🛡️",general:"🔔"};
  return map[tipo]||"🔔";
}

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
function isAdminUser(user){return normalizeRole(user?.rol||user?.role)===ROLES.ADMIN;}
function isStaffUser(user){return normalizeRole(user?.rol||user?.role)===ROLES.STAFF;}
function isInternalUser(user){const r=normalizeRole(user?.rol||user?.role);return r===ROLES.ADMIN||r===ROLES.STAFF;}
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
let masterVolume=0.7;
let backgroundAudio=null,backgroundAudioAvailable=true;
let backgroundTrackIndex=0,backgroundSourceTry=0;
const BACKGROUND_PLAYLIST=[
  {name:"Barbershop Arcade Dub",srcs:["/audio/barbershop-arcade-dub.mp3","/audio/barbershop-arcade-dub(1).mp3"]},
  {name:"Vinyl Arcade Skank",srcs:["/audio/Vinyl%20Arcade%20Skank.mp3","/audio/vinyl-arcade-skank.mp3"]},
  {name:"Neon Barbertron",srcs:["/audio/Neon%20Barbertron.mp3","/audio/neon-barbertron.mp3"]}
];
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
    const cleanVol=Math.min(vol*.55,0.045)*Math.max(0,Math.min(1.2,masterVolume));
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
function playUiSound(kind="tap"){
  if(globalMuted)return;
  const patterns={
    tap:[[520,.045,.026,0]],
    page:[[392,.06,.028,0],[523,.08,.022,.045],[659,.10,.018,.09]],
    back:[[392,.055,.026,0],[294,.08,.020,.05]],
    shop:[[659,.07,.024,0],[784,.08,.022,.055],[988,.09,.017,.11]],
    game:[[330,.055,.025,0],[494,.075,.022,.04],[660,.11,.018,.10]],
    social:[[440,.06,.024,0],[587,.07,.020,.05]],
    admin:[[220,.07,.022,0],[330,.08,.018,.06]],
    profile:[[523,.05,.022,0],[698,.07,.018,.06]],
    money:[[784,.055,.026,0],[988,.06,.024,.045],[1175,.08,.020,.09]],
    error:[[246,.12,.026,0],[196,.14,.020,.09]]
  };
  (patterns[kind]||patterns.tap).forEach(([f,d,v,delay])=>playTone(f,"sine",d,v,delay));
}
function navSoundKind(id){
  if(["dashboard"].includes(id))return "back";
  if(["tienda","cupones","caja"].includes(id))return "shop";
  if(["juegos","tops","retos","ranking"].includes(id))return "game";
  if(["feed","foro","comunidad","noticias","musica","buzon","chat","reviews"].includes(id))return "social";
  if(["gestion","clientes","inventario","usuarios","galeria"].includes(id))return "admin";
  if(id==="perfil")return "profile";
  return "page";
}
function playNavSound(id){playUiSound(navSoundKind(id));}
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

function getBackgroundTrack(){
  return BACKGROUND_PLAYLIST[backgroundTrackIndex%BACKGROUND_PLAYLIST.length]||BACKGROUND_PLAYLIST[0];
}
function getBackgroundName(){
  return getBackgroundTrack()?.name||"Rasta Cuts Dub";
}
function getBackgroundSrc(){
  const track=getBackgroundTrack();
  const srcs=track?.srcs||[];
  return srcs[backgroundSourceTry%Math.max(1,srcs.length)]||"/audio/barbershop-arcade-dub.mp3";
}
function resetBackgroundAudio(){
  try{
    if(backgroundAudio){
      backgroundAudio.pause();
      backgroundAudio.src="";
      backgroundAudio.load?.();
    }
  }catch(e){}
  backgroundAudio=null;
}
function createBackgroundAudio(){
  if(typeof Audio==="undefined")return null;
  const a=new Audio(getBackgroundSrc());
  a.loop=true;
  a.preload="auto";
  a.volume=Math.max(0,Math.min(1,masterVolume*0.42));
  return a;
}
function getBackgroundAudio(){
  if(typeof Audio==="undefined")return null;
  if(!backgroundAudio) backgroundAudio=createBackgroundAudio();
  return backgroundAudio;
}
function setBackgroundVolume(){
  const a=getBackgroundAudio();
  if(a)a.volume=Math.max(0,Math.min(1,masterVolume*0.42));
}
function stopGeneratedMusic(){
  if(musicInterval){clearInterval(musicInterval);musicInterval=null;}
}
function startGeneratedMusic(){
  stopGeneratedMusic();
  musicStep=0;
  setupMusicInterval();
  tickLofiTrack();
}
function startMusic(){
  if(musicPlaying)return;
  musicPlaying=true;
  stopGeneratedMusic();
  if(backgroundAudioAvailable){
    const a=getBackgroundAudio();
    if(a){
      setBackgroundVolume();
      a.play().catch(()=>{
        // Si el MP3 falla o el navegador bloquea algo, no rompemos la página.
        // Volvemos al sistema antiguo generado por código.
        backgroundAudioAvailable=false;
        if(musicPlaying&&!globalMuted)startGeneratedMusic();
      });
      return;
    }
  }
  startGeneratedMusic();
}
function stopMusic(){
  musicPlaying=false;
  stopGeneratedMusic();
  try{
    const a=backgroundAudio;
    if(a&&!a.paused)a.pause();
  }catch(e){}
}
function nextMusicTrack(){
  if(backgroundAudioAvailable){
    backgroundTrackIndex=(backgroundTrackIndex+1)%BACKGROUND_PLAYLIST.length;
    backgroundSourceTry=0;
    const wasPlaying=musicPlaying&&!globalMuted;
    resetBackgroundAudio();
    if(wasPlaying){
      const a=getBackgroundAudio();
      if(a){
        setBackgroundVolume();
        a.play().catch(()=>{});
      }
    }
    return;
  }
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
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Rubik+Wet+Paint&family=Bangers&family=Outfit:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#8A5A2E;border-radius:4px}
body{margin:0;background-color:#160B07;background-image:repeating-linear-gradient(0deg,rgba(232,211,162,.035) 0 1px,transparent 1px 6px),linear-gradient(160deg,#120806 0%,#21140C 48%,#2E1C10 100%)}
input,select,button,textarea{font-family:'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
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


/* ===== Responsive 2026: Android compacto + escritorio amplio ===== */
:root{--app-max-width:480px;--app-shell-pad-left:0px;--app-bottom-pad:82px}
@media (max-width:520px){
  .app-shell{width:100%!important;max-width:100%!important;box-shadow:none!important;border-radius:0!important}
  .page-content-pro{padding:14px 12px 96px!important}
  .motion-strip{margin-left:8px!important;margin-right:8px!important}
  .bottom-nav-pro{max-width:100%!important;border-radius:18px 18px 0 0!important;padding-bottom:calc(10px + env(safe-area-inset-bottom))!important}
  .nav-tab-pro span{font-size:.50rem!important}
  .nav-icon-pro{font-size:1.03rem!important;padding:4px 6px!important}
  input,select,textarea{font-size:16px!important}
  button{touch-action:manipulation}
}
@media (min-width:900px){
  :root{--app-max-width:1180px;--app-shell-pad-left:118px;--app-bottom-pad:28px}
  body{background-attachment:fixed}
  .app-shell{
    max-width:var(--app-max-width)!important;
    width:min(1180px,100vw)!important;
    padding-left:var(--app-shell-pad-left)!important;
    padding-bottom:var(--app-bottom-pad)!important;
    border-radius:0!important;
    overflow:visible!important;
  }
  .page-content-pro{
    padding:24px 24px 36px!important;
    min-height:calc(100dvh - 64px);
  }
  .page-content-pro>div:not(.motion-strip):not([class]){
    max-width:980px;
    margin-left:auto;
    margin-right:auto;
  }
  .bottom-nav-pro{
    position:fixed!important;
    top:82px!important;
    bottom:auto!important;
    left:calc(50% - 590px + 14px)!important;
    transform:none!important;
    width:92px!important;
    max-width:92px!important;
    min-height:calc(100dvh - 106px)!important;
    border-radius:26px!important;
    border:2px solid rgba(245,230,200,.22)!important;
    border-top:2px solid rgba(245,230,200,.22)!important;
    flex-direction:column!important;
    justify-content:flex-start!important;
    gap:8px!important;
    padding:14px 8px!important;
    box-shadow:0 18px 42px rgba(0,0,0,.32)!important;
    backdrop-filter:blur(12px);
  }
  .bottom-nav-pro .nav-tab-pro{
    width:100%!important;
    min-width:0!important;
    padding:9px 4px!important;
    border-radius:18px!important;
  }
  .bottom-nav-pro .nav-tab-pro:hover{
    background:rgba(255,244,214,.10)!important;
    transform:translateX(4px)!important;
  }
  .bottom-nav-pro .nav-tab-pro:after{
    left:auto!important;
    right:-5px!important;
    top:50%!important;
    bottom:auto!important;
    width:4px!important;
    height:4px!important;
    transform:translateY(-50%)!important;
  }
  .bottom-nav-pro .nav-tab-pro:hover:after{height:22px!important;width:4px!important}
  .bottom-nav-pro .nav-icon-pro{font-size:1.35rem!important}
  .bottom-nav-pro span{font-size:.62rem!important;line-height:1.05!important}
  .app-header-pro{
    border-radius:0 0 28px 28px!important;
    margin:0 14px!important;
    top:10px!important;
  }
  .app-header-pro>div:first-child div{
    font-size:1.62rem!important;
  }
  .modal-panel-pro{
    max-width:min(720px,calc(100vw - 72px))!important;
    border-radius:28px!important;
  }
  .gestion-grid-pro{
    grid-template-columns:repeat(6,1fr)!important;
  }
  .gestion-grid-pro button{
    min-height:78px!important;
  }
}
@media (min-width:1250px){
  .bottom-nav-pro{left:calc(50% - 590px + 14px)!important}
}
@media (min-width:900px) and (max-width:1249px){
  .bottom-nav-pro{left:14px!important}
}

/* ===== Paso 15.2: pulido fino móvil/PC ===== */
@media (max-width:520px){
  .app-header-pro{
    padding:10px 10px!important;
    gap:8px!important;
  }
  .app-header-pro>div:first-child{min-width:0!important;flex:1!important}
  .app-header-pro>div:first-child>div:first-child{
    font-size:1.14rem!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    max-width:42vw!important;
  }
  .app-header-pro>div:last-child{gap:5px!important;flex-shrink:0!important}
  .header-action-pro{padding:6px 7px!important;font-size:.68rem!important}
  .gestion-grid-pro{grid-template-columns:repeat(2,1fr)!important}
  .gestion-grid-pro button{min-height:70px!important}
  .studio-panel{
    border-radius:18px!important;
    padding:14px!important;
  }
  .bp{
    min-height:42px!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  .modal-overlay-pro{
    align-items:flex-end!important;
    padding:0!important;
  }
  .modal-panel-pro{
    border-radius:24px 24px 0 0!important;
    max-width:100%!important;
    max-height:calc(100dvh - 10px)!important;
    padding-bottom:calc(126px + env(safe-area-inset-bottom))!important;
  }
  .modal-panel-pro textarea{
    min-height:96px!important;
  }
}
@media (min-width:700px) and (max-width:899px){
  :root{--app-max-width:680px;--app-bottom-pad:92px}
  .app-shell{max-width:680px!important}
  .bottom-nav-pro{max-width:680px!important}
  .gestion-grid-pro{grid-template-columns:repeat(4,1fr)!important}
}
@media (min-width:900px){
  .modal-overlay-pro{
    align-items:center!important;
    padding:38px!important;
  }
  .modal-panel-pro{
    max-width:min(760px,calc(100vw - 110px))!important;
    width:100%!important;
    max-height:calc(100dvh - 76px)!important;
    border-radius:28px!important;
    padding:22px 22px 34px!important;
    animation:fadeSlide .22s ease!important;
  }
  .modal-panel-pro>div:first-child{
    margin:-22px -22px 18px!important;
    padding:16px 22px 14px!important;
  }
  .studio-panel{
    box-shadow:0 12px 30px rgba(18,8,4,.18)!important;
  }
  .studio-panel:hover{
    transform:translateY(-1px);
  }
  .bp:hover{
    transform:translateY(-1px);
  }
  input,select,textarea{
    min-height:44px;
  }
}
@media (min-width:1100px){
  .page-content-pro{
    padding-left:34px!important;
    padding-right:34px!important;
  }
  .gestion-grid-pro{grid-template-columns:repeat(7,1fr)!important}
}

/* ===== FASE79: Gestión ordenada por bloques ===== */
@media (max-width:520px){
  .gestion-grid-pro{grid-template-columns:repeat(2,1fr)!important}
}
@media (min-width:900px){
  .gestion-grid-pro{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}
}

/* ===== FASE98: UI 2026 tipo app PlayStore, pirata premium ===== */
:root{
  --ui-font:'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --ui-display:'Space Grotesk','Outfit',system-ui,sans-serif;
  --ui-pirate:'Pirata One',cursive;
  --glass-bg:rgba(22,12,8,.62);
  --glass-line:rgba(255,232,180,.18);
  --glass-line-strong:rgba(255,232,180,.34);
  --deep-shadow:0 24px 70px rgba(0,0,0,.46);
  --soft-shadow:0 16px 36px rgba(8,4,2,.30);
  --premium-gold:#F2CF75;
  --premium-amber:#C38732;
  --premium-ink:#0B0705;
  --app-radius:30px;
}
html{background:#050302;color-scheme:dark}
body{
  min-height:100vh;
  font-family:var(--ui-font)!important;
  background:
    radial-gradient(circle at 12% 4%,rgba(242,207,117,.20),transparent 34%),
    radial-gradient(circle at 88% 0%,rgba(79,96,45,.22),transparent 32%),
    radial-gradient(circle at 50% 110%,rgba(119,43,23,.18),transparent 40%),
    linear-gradient(135deg,#060302 0%,#140A06 44%,#231208 100%)!important;
  background-attachment:fixed;
}
body:before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    linear-gradient(115deg,transparent 0 24%,rgba(255,238,198,.045) 24.3% 24.7%,transparent 25% 100%),
    linear-gradient(0deg,rgba(255,255,255,.018) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px);
  background-size:100% 100%,44px 44px,44px 44px;
  mask-image:linear-gradient(180deg,rgba(0,0,0,.92),rgba(0,0,0,.25));
}
.app-shell{
  overflow:hidden!important;
  background:
    radial-gradient(circle at 16% -8%,color-mix(in srgb,var(--pageAccent,#B99A45) 34%,transparent),transparent 30%),
    radial-gradient(circle at 92% 6%,rgba(245,230,200,.12),transparent 28%),
    linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.010)),
    var(--pageShellModern,linear-gradient(160deg,#120806,#21140C 56%,#2E1C10))!important;
  backdrop-filter:blur(20px) saturate(1.12);
  box-shadow:0 0 0 1px rgba(255,236,185,.10),0 34px 90px rgba(0,0,0,.50)!important;
}
.app-shell:before{
  inset:0!important;
  background:
    radial-gradient(circle at 10% 18%,var(--pageGlowA,rgba(185,154,69,.22)),transparent 25%),
    radial-gradient(circle at 90% 8%,var(--pageGlowB,rgba(79,96,45,.20)),transparent 30%),
    radial-gradient(circle at 50% 100%,rgba(255,232,180,.06),transparent 38%),
    repeating-linear-gradient(135deg,rgba(255,232,180,.035) 0 1px,transparent 1px 17px)!important;
  opacity:1!important;
}
.app-shell:after{
  font-size:10rem!important;
  right:calc(50% - 360px)!important;
  top:88px!important;
  color:color-mix(in srgb,var(--pageAccent,#B99A45) 20%,transparent)!important;
  filter:blur(.2px) drop-shadow(0 18px 40px rgba(0,0,0,.25));
}
.page-content-pro{
  font-family:var(--ui-font)!important;
  letter-spacing:-.01em;
  isolation:isolate;
}
.page-content-pro:after{
  content:"";position:absolute;left:18px;right:18px;top:10px;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--pageAccent,#B99A45) 78%,white),transparent);
  opacity:.42;filter:blur(.3px);
}
.motion-strip{
  height:6px!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.055)!important;
  border:1px solid rgba(255,232,180,.10);
  overflow:hidden!important;
}
.motion-strip:before{
  content:"";position:absolute;inset:0;border-radius:999px;
  background:linear-gradient(90deg,rgba(255,255,255,.02),color-mix(in srgb,var(--pageAccent,#B99A45) 72%,#fff),rgba(255,255,255,.05));
  opacity:.78;
}
.motion-strip:after{height:100%!important;width:150px!important;background:linear-gradient(90deg,transparent,#fff6d6,transparent)!important;filter:blur(1px)}
.app-header-pro{
  margin:10px 10px 0!important;
  border-radius:0 0 28px 28px!important;
  border:1px solid rgba(255,232,180,.16)!important;
  border-top:0!important;
  background:
    linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.025)),
    color-mix(in srgb,var(--pageAccent,#B99A45) 20%,rgba(18,8,4,.86))!important;
  backdrop-filter:blur(24px) saturate(1.25)!important;
  box-shadow:0 18px 42px rgba(0,0,0,.32),inset 0 -1px 0 rgba(255,232,180,.17)!important;
}
.app-header-pro>div:first-child>div:first-child{
  font-family:var(--ui-display)!important;
  font-weight:900!important;
  letter-spacing:-.04em!important;
  text-shadow:0 8px 22px rgba(0,0,0,.34),0 0 18px color-mix(in srgb,var(--pageAccent,#B99A45) 36%,transparent)!important;
}
.header-action-pro{
  position:relative!important;
  overflow:hidden!important;
  background:rgba(255,255,255,.12)!important;
  border:1px solid rgba(255,232,180,.18)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 10px 22px rgba(0,0,0,.18)!important;
  backdrop-filter:blur(12px)!important;
}
.header-action-pro:before,.nav-tab-pro:before,.bp:before{
  content:"";position:absolute;top:-60%;bottom:-60%;width:42px;left:-70px;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.42),transparent);
  transform:rotate(18deg);opacity:0;transition:opacity .2s ease;
}
.header-action-pro:hover:before,.nav-tab-pro:hover:before,.bp:hover:before{opacity:.75;animation:premiumSweep .72s ease forwards}
@keyframes premiumSweep{from{left:-70px}to{left:calc(100% + 70px)}}
.bottom-nav-pro{
  border:1px solid rgba(255,232,180,.16)!important;
  border-bottom:0!important;
  background:
    linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035)),
    rgba(20,10,6,.74)!important;
  backdrop-filter:blur(26px) saturate(1.35)!important;
  box-shadow:0 -18px 46px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,232,180,.14)!important;
}
.nav-tab-pro{
  position:relative!important;overflow:hidden!important;
  border-radius:20px!important;
  isolation:isolate;
  transition:transform .18s cubic-bezier(.2,1,.22,1),background .18s ease,box-shadow .18s ease!important;
}
.nav-tab-pro:hover,.nav-tab-pro:focus-visible{background:rgba(255,232,180,.09)!important;box-shadow:0 10px 24px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.10)!important}
.nav-tab-pro[data-active="true"]{background:linear-gradient(180deg,rgba(255,232,180,.18),rgba(255,232,180,.06))!important}
.nav-icon-pro{
  border:1px solid rgba(255,232,180,.12)!important;
  background:rgba(255,255,255,.055)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 18px rgba(0,0,0,.18)!important;
  transform-style:preserve-3d;
}
.nav-tab-pro:hover .nav-icon-pro{filter:drop-shadow(0 0 12px color-mix(in srgb,var(--pageAccent,#B99A45) 60%,transparent));transform:translateY(-3px) scale(1.13) rotateX(10deg)!important}
.studio-panel,.ch{
  font-family:var(--ui-font)!important;
  border-radius:26px!important;
  background:
    linear-gradient(180deg,rgba(255,246,218,.94),rgba(235,207,150,.90)),
    radial-gradient(circle at 12% 0%,rgba(255,255,255,.45),transparent 34%)!important;
  border:1px solid rgba(255,232,180,.38)!important;
  box-shadow:var(--soft-shadow),inset 0 1px 0 rgba(255,255,255,.65)!important;
  transform-style:preserve-3d;
}
.studio-panel:hover,.ch:hover{transform:translateY(-4px) scale(1.012)!important;box-shadow:0 22px 52px rgba(0,0,0,.35),0 0 0 1px color-mix(in srgb,var(--pageAccent,#B99A45) 36%,transparent),inset 0 1px 0 rgba(255,255,255,.72)!important;filter:saturate(1.05)!important}
.studio-panel:after{width:120px!important;background:linear-gradient(90deg,transparent,rgba(255,255,255,.42),rgba(255,232,180,.22),transparent)!important;mix-blend-mode:screen}
.bp{
  position:relative!important;overflow:hidden!important;
  font-family:var(--ui-font)!important;
  border-radius:18px!important;
  border:1px solid rgba(255,232,180,.22)!important;
  box-shadow:0 12px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.18)!important;
  transition:transform .16s cubic-bezier(.2,1,.22,1),filter .16s ease,box-shadow .16s ease!important;
}
.bp:hover{transform:translateY(-2px) scale(1.018)!important;filter:saturate(1.08) brightness(1.03)!important;box-shadow:0 18px 36px rgba(0,0,0,.30),0 0 24px color-mix(in srgb,var(--pageAccent,#B99A45) 24%,transparent),inset 0 1px 0 rgba(255,255,255,.22)!important}
.bp:active{transform:translateY(1px) scale(.975)!important;filter:brightness(.96)!important}
input,select,textarea{
  font-family:var(--ui-font)!important;
  border-radius:18px!important;
  border:1px solid rgba(115,74,38,.22)!important;
  background:rgba(255,248,226,.92)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.50),0 8px 18px rgba(0,0,0,.08)!important;
}
.modal-panel-pro{
  font-family:var(--ui-font)!important;
  background:linear-gradient(180deg,rgba(255,248,226,.98),rgba(238,215,164,.96))!important;
  border:1px solid rgba(255,232,180,.42)!important;
  box-shadow:0 30px 90px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.70)!important;
  backdrop-filter:blur(18px) saturate(1.15)!important;
}
.modal-panel-pro>div:first-child{background:linear-gradient(180deg,rgba(255,248,226,.96),rgba(255,239,191,.90))!important;backdrop-filter:blur(10px)}
.landing-nav-card,.landing-feature-pro{
  border-radius:28px!important;
  background:linear-gradient(180deg,rgba(255,246,218,.14),rgba(255,246,218,.055))!important;
  border:1px solid rgba(255,232,180,.18)!important;
  box-shadow:0 16px 40px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.10)!important;
}
.news-short{border-radius:28px!important}
.icon3d{transform-style:preserve-3d;filter:drop-shadow(0 8px 16px rgba(0,0,0,.30)) drop-shadow(0 0 10px color-mix(in srgb,var(--pageAccent,#B99A45) 26%,transparent))!important}
.rasta-speech-bubble{
  border:1px solid rgba(255,232,180,.30)!important;
  background:linear-gradient(180deg,rgba(255,248,226,.94),rgba(236,210,157,.90))!important;
  box-shadow:0 20px 50px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.60)!important;
}
@media (max-width:520px){
  .app-header-pro{margin:0!important;border-radius:0 0 24px 24px!important}
  .bottom-nav-pro{border-radius:26px 26px 0 0!important;margin:0 auto!important;padding-top:8px!important}
  .page-content-pro{padding-top:16px!important}
  .studio-panel{border-radius:22px!important}
}
@media (min-width:900px){
  .app-shell{border-radius:34px!important;margin:18px auto!important;min-height:calc(100dvh - 36px)!important}
  .app-header-pro{border-radius:26px!important;margin:14px 18px 0!important;top:14px!important}
  .bottom-nav-pro{border-radius:28px!important;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035)),rgba(20,10,6,.70)!important}
  .page-content-pro{padding-top:28px!important}
}
@media (min-width:1250px){
  :root{--app-max-width:1240px;--app-shell-pad-left:124px}
}



/* ===== FASE99: Tycoon UI mezcla PlayStore + escenas híbridas, fix parpadeo mapa ===== */
.tycoon-map-card,.tycoon-map-card *{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.tycoon-map-card:before,.tycoon-map-card:after,.tycoon-map-board:before,.tycoon-map-board:after{content:none!important;display:none!important;animation:none!important}
.tycoon-map-card .studio-panel:after{display:none!important;animation:none!important}
@media (prefers-reduced-motion:no-preference){
  .tycoon-map-card button:hover{box-shadow:0 18px 34px rgba(0,0,0,.36),0 0 22px rgba(242,207,117,.16)!important}
}

/* ===== FASE100: clínica glass 2026 + modo día/noche ===== */
:root{
  --clinic-font:'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
body[data-rc-theme="night"]{
  color-scheme:dark;
  background:
    radial-gradient(circle at 14% 0%,rgba(67,214,255,.20),transparent 30%),
    radial-gradient(circle at 84% 4%,rgba(156,125,255,.18),transparent 28%),
    radial-gradient(circle at 52% 108%,rgba(126,242,154,.10),transparent 36%),
    linear-gradient(135deg,#0B1430 0%,#111C3F 44%,#1C2155 100%)!important;
}
body[data-rc-theme="day"]{
  color-scheme:light;
  background:
    radial-gradient(circle at 14% 0%,rgba(35,182,242,.18),transparent 30%),
    radial-gradient(circle at 86% 4%,rgba(156,107,255,.15),transparent 26%),
    radial-gradient(circle at 52% 108%,rgba(89,216,141,.10),transparent 36%),
    linear-gradient(135deg,#F7EAD1 0%,#FAF2E3 50%,#F1E6FF 100%)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#0B1430;
  --rc-bg-b:#111C3F;
  --rc-bg-c:#1C2155;
  --rc-card:rgba(21,32,72,.76);
  --rc-card-strong:rgba(29,42,88,.90);
  --rc-card-soft:rgba(42,56,106,.72);
  --rc-text:#F6F2E8;
  --rc-text-strong:#FFF9F0;
  --rc-muted:#D7D1C6;
  --rc-subtle:#AFA9C6;
  --rc-border:rgba(116,213,255,.24);
  --rc-border-strong:rgba(156,125,255,.40);
  --rc-primary:#43D6FF;
  --rc-primary-2:#47B8FF;
  --rc-accent2:#9C7DFF;
  --rc-accent3:#7EF29A;
  --rc-accent-warm:#FFBF69;
  --rc-danger:#FF6B7E;
  --rc-cream:#F4E6C8;
  --rc-panel-lite:#EAD9B2;
  --rc-shadow:0 28px 78px rgba(4,8,24,.48);
  --rc-inner:inset 0 1px 0 rgba(255,255,255,.10);
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.04));
  --rc-panel-fun:linear-gradient(145deg,rgba(244,230,200,.94),rgba(235,217,178,.90));
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#F7EAD1;
  --rc-bg-b:#FAF2E3;
  --rc-bg-c:#F1E6FF;
  --rc-card:rgba(255,248,238,.84);
  --rc-card-strong:rgba(255,245,230,.92);
  --rc-card-soft:rgba(245,235,219,.78);
  --rc-text:#23304A;
  --rc-text-strong:#18263F;
  --rc-muted:#5A647E;
  --rc-subtle:#7B7692;
  --rc-border:rgba(77,195,255,.26);
  --rc-border-strong:rgba(131,102,255,.36);
  --rc-primary:#23B6F2;
  --rc-primary-2:#5B8CFF;
  --rc-accent2:#9C6BFF;
  --rc-accent3:#59D88D;
  --rc-accent-warm:#FFA94D;
  --rc-danger:#E85B76;
  --rc-cream:#FFF1D7;
  --rc-panel-lite:#F3DFC0;
  --rc-shadow:0 24px 68px rgba(59,63,96,.16);
  --rc-inner:inset 0 1px 0 rgba(255,255,255,.88);
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.72),rgba(255,247,233,.50));
  --rc-panel-fun:linear-gradient(145deg,rgba(255,241,215,.98),rgba(243,223,192,.94));
}
.app-shell[data-rc-theme],.rc-standalone-shell[data-rc-theme]{
  color:var(--rc-text)!important; text-shadow:none!important;
  background:
    radial-gradient(circle at 12% 2%,color-mix(in srgb,var(--rc-primary) 30%,transparent),transparent 30%),
    radial-gradient(circle at 88% 0%,color-mix(in srgb,var(--rc-accent2) 24%,transparent),transparent 28%),
    radial-gradient(circle at 50% 112%,color-mix(in srgb,var(--rc-primary-2) 15%,transparent),transparent 44%),
    linear-gradient(135deg,var(--rc-bg-a),var(--rc-bg-b) 50%,var(--rc-bg-c))!important;
  box-shadow:0 0 0 1px var(--rc-border),0 32px 90px rgba(0,0,0,.28)!important;
}
.app-shell[data-rc-theme]:before,.rc-standalone-shell[data-rc-theme]:before{
  background:
    radial-gradient(circle at 14% 20%,color-mix(in srgb,var(--rc-primary) 18%,transparent),transparent 28%),
    radial-gradient(circle at 92% 12%,color-mix(in srgb,var(--rc-accent2) 17%,transparent),transparent 30%),
    linear-gradient(120deg,transparent 0 24%,rgba(255,255,255,.055) 24.2% 24.7%,transparent 25% 100%),
    linear-gradient(0deg,rgba(255,255,255,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.027) 1px,transparent 1px)!important;
  background-size:100% 100%,100% 100%,100% 100%,38px 38px,38px 38px!important;
  opacity:1!important;
}
.app-shell[data-rc-theme]:after{color:color-mix(in srgb,var(--rc-primary) 16%,transparent)!important}
.app-shell[data-rc-theme] .app-header-pro{
  background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.045)),rgba(12,18,31,.64)!important;
  border:1px solid var(--rc-border)!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  backdrop-filter:blur(28px) saturate(1.35)!important;
  -webkit-backdrop-filter:blur(28px) saturate(1.35)!important;
  box-shadow:0 18px 52px rgba(0,0,0,.24),var(--rc-inner),0 0 34px color-mix(in srgb,var(--rc-primary) 13%,transparent)!important;
}
.app-shell[data-rc-theme="day"] .app-header-pro{background:linear-gradient(135deg,rgba(255,244,226,.92),rgba(243,230,255,.72)),rgba(255,248,238,.84)!important}
.app-shell[data-rc-theme] .app-header-pro *,
.app-shell[data-rc-theme] .bottom-nav-pro *,
.rc-standalone-shell[data-rc-theme] *{color:var(--rc-text)!important}
.app-shell[data-rc-theme] .header-action-pro,
.app-shell[data-rc-theme] .theme-toggle-pro{
  background:linear-gradient(145deg,color-mix(in srgb,var(--rc-card-strong) 82%,transparent),color-mix(in srgb,var(--rc-primary) 12%,transparent),color-mix(in srgb,var(--rc-accent2) 8%,transparent))!important;
  border:1px solid var(--rc-border)!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  box-shadow:0 10px 26px rgba(0,0,0,.18),var(--rc-inner)!important;
}
.app-shell[data-rc-theme] .theme-toggle-pro{
  min-width:76px;
  justify-content:center;
}
.app-shell[data-rc-theme] .bottom-nav-pro{
  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045)),color-mix(in srgb,var(--rc-bg-b) 78%,transparent)!important;
  border:1px solid var(--rc-border)!important;
  border-bottom:0!important;
  backdrop-filter:blur(30px) saturate(1.4)!important;
  -webkit-backdrop-filter:blur(30px) saturate(1.4)!important;
  box-shadow:0 -20px 54px rgba(0,0,0,.28),var(--rc-inner)!important;
}
.app-shell[data-rc-theme="day"] .bottom-nav-pro{background:linear-gradient(180deg,rgba(255,247,232,.96),rgba(240,232,255,.80)),rgba(255,245,233,.88)!important}
.app-shell[data-rc-theme] .nav-tab-pro{color:var(--rc-muted)!important}
.app-shell[data-rc-theme] .nav-tab-pro .nav-icon-pro{
  color:var(--rc-text)!important; text-shadow:none!important;
  background:transparent!important;
  border:1px solid transparent!important;
}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"]{
  background:linear-gradient(145deg,color-mix(in srgb,var(--rc-primary) 20%,transparent),color-mix(in srgb,var(--rc-accent2) 14%,transparent),color-mix(in srgb,var(--rc-accent3) 12%,transparent))!important;
  box-shadow:0 14px 30px rgba(0,0,0,.20),0 0 24px color-mix(in srgb,var(--rc-primary) 18%,transparent)!important;
}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"] .nav-icon-pro{
  background:linear-gradient(135deg,var(--rc-primary),var(--rc-accent2))!important;
  color:white!important;
  border-color:rgba(255,255,255,.30)!important;
  box-shadow:0 8px 22px color-mix(in srgb,var(--rc-primary) 30%,transparent)!important;
}
.app-shell[data-rc-theme] .nav-tab-pro span{color:var(--rc-muted)!important;text-shadow:none!important}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"] span{color:var(--rc-text)!important; text-shadow:none!important;font-weight:950!important}
.app-shell[data-rc-theme] .page-content-pro,
.app-shell[data-rc-theme] .page-content-pro div,
.app-shell[data-rc-theme] .page-content-pro p,
.app-shell[data-rc-theme] .page-content-pro span,
.app-shell[data-rc-theme] .page-content-pro b,
.app-shell[data-rc-theme] .page-content-pro strong,
.app-shell[data-rc-theme] .page-content-pro label,
.app-shell[data-rc-theme] .page-content-pro h1,
.app-shell[data-rc-theme] .page-content-pro h2,
.app-shell[data-rc-theme] .page-content-pro h3{
  color:var(--rc-text)!important; text-shadow:none!important;
  text-shadow:none!important;
}
.app-shell[data-rc-theme] .page-content-pro [style*="color:T.textSub"],
.app-shell[data-rc-theme] .page-content-pro small{color:var(--rc-muted)!important}
.app-shell[data-rc-theme] .studio-panel,
.app-shell[data-rc-theme] .landing-nav-card,
.app-shell[data-rc-theme] .landing-feature-pro,
.app-shell[data-rc-theme] .news-short,
.app-shell[data-rc-theme] .rasta-speech-bubble,
.app-shell[data-rc-theme] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme] .studio-panel,
.rc-standalone-shell[data-rc-theme] .tycoon-map-card{
  background:var(--rc-frost),linear-gradient(180deg,color-mix(in srgb,var(--rc-card) 94%,transparent),color-mix(in srgb,var(--rc-card-soft) 82%,transparent))!important;
  border:1px solid var(--rc-border)!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  box-shadow:var(--rc-shadow),var(--rc-inner),0 0 0 1px color-mix(in srgb,var(--rc-primary) 10%,transparent)!important;
  backdrop-filter:blur(22px) saturate(1.28)!important;
  -webkit-backdrop-filter:blur(22px) saturate(1.28)!important;
}
.app-shell[data-rc-theme] .studio-panel:after,
.app-shell[data-rc-theme] .landing-nav-card:after,
.app-shell[data-rc-theme] .landing-feature-pro:after{
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.32),color-mix(in srgb,var(--rc-primary) 25%,transparent),transparent)!important;
}
.app-shell[data-rc-theme] .bp,
.app-shell[data-rc-theme] button.bp,
.rc-standalone-shell[data-rc-theme] .bp,
.rc-standalone-shell[data-rc-theme] button.bp{
  background:linear-gradient(135deg,var(--rc-primary),var(--rc-primary-2) 42%,var(--rc-accent2) 78%,var(--rc-accent3))!important;
  color:white!important;
  border:1px solid rgba(255,255,255,.24)!important;
  box-shadow:0 16px 34px color-mix(in srgb,var(--rc-primary) 22%,rgba(0,0,0,.20)),var(--rc-inner)!important;
}
.app-shell[data-rc-theme] .bp[col="ghost"],.app-shell[data-rc-theme] button[style*="rgba(255,244,214"]{
  background:linear-gradient(145deg,var(--rc-card-strong),var(--rc-card-soft))!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  border:1px solid var(--rc-border)!important;
}
.app-shell[data-rc-theme] input,
.app-shell[data-rc-theme] select,
.app-shell[data-rc-theme] textarea,
.rc-standalone-shell[data-rc-theme] input,
.rc-standalone-shell[data-rc-theme] select,
.rc-standalone-shell[data-rc-theme] textarea{
  background:linear-gradient(180deg,color-mix(in srgb,var(--rc-card-strong) 96%,transparent),color-mix(in srgb,var(--rc-card-soft) 78%,transparent))!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  border:1px solid var(--rc-border)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 12px 28px rgba(0,0,0,.12)!important;
}
.app-shell[data-rc-theme="day"] input,
.app-shell[data-rc-theme="day"] select,
.app-shell[data-rc-theme="day"] textarea{background:linear-gradient(180deg,rgba(255,251,244,.96),rgba(248,238,220,.88))!important;color:#23304A!important}
.app-shell[data-rc-theme] input::placeholder,
.app-shell[data-rc-theme] textarea::placeholder{color:var(--rc-subtle)!important}
.app-shell[data-rc-theme] .modal-overlay-pro{background:rgba(2,8,23,.66)!important;backdrop-filter:blur(10px)!important}
.app-shell[data-rc-theme] .modal-panel-pro{
  background:var(--rc-frost),var(--rc-card-strong)!important;
  border:1px solid var(--rc-border-strong)!important;
  color:var(--rc-text)!important; text-shadow:none!important;
  box-shadow:0 34px 96px rgba(0,0,0,.38),var(--rc-inner)!important;
}
.app-shell[data-rc-theme] .modal-panel-pro>div:first-child{background:linear-gradient(180deg,color-mix(in srgb,var(--rc-card-strong) 92%,transparent),color-mix(in srgb,var(--rc-card-soft) 84%,transparent))!important;border-bottom:1px solid var(--rc-border)!important}
.app-shell[data-rc-theme] .motion-strip{
  background:linear-gradient(90deg,transparent,var(--rc-primary),var(--rc-accent2),var(--rc-accent3),transparent)!important;
  box-shadow:0 0 22px color-mix(in srgb,var(--rc-primary) 35%,transparent)!important;
  border-color:var(--rc-border)!important;
}
.app-shell[data-rc-theme] .icon3d{filter:drop-shadow(0 8px 18px rgba(0,0,0,.26)) drop-shadow(0 0 12px color-mix(in srgb,var(--rc-primary) 30%,transparent))!important}
.app-shell[data-rc-theme] [style*="#FFF"],
.app-shell[data-rc-theme] [style*="#fff"],
.app-shell[data-rc-theme] [style*="255,244"],
.app-shell[data-rc-theme] [style*="255,248"],
.app-shell[data-rc-theme] [style*="E6CF9B"],
.app-shell[data-rc-theme] [style*="F6E5BE"],
.app-shell[data-rc-theme] [style*="D8BE87"]{
  border-color:var(--rc-border)!important;
}
.app-shell[data-rc-theme] .page-content-pro [style*="#A72822"],
.app-shell[data-rc-theme] .page-content-pro [style*="#E53935"]{background:var(--rc-danger)!important;color:white!important}

.app-shell[data-rc-theme] .page-content-pro [style*="background:#FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:#fff"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#E6CF9B"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#F6E5BE"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:rgba(255,255,255"],
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme] button:not(.bp):not(.nav-tab-pro):not(.header-action-pro){
  background:var(--rc-panel-fun)!important;
  color:var(--rc-text-strong)!important;
  border:1px solid color-mix(in srgb,var(--rc-accent-warm) 70%,var(--rc-border))!important;
  box-shadow:0 12px 26px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.35)!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="night"] button:not(.bp):not(.nav-tab-pro):not(.header-action-pro){
  background:linear-gradient(145deg,rgba(244,230,200,.92),rgba(232,214,176,.88))!important;
  color:#24324D!important;
}
.app-shell[data-rc-theme] .page-content-pro button[data-active="true"],
.app-shell[data-rc-theme] .page-content-pro button[aria-pressed="true"]{
  background:linear-gradient(135deg,var(--rc-accent-warm),#FFD166 40%,#FF9F1C 100%)!important;
  color:#24324D!important;
  border-color:#FFB74D!important;
}
.app-shell[data-rc-theme] .page-content-pro [style*="background:#FFF"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:#fff"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#FFF"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#E6CF9B"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#F6E5BE"] *{
  color:#24324D!important;
}
.app-shell[data-rc-theme] .page-content-pro .icon3d,
.rc-standalone-shell[data-rc-theme] .icon3d{
  filter:drop-shadow(0 10px 16px rgba(0,0,0,.26)) drop-shadow(0 0 12px color-mix(in srgb,var(--rc-accent2) 20%,transparent))!important;
}
.app-shell[data-rc-theme] .page-content-pro,
.rc-standalone-shell[data-rc-theme]{
  background-image:
    radial-gradient(circle at 18% 16%,color-mix(in srgb,var(--rc-primary) 10%,transparent),transparent 20%),
    radial-gradient(circle at 82% 14%,color-mix(in srgb,var(--rc-accent2) 10%,transparent),transparent 18%),
    radial-gradient(circle at 58% 90%,color-mix(in srgb,var(--rc-accent3) 10%,transparent),transparent 18%),
    linear-gradient(90deg,transparent 0 96%,rgba(255,255,255,.03) 96% 97%,transparent 97% 100%),
    linear-gradient(0deg,transparent 0 96%,rgba(255,255,255,.03) 96% 97%,transparent 97% 100%);
  background-size:auto,auto,auto,46px 46px,46px 46px;
}
.app-shell[data-rc-theme]:before,.rc-standalone-shell[data-rc-theme]:before{
  background:
    radial-gradient(circle at 14% 20%,color-mix(in srgb,var(--rc-primary) 18%,transparent),transparent 28%),
    radial-gradient(circle at 92% 12%,color-mix(in srgb,var(--rc-accent2) 17%,transparent),transparent 30%),
    radial-gradient(circle at 40% 88%,color-mix(in srgb,var(--rc-accent3) 14%,transparent),transparent 26%),
    repeating-linear-gradient(90deg,transparent 0 58px,rgba(255,255,255,.03) 58px 59px),
    repeating-linear-gradient(0deg,transparent 0 58px,rgba(255,255,255,.025) 58px 59px),
    linear-gradient(135deg,transparent 0 24%,rgba(255,255,255,.03) 24% 25%,transparent 25% 100%)!important;
}
.app-shell[data-rc-theme]:after{
  content:"✂ ✦ ◆"!important;
  font-size:6.3rem!important;
  letter-spacing:.08em;
  top:102px!important;
  right:calc(50% - 330px)!important;
  color:color-mix(in srgb,var(--rc-primary) 12%,var(--rc-accent2) 10%)!important;
}
@media (max-width:520px){.app-shell[data-rc-theme] .theme-toggle-pro{min-width:44px;font-size:.68rem!important;padding:6px 7px!important}.app-shell[data-rc-theme] .theme-toggle-pro .theme-word{display:none}}


/* ===== FASE102: contraste real + paleta crema arcade/graffiti ===== */
@keyframes rcCandyClouds{0%{transform:translate3d(-14px,0,0) rotate(0deg)}50%{transform:translate3d(14px,-10px,0) rotate(2deg)}100%{transform:translate3d(-14px,0,0) rotate(0deg)}}
@keyframes rcNeonRoad{0%{background-position:0 0,0 0,0 0}100%{background-position:120px 0,0 120px,80px 80px}}
@keyframes rcTabPulse{0%,100%{box-shadow:0 10px 24px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.65)}50%{box-shadow:0 13px 30px rgba(35,182,242,.20),0 0 22px rgba(156,107,255,.16),inset 0 1px 0 rgba(255,255,255,.72)}}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#F7E4BE;
  --rc-bg-b:#FFF0D8;
  --rc-bg-c:#EEDFFF;
  --rc-card:rgba(255,236,204,.78);
  --rc-card-strong:rgba(255,242,220,.94);
  --rc-card-soft:rgba(239,224,255,.78);
  --rc-text:#20304E;
  --rc-text-strong:#172642;
  --rc-muted:#4D5F7D;
  --rc-subtle:#697799;
  --rc-primary:#20B8FF;
  --rc-primary-2:#617CFF;
  --rc-accent2:#A066FF;
  --rc-accent3:#49D878;
  --rc-accent-warm:#FFAC3D;
  --rc-panel-fun:linear-gradient(145deg,#FFE0A3 0%,#FFF0CF 48%,#E8DEFF 100%);
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#071A38;
  --rc-bg-b:#10245A;
  --rc-bg-c:#241B5F;
  --rc-card:rgba(14,27,64,.78);
  --rc-card-strong:rgba(20,35,78,.92);
  --rc-card-soft:rgba(36,44,99,.72);
  --rc-text:#F6EDDC;
  --rc-text-strong:#FFF7E8;
  --rc-muted:#D7CBBA;
  --rc-subtle:#B9B2D6;
  --rc-primary:#43D6FF;
  --rc-primary-2:#528CFF;
  --rc-accent2:#A985FF;
  --rc-accent3:#73F59D;
  --rc-accent-warm:#FFBF69;
  --rc-panel-fun:linear-gradient(145deg,#F2D79B 0%,#F8E6BB 52%,#D9CCFF 100%);
}
.app-shell[data-rc-theme],.rc-standalone-shell[data-rc-theme]{
  background:
    radial-gradient(circle at 10% 5%,color-mix(in srgb,var(--rc-primary) 22%,transparent),transparent 27%),
    radial-gradient(circle at 90% 2%,color-mix(in srgb,var(--rc-accent2) 20%,transparent),transparent 27%),
    radial-gradient(circle at 55% 110%,color-mix(in srgb,var(--rc-accent3) 13%,transparent),transparent 35%),
    linear-gradient(135deg,var(--rc-bg-a),var(--rc-bg-b) 48%,var(--rc-bg-c))!important;
}
.app-shell[data-rc-theme]:before,.rc-standalone-shell[data-rc-theme]:before{
  background:
    linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),
    linear-gradient(0deg,rgba(255,255,255,.03) 1px,transparent 1px),
    radial-gradient(circle at 18% 18%,color-mix(in srgb,var(--rc-primary) 18%,transparent),transparent 24%),
    radial-gradient(circle at 80% 24%,color-mix(in srgb,var(--rc-accent2) 18%,transparent),transparent 22%),
    radial-gradient(circle at 44% 84%,color-mix(in srgb,var(--rc-accent3) 12%,transparent),transparent 22%)!important;
  background-size:54px 54px,54px 54px,auto,auto,auto!important;
  animation:rcNeonRoad 16s linear infinite,rcCandyClouds 9s ease-in-out infinite!important;
}
.app-shell[data-rc-theme]:after{
  content:"✂  BARBER  ★  RASTA  ◆"!important;
  font-family:var(--ui-display)!important;
  font-size:2.1rem!important;
  letter-spacing:.16em!important;
  right:calc(50% - 395px)!important;
  top:104px!important;
  color:color-mix(in srgb,var(--rc-primary) 14%,var(--rc-accent2) 10%)!important;
  opacity:.80!important;
  filter:blur(.1px) drop-shadow(0 14px 30px rgba(0,0,0,.15))!important;
  transform:rotate(-11deg)!important;
}
.app-shell[data-rc-theme] .app-header-pro{
  background:linear-gradient(135deg,color-mix(in srgb,var(--rc-card-strong) 84%,transparent),color-mix(in srgb,var(--rc-primary) 10%,transparent),color-mix(in srgb,var(--rc-accent2) 9%,transparent))!important;
  border:1px solid color-mix(in srgb,var(--rc-primary) 34%,transparent)!important;
}
.app-shell[data-rc-theme="day"] .app-header-pro{
  background:linear-gradient(135deg,rgba(255,241,215,.94),rgba(235,226,255,.78),rgba(217,246,255,.70))!important;
}
.app-shell[data-rc-theme] .bottom-nav-pro{
  background:linear-gradient(180deg,color-mix(in srgb,var(--rc-card-strong) 92%,transparent),color-mix(in srgb,var(--rc-card-soft) 78%,transparent))!important;
  border-color:color-mix(in srgb,var(--rc-primary) 46%,var(--rc-accent2))!important;
}
.app-shell[data-rc-theme="day"] .bottom-nav-pro{
  background:linear-gradient(180deg,rgba(255,241,215,.98),rgba(232,224,255,.88),rgba(218,246,255,.70))!important;
}
/* Regla clave: NINGÚN botón/pestaña clara puede tener letra blanca */
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme] button:not(.bp):not(.nav-tab-pro):not(.header-action-pro),
.app-shell[data-rc-theme] .gestion-grid-pro button,
.app-shell[data-rc-theme] .page-content-pro [role="tab"],
.app-shell[data-rc-theme] .page-content-pro [class*="tab"]:not(.nav-tab-pro){
  background:var(--rc-panel-fun)!important;
  color:#20304E!important;
  border:1.5px solid color-mix(in srgb,var(--rc-accent-warm) 70%,var(--rc-primary))!important;
  box-shadow:0 12px 26px rgba(17,24,39,.15),inset 0 1px 0 rgba(255,255,255,.78)!important;
  text-shadow:none!important;
  font-weight:950!important;
}
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro) *,
.rc-standalone-shell[data-rc-theme] button:not(.bp):not(.nav-tab-pro):not(.header-action-pro) *,
.app-shell[data-rc-theme] .gestion-grid-pro button *,
.app-shell[data-rc-theme] .page-content-pro [role="tab"] *,
.app-shell[data-rc-theme] .page-content-pro [class*="tab"]:not(.nav-tab-pro) *{
  color:#20304E!important;
  text-shadow:none!important;
  opacity:1!important;
}
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro):hover,
.app-shell[data-rc-theme] .gestion-grid-pro button:hover{
  background:linear-gradient(145deg,#FFD166 0%,#FFE6A3 38%,#B8F7D4 70%,#CFC4FF 100%)!important;
  transform:translateY(-2px) scale(1.015)!important;
  animation:rcTabPulse 1.25s ease-in-out infinite!important;
}
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro)[data-active="true"],
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro)[aria-selected="true"],
.app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro)[aria-pressed="true"]{
  background:linear-gradient(135deg,#FFB23F,#FFD166 40%,#6EE7B7 72%,#7DD3FC 100%)!important;
  color:#18263F!important;
  border-color:#FFB23F!important;
  box-shadow:0 14px 32px rgba(255,178,63,.28),0 0 24px rgba(67,214,255,.18),inset 0 1px 0 rgba(255,255,255,.70)!important;
}
/* Paneles y bocadillos claros: fondo divertido y texto oscuro obligatorio */
.app-shell[data-rc-theme] .rasta-speech-bubble,
.app-shell[data-rc-theme] .page-content-pro [style*="background:#FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:#fff"],
.app-shell[data-rc-theme] .page-content-pro [style*="background: #FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="background: #fff"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg,#FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="background:linear-gradient(180deg, #FFF"],
.app-shell[data-rc-theme] .page-content-pro [style*="rgba(255,255,255"],
.app-shell[data-rc-theme] .page-content-pro [style*="rgba(255, 255, 255"],
.app-shell[data-rc-theme] .page-content-pro [style*="E6CF9B"],
.app-shell[data-rc-theme] .page-content-pro [style*="F6E5BE"],
.app-shell[data-rc-theme] .page-content-pro [style*="D8BE87"],
.app-shell[data-rc-theme] .page-content-pro [style*="255,244"],
.app-shell[data-rc-theme] .page-content-pro [style*="255, 244"],
.app-shell[data-rc-theme] .page-content-pro [style*="255,248"],
.app-shell[data-rc-theme] .page-content-pro [style*="255, 248"]{
  background:var(--rc-panel-fun)!important;
  color:#20304E!important;
  border-color:color-mix(in srgb,var(--rc-accent-warm) 50%,var(--rc-primary))!important;
  text-shadow:none!important;
}
.app-shell[data-rc-theme] .rasta-speech-bubble *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:#FFF"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="background:#fff"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="rgba(255,255,255"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="rgba(255, 255, 255"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="E6CF9B"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="F6E5BE"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="D8BE87"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="255,244"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="255, 244"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="255,248"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="255, 248"] *{
  color:#20304E!important;
  text-shadow:none!important;
  opacity:1!important;
}
/* Paneles oscuros reales para separar zonas */
.app-shell[data-rc-theme] .studio-panel,
.app-shell[data-rc-theme] .landing-feature-pro,
.app-shell[data-rc-theme] .news-short,
.app-shell[data-rc-theme] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme] .studio-panel,
.rc-standalone-shell[data-rc-theme] .tycoon-map-card{
  background:linear-gradient(145deg,color-mix(in srgb,var(--rc-card-strong) 92%,transparent),color-mix(in srgb,var(--rc-card-soft) 74%,transparent)),radial-gradient(circle at top left,color-mix(in srgb,var(--rc-primary) 16%,transparent),transparent 44%)!important;
  border:1px solid color-mix(in srgb,var(--rc-primary) 28%,var(--rc-border))!important;
  color:var(--rc-text)!important;
}
.app-shell[data-rc-theme] .studio-panel > *:not(button),
.app-shell[data-rc-theme] .landing-feature-pro > *:not(button),
.app-shell[data-rc-theme] .news-short > *:not(button),
.app-shell[data-rc-theme] .tycoon-map-card > *:not(button),
.rc-standalone-shell[data-rc-theme] .studio-panel > *:not(button),
.rc-standalone-shell[data-rc-theme] .tycoon-map-card > *:not(button){
  color:var(--rc-text)!important;
}
/* Iconos y dibujos: más vivos y legibles */
.app-shell[data-rc-theme] .icon3d,
.app-shell[data-rc-theme] .nav-icon-pro,
.rc-standalone-shell[data-rc-theme] .icon3d{
  opacity:1!important;
  filter:drop-shadow(0 9px 14px rgba(0,0,0,.24)) drop-shadow(0 0 12px color-mix(in srgb,var(--rc-primary) 28%,transparent)) saturate(1.24)!important;
}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"] .nav-icon-pro{
  background:linear-gradient(135deg,#43D6FF,#9C7DFF 60%,#7EF29A)!important;
  color:#FFFFFF!important;
}
.app-shell[data-rc-theme] .nav-tab-pro span{font-weight:950!important;opacity:1!important}
.app-shell[data-rc-theme="day"] .nav-tab-pro span{color:#4D5F7D!important}
.app-shell[data-rc-theme="day"] .nav-tab-pro[data-active="true"] span{color:#20304E!important}
@media (max-width:520px){
  .app-shell[data-rc-theme] .page-content-pro button:not(.bp):not(.nav-tab-pro):not(.header-action-pro){min-height:44px!important}
}


/* ===== FASE103: contraste quirúrgico sobre FASE102 ===== */
/* Objetivo: conservar la base Mario/crema, pero hacerla legible y moderna con modo clínica claro/oscuro. */
.app-shell[data-rc-theme],.rc-standalone-shell[data-rc-theme]{
  --rc-radius-card:24px;
  --rc-glass-blur:blur(22px) saturate(1.22);
  color:var(--rc-text)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#050B16;
  --rc-bg-b:#081524;
  --rc-bg-c:#111B33;
  --rc-card:rgba(10,22,36,.86);
  --rc-card-strong:rgba(14,29,48,.96);
  --rc-card-soft:rgba(20,39,62,.88);
  --rc-panel-fun:linear-gradient(145deg,rgba(12,26,43,.94),rgba(20,39,62,.90));
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.035));
  --rc-text:#F7FBFF;
  --rc-text-strong:#FFFFFF;
  --rc-muted:#C4D4E5;
  --rc-subtle:#91A8BE;
  --rc-cream:#F7FBFF;
  --rc-panel-lite:rgba(22,42,66,.92);
  --rc-border:rgba(103,217,255,.24);
  --rc-border-strong:rgba(111,223,255,.48);
  --rc-primary:#45D9FF;
  --rc-primary-2:#4C8DFF;
  --rc-accent2:#9B72FF;
  --rc-accent3:#42E6B4;
  --rc-shadow:0 26px 82px rgba(0,0,0,.50);
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#F8FCFF;
  --rc-bg-b:#EAF7FF;
  --rc-bg-c:#EDF0FF;
  --rc-card:rgba(255,255,255,.86);
  --rc-card-strong:rgba(255,255,255,.96);
  --rc-card-soft:rgba(235,248,255,.88);
  --rc-panel-fun:linear-gradient(145deg,rgba(255,255,255,.96),rgba(232,248,255,.88));
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.82),rgba(226,247,255,.55));
  --rc-text:#0F2033;
  --rc-text-strong:#071525;
  --rc-muted:#425B70;
  --rc-subtle:#60778B;
  --rc-cream:#FFFFFF;
  --rc-panel-lite:rgba(238,249,255,.94);
  --rc-border:rgba(40,172,220,.22);
  --rc-border-strong:rgba(34,181,232,.48);
  --rc-primary:#008EBD;
  --rc-primary-2:#2563EB;
  --rc-accent2:#7C3AED;
  --rc-accent3:#059669;
  --rc-shadow:0 24px 70px rgba(40,88,126,.18);
}
body[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 12% -4%,rgba(69,217,255,.22),transparent 32%),
    radial-gradient(circle at 94% 0%,rgba(155,114,255,.18),transparent 30%),
    radial-gradient(circle at 48% 110%,rgba(66,230,180,.10),transparent 38%),
    linear-gradient(135deg,#03060A 0%,#050B16 44%,#111B33 100%)!important;
}
body[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 12% -4%,rgba(0,174,220,.16),transparent 32%),
    radial-gradient(circle at 94% 0%,rgba(124,58,237,.10),transparent 30%),
    linear-gradient(135deg,#F8FCFF 0%,#EAF7FF 52%,#EDF0FF 100%)!important;
}

/* Tarjetas: elimina el efecto crema apagado cuando no se lee. */
.app-shell[data-rc-theme] .studio-panel,
.app-shell[data-rc-theme] .landing-feature-pro,
.app-shell[data-rc-theme] .landing-nav-card,
.app-shell[data-rc-theme] .modal-panel-pro,
.app-shell[data-rc-theme] .news-short,
.rc-standalone-shell[data-rc-theme] .studio-panel,
.rc-standalone-shell[data-rc-theme] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme] .landing-nav-card,
.rc-standalone-shell[data-rc-theme] .modal-panel-pro{
  background:var(--rc-panel-fun)!important;
  border:1px solid var(--rc-border)!important;
  color:var(--rc-text)!important;
  box-shadow:var(--rc-shadow),inset 0 1px 0 rgba(255,255,255,.10)!important;
  backdrop-filter:var(--rc-glass-blur)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel,
.app-shell[data-rc-theme="day"] .landing-feature-pro,
.app-shell[data-rc-theme="day"] .landing-nav-card,
.app-shell[data-rc-theme="day"] .modal-panel-pro{
  box-shadow:var(--rc-shadow),inset 0 1px 0 rgba(255,255,255,.88)!important;
}

/* Texto fuerte y legible: corrige estilos inline marrones/crema demasiado débiles. */
.app-shell[data-rc-theme] .page-content-pro :where(h1,h2,h3,h4,h5,p,div,span,label,small,strong,b),
.rc-standalone-shell[data-rc-theme] :where(h1,h2,h3,h4,h5,p,div,span,label,small,strong,b){
  text-shadow:none!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro :where(h1,h2,h3,h4,h5,strong,b),
.rc-standalone-shell[data-rc-theme="night"] :where(h1,h2,h3,h4,h5,strong,b){
  color:var(--rc-text-strong)!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(p,div,span,label,small){
  color:var(--rc-text)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel :where(p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-feature-pro :where(p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-nav-card :where(p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="day"] .studio-panel :where(p,div,span,label,small){
  color:var(--rc-text)!important;
}

/* Botones y pestañas: estilo cristal dental, azul/cian/morado. */
.app-shell[data-rc-theme] .bp,
.rc-standalone-shell[data-rc-theme] .bp,
.app-shell[data-rc-theme] button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme] button:not(.nav-tab-pro):not(.header-action-pro){
  border:1px solid var(--rc-border-strong)!important;
  color:var(--rc-text-strong)!important;
  background:linear-gradient(135deg,color-mix(in srgb,var(--rc-primary) 22%,transparent),color-mix(in srgb,var(--rc-accent2) 18%,transparent)),var(--rc-card-strong)!important;
  box-shadow:0 14px 32px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.12)!important;
}
.app-shell[data-rc-theme="day"] .bp,
.rc-standalone-shell[data-rc-theme="day"] .bp,
.app-shell[data-rc-theme="day"] button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="day"] button:not(.nav-tab-pro):not(.header-action-pro){
  color:#0F2033!important;
  box-shadow:0 14px 30px rgba(40,88,126,.16),inset 0 1px 0 rgba(255,255,255,.82)!important;
}
.app-shell[data-rc-theme] button[disabled],
.rc-standalone-shell[data-rc-theme] button[disabled]{
  opacity:.55!important;
  filter:grayscale(.15)!important;
  cursor:not-allowed!important;
}

/* Header y navegación: más ChatGPT-like, menos verde/marrón. */
.app-shell[data-rc-theme] .app-header-pro{
  background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.035)),var(--rc-card-strong)!important;
  border:1px solid var(--rc-border)!important;
  border-top:0!important;
  box-shadow:0 22px 60px rgba(0,0,0,.32),inset 0 -1px 0 var(--rc-border-strong)!important;
}
.app-shell[data-rc-theme] .bottom-nav-pro{
  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.035)),var(--rc-card-strong)!important;
  border:1px solid var(--rc-border)!important;
  box-shadow:0 -22px 58px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.12)!important;
}
.app-shell[data-rc-theme] .header-action-pro,
.app-shell[data-rc-theme] .theme-toggle-pro{
  background:linear-gradient(135deg,rgba(69,217,255,.18),rgba(155,114,255,.14))!important;
  border:1px solid var(--rc-border-strong)!important;
  color:var(--rc-text-strong)!important;
}
.app-shell[data-rc-theme] .nav-icon-pro{
  color:var(--rc-text-strong)!important;
}
.app-shell[data-rc-theme] .nav-tab-pro span{
  color:var(--rc-muted)!important;
  font-weight:950!important;
}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"] span{
  color:var(--rc-text-strong)!important;
}
.app-shell[data-rc-theme] .nav-tab-pro[data-active="true"] .nav-icon-pro{
  background:linear-gradient(135deg,var(--rc-primary),var(--rc-accent2))!important;
  color:#fff!important;
}

/* Inputs y selects: lectura limpia. */
.app-shell[data-rc-theme] input,
.app-shell[data-rc-theme] select,
.app-shell[data-rc-theme] textarea,
.rc-standalone-shell[data-rc-theme] input,
.rc-standalone-shell[data-rc-theme] select,
.rc-standalone-shell[data-rc-theme] textarea{
  background:var(--rc-card-strong)!important;
  color:var(--rc-text)!important;
  border:1px solid var(--rc-border-strong)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.app-shell[data-rc-theme="day"] input,
.app-shell[data-rc-theme="day"] select,
.app-shell[data-rc-theme="day"] textarea{
  background:#FFFFFF!important;
  color:#0F2033!important;
}
.app-shell[data-rc-theme="night"] input::placeholder,
.app-shell[data-rc-theme="night"] textarea::placeholder{color:#8FA9C0!important}
.app-shell[data-rc-theme="day"] input::placeholder,
.app-shell[data-rc-theme="day"] textarea::placeholder{color:#6B8295!important}

/* Tycoon: mapa y salas con cristal moderno. */
.rc-standalone-shell[data-rc-theme] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme] .tycoon-map-board,
.app-shell[data-rc-theme] .tycoon-map-card,
.app-shell[data-rc-theme] .tycoon-map-board{
  background:linear-gradient(145deg,var(--rc-card-strong),var(--rc-card-soft))!important;
  border:1px solid var(--rc-border-strong)!important;
  color:var(--rc-text)!important;
  box-shadow:var(--rc-shadow)!important;
}
.rc-standalone-shell[data-rc-theme] .tycoon-map-card *,
.rc-standalone-shell[data-rc-theme] .tycoon-map-board *,
.app-shell[data-rc-theme] .tycoon-map-card *,
.app-shell[data-rc-theme] .tycoon-map-board *{
  color:var(--rc-text)!important;
}
.rc-standalone-shell[data-rc-theme] .tycoon-map-board button,
.app-shell[data-rc-theme] .tycoon-map-board button{
  background:linear-gradient(145deg,rgba(69,217,255,.14),rgba(155,114,255,.12)),var(--rc-card-strong)!important;
  border:1px solid var(--rc-border)!important;
}
.rc-standalone-shell[data-rc-theme="day"] .tycoon-map-board *,
.app-shell[data-rc-theme="day"] .tycoon-map-board *{
  color:#0F2033!important;
}

/* Badges y chips: evita crema con texto invisible. */
.app-shell[data-rc-theme] [style*="borderRadius:999"],
.rc-standalone-shell[data-rc-theme] [style*="borderRadius:999"],
.app-shell[data-rc-theme] [style*="border-radius:999"],
.rc-standalone-shell[data-rc-theme] [style*="border-radius:999"]{
  color:var(--rc-text-strong)!important;
}
.app-shell[data-rc-theme="day"] [style*="borderRadius:999"],
.rc-standalone-shell[data-rc-theme="day"] [style*="borderRadius:999"],
.app-shell[data-rc-theme="day"] [style*="border-radius:999"],
.rc-standalone-shell[data-rc-theme="day"] [style*="border-radius:999"]{
  color:#0F2033!important;
}

/* Quita brillos excesivos en tarjetas grandes para que no parezcan intermitentes. */
.app-shell[data-rc-theme] .studio-panel:after,
.rc-standalone-shell[data-rc-theme] .studio-panel:after{
  opacity:.16!important;
}
.app-shell[data-rc-theme] .tycoon-map-card:after,
.app-shell[data-rc-theme] .tycoon-map-board:after,
.rc-standalone-shell[data-rc-theme] .tycoon-map-card:after,
.rc-standalone-shell[data-rc-theme] .tycoon-map-board:after{
  display:none!important;
  animation:none!important;
}

/* Móvil: botones compactos para no saturar la cabecera. */
@media (max-width:520px){
  .app-shell[data-rc-theme] .theme-toggle-pro .theme-word{display:none!important}
  .app-shell[data-rc-theme] .header-action-pro{padding:6px 8px!important}
}


/* ===== FASE104: modo noche estilo LOGIN cálido + cristal moderno ===== */
/* Cambia la paleta azul clínica por la del login: negro café, oro crema, verde rasta apagado y rojo vino. */
body[data-rc-theme="night"]{
  color-scheme:dark;
  background:
    radial-gradient(circle at 50% 12%,rgba(212,175,55,.22),transparent 30%),
    radial-gradient(circle at 12% 80%,rgba(47,107,66,.22),transparent 28%),
    radial-gradient(circle at 88% 76%,rgba(167,40,34,.18),transparent 26%),
    linear-gradient(180deg,#050403 0%,#130B06 48%,#080604 100%)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#050403;
  --rc-bg-b:#130B06;
  --rc-bg-c:#080604;
  --rc-card:rgba(19,11,6,.82);
  --rc-card-strong:rgba(28,16,9,.94);
  --rc-card-soft:rgba(42,25,14,.86);
  --rc-panel-fun:linear-gradient(145deg,rgba(18,10,6,.92),rgba(36,20,11,.86));
  --rc-frost:linear-gradient(145deg,rgba(255,244,214,.105),rgba(255,255,255,.028));
  --rc-text:#F5E6C8;
  --rc-text-strong:#FFF4D6;
  --rc-muted:#D7C49A;
  --rc-subtle:#A79068;
  --rc-cream:#FFF4D6;
  --rc-panel-lite:rgba(44,26,14,.92);
  --rc-border:rgba(216,190,135,.22);
  --rc-border-strong:rgba(185,154,69,.48);
  --rc-primary:#D4AF37;
  --rc-primary-2:#B99A45;
  --rc-accent2:#4F602D;
  --rc-accent3:#A72822;
  --rc-accent-warm:#F0D69C;
  --rc-danger:#E85B76;
  --rc-shadow:0 28px 84px rgba(0,0,0,.56);
  --rc-inner:inset 0 1px 0 rgba(255,244,214,.12);
  background:
    radial-gradient(circle at 50% 12%,rgba(212,175,55,.20),transparent 30%),
    radial-gradient(circle at 12% 80%,rgba(47,107,66,.18),transparent 28%),
    radial-gradient(circle at 88% 76%,rgba(167,40,34,.16),transparent 26%),
    linear-gradient(180deg,#050403 0%,#130B06 48%,#080604 100%)!important;
  color:var(--rc-text)!important;
}

/* Fondo interior de la app con el mismo aire del login, pero más glass y más legible. */
.app-shell[data-rc-theme="night"]:before,.rc-standalone-shell[data-rc-theme="night"]:before{
  background:
    radial-gradient(circle at 18% 14%,rgba(212,175,55,.18),transparent 30%),
    radial-gradient(circle at 82% 8%,rgba(79,96,45,.16),transparent 28%),
    radial-gradient(circle at 76% 78%,rgba(167,40,34,.12),transparent 30%),
    repeating-linear-gradient(135deg,rgba(255,244,214,.035) 0 1px,transparent 1px 18px)!important;
  opacity:.95!important;
}

/* Header y nav: negro cristal + borde oro, como extensión del login. */
.app-shell[data-rc-theme="night"] .app-header-pro,
.app-shell[data-rc-theme="night"] .bottom-nav-pro{
  background:
    linear-gradient(135deg,rgba(255,244,214,.10),rgba(255,255,255,.025)),
    rgba(19,11,6,.82)!important;
  border-color:rgba(216,190,135,.22)!important;
  box-shadow:0 20px 58px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,244,214,.10)!important;
  backdrop-filter:blur(24px) saturate(1.20)!important;
}
.app-shell[data-rc-theme="night"] .app-header-pro{
  border-top:0!important;
  box-shadow:0 18px 42px rgba(0,0,0,.42),inset 0 -1px 0 rgba(216,190,135,.20)!important;
}

/* Tarjetas oscuras legibles, no azuladas. */
.app-shell[data-rc-theme="night"] .studio-panel,
.app-shell[data-rc-theme="night"] .landing-feature-pro,
.app-shell[data-rc-theme="night"] .landing-nav-card,
.app-shell[data-rc-theme="night"] .modal-panel-pro,
.app-shell[data-rc-theme="night"] .news-short,
.rc-standalone-shell[data-rc-theme="night"] .studio-panel,
.rc-standalone-shell[data-rc-theme="night"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="night"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="night"] .modal-panel-pro{
  background:
    linear-gradient(145deg,rgba(255,244,214,.075),rgba(255,244,214,.025)),
    rgba(19,11,6,.86)!important;
  border:1px solid rgba(216,190,135,.22)!important;
  color:#F5E6C8!important;
  box-shadow:0 22px 62px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,244,214,.09)!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b){
  color:#FFF4D6!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(p,div,span,label,small){
  color:#F5E6C8!important;
}

/* Botones en modo noche: oro/crema con profundidad, no cian. */
.app-shell[data-rc-theme="night"] .bp,
.rc-standalone-shell[data-rc-theme="night"] .bp,
.app-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro){
  background:
    linear-gradient(135deg,rgba(212,175,55,.22),rgba(79,96,45,.12)),
    rgba(28,16,9,.88)!important;
  border:1px solid rgba(216,190,135,.34)!important;
  color:#FFF4D6!important;
  box-shadow:0 14px 34px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,244,214,.12)!important;
}
.app-shell[data-rc-theme="night"] .bp:hover,
.rc-standalone-shell[data-rc-theme="night"] .bp:hover,
.app-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro):hover,
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro):hover{
  background:
    linear-gradient(135deg,rgba(212,175,55,.32),rgba(167,40,34,.16)),
    rgba(36,20,11,.92)!important;
}

/* Botón día/noche y sonido: mismo estilo que login, pero moderno. */
.app-shell[data-rc-theme="night"] .header-action-pro,
.app-shell[data-rc-theme="night"] .theme-toggle-pro{
  background:linear-gradient(135deg,rgba(255,244,214,.14),rgba(212,175,55,.12))!important;
  border:1px solid rgba(216,190,135,.26)!important;
  color:#FFF4D6!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro{
  color:#F5E6C8!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro span{
  color:#D7C49A!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro[data-active="true"]{
  background:linear-gradient(135deg,rgba(212,175,55,.16),rgba(255,244,214,.06))!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro[data-active="true"] span{
  color:#FFF4D6!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro[data-active="true"] .nav-icon-pro{
  background:linear-gradient(135deg,#6B4D1F,#B99A45 62%,#D8BE87)!important;
  color:#120806!important;
}

/* Inputs oscuros tipo login. */
.app-shell[data-rc-theme="night"] input,
.app-shell[data-rc-theme="night"] select,
.app-shell[data-rc-theme="night"] textarea,
.rc-standalone-shell[data-rc-theme="night"] input,
.rc-standalone-shell[data-rc-theme="night"] select,
.rc-standalone-shell[data-rc-theme="night"] textarea{
  background:rgba(8,6,4,.70)!important;
  color:#FFF4D6!important;
  border:1px solid rgba(216,190,135,.26)!important;
}
.app-shell[data-rc-theme="night"] input::placeholder,
.app-shell[data-rc-theme="night"] textarea::placeholder{
  color:rgba(245,230,200,.58)!important;
}

/* Tycoon en noche también cálido, para que no choque con la web. */
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board,
.app-shell[data-rc-theme="night"] .tycoon-map-card,
.app-shell[data-rc-theme="night"] .tycoon-map-board{
  background:
    radial-gradient(circle at 20% 8%,rgba(212,175,55,.16),transparent 30%),
    linear-gradient(145deg,rgba(19,11,6,.92),rgba(36,20,11,.86))!important;
  border:1px solid rgba(216,190,135,.26)!important;
  color:#FFF4D6!important;
  box-shadow:0 26px 78px rgba(0,0,0,.52)!important;
}
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card *,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board *,
.app-shell[data-rc-theme="night"] .tycoon-map-card *,
.app-shell[data-rc-theme="night"] .tycoon-map-board *{
  color:#FFF4D6!important;
}

/* Modo día queda limpio, pero lo acercamos menos a azul chillón y más crema clara del login. */
body[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 50% 12%,rgba(212,175,55,.14),transparent 30%),
    radial-gradient(circle at 12% 80%,rgba(47,107,66,.10),transparent 28%),
    radial-gradient(circle at 88% 76%,rgba(167,40,34,.08),transparent 26%),
    linear-gradient(180deg,#FFF9EF 0%,#FAF2E3 52%,#F1E6D7 100%)!important;
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#FFF9EF;
  --rc-bg-b:#FAF2E3;
  --rc-bg-c:#F1E6D7;
  --rc-primary:#8A5A2E;
  --rc-primary-2:#B99A45;
  --rc-accent2:#4F602D;
  --rc-accent3:#A72822;
  --rc-border:rgba(138,90,46,.18);
  --rc-border-strong:rgba(185,154,69,.42);
}


/* ===== FASE105: noche verde legible + día pastel alegre ===== */
/* NOCHE: verde/negro tipo login, pero tarjetas y bocadillos crema para leer bien. */
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#040704;
  --rc-bg-b:#07120B;
  --rc-bg-c:#102617;

  --rc-card:rgba(246,229,194,.94);
  --rc-card-strong:rgba(255,242,210,.98);
  --rc-card-soft:rgba(233,210,165,.92);
  --rc-panel-fun:linear-gradient(145deg,rgba(255,244,214,.97),rgba(232,211,162,.92));
  --rc-frost:linear-gradient(145deg,rgba(255,244,214,.94),rgba(232,211,162,.80));

  --rc-text:#1B1208;
  --rc-text-strong:#100903;
  --rc-muted:#4B3620;
  --rc-subtle:#665138;

  --rc-border:rgba(235,202,123,.42);
  --rc-border-strong:rgba(244,210,126,.66);
  --rc-primary:#78C878;
  --rc-primary-2:#2F8F5B;
  --rc-accent2:#D6B15A;
  --rc-accent3:#A94433;
  --rc-accent-warm:#F0C66E;
  --rc-danger:#8F2E24;

  --rc-cream:#FFF4D6;
  --rc-panel-lite:#E8D3A2;
  --rc-shadow:0 26px 78px rgba(0,0,0,.48);
  --rc-inner:inset 0 1px 0 rgba(255,255,255,.52);
}
body[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 14% 0%,rgba(120,200,120,.22),transparent 30%),
    radial-gradient(circle at 86% 2%,rgba(214,177,90,.16),transparent 30%),
    radial-gradient(circle at 52% 110%,rgba(169,68,51,.11),transparent 38%),
    linear-gradient(135deg,#030503 0%,#07120B 46%,#102617 100%)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 12% 2%,rgba(120,200,120,.20),transparent 31%),
    radial-gradient(circle at 88% 0%,rgba(214,177,90,.14),transparent 28%),
    radial-gradient(circle at 50% 112%,rgba(169,68,51,.10),transparent 44%),
    linear-gradient(135deg,#030503,#07120B 50%,#102617)!important;
}

/* En modo noche, los contenedores principales vuelven a crema/cálido con letras oscuras. */
.app-shell[data-rc-theme="night"] .studio-panel,
.app-shell[data-rc-theme="night"] .landing-feature-pro,
.app-shell[data-rc-theme="night"] .landing-nav-card,
.app-shell[data-rc-theme="night"] .modal-panel-pro,
.app-shell[data-rc-theme="night"] .news-short,
.rc-standalone-shell[data-rc-theme="night"] .studio-panel,
.rc-standalone-shell[data-rc-theme="night"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="night"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="night"] .modal-panel-pro{
  background:linear-gradient(145deg,rgba(255,244,214,.97),rgba(232,211,162,.91))!important;
  color:#1B1208!important;
  border:1.5px solid rgba(244,210,126,.62)!important;
  box-shadow:0 18px 48px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.72)!important;
  backdrop-filter:blur(22px) saturate(1.12)!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .modal-panel-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small){
  color:#1B1208!important;
  text-shadow:none!important;
}

/* Header/nav noche: oscuros y verdes, para no blanquear toda la pantalla. */
.app-shell[data-rc-theme="night"] .app-header-pro,
.app-shell[data-rc-theme="night"] .bottom-nav-pro{
  background:linear-gradient(135deg,rgba(255,244,214,.10),rgba(255,244,214,.035)),rgba(5,16,9,.86)!important;
  border-color:rgba(244,210,126,.34)!important;
  box-shadow:0 22px 60px rgba(0,0,0,.40),inset 0 1px 0 rgba(255,244,214,.12)!important;
}
.app-shell[data-rc-theme="night"] .app-header-pro *,
.app-shell[data-rc-theme="night"] .bottom-nav-pro *,
.app-shell[data-rc-theme="night"] .header-action-pro,
.app-shell[data-rc-theme="night"] .theme-toggle-pro{
  color:#FFF4D6!important;
}
.app-shell[data-rc-theme="night"] .header-action-pro,
.app-shell[data-rc-theme="night"] .theme-toggle-pro{
  background:linear-gradient(135deg,rgba(120,200,120,.20),rgba(214,177,90,.12))!important;
  border:1px solid rgba(244,210,126,.35)!important;
}

/* Botones dentro de tarjetas crema: verdes/dorados con contraste. */
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro){
  background:linear-gradient(135deg,#1D6B43,#78C878 58%,#D6B15A)!important;
  color:#FFF8E8!important;
  border:1px solid rgba(255,244,214,.46)!important;
  text-shadow:0 1px 2px rgba(0,0,0,.35)!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro) *,
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro) *{
  color:#FFF8E8!important;
}

/* Tycoon noche: paneles de interfaz crema, pero escenario oscuro mantiene ambiente de juego. */
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board,
.app-shell[data-rc-theme="night"] .tycoon-map-card,
.app-shell[data-rc-theme="night"] .tycoon-map-board{
  background:linear-gradient(145deg,rgba(255,244,214,.97),rgba(232,211,162,.91))!important;
  color:#1B1208!important;
  border:1.5px solid rgba(244,210,126,.62)!important;
}
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card *,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board *,
.app-shell[data-rc-theme="night"] .tycoon-map-card *,
.app-shell[data-rc-theme="night"] .tycoon-map-board *{
  color:#1B1208!important;
}

/* DÍA: menos blanco, más pastel alegre con profundidad. */
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#FFF2D9;
  --rc-bg-b:#FFE9EF;
  --rc-bg-c:#E9F7FF;

  --rc-card:rgba(255,248,232,.88);
  --rc-card-strong:rgba(255,252,242,.97);
  --rc-card-soft:rgba(255,235,232,.82);
  --rc-panel-fun:linear-gradient(145deg,rgba(255,252,242,.96),rgba(255,232,226,.86) 54%,rgba(232,247,255,.78));
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.84),rgba(255,233,239,.58));

  --rc-text:#241609;
  --rc-text-strong:#120A03;
  --rc-muted:#65492E;
  --rc-subtle:#7A6A5A;

  --rc-border:rgba(219,151,75,.28);
  --rc-border-strong:rgba(244,180,95,.50);
  --rc-primary:#F29D38;
  --rc-primary-2:#FF6F91;
  --rc-accent2:#8E75FF;
  --rc-accent3:#37B982;
  --rc-accent-warm:#FFD166;
  --rc-danger:#C44536;

  --rc-shadow:0 24px 68px rgba(158,96,76,.16);
}
body[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 12% -3%,rgba(255,209,102,.34),transparent 30%),
    radial-gradient(circle at 82% 0%,rgba(255,111,145,.22),transparent 28%),
    radial-gradient(circle at 50% 105%,rgba(55,185,130,.14),transparent 36%),
    linear-gradient(135deg,#FFF2D9 0%,#FFE9EF 48%,#E9F7FF 100%)!important;
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 12% 2%,rgba(255,209,102,.28),transparent 30%),
    radial-gradient(circle at 88% 0%,rgba(255,111,145,.20),transparent 28%),
    radial-gradient(circle at 50% 112%,rgba(55,185,130,.12),transparent 44%),
    linear-gradient(135deg,#FFF2D9,#FFE9EF 50%,#E9F7FF)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel,
.app-shell[data-rc-theme="day"] .landing-feature-pro,
.app-shell[data-rc-theme="day"] .landing-nav-card,
.app-shell[data-rc-theme="day"] .modal-panel-pro,
.app-shell[data-rc-theme="day"] .news-short,
.rc-standalone-shell[data-rc-theme="day"] .studio-panel,
.rc-standalone-shell[data-rc-theme="day"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="day"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="day"] .modal-panel-pro{
  background:linear-gradient(145deg,rgba(255,252,242,.96),rgba(255,232,226,.84) 58%,rgba(232,247,255,.75))!important;
  color:#241609!important;
  border:1px solid rgba(244,180,95,.36)!important;
  box-shadow:0 18px 44px rgba(158,96,76,.14),inset 0 1px 0 rgba(255,255,255,.86)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="day"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small){
  color:#241609!important;
}
.app-shell[data-rc-theme="day"] .app-header-pro,
.app-shell[data-rc-theme="day"] .bottom-nav-pro{
  background:linear-gradient(135deg,rgba(255,255,255,.72),rgba(255,233,239,.38)),rgba(255,248,232,.72)!important;
  border-color:rgba(244,180,95,.34)!important;
}
.app-shell[data-rc-theme="day"] .header-action-pro,
.app-shell[data-rc-theme="day"] .theme-toggle-pro{
  background:linear-gradient(135deg,rgba(255,209,102,.32),rgba(255,111,145,.18))!important;
  border:1px solid rgba(244,180,95,.38)!important;
  color:#241609!important;
}
.app-shell[data-rc-theme="day"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="day"] button:not(.nav-tab-pro):not(.header-action-pro){
  background:linear-gradient(135deg,#FFD166,#FF9F6E 52%,#FF6F91)!important;
  color:#241609!important;
  border:1px solid rgba(255,255,255,.72)!important;
  text-shadow:none!important;
}

/* Pequeño movimiento alegre del modo día sin molestar. */
@media (prefers-reduced-motion:no-preference){
  body[data-rc-theme="day"]:before{
    animation:bgDriftPro 12s ease-in-out infinite!important;
  }
  .app-shell[data-rc-theme="day"] .landing-nav-card:hover,
  .app-shell[data-rc-theme="day"] .studio-panel:hover{
    transform:translateY(-4px) scale(1.012)!important;
    filter:saturate(1.08) brightness(1.02)!important;
  }
}

/* Ajuste de chips/burbujas: crema y texto oscuro en ambos modos cuando estén dentro del contenido. */
.app-shell[data-rc-theme] .page-content-pro [style*="borderRadius:999"],
.rc-standalone-shell[data-rc-theme] [style*="borderRadius:999"],
.app-shell[data-rc-theme] .page-content-pro [style*="border-radius:999"],
.rc-standalone-shell[data-rc-theme] [style*="border-radius:999"]{
  background:rgba(255,244,214,.92)!important;
  color:#1B1208!important;
  border:1px solid rgba(214,177,90,.44)!important;
}
.app-shell[data-rc-theme] .page-content-pro [style*="borderRadius:999"] *,
.rc-standalone-shell[data-rc-theme] [style*="borderRadius:999"] *,
.app-shell[data-rc-theme] .page-content-pro [style*="border-radius:999"] *,
.rc-standalone-shell[data-rc-theme] [style*="border-radius:999"] *{
  color:#1B1208!important;
}

/* Pero no tocar las burbujas de cabecera/nav. */
.app-shell[data-rc-theme] .app-header-pro [style*="borderRadius:999"],
.app-shell[data-rc-theme] .bottom-nav-pro [style*="borderRadius:999"]{
  background:rgba(255,255,255,.16)!important;
  color:#FFF4D6!important;
}
.app-shell[data-rc-theme="day"] .app-header-pro [style*="borderRadius:999"],
.app-shell[data-rc-theme="day"] .bottom-nav-pro [style*="borderRadius:999"]{
  color:#241609!important;
}


/* ===== FASE106: reggae cyber night + burbujas blancas legibles + login cyberpunk ===== */
/* Modo noche: fondo verde reggae más vivo, tarjetas gris-verde con letra blanca, chips/burbujas blancos. */
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --rc-bg-a:#030704;
  --rc-bg-b:#07140A;
  --rc-bg-c:#12341E;

  --rc-card:rgba(28,52,42,.88);
  --rc-card-strong:rgba(34,66,52,.96);
  --rc-card-soft:rgba(48,78,61,.90);
  --rc-panel-fun:linear-gradient(145deg,rgba(30,58,46,.96),rgba(42,72,56,.91));
  --rc-frost:linear-gradient(145deg,rgba(255,255,255,.13),rgba(120,200,120,.06));

  --rc-text:#F8FFF5;
  --rc-text-strong:#FFFFFF;
  --rc-muted:#D8EBDD;
  --rc-subtle:#B8D0BD;

  --rc-border:rgba(255,216,102,.32);
  --rc-border-strong:rgba(255,216,102,.58);
  --rc-primary:#64D86B;
  --rc-primary-2:#2AAE65;
  --rc-accent2:#FFD23F;
  --rc-accent3:#E53935;
  --rc-accent-warm:#FFB703;
  --rc-danger:#FF4D4D;

  --rc-chip-bg:#FFF7E6;
  --rc-chip-text:#172112;
  --rc-shadow:0 26px 78px rgba(0,0,0,.54);
}
body[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 12% -4%,rgba(100,216,107,.30),transparent 31%),
    radial-gradient(circle at 88% 2%,rgba(255,210,63,.18),transparent 30%),
    radial-gradient(circle at 50% 110%,rgba(229,57,53,.13),transparent 40%),
    linear-gradient(135deg,#020403 0%,#07140A 48%,#12341E 100%)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 10% 2%,rgba(100,216,107,.24),transparent 31%),
    radial-gradient(circle at 88% 0%,rgba(255,210,63,.15),transparent 28%),
    radial-gradient(circle at 50% 112%,rgba(229,57,53,.10),transparent 44%),
    linear-gradient(135deg,#020403,#07140A 50%,#12341E)!important;
}

/* Tarjetas principales: gris-verde con texto blanco, NO crema. */
.app-shell[data-rc-theme="night"] .studio-panel,
.app-shell[data-rc-theme="night"] .landing-feature-pro,
.app-shell[data-rc-theme="night"] .landing-nav-card,
.app-shell[data-rc-theme="night"] .modal-panel-pro,
.app-shell[data-rc-theme="night"] .news-short,
.rc-standalone-shell[data-rc-theme="night"] .studio-panel,
.rc-standalone-shell[data-rc-theme="night"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="night"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="night"] .modal-panel-pro{
  background:linear-gradient(145deg,rgba(30,58,46,.96),rgba(42,72,56,.91))!important;
  color:var(--rc-text)!important;
  border:1.5px solid rgba(255,216,102,.36)!important;
  box-shadow:0 20px 54px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.10)!important;
  backdrop-filter:blur(22px) saturate(1.14)!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .modal-panel-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small){
  color:var(--rc-text)!important;
  text-shadow:none!important;
}

/* Burbujas/chips/badges dentro del contenido: blancas/crema con letra oscura. */
.app-shell[data-rc-theme="night"] .page-content-pro [style*="borderRadius:999"],
.rc-standalone-shell[data-rc-theme="night"] [style*="borderRadius:999"],
.app-shell[data-rc-theme="night"] .page-content-pro [style*="border-radius:999"],
.rc-standalone-shell[data-rc-theme="night"] [style*="border-radius:999"],
.app-shell[data-rc-theme="night"] .page-content-pro [class*="badge"],
.rc-standalone-shell[data-rc-theme="night"] [class*="badge"]{
  background:linear-gradient(180deg,#FFFFFF,#FFF2D6)!important;
  color:#172112!important;
  border:1px solid rgba(255,216,102,.50)!important;
  text-shadow:none!important;
  box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.9)!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro [style*="borderRadius:999"] *,
.rc-standalone-shell[data-rc-theme="night"] [style*="borderRadius:999"] *,
.app-shell[data-rc-theme="night"] .page-content-pro [style*="border-radius:999"] *,
.rc-standalone-shell[data-rc-theme="night"] [style*="border-radius:999"] *,
.app-shell[data-rc-theme="night"] .page-content-pro [class*="badge"] *,
.rc-standalone-shell[data-rc-theme="night"] [class*="badge"] *{
  color:#172112!important;
  text-shadow:none!important;
}

/* No tocar los botones/burbujas de cabecera ni nav: esos deben seguir oscuros. */
.app-shell[data-rc-theme="night"] .app-header-pro [style*="borderRadius:999"],
.app-shell[data-rc-theme="night"] .bottom-nav-pro [style*="borderRadius:999"],
.app-shell[data-rc-theme="night"] .app-header-pro [style*="border-radius:999"],
.app-shell[data-rc-theme="night"] .bottom-nav-pro [style*="border-radius:999"]{
  background:rgba(255,255,255,.13)!important;
  color:#FFF7E6!important;
  border-color:rgba(255,216,102,.26)!important;
}
.app-shell[data-rc-theme="night"] .app-header-pro [style*="borderRadius:999"] *,
.app-shell[data-rc-theme="night"] .bottom-nav-pro [style*="borderRadius:999"] *{
  color:#FFF7E6!important;
}

/* Botones modo noche: reggae amarillo/verde con texto fuerte. */
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro){
  background:linear-gradient(135deg,#1F7A45,#64D86B 54%,#FFD23F)!important;
  color:#071108!important;
  border:1px solid rgba(255,247,230,.48)!important;
  text-shadow:none!important;
  font-weight:950!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro) *,
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro) *{
  color:#071108!important;
}

/* Inputs noche: blancos para que se lean fácil. */
.app-shell[data-rc-theme="night"] input,
.app-shell[data-rc-theme="night"] select,
.app-shell[data-rc-theme="night"] textarea,
.rc-standalone-shell[data-rc-theme="night"] input,
.rc-standalone-shell[data-rc-theme="night"] select,
.rc-standalone-shell[data-rc-theme="night"] textarea{
  background:#FFF7E6!important;
  color:#172112!important;
  border:1.5px solid rgba(255,216,102,.58)!important;
}

/* Día: más alegre, menos blanco plano, con pastel reggae suave. */
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#FFF3C9;
  --rc-bg-b:#FFE1E7;
  --rc-bg-c:#DDF8EC;
  --rc-card:rgba(255,248,232,.90);
  --rc-card-strong:rgba(255,253,244,.98);
  --rc-card-soft:rgba(255,229,232,.84);
  --rc-panel-fun:linear-gradient(145deg,rgba(255,253,244,.96),rgba(255,231,218,.86) 46%,rgba(221,248,236,.76));
  --rc-text:#241609;
  --rc-text-strong:#120A03;
  --rc-muted:#5E462B;
  --rc-primary:#F6B443;
  --rc-primary-2:#FF7A7A;
  --rc-accent2:#68C17A;
  --rc-accent3:#A78BFA;
}
body[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 10% -4%,rgba(255,210,63,.34),transparent 31%),
    radial-gradient(circle at 88% 0%,rgba(255,122,122,.24),transparent 29%),
    radial-gradient(circle at 45% 110%,rgba(104,193,122,.20),transparent 38%),
    linear-gradient(135deg,#FFF3C9 0%,#FFE1E7 48%,#DDF8EC 100%)!important;
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 10% 2%,rgba(255,210,63,.30),transparent 30%),
    radial-gradient(circle at 88% 0%,rgba(255,122,122,.22),transparent 28%),
    radial-gradient(circle at 50% 112%,rgba(104,193,122,.17),transparent 44%),
    linear-gradient(135deg,#FFF3C9,#FFE1E7 48%,#DDF8EC)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel,
.app-shell[data-rc-theme="day"] .landing-feature-pro,
.app-shell[data-rc-theme="day"] .landing-nav-card,
.app-shell[data-rc-theme="day"] .modal-panel-pro,
.app-shell[data-rc-theme="day"] .news-short,
.rc-standalone-shell[data-rc-theme="day"] .studio-panel,
.rc-standalone-shell[data-rc-theme="day"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="day"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="day"] .modal-panel-pro{
  background:linear-gradient(145deg,rgba(255,253,244,.97),rgba(255,231,218,.88) 50%,rgba(221,248,236,.78))!important;
  color:#241609!important;
  border:1px solid rgba(255,183,77,.40)!important;
  box-shadow:0 18px 44px rgba(147,92,52,.16),inset 0 1px 0 rgba(255,255,255,.88)!important;
}

/* Login cyberpunk: fondo neón reggae/rojo/amarillo, form legible. */
.login-cyber-shell:before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index:0;
  background:
    linear-gradient(115deg,transparent 0 22%,rgba(100,216,107,.10) 22.3% 22.8%,transparent 23% 100%),
    linear-gradient(0deg,rgba(255,210,63,.055) 1px,transparent 1px),
    linear-gradient(90deg,rgba(100,216,107,.045) 1px,transparent 1px);
  background-size:100% 100%,38px 38px,38px 38px;
  mask-image:linear-gradient(180deg,rgba(0,0,0,.86),rgba(0,0,0,.24));
}
.login-cyber-shell:after{
  content:"";
  position:fixed;
  inset:-25%;
  pointer-events:none;
  z-index:0;
  background:
    radial-gradient(circle at 18% 18%,rgba(100,216,107,.18),transparent 18%),
    radial-gradient(circle at 78% 12%,rgba(255,210,63,.14),transparent 18%),
    radial-gradient(circle at 70% 80%,rgba(229,57,53,.12),transparent 18%);
  filter:blur(18px);
  animation:bgDriftPro 11s ease-in-out infinite;
}
.login-cyber-shell .studio-panel{
  background:linear-gradient(145deg,rgba(255,244,214,.96),rgba(232,211,162,.90))!important;
  border:1.5px solid rgba(255,210,63,.58)!important;
  box-shadow:0 22px 58px rgba(0,0,0,.46),0 0 22px rgba(100,216,107,.16),inset 0 1px 0 rgba(255,255,255,.78)!important;
}
.login-cyber-shell .landing-feature-pro{
  background:linear-gradient(145deg,rgba(15,31,20,.78),rgba(31,72,45,.62))!important;
  color:#FFF7E6!important;
  border:1px solid rgba(255,210,63,.30)!important;
  box-shadow:0 14px 34px rgba(0,0,0,.32),0 0 18px rgba(100,216,107,.10)!important;
}
.login-cyber-shell .landing-feature-pro *{color:#FFF7E6!important}
.login-cyber-shell .bp{
  background:linear-gradient(135deg,#64D86B,#FFD23F 58%,#E53935)!important;
  color:#071108!important;
  border:1px solid rgba(255,247,230,.72)!important;
  box-shadow:0 12px 26px rgba(0,0,0,.28),0 0 18px rgba(100,216,107,.18)!important;
}


/* ===== FASE107: estilo navegador Travian / pergamino oscuro legible ===== */
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  --travian-bg:#10160F;
  --travian-bg2:#1A2417;
  --travian-forest:#263820;
  --travian-panel:#E9D8B4;
  --travian-panel2:#F6E8C8;
  --travian-panel3:#CDB78C;
  --travian-ink:#3A2A18;
  --travian-ink2:#5B4429;
  --travian-border:#8E7957;
  --travian-border2:#5C4A33;
  --travian-green:#5F8E22;
  --travian-green2:#355F18;
  --travian-gold:#D5B24F;
  --travian-gold2:#A77A24;
  --travian-red:#A33A25;

  --rc-bg-a:#10160F;
  --rc-bg-b:#182416;
  --rc-bg-c:#263820;
  --rc-card:rgba(233,216,180,.96);
  --rc-card-strong:rgba(246,232,200,.98);
  --rc-card-soft:rgba(205,183,140,.92);
  --rc-panel-fun:linear-gradient(180deg,#F6E8C8 0%,#E9D8B4 58%,#D4BD8F 100%);
  --rc-frost:linear-gradient(180deg,rgba(246,232,200,.98),rgba(205,183,140,.92));
  --rc-text:#3A2A18;
  --rc-text-strong:#241709;
  --rc-muted:#5B4429;
  --rc-subtle:#725C3F;
  --rc-border:rgba(92,74,51,.42);
  --rc-border-strong:rgba(92,74,51,.72);
  --rc-primary:#5F8E22;
  --rc-primary-2:#355F18;
  --rc-accent2:#D5B24F;
  --rc-accent3:#A33A25;
  --rc-shadow:0 22px 58px rgba(0,0,0,.44);
}
body[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 50% 20%,rgba(126,158,78,.20),transparent 33%),
    radial-gradient(circle at 14% 78%,rgba(38,56,32,.40),transparent 30%),
    radial-gradient(circle at 86% 72%,rgba(10,16,12,.55),transparent 35%),
    linear-gradient(180deg,#0A0E0A 0%,#121A10 48%,#070A07 100%)!important;
}
.app-shell[data-rc-theme="night"],.rc-standalone-shell[data-rc-theme="night"]{
  background:
    radial-gradient(circle at 44% 18%,rgba(126,158,78,.20),transparent 31%),
    radial-gradient(circle at 8% 70%,rgba(38,56,32,.45),transparent 32%),
    radial-gradient(circle at 92% 78%,rgba(12,16,10,.58),transparent 34%),
    linear-gradient(180deg,#0A0E0A 0%,#121A10 52%,#080B07 100%)!important;
}
.app-shell[data-rc-theme="night"]:before,.rc-standalone-shell[data-rc-theme="night"]:before{
  background:
    linear-gradient(0deg,rgba(255,244,214,.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,244,214,.018) 1px,transparent 1px),
    radial-gradient(circle at 50% 30%,rgba(213,178,79,.08),transparent 42%)!important;
  background-size:32px 32px,32px 32px,100% 100%!important;
  opacity:.80!important;
}

/* Paneles principales: pergamino con tinta oscura, como las ventanas de navegador medieval. */
.app-shell[data-rc-theme="night"] .studio-panel,
.app-shell[data-rc-theme="night"] .landing-feature-pro,
.app-shell[data-rc-theme="night"] .landing-nav-card,
.app-shell[data-rc-theme="night"] .modal-panel-pro,
.app-shell[data-rc-theme="night"] .news-short,
.rc-standalone-shell[data-rc-theme="night"] .studio-panel,
.rc-standalone-shell[data-rc-theme="night"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="night"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="night"] .modal-panel-pro{
  background:
    radial-gradient(circle at 20% 0%,rgba(255,255,255,.36),transparent 34%),
    linear-gradient(180deg,#F6E8C8 0%,#E9D8B4 58%,#D4BD8F 100%)!important;
  color:#3A2A18!important;
  border:2px solid #8E7957!important;
  border-radius:14px!important;
  box-shadow:
    0 16px 38px rgba(0,0,0,.42),
    inset 0 1px 0 rgba(255,255,255,.72),
    inset 0 -3px 0 rgba(92,74,51,.16)!important;
  backdrop-filter:none!important;
}
.app-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="night"] .modal-panel-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.rc-standalone-shell[data-rc-theme="night"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small){
  color:#3A2A18!important;
  text-shadow:none!important;
}

/* Header/nav: madera oscura + marcos dorados. */
.app-shell[data-rc-theme="night"] .app-header-pro,
.app-shell[data-rc-theme="night"] .bottom-nav-pro{
  background:
    linear-gradient(180deg,rgba(246,232,200,.10),rgba(0,0,0,.08)),
    linear-gradient(180deg,#4A3522 0%,#241709 100%)!important;
  border:2px solid #8E7957!important;
  box-shadow:0 18px 42px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,244,214,.18)!important;
}
.app-shell[data-rc-theme="night"] .app-header-pro *,
.app-shell[data-rc-theme="night"] .bottom-nav-pro *{
  color:#F6E8C8!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro{
  background:rgba(246,232,200,.08)!important;
  border:1px solid rgba(213,178,79,.24)!important;
  border-radius:12px!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro[data-active="true"]{
  background:linear-gradient(180deg,#6F8E2C,#355F18)!important;
  border-color:#D5B24F!important;
}
.app-shell[data-rc-theme="night"] .nav-tab-pro[data-active="true"] .nav-icon-pro{
  background:linear-gradient(180deg,#D5B24F,#A77A24)!important;
  color:#241709!important;
}

/* Botones: verde de construcción estilo Travian. */
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro),
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro){
  background:linear-gradient(180deg,#7CAE2C 0%,#5F8E22 48%,#355F18 100%)!important;
  color:#FFF7E6!important;
  border:2px solid #8E7957!important;
  border-radius:8px!important;
  text-shadow:0 1px 2px rgba(0,0,0,.45)!important;
  font-weight:950!important;
  box-shadow:0 4px 0 #243D10,0 10px 20px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.35)!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro button:not(.nav-tab-pro):not(.header-action-pro) *,
.rc-standalone-shell[data-rc-theme="night"] button:not(.nav-tab-pro):not(.header-action-pro) *{
  color:#FFF7E6!important;
}

/* Chips/burbujas: pergamino claro con tinta oscura. */
.app-shell[data-rc-theme="night"] .page-content-pro [style*="borderRadius:999"],
.rc-standalone-shell[data-rc-theme="night"] [style*="borderRadius:999"],
.app-shell[data-rc-theme="night"] .page-content-pro [style*="border-radius:999"],
.rc-standalone-shell[data-rc-theme="night"] [style*="border-radius:999"],
.app-shell[data-rc-theme="night"] .page-content-pro [class*="badge"],
.rc-standalone-shell[data-rc-theme="night"] [class*="badge"]{
  background:linear-gradient(180deg,#FFF8E8,#E9D8B4)!important;
  color:#3A2A18!important;
  border:1.5px solid #8E7957!important;
  border-radius:999px!important;
  text-shadow:none!important;
  box-shadow:0 6px 14px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.8)!important;
}
.app-shell[data-rc-theme="night"] .page-content-pro [style*="borderRadius:999"] *,
.rc-standalone-shell[data-rc-theme="night"] [style*="borderRadius:999"] *,
.app-shell[data-rc-theme="night"] .page-content-pro [style*="border-radius:999"] *,
.rc-standalone-shell[data-rc-theme="night"] [style*="border-radius:999"] *,
.app-shell[data-rc-theme="night"] .page-content-pro [class*="badge"] *,
.rc-standalone-shell[data-rc-theme="night"] [class*="badge"] *{
  color:#3A2A18!important;
  text-shadow:none!important;
}

/* Inputs como cajas de pergamino. */
.app-shell[data-rc-theme="night"] input,
.app-shell[data-rc-theme="night"] select,
.app-shell[data-rc-theme="night"] textarea,
.rc-standalone-shell[data-rc-theme="night"] input,
.rc-standalone-shell[data-rc-theme="night"] select,
.rc-standalone-shell[data-rc-theme="night"] textarea{
  background:#FFF8E8!important;
  color:#3A2A18!important;
  border:2px solid #8E7957!important;
  border-radius:8px!important;
}

/* Tycoon: se acerca a mapa/aldea de navegador. */
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board,
.app-shell[data-rc-theme="night"] .tycoon-map-card,
.app-shell[data-rc-theme="night"] .tycoon-map-board{
  background:
    radial-gradient(circle at 50% 25%,rgba(126,158,78,.24),transparent 42%),
    linear-gradient(180deg,#182416 0%,#10160F 100%)!important;
  color:#F6E8C8!important;
  border:2px solid #8E7957!important;
  border-radius:14px!important;
  box-shadow:0 20px 52px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,244,214,.14)!important;
}
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-card *,
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board *,
.app-shell[data-rc-theme="night"] .tycoon-map-card *,
.app-shell[data-rc-theme="night"] .tycoon-map-board *{
  color:#F6E8C8!important;
}
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board button,
.app-shell[data-rc-theme="night"] .tycoon-map-board button{
  background:linear-gradient(180deg,#F6E8C8,#D4BD8F)!important;
  color:#3A2A18!important;
  border:2px solid #8E7957!important;
}
.rc-standalone-shell[data-rc-theme="night"] .tycoon-map-board button *,
.app-shell[data-rc-theme="night"] .tycoon-map-board button *{
  color:#3A2A18!important;
}

/* Modo día: pergamino soleado, no blanco plano. */
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  --rc-bg-a:#E8D8AE;
  --rc-bg-b:#F7EBCB;
  --rc-bg-c:#CFE3B3;
  --rc-card:rgba(248,235,203,.96);
  --rc-card-strong:rgba(255,248,226,.98);
  --rc-panel-fun:linear-gradient(180deg,#FFF8E2 0%,#F8EBCB 60%,#E3CE9D 100%);
  --rc-text:#3A2A18;
  --rc-text-strong:#241709;
  --rc-muted:#5B4429;
  --rc-primary:#6F8E2C;
  --rc-primary-2:#5F8E22;
  --rc-accent2:#D5B24F;
  --rc-accent3:#A33A25;
}
body[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 46% 14%,rgba(213,178,79,.30),transparent 34%),
    radial-gradient(circle at 16% 78%,rgba(126,158,78,.22),transparent 30%),
    linear-gradient(180deg,#E8D8AE 0%,#F7EBCB 46%,#CFE3B3 100%)!important;
}
.app-shell[data-rc-theme="day"],.rc-standalone-shell[data-rc-theme="day"]{
  background:
    radial-gradient(circle at 46% 14%,rgba(213,178,79,.26),transparent 34%),
    radial-gradient(circle at 16% 78%,rgba(126,158,78,.20),transparent 30%),
    linear-gradient(180deg,#E8D8AE 0%,#F7EBCB 48%,#CFE3B3 100%)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel,
.app-shell[data-rc-theme="day"] .landing-feature-pro,
.app-shell[data-rc-theme="day"] .landing-nav-card,
.app-shell[data-rc-theme="day"] .modal-panel-pro,
.app-shell[data-rc-theme="day"] .news-short,
.rc-standalone-shell[data-rc-theme="day"] .studio-panel,
.rc-standalone-shell[data-rc-theme="day"] .landing-feature-pro,
.rc-standalone-shell[data-rc-theme="day"] .landing-nav-card,
.rc-standalone-shell[data-rc-theme="day"] .modal-panel-pro{
  background:linear-gradient(180deg,#FFF8E2 0%,#F8EBCB 60%,#E3CE9D 100%)!important;
  color:#3A2A18!important;
  border:2px solid #A28A61!important;
  border-radius:14px!important;
  box-shadow:0 16px 34px rgba(92,74,51,.18),inset 0 1px 0 rgba(255,255,255,.78)!important;
}
.app-shell[data-rc-theme="day"] .studio-panel :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-feature-pro :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small),
.app-shell[data-rc-theme="day"] .landing-nav-card :where(h1,h2,h3,h4,h5,strong,b,p,div,span,label,small){
  color:#3A2A18!important;
}

/* Login: estilo aldea/juego navegador con toque Rasta. */
.login-cyber-shell{
  background:
    radial-gradient(circle at 50% 14%,rgba(213,178,79,.22),transparent 32%),
    radial-gradient(circle at 12% 80%,rgba(95,142,34,.26),transparent 28%),
    radial-gradient(circle at 88% 76%,rgba(163,58,37,.14),transparent 28%),
    linear-gradient(180deg,#080C07,#121A10 48%,#050704)!important;
}
.login-cyber-shell:before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index:0;
  background:
    linear-gradient(0deg,rgba(255,244,214,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,244,214,.025) 1px,transparent 1px),
    radial-gradient(circle at 50% 30%,rgba(213,178,79,.10),transparent 42%);
  background-size:36px 36px,36px 36px,100% 100%;
  opacity:.80;
}
.login-cyber-shell .studio-panel{
  background:linear-gradient(180deg,#FFF8E2 0%,#F8EBCB 58%,#E3CE9D 100%)!important;
  color:#3A2A18!important;
  border:2px solid #8E7957!important;
  border-radius:14px!important;
  box-shadow:0 22px 58px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.78)!important;
}
.login-cyber-shell .studio-panel *{color:#3A2A18!important}
.login-cyber-shell .landing-feature-pro{
  background:linear-gradient(180deg,#F6E8C8,#D4BD8F)!important;
  color:#3A2A18!important;
  border:2px solid #8E7957!important;
}
.login-cyber-shell .landing-feature-pro *{color:#3A2A18!important}
.login-cyber-shell .bp{
  background:linear-gradient(180deg,#7CAE2C 0%,#5F8E22 50%,#355F18 100%)!important;
  color:#FFF7E6!important;
  border:2px solid #8E7957!important;
}


/* ===== FASE108: navegación fija, Rasta helper limpio, cartera/carrito/notificaciones ===== */
.bottom-nav-pro{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:0!important;
  transform:translateX(-50%)!important;
  width:min(100vw,var(--app-max-width,480px))!important;
  max-width:var(--app-max-width,480px)!important;
  padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;
  z-index:1200!important;
}
.app-shell{
  padding-bottom:calc(var(--app-bottom-pad,82px) + env(safe-area-inset-bottom,0px))!important;
}
.page-content-pro{
  padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))!important;
}
.brand-home-button:hover .brand-scissors{
  transform:rotate(-10deg) scale(1.12);
  filter:drop-shadow(0 0 8px rgba(213,178,79,.55));
}
.brand-scissors{
  transition:transform .18s ease,filter .18s ease;
}
.rasta-face-avatar{
  isolation:isolate;
}
.rasta-face-avatar > div:first-child{
  filter:drop-shadow(0 10px 18px rgba(0,0,0,.25));
}
.wallet-button-pro,.cart-button-pro{
  display:inline-grid!important;
  place-items:center!important;
}
@media (max-width:520px){
  .wallet-button-pro,.cart-button-pro{padding:5px 7px!important;font-size:.82rem!important}
  .app-header-pro{gap:6px!important;padding:10px 10px!important}
  .app-header-pro .theme-word{display:none!important}
}


/* ===== FASE109: tienda personalización avatar/perfil + carrito funcional base ===== */
.cart-button-pro{position:relative}
.app-shell[data-rc-theme] .page-content-pro .shop-avatar-tag{
  background:linear-gradient(180deg,#FFF8E8,#E9D8B4)!important;
  color:#3A2A18!important;
}

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
  return <div className="modal-overlay-pro" style={{position:"fixed",inset:0,background:"rgba(10,7,4,0.62)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:24}} onClick={onClose}>
    <div className="modal-panel-pro" onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:"24px 24px 0 0",padding:"18px 16px calc(112px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.28s ease",maxHeight:"calc(100dvh - 24px)",overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",boxShadow:"0 -18px 42px rgba(0,0,0,.28)"}}>
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
  const nivel=pts>=1000?"VIP":pts>=500?"Oro":pts>=200?"Plata":"Bronce";
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

const WEB_POINTS_DAILY_NORMAL_CAP=50;
const PERSONALIZATION_SHOP_EXTRA=[
  {id:"title_fresh_cut",item_key:"title_fresh_cut",icono:"🏷️",nombre:"Título: Corte Fresco",descripcion:"Título visible para tu perfil. Personalización web, no Tycoon.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Corte Fresco",puntos_precio:180,rareza:"comun",activo:true,stock:null},
  {id:"title_barrio_vip",item_key:"title_barrio_vip",icono:"👑",nombre:"Título: Barrio VIP",descripcion:"Título premium para perfiles con flow.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Barrio VIP",puntos_precio:650,rareza:"epico",activo:true,stock:null},
  {id:"name_gold",item_key:"name_gold",icono:"✨",nombre:"Nombre dorado",descripcion:"Color especial para destacar tu nombre en perfil y comunidad.",categoria:"avatar",tipo:"perfil_color",slot:"nameColor",valor:"gold",puntos_precio:420,rareza:"raro",activo:true,stock:null},
  {id:"name_green",item_key:"name_green",icono:"🟢",nombre:"Nombre verde rasta",descripcion:"Color verde para tu nombre público.",categoria:"avatar",tipo:"perfil_color",slot:"nameColor",valor:"green",puntos_precio:320,rareza:"comun",activo:true,stock:null},
  {id:"profile_card_wood",item_key:"profile_card_wood",icono:"🪵",nombre:"Tarjeta pergamino",descripcion:"Estilo visual para tu tarjeta de perfil.",categoria:"avatar",tipo:"perfil_card",slot:"profileCard",valor:"wood",puntos_precio:500,rareza:"raro",activo:true,stock:null},
  {id:"profile_card_night",item_key:"profile_card_night",icono:"🌙",nombre:"Tarjeta noche verde",descripcion:"Marco oscuro/verde para tu tarjeta de perfil.",categoria:"avatar",tipo:"perfil_card",slot:"profileCard",valor:"nightGreen",puntos_precio:580,rareza:"epico",activo:true,stock:null},
  {id:"sticker_scissors",item_key:"sticker_scissors",icono:"✂️",nombre:"Pegatina tijeras",descripcion:"Pegatina coleccionable para futuras tarjetas de perfil.",categoria:"avatar",tipo:"perfil_sticker",slot:"sticker",valor:"scissors",puntos_precio:120,rareza:"comun",activo:true,stock:null},
  {id:"sticker_dread",item_key:"sticker_dread",icono:"🦁",nombre:"Pegatina dread",descripcion:"Pegatina rasta para futuras tarjetas de perfil.",categoria:"avatar",tipo:"perfil_sticker",slot:"sticker",valor:"dread",puntos_precio:180,rareza:"raro",activo:true,stock:null}
].map(x=>({...x,origen:"fallback_personalizacion"}));
function personalizationProductFromCosmetic(c){
  return {
    id:c.item_key||`${c.slot}_${c.valor}`,
    item_key:c.item_key,
    icono:c.slot==="frame"?"🖼️":c.slot==="bg"?"🌄":c.slot==="aura"?"✨":"🎭",
    nombre:c.nombre,
    descripcion:`${c.descripcion||"Personalización del avatar/perfil."} No afecta al Tycoon.`,
    categoria:"avatar",
    tipo:"cosmetico_avatar",
    slot:c.slot,
    valor:c.valor,
    puntos_precio:Number(c.puntos_precio)||0,
    rareza:c.rareza||"comun",
    activo:c.activo!==false,
    stock:null,
    origen:"fallback_avatar"
  };
}
function avatarShopFallbackItems(){
  return [
    ...COSMETIC_CATALOG_FALLBACK.map(personalizationProductFromCosmetic),
    ...PERSONALIZATION_SHOP_EXTRA
  ].filter(x=>x.activo!==false);
}
function cartStorageKey(user){return `rasta_cart_v1_${user?.id||"anon"}`;}
function readCart(user){
  try{return JSON.parse(localStorage.getItem(cartStorageKey(user))||"[]");}catch{return [];}
}
function writeCart(user,items){
  try{
    localStorage.setItem(cartStorageKey(user),JSON.stringify(Array.isArray(items)?items:[]));
    window.dispatchEvent(new CustomEvent("rasta-cart-updated"));
  }catch{}
}
function addToLocalCart(user,item,qty=1){
  const current=readCart(user);
  const id=String(item.id||item.item_key||item.nombre||Date.now());
  const existing=current.find(x=>String(x.id)===id);
  let next;
  if(existing){
    next=current.map(x=>String(x.id)===id?{...x,qty:(Number(x.qty)||1)+qty}:x);
  }else{
    next=[...current,{
      id,
      item_key:item.item_key||null,
      nombre:item.nombre||item.titulo||"Artículo",
      tipo:item.tipo||"tienda",
      categoria:item.categoria||"premios",
      icono:item.icono||"🎁",
      precio_puntos:Number(item.puntos_precio||item.precio_puntos||item.puntos||0),
      puntos:Number(item.puntos_precio||item.precio_puntos||item.puntos||0),
      qty
    }];
  }
  writeCart(user,next);
  return next;
}

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
  const viewerRole=normalizeRole(currentUser?.role||currentUser?.rol);
  if(viewerRole===ROLES.ADMIN || viewerRole===ROLES.STAFF) return false;
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

function isBannedProfile(u){
  if(!u?.baneado)return false;
  if(u.baneo_hasta){
    const until=new Date(u.baneo_hasta);
    if(!Number.isNaN(until.getTime()) && until.getTime()<Date.now()) return false;
  }
  return true;
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
    baneado:!!u.baneado,
    motivo_baneo:u.motivo_baneo||null,
    baneo_hasta:u.baneo_hasta||null,
    fecha_registro:u.created_at
  };
}
async function getUserProfileByEmail(email){
  if(!supabase || !email) return null;
  const {data,error}=await supabase
    .from("usuarios")
    .select("*")
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
    .select("*")
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


function RastaFaceAvatar({size=66,speaking=false}={}){
  return (
    <div
      className="rasta-face-avatar"
      style={{
        width:size,
        height:size,
        borderRadius:"50%",
        overflow:"hidden",
        position:"relative",
        display:"grid",
        placeItems:"center",
        background:"radial-gradient(circle at 50% 35%,#F7D76D,#2A1A0D 70%)",
        border:"3px solid #D5B24F",
        boxShadow:speaking
          ?"0 14px 28px rgba(0,0,0,.34),0 0 0 6px rgba(213,178,79,.18)"
          :"0 10px 22px rgba(0,0,0,.28)",
        animation:"helperBob 2.4s ease-in-out infinite"
      }}
    >
      <div style={{
        position:"absolute",
        width:size*3.25,
        left:-size*1.13,
        top:-size*.86,
        transform:"scale(1)",
        transformOrigin:"center top",
        pointerEvents:"none"
      }}>
        <HeroMascot/>
      </div>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",boxShadow:"inset 0 0 0 2px rgba(255,248,226,.35),inset 0 -18px 22px rgba(0,0,0,.20)"}}/>
    </div>
  );
}

function RastaLandingHero({compact=false,onNavigate=null,user=null,settings=null}){
  const branding=settings?.branding||{};
  const name=branding.nombre_tienda||BRAND.name;
  const slogan=branding.slogan||"Reserva, juega, descubre música y canjea recompensas.";
  const emoji=branding.emoji_principal||"✂️";
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
        }}>{name}</div>
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
        }}>{emoji} Cortes, rastas y estilo urbano {emoji}</div>
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
          <div style={{fontWeight:950,fontSize:compact?".94rem":"1.05rem",color:"#FFD66B"}}>{slogan}</div>
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
function Auth({onLogin,showToast,settings}){
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
    if(isBannedProfile(perfil)){
      try{await supabase.auth.signOut();}catch{}
      const msg=perfil.motivo_baneo?`Cuenta bloqueada: ${perfil.motivo_baneo}`:"Esta cuenta está bloqueada. Contacta con Rasta Cuts.";
      showAuthError(msg);
      SFX.error();
      return;
    }
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
    if(isBannedProfile(perfil)){
      try{await supabase.auth.signOut();}catch{}
      showAuthError("Esta cuenta está bloqueada. Contacta con Rasta Cuts.");
      SFX.error();
      return;
    }
    SFX.success();showToast(`Bienvenido a ${BRAND.name}!`);
    onLogin(toAppUser(perfil));
  }

  return(
    <div className="login-cyber-shell" style={{minHeight:"100vh",background:"radial-gradient(circle at 50% 10%,rgba(102,255,158,.20),transparent 30%),radial-gradient(circle at 10% 78%,rgba(255,214,102,.18),transparent 28%),radial-gradient(circle at 90% 72%,rgba(255,58,140,.16),transparent 28%),linear-gradient(180deg,#020503,#07120B 48%,#020403)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"18px 14px 28px",overflowX:"hidden",position:"relative"}}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480}}>
        <RastaLandingHero compact={false} settings={settings}/>

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
          {settings?.branding?.mensaje_login||"Forma parte de la comunidad Rasta Cuts: reserva, juega, participa y desbloquea recompensas."}
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
        <StatCard icon="👥" label="Clientes" value={stats.clientes} col="blue"/>
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
function ClientDashboard({user,onNavigate,settings}){
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
  const nivel=user.puntos>=1000?"VIP":user.puntos>=500?"Oro":user.puntos>=200?"Plata":"Bronce";
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <RastaLandingHero compact user={user} onNavigate={onNavigate} settings={settings}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        {settings?.secciones?.noticias_activas!==false&&<LandingFeature icon="📰" title="Actualidad" sub="Noticias rápidas tipo shorts." accent="#263F4D"/>}
        {settings?.secciones?.musica_activa!==false&&<LandingFeature icon="🎧" title="Música" sub="Reggae, rap clásico y novedades." accent="#4E3A76"/>}
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
        {[["📅","Cita","citas"],["🎮","Arcade","juegos"],["🎁","Tienda","tienda"],["📩","Buzón","buzon"]].map(([icon,lbl,id])=>(
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

function Citas({user,showToast,onNavigate}){
  const [citas,setCitas]=useState([]);
  const [cobros,setCobros]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({servicios:["corte"],fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});
  const [ocupados,setOcupados]=useState([]);
  const [view,setView]=useState(user?.rol!==ROLES.CLIENT?"pendiente":"todas");
  const [proposal,setProposal]=useState(null);
  const [adminEdit,setAdminEdit]=useState(null);
  const [cancelEdit,setCancelEdit]=useState(null);
  const isAdmin=user?.rol!==ROLES.CLIENT;

  useEffect(()=>{loadCitas();},[]);

  async function loadCitas(){
    setLoading(true);
    const q=isAdmin?"?order=fecha.asc,hora.asc&select=*":`?usuario_id=eq.${user.id}&order=fecha.asc,hora.asc&select=*`;
    const [citasRows,cobrosRows]=await Promise.all([
      dbGet("citas",q),
      dbGet("cobros","?select=id,cita_id,importe,estado")
    ]);
    setCitas(Array.isArray(citasRows)?citasRows:[]);
    setCobros((Array.isArray(cobrosRows)?cobrosRows:[]).filter(c=>String(c.estado||"pagado").toLowerCase()!=="anulado"));
    setLoading(false);
  }

  async function checkHorarios(fecha){if(!fecha)return;const data=await dbGet("citas",`?fecha=eq.${fecha}&select=hora`);setOcupados((data||[]).map(c=>c.hora));}

  function pagoDe(cita){
    return cobros.find(x=>String(x.cita_id||"")===String(cita.id)||String(x.id||"")===String(cita.cobro_id||""));
  }

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
    const created=await dbPost("citas",{
      servicio:servicios.map(s=>s.id).join(","),
      servicio_label:servicios.map(s=>s.label).join(" + "),
      servicio_precio:total,
      fecha:form.fecha,
      hora:form.hora,
      notas:notasLimpias?`${resumenDuracion}\n${notasLimpias}`:resumenDuracion,
      cliente_nombre:form.cliente_nombre||user?.nombre||user?.email||"Cliente",
      usuario_id:user.id,
      estado:"pendiente",
      respuesta_cliente:"pendiente",
      updated_at:new Date().toISOString()
    });
    await createNotification({rol_destino:"admin",tipo:"cita_nueva",titulo:"Nueva cita pendiente",mensaje:`${form.cliente_nombre||user?.nombre||user?.email||"Cliente"} pidió cita para ${form.fecha} a las ${form.hora}.`,entidad_tipo:"cita",entidad_id:Array.isArray(created)?created?.[0]?.id:null,importante:true});
    showToast("Cita enviada y pendiente de confirmar");SFX.success();setShowNew(false);setForm({servicios:["corte"],fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});loadCitas();
  }

  async function updateCita(cita,patch,msg){
    const ok=await dbPatch("citas",`?id=eq.${cita.id}`,{...patch,updated_at:new Date().toISOString(),gestionado_por:isAdmin?(user?.email||user?.id||"staff"):cita.gestionado_por});
    if(ok){showToast(msg);SFX.success();await loadCitas();}
    else{showToast("No se pudo actualizar la cita");SFX.error();}
  }

  async function sendCitaMessage(cita,msg){
    try{
      if(!cita?.usuario_id||!msg)return;
      await dbPost("mensajes_privados",{
        usuario_id:String(cita.usuario_id),
        cliente_nombre:cita.cliente_nombre||"Cliente",
        autor_id:String(user.id),
        autor_nombre:user.nombre||"Rasta Cuts",
        autor_rol:normalizeRole(user.rol||user.role),
        mensaje:msg,
        leido_cliente:false,
        leido_admin:true,
        estado:"abierto",
        vinculado_cita_id:cita.id
      });
    }catch(e){}
  }

  function openProposal(cita){
    setProposal({cita,fecha:cita.propuesta_fecha||cita.fecha||"",hora:cita.propuesta_hora||cita.hora||"",nota:""});
    checkHorarios(cita.propuesta_fecha||cita.fecha||"");
  }

  async function sendProposal(){
    if(!proposal?.fecha||!proposal?.hora){showToast("Elige fecha y hora para la propuesta");return;}
    const extra=`Te proponemos cambiar tu cita al ${proposal.fecha} a las ${proposal.hora}${proposal.nota?`.\n${proposal.nota}`:"."}`;
    await updateCita(proposal.cita,{
      propuesta_fecha:proposal.fecha,
      propuesta_hora:proposal.hora,
      estado:"propuesta",
      respuesta_cliente:"pendiente",
      notas_admin:proposal.nota||proposal.cita.notas_admin||""
    },"Propuesta enviada al cliente");
    await sendCitaMessage(proposal.cita,`📅 Propuesta de nueva cita:\n${extra}`);
    setProposal(null);
  }

  async function aceptarPropuesta(cita){
    if(!cita.propuesta_fecha||!cita.propuesta_hora){showToast("Esta propuesta no tiene fecha/hora guardada");return;}
    await updateCita(cita,{
      fecha:cita.propuesta_fecha,
      hora:cita.propuesta_hora,
      estado:"confirmada",
      respuesta_cliente:"aceptada"
    },"Propuesta aceptada");
    await createNotification({rol_destino:"admin",tipo:"cita_propuesta_aceptada",titulo:"Propuesta aceptada",mensaje:`${cita.cliente_nombre||"Cliente"} aceptó la cita del ${cita.propuesta_fecha} a las ${cita.propuesta_hora}.`,entidad_tipo:"cita",entidad_id:cita.id,importante:true});
  }

  async function rechazarPropuesta(cita){
    await updateCita(cita,{estado:"pendiente",respuesta_cliente:"rechazada"},"Propuesta rechazada");
    await createNotification({rol_destino:"admin",tipo:"cita_propuesta_rechazada",titulo:"Propuesta rechazada",mensaje:`${cita.cliente_nombre||"Cliente"} rechazó la propuesta de cita.`,entidad_tipo:"cita",entidad_id:cita.id,importante:true});
  }

  async function guardarNotasAdmin(){
    if(!adminEdit)return;
    await updateCita(adminEdit.cita,{notas_admin:adminEdit.notas_admin||""},"Notas internas guardadas");
    setAdminEdit(null);
  }

  async function cancelarCita(){
    if(!cancelEdit)return;
    const motivo=String(cancelEdit.motivo||"").trim();
    await updateCita(cancelEdit.cita,{estado:"cancelada",motivo_cancelacion:motivo||null},"Cita cancelada");
    if(motivo||isAdmin) await sendCitaMessage(cancelEdit.cita,`❌ Cita cancelada${motivo?`:\n${motivo}`:"."}`);
    setCancelEdit(null);
  }

  function irBuzon(cita){
    if(isAdmin){onNavigate?.("gestion");showToast?.("Abre Gestión > Mensajes para responder al cliente");}
    else onNavigate?.("buzon");
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
    {id:"cancelada",label:"Canceladas",icon:"❌"},
  ];
  const citasVisibles=view==="todas"?citas:citas.filter(c=>statusOf(c)===view);
  const eColor={pendiente:"gold",propuesta:"blue",confirmada:"green",cancelada:"red",completada:"blue"};
  const eLabel={pendiente:"pendiente",propuesta:"propuesta",confirmada:"confirmada",cancelada:"cancelada",completada:"realizada"};

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📅" title="Citas" sub={isAdmin?"Panel real de reservas y propuestas":"Tus reservas"} action={<Btn small onClick={()=>setShowNew(true)}>+ Nueva</Btn>}/>

      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{isAdmin?"☕ Panel de citas":"🧾 Estado de tus citas"}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>{isAdmin?"Confirma, propone otra hora, añade notas internas, cancela o marca realizadas.":"Aquí verás si tu reserva está pendiente, confirmada, cancelada o con propuesta de cambio."}</div>
          </div>
          <Badge col={(counts.pendiente||0)?"gold":"green"}>{counts.pendiente||0} pendientes</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.pendiente||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Pendientes</div></div>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.propuesta||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Propuestas</div></div>
          <div style={{background:"rgba(255,244,214,.58)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"10px",textAlign:"center"}}><div style={{fontSize:"1.15rem",fontWeight:950,color:T.g800}}>{counts.confirmada||0}</div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub}}>Confirmadas</div></div>
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
          const pago=pagoDe(c);
          const propuesta=c.propuesta_fecha&&c.propuesta_hora;
          return <Card key={c.id} style={{marginBottom:12,background:st==="pendiente"?"linear-gradient(180deg,#F0E0B8,#E6CF9B)":st==="confirmada"?"linear-gradient(180deg,#E4E8C6,#D8BE87)":T.panel}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,flexWrap:"wrap"}}>
                  <Badge col={eColor[st]||"green"}>{eLabel[st]||st}</Badge>
                  {pago&&<Badge col="green">cobrada {Number(pago.importe||0).toFixed(2)}€</Badge>}
                  {c.respuesta_cliente&&c.respuesta_cliente!=="pendiente"&&<Badge col={c.respuesta_cliente==="aceptada"?"green":"red"}>{c.respuesta_cliente}</Badge>}
                  <span style={{fontSize:".78rem",fontWeight:950,color:T.g700}}>👤 {c.cliente_nombre||"Cliente"}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {list.length?list.map(s=><span key={s.id} style={{background:"rgba(75,48,27,.1)",border:`1px solid ${T.g300}`,borderRadius:999,padding:"4px 9px",fontWeight:900,fontSize:".72rem",color:T.g800}}>{s.icon||"✂️"} {s.label}</span>):<b>{c.servicio_label||c.servicio}</b>}
                </div>
                <div style={{fontSize:"0.86rem",fontWeight:950,color:T.g800}}>📆 {c.fecha} · {c.hora}{dur?` - ${endTime(c.hora,dur)}`:""}</div>
                {propuesta&&<Card style={{marginTop:9,padding:10,background:"linear-gradient(180deg,#DCE4C8,#C9D39C)",border:"1.5px solid rgba(47,107,66,.35)"}}>
                  <div style={{fontWeight:950,color:T.g800}}>🔁 Propuesta de la tienda</div>
                  <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,marginTop:3}}>Nueva fecha: {c.propuesta_fecha} · {c.propuesta_hora}</div>
                </Card>}
                {c.motivo_cancelacion&&<div style={{marginTop:8,fontSize:".76rem",lineHeight:1.38,color:T.red,whiteSpace:"pre-wrap",fontWeight:850}}>Motivo: {c.motivo_cancelacion}</div>}
                {c.notas&&<div style={{marginTop:8,fontSize:".76rem",lineHeight:1.38,color:T.textSub,whiteSpace:"pre-wrap",fontWeight:750,maxHeight:86,overflow:"hidden"}}>{String(c.notas)}</div>}
                {isAdmin&&c.notas_admin&&<div style={{marginTop:8,fontSize:".76rem",lineHeight:1.38,color:T.g800,whiteSpace:"pre-wrap",fontWeight:850,background:"rgba(255,244,214,.48)",border:`1px dashed ${T.g300}`,borderRadius:12,padding:8}}>🔒 Nota interna: {c.notas_admin}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                {!!precio&&<span style={{fontWeight:950,color:T.g600,fontSize:"1rem"}}>{precio}€</span>}
                {!!dur&&<span style={{fontWeight:850,color:T.textSub,fontSize:"0.72rem"}}>⏱️ {formatDuration(dur)}</span>}
              </div>
            </div>
            <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              {isAdmin&&st==="pendiente"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"confirmada",respuesta_cliente:"aceptada"},"Cita confirmada")}>✅ Aceptar</Btn>}
              {isAdmin&&["pendiente","confirmada","propuesta"].includes(st)&&<Btn small col="gold" onClick={()=>openProposal(c)}>🔁 Proponer otra hora</Btn>}
              {isAdmin&&["confirmada","propuesta"].includes(st)&&<Btn small col="dark" onClick={()=>updateCita(c,{estado:"completada"},"Cita marcada como realizada")}>🏁 Realizada</Btn>}
              {isAdmin&&<Btn small col="ghost" onClick={()=>setAdminEdit({cita:c,notas_admin:c.notas_admin||""})}>🔒 Nota interna</Btn>}
              {isAdmin&&<Btn small col="ghost" onClick={()=>irBuzon(c)}>📩 Buzón</Btn>}
              {isAdmin&&st==="cancelada"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"pendiente"},"Cita reabierta")}>↩️ Reabrir</Btn>}
              {!isAdmin&&st==="propuesta"&&<Btn small col="green" onClick={()=>aceptarPropuesta(c)}>✅ Aceptar propuesta</Btn>}
              {!isAdmin&&st==="propuesta"&&<Btn small col="red" onClick={()=>rechazarPropuesta(c)}>❌ Rechazar</Btn>}
              {!isAdmin&&<Btn small col="ghost" onClick={()=>irBuzon(c)}>📩 Buzón</Btn>}
              {["pendiente","propuesta","confirmada"].includes(st)&&<Btn small col="red" onClick={()=>setCancelEdit({cita:c,motivo:c.motivo_cancelacion||""})}>❌ Cancelar</Btn>}
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

      <Modal show={!!adminEdit} onClose={()=>setAdminEdit(null)} title="Nota interna">
        {adminEdit&&<>
          <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>{adminEdit.cita.cliente_nombre||"Cliente"}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>{adminEdit.cita.fecha} · {adminEdit.cita.hora}</div>
          </Card>
          <textarea value={adminEdit.notas_admin} onChange={e=>setAdminEdit(v=>({...v,notas_admin:e.target.value}))} rows={5} placeholder="Notas internas para admin/staff. El cliente no las verá." style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:T.g150,resize:"vertical",outline:"none",fontWeight:800,color:T.text}}/>
          <div style={{marginTop:10}}><Btn full col="gold" onClick={guardarNotasAdmin}>Guardar nota interna</Btn></div>
        </>}
      </Modal>

      <Modal show={!!cancelEdit} onClose={()=>setCancelEdit(null)} title="Cancelar cita">
        {cancelEdit&&<>
          <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>{cancelEdit.cita.cliente_nombre||"Cliente"}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>{cancelEdit.cita.fecha} · {cancelEdit.cita.hora}</div>
          </Card>
          <Input label="Motivo de cancelación" value={cancelEdit.motivo} onChange={v=>setCancelEdit(c=>({...c,motivo:v}))} placeholder="Ej: no hay hueco, cliente avisa, error de horario..."/>
          <div style={{marginTop:10}}><Btn full col="red" onClick={cancelarCita}>Cancelar cita</Btn></div>
        </>}
      </Modal>
    </div>
  );
}

// CLIENTES
function Clientes({user,showToast}){
  const [clientes,setClientes]=useState([]);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [historial,setHistorial]=useState([]);
  const [cobros,setCobros]=useState([]);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [rawUsers,rawCitas]=await Promise.all([
      dbGet("usuarios","?order=nombre.asc&select=*"),
      dbGet("citas","?select=usuario_id,estado")
    ]);

    const idsConCita=new Set((Array.isArray(rawCitas)?rawCitas:[])
      .filter(c=>c.usuario_id)
      .map(c=>String(c.usuario_id)));

    const raw=(Array.isArray(rawUsers)?rawUsers:[])
      .filter(u=>idsConCita.has(String(u.id)));

    const enriched=await enrichProfilesWithAvatarConfigs(raw);
    const citaCounts=(Array.isArray(rawCitas)?rawCitas:[]).reduce((acc,c)=>{
      if(c.usuario_id) acc[String(c.usuario_id)]=(acc[String(c.usuario_id)]||0)+1;
      return acc;
    },{});

    setClientes(enriched.map(u=>({...u,citas_count:citaCounts[String(u.id)]||0})));
    setLoading(false);
  }

  async function selectCliente(c){
    setSelected(c);
    setDetailLoading(true);
    const [citas,cobs]=await Promise.all([
      dbGet("citas",`?usuario_id=eq.${c.id}&order=fecha.desc,hora.desc&limit=50&select=*`),
      dbGet("cobros",`?usuario_id=eq.${c.id}&order=created_at.desc&limit=80&select=*`)
    ]);
    setHistorial(Array.isArray(citas)?citas:[]);
    setCobros((Array.isArray(cobs)?cobs:[]).filter(x=>String(x.estado||"pagado").toLowerCase()!=="anulado"));
    setDetailLoading(false);
  }

  function pagoDe(cita){
    return cobros.find(x=>String(x.cita_id||"")===String(cita.id)||String(x.id||"")===String(cita.cobro_id||""));
  }

  const filtered=clientes.filter(c=>(c.nombre||"").toLowerCase().includes(search.toLowerCase())||(c.email||"").toLowerCase().includes(search.toLowerCase()));
  const totalGastado=cobros.reduce((sum,c)=>sum+(Number(c.importe)||0),0);
  const totalPuntosGanados=cobros.reduce((sum,c)=>sum+(Number(c.puntos_generados)||0),0);
  const citasCompletadas=historial.filter(c=>String(c.estado||"").toLowerCase()==="completada").length;
  const citasPendientes=historial.filter(c=>["pendiente","propuesta","confirmada"].includes(String(c.estado||"").toLowerCase())).length;

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👥" title="Clientes" sub={`${clientes.length} clientes con cita registrada`}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#0E2F3A,#1A5261 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>👥</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Clientes de tienda</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Aquí sólo aparecen personas con al menos una cita registrada. Los usuarios web se gestionan en Gestión &gt; Usuarios.</div>
          </div>
        </div>
      </Card>
      <Input value={search} onChange={setSearch} placeholder="Buscar cliente por nombre o email..."/>
      {loading?<Spinner/>:filtered.length===0?<EmptyState icon="👥" title="Sin clientes" sub="Todavía no hay usuarios con citas registradas."/>:filtered.map(c=>(
        <Card key={c.id} style={{marginBottom:10,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`1.5px solid ${T.g300}`}} hover onClick={()=>selectCliente(c)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <PublicAvatar profile={c} currentUser={user} size={44}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(c,user)}</div>
              <div style={{fontSize:"0.78rem",color:T.textSub,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.email}</div>
              <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub,marginTop:2}}>📅 {c.citas_count||0} cita{(c.citas_count||0)===1?"":"s"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:950,color:T.g600}}>⭐ {c.puntos||0}</div>
              <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>puntos</div>
            </div>
          </div>
        </Card>
      ))}

      <Modal show={!!selected} onClose={()=>{setSelected(null);setHistorial([]);setCobros([]);}} title={selected?.nombre||"Cliente"}>
        {selected&&(
          <div>
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
              <PublicAvatar profile={selected} currentUser={user} size={58}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:950,color:T.g800,fontSize:"1rem"}}>{publicName(selected,user)}</div>
                <div style={{fontSize:"0.82rem",color:T.textSub,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selected.email}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>
                  <Badge col="gold">⭐ {selected.puntos||0} pts</Badge>
                  <Badge col="blue">📅 {historial.length} citas</Badge>
                  {selected.modo_incognito&&<Badge col="dark">incógnito para usuarios</Badge>}
                </div>
              </div>
            </div>

            {detailLoading?<Spinner/>:<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <StatCard icon="📅" label="Citas" value={historial.length} col="green"/>
                <StatCard icon="🏁" label="Realizadas" value={citasCompletadas} col="blue"/>
                <StatCard icon="🟡" label="Activas" value={citasPendientes} col="gold"/>
                <StatCard icon="💶" label="Cobrado" value={`${totalGastado.toFixed(2)}€`} col="gold"/>
              </div>

              <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`1.5px solid ${T.gold}`,padding:12}}>
                <div style={{fontWeight:950,color:T.g800}}>Resumen de fidelidad</div>
                <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>
                  Este cliente ha generado aproximadamente <b>{totalPuntosGanados}</b> puntos por cobros registrados. Los puntos son fidelidad, no dinero.
                </div>
              </Card>

              <div style={{fontWeight:950,color:T.g800,margin:"8px 0"}}>Historial de citas</div>
              {historial.length===0?<EmptyState icon="📅" title="Sin citas" sub="Este cliente todavía no tiene citas registradas."/>:
                historial.map(h=>{
                  const pago=pagoDe(h);
                  const st=String(h.estado||"pendiente").toLowerCase();
                  const col={pendiente:"gold",propuesta:"blue",confirmada:"green",completada:"blue",cancelada:"red"}[st]||"gold";
                  const dur=citaDuration(citaServices(h));
                  return <Card key={h.id} style={{marginBottom:9,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`1.5px solid ${T.g200}`,padding:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                          <Badge col={col}>{st==="completada"?"realizada":st}</Badge>
                          {pago&&<Badge col="green">cobrada {Number(pago.importe||0).toFixed(2)}€</Badge>}
                        </div>
                        <div style={{fontWeight:950,color:T.g800,lineHeight:1.2}}>{h.servicio_label||h.servicio||"Servicio"}</div>
                        <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:4}}>📆 {h.fecha||"sin fecha"} · 🕒 {h.hora||"sin hora"}{dur?` · ${formatDuration(dur)}`:""}</div>
                        {h.propuesta_fecha&&h.propuesta_hora&&<div style={{fontSize:".74rem",fontWeight:850,color:T.textSub,marginTop:5}}>🔁 Propuesta: {h.propuesta_fecha} · {h.propuesta_hora} · {h.respuesta_cliente||"pendiente"}</div>}
                        {h.motivo_cancelacion&&<div style={{fontSize:".74rem",fontWeight:850,color:T.red,marginTop:5}}>Motivo: {h.motivo_cancelacion}</div>}
                        {h.notas_admin&&<div style={{fontSize:".74rem",fontWeight:850,color:T.g800,marginTop:5,background:"rgba(255,244,214,.5)",borderRadius:10,padding:7}}>🔒 {h.notas_admin}</div>}
                      </div>
                      <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                        {!!h.servicio_precio&&<div style={{fontWeight:950,color:T.g600}}>{Number(h.servicio_precio)}€</div>}
                      </div>
                    </div>
                  </Card>;
                })
              }

              <div style={{fontWeight:950,color:T.g800,margin:"14px 0 8px"}}>Últimos cobros</div>
              {cobros.length===0?<div style={{fontSize:".82rem",fontWeight:800,color:T.textSub}}>Sin cobros registrados.</div>:
                cobros.slice(0,8).map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.g100}`,fontSize:"0.83rem"}}>
                  <span style={{fontWeight:850,color:T.text}}>{c.descripcion||c.concepto||"Cobro"}</span>
                  <span style={{fontWeight:950,color:T.g600}}>{Number(c.importe||0).toFixed(2)}€</span>
                </div>)
              }
            </>}
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
  if(!isInternalUser(user)) return <EmptyState icon="🔒" title="Zona interna" sub="Sólo admin y staff pueden usar facturación."/>;
  const [cobros,setCobros]=useState([]);
  const [citasRealizadas,setCitasRealizadas]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [carrito,setCarrito]=useState([]);
  const [metodo,setMetodo]=useState("efectivo");
  const [clienteNombre,setClienteNombre]=useState("");
  const [citaCobro,setCitaCobro]=useState(null);
  const [cobroForm,setCobroForm]=useState({metodo_pago:"efectivo",importe:"",puntos_generados:"10",descripcion:""});
  const [puntosCitaDefault,setPuntosCitaDefault]=useState(10);

  const today=()=>new Date().toISOString().split("T")[0];
  const monthStart=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  };
  const money=n=>`${(Number(n)||0).toFixed(2)}€`;
  const metodoLabel=m=>({efectivo:"Efectivo",tarjeta:"Tarjeta",bizum:"Bizum",mixto:"Mixto"})[m]||m||"Sin método";

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
    const [cobs,citas,settingsRows]=await Promise.all([
      dbGet("cobros",`?fecha=gte.${monthStart()}&order=created_at.desc&select=*`),
      dbGet("citas",`?estado=eq.completada&order=fecha.desc,hora.desc&select=*`),
      dbGet("app_settings","?setting_key=eq.puntos&select=setting_value&limit=1")
    ]);
    const puntosCfg=settingsRows?.[0]?.setting_value||{};
    const puntosDefault=Math.max(0,parseInt(puntosCfg.puntos_por_cita_cobrada??10,10)||10);
    setPuntosCitaDefault(puntosDefault);
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
      puntos_generados:String(puntosCitaDefault),
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
      const cobroId=Array.isArray(ok)?ok?.[0]?.id:null;
      if(cobroId) await dbPatch("citas",`?id=eq.${citaCobro.id}`,{cobro_id:cobroId,updated_at:new Date().toISOString()});
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
  const canManageUsers=normalizeRole(user?.rol||user?.role)===ROLES.ADMIN;
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [roleFilter,setRoleFilter]=useState("todos");
  const [selected,setSelected]=useState(null);
  const [banForm,setBanForm]=useState({motivo:"",hasta:""});

  useEffect(()=>{if(canManageUsers) load(); else setLoading(false);},[canManageUsers]);

  async function load(){
    setLoading(true);
    const raw=await dbGet("usuarios","?order=created_at.desc&select=*")||[];
    setUsers(await enrichProfilesWithAvatarConfigs(raw));
    setLoading(false);
  }

  async function changeRole(id,rol){
    if(!canManageUsers)return;
    if(String(id)===String(user.id)&&normalizeRole(rol)!==ROLES.ADMIN){
      showToast?.("No te quites el rol de admin desde aquí");
      SFX.error();
      return;
    }
    const ok=await dbPatch("usuarios",`?id=eq.${id}`,{role:normalizeRole(rol)});
    if(ok){
      showToast("Rol actualizado");
      SFX.success();
      await load();
      setSelected(s=>s&&String(s.id)===String(id)?{...s,role:normalizeRole(rol)}:s);
    }else{
      showToast?.("No se pudo cambiar el rol");
      SFX.error();
    }
  }

  async function toggleBan(usuario){
    if(!canManageUsers||!usuario)return;
    if(String(usuario.id)===String(user.id)){
      showToast?.("No puedes bloquear tu propia cuenta");
      SFX.error();
      return;
    }
    const banned=isBannedProfile(usuario);
    const patch=banned
      ? {baneado:false,motivo_baneo:null,baneado_por:null,baneado_at:null,baneo_hasta:null}
      : {
          baneado:true,
          motivo_baneo:banForm.motivo||"Bloqueado desde Gestión > Usuarios",
          baneado_por:String(user.id),
          baneado_at:new Date().toISOString(),
          baneo_hasta:banForm.hasta?new Date(`${banForm.hasta}T23:59:59`).toISOString():null
        };
    const ok=await dbPatch("usuarios",`?id=eq.${usuario.id}`,patch);
    if(ok){
      showToast?.(banned?"Usuario desbloqueado":"Usuario bloqueado");
      SFX.success();
      setSelected(null);
      setBanForm({motivo:"",hasta:""});
      await load();
    }else{
      showToast?.("No se pudo actualizar el bloqueo");
      SFX.error();
    }
  }

  function roleBadge(u){
    const r=normalizeRole(u?.role||u?.rol);
    if(r===ROLES.ADMIN)return <Badge col="gold">admin</Badge>;
    if(r===ROLES.STAFF)return <Badge col="green">staff</Badge>;
    return <Badge col="blue">cliente</Badge>;
  }

  const roleCounts=users.reduce((acc,u)=>{const r=normalizeRole(u.role||u.rol);acc[r]=(acc[r]||0)+1;acc.todos=(acc.todos||0)+1;return acc;},{todos:users.length});
  const filtered=users.filter(u=>{
    const q=search.toLowerCase();
    const text=`${u.nombre||""} ${u.email||""}`.toLowerCase();
    const r=normalizeRole(u.role||u.rol);
    const roleOk=roleFilter==="todos"||r===roleFilter;
    return text.includes(q)&&roleOk;
  });

  if(!canManageUsers){
    return <EmptyState icon="🔒" title="Solo administradores" sub="Esta sección permite cambiar roles, bloquear usuarios y gestionar cuentas online."/>;
  }

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👑" title="Usuarios web" sub={`${users.length} cuentas registradas en la web`}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🔐</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Usuarios de la página</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Gestiona cuentas online: jugadores, comunidad, roles, permisos y bloqueos. Los clientes de tienda están en Gestión &gt; Clientes.</div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <Input value={search} onChange={setSearch} placeholder="Buscar usuario por nombre o email..."/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
          {[
            {id:"todos",label:"Todos",n:roleCounts.todos||0},
            {id:"client",label:"Clientes",n:roleCounts.client||0},
            {id:"staff",label:"Staff",n:roleCounts.staff||0},
            {id:"admin",label:"Admin",n:roleCounts.admin||0},
          ].map(f=><button key={f.id} onClick={()=>{SFX.tab();setRoleFilter(f.id);}} style={{border:`2px solid ${roleFilter===f.id?T.gold:T.g300}`,background:roleFilter===f.id?T.gradGold:"rgba(255,244,214,.72)",color:roleFilter===f.id?T.g900:T.g700,borderRadius:14,padding:"8px 4px",fontWeight:950,cursor:"pointer",fontSize:".68rem"}}>
            {f.label}<br/><span style={{opacity:.75}}>{f.n}</span>
          </button>)}
        </div>
      </Card>

      {loading?<Spinner/>:filtered.length===0?<EmptyState icon="👑" title="Sin usuarios" sub="No hay cuentas con ese filtro."/>:filtered.map(u=>{
        const banned=isBannedProfile(u);
        return <Card key={u.id} style={{marginBottom:10,background:banned?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:banned?`2px solid ${T.red}`:`1.5px solid ${T.g300}`,opacity:banned?.82:1}} hover onClick={()=>{setSelected(u);setBanForm({motivo:u.motivo_baneo||"",hasta:u.baneo_hasta?String(u.baneo_hasta).slice(0,10):""});}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <PublicAvatar profile={u} currentUser={user} size={42}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{fontWeight:900,fontSize:"0.9rem",color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(u,user)}</div>
                {roleBadge(u)}
                {banned&&<Badge col="red">bloqueado</Badge>}
                {u.modo_incognito&&<Badge col="dark">incógnito</Badge>}
              </div>
              <div style={{fontSize:"0.75rem",color:T.textSub,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.email}</div>
            </div>
            <div style={{fontWeight:950,color:T.g600}}>⭐ {u.puntos||0}</div>
          </div>
        </Card>;
      })}

      <Modal show={!!selected} onClose={()=>setSelected(null)} title={selected?.nombre||"Usuario"}>
        {selected&&<>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
            <PublicAvatar profile={selected} currentUser={user} size={58}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:950,color:T.g800,fontSize:"1rem"}}>{publicName(selected,user)}</div>
              <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selected.email}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>
                {roleBadge(selected)}
                <Badge col="gold">⭐ {selected.puntos||0} pts</Badge>
                {selected.modo_incognito&&<Badge col="dark">incógnito para usuarios</Badge>}
                {isBannedProfile(selected)&&<Badge col="red">bloqueado</Badge>}
              </div>
            </div>
          </div>

          <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`2px solid ${T.gold}`,padding:12}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>👑 Rol y permisos</div>
            <select value={normalizeRole(selected.role||selected.rol)} onChange={e=>changeRole(selected.id,e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:14,border:`2px solid ${T.g300}`,background:T.g50,fontSize:".9rem",fontWeight:900,color:T.g800}}>
              <option value="client">Cliente / usuario normal</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </Card>

          <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${isBannedProfile(selected)?T.red:T.g300}`,padding:12}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🚫 Bloqueo de usuario</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginBottom:10}}>Si bloqueas una cuenta, no podrá iniciar sesión mientras el bloqueo esté activo.</div>
            {!isBannedProfile(selected)&&<>
              <Input label="Motivo" value={banForm.motivo} onChange={v=>setBanForm(f=>({...f,motivo:v}))} placeholder="Ej: spam, insultos, uso indebido..."/>
              <Input label="Bloqueado hasta (opcional)" value={banForm.hasta} onChange={v=>setBanForm(f=>({...f,hasta:v}))} type="date"/>
            </>}
            {isBannedProfile(selected)&&<div style={{fontSize:".82rem",fontWeight:850,color:T.red,lineHeight:1.35,marginBottom:10}}>
              Motivo: {selected.motivo_baneo||"Sin motivo guardado"}{selected.baneo_hasta?` · Hasta ${new Date(selected.baneo_hasta).toLocaleDateString("es-ES")}`:""}
            </div>}
            <Btn full col={isBannedProfile(selected)?"green":"red"} onClick={()=>toggleBan(selected)}>
              {isBannedProfile(selected)?"Quitar bloqueo":"Bloquear usuario"}
            </Btn>
          </Card>

          <Card style={{background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`,padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>🕶️ Privacidad</div>
            <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Si el usuario tiene modo incógnito, otros clientes lo verán oculto, pero admin y staff pueden verlo completo en paneles internos.</div>
          </Card>
        </>}
      </Modal>
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
  const [replies,setReplies]=useState([]);
  const [votes,setVotes]=useState([]);
  const [follows,setFollows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [category,setCategory]=useState("general");
  const [filter,setFilter]=useState("todo");
  const [search,setSearch]=useState("");
  const [active,setActive]=useState(null);
  const [reply,setReply]=useState("");
  const [selectedProfile,setSelectedProfile]=useState(null);
  const [report,setReport]=useState(null);

  const role=normalizeRole(user?.rol||user?.role);
  const canModerate=role!==ROLES.CLIENT;

  const categories=[
    {id:"todo",label:"Todo",icon:"✨"},
    {id:"pendientes",label:"Pendientes",icon:"🔴"},
    {id:"seguidos",label:"Seguidos",icon:"✓"},
    {id:"mis_temas",label:"Mis temas",icon:"👤"},
    {id:"avisos",label:"Avisos",icon:"📌"},
    {id:"general",label:"General",icon:"💬"},
    {id:"ideas",label:"Ideas",icon:"💡"},
    {id:"musica",label:"Música",icon:"🎧"},
    {id:"juegos",label:"Juegos",icon:"🎮"},
    {id:"cuidados",label:"Cuidados",icon:"🪮"}
  ];
  const specialFilters=new Set(["todo","pendientes","seguidos","mis_temas"]);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [temas,resps,vots,segs]=await Promise.all([
      dbGet("foro_temas","?order=fijado.desc,created_at.desc&limit=80&select=*"),
      dbGet("foro_respuestas","?order=created_at.asc&limit=800&select=*"),
      dbGet("foro_votos",`?usuario_id=eq.${user.id}&select=*`),
      dbGet("foro_seguimientos",`?usuario_id=eq.${user.id}&select=*`)
    ]);
    setTopics(Array.isArray(temas)?temas:[]);
    setReplies(Array.isArray(resps)?resps:[]);
    setVotes(Array.isArray(vots)?vots:[]);
    setFollows(Array.isArray(segs)?segs:[]);
    setLoading(false);
  }

  function topicReplies(id){return replies.filter(r=>String(r.tema_id)===String(id));}
  function getFollow(topic){return follows.find(f=>String(f.tema_id)===String(topic?.id));}
  function isFollowing(topic){return Boolean(getFollow(topic)?.siguiendo);}
  function unreadCount(topic){
    const f=getFollow(topic);
    if(!f||!f.siguiendo)return 0;
    const total=topicReplies(topic.id).length;
    const vistos=Number(f.respuestas_vistas||0);
    return Math.max(0,total-vistos);
  }
  function totalPendingThreads(){return topics.filter(t=>unreadCount(t)>0).length;}

  async function saveFollow(topic,{siguiendo=true,respuestas_vistas=null,markRead=false}={}){
    if(!topic?.id||!user?.id)return;
    const total=topicReplies(topic.id).length;
    const seen=respuestas_vistas===null?(markRead?total:Number(getFollow(topic)?.respuestas_vistas||0)):respuestas_vistas;
    const payload={
      usuario_id:String(user.id),
      usuario_nombre:user.nombre||user.email||"Usuario",
      tema_id:topic.id,
      tema_titulo:topic.titulo||"Tema del foro",
      siguiendo,
      respuestas_vistas:seen,
      ultima_lectura:markRead?new Date().toISOString():(getFollow(topic)?.ultima_lectura||null),
      updated_at:new Date().toISOString()
    };
    try{
      await supabase.from("foro_seguimientos").upsert(payload,{onConflict:"usuario_id,tema_id"});
      setFollows(prev=>{
        const rest=prev.filter(f=>String(f.tema_id)!==String(topic.id));
        return [...rest,{...getFollow(topic),...payload}];
      });
    }catch(e){console.warn("foro_seguimientos",e);}
  }
  async function openTopic(topic){
    setActive(topic);
    await saveFollow(topic,{siguiendo:true,markRead:true});
  }
  async function toggleFollow(topic){
    const next=!isFollowing(topic);
    await saveFollow(topic,{siguiendo:next,respuestas_vistas:next?topicReplies(topic.id).length:Number(getFollow(topic)?.respuestas_vistas||0),markRead:next});
    showToast(next?"Tema seguido":"Has dejado de seguir el tema");
    SFX.success();
  }
  function voted(target_tipo,target_id){return votes.some(v=>String(v.target_tipo)===target_tipo&&String(v.target_id)===String(target_id));}
  function categoryLabel(id){return categories.find(c=>c.id===id)?.label||id||"General";}
  function categoryIcon(id){return categories.find(c=>c.id===id)?.icon||"💬";}
  function topicAuthor(t){return {id:t.usuario_id,nombre:t.autor_nombre,avatar:t.autor_avatar,avatar_config:t.autor_avatar_config,perfil_publico:true,modo_incognito:false,role:"client"};}
  function replyAuthor(r){return {id:r.usuario_id,nombre:r.autor_nombre,avatar:r.autor_avatar,avatar_config:r.autor_avatar_config,perfil_publico:true,modo_incognito:false,role:"client"};}

  function openReport(target_tipo,target){
    setReport({
      target_tipo,
      target,
      motivo:"contenido inapropiado",
      detalle:"",
      target_titulo:target_tipo==="tema"?(target.titulo||"Tema del foro"):`Respuesta en: ${shown?.titulo||"tema"}`,
      target_autor_id:target.usuario_id||target.autor_id||"",
      target_autor_nombre:target.autor_nombre||"Usuario"
    });
  }

  async function sendReport(){
    if(!report?.target?.id){showToast?.("No se pudo preparar el reporte");return;}
    const payload={
      reportado_por_id:String(user.id),
      reportado_por_nombre:user.nombre||user.email||"Usuario",
      target_tipo:report.target_tipo,
      target_id:String(report.target.id),
      target_titulo:report.target_titulo,
      target_autor_id:report.target_autor_id?String(report.target_autor_id):null,
      target_autor_nombre:report.target_autor_nombre||null,
      motivo:report.motivo||"contenido inapropiado",
      detalle:report.detalle||null,
      estado:"pendiente"
    };
    const ok=await dbPost("reportes_comunidad",payload);
    if(ok){
      await createNotification({rol_destino:"admin",tipo:"reporte",titulo:"Nuevo reporte de comunidad",mensaje:`${payload.reportado_por_nombre} ha reportado ${payload.target_tipo}: ${payload.target_titulo}`,entidad_tipo:"reporte",entidad_id:Array.isArray(ok)?ok?.[0]?.id:null,importante:true});
      SFX.success();
      showToast?.("Reporte enviado a moderación");
      setReport(null);
    }else{
      SFX.error();
      showToast?.("No se pudo enviar el reporte");
    }
  }

  async function createTopic(){
    if(!title.trim()||!body.trim()){showToast("Pon título y texto");return;}
    const payload={
      usuario_id:String(user.id),
      autor_nombre:user.nombre||"Usuario",
      autor_avatar:user.avatar||0,
      autor_avatar_config:user.avatarConfig||user.avatar_config||null,
      titulo:title.trim(),
      contenido:body.trim(),
      categoria:category,
      fijado:false,
      cerrado:false,
      likes:0,
      respuestas_count:0,
      updated_at:new Date().toISOString()
    };
    const created=await dbPost("foro_temas",payload);
    setTitle("");setBody("");setCategory("general");
    SFX.success();showToast("Tema creado");
    await load();
    if(Array.isArray(created)&&created[0]){
      await saveFollow(created[0],{siguiendo:true,respuestas_vistas:0,markRead:true});
      setActive(created[0]);
    }
  }

  async function addReply(topic){
    if(!reply.trim())return;
    if(topic.cerrado){showToast("Este tema está cerrado");SFX.error();return;}
    const ok=await dbPost("foro_respuestas",{
      tema_id:topic.id,
      usuario_id:String(user.id),
      autor_nombre:user.nombre||"Usuario",
      autor_avatar:user.avatar||0,
      autor_avatar_config:user.avatarConfig||user.avatar_config||null,
      contenido:reply.trim(),
      likes:0
    });
    if(ok){
      const nextCount=(Number(topic.respuestas_count)||0)+1;
      await dbPatch("foro_temas",`?id=eq.${topic.id}`,{respuestas_count:nextCount,updated_at:new Date().toISOString()});
      setReply("");
      await saveFollow(topic,{siguiendo:true,respuestas_vistas:nextCount,markRead:true});
      SFX.success();
      showToast("Respuesta publicada");
      await load();
      setActive(a=>a?{...a,respuestas_count:nextCount,updated_at:new Date().toISOString()}:topic);
    }
  }

  async function voteTarget(target,tipo="tema"){
    const id=target.id;
    if(voted(tipo,id)){showToast("Ya has votado esto");SFX.error();return;}
    const ok=await dbPost("foro_votos",{usuario_id:String(user.id),target_tipo:tipo,target_id:id});
    if(!ok){showToast("No se pudo votar o ya estaba votado");SFX.error();return;}
    const table=tipo==="tema"?"foro_temas":"foro_respuestas";
    const nextLikes=(Number(target.likes)||0)+1;
    await dbPatch(table,`?id=eq.${id}`,{likes:nextLikes});
    SFX.coins();
    showToast("Voto guardado");
    await load();
    if(tipo==="tema") setActive(a=>a?.id===id?{...a,likes:nextLikes}:a);
  }

  async function togglePinned(topic){
    if(!canModerate)return;
    const ok=await dbPatch("foro_temas",`?id=eq.${topic.id}`,{fijado:!topic.fijado,updated_at:new Date().toISOString()});
    if(ok){showToast(!topic.fijado?"Tema fijado":"Tema desfijado");await load();setActive(a=>a?.id===topic.id?{...a,fijado:!topic.fijado}:a);}
  }

  async function toggleClosed(topic){
    if(!canModerate)return;
    const ok=await dbPatch("foro_temas",`?id=eq.${topic.id}`,{cerrado:!topic.cerrado,updated_at:new Date().toISOString()});
    if(ok){showToast(!topic.cerrado?"Tema cerrado":"Tema reabierto");await load();setActive(a=>a?.id===topic.id?{...a,cerrado:!topic.cerrado}:a);}
  }

  const filteredTopics=topics.filter(t=>{
    const q=normalizeText(search);
    const catOk=filter==="todo"
      ||(filter==="pendientes"&&unreadCount(t)>0)
      ||(filter==="seguidos"&&isFollowing(t))
      ||(filter==="mis_temas"&&String(t.usuario_id)===String(user.id))
      ||(!specialFilters.has(filter)&&String(t.categoria||"general")===filter);
    const qOk=!q||normalizeText(`${t.titulo||""} ${t.contenido||""} ${t.autor_nombre||""}`).includes(q);
    return catOk&&qOk;
  }).sort((a,b)=>{
    if(Boolean(a.fijado)!==Boolean(b.fijado)) return a.fijado?-1:1;
    return new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at);
  });

  const shown=active||null;
  return <div style={{animation:"fadeSlide .4s ease"}}>
    <SectionHeader icon="🗣️" title="Foro Rasta" sub={totalPendingThreads()>0?`${totalPendingThreads()} hilos pendientes de leer`:"Temas, respuestas, votos y conversación de la comunidad"}/>

    {!shown&&<Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>🗣️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Foro de comunidad</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Abre temas, responde dudas, vota ideas y participa sin mezclarlo con el tablón oficial.</div>
        </div>
      </div>
    </Card>}

    {!shown&&totalPendingThreads()>0&&<Card hover onClick={()=>setFilter("pendientes")} style={{marginBottom:14,background:"linear-gradient(180deg,#FFE9D8,#EBD18D)",border:"2px solid #A72822"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:999,background:"#A72822",color:"#FFF4D6",display:"grid",placeItems:"center",fontWeight:950}}>{totalPendingThreads()}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,color:T.g800}}>Hilos pendientes de leer</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Tienes temas seguidos con respuestas nuevas. Pulsa para verlos.</div>
        </div>
      </div>
    </Card>}

    {!shown&&<Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Abrir nuevo tema</div>
      <Input label="Título" value={title} onChange={setTitle} placeholder="Ej: ¿Qué cuidados necesita una rasta nueva?"/>
      <Select label="Categoría" value={category} onChange={setCategory} options={categories.filter(c=>!specialFilters.has(c.id)).map(c=>({value:c.id,label:`${c.icon} ${c.label}`}))}/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe tu duda, idea o propuesta..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:T.g150,resize:"vertical",outline:"none"}}/>
      <div style={{marginTop:10}}><Btn full col="gold" onClick={createTopic}>➕ Crear tema</Btn></div>
    </Card>}

    {!shown&&<Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`}}>
      <Input label="Buscar en el foro" value={search} onChange={setSearch} placeholder="Buscar tema, texto o autor..."/>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {categories.map(c=><button key={c.id} onClick={()=>{SFX.tab();setFilter(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===c.id?T.gold:T.g300}`,background:filter===c.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>
          {c.icon} {c.label}
        </button>)}
      </div>
    </Card>}

    {shown? <div>
      <Btn small col="ghost" onClick={()=>setActive(null)} style={{marginBottom:10}}>← Volver al foro</Btn>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${shown.fijado?T.gold:T.g300}`}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
          {shown.fijado&&<Badge col="gold">📌 fijado</Badge>}
          {shown.cerrado&&<Badge col="red">cerrado</Badge>}
          <Badge col="blue">{categoryIcon(shown.categoria)} {categoryLabel(shown.categoria)}</Badge>
          {isFollowing(shown)&&<Badge col="green">✓ seguido</Badge>}
          {unreadCount(shown)>0&&<Badge col="red">🔴 {unreadCount(shown)} nuevas</Badge>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8,cursor:"pointer"}} onClick={()=>setSelectedProfile(topicAuthor(shown))}>
          <PublicAvatar profile={topicAuthor(shown)} size={34}/>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{publicName(topicAuthor(shown))}</div>
            <div style={{fontSize:".7rem",fontWeight:800,color:T.textSub}}>{shown.created_at?new Date(shown.created_at).toLocaleString("es-ES"):""}</div>
          </div>
        </div>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.42rem",color:T.g800,lineHeight:1.05}}>{shown.titulo||"Tema del foro"}</div>
        <div style={{fontSize:".9rem",fontWeight:750,lineHeight:1.5,whiteSpace:'pre-wrap',marginTop:8,color:T.text}}>{shown.contenido}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Badge col="blue">💬 {topicReplies(shown.id).length} respuestas</Badge>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small col={isFollowing(shown)?"green":"ghost"} onClick={()=>toggleFollow(shown)}>{isFollowing(shown)?"✓ Siguiendo":"Seguir"}</Btn>
            <Btn small col={voted("tema",shown.id)?"ghost":"gold"} onClick={()=>voteTarget(shown,"tema")}>👍 {shown.likes||0}</Btn>
            {!canModerate&&<Btn small col="ghost" onClick={()=>openReport("tema",shown)}>🚩 Reportar</Btn>}
          </div>
        </div>
        {canModerate&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <Btn small col="ghost" onClick={()=>togglePinned(shown)}>{shown.fijado?"Desfijar":"Fijar"}</Btn>
          <Btn small col={shown.cerrado?"green":"red"} onClick={()=>toggleClosed(shown)}>{shown.cerrado?"Reabrir":"Cerrar"}</Btn>
        </div>}
      </Card>

      {topicReplies(shown.id).length===0?<EmptyState icon="💬" title="Sin respuestas" sub="Sé el primero en responder este tema."/>:topicReplies(shown.id).map(r=>{
        const a=replyAuthor(r);
        return <Card key={r.id} style={{marginBottom:8,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)",border:`1.5px solid ${T.g200}`}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,cursor:"pointer"}} onClick={()=>setSelectedProfile(a)}>
            <PublicAvatar profile={a} size={30}/>
            <div>
              <b style={{color:T.g800}}>{publicName(a)}</b>
              <div style={{fontSize:".66rem",fontWeight:800,color:T.textSub}}>{r.created_at?new Date(r.created_at).toLocaleString("es-ES"):""}</div>
            </div>
          </div>
          <div style={{fontSize:".86rem",fontWeight:750,lineHeight:1.45,whiteSpace:'pre-wrap'}}>{r.contenido}</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8,flexWrap:"wrap"}}>
            {!canModerate&&<button onClick={()=>openReport("respuesta",r)} style={{background:"rgba(255,244,214,.72)",border:`1.5px solid ${T.g200}`,cursor:"pointer",fontSize:"0.76rem",color:T.g700,fontWeight:950,padding:'6px 10px',borderRadius:999}}>🚩 Reportar</button>}
            <button onClick={()=>voteTarget(r,"respuesta")} disabled={voted("respuesta",r.id)} style={{background:T.g150,border:`1.5px solid ${T.g200}`,cursor:voted("respuesta",r.id)?"default":"pointer",fontSize:"0.76rem",color:T.g700,fontWeight:950,padding:'6px 10px',borderRadius:999,opacity:voted("respuesta",r.id)?.65:1}}>👍 {r.likes||0}</button>
          </div>
        </Card>;
      })}

      <Card style={{background:shown.cerrado?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        {shown.cerrado?<div style={{fontWeight:950,color:T.red,textAlign:"center"}}>Este tema está cerrado. No se pueden añadir respuestas.</div>:<>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Responder al tema</div>
          <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Responder al tema..." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:T.g150,resize:"vertical",outline:"none",fontWeight:800,color:T.text}}/>
          <div style={{marginTop:8}}><Btn full onClick={()=>addReply(shown)}>Responder</Btn></div>
        </>}
      </Card>
    </div> : loading?<Spinner/>:filteredTopics.length===0?<EmptyState icon="🗣️" title="Sin temas" sub={filter==="pendientes"?"No tienes hilos pendientes de leer.":filter==="seguidos"?"Todavía no sigues ningún tema.":"No hay temas con ese filtro."}/>:filteredTopics.map(t=>{
      const a=topicAuthor(t);
      const respuestas=Number(t.respuestas_count)||topicReplies(t.id).length;
      const unread=unreadCount(t);
      const followed=isFollowing(t);
      return <Card key={t.id} hover onClick={()=>openTopic(t)} style={{marginBottom:10,background:unread>0?"linear-gradient(180deg,#FFE9D8,#EBD18D)":t.fijado?"linear-gradient(180deg,#FFF4D6,#EBD18D)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:unread>0?"2px solid #A72822":t.fijado?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <PublicAvatar profile={a} size={38}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
              {t.fijado&&<Badge col="gold">📌</Badge>}
              {t.cerrado&&<Badge col="red">cerrado</Badge>}
              {followed&&<Badge col="green">✓ seguido</Badge>}
              {unread>0&&<Badge col="red">🔴 {unread} nuevas</Badge>}
              <Badge col="blue">{categoryIcon(t.categoria)} {categoryLabel(t.categoria)}</Badge>
            </div>
            <div style={{fontWeight:950,color:T.g800,lineHeight:1.2}}>{t.titulo||"Tema"}</div>
            <div style={{fontSize:".75rem",fontWeight:800,color:T.textSub,marginTop:3}}>{publicName(a)} · 👍 {t.likes||0} · 💬 {respuestas}</div>
          </div>
        </div>
      </Card>;
    })}
    <Modal show={!!report} onClose={()=>setReport(null)} title="Reportar contenido">
      {report&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
          <div style={{fontWeight:950,color:T.g800}}>🚩 {report.target_titulo}</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>Tipo: {report.target_tipo} · Autor: {report.target_autor_nombre||"Usuario"}</div>
        </Card>
        <Select label="Motivo" value={report.motivo} onChange={v=>setReport(r=>({...r,motivo:v}))} options={[
          {value:"contenido inapropiado",label:"Contenido inapropiado"},
          {value:"spam",label:"Spam o publicidad"},
          {value:"falta de respeto",label:"Falta de respeto"},
          {value:"datos personales",label:"Datos personales"},
          {value:"otro",label:"Otro motivo"}
        ]}/>
        <textarea value={report.detalle} onChange={e=>setReport(r=>({...r,detalle:e.target.value}))} placeholder="Añade algún detalle si hace falta..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:T.g150,resize:"vertical",outline:"none",fontWeight:800,color:T.text}}/>
        <div style={{marginTop:10}}><Btn full col="red" onClick={sendReport}>Enviar reporte</Btn></div>
      </>}
    </Modal>
    <PublicProfileModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)}/>
  </div>;
}


// TIENDA
function Tienda({user,setUser,showToast,showPoints,settings}){
  const [productos,setProductos]=useState([]);
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState("todo");
  const tiendaActiva=settings?.secciones?.tienda_activa!==false;
  useEffect(()=>{if(tiendaActiva)load();},[tiendaActiva]);
  if(!tiendaActiva)return <DisabledSection icon="🛍️" title="Tienda desactivada" sub="La tienda está apagada temporalmente desde Gestión > Ajustes."/>;

  async function load(){
    setLoading(true);
    let data=await dbGet("tienda_items","?activo=eq.true&order=puntos_precio.asc&select=*");
    if(!Array.isArray(data)||!data.length){
      data=await dbGet("premios","?activo=eq.true&order=puntos_precio.asc&select=*");
    }
    const pedidosRows=await dbGet("tienda_pedidos",`?usuario_id=eq.${user.id}&order=created_at.desc&limit=8&select=*`);
    const baseItems=Array.isArray(data)?data:[];
    const hasAvatar=baseItems.some(p=>String(p.categoria||"").toLowerCase()==="avatar"||String(p.tipo||"").includes("avatar")||String(p.tipo||"").includes("perfil"));
    const merged=hasAvatar?baseItems:[...baseItems,...avatarShopFallbackItems()];
    setProductos(merged);
    setPedidos(Array.isArray(pedidosRows)?pedidosRows:[]);
    setLoading(false);
  }

  async function canjear(p){
    const precio=Number(p.puntos_precio)||0;
    const stockLimitado=p.stock!==null && p.stock!==undefined && String(p.stock)!=="";
    if((user.puntos||0)<precio){showToast("No tienes suficientes puntos");SFX.error();return;}
    if(stockLimitado && Number(p.stock)<=0){showToast("Este premio está agotado");SFX.error();return;}
    const nuevos=Math.max(0,(user.puntos||0)-precio);
    const okUser=await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    const canjeRows=await dbPost("canjes",{
      usuario_id:user.id,
      premio_id:p.id,
      premio_nombre:p.nombre,
      puntos_gastados:precio,
      item_key:p.item_key||null,
      categoria:p.categoria||"premios",
      tipo:p.tipo||"canje"
    });
    const pedidoRows=await dbPost("tienda_pedidos",{
      usuario_id:String(user.id),
      cliente_nombre:user.nombre||user.email||"Cliente",
      cliente_email:user.email||null,
      item_id:String(p.id),
      item_nombre:p.nombre,
      item_categoria:p.categoria||"premios",
      item_tipo:p.tipo||"canje",
      puntos_coste:precio,
      precio_euros:0,
      estado:"pendiente",
      notas_cliente:null,
      updated_at:new Date().toISOString()
    });
    const pedidoId=Array.isArray(pedidoRows)?pedidoRows?.[0]?.id:null;
    if(stockLimitado){
      await dbPatch("tienda_items",`?id=eq.${p.id}`,{stock:Math.max(0,Number(p.stock)-1)});
    }
    if(okUser){
      setUser(u=>({...u,puntos:nuevos}));
      SFX.coins();
      await createNotification({rol_destino:"admin",tipo:"pedido",titulo:"Nuevo pedido de tienda",mensaje:`${user.nombre||user.email||"Cliente"} pidió ${p.nombre} por ${precio} puntos.`,entidad_tipo:"tienda_pedido",entidad_id:pedidoId||p.id,importante:true});
      await createNotification({usuario_id:user.id,rol_destino:"client",tipo:"pedido",titulo:"Pedido creado",mensaje:`Tu pedido de ${p.nombre} queda pendiente de preparación.`,entidad_tipo:"tienda_pedido",entidad_id:pedidoId||p.id,importante:false});
      showToast(`${p.nombre} pedido correctamente`);
      await load();
    }else{
      showToast("Pedido guardado, pero revisa los puntos del usuario");
    }
  }

  function addCart(p){
    addToLocalCart(user,p,1);
    SFX.coins();
    showToast(`${p.nombre} añadido al carrito`);
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

      {pedidos.length>0&&<Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧾 Tus últimos pedidos</div>
        {pedidos.slice(0,3).map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",padding:"7px 0",borderTop:`1px solid ${T.g150}`}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:900,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.item_nombre}</div>
            <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{new Date(p.created_at).toLocaleDateString("es-ES")} · {p.puntos_coste||0} pts</div>
          </div>
          <Badge col={p.estado==="entregado"?"green":p.estado==="cancelado"?"red":p.estado==="listo"?"blue":"gold"}>{p.estado}</Badge>
        </div>)}
      </Card>}

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
                <div style={{display:"grid",gridTemplateColumns:ok?"1fr 1fr":"1fr",gap:8}}>
                  <Btn full small col="ghost" onClick={()=>addCart(p)}>🛒 Añadir</Btn>
                  {ok?<Btn full small col="gold" onClick={()=>canjear(p)}>Canjear</Btn>:<div style={{textAlign:"center",fontSize:"0.78rem",color:T.textSub,fontWeight:850,alignSelf:"center"}}>Faltan {precio-(user.puntos||0)} pts</div>}
                </div>}
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
  {id:"tycoon",icon:"🏪",title:"Rasta Cuts Tycoon",desc:"Gestión profunda en tiempo real con moneda RC propia",pts:0},
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
  tycoon:{icon:"🏪",title:"Rasta Cuts Tycoon",short:"Tycoon"},
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
                    fontFamily:"'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
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


function GachaSlotsGame({user,onWin,settings}){
  const uid=user?.id||"anon";
  const SYMBOLS={scissors:{icon:'✂️',name:'Tijeras'},comb:{icon:'🪮',name:'Peines'},hook:{icon:'🪝',name:'Ganchillos'},band:{icon:'🧵',name:'Gomas'},ticket:{icon:'🎟️',name:'Ticket dorado'},gem:{icon:'💎',name:'Cristal'},coin:{icon:'🪙',name:'Moneda'}};
  const normal=['scissors','comb','hook','band','coin'];
  const [reels,setReels]=useState(['scissors','comb','hook']);
  const [spinning,setSpinning]=useState(false);
  const [result,setResult]=useState(null);
  const [pulls,setPulls]=useState(()=>getGachaPullsToday(uid));
  const dailyLimit=Math.max(1,parseInt(settings?.puntos?.gacha_tiradas_dia??GACHA_DAILY_PULL_LIMIT,10)||GACHA_DAILY_PULL_LIMIT);
  const pullsLeft=Math.max(0,dailyLimit-pulls);
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
    <div style={{marginTop:10,fontSize:'.72rem',fontWeight:800,opacity:.78,lineHeight:1.35}}>Tiradas usadas hoy: {pulls}/{dailyLimit}. Probabilidades: 50 pts 1/5000 · 20 pts 1/500 · 10 pts 1/200 · 5 pts 1/100 · 2 pts 1/30 · 1 pt 1/10.</div>
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





const TYCOON_ROOM_DEFS={
  hall:{id:"hall",icon:"🏪",name:"Hall / tienda",short:"Hall",desc:"Escaparate, caja, recepción y primera impresión del negocio.",unlocked:true,baseCost:130,baseTime:26,unlockCost:0,req:"Inicio",pos:{left:"39%",top:"18%"},effect:"Atrae más clientes y mejora el ritmo de caja."},
  salon:{id:"salon",icon:"💈",name:"Peluquería",short:"Peluquería",desc:"Sillas, espejos, herramientas y servicios principales.",unlocked:true,baseCost:170,baseTime:32,unlockCost:0,req:"Inicio",pos:{left:"12%",top:"45%"},effect:"Sube los RC por cliente y la capacidad de atender tandas."},
  storage:{id:"storage",icon:"📦",name:"Almacén",short:"Almacén",desc:"Estanterías, baldas, cajas, toallas y productos de trabajo.",unlocked:true,baseCost:115,baseTime:24,unlockCost:0,req:"Inicio",pos:{left:"66%",top:"47%"},effect:"Aumenta la capacidad de stock y abarata las reposiciones."},
  bathroom:{id:"bathroom",icon:"🚻",name:"Baño",short:"Baño",desc:"Limpieza, comodidad y satisfacción de los clientes.",unlocked:false,baseCost:155,baseTime:30,unlockCost:260,req:"Hall nivel 2",pos:{left:"28%",top:"69%"},effect:"Reduce la pérdida de limpieza y mejora la satisfacción."},
  chill:{id:"chill",icon:"🛋️",name:"Zona chill",short:"Chill",desc:"Sofás, música, café y espera agradable.",unlocked:false,baseCost:235,baseTime:42,unlockCost:460,req:"Almacén nivel 2",pos:{left:"52%",top:"70%"},effect:"Mejora reputación, clientes VIP y estabilidad de ingresos."},
  terrace:{id:"terrace",icon:"🌴",name:"Terraza",short:"Terraza",desc:"Exterior, eventos, ambiente y picos de clientela.",unlocked:false,baseCost:360,baseTime:58,unlockCost:900,req:"Zona chill nivel 2",pos:{left:"78%",top:"23%"},effect:"Aumenta mucho los picos de clientes cuando el negocio crece."}
};
const TYCOON_ROOM_ORDER=["hall","salon","storage","bathroom","chill","terrace"];

const TYCOON_ROOM_IMAGES={
  hall:{base:"/tycoon/hall.webp",label:"Hall / tienda"},
  salon:{base:"/tycoon/peluqueria.webp",label:"Peluquería"},
  storage:{base:"/tycoon/almacen.webp",label:"Almacén"},
  bathroom:{base:"/tycoon/bano.webp",label:"Baño"},
  chill:{base:"/tycoon/chill.webp",label:"Zona chill"},
  terrace:{base:"/tycoon/terraza.webp",label:"Terraza"}
};
const TYCOON_OBJECT_IMAGES={
  cash:"/tycoon/objetos/caja.webp",
  chair:"/tycoon/objetos/silla.webp",
  shelf:"/tycoon/objetos/estanteria.webp",
  vitrine:"/tycoon/objetos/vitrina.webp",
  plant:"/tycoon/objetos/planta.webp",
  lights:"/tycoon/objetos/luces.webp"
};
function tycoonRoomImage(id){
  return TYCOON_ROOM_IMAGES[id]?.base||"/tycoon/hall.webp";
}

function clampNum(n,min,max){return Math.max(min,Math.min(max,Number(n)||0));}
function tycoonRoomDef(id){return TYCOON_ROOM_DEFS[id]||TYCOON_ROOM_DEFS.hall;}
function tycoonBaseRoom(id){const d=tycoonRoomDef(id);return {id,level:d.unlocked?1:0,unlocked:Boolean(d.unlocked),name:d.name,icon:d.icon,desc:d.desc};}
function createTycoonInitialState(){
  const now=Date.now();
  const rooms={};
  TYCOON_ROOM_ORDER.forEach(id=>rooms[id]=tycoonBaseRoom(id));
  return {
    version:3,
    rc:180,
    lifetimeRC:180,
    reputation:1,
    satisfaction:70,
    cleanliness:74,
    energy:82,
    totalClients:0,
    selectedRoom:"salon",
    guideStep:0,
    lastTick:now,
    rooms,
    stock:{wax:16,shampoo:12,towels:18,drinks:6},
    staff:{barbers:1,assistants:0,cashiers:0},
    decor:{plants:0,posters:0,lights:0,vitrine:0},
    missions:{clients25:false,salon3:false,storage3:false,chillOpen:false,firstBuild:false},
    buildQueue:[],
    log:[{t:now,msg:"Rasta abrió el estudio. Empiezas pequeño, pero con mapa, salas, stock y obras en tiempo real."}]
  };
}
function tycoonKey(user){return `rasta_cuts_tycoon_v3_${user?.id||"anon"}`;}
function tycoonLegacyKeys(user){const id=user?.id||"anon";return [`rasta_cuts_tycoon_v2_${id}`,`rasta_cuts_tycoon_v1_${id}`];}
function tycoonFormatTime(ms){
  const sec=Math.max(0,Math.ceil((Number(ms)||0)/1000));
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  if(h>0)return `${h}h ${String(m).padStart(2,"0")}m`;
  if(m>0)return `${m}m ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}
function tycoonUpgradeCost(state,id){
  const lvl=Math.max(1,Number(state?.rooms?.[id]?.level)||1);
  const base=tycoonRoomDef(id).baseCost||150;
  return Math.round(base*Math.pow(1.52,lvl-1));
}
function tycoonUnlockCost(id){return tycoonRoomDef(id).unlockCost||0;}
function tycoonBuildSeconds(state,id,type="upgrade"){
  const lvl=Math.max(1,Number(state?.rooms?.[id]?.level)||1);
  const base=tycoonRoomDef(id).baseTime||30;
  return Math.round((type==="unlock"?base+24:base)*Math.pow(1.22,lvl-1));
}
function tycoonCanUnlock(id,state){
  if(id==="bathroom")return (state.rooms?.hall?.level||1)>=2;
  if(id==="chill")return (state.rooms?.storage?.level||1)>=2;
  if(id==="terrace")return (state.rooms?.chill?.level||0)>=2;
  return true;
}
function tycoonTaskFor(state,roomId){return (state.buildQueue||[]).find(t=>String(t.roomId)===String(roomId));}
function normalizeTycoonState(raw){
  const base=createTycoonInitialState();
  if(!raw||typeof raw!=="object")return base;
  const rooms={...base.rooms};
  const oldRooms=raw.rooms||{};
  TYCOON_ROOM_ORDER.forEach(id=>{
    rooms[id]={...rooms[id],...(oldRooms[id]||{})};
    rooms[id].id=id;rooms[id].name=tycoonRoomDef(id).name;rooms[id].icon=tycoonRoomDef(id).icon;rooms[id].desc=tycoonRoomDef(id).desc;
  });
  if(oldRooms.main&&!oldRooms.salon){
    rooms.salon={...rooms.salon,...oldRooms.main,id:"salon",name:tycoonRoomDef("salon").name,icon:tycoonRoomDef("salon").icon,desc:tycoonRoomDef("salon").desc,unlocked:true,level:Math.max(1,oldRooms.main.level||1)};
  }
  TYCOON_ROOM_ORDER.forEach(id=>{
    const def=tycoonRoomDef(id);
    rooms[id].unlocked=Boolean(rooms[id].unlocked||def.unlocked);
    rooms[id].level=Math.max(rooms[id].unlocked?1:0,Number(rooms[id].level)||0);
  });
  let buildQueue=Array.isArray(raw.buildQueue)?raw.buildQueue:[];
  if(raw.queue&&raw.queue.roomId){
    buildQueue=[...buildQueue,{
      id:`legacy_${raw.queue.roomId}_${raw.queue.finishAt||Date.now()}`,
      roomId:raw.queue.roomId,
      type:"upgrade",
      targetLevel:raw.queue.toLevel||((rooms[raw.queue.roomId]?.level||1)+1),
      cost:raw.queue.cost||0,
      label:`${rooms[raw.queue.roomId]?.name||"Sala"} nivel ${raw.queue.toLevel||""}`,
      startedAt:raw.queue.startedAt||Date.now(),
      endAt:raw.queue.finishAt||Date.now()
    }];
  }
  buildQueue=buildQueue
    .filter(t=>t&&t.roomId&&TYCOON_ROOM_DEFS[t.roomId])
    .map(t=>({...t,id:t.id||`${t.roomId}_${t.endAt||Date.now()}`,startedAt:Number(t.startedAt)||Date.now(),endAt:Number(t.endAt||t.finishAt)||Date.now(),targetLevel:Number(t.targetLevel||t.toLevel)||1}));
  const selected=TYCOON_ROOM_DEFS[raw.selectedRoom]?raw.selectedRoom:(TYCOON_ROOM_DEFS[raw.activeRoom]?raw.activeRoom:"salon");
  return completeTycoonTasks({
    ...base,
    ...raw,
    version:3,
    selectedRoom:selected,
    rooms,
    stock:{...base.stock,...(raw.stock||{})},
    staff:{...base.staff,...(raw.staff||{})},
    decor:{...base.decor,...(raw.decor||{})},
    missions:{...base.missions,...(raw.missions||{})},
    buildQueue,
    log:Array.isArray(raw.log)?raw.log.slice(0,26):base.log
  });
}
function loadTycoonState(user){
  try{
    let raw=localStorage.getItem(tycoonKey(user));
    if(!raw){
      for(const k of tycoonLegacyKeys(user)){raw=localStorage.getItem(k);if(raw)break;}
    }
    return raw?normalizeTycoonState(JSON.parse(raw)):createTycoonInitialState();
  }catch(e){return createTycoonInitialState();}
}
function saveTycoonState(user,state){
  try{localStorage.setItem(tycoonKey(user),JSON.stringify({...state,lastTick:Date.now()}));}catch(e){}
}
function completeTycoonTasks(raw){
  const now=Date.now();
  const queue=Array.isArray(raw.buildQueue)?raw.buildQueue:[];
  const due=queue.filter(t=>Number(t.endAt||0)<=now);
  if(!due.length)return raw;
  const next={...raw,rooms:{...(raw.rooms||{})},buildQueue:queue.filter(t=>Number(t.endAt||0)>now),log:[...(raw.log||[])]};
  due.forEach(task=>{
    const def=tycoonRoomDef(task.roomId);
    const current=next.rooms[task.roomId]||tycoonBaseRoom(task.roomId);
    const target=Math.max(Number(task.targetLevel)||1,task.type==="unlock"?1:(current.level||0)+1);
    next.rooms[task.roomId]={...current,id:task.roomId,name:def.name,icon:def.icon,desc:def.desc,unlocked:true,level:target};
    next.missions={...(next.missions||{}),firstBuild:true};
    if(task.roomId==="chill")next.missions.chillOpen=true;
    next.log=[{t:now,msg:task.type==="unlock"?`${def.name} queda desbloqueada.`:`${def.name} termina la mejora a nivel ${target}.`},...(next.log||[])].slice(0,26);
  });
  return next;
}
function tycoonEconomy(state){
  const lvl=id=>Math.max(0,Number(state.rooms?.[id]?.level)||0);
  const hall=lvl("hall"),salon=lvl("salon"),storage=lvl("storage"),bathroom=lvl("bathroom"),chill=lvl("chill"),terrace=lvl("terrace");
  const totalStock=Object.values(state.stock||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const capacity=16+(storage*12);
  const stockRatio=clampNum(totalStock/Math.max(1,capacity),0,1);
  const staff=state.staff||{};
  const servicePower=(salon*1.28)+(staff.barbers||0)*1.05+(staff.assistants||0)*.42;
  const attraction=(hall*.72)+(chill*.36)+(terrace*.55)+(Number(state.reputation)||1)*.38;
  const mood=(clampNum(state.satisfaction,0,100)/100*.55)+(clampNum(state.cleanliness,0,100)/100*.30)+(clampNum(state.energy,0,100)/100*.15);
  const clientsHour=Math.max(0,Math.round((4+attraction*5.4)*stockRatio*mood));
  const rcClient=Math.round(8+(salon*4.7)+(chill*1.7)+(terrace*1.2)+(state.reputation||1)*1.1);
  const grossHour=clientsHour*rcClient;
  const upkeepHour=Math.round(((staff.barbers||0)*18)+((staff.assistants||0)*10)+((staff.cashiers||0)*12)+(hall+salon+storage+bathroom+chill+terrace)*3.8);
  const netHour=Math.max(0,grossHour-upkeepHour);
  return {hall,salon,storage,bathroom,chill,terrace,totalStock,capacity,stockRatio,servicePower,clientsHour,rcClient,grossHour,upkeepHour,netHour};
}
function RastaCutsTycoonGame({user,showToast,standalone=false,onExit}){
  const [state,setState]=useState(()=>loadTycoonState(user));
  const [tab,setTab]=useState("mapa");
  const [inspect,setInspect]=useState(null);
  const [nowTick,setNowTick]=useState(()=>Date.now());
  const economy=useMemo(()=>tycoonEconomy(state),[state]);
  const selectedId=TYCOON_ROOM_DEFS[state.selectedRoom]?state.selectedRoom:"salon";
  const selectedRoom=state.rooms?.[selectedId]||tycoonBaseRoom(selectedId);
  const selectedDef=tycoonRoomDef(selectedId);
  const selectedTask=tycoonTaskFor(state,selectedId);
  const roomList=TYCOON_ROOM_ORDER.map(id=>({...(state.rooms?.[id]||tycoonBaseRoom(id)),...tycoonRoomDef(id),level:state.rooms?.[id]?.level??tycoonBaseRoom(id).level,unlocked:state.rooms?.[id]?.unlocked??tycoonBaseRoom(id).unlocked}));
  const maxQueue=1+Math.floor((state.rooms?.hall?.level||1)/4);
  const activeQueue=(state.buildQueue||[]).filter(t=>Number(t.endAt||0)>Date.now());
  const queueFull=activeQueue.length>=maxQueue;
  function pushLog(prev,msg){return [{t:Date.now(),msg},...(prev.log||[])].slice(0,26);}
  function mutate(fn){
    setState(prev=>{
      const cleaned=completeTycoonTasks(prev);
      const next=fn({...cleaned,rooms:{...cleaned.rooms},stock:{...cleaned.stock},staff:{...cleaned.staff},decor:{...cleaned.decor},missions:{...cleaned.missions},buildQueue:[...(cleaned.buildQueue||[])],log:[...(cleaned.log||[])]});
      saveTycoonState(user,next);
      return next;
    });
  }
  useEffect(()=>{saveTycoonState(user,state);},[state,user?.id]);
  useEffect(()=>{const clock=setInterval(()=>setNowTick(Date.now()),1000);return()=>clearInterval(clock);},[]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      setState(prev=>{
        prev=completeTycoonTasks(prev);
        const eco=tycoonEconomy(prev);
        const stock={...(prev.stock||{})};
        let served=0,gain=0,log=prev.log||[];
        if(eco.totalStock>0&&eco.clientsHour>0&&Math.random()<Math.min(.92,eco.clientsHour/35)){
          served=Math.max(1,Math.min(6,Math.floor(eco.servicePower)));
          served=Math.min(served,Math.floor(eco.totalStock));
          let left=served;
          ["wax","shampoo","towels","drinks"].forEach(k=>{const take=Math.min(left,Number(stock[k]||0));stock[k]=Math.max(0,Number(stock[k]||0)-take);left-=take;});
          gain=served*eco.rcClient;
          if(Math.random()<.18)log=pushLog({...prev,log},`Entraron ${served} cliente${served===1?"":"s"} y dejaron ${gain} RC.`);
        }
        const loss=served>0?served*(1.15-(eco.bathroom*.07)):.18;
        const satDelta=served>0?.45+(eco.chill*.08)+(eco.bathroom*.04):-.08;
        const next={...prev,stock,log,rc:Math.max(0,Math.round((prev.rc||0)+gain)),lifetimeRC:(prev.lifetimeRC||0)+gain,totalClients:(prev.totalClients||0)+served,cleanliness:clampNum((prev.cleanliness||70)-loss,0,100),satisfaction:clampNum((prev.satisfaction||70)+satDelta,0,100),energy:clampNum((prev.energy||80)-(served*.6)+.16,0,100)};
        next.reputation=clampNum((next.reputation||1)+(next.satisfaction>82?.012:0)-(next.satisfaction<35?.018:0),1,60);
        next.missions={...(next.missions||{}),clients25:(next.totalClients||0)>=25,salon3:(next.rooms?.salon?.level||0)>=3,storage3:(next.rooms?.storage?.level||0)>=3,chillOpen:Boolean(next.rooms?.chill?.unlocked)};
        saveTycoonState(user,next);
        return next;
      });
    },4000);
    return()=>clearInterval(timer);
  },[user?.id]);
  function startRoomTask(id,type="upgrade"){
    const def=tycoonRoomDef(id),room=state.rooms?.[id]||tycoonBaseRoom(id);
    if(tycoonTaskFor(state,id)){showToast?.("Ya hay una obra en marcha en esa zona");SFX.error();return;}
    if(queueFull){showToast?.(`Cola de obras llena: ${activeQueue.length}/${maxQueue}`);SFX.error();return;}
    if(type==="unlock"||!room.unlocked){
      if(room.unlocked)return;
      if(!tycoonCanUnlock(id,state)){showToast?.(`Antes necesitas: ${def.req}`);SFX.error();return;}
      const cost=tycoonUnlockCost(id);
      if((state.rc||0)<cost){showToast?.(`Necesitas ${cost} RC para abrir ${def.name}`);SFX.error();return;}
      const now=Date.now(),endAt=now+tycoonBuildSeconds(state,id,"unlock")*1000;
      mutate(prev=>{prev.rc-=cost;prev.buildQueue.push({id:`${id}_${now}`,roomId:id,type:"unlock",targetLevel:1,cost,label:`Abrir ${def.name}`,startedAt:now,endAt});prev.log=pushLog(prev,`Obra iniciada: abrir ${def.name}.`);return prev;});
      setInspect({icon:def.icon,title:def.name,text:`Zona en obras. Tiempo: ${tycoonFormatTime(endAt-now)}.`});SFX.coins();return;
    }
    const nextLevel=(room.level||1)+1,cost=tycoonUpgradeCost(state,id);
    if((state.rc||0)<cost){showToast?.(`Necesitas ${cost} RC para mejorar ${def.name}`);SFX.error();return;}
    const now=Date.now(),endAt=now+tycoonBuildSeconds(state,id,"upgrade")*1000;
    mutate(prev=>{prev.rc-=cost;prev.buildQueue.push({id:`${id}_${now}`,roomId:id,type:"upgrade",targetLevel:nextLevel,cost,label:`${def.name} nivel ${nextLevel}`,startedAt:now,endAt});prev.log=pushLog(prev,`Mejora iniciada: ${def.name} a nivel ${nextLevel}.`);return prev;});
    setInspect({icon:"🔨",title:"Obra iniciada",text:`${def.name} subirá a nivel ${nextLevel} cuando termine.`});SFX.success();
  }
  function enterRoom(id){
    const room=state.rooms?.[id]||tycoonBaseRoom(id),def=tycoonRoomDef(id);
    if(!room.unlocked){setInspect({icon:def.icon,title:def.name,roomId:id,unlock:tycoonCanUnlock(id,state),text:tycoonCanUnlock(id,state)?`Puedes abrir esta zona por ${tycoonUnlockCost(id)} RC.`:`Bloqueada. Requisito: ${def.req}.`});SFX.error();return;}
    mutate(prev=>({...prev,selectedRoom:id}));
    setTab("sala");setInspect(null);SFX.nav();
  }
  function attendBurst(){
    const available=Object.values(state.stock||{}).reduce((a,b)=>a+(Number(b)||0),0);
    if(available<=0){showToast?.("No queda stock. Repon el almacén.");SFX.error();return;}
    mutate(prev=>{
      const eco=tycoonEconomy(prev);
      let served=Math.max(1,Math.min(8,Math.floor(eco.servicePower)));
      served=Math.min(served,Object.values(prev.stock||{}).reduce((a,b)=>a+(Number(b)||0),0));
      let left=served;
      ["wax","shampoo","towels","drinks"].forEach(k=>{const take=Math.min(left,Number(prev.stock[k]||0));prev.stock[k]=Math.max(0,Number(prev.stock[k]||0)-take);left-=take;});
      const gain=served*eco.rcClient;
      prev.rc+=gain;prev.lifetimeRC=(prev.lifetimeRC||0)+gain;prev.totalClients=(prev.totalClients||0)+served;
      prev.satisfaction=clampNum((prev.satisfaction||70)+1.2,0,100);prev.cleanliness=clampNum((prev.cleanliness||70)-(served*1.5),0,100);prev.energy=clampNum((prev.energy||80)-(served*.9),0,100);
      prev.log=pushLog(prev,`Atendiste una tanda de ${served} cliente${served===1?"":"s"} y ganaste ${gain} RC.`);
      return prev;
    });
    SFX.coins();
  }
  function restock(){
    const cost=Math.max(45,Math.round(135-(economy.storage*9)));
    if((state.rc||0)<cost){showToast?.("No tienes RC suficientes para reponer");SFX.error();return;}
    mutate(prev=>{const eco=tycoonEconomy(prev);prev.rc-=cost;const add=16+eco.storage*7;prev.stock.wax=(prev.stock.wax||0)+Math.ceil(add*.28);prev.stock.shampoo=(prev.stock.shampoo||0)+Math.ceil(add*.25);prev.stock.towels=(prev.stock.towels||0)+Math.ceil(add*.32);prev.stock.drinks=(prev.stock.drinks||0)+Math.ceil(add*.15);prev.log=pushLog(prev,`Almacén repuesto: +${add} unidades.`);return prev;});
    SFX.success();
  }
  function cleanShop(){
    const cost=35;
    if((state.rc||0)<cost){showToast?.("No tienes RC suficientes para limpiar");SFX.error();return;}
    mutate(prev=>{prev.rc-=cost;prev.cleanliness=clampNum((prev.cleanliness||70)+30+(economy.bathroom*5),0,100);prev.satisfaction=clampNum((prev.satisfaction||70)+3,0,100);prev.log=pushLog(prev,"Limpieza general lista. El estudio vuelve a oler a local serio.");return prev;});
    SFX.success();
  }
  function hire(type){
    const costs={barbers:390,assistants:210,cashiers:280};
    const cost=costs[type]||220;
    if((state.rc||0)<cost){showToast?.("No tienes RC suficientes para contratar");SFX.error();return;}
    mutate(prev=>{prev.rc-=cost;prev.staff[type]=(prev.staff[type]||0)+1;prev.log=pushLog(prev,type==="barbers"?"Nuevo barbero contratado.":type==="cashiers"?"Nueva persona en caja contratada.":"Nuevo ayudante contratado.");return prev;});
    SFX.success();
  }
  function buyDecor(type){
    const costs={plants:90,posters:120,lights:180,vitrine:260};
    const cost=costs[type]||100;
    if((state.rc||0)<cost){showToast?.("Faltan RC para decoración");SFX.error();return;}
    mutate(prev=>{prev.rc-=cost;prev.decor[type]=(prev.decor[type]||0)+1;prev.satisfaction=clampNum((prev.satisfaction||70)+1.5,0,100);prev.log=pushLog(prev,"Decoración añadida al hall.");return prev;});
    SFX.success();
  }
  function resetGame(){
    if(!confirm("¿Reiniciar Rasta Cuts Tycoon? Se perderá el progreso local de este juego."))return;
    const fresh=createTycoonInitialState();setState(fresh);saveTycoonState(user,fresh);SFX.error();
  }
  function handleHotspot(h){
    setInspect(h);
    if(h.action==="attend")attendBurst();
    else if(h.action==="restock")restock();
    else if(h.action==="clean")cleanShop();
    else if(h.action==="upgrade")startRoomTask(selectedId,"upgrade");
    else SFX.tab();
  }
  function MiniStat({icon,label,value,sub}){return <div style={{background:"linear-gradient(180deg,rgba(255,244,214,.95),rgba(232,211,162,.87))",border:"1.5px solid rgba(212,175,55,.55)",borderRadius:16,padding:"10px 11px",boxShadow:"0 8px 18px rgba(0,0,0,.16)"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:"1.25rem"}}>{icon}</span><b style={{color:T.g800}}>{value}</b></div><div style={{fontSize:".68rem",fontWeight:900,color:T.textSub,marginTop:3}}>{label}</div>{sub&&<div style={{fontSize:".62rem",fontWeight:800,color:T.textSub,opacity:.82}}>{sub}</div>}</div>;}
  function Bar({label,value}){const v=clampNum(value,0,100);return <div style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",fontSize:".74rem",fontWeight:950,color:T.g800,marginBottom:4}}><span>{label}</span><span>{Math.round(v)}%</span></div><div style={{height:10,borderRadius:999,background:"rgba(75,48,27,.16)",overflow:"hidden"}}><div style={{height:"100%",width:`${v}%`,borderRadius:999,background:v<35?"linear-gradient(90deg,#8F2E24,#E57373)":v<70?"linear-gradient(90deg,#B99A45,#F3D37B)":"linear-gradient(90deg,#315D2D,#7FCB84)",transition:"width .25s ease"}}/></div></div>;}
  function Tab({id,icon,label}){return <button onClick={()=>{SFX.tab();setTab(id);}} style={{border:`2px solid ${tab===id?T.gold:"rgba(255,244,214,.25)"}`,background:tab===id?"linear-gradient(180deg,#D4AF37,#A87945)":"rgba(255,244,214,.12)",color:tab===id?T.g900:"#FFF4D6",borderRadius:16,padding:"10px 8px",fontWeight:950,cursor:"pointer",boxShadow:tab===id?"0 10px 24px rgba(212,175,55,.22)":"0 8px 18px rgba(0,0,0,.15)"}}><div style={{fontSize:"1.25rem"}}>{icon}</div><div style={{fontSize:".72rem"}}>{label}</div></button>;}
  function BuildingBadge({task}){
    if(!task)return null;
    const left=Math.max(0,Number(task.endAt||0)-nowTick);
    return <span style={{display:"inline-flex",gap:5,alignItems:"center",background:"rgba(18,8,6,.72)",color:T.white,borderRadius:999,padding:"4px 8px",fontSize:".64rem",fontWeight:950}}>🔨 {tycoonFormatTime(left)}</span>;
  }
  function TycoonMap(){
    const opened=roomList.filter(r=>r.unlocked).length;
    return <div className="tycoon-map-card" style={{background:"linear-gradient(150deg,rgba(23,33,20,.96),rgba(49,64,30,.94) 52%,rgba(138,106,43,.92))",border:"1px solid rgba(255,244,214,.34)",color:T.white,overflow:"hidden",position:"relative",borderRadius:28,padding:16,boxShadow:"0 22px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,244,214,.10)",animation:"none",transform:"translateZ(0)",backfaceVisibility:"hidden"}}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(circle at 18% 14%,rgba(255,244,214,.16),transparent 25%),radial-gradient(circle at 82% 8%,rgba(185,154,69,.14),transparent 32%),linear-gradient(30deg,transparent 48%,rgba(255,244,214,.055) 49%,transparent 50%)"}}/>
      <div style={{position:"relative",zIndex:2,display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontFamily:"var(--ui-display,'Outfit',system-ui)",fontSize:"1.45rem",fontWeight:950,letterSpacing:"-.04em"}}>Mapa del negocio</div>
          <div style={{fontSize:".82rem",fontWeight:850,opacity:.84,lineHeight:1.35}}>Vista principal estable: entra en salas, revisa requisitos y lanza mejoras sin parpadeos.</div>
        </div>
        <Badge col="gold">{opened}/{roomList.length} zonas</Badge>
      </div>
      <div className="tycoon-map-board" style={{position:"relative",height:standalone?405:325,zIndex:2,borderRadius:24,overflow:"hidden",background:"linear-gradient(180deg,rgba(255,244,214,.10),rgba(0,0,0,.22))",border:"1px solid rgba(255,244,214,.18)",boxShadow:"inset 0 0 42px rgba(0,0,0,.20)",transform:"translateZ(0)",animation:"none"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(0,0,0,.16),transparent 55%),radial-gradient(circle at 50% 42%,rgba(255,244,214,.09),transparent 42%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",left:"6%",right:"6%",bottom:"16%",height:78,background:"rgba(72,42,20,.58)",transform:"skewX(-18deg) translateZ(0)",borderRadius:32,boxShadow:"0 22px 40px rgba(0,0,0,.24)"}}/>
        <div style={{position:"absolute",left:"14%",top:"18%",width:"70%",height:"58%",borderRadius:"50%",border:"3px dashed rgba(255,244,214,.16)",pointerEvents:"none"}}/>
        {roomList.map(r=>{
          const task=tycoonTaskFor(state,r.id),blocked=!r.unlocked,def=tycoonRoomDef(r.id);
          return <button key={r.id} onClick={()=>r.unlocked?enterRoom(r.id):setInspect({icon:r.icon,title:r.name,roomId:r.id,unlock:tycoonCanUnlock(r.id,state),text:tycoonCanUnlock(r.id,state)?`Puedes abrir esta zona por ${tycoonUnlockCost(r.id)} RC.`:`Bloqueada. Requisito: ${def.req}.`})} style={{position:"absolute",left:def.pos.left,top:def.pos.top,transform:"translate(-50%,-50%) translateZ(0)",width:124,minHeight:88,border:`2px solid ${blocked?"rgba(255,244,214,.24)":T.gold}`,background:blocked?"rgba(18,8,6,.72)":"linear-gradient(180deg,#FFF4D6,#C6A06A)",color:blocked?T.white:T.g900,borderRadius:20,padding:10,cursor:"pointer",boxShadow:"0 14px 24px rgba(0,0,0,.30)",textAlign:"center",transition:"transform .18s ease, filter .18s ease, box-shadow .18s ease",animation:"none",willChange:"transform"}} onMouseEnter={e=>{e.currentTarget.style.transform="translate(-50%,-52%) translateZ(0) scale(1.03)";e.currentTarget.style.filter="brightness(1.06)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translate(-50%,-50%) translateZ(0)";e.currentTarget.style.filter="none";}}>
            <div style={{fontSize:"1.65rem",lineHeight:1}}>{blocked?"🔒":r.icon}</div>
            <div style={{fontWeight:950,fontSize:".82rem",lineHeight:1.1}}>{r.short||r.name}</div>
            <div style={{fontSize:".65rem",fontWeight:850,opacity:.84}}>{r.unlocked?`Nv. ${r.level||0}`:"Bloqueada"}</div>
            {task&&<div style={{marginTop:5}}><BuildingBadge task={task}/></div>}
          </button>;
        })}
      </div>
      {inspect&&<div style={{position:"relative",zIndex:3,marginTop:12,background:"rgba(255,244,214,.12)",border:"1px solid rgba(255,244,214,.25)",borderRadius:18,padding:12}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{fontSize:"1.7rem"}}>{inspect.icon}</div><div style={{flex:1}}><div style={{fontWeight:950}}>{inspect.title}</div><div style={{fontSize:".78rem",fontWeight:850,opacity:.86,lineHeight:1.35}}>{inspect.text}</div></div>{inspect.roomId&&inspect.unlock&&<Btn small col="gold" onClick={()=>startRoomTask(inspect.roomId,"unlock")}>Abrir</Btn>}</div>
      </div>}
    </div>;
  }
  function SceneObject({h}){return <button onClick={()=>handleHotspot(h)} title={h.title} style={{position:"absolute",left:h.left,top:h.top,width:h.w||82,height:h.h||64,border:"2px solid rgba(255,244,214,.65)",background:"rgba(255,244,214,.82)",color:T.g900,borderRadius:18,cursor:"pointer",boxShadow:"0 12px 26px rgba(0,0,0,.25)",fontWeight:950,display:"grid",placeItems:"center",animation:"chipFloat 4s ease-in-out infinite"}}><div style={{fontSize:"1.7rem",lineHeight:1}}>{h.icon}</div><div style={{fontSize:".66rem",lineHeight:1.05}}>{h.title}</div></button>;}
  function TycoonScene({roomId}){
    const room=state.rooms?.[roomId]||tycoonBaseRoom(roomId),def=tycoonRoomDef(roomId),lvl=room.level||0;
    const roomImg=tycoonRoomImage(roomId);
    const common=[{icon:"⬆️",title:"Mejorar",text:`Sube ${def.name} para mejorar su efecto.`,left:"77%",top:"11%",action:"upgrade",kind:"upgrade"}];
    const hotspots={
      hall:[
        {icon:"🧾",title:"Caja",text:"Controla cobros, flujo de clientes y RC generados.",left:"67%",top:"58%",action:"upgrade",kind:"money"},
        {icon:"🧴",title:"Vitrina",text:"Decora el escaparate para mejorar la primera impresión.",left:"17%",top:"52%",action:"decor",kind:"decor"},
        {icon:"🚪",title:"Entrada",text:"Por aquí entran los clientes. El Hall aumenta atracción.",left:"43%",top:"47%",kind:"info"}
      ],
      salon:[
        {icon:"💺",title:"Silla",text:"Atiende una tanda manual de clientes y cobra RC al momento.",left:"15%",top:"58%",action:"attend",kind:"action"},
        {icon:"🪞",title:"Espejo",text:"La Peluquería sube los RC por cliente y la capacidad de servicio.",left:"46%",top:"24%",action:"upgrade",kind:"upgrade"},
        {icon:"🧍",title:"Clientes",text:"La cola depende de reputación, limpieza, stock y energía.",left:"64%",top:"59%",kind:"info"}
      ],
      storage:[
        {icon:"🧴",title:"Baldas",text:"Aquí vive el stock. Si se vacía, se frenan los ingresos por hora.",left:"16%",top:"35%",action:"restock",kind:"action"},
        {icon:"📦",title:"Cajas",text:"Reponer llena productos, toallas y bebidas.",left:"54%",top:"58%",action:"restock",kind:"action"},
        {icon:"📋",title:"Inventario",text:`Stock actual: ${Math.floor(economy.totalStock)}/${economy.capacity}.`,left:"73%",top:"32%",kind:"info"}
      ],
      bathroom:[
        {icon:"🚿",title:"Lavabo",text:"El baño ayuda a que la limpieza no caiga tan rápido.",left:"21%",top:"45%",action:"clean",kind:"action"},
        {icon:"🧹",title:"Limpieza",text:"Paga RC para recuperar limpieza y satisfacción.",left:"63%",top:"55%",action:"clean",kind:"action"}
      ],
      chill:[
        {icon:"🛋️",title:"Sofá",text:"La zona chill mejora espera, satisfacción y reputación.",left:"19%",top:"60%",action:"upgrade",kind:"upgrade"},
        {icon:"🎶",title:"Ambiente",text:"Más ambiente, más ganas de quedarse.",left:"61%",top:"33%",kind:"info"},
        {icon:"☕",title:"Café",text:"Más comodidad para clientes VIP.",left:"49%",top:"58%",kind:"info"}
      ],
      terrace:[
        {icon:"🌴",title:"Terraza",text:"Eventos y ambiente exterior: sube picos de clientes.",left:"17%",top:"48%",action:"upgrade",kind:"upgrade"},
        {icon:"☀️",title:"Evento",text:"La terraza será clave para misiones y eventos futuros.",left:"61%",top:"42%",kind:"info"},
        {icon:"🎤",title:"Música",text:"Aquí luego podremos activar eventos especiales.",left:"42%",top:"60%",kind:"info"}
      ]
    };
    const bg={hall:"linear-gradient(180deg,#68401F,#24110A)",salon:"linear-gradient(180deg,#7A4A24,#2A160B)",storage:"linear-gradient(180deg,#5A3A22,#24130A)",bathroom:"linear-gradient(180deg,#557383,#20313A)",chill:"linear-gradient(180deg,#4E2A3A,#211019)",terrace:"linear-gradient(180deg,#617C42,#2A391D)"}[roomId]||"linear-gradient(180deg,#7A4A24,#2A160B)";
    if(!room.unlocked)return <Card style={{background:"linear-gradient(180deg,#24110A,#120806)",color:T.white,border:"2px solid rgba(255,244,214,.25)"}}><div style={{textAlign:"center",padding:30}}><div style={{fontSize:"3rem"}}>🔒</div><div style={{fontWeight:950,fontSize:"1.25rem"}}>{def.name} bloqueada</div><div style={{fontSize:".85rem",fontWeight:850,opacity:.82,marginTop:6}}>Requisito: {def.req}</div><div style={{fontSize:".76rem",fontWeight:850,opacity:.72,marginTop:6}}>Imagen preparada: {roomImg}</div><div style={{marginTop:14}}><Btn col="gold" onClick={()=>startRoomTask(roomId,"unlock")}>Abrir por {tycoonUnlockCost(roomId)} RC</Btn></div></div></Card>;
    const hasDecor=roomId==="hall";
    return <div style={{position:"relative",height:standalone?460:380,borderRadius:28,overflow:"hidden",background:bg,border:"2px solid rgba(255,244,214,.34)",boxShadow:"inset 0 -40px 90px rgba(0,0,0,.42),0 18px 44px rgba(0,0,0,.24)"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(180deg,rgba(10,5,3,.08),rgba(10,5,3,.48)),url("${roomImg}")`,backgroundSize:"cover",backgroundPosition:"center",filter:"saturate(1.08) contrast(1.02)"}}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 18% 8%,rgba(255,244,214,.20),transparent 30%),radial-gradient(circle at 78% 20%,rgba(185,154,69,.16),transparent 32%),linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.55))"}}/>
      <div style={{position:"absolute",left:14,top:14,background:"rgba(18,8,6,.70)",border:"1px solid rgba(255,244,214,.28)",borderRadius:18,padding:"9px 12px",color:T.white,backdropFilter:"blur(8px)",boxShadow:"0 10px 24px rgba(0,0,0,.28)"}}>
        <div style={{fontWeight:950}}>{def.icon} {def.name}</div>
        <div style={{fontSize:".72rem",fontWeight:850,opacity:.84}}>Nivel {lvl} · {def.effect}</div>
      </div>
      <div style={{position:"absolute",right:14,top:14,display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Badge col="gold">+{economy.netHour} RC/h</Badge>
        <Badge col="blue">{economy.clientsHour} clientes/h</Badge>
      </div>

      {/* Fallback decorativo por si todavía no has subido imágenes reales. Queda encima como objetos de juego. */}
      {roomId==="hall"&&<>
        <div style={{position:"absolute",left:"38%",top:"28%",fontFamily:"'Pirata One',cursive",fontSize:"1.55rem",color:"#FFF4D6",textShadow:"0 4px 10px #000"}}>Rasta Cuts</div>
        {hasDecor&&[...Array(Math.min(4,state.decor?.plants||0))].map((_,i)=><div key={`p${i}`} style={{position:"absolute",left:`${8+i*20}%`,bottom:"8%",fontSize:"1.8rem",filter:"drop-shadow(0 7px 8px rgba(0,0,0,.45))"}}>🌿</div>)}
        {hasDecor&&[...Array(Math.min(5,state.decor?.lights||0))].map((_,i)=><div key={`l${i}`} style={{position:"absolute",left:`${18+i*13}%`,top:"13%",fontSize:"1.15rem",filter:"drop-shadow(0 0 8px rgba(255,224,120,.8))"}}>💡</div>)}
      </>}
      {roomId==="salon"&&[...Array(Math.min(5,Math.max(1,lvl)))].map((_,i)=><div key={i} style={{position:"absolute",left:`${12+i*15}%`,bottom:"13%",fontSize:"2.3rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>💺</div>)}
      {roomId==="storage"&&[...Array(Math.min(5,Math.max(1,lvl)))].map((_,i)=><div key={i} style={{position:"absolute",left:`${11+i*16}%`,bottom:"14%",fontSize:"2.15rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>📦</div>)}
      {roomId==="bathroom"&&<><div style={{position:"absolute",left:"19%",bottom:"18%",fontSize:"2.8rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>🚿</div><div style={{position:"absolute",right:"19%",bottom:"18%",fontSize:"2.8rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>🚽</div></>}
      {roomId==="chill"&&<><div style={{position:"absolute",left:"15%",bottom:"16%",fontSize:"2.8rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>🛋️</div><div style={{position:"absolute",right:"20%",top:"28%",fontSize:"2.2rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>🎶</div></>}
      {roomId==="terrace"&&<><div style={{position:"absolute",left:"14%",bottom:"18%",fontSize:"3rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>🌴</div><div style={{position:"absolute",right:"16%",bottom:"18%",fontSize:"3rem",filter:"drop-shadow(0 8px 8px rgba(0,0,0,.45))"}}>⛱️</div></>}

      {[...(hotspots[roomId]||[]),...common].map((h,i)=><SceneObject key={i} h={h}/>)}
      {selectedTask&&<div style={{position:"absolute",right:14,bottom:14}}><BuildingBadge task={selectedTask}/></div>}
      <div style={{position:"absolute",left:14,bottom:14,background:"rgba(18,8,6,.68)",border:"1px solid rgba(255,244,214,.24)",borderRadius:16,padding:"7px 10px",fontSize:".68rem",fontWeight:850,color:"rgba(255,244,214,.82)",backdropFilter:"blur(8px)"}}>
        Fondo: {roomImg} · si no existe, se usa escena híbrida
      </div>
    </div>;
  }
  const guideTexts=[
    "Esto no es el Arcade normal: aquí construyes el estudio con moneda propia RC. No toca los puntos reales de la web.",
    "El mapa es la vista tipo Travian: pulsa un edificio, entra en su sala y usa los objetos clicables.",
    "La peluquería aumenta lo que cobras por cliente. El hall atrae gente. El almacén evita que se pare la economía.",
    "Cada mejora entra en Obras y tarda tiempo real. Más adelante se puede hacer que Supabase guarde esto online.",
    "Ruta recomendada: Hall nivel 2, Peluquería nivel 2, Almacén nivel 2, abrir Baño y luego Zona chill."
  ];
  const roomCost=selectedRoom.unlocked?tycoonUpgradeCost(state,selectedId):tycoonUnlockCost(selectedId);
  const roomTime=tycoonFormatTime(tycoonBuildSeconds(state,selectedId,selectedRoom.unlocked?"upgrade":"unlock")*1000);
  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease",minHeight:standalone?"100vh":"auto",padding:standalone?"16px":"0",background:standalone?"radial-gradient(circle at 20% 0,rgba(185,154,69,.18),transparent 30%),linear-gradient(180deg,#0B0503,#160B07 34%,#24110A)":"transparent",color:T.white,fontFamily:"'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#2B1A0D 48%,#B99A45)",border:"2px solid rgba(255,244,214,.52)",color:T.white,overflow:"hidden",position:"relative",boxShadow:"0 18px 60px rgba(0,0,0,.34)"}}>
      <div style={{position:"absolute",right:-22,top:-32,fontSize:"7rem",opacity:.10}}>🏪</div>
      <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div className="icon3d" style={{fontSize:"2.6rem"}}>🏪</div>
        <div style={{flex:1,minWidth:230}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:standalone?"2.05rem":"1.75rem",lineHeight:1}}>Rasta Cuts Tycoon</div><div style={{fontSize:".82rem",fontWeight:850,opacity:.84}}>Gestión en tiempo real: mapa, salas, objetos, stock, equipo, reputación y obras con espera.</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}><Badge col="gold">{Math.floor(state.rc||0)} RC</Badge><Badge col="green">+{economy.netHour} RC/h</Badge><Badge col="blue">{activeQueue.length}/{maxQueue} obras</Badge>{standalone&&<Btn small col="ghost" onClick={onExit}>Salir a la web</Btn>}</div>
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:8}}>
      <Tab id="mapa" icon="🗺️" label="Mapa"/><Tab id="sala" icon="🏠" label="Sala"/><Tab id="stock" icon="📦" label="Stock"/><Tab id="equipo" icon="👥" label="Equipo"/><Tab id="obras" icon="🔨" label="Obras"/><Tab id="guia" icon="📖" label="Guía"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:9}}>
      <MiniStat icon="💰" label="Saldo" value={`${Math.floor(state.rc||0)} RC`}/><MiniStat icon="📈" label="Reputación" value={`Nv. ${Number(state.reputation||1).toFixed(1)}`}/><MiniStat icon="🙂" label="Satisfacción" value={`${Math.round(state.satisfaction||0)}%`}/><MiniStat icon="📦" label="Stock" value={`${Math.floor(economy.totalStock)}/${economy.capacity}`}/><MiniStat icon="🧾" label="Clientes/h" value={economy.clientsHour}/><MiniStat icon="💵" label="RC por cliente" value={economy.rcClient}/>
    </div>
    {tab==="mapa"&&<TycoonMap/>}
    {tab==="sala"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(285px,1fr))",gap:12}}>
      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><div><div style={{fontWeight:950,color:T.g800,fontSize:"1.08rem"}}>{selectedDef.icon} {selectedDef.name}</div><div style={{fontSize:".82rem",fontWeight:820,color:T.textSub,lineHeight:1.35}}>{selectedDef.desc}</div></div><Badge col={selectedRoom.unlocked?"green":"red"}>{selectedRoom.unlocked?`Nivel ${selectedRoom.level}`:"Bloqueada"}</Badge></div><TycoonScene roomId={selectedId}/></Card>
      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Panel de la sala</div><div style={{fontSize:".82rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginBottom:12}}>{selectedDef.effect}</div>
        {selectedTask&&<div style={{marginBottom:12,background:"rgba(18,8,6,.08)",borderRadius:14,padding:10,fontWeight:900,color:T.g800}}>⏳ {selectedTask.label} · queda {tycoonFormatTime(Number(selectedTask.endAt)-nowTick)}</div>}
        <Bar label="Satisfacción" value={state.satisfaction}/><Bar label="Limpieza" value={state.cleanliness}/><Bar label="Energía del equipo" value={state.energy}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:12}}><Btn col="gold" onClick={()=>selectedRoom.unlocked?startRoomTask(selectedId,"upgrade"):startRoomTask(selectedId,"unlock")} disabled={Boolean(selectedTask)||queueFull}>{selectedRoom.unlocked?`Mejorar ${roomCost} RC`:`Abrir ${roomCost} RC`}</Btn><Btn col="green" onClick={attendBurst}>Atender tanda</Btn><Btn col="ghost" onClick={cleanShop}>Limpiar 35 RC</Btn></div>
        <div style={{fontSize:".75rem",fontWeight:850,color:T.textSub,marginTop:10}}>Tiempo de obra: {roomTime}</div>
        {inspect&&<div style={{marginTop:12,background:"rgba(255,244,214,.55)",border:`1.5px solid ${T.g300}`,borderRadius:16,padding:12}}><div style={{fontWeight:950,color:T.g800}}>{inspect.icon} {inspect.title}</div><div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.35}}>{inspect.text}</div></div>}
      </Card>
    </div>}
    {tab==="stock"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{fontWeight:950,color:T.g800,marginBottom:8}}>📦 Almacén visual</div><div style={{fontSize:".82rem",fontWeight:820,color:T.textSub,marginBottom:12}}>Capacidad según almacén: {economy.capacity}. Si el stock cae, baja la entrada de clientes.</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>{Object.entries(state.stock||{}).map(([k,v])=><MiniStat key={k} icon={k==="wax"?"🧴":k==="shampoo"?"🫧":k==="towels"?"🧺":"🥤"} label={{wax:"Cera",shampoo:"Champú",towels:"Toallas",drinks:"Bebidas"}[k]||k} value={Math.floor(v)}/>)}</div><div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}><Btn col="gold" onClick={restock}>Reponer stock</Btn><Btn col="ghost" onClick={()=>enterRoom("storage")}>Entrar al almacén</Btn></div></Card>}
    {tab==="equipo"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{fontWeight:950,color:T.g800,marginBottom:10}}>👥 Equipo y decoración</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:8,marginBottom:12}}><MiniStat icon="💈" label="Barberos" value={state.staff?.barbers||0}/><MiniStat icon="🧹" label="Ayudantes" value={state.staff?.assistants||0}/><MiniStat icon="🧾" label="Caja" value={state.staff?.cashiers||0}/><MiniStat icon="⚙️" label="Servicio" value={economy.servicePower.toFixed(1)}/></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}><Btn col="green" onClick={()=>hire("barbers")}>Barbero 390 RC</Btn><Btn col="green" onClick={()=>hire("assistants")}>Ayudante 210 RC</Btn><Btn col="ghost" onClick={()=>hire("cashiers")}>Caja 280 RC</Btn></div><div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Hall / escaparate</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8}}><Btn small col="ghost" onClick={()=>buyDecor("plants")}>🌿 Planta 90</Btn><Btn small col="ghost" onClick={()=>buyDecor("posters")}>🖼️ Póster 120</Btn><Btn small col="ghost" onClick={()=>buyDecor("lights")}>💡 Luces 180</Btn><Btn small col="ghost" onClick={()=>buyDecor("vitrine")}>🧴 Vitrina 260</Btn></div></Card>}
    {tab==="obras"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}><div><div style={{fontWeight:950,color:T.g800}}>🔨 Cola de obras</div><div style={{fontSize:".8rem",fontWeight:820,color:T.textSub}}>Máximo actual: {maxQueue}. Sube el Hall para mejorar la gestión.</div></div><Badge col="gold">{activeQueue.length}/{maxQueue}</Badge></div>{activeQueue.length===0?<EmptyState icon="🔨" title="No hay obras en marcha" sub="Entra en una sala o usa el mapa para iniciar mejoras."/>:<div style={{display:"grid",gap:9}}>{activeQueue.map(t=>{const total=Math.max(1,Number(t.endAt)-Number(t.startedAt));const left=Math.max(0,Number(t.endAt)-nowTick);const pct=clampNum(100-(left/total*100),0,100);return <div key={t.id} style={{background:"rgba(255,244,214,.65)",border:`1.5px solid ${T.g300}`,borderRadius:16,padding:12}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{color:T.g800}}>{t.label}</b><Badge col="gold">{tycoonFormatTime(left)}</Badge></div><div style={{height:10,borderRadius:999,background:"rgba(75,48,27,.15)",overflow:"hidden",marginTop:9}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#263F4D,#B99A45)",borderRadius:999}}/></div></div>;})}</div>}</Card>}
    {tab==="guia"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}><div style={{fontSize:"2.2rem"}}>🧔🏽‍♂️</div><div><div style={{fontWeight:950,color:T.g800}}>Guía de Rasta</div><div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>{guideTexts[state.guideStep%guideTexts.length]}</div><div style={{marginTop:10}}><Btn small col="gold" onClick={()=>mutate(prev=>({...prev,guideStep:(prev.guideStep||0)+1}))}>Siguiente consejo</Btn></div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}>{[{icon:"💰",t:"Economía RC",d:"Los RC sólo pertenecen al Tycoon. Sirven para stock, mejoras, equipo y decoración."},{icon:"🗺️",t:"Mapa",d:"Es la vista principal tipo Travian. Pulsa edificios para entrar o ver requisitos."},{icon:"🏠",t:"Salas",d:"Cada sala tiene objetos clicables. La escena cambia según el tipo de zona."},{icon:"📦",t:"Stock",d:"Sin productos no se atienden clientes y los RC/h bajan."},{icon:"🔨",t:"Obras",d:"Las mejoras tardan tiempo real y se completan solas."},{icon:"📈",t:"Progreso",d:"Hall atrae clientes, Peluquería sube ingresos, Almacén sostiene la economía."}].map(x=><div key={x.t} style={{background:"rgba(255,255,255,.38)",border:`1px solid ${T.g200}`,borderRadius:16,padding:12}}><div style={{fontWeight:950,color:T.g800}}>{x.icon} {x.t}</div><div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:4}}>{x.d}</div></div>)}</div><div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}><Btn small col="red" onClick={resetGame}>Reiniciar Tycoon</Btn></div></Card>}
    <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)"}}><div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Registro</div><div style={{display:"grid",gap:6,maxHeight:190,overflow:"auto"}}>{(state.log||[]).slice(0,12).map((l,i)=><div key={i} style={{fontSize:".75rem",fontWeight:820,color:T.textSub,lineHeight:1.35,borderBottom:`1px solid ${T.g200}`,paddingBottom:5}}>{new Date(l.t).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})} · {l.msg}</div>)}</div></Card>
  </div>;
}


function Juegos({user,setUser,showToast,showPoints,setHelperPage,onOpenTops,onOpenTycoon,settings}){
  const [activeGame,setActiveGame]=useState(null);
  const [boardGame,setBoardGame]=useState("runner");
  const [topMode,setTopMode]=useState("weekly");
  const [leaderboard,setLeaderboard]=useState([]);
  const [lbLoading,setLbLoading]=useState(false);
  const [boardTick,setBoardTick]=useState(0);
  const arcadeActiva=settings?.secciones?.arcade_activo!==false;
  const gachaActiva=settings?.secciones?.gacha_activo!==false;
  const gameDailyCap=Math.max(0,parseInt(settings?.puntos?.limite_diario_juegos??GAME_DAILY_CAP,10)||GAME_DAILY_CAP);
  const GAMES=ARCADE_GAMES.filter(g=>g.id!=="gacha"||gachaActiva);
  if(!arcadeActiva)return <DisabledSection icon="🎮" title="Arcade desactivado" sub="Los juegos están apagados temporalmente desde Gestión > Ajustes."/>;
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
    const maxReward=GAME_DAILY_REWARDS[gameId]||10;
    const remaining=Math.max(0,gameDailyCap-getDailyGamePointsTotal(user.id));
    const reward=Math.min(maxReward,rawScore,remaining);
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
      showToast(`Récord guardado. Límite diario de ${gameDailyCap} pts alcanzado.`);
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
        {activeGame==="gacha"&&<GachaSlotsGame user={user} settings={settings} onWin={pts=>handleWin("gacha",pts)}/>} 
        {activeGame==="tycoon"&&<RastaCutsTycoonGame user={user} showToast={showToast}/>} 
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
                    {g.id==="tycoon"?<span style={{fontSize:"0.74rem",color:T.orange,fontWeight:950}}>🏪 moneda propia RC · sin puntos reales</span>:<span style={{fontSize:"0.74rem",color:T.orange,fontWeight:950}}>🏅 máx. +{g.pts} pts/día</span>}
                    {g.id==="tycoon"?<span style={{fontSize:"0.74rem",color:T.g700,fontWeight:950}}>⏱️ progreso en tiempo real</span>:<span style={{fontSize:"0.74rem",color:T.g700,fontWeight:950}}>📈 tu récord semana: {best}</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  {played&&<Badge col="green">✅ cobrado hoy</Badge>}
                  <Btn small col="gold" onClick={()=>g.id==="tycoon"?onOpenTycoon?.():setActiveGame(g.id)}>{g.id==="tycoon"?"🏪 Abrir juego":(played?"🔁 Rejugar":"▶ Jugar")}</Btn>
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
    {id:"community",icon:"🌐",title:"Comunidad",sub:"Temas, respuestas, votos y participación real",unit:"pts"},
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
        const [newsEvents,newsComments,newsLikes,foroTemas,foroRespuestas,foroVotos,oldTopics,oldReplies]=await Promise.all([
          safeList("news_point_events","?select=usuario_id,puntos&limit=5000"),
          safeList("news_comments","?select=usuario_id&limit=5000"),
          safeList("news_likes","?select=usuario_id&limit=5000"),
          safeList("foro_temas","?select=usuario_id,likes,respuestas_count,fijado&limit=5000"),
          safeList("foro_respuestas","?select=usuario_id,likes&limit=5000"),
          safeList("foro_votos","?select=usuario_id,target_tipo&limit=5000"),
          safeList("publicaciones","?select=autor_id,likes_count,tipo&limit=3000"),
          safeList("foro_respuestas","?select=autor_id&limit=3000"),
        ]);

        // Actualidad: ya viene controlado por eventos únicos cuando existe.
        (newsEvents||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+Number(r.puntos||0);
        });
        // Respaldo/extra para actividad de noticias si existen tablas de comentarios/likes.
        (newsComments||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+3;
        });
        (newsLikes||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+1;
        });

        // Foro real: crear temas pesa más que responder; likes recibidos también suman.
        (foroTemas||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+8+Number(r.likes||0)+Math.min(10,Number(r.respuestas_count||0));
        });
        (foroRespuestas||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+3+Number(r.likes||0);
        });
        // Votar también cuenta, pero poco, para premiar participación sin inflar demasiado.
        (foroVotos||[]).forEach(r=>{
          const id=String(r.usuario_id||"");
          if(id) values[id]=(values[id]||0)+1;
        });

        // Compatibilidad con datos antiguos del foro si aún quedaban en publicaciones.
        (oldTopics||[]).filter(r=>String(r.tipo||"")==="foro").forEach(r=>{
          const id=String(r.autor_id||"");
          if(id) values[id]=(values[id]||0)+5+Number(r.likes_count||0);
        });
        (oldReplies||[]).forEach(r=>{
          const id=String(r.autor_id||"");
          if(id) values[id]=(values[id]||0)+2;
        });
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
  const nivel=user.puntos>=1000?"VIP":user.puntos>=500?"Oro":user.puntos>=200?"Plata":"Bronce";
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

function normalizeMusicItem(item){
  if(!item)return null;
  if(item.artist||item.genre||item.desc){
    return {
      id:item.id,
      titulo:item.artist||item.title||"Música",
      artista:item.artist||item.artista||"",
      genero:item.genre||item.genero||"reggae",
      descripcion:item.desc||item.descripcion||"",
      icono:item.emoji||item.icono||"🎧",
      youtube_url:item.links?.find(l=>String(l.label).toLowerCase().includes("youtube"))?.url||item.youtube_url||"",
      spotify_url:item.spotify_url||"",
      web_url:item.links?.find(l=>!String(l.label).toLowerCase().includes("youtube"))?.url||item.web_url||"",
      audio_url:item.audio_url||"",
      tipo:item.tipo||"externo",
      destacado:Boolean(item.destacado),
      activo:item.activo!==false,
      mood:item.mood||"selección recomendada"
    };
  }
  return {
    id:item.id,
    titulo:item.titulo||item.nombre||"Música",
    artista:item.artista||"",
    genero:item.genero||"reggae",
    descripcion:item.descripcion||"",
    icono:item.icono||"🎧",
    youtube_url:item.youtube_url||"",
    spotify_url:item.spotify_url||"",
    web_url:item.web_url||"",
    audio_url:item.audio_url||"",
    tipo:item.tipo||"externo",
    destacado:Boolean(item.destacado),
    activo:item.activo!==false,
    mood:item.destacado?"destacado":"selección recomendada"
  };
}

function MusicaComunidad({showToast}){
  const [filter,setFilter]=useState("todo");
  const [musicSeed,setMusicSeed]=useState(0);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [playing,setPlaying]=useState(null);

  const filters=[
    {id:"todo",label:"Todo",icon:"✨"},
    {id:"reggae",label:"Reggae",icon:"🟢"},
    {id:"rap",label:"Rap",icon:"🎤"},
    {id:"ska",label:"Ska",icon:"🎺"},
    {id:"rock",label:"Rock",icon:"🎸"},
    {id:"propia",label:"Propia",icon:"💿"}
  ];

  useEffect(()=>{loadMusic();},[]);

  async function loadMusic(){
    setLoading(true);
    let data=await dbGet("musica_items","?activo=eq.true&order=destacado.desc,orden.asc,created_at.desc&select=*");
    if(!Array.isArray(data)||!data.length){
      data=MUSIC_LIBRARY.map(normalizeMusicItem).filter(Boolean);
    }else{
      data=data.map(normalizeMusicItem).filter(Boolean);
    }
    setItems(data);
    setLoading(false);
  }

  function matches(item){
    const genero=normalizeText(item?.genero||"");
    const artista=normalizeText(item?.artista||"");
    const titulo=normalizeText(item?.titulo||"");
    const descripcion=normalizeText(item?.descripcion||"");
    const tipo=normalizeText(item?.tipo||"");
    const full=`${genero} ${artista} ${titulo} ${descripcion} ${tipo}`;
    const hasWord=(txt,words)=>words.some(w=>new RegExp(`(^|\\s|/|-)${w}($|\\s|/|-)`).test(txt));
    const isSka=hasWord(`${genero} ${artista} ${titulo}`,["ska","ska-p","skap"])||full.includes("ska punk");
    const isRap=hasWord(`${genero} ${artista} ${titulo}`,["rap","hiphop","hip-hop"])||full.includes("hip hop")||full.includes("hip-hop");
    if(filter==="todo")return true;
    if(filter==="propia")return full.includes("propio")||full.includes("archivo")||String(item.tipo)==="archivo"||Boolean(item.audio_url);
    if(filter==="reggae")return full.includes("reggae")||full.includes("dancehall");
    if(filter==="rap")return isRap&&!isSka;
    if(filter==="ska")return isSka;
    if(filter==="rock")return full.includes("rock")||full.includes("grunge");
    return true;
  }

  const list=dailyOrderedList(items,`music_db_${filter}`,musicSeed)
    .filter(matches)
    .slice(0,filter==="todo"?10:40);

  function reloadMusic(){
    SFX.action();
    setMusicSeed(v=>v+1);
    showToast?.("Cambiando la selección musical...");
  }

  function openUrl(label,url){
    if(!url){showToast?.("Este enlace todavía no está configurado");return;}
    SFX.action();
    showToast?.(`Abriendo ${label}`);
    window.open(url,"_blank","noopener,noreferrer");
  }

  function toggleAudio(item){
    if(!item.audio_url){showToast?.("Este elemento no tiene audio subido");return;}
    SFX.action();
    setPlaying(p=>p===item.id?null:item.id);
  }

  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{marginBottom:14,padding:0,overflow:"hidden",background:"linear-gradient(160deg,#120806,#24110A 48%,#4E3A76)",border:"2px solid rgba(255,244,214,.5)",color:T.white}}>
      <div style={{padding:"18px 16px",position:"relative"}}>
        <div style={{position:"absolute",right:-18,top:-28,fontSize:"7rem",opacity:.10,transform:"rotate(-12deg)"}}>🎧</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:".72rem",fontWeight:950,letterSpacing:".08em",textTransform:"uppercase",color:"rgba(255,244,214,.72)"}}>Biblioteca Rasta Cuts</div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.75rem",lineHeight:1,color:"#FFD66B",textShadow:"0 4px 12px rgba(0,0,0,.35)"}}>Biblioteca musical</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35,marginTop:4}}>Selección editable desde admin: enlaces oficiales y archivos propios/libres subidos con permiso.</div>
          <button onClick={reloadMusic} style={{marginTop:11,border:"1px solid rgba(255,244,214,.35)",background:"rgba(255,244,214,.12)",color:T.white,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>🔄 Cambiar selección</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,padding:"0 12px 14px"}}>
        {filters.map(f=><button key={f.id} onClick={()=>{SFX.tab();setFilter(f.id);setMusicSeed(0);}} style={{border:`1.5px solid ${filter===f.id?T.gold:"rgba(255,244,214,.25)"}`,borderRadius:14,padding:"8px 4px",background:filter===f.id?"rgba(255,214,107,.22)":"rgba(255,244,214,.08)",color:T.white,fontWeight:950,cursor:"pointer",fontSize:".68rem"}}>
          <div style={{fontSize:"1.1rem",lineHeight:1}}>{f.icon}</div>
          <div style={{marginTop:3}}>{f.label}</div>
        </button>)}
      </div>
    </Card>

    {loading?<Spinner/>:list.length===0?<EmptyState icon="🎧" title="Sin música en esta categoría" sub="Añade artistas, enlaces o archivos desde Gestión > Música."/>:
      <div style={{display:"grid",gap:12}}>
        {list.map(item=><Card key={item.id} style={{padding:0,overflow:"hidden",background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${item.destacado?T.gold:T.g300}`}} hover>
          <div style={{display:"grid",gridTemplateColumns:"88px 1fr",gap:0}}>
            <div style={{minHeight:150,background:"radial-gradient(circle at 40% 25%,rgba(255,255,255,.28),transparent 32%),linear-gradient(160deg,#24110A,#4E3A76 60%,#D4AF37)",display:"grid",placeItems:"center",position:"relative"}}>
              <div className="icon3d" style={{fontSize:"2.9rem"}}>{item.icono||"🎧"}</div>
              <div style={{position:"absolute",bottom:8,left:8,right:8,textAlign:"center",fontSize:".62rem",fontWeight:950,color:"rgba(255,244,214,.8)"}}>{item.genero}</div>
            </div>
            <div style={{padding:"13px 13px 12px",minWidth:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div>
                  <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.32rem",lineHeight:1,color:T.g800}}>{item.titulo}</div>
                  <div style={{fontSize:".72rem",fontWeight:950,color:"#4E3A76",textTransform:"uppercase",letterSpacing:".05em",marginTop:2}}>{item.artista||item.mood||"selección"}</div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {item.destacado&&<Badge col="gold">Destacado</Badge>}
                  <Badge col={item.tipo==="archivo"?"green":"blue"}>{item.tipo==="archivo"?"Audio":"Enlace"}</Badge>
                </div>
              </div>
              <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:8}}>{item.descripcion||"Música recomendada por Rasta Cuts."}</div>

              {playing===item.id&&item.audio_url&&<div style={{marginTop:10}}>
                <audio controls autoPlay src={item.audio_url} style={{width:"100%"}} onEnded={()=>setPlaying(null)}/>
              </div>}

              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:11}}>
                {item.audio_url&&<button onClick={()=>toggleAudio(item)} style={{border:"none",borderRadius:999,padding:"8px 11px",background:"linear-gradient(180deg,#2F6B42,#1F4A30)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 14px rgba(20,8,4,.18)"}}>
                  {playing===item.id?"⏸️ Ocultar":"▶️ Reproducir"}
                </button>}
                {item.youtube_url&&<button onClick={()=>openUrl("YouTube",item.youtube_url)} style={{border:"none",borderRadius:999,padding:"8px 11px",background:"linear-gradient(180deg,#A72822,#6E1B14)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 14px rgba(20,8,4,.18)"}}>▶️ YouTube</button>}
                {item.spotify_url&&<button onClick={()=>openUrl("Spotify",item.spotify_url)} style={{border:"none",borderRadius:999,padding:"8px 11px",background:"linear-gradient(180deg,#2F6B42,#1D422A)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 14px rgba(20,8,4,.18)"}}>🎵 Spotify</button>}
                {item.web_url&&<button onClick={()=>openUrl("Web",item.web_url)} style={{border:"none",borderRadius:999,padding:"8px 11px",background:"linear-gradient(180deg,#24110A,#6E3518)",color:T.white,fontWeight:950,cursor:"pointer",boxShadow:"0 8px 14px rgba(20,8,4,.18)"}}>🔎 Web</button>}
              </div>
            </div>
          </div>
        </Card>)}
      </div>
    }

    <Card style={{marginTop:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
      <div style={{fontWeight:950,color:T.g800}}>📌 Nota legal sencilla</div>
      <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Usa enlaces para música comercial. Sube archivos sólo si son tuyos, libres o tienes permiso para publicarlos.</div>
    </Card>
  </div>;
}


function Comunidad(props){
  const {initialTab="feed",showToast,settings}=props;
  const sec=settings?.secciones||{};
  const [sub,setSub]=useState(initialTab||"feed");
  useEffect(()=>{setSub(initialTab||"feed");},[initialTab]);
  const tabs=[
    {id:"feed",icon:"📌",label:"Tablón",sub:"Anuncios oficiales, promociones y novedades de la tienda.",enabled:true},
    {id:"foro",icon:"🗣️",label:"Foro",sub:"Temas abiertos, dudas, votaciones y conversación entre usuarios.",enabled:sec.foro_activo!==false},
    {id:"noticias",icon:"📰",label:"Actualidad",sub:"Curiosidades, rural, comida, sitios, peluquería y negocios locales.",enabled:sec.noticias_activas!==false},
    {id:"musica",icon:"🎧",label:"Música",sub:"Reggae, rap clásico, ska y rock con enlaces rápidos para descubrir buena música.",enabled:sec.musica_activa!==false},
  ].filter(t=>t.enabled);
  const active=tabs.find(t=>t.id===sub)||tabs[0]||{id:"feed",icon:"📌",label:"Tablón"};
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
    {active.id==="feed"&&<SocialFeed {...props}/>} 
    {active.id==="foro"&&<Foro {...props}/>} 
    {active.id==="noticias"&&<Noticias {...props}/>} 
    {active.id==="musica"&&<MusicaComunidad {...props}/>} 
  </div>;
}



function GestionTienda({user,showToast}){
  if(!isAdminUser(user)) return <EmptyState icon="🔒" title="Sólo admin" sub="La tienda editable sólo puede gestionarla el administrador."/>;
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



const DEFAULT_APP_SETTINGS={
  branding:{nombre_tienda:"Rasta Cuts",slogan:"Reserva, juega, participa y desbloquea recompensas.",mensaje_login:"Forma parte de la comunidad Rasta Cuts.",emoji_principal:"✂️"},
  puntos:{puntos_por_cita_cobrada:10,puntos_por_comentario:3,puntos_por_like:1,limite_diario_juegos:75,gacha_tiradas_dia:50},
  secciones:{tienda_activa:true,arcade_activo:true,musica_activa:true,noticias_activas:true,foro_activo:true,gacha_activo:true},
  musica:{musica_activa_por_defecto:false,volumen_general:0.7,modo:"jazz_lofi_reggae",descripcion:"Música suave tipo jazz lofi reggae."},
  rasta_helper:{modo_ayuda_activo:true,tips_diarios:true,mostrar_bocadillos_automaticos:false,tono:"util_profesional_divertido"}
};
async function loadAppSettingsFromDb(){
  const next=JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS));
  try{
    const rows=await dbGet("app_settings","?select=setting_key,setting_value");
    (Array.isArray(rows)?rows:[]).forEach(r=>{
      if(next[r.setting_key]) next[r.setting_key]={...next[r.setting_key],...(r.setting_value||{})};
    });
  }catch(e){}
  return next;
}
function DisabledSection({icon="🔒",title="Sección desactivada",sub="Esta sección está desactivada desde Gestión > Ajustes."}){
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{textAlign:"center",padding:"12px 6px"}}>
        <div className="icon3d" style={{fontSize:"3rem",marginBottom:8}}>{icon}</div>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.45rem",color:T.g800}}>{title}</div>
        <div style={{fontSize:".86rem",fontWeight:800,color:T.textSub,lineHeight:1.4,marginTop:6}}>{sub}</div>
      </div>
    </Card>
  </div>;
}

function GestionAjustes({user,showToast}){
  if(!isAdminUser(user)) return <EmptyState icon="🔒" title="Sólo admin" sub="Los ajustes globales sólo debería tocarlos el administrador."/>;
  const DEFAULTS={
    branding:{nombre_tienda:"Rasta Cuts",slogan:"Reserva, juega, participa y desbloquea recompensas.",mensaje_login:"Forma parte de la comunidad Rasta Cuts.",emoji_principal:"✂️"},
    puntos:{puntos_por_cita_cobrada:10,puntos_por_comentario:3,puntos_por_like:1,limite_diario_juegos:75,gacha_tiradas_dia:50},
    secciones:{tienda_activa:true,arcade_activo:true,musica_activa:true,noticias_activas:true,foro_activo:true,gacha_activo:true},
    musica:{musica_activa_por_defecto:false,volumen_general:0.7,modo:"jazz_lofi_reggae",descripcion:"Música suave tipo jazz lofi reggae."},
    rasta_helper:{modo_ayuda_activo:true,tips_diarios:true,mostrar_bocadillos_automaticos:false,tono:"util_profesional_divertido"}
  };
  const META={
    branding:{icon:"🏷️",title:"Marca",sub:"Nombre, slogan y textos principales.",categoria:"general"},
    puntos:{icon:"⭐",title:"Puntos",sub:"Fidelidad y límites de puntos. No equivalen a euros.",categoria:"puntos"},
    secciones:{icon:"🧩",title:"Secciones",sub:"Activar o preparar secciones principales.",categoria:"secciones"},
    musica:{icon:"🎧",title:"Música",sub:"Ajustes generales de sonido.",categoria:"musica"},
    rasta_helper:{icon:"🧭",title:"Rasta ayuda",sub:"Asistente, tips diarios y ayuda interactiva.",categoria:"rasta"}
  };
  const [settings,setSettings]=useState(DEFAULTS);
  const [active,setActive]=useState("branding");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const rows=await dbGet("app_settings","?order=categoria.asc,setting_key.asc&select=*");
    const next={...DEFAULTS};
    (Array.isArray(rows)?rows:[]).forEach(r=>{
      if(next[r.setting_key]) next[r.setting_key]={...next[r.setting_key],...(r.setting_value||{})};
    });
    setSettings(next);
    setLoading(false);
  }

  function setVal(key,field,value){
    setSettings(prev=>({...prev,[key]:{...(prev[key]||{}),[field]:value}}));
  }
  function bool(v){return v===true||v==="true";}

  async function save(key=active){
    setSaving(true);
    const meta=META[key];
    const payload={
      setting_key:key,
      setting_value:settings[key],
      descripcion:meta?.sub||"Ajuste de aplicación",
      categoria:meta?.categoria||"general",
      editable:true,
      updated_at:new Date().toISOString()
    };
    let ok=await dbPatch("app_settings",`?setting_key=eq.${key}`,payload);
    if(!ok) ok=await dbPost("app_settings",payload);
    setSaving(false);
    if(ok){showToast?.("Ajustes guardados");SFX.success();await load();}
    else{showToast?.("No se pudieron guardar los ajustes");SFX.error();}
  }

  function NumberField({k,f,label,min=0}){
    return <Input label={label} value={String(settings[k]?.[f]??"")} onChange={v=>setVal(k,f,Math.max(min,parseFloat(v||"0")||0))} type="number"/>;
  }
  function TextField({k,f,label,placeholder=""}){
    return <Input label={label} value={String(settings[k]?.[f]??"")} onChange={v=>setVal(k,f,v)} placeholder={placeholder}/>;
  }
  function BoolField({k,f,label}){
    return <Select label={label} value={String(bool(settings[k]?.[f]))} onChange={v=>setVal(k,f,v==="true")} options={[{value:"true",label:"Activado"},{value:"false",label:"Desactivado"}]}/>;
  }

  const cfg=settings[active]||{};
  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="⚙️" title="Ajustes internos" sub="Configuración editable de la app" action={<Btn small col="gold" onClick={()=>save(active)} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🛠️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Panel de configuración</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Estos valores se guardan en Supabase en app_settings. Algunas opciones ya se usan; otras quedan preparadas para los siguientes pasos.</div>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
        {Object.entries(META).map(([key,m])=><button key={key} onClick={()=>{SFX.tab();setActive(key);}} style={{border:`2px solid ${active===key?T.gold:T.g300}`,background:active===key?T.gradGold:"rgba(255,244,214,.84)",color:active===key?T.g900:T.g700,borderRadius:16,padding:"10px 8px",fontWeight:950,cursor:"pointer",boxShadow:active===key?"0 10px 24px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.1)"}}>
          <div style={{fontSize:"1.35rem",lineHeight:1}}>{m.icon}</div>
          <div style={{fontSize:".74rem",marginTop:4}}>{m.title}</div>
        </button>)}
      </div>

      {loading?<Spinner/>:<Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>{META[active].icon}</div>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{META[active].title}</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{META[active].sub}</div>
          </div>
        </div>

        {active==="branding"&&<>
          <TextField k="branding" f="nombre_tienda" label="Nombre de tienda"/>
          <TextField k="branding" f="slogan" label="Slogan"/>
          <TextField k="branding" f="mensaje_login" label="Mensaje de login"/>
          <TextField k="branding" f="emoji_principal" label="Emoji principal"/>
        </>}

        {active==="puntos"&&<>
          <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`1.5px solid ${T.gold}`,padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>Regla importante</div>
            <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>Los puntos son fidelidad y recompensas. No equivalen a euros ni se usan como dinero.</div>
          </Card>
          <NumberField k="puntos" f="puntos_por_cita_cobrada" label="Puntos por cita cobrada"/>
          <NumberField k="puntos" f="puntos_por_comentario" label="Puntos por comentario"/>
          <NumberField k="puntos" f="puntos_por_like" label="Puntos por like"/>
          <NumberField k="puntos" f="limite_diario_juegos" label="Límite diario de puntos en juegos"/>
          <NumberField k="puntos" f="gacha_tiradas_dia" label="Tiradas de Gacha al día"/>
        </>}

        {active==="secciones"&&<>
          <BoolField k="secciones" f="tienda_activa" label="Tienda activa"/>
          <BoolField k="secciones" f="arcade_activo" label="Arcade activo"/>
          <BoolField k="secciones" f="musica_activa" label="Música activa"/>
          <BoolField k="secciones" f="noticias_activas" label="Noticias activas"/>
          <BoolField k="secciones" f="foro_activo" label="Foro activo"/>
          <BoolField k="secciones" f="gacha_activo" label="Gacha activo"/>
        </>}

        {active==="musica"&&<>
          <BoolField k="musica" f="musica_activa_por_defecto" label="Música activa por defecto"/>
          <NumberField k="musica" f="volumen_general" label="Volumen general 0 a 1"/>
          <TextField k="musica" f="modo" label="Modo musical"/>
          <TextField k="musica" f="descripcion" label="Descripción"/>
        </>}

        {active==="rasta_helper"&&<>
          <BoolField k="rasta_helper" f="modo_ayuda_activo" label="Modo ayuda disponible"/>
          <BoolField k="rasta_helper" f="tips_diarios" label="Tips diarios"/>
          <BoolField k="rasta_helper" f="mostrar_bocadillos_automaticos" label="Bocadillos automáticos"/>
          <TextField k="rasta_helper" f="tono" label="Tono del asistente"/>
        </>}

        <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)"}}>
          <Btn full col="gold" onClick={()=>save(active)} disabled={saving}>{saving?"Guardando...":"Guardar ajustes"}</Btn>
        </div>
      </Card>}

      <Card style={{marginTop:12,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
        <div style={{fontWeight:950,color:T.g800}}>📌 Próximo paso</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Después conectaremos más partes de la app a estos ajustes para que los cambios se apliquen automáticamente en juegos, música, comunidad y login.</div>
      </Card>
    </div>
  );
}


function MessageBubble({msg,isMine=false}){
  const when=msg.created_at?new Date(msg.created_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
  return <div style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start",marginBottom:10}}>
    <div style={{
      maxWidth:"82%",
      background:isMine?"linear-gradient(135deg,#4F602D,#2F6B42)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",
      color:isMine?T.white:T.g800,
      border:isMine?"1px solid rgba(255,244,214,.25)":`1.5px solid ${T.g300}`,
      borderRadius:isMine?"18px 18px 4px 18px":"18px 18px 18px 4px",
      padding:"10px 12px",
      boxShadow:"0 8px 18px rgba(20,8,4,.14)"
    }}>
      <div style={{fontSize:".72rem",fontWeight:950,opacity:isMine?.78:.66,marginBottom:4}}>
        {msg.autor_nombre||"Usuario"} · {when}
      </div>
      <div style={{fontSize:".88rem",fontWeight:800,lineHeight:1.38,whiteSpace:"pre-wrap"}}>{msg.mensaje}</div>
    </div>
  </div>;
}

function BuzonPrivado({user,showToast,refreshUnread,unread}){
  const [mensajes,setMensajes]=useState([]);
  const [texto,setTexto]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{load();},[user?.id]);

  async function load(){
    if(!user?.id)return;
    setLoading(true);
    const rows=await dbGet("mensajes_privados",`?usuario_id=eq.${user.id}&order=created_at.asc&select=*`);
    setMensajes(Array.isArray(rows)?rows:[]);
    try{await dbPatch("mensajes_privados",`?usuario_id=eq.${user.id}&autor_rol=neq.client&leido_cliente=eq.false`,{leido_cliente:true});}catch{}
    refreshUnread?.();
    setLoading(false);
  }

  async function enviar(){
    const msg=texto.trim();
    if(!msg){showToast?.("Escribe un mensaje");return;}
    const ok=await dbPost("mensajes_privados",{
      usuario_id:String(user.id),
      cliente_nombre:user.nombre||user.email||"Cliente",
      autor_id:String(user.id),
      autor_nombre:user.nombre||user.email||"Cliente",
      autor_rol:"client",
      mensaje:msg,
      leido_cliente:true,
      leido_admin:false,
      estado:"abierto"
    });
    if(ok){
      setTexto("");
      SFX.success();
      showToast?.("Mensaje enviado");
      await createNotification({rol_destino:"admin",tipo:"mensaje",titulo:"Nuevo mensaje privado",mensaje:`${user.nombre||user.email||"Cliente"} escribió en el buzón.`,entidad_tipo:"mensaje",entidad_id:Array.isArray(ok)?ok?.[0]?.id:null,importante:false});
      await load();
      refreshUnread?.();
    }else{
      SFX.error();
      showToast?.("No se pudo enviar el mensaje");
    }
  }

  const lastEstado=mensajes[mensajes.length-1]?.estado||"abierto";
  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="📩" title="Buzón privado" sub={(unread?.client||0)>0?`${unread.client} mensajes nuevos`:`Mensajes directos con Rasta Cuts · ${lastEstado==="cerrado"?"cerrado":"abierto"}`}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>💬</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Habla con la tienda</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Usa este buzón para dudas de citas, canjes, premios o cualquier cosa que quieras comentar de forma privada.</div>
        </div>
      </div>
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,marginBottom:14,minHeight:280}}>
      {loading?<Spinner/>:mensajes.length===0?<EmptyState icon="📩" title="Aún no hay mensajes" sub="Escribe el primero y aparecerá aquí el historial."/>:
        <div>{mensajes.map(m=><MessageBubble key={m.id} msg={m} isMine={String(m.autor_rol||"client")==="client"}/>)}</div>
      }
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Nuevo mensaje</div>
      <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Escribe tu mensaje privado..." style={{width:"100%",borderRadius:14,border:`1.5px solid ${T.g200}`,background:T.g50,padding:"11px 12px",fontSize:".9rem",fontWeight:800,color:T.text,resize:"vertical",outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}/>
      <div style={{marginTop:10}}>
        <Btn full col="gold" onClick={enviar}>Enviar mensaje</Btn>
      </div>
    </Card>
  </div>;
}

function GestionMensajes({user,showToast,refreshUnread,unread}){
  const [rows,setRows]=useState([]);
  const [selected,setSelected]=useState(null);
  const [thread,setThread]=useState([]);
  const [texto,setTexto]=useState("");
  const [loading,setLoading]=useState(true);
  const [threadLoading,setThreadLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("abierto");

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("mensajes_privados","?order=created_at.desc&select=*");
    setRows(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  const conversaciones=useMemo(()=>{
    const map=new Map();
    for(const m of rows){
      const id=String(m.usuario_id||"");
      if(!id)continue;
      if(!map.has(id)){
        map.set(id,{usuario_id:id,cliente_nombre:m.cliente_nombre||"Cliente",ultimo:m,unread:0,total:0,estado:m.estado||"abierto"});
      }
      const c=map.get(id);
      c.total+=1;
      if(new Date(m.created_at)>new Date(c.ultimo.created_at)){ c.ultimo=m; c.estado=m.estado||"abierto"; }
      if(String(m.autor_rol||"client")==="client" && !m.leido_admin)c.unread+=1;
    }
    const q=normalizeText(search);
    return [...map.values()]
      .filter(c=>statusFilter==="todo"||String(c.estado||"abierto")===statusFilter)
      .filter(c=>!q||normalizeText(`${c.cliente_nombre} ${c.ultimo?.mensaje||""} ${c.usuario_id}`).includes(q))
      .sort((a,b)=>new Date(b.ultimo.created_at)-new Date(a.ultimo.created_at));
  },[rows,search,statusFilter]);

  async function openThread(conv){
    setSelected(conv);
    setThreadLoading(true);
    const msgs=await dbGet("mensajes_privados",`?usuario_id=eq.${conv.usuario_id}&order=created_at.asc&select=*`);
    setThread(Array.isArray(msgs)?msgs:[]);
    try{await dbPatch("mensajes_privados",`?usuario_id=eq.${conv.usuario_id}&autor_rol=eq.client&leido_admin=eq.false`,{leido_admin:true});}catch{}
    refreshUnread?.();
    setThreadLoading(false);
    await load();
  }

  async function cambiarEstadoConversacion(nuevoEstado){
    if(!selected)return;
    const ok=await dbPatch("mensajes_privados",`?usuario_id=eq.${selected.usuario_id}`,{estado:nuevoEstado});
    if(ok){
      SFX.success();
      showToast?.(nuevoEstado==="cerrado"?"Conversación cerrada":"Conversación reabierta");
      setSelected(s=>s?{...s,estado:nuevoEstado}:s);
      await openThread({...selected,estado:nuevoEstado});
      await load();
    }else{
      SFX.error();
      showToast?.("No se pudo cambiar el estado");
    }
  }

  async function responder(){
    if(!selected)return;
    const msg=texto.trim();
    if(!msg){showToast?.("Escribe una respuesta");return;}
    const ok=await dbPost("mensajes_privados",{
      usuario_id:String(selected.usuario_id),
      cliente_nombre:selected.cliente_nombre||"Cliente",
      autor_id:String(user.id),
      autor_nombre:user.nombre||"Rasta Cuts",
      autor_rol:normalizeRole(user.rol||user.role),
      mensaje:msg,
      leido_cliente:false,
      leido_admin:true,
      estado:"abierto"
    });
    if(ok){
      setTexto("");
      SFX.success();
      showToast?.("Respuesta enviada");
      await createNotification({usuario_id:selected.usuario_id,rol_destino:"client",tipo:"mensaje",titulo:"Nueva respuesta de Rasta Cuts",mensaje:"Tienes una respuesta nueva en tu buzón privado.",entidad_tipo:"mensaje",entidad_id:Array.isArray(ok)?ok?.[0]?.id:null,importante:false});
      setSelected(s=>s?{...s,estado:"abierto"}:s);
      await openThread({...selected,estado:"abierto"});
      refreshUnread?.();
    }else{
      SFX.error();
      showToast?.("No se pudo enviar la respuesta");
    }
  }

  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="📩" title="Mensajes privados" sub={`${conversaciones.length} conversaciones · ${(unread?.admin||0)} sin leer`} action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#120806,#2B1A0D 48%,#D4AF37)",border:"2px solid rgba(255,244,214,.52)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>📬</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950}}>Buzón de clientes</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Aquí puedes responder conversaciones privadas de cada cliente. Los clientes sólo ven su propio hilo.</div>
        </div>
      </div>
    </Card>

    {!selected&&(
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <Input label="Buscar conversación" value={search} onChange={setSearch} placeholder="Cliente, mensaje o ID..."/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[{id:"abierto",label:"Abiertas"},{id:"cerrado",label:"Cerradas"},{id:"todo",label:"Todas"}].map(f=><button key={f.id} onClick={()=>{SFX.tab();setStatusFilter(f.id);}} style={{border:`2px solid ${statusFilter===f.id?T.gold:T.g300}`,background:statusFilter===f.id?T.gradGold:"rgba(255,244,214,.84)",color:statusFilter===f.id?T.g900:T.g700,borderRadius:14,padding:"9px 6px",fontWeight:950,cursor:"pointer",fontSize:".76rem"}}>{f.label}</button>)}
        </div>
      </Card>
    )}

    {!selected&&(
      loading?<Spinner/>:conversaciones.length===0?<EmptyState icon="📩" title="Sin mensajes" sub="Cuando un cliente escriba, aparecerá aquí."/>:
      conversaciones.map(c=>{
        const when=c.ultimo?.created_at?new Date(c.ultimo.created_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
        return <Card key={c.usuario_id} hover onClick={()=>openThread(c)} style={{marginBottom:10,background:c.unread?"linear-gradient(180deg,#FFF4D6,#EBD18D)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:c.unread?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="icon3d" style={{fontSize:"2rem"}}>{c.unread?"🔔":"💬"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:950,color:T.g800}}>{c.cliente_nombre}</div>
              <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.ultimo?.mensaje}</div>
              <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub,marginTop:3}}>{when} · {c.total} mensajes · {c.estado==="cerrado"?"cerrada":"abierta"}</div>
            </div>
            {c.unread>0&&<Badge col="red">{c.unread}</Badge>}
          </div>
        </Card>;
      })
    )}

    {selected&&(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>{SFX.navBack();setSelected(null);setThread([]);}} style={{background:T.g150,border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",fontWeight:950,fontSize:"1rem",color:T.g700,boxShadow:"0 8px 18px rgba(20,8,4,.2)"}}>{"<"}</button>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,color:T.g800}}>Conversación con {selected.cliente_nombre}</div>
            <div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>ID cliente: {selected.usuario_id}</div>
          </div>
          <Badge col={selected.estado==="cerrado"?"red":"green"}>{selected.estado==="cerrado"?"cerrada":"abierta"}</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <Btn small col="ghost" onClick={()=>cambiarEstadoConversacion("abierto")}>Reabrir</Btn>
          <Btn small col="red" onClick={()=>cambiarEstadoConversacion("cerrado")}>Cerrar</Btn>
        </div>

        <Card style={{background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,marginBottom:14,minHeight:300}}>
          {threadLoading?<Spinner/>:thread.map(m=><MessageBubble key={m.id} msg={m} isMine={String(m.autor_rol||"client")!=="client"}/>)}
        </Card>

        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Responder</div>
          <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Escribe la respuesta..." style={{width:"100%",borderRadius:14,border:`1.5px solid ${T.g200}`,background:T.g50,padding:"11px 12px",fontSize:".9rem",fontWeight:800,color:T.text,resize:"vertical",outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}/>
          <div style={{marginTop:10}}>
            <Btn full col="gold" onClick={responder}>Enviar respuesta</Btn>
          </div>
        </Card>
      </div>
    )}
  </div>;
}


function GestionMusica({user,showToast}){
  if(!isAdminUser(user)) return <EmptyState icon="🔒" title="Sólo admin" sub="La música editable sólo puede gestionarla el administrador."/>;
  const empty={id:null,titulo:"",artista:"",genero:"reggae",descripcion:"",tipo:"externo",icono:"🎧",youtube_url:"",spotify_url:"",web_url:"",audio_url:"",storage_path:"",destacado:"false",activo:"true",orden:"0"};
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showEdit,setShowEdit]=useState(false);
  const [form,setForm]=useState(empty);
  const [filter,setFilter]=useState("todo");
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("musica_items","?order=destacado.desc,orden.asc,created_at.desc&select=*");
    setItems(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  function openNew(){
    setForm({...empty});
    setShowEdit(true);
  }

  function openEdit(item){
    setForm({
      id:item.id,
      titulo:item.titulo||"",
      artista:item.artista||"",
      genero:item.genero||"reggae",
      descripcion:item.descripcion||"",
      tipo:item.tipo||"externo",
      icono:item.icono||"🎧",
      youtube_url:item.youtube_url||"",
      spotify_url:item.spotify_url||"",
      web_url:item.web_url||"",
      audio_url:item.audio_url||"",
      storage_path:item.storage_path||"",
      destacado:String(Boolean(item.destacado)),
      activo:String(item.activo!==false),
      orden:String(item.orden??0)
    });
    setShowEdit(true);
  }

  async function uploadAudio(file){
    if(!file)return;
    if(!supabase){showToast?.("Supabase no está conectado");return;}
    if(!file.type.startsWith("audio/")){showToast?.("Sube un archivo de audio");return;}
    setUploading(true);
    try{
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"_");
      const path=`audios/${Date.now()}_${safeName}`;
      const {error}=await supabase.storage.from("musica").upload(path,file,{cacheControl:"3600",upsert:false});
      if(error) throw error;
      const {data}=supabase.storage.from("musica").getPublicUrl(path);
      setForm(f=>({...f,tipo:"archivo",audio_url:data?.publicUrl||"",storage_path:path}));
      showToast?.("Audio subido");
      SFX.success();
    }catch(e){
      console.warn("upload audio",e);
      showToast?.("No se pudo subir el audio. Revisa el bucket público 'musica'.");
      SFX.error();
    }
    setUploading(false);
  }

  async function saveItem(){
    if(!form.titulo.trim()){showToast?.("Pon un título");return;}
    const payload={
      titulo:form.titulo.trim(),
      artista:form.artista.trim()||null,
      genero:form.genero||"reggae",
      descripcion:form.descripcion.trim()||null,
      tipo:form.audio_url?form.tipo:"externo",
      icono:form.icono||"🎧",
      youtube_url:form.youtube_url.trim()||null,
      spotify_url:form.spotify_url.trim()||null,
      web_url:form.web_url.trim()||null,
      audio_url:form.audio_url.trim()||null,
      storage_path:form.storage_path.trim()||null,
      destacado:form.destacado==="true",
      activo:form.activo==="true",
      orden:parseInt(form.orden||"0",10)||0,
      updated_at:new Date().toISOString()
    };
    const ok=form.id
      ? await dbPatch("musica_items",`?id=eq.${form.id}`,payload)
      : await dbPost("musica_items",payload);
    if(ok){
      showToast?.(form.id?"Música actualizada":"Música añadida");
      SFX.success();
      setShowEdit(false);
      await load();
    }else{
      showToast?.("No se pudo guardar la música");
      SFX.error();
    }
  }

  async function toggleActive(item){
    const ok=await dbPatch("musica_items",`?id=eq.${item.id}`,{activo:!item.activo,updated_at:new Date().toISOString()});
    if(ok){showToast?.(!item.activo?"Música activada":"Música desactivada");await load();}
    else{showToast?.("No se pudo cambiar el estado");SFX.error();}
  }

  async function toggleFeatured(item){
    const ok=await dbPatch("musica_items",`?id=eq.${item.id}`,{destacado:!item.destacado,updated_at:new Date().toISOString()});
    if(ok){showToast?.(!item.destacado?"Marcado como destacado":"Quitado de destacados");await load();}
    else{showToast?.("No se pudo cambiar destacado");SFX.error();}
  }

  const cats=[
    {id:"todo",label:"Todo"},
    {id:"reggae",label:"Reggae"},
    {id:"rap",label:"Rap"},
    {id:"ska",label:"Ska"},
    {id:"rock",label:"Rock"},
    {id:"archivo",label:"Archivos"}
  ];
  const visibles=filter==="todo"?items:items.filter(i=>{
    if(filter==="archivo")return String(i.tipo)==="archivo"||Boolean(i.audio_url);
    return normalizeText(i.genero||"").includes(filter);
  });

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="🎧" title="Música editable" sub={`${items.length} items configurados`} action={<Btn small col="gold" onClick={openNew}>+ Música</Btn>}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#4E3A76 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🎧</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Administra música sin tocar código</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Añade enlaces oficiales o sube audios propios/libres al bucket público musica.</div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
        <div style={{fontWeight:950,color:T.g800}}>⚠️ Regla importante</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>No subas MP3 comerciales descargados. Para artistas conocidos usa enlaces externos; para archivos, sólo música tuya, libre o con permiso.</div>
      </Card>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=><button key={c.id} onClick={()=>{SFX.tab();setFilter(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===c.id?T.gold:T.g300}`,background:filter===c.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{c.label}</button>)}
      </div>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🎧" title="Sin música" sub="Añade el primer artista, canción, playlist o audio propio."/>:
        visibles.map(item=><Card key={item.id} style={{marginBottom:10,background:item.activo?"linear-gradient(180deg,#FFF4D6,#E9D9B7)":"linear-gradient(180deg,#E6CF9B,#D8BE87)",opacity:item.activo?1:.72,border:item.destacado?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div className="icon3d" style={{fontSize:"2rem"}}>{item.icono||"🎧"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <b style={{color:T.g800}}>{item.titulo}</b>
                <Badge col={item.activo?"green":"red"}>{item.activo?"activo":"oculto"}</Badge>
                {item.destacado&&<Badge col="gold">destacado</Badge>}
              </div>
              <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:3}}>{item.artista||"Sin artista"} · {item.genero} · {item.tipo}</div>
              <div style={{fontSize:".76rem",fontWeight:750,color:T.textSub,lineHeight:1.35,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descripcion||item.youtube_url||item.audio_url||"Sin descripción"}</div>
            </div>
          </div>
          {item.audio_url&&<audio controls src={item.audio_url} style={{width:"100%",marginTop:10}}/>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}>
            <Btn small col="dark" onClick={()=>openEdit(item)}>Editar</Btn>
            <Btn small col={item.destacado?"ghost":"gold"} onClick={()=>toggleFeatured(item)}>{item.destacado?"Normal":"Destacar"}</Btn>
            <Btn small col={item.activo?"red":"green"} onClick={()=>toggleActive(item)}>{item.activo?"Ocultar":"Activar"}</Btn>
          </div>
        </Card>)
      }

      <Modal show={showEdit} onClose={()=>setShowEdit(false)} title={form.id?"Editar música":"Nueva música"}>
        <Input label="Título" value={form.titulo} onChange={v=>setForm(f=>({...f,titulo:v}))} placeholder="Ej: Morodo - búsqueda oficial"/>
        <Input label="Artista" value={form.artista} onChange={v=>setForm(f=>({...f,artista:v}))} placeholder="Morodo, Kase.O, base propia..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Icono" value={form.icono} onChange={v=>setForm(f=>({...f,icono:v}))}/>
          <Input label="Orden" value={form.orden} onChange={v=>setForm(f=>({...f,orden:v}))} type="number"/>
        </div>
        <Select label="Género" value={form.genero} onChange={v=>setForm(f=>({...f,genero:v}))} options={[
          {value:"reggae",label:"Reggae"},
          {value:"rap",label:"Rap"},
          {value:"ska",label:"Ska"},
          {value:"rock",label:"Rock"},
          {value:"lofi",label:"Lofi"},
          {value:"otro",label:"Otro"}
        ]}/>
        <Select label="Tipo" value={form.tipo} onChange={v=>setForm(f=>({...f,tipo:v}))} options={[
          {value:"externo",label:"Enlace externo"},
          {value:"archivo",label:"Archivo propio/libre"}
        ]}/>
        <Input label="Descripción" value={form.descripcion} onChange={v=>setForm(f=>({...f,descripcion:v}))}/>
        <Input label="YouTube URL" value={form.youtube_url} onChange={v=>setForm(f=>({...f,youtube_url:v}))} placeholder="https://www.youtube.com/..."/>
        <Input label="Spotify URL" value={form.spotify_url} onChange={v=>setForm(f=>({...f,spotify_url:v}))} placeholder="https://open.spotify.com/..."/>
        <Input label="Web / playlist / búsqueda" value={form.web_url} onChange={v=>setForm(f=>({...f,web_url:v}))}/>
        <Input label="Audio URL" value={form.audio_url} onChange={v=>setForm(f=>({...f,audio_url:v,tipo:v?"archivo":f.tipo}))} placeholder="Se rellena al subir audio o puedes pegar URL"/>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:".78rem",fontWeight:950,color:T.g700,marginBottom:6}}>Subir audio propio/libre</div>
          <input type="file" accept="audio/*" onChange={e=>uploadAudio(e.target.files?.[0])} style={{width:"100%",fontWeight:800,color:T.text}}/>
          {uploading&&<div style={{fontSize:".78rem",fontWeight:900,color:T.g700,marginTop:6}}>Subiendo audio...</div>}
          {form.storage_path&&<div style={{fontSize:".72rem",fontWeight:800,color:T.textSub,marginTop:6}}>Storage: {form.storage_path}</div>}
        </div>
        <Select label="Destacado" value={form.destacado} onChange={v=>setForm(f=>({...f,destacado:v}))} options={[{value:"true",label:"Destacado"},{value:"false",label:"Normal"}]}/>
        <Select label="Estado" value={form.activo} onChange={v=>setForm(f=>({...f,activo:v}))} options={[{value:"true",label:"Activo"},{value:"false",label:"Oculto"}]}/>
        <div style={{position:"sticky",bottom:"calc(10px + env(safe-area-inset-bottom))",zIndex:8,marginTop:14,padding:"10px 0 0",background:"linear-gradient(180deg,rgba(255,248,230,0),#FFF8E6 38%,#FFF8E6)"}}>
          <Btn full col="gold" onClick={saveItem} disabled={uploading}>{uploading?"Subiendo...":"Guardar música"}</Btn>
        </div>
      </Modal>
    </div>
  );
}


function GestionAgenda({showToast}){
  const todayKey=()=>new Date().toISOString().split("T")[0];
  const [fecha,setFecha]=useState(todayKey());
  const [modo,setModo]=useState("dia");
  const [citas,setCitas]=useState([]);
  const [cobros,setCobros]=useState([]);
  const [loading,setLoading]=useState(true);

  function toKey(d){return d.toISOString().split("T")[0];}
  function dateObj(key){return new Date(`${key}T12:00:00`);}
  function weekDates(baseKey=fecha){
    const base=dateObj(baseKey);
    const day=(base.getDay()+6)%7; // lunes = 0
    const monday=new Date(base);
    monday.setDate(base.getDate()-day);
    return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return toKey(d);});
  }

  useEffect(()=>{load();},[fecha,modo]);

  async function load(){
    setLoading(true);
    const dates=weekDates(fecha);
    const from=modo==="semana"?dates[0]:fecha;
    const to=modo==="semana"?dates[6]:fecha;
    const [citasRows,cobrosRows]=await Promise.all([
      dbGet("citas",`?fecha=gte.${from}&fecha=lte.${to}&order=fecha.asc,hora.asc&select=*`),
      dbGet("cobros","?select=id,cita_id,importe,estado")
    ]);
    setCitas(Array.isArray(citasRows)?citasRows:[]);
    setCobros((Array.isArray(cobrosRows)?cobrosRows:[]).filter(c=>String(c.estado||"pagado").toLowerCase()!=="anulado"));
    setLoading(false);
  }

  function pagoDe(cita){
    return cobros.find(x=>String(x.cita_id||"")===String(cita.id)||String(x.id||"")===String(cita.cobro_id||""));
  }

  async function updateCita(cita,patch,msg){
    const ok=await dbPatch("citas",`?id=eq.${cita.id}`,{...patch,updated_at:new Date().toISOString()});
    if(ok){showToast?.(msg);SFX.success();await load();}
    else{showToast?.("No se pudo actualizar la cita");SFX.error();}
  }

  function addDays(days){
    const d=dateObj(fecha);
    d.setDate(d.getDate()+days);
    setFecha(toKey(d));
  }

  const active=citas.filter(c=>!["cancelada"].includes(String(c.estado||"pendiente").toLowerCase()));
  const totalDia=active.reduce((sum,c)=>sum+(Number(c.servicio_precio)||citaTotal(citaServices(c))||0),0);
  const realizados=active.filter(c=>String(c.estado||"").toLowerCase()==="completada").length;
  const confirmadas=active.filter(c=>String(c.estado||"").toLowerCase()==="confirmada").length;
  const pendientes=active.filter(c=>["pendiente","propuesta"].includes(String(c.estado||"").toLowerCase())).length;

  const slots=HORARIOS.map(h=>{
    const found=citas.filter(c=>String(c.fecha||"")===fecha&&String(c.hora||"").slice(0,5)===h);
    return {hora:h,citas:found};
  });

  const days=weekDates(fecha);
  function dayLabel(key){
    const d=dateObj(key);
    return d.toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
  }
  function citasDia(key){
    return citas.filter(c=>String(c.fecha||"")===key).sort((a,b)=>String(a.hora||"").localeCompare(String(b.hora||"")));
  }

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="🗓️" title="Agenda" sub={modo==="dia"?"Vista diaria ordenada por horas":"Vista semanal compacta"}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.2rem"}}>🗓️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Agenda de trabajo</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Alterna entre día y semana para ver huecos, citas, estado, precio y acciones rápidas.</div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"grid",gridTemplateColumns:"44px 1fr 44px",gap:8,alignItems:"end",marginBottom:12}}>
          <Btn small col="ghost" onClick={()=>addDays(modo==="semana"?-7:-1)}>←</Btn>
          <Input label={modo==="semana"?"Semana de referencia":"Fecha"} value={fecha} onChange={setFecha} type="date"/>
          <Btn small col="ghost" onClick={()=>addDays(modo==="semana"?7:1)}>→</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <button onClick={()=>{SFX.tab();setModo("dia");}} style={{border:`2px solid ${modo==="dia"?T.gold:T.g300}`,background:modo==="dia"?T.gradGold:"rgba(255,244,214,.66)",color:modo==="dia"?T.g900:T.g700,borderRadius:14,padding:"9px 6px",fontWeight:950,cursor:"pointer"}}>📅 Día</button>
          <button onClick={()=>{SFX.tab();setModo("semana");}} style={{border:`2px solid ${modo==="semana"?T.gold:T.g300}`,background:modo==="semana"?T.gradGold:"rgba(255,244,214,.66)",color:modo==="semana"?T.g900:T.g700,borderRadius:14,padding:"9px 6px",fontWeight:950,cursor:"pointer"}}>🗓️ Semana</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          <div style={{background:"rgba(255,244,214,.62)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"9px 6px",textAlign:"center"}}><div style={{fontWeight:950,color:T.g800}}>{active.length}</div><div style={{fontSize:".64rem",fontWeight:900,color:T.textSub}}>Citas</div></div>
          <div style={{background:"rgba(255,244,214,.62)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"9px 6px",textAlign:"center"}}><div style={{fontWeight:950,color:T.g800}}>{confirmadas}</div><div style={{fontSize:".64rem",fontWeight:900,color:T.textSub}}>Confirmadas</div></div>
          <div style={{background:"rgba(255,244,214,.62)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"9px 6px",textAlign:"center"}}><div style={{fontWeight:950,color:T.g800}}>{realizados}</div><div style={{fontSize:".64rem",fontWeight:900,color:T.textSub}}>Realizadas</div></div>
          <div style={{background:"rgba(255,244,214,.62)",border:`1px solid ${T.g300}`,borderRadius:14,padding:"9px 6px",textAlign:"center"}}><div style={{fontWeight:950,color:T.g800}}>{totalDia}€</div><div style={{fontSize:".64rem",fontWeight:900,color:T.textSub}}>{modo==="dia"?"Previsto":"Semana"}</div></div>
        </div>
        {pendientes>0&&<div style={{marginTop:10,fontSize:".78rem",fontWeight:850,color:T.g700}}>🟡 Hay {pendientes} cita{pendientes===1?"":"s"} pendiente{pendientes===1?"":"s"} de revisar.</div>}
      </Card>

      {loading?<Spinner/>:modo==="dia"?(
        <div>
          {citas.filter(c=>String(c.fecha||"")===fecha).length===0?<EmptyState icon="🗓️" title="Día libre" sub="No hay citas registradas para esta fecha."/>:
            slots.map(slot=>{
              const citasHora=slot.citas;
              return <Card key={slot.hora} style={{marginBottom:9,padding:0,overflow:"hidden",background:citasHora.length?"linear-gradient(180deg,#FFF4D6,#E9D9B7)":"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`1.5px solid ${citasHora.length?T.g300:T.g150}`,opacity:citasHora.length?1:.62}}>
                <div style={{display:"grid",gridTemplateColumns:"62px 1fr",gap:0}}>
                  <div style={{background:citasHora.length?"linear-gradient(180deg,#6E3518,#24110A)":"rgba(75,48,27,.22)",color:citasHora.length?T.white:T.g700,display:"grid",placeItems:"center",fontWeight:950,fontSize:".9rem",padding:"12px 4px"}}>
                    {slot.hora}
                  </div>
                  <div style={{padding:"10px 12px"}}>
                    {citasHora.length===0?<div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Hueco libre</div>:
                      citasHora.map(c=>{
                        const st=String(c.estado||"pendiente").toLowerCase();
                        const list=citaServices(c);
                        const dur=citaDuration(list);
                        const precio=Number(c.servicio_precio)||citaTotal(list);
                        const pago=pagoDe(c);
                        return <div key={c.id} style={{paddingBottom:citasHora.length>1?10:0,marginBottom:citasHora.length>1?10:0,borderBottom:citasHora.length>1?`1px solid ${T.g200}`:"none"}}>
                          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>
                                <Badge col={st==="pendiente"?"gold":st==="confirmada"?"green":st==="cancelada"?"red":st==="completada"?"blue":"blue"}>{st==="completada"?"realizada":st}</Badge>
                                {pago&&<Badge col="green">cobrada</Badge>}
                              </div>
                              <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>👤 {c.cliente_nombre||"Cliente"}</div>
                              <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>✂️ {c.servicio_label||c.servicio||"Servicio"}</div>
                              {c.notas_admin&&<div style={{fontSize:".72rem",fontWeight:850,color:T.g800,marginTop:5,background:"rgba(255,244,214,.52)",borderRadius:9,padding:"5px 7px"}}>🔒 {c.notas_admin}</div>}
                            </div>
                            <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                              {!!precio&&<div style={{fontWeight:950,color:T.g600}}>{precio}€</div>}
                              {!!dur&&<div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>hasta {endTime(slot.hora,dur)}</div>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:9}}>
                            {st==="pendiente"&&<Btn small col="green" onClick={()=>updateCita(c,{estado:"confirmada",respuesta_cliente:"aceptada"},"Cita confirmada")}>Confirmar</Btn>}
                            {["confirmada","propuesta"].includes(st)&&<Btn small col="dark" onClick={()=>updateCita(c,{estado:"completada"},"Marcada como realizada")}>Realizada</Btn>}
                            {["pendiente","propuesta","confirmada"].includes(st)&&<Btn small col="red" onClick={()=>updateCita(c,{estado:"cancelada",motivo_cancelacion:"Cancelada desde agenda"},"Cita cancelada")}>Cancelar</Btn>}
                          </div>
                        </div>;
                      })
                    }
                  </div>
                </div>
              </Card>;
            })
          }
        </div>
      ):(
        <div>
          {days.map(day=>{
            const list=citasDia(day);
            const total=list.filter(c=>String(c.estado||"")!=="cancelada").reduce((sum,c)=>sum+(Number(c.servicio_precio)||0),0);
            return <Card key={day} style={{marginBottom:11,background:day===todayKey()?"linear-gradient(180deg,#FFF4D6,#EBD18D)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:day===todayKey()?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10}}>
                <div>
                  <div style={{fontWeight:950,color:T.g800,textTransform:"capitalize"}}>{dayLabel(day)}</div>
                  <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{list.length} cita{list.length===1?"":"s"} · {total}€ previsto</div>
                </div>
                <Btn small col="ghost" onClick={()=>{setFecha(day);setModo("dia");}}>Ver día</Btn>
              </div>
              {list.length===0?<div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Día libre</div>:
                list.map(c=>{
                  const st=String(c.estado||"pendiente").toLowerCase();
                  return <div key={c.id} style={{display:"grid",gridTemplateColumns:"48px 1fr auto",gap:8,alignItems:"center",padding:"7px 0",borderTop:`1px solid ${T.g150}`}}>
                    <div style={{fontWeight:950,color:T.g700,fontSize:".78rem"}}>{String(c.hora||"--:--").slice(0,5)}</div>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:900,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.cliente_nombre||"Cliente"}</div>
                      <div style={{fontSize:".7rem",fontWeight:800,color:T.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.servicio_label||c.servicio||"Servicio"}</div>
                    </div>
                    <Badge col={st==="pendiente"?"gold":st==="confirmada"?"green":st==="cancelada"?"red":st==="completada"?"blue":"blue"}>{st==="completada"?"realizada":st}</Badge>
                  </div>;
                })
              }
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}



function GestionPedidos({user,showToast}){
  if(!isInternalUser(user)) return <EmptyState icon="🔒" title="Zona interna" sub="Sólo admin y staff pueden gestionar pedidos."/>;
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("pendiente");
  const [edit,setEdit]=useState(null);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("tienda_pedidos","?order=created_at.desc&limit=300&select=*");
    setPedidos(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  async function setEstado(pedido,estado,extra={}){
    const now=new Date().toISOString();
    const patch={estado,updated_at:now,...extra};
    if(estado==="preparando") patch.preparado_por=user?.email||user?.nombre||"staff";
    if(estado==="listo") patch.fecha_preparado=now;
    if(estado==="entregado"){patch.fecha_entregado=now;patch.entregado_por=user?.email||user?.nombre||"staff";}
    if(estado==="cancelado") patch.fecha_cancelado=now;
    const ok=await dbPatch("tienda_pedidos",`?id=eq.${pedido.id}`,patch);
    if(ok){
      SFX.success();
      showToast?.(`Pedido ${estado}`);
      await createNotification({usuario_id:pedido.usuario_id,rol_destino:"client",tipo:"pedido",titulo:`Pedido ${estado}`,mensaje:`Tu pedido de ${pedido.item_nombre} está ${estado}.`,entidad_tipo:"tienda_pedido",entidad_id:pedido.id,importante:estado==="listo"});
      await load();
    }else{showToast?.("No se pudo actualizar el pedido");SFX.error();}
  }

  async function guardarNotas(){
    if(!edit)return;
    const ok=await dbPatch("tienda_pedidos",`?id=eq.${edit.id}`,{notas_admin:edit.notas_admin||null,motivo_cancelacion:edit.motivo_cancelacion||null,updated_at:new Date().toISOString()});
    if(ok){showToast?.("Pedido actualizado");setEdit(null);await load();}
    else{showToast?.("No se pudo guardar");SFX.error();}
  }

  async function cancelarConDevolucion(pedido){
    const pts=Number(pedido.puntos_coste)||0;
    if(pts>0&&pedido.usuario_id){
      const rows=await dbGet("usuarios",`?id=eq.${pedido.usuario_id}&select=id,puntos&limit=1`);
      const actual=Number(rows?.[0]?.puntos||0);
      await dbPatch("usuarios",`?id=eq.${pedido.usuario_id}`,{puntos:actual+pts});
    }
    await setEstado(pedido,"cancelado",{motivo_cancelacion:"Cancelado desde gestión con devolución de puntos"});
  }

  const tabs=[
    {id:"pendiente",label:"Pendientes"},{id:"preparando",label:"Preparando"},{id:"listo",label:"Listos"},{id:"entregado",label:"Entregados"},{id:"cancelado",label:"Cancelados"},{id:"todos",label:"Todos"}
  ];
  const visibles=filter==="todos"?pedidos:pedidos.filter(p=>String(p.estado||"pendiente")===filter);
  const countEstado=id=>id==="todos"?pedidos.length:pedidos.filter(p=>String(p.estado||"pendiente")===id).length;

  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="🛍️" title="Pedidos de tienda" sub="Canjes pendientes, preparación y entrega" action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>🎁</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Gestión de canjes</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Cuando un cliente canjea puntos, aparece aquí como pedido. Puedes prepararlo, marcarlo listo, entregarlo o cancelarlo.</div>
        </div>
      </div>
    </Card>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
      {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setFilter(t.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===t.id?T.gold:T.g300}`,background:filter===t.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===t.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{t.label} ({countEstado(t.id)})</button>)}
    </div>
    {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin pedidos" sub="No hay pedidos en esta vista."/>:visibles.map(p=><Card key={p.id} style={{marginBottom:10,background:p.estado==="cancelado"?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:p.estado==="pendiente"?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}><Badge col={p.estado==="entregado"?"green":p.estado==="cancelado"?"red":p.estado==="listo"?"blue":"gold"}>{p.estado}</Badge><Badge col="gold">{p.puntos_coste||0} pts</Badge></div>
          <div style={{fontWeight:950,color:T.g800}}>{p.item_nombre}</div>
          <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3}}>👤 {p.cliente_nombre||"Cliente"} · {p.cliente_email||"sin email"}</div>
          <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,marginTop:3}}>{new Date(p.created_at).toLocaleString("es-ES")}</div>
          {p.notas_admin&&<div style={{fontSize:".74rem",fontWeight:850,color:T.g800,marginTop:6,background:"rgba(255,244,214,.52)",borderRadius:10,padding:7}}>🔒 {p.notas_admin}</div>}
          {p.motivo_cancelacion&&<div style={{fontSize:".74rem",fontWeight:850,color:T.red,marginTop:6}}>Motivo: {p.motivo_cancelacion}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
        {p.estado==="pendiente"&&<Btn small col="gold" onClick={()=>setEstado(p,"preparando")}>Preparar</Btn>}
        {["pendiente","preparando"].includes(p.estado)&&<Btn small col="blue" onClick={()=>setEstado(p,"listo")}>Listo</Btn>}
        {["pendiente","preparando","listo"].includes(p.estado)&&<Btn small col="green" onClick={()=>setEstado(p,"entregado")}>Entregado</Btn>}
        {p.estado!=="cancelado"&&p.estado!=="entregado"&&<Btn small col="red" onClick={()=>cancelarConDevolucion(p)}>Cancelar + devolver</Btn>}
        <Btn small col="ghost" onClick={()=>setEdit({...p})}>Notas</Btn>
      </div>
    </Card>)}
    <Modal show={!!edit} onClose={()=>setEdit(null)} title="Editar pedido">
      {edit&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}><div style={{fontWeight:950,color:T.g800}}>{edit.item_nombre}</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>{edit.cliente_nombre} · {edit.estado}</div></Card>
        <Input label="Notas internas" value={edit.notas_admin||""} onChange={v=>setEdit(e=>({...e,notas_admin:v}))}/>
        <Input label="Motivo de cancelación" value={edit.motivo_cancelacion||""} onChange={v=>setEdit(e=>({...e,motivo_cancelacion:v}))}/>
        <Btn full col="gold" onClick={guardarNotas}>Guardar</Btn>
      </>}
    </Modal>
  </div>;
}


function GestionModeracion({user,showToast}){
  const [reportes,setReportes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("pendiente");
  const [selected,setSelected]=useState(null);
  const [nota,setNota]=useState("");

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const rows=await dbGet("reportes_comunidad","?order=created_at.desc&limit=200&select=*");
    setReportes(Array.isArray(rows)?rows:[]);
    setLoading(false);
  }

  async function updateReporte(rep,patch,msg){
    const ok=await dbPatch("reportes_comunidad",`?id=eq.${rep.id}`,{...patch,updated_at:new Date().toISOString(),revisado_por:user?.email||user?.nombre||"staff",revisado_at:new Date().toISOString()});
    if(ok){SFX.success();showToast?.(msg);setSelected(null);await load();}
    else{SFX.error();showToast?.("No se pudo actualizar el reporte");}
  }

  async function cerrarTema(rep){
    if(String(rep.target_tipo)!=="tema"){showToast?.("Sólo se puede cerrar automáticamente un tema del foro");return;}
    await dbPatch("foro_temas",`?id=eq.${rep.target_id}`,{cerrado:true,updated_at:new Date().toISOString()});
    await updateReporte(rep,{estado:"oculto",notas_admin:nota||"Tema cerrado desde moderación",accion_tomada:"tema_cerrado"},"Tema cerrado y reporte marcado");
  }

  const counts=reportes.reduce((a,r)=>{const st=String(r.estado||"pendiente");a[st]=(a[st]||0)+1;a.todo=(a.todo||0)+1;return a;},{todo:reportes.length});
  const tabs=[
    {id:"pendiente",label:"Pendientes",icon:"🚩"},
    {id:"revisado",label:"Revisados",icon:"✅"},
    {id:"descartado",label:"Descartados",icon:"🟢"},
    {id:"oculto",label:"Actuados",icon:"🙈"},
    {id:"todo",label:"Todos",icon:"📚"}
  ];
  const list=filter==="todo"?reportes:reportes.filter(r=>String(r.estado||"pendiente")===filter);

  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="🛡️" title="Moderación" sub={`${counts.pendiente||0} reportes pendientes`} action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#42130F,#7A241B 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>🛡️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Reportes de comunidad</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Revisa avisos de usuarios, descarta lo que no proceda o cierra temas problemáticos.</div>
        </div>
      </div>
    </Card>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
      {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setFilter(t.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===t.id?T.gold:T.g300}`,background:filter===t.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===t.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{t.icon} {t.label} ({counts[t.id]||0})</button>)}
    </div>

    {loading?<Spinner/>:list.length===0?<EmptyState icon="🛡️" title="Sin reportes" sub="No hay reportes en esta vista."/>:list.map(r=>{
      const st=String(r.estado||"pendiente");
      const col=st==="pendiente"?"red":st==="descartado"?"green":st==="oculto"?"gold":"blue";
      return <Card key={r.id} hover onClick={()=>{setSelected(r);setNota(r.notas_admin||"");}} style={{marginBottom:10,background:st==="pendiente"?"linear-gradient(180deg,#FFF4D6,#EBD18D)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:st==="pendiente"?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{fontSize:"1.6rem"}}>🚩</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}><Badge col={col}>{st}</Badge><Badge col="blue">{r.target_tipo}</Badge></div>
            <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.target_titulo||"Contenido reportado"}</div>
            <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3}}>Motivo: {r.motivo||"sin motivo"}</div>
            <div style={{fontSize:".68rem",fontWeight:800,color:T.textSub,marginTop:3}}>{r.created_at?new Date(r.created_at).toLocaleString("es-ES"):""} · Reporta: {r.reportado_por_nombre||"Usuario"}</div>
          </div>
        </div>
      </Card>;
    })}

    <Modal show={!!selected} onClose={()=>setSelected(null)} title="Revisar reporte">
      {selected&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
          <div style={{fontWeight:950,color:T.g800}}>🚩 {selected.target_titulo||"Contenido reportado"}</div>
          <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:4}}>Tipo: {selected.target_tipo} · Autor: {selected.target_autor_nombre||"desconocido"}</div>
          <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:4}}>Motivo: {selected.motivo}</div>
          {selected.detalle&&<div style={{fontSize:".8rem",fontWeight:800,color:T.g800,marginTop:8,whiteSpace:"pre-wrap"}}>Detalle: {selected.detalle}</div>}
        </Card>
        <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={4} placeholder="Notas internas de moderación..." style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:T.g150,resize:"vertical",outline:"none",fontWeight:800,color:T.text}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <Btn small col="green" onClick={()=>updateReporte(selected,{estado:"revisado",notas_admin:nota,accion_tomada:"revisado"},"Reporte revisado")}>Revisado</Btn>
          <Btn small col="ghost" onClick={()=>updateReporte(selected,{estado:"descartado",notas_admin:nota,accion_tomada:"descartado"},"Reporte descartado")}>Descartar</Btn>
          <Btn small col="red" onClick={()=>cerrarTema(selected)}>Cerrar tema</Btn>
          <Btn small col="gold" onClick={()=>updateReporte(selected,{estado:"oculto",notas_admin:nota,accion_tomada:"marcado_para_revisar"},"Marcado como actuado")}>Marcar actuado</Btn>
        </div>
      </>}
    </Modal>
  </div>;
}


function GestionEstadisticas({showToast}){
  const [loading,setLoading]=useState(true);
  const [range,setRange]=useState("mes");
  const [data,setData]=useState({
    citas:[],cobros:[],clientes:[],pedidos:[],foroTemas:[],foroRespuestas:[],newsEvents:[],gameScores:[],canjes:[]
  });

  const money=n=>`${(Number(n)||0).toFixed(2)}€`;
  const todayKey=()=>new Date().toISOString().split("T")[0];
  function daysAgo(n){
    const d=new Date();
    d.setDate(d.getDate()-n);
    return d.toISOString().split("T")[0];
  }
  function monthStart(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  }
  function yearStart(){
    const d=new Date();
    return `${d.getFullYear()}-01-01`;
  }
  function startDate(){
    if(range==="hoy")return todayKey();
    if(range==="7d")return daysAgo(7);
    if(range==="30d")return daysAgo(30);
    if(range==="anio")return yearStart();
    return monthStart();
  }
  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  useEffect(()=>{load();},[range]);

  async function load(){
    setLoading(true);
    const start=startDate();
    const [citas,cobros,clientes,pedidos,foroTemas,foroRespuestas,newsEvents,gameScores,canjes]=await Promise.all([
      safeList("citas",`?fecha=gte.${start}&order=fecha.desc,hora.desc&limit=5000&select=*`),
      safeList("cobros",`?fecha=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("usuarios","?role=eq.client&limit=5000&select=id,nombre,email,puntos,created_at"),
      safeList("tienda_pedidos",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("foro_temas",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("foro_respuestas",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("news_point_events",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("game_scores",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("canjes",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
    ]);
    setData({citas,cobros,clientes,pedidos,foroTemas,foroRespuestas,newsEvents,gameScores,canjes});
    setLoading(false);
  }

  const cobrosOk=data.cobros.filter(c=>String(c.estado||"pagado").toLowerCase()!=="anulado");
  const ingresos=cobrosOk.reduce((sum,c)=>sum+(Number(c.importe)||0),0);
  const citasActivas=data.citas.filter(c=>String(c.estado||"").toLowerCase()!=="cancelada");
  const citasRealizadas=data.citas.filter(c=>String(c.estado||"").toLowerCase()==="completada");
  const citasPendientes=data.citas.filter(c=>["pendiente","propuesta"].includes(String(c.estado||"pendiente").toLowerCase()));
  const pedidosPendientes=data.pedidos.filter(p=>["pendiente","preparando","listo"].includes(String(p.estado||"pendiente").toLowerCase()));
  const pedidosEntregados=data.pedidos.filter(p=>String(p.estado||"").toLowerCase()==="entregado");
  const puntosPedidos=data.pedidos.reduce((sum,p)=>sum+(Number(p.puntos_coste)||0),0);
  const puntosNoticias=data.newsEvents.reduce((sum,p)=>sum+(Number(p.puntos)||0),0);
  const puntosCanjes=data.canjes.reduce((sum,c)=>sum+(Number(c.puntos)||Number(c.puntos_coste)||0),0);

  function countBy(arr,keyFn){
    const map=new Map();
    arr.forEach(x=>{
      const key=keyFn(x)||"Sin dato";
      map.set(key,(map.get(key)||0)+1);
    });
    return [...map.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
  }
  const topServicios=countBy(data.citas,c=>c.servicio_label||c.servicio).slice(0,5);
  const topPedidos=countBy(data.pedidos,p=>p.item_nombre||p.nombre||p.item_id).slice(0,5);
  const topJuegos=countBy(data.gameScores,s=>s.game_id||s.juego||s.game||"Juego").slice(0,5);
  const topClientes=[...data.clientes].sort((a,b)=>Number(b.puntos||0)-Number(a.puntos||0)).slice(0,5);

  function BarList({items,empty="Sin datos todavía"}){
    const max=Math.max(1,...items.map(i=>Number(i.value)||0));
    if(!items.length)return <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,padding:"8px 0"}}>{empty}</div>;
    return <div style={{display:"grid",gap:8}}>
      {items.map((i,idx)=><div key={`${i.label}-${idx}`}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:".78rem",fontWeight:900,color:T.g800,marginBottom:4}}>
          <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{i.label}</span>
          <span>{i.value}</span>
        </div>
        <div style={{height:8,borderRadius:999,background:"rgba(75,48,27,.13)",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.max(8,(Number(i.value)||0)/max*100)}%`,borderRadius:999,background:"linear-gradient(90deg,#2F6B42,#D4AF37,#A72822)"}}/>
        </div>
      </div>)}
    </div>;
  }

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="📊" title="Estadísticas" sub="Resumen visual del negocio, tienda, comunidad y juegos" action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#17252D,#263F4D 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.2rem"}}>📊</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Panel de control</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Mide citas, ingresos, pedidos, puntos y actividad sin salir de Gestión.</div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
          {[
            ["hoy","Hoy"],["7d","7 días"],["mes","Mes"],["30d","30 días"],["anio","Año"]
          ].map(([id,label])=><button key={id} onClick={()=>{SFX.tab();setRange(id);}} style={{border:`2px solid ${range===id?T.gold:T.g300}`,background:range===id?T.gradGold:"rgba(255,244,214,.72)",color:range===id?T.g900:T.g700,borderRadius:14,padding:"8px 4px",fontWeight:950,cursor:"pointer",fontSize:".7rem"}}>{label}</button>)}
        </div>
      </Card>

      {loading?<Spinner/>:<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <StatCard icon="💶" label="Ingresos" value={money(ingresos)} col="gold"/>
          <StatCard icon="📅" label="Citas activas" value={citasActivas.length} col="green"/>
          <StatCard icon="🏁" label="Realizadas" value={citasRealizadas.length} col="blue"/>
          <StatCard icon="🟡" label="Pendientes" value={citasPendientes.length} col="gold"/>
          <StatCard icon="🎁" label="Pedidos activos" value={pedidosPendientes.length} col="pink"/>
          <StatCard icon="✅" label="Pedidos entregados" value={pedidosEntregados.length} col="green"/>
          <StatCard icon="👥" label="Clientes" value={data.clientes.length} col="blue"/>
          <StatCard icon="⭐" label="Puntos movidos" value={puntosPedidos+puntosNoticias+puntosCanjes} col="gold"/>
        </div>

        <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>📈 Resumen rápido</div>
          <div style={{display:"grid",gap:8,fontSize:".84rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>
            <div>Ingresos registrados: <b style={{color:T.g800}}>{money(ingresos)}</b> en {cobrosOk.length} cobro{cobrosOk.length===1?"":"s"}.</div>
            <div>Citas: <b style={{color:T.g800}}>{data.citas.length}</b> totales, <b style={{color:T.g800}}>{citasRealizadas.length}</b> realizadas y <b style={{color:T.g800}}>{citasPendientes.length}</b> pendientes/propuestas.</div>
            <div>Comunidad: <b style={{color:T.g800}}>{data.foroTemas.length}</b> temas, <b style={{color:T.g800}}>{data.foroRespuestas.length}</b> respuestas y <b style={{color:T.g800}}>{data.newsEvents.length}</b> eventos de actualidad.</div>
            <div>Tienda: <b style={{color:T.g800}}>{data.pedidos.length}</b> pedidos y <b style={{color:T.g800}}>{puntosPedidos}</b> puntos canjeados en pedidos.</div>
          </div>
        </Card>

        <div style={{display:"grid",gap:14}}>
          <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>✂️ Servicios más pedidos</div>
            <BarList items={topServicios}/>
          </Card>
          <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🎁 Productos/canjes más pedidos</div>
            <BarList items={topPedidos}/>
          </Card>
          <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🎮 Juegos más usados</div>
            <BarList items={topJuegos}/>
          </Card>
          <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
            <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>👑 Clientes con más puntos</div>
            {topClientes.length===0?<div style={{fontSize:".82rem",fontWeight:800,color:T.textSub}}>Sin clientes todavía.</div>:topClientes.map((c,i)=><div key={c.id||i} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"8px 0",borderBottom:i<topClientes.length-1?`1px solid ${T.g150}`:"none",fontSize:".84rem"}}>
              <span style={{fontWeight:900,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{i+1}. {c.nombre||c.email||"Cliente"}</span>
              <span style={{fontWeight:950,color:T.g600}}>{Number(c.puntos||0)} pts</span>
            </div>)}
          </Card>
        </div>

        <Card style={{marginTop:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
          <div style={{fontWeight:950,color:T.g800}}>📌 Nota</div>
          <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Este panel lee datos de Supabase y los resume. Si una tabla aún no tiene datos, simplemente aparecerá como cero o sin resultados.</div>
        </Card>
      </>}
    </div>
  );
}


function GestionSeguridad({user,showToast}){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("todos");
  const isAdmin=isAdminUser(user);

  useEffect(()=>{if(isAdmin)load(); else setLoading(false);},[isAdmin]);

  async function load(){
    setLoading(true);
    try{
      const data=await dbGet("seguridad_auditoria","?order=created_at.desc&limit=200&select=*");
      setRows(Array.isArray(data)?data:[]);
    }catch(e){
      setRows([]);
      showToast?.("No se pudo cargar auditoría. Revisa la tabla seguridad_auditoria.");
    }
    setLoading(false);
  }

  const filters=[
    {id:"todos",label:"Todos",icon:"🧾"},
    {id:"cambio_rol",label:"Roles",icon:"👑"},
    {id:"baneo",label:"Bloqueos",icon:"🚫"},
    {id:"ajustes",label:"Ajustes",icon:"⚙️"},
    {id:"general",label:"General",icon:"🔐"}
  ];

  const visibles=filter==="todos"?rows:rows.filter(r=>String(r.tipo||"general")===filter);
  const cambiosRol=rows.filter(r=>String(r.tipo||"")==="cambio_rol").length;
  const ultimos7=rows.filter(r=>{
    const d=new Date(r.created_at||0);
    const now=new Date();
    return (now-d)/(1000*60*60*24)<=7;
  }).length;

  function labelTipo(tipo){
    const map={
      cambio_rol:"Cambio de rol",
      ajustes:"Ajustes",
      general:"General",
      baneo:"Baneo",
      permisos:"Permisos"
    };
    return map[tipo]||tipo||"General";
  }

  function colTipo(tipo){
    if(tipo==="cambio_rol")return "gold";
    if(tipo==="baneo")return "red";
    if(tipo==="ajustes")return "blue";
    return "green";
  }

  if(!isAdmin){
    return <EmptyState icon="🔒" title="Sólo admin" sub="La auditoría de seguridad sólo debería verla el administrador."/>
  }

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="🛡️" title="Seguridad" sub="Auditoría de roles, permisos y cambios importantes" action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>

      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#120806,#24110A 52%,#A72822)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.2rem"}}>🛡️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Registro de seguridad</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Aquí se revisan cambios de rol y eventos sensibles guardados en Supabase.</div>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard icon="🧾" label="Registros" value={rows.length} col="blue"/>
        <StatCard icon="👑" label="Cambios rol" value={cambiosRol} col="gold"/>
        <StatCard icon="🕒" label="Últimos 7 días" value={ultimos7} col="green"/>
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {filters.map(f=><button key={f.id} onClick={()=>{SFX.tab();setFilter(f.id);}} style={{border:`2px solid ${filter===f.id?T.gold:T.g300}`,background:filter===f.id?T.gradGold:"rgba(255,244,214,.72)",color:filter===f.id?T.g900:T.g700,borderRadius:14,padding:"8px 4px",fontWeight:950,cursor:"pointer",fontSize:".68rem"}}>
            <div>{f.icon}</div><div>{f.label}</div>
          </button>)}
        </div>
      </Card>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛡️" title="Sin registros" sub="Todavía no hay auditoría con este filtro."/>:
        visibles.map(r=><Card key={r.id} style={{marginBottom:10,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`1.5px solid ${T.g300}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Badge col={colTipo(r.tipo)}>{labelTipo(r.tipo)}</Badge>
              {r.entidad&&<Badge col="blue">{r.entidad}</Badge>}
            </div>
            <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub,textAlign:"right"}}>
              {r.created_at?new Date(r.created_at).toLocaleString("es-ES"):""}
            </div>
          </div>

          <div style={{fontWeight:950,color:T.g800,marginBottom:4}}>
            {r.usuario_afectado_email||r.usuario_afectado_id||r.entidad_id||"Evento de seguridad"}
          </div>

          {(r.valor_anterior||r.valor_nuevo)&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:".82rem",fontWeight:900,color:T.textSub,marginBottom:7}}>
            <span style={{background:"rgba(167,40,34,.1)",border:"1px solid rgba(167,40,34,.25)",borderRadius:999,padding:"4px 8px"}}>{r.valor_anterior||"—"}</span>
            <span>→</span>
            <span style={{background:"rgba(47,107,66,.12)",border:"1px solid rgba(47,107,66,.25)",borderRadius:999,padding:"4px 8px",color:T.g800}}>{r.valor_nuevo||"—"}</span>
          </div>}

          {r.detalle&&<div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35,whiteSpace:"pre-wrap"}}>{r.detalle}</div>}
        </Card>)
      }

      <Card style={{marginTop:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
        <div style={{fontWeight:950,color:T.g800}}>📌 Nota</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>
          Si cambias un rol desde Gestión &gt; Usuarios y el trigger de Supabase está activo, aparecerá aquí como cambio de rol.
        </div>
      </Card>
    </div>
  );
}



function GestionFacturacionPanel({user,showToast}){
  const [loading,setLoading]=useState(true);
  const [range,setRange]=useState("hoy");
  const [rows,setRows]=useState({cobros:[],citas:[],pedidos:[],canjes:[]});

  const money=n=>`${(Number(n)||0).toFixed(2)}€`;
  function dayKey(offset=0){
    const d=new Date();
    d.setDate(d.getDate()+offset);
    return d.toISOString().split("T")[0];
  }
  function monthStart(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  }
  function startDate(){
    if(range==="hoy") return dayKey(0);
    if(range==="7d") return dayKey(-7);
    if(range==="30d") return dayKey(-30);
    return monthStart();
  }
  async function safeList(table,query){
    try{
      const r=await dbGet(table,query);
      return Array.isArray(r)?r:[];
    }catch(e){return [];}
  }
  async function load(){
    setLoading(true);
    const start=startDate();
    const [cobros,citas,pedidos,canjes]=await Promise.all([
      safeList("cobros",`?fecha=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("citas",`?fecha=gte.${start}&order=fecha.desc,hora.desc&limit=5000&select=*`),
      safeList("tienda_pedidos",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
      safeList("canjes",`?created_at=gte.${start}&order=created_at.desc&limit=5000&select=*`),
    ]);
    setRows({cobros,citas,pedidos,canjes});
    setLoading(false);
  }
  useEffect(()=>{load();},[range]);

  const cobrosOk=rows.cobros.filter(c=>String(c.estado||"pagado").toLowerCase()!=="anulado");
  const ingresos=cobrosOk.reduce((sum,c)=>sum+(Number(c.importe)||0),0);
  const ticketMedio=cobrosOk.length?ingresos/cobrosOk.length:0;
  const citasRealizadas=rows.citas.filter(c=>String(c.estado||"").toLowerCase()==="completada");
  const citasPendientes=rows.citas.filter(c=>["pendiente","propuesta"].includes(String(c.estado||"pendiente").toLowerCase()));
  const pedidosActivos=rows.pedidos.filter(p=>["pendiente","preparando","listo"].includes(String(p.estado||"pendiente").toLowerCase()));
  const puntosCanjeados=rows.canjes.reduce((sum,c)=>sum+(Number(c.puntos)||Number(c.puntos_coste)||0),0);

  function estadoCobros(){
    const anulados=rows.cobros.filter(c=>String(c.estado||"").toLowerCase()==="anulado").length;
    if(!rows.cobros.length) return "Sin cobros registrados en este periodo.";
    return `${cobrosOk.length} cobro${cobrosOk.length===1?"":"s"} válido${cobrosOk.length===1?"":"s"} y ${anulados} anulado${anulados===1?"":"s"}.`;
  }

  return <div style={{display:"grid",gap:14}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#3A2414 50%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>💰</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.6rem",lineHeight:1}}>Resumen de facturación</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Vista rápida de caja, cobros, citas realizadas, pedidos activos y puntos canjeados.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`,padding:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
        {[["hoy","Hoy"],["7d","7 días"],["mes","Mes"],["30d","30 días"]].map(([id,label])=>
          <button key={id} onClick={()=>{SFX.tab();setRange(id);}} style={{border:`2px solid ${range===id?T.gold:T.g300}`,background:range===id?T.gradGold:"rgba(255,244,214,.72)",color:range===id?T.g900:T.g700,borderRadius:14,padding:"9px 4px",fontWeight:950,cursor:"pointer",fontSize:".72rem"}}>
            {label}
          </button>
        )}
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
        <StatCard icon="💶" label="Ingresos" value={money(ingresos)} col="gold"/>
        <StatCard icon="🧾" label="Cobros" value={cobrosOk.length} col="green"/>
        <StatCard icon="📊" label="Ticket medio" value={money(ticketMedio)} col="blue"/>
        <StatCard icon="🏁" label="Citas realizadas" value={citasRealizadas.length} col="green"/>
        <StatCard icon="🟡" label="Citas pendientes" value={citasPendientes.length} col="gold"/>
        <StatCard icon="🎁" label="Pedidos activos" value={pedidosActivos.length} col="pink"/>
        <StatCard icon="⭐" label="Puntos canjeados" value={puntosCanjeados} col="gold"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧾 Estado de caja</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            {estadoCobros()} Ingresos válidos: <b style={{color:T.g800}}>{money(ingresos)}</b>.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>📅 Citas y trabajo</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Hay <b style={{color:T.g800}}>{citasRealizadas.length}</b> cita{citasRealizadas.length===1?"":"s"} realizada{citasRealizadas.length===1?"":"s"} y <b style={{color:T.g800}}>{citasPendientes.length}</b> pendiente{citasPendientes.length===1?"":"s"} en el periodo.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🛍️ Tienda y canjes</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Pedidos activos: <b style={{color:T.g800}}>{pedidosActivos.length}</b>. Puntos canjeados: <b style={{color:T.g800}}>{puntosCanjeados}</b>.
          </div>
        </Card>
      </div>

      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>💡 Cómo usar esta zona</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
          Usa <b>Caja</b> para registrar o revisar cobros concretos. Usa <b>Estadísticas</b> para ver gráficas generales de negocio, comunidad, tienda y juegos. Este resumen sirve como panel rápido de facturación.
        </div>
      </Card>
    </>}
  </div>;
}



function GestionComunidadPanel({user,showToast,unread}){
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({reportes:[],mensajes:[],temas:[],respuestas:[],posts:[],musica:[],settings:{}});

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const [reportes,mensajes,temas,respuestas,posts,musica,settingsRows]=await Promise.all([
      safeList("reportes_comunidad","?order=created_at.desc&limit=500&select=*"),
      safeList("mensajes_privados","?order=created_at.desc&limit=500&select=*"),
      safeList("foro_temas","?order=created_at.desc&limit=500&select=*"),
      safeList("foro_respuestas","?order=created_at.desc&limit=500&select=*"),
      safeList("publicaciones","?order=created_at.desc&limit=500&select=*"),
      safeList("musica_items","?order=created_at.desc&limit=500&select=*"),
      safeList("app_settings","?setting_key=in.(secciones,comunidad)&select=*")
    ]);

    const settings={};
    settingsRows.forEach(r=>{settings[r.setting_key]=r.setting_value||{};});
    setData({reportes,mensajes,temas,respuestas,posts,musica,settings});
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  const reportesPendientes=data.reportes.filter(r=>String(r.estado||"pendiente").toLowerCase()==="pendiente");
  const mensajesClienteNoLeidos=data.mensajes.filter(m=>String(m.autor_rol||"client")==="client"&&!m.leido_admin);
  const temasAbiertos=data.temas.filter(t=>t.cerrado!==true);
  const temasCerrados=data.temas.filter(t=>t.cerrado===true);
  const postsTablon=data.posts.filter(p=>String(p.tipo||"")!=="foro");
  const musicaActiva=data.musica.filter(m=>m.activo!==false);
  const foroActivo=data.settings?.secciones?.foro_activo!==false;
  const noticiasActivas=data.settings?.secciones?.noticias_activas!==false;
  const musicaActivaCfg=data.settings?.secciones?.musica_activa!==false;

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#263F4D 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🌐</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Resumen de comunidad</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Control rápido de reportes, mensajes, foro, tablón, actualidad y música.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
        <StatCard icon="🚩" label="Reportes pendientes" value={reportesPendientes.length} col={reportesPendientes.length?"red":"green"}/>
        <StatCard icon="📩" label="Mensajes sin leer" value={mensajesClienteNoLeidos.length||unread?.admin||0} col="gold"/>
        <StatCard icon="🗣️" label="Temas abiertos" value={temasAbiertos.length} col="blue"/>
        <StatCard icon="💬" label="Respuestas foro" value={data.respuestas.length} col="green"/>
        <StatCard icon="📌" label="Publicaciones" value={postsTablon.length} col="pink"/>
        <StatCard icon="🎧" label="Música activa" value={musicaActiva.length} col="gold"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <Card style={{background:reportesPendientes.length?"linear-gradient(180deg,#FFE7DE,#F0C3B3)":"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🛡️ Moderación</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            {reportesPendientes.length?`Hay ${reportesPendientes.length} reporte${reportesPendientes.length===1?"":"s"} pendiente${reportesPendientes.length===1?"":"s"} de revisar.`:"No hay reportes pendientes."}
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>📩 Mensajes privados</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Mensajes de clientes sin leer: <b style={{color:T.g800}}>{mensajesClienteNoLeidos.length||unread?.admin||0}</b>.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🗣️ Foro y actividad</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Foro: <b style={{color:T.g800}}>{foroActivo?"activo":"pausado"}</b>. Temas abiertos: <b style={{color:T.g800}}>{temasAbiertos.length}</b>. Cerrados: <b style={{color:T.g800}}>{temasCerrados.length}</b>.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🎧 Música y actualidad</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Música: <b style={{color:T.g800}}>{musicaActivaCfg?"activa":"pausada"}</b>. Actualidad: <b style={{color:T.g800}}>{noticiasActivas?"activa":"pausada"}</b>.
          </div>
        </Card>
      </div>

      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧭 Cómo usar esta zona</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
          Usa <b>Moderación</b> para revisar reportes. Usa <b>Mensajes</b> para contestar clientes. Usa <b>Música</b> para editar artistas y enlaces. Usa <b>Ajustes</b> para activar o pausar foro, actualidad y música.
        </div>
      </Card>
    </>}
  </div>;
}

function GestionComunidadAjustes({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [settings,setSettings]=useState({
    secciones:{foro_activo:true,noticias_activas:true,musica_activa:true},
    comunidad:{mensajes_activos:true,reportes_activos:true,solo_staff_publica_tablon:true,mensaje_comunidad:"Participa con respeto y usa la comunidad para aportar."}
  });

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const rows=await safeList("app_settings","?setting_key=in.(secciones,comunidad)&select=*");
    const next={
      secciones:{foro_activo:true,noticias_activas:true,musica_activa:true},
      comunidad:{mensajes_activos:true,reportes_activos:true,solo_staff_publica_tablon:true,mensaje_comunidad:"Participa con respeto y usa la comunidad para aportar."}
    };
    rows.forEach(r=>{
      if(r.setting_key==="secciones") next.secciones={...next.secciones,...(r.setting_value||{})};
      if(r.setting_key==="comunidad") next.comunidad={...next.comunidad,...(r.setting_value||{})};
    });
    setSettings(next);
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  function setSection(field,value){
    setSettings(prev=>({...prev,secciones:{...prev.secciones,[field]:value}}));
  }
  function setComunidad(field,value){
    setSettings(prev=>({...prev,comunidad:{...prev.comunidad,[field]:value}}));
  }

  async function saveSetting(key,value,categoria){
    const payload={
      setting_key:key,
      setting_value:value,
      descripcion:key==="comunidad"?"Configuración de comunidad":"Activación de secciones",
      categoria,
      editable:true,
      updated_at:new Date().toISOString()
    };
    let ok=await dbPatch("app_settings",`?setting_key=eq.${key}`,payload);
    if(!ok) ok=await dbPost("app_settings",payload);
    return ok;
  }

  async function save(){
    if(!isAdmin){showToast?.("Sólo admin puede guardar ajustes de comunidad");SFX.error();return;}
    setSaving(true);
    const ok1=await saveSetting("secciones",settings.secciones,"secciones");
    const ok2=await saveSetting("comunidad",settings.comunidad,"comunidad");
    setSaving(false);
    if(ok1&&ok2){showToast?.("Ajustes de comunidad guardados");SFX.success();await load();}
    else{showToast?.("No se pudieron guardar los ajustes");SFX.error();}
  }

  function Toggle({label,sub,value,onChange}){
    return <button onClick={()=>isAdmin&&onChange(!value)} style={{textAlign:"left",border:`2px solid ${value?T.gold:T.g300}`,background:value?"linear-gradient(180deg,#FFF4D6,#F4D58D)":"rgba(255,244,214,.78)",borderRadius:16,padding:"12px",cursor:isAdmin?"pointer":"not-allowed",opacity:isAdmin?1:.65}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>{label}</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{sub}</div>
        </div>
        <Badge col={value?"green":"red"}>{value?"ON":"OFF"}</Badge>
      </div>
    </button>;
  }

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#263F4D 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>⚙️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Ajustes de comunidad</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Activa, pausa o configura foro, mensajes, actualidad, música y normas básicas.
          </div>
        </div>
        <Badge col={isAdmin?"gold":"blue"}>{isAdmin?"ADMIN":"STAFF"}</Badge>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🌐 Secciones públicas</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
          <Toggle label="Foro activo" sub="Permite abrir temas y responder." value={settings.secciones.foro_activo!==false} onChange={v=>setSection("foro_activo",v)}/>
          <Toggle label="Actualidad activa" sub="Muestra la zona de noticias/actualidad." value={settings.secciones.noticias_activas!==false} onChange={v=>setSection("noticias_activas",v)}/>
          <Toggle label="Música activa" sub="Muestra la biblioteca musical." value={settings.secciones.musica_activa!==false} onChange={v=>setSection("musica_activa",v)}/>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🛡️ Reglas internas</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10,marginBottom:12}}>
          <Toggle label="Mensajes activos" sub="Permite usar el buzón privado." value={settings.comunidad.mensajes_activos!==false} onChange={v=>setComunidad("mensajes_activos",v)}/>
          <Toggle label="Reportes activos" sub="Permite reportar temas, respuestas o contenido." value={settings.comunidad.reportes_activos!==false} onChange={v=>setComunidad("reportes_activos",v)}/>
          <Toggle label="Tablón sólo staff" sub="Sólo admin/staff pueden publicar anuncios." value={settings.comunidad.solo_staff_publica_tablon!==false} onChange={v=>setComunidad("solo_staff_publica_tablon",v)}/>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>Mensaje visible de comunidad</div>
          <textarea value={settings.comunidad.mensaje_comunidad||""} onChange={e=>setComunidad("mensaje_comunidad",e.target.value)} style={{width:"100%",minHeight:90,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}/>
        </div>
        <Btn col="gold" onClick={save} disabled={!isAdmin||saving}>{saving?"Guardando...":"Guardar ajustes de comunidad"}</Btn>
        {!isAdmin&&<div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:8}}>El staff puede revisar esta pantalla, pero sólo admin puede guardar ajustes.</div>}
      </Card>
    </>}
  </div>;
}

function GestionTiendaPanel({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({items:[],pedidos:[],stock:[],canjes:[],settings:{}});

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const [items,pedidos,stock,canjes,settingsRows]=await Promise.all([
      safeList("tienda_items","?order=created_at.desc&limit=500&select=*"),
      safeList("tienda_pedidos","?order=created_at.desc&limit=500&select=*"),
      safeList("inventario","?order=nombre.asc&limit=500&select=*"),
      safeList("canjes","?order=created_at.desc&limit=500&select=*"),
      safeList("app_settings","?setting_key=in.(tienda,secciones,puntos)&select=*")
    ]);

    const settings={};
    settingsRows.forEach(r=>{settings[r.setting_key]=r.setting_value||{};});
    setData({items,pedidos,stock,canjes,settings});
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  const itemsActivos=data.items.filter(i=>i.activo!==false).length;
  const premiosActivos=data.items.filter(i=>i.activo!==false&&String(i.tipo||"canje")==="canje").length;
  const pedidosPendientes=data.pedidos.filter(p=>["pendiente","preparando","listo"].includes(String(p.estado||"pendiente").toLowerCase()));
  const pedidosListos=data.pedidos.filter(p=>String(p.estado||"").toLowerCase()==="listo");
  const entregados=data.pedidos.filter(p=>String(p.estado||"").toLowerCase()==="entregado");
  const stockBajo=data.stock.filter(i=>Number(i.stock||0)<=Number(i.stock_min||0));
  const puntosCanjeados=data.pedidos.reduce((sum,p)=>sum+(Number(p.puntos_coste)||0),0)+data.canjes.reduce((sum,c)=>sum+(Number(c.puntos)||Number(c.puntos_coste)||0),0);
  const tiendaActiva=data.settings?.secciones?.tienda_activa!==false;
  const canjesActivos=data.settings?.tienda?.canjes_activos!==false;

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#3A2414 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🛍️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Resumen de tienda</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Control rápido de premios, pedidos, canjes, stock bajo y actividad de la tienda de puntos.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
        <StatCard icon="🛍️" label="Tienda" value={tiendaActiva?"Activa":"Pausada"} col={tiendaActiva?"green":"red"}/>
        <StatCard icon="🎁" label="Premios activos" value={premiosActivos} col="gold"/>
        <StatCard icon="📋" label="Pedidos activos" value={pedidosPendientes.length} col="pink"/>
        <StatCard icon="✅" label="Entregados" value={entregados.length} col="green"/>
        <StatCard icon="📦" label="Stock bajo" value={stockBajo.length} col={stockBajo.length?"red":"green"}/>
        <StatCard icon="⭐" label="Puntos canjeados" value={puntosCanjeados} col="gold"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🎁 Premios y canjes</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Hay <b style={{color:T.g800}}>{itemsActivos}</b> objeto{itemsActivos===1?"":"s"} activo{itemsActivos===1?"":"s"} y <b style={{color:T.g800}}>{premiosActivos}</b> premio{premiosActivos===1?"":"s"} de canje. Canjes: <b style={{color:T.g800}}>{canjesActivos?"permitidos":"pausados"}</b>.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>📋 Pedidos</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Pendientes/preparando/listos: <b style={{color:T.g800}}>{pedidosPendientes.length}</b>. Listos para entregar: <b style={{color:T.g800}}>{pedidosListos.length}</b>.
          </div>
        </Card>
        <Card style={{background:stockBajo.length?"linear-gradient(180deg,#FFE7DE,#F0C3B3)":"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>📦 Stock</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            {stockBajo.length?`Hay ${stockBajo.length} producto${stockBajo.length===1?"":"s"} por debajo del mínimo.`:"No hay productos por debajo del mínimo."}
          </div>
          {stockBajo.slice(0,5).map(i=><div key={i.id} style={{marginTop:7,fontSize:".78rem",fontWeight:850,color:T.red}}>⚠️ {i.nombre}: {i.stock}/{i.stock_min}</div>)}
        </Card>
      </div>

      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧭 Cómo usar esta zona</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
          Usa <b>Premios</b> para crear o editar objetos canjeables. Usa <b>Stock</b> para inventario interno. Usa <b>Pedidos</b> para preparar entregas. Usa <b>Ajustes</b> para activar o pausar la tienda.
        </div>
      </Card>
    </>}
  </div>;
}

function GestionTiendaAjustes({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [settings,setSettings]=useState({
    secciones:{tienda_activa:true},
    tienda:{canjes_activos:true,puntos_minimos_canje:0,mensaje_tienda:"Canjea tus puntos por recompensas de Rasta Cuts."}
  });

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const rows=await safeList("app_settings","?setting_key=in.(secciones,tienda)&select=*");
    const next={
      secciones:{tienda_activa:true},
      tienda:{canjes_activos:true,puntos_minimos_canje:0,mensaje_tienda:"Canjea tus puntos por recompensas de Rasta Cuts."}
    };
    rows.forEach(r=>{
      if(r.setting_key==="secciones") next.secciones={...next.secciones,...(r.setting_value||{})};
      if(r.setting_key==="tienda") next.tienda={...next.tienda,...(r.setting_value||{})};
    });
    setSettings(next);
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  function setSection(field,value){
    setSettings(prev=>({...prev,secciones:{...prev.secciones,[field]:value}}));
  }
  function setTienda(field,value){
    setSettings(prev=>({...prev,tienda:{...prev.tienda,[field]:value}}));
  }

  async function saveSetting(key,value,categoria){
    const payload={
      setting_key:key,
      setting_value:value,
      descripcion:key==="tienda"?"Configuración de tienda y canjes":"Activación de secciones",
      categoria,
      editable:true,
      updated_at:new Date().toISOString()
    };
    let ok=await dbPatch("app_settings",`?setting_key=eq.${key}`,payload);
    if(!ok) ok=await dbPost("app_settings",payload);
    return ok;
  }

  async function save(){
    if(!isAdmin){showToast?.("Sólo admin puede guardar ajustes de tienda");SFX.error();return;}
    setSaving(true);
    const ok1=await saveSetting("secciones",settings.secciones,"secciones");
    const ok2=await saveSetting("tienda",settings.tienda,"tienda");
    setSaving(false);
    if(ok1&&ok2){showToast?.("Ajustes de tienda guardados");SFX.success();await load();}
    else{showToast?.("No se pudieron guardar los ajustes");SFX.error();}
  }

  function Toggle({label,sub,value,onChange}){
    return <button onClick={()=>isAdmin&&onChange(!value)} style={{textAlign:"left",border:`2px solid ${value?T.gold:T.g300}`,background:value?"linear-gradient(180deg,#FFF4D6,#F4D58D)":"rgba(255,244,214,.78)",borderRadius:16,padding:"12px",cursor:isAdmin?"pointer":"not-allowed",opacity:isAdmin?1:.65}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>{label}</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{sub}</div>
        </div>
        <Badge col={value?"green":"red"}>{value?"ON":"OFF"}</Badge>
      </div>
    </button>;
  }

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#3A2414 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>⚙️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Ajustes de tienda</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Activa, pausa o configura las reglas básicas de canjes.
          </div>
        </div>
        <Badge col={isAdmin?"gold":"blue"}>{isAdmin?"ADMIN":"STAFF"}</Badge>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🛍️ Activación</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
          <Toggle label="Tienda activa" sub="Muestra u oculta la tienda para clientes." value={settings.secciones.tienda_activa!==false} onChange={v=>setSection("tienda_activa",v)}/>
          <Toggle label="Canjes activos" sub="Permite o bloquea nuevos canjes de puntos." value={settings.tienda.canjes_activos!==false} onChange={v=>setTienda("canjes_activos",v)}/>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>⭐ Reglas de canje</div>
        <Input label="Puntos mínimos para canjear" type="number" value={String(settings.tienda.puntos_minimos_canje??0)} onChange={v=>setTienda("puntos_minimos_canje",Math.max(0,parseInt(v,10)||0))}/>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>Mensaje visible de tienda</div>
          <textarea value={settings.tienda.mensaje_tienda||""} onChange={e=>setTienda("mensaje_tienda",e.target.value)} style={{width:"100%",minHeight:90,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}/>
        </div>
        <Btn col="gold" onClick={save} disabled={!isAdmin||saving}>{saving?"Guardando...":"Guardar ajustes de tienda"}</Btn>
        {!isAdmin&&<div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:8}}>El staff puede revisar esta pantalla, pero sólo admin puede guardar ajustes.</div>}
      </Card>
    </>}
  </div>;
}

function GestionJuegosAdmin({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [active,setActive]=useState("resumen");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [scores,setScores]=useState([]);
  const [retos,setRetos]=useState([]);
  const [settings,setSettings]=useState({
    secciones:{arcade_activo:true,gacha_activo:true},
    puntos:{limite_diario_juegos:75,gacha_tiradas_dia:50}
  });
  const [newReto,setNewReto]=useState({
    titulo:"Reto semanal arcade",
    descripcion:"Consigue puntos jugando en Arcade durante la semana.",
    tipo:"juegos",
    meta:100,
    puntos_premio:25,
    fecha_fin:new Date(Date.now()+7*86400000).toISOString().split("T")[0],
    activo:true
  });

  const gameList=typeof ARCADE_GAMES!=="undefined"?ARCADE_GAMES:[];
  const gameNames=Object.fromEntries(gameList.map(g=>[g.id,g.title]));

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const [scoresRows,retosRows,settingsRows]=await Promise.all([
      safeList("game_scores","?order=created_at.desc&limit=500&select=*"),
      safeList("retos","?order=created_at.desc&limit=200&select=*"),
      safeList("app_settings","?setting_key=in.(secciones,puntos)&select=*")
    ]);

    const next={
      secciones:{arcade_activo:true,gacha_activo:true},
      puntos:{limite_diario_juegos:75,gacha_tiradas_dia:50}
    };

    settingsRows.forEach(r=>{
      if(r.setting_key==="secciones") next.secciones={...next.secciones,...(r.setting_value||{})};
      if(r.setting_key==="puntos") next.puntos={...next.puntos,...(r.setting_value||{})};
    });

    setScores(scoresRows);
    setRetos(retosRows);
    setSettings(next);
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  function setSectionValue(field,value){
    setSettings(prev=>({...prev,secciones:{...prev.secciones,[field]:value}}));
  }
  function setPointValue(field,value){
    setSettings(prev=>({...prev,puntos:{...prev.puntos,[field]:value}}));
  }

  async function saveSetting(key,value,categoria){
    const payload={
      setting_key:key,
      setting_value:value,
      descripcion:key==="secciones"?"Activación de secciones de juegos":"Límites y recompensas de juegos",
      categoria,
      editable:true,
      updated_at:new Date().toISOString()
    };
    let ok=await dbPatch("app_settings",`?setting_key=eq.${key}`,payload);
    if(!ok) ok=await dbPost("app_settings",payload);
    return ok;
  }

  async function saveGameSettings(){
    if(!isAdmin){showToast?.("Sólo admin puede guardar ajustes de juegos");SFX.error();return;}
    setSaving(true);
    const ok1=await saveSetting("secciones",settings.secciones,"secciones");
    const ok2=await saveSetting("puntos",settings.puntos,"puntos");
    setSaving(false);
    if(ok1&&ok2){showToast?.("Ajustes de juegos guardados");SFX.success();await load();}
    else{showToast?.("No se pudieron guardar los ajustes");SFX.error();}
  }

  async function createReto(){
    if(!isAdmin){showToast?.("Sólo admin puede crear retos");SFX.error();return;}
    const titulo=String(newReto.titulo||"").trim();
    if(!titulo){showToast?.("Pon un título al reto");SFX.error();return;}
    const payload={
      titulo,
      descripcion:String(newReto.descripcion||"").trim(),
      tipo:newReto.tipo||"juegos",
      meta:Math.max(1,parseInt(newReto.meta,10)||1),
      puntos_premio:Math.max(0,parseInt(newReto.puntos_premio,10)||0),
      fecha_fin:newReto.fecha_fin,
      activo:true
    };
    const ok=await dbPost("retos",payload);
    if(ok){showToast?.("Reto creado");SFX.success();await load();}
    else{showToast?.("No se pudo crear el reto");SFX.error();}
  }

  async function toggleReto(reto){
    if(!isAdmin){showToast?.("Sólo admin puede cambiar retos");return;}
    const ok=await dbPatch("retos",`?id=eq.${reto.id}`,{activo:!reto.activo});
    if(ok){showToast?.(reto.activo?"Reto desactivado":"Reto activado");SFX.success();await load();}
    else{showToast?.("No se pudo actualizar el reto");SFX.error();}
  }

  const totalScores=scores.length;
  const totalPoints=scores.reduce((sum,s)=>sum+(Number(s.points)||Number(s.puntos)||Number(s.score)||0),0);
  const bestScore=[...scores].sort((a,b)=>(Number(b.score)||Number(b.points)||0)-(Number(a.score)||Number(a.points)||0))[0];
  const activeRetos=retos.filter(r=>r.activo!==false).length;
  const byGame=Object.entries(scores.reduce((acc,s)=>{
    const id=s.game_id||s.juego||s.game||"desconocido";
    acc[id]=(acc[id]||0)+1;
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]).slice(0,8);

  function Toggle({label,sub,value,onChange,disabled=false}){
    return <button onClick={()=>!disabled&&onChange(!value)} style={{textAlign:"left",border:`2px solid ${value?T.gold:T.g300}`,background:value?"linear-gradient(180deg,#FFF4D6,#F4D58D)":"rgba(255,244,214,.78)",borderRadius:16,padding:"12px",cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>{label}</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{sub}</div>
        </div>
        <Badge col={value?"green":"red"}>{value?"ON":"OFF"}</Badge>
      </div>
    </button>;
  }

  function SmallTab({id,icon,label}){
    return <button onClick={()=>{SFX.tab();setActive(id);}} style={{border:`2px solid ${active===id?T.gold:T.g300}`,background:active===id?T.gradGold:"rgba(255,244,214,.82)",color:active===id?T.g900:T.g700,borderRadius:15,padding:"10px 6px",fontWeight:950,cursor:"pointer",boxShadow:active===id?"0 10px 24px rgba(212,175,55,.22)":"0 5px 12px rgba(20,8,4,.08)"}}>
      <div style={{fontSize:"1.25rem",lineHeight:1}}>{icon}</div>
      <div style={{fontSize:".72rem",marginTop:4}}>{label}</div>
    </button>;
  }

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#2B1A0D 48%,#263F4D)",border:"2px solid rgba(255,244,214,.42)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🎮</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Gestión de juegos</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.82)",lineHeight:1.35}}>
            Control real de Arcade, rankings, retos, límites diarios y actividad de jugadores.
          </div>
        </div>
        <Badge col={isAdmin?"gold":"blue"}>{isAdmin?"ADMIN":"STAFF"}</Badge>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
      <SmallTab id="resumen" icon="📊" label="Resumen"/>
      <SmallTab id="ajustes" icon="⚙️" label="Ajustes"/>
      <SmallTab id="rankings" icon="🏆" label="Rankings"/>
      <SmallTab id="retos" icon="🎯" label="Retos"/>
      <SmallTab id="actividad" icon="🕹️" label="Actividad"/>
    </div>

    {loading?<Spinner/>:<>
      {active==="resumen"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
          <StatCard icon="🕹️" label="Partidas registradas" value={totalScores} col="blue"/>
          <StatCard icon="⭐" label="Puntos de juego" value={totalPoints} col="gold"/>
          <StatCard icon="🎯" label="Retos activos" value={activeRetos} col="green"/>
          <StatCard icon="🏆" label="Mejor marca" value={bestScore?(Number(bestScore.score)||Number(bestScore.points)||0):0} col="pink"/>
        </div>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🎮 Juegos disponibles</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            {gameList.map(g=><div key={g.id} style={{border:`1px solid ${T.g300}`,borderRadius:15,padding:10,background:"rgba(255,244,214,.70)"}}>
              <div style={{fontSize:"1.5rem"}}>{g.icon}</div>
              <div style={{fontWeight:950,color:T.g800}}>{g.title}</div>
              <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.3}}>{g.desc}</div>
              <div style={{marginTop:6}}><Badge col="gold">+{g.pts||0} pts</Badge></div>
            </div>)}
          </div>
        </Card>
      </>}

      {active==="ajustes"&&<div style={{display:"grid",gap:12}}>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>⚙️ Activación</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
            <Toggle label="Arcade activo" sub="Muestra u oculta la sección Arcade para clientes." value={settings.secciones.arcade_activo!==false} onChange={v=>setSectionValue("arcade_activo",v)} disabled={!isAdmin}/>
            <Toggle label="Gacha activo" sub="Permite o bloquea la máquina de premios." value={settings.secciones.gacha_activo!==false} onChange={v=>setSectionValue("gacha_activo",v)} disabled={!isAdmin}/>
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>⭐ Límites y recompensas</div>
          <Input label="Límite diario de puntos por juegos" type="number" value={String(settings.puntos.limite_diario_juegos??75)} onChange={v=>setPointValue("limite_diario_juegos",Math.max(0,parseInt(v,10)||0))}/>
          <Input label="Tiradas diarias de Gacha" type="number" value={String(settings.puntos.gacha_tiradas_dia??50)} onChange={v=>setPointValue("gacha_tiradas_dia",Math.max(0,parseInt(v,10)||0))}/>
          <Btn col="gold" onClick={saveGameSettings} disabled={!isAdmin||saving}>{saving?"Guardando...":"Guardar ajustes de juegos"}</Btn>
          {!isAdmin&&<div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:8}}>El staff puede revisar esta pantalla, pero sólo admin puede guardar ajustes.</div>}
        </Card>
      </div>}

      {active==="rankings"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🏆 Partidas por juego</div>
        {byGame.length===0?<EmptyState icon="🏆" title="Sin partidas" sub="Todavía no hay puntuaciones registradas."/>:<div style={{display:"grid",gap:9}}>
          {byGame.map(([id,count])=><div key={id}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".82rem",fontWeight:950,color:T.g800,marginBottom:4}}>
              <span>{gameNames[id]||id}</span><span>{count}</span>
            </div>
            <div style={{height:9,borderRadius:999,background:"rgba(75,48,27,.14)",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.max(8,count/Math.max(1,byGame[0]?.[1]||1)*100)}%`,borderRadius:999,background:"linear-gradient(90deg,#263F4D,#B99A45,#8F2E24)"}}/>
            </div>
          </div>)}
        </div>}
      </Card>}

      {active==="retos"&&<div style={{display:"grid",gap:12}}>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🎯 Crear reto</div>
          <Input label="Título" value={newReto.titulo} onChange={v=>setNewReto(r=>({...r,titulo:v}))}/>
          <Input label="Descripción" value={newReto.descripcion} onChange={v=>setNewReto(r=>({...r,descripcion:v}))}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
            <Input label="Meta" type="number" value={String(newReto.meta)} onChange={v=>setNewReto(r=>({...r,meta:v}))}/>
            <Input label="Premio en puntos" type="number" value={String(newReto.puntos_premio)} onChange={v=>setNewReto(r=>({...r,puntos_premio:v}))}/>
            <Input label="Fecha fin" type="date" value={newReto.fecha_fin} onChange={v=>setNewReto(r=>({...r,fecha_fin:v}))}/>
          </div>
          <Btn col="gold" onClick={createReto} disabled={!isAdmin}>Crear reto</Btn>
        </Card>

        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>📋 Retos existentes</div>
          {retos.length===0?<EmptyState icon="🎯" title="Sin retos" sub="Aún no hay retos creados."/>:retos.slice(0,20).map(r=><div key={r.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.g200}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:950,color:T.g800}}>{r.titulo}</div>
                <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{r.descripcion}</div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:6}}>
                  <Badge col="blue">Meta {r.meta}</Badge><Badge col="gold">+{r.puntos_premio} pts</Badge><Badge col={r.activo!==false?"green":"red"}>{r.activo!==false?"Activo":"Inactivo"}</Badge>
                </div>
              </div>
              <Btn small col={r.activo!==false?"red":"green"} onClick={()=>toggleReto(r)} disabled={!isAdmin}>{r.activo!==false?"Desactivar":"Activar"}</Btn>
            </div>
          </div>)}
        </Card>
      </div>}

      {active==="actividad"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🕹️ Últimas partidas</div>
        {scores.length===0?<EmptyState icon="🕹️" title="Sin actividad" sub="Aún no hay partidas registradas."/>:scores.slice(0,30).map((s,idx)=><div key={s.id||idx} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.g200}`}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{gameNames[s.game_id||s.juego||s.game]||s.game_id||s.juego||"Juego"}</div>
            <div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>{s.usuario_nombre||s.nombre||s.usuario_id||"Usuario"} · {String(s.created_at||"").slice(0,16).replace("T"," ")}</div>
          </div>
          <Badge col="gold">{Number(s.score)||Number(s.points)||Number(s.puntos)||0}</Badge>
        </div>)}
      </Card>}
    </>}
  </div>;
}


function GestionAdminPanel({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({usuarios:[],auditoria:[],settings:[]});

  async function safeList(table,query){
    try{
      const rows=await dbGet(table,query);
      return Array.isArray(rows)?rows:[];
    }catch(e){return [];}
  }

  async function load(){
    setLoading(true);
    const [usuarios,auditoria,settings]=await Promise.all([
      safeList("usuarios","?order=created_at.desc&limit=5000&select=*"),
      safeList("seguridad_auditoria","?order=created_at.desc&limit=300&select=*"),
      safeList("app_settings","?order=categoria.asc,setting_key.asc&limit=300&select=*")
    ]);
    setData({usuarios,auditoria,settings});
    setLoading(false);
  }

  useEffect(()=>{if(isAdmin)load(); else setLoading(false);},[isAdmin]);

  if(!isAdmin)return <EmptyState icon="🔒" title="Sólo admin" sub="El resumen administrativo sólo debería verlo el administrador."/>;
  const countRole=r=>data.usuarios.filter(u=>normalizeRole(u.role||u.rol)===r).length;
  const baneados=data.usuarios.filter(u=>isBannedProfile(u));
  const ultimos7=data.auditoria.filter(r=>{
    const d=new Date(r.created_at||0);
    const now=new Date();
    return (now-d)/(1000*60*60*24)<=7;
  });
  const cambiosRol=data.auditoria.filter(r=>String(r.tipo||"")==="cambio_rol");
  const ajustesEditables=data.settings.filter(s=>s.editable!==false).length;

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#24110A 52%,#A72822)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🔐</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Panel admin</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Vista rápida de usuarios, roles, bloqueos, auditoría y ajustes globales.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
        <StatCard icon="👥" label="Usuarios web" value={data.usuarios.length} col="blue"/>
        <StatCard icon="👑" label="Admin" value={countRole(ROLES.ADMIN)} col="gold"/>
        <StatCard icon="💈" label="Staff" value={countRole(ROLES.STAFF)} col="green"/>
        <StatCard icon="🙂" label="Clientes web" value={countRole(ROLES.CLIENT)} col="blue"/>
        <StatCard icon="🚫" label="Bloqueados" value={baneados.length} col={baneados.length?"red":"green"}/>
        <StatCard icon="🧾" label="Auditoría 7 días" value={ultimos7.length} col="gold"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <Card style={{background:baneados.length?"linear-gradient(180deg,#FFE7DE,#F0C3B3)":"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🚫 Bloqueos</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            {baneados.length?`Hay ${baneados.length} usuario${baneados.length===1?"":"s"} bloqueado${baneados.length===1?"":"s"}.`:"No hay usuarios bloqueados."}
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>👑 Roles</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Cambios de rol registrados: <b style={{color:T.g800}}>{cambiosRol.length}</b>. Revisa los cambios delicados desde Seguridad.
          </div>
        </Card>
        <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>⚙️ Ajustes</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Ajustes registrados: <b style={{color:T.g800}}>{data.settings.length}</b>. Editables: <b style={{color:T.g800}}>{ajustesEditables}</b>.
          </div>
        </Card>
      </div>

      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧭 Orden recomendado</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
          Usa <b>Usuarios</b> para buscar cuentas. Usa <b>Roles</b> para revisar permisos. Usa <b>Bloqueos</b> para ver cuentas baneadas. Usa <b>Seguridad</b> para auditoría y <b>Ajustes</b> para configuración global.
        </div>
      </Card>
    </>}
  </div>;
}

function GestionRolesPermisos({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const rows=await dbGet("usuarios","?order=created_at.desc&limit=5000&select=*");
    setUsers(Array.isArray(rows)?rows:[]);
    setLoading(false);
  }

  useEffect(()=>{if(isAdmin)load(); else setLoading(false);},[isAdmin]);

  if(!isAdmin)return <EmptyState icon="🔒" title="Sólo admin" sub="Sólo admin puede revisar roles y permisos."/>;
  const roleUsers=r=>users.filter(u=>normalizeRole(u.role||u.rol)===r);
  const matrix=[
    {zona:"Gestión",admin:"Completo",staff:"Limitado",client:"No"},
    {zona:"Usuarios y roles",admin:"Sí",staff:"No",client:"No"},
    {zona:"Baneos",admin:"Sí",staff:"No",client:"No"},
    {zona:"Citas",admin:"Sí",staff:"Sí",client:"Propias"},
    {zona:"Caja",admin:"Sí",staff:"Sí",client:"No"},
    {zona:"Tienda premios",admin:"Sí",staff:"Pedidos/stock",client:"Canjear"},
    {zona:"Comunidad",admin:"Completo",staff:"Moderar/mensajes",client:"Participar"},
    {zona:"Juegos",admin:"Ajustes",staff:"Consulta",client:"Jugar"},
    {zona:"Ajustes globales",admin:"Sí",staff:"No",client:"No"}
  ];

  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#24110A 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>👑</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Roles y permisos</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Revisión clara de lo que puede hacer admin, staff y cliente.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    {loading?<Spinner/>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
        <StatCard icon="👑" label="Admins" value={roleUsers(ROLES.ADMIN).length} col="gold"/>
        <StatCard icon="💈" label="Staff" value={roleUsers(ROLES.STAFF).length} col="green"/>
        <StatCard icon="🙂" label="Clientes" value={roleUsers(ROLES.CLIENT).length} col="blue"/>
      </div>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",overflowX:"auto"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>🧩 Matriz de permisos</div>
        <div style={{minWidth:560}}>
          <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr",gap:6,fontSize:".76rem",fontWeight:950,color:T.g800,marginBottom:6}}>
            <div>Zona</div><div>Admin</div><div>Staff</div><div>Cliente</div>
          </div>
          {matrix.map(row=><div key={row.zona} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr",gap:6,padding:"8px 0",borderTop:`1px solid ${T.g200}`,fontSize:".78rem",fontWeight:850,color:T.textSub}}>
            <div style={{color:T.g800,fontWeight:950}}>{row.zona}</div><div>{row.admin}</div><div>{row.staff}</div><div>{row.client}</div>
          </div>)}
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>✍️ Cambiar roles</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
          Para cambiar el rol de una cuenta usa <b>Admin &gt; Usuarios</b>. Esta pantalla es para revisar permisos y evitar confusiones.
        </div>
      </Card>
    </>}
  </div>;
}

function GestionBaneos({user,showToast}){
  const isAdmin=isAdminUser(user);
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const rows=await dbGet("usuarios","?order=created_at.desc&limit=5000&select=*");
    setUsers(Array.isArray(rows)?rows:[]);
    setLoading(false);
  }

  useEffect(()=>{if(isAdmin)load(); else setLoading(false);},[isAdmin]);

  async function unban(u){
    if(!isAdmin)return;
    const ok=await dbPatch("usuarios",`?id=eq.${u.id}`,{baneado:false,motivo_baneo:null,baneado_por:null,baneado_at:null,baneo_hasta:null});
    if(ok){showToast?.("Usuario desbloqueado");SFX.success();await load();}
    else{showToast?.("No se pudo desbloquear");SFX.error();}
  }

  if(!isAdmin)return <EmptyState icon="🔒" title="Sólo admin" sub="Sólo admin puede revisar bloqueos."/>;
  const banned=users.filter(u=>isBannedProfile(u));
  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#42130F 52%,#A72822)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🚫</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Baneos y bloqueos</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Lista de cuentas bloqueadas y desbloqueo rápido.
          </div>
        </div>
        <Btn small col="ghost" onClick={load}>Actualizar</Btn>
      </div>
    </Card>

    {loading?<Spinner/>:banned.length===0?<EmptyState icon="✅" title="Sin usuarios bloqueados" sub="No hay cuentas bloqueadas ahora mismo."/>:
      banned.map(u=><Card key={u.id} style={{background:"linear-gradient(180deg,#FFE7DE,#F0C3B3)",border:`2px solid ${T.red}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.nombre||"Usuario"} · {u.email||"sin email"}</div>
            <div style={{fontSize:".78rem",fontWeight:820,color:T.textSub,lineHeight:1.4,marginTop:5}}>Motivo: {u.motivo_baneo||"Sin motivo registrado"}</div>
            <div style={{fontSize:".72rem",fontWeight:820,color:T.textSub,marginTop:5}}>Desde: {u.baneado_at?new Date(u.baneado_at).toLocaleString("es-ES"):"sin fecha"}{u.baneo_hasta?` · Hasta: ${new Date(u.baneo_hasta).toLocaleDateString("es-ES")}`:""}</div>
          </div>
          <Btn small col="green" onClick={()=>unban(u)}>Desbloquear</Btn>
        </div>
      </Card>)
    }
  </div>;
}



function GestionSeguridadSupabase({user,showToast}){
  const isAdmin=isAdminUser(user);
  const STORAGE_KEY="rasta_cuts_supabase_rls_plan_v1";
  const blocks=[
    {
      id:"usuarios",icon:"👥",title:"Usuarios y roles",risk:"Muy alto",desc:"Base de toda la seguridad. Hay que cerrar lectura/escritura de perfiles, roles y baneos.",
      tables:["usuarios","seguridad_auditoria"],
      items:[
        "Cliente sólo puede leer su propio perfil completo",
        "Cliente sólo puede editar datos seguros de su perfil",
        "Cliente nunca puede cambiar su rol",
        "Staff puede leer usuarios necesarios para gestión, pero no cambiar roles",
        "Admin puede cambiar roles y bloqueos",
        "Todo cambio de rol o baneo queda en auditoría"
      ]
    },
    {
      id:"citas",icon:"📅",title:"Citas y clientes de tienda",risk:"Alto",desc:"Separar clientes de tienda/citas de usuarios web para no mezclar privacidad.",
      tables:["clientes","citas"],
      items:[
        "Cliente web sólo puede ver sus propias citas",
        "Staff/admin pueden ver agenda y citas de trabajo",
        "Citas privadas no se exponen a otros usuarios",
        "Cambios de estado quedan controlados",
        "Datos personales mínimos visibles"
      ]
    },
    {
      id:"tienda",icon:"🛍️",title:"Tienda, stock y pedidos",risk:"Alto",desc:"Evitar que un cliente modifique premios, puntos, pedidos o stock desde fuera.",
      tables:["tienda_items","tienda_pedidos","inventario","canjes"],
      items:[
        "Cliente puede ver premios activos",
        "Cliente sólo puede ver sus propios pedidos/canjes",
        "Cliente no puede editar stock ni premios",
        "Staff puede gestionar pedidos y stock",
        "Sólo admin edita premios, costes y ajustes de tienda"
      ]
    },
    {
      id:"comunidad",icon:"🌐",title:"Comunidad y mensajes",risk:"Alto",desc:"Controlar foro, mensajes privados, reportes y tablón para que nadie lea lo que no debe.",
      tables:["foro_temas","foro_respuestas","mensajes_privados","reportes_comunidad","publicaciones"],
      items:[
        "Temas públicos legibles según sección activa",
        "Mensajes privados sólo visibles por emisor/receptor y admin/staff autorizado",
        "Reportes sólo visibles por staff/admin",
        "Usuarios baneados no pueden publicar",
        "Staff/admin pueden moderar contenido"
      ]
    },
    {
      id:"ajustes",icon:"⚙️",title:"Ajustes y configuración",risk:"Muy alto",desc:"Los ajustes activan o apagan secciones; sólo admin debería cambiarlos.",
      tables:["app_settings","musica_items"],
      items:[
        "Ajustes globales sólo editables por admin",
        "Lectura pública sólo de ajustes seguros",
        "Música editable sólo por admin",
        "No exponer claves ni datos sensibles",
        "Registrar cambios importantes"
      ]
    }
  ];

  const flat=blocks.flatMap(b=>b.items.map((_,i)=>`${b.id}_${i}`));
  const [checked,setChecked]=useState(()=> {
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}
    catch(e){return {};}
  });
  const done=flat.filter(k=>checked[k]).length;
  const total=flat.length;
  const pct=total?Math.round(done/total*100):0;

  function toggle(key){
    const next={...checked,[key]:!checked[key]};
    setChecked(next);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch(e){}
    SFX.tab();
  }
  function reset(){
    setChecked({});
    try{localStorage.removeItem(STORAGE_KEY);}catch(e){}
    showToast?.("Plan Supabase reiniciado");
  }

  if(!isAdmin)return <EmptyState icon="🔒" title="Sólo admin" sub="La preparación de seguridad sólo debería verla el administrador."/>;
  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#24110A 52%,#263F4D)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>🧱</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Preparación Supabase / RLS</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Hoja de ruta para cerrar seguridad real en base de datos sin romper login, roles ni Gestión.
          </div>
        </div>
        <Badge col={pct===100?"green":"gold"}>{pct}%</Badge>
      </div>
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>Estado antes de tocar RLS</div>
          <div style={{fontSize:".8rem",fontWeight:820,color:T.textSub}}>{done} de {total} puntos preparados</div>
        </div>
        <Btn small col="ghost" onClick={reset}>Reiniciar</Btn>
      </div>
      <div style={{height:12,borderRadius:999,background:"rgba(75,48,27,.14)",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,borderRadius:999,background:"linear-gradient(90deg,#263F4D,#B99A45,#2F6B42)",transition:"width .25s ease"}}/>
      </div>
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFE7DE,#F0C3B3)",border:`2px solid ${T.red}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:6}}>⚠️ Regla antes de empezar</div>
      <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
        No activaremos políticas RLS de golpe. Primero se hará copia de seguridad mental del estado, luego <b>usuarios/roles</b>, después <b>citas</b>, luego <b>tienda</b>, después <b>comunidad</b> y al final <b>ajustes/auditoría</b>.
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
      {blocks.map(b=>{
        const blockDone=b.items.filter((_,i)=>checked[`${b.id}_${i}`]).length;
        return <Card key={b.id} style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.g300}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
            <div style={{fontSize:"1.75rem"}}>{b.icon}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                <div style={{fontWeight:950,color:T.g800}}>{b.title}</div>
                <Badge col={b.risk==="Muy alto"?"red":"gold"}>{b.risk}</Badge>
              </div>
              <div style={{fontSize:".75rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:4}}>{b.desc}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>
                {b.tables.map(t=><Badge key={t} col="blue">{t}</Badge>)}
              </div>
              <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,marginTop:7}}>{blockDone}/{b.items.length} preparado</div>
            </div>
          </div>
          <div style={{display:"grid",gap:8}}>
            {b.items.map((text,i)=>{
              const key=`${b.id}_${i}`;
              const on=!!checked[key];
              return <button key={key} onClick={()=>toggle(key)} style={{textAlign:"left",display:"flex",gap:9,alignItems:"flex-start",border:`1.5px solid ${on?T.gold:T.g300}`,background:on?"linear-gradient(180deg,#E8D3A2,#D8BE87)":"rgba(255,244,214,.72)",borderRadius:13,padding:"9px 10px",cursor:"pointer",fontWeight:850,color:on?T.g800:T.textSub,lineHeight:1.28}}>
                <span style={{fontSize:"1rem",lineHeight:1.1}}>{on?"✅":"⬜"}</span>
                <span style={{fontSize:".82rem"}}>{text}</span>
              </button>;
            })}
          </div>
        </Card>;
      })}
    </div>

    <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Orden técnico recomendado</div>
      <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
        Primero se comprueba que el rol real vive en <b>usuarios</b>. Luego se crean políticas de lectura/escritura por tabla. Después se prueba con tres cuentas: admin, staff y cliente. Si algo falla, se revierte sólo esa tabla, no toda la app.
      </div>
    </Card>
  </div>;
}

function GestionChecklist({user,showToast}){
  const isAdmin=isAdminUser(user);
  const STORAGE_KEY="rasta_cuts_checklist_gestion_v1";
  const groups=[
    {
      id:"principal",icon:"🏠",title:"Principal",items:[
        "Resumen carga sin pantalla en blanco",
        "Agenda abre correctamente",
        "Citas permite revisar pendientes/confirmadas",
        "Clientes muestra clientes de tienda, no usuarios web mezclados"
      ]
    },
    {
      id:"facturacion",icon:"💰",title:"Facturación",items:[
        "Resumen de facturación carga bien",
        "Caja permite revisar cobros",
        "Estadísticas cargan sin romper la vista",
        "No aparece dinero mezclado en Principal"
      ]
    },
    {
      id:"tienda",icon:"🛍️",title:"Tienda",items:[
        "Resumen muestra pedidos, premios y stock bajo",
        "Premios abre sólo para admin",
        "Stock permite sumar/restar unidades",
        "Pedidos permite cambiar estados",
        "Ajustes permite activar/desactivar tienda y canjes"
      ]
    },
    {
      id:"juegos",icon:"🎮",title:"Juegos",items:[
        "Resumen muestra partidas y juegos disponibles",
        "Ajustes tiene Arcade/Gacha y límites",
        "Rankings carga sin quedarse vacío por error",
        "Retos permite crear y activar/desactivar",
        "Actividad muestra partidas recientes"
      ]
    },
    {
      id:"comunidad",icon:"🌐",title:"Comunidad",items:[
        "Resumen carga sin pantalla en blanco",
        "Moderación abre reportes",
        "Mensajes abre buzón interno",
        "Música sólo editable por admin",
        "Ajustes permite activar foro, actualidad, música, mensajes y reportes"
      ]
    },
    {
      id:"admin",icon:"🔐",title:"Admin",items:[
        "Resumen admin carga datos",
        "Usuarios permite buscar y cambiar roles",
        "Roles muestra matriz de permisos clara",
        "Baneos muestra bloqueados y desbloqueo rápido",
        "Auditoría carga registros",
        "Ajustes globales siguen funcionando"
      ]
    },
    {
      id:"roles",icon:"🧪",title:"Pruebas por rol",items:[
        "Admin ve todas las secciones de Gestión",
        "Staff no ve Admin ni ajustes delicados",
        "Staff sí ve agenda, citas, caja, stock, pedidos, comunidad y juegos",
        "Cliente no puede entrar en Gestión",
        "Modo incógnito sólo oculta a usuarios normales, no a admin/staff"
      ]
    },
    {
      id:"movil",icon:"📱",title:"Móvil / Android",items:[
        "Botones grandes y tocables",
        "No hay modales tapados por el menú inferior",
        "Los formularios se pueden rellenar sin zoom raro",
        "Las tarjetas no se salen de pantalla",
        "El scroll llega hasta el final de cada pantalla"
      ]
    }
  ];
  const flat=groups.flatMap(g=>g.items.map((text,i)=>`${g.id}_${i}`));
  const [checked,setChecked]=useState(()=> {
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}
    catch(e){return {};}
  });
  const done=flat.filter(k=>checked[k]).length;
  const total=flat.length;
  const pct=total?Math.round(done/total*100):0;

  function toggle(key){
    const next={...checked,[key]:!checked[key]};
    setChecked(next);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch(e){}
    SFX.tab();
  }
  function reset(){
    setChecked({});
    try{localStorage.removeItem(STORAGE_KEY);}catch(e){}
    showToast?.("Checklist reiniciado");
  }

  if(!isAdmin)return <EmptyState icon="🔒" title="Sólo admin" sub="El checklist final de gestión sólo debería verlo el administrador."/>;
  return <div style={{display:"grid",gap:14,animation:"fadeSlide .34s ease"}}>
    <Card style={{background:"linear-gradient(145deg,#120806,#24110A 52%,#B99A45)",border:"2px solid rgba(255,244,214,.48)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div className="icon3d" style={{fontSize:"2.35rem"}}>✅</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.65rem",lineHeight:1}}>Checklist de Gestión</div>
          <div style={{fontSize:".85rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35}}>
            Revisión final antes de tocar seguridad real en Supabase. Marca cada prueba cuando la compruebes en la web.
          </div>
        </div>
        <Badge col={pct===100?"green":"gold"}>{pct}%</Badge>
      </div>
    </Card>

    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}>
        <div>
          <div style={{fontWeight:950,color:T.g800}}>Progreso de revisión</div>
          <div style={{fontSize:".8rem",fontWeight:820,color:T.textSub}}>{done} de {total} pruebas marcadas</div>
        </div>
        <Btn small col="ghost" onClick={reset}>Reiniciar</Btn>
      </div>
      <div style={{height:12,borderRadius:999,background:"rgba(75,48,27,.14)",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,borderRadius:999,background:"linear-gradient(90deg,#263F4D,#B99A45,#2F6B42)",transition:"width .25s ease"}}/>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
      {groups.map(g=><Card key={g.id} style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{fontSize:"1.75rem"}}>{g.icon}</div>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>{g.title}</div>
            <div style={{fontSize:".74rem",fontWeight:820,color:T.textSub}}>
              {g.items.filter((_,i)=>checked[`${g.id}_${i}`]).length}/{g.items.length} comprobado
            </div>
          </div>
        </div>
        <div style={{display:"grid",gap:8}}>
          {g.items.map((text,i)=>{
            const key=`${g.id}_${i}`;
            const on=!!checked[key];
            return <button key={key} onClick={()=>toggle(key)} style={{textAlign:"left",display:"flex",gap:9,alignItems:"flex-start",border:`1.5px solid ${on?T.gold:T.g300}`,background:on?"linear-gradient(180deg,#E8D3A2,#D8BE87)":"rgba(255,244,214,.72)",borderRadius:13,padding:"9px 10px",cursor:"pointer",fontWeight:850,color:on?T.g800:T.textSub,lineHeight:1.28}}>
              <span style={{fontSize:"1rem",lineHeight:1.1}}>{on?"✅":"⬜"}</span>
              <span style={{fontSize:".82rem"}}>{text}</span>
            </button>;
          })}
        </div>
      </Card>)}
    </div>

    <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Siguiente paso cuando esté todo marcado</div>
      <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
        Cuando Gestión esté revisada, el siguiente bloque será <b>Supabase/RLS</b>: primero usuarios y roles, después citas, tienda, comunidad y auditoría. No conviene tocar RLS hasta saber que la interfaz ya está estable.
      </div>
    </Card>
  </div>;
}

function GestionAdmin({user,setUser,showToast,showPoints,unread}){
  const role=normalizeRole(user?.rol||user?.role);
  const isAdmin=role===ROLES.ADMIN;
  const isStaff=role===ROLES.STAFF;
  const canAccess=isAdmin||isStaff;
  const [tab,setTab]=useState("resumen");
  const [gestionGroup,setGestionGroup]=useState("principal");

  const tabs=[
    {id:"resumen",icon:"🏠",label:"Resumen",sub:"Vista principal con próximas citas, avisos y accesos rápidos",staff:true,group:"principal"},
    {id:"agenda",icon:"🗓️",label:"Agenda",sub:"Vista diaria ordenada por horas",staff:true,group:"principal"},
    {id:"citas",icon:"📅",label:"Citas",sub:"Reservas pendientes, confirmadas y propuestas",staff:true,group:"principal"},
    {id:"clientes",icon:"👥",label:"Clientes",sub:"Clientes reales de tienda con citas registradas",staff:true,group:"principal"},

    {id:"facturacion",icon:"💰",label:"Resumen",sub:"Panel rápido de facturación, caja, cobros y actividad económica",staff:true,group:"facturacion"},
    {id:"caja",icon:"🧾",label:"Caja",sub:"Cobros, ventas y registros concretos del día",staff:true,group:"facturacion"},
    {id:"estadisticas",icon:"📊",label:"Estadísticas",sub:"Resumen gráfico de citas, ingresos, pedidos, puntos y comunidad",staff:true,group:"facturacion"},

    {id:"tienda_resumen",icon:"🛍️",label:"Resumen",sub:"Vista rápida de tienda, canjes, pedidos y stock bajo",staff:true,group:"tienda"},
    {id:"tienda_items",icon:"🎁",label:"Premios",sub:"Premios, cupones, objetos y canjes editables",staff:false,group:"tienda"},
    {id:"stock",icon:"📦",label:"Stock",sub:"Inventario interno y productos de trabajo",staff:true,group:"tienda"},
    {id:"pedidos",icon:"📋",label:"Pedidos",sub:"Canjes y entregas de tienda",staff:true,group:"tienda"},
    {id:"tienda_ajustes",icon:"⚙️",label:"Ajustes",sub:"Activación de tienda, canjes y reglas básicas",staff:false,group:"tienda"},

    {id:"juegos_admin",icon:"🎮",label:"Juegos",sub:"Zona de control para Arcade, rankings, retos y recompensas",staff:true,group:"juegos"},

    {id:"comunidad_resumen",icon:"🌐",label:"Resumen",sub:"Vista rápida de reportes, mensajes, foro, tablón, actualidad y música",staff:true,group:"comunidad"},
    {id:"moderacion",icon:"🛡️",label:"Moderación",sub:"Reportes y control de comunidad",staff:true,group:"comunidad"},
    {id:"mensajes",icon:"📩",label:(unread?.admin?`Mensajes (${unread.admin})`:"Mensajes"),sub:"Buzón privado de clientes",staff:true,group:"comunidad"},
    {id:"musica_admin",icon:"🎧",label:"Música",sub:"Artistas, enlaces y audios propios",staff:false,group:"comunidad"},
    {id:"comunidad_ajustes",icon:"⚙️",label:"Ajustes",sub:"Activación de foro, actualidad, música, mensajes y reportes",staff:false,group:"comunidad"},

    {id:"admin_resumen",icon:"🔐",label:"Resumen",sub:"Vista rápida de usuarios, roles, bloqueos, auditoría y ajustes",staff:false,group:"admin"},
    {id:"usuarios",icon:"👥",label:"Usuarios",sub:"Usuarios de la web: búsqueda, roles y bloqueos",staff:false,group:"admin"},
    {id:"roles_permisos",icon:"👑",label:"Roles",sub:"Matriz clara de permisos admin, staff y cliente",staff:false,group:"admin"},
    {id:"baneos",icon:"🚫",label:"Baneos",sub:"Usuarios bloqueados y desbloqueo rápido",staff:false,group:"admin"},
    {id:"seguridad",icon:"🧾",label:"Auditoría",sub:"Registro de roles, bloqueos y cambios importantes",staff:false,group:"admin"},
    {id:"supabase_rls",icon:"🧱",label:"Supabase",sub:"Preparación de seguridad real, RLS y tablas sensibles",staff:false,group:"admin"},
    {id:"checklist",icon:"✅",label:"Checklist",sub:"Revisión final de Gestión antes de seguridad real",staff:false,group:"admin"},
    {id:"ajustes",icon:"⚙️",label:"Ajustes",sub:"Configuración interna global de la web",staff:false,group:"admin"},
  ].filter(t=>isAdmin||t.staff);

  const active=tabs.find(t=>t.id===tab)||tabs[0];

  const gestionGroups=[
    {id:"principal",icon:"🏠",label:"Principal",sub:"Resumen, agenda, citas y clientes. Lo básico para trabajar cada día."},
    {id:"facturacion",icon:"💰",label:"Facturación",sub:"Caja, cobros y estadísticas. Todo lo económico en una zona clara."},
    {id:"tienda",icon:"🛍️",label:"Tienda",sub:"Resumen, premios, stock, pedidos y ajustes de tienda."},
    {id:"juegos",icon:"🎮",label:"Juegos",sub:"Arcade, rankings, retos y recompensas internas de juego."},
    {id:"comunidad",icon:"🌐",label:"Comunidad",sub:"Resumen, moderación, mensajes, música y ajustes de comunidad."},
    {id:"admin",icon:"🔐",label:"Admin",sub:"Resumen, usuarios, roles, baneos, auditoría, Supabase, checklist y ajustes globales."}
  ].filter(g=>tabs.some(t=>t.group===g.id));

  const visibleTabs=tabs.filter(t=>t.group===gestionGroup);

  function openGestionGroup(id){
    SFX.tab();
    setGestionGroup(id);
    const first=tabs.find(t=>t.group===id);
    if(first) setTab(first.id);
  }

  useEffect(()=>{
    if(!tabs.find(t=>t.id===tab)) setTab(tabs[0]?.id||"resumen");
    if(!tabs.some(t=>t.group===gestionGroup)) setGestionGroup(tabs[0]?.group||"principal");
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
              Panel interno organizado por zonas: principal, facturación, tienda, juegos, comunidad y administración.
            </div>
          </div>
          <Badge col={isAdmin?"gold":"green"}>{isAdmin?"ADMIN":"STAFF"}</Badge>
        </div>
      </Card>

      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`,padding:12}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
          {gestionGroups.map(g=><button key={g.id} onClick={()=>openGestionGroup(g.id)} style={{border:`2px solid ${gestionGroup===g.id?T.gold:T.g300}`,background:gestionGroup===g.id?T.gradGold:"rgba(255,244,214,.72)",color:gestionGroup===g.id?T.g900:T.g700,borderRadius:16,padding:"10px 6px",fontWeight:950,cursor:"pointer",fontSize:".72rem",boxShadow:gestionGroup===g.id?"0 10px 24px rgba(212,175,55,.22)":"0 5px 12px rgba(20,8,4,.08)"}}>
            <div style={{fontSize:"1.2rem",lineHeight:1}}>{g.icon}</div>
            <div style={{marginTop:4}}>{g.label}</div>
          </button>)}
        </div>
        <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:10}}>
          {gestionGroups.find(g=>g.id===gestionGroup)?.sub}
        </div>
      </Card>

      <div className="gestion-grid-pro" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:12}}>
        {visibleTabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setTab(t.id);}} style={{border:`2px solid ${active.id===t.id?T.gold:T.g300}`,background:active.id===t.id?T.gradGold:"rgba(255,244,214,.84)",color:active.id===t.id?T.g900:T.g700,borderRadius:16,padding:"12px 8px",fontWeight:950,cursor:"pointer",boxShadow:active.id===t.id?"0 10px 24px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.1)"}}>
          <div style={{fontSize:"1.35rem",lineHeight:1}}>{t.icon}</div>
          <div style={{fontSize:".76rem",marginTop:4}}>{t.label}</div>
        </button>)}
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",padding:"12px 14px"}}>
        <div style={{fontWeight:950,color:T.g800}}>{active.icon} {active.label}</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>{active.sub}</div>
        <div style={{marginTop:8,fontSize:".72rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>
          {isAdmin?"Permisos admin: acceso completo a gestión, ajustes, tienda, música, usuarios y seguridad.":"Permisos staff: agenda, citas, caja, clientes, stock, pedidos, juegos, mensajes, moderación y estadísticas. Sin ajustes, tienda editable, música editable ni roles."}
        </div>
      </Card>

      {tab==="resumen"&&<DashboardAdmin user={user} showToast={showToast}/>}
      {tab==="agenda"&&<GestionAgenda showToast={showToast}/>}
      {tab==="citas"&&<Citas user={user} showToast={showToast}/>}
      {tab==="clientes"&&<Clientes user={user} showToast={showToast}/>}

      {tab==="facturacion"&&<GestionFacturacionPanel user={user} showToast={showToast}/>}
      {tab==="caja"&&<Caja user={user} showToast={showToast}/>}
      {tab==="estadisticas"&&<GestionEstadisticas showToast={showToast}/>}

      {tab==="tienda_resumen"&&<GestionTiendaPanel user={user} showToast={showToast}/>}
      {tab==="tienda_items"&&(isAdmin?<GestionTienda user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El staff puede gestionar stock y pedidos, pero no editar premios ni cupones de tienda."/> )}
      {tab==="stock"&&<Inventario showToast={showToast}/>}
      {tab==="pedidos"&&<GestionPedidos user={user} showToast={showToast}/>}
      {tab==="tienda_ajustes"&&(isAdmin?<GestionTiendaAjustes user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="Los ajustes de tienda y canjes sólo debería tocarlos el administrador."/> )}

      {tab==="juegos_admin"&&<GestionJuegosAdmin user={user} showToast={showToast}/>}

      {tab==="comunidad_resumen"&&<GestionComunidadPanel user={user} showToast={showToast} unread={unread}/>}
      {tab==="moderacion"&&<GestionModeracion user={user} showToast={showToast}/>}
      {tab==="mensajes"&&<GestionMensajes user={user} showToast={showToast} unread={unread}/>}
      {tab==="musica_admin"&&(isAdmin?<GestionMusica user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El staff puede moderar comunidad y mensajes, pero no editar la música."/> )}
      {tab==="comunidad_ajustes"&&(isAdmin?<GestionComunidadAjustes user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="Los ajustes de comunidad sólo debería tocarlos el administrador."/> )}

      {tab==="admin_resumen"&&(isAdmin?<GestionAdminPanel user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El resumen admin sólo debería verlo el administrador."/> )}
      {tab==="usuarios"&&(isAdmin?<AdminUsuarios user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El staff no puede cambiar roles, permisos ni bloqueos de usuarios."/> )}
      {tab==="roles_permisos"&&(isAdmin?<GestionRolesPermisos user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="La matriz de permisos sólo debería verla el administrador."/> )}
      {tab==="baneos"&&(isAdmin?<GestionBaneos user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="Los bloqueos sólo debería revisarlos el administrador."/> )}
      {tab==="seguridad"&&(isAdmin?<GestionSeguridad user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="La auditoría de seguridad sólo debería verla el administrador."/> )}
      {tab==="supabase_rls"&&(isAdmin?<GestionSeguridadSupabase user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="La preparación de Supabase sólo debería verla el administrador."/> )}
      {tab==="checklist"&&(isAdmin?<GestionChecklist user={user} showToast={showToast}/>:<RestrictedCard title="Sólo admin" sub="El checklist final sólo debería verlo el administrador."/> )}
      {tab==="ajustes"&&(isAdmin?<GestionAjustes user={user} showToast={showToast}/>:<RestrictedCard title="Ajustes bloqueados" sub="Los ajustes globales sólo debería tocarlos el administrador."/> )}
    </div>
  );
}


const NAV_CFG={
  admin:[{id:"juegos",icon:"🎮",label:"Arcade"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"perfil",icon:"👤",label:"Perfil"}],
  staff:[{id:"juegos",icon:"🎮",label:"Arcade"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"perfil",icon:"👤",label:"Perfil"}],
  client:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"buzon",icon:"📩",label:"Buzón"},{id:"perfil",icon:"👤",label:"Perfil"}],
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
  gestion:"Panel interno para facturación, caja, citas, clientes, stock y herramientas de administración.",
  buzon:"Buzón privado para hablar con Rasta Cuts. El cliente ve su hilo y admin/staff responden desde Gestión > Mensajes.",
  mensajes:"Buzón interno para responder mensajes privados de clientes.",
  pedidos:"Gestión de canjes de tienda: pendiente, preparando, listo, entregado o cancelado."
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
  ],
  cartera:[
    "La cartera separa las economías: puntos web para perfil, tienda y comunidad; RC sólo para el Tycoon; dinero real futuro aparte.",
    "La regla buena es clara: máximo normal de 50 puntos al día si completas todo perfecto. Sin contar gacha.",
    "Aquí verás puntos disponibles, progreso diario y, más adelante, historial de movimientos.",
    "Si algún día activas pagos, el saldo real debe vivir aquí, separado de los puntos para no mezclar churras con rastas."
  ],
  carrito:[
    "El carrito guardará compras de tienda y personalización del avatar/perfil antes de confirmar el canje.",
    "Aquí no entra el Tycoon. El Tycoon tendrá sus RC y su propia economía cuando lo mejoremos más adelante.",
    "Lo ideal es que puedas añadir, quitar, vaciar y revisar total antes de gastar puntos.",
    "Buen carrito: claro, sin letra pequeña y con el total siempre visible. Que nadie compre un peine pensando que era una corona."
  ],
  personalizacion:[
    "La personalización es para avatar, perfil y presencia dentro de la web: marcos, fondos, títulos, colores e insignias.",
    "Los cosméticos son perfectos para endurecer la economía sin tener que regalar premios reales todo el tiempo.",
    "Primero se desbloquea el objeto; después se aplica desde el editor de personaje o perfil.",
    "El Tycoon queda fuera de esta tienda por ahora. Sus muebles y mejoras visuales irán con RC cuando toque."
  ],
  notificaciones:[
    "La campana es el buzón rápido: citas, mensajes, canjes y avisos importantes.",
    "Una notificación de cita debe enseñar fecha, hora, servicio, estado y mensaje completo sin obligarte a buscar a ciegas.",
    "Si algo es importante, debe verse como importante. Si ya lo leíste, que no siga gritando como loro en barbería.",
    "Desde aquí deberías poder abrir la sección relacionada: Citas, comunidad, tienda o perfil."
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
  if(page==="perfil"||page==="cartera"||page==="carrito")return "success";
  if(page==="notificaciones")return "noticias";
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
  if(page==="cartera")return "Rasta cartera";
  if(page==="carrito")return "Rasta carrito";
  if(page==="notificaciones")return "Rasta campana";
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
    ranking:"Estás en Ranking. Aquí se comparan puntos y progreso entre clientes.",
    cartera:"Estás en Cartera. Aquí se separan los puntos web, el límite diario, el saldo futuro y la economía del Tycoon.",
    carrito:"Estás en Carrito. Aquí se guardarán compras de tienda y personalización del avatar antes de confirmar el canje.",
    notificaciones:"Estás en Notificaciones. Aquí se leen avisos completos, citas, mensajes y accesos rápidos a la sección relacionada."
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
  if(t.includes("cartera")||t.includes("👛"))return "Abre la cartera: puntos disponibles, límite diario de 50 puntos, saldo futuro y economías separadas.";
  if(t.includes("carrito")||t.includes("🛒"))return "Abre el carrito: aquí se guardarán compras de tienda y personalización de avatar/perfil antes de confirmar.";
  if(t.includes("notificaciones")||t.includes("🔔")||t.includes("campana"))return "Abre la campana. Aquí puedes leer citas, avisos y mensajes completos sin perderte.";
  if(t.includes("ver detalle"))return "Despliega la notificación para leer el mensaje completo y los datos importantes.";
  if(t.includes("abrir cita"))return "Te lleva a Citas para revisar o gestionar la reserva relacionada.";
  if(t.includes("marcar leída")||t.includes("marcar leidas")||t.includes("marcar leídas"))return "Marca la notificación como leída para que deje de aparecer como nueva.";
  if(t.includes("vaciar"))return "Vacía el carrito. Úsalo sólo si quieres quitar todos los artículos guardados.";
  if(t.includes("confirmación")||t.includes("confirmar carrito"))return "Confirmará el canje del carrito cuando terminemos la tienda y la personalización.";
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
          <div style={{position:"relative"}}>
            <RastaFaceAvatar size={68} speaking={open}/>
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



function HelperInline({page}){
  const [open,setOpen]=useState(false);
  const text=rastaPageHelpIntro(page);
  return <div style={{background:"rgba(255,248,230,.72)",border:`1px solid ${T.g200}`,borderRadius:18,padding:10}}>
    <button onClick={()=>setOpen(v=>!v)} style={{border:"none",background:"transparent",display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:0,width:"100%",textAlign:"left"}}>
      <RastaFaceAvatar size={38} speaking={open}/>
      <div style={{flex:1}}>
        <div style={{fontWeight:950,color:T.g800,fontSize:".84rem"}}>{helperTitle(page)}</div>
        <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{open?"Ocultar explicación":"Ver explicación rápida"}</div>
      </div>
      <div style={{fontWeight:950,color:T.g700}}>{open?"−":"+"}</div>
    </button>
    {open&&<div style={{fontSize:".8rem",fontWeight:820,color:T.text,lineHeight:1.42,marginTop:8,whiteSpace:"pre-wrap"}}>{text}</div>}
  </div>;
}

function WalletPanel({show,onClose,user}){
  if(!show)return null;
  const pts=Number(user?.puntos||0);
  const dailyMax=50;
  const todayEarned=Number(user?.puntos_hoy||user?.daily_points||0);
  const pct=Math.max(0,Math.min(100,Math.round(todayEarned/dailyMax*100)));
  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,.62)",zIndex:710,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"64px 12px 90px"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:24,boxShadow:"0 24px 60px rgba(0,0,0,.34)",padding:14,animation:"fadeSlide .22s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
        <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>👛 Cartera</div><div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Puntos web separados del Tycoon y de pagos futuros.</div></div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,fontWeight:950,color:T.g700,cursor:"pointer"}}>×</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <Card style={{padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}><div style={{fontSize:"1.6rem"}}>⭐</div><div style={{fontWeight:950,color:T.g800,fontSize:"1.3rem"}}>{pts}</div><div style={{fontSize:".76rem",fontWeight:850,color:T.textSub}}>Puntos disponibles</div></Card>
        <Card style={{padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}><div style={{fontSize:"1.6rem"}}>💳</div><div style={{fontWeight:950,color:T.g800,fontSize:"1.3rem"}}>0,00 €</div><div style={{fontSize:".76rem",fontWeight:850,color:T.textSub}}>Saldo futuro</div></Card>
      </div>
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800,marginBottom:8}}><span>Límite diario normal</span><span>{todayEarned}/{dailyMax} pts</span></div>
        <div style={{height:10,borderRadius:999,background:"rgba(75,48,27,.15)",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#5F8E22,#D5B24F)",borderRadius:999}}/></div>
        <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:8}}>Referencia canónica: máximo normal de 50 puntos/día completando todo perfecto. El gacha queda aparte y se ajustará en economía.</div>
      </Card>
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#F6E8C8,#D4BD8F)"}}>
        <div style={{fontWeight:950,color:T.g800}}>Economías separadas</div>
        <div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.42,marginTop:6}}>Puntos web: avatar, perfil, tienda y comunidad. RC: sólo Tycoon. Dinero real futuro: pagos, reservas o saldo, siempre separado.</div>
      </Card>
      <div style={{marginTop:10}}><HelperInline page="cartera"/></div>
    </div>
  </div>;
}

function CartPanel({show,onClose,user,showToast}){
  const [items,setItems]=useState(()=>readCart(user));
  useEffect(()=>{
    const reload=()=>setItems(readCart(user));
    window.addEventListener("rasta-cart-updated",reload);
    return()=>window.removeEventListener("rasta-cart-updated",reload);
  },[user?.id]);
  useEffect(()=>{writeCart(user,items);},[items,user?.id]);
  if(!show)return null;
  const totalPts=items.reduce((sum,it)=>sum+(Number(it.precio_puntos||it.puntos||0)*Number(it.qty||1)),0);
  function clearCart(){setItems([]);showToast?.("Carrito vaciado");}
  function removeItem(i){setItems(items.filter((_,idx)=>idx!==i));SFX.tab();}
  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,.62)",zIndex:710,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"64px 12px 90px"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:24,boxShadow:"0 24px 60px rgba(0,0,0,.34)",padding:14,animation:"fadeSlide .22s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
        <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🛒 Carrito</div><div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Premios, tienda y personalización del avatar/perfil.</div></div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,fontWeight:950,color:T.g700,cursor:"pointer"}}>×</button>
      </div>
      {items.length===0?<EmptyState icon="🛒" title="Carrito vacío" sub="Aquí guardaremos compras de tienda y personalización del avatar. El Tycoon queda aparte."/>:<div style={{display:"grid",gap:8}}>{items.map((it,i)=><Card key={`${it.id}-${i}`} style={{padding:10}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}><div style={{minWidth:0}}><div style={{fontWeight:950,color:T.g800,display:"flex",gap:7,alignItems:"center"}}><span>{it.icono||"🎁"}</span><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.nombre||it.titulo||"Artículo"}</span></div><div style={{fontSize:".76rem",fontWeight:820,color:T.textSub}}>{it.categoria==="avatar"?"Personalización avatar/perfil":(it.tipo||"tienda")} · x{it.qty||1}</div></div><div style={{display:"grid",gap:6,justifyItems:"end"}}><div style={{fontWeight:950,color:T.g800}}>{Number(it.precio_puntos||it.puntos||0)*(it.qty||1)} pts</div><button onClick={()=>removeItem(i)} style={{border:`1px solid ${T.g200}`,background:"rgba(255,244,214,.72)",borderRadius:999,padding:"4px 8px",fontWeight:950,color:T.red,cursor:"pointer"}}>Quitar</button></div></div></Card>)}</div>}
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#F6E8C8,#D4BD8F)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800}}><span>Total</span><span>{totalPts} pts</span></div>
        <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:6}}>Base preparada para añadir/quitar productos desde Tienda y Personalización en fases siguientes.</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}><Btn small col="ghost" onClick={clearCart} disabled={!items.length}>Vaciar</Btn><Btn small col="gold" onClick={()=>showToast?.("Confirmación de carrito pendiente para la siguiente fase")} disabled={!items.length}>Confirmar</Btn></div>
      <div style={{marginTop:10}}><HelperInline page="carrito"/></div>
    </div>
  </div>;
}

function NotificacionesPanel({show,onClose,items=[],onMarkAll,onMarkOne,onRefresh,onOpenCitas}){
  const [openId,setOpenId]=useState(null);
  if(!show)return null;
  const unread=items.filter(n=>!n.leida).length;
  const when=v=>{try{return new Date(v).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch{return "";}};
  const isCita=n=>{
    const t=`${n.tipo||""} ${n.titulo||""} ${n.mensaje||""}`.toLowerCase();
    return t.includes("cita")||t.includes("reserva")||t.includes("agenda");
  };
  const safePayload=n=>{
    const raw=n.payload||n.meta||n.datos||n.extra||null;
    if(!raw)return {};
    if(typeof raw==="object")return raw;
    try{return JSON.parse(raw);}catch{return {};}
  };
  const detailRows=n=>{
    const p=safePayload(n);
    const rows=[
      ["Fecha",n.fecha||p.fecha||p.dia||p.date],
      ["Hora",n.hora||p.hora||p.time],
      ["Servicio",n.servicio||p.servicio||p.tratamiento||p.service],
      ["Estado",n.estado||p.estado||p.status],
      ["Cliente",n.cliente||p.cliente||p.nombre_cliente],
      ["Notas",n.notas||p.notas||p.comentario]
    ].filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()!=="");
    return rows;
  };
  async function readOne(n){
    if(!n?.leida) await onMarkOne?.(n);
  }
  async function openCitas(n){
    await readOne(n);
    onClose?.();
    onOpenCitas?.();
  }
  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,.62)",zIndex:700,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"64px 12px 90px"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,maxHeight:"calc(100dvh - 128px)",overflowY:"auto",background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:24,boxShadow:"0 24px 60px rgba(0,0,0,.34)",padding:14,animation:"fadeSlide .22s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
        <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🔔 Notificaciones</div><div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>{unread} sin leer · {items.length} recientes</div></div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,fontWeight:950,color:T.g700,cursor:"pointer"}}>×</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><Btn small col="ghost" onClick={onRefresh}>Actualizar</Btn><Btn small col="gold" onClick={onMarkAll} disabled={!unread}>Marcar leídas</Btn></div>
      {items.length===0?<EmptyState icon="🔔" title="Sin notificaciones" sub="Cuando haya citas, mensajes o canjes nuevos aparecerán aquí."/>:items.map(n=>{
        const opened=openId===n.id;
        const cita=isCita(n);
        const rows=detailRows(n);
        return <Card key={n.id} style={{marginBottom:9,padding:12,background:n.leida?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#EBD18D)",border:n.importante?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div className="icon3d" style={{fontSize:"1.6rem"}}>{notificationIcon(n.tipo)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                {!n.leida&&<Badge col="red">nuevo</Badge>}{n.importante&&<Badge col="gold">importante</Badge>}{cita&&<Badge col="blue">cita</Badge>}
                <span style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>{when(n.created_at)}</span>
              </div>
              <div style={{fontWeight:950,color:T.g800,lineHeight:1.2}}>{n.titulo||"Notificación"}</div>
              {n.mensaje&&<div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4,whiteSpace:"pre-wrap"}}>{opened?n.mensaje:String(n.mensaje).slice(0,120)+(String(n.mensaje).length>120?"...":"")}</div>}
              {opened&&rows.length>0&&<div style={{marginTop:10,display:"grid",gap:6,background:"rgba(255,248,230,.64)",border:`1px solid ${T.g200}`,borderRadius:14,padding:10}}>
                {rows.map(([k,v])=><div key={k} style={{display:"grid",gridTemplateColumns:"82px 1fr",gap:8,fontSize:".78rem",fontWeight:850,color:T.text}}>
                  <span style={{color:T.g700,fontWeight:950}}>{k}</span><span>{String(v)}</span>
                </div>)}
              </div>}
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
                <Btn small col="ghost" onClick={async()=>{setOpenId(opened?null:n.id); if(!opened) await readOne(n);}}>{opened?"Ocultar":"Ver detalle"}</Btn>
                {cita&&<Btn small col="gold" onClick={()=>openCitas(n)}>Abrir cita</Btn>}
                {!n.leida&&<Btn small col="green" onClick={()=>readOne(n)}>Marcar leída</Btn>}
              </div>
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}


export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [communityTab,setCommunityTab]=useState("feed");
  const [toast,setToast]=useState({show:false,msg:""});
  const [ptsPopup,setPtsPopup]=useState({show:false,pts:0});
  const [musicOn,setMusicOn]=useState(false);
  const [uiTheme,setUiTheme]=useState(()=>{
    if(typeof window==="undefined")return "night";
    try{
      const saved=localStorage.getItem("rastaCutsUiTheme");
      if(saved==="day"||saved==="night")return saved;
    }catch{}
    return "night";
  });
  const [checkingSession,setCheckingSession]=useState(true);
  const [helperPage,setHelperPage]=useState(null);
  const [topsInitial,setTopsInitial]=useState("games");
  const [appSettings,setAppSettings]=useState(DEFAULT_APP_SETTINGS);
  const [unread,setUnread]=useState({client:0,admin:0});
  const [notifOpen,setNotifOpen]=useState(false);
  const [walletOpen,setWalletOpen]=useState(false);
  const [cartOpen,setCartOpen]=useState(false);
  const [notifications,setNotifications]=useState([]);
  const [notifCount,setNotifCount]=useState(0);
  const [tycoonRoute,setTycoonRoute]=useState(()=>typeof window!=="undefined"&&window.location.hash==="#/tycoon");

  useEffect(()=>{
    const onHash=()=>setTycoonRoute(typeof window!=="undefined"&&window.location.hash==="#/tycoon");
    window.addEventListener("hashchange",onHash);
    onHash();
    return()=>window.removeEventListener("hashchange",onHash);
  },[]);

  useEffect(()=>{
    try{
      document.documentElement.dataset.rcTheme=uiTheme;
      document.body.dataset.rcTheme=uiTheme;
      localStorage.setItem("rastaCutsUiTheme",uiTheme);
    }catch{}
  },[uiTheme]);

  function openTycoonPage(){
    if(typeof window!=="undefined") window.location.hash="#/tycoon";
    setTycoonRoute(true);
  }
  function closeTycoonPage(){
    if(typeof window!=="undefined"){
      history.pushState("",document.title,window.location.pathname+window.location.search);
    }
    setTycoonRoute(false);
    stopGameMusic();
  }

  useEffect(()=>{
    async function loadSettings(){
      const cfg=await loadAppSettingsFromDb();
      setAppSettings(cfg);
    }
    loadSettings();
  },[]);

  useEffect(()=>{
    const vol=Number(appSettings?.musica?.volumen_general);
    masterVolume=Number.isFinite(vol)?Math.max(0,Math.min(1.2,vol)):0.7;
    setBackgroundVolume();
  },[appSettings?.musica?.volumen_general]);

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
        if(perfil){
          if(isBannedProfile(perfil)){
            try{await supabase.auth.signOut();}catch{}
          }else{
            setUser(toAppUser(perfil));
          }
        }
      }
      setCheckingSession(false);
    }
    restoreSession();
  },[]);

  const showToast=useCallback(msg=>{setToast({show:true,msg});setTimeout(()=>setToast({show:false,msg:""}),3200);},[]);
  const showPoints=useCallback(pts=>{setPtsPopup({show:true,pts});setTimeout(()=>setPtsPopup({show:false,pts:0}),1800);},[]);

  const loadNotifications=useCallback(async()=>{
    if(!user?.id)return;
    const roleNow=normalizeRole(user.rol||user.role);
    try{
      const q=roleNow===ROLES.CLIENT
        ? `?usuario_id=eq.${user.id}&rol_destino=eq.client&order=created_at.desc&limit=60&select=*`
        : `?or=(rol_destino.eq.admin,rol_destino.eq.staff)&order=created_at.desc&limit=60&select=*`;
      const rows=await dbGet("notificaciones",q);
      const list=Array.isArray(rows)?rows:[];
      setNotifications(list);
      setNotifCount(list.filter(n=>!n.leida).length);
    }catch(e){setNotifications([]);setNotifCount(0);}
  },[user?.id,user?.rol,user?.role]);

  async function markNotificationsRead(){
    const ids=notifications.filter(n=>!n.leida).map(n=>n.id).filter(Boolean);
    if(!ids.length)return;
    await dbPatch("notificaciones",`?id=in.(${ids.join(",")})`,{leida:true});
    await loadNotifications();
  }
  async function markNotificationRead(n){
    if(!n?.id||n.leida)return;
    await dbPatch("notificaciones",`?id=eq.${n.id}`,{leida:true});
    await loadNotifications();
  }

  const refreshUnread=useCallback(async()=>{
    if(!user?.id)return;
    const roleNow=normalizeRole(user.rol||user.role);
    try{
      const rows=roleNow===ROLES.CLIENT
        ? await dbGet("mensajes_privados",`?usuario_id=eq.${user.id}&autor_rol=neq.client&leido_cliente=eq.false&select=id`)
        : await dbGet("mensajes_privados","?autor_rol=eq.client&leido_admin=eq.false&select=id");
      const count=Array.isArray(rows)?rows.length:0;
      setUnread(roleNow===ROLES.CLIENT?{client:count,admin:0}:{client:0,admin:count});
    }catch(e){}
  },[user?.id,user?.rol,user?.role]);

  useEffect(()=>{refreshUnread();loadNotifications();},[refreshUnread,loadNotifications,page]);
  useEffect(()=>{
    if(!user?.id)return;
    const timer=setInterval(()=>{refreshUnread();loadNotifications();},45000);
    return()=>clearInterval(timer);
  },[user?.id,refreshUnread,loadNotifications]);
  function toggleMusic(){
    if(appSettings?.secciones?.musica_activa===false){showToast("La música está desactivada desde Ajustes");SFX.error();return;}
    globalMuted=!globalMuted;
    if(globalMuted){stopMusic();stopGameMusic();setMusicOn(false);}
    else{startMusic();setMusicOn(true);}
  }
  function changeMusicTrack(){nextMusicTrack();SFX.tab();showToast(`Tema: ${backgroundAudioAvailable?getBackgroundName():(REGGAE_LOFI_TRACKS[currentMusicTrack]?.name||"Lofi Rasta")}`);}
  function toggleUiTheme(){
    setUiTheme(prev=>{
      const next=prev==="night"?"day":"night";
      playUiSound(next==="night"?"admin":"page");
      showToast(next==="night"?"Modo noche activado":"Modo día activado");
      return next;
    });
  }
  const navTo=id=>{
    setHelperPage(null);
    const sec=appSettings?.secciones||{};
    const blocked={
      tienda:sec.tienda_activa===false,
      juegos:sec.arcade_activo===false,
      musica:sec.musica_activa===false,
      noticias:sec.noticias_activas===false,
      foro:sec.foro_activo===false
    };
    if(blocked[id]){showToast("Esta sección está desactivada temporalmente");SFX.error();return;}
    const communityMap={feed:"feed",foro:"foro",noticias:"noticias",musica:"musica",comunidad:communityTab||"feed"};
    const target=communityMap[id]?"comunidad":id;
    if(communityMap[id]) setCommunityTab(communityMap[id]);
    if(target===page){SFX.tab();}
    else{playNavSound(id);}
    setPage(target);
  };
  const logout=()=>{supabase?.auth.signOut();setUser(null);setPage("dashboard");};

  if(checkingSession)return <div style={{fontFamily:"sans-serif",minHeight:"100vh",display:"grid",placeItems:"center",background:T.g100}}><Spinner/></div>;
  if(!user)return (
    <>
      <Auth onLogin={u=>{setUser(u);setPage(normalizeRole(u.rol||u.role)===ROLES.CLIENT?"dashboard":"gestion");}} showToast={showToast} settings={appSettings}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  const role=normalizeRole(user.rol || user.role);
  const rawNav=NAV_CFG[role]||NAV_CFG.client;
  const sec=appSettings?.secciones||{};
  const nav=rawNav.filter(n=>!(n.id==="tienda"&&sec.tienda_activa===false)&&!(n.id==="juegos"&&sec.arcade_activo===false));
  const grad=GRAD_ROLE[role]||GRAD_ROLE.client;
  const ap=(role!==ROLES.CLIENT && page==="dashboard")?"gestion":page;
  const theme=pageTheme(ap,communityTab,role);
  const clinicAccent=uiTheme==="day"?"#23B6F2":"#43D6FF";
  const clinicAccent2=uiTheme==="day"?"#9C6BFF":"#9C7DFF";
  const currentUser={...user,rol:role};
  const sp={showToast,showPoints,user:currentUser,setUser,settings:appSettings,refreshUnread,unread,loadNotifications};
  const isAdmin=role===ROLES.ADMIN || role===ROLES.STAFF;

  if(tycoonRoute){
    return (
      <div className="rc-standalone-shell" data-rc-theme={uiTheme} style={{fontFamily:"'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100vh",background:uiTheme==="day"?"radial-gradient(circle at top,#FFF1D7 0,#FAF2E3 52%,#F1E6FF 100%)":"radial-gradient(circle at 50% 12%,rgba(212,175,55,.22),transparent 30%),radial-gradient(circle at 12% 80%,rgba(47,107,66,.22),transparent 28%),radial-gradient(circle at 88% 76%,rgba(167,40,34,.18),transparent 26%),linear-gradient(180deg,#050403,#130B06 48%,#080604)",color:"var(--rc-text,#EAF6FF)"}}>
        <style>{CSS}</style>
        <Particles/>
        <RastaCutsTycoonGame user={currentUser} showToast={showToast} standalone onExit={closeTycoonPage}/>
        <Toast msg={toast.msg} show={toast.show}/>
      </div>
    );
  }

  const pages={
    dashboard:role===ROLES.CLIENT?<ClientDashboard user={currentUser} onNavigate={navTo} settings={appSettings}/>:<GestionAdmin {...sp}/>,
    citas:<Citas {...sp} onNavigate={navTo}/>,clientes:<Clientes {...sp}/>,inventario:<Inventario {...sp}/>,
    gestion:<GestionAdmin {...sp}/>,caja:<Caja {...sp}/>,usuarios:<AdminUsuarios {...sp}/>,feed:<SocialFeed {...sp}/>,foro:<Foro {...sp}/>,
    noticias:<Noticias {...sp}/>,musica:<Comunidad {...sp} initialTab="musica"/>,comunidad:<Comunidad {...sp} initialTab={communityTab}/>,
    tienda:(sec.tienda_activa===false?<DisabledSection icon="🛍️" title="Tienda desactivada" sub="La tienda está apagada temporalmente desde Gestión > Ajustes."/>:<Tienda {...sp}/>),juegos:(sec.arcade_activo===false?<DisabledSection icon="🎮" title="Arcade desactivado" sub="Los juegos están apagados temporalmente desde Gestión > Ajustes."/>:<Juegos {...sp} setHelperPage={setHelperPage} onOpenTycoon={openTycoonPage} onOpenTops={(tab)=>{setTopsInitial(tab||"games");navTo("tops");}}/>),tops:<GameTopsPage user={currentUser} initialTab={topsInitial} onBack={()=>navTo("juegos")} onPlay={()=>navTo("juegos")}/>,retos:<Retos {...sp}/>,
    ranking:<Ranking user={currentUser}/>,buzon:<BuzonPrivado {...sp}/>,perfil:<Perfil {...sp} onLogout={logout}/>,
    galeria:<Galeria showToast={showToast} isAdmin={isAdmin}/>,
    reviews:<Reviews {...sp}/>,chat:<Chat user={currentUser} showToast={showToast}/>,
    cupones:<Cupones user={currentUser} showToast={showToast}/>,
  };

  return(
    <div className={`app-shell page-${ap} theme-${ap==="comunidad"?communityTab:ap}`} data-rc-theme={uiTheme} data-page={ap} data-community={communityTab} style={{fontFamily:"'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:theme.shell,minHeight:"100vh",maxWidth:"var(--app-max-width,480px)",width:"100%",margin:"0 auto",paddingBottom:"var(--app-bottom-pad,82px)",position:"relative",boxShadow:`0 0 0 1px rgba(148,232,255,.18),0 0 42px rgba(0,0,0,.28),0 0 36px ${clinicAccent}22`,"--shineA":`color-mix(in srgb, ${clinicAccent} 28%, transparent)`,"--shineB":`color-mix(in srgb, ${clinicAccent2} 22%, transparent)`,"--shineSpeed":"7.2s","--pageGlowA":`color-mix(in srgb, ${clinicAccent} 20%, transparent)`,"--pageGlowB":`color-mix(in srgb, ${clinicAccent2} 18%, transparent)`,"--pageMark":theme.mark,"--pageMarkColor":`${clinicAccent}18`,"--pageAccent":clinicAccent,"--pageAccent2":clinicAccent2,"--pageShellModern":theme.shell}}>
      <style>{CSS}</style>
      <Particles/>
      <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
      <div className="app-header-pro" style={{background:role===ROLES.CLIENT?theme.header:grad,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50,boxShadow:`0 4px 20px rgba(0,0,0,0.22), inset 0 -1px 0 ${clinicAccent}55`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="brand-home-button" onClick={()=>navTo("dashboard")} title="Ir al inicio" style={{display:"inline-flex",alignItems:"center",gap:7,border:"none",background:"transparent",padding:0,cursor:"pointer",fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.white,textShadow:"0 4px 10px rgba(0,0,0,.35)"}}><span className="brand-scissors" style={{fontSize:"1.3rem"}}>{appSettings?.branding?.emoji_principal||"✂️"}</span><span>{appSettings?.branding?.nombre_tienda||BRAND.name}</span></button>
          {role!==ROLES.CLIENT&&<span style={{background:"rgba(255,255,255,0.22)",color:T.white,borderRadius:50,padding:"2px 8px",fontSize:"0.68rem",fontWeight:800,textTransform:"uppercase"}}>{role}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="header-action-pro" onClick={()=>setNotifOpen(true)} title="Notificaciones · campana de avisos y citas" style={{position:"relative",background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 9px",cursor:"pointer",color:T.white,fontWeight:900,fontSize:"0.9rem"}}>🔔{notifCount>0&&<span style={{position:"absolute",top:-5,right:-5,minWidth:17,height:17,borderRadius:999,background:"#A72822",color:"#FFF4D6",fontSize:".58rem",fontWeight:950,display:"grid",placeItems:"center",border:"1.5px solid #FFF4D6",boxShadow:"0 4px 10px rgba(0,0,0,.28)"}}>{notifCount>9?"9+":notifCount}</span>}</button>
          <button className="header-action-pro wallet-button-pro" onClick={()=>setWalletOpen(true)} title="Cartera · puntos, saldo y límite diario" style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 9px",cursor:"pointer",color:T.white,fontWeight:900,fontSize:"0.9rem"}}>👛</button>
          <button className="header-action-pro cart-button-pro" onClick={()=>setCartOpen(true)} title="Carrito · compras y personalización" style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 9px",cursor:"pointer",color:T.white,fontWeight:900,fontSize:"0.9rem"}}>🛒</button>
          <button className="header-action-pro" onClick={toggleMusic} onDoubleClick={changeMusicTrack} title={musicOn?`Doble toque: reiniciar tema (${getBackgroundName()})`:"Activar música"} style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 10px",cursor:"pointer",color:T.white,fontWeight:800,fontSize:"0.72rem"}}>{musicOn?"🔇 Silenciar":"🔊 Sonido"}</button>
          <button className="header-action-pro theme-toggle-pro" onClick={toggleUiTheme} title={uiTheme==="night"?"Cambiar a modo día":"Cambiar a modo noche"} style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 10px",cursor:"pointer",color:T.white,fontWeight:900,fontSize:"0.72rem",display:"inline-flex",alignItems:"center",gap:4}}>{uiTheme==="night"?"☀️":"🌙"} <span className="theme-word">{uiTheme==="night"?"Día":"Noche"}</span></button>
          {role===ROLES.CLIENT&&<div style={{background:"rgba(255,255,255,0.2)",borderRadius:50,padding:"4px 12px",color:T.white,fontWeight:900,fontSize:"0.84rem"}}>{currentUser.puntos||0} pts</div>}
          <div className="header-action-pro" onClick={()=>navTo("perfil")} style={{cursor:"pointer",padding:2,background:"rgba(255,255,255,0.18)",borderRadius:"50%"}}>
            <Av av={currentUser.avatar} config={currentUser.avatarConfig} size={32}/>
          </div>
        </div>
      </div>
      <div key={`${ap}-${communityTab}`} className="page-content-pro" style={{padding:"18px 14px",position:"relative"}}>
        <div className="motion-strip" style={{background:`linear-gradient(90deg,transparent,${clinicAccent}99,${clinicAccent2}77,transparent)`,margin:"0 18px 16px",boxShadow:`0 0 18px ${clinicAccent}44`,opacity:.92}}/>
        {pages[ap]||pages["dashboard"]}
        <HelperMascot page={helperPage || (ap==="comunidad"?communityTab:ap)}/>
      </div>
      <div className="bottom-nav-pro" style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"var(--rc-card-strong)",borderTop:`2px solid ${clinicAccent}`,display:"flex",justifyContent:"space-around",padding:"6px 2px 10px",zIndex:100,boxShadow:"0 -4px 20px rgba(0,0,0,0.18)"}}>
        {nav.map(n=>{
          const badge=(role===ROLES.CLIENT && n.id==="buzon")?unread.client:((role!==ROLES.CLIENT && n.id==="gestion")?unread.admin:0);
          return(
          <button className="nav-tab-pro" data-active={ap===n.id?"true":"false"} key={n.id} onClick={()=>navTo(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",minWidth:38,position:"relative"}}>
            {badge>0&&<span style={{position:"absolute",top:-2,right:2,minWidth:17,height:17,borderRadius:999,background:"#A72822",color:"#FFF4D6",fontSize:".58rem",fontWeight:950,display:"grid",placeItems:"center",border:"1.5px solid #FFF4D6",boxShadow:"0 4px 10px rgba(0,0,0,.28)"}}>{badge>9?"9+":badge}</span>}
            <div className="nav-icon-pro" style={{fontSize:"1.1rem",background:ap===n.id?`linear-gradient(135deg,${clinicAccent},${clinicAccent2})`:"transparent",borderRadius:10,padding:"4px 7px",transform:ap===n.id?"scale(1.18)":"scale(1)",transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:ap===n.id?`0 3px 12px ${clinicAccent}55`:"none"}}>{n.icon}</div>
            <span style={{fontSize:"0.52rem",fontWeight:800,color:ap===n.id?"var(--rc-text)":"var(--rc-muted)",transition:"color 0.2s"}}>{n.label}</span>
          </button>
        );})}
      </div>
      <NotificacionesPanel show={notifOpen} onClose={()=>setNotifOpen(false)} items={notifications} onRefresh={loadNotifications} onMarkAll={markNotificationsRead} onMarkOne={markNotificationRead} onOpenCitas={()=>navTo("citas")}/>
      <WalletPanel show={walletOpen} onClose={()=>setWalletOpen(false)} user={currentUser}/>
      <CartPanel show={cartOpen} onClose={()=>setCartOpen(false)} user={currentUser} showToast={showToast}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}
