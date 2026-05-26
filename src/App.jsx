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
  // Parchment/Pirate palette
  g900:"#2C1810",g800:"#3D2314",g700:"#5C3317",g600:"#8B4513",
  g500:"#A0522D",g400:"#CD853F",g300:"#DEB887",g200:"#F5DEB3",
  g150:"#D4AA6E",g100:"#DDB97A",g50:"#E8C98A",
  pink:"#C0392B",gold:"#D4AF37",orange:"#E8871A",red:"#8B0000",blue:"#1A3A5C",
  text:"#2C1810",textSub:"#8B4513",white:"#F5E6C8",
  gradAdmin:"linear-gradient(135deg,#2C1810,#5C3317)",
  gradStaff:"linear-gradient(135deg,#5C3317,#8B4513)",
  gradClient:"linear-gradient(135deg,#8B4513,#CD853F)",
  gradGold:"linear-gradient(135deg,#D4AF37,#E8871A)",
  gradPink:"linear-gradient(135deg,#8B0000,#C0392B)",
};

const ROLES = { ADMIN:"admin", STAFF:"staff", CLIENT:"cliente" };

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
  nav:()=>{playTone(520,"sine",0.08,0.1);playTone(660,"sine",0.08,0.08,0.06);},
  click:()=>{playTone(440,"triangle",0.07,0.12);},
  coins:()=>{[880,1047,1319].forEach((f,i)=>playTone(f,"sine",0.12,0.15,i*0.07));},
  success:()=>{[523,659,784,1047].forEach((f,i)=>playTone(f,"sine",0.14,0.14,i*0.08));},
  error:()=>{playTone(220,"sawtooth",0.15,0.12);playTone(180,"sawtooth",0.12,0.1,0.1);},
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
      g.gain.linearRampToValueAtTime(0.035,ctx.currentTime+0.05);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.2);
      o.start(ctx.currentTime);o.stop(ctx.currentTime+1.3);beat++;
    }catch(e){}
  },600);
}
function stopMusic(){musicPlaying=false;if(musicInterval){clearInterval(musicInterval);musicInterval=null;}}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#CD853F;border-radius:4px}
body{margin:0;background-color:#C8A96E;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(101,67,33,0.03) 2px,rgba(101,67,33,0.03) 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(101,67,33,0.02) 2px,rgba(101,67,33,0.02) 4px),linear-gradient(160deg,#D4A96A 0%,#C19A5B 30%,#B8924F 60%,#C4A060 100%)}
input,select,button,textarea{font-family:'Crimson Text',serif}
@keyframes popIn{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes floatUp{0%{transform:translateY(110vh) rotate(0deg);opacity:0}10%{opacity:.3}90%{opacity:.15}100%{transform:translateY(-10vh) rotate(360deg);opacity:0}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes ptsFloat{0%{opacity:0;transform:translateY(0) scale(0.7)}20%{opacity:1;transform:translateY(-10px) scale(1.1)}80%{opacity:1;transform:translateY(-40px)}100%{opacity:0;transform:translateY(-60px) scale(0.9)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes logoPulse{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.04)}}
@keyframes bladeGlint{0%,100%{opacity:.35;transform:translateX(-20px) rotate(-18deg)}50%{opacity:.9;transform:translateX(20px) rotate(-18deg)}}
.bp:active{transform:scale(0.94)!important}
.ch:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(27,67,50,0.15)!important}
`;

function Btn({children,onClick,col="green",full=false,small=false,disabled=false,style:sx={}}){
  const C={green:{bg:T.gradClient,sh:"rgba(64,145,108,0.35)"},dark:{bg:T.gradAdmin,sh:"rgba(27,67,50,0.35)"},pink:{bg:T.gradPink,sh:"rgba(233,30,140,0.3)"},gold:{bg:T.gradGold,sh:"rgba(255,183,3,0.35)"},red:{bg:"linear-gradient(135deg,#E53935,#EF5350)",sh:"rgba(229,57,53,0.3)"},ghost:{bg:"transparent",sh:"none"}};
  const c=C[col]||C.green;
  return <button onClick={disabled?undefined:onClick} className="bp" style={{background:col==="ghost"?"transparent":c.bg,color:col==="ghost"?T.g700:T.white,border:col==="ghost"?`2px solid ${T.g300}`:"none",borderRadius:14,padding:small?"7px 14px":"11px 20px",fontWeight:800,fontSize:small?"0.78rem":"0.9rem",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,width:full?"100%":"auto",boxShadow:col==="ghost"?"none":`0 4px 14px ${c.sh}`,transition:"all 0.18s ease",...sx}}>{children}</button>;
}
function Card({children,style:sx={},onClick,hover=false}){
  return <div onClick={onClick} className={hover?"ch":""} style={{background:"#F5E6C8",borderRadius:18,padding:"16px",boxShadow:"0 4px 16px rgba(101,67,33,0.25)",border:`2px solid ${T.g400}`,transition:"all 0.22s ease",cursor:onClick?"pointer":"default",...sx}}>{children}</div>;
}
function Input({label,value,onChange,type="text",placeholder="",style:sx={}}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.88rem",color:T.text,outline:"none",...sx}} onFocus={e=>e.target.style.border=`1.5px solid ${T.g500}`} onBlur={e=>e.target.style.border=`1.5px solid ${T.g200}`}/></div>;
}
function Select({label,value,onChange,options=[]}){
  return <div style={{marginBottom:14}}>{label&&<div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:5}}>{label}</div>}<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${T.g200}`,background:T.g50,fontSize:"0.88rem",color:T.text,outline:"none"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
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
function SectionHeader({icon,title,sub,action}){return <div style={{marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.3rem",color:T.g800}}>{icon} {title}</div>{sub&&<div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{sub}</div>}</div>{action}</div>;}
function StatCard({icon,label,value,col="green"}){
  const C={green:{bg:T.g150,ac:T.g600},gold:{bg:"#FFF8E1",ac:T.orange},pink:{bg:"#FCE4EC",ac:T.pink},blue:{bg:"#E3F2FD",ac:T.blue}};
  const c=C[col]||C.green;
  return <Card style={{background:c.bg,border:"none",padding:"14px 16px"}} hover><div style={{fontSize:"1.5rem",marginBottom:4}}>{icon}</div><div style={{fontSize:"0.72rem",fontWeight:700,color:T.textSub,marginBottom:2}}>{label}</div><div style={{fontWeight:900,fontSize:"1.4rem",color:c.ac}}>{value}</div></Card>;
}
const AVATARS=["🧑","👩","👨","👱","👴","👵","🧔","👩‍🦱","👨‍🦱","👩‍🦰","👨‍🦰","👩‍🦳"];
function Av({av=0,size=36}){
  const idx=typeof av==="number"?av:0;
  return <div style={{width:size,height:size,borderRadius:"50%",background:T.g150,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.55,border:`2px solid ${T.g300}`}}>{AVATARS[idx%AVATARS.length]}</div>;
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

function toAppUser(u){
  return {id:u.id,nombre:u.nombre,email:u.email,rol:u.role||"cliente",puntos:u.puntos||0,avatar:u.avatar||0,fecha_registro:u.created_at};
}
async function getUserProfileByEmail(email){
  if(!supabase || !email) return null;
  const {data,error}=await supabase
    .from("usuarios")
    .select("id,nombre,email,role,puntos,avatar,created_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if(error) return null;
  return data;
}
async function createUserProfile({nombre,email}){
  if(!supabase || !email) return null;
  const {data,error}=await supabase
    .from("usuarios")
    .insert({nombre,email:email.toLowerCase(),role:"cliente",puntos:0,avatar:Math.floor(Math.random()*AVATARS.length)})
    .select("id,nombre,email,role,puntos,avatar,created_at")
    .maybeSingle();
  if(error) return null;
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
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <BrandLogo/>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"2.55rem",letterSpacing:"1px",color:T.white,textShadow:"0 4px 12px rgba(0,0,0,0.35)"}}>{BRAND.name}</div>
          <div style={{color:T.g200,fontSize:"0.92rem",marginTop:5,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.8px"}}>{BRAND.tagline}</div>
          <div style={{color:"rgba(245,230,200,0.78)",fontSize:"0.78rem",marginTop:4,fontWeight:600}}>{BRAND.subtagline}</div>
        </div>
        <Card style={{padding:"28px 24px",animation:"popIn 0.4s ease",background:"#F5E6C8",border:"2px solid #8B4513"}}>
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
        dbGet("usuarios","?role=eq.cliente&select=id"),
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
function ClientDashboard({user}){
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
      <Card style={{background:T.gradClient,border:"none",marginBottom:16,padding:"20px"}}>
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
        {[["📅","Cita"],["🛍️","Tienda"],["🎮","Jugar"]].map(([icon,lbl])=>(
          <Card key={lbl} style={{textAlign:"center",padding:"14px 8px",background:T.g50}} hover>
            <div style={{fontSize:"1.6rem"}}>{icon}</div>
            <div style={{fontSize:"0.72rem",fontWeight:800,color:T.g700,marginTop:4}}>{lbl}</div>
          </Card>
        ))}
      </div>
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
  async function load(){setLoading(true);setClientes(await dbGet("usuarios","?role=eq.cliente&order=nombre.asc&select=*")||[]);setLoading(false);}
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
            <select value={u.role||"cliente"} onChange={e=>changeRole(u.id,e.target.value)} style={{padding:"5px 8px",borderRadius:8,border:`1.5px solid ${T.g300}`,background:T.g50,fontSize:"0.78rem",fontWeight:700,cursor:"pointer"}}>
              <option value="cliente">Cliente</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </Card>
      ))}
    </div>
  );
}

// FEED
function SocialFeed({user,setUser,showToast,showPoints}){
  const [posts,setPosts]=useState([]);const [newPost,setNewPost]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setPosts(await dbGet("publicaciones","?order=created_at.desc&limit=20&select=*")||[]);setLoading(false);}
  async function publish(){
    if(!newPost.trim())return;
    await dbPost("publicaciones",{contenido:newPost,autor_id:user.id,tipo:"post",likes_count:0});
    const nuevos=(user.puntos||0)+5;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser(u=>({...u,puntos:nuevos}));showPoints(5);setNewPost("");SFX.success();load();
  }
  async function likePost(post){
    await dbPatch("publicaciones",`?id=eq.${post.id}`,{likes_count:(post.likes_count||0)+1});load();
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📱" title="Feed" sub="Comparte con la comunidad"/>
      <Card style={{marginBottom:16}}>
        <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Que te parece tu nuevo look?" rows={3} style={{width:"100%",border:`1.5px solid ${T.g200}`,borderRadius:12,padding:"10px",fontSize:"0.88rem",color:T.text,background:T.g50,resize:"none",outline:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <span style={{fontSize:"0.75rem",color:T.textSub}}>+5 pts por publicar</span>
          <Btn small onClick={publish}>Publicar</Btn>
        </div>
      </Card>
      {loading?<Spinner/>:posts.map(p=>(
        <Card key={p.id} style={{marginBottom:12}}>
          {p.imagen_url&&<img src={p.imagen_url} alt="" style={{width:"100%",borderRadius:10,marginBottom:8,objectFit:"cover",maxHeight:200}}/>}
          <div style={{fontSize:"0.9rem",color:T.text,lineHeight:1.5}}>{p.contenido}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <span style={{fontSize:"0.72rem",color:T.textSub}}>{new Date(p.created_at).toLocaleDateString("es-ES")}</span>
            <button onClick={()=>likePost(p)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.82rem",color:T.textSub,fontWeight:700}}>Me gusta {p.likes_count||0}</button>
          </div>
        </Card>
      ))}
    </div>
  );
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

const SOPA_WORDS=["TIJERA","COLOR","BRILLO","CORTE","MECHAS","RIZOS","SECADOR"];
function generateGrid(words){
  const SIZE=10,grid=Array(SIZE).fill(null).map(()=>Array(SIZE).fill(""));
  const placed=[],DIRS=[[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
  for(const word of words){
    let tries=0;
    while(tries<100){
      tries++;
      const dir=DIRS[Math.floor(Math.random()*DIRS.length)];
      const r=Math.floor(Math.random()*SIZE),c=Math.floor(Math.random()*SIZE);
      let ok=true;
      for(let i=0;i<word.length;i++){const nr=r+dir[0]*i,nc=c+dir[1]*i;if(nr<0||nr>=SIZE||nc<0||nc>=SIZE||grid[nr][nc]!==""&&grid[nr][nc]!==word[i]){ok=false;break;}}
      if(ok){const cells=[];for(let i=0;i<word.length;i++){const nr=r+dir[0]*i,nc=c+dir[1]*i;grid[nr][nc]=word[i];cells.push(`${nr}-${nc}`);}placed.push({word,cells});break;}
    }
  }
  const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(grid[r][c]==="")grid[r][c]=L[Math.floor(Math.random()*L.length)];
  return{grid,placed};
}

function SopaLetras({onWin}){
  const [{grid,placed}]=useState(()=>generateGrid(SOPA_WORDS));
  const [found,setFound]=useState([]);
  const [selected,setSelected]=useState([]);
  const [start,setStart]=useState(null);
  const [wrong,setWrong]=useState(false);
  const isSelecting=useRef(false);
  const SIZE=10;

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
          if(nf.length===placed.length)setTimeout(()=>onWin(nf.length*5),300);
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
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {SOPA_WORDS.map(w=><Badge key={w} col={found.includes(w)?"green":"gold"}>{found.includes(w)?"OK ":""}{w}</Badge>)}
      </div>
      <div
        style={{userSelect:"none",touchAction:"none",display:"inline-block",background:"#F5E6C8",borderRadius:12,padding:8,border:`2px solid ${T.g400}`,cursor:"crosshair"}}
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
                    width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"0.8rem",fontWeight:900,cursor:"crosshair",borderRadius:6,
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
      <div style={{marginTop:8,fontSize:"0.85rem",color:T.textSub,fontWeight:700}}>Encontradas: {found.length}/{placed.length}</div>
    </div>
  );
}

const MEMO_EMOJIS=["A","B","C","D","E","F","G","H"];
function MemoryGame({onWin}){
  const [cards,setCards]=useState(()=>[...MEMO_EMOJIS,...MEMO_EMOJIS].map((e,i)=>({id:i,emoji:e,flipped:false,matched:false})).sort(()=>Math.random()-0.5));
  const [flipped,setFlipped]=useState([]);const [moves,setMoves]=useState(0);const [lock,setLock]=useState(false);
  function flip(id){
    if(lock)return;const card=cards.find(c=>c.id===id);if(!card||card.flipped||card.matched)return;
    const nc=cards.map(c=>c.id===id?{...c,flipped:true}:c);const nf=[...flipped,id];setCards(nc);setFlipped(nf);
    if(nf.length===2){
      setLock(true);setMoves(m=>m+1);const [a,b]=nf.map(fid=>nc.find(c=>c.id===fid));
      setTimeout(()=>{
        if(a.emoji===b.emoji){const m=nc.map(c=>nf.includes(c.id)?{...c,matched:true}:c);setCards(m);setFlipped([]);setLock(false);if(m.every(c=>c.matched))onWin(Math.max(20-moves,5));}
        else{setCards(nc.map(c=>nf.includes(c.id)?{...c,flipped:false}:c));setFlipped([]);setLock(false);}
      },900);
    }
  }
  return(
    <div>
      <div style={{fontSize:"0.8rem",color:T.textSub,fontWeight:700,marginBottom:10}}>Movimientos: {moves}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {cards.map(c=><div key={c.id} onClick={()=>flip(c.id)} style={{height:60,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",fontWeight:900,cursor:"pointer",background:c.flipped||c.matched?T.g100:T.g600,color:c.flipped||c.matched?T.g800:T.g600,border:`2px solid ${c.matched?T.g400:T.g500}`,transition:"all 0.2s"}}>{(c.flipped||c.matched)?c.emoji:""}</div>)}
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

function Juegos({user,setUser,showToast,showPoints}){
  const [activeGame,setActiveGame]=useState(null);
  const GAMES=[{id:"sopa",icon:"🔤",title:"Sopa de Letras",desc:"Encuentra las palabras ocultas",pts:25},{id:"memoria",icon:"🧠",title:"Memoria",desc:"Encuentra todos los pares",pts:20},{id:"trivia",icon:"?",title:"Trivia Capilar",desc:"Demuestra tu conocimiento",pts:15}];
  async function handleWin(gameId,pts){
    markPlayedToday(gameId,user.id);
    const nuevos=(user.puntos||0)+pts;
    await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    setUser(u=>({...u,puntos:nuevos}));showPoints(pts);SFX.coins();showToast(`+${pts} puntos!`);setActiveGame(null);
  }
  if(activeGame){
    const g=GAMES.find(x=>x.id===activeGame);
    return(
      <div style={{animation:"fadeSlide 0.4s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setActiveGame(null)} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,cursor:"pointer",fontWeight:900,fontSize:"1rem",color:T.g700}}>{"<"}</button>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.2rem",color:T.g800}}>{g?.icon} {g?.title}</div>
        </div>
        {activeGame==="sopa"&&<SopaLetras onWin={pts=>handleWin("sopa",pts)}/>}
        {activeGame==="memoria"&&<MemoryGame onWin={pts=>handleWin("memoria",pts)}/>}
        {activeGame==="trivia"&&<TriviaGame onWin={pts=>handleWin("trivia",pts)}/>}
      </div>
    );
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎮" title="Juegos" sub="Gana puntos - 1 vez al dia por juego"/>
      {GAMES.map(g=>{
        const played=getPlayedToday(g.id,user.id);
        return(
          <Card key={g.id} style={{marginBottom:12,opacity:played?0.65:1}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:"2.2rem"}}>{g.icon}</div>
              <div style={{flex:1}}><div style={{fontWeight:800}}>{g.title}</div><div style={{fontSize:"0.8rem",color:T.textSub}}>{g.desc}</div><div style={{fontSize:"0.75rem",color:T.orange,fontWeight:700,marginTop:2}}>Hasta +{g.pts} pts</div></div>
              {played?<Badge col="green">Jugado hoy</Badge>:<Btn small onClick={()=>setActiveGame(g.id)}>Jugar</Btn>}
            </div>
          </Card>
        );
      })}
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
  const [lista,setLista]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);setLista(await dbGet("usuarios","?role=eq.cliente&order=puntos.desc&limit=20&select=*")||[]);setLoading(false);}
  const medals=["1","2","3"];
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏆" title="Ranking" sub="Top clientes del mes"/>
      {loading?<Spinner/>:lista.map((u,i)=>{
        const isMe=u.id===user.id;
        return(
          <Card key={u.id} style={{marginBottom:8,background:isMe?T.g100:T.white,border:isMe?`2px solid ${T.g400}`:`1px solid ${T.g150}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.3rem",minWidth:32,textAlign:"center"}}>#{i+1}</div>
              <Av av={u.avatar} size={38}/>
              <div style={{flex:1}}><div style={{fontWeight:800}}>{u.nombre}{isMe?" (tu)":""}</div></div>
              <div style={{fontWeight:900,color:T.orange}}>{u.puntos||0} pts</div>
            </div>
          </Card>
        );
      })}
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

// PERFIL
function Perfil({user,setUser,onLogout,showToast}){
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({nombre:user.nombre,avatar:user.avatar||0});
  async function save(){
    await dbPatch("usuarios",`?id=eq.${user.id}`,{nombre:form.nombre,avatar:form.avatar});
    setUser(u=>({...u,...form}));setEditing(false);showToast("Perfil actualizado");
  }
  const nivel=user.puntos>=1000?"VIP":user.puntos>=500?"Gold":user.puntos>=200?"Silver":"Bronze";
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="👤" title="Mi Perfil"/>
      <Card style={{textAlign:"center",marginBottom:16}}>
        <Av av={form.avatar} size={72}/>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.3rem",color:T.g800,marginTop:10}}>{user.nombre}</div>
        <div style={{fontSize:"0.82rem",color:T.textSub}}>{user.email}</div>
        <div style={{marginTop:8}}><Badge col="gold">{nivel}</Badge></div>
        {user.rol===ROLES.CLIENT&&<div style={{marginTop:12}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.8rem",color:T.g700}}>{user.puntos||0} pts</div></div>}
      </Card>
      {editing?(
        <Card style={{marginBottom:16}}>
          <Input label="Nombre" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:"0.8rem",fontWeight:800,color:T.g700,marginBottom:8}}>Elige tu avatar</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{AVATARS.map((a,i)=><button key={i} onClick={()=>setForm(f=>({...f,avatar:i}))} style={{width:44,height:44,borderRadius:"50%",border:`2px solid ${form.avatar===i?T.g600:T.g200}`,background:form.avatar===i?T.g150:T.white,fontSize:"1.3rem",cursor:"pointer"}}>{a}</button>)}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn full onClick={save}>Guardar</Btn>
            <Btn full col="ghost" onClick={()=>setEditing(false)}>Cancelar</Btn>
          </div>
        </Card>
      ):<Btn full col="ghost" onClick={()=>setEditing(true)} style={{marginBottom:12}}>Editar perfil</Btn>}
      <Btn full col="red" onClick={onLogout}>Cerrar sesion</Btn>
    </div>
  );
}

const NAV_CFG={
  admin:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"citas",icon:"📅",label:"Citas"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"inventario",icon:"📦",label:"Stock"},{id:"caja",icon:"💰",label:"Caja"},{id:"usuarios",icon:"👑",label:"Usuarios"},{id:"perfil",icon:"👤",label:"Perfil"}],
  staff:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"citas",icon:"📅",label:"Citas"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"inventario",icon:"📦",label:"Stock"},{id:"caja",icon:"💰",label:"Caja"},{id:"perfil",icon:"👤",label:"Perfil"}],
  cliente:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"feed",icon:"📱",label:"Feed"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"juegos",icon:"🎮",label:"Juegos"},{id:"retos",icon:"🎯",label:"Retos"},{id:"ranking",icon:"🏆",label:"Ranking"},{id:"perfil",icon:"👤",label:"Perfil"}],
};
const GRAD_ROLE={admin:T.gradAdmin,staff:T.gradStaff,cliente:T.gradClient};

export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
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
  function toggleMusic(){globalMuted=!globalMuted;if(globalMuted){stopMusic();setMusicOn(false);}else{startMusic();setMusicOn(true);}}
  const navTo=id=>{SFX.nav();setPage(id);};
  const logout=()=>{supabase?.auth.signOut();setUser(null);setPage("dashboard");};

  if(checkingSession)return <div style={{fontFamily:"sans-serif",minHeight:"100vh",display:"grid",placeItems:"center",background:T.g100}}><Spinner/></div>;
  if(!user)return (
    <>
      <Auth onLogin={u=>{setUser(u);setPage("dashboard");}} showToast={showToast}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  const role=user.rol||"cliente";
  const nav=NAV_CFG[role]||NAV_CFG.cliente;
  const grad=GRAD_ROLE[role]||GRAD_ROLE.cliente;
  const ap=nav.find(n=>n.id===page)?page:"dashboard";
  const sp={showToast,showPoints,user,setUser};
  const isAdmin=role===ROLES.ADMIN || role===ROLES.STAFF;

  const pages={
    dashboard:role===ROLES.CLIENT?<ClientDashboard user={user}/>:<DashboardAdmin user={user}/>,
    citas:<Citas {...sp}/>,clientes:<Clientes {...sp}/>,inventario:<Inventario {...sp}/>,
    caja:<Caja {...sp}/>,usuarios:<AdminUsuarios {...sp}/>,feed:<SocialFeed {...sp}/>,
    tienda:<Tienda {...sp}/>,juegos:<Juegos {...sp}/>,retos:<Retos {...sp}/>,
    ranking:<Ranking user={user}/>,perfil:<Perfil {...sp} onLogout={logout}/>,
    galeria:<Galeria showToast={showToast} isAdmin={isAdmin}/>,
    reviews:<Reviews {...sp}/>,chat:<Chat user={user} showToast={showToast}/>,
    cupones:<Cupones user={user} showToast={showToast}/>,
  };

  return(
    <div style={{fontFamily:"'Crimson Text',serif",background:T.g100,minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:82,position:"relative"}}>
      <style>{CSS}</style>
      <Particles/>
      <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
      <div style={{background:grad,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50,boxShadow:"0 4px 20px rgba(27,67,50,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.white}}>{BRAND.name}</div>
          {role!==ROLES.CLIENT&&<span style={{background:"rgba(255,255,255,0.22)",color:T.white,borderRadius:50,padding:"2px 8px",fontSize:"0.68rem",fontWeight:800,textTransform:"uppercase"}}>{role}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={toggleMusic} style={{background:"rgba(255,255,255,0.18)",border:"none",borderRadius:50,padding:"5px 10px",cursor:"pointer",color:T.white,fontWeight:800,fontSize:"0.72rem"}}>{musicOn?"Silenciar":"Sonido"}</button>
          {role===ROLES.CLIENT&&<div style={{background:"rgba(255,255,255,0.2)",borderRadius:50,padding:"4px 12px",color:T.white,fontWeight:900,fontSize:"0.84rem"}}>{user.puntos||0} pts</div>}
          <div onClick={()=>navTo("perfil")} style={{cursor:"pointer",padding:2,background:"rgba(255,255,255,0.18)",borderRadius:"50%"}}>
            <Av av={user.avatar} size={32}/>
          </div>
        </div>
      </div>
      <div style={{padding:"18px 14px"}}>{pages[ap]||pages["dashboard"]}</div>
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
