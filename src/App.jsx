import { useState, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════════════════
const SUPA_URL = "https://uetuoxtfccrbymwlsssx.supabase.co";
const SUPA_KEY = "sb_publishable_-ow7f5HJgbcDgXvI7tyIzw_vR3PnrfZ";

async function db(table, method = "GET", body = null, query = "") {
  const url = `${SUPA_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (method === "GET" || (method === "POST" && res.ok)) {
    try { return await res.json(); } catch { return []; }
  }
  return res.ok;
}

const dbGet    = (table, query="")   => db(table, "GET",    null,  query);
const dbPost   = (table, body)       => db(table, "POST",   body,  "");
const dbPatch  = (table, query, body)=> db(table, "PATCH",  body,  query);
const dbDelete = (table, query)      => db(table, "DELETE", null,  query);

// ═══════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════
let audioCtx = null;
let musicInterval = null;
let musicPlaying = false;
const PENTA = [261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.25];

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq,type='sine',dur=0.12,vol=0.15,delay=0) {
  try {
    const ctx=getCtx(); const osc=ctx.createOscillator(); const g=ctx.createGain();
    osc.connect(g); g.connect(ctx.destination); osc.type=type;
    osc.frequency.setValueAtTime(freq,ctx.currentTime+delay);
    g.gain.setValueAtTime(0,ctx.currentTime+delay);
    g.gain.linearRampToValueAtTime(vol,ctx.currentTime+delay+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+dur+0.05);
  } catch(e){}
}
const SFX = {
  nav:    ()=>{ playTone(520,'sine',0.08,0.1); playTone(660,'sine',0.08,0.08,0.06); },
  click:  ()=>{ playTone(440,'triangle',0.07,0.12); },
  coins:  ()=>{ [880,1047,1319].forEach((f,i)=>playTone(f,'sine',0.12,0.15,i*0.07)); },
  success:()=>{ [523,659,784,1047].forEach((f,i)=>playTone(f,'sine',0.14,0.14,i*0.08)); },
  error:  ()=>{ playTone(220,'sawtooth',0.15,0.12); playTone(180,'sawtooth',0.12,0.1,0.1); },
};
function startMusic() {
  if(musicPlaying) return; musicPlaying=true; let beat=0;
  const pat=[0,2,4,2,1,3,5,3,4,6,4,2];
  const tick=()=>{
    if(!musicPlaying) return;
    try{
      const ctx=getCtx(); if(ctx.state==='suspended') ctx.resume();
      const f=PENTA[pat[beat%pat.length]%PENTA.length];
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0,ctx.currentTime); g.gain.linearRampToValueAtTime(0.035,ctx.currentTime+0.05);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.2);
      o.start(ctx.currentTime); o.stop(ctx.currentTime+1.3);
      if(beat%4===0){const b=ctx.createOscillator(),bg=ctx.createGain(); b.connect(bg); bg.connect(ctx.destination); b.type='triangle'; b.frequency.value=f/2; bg.gain.setValueAtTime(0,ctx.currentTime); bg.gain.linearRampToValueAtTime(0.02,ctx.currentTime+0.08); bg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.6); b.start(ctx.currentTime); b.stop(ctx.currentTime+1.7);}
      beat++;
    }catch(e){}
  };
  tick(); musicInterval=setInterval(tick,700);
}
function stopMusic(){ musicPlaying=false; if(musicInterval){clearInterval(musicInterval);musicInterval=null;} }

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════
const ROLES = { ADMIN:'admin', STAFF:'staff', CLIENT:'client' };
const SHOP = { name:'PeluquerIA', whatsapp:'622123873', email:'allue1995@gmail.com', address:'Santa Engracia, City 50669' };
const TIPS = [
  { emoji:"💧", titulo:"Hidratación profunda", texto:"Aplica mascarilla capilar una vez por semana. Déjala 20 min bajo un gorro de ducha." },
  { emoji:"✂️", titulo:"Corte cada 6-8 semanas", texto:"Cortar las puntas regularmente evita que el daño suba por el cabello." },
  { emoji:"🌡️", titulo:"Protege del calor", texto:"Usa siempre protector térmico antes de plancha o secador." },
  { emoji:"🌙", titulo:"Funda de seda al dormir", texto:"La seda reduce el frizz y mantiene el estilismo más tiempo." },
  { emoji:"💆", titulo:"Masaje capilar diario", texto:"5 minutos estimula la circulación. Prueba con aceite de romero." },
  { emoji:"🚿", titulo:"Agua fría al final", texto:"10 segundos de agua fría cierra la cutícula y da más brillo." },
];
const NOTICIAS = [
  { emoji:"🌿", titulo:"Coloración vegetal en auge", texto:"Los tintes naturales de henna e indigo ganan terreno. Menos daño, más color.", tag:"Tendencia" },
  { emoji:"✂️", titulo:"El corte 'bixie' arrasa", texto:"Entre bob y píxie, el bixie es el corte del año. Favorece casi todos los rostros.", tag:"Moda" },
  { emoji:"💆", titulo:"Tratamientos express en cabina", texto:"15 minutos de tratamiento están revolucionando la experiencia en peluquería.", tag:"Novedad" },
  { emoji:"🌊", titulo:"El wet look vuelve con fuerza", texto:"Pelo mojado y brillante. Sencillo de conseguir con gel fijador ligero.", tag:"Estilo" },
];
const PRODUCTOS_TIENDA = [
  { id:1, nombre:"Mascarilla Brillo Intenso", precio:18.90, emoji:"✨", desc:"Hidratación profunda con aceite de argán.", cat:"Tratamiento" },
  { id:2, nombre:"Champú Volumen Total", precio:12.50, emoji:"🫧", desc:"Limpieza suave con efecto voluminizador. Sin sulfatos.", cat:"Limpieza" },
  { id:3, nombre:"Sérum Antiencrespamiento", precio:22.00, emoji:"💧", desc:"Controla el frizz durante 48h. Aplicar en húmedo.", cat:"Estilismo" },
  { id:4, nombre:"Spray Protector Térmico", precio:15.75, emoji:"🌡️", desc:"Protege hasta 230°C. Imprescindible antes de plancha.", cat:"Protección" },
  { id:5, nombre:"Aceite de Argán Puro", precio:28.00, emoji:"🫙", desc:"100% natural. Nutre, da brillo y doma el cabello.", cat:"Tratamiento" },
  { id:6, nombre:"Pack Cuidado Completo", precio:45.00, emoji:"🎁", desc:"Champú + mascarilla + sérum. El regalo perfecto.", cat:"Pack" },
];
const GRID=[['T','I','N','T','E','R','O','J','A','T'],['R','M','E','C','H','A','S','P','E','R'],['I','A','S','C','O','R','T','E','L','I'],['Z','S','C','A','B','E','L','L','O','Z'],['A','C','O','N','D','I','C','I','O','N'],['D','A','M','P','U','C','H','A','S','A'],['O','R','I','Z','A','D','O','B','R','D'],['R','A','P','L','A','N','C','H','A','O'],['F','L','E','C','O','S','V','E','L','R'],['B','R','I','L','L','O','T','O','N','O']];
const WORDS=['TINTE','MECHAS','CORTE','CABELLO','RIZADO','PLANCHA','FLECOS','BRILLO'];
const TRIVIA=[{q:"¿Con qué frecuencia se recomienda la mascarilla?",opts:["Cada día","Una vez/semana","Una vez/mes","Nunca"],ans:1,pts:10},{q:"¿Qué vitamina es clave para el cabello?",opts:["Vitamina C","Vitamina D","Biotina","Vitamina K"],ans:2,pts:10},{q:"¿Temperatura más segura para la plancha?",opts:["120-150°C","180-200°C","230°C","250°C"],ans:0,pts:15},{q:"¿Cada cuánto cortar las puntas?",opts:["2 semanas","6-8 semanas","6 meses","1 año"],ans:1,pts:10},{q:"¿Mejor funda de almohada para el pelo?",opts:["Algodón","Poliéster","Seda o satén","Lana"],ans:2,pts:15}];
const AV={skin:['#FDDBB4','#F0C27F','#C68642','#8D5524','#F5CBA7','#D4A574'],hair:['liso','ondulado','rizado','corto','coleta','trenzas','mohicano','bob'],hcol:['#2C1810','#8B4513','#DAA520','#FF6B9D','#C77DFF','#4D96FF','#FF9A3C','#E8E8E8','#1a1a1a'],eyes:['😊','😄','🥰','😎','🤩','😏'],acc:['none','👑','🎀','💎','🌸','⭐','🎓','🦋'],bg:['linear-gradient(135deg,#FFE8F3,#F3E8FF)','linear-gradient(135deg,#E8F4FF,#E8FAE8)','linear-gradient(135deg,#FFF8DC,#FFE8D0)','linear-gradient(135deg,#E8F0FF,#F0E8FF)','linear-gradient(135deg,#F0FFF0,#E0FFE0)','linear-gradient(135deg,#FFE4E1,#FFF0E1)']};
const HAIR_SVG={liso:<path d="M50,20 Q30,20 25,40 L25,55 Q35,50 50,50 Q65,50 75,55 L75,40 Q70,20 50,20Z" fill="currentColor"/>,ondulado:<path d="M50,18 Q28,18 23,38 Q20,52 25,58 Q35,52 50,52 Q65,52 75,58 Q80,52 77,38 Q72,18 50,18Z" fill="currentColor"/>,rizado:<path d="M50,16 Q25,16 22,38 Q20,55 28,60 Q32,52 36,58 Q40,50 44,56 Q48,48 52,54 Q56,46 60,52 Q64,44 68,50 Q72,42 75,48 Q80,38 78,22 Q70,14 50,16Z" fill="currentColor"/>,corto:<path d="M50,24 Q32,24 28,38 L28,48 Q38,44 50,44 Q62,44 72,48 L72,38 Q68,24 50,24Z" fill="currentColor"/>,coleta:<><path d="M50,18 Q30,18 26,38 L26,54 Q36,50 50,50 Q64,50 74,54 L74,38 Q70,18 50,18Z" fill="currentColor"/><ellipse cx="78" cy="62" rx="6" ry="14" fill="currentColor" transform="rotate(20,78,62)"/></>,trenzas:<><path d="M50,18 Q30,18 26,36 L26,52 Q36,48 50,48 Q64,48 74,52 L74,36 Q70,18 50,18Z" fill="currentColor"/><path d="M30,52 Q27,60 30,68 Q33,76 30,84" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"/><path d="M70,52 Q73,60 70,68 Q67,76 70,84" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"/></>,mohicano:<><path d="M50,22 Q40,22 38,34 L38,50 Q44,48 50,48 Q56,48 62,50 L62,34 Q60,22 50,22Z" fill="currentColor"/><path d="M44,18 Q50,0 56,18" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/></>,bob:<path d="M50,20 Q28,20 24,40 L24,62 Q36,60 50,60 Q64,60 76,62 L76,40 Q72,20 50,20Z" fill="currentColor"/>};
const COLS=['#FF6B9D','#4D96FF','#6BCB77','#C77DFF','#FF9A3C'];
const acol=n=>COLS[(n||'A').charCodeAt(0)%COLS.length];
const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
const hoyStr=()=>new Date().toISOString().split('T')[0];
const fmt=s=>{if(!s)return'';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;};
const DEFAULT_AVATAR={skin:'#FDDBB4',hair:'liso',hcol:'#2C1810',eyes:'😊',acc:'none',bg:AV.bg[0]};

// ═══════════════════════════════════════════════════════════
//  FLOATING PARTICLES
// ═══════════════════════════════════════════════════════════
const PEMOJIS=['✂️','🌸','⭐','💫','✨','💅','🎀','💎'];
function Particles() {
  const ps=Array.from({length:10},(_,i)=>({id:i,e:PEMOJIS[i%PEMOJIS.length],x:Math.random()*100,delay:Math.random()*8,dur:6+Math.random()*6,sz:0.7+Math.random()*0.7}));
  return(<div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>{ps.map(p=><div key={p.id} style={{position:'absolute',left:`${p.x}%`,bottom:0,fontSize:`${p.sz}rem`,animation:`floatUp ${p.dur}s ease-in-out ${p.delay}s infinite`}}>{p.e}</div>)}</div>);
}

function PtsPopup({pts,show}){
  return <div style={{position:'fixed',top:'20%',left:'50%',transform:`translateX(-50%) scale(${show?1:0.5})`,background:'linear-gradient(135deg,#FFD93D,#FF9A3C)',color:'white',borderRadius:20,padding:'12px 24px',fontFamily:'Fredoka One,cursive',fontSize:'1.4rem',boxShadow:'0 8px 30px rgba(255,150,0,0.4)',opacity:show?1:0,transition:'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',zIndex:9998,pointerEvents:'none',whiteSpace:'nowrap'}}>+{pts} ⭐ puntos!</div>;
}

// ═══════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════
function AvatarSVG({av,size=80}){
  const a=av||DEFAULT_AVATAR;
  const h=HAIR_SVG[a.hair]||HAIR_SVG.liso;
  return(<svg width={size} height={size} viewBox="0 0 100 100" style={{borderRadius:'50%',background:a.bg||AV.bg[0],flexShrink:0,display:'block'}}><g style={{color:a.hcol||'#2C1810'}}>{h}</g><ellipse cx="50" cy="58" rx="20" ry="22" fill={a.skin||'#FDDBB4'}/><text x="50" y="62" textAnchor="middle" fontSize="15" style={{userSelect:'none'}}>{a.eyes||'😊'}</text>{(a.hair==='bob'||a.hair==='liso'||!a.hair)&&<path d="M30,40 Q30,36 50,36 Q70,36 70,40 L70,38 Q70,20 50,20 Q30,20 30,38Z" fill={a.hcol||'#2C1810'}/>}{a.acc&&a.acc!=='none'&&<text x="50" y="25" textAnchor="middle" fontSize="17" style={{userSelect:'none'}}>{a.acc}</text>}</svg>);
}
function ACircle({nombre,size=36}){return <div style={{width:size,height:size,borderRadius:'50%',background:acol(nombre),display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:size*.34,flexShrink:0}}>{ini(nombre)}</div>;}
function Toast({msg,show}){return <div style={{position:'fixed',bottom:90,left:12,right:12,background:'white',borderRadius:16,padding:'13px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.16)',display:'flex',alignItems:'center',gap:10,fontWeight:700,fontSize:'0.87rem',transform:show?'translateY(0)':'translateY(140px)',opacity:show?1:0,transition:'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',zIndex:9999,borderLeft:'4px solid #4CAF50',maxWidth:460,margin:'0 auto'}}>{msg}</div>;}
function Badge({c,children}){const p={pink:{bg:'#FFE8F3',tx:'#D63384'},green:{bg:'#E8FAE8',tx:'#2E7D32'},yellow:{bg:'#FFF8DC',tx:'#B8860B'},blue:{bg:'#E8F0FF',tx:'#1565C0'},red:{bg:'#FFE8E8',tx:'#C62828'},purple:{bg:'#F3E8FF',tx:'#7B1FA2'},orange:{bg:'#FFF0E8',tx:'#E65100'}}[c]||{bg:'#eee',tx:'#555'};return <span style={{background:p.bg,color:p.tx,borderRadius:50,padding:'3px 11px',fontSize:'0.72rem',fontWeight:800}}>{children}</span>;}
function RoleBadge({role}){const cfg={admin:{c:'purple',l:'👑 Admin'},staff:{c:'blue',l:'💼 Staff'},client:{c:'pink',l:'💅 Cliente'}}[role]||{c:'pink',l:'Cliente'};return <Badge c={cfg.c}>{cfg.l}</Badge>;}
function Card({children,style}){return <div style={{background:'white',borderRadius:20,padding:20,boxShadow:'0 4px 20px rgba(0,0,0,0.07)',marginBottom:16,...style}}>{children}</div>;}
function Btn({children,onClick,col='pink',sm,full,style,disabled}){
  const bg={pink:'linear-gradient(135deg,#2E7D32,#4CAF50)',green:'linear-gradient(135deg,#6BCB77,#4CAF50)',yellow:'linear-gradient(135deg,#FFD93D,#FF9A3C)',red:'linear-gradient(135deg,#FF6B6B,#FF4444)',blue:'linear-gradient(135deg,#4D96FF,#2979FF)',purple:'linear-gradient(135deg,#C77DFF,#9C27B0)',gray:'#EFEFEF'}[col]||'#FF6B9D';
  return <button onClick={()=>{if(!disabled){SFX.click();if(onClick)onClick();}}} disabled={disabled} style={{background:disabled?'#E0E0E0':bg,color:(col==='gray'||disabled)?'#aaa':'white',border:'none',borderRadius:50,padding:sm?'8px 16px':'12px 22px',fontWeight:800,fontSize:sm?'0.79rem':'0.88rem',cursor:disabled?'not-allowed':'pointer',fontFamily:'Nunito,sans-serif',boxShadow:(col==='gray'||disabled)?'none':'0 4px 14px rgba(0,0,0,0.14)',display:'inline-flex',alignItems:'center',gap:6,transition:'transform 0.12s',width:full?'100%':'auto',justifyContent:full?'center':'flex-start',...style}} onPointerDown={e=>{if(!disabled)e.currentTarget.style.transform='scale(0.93)';}} onPointerUp={e=>e.currentTarget.style.transform='scale(1)'} onPointerLeave={e=>e.currentTarget.style.transform='scale(1)'}>{children}</button>;
}
function Modal({open,onClose,title,children}){
  useEffect(()=>{if(open)SFX.click();},[open]);
  if(!open)return null;
  return <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(5px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:14}}>
    <div style={{background:'white',borderRadius:24,padding:22,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 30px 80px rgba(0,0,0,0.25)',animation:'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.4rem',marginBottom:16,background:'linear-gradient(135deg,#2E7D32,#4CAF50)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{title}</div>
      {children}
    </div>
  </div>;
}
function FI({label,...p}){return <div style={{marginBottom:12}}>{label&&<label style={{display:'block',fontSize:'0.74rem',fontWeight:800,marginBottom:4,color:'#bbb',textTransform:'uppercase',letterSpacing:1}}>{label}</label>}<input {...p} style={{width:'100%',padding:'11px 13px',border:'2px solid #F0EAE0',borderRadius:12,fontFamily:'Nunito,sans-serif',fontSize:'0.93rem',fontWeight:600,outline:'none',background:'#FAFAFA',color:'#2D2D2D',boxSizing:'border-box',...p.style}} onFocus={e=>e.target.style.borderColor='#FF6B9D'} onBlur={e=>e.target.style.borderColor='#F0EAE0'}/></div>;}
function FS({label,children,...p}){return <div style={{marginBottom:12}}>{label&&<label style={{display:'block',fontSize:'0.74rem',fontWeight:800,marginBottom:4,color:'#bbb',textTransform:'uppercase',letterSpacing:1}}>{label}</label>}<select {...p} style={{width:'100%',padding:'11px 13px',border:'2px solid #F0EAE0',borderRadius:12,fontFamily:'Nunito,sans-serif',fontSize:'0.93rem',fontWeight:600,outline:'none',background:'#FAFAFA',color:'#2D2D2D',boxSizing:'border-box'}}>{children}</select></div>;}

// ═══════════════════════════════════════════════════════════
//  AVATAR EDITOR
// ═══════════════════════════════════════════════════════════
function AvatarEditor({av,onSave,onClose}){
  const [loc,setLoc]=useState({...DEFAULT_AVATAR,...av});
  const upd=(k,v)=>{SFX.click();setLoc(l=>({...l,[k]:v}));};
  const Sw=({val,cur,onClick,style})=><div onClick={onClick} style={{width:34,height:34,borderRadius:9,cursor:'pointer',border:cur===val?'3px solid #FF6B9D':'2px solid transparent',boxShadow:cur===val?'0 0 0 2px white,0 0 0 4px #FF6B9D':'0 1px 4px rgba(0,0,0,0.1)',transition:'all 0.15s',flexShrink:0,...style}}/>;
  const HBtn=({h})=><button onClick={()=>upd('hair',h)} style={{padding:'6px 10px',borderRadius:10,border:loc.hair===h?'2px solid #FF6B9D':'2px solid #F0EAE0',background:loc.hair===h?'#FFE8F3':'white',fontFamily:'Nunito,sans-serif',fontWeight:700,fontSize:'0.74rem',cursor:'pointer',color:loc.hair===h?'#FF6B9D':'#777'}}>{h.charAt(0).toUpperCase()+h.slice(1)}</button>;
  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(5px)',zIndex:2000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div style={{background:'white',borderRadius:'26px 26px 0 0',padding:'22px 20px 28px',width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',animation:'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
      <div style={{width:40,height:4,background:'#E0E0E0',borderRadius:2,margin:'0 auto 18px'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.5rem',background:'linear-gradient(135deg,#2E7D32,#4CAF50)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>🎨 Crea tu Avatar</div>
        <button onClick={onClose} style={{background:'#F5F5F5',border:'none',borderRadius:10,padding:'7px 13px',cursor:'pointer',fontWeight:800}}>✕</button>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:22}}>
        <div style={{padding:6,background:'linear-gradient(135deg,#2E7D32,#4CAF50)',borderRadius:'50%',boxShadow:'0 8px 24px rgba(255,107,157,0.35)'}}><AvatarSVG av={loc} size={100}/></div>
      </div>
      {[{label:'🌈 Fondo',content:<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{AV.bg.map((b,i)=><div key={i} onClick={()=>upd('bg',b)} style={{width:38,height:38,borderRadius:10,background:b,cursor:'pointer',border:loc.bg===b?'3px solid #FF6B9D':'2px solid transparent'}}/>)}</div>},{label:'🫙 Tono de piel',content:<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{AV.skin.map(s=><Sw key={s} val={s} cur={loc.skin} onClick={()=>upd('skin',s)} style={{background:s}}/>)}</div>},{label:'💇 Peinado',content:<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{AV.hair.map(h=><HBtn key={h} h={h}/>)}</div>},{label:'🎨 Color de pelo',content:<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{AV.hcol.map(c=><Sw key={c} val={c} cur={loc.hcol} onClick={()=>upd('hcol',c)} style={{background:c}}/>)}</div>},{label:'😊 Expresión',content:<div style={{display:'flex',gap:7}}>{AV.eyes.map(e=><button key={e} onClick={()=>upd('eyes',e)} style={{fontSize:'1.5rem',background:loc.eyes===e?'#FFE8F3':'#F5F5F5',border:loc.eyes===e?'2px solid #FF6B9D':'2px solid transparent',borderRadius:10,padding:'6px 8px',cursor:'pointer'}}>{e}</button>)}</div>},{label:'👑 Accesorio',content:<div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{AV.acc.map(a=><button key={a} onClick={()=>upd('acc',a)} style={{fontSize:a==='none'?'0.7rem':'1.4rem',background:loc.acc===a?'#FFE8F3':'#F5F5F5',border:loc.acc===a?'2px solid #FF6B9D':'2px solid transparent',borderRadius:10,padding:'6px 8px',cursor:'pointer',color:a==='none'?'#bbb':'inherit',fontFamily:'Nunito,sans-serif',fontWeight:700}}>{a==='none'?'❌ Ninguno':a}</button>)}</div>}].map((s,i)=><div key={i} style={{marginBottom:18}}><div style={{fontSize:'0.76rem',fontWeight:800,color:'#bbb',textTransform:'uppercase',letterSpacing:1.2,marginBottom:9}}>{s.label}</div>{s.content}</div>)}
      <div style={{display:'flex',gap:10}}>
        <Btn col="gray" onClick={onClose} style={{flex:1,justifyContent:'center'}}>Cancelar</Btn>
        <Btn col="pink" onClick={()=>onSave(loc)} style={{flex:1,justifyContent:'center'}}>💾 Guardar</Btn>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
function Auth({onLogin,showToast}){
  const [mode,setMode]=useState('login');
  const [f,setF]=useState({nombre:'',email:'',pass:'',pass2:''});
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const [show,setShow]=useState(false);
  const [musicOn,setMusicOn]=useState(false);

  const login=async()=>{
    if(!f.email||!f.pass){setErr('Rellena email y contraseña');return;}
    setLoading(true);
    const rows=await dbGet('usuarios',`?email=eq.${encodeURIComponent(f.email)}&password=eq.${encodeURIComponent(f.pass)}&select=*`);
    setLoading(false);
    if(!rows||rows.length===0){SFX.error();setErr('Email o contraseña incorrectos');return;}
    SFX.success(); onLogin(rows[0]);
  };

  const register=async()=>{
    if(!f.nombre||!f.email||!f.pass){setErr('Rellena todos los campos');return;}
    if(f.pass!==f.pass2){setErr('Las contraseñas no coinciden');return;}
    setLoading(true);
    const exists=await dbGet('usuarios',`?email=eq.${encodeURIComponent(f.email)}&select=id`);
    if(exists&&exists.length>0){setLoading(false);SFX.error();setErr('Email ya registrado');return;}
    const nu=await dbPost('usuarios',{nombre:f.nombre,email:f.email,password:f.pass,role:ROLES.CLIENT,puntos:20,visitas:0,avatar:DEFAULT_AVATAR,words_found:[]});
    setLoading(false);
    if(!nu||nu.length===0){setErr('Error al crear cuenta. Inténtalo de nuevo.');return;}
    SFX.success(); onLogin(nu[0]);
  };

  return(<div style={{minHeight:'100vh',background:'linear-gradient(160deg,#FFE8F3 0%,#F3E8FF 45%,#E8F4FF 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,fontFamily:'Nunito,sans-serif',position:'relative'}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');@keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes floatUp{0%{transform:translateY(110vh) rotate(0deg);opacity:0}10%{opacity:.35}90%{opacity:.2}100%{transform:translateY(-10vh) rotate(360deg);opacity:0}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{display:none}input,select,button{font-family:Nunito,sans-serif}`}</style>
    <Particles/>
    <button onClick={()=>{if(musicOn){stopMusic();setMusicOn(false);}else{startMusic();setMusicOn(true);}}} style={{position:'fixed',top:16,right:16,background:'white',border:'2px solid #FFE8F3',borderRadius:50,padding:'8px 14px',cursor:'pointer',fontWeight:800,fontSize:'0.85rem',zIndex:10}}>
      {musicOn?'🔇 Música':'🎵 Música'}
    </button>
    <div style={{textAlign:'center',marginBottom:26,animation:'popIn 0.6s ease'}}>
      <div style={{fontSize:'3.5rem',marginBottom:6,animation:'pulse 2s ease-in-out infinite',filter:'drop-shadow(0 4px 12px rgba(255,107,157,0.4))'}}>✂️</div>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'2.6rem',background:'linear-gradient(135deg,#2E7D32,#4CAF50)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>PeluquerIA</div>
      <div style={{color:'#C8A0CC',fontWeight:800,fontSize:'0.78rem',letterSpacing:3,marginTop:2}}>TU PELUQUERÍA DIGITAL ✨</div>
    </div>
    <div style={{background:'white',borderRadius:28,padding:26,width:'100%',maxWidth:370,boxShadow:'0 24px 64px rgba(255,107,157,0.15)',border:'1.5px solid #FFE8F3',animation:'fadeSlide 0.5s ease 0.2s both'}}>
      <div style={{display:'flex',background:'#F8F5FF',borderRadius:14,padding:4,marginBottom:22}}>
        {['login','register'].map(m=><button key={m} onClick={()=>{SFX.nav();setMode(m);setErr('');}} style={{flex:1,padding:'10px',border:'none',borderRadius:11,fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:'0.87rem',cursor:'pointer',background:mode===m?'white':'transparent',color:mode===m?'#FF6B9D':'#bbb',boxShadow:mode===m?'0 2px 10px rgba(255,107,157,0.18)':'none',transition:'all 0.22s'}}>{m==='login'?'🔑 Entrar':'✨ Registrarse'}</button>)}
      </div>
      {mode==='register'&&<FI label="Tu nombre" placeholder="María García" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/>}
      <FI label="Email" type="email" placeholder="tu@email.com" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
      <div style={{position:'relative'}}>
        <FI label="Contraseña" type={show?'text':'password'} placeholder="••••••••" value={f.pass} onChange={e=>setF({...f,pass:e.target.value})}/>
        <button onClick={()=>setShow(!show)} style={{position:'absolute',right:12,top:29,background:'none',border:'none',cursor:'pointer',fontSize:'1rem'}}>{show?'🙈':'👁'}</button>
      </div>
      {mode==='register'&&<FI label="Repetir contraseña" type="password" placeholder="••••••••" value={f.pass2} onChange={e=>setF({...f,pass2:e.target.value})}/>}
      {mode==='register'&&<div style={{background:'linear-gradient(135deg,#E8FAE8,#FFF8DC)',borderRadius:12,padding:'10px 14px',fontSize:'0.8rem',fontWeight:700,color:'#2E7D32',marginBottom:10}}>🎁 Al registrarte recibes 20 puntos de bienvenida</div>}
      {err&&<div style={{background:'#FFE8E8',color:'#C62828',borderRadius:10,padding:'10px 13px',fontSize:'0.82rem',fontWeight:700,marginBottom:12}}>⚠️ {err}</div>}
      <Btn full col="pink" onClick={mode==='login'?login:register} disabled={loading} style={{marginTop:4,fontSize:'0.95rem',padding:'13px'}}>
        {loading?'⏳ Cargando...':(mode==='login'?'🚀 Entrar':'🎉 Crear cuenta gratis')}
      </Btn>
      {mode==='login'&&<div style={{marginTop:14,padding:12,background:'linear-gradient(135deg,#FFF9F0,#FFF0FA)',borderRadius:12,fontSize:'0.78rem',color:'#C8A0CC',fontWeight:700,textAlign:'center',border:'1px dashed #FFD0EC'}}>💡 Demo admin: allue1995@gmail.com / admin123</div>}
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  PERFIL
// ═══════════════════════════════════════════════════════════
function Perfil({user,setUser,onLogout,showToast,showPoints}){
  const [editAv,setEditAv]=useState(false);

  const saveAvatar=async(av)=>{
    await dbPatch('usuarios',`?id=eq.${user.id}`,{avatar:av});
    setUser({...user,avatar:av});
    setEditAv(false); showToast('🎨 Avatar guardado!');
  };

  const canjear=async(pts,desc)=>{
    if(user.puntos<pts){SFX.error();showToast('⭐ No tienes suficientes puntos');return;}
    const np=user.puntos-pts;
    await dbPatch('usuarios',`?id=eq.${user.id}`,{puntos:np});
    setUser({...user,puntos:np});
    SFX.success(); showToast(`🎁 ¡${desc} canjeado! Muéstraselo en la peluquería`);
  };

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    {editAv&&<AvatarEditor av={user.avatar} onSave={saveAvatar} onClose={()=>setEditAv(false)}/>}
    <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',borderRadius:22,padding:'22px 20px',marginBottom:16,color:'white',textAlign:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,background:'rgba(255,255,255,0.08)',borderRadius:'50%'}}/>
      <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
        <div style={{position:'relative'}}>
          <div style={{padding:4,background:'rgba(255,255,255,0.25)',borderRadius:'50%'}}><AvatarSVG av={user.avatar} size={86}/></div>
          <button onClick={()=>setEditAv(true)} style={{position:'absolute',bottom:0,right:-4,background:'white',border:'none',borderRadius:50,width:27,height:27,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.82rem'}}>✏️</button>
        </div>
      </div>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.5rem'}}>{user.nombre}</div>
      <div style={{fontSize:'0.8rem',opacity:0.8,marginBottom:6}}>{user.email}</div>
      <RoleBadge role={user.role}/>
      <div style={{display:'flex',justifyContent:'center',gap:24,marginTop:14,background:'rgba(255,255,255,0.15)',borderRadius:14,padding:'12px 20px'}}>
        <div><div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>{user.puntos}</div><div style={{fontSize:'0.7rem',opacity:0.8,fontWeight:700}}>PUNTOS</div></div>
        <div style={{width:1,background:'rgba(255,255,255,0.3)'}}/>
        <div><div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>{user.visitas}</div><div style={{fontSize:'0.7rem',opacity:0.8,fontWeight:700}}>VISITAS</div></div>
      </div>
    </div>
    {user.role===ROLES.CLIENT&&<>
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><div style={{fontWeight:800,fontSize:'0.9rem'}}>🎯 Próximo premio</div><div style={{color:'#FF6B9D',fontWeight:800}}>{user.puntos}/500</div></div>
        <div style={{height:10,background:'#F0EAE0',borderRadius:50,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(user.puntos/500)*100)}%`,background:'linear-gradient(90deg,#FF6B9D,#C77DFF)',borderRadius:50,transition:'width 0.8s ease'}}/></div>
        <div style={{fontSize:'0.77rem',color:'#bbb',marginTop:6,fontWeight:700}}>Faltan {Math.max(0,500-user.puntos)} pts para el 10% de descuento</div>
      </Card>
      <Card>
        <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.1rem',marginBottom:12}}>🎁 Canjear puntos</div>
        {[{pts:500,icon:'💅',desc:'10% descuento'},{pts:1000,icon:'✨',desc:'20% descuento'},{pts:2000,icon:'👑',desc:'Servicio de cortesía'}].map((r,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<2?'1px solid #F9F9F9':'none'}}>
            <div style={{fontSize:'1.8rem'}}>{r.icon}</div>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.87rem'}}>{r.desc}</div><div style={{fontSize:'0.74rem',color:'#C77DFF',fontWeight:700}}>⭐ {r.pts}</div></div>
            <Btn sm col={user.puntos>=r.pts?'pink':'gray'} onClick={()=>canjear(r.pts,r.desc)}>{user.puntos>=r.pts?'Canjear':'🔒'}</Btn>
          </div>
        ))}
      </Card>
    </>}
    <Card style={{background:'linear-gradient(135deg,#FFF9F0,#FFF0FA)'}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.1rem',marginBottom:12}}>🏆 Logros</div>
      {[{cond:true,icon:'🎉',label:'Registrada',desc:'Bienvenida a PeluquerIA (+20 pts)'},{cond:user.visitas>=5,icon:'💫',label:'Cliente habitual',desc:'5 visitas completadas'},{cond:user.visitas>=10,icon:'👑',label:'VIP',desc:'10 visitas — ¡eres una estrella!'},{cond:user.puntos>=100,icon:'⭐',label:'Coleccionista',desc:'100 puntos acumulados'},{cond:(user.words_found||[]).length>=4,icon:'🔤',label:'Wordmaster',desc:'4+ palabras en la sopa'}].map((l,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',opacity:l.cond?1:0.35}}>
          <div style={{fontSize:'1.5rem',filter:l.cond?'none':'grayscale(1)'}}>{l.icon}</div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.86rem'}}>{l.label}</div><div style={{fontSize:'0.74rem',color:'#bbb'}}>{l.desc}</div></div>
          {l.cond&&<Badge c="green">✅</Badge>}
        </div>
      ))}
    </Card>
    <Card style={{background:'#E8F5E9',marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:12}}>📞 Contacta con {SHOP.name}</div>
      <a href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'white',borderRadius:12,textDecoration:'none',marginBottom:8,color:'#2D2D2D',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}><span style={{fontSize:'1.4rem'}}>📱</span><div><div style={{fontWeight:800,fontSize:'0.88rem'}}>WhatsApp</div><div style={{fontSize:'0.77rem',color:'#bbb'}}>{SHOP.whatsapp}</div></div></a>
      <a href={`mailto:${SHOP.email}`} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'white',borderRadius:12,textDecoration:'none',color:'#2D2D2D',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}><span style={{fontSize:'1.4rem'}}>📍</span><div><div style={{fontWeight:800,fontSize:'0.88rem'}}>{SHOP.address}</div><div style={{fontSize:'0.77rem',color:'#bbb'}}>{SHOP.email}</div></div></a>
    </Card>
    <Btn full col="gray" onClick={onLogout} style={{justifyContent:'center',marginTop:4}}>🚪 Cerrar sesión</Btn>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  ADMIN — USUARIOS
// ═══════════════════════════════════════════════════════════
function AdminUsuarios({showToast}){
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [f,setF]=useState({nombre:'',email:'',password:'',role:ROLES.STAFF});

  useEffect(()=>{ loadUsers(); },[]);
  const loadUsers=async()=>{ setLoading(true); const r=await dbGet('usuarios','?select=*&order=created_at.asc'); setUsers(r||[]); setLoading(false); };

  const guardar=async()=>{
    if(!f.nombre||!f.email||!f.password){SFX.error();showToast('⚠️ Rellena todos los campos');return;}
    if(edit){
      await dbPatch('usuarios',`?id=eq.${edit.id}`,{nombre:f.nombre,email:f.email,password:f.password,role:f.role});
      showToast('✅ Usuario actualizado');
    } else {
      const exists=await dbGet('usuarios',`?email=eq.${encodeURIComponent(f.email)}&select=id`);
      if(exists&&exists.length>0){SFX.error();showToast('⚠️ Email ya registrado');return;}
      await dbPost('usuarios',{nombre:f.nombre,email:f.email,password:f.password,role:f.role,puntos:f.role===ROLES.CLIENT?20:0,visitas:0,avatar:DEFAULT_AVATAR,words_found:[]});
      showToast('✅ Usuario creado');
    }
    SFX.success(); setModal(false); setEdit(null); loadUsers();
  };

  const del=async(id)=>{ if(!confirm('¿Eliminar usuario?'))return; await dbDelete('usuarios',`?id=eq.${id}`); showToast('🗑 Eliminado'); loadUsers(); };

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.6rem'}}>👥 Usuarios</div>
      <Btn sm col="purple" onClick={()=>{setEdit(null);setF({nombre:'',email:'',password:'',role:ROLES.STAFF});setModal(true);}}>➕ Nuevo</Btn>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
      {[ROLES.ADMIN,ROLES.STAFF,ROLES.CLIENT].map(r=>{
        const count=users.filter(u=>u.role===r).length;
        const cfg={admin:{icon:'👑',label:'Admins',bg:'#F3E8FF',c:'#7B1FA2'},staff:{icon:'💼',label:'Staff',bg:'#E8F0FF',c:'#1565C0'},client:{icon:'💅',label:'Clientes',bg:'#FFE8F3',c:'#D63384'}}[r];
        return <div key={r} style={{background:cfg.bg,borderRadius:14,padding:'12px 8px',textAlign:'center'}}>
          <div style={{fontSize:'1.3rem'}}>{cfg.icon}</div>
          <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.4rem',color:cfg.c}}>{count}</div>
          <div style={{fontSize:'0.68rem',color:'#999',fontWeight:700}}>{cfg.label}</div>
        </div>;
      })}
    </div>
    {loading?<div style={{textAlign:'center',padding:40,color:'#bbb'}}>⏳ Cargando...</div>:users.map(u=>(
      <div key={u.id} style={{background:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <AvatarSVG av={u.avatar} size={44}/>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.9rem'}}>{u.nombre}</div><div style={{fontSize:'0.75rem',color:'#bbb'}}>{u.email}</div></div>
          <RoleBadge role={u.role}/>
        </div>
        <div style={{display:'flex',gap:8,marginTop:10,justifyContent:'flex-end'}}>
          <Btn sm col="blue" onClick={()=>{setEdit(u);setF({nombre:u.nombre,email:u.email,password:u.password,role:u.role});setModal(true);}}>✏️</Btn>
          {u.role!==ROLES.ADMIN&&<Btn sm col="red" onClick={()=>del(u.id)}>🗑</Btn>}
        </div>
      </div>
    ))}
    <Modal open={modal} onClose={()=>setModal(false)} title={edit?'✏️ Editar Usuario':'➕ Nuevo Usuario'}>
      <FI label="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} placeholder="Nombre completo"/>
      <FI label="Email" type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="email@ejemplo.com"/>
      <FI label="Contraseña" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="••••••••"/>
      <FS label="Rol" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>
        <option value={ROLES.CLIENT}>💅 Cliente</option>
        <option value={ROLES.STAFF}>💼 Staff</option>
        <option value={ROLES.ADMIN}>👑 Admin</option>
      </FS>
      <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
        <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
        <Btn col="purple" onClick={guardar}>💾 Guardar</Btn>
      </div>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  CITAS
// ═══════════════════════════════════════════════════════════
function Citas({showToast}){
  const [citas,setCitas]=useState([]);
  const [clientes,setClientes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [f,setF]=useState({cliente_id:'',fecha:hoyStr(),hora:'',servicio:'Corte de pelo'});

  useEffect(()=>{load();},[]);
  const load=async()=>{
    setLoading(true);
    const [c,cl]=await Promise.all([dbGet('citas','?select=*&order=fecha.asc,hora.asc'),dbGet('clientes','?select=*&order=nombre.asc')]);
    setCitas(c||[]); setClientes(cl||[]); setLoading(false);
  };

  const guardar=async()=>{
    if(!f.cliente_id||!f.fecha||!f.hora){SFX.error();showToast('⚠️ Rellena todos los campos');return;}
    await dbPost('citas',{...f,estado:'pendiente'});
    await dbPatch('clientes',`?id=eq.${f.cliente_id}`,{visitas:(clientes.find(c=>c.id===f.cliente_id)?.visitas||0)+1,puntos:(clientes.find(c=>c.id===f.cliente_id)?.puntos||0)+50});
    SFX.coins(); setModal(false); showToast('✅ Cita guardada! +50 pts al cliente');
    setF({cliente_id:'',fecha:hoyStr(),hora:'',servicio:'Corte de pelo'}); load();
  };
  const tog=async(c)=>{ await dbPatch('citas',`?id=eq.${c.id}`,{estado:c.estado==='confirmada'?'pendiente':'confirmada'}); load(); };
  const del=async(id)=>{ if(!confirm('¿Eliminar?'))return; await dbDelete('citas',`?id=eq.${id}`); showToast('🗑 Eliminada'); load(); };
  const getCli=id=>clientes.find(c=>c.id===id)||{nombre:'?'};

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>📅 Citas</div>
      <Btn onClick={()=>setModal(true)}>➕ Nueva</Btn>
    </div>
    {loading?<div style={{textAlign:'center',padding:40,color:'#bbb'}}>⏳ Cargando...</div>:citas.length===0?<Card><div style={{textAlign:'center',color:'#ddd',padding:36,fontWeight:700}}>Sin citas registradas</div></Card>:citas.map(c=>{const cli=getCli(c.cliente_id);return(
      <div key={c.id} style={{background:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:10}}>
        <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',color:'white',borderRadius:12,padding:'8px 10px',textAlign:'center',minWidth:62,fontFamily:'Fredoka One,cursive'}}>
          <div style={{fontSize:'0.95rem'}}>{c.hora?.slice(0,5)}</div>
          <div style={{fontSize:'0.62rem',opacity:0.85}}>{fmt(c.fecha)}</div>
        </div>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.9rem'}}>{cli.nombre}</div><div style={{fontSize:'0.76rem',color:'#bbb'}}>{c.servicio}</div></div>
        <Badge c={c.estado==='confirmada'?'green':'yellow'}>{c.estado==='confirmada'?'✅':'⏳'}</Badge>
        <button onClick={()=>tog(c)} style={{background:'#F5F5F5',border:'none',borderRadius:8,padding:'5px 8px',cursor:'pointer',fontWeight:800}}>↕</button>
        <button onClick={()=>del(c.id)} style={{background:'#FFE8E8',border:'none',borderRadius:8,padding:'5px 8px',cursor:'pointer',color:'#C62828',fontWeight:800}}>🗑</button>
      </div>
    );})}
    <Modal open={modal} onClose={()=>setModal(false)} title="📅 Nueva Cita">
      <FS label="Cliente" value={f.cliente_id} onChange={e=>setF({...f,cliente_id:e.target.value})}>
        <option value="">Seleccionar...</option>
        {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
      </FS>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <FI label="Fecha" type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})}/>
        <FI label="Hora" type="time" value={f.hora} onChange={e=>setF({...f,hora:e.target.value})}/>
      </div>
      <FS label="Servicio" value={f.servicio} onChange={e=>setF({...f,servicio:e.target.value})}>
        {['Corte de pelo','Tinte','Mechas','Permanente','Alisado','Peinado','Tratamiento'].map(s=><option key={s}>{s}</option>)}
      </FS>
      <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
        <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  CLIENTES
// ═══════════════════════════════════════════════════════════
function Clientes({showToast}){
  const [clientes,setClientes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [q,setQ]=useState('');
  const [f,setF]=useState({nombre:'',telefono:'',servicio:'Corte de pelo'});

  useEffect(()=>{load();},[]);
  const load=async()=>{ setLoading(true); const r=await dbGet('clientes','?select=*&order=nombre.asc'); setClientes(r||[]); setLoading(false); };

  const guardar=async()=>{
    if(!f.nombre||!f.telefono){SFX.error();showToast('⚠️ Nombre y teléfono obligatorios');return;}
    await dbPost('clientes',{...f,visitas:0,puntos:0});
    SFX.success(); setModal(false); setF({nombre:'',telefono:'',servicio:'Corte de pelo'}); showToast('👤 Cliente añadido!'); load();
  };

  const lista=clientes.filter(c=>c.nombre.toLowerCase().includes(q.toLowerCase())||c.telefono?.includes(q));
  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>👥 Clientes</div>
      <Btn onClick={()=>setModal(true)}>➕ Nuevo</Btn>
    </div>
    <div style={{position:'relative',marginBottom:14}}>
      <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)'}}>🔍</span>
      <input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%',padding:'11px 13px 11px 36px',border:'2px solid #F0EAE0',borderRadius:12,fontFamily:'Nunito,sans-serif',fontWeight:600,fontSize:'0.9rem',outline:'none',boxSizing:'border-box',background:'#FAFAFA'}}/>
    </div>
    {loading?<div style={{textAlign:'center',padding:40,color:'#bbb'}}>⏳ Cargando...</div>:lista.map(c=>(
      <div key={c.id} style={{background:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <ACircle nombre={c.nombre}/>
          <div style={{flex:1}}><div style={{fontWeight:800}}>{c.nombre}</div><div style={{fontSize:'0.79rem',color:'#bbb'}}>{c.telefono}</div></div>
          <div style={{textAlign:'right'}}><div style={{fontFamily:'Fredoka One,cursive',color:'#C77DFF'}}>⭐ {c.puntos}</div><div style={{fontSize:'0.71rem',color:'#ddd'}}>{c.visitas} visitas</div></div>
        </div>
        <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
          <Badge c="pink">{c.servicio}</Badge>
          {c.puntos>=2000&&<Badge c="purple">👑 VIP</Badge>}
          {c.puntos>=500&&c.puntos<2000&&<Badge c="green">🎁 Premio disponible</Badge>}
        </div>
      </div>
    ))}
    <Modal open={modal} onClose={()=>setModal(false)} title="👤 Nuevo Cliente">
      <FI label="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} placeholder="María García"/>
      <FI label="Teléfono" type="tel" value={f.telefono} onChange={e=>setF({...f,telefono:e.target.value})} placeholder="612 345 678"/>
      <FS label="Servicio habitual" value={f.servicio} onChange={e=>setF({...f,servicio:e.target.value})}>
        {['Corte de pelo','Tinte','Mechas','Permanente','Peinado'].map(s=><option key={s}>{s}</option>)}
      </FS>
      <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
        <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  INVENTARIO
// ═══════════════════════════════════════════════════════════
function Inventario({showToast}){
  const [inv,setInv]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [f,setF]=useState({nombre:'',categoria:'Tintes',precio:'',stock:'',stock_minimo:''});

  useEffect(()=>{load();},[]);
  const load=async()=>{ setLoading(true); const r=await dbGet('inventario','?select=*&order=nombre.asc'); setInv(r||[]); setLoading(false); };

  const adj=async(p,d)=>{
    const ns=Math.max(0,p.stock+d);
    await dbPatch('inventario',`?id=eq.${p.id}`,{stock:ns});
    setInv(inv.map(x=>x.id===p.id?{...x,stock:ns}:x));
    if(ns<=p.stock_minimo) showToast(`⚠️ Stock bajo en ${p.nombre}`);
  };

  const guardar=async()=>{
    if(!f.nombre){SFX.error();showToast('⚠️ El nombre es obligatorio');return;}
    await dbPost('inventario',{...f,precio:parseFloat(f.precio)||0,stock:parseInt(f.stock)||0,stock_minimo:parseInt(f.stock_minimo)||1});
    SFX.success(); setModal(false); setF({nombre:'',categoria:'Tintes',precio:'',stock:'',stock_minimo:''}); showToast('📦 Producto añadido!'); load();
  };

  const al=inv.filter(p=>p.stock<=p.stock_minimo);
  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>📦 Inventario</div>
      <Btn onClick={()=>setModal(true)}>➕ Añadir</Btn>
    </div>
    {al.map(p=><div key={p.id} style={{background:'#FFF8DC',border:'2px solid #FFD93D',borderRadius:12,padding:'11px 14px',marginBottom:8,fontWeight:700,fontSize:'0.82rem',color:'#8B6914'}}>⚠️ <b>{p.nombre}</b> — Solo {p.stock} uds (mín: {p.stock_minimo})</div>)}
    {loading?<div style={{textAlign:'center',padding:40,color:'#bbb'}}>⏳ Cargando...</div>:inv.map(p=>{
      const pct=Math.min(100,Math.round((p.stock/Math.max(p.stock_minimo*3,1))*100));
      const bc=p.stock<=p.stock_minimo?'#FF6B6B':p.stock<=p.stock_minimo*2?'#FFD93D':'#6BCB77';
      return(<div key={p.id} style={{background:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <div><div style={{fontWeight:800,fontSize:'0.9rem'}}>{p.nombre}</div><Badge c="blue">{p.categoria}</Badge></div>
          <div style={{fontWeight:800,color:'#6BCB77',alignSelf:'center'}}>{parseFloat(p.precio).toFixed(2)}€</div>
        </div>
        <div style={{height:7,background:'#F0EAE0',borderRadius:50,marginBottom:8}}><div style={{height:'100%',width:`${pct}%`,background:bc,borderRadius:50,transition:'width 0.4s'}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'0.75rem',color:'#ddd',fontWeight:700}}>Mín: {p.stock_minimo}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>adj(p,-1)} style={{background:'#F5F5F5',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontWeight:800}}>−</button>
            <span style={{fontFamily:'Fredoka One,cursive',fontSize:'1.25rem',minWidth:28,textAlign:'center',color:p.stock<=p.stock_minimo?'#FF6B6B':'#2D2D2D'}}>{p.stock}</span>
            <button onClick={()=>adj(p,1)} style={{background:'#F5F5F5',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontWeight:800}}>+</button>
          </div>
        </div>
      </div>);
    })}
    <Modal open={modal} onClose={()=>setModal(false)} title="📦 Nuevo Producto">
      <FI label="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} placeholder="Tinte Rubio Ceniza"/>
      <FS label="Categoría" value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value})}>
        {['Tintes','Champús','Acondicionadores','Tratamientos','Herramientas','Otros'].map(s=><option key={s}>{s}</option>)}
      </FS>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <FI label="Precio €" type="number" value={f.precio} onChange={e=>setF({...f,precio:e.target.value})} placeholder="12.50"/>
        <FI label="Stock" type="number" value={f.stock} onChange={e=>setF({...f,stock:e.target.value})} placeholder="10"/>
      </div>
      <FI label="Stock mínimo" type="number" value={f.stock_minimo} onChange={e=>setF({...f,stock_minimo:e.target.value})} placeholder="3"/>
      <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
        <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  CAJA
// ═══════════════════════════════════════════════════════════
function Caja({showToast}){
  const [facturas,setFacturas]=useState([]);
  const [clientes,setClientes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [f,setF]=useState({cliente_id:'',lineas:[{servicio:'',precio:''}],estado:'pagada'});

  useEffect(()=>{load();},[]);
  const load=async()=>{
    setLoading(true);
    const [fa,cl]=await Promise.all([dbGet('facturas','?select=*&order=created_at.desc'),dbGet('clientes','?select=*&order=nombre.asc')]);
    setFacturas(fa||[]); setClientes(cl||[]); setLoading(false);
  };

  const addL=()=>setF(x=>({...x,lineas:[...x.lineas,{servicio:'',precio:''}]}));
  const updL=(i,k,v)=>setF(x=>({...x,lineas:x.lineas.map((l,idx)=>idx===i?{...l,[k]:v}:l)}));
  const total=f.lineas.reduce((a,l)=>a+(parseFloat(l.precio)||0),0);

  const guardar=async()=>{
    if(!f.cliente_id){SFX.error();showToast('⚠️ Selecciona cliente');return;}
    const ls=f.lineas.filter(l=>l.servicio.trim());
    if(!ls.length){SFX.error();showToast('⚠️ Añade un servicio');return;}
    await dbPost('facturas',{cliente_id:f.cliente_id,lineas:ls,total,estado:f.estado,fecha:hoyStr()});
    SFX.coins(); setModal(false); setF({cliente_id:'',lineas:[{servicio:'',precio:''}],estado:'pagada'}); showToast('🧾 Factura emitida!'); load();
  };

  const pag=facturas.filter(f=>f.estado==='pagada');
  const tot=pag.reduce((a,f)=>a+parseFloat(f.total||0),0);
  const getCli=id=>clientes.find(c=>c.id===id)||{nombre:'?'};

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem'}}>💰 Caja</div>
      <Btn onClick={()=>setModal(true)}>➕ Nueva</Btn>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9,marginBottom:16}}>
      {[{icon:'💵',val:tot.toFixed(0)+'€',label:'Este mes',bg:'#E8FAE8',c:'#2E7D32'},{icon:'🧾',val:facturas.length,label:'Facturas',bg:'#FFE8F3',c:'#D63384'},{icon:'⭐',val:pag.length?(tot/pag.length).toFixed(0)+'€':'0€',label:'Ticket medio',bg:'#FFF8DC',c:'#B8860B'}].map((s,i)=>(
        <div key={i} style={{background:s.bg,borderRadius:14,padding:'12px 8px',textAlign:'center'}}>
          <div style={{fontSize:'1.2rem'}}>{s.icon}</div>
          <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.2rem',color:s.c}}>{s.val}</div>
          <div style={{fontSize:'0.67rem',color:'#999',fontWeight:700}}>{s.label}</div>
        </div>
      ))}
    </div>
    {loading?<div style={{textAlign:'center',padding:40,color:'#bbb'}}>⏳ Cargando...</div>:facturas.map(fc=>{const cli=getCli(fc.cliente_id);return(
      <div key={fc.id} style={{background:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:10}}>
        <ACircle nombre={cli.nombre} size={34}/>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.88rem'}}>{cli.nombre}</div><div style={{fontSize:'0.74rem',color:'#bbb'}}>{fc.lineas?.map(l=>l.servicio).join(', ')}</div></div>
        <div style={{textAlign:'right'}}><div style={{fontFamily:'Fredoka One,cursive',color:'#6BCB77'}}>{parseFloat(fc.total).toFixed(0)}€</div><Badge c={fc.estado==='pagada'?'green':'yellow'}>{fc.estado==='pagada'?'✅':'⏳'}</Badge></div>
      </div>
    );})}
    <Modal open={modal} onClose={()=>setModal(false)} title="🧾 Nueva Factura">
      <FS label="Cliente" value={f.cliente_id} onChange={e=>setF({...f,cliente_id:e.target.value})}>
        <option value="">Seleccionar...</option>
        {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
      </FS>
      {f.lineas.map((l,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
        <FI placeholder="Servicio" value={l.servicio} onChange={e=>updL(i,'servicio',e.target.value)}/>
        <FI placeholder="Precio €" type="number" value={l.precio} onChange={e=>updL(i,'precio',e.target.value)}/>
      </div>)}
      <button onClick={addL} style={{background:'#F5F5F5',border:'none',borderRadius:10,padding:'7px 12px',cursor:'pointer',fontWeight:700,marginBottom:10,fontFamily:'Nunito,sans-serif',fontSize:'0.82rem'}}>➕ Línea</button>
      <div style={{background:'linear-gradient(135deg,#FFF0F7,#F8F0FF)',borderRadius:12,padding:12,textAlign:'right',marginBottom:10}}>
        <span style={{fontFamily:'Fredoka One,cursive',fontSize:'1.2rem',color:'#FF6B9D'}}>Total: {total.toFixed(2)} €</span>
      </div>
      <FS label="Estado" value={f.estado} onChange={e=>setF({...f,estado:e.target.value})}>
        <option value="pagada">✅ Pagada</option>
        <option value="pendiente">⏳ Pendiente</option>
      </FS>
      <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
        <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
        <Btn onClick={guardar}>💾 Emitir</Btn>
      </div>
    </Modal>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARDS
// ═══════════════════════════════════════════════════════════
function DashboardAdmin({user}){
  const [citasHoy,setCitasHoy]=useState([]);
  const [clientes,setClientes]=useState([]);
  const [alertas,setAlertas]=useState([]);
  const [ingresos,setIngresos]=useState(0);
  const tip=TIPS[Math.floor(Date.now()/86400000)%TIPS.length];

  useEffect(()=>{
    const load=async()=>{
      const [ci,cl,inv,fa]=await Promise.all([
        dbGet('citas',`?fecha=eq.${hoyStr()}&select=*,clientes(nombre)`),
        dbGet('clientes','?select=id'),
        dbGet('inventario','?select=*'),
        dbGet('facturas','?estado=eq.pagada&select=total'),
      ]);
      setCitasHoy(ci||[]); setClientes(cl||[]);
      setAlertas((inv||[]).filter(p=>p.stock<=p.stock_minimo));
      setIngresos((fa||[]).reduce((a,f)=>a+parseFloat(f.total||0),0));
    };
    load();
  },[]);

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',borderRadius:22,padding:'18px 20px',marginBottom:14,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-20,right:80,width:80,height:80,background:'rgba(255,255,255,0.08)',borderRadius:'50%'}}/>
      <div>
        <div style={{fontSize:'0.78rem',opacity:0.85,fontWeight:700}}>{user.role===ROLES.ADMIN?'👑 ADMIN':'💼 STAFF'}</div>
        <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.6rem'}}>Hola, {user.nombre.split(' ')[0]}!</div>
        <div style={{fontSize:'0.79rem',opacity:0.85}}>Panel de gestión PeluquerIA</div>
      </div>
      <AvatarSVG av={user.avatar} size={70}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
      {[{icon:'📅',val:citasHoy.length,label:'Citas hoy',c:'#FF6B9D',bg:'#FFE8F3'},{icon:'👥',val:clientes.length,label:'Clientes',c:'#4D96FF',bg:'#E8F0FF'},{icon:'💰',val:ingresos.toFixed(0)+'€',label:'Ingresos',c:'#6BCB77',bg:'#E8FAE8'},{icon:'⚠️',val:alertas.length,label:'Stock bajo',c:'#FF9A3C',bg:'#FFF0E8'}].map((s,i)=>(
        <div key={i} style={{background:s.bg,borderRadius:16,padding:14}}>
          <div style={{fontSize:'1.4rem'}}>{s.icon}</div>
          <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.5rem',color:s.c}}>{s.val}</div>
          <div style={{fontSize:'0.71rem',color:'#999',fontWeight:700}}>{s.label}</div>
        </div>
      ))}
    </div>
    <Card>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.1rem',marginBottom:12}}>📅 Citas de hoy</div>
      {citasHoy.length===0?<div style={{textAlign:'center',color:'#ddd',padding:'18px 0',fontWeight:700}}>Sin citas hoy 🌴</div>:citasHoy.map(c=>(
        <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #F8F8F8'}}>
          <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',color:'white',borderRadius:10,padding:'7px 9px',textAlign:'center',minWidth:56,fontFamily:'Fredoka One,cursive',fontSize:'0.88rem'}}>{c.hora?.slice(0,5)}</div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.88rem'}}>{c.clientes?.nombre||'?'}</div><div style={{fontSize:'0.75rem',color:'#bbb'}}>{c.servicio}</div></div>
          <Badge c={c.estado==='confirmada'?'green':'yellow'}>{c.estado==='confirmada'?'✅':'⏳'}</Badge>
        </div>
      ))}
    </Card>
    <div style={{background:'linear-gradient(135deg,#FFFDE8,#FFF0D0)',borderRadius:18,padding:18,border:'2px solid #FFD93D'}}>
      <div style={{fontFamily:'Fredoka One,cursive',color:'#B8860B',marginBottom:6}}>💡 Consejo del día</div>
      <div style={{fontSize:'1.4rem',marginBottom:4}}>{tip.emoji}</div>
      <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:4}}>{tip.titulo}</div>
      <div style={{fontSize:'0.81rem',color:'#777',lineHeight:1.55}}>{tip.texto}</div>
    </div>
  </div>);
}

function ClientDashboard({user}){
  const tip=TIPS[Math.floor(Date.now()/86400000)%TIPS.length];
  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',borderRadius:22,padding:'18px 20px',marginBottom:14,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-20,right:80,width:80,height:80,background:'rgba(255,255,255,0.08)',borderRadius:'50%'}}/>
      <div>
        <div style={{fontSize:'0.78rem',opacity:0.85,fontWeight:700}}>BIENVENIDA ✨</div>
        <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.6rem'}}>{user.nombre.split(' ')[0]}!</div>
        <div style={{fontSize:'0.79rem',opacity:0.85}}>⭐ {user.puntos} puntos</div>
      </div>
      <AvatarSVG av={user.avatar} size={70}/>
    </div>
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><div style={{fontWeight:800,fontSize:'0.9rem'}}>🎯 Tu progreso</div><div style={{color:'#FF6B9D',fontWeight:800}}>{user.puntos}/500</div></div>
      <div style={{height:10,background:'#F0EAE0',borderRadius:50,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(user.puntos/500)*100)}%`,background:'linear-gradient(90deg,#FF6B9D,#C77DFF)',borderRadius:50,transition:'width 0.8s ease'}}/></div>
      <div style={{fontSize:'0.77rem',color:'#bbb',marginTop:6,fontWeight:700}}>{Math.max(0,500-user.puntos)} puntos para tu 1er descuento 💅</div>
    </Card>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
      {[{icon:'🎮',label:'Juega y gana',desc:'Trivia & sopa de letras',c:'#C77DFF',bg:'#F3E8FF'},{icon:'🛍️',label:'Tienda online',desc:'1 pt por cada 3€',c:'#6BCB77',bg:'#E8FAE8'}].map((s,i)=>(
        <div key={i} style={{background:s.bg,borderRadius:16,padding:14,textAlign:'center'}}>
          <div style={{fontSize:'1.8rem',marginBottom:4}}>{s.icon}</div>
          <div style={{fontWeight:800,fontSize:'0.85rem',color:s.c}}>{s.label}</div>
          <div style={{fontSize:'0.72rem',color:'#bbb',fontWeight:700}}>{s.desc}</div>
        </div>
      ))}
    </div>
    <div style={{background:'linear-gradient(135deg,#FFFDE8,#FFF0D0)',borderRadius:18,padding:18,border:'2px solid #FFD93D'}}>
      <div style={{fontFamily:'Fredoka One,cursive',color:'#B8860B',marginBottom:6}}>💡 Consejo del día</div>
      <div style={{fontSize:'1.4rem',marginBottom:4}}>{tip.emoji}</div>
      <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:4}}>{tip.titulo}</div>
      <div style={{fontSize:'0.81rem',color:'#777',lineHeight:1.55}}>{tip.texto}</div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════
//  CLIENT PAGES
// ═══════════════════════════════════════════════════════════
function Noticias(){
  const [sel,setSel]=useState(null);
  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem',marginBottom:2}}>📰 Noticias</div>
    <div style={{color:'#ccc',fontSize:'0.81rem',fontWeight:700,marginBottom:16}}>Lo último del mundo capilar ✨</div>
    {NOTICIAS.map((n,i)=>(
      <div key={i} onClick={()=>{SFX.click();setSel(sel===i?null:i);}} style={{background:'white',borderRadius:18,padding:18,marginBottom:12,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',cursor:'pointer',border:sel===i?'2px solid #FF6B9D':'2px solid transparent',transition:'all 0.25s'}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <div style={{fontSize:'2rem'}}>{n.emoji}</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div style={{fontWeight:800,fontSize:'0.92rem'}}>{n.titulo}</div>
              <Badge c="blue">{n.tag}</Badge>
            </div>
            {sel===i?<div style={{fontSize:'0.82rem',color:'#666',lineHeight:1.6}}>{n.texto}</div>:<div style={{fontSize:'0.79rem',color:'#bbb',fontWeight:700}}>Toca para leer →</div>}
          </div>
        </div>
      </div>
    ))}
    <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.2rem',marginBottom:12,marginTop:8}}>✨ Consejos esenciales</div>
    {TIPS.map((t,i)=><Card key={i} style={{marginBottom:10}}><div style={{display:'flex',gap:12}}><div style={{fontSize:'1.6rem',flexShrink:0}}>{t.emoji}</div><div><div style={{fontWeight:800,marginBottom:4,fontSize:'0.9rem'}}>{t.titulo}</div><div style={{fontSize:'0.81rem',color:'#777',lineHeight:1.6}}>{t.texto}</div></div></div></Card>)}
  </div>);
}

function Productos({user,setUser,showToast,showPoints}){
  const [carrito,setCarrito]=useState([]);
  const add=p=>{SFX.click();setCarrito(c=>{const ex=c.find(x=>x.id===p.id);return ex?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}];});};
  const sub=p=>setCarrito(c=>c.map(x=>x.id===p.id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0));
  const total=carrito.reduce((a,x)=>a+x.precio*x.qty,0);
  const pts=Math.floor(total/3);

  const confirmar=async()=>{
    if(!carrito.length)return;
    const np=user.puntos+pts;
    await dbPatch('usuarios',`?id=eq.${user.id}`,{puntos:np});
    setUser({...user,puntos:np});
    SFX.coins(); showPoints(pts); showToast(`🛍️ Pedido de ${total.toFixed(2)}€! +${pts} puntos ⭐`);
    setCarrito([]);
  };

  const catColors={Tratamiento:'pink',Limpieza:'blue',Estilismo:'purple',Protección:'orange',Pack:'green'};
  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem',marginBottom:2}}>🛍️ Tienda</div>
    <div style={{color:'#ccc',fontSize:'0.81rem',fontWeight:700,marginBottom:14}}>1 punto por cada 3€ de compra ⭐</div>
    {carrito.length>0&&(
      <div style={{background:'linear-gradient(135deg,#6BCB77,#4CAF50)',borderRadius:16,padding:14,color:'white',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div><div style={{fontWeight:800}}>🛒 Tu carrito</div><div style={{fontSize:'0.8rem',opacity:0.9}}>{carrito.reduce((a,x)=>a+x.qty,0)} artículos · {total.toFixed(2)}€</div></div>
          <Btn sm col="yellow" onClick={confirmar}>Pedir 🚀</Btn>
        </div>
        <div style={{background:'rgba(255,255,255,0.2)',borderRadius:10,padding:'8px 12px',fontSize:'0.8rem',fontWeight:700}}>⭐ Ganarás <b>{pts} puntos</b> con esta compra</div>
      </div>
    )}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      {PRODUCTOS_TIENDA.map(p=>{
        const qty=carrito.find(x=>x.id===p.id)?.qty||0;
        return(<div key={p.id} style={{background:'white',borderRadius:18,padding:16,boxShadow:'0 4px 20px rgba(0,0,0,0.07)',display:'flex',flexDirection:'column'}}>
          <div style={{fontSize:'2.4rem',marginBottom:8,textAlign:'center'}}>{p.emoji}</div>
          <Badge c={catColors[p.cat]||'blue'}>{p.cat}</Badge>
          <div style={{fontWeight:800,fontSize:'0.87rem',marginTop:8,marginBottom:4}}>{p.nombre}</div>
          <div style={{fontSize:'0.74rem',color:'#bbb',marginBottom:10,flex:1,lineHeight:1.5}}>{p.desc}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.1rem',color:'#6BCB77'}}>{p.precio.toFixed(2)}€</div>
              <div style={{fontSize:'0.65rem',color:'#C77DFF',fontWeight:700}}>+{Math.floor(p.precio/3)} pts</div>
            </div>
            {qty>0?<div style={{display:'flex',alignItems:'center',gap:5}}>
              <button onClick={()=>sub(p)} style={{background:'#FFE8E8',border:'none',borderRadius:8,width:26,height:26,cursor:'pointer',fontWeight:800,color:'#C62828'}}>−</button>
              <span style={{fontWeight:800,fontFamily:'Fredoka One,cursive',minWidth:16,textAlign:'center'}}>{qty}</span>
              <button onClick={()=>add(p)} style={{background:'#E8FAE8',border:'none',borderRadius:8,width:26,height:26,cursor:'pointer',fontWeight:800,color:'#2E7D32'}}>+</button>
            </div>:<Btn sm col="pink" onClick={()=>add(p)}>+ Añadir</Btn>}
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function Juegos({user,setUser,showToast,showPoints}){
  const [juego,setJuego]=useState(null);
  const [cells,setCells]=useState([]);
  const [found,setFound]=useState(user.words_found||[]);
  const [tIdx,setTIdx]=useState(0);
  const [ans,setAns]=useState(null);

  const addPts=async pts=>{
    const np=user.puntos+pts;
    await dbPatch('usuarios',`?id=eq.${user.id}`,{puntos:np});
    setUser({...user,puntos:np});
  };

  const isFound=(r,c)=>found.some(word=>{
    for(let r2=0;r2<10;r2++) for(let c2=0;c2<10;c2++) if(GRID[r2][c2]===word[0])
      for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
        let ok=true;
        for(let k=0;k<word.length;k++){const nr=r2+dr*k,nc=c2+dc*k;if(nr<0||nr>=10||nc<0||nc>=10||GRID[nr][nc]!==word[k]){ok=false;break;}}
        if(ok) for(let k=0;k<word.length;k++) if(r2+dr*k===r&&c2+dc*k===c) return true;
      }
    return false;
  });

  const tap=async(r,c)=>{
    const idx=cells.findIndex(([sr,sc])=>sr===r&&sc===c);
    if(idx>=0){setCells(cells.slice(0,idx));return;}
    const ns=[...cells,[r,c]]; setCells(ns);
    if(ns.length>=3){
      const w=ns.map(([r,c])=>GRID[r][c]).join('');
      const m=WORDS.find(x=>x===w||x===w.split('').reverse().join(''));
      if(m&&!found.includes(m)){
        const nf=[...found,m];
        setFound(nf);
        await dbPatch('usuarios',`?id=eq.${user.id}`,{words_found:nf,puntos:user.puntos+20});
        setUser({...user,puntos:user.puntos+20,words_found:nf});
        SFX.coins(); showPoints(20); showToast(`✨ "${m}" encontrada! +20 pts`);
        if(nf.length===WORDS.length){setTimeout(async()=>{ await addPts(50); SFX.success(); showPoints(50); showToast('🏆 ¡Sopa completa! +50 bonus');},900);}
      }
      setCells([]);
    }
  };

  const preg=TRIVIA[tIdx%TRIVIA.length];
  const resp=async i=>{
    if(ans!==null)return; setAns(i);
    if(i===preg.ans){await addPts(preg.pts); SFX.coins(); showPoints(preg.pts); showToast(`🎉 ¡Correcto! +${preg.pts} pts`);}
    else{SFX.error(); showToast('❌ Incorrecto — ¡la próxima!');}
  };

  if(juego==='sopa')return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
      <button onClick={()=>{SFX.nav();setJuego(null);}} style={{background:'#F5F5F5',border:'none',borderRadius:10,padding:'7px 12px',cursor:'pointer',fontWeight:800,fontFamily:'Nunito,sans-serif'}}>← Volver</button>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.4rem'}}>🔤 Sopa de Letras</div>
    </div>
    <div style={{background:'linear-gradient(135deg,#E8F0FF,#F3E8FF)',borderRadius:14,padding:12,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:'0.79rem',color:'#5C6BC0',marginBottom:7}}>Encuentra (+20 pts c/u):</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{WORDS.map(w=><span key={w} style={{background:found.includes(w)?'#6BCB77':'white',color:found.includes(w)?'white':'#777',borderRadius:50,padding:'3px 9px',fontSize:'0.72rem',fontWeight:700,textDecoration:found.includes(w)?'line-through':'none',transition:'all 0.3s'}}>{w}</span>)}</div>
    </div>
    <div style={{overflowX:'auto'}}><div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3,maxWidth:340,margin:'0 auto'}}>
      {GRID.map((row,r)=>row.map((l,c)=>{ const s=cells.some(([sr,sc])=>sr===r&&sc===c),fd=isFound(r,c);
        return <button key={`${r}-${c}`} onClick={()=>tap(r,c)} style={{background:fd?'#6BCB77':s?'#FF6B9D':'white',color:(fd||s)?'white':'#2D2D2D',border:'none',borderRadius:6,aspectRatio:1,fontWeight:800,fontSize:'0.72rem',cursor:'pointer',fontFamily:'Nunito,sans-serif',padding:0,transition:'all 0.15s'}}>{l}</button>;
      }))}
    </div></div>
    {found.length===WORDS.length&&<div style={{textAlign:'center',marginTop:20,background:'linear-gradient(135deg,#FFD93D,#FF9A3C)',borderRadius:18,padding:22,color:'white'}}><div style={{fontSize:'2.5rem'}}>🏆</div><div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.5rem'}}>¡Completada!</div></div>}
  </div>);

  if(juego==='trivia')return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
      <button onClick={()=>{SFX.nav();setJuego(null);}} style={{background:'#F5F5F5',border:'none',borderRadius:10,padding:'7px 12px',cursor:'pointer',fontWeight:800,fontFamily:'Nunito,sans-serif'}}>← Volver</button>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.4rem'}}>🧠 Trivia Capilar</div>
    </div>
    <Card>
      <div style={{background:'linear-gradient(135deg,#2E7D32,#4CAF50)',borderRadius:14,padding:18,color:'white',marginBottom:16}}>
        <div style={{fontSize:'0.71rem',fontWeight:700,opacity:0.85,marginBottom:6}}>PREGUNTA {(tIdx%TRIVIA.length)+1}/{TRIVIA.length} · {preg.pts} PTS</div>
        <div style={{fontWeight:800,fontSize:'1rem',lineHeight:1.55}}>{preg.q}</div>
      </div>
      {preg.opts.map((opt,i)=>{let bg='white',col='#2D2D2D',brd='2px solid #F0EAE0';if(ans!==null){if(i===preg.ans){bg='#E8FAE8';brd='2px solid #6BCB77';col='#2E7D32';}else if(i===ans){bg='#FFE8E8';brd='2px solid #FF6B6B';col='#C62828';}}return <button key={i} onClick={()=>resp(i)} style={{width:'100%',textAlign:'left',padding:'12px 14px',background:bg,border:brd,borderRadius:12,marginBottom:7,fontFamily:'Nunito,sans-serif',fontWeight:700,fontSize:'0.88rem',cursor:ans===null?'pointer':'default',color:col,transition:'all 0.2s'}}>{opt}</button>;})}
      {ans!==null&&<div style={{textAlign:'center',marginTop:10}}><Btn onClick={()=>{SFX.nav();setTIdx(n=>(n+1)%TRIVIA.length);setAns(null);}} col="blue">Siguiente →</Btn></div>}
    </Card>
  </div>);

  return(<div style={{animation:'fadeSlide 0.3s ease'}}>
    <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem',marginBottom:2}}>🎮 Juegos</div>
    <div style={{color:'#ccc',fontSize:'0.81rem',fontWeight:700,marginBottom:14}}>Juega, sube al ranking y gana premios ✨</div>
    <div style={{background:'linear-gradient(135deg,#C77DFF,#4D96FF)',borderRadius:20,padding:'18px 20px',color:'white',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:'0.77rem',opacity:0.85,fontWeight:700}}>TUS PUNTOS</div><div style={{fontFamily:'Fredoka One,cursive',fontSize:'2.2rem'}}>{user.puntos} ⭐</div></div>
      <div style={{fontSize:'0.76rem',opacity:0.85,textAlign:'right',lineHeight:1.7}}><div>500 = 10% dto</div><div>1000 = 20% dto</div><div>2000 = Gratis</div></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
      {[{icon:'🔤',name:'Sopa de Letras',desc:'Palabras capilares',pts:'+20 pts/palabra',c:'#4D96FF',bg:'#E8F0FF',act:()=>{SFX.nav();setJuego('sopa');}},{icon:'🧠',name:'Trivia Capilar',desc:'¿Cuánto sabes?',pts:'+10–15 pts',c:'#C77DFF',bg:'#F3E8FF',act:()=>{SFX.nav();setJuego('trivia');}}].map((j,i)=>(
        <div key={i} onClick={j.act} style={{background:'white',borderRadius:18,padding:16,boxShadow:'0 4px 20px rgba(0,0,0,0.07)',cursor:'pointer',border:`2px solid ${j.c}22`,transition:'transform 0.15s'}} onPointerDown={e=>e.currentTarget.style.transform='scale(0.95)'} onPointerUp={e=>e.currentTarget.style.transform='scale(1)'} onPointerLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <div style={{fontSize:'2.4rem',marginBottom:8}}>{j.icon}</div>
          <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:4}}>{j.name}</div>
          <div style={{fontSize:'0.74rem',color:'#bbb',marginBottom:8}}>{j.desc}</div>
          <span style={{background:j.bg,color:j.c,borderRadius:50,padding:'3px 10px',fontSize:'0.7rem',fontWeight:800}}>{j.pts}</span>
        </div>
      ))}
    </div>
    <Card>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.1rem',marginBottom:12}}>🎁 Canjear puntos</div>
      {[{pts:500,icon:'💅',desc:'10% descuento'},{pts:1000,icon:'✨',desc:'20% descuento'},{pts:2000,icon:'👑',desc:'Servicio de cortesía'}].map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:i<2?'1px solid #F9F9F9':'none'}}>
          <div style={{fontSize:'1.6rem'}}>{r.icon}</div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:'0.87rem'}}>{r.desc}</div><div style={{fontSize:'0.73rem',color:'#C77DFF',fontWeight:700}}>⭐ {r.pts} pts</div></div>
          <Btn sm col={user.puntos>=r.pts?'pink':'gray'} onClick={async()=>{
            if(user.puntos>=r.pts){
              const np=user.puntos-r.pts;
              await dbPatch('usuarios',`?id=eq.${user.id}`,{puntos:np});
              setUser({...user,puntos:np}); SFX.success();
              showToast(`🎁 ¡${r.desc} canjeado! Muéstraselo en la peluquería`);
            } else { SFX.error(); showToast('⭐ No tienes suficientes puntos'); }
          }}>{user.puntos>=r.pts?'Canjear':'🔒'}</Btn>
        </div>
      ))}
    </Card>
  </div>);
}


// ═══════════════════════════════════════════════════════════
//  SOCIAL FEED
// ═══════════════════════════════════════════════════════════
function SocialFeed({user, setUser, showToast, showPoints}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [cmModal, setCmModal] = useState(null);
  const [comments, setComments] = useState({});
  const [newCm, setNewCm] = useState('');
  const [liked, setLiked] = useState(new Set());
  const [f, setF] = useState({titulo:'', contenido:'', emoji:'✂️', tipo:'post'});
  const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.STAFF;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [p, l] = await Promise.all([
      dbGet('publicaciones', '?select=*,usuarios(nombre,avatar)&order=created_at.desc'),
      dbGet('likes', `?usuario_id=eq.${user.id}&publicacion_id=not.is.null&select=publicacion_id`),
    ]);
    setPosts(p||[]); setLiked(new Set((l||[]).map(x=>x.publicacion_id))); setLoading(false);
  };

  const loadCm = async (pid) => {
    const c = await dbGet('comentarios', `?publicacion_id=eq.${pid}&select=*,usuarios(nombre,avatar)&order=created_at.asc`);
    setComments(prev => ({...prev, [pid]: c||[]}));
  };

  const toggleLike = async (post) => {
    const isLiked = liked.has(post.id);
    if (isLiked) {
      await dbDelete('likes', `?usuario_id=eq.${user.id}&publicacion_id=eq.${post.id}`);
      await dbPatch('publicaciones', `?id=eq.${post.id}`, {likes_count: Math.max(0, post.likes_count-1)});
      setLiked(prev => { const s=new Set(prev); s.delete(post.id); return s; });
      setPosts(prev => prev.map(p => p.id===post.id ? {...p, likes_count:Math.max(0,p.likes_count-1)} : p));
    } else {
      await dbPost('likes', {usuario_id:user.id, publicacion_id:post.id});
      await dbPatch('publicaciones', `?id=eq.${post.id}`, {likes_count: post.likes_count+1});
      setLiked(prev => new Set([...prev, post.id]));
      setPosts(prev => prev.map(p => p.id===post.id ? {...p, likes_count:p.likes_count+1} : p));
      SFX.coins();
      const np = user.puntos + 2;
      await dbPatch('usuarios', `?id=eq.${user.id}`, {puntos: np});
      setUser({...user, puntos: np});
      if (showPoints) showPoints(2);
    }
  };

  const sendCm = async () => {
    if (!newCm.trim() || !cmModal) return;
    await dbPost('comentarios', {publicacion_id:cmModal.id, autor_id:user.id, contenido:newCm.trim(), likes_count:0});
    setNewCm(''); await loadCm(cmModal.id);
    SFX.coins();
    const np = user.puntos + 3;
    await dbPatch('usuarios', `?id=eq.${user.id}`, {puntos: np});
    setUser({...user, puntos: np});
    if (showPoints) showPoints(3);
    showToast('💬 Comentario publicado! +3 pts');
  };

  const publish = async () => {
    if (!f.titulo||!f.contenido) { showToast('⚠️ Rellena título y contenido'); return; }
    await dbPost('publicaciones', {autor_id:user.id, ...f, likes_count:0});
    setModal(false); setF({titulo:'', contenido:'', emoji:'✂️', tipo:'post'});
    load(); SFX.success(); showToast('📝 Publicación creada!');
  };

  const ago = s => { const d=(Date.now()-new Date(s))/1000; if(d<60)return'ahora'; if(d<3600)return`${Math.floor(d/60)}m`; if(d<86400)return`${Math.floor(d/3600)}h`; return`${Math.floor(d/86400)}d`; };
  const TB = {post:{c:'green',l:'Post'}, noticia:{c:'blue',l:'Noticia'}, oferta:{c:'pink',l:'Oferta'}, reto:{c:'yellow',l:'Reto'}};

  return (
    <div style={{animation:'fadeSlide 0.3s ease'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div style={{fontFamily:'Fredoka One,cursive', fontSize:'1.8rem'}}>📱 Feed</div>
        {isAdmin && <Btn sm col="green" onClick={()=>setModal(true)}>✍️ Publicar</Btn>}
      </div>
      {loading ? <Card><div style={{textAlign:'center',color:'#bbb',padding:30}}>⏳ Cargando...</div></Card>
      : posts.length===0 ? <Card><div style={{textAlign:'center',color:'#bbb',padding:24,fontWeight:700}}>Sin publicaciones aún ✍️</div></Card>
      : posts.map(post => {
        const isLiked = liked.has(post.id);
        const tb = TB[post.tipo]||TB.post;
        return (
          <Card key={post.id} style={{marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <AvatarSVG av={post.usuarios?.avatar} size={40}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:'0.88rem'}}>{post.usuarios?.nombre||SHOP.name}</div>
                <div style={{fontSize:'0.72rem',color:'#bbb'}}>{ago(post.created_at)}</div>
              </div>
              <Badge c={tb.c}>{tb.l}</Badge>
            </div>
            <div style={{fontSize:'1.8rem',marginBottom:6}}>{post.emoji}</div>
            <div style={{fontWeight:800,fontSize:'1rem',marginBottom:6}}>{post.titulo}</div>
            <div style={{fontSize:'0.85rem',color:'#666',lineHeight:1.6,marginBottom:12}}>{post.contenido}</div>
            <div style={{display:'flex',gap:10,paddingTop:10,borderTop:'1px solid #F0F0F0'}}>
              <button onClick={()=>toggleLike(post)} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.84rem',color:isLiked?'#E91E8C':'#bbb',padding:'4px 8px',borderRadius:8}}>
                {isLiked?'❤️':'🤍'} {post.likes_count}
              </button>
              <button onClick={async()=>{await loadCm(post.id);setCmModal(post);}} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.84rem',color:'#bbb',padding:'4px 8px',borderRadius:8}}>
                💬 Comentar
              </button>
              <a href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:5,fontWeight:700,fontSize:'0.84rem',color:'#4CAF50',padding:'4px 8px',borderRadius:8,textDecoration:'none',marginLeft:'auto'}}>
                📱 Reservar
              </a>
            </div>
          </Card>
        );
      })}

      <Modal open={modal} onClose={()=>setModal(false)} title="✍️ Nueva Publicación">
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {['✂️','💅','🌿','🎉','💇','✨','🎁','🏆'].map(e=><button key={e} onClick={()=>setF({...f,emoji:e})} style={{fontSize:'1.4rem',background:f.emoji===e?'#E8F5E9':'#F5F5F5',border:f.emoji===e?'2px solid #4CAF50':'2px solid transparent',borderRadius:10,padding:'6px 8px',cursor:'pointer'}}>{e}</button>)}
        </div>
        <FI label="Título" value={f.titulo} onChange={e=>setF({...f,titulo:e.target.value})} placeholder="Título de la publicación"/>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:'0.74rem',fontWeight:800,marginBottom:4,color:'#bbb',textTransform:'uppercase',letterSpacing:1}}>Contenido</label>
          <textarea value={f.contenido} onChange={e=>setF({...f,contenido:e.target.value})} placeholder="Escribe aquí..." rows={4}
            style={{width:'100%',padding:'11px 13px',border:'2px solid #F0EAE0',borderRadius:12,fontFamily:'Nunito,sans-serif',fontSize:'0.9rem',fontWeight:600,outline:'none',background:'#FAFAFA',resize:'vertical',boxSizing:'border-box'}}/>
        </div>
        <FS label="Tipo" value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})}>
          <option value="post">📝 Post</option>
          <option value="noticia">📰 Noticia</option>
          <option value="oferta">🎁 Oferta</option>
          <option value="reto">🏆 Reto</option>
        </FS>
        <div style={{display:'flex',gap:10,marginTop:6,justifyContent:'flex-end'}}>
          <Btn col="gray" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn col="green" onClick={publish}>📤 Publicar</Btn>
        </div>
      </Modal>

      <Modal open={!!cmModal} onClose={()=>setCmModal(null)} title={`💬 ${cmModal?.titulo||''}`}>
        <div style={{maxHeight:240,overflowY:'auto',marginBottom:14}}>
          {(comments[cmModal?.id]||[]).length===0
            ? <div style={{textAlign:'center',color:'#bbb',padding:20,fontWeight:700}}>Sin comentarios. ¡Sé el primero!</div>
            : (comments[cmModal?.id]||[]).map(c=>(
              <div key={c.id} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid #F5F5F5'}}>
                <AvatarSVG av={c.usuarios?.avatar} size={34}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:'0.82rem'}}>{c.usuarios?.nombre||'?'} <span style={{fontWeight:400,color:'#bbb',fontSize:'0.72rem'}}>{ago(c.created_at)}</span></div>
                  <div style={{fontSize:'0.84rem',color:'#666',marginTop:2}}>{c.contenido}</div>
                </div>
              </div>
            ))
          }
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={newCm} onChange={e=>setNewCm(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')sendCm();}}
            placeholder="Escribe un comentario..." style={{flex:1,padding:'10px 13px',border:'2px solid #F0EAE0',borderRadius:12,fontFamily:'Nunito,sans-serif',fontSize:'0.88rem',fontWeight:600,outline:'none',background:'#FAFAFA'}}/>
          <Btn sm col="green" onClick={sendCm}>Enviar</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RANKING
// ═══════════════════════════════════════════════════════════
function Ranking({user}) {
  const [tab, setTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const r = await dbGet('usuarios', '?role=eq.client&select=id,nombre,puntos,visitas,avatar&order=puntos.desc');
    setUsers(r||[]); setLoading(false);
  };

  const medals = ['🥇','🥈','🥉'];
  const myPos = users.findIndex(u => u.id===user.id) + 1;
  const tabs = [{id:'general',l:'🌍 General'},{id:'semanal',l:'📅 Semanal'},{id:'mensual',l:'📆 Mensual'},{id:'anual',l:'🗓 Anual'}];

  return (
    <div style={{animation:'fadeSlide 0.3s ease'}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem',marginBottom:4}}>🏆 Ranking</div>
      <div style={{color:'#bbb',fontSize:'0.81rem',fontWeight:700,marginBottom:14}}>Compite y gana premios ✨</div>

      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:14}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
          style={{padding:'8px 14px',borderRadius:50,border:'none',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:'0.78rem',cursor:'pointer',background:tab===t.id?'linear-gradient(135deg,#2E7D32,#4CAF50)':'white',color:tab===t.id?'white':'#bbb',boxShadow:tab===t.id?'0 4px 14px rgba(46,125,50,0.3)':'none',whiteSpace:'nowrap',flexShrink:0,transition:'all 0.2s'}}>
          {t.l}
        </button>)}
      </div>

      {users.length>=3 && (
        <div style={{background:'linear-gradient(180deg,#C8E6C9,white)',borderRadius:20,padding:'20px 10px',marginBottom:14,display:'flex',alignItems:'flex-end',justifyContent:'center',gap:8}}>
          {[1,0,2].map(idx => {
            const u = users[idx]; if(!u) return null;
            const hs=[100,130,85];
            return <div key={u.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{fontSize:'1.4rem'}}>{medals[idx]}</div>
              <AvatarSVG av={u.avatar} size={idx===0?52:44}/>
              <div style={{fontWeight:800,fontSize:'0.74rem',textAlign:'center',maxWidth:68,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.nombre.split(' ')[0]}</div>
              <div style={{background:idx===0?'linear-gradient(135deg,#2E7D32,#4CAF50)':idx===1?'linear-gradient(135deg,#E91E8C,#F48FB1)':'linear-gradient(135deg,#4CAF50,#81C784)',color:'white',borderRadius:50,padding:'3px 9px',fontSize:'0.71rem',fontWeight:800}}>⭐{u.puntos}</div>
              <div style={{width:58,height:hs[idx],background:idx===0?'linear-gradient(135deg,#2E7D32,#4CAF50)':idx===1?'linear-gradient(135deg,#E91E8C,#F48FB1)':'linear-gradient(135deg,#4CAF50,#81C784)',borderRadius:'8px 8px 0 0',opacity:0.7}}/>
            </div>;
          })}
        </div>
      )}

      {myPos>0 && <div style={{background:'#E8F5E9',borderRadius:14,padding:'12px 16px',marginBottom:14,border:'2px solid #81C784',display:'flex',alignItems:'center',gap:10}}>
        <div style={{fontWeight:900,color:'#2E7D32',minWidth:28}}>#{myPos}</div>
        <AvatarSVG av={user.avatar} size={36}/>
        <div style={{flex:1,fontWeight:800,fontSize:'0.88rem'}}>Tú — {user.nombre.split(' ')[0]}</div>
        <div style={{fontWeight:900,color:'#2E7D32'}}>⭐ {user.puntos}</div>
      </div>}

      {loading ? <Card><div style={{textAlign:'center',color:'#bbb',padding:24}}>⏳ Cargando...</div></Card>
      : users.map((u,i) => (
        <div key={u.id} style={{background:'white',borderRadius:14,padding:12,marginBottom:8,boxShadow:'0 2px 12px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:10,border:u.id===user.id?'2px solid #4CAF50':'1px solid #E8F5E9'}}>
          <div style={{fontWeight:900,fontSize:'1.2rem',minWidth:32,textAlign:'center',color:i<3?'#E91E8C':'#bbb'}}>{medals[i]||`#${i+1}`}</div>
          <AvatarSVG av={u.avatar} size={38}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:'0.88rem'}}>{u.nombre}</div>
            <div style={{fontSize:'0.72rem',color:'#bbb'}}>{u.visitas} visitas</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:900,color:'#E91E8C'}}>⭐ {u.puntos}</div>
            {i<3 && <Badge c={i===0?'yellow':i===1?'green':'blue'}>{medals[i]}</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RETOS
// ═══════════════════════════════════════════════════════════
function Retos({user, setUser, showToast, showPoints}) {
  const [retos, setRetos] = useState([]);
  const [prog, setProg] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('semanal');

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    const [r, p] = await Promise.all([
      dbGet('retos', `?tipo=eq.${tab}&activo=eq.true&select=*`),
      dbGet('retos_progreso', `?usuario_id=eq.${user.id}&select=*`),
    ]);
    setRetos(r||[]);
    const pg = {};
    (p||[]).forEach(x => pg[x.reto_id]=x);
    setProg(pg); setLoading(false);
  };

  const claim = async (reto) => {
    const p = prog[reto.id];
    if (!p||p.progreso<reto.meta) return;
    if (p.completado) { showToast('Ya reclamaste este reto'); return; }
    await dbPatch('retos_progreso', `?id=eq.${p.id}`, {completado:true});
    const np = user.puntos + reto.puntos_premio;
    await dbPatch('usuarios', `?id=eq.${user.id}`, {puntos:np});
    setUser({...user, puntos:np});
    SFX.success(); if(showPoints) showPoints(reto.puntos_premio);
    showToast(`🏆 ¡Reto completado! +${reto.puntos_premio} pts`);
    load();
  };

  const daysLeft = f => { if(!f)return'∞'; const d=Math.ceil((new Date(f)-new Date())/86400000); return d>0?`${d}d`:'Fin'; };

  return (
    <div style={{animation:'fadeSlide 0.3s ease'}}>
      <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.8rem',marginBottom:4}}>🎯 Retos</div>
      <div style={{color:'#bbb',fontSize:'0.81rem',fontWeight:700,marginBottom:14}}>Completa retos y gana puntos extra ✨</div>

      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {[['semanal','📅 Semanal'],['mensual','📆 Mensual'],['anual','🗓 Anual']].map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'9px 6px',borderRadius:12,border:'none',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:'0.78rem',cursor:'pointer',background:tab===id?'linear-gradient(135deg,#2E7D32,#4CAF50)':'white',color:tab===id?'white':'#bbb',boxShadow:tab===id?'0 4px 14px rgba(46,125,50,0.3)':'none',transition:'all 0.2s'}}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <Card><div style={{textAlign:'center',color:'#bbb',padding:24}}>⏳ Cargando...</div></Card>
      : retos.length===0 ? <Card><div style={{textAlign:'center',color:'#bbb',padding:24,fontWeight:700}}>Sin retos activos</div></Card>
      : retos.map(r => {
        const p = prog[r.id];
        const pv = p?.progreso||0;
        const pct = Math.min(100, Math.round((pv/r.meta)*100));
        const done = p?.completado;
        const canClaim = pv>=r.meta && !done;

        return (
          <Card key={r.id} style={{border:canClaim?'2px solid #4CAF50':done?'2px solid #81C784':'1px solid #E8F5E9'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:4}}>{r.titulo}</div>
                <div style={{fontSize:'0.82rem',color:'#666',lineHeight:1.5}}>{r.descripcion}</div>
              </div>
              <div style={{textAlign:'right',marginLeft:10}}>
                <div style={{fontWeight:900,color:'#E91E8C',fontSize:'1.1rem'}}>+{r.puntos_premio}⭐</div>
                <div style={{fontSize:'0.72rem',color:'#bbb'}}>{daysLeft(r.fecha_fin)}</div>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <div style={{fontSize:'0.77rem',fontWeight:700,color:'#bbb'}}>Progreso</div>
                <div style={{fontSize:'0.77rem',fontWeight:800,color:'#4CAF50'}}>{pv}/{r.meta}</div>
              </div>
              <div style={{height:8,background:'#E8F5E9',borderRadius:50,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:done?'linear-gradient(135deg,#2E7D32,#4CAF50)':canClaim?'linear-gradient(135deg,#E91E8C,#F48FB1)':'linear-gradient(135deg,#4CAF50,#81C784)',borderRadius:50,transition:'width 0.6s ease'}}/>
              </div>
            </div>
            {done ? <div style={{background:'#E8F5E9',borderRadius:10,padding:'8px 12px',fontSize:'0.82rem',fontWeight:700,color:'#2E7D32'}}>✅ Reto completado y reclamado</div>
            : canClaim ? <Btn full col="green" onClick={()=>claim(r)}>🏆 ¡Reclamar {r.puntos_premio} puntos!</Btn>
            : <div style={{fontSize:'0.78rem',color:'#bbb',fontWeight:600}}>{r.meta-pv} acciones más para completarlo</div>}
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  NAV CONFIG
// ═══════════════════════════════════════════════════════════
const NAV_CFG={
  admin:[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'citas',icon:'📅',label:'Citas'},{id:'clientes',icon:'👥',label:'Clientes'},{id:'inventario',icon:'📦',label:'Stock'},{id:'caja',icon:'💰',label:'Caja'},{id:'usuarios',icon:'👑',label:'Usuarios'},{id:'perfil',icon:'👤',label:'Perfil'}],
  staff:[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'citas',icon:'📅',label:'Citas'},{id:'clientes',icon:'👥',label:'Clientes'},{id:'inventario',icon:'📦',label:'Stock'},{id:'caja',icon:'💰',label:'Caja'},{id:'perfil',icon:'👤',label:'Perfil'}],
  client:[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'feed',icon:'📱',label:'Feed'},{id:'tienda',icon:'🛍️',label:'Tienda'},{id:'juegos',icon:'🎮',label:'Juegos'},{id:'retos',icon:'🎯',label:'Retos'},{id:'ranking',icon:'🏆',label:'Ranking'},{id:'perfil',icon:'👤',label:'Perfil'}],
};
const GRAD={admin:'linear-gradient(135deg,#1B5E20,#2E7D32)',staff:'linear-gradient(135deg,#2E7D32,#4CAF50)',client:'linear-gradient(135deg,#4CAF50,#81C784)'};

// ═══════════════════════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════════════════════
export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState('dashboard');
  const [toast,setToast]=useState({show:false,msg:''});
  const [ptsPopup,setPtsPopup]=useState({show:false,pts:0});
  const [musicOn,setMusicOn]=useState(false);

  const showToast=useCallback(msg=>{setToast({show:true,msg});setTimeout(()=>setToast({show:false,msg:''}),3200);},[]);
  const showPoints=useCallback(pts=>{setPtsPopup({show:true,pts});setTimeout(()=>setPtsPopup({show:false,pts:0}),1800);},[]);
  const toggleMusic=()=>{if(musicOn){stopMusic();setMusicOn(false);}else{startMusic();setMusicOn(true);}};
  const navTo=id=>{SFX.nav();setPage(id);};
  const logout=()=>{setUser(null);setPage('dashboard');};

  if(!user) return <Auth onLogin={u=>{setUser(u);setPage('dashboard');}} showToast={showToast}/>;

  const role=user.role;
  const nav=NAV_CFG[role]||NAV_CFG.client;
  const grad=GRAD[role]||GRAD.client;
  const ap=nav.find(n=>n.id===page)?page:'dashboard';

  const sp={showToast,showPoints};
  const pages={
    dashboard: role===ROLES.CLIENT?<ClientDashboard user={user}/>:<DashboardAdmin user={user}/>,
    citas:     <Citas {...sp}/>,
    clientes:  <Clientes {...sp}/>,
    inventario:<Inventario {...sp}/>,
    caja:      <Caja {...sp}/>,
    usuarios:  <AdminUsuarios {...sp}/>,
    feed:      <SocialFeed user={user} setUser={setUser} {...sp}/>,
    noticias:  <Noticias/>,
    tienda:    <Productos user={user} setUser={setUser} {...sp}/>,
    juegos:    <Juegos user={user} setUser={setUser} {...sp}/>,
    retos:     <Retos user={user} setUser={setUser} {...sp}/>,
    ranking:   <Ranking user={user}/>,
    perfil:    <Perfil user={user} setUser={setUser} onLogout={logout} {...sp}/>,
  };

  return(<div style={{fontFamily:'Nunito,sans-serif',background:'#F1F8E9',minHeight:'100vh',maxWidth:480,margin:'0 auto',paddingBottom:82,position:'relative'}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');@keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes floatUp{0%{transform:translateY(110vh) rotate(0deg);opacity:0}10%{opacity:.35}90%{opacity:.2}100%{transform:translateY(-10vh) rotate(360deg);opacity:0}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{display:none}input,select,button{font-family:Nunito,sans-serif}`}</style>
    <Particles/>
    <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
    {/* HEADER */}
    <div style={{background:grad,padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:50,boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{fontFamily:'Fredoka One,cursive',fontSize:'1.4rem',color:'white'}}>✂️ PeluquerIA</div>
        {role!=='client'&&<span style={{background:'rgba(255,255,255,0.25)',color:'white',borderRadius:50,padding:'2px 8px',fontSize:'0.7rem',fontWeight:800,textTransform:'uppercase'}}>{role}</span>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <button onClick={toggleMusic} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:50,padding:'5px 10px',cursor:'pointer',color:'white',fontWeight:800,fontSize:'0.75rem'}}>{musicOn?'🔇':'🎵'}</button>
        {role==='client'&&<div style={{background:'rgba(255,255,255,0.22)',borderRadius:50,padding:'5px 12px',color:'white',fontWeight:800,fontSize:'0.84rem'}}>⭐ {user.puntos}</div>}
        <div onClick={()=>navTo('perfil')} style={{cursor:'pointer',padding:2,background:'rgba(255,255,255,0.2)',borderRadius:'50%'}}><AvatarSVG av={user.avatar} size={34}/></div>
      </div>
    </div>
    {/* PAGE */}
    <div style={{padding:'18px 14px'}}>{pages[ap]||pages['dashboard']}</div>
    {/* BOTTOM NAV */}
    <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'white',borderTop:'1.5px solid #F0EAE0',display:'flex',justifyContent:'space-around',padding:'7px 2px 11px',zIndex:100,boxShadow:'0 -4px 20px rgba(0,0,0,0.07)'}}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>navTo(n.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',padding:'2px 4px',minWidth:38}}>
          <div style={{fontSize:'1.1rem',background:ap===n.id?grad:'transparent',borderRadius:10,padding:'4px 7px',transform:ap===n.id?'scale(1.2)':'scale(1)',transition:'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',boxShadow:ap===n.id?'0 3px 12px rgba(0,0,0,0.2)':'none'}}>{n.icon}</div>
          <span style={{fontSize:'0.54rem',fontWeight:800,color:ap===n.id?'#FF6B9D':'#ccc',transition:'color 0.2s'}}>{n.label}</span>
        </button>
      ))}
    </div>
    <Toast msg={toast.msg} show={toast.show}/>
  </div>);
}
