import React from "react";
import { SFX } from "../audio/audioEngine.js";
import { T } from "../config/appConfig.js";

function Btn({children,onClick,col="green",full=false,small=false,disabled=false,style:sx={}}){
  const C={green:{bg:T.gradClient,sh:"rgba(64,145,108,0.35)"},dark:{bg:T.gradAdmin,sh:"rgba(27,67,50,0.35)"},pink:{bg:T.gradPink,sh:"rgba(233,30,140,0.3)"},gold:{bg:T.gradGold,sh:"rgba(255,183,3,0.35)"},red:{bg:"linear-gradient(135deg,#E53935,#EF5350)",sh:"rgba(229,57,53,0.3)"},ghost:{bg:"transparent",sh:"none"}};
  const c=C[col]||C.green;
  return <button onClick={disabled?undefined:(e)=>{col==="ghost"?SFX.click():SFX.action();onClick?.(e);}} className="bp" style={{background:col==="ghost"?"rgba(255,244,214,.72)":c.bg,color:col==="ghost"?T.g700:T.white,border:col==="ghost"?`2px solid ${T.g300}`:"1px solid rgba(255,255,255,.22)",borderRadius:16,padding:small?"8px 14px":"12px 20px",fontWeight:900,fontSize:small?"0.78rem":"0.9rem",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,width:full?"100%":"auto",boxShadow:col==="ghost"?"0 6px 16px rgba(20,8,4,.12)":`0 8px 22px ${c.sh}`,transition:"all 0.18s ease",letterSpacing:".2px",...sx}}>{children}</button>;
}

function Card({children,style:sx={},onClick,hover=false}){
  return <div onClick={onClick?(e)=>{SFX.tab();onClick(e);}:undefined} className={`${hover?"ch":""} studio-panel`} style={{background:T.panel,borderRadius:20,padding:"16px",boxShadow:"0 8px 18px rgba(18,8,4,0.24)",border:`2px solid ${T.g300}`,transition:"all 0.22s ease",cursor:onClick?"pointer":"default",animation:"cardLift .35s ease",...sx}}>{children}</div>;
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

function SectionHeader({icon,title,sub,action}){return <div style={{marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.3rem",color:T.g800}}>{icon} {title}</div>{sub&&<div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{sub}</div>}</div>{action}</div>;}

function StatCard({icon,label,value,col="green"}){
  const C={green:{bg:T.g150,ac:T.g600},gold:{bg:"#FFF8E1",ac:T.orange},pink:{bg:"#FCE4EC",ac:T.pink},blue:{bg:"#E3F2FD",ac:T.blue}};
  const c=C[col]||C.green;
  return <Card style={{background:c.bg,border:"none",padding:"14px 16px"}} hover><div style={{fontSize:"1.5rem",marginBottom:4}}>{icon}</div><div style={{fontSize:"0.72rem",fontWeight:700,color:T.textSub,marginBottom:2}}>{label}</div><div style={{fontWeight:900,fontSize:"1.4rem",color:c.ac}}>{value}</div></Card>;
}

export {
  Btn,
  Card,
  Input,
  Select,
  Badge,
  Modal,
  Spinner,
  EmptyState,
  SectionHeader,
  StatCard
};
