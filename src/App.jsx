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
  // Urban studio palette: más contraste, tarjetas claras y fondo oscuro cálido
  g900:"#150B07",g800:"#24110A",g700:"#3A1E10",g600:"#6E3518",
  g500:"#9A4F22",g400:"#C97934",g300:"#E1A85D",g200:"#F0D39B",
  g150:"#F6E5BE",g100:"#E6C27A",g50:"#FFF4D6",
  pink:"#C0392B",gold:"#D4AF37",orange:"#E8871A",red:"#8B0000",blue:"#1A3A5C",
  ink:"#120806",panel:"#FFF1CE",panel2:"#FFE7B0",
  text:"#1B0D07",textSub:"#6E3518",white:"#FFF2D4",
  gradAdmin:"linear-gradient(135deg,#130906,#3A1E10 55%,#8B4513)",
  gradStaff:"linear-gradient(135deg,#3A1E10,#8B4513 55%,#C97934)",
  gradClient:"linear-gradient(135deg,#5C2B13,#B86A2E 55%,#E1A85D)",
  gradGold:"linear-gradient(135deg,#B87912,#D4AF37 55%,#FFF1A8)",
  gradPink:"linear-gradient(135deg,#5C0F0F,#B51F1F 55%,#F06A3B)",
};

const ROLES = { ADMIN:"admin", STAFF:"staff", CLIENT:"client" };

function normalizeRole(value){
  const role = String(value || "").trim().toLowerCase();
  if(["admin","administrador","administrator"].includes(role)) return ROLES.ADMIN;
  if(["staff","empleado","trabajador","worker"].includes(role)) return ROLES.STAFF;
  return ROLES.CLIENT;
}

const BRAND = {
  name:"Rasta Cuts",
  tagline:"Cortes, rastas y estilo urbano",
  subtagline:"Reserva, juega y gana recompensas",
};

let audioCtx=null,musicInterval=null,musicPlaying=false,globalMuted=true;
const PENTA=[261.63,293.66,329.63,392.0,440.0,523.25,587.33,659.25];
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function playTone(freq,type="sine",dur=0.12,vol=0.15,delay=0){
  if(globalMuted)return;
  try{
    const ctx=getCtx(),osc=ctx.createOscillator(),g=ctx.createGain();
    osc.connect(g);g.connect(ctx.destination);osc.type=type;
    osc.frequency.setValueAtTime(freq,ctx.currentTime+delay);
    g.gain.setValueAtTime(0,ctx.currentTime+delay);
    g.gain.linearRampToValueAtTime(vol,ctx.currentTime+delay+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+dur+0.05);
  }catch(e){}
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
function startMusic(){
  if(musicPlaying)return;musicPlaying=true;let beat=0;
  const pat=[0,2,4,2,1,3,5,3,4,6,4,2];
  musicInterval=setInterval(()=>{
    if(!musicPlaying)return;
    try{
      const ctx=getCtx();if(ctx.state==="suspended")ctx.resume();
      const f=PENTA[pat[beat%pat.length]%PENTA.length];
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);o.type="sine";o.frequency.value=f;
      g.gain.setValueAtTime(0,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.052,ctx.currentTime+0.05);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.2);
      o.start(ctx.currentTime);o.stop(ctx.currentTime+1.3);beat++;
    }catch(e){}
  },600);
}
function stopMusic(){musicPlaying=false;if(musicInterval){clearInterval(musicInterval);musicInterval=null;}}

let gameMusicInterval=null, resumeMainAfterGame=false;
const GAME_MUSIC={
  sopa:[392,440,494,587],
  memoria:[330,392,440,494],
  trivia:[349,392,440,523],
  runner:[294,349,392,440],
  jump:[330,392,494,587],
  stitch:[349,440,523,659],
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
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#CD853F;border-radius:4px}
body{margin:0;background-color:#160B07;background-image:radial-gradient(circle at 18% 10%,rgba(212,175,55,.18),transparent 28%),radial-gradient(circle at 90% 8%,rgba(192,57,43,.15),transparent 24%),radial-gradient(circle at 50% 110%,rgba(232,135,26,.22),transparent 38%),linear-gradient(160deg,#130906 0%,#2C1810 42%,#5C3317 100%)}
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
@keyframes shineLine{0%{left:-120%;opacity:0}25%{opacity:.35}60%{opacity:.22}100%{left:120%;opacity:0}}
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

.bp:active{transform:scale(0.94)!important}
.ch:hover{transform:translateY(-3px) scale(1.01);box-shadow:0 14px 34px rgba(20,8,4,0.32)!important}
.studio-panel{position:relative;overflow:hidden}
.studio-panel:after{content:"";position:absolute;top:0;bottom:0;width:80px;left:-120%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);animation:shineLine 5.5s ease-in-out infinite}
.icon3d{filter:drop-shadow(0 7px 8px rgba(0,0,0,.28));text-shadow:0 4px 8px rgba(0,0,0,.25);animation:wiggle3d 3.2s ease-in-out infinite}

`;

function Btn({children,onClick,col="green",full=false,small=false,disabled=false,style:sx={}}){
  const C={green:{bg:T.gradClient,sh:"rgba(64,145,108,0.35)"},dark:{bg:T.gradAdmin,sh:"rgba(27,67,50,0.35)"},pink:{bg:T.gradPink,sh:"rgba(233,30,140,0.3)"},gold:{bg:T.gradGold,sh:"rgba(255,183,3,0.35)"},red:{bg:"linear-gradient(135deg,#E53935,#EF5350)",sh:"rgba(229,57,53,0.3)"},ghost:{bg:"transparent",sh:"none"}};
  const c=C[col]||C.green;
  return <button onClick={disabled?undefined:(e)=>{col==="ghost"?SFX.click():SFX.action();onClick?.(e);}} className="bp" style={{background:col==="ghost"?"rgba(255,244,214,.72)":c.bg,color:col==="ghost"?T.g700:T.white,border:col==="ghost"?`2px solid ${T.g300}`:"1px solid rgba(255,255,255,.22)",borderRadius:16,padding:small?"8px 14px":"12px 20px",fontWeight:900,fontSize:small?"0.78rem":"0.9rem",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,width:full?"100%":"auto",boxShadow:col==="ghost"?"0 6px 16px rgba(20,8,4,.12)":`0 8px 22px ${c.sh}`,transition:"all 0.18s ease",letterSpacing:".2px",...sx}}>{children}</button>;
}
function Card({children,style:sx={},onClick,hover=false}){
  return <div onClick={onClick?(e)=>{SFX.click();onClick(e);}:undefined} className={`${hover?"ch":""} studio-panel`} style={{background:"linear-gradient(180deg,#FFF4D6 0%,#F6E5BE 100%)",borderRadius:20,padding:"16px",boxShadow:"0 12px 30px rgba(20,8,4,0.22), inset 0 1px 0 rgba(255,255,255,.55)",border:`2px solid ${T.g300}`,transition:"all 0.22s ease",cursor:onClick?"pointer":"default",animation:"cardLift .35s ease",...sx}}>{children}</div>;
}
function Input({label,value,onChange,type="text",placeholder="",style:sx={}}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:"#FFF8E5",fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)",...sx}} onFocus={e=>e.target.style.border=`1.5px solid ${T.g500}`} onBlur={e=>e.target.style.border=`1.5px solid ${T.g200}`}/></div>;
}
function Select({label,value,onChange,options=[]}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:"#FFF8E5",fontSize:"0.9rem",color:T.text,outline:"none",boxShadow:"inset 0 2px 8px rgba(20,8,4,.08)"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Badge({children,col="green"}){
  const C={green:{bg:T.g150,c:T.g700},pink:{bg:"#FCE4EC",c:T.pink},gold:{bg:"#FFF8E1",c:"#E65100"},red:{bg:"#FFEBEE",c:T.red},blue:{bg:"#E3F2FD",c:T.blue}};
  const cc=C[col]||C.green;
  return <span style={{background:cc.bg,color:cc.c,borderRadius:50,padding:"3px 10px",fontSize:"0.72rem",fontWeight:800}}>{children}</span>;
}
function Modal({show,onClose,title,children}){
  if(!show)return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(27,67,50,0.55)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:T.white,borderRadius:"22px 22px 0 0",padding:"24px 18px 32px",width:"100%",maxWidth:480,animation:"slideUp 0.3s ease",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div style={{fontWeight:900,fontSize:"1.1rem",color:T.text}}>{title}</div><button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:"1rem",color:T.g700}}>X</button></div>{children}</div></div>;
}
function Spinner(){return <div style={{width:28,height:28,border:`3px solid ${T.g200}`,borderTop:`3px solid ${T.g600}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"20px auto"}}/>;}
function EmptyState({icon,title,sub}){return <div style={{textAlign:"center",padding:"40px 20px",color:T.textSub}}><div style={{fontSize:"2.8rem",marginBottom:10}}>{icon}</div><div style={{fontWeight:800,fontSize:"1rem",color:T.g700,marginBottom:6}}>{title}</div><div style={{fontSize:"0.83rem"}}>{sub}</div></div>;}
function PublicProfileModal({profile,onClose}){
  if(!profile)return null;
  const cfg=normalizeAvatarConfig(profile.avatar_config||profile.avatarConfig,profile.avatar);
  const pts=Number(profile.puntos||0);
  const nivel=pts>=1000?"VIP":pts>=500?"Gold":pts>=200?"Silver":"Bronze";
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
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
const AVATARS=["🧑","👩","👨","👱","👴","👵","🧔","👩‍🦱","👨‍🦱","👩‍🦰","👨‍🦰","👩‍🦳"];
const AVATAR_STYLES=[
  {emoji:"🧑🏽‍🎤",name:"Rasta Neo",tag:"dreads doradas",bg:"linear-gradient(145deg,#3A1E10,#D4AF37)"},
  {emoji:"👩🏽‍🎤",name:"Punk Queen",tag:"undercut rebelde",bg:"linear-gradient(145deg,#5C0F0F,#F06A3B)"},
  {emoji:"🧔🏽‍♂️",name:"Barber Boss",tag:"barba pro",bg:"linear-gradient(145deg,#130906,#8B4513)"},
  {emoji:"👨🏽‍🦱",name:"Afro Pop",tag:"volumen 3D",bg:"linear-gradient(145deg,#1A3A5C,#E1A85D)"},
  {emoji:"👩🏽‍🦱",name:"Curl Star",tag:"rizos anime",bg:"linear-gradient(145deg,#6E3518,#FFF1A8)"},
  {emoji:"🧑🏼‍🎨",name:"Color Splash",tag:"mechas fantasía",bg:"linear-gradient(145deg,#C0392B,#D4AF37)"},
  {emoji:"🧑🏾‍🦱",name:"Dread Master",tag:"rastas largas",bg:"linear-gradient(145deg,#24110A,#9A4F22)"},
  {emoji:"👱🏽‍♀️",name:"Blonde Blade",tag:"bob luminoso",bg:"linear-gradient(145deg,#D4AF37,#FFF4D6)"},
  {emoji:"🧑🏻‍🎤",name:"Cyber Punk",tag:"neón urbano",bg:"linear-gradient(145deg,#150B07,#C0392B)"},
  {emoji:"👩🏾‍🦳",name:"Silver Flow",tag:"plata premium",bg:"linear-gradient(145deg,#6E3518,#EDE1C8)"},
  {emoji:"🧑🏽",name:"Fresh Cut",tag:"degradado limpio",bg:"linear-gradient(145deg,#3A1E10,#C97934)"},
  {emoji:"👨🏾‍🎤",name:"Rock Fade",tag:"crestón punk",bg:"linear-gradient(145deg,#8B0000,#2C1810)"},
];

const AVATAR_OPTIONS={
  skin:["#F7C79C","#E9A578","#C98258","#9B5A38","#6E3B24"],
  hairColor:["#24140C","#4C2E17","#8B5A2B","#D4AF37","#8B0000","#1A3A5C","#EDE1C8"],
  eyeColor:["#1A120C","#5B341A","#1A3A5C","#2F6B42","#7B3FA1"],
  face:["oval","round","sharp","square"],
  hair:["dreadsLong","dreadsBun","dreadsTop","afro","punk","fade","bob"],
  brows:["soft","strong","angry","thin"],
  eyes:["anime","sleepy","sharp","round"],
  facial:["none","moustache","goatee","beard","full"],
  accessory:["none","earring","glasses","bandana","cap","piercing","capBlack","capGold","glassesGold","bandanaGreen","crown","hoopGold"],
  bg:["gold","dark","red","blue","paper","studio","street","royal"],
  frame:["none","bronze","gold","neon","legend"],
  aura:["none","warm","flame","ocean","vip"]
};
const DEFAULT_AVATAR_CONFIG={skin:2,hair:"dreadsLong",hairColor:0,face:"oval",eyes:"anime",eyeColor:0,brows:"strong",facial:"none",accessory:"earring",bg:"gold",frame:"none",aura:"none"};
const AVATAR_PRESETS=[
  {skin:2,hair:"dreadsLong",hairColor:0,face:"oval",eyes:"anime",eyeColor:0,brows:"strong",facial:"goatee",accessory:"earring",bg:"gold"},
  {skin:1,hair:"dreadsBun",hairColor:1,face:"sharp",eyes:"sharp",eyeColor:3,brows:"strong",facial:"none",accessory:"bandana",bg:"red"},
  {skin:3,hair:"dreadsTop",hairColor:2,face:"square",eyes:"anime",eyeColor:1,brows:"angry",facial:"beard",accessory:"glasses",bg:"dark"},
  {skin:2,hair:"punk",hairColor:4,face:"sharp",eyes:"sharp",eyeColor:4,brows:"angry",facial:"none",accessory:"piercing",bg:"red"},
  {skin:0,hair:"bob",hairColor:3,face:"round",eyes:"round",eyeColor:2,brows:"soft",facial:"none",accessory:"earring",bg:"paper"},
  {skin:4,hair:"afro",hairColor:0,face:"oval",eyes:"sleepy",eyeColor:0,brows:"soft",facial:"full",accessory:"glasses",bg:"blue"},
  {skin:2,hair:"fade",hairColor:0,face:"square",eyes:"sharp",eyeColor:1,brows:"strong",facial:"moustache",accessory:"none",bg:"dark"},
  {skin:1,hair:"dreadsLong",hairColor:6,face:"sharp",eyes:"anime",eyeColor:4,brows:"thin",facial:"none",accessory:"cap",bg:"gold"},
  {skin:3,hair:"dreadsBun",hairColor:5,face:"round",eyes:"round",eyeColor:2,brows:"soft",facial:"goatee",accessory:"bandana",bg:"blue"},
  {skin:2,hair:"punk",hairColor:3,face:"oval",eyes:"sleepy",eyeColor:0,brows:"thin",facial:"none",accessory:"earring",bg:"paper"},
  {skin:1,hair:"afro",hairColor:4,face:"sharp",eyes:"anime",eyeColor:3,brows:"strong",facial:"none",accessory:"piercing",bg:"red"},
  {skin:4,hair:"dreadsTop",hairColor:1,face:"square",eyes:"sharp",eyeColor:0,brows:"angry",facial:"full",accessory:"earring",bg:"dark"},
];
const AVATAR_LABELS={
  skin:"Piel",hair:"Peinado",hairColor:"Color pelo",face:"Cara",eyes:"Ojos",eyeColor:"Color ojos",brows:"Cejas",facial:"Barba/bigote",accessory:"Complemento",bg:"Fondo",
  oval:"Ovalada",round:"Redonda",sharp:"Anime",square:"Cuadrada",dreadsLong:"Rastas largas",dreadsBun:"Nudo rasta",dreadsTop:"Rastas arriba",afro:"Afro",punk:"Punk",fade:"Degradado",bob:"Bob",soft:"Suaves",strong:"Marcadas",angry:"Intensas",thin:"Finas",anime:"Anime",sleepy:"Relajados",none:"Nada",moustache:"Bigote",goatee:"Perilla",beard:"Barba",full:"Barba completa",earring:"Pendiente",glasses:"Gafas",bandana:"Bandana",cap:"Gorra",piercing:"Piercing",capBlack:"Gorra negra",capGold:"Gorra dorada",glassesGold:"Gafas doradas",bandanaGreen:"Bandana verde",crown:"Corona barber",hoopGold:"Aros dorados",gold:"Dorado",dark:"Oscuro",red:"Rojo",blue:"Azul",paper:"Papiro",studio:"Estudio",street:"Calle",royal:"VIP",bronze:"Bronce",neon:"Neón",legend:"Leyenda",warm:"Brillo cálido",flame:"Aura fuego",ocean:"Aura mar",vip:"Aura VIP"
};
function safeJsonParse(value){
  if(!value) return null;
  if(typeof value==="object") return value;
  try{return JSON.parse(value);}catch{return null;}
}
function normalizeAvatarConfig(value, legacyAvatar=0){
  const parsed=safeJsonParse(value);
  const fallback=AVATAR_PRESETS[(Number(legacyAvatar)||0)%AVATAR_PRESETS.length]||DEFAULT_AVATAR_CONFIG;
  const cfg={...DEFAULT_AVATAR_CONFIG,...fallback,...(parsed||{})};
  cfg.skin=Math.max(0,Math.min(AVATAR_OPTIONS.skin.length-1,Number(cfg.skin)||0));
  cfg.hairColor=Math.max(0,Math.min(AVATAR_OPTIONS.hairColor.length-1,Number(cfg.hairColor)||0));
  cfg.eyeColor=Math.max(0,Math.min(AVATAR_OPTIONS.eyeColor.length-1,Number(cfg.eyeColor)||0));
  if(!AVATAR_OPTIONS.face.includes(cfg.face)) cfg.face="oval";
  if(!AVATAR_OPTIONS.hair.includes(cfg.hair)) cfg.hair="dreadsLong";
  if(!AVATAR_OPTIONS.eyes.includes(cfg.eyes)) cfg.eyes="anime";
  if(!AVATAR_OPTIONS.brows.includes(cfg.brows)) cfg.brows="strong";
  if(!AVATAR_OPTIONS.facial.includes(cfg.facial)) cfg.facial="none";
  if(!AVATAR_OPTIONS.accessory.includes(cfg.accessory)) cfg.accessory="none";
  if(!AVATAR_OPTIONS.bg.includes(cfg.bg)) cfg.bg="gold";
  if(!AVATAR_OPTIONS.frame.includes(cfg.frame)) cfg.frame="none";
  if(!AVATAR_OPTIONS.aura.includes(cfg.aura)) cfg.aura="none";
  return cfg;
}
function avatarStyleName(cfg){return `${AVATAR_LABELS[cfg.hair]||"Estilo"} · ${AVATAR_LABELS[cfg.accessory]||"sin extra"}`;}
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
  try{
    await supabase.from("avatar_profiles").upsert({usuario_id:String(user.id),email:user.email,avatar_config:clean,updated_at:new Date().toISOString()},{onConflict:"usuario_id"});
  }catch{}
  return clean;
}
function randomAvatarConfig(){
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  return {skin:Math.floor(Math.random()*AVATAR_OPTIONS.skin.length),hair:pick(AVATAR_OPTIONS.hair),hairColor:Math.floor(Math.random()*AVATAR_OPTIONS.hairColor.length),face:pick(AVATAR_OPTIONS.face),eyes:pick(AVATAR_OPTIONS.eyes),eyeColor:Math.floor(Math.random()*AVATAR_OPTIONS.eyeColor.length),brows:pick(AVATAR_OPTIONS.brows),facial:pick(AVATAR_OPTIONS.facial),accessory:pick(AVATAR_OPTIONS.accessory),bg:pick(AVATAR_OPTIONS.bg)};
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
function makeId(value=""){
  const str=String(value||"");
  let hash=0;
  for(let i=0;i<str.length;i+=1){
    hash=(hash*31+str.charCodeAt(i))>>>0;
  }
  return hash.toString(16);
}
function AvatarFigure({config,size=80,animated=false}){
  const cfg=normalizeAvatarConfig(config);
  const skin=AVATAR_OPTIONS.skin[cfg.skin];
  const hair=AVATAR_OPTIONS.hairColor[cfg.hairColor];
  const eye=AVATAR_OPTIONS.eyeColor[cfg.eyeColor];
  const hasCap=["cap","capBlack","capGold"].includes(cfg.accessory);
  const hasBandana=["bandana","bandanaGreen"].includes(cfg.accessory);
  const uid=`avp-${String(size).replace(/\W/g,"")}-${cfg.skin}-${cfg.hair}-${cfg.hairColor}-${cfg.accessory}-${cfg.bg}-${cfg.frame}-${cfg.aura}`;
  const faceW={oval:34,round:36,sharp:33,square:35}[cfg.face]||34;
  const jawY={oval:118,round:116,sharp:123,square:119}[cfg.face]||118;
  const cheekY={oval:67,round:69,sharp:66,square:66}[cfg.face]||67;
  const eyeRy={anime:6.6,sleepy:2.5,sharp:4.2,round:5.4}[cfg.eyes]||5;
  const eyeRx={anime:7.8,sleepy:7.4,sharp:7.2,round:5.6}[cfg.eyes]||6;
  const browShape=cfg.brows==="angry"
    ?"M54 73 L67 77 M93 77 L106 73"
    :cfg.brows==="thin"
      ?"M55 72 Q61 69 67 71 M93 71 Q99 69 105 72"
      :"M53 72 Q61 67 69 71 M91 71 Q99 67 107 72";

  const capColor=cfg.accessory==="capGold"?"#D4AF37":cfg.accessory==="capBlack"?"#15100C":"#19324B";
  const bandanaColor=cfg.accessory==="bandanaGreen"?"#2F6B42":"#C0392B";
  const frameGlow=cfg.aura==="vip"?"rgba(255,241,168,.65)":cfg.aura==="flame"?"rgba(240,106,59,.55)":cfg.aura==="ocean"?"rgba(95,215,255,.48)":"rgba(212,175,55,.35)";

  const sideLockLeft = cfg.hair==="bob"
    ? "M46 59 C31 78 33 114 49 139"
    : cfg.hair==="afro"
      ? "M45 60 C30 74 32 104 44 126"
      : "M47 58 C30 75 32 112 47 141";
  const sideLockRight = cfg.hair==="bob"
    ? "M114 59 C129 78 127 114 111 139"
    : cfg.hair==="afro"
      ? "M115 60 C130 74 128 104 116 126"
      : "M113 58 C130 75 128 112 113 141";

  return <svg viewBox="0 0 160 178" width={size} height={size} style={{display:"block",overflow:"visible",filter:"drop-shadow(0 14px 14px rgba(0,0,0,.34))"}}>
    <defs>
      <radialGradient id={`${uid}-bg`} cx="35%" cy="18%" r="78%">
        <stop offset="0%" stopColor="rgba(255,255,255,.45)"/>
        <stop offset="42%" stopColor="rgba(255,255,255,.08)"/>
        <stop offset="100%" stopColor="rgba(0,0,0,.16)"/>
      </radialGradient>
      <linearGradient id={`${uid}-skin`} x1="42" y1="46" x2="106" y2="126">
        <stop offset="0%" stopColor="#FFE0BE"/>
        <stop offset="45%" stopColor={skin}/>
        <stop offset="100%" stopColor="#8C4C32"/>
      </linearGradient>
      <linearGradient id={`${uid}-hair`} x1="46" y1="18" x2="112" y2="140">
        <stop offset="0%" stopColor="#7A5530"/>
        <stop offset="42%" stopColor={hair}/>
        <stop offset="100%" stopColor="#120806"/>
      </linearGradient>
      <linearGradient id={`${uid}-shirt`} x1="42" y1="124" x2="118" y2="174">
        <stop offset="0%" stopColor="#4B2412"/>
        <stop offset="55%" stopColor="#1D0E08"/>
        <stop offset="100%" stopColor="#070302"/>
      </linearGradient>
      <radialGradient id={`${uid}-eye`} cx="36%" cy="34%" r="65%">
        <stop offset="0%" stopColor="#FFFFFF"/>
        <stop offset="34%" stopColor="#FFFFFF"/>
        <stop offset="100%" stopColor="#E6D6C4"/>
      </radialGradient>
      <filter id={`${uid}-softShadow`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity=".28"/>
      </filter>
    </defs>

    <g style={animated?{animation:"avatarIdlePro 3.4s ease-in-out infinite",transformOrigin:"80px 92px"}:null}>
      <ellipse cx="80" cy="162" rx="52" ry="12" fill="rgba(0,0,0,.26)"/>
      <circle cx="80" cy="82" r="70" fill={`url(#${uid}-bg)`} opacity=".95"/>
      <circle cx="55" cy="31" r="32" fill="rgba(255,255,255,.12)"/>
      {cfg.aura!=="none"&&<circle cx="80" cy="82" r="72" fill="none" stroke={frameGlow} strokeWidth="4" opacity=".72"/>}

      {/* Pelo trasero: siempre queda por detrás de la cara. Con gorra se recorta para que no parezca calva ni moño mal pegado. */}
      {hasCap&&cfg.hair!=="fade"&&<g fill="none" stroke={`url(#${uid}-hair)`} strokeLinecap="round" strokeWidth={cfg.hair==="afro"?13:10} opacity=".96">
        <path d={sideLockLeft}/>
        <path d={sideLockRight}/>
        {cfg.hair.includes("dreads")&&<><path d="M58 62 C46 82 49 113 57 139"/><path d="M102 62 C114 82 111 113 103 139"/></>}
      </g>}

      {!hasCap&&cfg.hair==="dreadsLong"&&<g fill="none" stroke={`url(#${uid}-hair)`} strokeLinecap="round" strokeWidth="10">
        {["M43 48 C21 62 20 97 35 137","M55 38 C34 61 36 100 50 145","M105 38 C126 61 124 100 110 145","M117 48 C139 62 140 97 125 137","M62 34 C51 62 54 98 61 131","M98 34 C109 62 106 98 99 131"].map((d,i)=><path key={i} d={d} style={animated?{animation:`${i%2?"dreadSwing2":"dreadSwing"} ${2.6+i*.12}s ease-in-out infinite`,transformOrigin:"80px 44px"}:null}/>)}
        <g fill="#D4AF37" stroke="none"><circle cx="50" cy="112" r="3"/><circle cx="111" cy="108" r="3"/><circle cx="37" cy="126" r="2.6"/></g>
      </g>}

      {!hasCap&&cfg.hair==="dreadsBun"&&<g>
        <g fill="none" stroke={`url(#${uid}-hair)`} strokeLinecap="round" strokeWidth="9">
          <path d="M50 45 C31 63 35 100 48 135"/>
          <path d="M110 45 C129 63 125 100 112 135"/>
          <path d="M61 39 C53 63 56 98 63 125"/>
          <path d="M99 39 C107 63 104 98 97 125"/>
        </g>
        <ellipse cx="80" cy="30" rx="27" ry="17" fill={`url(#${uid}-hair)`} filter={`url(#${uid}-softShadow)`}/>
        <path d="M60 31 C70 18 91 18 101 31" stroke="rgba(255,255,255,.22)" strokeWidth="4" strokeLinecap="round" fill="none"/>
      </g>}

      {!hasCap&&cfg.hair==="dreadsTop"&&<g fill="none" stroke={`url(#${uid}-hair)`} strokeLinecap="round" strokeWidth="9">
        <path d="M49 47 C34 62 37 95 50 128"/>
        <path d="M111 47 C126 62 123 95 110 128"/>
        <path d="M64 35 C55 18 68 9 78 24"/>
        <path d="M78 25 C84 7 100 13 92 34"/>
        <path d="M88 35 C100 18 114 29 100 45"/>
        <path d="M72 38 C78 27 90 29 93 42"/>
      </g>}

      {!hasCap&&cfg.hair==="afro"&&<g fill={`url(#${uid}-hair)`} filter={`url(#${uid}-softShadow)`}>
        {[["50","48","19"],["68","34","23"],["92","34","23"],["110","48","19"],["40","70","19"],["120","70","19"],["80","24","24"]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r}/>)}
      </g>}

      {!hasCap&&cfg.hair==="punk"&&<path d="M39 72 C44 39 58 16 80 3 C102 16 116 39 121 72 C103 55 57 55 39 72Z" fill={`url(#${uid}-hair)`} filter={`url(#${uid}-softShadow)`}/>}
      {!hasCap&&cfg.hair==="fade"&&<path d="M43 70 C49 42 61 31 80 31 C99 31 111 42 117 70 C99 58 61 58 43 70Z" fill={`url(#${uid}-hair)`}/>}
      {!hasCap&&cfg.hair==="bob"&&<path d="M38 78 C35 47 51 28 80 28 C109 28 125 47 122 78 C119 112 106 132 97 144 C95 115 65 115 63 144 C54 132 41 112 38 78Z" fill={`url(#${uid}-hair)`} filter={`url(#${uid}-softShadow)`}/>}

      <g style={animated?{animation:"avatarBreathPro 4.2s ease-in-out infinite",transformOrigin:"80px 140px"}:null}>
        <path d="M49 151 C54 131 65 122 80 122 C95 122 106 131 111 151 C102 166 58 166 49 151Z" fill={`url(#${uid}-shirt)`} filter={`url(#${uid}-softShadow)`}/>
        <path d="M62 142 C68 133 73 130 80 130 C87 130 93 133 98 142 C91 150 69 150 62 142Z" fill="rgba(212,175,55,.24)"/>
        <path d="M68 124 C70 113 90 113 92 124 L91 137 C86 143 74 143 69 137Z" fill={`url(#${uid}-skin)`}/>
      </g>

      <path d={`M${80-faceW} ${cheekY} C${80-faceW-5} 41 ${80-faceW+8} 31 80 31 C${80+faceW-8} 31 ${80+faceW+5} 41 ${80+faceW} ${cheekY} C${80+faceW+2} 98 98 ${jawY} 80 ${jawY} C62 ${jawY} ${80-faceW-2} 98 ${80-faceW} ${cheekY}Z`} fill={`url(#${uid}-skin)`} filter={`url(#${uid}-softShadow)`}/>

      {/* Pelo delantero / nacimiento del pelo. Esta capa tapa la frente y evita el efecto calva. */}
      {!hasCap&&!hasBandana&&["dreadsLong","dreadsBun","dreadsTop","fade"].includes(cfg.hair)&&<path d="M45 62 C51 41 64 32 80 32 C96 32 109 41 115 62 C98 53 62 53 45 62Z" fill={`url(#${uid}-hair)`}/>}
      {!hasCap&&!hasBandana&&cfg.hair==="bob"&&<path d="M42 68 C46 41 60 31 80 31 C100 31 114 41 118 68 C101 54 59 54 42 68Z" fill={`url(#${uid}-hair)`}/>}
      {!hasCap&&!hasBandana&&cfg.hair==="afro"&&<path d="M42 67 C47 45 59 34 80 32 C101 34 113 45 118 67 C98 53 62 53 42 67Z" fill={`url(#${uid}-hair)`}/>}
      {!hasCap&&!hasBandana&&cfg.hair==="punk"&&<path d="M45 69 C52 49 64 40 80 39 C96 40 108 49 115 69 C98 58 62 58 45 69Z" fill={`url(#${uid}-hair)`}/>}

      <path d="M62 112 C69 119 91 119 98 112 C93 128 67 128 62 112Z" fill="rgba(90,45,28,.12)"/>

      {hasBandana&&<g>
        <path d="M42 58 C55 45 105 45 118 58 L115 74 C96 65 64 65 45 74Z" fill={bandanaColor} filter={`url(#${uid}-softShadow)`}/>
        <path d="M57 56 C67 51 94 51 104 56" stroke="rgba(255,255,255,.32)" strokeWidth="3" strokeLinecap="round"/>
        <path d="M113 61 L134 53 L122 78Z" fill={bandanaColor}/>
        <path d="M48 72 C58 64 101 64 112 72" stroke="rgba(0,0,0,.2)" strokeWidth="2" strokeLinecap="round"/>
      </g>}

      {hasCap&&<g filter={`url(#${uid}-softShadow)`}>
        <path d="M39 67 C43 40 58 24 80 23 C102 24 117 40 121 67 L117 79 C97 69 63 69 43 79Z" fill={capColor}/>
        <path d="M45 68 C57 60 103 60 116 68 L114 77 C96 70 64 70 46 77Z" fill="rgba(0,0,0,.18)"/>
        <path d="M91 68 C116 65 139 72 149 83" fill="none" stroke={capColor} strokeWidth="11" strokeLinecap="round"/>
        <path d="M55 53 C66 44 96 44 107 53" stroke="rgba(255,255,255,.32)" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <circle cx="80" cy="38" r="4" fill="rgba(255,255,255,.35)"/>
        <path d="M57 75 C69 70 91 70 103 75" stroke={`url(#${uid}-hair)`} strokeWidth="6" strokeLinecap="round" opacity={cfg.hair==="fade"?0.55:0.9}/>
      </g>}

      {cfg.accessory==="crown"&&<g filter={`url(#${uid}-softShadow)`}>
        <path d="M49 60 L57 34 L72 54 L80 27 L89 54 L104 34 L112 60 Z" fill="#D4AF37"/>
        <path d="M50 60 L112 60" stroke="#FFF1A8" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="80" cy="34" r="4" fill="#FFF1A8"/>
      </g>}

      <path d={browShape} stroke="#1A0C06" strokeWidth={cfg.brows==="thin"?2.2:4.2} strokeLinecap="round" fill="none"/>
      <g style={animated?{animation:"eyeBlink 5.2s ease-in-out infinite",transformOrigin:"80px 84px"}:null}>
        <ellipse cx="64" cy="85" rx={eyeRx} ry={eyeRy} fill={`url(#${uid}-eye)`}/>
        <ellipse cx="96" cy="85" rx={eyeRx} ry={eyeRy} fill={`url(#${uid}-eye)`}/>
        <ellipse cx="64" cy="85" rx="3.8" ry="4.9" fill={eye}/><circle cx="62.5" cy="83.2" r="1.35" fill="#fff"/>
        <ellipse cx="96" cy="85" rx="3.8" ry="4.9" fill={eye}/><circle cx="94.5" cy="83.2" r="1.35" fill="#fff"/>
      </g>
      <path d="M78 91 C80 98 79 102 74 105" stroke="#9B5A38" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      <path d="M66 111 C75 119 87 119 96 111" stroke="#7F2B1A" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
      <path d="M69 115 C76 119 86 119 92 115" stroke="rgba(255,255,255,.38)" strokeWidth="1.8" strokeLinecap="round"/>

      {cfg.facial==="moustache"&&<path d="M63 105 C71 99 77 103 80 108 C83 103 89 99 97 105" stroke={`url(#${uid}-hair)`} strokeWidth="5" strokeLinecap="round" fill="none"/>}
      {cfg.facial==="goatee"&&<g><path d="M64 106 C72 102 88 102 96 106" stroke={`url(#${uid}-hair)`} strokeWidth="3.5" strokeLinecap="round" fill="none"/><path d="M77 118 Q80 130 84 118" stroke={`url(#${uid}-hair)`} strokeWidth="5" strokeLinecap="round" fill="none"/></g>}
      {cfg.facial==="beard"&&<path d="M49 101 C57 135 103 135 111 101 C100 125 60 125 49 101Z" fill={`url(#${uid}-hair)`} opacity=".82"/>}
      {cfg.facial==="full"&&<path d="M44 94 C49 139 111 139 116 94 C101 130 59 130 44 94Z" fill={`url(#${uid}-hair)`} opacity=".88"/>}

      {cfg.accessory==="earring"&&<g><circle cx="46" cy="94" r="3.4" fill="#FFD66B"/><circle cx="114" cy="94" r="3.4" fill="#FFD66B"/></g>}
      {cfg.accessory==="hoopGold"&&<g stroke="#FFD66B" strokeWidth="2.8" fill="none"><circle cx="46" cy="94" r="6"/><circle cx="114" cy="94" r="6"/></g>}
      {(cfg.accessory==="glasses"||cfg.accessory==="glassesGold")&&<g stroke={cfg.accessory==="glassesGold"?"#D4AF37":"#1A120C"} strokeWidth="3.2" fill="rgba(255,255,255,.08)">
        <circle cx="64" cy="85" r="11.4"/><circle cx="96" cy="85" r="11.4"/><path d="M75 85 L85 85"/>
        <path d="M53 83 L46 80 M107 83 L114 80" strokeLinecap="round"/>
      </g>}
      {cfg.accessory==="piercing"&&<circle cx="90" cy="104" r="2.4" fill="#D4AF37"/>}

      <path d="M54 51 C66 37 96 37 107 51" stroke="rgba(255,255,255,.18)" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M54 69 C51 87 55 106 65 116" stroke="rgba(255,255,255,.16)" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </g>
  </svg>;
}
function Av({av=0,config=null,size=36}){
  const cfg=normalizeAvatarConfig(config,av);
  const frame={none:`2px solid rgba(255,244,214,.9)`,bronze:`3px solid #C97934`,gold:`3px solid #D4AF37`,neon:`3px solid #5FD7FF`,legend:`3px solid #FFF1A8`}[cfg.frame]||`2px solid rgba(255,244,214,.9)`;
  const aura={none:"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)",warm:"0 0 22px rgba(212,175,55,.45), 0 8px 18px rgba(20,8,4,.28)",flame:"0 0 26px rgba(240,106,59,.55), 0 8px 18px rgba(20,8,4,.28)",ocean:"0 0 26px rgba(95,215,255,.45), 0 8px 18px rgba(20,8,4,.28)",vip:"0 0 30px rgba(255,241,168,.7), 0 8px 18px rgba(20,8,4,.28)"}[cfg.aura]||"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)";
  return <div title={avatarStyleName(cfg)} style={{width:size,height:size,borderRadius:"50%",background:bgGradient(cfg.bg),display:"flex",alignItems:"center",justifyContent:"center",border:frame,boxShadow:aura,position:"relative",overflow:"hidden",perspective:500}}>
    {cfg.aura!=="none"&&<span style={{position:"absolute",inset:3,borderRadius:"50%",background:"radial-gradient(circle at 35% 18%,rgba(255,255,255,.28),transparent 42%)",pointerEvents:"none"}}/>}
    <span style={{position:"absolute",top:0,bottom:0,width:"38%",left:"-45%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)",animation:size>70?"avatarShinePro 5.2s ease-in-out infinite":"none"}}/>
    <AvatarFigure config={cfg} size={size*1.18} animated={size>=70}/>
  </div>;
}
function CharacterCard({idx,selected,onPick,compact=false}){
  const cfg=normalizeAvatarConfig(AVATAR_PRESETS[idx%AVATAR_PRESETS.length],idx);
  return <button type="button" onClick={()=>{SFX.tab();onPick(idx);}} style={{background:selected?"linear-gradient(180deg,#FFF4D6,#F6E5BE)":"rgba(255,244,214,.72)",border:`2px solid ${selected?T.gold:T.g200}`,borderRadius:18,padding:compact?8:10,cursor:"pointer",boxShadow:selected?"0 10px 24px rgba(212,175,55,.3)":"0 6px 16px rgba(20,8,4,.12)",textAlign:"center",transition:"all .18s ease"}}>
    <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Av av={idx} config={cfg} size={compact?48:62}/></div>
    <div style={{fontWeight:900,fontSize:compact?".7rem":".78rem",color:T.g800,lineHeight:1.05}}>{AVATAR_LABELS[cfg.hair]}</div>
    {!compact&&<div style={{fontSize:".66rem",fontWeight:800,color:T.textSub,marginTop:2}}>{avatarStyleName(cfg)}</div>}
  </button>;
}
function PickerButton({active,children,onClick,locked=false}){
  return <button type="button" onClick={()=>{if(locked){SFX.error();return;}SFX.tab();onClick?.();}} style={{border:`2px solid ${active?T.gold:T.g200}`,background:active?T.gradGold:locked?"rgba(60,40,25,.18)":"rgba(255,244,214,.72)",color:active?T.g900:locked?T.textSub:T.g700,borderRadius:12,padding:"8px 9px",fontWeight:900,fontSize:".72rem",cursor:locked?"not-allowed":"pointer",boxShadow:active?"0 8px 18px rgba(212,175,55,.25)":"0 5px 12px rgba(20,8,4,.1)"}}>{locked?"🔒 ":""}{children}</button>;
}
function ColorDot({color,active,onClick}){
  return <button type="button" onClick={()=>{SFX.tab();onClick?.();}} style={{width:32,height:32,borderRadius:"50%",background:color,border:`3px solid ${active?T.gold:"rgba(255,244,214,.9)"}`,boxShadow:active?"0 0 0 3px rgba(212,175,55,.25)":"0 4px 10px rgba(20,8,4,.18)",cursor:"pointer"}}/>;
}
function AvatarEditor({form,setForm,ownedKeys=[]}){
  const [panel,setPanel]=useState("base");
  const cfg=normalizeAvatarConfig(form.avatarConfig,form.avatar);
  const premiumKeys=new Set(ownedKeys||[]);
  const isLocked=(slot,value)=>COSMETIC_CATALOG_FALLBACK.some(c=>c.slot===slot&&c.valor===value&&!premiumKeys.has(c.item_key));
  const patch=(key,value)=>{if(isLocked(key,value)){SFX.error();return;}setForm(f=>({...f,avatarConfig:normalizeAvatarConfig({...cfg,[key]:value},f.avatar)}));};
  const randomize=()=>setForm(f=>({...f,avatarConfig:randomAvatarConfig(),avatar:Math.floor(Math.random()*AVATAR_PRESETS.length)}));
  const preset=(idx)=>setForm(f=>({...f,avatar:idx,avatarConfig:normalizeAvatarConfig(AVATAR_PRESETS[idx],idx)}));
  const basicAccessories=AVATAR_OPTIONS.accessory.filter(v=>!["capBlack","capGold","glassesGold","bandanaGreen","crown","hoopGold"].includes(v));
  const panels=[
    {id:"base",label:"Base",icon:"👤"},
    {id:"pelo",label:"Pelo",icon:"💇"},
    {id:"cara",label:"Cara",icon:"👀"},
    {id:"extras",label:"Extras",icon:"🎩"},
  ];
  return <div>
    <Card style={{textAlign:"center",background:"radial-gradient(circle at 50% 20%,rgba(255,241,168,.24),transparent 34%),linear-gradient(160deg,#160B07,#3A1E10 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.72)",color:T.white,marginBottom:12,overflow:"hidden"}}>
      <div style={{fontSize:".7rem",fontWeight:950,letterSpacing:".7px",textTransform:"uppercase",opacity:.75}}>Cabina de personaje</div>
      <div style={{display:"flex",justifyContent:"center",margin:"6px 0 8px"}}><Av av={form.avatar} config={cfg} size={150}/></div>
      <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.5rem",textShadow:"0 4px 10px rgba(0,0,0,.35)"}}>{AVATAR_LABELS[cfg.hair]} · {AVATAR_LABELS[cfg.accessory]}</div>
      <div style={{fontSize:".78rem",fontWeight:800,opacity:.86}}>Estilo pseudo-3D con piezas ancladas: gorra, gafas y rastas ya no flotan.</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
        <Btn small col="gold" onClick={randomize}>🎲 Aleatorio</Btn>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
      {panels.map(p=><button key={p.id} onClick={()=>{SFX.tab();setPanel(p.id);}} style={{border:`2px solid ${panel===p.id?T.gold:T.g300}`,background:panel===p.id?T.gradGold:"rgba(255,244,214,.82)",color:panel===p.id?T.g900:T.g700,borderRadius:16,padding:"8px 4px",fontWeight:950,cursor:"pointer",boxShadow:panel===p.id?"0 10px 22px rgba(212,175,55,.24)":"0 5px 12px rgba(20,8,4,.1)"}}>
        <div style={{fontSize:"1.05rem",lineHeight:1}}>{p.icon}</div><div style={{fontSize:".68rem",marginTop:3}}>{p.label}</div>
      </button>)}
    </div>

    {panel==="base"&&<>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🎭 Presets de personaje</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>{AVATAR_PRESETS.slice(0,8).map((_,i)=><CharacterCard key={i} idx={i} compact selected={Number(form.avatar)===i} onPick={preset}/>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🖼️ Fondo</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.bg.map(v=><PickerButton key={v} active={cfg.bg===v} locked={isLocked("bg",v)} onClick={()=>patch("bg",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>✨ Marco</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.frame.map(v=><PickerButton key={v} active={cfg.frame===v} locked={isLocked("frame",v)} onClick={()=>patch("frame",v)}>{AVATAR_LABELS[v]||v}</PickerButton>)}</div>
    </>}

    {panel==="pelo"&&<>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>💇 Peinado</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.hair.map(v=><PickerButton key={v} active={cfg.hair===v} onClick={()=>patch("hair",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🎨 Color de pelo</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{AVATAR_OPTIONS.hairColor.map((c,i)=><ColorDot key={c} color={c} active={cfg.hairColor===i} onClick={()=>patch("hairColor",i)}/>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🧔 Barba / bigote</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.facial.map(v=><PickerButton key={v} active={cfg.facial===v} onClick={()=>patch("facial",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
    </>}

    {panel==="cara"&&<>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>👤 Forma y piel</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.face.map(v=><PickerButton key={v} active={cfg.face===v} onClick={()=>patch("face",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{AVATAR_OPTIONS.skin.map((c,i)=><ColorDot key={c} color={c} active={cfg.skin===i} onClick={()=>patch("skin",i)}/>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>👀 Ojos</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.eyes.map(v=><PickerButton key={v} active={cfg.eyes===v} onClick={()=>patch("eyes",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>{AVATAR_OPTIONS.brows.map(v=><PickerButton key={v} active={cfg.brows===v} onClick={()=>patch("brows",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{AVATAR_OPTIONS.eyeColor.map((c,i)=><ColorDot key={c} color={c} active={cfg.eyeColor===i} onClick={()=>patch("eyeColor",i)}/>)}</div>
    </>}

    {panel==="extras"&&<>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🎩 Complementos básicos</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{basicAccessories.map(v=><PickerButton key={v} active={cfg.accessory===v} onClick={()=>patch("accessory",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🔓 Complementos desbloqueables</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{["capBlack","capGold","glassesGold","bandanaGreen","crown","hoopGold"].map(v=><PickerButton key={v} active={cfg.accessory===v} locked={isLocked("accessory",v)} onClick={()=>patch("accessory",v)}>{AVATAR_LABELS[v]}</PickerButton>)}</div>
      <div style={{fontWeight:900,color:T.g800,margin:"8px 0"}}>🌟 Aura</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>{AVATAR_OPTIONS.aura.map(v=><PickerButton key={v} active={cfg.aura===v} locked={isLocked("aura",v)} onClick={()=>patch("aura",v)}>{AVATAR_LABELS[v]||v}</PickerButton>)}</div>
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

        {/* Eyes */}
        <ellipse cx="158" cy="136" rx="24" ry="24" fill="#FFF" />
        <ellipse cx="224" cy="136" rx="24" ry="24" fill="#FFF" />
        <g style={{transformOrigin:"158px 136px",animation:"eyeBlink 4.8s ease-in-out infinite"}}>
          <ellipse cx="158" cy="136" rx="14" ry="16" fill="#17110D" />
          <ellipse cx="154" cy="131" rx="4" ry="4.5" fill="#fff" />
        </g>
        <g style={{transformOrigin:"224px 136px",animation:"eyeBlink 5s ease-in-out infinite"}}>
          <ellipse cx="224" cy="136" rx="14" ry="16" fill="#17110D" />
          <ellipse cx="220" cy="131" rx="4" ry="4.5" fill="#fff" />
        </g>

        {/* Nose and mouth */}
        <path d="M185 149 C189 161, 189 169, 183 174" fill="none" stroke="#CF8B61" strokeWidth="4" strokeLinecap="round" />
        <path d="M178 156 Q191 165 204 156" fill="none" stroke="#A55A45" strokeWidth="4" strokeLinecap="round" />
        <path d="M159 184 C173 199, 210 199, 224 184" fill="none" stroke="#8B2F1C" strokeWidth="7" strokeLinecap="round" />
        <path d="M168 188 C178 196, 203 196, 215 188" fill="#FFF2F2" opacity=".42" />

        {/* Crochet hook */}
        <g style={{animation:"hookMove 1.7s ease-in-out infinite",transformOrigin:"278px 146px"}}>
          <path d="M286 168 C264 139, 236 128, 208 121" fill="none" stroke="#E2D6C2" strokeWidth="5" strokeLinecap="round" />
          <path d="M286 168 q11 0 11 -11 q0 -8 -8 -8" fill="none" stroke="#E2D6C2" strokeWidth="5" strokeLinecap="round" />
          <path d="M281 161 C267 145, 248 138, 232 130" fill="none" stroke="#7E4A28" strokeWidth="3" strokeLinecap="round" opacity=".55" />
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

function toAppUser(u){
  const avatarConfig=normalizeAvatarConfig(u.avatar_config || u.avatarConfig, u.avatar);
  return {
    id:u.id,
    nombre:u.nombre,
    email:u.email,
    rol:normalizeRole(u.role || u.rol),
    puntos:u.puntos||0,
    avatar:u.avatar||0,
    avatarConfig,
    avatar_config:avatarConfig,
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
  if(data) data.avatar_config=await getAvatarConfigForProfile(data);
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
    await saveAvatarConfigForUser(data,cfg);
  }
  return data;
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
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.g900} 0%,${T.g700} 50%,${T.g600} 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:460}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <HeroMascot/>
          <div style={{fontFamily:"'Rubik Wet Paint','Bangers',cursive",fontSize:"3.35rem",lineHeight:.92,letterSpacing:"2px",color:"#FFD66B",textShadow:"0 4px 0 #4A1F0A, 0 10px 18px rgba(0,0,0,0.48)",transform:"rotate(-1deg)"}}>{BRAND.name}</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:10,padding:"7px 14px",background:"rgba(255,244,214,.1)",border:"1px solid rgba(255,214,107,.28)",borderRadius:999,backdropFilter:"blur(6px)"}}>
            <span className="icon3d" style={{fontSize:"1.05rem"}}>🪮</span>
            <span style={{color:T.g150,fontSize:"0.84rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"1px"}}>{BRAND.tagline}</span>
            <span className="icon3d" style={{fontSize:"1.05rem"}}>✂️</span>
          </div>
          <div style={{color:"rgba(245,230,200,0.88)",fontSize:"0.82rem",marginTop:7,fontWeight:700,maxWidth:320,marginInline:"auto"}}>{BRAND.subtagline}. Vibra de estudio urbano, look anime y rastas con estilo.</div>
        </div>
        <Card style={{padding:"28px 24px",animation:"softPop3d 0.42s ease",background:"linear-gradient(180deg,#FFF4D6 0%,#F7E0AE 100%)",border:"2px solid #C97934",boxShadow:"0 18px 40px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.75)"}}>
          <div style={{display:"flex",background:T.g100,borderRadius:12,padding:4,marginBottom:22}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setFormError("");}} style={{flex:1,padding:"8px",borderRadius:10,border:"none",background:mode===m?T.white:"transparent",color:mode===m?T.g800:T.textSub,fontWeight:800,fontSize:"0.85rem",cursor:"pointer",transition:"all 0.2s"}}>
                {m==="login"?"Entrar":"Registrarse"}
              </button>
            ))}
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
              <Btn full col="dark" onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar"}</Btn>
            </div>
          ):(
            <div>
              <Input label="Nombre completo" value={name} onChange={setName} placeholder="Tu nombre"/>
              <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com"/>
              <Input label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres"/>
              <Btn full col="green" onClick={handleRegister} disabled={loading}>{loading?"Registrando...":"Crear cuenta"}</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// DASHBOARD ADMIN
function DashboardAdmin({user}){
  const [stats,setStats]=useState({citas:0,clientes:0,ingresos:0,stockBajo:0});
  const [citasHoy,setCitasHoy]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    async function load(){
      const today=new Date().toISOString().split("T")[0];
      const [citas,clientes,ventas,stock]=await Promise.all([
        dbGet("citas",`?fecha=gte.${today}&select=*`),
        dbGet("usuarios","?role=eq.client&select=id"),
        dbGet("facturas",`?fecha=gte.${today}&select=total`),
        dbGet("inventario","?stock=lte.5&select=id"),
      ]);
      setStats({citas:(citas||[]).length,clientes:(clientes||[]).length,ingresos:(ventas||[]).reduce((s,v)=>s+(v.total||0),0),stockBajo:(stock||[]).length});
      setCitasHoy((citas||[]).slice(0,5));setLoading(false);
    }
    load();
  },[]);
  if(loading)return <Spinner/>;
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏠" title={`Hola, ${user.nombre?.split(" ")[0]}`} sub={new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <StatCard icon="📅" label="Citas hoy" value={stats.citas} col="green"/>
        <StatCard icon="👥" label="Clientes" value={stats.clientes} col="blue"/>
        <StatCard icon="💰" label="Ingresos hoy" value={`${stats.ingresos.toFixed(2)}€`} col="gold"/>
        <StatCard icon="📦" label="Stock bajo" value={stats.stockBajo} col={stats.stockBajo>0?"pink":"green"}/>
      </div>
      <Card>
        <div style={{fontWeight:800,fontSize:"0.95rem",color:T.g800,marginBottom:12}}>Proximas citas</div>
        {citasHoy.length===0?<EmptyState icon="📅" title="Sin citas hoy" sub="Dia tranquilo"/>
          :citasHoy.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.g100}`}}>
              <div><div style={{fontWeight:700,fontSize:"0.88rem"}}>{c.cliente_nombre||"Cliente"}</div><div style={{fontSize:"0.75rem",color:T.textSub}}>{c.servicio}</div></div>
              <div style={{fontWeight:800,color:T.g600}}>{c.hora}</div>
            </div>
          ))
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
      <Card style={{marginBottom:16,background:"linear-gradient(160deg,#FFF4D6,#E9D9B7 55%,#D4AF37)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div className="icon3d" style={{fontSize:"2.4rem"}}>🧑🏾‍🦱</div>
          <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>Bienvenido a Rasta Cuts</div><div style={{fontSize:".84rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>Reserva, juega, gana puntos, lee anuncios oficiales y entra al foro para hablar con la comunidad.</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:12}}>
          <Btn small col="gold" onClick={()=>onNavigate?.("feed")}>📌 Ver tablón</Btn>
          <Btn small col="dark" onClick={()=>onNavigate?.("foro")}>🗣️ Ir al foro</Btn>
          <Btn small col="ghost" onClick={()=>onNavigate?.("noticias")}>📰 Actualidad</Btn>
          <Btn small col="pink" onClick={()=>onNavigate?.("juegos")}>🎮 Jugar</Btn>
        </div>
      </Card>
      <Card style={{background:"linear-gradient(135deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.4)",marginBottom:16,padding:"20px",color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:"0.8rem",fontWeight:700}}>Hola de nuevo!</div>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.4rem",color:T.white}}>{user.nombre?.split(" ")[0]}</div>
            <div style={{marginTop:6}}><Badge col="gold">{nivel}</Badge></div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.75)",fontWeight:700}}>TUS PUNTOS</div>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"2rem",color:T.white}}>{user.puntos||0}</div>
          </div>
        </div>
        <div style={{marginTop:14,height:8,background:"rgba(255,255,255,0.25)",borderRadius:50,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(((user.puntos||0)/1000)*100,100)}%`,background:T.white,borderRadius:50,transition:"width 0.6s ease"}}/>
        </div>
      </Card>
      {proxCita&&(
        <Card style={{marginBottom:16,background:T.g50}}>
          <div style={{fontWeight:800,color:T.g700,marginBottom:8}}>Tu proxima cita</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:700}}>{proxCita.servicio}</div><div style={{fontSize:"0.8rem",color:T.textSub}}>{proxCita.fecha}</div></div>
            <Badge col="green">{proxCita.hora}</Badge>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
        {[["📅","Cita","citas"],["🛍️","Tienda","tienda"],["🎮","Jugar","juegos"]].map(([icon,lbl,id])=>(
          <Card key={lbl} onClick={()=>onNavigate?.(id)} style={{textAlign:"center",padding:"14px 8px",background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",minHeight:92}} hover>
            <div className="icon3d" style={{fontSize:"2rem"}}>{icon}</div>
            <div style={{fontSize:"0.75rem",fontWeight:900,color:T.g700,marginTop:6}}>{lbl}</div>
          </Card>
        ))}
      </div>
      <ActualidadMini onNavigate={onNavigate}/>
      {noticias.length>0&&(
        <div>
          <div style={{fontWeight:800,color:T.g800,marginBottom:10}}>Novedades</div>
          {noticias.map(n=>(
            <Card key={n.id} style={{marginBottom:10}} hover>
              <div style={{fontWeight:800,color:T.g800}}>{n.emoji} {n.titulo||n.contenido?.slice(0,40)}</div>
              <div style={{fontSize:"0.8rem",color:T.textSub,marginTop:4}}>{n.contenido}</div>
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
  {id:"negocios",label:"Negocios locales",short:"Negocios",icon:"💼",desc:"ideas, emprender y comercio cercano"},
];
const CATEGORY_COLORS={
  todo:{accent:"#D4AF37",bg:"linear-gradient(135deg,#FFF4D6,#F6E5BE)",dark:"#6E3518"},
  curiosidades:{accent:"#7B3FA1",bg:"linear-gradient(135deg,#EFE3FF,#FFF4D6)",dark:"#3C2258"},
  rural:{accent:"#65762C",bg:"linear-gradient(135deg,#EEF1CF,#FFF4D6)",dark:"#3D471A"},
  comer:{accent:"#C97934",bg:"linear-gradient(135deg,#FFE7B0,#FFF4D6)",dark:"#6E3518"},
  sitios:{accent:"#2F6B42",bg:"linear-gradient(135deg,#E9F5DE,#FFF4D6)",dark:"#214E31"},
  estilo:{accent:"#8B0000",bg:"linear-gradient(135deg,#FCE4EC,#FFF4D6)",dark:"#5C0F0F"},
  negocios:{accent:"#1A3A5C",bg:"linear-gradient(135deg,#E3F2FD,#FFF4D6)",dark:"#10263F"},
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
async function fetchNews(category="todo"){
  const res=await fetch(`/api/news?category=${encodeURIComponent(category)}&day=${new Date().toISOString().split("T")[0]}`);
  const data=await res.json();
  const items=Array.isArray(data.news)?data.news:[];
  return items.length?items:NEWS_FALLBACK;
}
function trimSummary(text=""){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  if(!clean)return "Resumen breve no disponible. Pulsa para leer la fuente original.";
  return clean.length>185?`${clean.slice(0,182).trim()}...`:clean;
}
function newsIconFor(cat){return categoryInfo(cat).icon;}
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
  const imageBlock=hasImage?(
    <div style={{width:compact?84:"100%",height:compact?90:featured?184:138,flex:"0 0 auto",backgroundImage:`linear-gradient(180deg,rgba(20,8,4,.02),rgba(20,8,4,.36)), url(${item.image})`,backgroundSize:"cover",backgroundPosition:"center",borderRadius:compact?18:"20px 20px 0 0",border:compact?`1px solid rgba(255,244,214,.65)`:"none"}}/>
  ):(
    <div style={{width:compact?84:"100%",height:compact?90:featured?150:112,flex:"0 0 auto",display:"grid",placeItems:"center",background:`radial-gradient(circle at 20% 20%,rgba(255,255,255,.32),transparent 34%),${visual.bg}`,borderRadius:compact?18:"20px 20px 0 0",border:compact?`1px solid ${T.g300}`:"none"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:compact?"2rem":"3rem",filter:"drop-shadow(0 6px 8px rgba(0,0,0,.20))"}}>{cat.icon}</div>{!compact&&<div style={{fontWeight:950,color:visual.dark,fontSize:".74rem",letterSpacing:".5px",textTransform:"uppercase"}}>{cat.short}</div>}</div>
    </div>
  );
  return <Card onClick={openNews} hover style={{marginBottom:compact?10:14,padding:compact?12:0,overflow:"hidden",background:"linear-gradient(180deg,#FFF9E9 0%,#F5E0B8 100%)",border:`2px solid ${featured?T.gold:T.g300}`,boxShadow:featured?"0 18px 42px rgba(20,8,4,.28), inset 0 1px 0 rgba(255,255,255,.68)":"0 10px 24px rgba(20,8,4,.18), inset 0 1px 0 rgba(255,255,255,.55)"}}>
    <div style={{display:compact?"flex":"block",gap:12,alignItems:"stretch"}}>
      {imageBlock}
      <div style={{padding:compact?0:"14px 15px 15px",minWidth:0,flex:1}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
          <span style={{background:visual.accent,color:"#FFF8E5",borderRadius:50,padding:"3px 9px",fontSize:".66rem",fontWeight:950,letterSpacing:".25px"}}>{cat.icon} {cat.short}</span>
          <span style={{background:"rgba(255,244,214,.82)",color:T.g700,border:`1px solid ${T.g200}`,borderRadius:50,padding:"3px 8px",fontSize:".66rem",fontWeight:900}}>{item?.source||"Fuente"}</span>
          {!compact&&<span style={{fontSize:".68rem",fontWeight:900,color:T.textSub,marginLeft:"auto"}}>{formatNewsDate(item?.date)}</span>}
        </div>
        <div style={{fontWeight:950,color:T.g900,fontSize:featured?"1.18rem":compact?".92rem":"1rem",lineHeight:1.16,letterSpacing:"-.15px",display:"-webkit-box",WebkitLineClamp:compact?2:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{title}</div>
        <div style={{fontSize:compact?".76rem":".84rem",fontWeight:750,color:T.textSub,lineHeight:1.38,marginTop:7,display:"-webkit-box",WebkitLineClamp:compact?2:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{summary}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:10}}>
          <span style={{fontSize:".72rem",fontWeight:900,color:visual.accent}}>Abrir debate y fuente</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:".7rem",fontWeight:950,color:T.g700}}>👍 {stats?.likes||0}</span>
            <span style={{fontSize:".7rem",fontWeight:950,color:T.g700}}>💬 {stats?.comments||0}</span>
            <span style={{width:30,height:30,borderRadius:12,display:"grid",placeItems:"center",background:visual.accent,color:"#FFF8E5",fontWeight:950,boxShadow:"0 6px 14px rgba(20,8,4,.22)"}}>↗</span>
          </div>
        </div>
      </div>
    </div>
  </Card>;
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
      <div style={{background:`radial-gradient(circle at 15% 10%,rgba(255,255,255,.22),transparent 35%),${visual.bg}`,border:`2px solid ${visual.accent}`,borderRadius:22,padding:14,marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><Badge col="gold">{cat.icon} {cat.label}</Badge><Badge col="green">{item.source||"Fuente"}</Badge></div>
        <div style={{fontWeight:950,color:T.g900,fontSize:"1.2rem",lineHeight:1.18}}>{item.title}</div>
        <div style={{fontSize:".86rem",fontWeight:750,color:T.textSub,lineHeight:1.42,marginTop:8}}>{trimSummary(item.summary)}</div>
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          <Btn small col="gold" onClick={()=>window.open(item.url,"_blank","noopener,noreferrer")}>Leer fuente original ↗</Btn>
          <Btn small col={liked?"ghost":"dark"} disabled={loading||liked} onClick={like}>{liked?"👍 Te gusta":"👍 Me gusta"}</Btn>
        </div>
        <div style={{display:"flex",gap:10,marginTop:10,fontSize:".75rem",fontWeight:900,color:T.g700}}><span>👍 {likes}</span><span>💬 {comments.length}</span><span>{formatNewsDate(item.date)}</span></div>
      </div>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF8E5,#F6E5BE)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:7}}>Unirse al hilo</div>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Comenta algo útil: recomendación, experiencia, sitio parecido, opinión o dato que ayude a otros." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"11px 12px",background:"#FFF8E5",resize:"none",outline:"none",fontSize:".9rem",fontWeight:750,color:T.text}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:9}}><div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>+5 pts por tu primer comentario en esta noticia. Bonos al comentar 3 y 10 noticias distintas.</div><Btn small onClick={sendComment} disabled={loading}>Comentar</Btn></div>
      </Card>
      <div style={{fontWeight:950,color:T.g800,margin:"4px 0 10px"}}>Comentarios</div>
      {comments.length===0?<EmptyState icon="💬" title="Sin comentarios todavía" sub="Sé el primero en abrir el hilo."/>:comments.map(c=><Card key={c.id} style={{marginBottom:9,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)"}}>
        <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:7}}><Av av={c.usuario_avatar||0} config={c.usuario_avatar_config} size={32}/><div><div style={{fontWeight:950,color:T.g800,fontSize:".86rem"}}>{c.usuario_nombre||"Usuario"}</div><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>{formatNewsDate(c.created_at)}</div></div></div>
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
      try{const list=await fetchNews("todo");if(alive)setItems(list.slice(0,3));}
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
  const curiosity=getDailyCuriosity();

  useEffect(()=>{
    let alive=true;
    async function load(){
      setLoading(true);setError("");
      try{
        const list=await fetchNews(category);
        if(alive){setItems(list);loadStats(list);}
      }catch(e){
        const fallback=category==="todo"?NEWS_FALLBACK:NEWS_FALLBACK.filter(n=>n.category===category);
        if(alive){const final=fallback.length?fallback:NEWS_FALLBACK;setItems(final);loadStats(final);setError("No se han podido cargar todas las fuentes. Te dejo una selección de respaldo.");}
      }finally{if(alive)setLoading(false);}
    }
    load();return()=>{alive=false;};
  },[category]);

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
    setLoading(true);
    fetchNews(category)
      .then(list=>{setItems(list);setError("");loadStats(list);})
      .catch(()=>setError("No se han podido actualizar ahora."))
      .finally(()=>setLoading(false));
  }

  function bumpStat(newsId,type){
    setStats(s=>({...s,[newsId]:{comments:(s[newsId]?.comments||0)+(type==="comment"?1:0),likes:(s[newsId]?.likes||0)+(type==="like"?1:0)}}));
  }

  const featured=items[0];
  const secondary=items.slice(1,3);
  const rest=items.slice(3,15);
  const active=categoryInfo(category);

  return <div style={{animation:"fadeSlide .35s ease"}}>
    <Card style={{marginBottom:12,padding:0,overflow:"hidden",background:"linear-gradient(135deg,#1B0D07,#3A1E10 58%,#9A4F22)",border:"2px solid rgba(255,244,214,.55)",color:T.white}}>
      <div style={{padding:"14px 14px",position:"relative"}}>
        <div style={{position:"absolute",right:-24,top:-30,fontSize:"6rem",opacity:.08,transform:"rotate(-8deg)"}}>📰</div>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",position:"relative",zIndex:1}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:".68rem",fontWeight:950,letterSpacing:".65px",textTransform:"uppercase",color:"rgba(255,244,214,.75)"}}>Portada diaria</div>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.55rem",lineHeight:1}}>Actualidad útil</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.88,lineHeight:1.32,marginTop:4}}>Noticias, curiosidades y planes en formato revista, con menos scroll y selección renovada.</div>
          </div>
          <Btn small col="gold" onClick={reload}>Actualizar</Btn>
        </div>
      </div>
    </Card>

    <div style={{display:"flex",gap:8,overflowX:"auto",padding:"0 2px 10px",marginBottom:6}}>
      {NEWS_CATEGORIES.map(c=>{
        const selectedCat=category===c.id,visual=categoryVisual(c.id);
        return <button key={c.id} onClick={()=>{SFX.tab();setCategory(c.id);}} style={{minWidth:96,whiteSpace:"nowrap",border:`2px solid ${selectedCat?visual.accent:T.g300}`,background:selectedCat?visual.bg:"rgba(255,244,214,.78)",color:selectedCat?T.g900:T.g700,borderRadius:999,padding:"8px 10px",fontWeight:950,cursor:"pointer",boxShadow:selectedCat?"0 10px 20px rgba(20,8,4,.18)":"0 5px 12px rgba(20,8,4,.1)"}}>
          <span style={{fontSize:"1rem",marginRight:5}}>{c.icon}</span>{c.short}
        </button>;
      })}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:10,marginBottom:12}}>
      <Card style={{background:"linear-gradient(180deg,#FFF8E5,#F6E5BE)",border:`2px solid ${T.g300}`,padding:12}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:44,height:44,borderRadius:16,display:"grid",placeItems:"center",background:categoryVisual("curiosidades").bg,fontSize:"1.45rem"}}>💡</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:".65rem",fontWeight:950,color:T.g600,textTransform:"uppercase"}}>Curiosidad · {curiosity.tag}</div>
            <div style={{fontWeight:950,color:T.g900,lineHeight:1.12,fontSize:".92rem"}}>{curiosity.title}</div>
            <div style={{fontSize:".75rem",fontWeight:750,lineHeight:1.28,color:T.textSub,marginTop:4,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{curiosity.text}</div>
          </div>
        </div>
      </Card>
      <Card style={{background:"linear-gradient(180deg,#F6E5BE,#E6C27A)",border:`2px solid ${T.g300}`,padding:12}}>
        <div style={{fontWeight:950,color:T.g800,fontSize:".86rem",marginBottom:8}}>Participa</div>
        <div style={{display:"grid",gap:6}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".74rem",fontWeight:900,color:T.textSub}}><span>👍 Primer like</span><b style={{color:T.g800}}>+1</b></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".74rem",fontWeight:900,color:T.textSub}}><span>💬 Primer comentario</span><b style={{color:T.g800}}>+3</b></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".74rem",fontWeight:900,color:T.textSub}}><span>🔥 Hitos</span><b style={{color:T.g800}}>+8/+20</b></div>
        </div>
      </Card>
    </div>

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"4px 2px 10px"}}>
      <div><div style={{fontWeight:950,color:T.g800}}>{active.icon} {active.label}</div><div style={{fontSize:".74rem",fontWeight:800,color:T.textSub}}>Abre una tarjeta para comentar y seguir el hilo.</div></div>
      <Badge col="gold">{items.length||0}</Badge>
    </div>

    {error&&<Card style={{marginBottom:10,background:"#FFF0E5",border:"2px solid #E8871A"}}><div style={{fontWeight:950,color:T.g800}}>Aviso</div><div style={{fontSize:".8rem",fontWeight:750,color:T.textSub}}>{error}</div></Card>}

    {loading?<Spinner/>:items.length===0?<EmptyState icon="📰" title="No hay selección ahora" sub="Prueba otra categoría o actualiza en unos minutos."/>:<>
      {featured&&<div style={{marginBottom:10}}><NewsCard item={featured} featured stats={stats[String(featured.id)]} onOpen={setSelected}/></div>}
      {secondary.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:10}}>
        {secondary.map(n=><NewsCard key={n.id} item={n} compact stats={stats[String(n.id)]} onOpen={setSelected}/>)}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {rest.map(n=><NewsCard key={n.id} item={n} compact stats={stats[String(n.id)]} onOpen={setSelected}/>)}
      </div>
    </>}

    <NewsDetailModal item={selected} user={user} setUser={setUser} showToast={showToast} showPoints={showPoints} onClose={()=>setSelected(null)} onChanged={bumpStat}/>
  </div>;
}

// CITAS
const SERVICIOS=[
  {id:"corte",label:"Corte",precio:15},{id:"color",label:"Coloracion",precio:45},
  {id:"mechas",label:"Mechas",precio:60},{id:"lavado",label:"Lavado",precio:12},
  {id:"tratamiento",label:"Tratamiento",precio:25},{id:"alisado",label:"Alisado",precio:55},
  {id:"recogido",label:"Recogido",precio:30},
];
const HORARIOS=["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"];

function Citas({user,showToast}){
  const [citas,setCitas]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({servicio:"corte",fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});
  const [ocupados,setOcupados]=useState([]);
  const isAdmin=user?.rol!==ROLES.CLIENT;
  useEffect(()=>{loadCitas();},[]);
  async function loadCitas(){
    setLoading(true);
    const q=isAdmin?"?order=fecha.asc,hora.asc&select=*":`?usuario_id=eq.${user.id}&order=fecha.asc&select=*`;
    setCitas(await dbGet("citas",q)||[]);setLoading(false);
  }
  async function checkHorarios(fecha){if(!fecha)return;const data=await dbGet("citas",`?fecha=eq.${fecha}&select=hora`);setOcupados((data||[]).map(c=>c.hora));}
  async function saveCita(){
    if(!form.fecha||!form.hora){showToast("Selecciona fecha y hora");return;}
    const serv=SERVICIOS.find(s=>s.id===form.servicio);
    await dbPost("citas",{...form,usuario_id:user.id,estado:"pendiente",servicio_precio:serv?.precio,servicio_label:serv?.label});
    showToast("Cita reservada");SFX.success();setShowNew(false);setForm({servicio:"corte",fecha:"",hora:"",notas:"",cliente_nombre:user?.nombre||""});loadCitas();
  }
  const eColor={pendiente:"gold",confirmada:"green",cancelada:"red",completada:"blue"};
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📅" title="Citas" sub={isAdmin?"Gestion de citas":"Tus citas"} action={<Btn small onClick={()=>setShowNew(true)}>+ Nueva</Btn>}/>
      {loading?<Spinner/>:citas.length===0?<EmptyState icon="📅" title="Sin citas" sub="Reserva la primera"/>
        :citas.map(c=>(
          <Card key={c.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:800,fontSize:"0.92rem"}}>{c.servicio_label||c.servicio}</div>
                <div style={{fontSize:"0.8rem",color:T.textSub}}>{c.cliente_nombre}</div>
                <div style={{fontSize:"0.78rem",color:T.textSub,marginTop:2}}>{c.fecha} · {c.hora}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <Badge col={eColor[c.estado]||"green"}>{c.estado}</Badge>
                {c.servicio_precio&&<span style={{fontWeight:800,color:T.g600,fontSize:"0.88rem"}}>{c.servicio_precio}€</span>}
              </div>
            </div>
            {c.estado==="pendiente"&&(
              <div style={{marginTop:10,display:"flex",gap:8}}>
                {isAdmin&&<Btn small col="green" onClick={()=>{dbPatch("citas",`?id=eq.${c.id}`,{estado:"confirmada"});loadCitas();}}>Confirmar</Btn>}
                <Btn small col="red" onClick={()=>{dbPatch("citas",`?id=eq.${c.id}`,{estado:"cancelada"});loadCitas();}}>Cancelar</Btn>
              </div>
            )}
          </Card>
        ))
      }
      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nueva cita">
        {isAdmin&&<Input label="Nombre del cliente" value={form.cliente_nombre} onChange={v=>setForm(f=>({...f,cliente_nombre:v}))}/>}
        <Select label="Servicio" value={form.servicio} onChange={v=>setForm(f=>({...f,servicio:v}))} options={SERVICIOS.map(s=>({value:s.id,label:`${s.label} - ${s.precio}€`}))}/>
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
        <Input label="Notas" value={form.notas} onChange={v=>setForm(f=>({...f,notas:v}))} placeholder="Indicaciones especiales..."/>
        <Btn full onClick={saveCita}>Reservar cita</Btn>
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
  async function load(){setLoading(true);setClientes(await dbGet("usuarios","?role=eq.client&order=nombre.asc&select=*")||[]);setLoading(false);}
  async function selectCliente(c){setSelected(c);setHistorial(await dbGet("citas",`?usuario_id=eq.${c.id}&order=fecha.desc&limit=10&select=*`)||[]);}
  const filtered=clientes.filter(c=>(c.nombre||"").toLowerCase().includes(search.toLowerCase())||(c.email||"").toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👥" title="Clientes" sub={`${clientes.length} clientes`}/>
      <Input value={search} onChange={setSearch} placeholder="Buscar..."/>
      {loading?<Spinner/>:filtered.map(c=>(
        <Card key={c.id} style={{marginBottom:10}} hover onClick={()=>selectCliente(c)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Av av={c.avatar} size={44}/>
            <div style={{flex:1}}><div style={{fontWeight:800}}>{c.nombre}</div><div style={{fontSize:"0.78rem",color:T.textSub}}>{c.email}</div></div>
            <div style={{fontWeight:900,color:T.g600}}>pts {c.puntos||0}</div>
          </div>
        </Card>
      ))}
      <Modal show={!!selected} onClose={()=>setSelected(null)} title={selected?.nombre||""}>
        {selected&&(
          <div>
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
              <Av av={selected.avatar} size={56}/>
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
function Caja({showToast}){
  const [ventas,setVentas]=useState([]);const [showNew,setShowNew]=useState(false);const [loading,setLoading]=useState(true);
  const [carrito,setCarrito]=useState([]);const [metodo,setMetodo]=useState("efectivo");const [clienteNombre,setClienteNombre]=useState("");
  useEffect(()=>{loadVentas();},[]);
  async function loadVentas(){setLoading(true);const today=new Date().toISOString().split("T")[0];setVentas(await dbGet("facturas",`?fecha=gte.${today}&order=created_at.desc&select=*`)||[]);setLoading(false);}
  function addToCarrito(s){setCarrito(c=>{const ex=c.find(i=>i.id===s.id);if(ex)return c.map(i=>i.id===s.id?{...i,qty:i.qty+1}:i);return[...c,{...s,qty:1}];});}
  const total=carrito.reduce((s,i)=>s+i.precio*i.qty,0);
  async function cobrar(){
    if(!carrito.length)return;
    await dbPost("facturas",{items:JSON.stringify(carrito),total,metodo_pago:metodo,cliente_nombre:clienteNombre,fecha:new Date().toISOString().split("T")[0]});
    SFX.coins();showToast(`Cobrado ${total.toFixed(2)}€`);setCarrito([]);setClienteNombre("");setShowNew(false);loadVentas();
  }
  const totalHoy=ventas.reduce((s,v)=>s+(v.total||0),0);
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="💰" title="Caja" sub={`Hoy: ${totalHoy.toFixed(2)}€`} action={<Btn small onClick={()=>setShowNew(true)}>+ Venta</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <StatCard icon="💶" label="Efectivo" value={`${ventas.filter(v=>v.metodo_pago==="efectivo").reduce((s,v)=>s+(v.total||0),0).toFixed(2)}€`} col="green"/>
        <StatCard icon="💳" label="Tarjeta" value={`${ventas.filter(v=>v.metodo_pago==="tarjeta").reduce((s,v)=>s+(v.total||0),0).toFixed(2)}€`} col="blue"/>
      </div>
      {loading?<Spinner/>:ventas.length===0?<EmptyState icon="💰" title="Sin ventas hoy" sub=""/>
        :ventas.map(v=>(
          <Card key={v.id} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:800}}>{v.cliente_nombre||"Anonimo"}</div><div style={{fontSize:"0.75rem",color:T.textSub}}>{v.metodo_pago}</div></div>
              <div style={{fontWeight:900,fontSize:"1.1rem",color:T.g600}}>{(v.total||0).toFixed(2)}€</div>
            </div>
          </Card>
        ))
      }
      <Modal show={showNew} onClose={()=>setShowNew(false)} title="Nueva venta">
        <Input label="Cliente (opcional)" value={clienteNombre} onChange={setClienteNombre}/>
        <div style={{fontWeight:800,color:T.g700,marginBottom:8,fontSize:"0.85rem"}}>Servicios</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {SERVICIOS.map(s=><button key={s.id} onClick={()=>addToCarrito(s)} style={{padding:"8px 12px",borderRadius:10,border:`1.5px solid ${T.g300}`,background:T.g50,cursor:"pointer",fontSize:"0.8rem",fontWeight:700}}>{s.label} {s.precio}€</button>)}
        </div>
        {carrito.length>0&&(
          <div style={{background:T.g50,borderRadius:12,padding:12,marginBottom:14}}>
            {carrito.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:"0.85rem",marginBottom:4}}><span>{i.label} x{i.qty}</span><span style={{fontWeight:800}}>{(i.precio*i.qty).toFixed(2)}€</span></div>)}
            <div style={{borderTop:`1px solid ${T.g200}`,marginTop:8,paddingTop:8,fontWeight:900,display:"flex",justifyContent:"space-between"}}><span>TOTAL</span><span style={{color:T.g600}}>{total.toFixed(2)}€</span></div>
          </div>
        )}
        <Select label="Metodo de pago" value={metodo} onChange={setMetodo} options={[{value:"efectivo",label:"Efectivo"},{value:"tarjeta",label:"Tarjeta"},{value:"bizum",label:"Bizum"}]}/>
        <Btn full col="gold" onClick={cobrar} disabled={!carrito.length}>Cobrar {total.toFixed(2)}€</Btn>
      </Modal>
    </div>
  );
}

// ADMIN USUARIOS
function AdminUsuarios({user,showToast}){
  const canManageUsers=user?.rol===ROLES.ADMIN;
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{if(canManageUsers) load(); else setLoading(false);},[canManageUsers]);
  async function load(){setLoading(true);setUsers(await dbGet("usuarios","?order=nombre.asc&select=*")||[]);setLoading(false);}
  async function changeRole(id,rol){if(!canManageUsers)return;await dbPatch("usuarios",`?id=eq.${id}`,{role:rol});showToast("Rol actualizado");load();}
  if(!canManageUsers){
    return <EmptyState icon="🔒" title="Solo administradores" sub="Esta sección permite cambiar roles y gestionar usuarios."/>;
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👑" title="Usuarios" sub={`${users.length} usuarios`}/>
      {loading?<Spinner/>:users.map(u=>(
        <Card key={u.id} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Av av={u.avatar} size={40}/>
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
      dbGet("usuarios","?select=id,nombre,role,puntos,avatar,visitas")
    ]);
    setPosts(Array.isArray(raw)?raw:[]);setProfiles(Array.isArray(users)?users:[]);setLoading(false);
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
          <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Escribe una promoción, aviso, norma, actualización o evento..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:'#F3E7CA',resize:"none",outline:"none",boxShadow:'inset 0 2px 8px rgba(20,8,4,.06)'}}/>
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
          <div onClick={()=>setSelectedProfile(a)} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,cursor:'pointer'}}><Av av={a.avatar} config={a.avatarConfig} size={34}/><div><div style={{fontWeight:900,color:T.g800,fontSize:'.86rem'}}>{a.nombre || 'Equipo Rasta'}</div><div style={{fontSize:'.68rem',fontWeight:800,color:T.textSub,textTransform:'uppercase'}}>{normalizeRole(a.role||a.rol)==='client'?'cliente':normalizeRole(a.role||a.rol)}</div></div></div>
          <div style={{fontSize:"0.93rem",fontWeight:700,color:T.text,lineHeight:1.55,whiteSpace:'pre-wrap'}}>{p.contenido}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <span style={{fontSize:"0.76rem",color:T.textSub,fontWeight:800}}>{p.created_at?new Date(p.created_at).toLocaleDateString("es-ES"):""}</span>
            <button onClick={()=>likePost(p)} style={{background:'#F3E7CA',border:`1.5px solid ${T.g200}`,cursor:"pointer",fontSize:"0.8rem",color:T.g700,fontWeight:900,padding:'7px 12px',borderRadius:999}}>❤️ {p.likes_count||0}</button>
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
      dbGet("usuarios","?select=id,nombre,role,puntos,avatar,visitas"),
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
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe tu duda, idea o propuesta..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:'#F3E7CA',resize:"none",outline:"none"}}/>
      <div style={{marginTop:10}}><Btn full col="gold" onClick={createTopic}>➕ Crear tema</Btn></div>
    </Card>}
    {shown? <div>
      <Btn small col="ghost" onClick={()=>setActive(null)} style={{marginBottom:10}}>← Volver al foro</Btn>
      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>{shown.titulo||"Tema del foro"}</div>
        <div style={{fontSize:".9rem",fontWeight:700,lineHeight:1.5,whiteSpace:'pre-wrap',marginTop:8}}>{shown.contenido}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,alignItems:"center"}}><Badge col="blue">{getReplies(shown.id).length} respuestas</Badge><Btn small col="gold" onClick={()=>vote(shown)}>👍 Votar {shown.likes_count||0}</Btn></div>
      </Card>
      {getReplies(shown.id).map(r=><Card key={r.id} style={{marginBottom:8,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)"}}><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,cursor:"pointer"}} onClick={()=>setSelectedProfile({id:r.autor_id,nombre:r.autor_nombre,avatar:r.autor_avatar,avatar_config:r.autor_avatar_config,puntos:0})}><Av av={r.autor_avatar} config={r.autor_avatar_config} size={30}/><b>{r.autor_nombre||"Usuario"}</b></div><div style={{fontSize:".86rem",fontWeight:700,lineHeight:1.45,whiteSpace:'pre-wrap'}}>{r.contenido}</div></Card>)}
      <Card><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Responder al tema..." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px",background:'#F3E7CA',resize:"none"}}/><div style={{marginTop:8}}><Btn full onClick={()=>addReply(shown)}>Responder</Btn></div></Card>
    </div> : loading?<Spinner/>:topics.length===0?<EmptyState icon="🗣️" title="Foro vacío" sub="Sé el primero en abrir un tema."/>:topics.map(t=>{const a=authorOf(t);return <Card key={t.id} hover onClick={()=>setActive(t)} style={{marginBottom:10}}><div style={{display:"flex",gap:10,alignItems:"center"}}><Av av={a.avatar} config={a.avatar_config||a.avatarConfig} size={36}/><div style={{flex:1}}><div style={{fontWeight:900,color:T.g800}}>{t.titulo||t.contenido?.slice(0,48)||"Tema"}</div><div style={{fontSize:".75rem",fontWeight:800,color:T.textSub}}>{a.nombre||"Usuario"} · 👍 {t.likes_count||0} · 💬 {getReplies(t.id).length}</div></div></div></Card>;})}
    <PublicProfileModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)}/>
  </div>;
}

// TIENDA
function Tienda({user,setUser,showToast,showPoints}){
  const [productos,setProductos]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setProductos(await dbGet("premios","?activo=eq.true&order=puntos_precio.asc&select=*")||[]);setLoading(false);}
  async function canjear(p){
    if((user.puntos||0)<p.puntos_precio){showToast("No tienes suficientes puntos");SFX.error();return;}
    const nuevos=user.puntos-p.puntos_precio;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    await dbPost("canjes",{usuario_id:user.id,premio_id:p.id,premio_nombre:p.nombre,puntos_gastados:p.puntos_precio});
    setUser(u=>({...u,puntos:nuevos}));SFX.coins();showToast(`${p.nombre} canjeado!`);
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🛍️" title="Tienda" sub={`Tienes ${user.puntos||0} pts`}/>
      <Card style={{background:T.gradGold,border:"none",marginBottom:16,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:T.white}}><div style={{fontSize:"0.78rem",fontWeight:700,opacity:0.85}}>TUS PUNTOS</div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"2rem"}}>{user.puntos||0}</div></div>
          <div style={{fontSize:"2.5rem"}}>🎁</div>
        </div>
      </Card>
      {loading?<Spinner/>:productos.length===0?<EmptyState icon="🛍️" title="Sin premios aun" sub="Pronto habra novedades"/>
        :productos.map(p=>{
          const ok=(user.puntos||0)>=p.puntos_precio;
          return(
            <Card key={p.id} style={{marginBottom:12,border:ok?`2px solid ${T.g400}`:`1px solid ${T.g150}`,opacity:ok?1:0.75}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}><div style={{fontWeight:800}}>{p.nombre}</div><div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{p.descripcion}</div></div>
                <div style={{fontWeight:900,color:T.orange,fontSize:"1.1rem",marginLeft:12}}>{p.puntos_precio} pts</div>
              </div>
              <div style={{marginTop:12}}>{ok?<Btn full small col="gold" onClick={()=>canjear(p)}>Canjear</Btn>:<div style={{textAlign:"center",fontSize:"0.78rem",color:T.textSub,fontWeight:700}}>Faltan {p.puntos_precio-(user.puntos||0)} pts</div>}</div>
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
const GAME_DAILY_REWARDS={stitch:15,runner:12,jump:12,memoria:15,sopa:15,trivia:8};
const GAME_DAILY_CAP=45;
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
    const entry={user_id:user.id,nombre:user.nombre||"Jugador",avatar:user.avatar||0,avatar_config:user.avatarConfig||user.avatar_config||null,score:Number(score)||0,created_at:new Date().toISOString()};
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
  const [jumping,setJumping]=useState(false);
  const [score,setScore]=useState(0);
  const [obstacles,setObstacles]=useState([{x:112,id:1}]);
  const [gameOver,setGameOver]=useState(false);

  function resetAndStart(){
    setScore(0);
    setObstacles([{x:112,id:Date.now()}]);
    setGameOver(false);
    setJumping(false);
    setRunning(true);
  }

  useEffect(()=>{
    if(!running) return;
    const onKey=e=>{ if(e.code==='Space' || e.key==='ArrowUp'){ e.preventDefault(); doJump(); } };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[running,jumping,gameOver]);

  function doJump(){
    if(!running||jumping||gameOver) return;
    SFX.tab();
    setJumping(true);
    setTimeout(()=>setJumping(false),760);
  }

  useEffect(()=>{
    if(!running) return;
    const timer=setInterval(()=>{
      setScore(s=>s+1);
      setObstacles(prev=>{
        let next=prev.map(o=>({...o,x:o.x-2.45})).filter(o=>o.x>-18);
        const last=next[next.length-1];
        if(!last || last.x<42+Math.random()*16) next=[...next,{x:112+Math.random()*18,id:Date.now()+Math.random()}];
        const hit=next.some(o=>o.x<23 && o.x>9 && !jumping);
        if(hit){
          clearInterval(timer);
          setRunning(false);
          setGameOver(true);
          SFX.error();
        }
        return next;
      });
    },125);
    return ()=>clearInterval(timer);
  },[running,jumping]);

  const pts=Math.max(6, Math.min(40, Math.floor(score/5)));
  return <Card style={{background:'linear-gradient(180deg,#F4E5BE,#E7CA8A)',border:`2px solid ${T.g300}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:8}}><div style={{fontWeight:900,color:T.g800}}>🦖✂️ Rasta Runner</div><Badge col='gold'>Modo fácil</Badge></div>
    <div
      onPointerDown={doJump}
      style={{position:'relative',height:188,borderRadius:20,overflow:'hidden',background:'linear-gradient(180deg,#DDEBFF,#FFF0C9 72%,#C7A25C 72%)',border:'2px solid rgba(62,35,18,.15)',touchAction:'manipulation',cursor:running?'pointer':'default'}}
    >
      <div style={{position:'absolute',left:0,right:0,bottom:28,height:4,background:'#6E3518'}}/>
      <div style={{position:'absolute',left:14,bottom:jumping?84:32,transition:'bottom .22s ease'}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={42}/></div>
      <div style={{position:'absolute',left:10,bottom:8,fontSize:'.76rem',fontWeight:900,color:T.g700}}>Distancia: {score}</div>
      <div style={{position:'absolute',right:10,bottom:8,fontSize:'.72rem',fontWeight:900,color:T.g700}}>Toca la pista para saltar</div>
      {obstacles.map((o,i)=><div key={o.id||i} style={{position:'absolute',left:`${o.x}%`,bottom:22,fontSize:'1.45rem',filter:'drop-shadow(0 3px 4px rgba(0,0,0,.22))'}}>✂️</div>)}
      {!running && !gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,248,230,.42)',padding:18}}><div style={{textAlign:'center'}}><div style={{fontWeight:900,color:T.g800,marginBottom:10}}>Velocidad rebajada, saltos más largos y menos tijeras.</div><Btn col='gold' onClick={resetAndStart}>▶ Empezar suave</Btn></div></div>}
      {gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(40,20,10,.52)',padding:16}}><div style={{textAlign:'center',color:T.white}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.45rem'}}>¡Buen intento!</div><div style={{fontWeight:800,margin:'8px 0 12px'}}>Distancia {score} · récord {pts}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><Btn col='gold' onClick={()=>onWin(pts)}>Guardar récord</Btn><Btn col='ghost' onClick={resetAndStart}>🔁 Reintentar</Btn></div></div></div>}
    </div>
    <div style={{marginTop:10,fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45}}>Controles: toca la pantalla, botón Saltar, espacio o flecha arriba. Ahora el ritmo es más cómodo para móvil.</div>
    {running && <div style={{marginTop:10}}><Btn full col='dark' onClick={doJump}>⤴️ Saltar</Btn></div>}
  </Card>;
}

function PlatformJumpGame({onWin,user}){
  const [lane,setLane]=useState(1);
  const [rows,setRows]=useState([]);
  const [running,setRunning]=useState(false);
  const [score,setScore]=useState(0);
  const [gameOver,setGameOver]=useState(false);
  function resetAndStart(){setRows([{id:1,y:0,safeLane:1}]);setLane(1);setScore(0);setGameOver(false);setRunning(true);}
  function move(dir){setLane(l=>Math.max(0,Math.min(2,l+dir)));SFX.click();}
  useEffect(()=>{
    if(!running) return;
    const onKey=e=>{
      if(e.key==='ArrowLeft') move(-1);
      if(e.key==='ArrowRight') move(1);
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[running]);
  useEffect(()=>{
    if(!running) return;
    const timer=setInterval(()=>{
      setRows(prev=>{
        let next=prev.map(r=>({...r,y:r.y+1}));
        const touch=next.find(r=>r.y>=5);
        if(touch){
          const safe=Math.abs(touch.safeLane-lane)<=0;
          if(safe){ setScore(s=>s+10); SFX.click(); }
          else { setRunning(false); setGameOver(true); SFX.error(); }
          next=next.filter(r=>r!==touch);
        }
        next=next.filter(r=>r.y<7);
        if(next.length===0 || next[next.length-1].y>2){ next=[...next,{id:Math.random(),y:0,safeLane:Math.floor(Math.random()*3)}]; }
        return next;
      });
    },720);
    return ()=>clearInterval(timer);
  },[running,lane]);
  const pts=Math.max(8, Math.min(45, Math.floor(score/6)));
  return <Card style={{background:'linear-gradient(180deg,#F0E3C1,#E4C88F)',border:`2px solid ${T.g300}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontWeight:900,color:T.g800}}>🌤️ Dread Jump</div><Badge col='pink'>Plataformas relax</Badge></div>
    <div style={{position:'relative',borderRadius:18,overflow:'hidden',background:'linear-gradient(180deg,#D8ECFF,#F7F1DA)',padding:12,border:'2px solid rgba(62,35,18,.15)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        {Array.from({length:6}).map((_,ri)=>Array.from({length:3}).map((__,ci)=>{
          const rowObj=rows.find(r=>r.y===ri && r.safeLane===ci);
          const atPlayer=ri===5 && ci===lane;
          return <div key={`${ri}-${ci}`} onClick={()=>setLane(ci)} style={{height:30,borderRadius:12,background:rowObj?'linear-gradient(180deg,#B86A2E,#6E3518)':'rgba(255,255,255,.45)',border:atPlayer?'2px solid #C0392B':'1px solid rgba(60,30,12,.12)',display:'grid',placeItems:'center',fontSize:atPlayer?'1.25rem':'1rem',cursor:'pointer'}}>{atPlayer?<Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={24}/>:rowObj?'🟫':''}</div>;
        }))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontWeight:900,fontSize:'.8rem',color:T.g700,gap:8,lineHeight:1.35}}><span>Score: {score}</span><span>Toca columna, usa botones o flechas. Cae en la plataforma marrón.</span></div>
      {!running && !gameOver && <div style={{marginTop:12}}><Btn full col='gold' onClick={resetAndStart}>▶ Empezar suave</Btn></div>}
      {gameOver && <div style={{marginTop:12,textAlign:'center'}}><div style={{fontWeight:900,color:T.g800,marginBottom:8}}>Has conseguido {score} · récord {pts}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><Btn col='gold' onClick={()=>onWin(pts)}>Guardar récord</Btn><Btn col='ghost' onClick={resetAndStart}>🔁 Reintentar</Btn></div></div>}
      {running && <div style={{display:'flex',gap:8,marginTop:12}}><Btn full col='ghost' onClick={()=>move(-1)}>⬅️ Izq.</Btn><Btn full col='dark' onClick={()=>setLane(1)}>Centro</Btn><Btn full col='ghost' onClick={()=>move(1)}>Der. ➡️</Btn></div>}
    </div>
  </Card>;
}

function DreadStitchGame({onWin,user}){
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [targets,setTargets]=useState([]);
  const [hits,setHits]=useState(0);
  const [misses,setMisses]=useState(0);
  const [badHits,setBadHits]=useState(0);
  const [time,setTime]=useState(14);
  const [round,setRound]=useState(1);
  const [completed,setCompleted]=useState(0);
  const [lastAccuracy,setLastAccuracy]=useState(100);
  const [resultMsg,setResultMsg]=useState("Listo para coser");
  const areaRef=useRef(null);
  const statsTotal=hits+misses+badHits;
  const liveAccuracy=statsTotal?Math.round((hits/statsTotal)*100):100;
  const minHits=Math.min(5+Math.floor(round/2),9);
  const earnedPts=completed>0?Math.min(100,Math.max(10,completed*12+Math.round(lastAccuracy/5))):0;

  function clearRoundStats(){
    setTargets([]);setHits(0);setMisses(0);setBadHits(0);setTime(14);
  }

  function reset(){
    clearRoundStats();
    setRound(1);setCompleted(0);setLastAccuracy(100);setResultMsg("Listo para coser");
    setFinished(false);setRunning(true);
  }

  function endGame(acc,done){
    setRunning(false);
    setFinished(true);
    setTargets([]);
    setLastAccuracy(acc);
    setResultMsg(done>0?`Has completado ${done} rasta${done===1?"":"s"}. Guarda tu récord al terminar.`:"La primera rasta salió floja. Practica y vuelve a intentarlo.");
  }

  function evaluateRound(){
    const total=hits+misses+badHits;
    const acc=total?Math.round((hits/total)*100):0;
    const goodEnough=acc>=80 && hits>=minHits;
    if(goodEnough){
      const nextCompleted=completed+1;
      setCompleted(nextCompleted);
      setRound(r=>r+1);
      setLastAccuracy(acc);
      setResultMsg(`Rasta ${round} terminada al ${acc}%. Siguiente objetivo.`);
      SFX.success();
      clearRoundStats();
    }else{
      endGame(acc,completed);
      SFX.error();
    }
  }

  useEffect(()=>{
    if(!running) return;
    const tick=setInterval(()=>setTime(t=>{
      if(t<=1){clearInterval(tick);setTimeout(evaluateRound,0);return 0;}
      return t-1;
    }),1000);
    return ()=>clearInterval(tick);
  },[running,hits,misses,badHits,completed,round,minHits]);

  useEffect(()=>{
    if(!running) return;
    const spawn=setInterval(()=>{
      setTargets(prev=>{
        const now=Date.now();
        let next=prev.filter(t=>{
          const alive=now-t.created<2400;
          if(!alive && t.kind==='good') setMisses(m=>m+1);
          return alive;
        });
        const maxTargets=Math.min(4+Math.floor(round/3),7);
        if(next.length<maxTargets){
          const kind=Math.random()<0.82?'good':'bad';
          next=[...next,{id:now+Math.random(),kind,x:10+Math.random()*78,y:16+Math.random()*62,created:now}];
        }
        return next;
      });
    },820);
    return ()=>clearInterval(spawn);
  },[running,round]);

  function hitAt(clientX,clientY){
    if(!running||!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const px=((clientX-rect.left)/rect.width)*100;
    const py=((clientY-rect.top)/rect.height)*100;
    setTargets(prev=>{
      const idx=prev.findIndex(t=>Math.abs(t.x-px)<10 && Math.abs(t.y-py)<12);
      if(idx<0) return prev;
      const target=prev[idx];
      if(target.kind==='good'){setHits(h=>h+1);SFX.success();}
      else{setBadHits(b=>b+1);SFX.error();}
      return prev.filter((_,i)=>i!==idx);
    });
  }

  return <Card style={{background:'linear-gradient(180deg,#F5E6C8,#E6C27A)',border:`2px solid ${T.gold}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:900,color:T.g800}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={36}/> Gancho Ninja</div>
      <Badge col={liveAccuracy>=80?'green':'gold'}>{liveAccuracy}% precisión</Badge>
    </div>
    <div style={{fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45,marginBottom:10}}>Cada rasta es un objetivo. Cose las rastas sueltas <b>〰️</b> y evita las tijeras <b>✂️</b>. Si la rasta queda por debajo del 80%, pierdes y se acaba la partida. Si supera el 80%, pasas a la siguiente rasta. Los puntos reales se guardan solo al terminar, cuentan una vez al día y tienen tope para no romper la tienda.</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10,textAlign:'center'}}>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.68rem',color:T.textSub}}>Objetivo</div>#{round}</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.68rem',color:T.textSub}}>Completadas</div>{completed}</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.68rem',color:T.textSub}}>Mínimo</div>{minHits} puntadas</div>
    </div>
    <div
      ref={areaRef}
      onPointerDown={e=>hitAt(e.clientX,e.clientY)}
      onPointerMove={e=>{if(e.buttons||e.pressure>0)hitAt(e.clientX,e.clientY);}}
      style={{height:270,position:'relative',overflow:'hidden',borderRadius:20,border:'2px solid rgba(62,35,18,.18)',background:'radial-gradient(circle at 25% 18%,rgba(255,214,107,.34),transparent 28%),linear-gradient(160deg,#24110A,#6E3518)',touchAction:'none',cursor:running?'crosshair':'default'}}
    >
      <div style={{position:'absolute',top:10,left:12,right:12,display:'flex',justifyContent:'space-between',fontWeight:900,color:T.white,fontSize:'.8rem',zIndex:2}}><span>⏱️ {time}s</span><span>✅ {hits} · ❌ {misses+badHits}</span></div>
      <div style={{position:'absolute',top:38,left:12,right:12,zIndex:2,height:7,borderRadius:999,background:'rgba(255,244,214,.18)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(hits/minHits)*100)}%`,background:'linear-gradient(90deg,#D4AF37,#FFF1A8)',transition:'width .2s ease'}}/></div>
      {targets.map(t=><button key={t.id} onClick={e=>{e.stopPropagation();hitAt(e.clientX,e.clientY);}} style={{position:'absolute',left:`${t.x}%`,top:`${t.y}%`,transform:'translate(-50%,-50%)',width:54,height:54,borderRadius:'50%',border:'2px solid rgba(255,244,214,.8)',background:t.kind==='good'?'linear-gradient(180deg,#FFF4D6,#D4AF37)':'linear-gradient(180deg,#FFEBEE,#C0392B)',boxShadow:'0 10px 20px rgba(0,0,0,.28)',fontSize:'1.65rem',display:'grid',placeItems:'center',cursor:'pointer'}}>{t.kind==='good'?'〰️':'✂️'}</button>)}
      {!running && !finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,244,214,.16)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:300}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem',marginBottom:8}}>Cose una rasta tras otra</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.86,marginBottom:12}}>Mantén cada objetivo por encima del 80% para seguir jugando.</div><Btn col='gold' onClick={reset}>▶ Empezar</Btn></div></div>}
      {finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(20,8,4,.72)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:300}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem'}}>{completed>0?'Partida terminada':'Rasta fallida'}</div><div style={{fontWeight:900,margin:'8px 0'}}>Última precisión {lastAccuracy}% · {completed} rastas completadas</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.85,marginBottom:12}}>{resultMsg}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>{earnedPts>0&&<Btn col='gold' onClick={()=>onWin(earnedPts)}>Guardar récord · {earnedPts}</Btn>}<Btn col='ghost' onClick={reset}>🔁 Reintentar</Btn></div></div></div>}
    </div>
  </Card>;
}

function Juegos({user,setUser,showToast,showPoints}){
  const [activeGame,setActiveGame]=useState(null);
  const [boardGame,setBoardGame]=useState("sopa");
  const [boardTick,setBoardTick]=useState(0);
  const GAMES=[
    {id:"stitch",icon:"🪝",title:"Gancho Ninja",desc:"Cose rastas con precisión",pts:GAME_DAILY_REWARDS.stitch},
    {id:"runner",icon:"✂️",title:"Rasta Runner",desc:"Esquiva tijeras en modo fácil",pts:GAME_DAILY_REWARDS.runner},
    {id:"jump",icon:"🌤️",title:"Dread Jump",desc:"Plataformas con ritmo suave",pts:GAME_DAILY_REWARDS.jump},
    {id:"memoria",icon:"🧠",title:"Memoria Pro",desc:"12 parejas, dificultad buena",pts:GAME_DAILY_REWARDS.memoria},
    {id:"sopa",icon:"🔤",title:"Sopa diaria",desc:"Sopa 14x14 que cambia cada día",pts:GAME_DAILY_REWARDS.sopa},
    {id:"trivia",icon:"💈",title:"Trivia Barber",desc:"Preguntas capilares",pts:GAME_DAILY_REWARDS.trivia}
  ];
  useEffect(()=>{
    if(activeGame) startGameMusic(activeGame);
    else stopGameMusic();
    return ()=>stopGameMusic();
  },[activeGame]);
  async function handleWin(gameId,score){
    const alreadyPlayed=getPlayedToday(gameId,user.id);
    const rawScore=Math.max(0,Number(score)||0);
    const reward=gameRewardFor(gameId,rawScore,user.id);
    saveLocalGameScore(gameId,user,rawScore);
    try{ await dbPost("game_scores",{usuario_id:user.id,usuario_nombre:user.nombre,usuario_avatar:user.avatar,usuario_avatar_config:user.avatarConfig||user.avatar_config||null,game_id:gameId,score:rawScore,week:weekKey()}); }catch{}
    setBoardTick(t=>t+1);
    if(alreadyPlayed){
      SFX.success();
      showToast(`Récord guardado. Los puntos de ${gameId} ya estaban cobrados hoy.`);
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
      </div>
    );
  }
  const lb=getLocalGameLeaderboard(boardGame);
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎮" title="Rasta Arcade" sub="Arcade táctil con avatar propio, sopas diarias y récords semanales"/>
      <Card style={{marginBottom:14,background:"linear-gradient(160deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
        <div style={{fontWeight:900,marginBottom:6}}>🎧 Modo juego agradable</div>
        <div style={{fontSize:".82rem",fontWeight:800,opacity:.86,lineHeight:1.45}}>Los runners van más suaves, pero Memoria y Sopa mantienen dificultad real. Los récords pueden ser altos, pero los puntos reales están limitados para que los premios sigan teniendo valor.</div>
      </Card>
      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:900,color:T.g800,marginBottom:6}}>⚖️ Economía diaria equilibrada</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.45}}>Cada juego solo da puntos reales una vez al día. Máximo por juego: 8–15 pts. Límite diario total de Arcade: {GAME_DAILY_CAP} pts. Puedes rejugar para mejorar récords sin romper la tienda.</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:16}}>
        {GAMES.map(g=>{
          const played=getPlayedToday(g.id,user.id);
          const best=getMyBestScore(g.id,user.id);
          return(
            <Card key={g.id} style={{opacity:played?0.72:1,background:played?"linear-gradient(180deg,#EBD8A8,#D7B777)":"linear-gradient(135deg,#FFF4D6,#F6E5BE)",border:played?`1px solid ${T.g300}`:`2px solid ${T.gold}`}} hover>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div className="icon3d" style={{fontSize:"2.55rem"}}>{g.icon}</div>
                <div style={{flex:1}}><div style={{fontWeight:900,fontSize:"1rem"}}>{g.title}</div><div style={{fontSize:"0.78rem",color:T.textSub,fontWeight:800}}>{g.desc}</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}><span style={{fontSize:"0.75rem",color:T.orange,fontWeight:900}}>🏅 Máx. +{g.pts} pts reales/día</span><span style={{fontSize:"0.75rem",color:T.g700,fontWeight:900}}>📈 Récord: {best}</span></div></div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>{played&&<Badge col="green">✅ Puntos hoy</Badge>}<Btn small col="gold" onClick={()=>setActiveGame(g.id)}>{played?"🔁 Rejugar":"▶ Jugar"}</Btn></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card style={{background:"linear-gradient(160deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div><div style={{fontWeight:900}}>🏆 Top 10 semanal por juego</div><div style={{fontSize:".72rem",opacity:.75,fontWeight:700}}>Se actualiza y guarda el récord local de la semana</div></div>
          <div style={{fontWeight:900,color:T.gold}}>{weekKey()}</div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:'wrap'}}>
          {GAMES.map(g=><button key={g.id} onClick={()=>{SFX.tab();setBoardGame(g.id);}} style={{flex:'1 1 18%',border:"none",borderRadius:12,padding:"8px 4px",background:boardGame===g.id?T.gradGold:"rgba(255,244,214,.18)",color:boardGame===g.id?T.g900:T.white,fontWeight:900,cursor:"pointer"}} title={g.title}>{g.icon}</button>)}
        </div>
        {lb.length===0?<div style={{fontSize:".82rem",fontWeight:800,opacity:.8,textAlign:"center",padding:"10px"}}>Sé el primero en marcar puntuación esta semana ✨</div>:lb.map((r,i)=><div key={`${r.user_id}-${i}-${boardTick}`} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<lb.length-1?"1px solid rgba(255,244,214,.18)":"none"}}><div style={{width:28,fontWeight:900}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div><Av av={r.avatar} config={r.avatar_config||r.avatarConfig} size={32}/><div style={{flex:1,fontWeight:900}}>{r.nombre}</div><div style={{color:T.gold,fontWeight:900}}>{r.score}</div></div>)}
      </Card>
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
              <Av av={u.avatar} config={u.avatar_config||u.avatarConfig} size={42}/>
              <div style={{flex:1}}><div style={{fontWeight:900}}>{u.nombre||"Cliente"}{isMe?" · tú":""}</div><div style={{fontSize:".72rem",color:T.textSub,fontWeight:800}}>{avatarStyleName(normalizeAvatarConfig(u.avatar_config||u.avatarConfig,u.avatar))}</div></div>
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
  return <Card style={{marginBottom:16,background:"linear-gradient(180deg,#FFF8E5,#F6E5BE)",border:`2px solid ${T.g300}`}}>
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
      <div style={{display:"flex",justifyContent:"center",margin:"4px 0 8px"}}><Av av={user.avatar} config={{...currentConfig,...cosmeticPatch(item)}} size={68}/></div>
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
  const [form,setForm]=useState({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarConfig(user.avatarConfig||user.avatar_config,user.avatar)});
  useEffect(()=>{setForm({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarConfig(user.avatarConfig||user.avatar_config,user.avatar)});setOwnedCosmetics(localOwnedCosmetics(user));},[user.id,user.nombre,user.avatar,user.avatarConfig]);
  async function save(){
    const cfg=normalizeAvatarConfig(form.avatarConfig,form.avatar);
    await dbPatch("usuarios",`?id=eq.${user.id}`,{nombre:form.nombre,avatar:form.avatar});
    await saveAvatarConfigForUser({...user,nombre:form.nombre,avatar:form.avatar},cfg);
    setUser(u=>({...u,nombre:form.nombre,avatar:form.avatar,avatarConfig:cfg,avatar_config:cfg}));
    SFX.success();showToast("Personaje actualizado");
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


function Comunidad(props){
  const {initialTab="feed",showToast}=props;
  const [sub,setSub]=useState(initialTab||"feed");
  useEffect(()=>{setSub(initialTab||"feed");},[initialTab]);
  const tabs=[
    {id:"feed",icon:"📌",label:"Tablón",sub:"Anuncios oficiales, promociones y novedades de la tienda."},
    {id:"foro",icon:"🗣️",label:"Foro",sub:"Temas abiertos, dudas, votaciones y conversación entre usuarios."},
    {id:"noticias",icon:"📰",label:"Actualidad",sub:"Curiosidades, rural, comida, sitios, peluquería y negocios locales."},
  ];
  const active=tabs.find(t=>t.id===sub)||tabs[0];
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{marginBottom:14,background:"linear-gradient(160deg,#24110A,#5C3317 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.6)",color:T.white,padding:"18px 16px"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.8rem",lineHeight:1}}>Comunidad</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.82)",lineHeight:1.35}}>Un solo sitio para leer, participar y volver a tus hilos sin perderte entre pestañas.</div>
        </div>
        <div className="icon3d" style={{fontSize:"2.1rem"}}>🌐</div>
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
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
  </div>;
}

const NAV_CFG={
  admin:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"usuarios",icon:"👑",label:"Usuarios"},{id:"perfil",icon:"👤",label:"Perfil"}],
  staff:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"citas",icon:"📅",label:"Citas"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"inventario",icon:"📦",label:"Stock"},{id:"perfil",icon:"👤",label:"Perfil"}],
  client:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"perfil",icon:"👤",label:"Perfil"}],
};
const GRAD_ROLE={admin:T.gradAdmin,staff:T.gradStaff,client:T.gradClient};

const HELP_TEXTS={
  dashboard:"Aquí ves tu resumen principal: puntos, próxima cita y accesos rápidos.",
  comunidad:"Aquí están el Tablón, el Foro y Actualidad: lee anuncios, abre temas, comenta noticias y vuelve a tus hilos.",
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
  usuarios:"Aquí un admin puede cambiar roles y permisos."
};
function HelperMascot({page}){
  const [open,setOpen]=useState(false);
  const text=HELP_TEXTS[page]||"Pulsa cualquier pestaña del menú para moverte por la app.";
  return <Card style={{marginTop:16,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",padding:"12px 14px",boxShadow:"0 8px 20px rgba(20,8,4,.16)"}}>
    <button onClick={()=>{SFX.click();setOpen(v=>!v);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:"transparent",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
      <div style={{width:46,height:46,borderRadius:"50%",display:"grid",placeItems:"center",background:"linear-gradient(180deg,#FFF4D6,#E6C27A)",border:`2px solid ${T.g300}`,boxShadow:"0 8px 16px rgba(20,8,4,.18)",fontSize:"1.65rem"}}>🧑🏾‍🦱</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:950,color:T.g800}}>Ayuda rápida</div>
        <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>{open?"Toca para ocultar la ayuda":"Toca para ver qué puedes hacer aquí"}</div>
      </div>
      <div style={{fontSize:"1.2rem",fontWeight:900,color:T.g700}}>{open?"−":"+"}</div>
    </button>
    {open&&<div style={{marginTop:10,borderTop:`1px solid ${T.g200}`,paddingTop:10,fontSize:".84rem",fontWeight:800,color:T.text,lineHeight:1.45,animation:"bubblePop .22s ease"}}>{text}</div>}
  </Card>;
}

export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [communityTab,setCommunityTab]=useState("feed");
  const [toast,setToast]=useState({show:false,msg:""});
  const [ptsPopup,setPtsPopup]=useState({show:false,pts:0});
  const [musicOn,setMusicOn]=useState(false);
  const [checkingSession,setCheckingSession]=useState(true);

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
  const navTo=id=>{
    const communityMap={feed:"feed",foro:"foro",noticias:"noticias",comunidad:communityTab||"feed"};
    const target=communityMap[id]?"comunidad":id;
    if(communityMap[id]) setCommunityTab(communityMap[id]);
    target===page?SFX.tab():(target==="dashboard"?SFX.navBack():SFX.nav());
    setPage(target);
  };
  const logout=()=>{supabase?.auth.signOut();setUser(null);setPage("dashboard");};

  if(checkingSession)return <div style={{fontFamily:"sans-serif",minHeight:"100vh",display:"grid",placeItems:"center",background:T.g100}}><Spinner/></div>;
  if(!user)return (
    <>
      <Auth onLogin={u=>{setUser(u);setPage("dashboard");}} showToast={showToast}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  const role=normalizeRole(user.rol || user.role);
  const nav=NAV_CFG[role]||NAV_CFG.client;
  const grad=GRAD_ROLE[role]||GRAD_ROLE.client;
  const ap=page;
  const currentUser={...user,rol:role};
  const sp={showToast,showPoints,user:currentUser,setUser};
  const isAdmin=role===ROLES.ADMIN || role===ROLES.STAFF;

  const pages={
    dashboard:role===ROLES.CLIENT?<ClientDashboard user={currentUser} onNavigate={navTo}/>:<DashboardAdmin user={currentUser}/>,
    citas:<Citas {...sp}/>,clientes:<Clientes {...sp}/>,inventario:<Inventario {...sp}/>,
    caja:<Caja {...sp}/>,usuarios:<AdminUsuarios {...sp}/>,feed:<SocialFeed {...sp}/>,foro:<Foro {...sp}/>,
    noticias:<Noticias {...sp}/>,comunidad:<Comunidad {...sp} initialTab={communityTab}/>,
    tienda:<Tienda {...sp}/>,juegos:<Juegos {...sp}/>,retos:<Retos {...sp}/>,
    ranking:<Ranking user={currentUser}/>,perfil:<Perfil {...sp} onLogout={logout}/>,
    galeria:<Galeria showToast={showToast} isAdmin={isAdmin}/>,
    reviews:<Reviews {...sp}/>,chat:<Chat user={currentUser} showToast={showToast}/>,
    cupones:<Cupones user={currentUser} showToast={showToast}/>,
  };

  return(
    <div style={{fontFamily:"'Crimson Text',serif",background:"linear-gradient(180deg,rgba(255,244,214,.09),rgba(255,244,214,.03)),linear-gradient(160deg,#2C1810,#5C3317)",minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:82,position:"relative",boxShadow:"0 0 0 1px rgba(255,244,214,.12),0 0 70px rgba(0,0,0,.45)"}}>
      <style>{CSS}</style>
      <Particles/>
      <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
      <div style={{background:grad,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50,boxShadow:"0 4px 20px rgba(27,67,50,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.white,textShadow:"0 4px 10px rgba(0,0,0,.35)"}}>✂️ {BRAND.name}</div>
          {role!==ROLES.CLIENT&&<span style={{background:"rgba(255,255,255,0.22)",color:T.white,borderRadius:50,padding:"2px 8px",fontSize:"0.68rem",fontWeight:800,textTransform:"uppercase"}}>{role}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={toggleMusic} style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 10px",cursor:"pointer",color:T.white,fontWeight:800,fontSize:"0.72rem"}}>{musicOn?"🔇 Silenciar":"🔊 Sonido"}</button>
          {role===ROLES.CLIENT&&<div style={{background:"rgba(255,255,255,0.2)",borderRadius:50,padding:"4px 12px",color:T.white,fontWeight:900,fontSize:"0.84rem"}}>{currentUser.puntos||0} pts</div>}
          <div onClick={()=>navTo("perfil")} style={{cursor:"pointer",padding:2,background:"rgba(255,255,255,0.18)",borderRadius:"50%"}}>
            <Av av={currentUser.avatar} config={currentUser.avatarConfig} size={32}/>
          </div>
        </div>
      </div>
      <div style={{padding:"18px 14px"}}>
        {pages[ap]||pages["dashboard"]}
        <HelperMascot page={ap}/>
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#8B5E2F",borderTop:`2px solid ${T.g600}`,display:"flex",justifyContent:"space-around",padding:"6px 2px 10px",zIndex:100,boxShadow:"0 -4px 20px rgba(27,67,50,0.08)"}}>
        {nav.map(n=>(
          <button key={n.id} onClick={()=>navTo(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",minWidth:38}}>
            <div style={{fontSize:"1.1rem",background:ap===n.id?grad:"transparent",borderRadius:10,padding:"4px 7px",transform:ap===n.id?"scale(1.18)":"scale(1)",transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:ap===n.id?"0 3px 12px rgba(27,67,50,0.2)":"none"}}>{n.icon}</div>
            <span style={{fontSize:"0.52rem",fontWeight:800,color:ap===n.id?"#F5E6C8":"#DEB887",transition:"color 0.2s"}}>{n.label}</span>
          </button>
        ))}
      </div>
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}
