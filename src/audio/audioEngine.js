import { BACKGROUND_PLAYLIST, PENTA, NOTE_FREQ, REGGAE_LOFI_TRACKS, GAME_MUSIC } from "../data/musicData.js";

let audioCtx=null,musicInterval=null,musicPlaying=false,globalMuted=true;
let masterVolume=0.72;
let backgroundAudio=null,backgroundAudioAvailable=true;
let backgroundTrackIndex=0,backgroundSourceTry=0,backgroundDuckedForGame=false; let backgroundFirstStartDone=false;

let currentMusicTrack=0,musicStep=0;
let backgroundShuffleQueue=[];


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
  nav:()=>playUiSound("page"),
  navBack:()=>playUiSound("back"),
  tab:()=>playUiSound("tab"),
  click:()=>playUiSound("tap"),
  action:()=>playUiSound("action"),
  jump:()=>playUiSound("jump"),
  collect:()=>playUiSound("collect"),
  hit:()=>playUiSound("hit"),
  coins:()=>playUiSound("money"),
  success:()=>playUiSound("success"),
  error:()=>playUiSound("error"),
  notify:()=>playUiSound("notify"),
};

function playRastaVoice(kind="talk"){
  if(globalMuted)return;
  try{
    const voices={
      open:[
        [523,.050,.012,0],[659,.055,.014,.055],[784,.070,.010,.115],[1046,.050,.006,.190]
      ],
      close:[
        [659,.045,.010,0],[523,.052,.009,.055],[392,.070,.007,.115]
      ],
      tip:[
        [587,.050,.012,0],[740,.060,.012,.060],[880,.045,.010,.135],[740,.050,.006,.205]
      ],
      help:[
        [392,.050,.010,0],[523,.055,.012,.050],[392,.045,.008,.115],[659,.070,.010,.175]
      ],
      context:[
        [440,.040,.010,0],[660,.052,.012,.052],[880,.054,.010,.116]
      ],
      happy:[
        [523,.045,.012,0],[659,.045,.012,.045],[784,.055,.013,.095],[988,.070,.009,.155]
      ]
    };
    const pattern=voices[kind]||voices.talk||voices.open;
    pattern.forEach(([f,d,v,delay],idx)=>{
      playTone(f,idx%2?"triangle":"sine",d,v,delay);
    });
    if(kind==="open"||kind==="tip"||kind==="happy") playNoise(.035,.004,.075,"lowpass",1250);
  }catch(e){}
}
function playUiSound(kind="tap"){
  if(globalMuted)return;
  const patterns={
    tap:[[520,.022,.007,0]],
    tab:[[620,.026,.008,0]],
    page:[[392,.045,.014,0],[523,.050,.010,.045]],
    back:[[392,.040,.012,0],[294,.052,.009,.05]],
    action:[[560,.040,.012,0],[720,.045,.009,.045]],
    jump:[[440,.035,.010,0],[660,.030,.006,.035]],
    collect:[[720,.040,.014,0],[980,.044,.010,.045]],
    hit:[[210,.070,.014,0]],
    shop:[[660,.045,.014,0],[880,.050,.010,.048],[1175,.055,.007,.096]],
    game:[[330,.045,.011,0],[494,.052,.008,.045]],
    social:[[440,.040,.010,0],[587,.046,.007,.045]],
    admin:[[220,.048,.010,0],[330,.055,.007,.058]],
    profile:[[523,.040,.010,0],[698,.046,.007,.055]],
    money:[[784,.045,.014,0],[988,.050,.010,.044],[1175,.055,.007,.088]],
    notify:[[880,.040,.011,0],[1175,.046,.007,.06]],
    success:[[523,.052,.014,0],[659,.058,.010,.060],[784,.064,.007,.120]],
    error:[[246,.085,.012,0],[196,.095,.008,.075]]
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


/* ===== Audio limpio 2.1.4 =====
   - 1 toque: activar / silenciar sin reiniciar.
   - doble toque: saltar a una canción aleatoria.
   - al acabar: avanza automáticamente a la siguiente pista.
   - al entrar en juegos: música principal muteada, audio de juego encima.
*/
function readBackgroundMusicMode(){
  try{
    const saved=localStorage.getItem("rasta_cuts_audio_mode");
    return saved==="ambient"?"ambient":"random";
  }catch{
    return "random";
  }
}

let backgroundMusicMode=readBackgroundMusicMode();
let backgroundPreferredZone="global";

function normalizeAudioZone(zone){
  const z=String(zone||"global").toLowerCase();
  if(["home","login","shop","profile","arcade","community","global"].includes(z))return z;
  return "global";
}

function pageToAudioZone(page,communityTab){
  const p=String(page||"").toLowerCase();
  const c=String(communityTab||"").toLowerCase();

  if(!p)return "login";
  if(p==="dashboard")return "home";
  if(p==="juegos"||p==="ranking"||p==="retos"||p==="tops")return "arcade";
  if(p==="tienda"||p==="cupones"||p==="caja")return "shop";
  if(p==="perfil")return "profile";
  if(p==="comunidad")return c==="musica"?"global":"community";
  if(p==="gestion"||p==="citas"||p==="clientes"||p==="inventario")return "shop";
  if(p==="buzon"||p==="notificaciones"||p==="reviews"||p==="chat")return "global";

  return "global";
}

function detectBackgroundZone(){
  if(backgroundPreferredZone&&backgroundPreferredZone!=="global"){
    return normalizeAudioZone(backgroundPreferredZone);
  }

  try{
    const shell=document.querySelector(".app-shell");
    const page=shell?.dataset?.page || "";
    const community=shell?.dataset?.community || "";
    return normalizeAudioZone(pageToAudioZone(page,community));
  }catch{}

  return "global";
}

function readLiveBackgroundMode(){
  const liveMode=readBackgroundMusicMode();
  if(liveMode!==backgroundMusicMode){
    backgroundMusicMode=liveMode;
    backgroundShuffleQueue=[];
  }
  return backgroundMusicMode;
}

function indexesForZone(zone){
  const exact=BACKGROUND_PLAYLIST
    .map((t,i)=>({t,i}))
    .filter(x=>String(x.t?.zone||"").toLowerCase()===zone)
    .map(x=>x.i);

  if(exact.length)return exact;

  const global=BACKGROUND_PLAYLIST
    .map((t,i)=>({t,i}))
    .filter(x=>String(x.t?.zone||"").toLowerCase()==="global")
    .map(x=>x.i);

  return global;
}

function backgroundCandidateIndexes(){
  const len=BACKGROUND_PLAYLIST.length;
  if(!len)return [0];

  const mode=readLiveBackgroundMode();

  if(mode!=="ambient"){
    return Array.from({length:len},(_,i)=>i);
  }

  const zone=detectBackgroundZone();
  const zoneIndexes=indexesForZone(zone);

  if(zoneIndexes.length)return zoneIndexes;

  return Array.from({length:len},(_,i)=>i);
}

function currentTrackStillFitsMode(){
  const candidates=backgroundCandidateIndexes();
  return candidates.includes(backgroundTrackIndex);
}

function getBackgroundTrack(){
  return BACKGROUND_PLAYLIST[backgroundTrackIndex%BACKGROUND_PLAYLIST.length]||BACKGROUND_PLAYLIST[0];
}
function getBackgroundName(){
  return getBackgroundTrack()?.name||"Rasta Cuts Lounge";
}
function getBackgroundSrc(){
  const track=getBackgroundTrack();
  const srcs=Array.isArray(track?.srcs)?track.srcs:[];
  return srcs[backgroundSourceTry%Math.max(1,srcs.length)]||"/audio/Glass%20Lounge%20Loop.mp3";
}
function pickRandomBackgroundIndex(){
  const candidates=backgroundCandidateIndexes();
  const len=candidates.length;

  if(len<=1)return candidates[0]??0;

  if(!backgroundShuffleQueue.length){
    backgroundShuffleQueue=candidates
      .filter(i=>i!==backgroundTrackIndex)
      .sort(()=>Math.random()-0.5);

    if(!backgroundShuffleQueue.length){
      backgroundShuffleQueue=[...candidates].sort(()=>Math.random()-0.5);
    }
  }

  return backgroundShuffleQueue.shift()??candidates[0]??0;
}
function backgroundTargetVolume(){
  if(globalMuted||backgroundDuckedForGame)return 0;
  const track=getBackgroundTrack();
  const gain=Number(track?.gain)||1;
  const base=Number.isFinite(masterVolume)?masterVolume:0.72;
  return Math.max(0.28,Math.min(0.78,base*0.58*gain));
}
function applyBackgroundAudioState(){
  try{
    if(!backgroundAudio)return;
    backgroundAudio.loop=false;
    backgroundAudio.muted=Boolean(globalMuted||backgroundDuckedForGame);
    backgroundAudio.volume=backgroundTargetVolume();
  }catch(e){}
}
function resetBackgroundAudio(keepAvailability=true){
  try{
    if(backgroundAudio){
      backgroundAudio.pause();
      backgroundAudio.removeAttribute?.("src");
      backgroundAudio.load?.();
    }
  }catch(e){}
  backgroundAudio=null;
  if(keepAvailability) backgroundAudioAvailable=true;
}
function createBackgroundAudio(){
  if(typeof Audio==="undefined")return null;
  const a=new Audio();
  a.src=getBackgroundSrc();
  a.loop=false;
  a.preload="auto";
  a.crossOrigin="anonymous";
  a.volume=backgroundTargetVolume();
  a.muted=Boolean(globalMuted||backgroundDuckedForGame);
  a.dataset.trackName=getBackgroundName();
  a.addEventListener("ended",()=>{
    if(musicPlaying){
      nextMusicTrack(true);
    }
  });
  a.addEventListener("error",()=>{
    const track=getBackgroundTrack();
    const srcCount=track?.srcs?.length||1;
    if(backgroundSourceTry<srcCount-1){
      backgroundSourceTry++;
      const shouldResume=musicPlaying&&!globalMuted&&!backgroundDuckedForGame;
      resetBackgroundAudio(true);
      if(shouldResume)startMusic();
      return;
    }
    backgroundAudioAvailable=false;
    resetBackgroundAudio(false);
    if(musicPlaying&&!globalMuted&&!backgroundDuckedForGame)startGeneratedMusic();
  });
  return a;
}
function getBackgroundAudio(){
  if(typeof Audio==="undefined")return null;
  if(!backgroundAudio) backgroundAudio=createBackgroundAudio();
  return backgroundAudio;
}
function setBackgroundVolume(){
  applyBackgroundAudioState();
}
function stopGeneratedMusic(){
  if(musicInterval){clearInterval(musicInterval);musicInterval=null;}
}
function startGeneratedMusic(){
  stopGeneratedMusic();
  musicStep=0;
  setupMusicInterval();
  if(!globalMuted&&!backgroundDuckedForGame)tickLofiTrack();
}
function playCurrentBackgroundTrack({forceRestart=false}={}){
  stopGeneratedMusic();
  backgroundAudioAvailable=true;
  const a=getBackgroundAudio();
  if(!a)return Promise.reject(new Error("Audio no disponible"));
  if(forceRestart){
    try{a.currentTime=0;}catch(e){}
  }
  applyBackgroundAudioState();
  return a.play().then(()=>{applyBackgroundAudioState();return true;});
}
function startMusic(){
  musicPlaying=true;
  globalMuted=false;
  backgroundDuckedForGame=false;
  backgroundAudioAvailable=true;
  stopGeneratedMusic();

  if(!backgroundFirstStartDone || !currentTrackStillFitsMode()){
    backgroundTrackIndex=pickRandomBackgroundIndex();
    backgroundSourceTry=0;
    backgroundFirstStartDone=true;
    resetBackgroundAudio(true);
  }

  const tryPlay=(attempt=0)=>{
    playCurrentBackgroundTrack({forceRestart:false}).catch(()=>{
      const track=getBackgroundTrack();
      const srcCount=track?.srcs?.length||1;
      if(backgroundSourceTry<srcCount-1){
        backgroundSourceTry++;
        resetBackgroundAudio(true);
        tryPlay(attempt+1);
        return;
      }
      if(attempt<BACKGROUND_PLAYLIST.length){
        backgroundTrackIndex=pickRandomBackgroundIndex();
        backgroundSourceTry=0;
        resetBackgroundAudio(true);
        tryPlay(attempt+1);
        return;
      }
      backgroundAudioAvailable=false;
      resetBackgroundAudio(false);
      if(musicPlaying&&!globalMuted&&!backgroundDuckedForGame)startGeneratedMusic();
    });
  };

  tryPlay(0);
}
function stopMusic(){
  musicPlaying=false;
  stopGeneratedMusic();
  try{if(backgroundAudio&&!backgroundAudio.paused)backgroundAudio.pause();}catch(e){}
}
function muteMusicKeepTime(muted=true){
  globalMuted=Boolean(muted);
  stopGeneratedMusic();
  applyBackgroundAudioState();
  if(musicPlaying&&backgroundAudioAvailable){
    const a=getBackgroundAudio();
    if(a&&a.paused){
      a.play().catch(()=>{});
    }
  }
  if(musicPlaying&&!backgroundAudioAvailable&&!globalMuted&&!backgroundDuckedForGame)startGeneratedMusic();
}
function nextMusicTrack(auto=false){
  backgroundTrackIndex=pickRandomBackgroundIndex();
  backgroundSourceTry=0;
  const shouldPlay=musicPlaying||auto;
  const wasDucked=backgroundDuckedForGame;
  resetBackgroundAudio(true);

  if(shouldPlay){
    musicPlaying=true;
    if(!wasDucked)globalMuted=false;
    backgroundDuckedForGame=wasDucked;
    playCurrentBackgroundTrack({forceRestart:true}).catch(()=>{
      backgroundAudioAvailable=false;
      resetBackgroundAudio(false);
      if(musicPlaying&&!globalMuted&&!backgroundDuckedForGame)startGeneratedMusic();
    });
    return;
  }

  currentMusicTrack=Math.floor(Math.random()*REGGAE_LOFI_TRACKS.length);
  musicStep=0;
}

let gameMusicInterval=null, resumeMainAfterGame=false;

function startGameMusic(gameId){
  if(globalMuted)return;
  stopGameMusic(false);
  resumeMainAfterGame=musicPlaying;
  backgroundDuckedForGame=true;
  stopGeneratedMusic();
  applyBackgroundAudioState();

  if(backgroundAudioAvailable&&musicPlaying){
    const a=getBackgroundAudio();
    if(a&&a.paused)a.play().catch(()=>{});
  }

  const cfg=GAME_MUSIC[gameId]||GAME_MUSIC.sopa;
  const notes=cfg.notes;
  let i=0;
  gameMusicInterval=setInterval(()=>{
    if(globalMuted){stopGameMusic(false);return;}
    const n=notes[i%notes.length];
    const next=notes[(i+2)%notes.length];

    // Música de juego suave, distinta por juego, sin machacar el click.
    if(gameId==="gacha"){
      if(i%2===0)playTone(n,"square",0.050,0.018,0);
      if(i%4===3)playTone(next*2,"triangle",0.060,0.010,0.045);
      if(i%8===0)playTone(n*0.5,"sine",0.090,0.012,0.02);
    }else if(gameId==="runner"){
      if(i%2===0)playTone(n,"square",0.055,0.014,0);
      if(i%4===0)playTone(n*cfg.bass,"sine",0.080,0.010,0.02);
    }else if(gameId==="stitch"){
      playTone(n,"triangle",0.060,0.013,0);
      if(i%3===0)playTone(next,"sine",0.070,0.008,0.07);
    }else{
      playTone(n,cfg.wave,0.075,0.012,0);
      if(i%4===1)playTone(next,"triangle",0.090,0.007,0.08);
    }
    i++;
  },cfg.tempo);
}
function stopGameMusic(restoreMain=true){
  if(gameMusicInterval){clearInterval(gameMusicInterval);gameMusicInterval=null;}
  backgroundDuckedForGame=false;
  applyBackgroundAudioState();
  if(restoreMain&&resumeMainAfterGame&&!globalMuted){
    resumeMainAfterGame=false;
    musicPlaying=true;
    startMusic();
  }else if(!restoreMain){
    resumeMainAfterGame=false;
  }
}


function isMuted(){return Boolean(globalMuted);}
function isMusicPlaying(){return Boolean(musicPlaying);}
function isBackgroundAudioAvailable(){return Boolean(backgroundAudioAvailable);}
function setMuted(value){globalMuted=Boolean(value);applyBackgroundAudioState();}
function setMusicPlaying(value){musicPlaying=Boolean(value);}
function setBackgroundDuckedForGame(value){backgroundDuckedForGame=Boolean(value);applyBackgroundAudioState();}
function setBackgroundMusicMode(mode){
  backgroundMusicMode=mode==="ambient"?"ambient":"random";
  backgroundShuffleQueue=[];
  try{localStorage.setItem("rasta_cuts_audio_mode",backgroundMusicMode);}catch{}
}
function setBackgroundZone(zone){
  const next=normalizeAudioZone(zone);
  if(backgroundPreferredZone!==next){
    backgroundPreferredZone=next;
    backgroundShuffleQueue=[];
  }
}
function setMasterVolume(value){masterVolume=Number.isFinite(value)?Math.max(0,Math.min(1.2,value)):0.72;setBackgroundVolume();}

export {
  SFX,
  getBackgroundName,
  isBackgroundAudioAvailable,
  isMusicPlaying,
  isMuted,
  muteMusicKeepTime,
  nextMusicTrack,
  playNavSound,
  playRastaVoice,
  playUiSound,
  setBackgroundDuckedForGame,
  setBackgroundVolume,
  setBackgroundMusicMode,
  setBackgroundZone,
  setMasterVolume,
  setMuted,
  setMusicPlaying,
  startGameMusic,
  startMusic,
  stopGameMusic
};
