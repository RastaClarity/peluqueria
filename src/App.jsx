import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import "./styles/rastacuts.css";
import { HELP_TEXTS, HELP_TIPS } from "./data/rastaHelpData.js";
import {
  AVATARS,
  AVATAR_STYLES,
  MALE_HAIR,
  FEMALE_HAIR,
  BEARD_VALUES,
  BASIC_ACCESSORIES,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_MALE_AVATAR,
  DEFAULT_FEMALE_AVATAR,
  AVATAR_PRESETS,
  AVATAR_PRESET_NAMES,
  AVATAR_LABELS,
  COSMETIC_CATALOG_FALLBACK,
  PERSONALIZATION_SHOP_EXTRA
} from "./data/avatarShopData.js";
import {
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
  setMasterVolume,
  setMuted,
  setMusicPlaying,
  startGameMusic,
  startMusic,
  stopGameMusic
} from "./audio/audioEngine.js";
import { supabase, SUPA_URL } from "./lib/supabaseClient.js";
import { dbGet, dbPost, dbPatch, dbDelete } from "./lib/db.js";
import { createNotification, notificationIcon } from "./lib/notifications.js";
import { ROLES, normalizeRole, isAdminUser, isStaffUser, isInternalUser, normalizeText } from "./lib/users.js";
import {
  WEB_POINTS_DAILY_NORMAL_CAP,
  getWebPointsToday,
  addWebPointsToday,
  webPointsRemainingToday,
  readPointHistory,
  readPointHistoryFromDb,
  recordPointMovement,
  clearPointHistory,
  awardWebPoints,
  awardWebPointsByUserId,
  readLocalFeedLikes,
  saveLocalFeedLikes,
  hasLocalFeedLike,
  addLocalFeedLike,
  removeLocalFeedLike,
  personalizationProductFromCosmetic,
  avatarShopFallbackItems,
  readCart,
  writeCart,
  addToLocalCart,
  createShopOrder,
  hydrateCartItem,
  isAvatarPersonalizationItem,
  unlockCosmeticForUser,
  rarityLabel,
  rarityColor,
  cosmeticPatch,
  localOwnedCosmetics,
  saveLocalOwnedCosmetics
} from "./lib/rewards.js";
import {
  avatarLabel,
  safeJsonParse,
  normalizeAvatarConfig,
  avatarStyleName,
  avatarStorageKey,
  getLocalAvatarConfig,
  setLocalAvatarConfig,
  getAvatarConfigForProfile,
  saveAvatarConfigForUser,
  enrichProfilesWithAvatarConfigs,
  randomAvatarConfig,
  bgGradient,
  makeId,
  shadeHex,
  avatarColorForAccessory,
  avatarAuraColor,
  HAIR_STYLES,
  CLEAN_AVATAR_OPTIONS,
  cleanPick,
  cleanAvatarDefaults,
  normalizeAvatarV3
} from "./lib/avatarEngine.js";
import { T, BRAND, APP_VERSION, APP_VERSION_SHORT, APP_BUILD_DATE, APP_SAFE_MODE_KEY } from "./config/appConfig.js";
import { Btn, Card, Input, Select, Badge, Modal, Spinner, EmptyState, SectionHeader, StatCard } from "./components/ui.jsx";

let musicButtonClickTimer=null;
let musicButtonLastTap=0;

function userRP(u){return Math.max(0,Number(u?.puntos||0)||0);}
function userRC(u){return Math.max(0,Number(u?.rc??u?.rasta_coins??0)||0);}
function userXP(u){return Math.max(0,Number(u?.xp??u?.avatar_xp??0)||0);}
function userLevel(u){return Math.max(1,Number(u?.avatar_level||avatarLevelFromXP(userXP(u)))||1);}
function avatarLevelFromXP(xp){
  const clean=Math.max(0,Number(xp)||0);
  return Math.max(1,Math.floor(Math.sqrt(clean/120))+1);
}
function avatarLevelName(level){
  const l=Math.max(1,Number(level)||1);
  if(l>=30)return "Leyenda Rasta Cuts";
  if(l>=20)return "Maestro del Fade";
  if(l>=10)return "Barbero Callejero";
  if(l>=5)return "Aprendiz Rasta";
  return "Cliente Nuevo";
}

function avatarLevelXPRequired(level){
  const l=Math.max(1,Number(level)||1);
  return Math.round(Math.pow(l-1,2)*120);
}
function avatarLevelProgress(xp){
  const clean=Math.max(0,Number(xp)||0);
  const level=avatarLevelFromXP(clean);
  const current=avatarLevelXPRequired(level);
  const next=avatarLevelXPRequired(level+1);
  const span=Math.max(1,next-current);
  const pct=Math.max(0,Math.min(100,Math.round(((clean-current)/span)*100)));
  return {level,current,next,pct,remaining:Math.max(0,next-clean)};
}
const AVATAR_ROLE_TREE=[
  {level:1,title:"Cliente Nuevo",icon:"🌱",skill:"Acceso básico a perfil, rankings y tienda."},
  {level:5,title:"Aprendiz Rasta",icon:"🪮",skill:"Desbloquea identidad de jugador y primeras insignias."},
  {level:10,title:"Barbero Callejero",icon:"✂️",skill:"Rango visible fuerte para rankings, foro y comunidad."},
  {level:20,title:"Maestro del Fade",icon:"🔥",skill:"Rango avanzado para eventos, temporadas y retos premium."},
  {level:30,title:"Leyenda Rasta Cuts",icon:"👑",skill:"Rango legendario reservado para los usuarios más activos."},
];
function avatarUnlockedRoles(level){
  const l=Math.max(1,Number(level)||1);
  return AVATAR_ROLE_TREE.filter(r=>l>=r.level);
}
function avatarCurrentRole(level){
  const l=Math.max(1,Number(level)||1);
  return [...AVATAR_ROLE_TREE].reverse().find(r=>l>=r.level)||AVATAR_ROLE_TREE[0];
}
const AVATAR_BADGE_TREE=[
  {id:"role_cliente",level:1,icon:"🌱",title:"Cliente Nuevo",desc:"Primer rango activo en Rasta Cuts.",color:"green"},
  {id:"role_aprendiz",level:5,icon:"🪮",title:"Aprendiz Rasta",desc:"Primer salto real de progresión.",color:"gold"},
  {id:"role_barbero",level:10,icon:"✂️",title:"Barbero Callejero",desc:"Insignia visible para rankings y comunidad.",color:"blue"},
  {id:"role_maestro",level:20,icon:"🔥",title:"Maestro del Fade",desc:"Rango avanzado para usuarios muy activos.",color:"pink"},
  {id:"role_leyenda",level:30,icon:"👑",title:"Leyenda Rasta Cuts",desc:"Insignia legendaria del camino.",color:"gold"},
  {id:"rp_100",stat:"rp",min:100,icon:"💎",title:"Primer tesoro",desc:"Acumula 100 RP.",color:"green"},
  {id:"rc_500",stat:"rc",min:500,icon:"🪙",title:"Bolsillo arcade",desc:"Acumula 500 RC para juegos y Tycoon.",color:"blue"},
  {id:"xp_500",stat:"xp",min:500,icon:"⭐",title:"Avatar en marcha",desc:"Consigue 500 XP de avatar.",color:"gold"},
  {id:"rc_2500",stat:"rc",min:2500,icon:"🏦",title:"Magnate RC",desc:"Acumula 2.500 RC.",color:"pink"},
  {id:"xp_5000",stat:"xp",min:5000,icon:"🏆",title:"Camino serio",desc:"Consigue 5.000 XP de avatar.",color:"gold"},
];
function avatarBadgesForUser(user){
  const xp=userXP(user);
  const lvl=Number(user?.avatar_level||avatarLevelFromXP(xp));
  const stats={rp:userRP(user),rc:userRC(user),xp};
  return AVATAR_BADGE_TREE.map(b=>{
    const unlocked=b.level?lvl>=b.level:stats[b.stat]>=b.min;
    const progress=b.level?lvl:stats[b.stat];
    const target=b.level||b.min||1;
    const pct=Math.max(0,Math.min(100,Math.round((progress/target)*100)));
    return {...b,unlocked,progress,target,pct};
  });
}
function AvatarBadgesStrip({user,limit=5,dark=false}){
  const unlocked=avatarBadgesForUser(user).filter(b=>b.unlocked).slice(0,limit);
  if(!unlocked.length)return null;
  return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
    {unlocked.map(b=><span key={b.id} title={b.title} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 8px",borderRadius:999,border:`1px solid ${dark?"rgba(255,244,214,.45)":T.g300}`,background:dark?"rgba(255,244,214,.15)":"rgba(255,248,225,.85)",color:dark?T.white:T.g800,fontSize:".68rem",fontWeight:950,boxShadow:"0 4px 10px rgba(20,8,4,.12)"}}>{b.icon} {b.title}</span>)}
  </div>;
}
function AvatarMiniIdentity({profile,currentUser=null,dark=false,limit=3,showCurrency=false}){
  if(!profile)return null;
  const hidden=isPrivateProfile(profile,currentUser);
  return <div style={{marginTop:5}}>
    <AvatarBadgesStrip user={profile} limit={limit} dark={dark}/>
    {showCurrency&&!hidden&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:5}}>
      <span style={{fontSize:".62rem",fontWeight:900,opacity:dark ? .72 : .75,color:dark?T.white:T.textSub}}>💎 {userRP(profile)} RP</span>
      <span style={{fontSize:".62rem",fontWeight:900,opacity:dark ? .72 : .75,color:dark?T.white:T.textSub}}>🪙 {userRC(profile)} RC</span>
      <span style={{fontSize:".62rem",fontWeight:900,opacity:dark ? .72 : .75,color:dark?T.white:T.textSub}}>⭐ Nv. {Number(profile?.avatar_level||avatarLevelFromXP(userXP(profile)))}</span>
    </div>}
  </div>;
}
function AvatarBadgesPanel({user,compact=false}){
  const badges=avatarBadgesForUser(user);
  const unlocked=badges.filter(b=>b.unlocked).length;
  return <div style={{marginTop:compact?10:14,background:"rgba(255,248,225,.68)",border:`1px solid ${T.g200}`,borderRadius:18,padding:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
      <div>
        <div style={{fontWeight:950,color:T.g800}}>🏅 Insignias visibles</div>
        <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35}}>Se enseñan en perfil, rankings y comunidad para que el progreso tenga identidad.</div>
      </div>
      <Badge col="gold">{unlocked}/{badges.length}</Badge>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(132px,1fr))",gap:8}}>
      {badges.map(b=><div key={b.id} style={{border:`2px solid ${b.unlocked?T.gold:T.g200}`,background:b.unlocked?"linear-gradient(180deg,#FFF8E1,#F1D58F)":"rgba(255,244,214,.38)",borderRadius:16,padding:10,opacity:b.unlocked?1:.62}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div style={{fontSize:"1.35rem"}}>{b.unlocked?b.icon:"🔒"}</div>
          <Badge col={b.unlocked?(b.color||"gold"):"blue"}>{b.level?`Nv. ${b.level}`:`${b.min}`}</Badge>
        </div>
        <div style={{fontWeight:950,color:T.g800,fontSize:".82rem",marginTop:7}}>{b.title}</div>
        <div style={{fontSize:".70rem",fontWeight:820,color:T.textSub,lineHeight:1.3,marginTop:4}}>{b.unlocked?b.desc:`Progreso: ${b.progress}/${b.target}`}</div>
        {!b.unlocked&&<div style={{height:6,background:"rgba(75,48,27,.14)",borderRadius:999,overflow:"hidden",marginTop:8}}><div style={{height:"100%",width:`${b.pct}%`,background:T.gradGold,borderRadius:999}}/></div>}
      </div>)}
    </div>
  </div>;
}
function AvatarLevelRolesPanel({user,compact=false}){
  const xp=userXP(user);
  const progress=avatarLevelProgress(xp);
  const lvl=Number(user?.avatar_level||progress.level);
  const roleName=avatarLevelName(lvl);
  const unlocked=avatarUnlockedRoles(lvl);
  const nextRole=AVATAR_ROLE_TREE.find(r=>r.level>lvl)||null;
  return <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)",border:`2px solid ${T.g300}`}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:12}}>
      <div>
        <div style={{fontWeight:950,color:T.g800,fontSize:"1.02rem"}}>⭐ Nivel de avatar y roles</div>
        <div style={{fontSize:".78rem",fontWeight:820,color:T.textSub,lineHeight:1.35}}>La XP no se gasta. Sube tu nivel jugando, completando retos y usando el Tycoon.</div>
      </div>
      <div style={{textAlign:"right"}}>
        <Badge col="gold">Nivel {lvl}</Badge>
        <div style={{fontSize:".72rem",fontWeight:900,color:T.g700,marginTop:6}}>{roleName}</div>
      </div>
    </div>
    <div style={{background:"rgba(75,48,27,.14)",height:12,borderRadius:999,overflow:"hidden",border:`1px solid ${T.g200}`}}>
      <div style={{height:"100%",width:`${progress.pct}%`,background:"linear-gradient(90deg,#5F8E22,#D5B24F,#A72822)",borderRadius:999,transition:"width .45s ease"}}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:7,fontSize:".74rem",fontWeight:850,color:T.textSub}}>
      <span>{xp} XP</span>
      <span>{progress.remaining} XP para nivel {lvl+1}</span>
    </div>
    {compact&&<AvatarBadgesStrip user={user}/>}
    {!compact&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:8,marginTop:12}}>
        {AVATAR_ROLE_TREE.map(r=>{
          const ok=lvl>=r.level;
          return <div key={r.level} style={{border:`2px solid ${ok?T.gold:T.g200}`,background:ok?"linear-gradient(180deg,#FFF8E1,#F3E2B5)":"rgba(255,244,214,.42)",borderRadius:16,padding:10,opacity:ok?1:.62}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
              <div style={{fontSize:"1.35rem"}}>{ok?r.icon:"🔒"}</div>
              <Badge col={ok?"gold":"blue"}>Nv. {r.level}</Badge>
            </div>
            <div style={{fontWeight:950,color:T.g800,marginTop:7,fontSize:".86rem"}}>{r.title}</div>
            <div style={{fontSize:".72rem",fontWeight:820,color:T.textSub,lineHeight:1.32,marginTop:4}}>{ok?r.skill:`Se desbloquea al llegar al nivel ${r.level}.`}</div>
          </div>;
        })}
      </div>
      <AvatarBadgesPanel user={user}/>
      <div style={{marginTop:12,background:"rgba(255,244,214,.60)",border:`1px solid ${T.g200}`,borderRadius:16,padding:11}}>
        <div style={{fontWeight:950,color:T.g800}}>🎮 Cómo subir más rápido</div>
        <div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.42,marginTop:4}}>Gacha da sobre todo azar, RC y XP pequeños. Los juegos/misiones dan RP de forma controlada y el Tycoon alimenta la progresión con RC.</div>
        {nextRole&&<div style={{fontSize:".78rem",fontWeight:900,color:T.g700,marginTop:8}}>Siguiente rango: {nextRole.icon} {nextRole.title} en nivel {nextRole.level}</div>}
      </div>
    </>}
  </Card>;
}
function formatCurrencyBadge(user){return `💎 ${userRP(user)} RP · 🪙 ${userRC(user)} RC · ⭐ Nv. ${Number(user?.avatar_level||avatarLevelFromXP(userXP(user)))}`;}

function PublicProfileModal({profile,onClose}){
  const [publicStats,setPublicStats]=useState({loading:false,best:[],games:0,comments:0,likes:0,forum:0});

  useEffect(()=>{
    let alive=true;
    async function loadPublicStats(){
      if(!profile?.id&&!profile?.user_id&&!profile?.usuario_id){
        setPublicStats({loading:false,best:[],games:0,comments:0,likes:0,forum:0});
        return;
      }
      const uid=String(profile.id||profile.user_id||profile.usuario_id);
      setPublicStats(s=>({...s,loading:true}));
      try{
        const [scores,comments,likes,topics,replies]=await Promise.all([
          safeList("game_scores",`?usuario_id=eq.${uid}&order=score.desc&limit=120&select=game_id,score,created_at`),
          safeList("news_comments",`?usuario_id=eq.${uid}&limit=200&select=id`),
          safeList("news_likes",`?usuario_id=eq.${uid}&limit=200&select=id`),
          safeList("foro_temas",`?usuario_id=eq.${uid}&limit=200&select=id`),
          safeList("foro_respuestas",`?usuario_id=eq.${uid}&limit=200&select=id`)
        ]);

        const bestMap={};
        (scores||[]).forEach(s=>{
          const gid=String(s.game_id||s.juego||s.game||"").trim();
          if(!gid||gid==="gacha")return;
          const score=Number(s.score)||Number(s.points)||Number(s.puntos)||0;
          if(!bestMap[gid]||score>Number(bestMap[gid].score||0))bestMap[gid]={...s,game_id:gid,score};
        });

        const best=Object.values(bestMap)
          .sort((a,b)=>Number(b.score||0)-Number(a.score||0))
          .slice(0,4);

        if(alive)setPublicStats({
          loading:false,
          best,
          games:(scores||[]).length,
          comments:(comments||[]).length,
          likes:(likes||[]).length,
          forum:(topics||[]).length+(replies||[]).length
        });
      }catch(e){
        if(alive)setPublicStats({loading:false,best:[],games:0,comments:0,likes:0,forum:0});
      }
    }
    loadPublicStats();
    return()=>{alive=false;};
  },[profile?.id,profile?.user_id,profile?.usuario_id]);

  if(!profile)return null;
  const hidden=isPrivateProfile(profile);
  const cfg=normalizeAvatarV3(profile.avatar_config||profile.avatarConfig,profile.id||profile.avatar||0);
  const pts=userRP(profile);
  const rc=userRC(profile);
  const xp=userXP(profile);
  const levelNum=Number(profile.avatar_level||avatarLevelFromXP(xp));
  const nivel=avatarLevelName(levelNum);
  const progress=levelProgress(xp);
  const joinedLabel=profile.created_at?new Date(profile.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}):null;

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
    <div style={{display:"grid",gap:12}}>
      <Card style={{textAlign:"center",background:"linear-gradient(145deg,#120806,#183226 58%,#6E3518)",color:T.white,border:"2px solid rgba(242,200,91,.42)",overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-18,top:-20,fontSize:"6rem",opacity:.10}}>♛</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
            <div style={{borderRadius:"50%",padding:5,background:"linear-gradient(145deg,#FFF4D6,#E0B84F)",boxShadow:"0 14px 30px rgba(0,0,0,.28)"}}>
              <Av av={profile.avatar} config={cfg} size={102}/>
            </div>
          </div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.7rem",color:T.g50,lineHeight:1}}>{profile.nombre||profile.usuario_nombre||"Cliente Rasta"}</div>
          <div style={{fontSize:".78rem",fontWeight:850,color:"rgba(255,247,218,.74)",marginTop:5}}>
            {publicRoleLabel(profile)}{joinedLabel?` · desde ${joinedLabel}`:""}
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:11}}>
            <Badge col="gold">{nivel}</Badge>
            <Badge col="green">💎 {pts} RP</Badge>
            <Badge col="blue">🪙 {rc} RC</Badge>
            <Badge col="pink">⭐ {xp} XP</Badge>
          </div>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`1.5px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>⭐ Progreso público</div>
            <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub}}>Nivel {levelNum} · {progress.remaining} XP para el siguiente</div>
          </div>
          <Badge col="gold">{Math.round(progress.pct)}%</Badge>
        </div>
        <div style={{height:11,borderRadius:999,background:"rgba(110,53,24,.16)",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.max(5,Math.min(100,progress.pct))}%`,borderRadius:999,background:T.gradGold}}/>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginTop:10}}>
          <AvatarBadgesStrip user={profile} limit={5}/>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        <Card style={{padding:10,textAlign:"center",background:"linear-gradient(180deg,#F6E5BE,#E6C27A)"}}>
          <div style={{fontSize:"1.25rem"}}>🎮</div><b>{publicStats.games}</b><div style={{fontSize:".65rem",fontWeight:850,color:T.textSub}}>partidas</div>
        </Card>
        <Card style={{padding:10,textAlign:"center",background:"linear-gradient(180deg,#F6E5BE,#E6C27A)"}}>
          <div style={{fontSize:"1.25rem"}}>💬</div><b>{publicStats.comments}</b><div style={{fontSize:".65rem",fontWeight:850,color:T.textSub}}>comentarios</div>
        </Card>
        <Card style={{padding:10,textAlign:"center",background:"linear-gradient(180deg,#F6E5BE,#E6C27A)"}}>
          <div style={{fontSize:"1.25rem"}}>👍</div><b>{publicStats.likes}</b><div style={{fontSize:".65rem",fontWeight:850,color:T.textSub}}>likes</div>
        </Card>
        <Card style={{padding:10,textAlign:"center",background:"linear-gradient(180deg,#F6E5BE,#E6C27A)"}}>
          <div style={{fontSize:"1.25rem"}}>🗣️</div><b>{publicStats.forum}</b><div style={{fontSize:".65rem",fontWeight:850,color:T.textSub}}>foro</div>
        </Card>
      </div>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`1.5px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🏆 Mejores marcas</div>
        {publicStats.loading?<Spinner/>:publicStats.best.length===0?
          <div style={{fontSize:".82rem",fontWeight:820,color:T.textSub,lineHeight:1.4}}>Todavía no hay marcas públicas de Arcade para este perfil.</div>:
          <div style={{display:"grid",gap:7}}>
            {publicStats.best.map((s,i)=>{
              const meta=gameMeta(s.game_id);
              return <div key={`${s.game_id}-${i}`} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",border:`1px solid ${T.g200}`,background:"rgba(255,255,255,.35)",borderRadius:13,padding:"8px 10px"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{meta.icon} {meta.title}</div>
                  <div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>Mejor puntuación registrada</div>
                </div>
                <Badge col="gold">{Number(s.score)||0}</Badge>
              </div>;
            })}
          </div>
        }
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`1.5px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🎭 Estilo de avatar</div>
        <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.4}}>{avatarStyleName(cfg)}</div>
      </Card>
    </div>
  </Modal>;
}

const AVATAR_LAYER_ENGINE_VERSION="RASTACUTS_2_1_5_BARBER_POLISH";



function AvatarFigure({config,size=80,animated=false}){
  const cfg=normalizeAvatarConfig(config);
  const female=cfg.gender==="female";
  const skin=AVATAR_OPTIONS.skin[cfg.skin]||"#C98258";
  const hair=AVATAR_OPTIONS.hairColor[cfg.hairColor]||"#14100C";
  const eye=AVATAR_OPTIONS.eyeColor[cfg.eyeColor]||"#1A120C";
  const uid=`rc204-${String(size).replace(/\W/g,"")}-${cfg.gender}-${cfg.skin}-${cfg.face}-${cfg.hair}-${cfg.hairColor}-${cfg.eyes}-${cfg.brows}-${cfg.nose}-${cfg.mouth}-${cfg.facial}-${cfg.accessory}`;
  const skinHi=shadeHex(skin,22);
  const skinLo=shadeHex(skin,-20);
  const skinDeep=shadeHex(skin,-38);
  const hairHi=shadeHex(hair,32);
  const hairLo=shadeHex(hair,-44);
  const line="#211107";
  const gold="#D7B64C";
  const red="#A72822";
  const green="#5F8E22";
  const jacket=female?"#24451F":"#142F1B";
  const shirt=female?"#F2E3B7":"#FFF2C8";
  const acc=avatarColorForAccessory(cfg.accessory);
  const auraColor=avatarAuraColor(cfg.aura);

  const facePaths={
    oval:"M100 44 C72 44 55 68 55 103 C55 143 73 170 100 174 C127 170 145 143 145 103 C145 68 128 44 100 44Z",
    round:"M100 49 C68 49 50 72 51 105 C52 144 75 171 100 173 C125 171 148 144 149 105 C150 72 132 49 100 49Z",
    square:"M100 47 C70 47 55 67 55 101 L55 132 C55 155 76 174 100 174 C124 174 145 155 145 132 L145 101 C145 67 130 47 100 47Z",
    sharp:"M100 44 C71 44 55 67 56 104 C57 138 75 158 100 181 C125 158 143 138 144 104 C145 67 129 44 100 44Z",
    heart:"M100 50 C69 43 51 69 55 102 C59 135 77 158 100 180 C123 158 141 135 145 102 C149 69 131 43 100 50Z",
    long:"M100 34 C73 34 59 65 60 105 C61 151 79 182 100 186 C121 182 139 151 140 105 C141 65 127 34 100 34Z"
  };
  const facePath=facePaths[cfg.face]||facePaths.oval;

  const EyeLayer=()=>{
    const y=cfg.eyes==="sleepy"?103:101;
    const rx=cfg.eyes==="round"?9.4:cfg.eyes==="sharp"?11.5:cfg.eyes==="glam"?11.5:10;
    const ry=cfg.eyes==="sleepy"?3.2:cfg.eyes==="smile"?3.5:cfg.eyes==="round"?8.8:7.1;
    if(cfg.eyes==="sleepy"||cfg.eyes==="smile"){
      return <g fill="none" stroke={line} strokeWidth="2.4" strokeLinecap="round">
        <path d={`M71 ${y} C78 ${y+ry} 86 ${y+ry} 93 ${y}`}/>
        <path d={`M107 ${y} C114 ${y+ry} 122 ${y+ry} 129 ${y}`}/>
      </g>;
    }
    return <g>
      <ellipse cx="82" cy={y} rx={rx} ry={ry} fill="#FFF8EA" stroke={line} strokeWidth="2.4"/>
      <ellipse cx="118" cy={y} rx={rx} ry={ry} fill="#FFF8EA" stroke={line} strokeWidth="2.4"/>
      <circle cx="82" cy={y} r="4.6" fill={eye}/>
      <circle cx="118" cy={y} r="4.6" fill={eye}/>
      <circle cx="80.3" cy={y-2.2} r="1.5" fill="#fff" opacity=".9"/>
      <circle cx="116.3" cy={y-2.2} r="1.5" fill="#fff" opacity=".9"/>
      {cfg.eyes==="glam"&&<g stroke={line} strokeWidth="1.4" strokeLinecap="round"><path d="M68 96 L62 92"/><path d="M132 96 L138 92"/><path d="M70 102 L63 102"/><path d="M130 102 L137 102"/></g>}
    </g>;
  };

  const BrowsLayer=()=>{
    const sw=cfg.brows==="thin"?2.4:cfg.brows==="strong"?4.3:3.5;
    const left=cfg.brows==="angry"?"M70 84 L94 92":cfg.brows==="arched"?"M69 91 C77 81 89 80 96 87":cfg.brows==="soft"?"M70 89 C78 85 88 85 96 89":"M69 88 C78 82 89 82 97 87";
    const right=cfg.brows==="angry"?"M106 92 L130 84":cfg.brows==="arched"?"M104 87 C111 80 123 81 131 91":cfg.brows==="soft"?"M104 89 C112 85 122 85 130 89":"M103 87 C111 82 122 82 131 88";
    return <g fill="none" stroke={hairLo} strokeWidth={sw} strokeLinecap="round"><path d={left}/><path d={right}/></g>;
  };

  const NoseLayer=()=>{
    const paths={
      sharp:"M100 107 C96 121 95 132 102 136 M94 138 C101 142 109 140 113 136",
      soft:"M101 108 C98 121 99 130 103 134 M96 136 C103 139 110 138 114 134",
      long:"M101 103 C97 120 96 137 105 141 M94 143 C104 148 115 144 118 139",
      small:"M101 116 C99 126 100 132 104 135 M97 136 C103 138 109 137 113 134",
      wide:"M100 108 C96 124 93 134 101 139 M89 139 C100 147 114 145 120 138",
      hook:"M102 104 C97 121 99 135 108 138 M96 142 C105 146 116 143 119 137"
    };
    return <path d={paths[cfg.nose]||paths.sharp} stroke={skinDeep} strokeWidth="2.9" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".78"/>;
  };

  const MouthLayer=()=>{
    const paths={
      sharp:"M82 151 C91 157 109 157 118 151",
      smile:"M80 148 C91 163 109 163 120 148",
      serious:"M84 154 L116 154",
      smirk:"M82 153 C94 158 109 156 121 149",
      soft:"M83 150 C92 156 108 156 117 150",
      open:"M82 148 C90 166 110 166 118 148 C108 156 92 156 82 148"
    };
    return <path d={paths[cfg.mouth]||paths.soft} stroke={cfg.mouth==="open"?"#2A0907":"#7E2B19"} strokeWidth="3.2" fill={cfg.mouth==="open"?"#2A0907":"none"} strokeLinecap="round" strokeLinejoin="round"/>;
  };

  const BackHair=()=>{
    if(cfg.hair==="dreadsLong"){
      return <g><path d="M55 58 C68 40 132 40 145 58" fill="none" stroke={hairLo} strokeWidth="12" strokeLinecap="round"/>{[54,66,78,90,110,122,134,146].map((x,i)=><path key={x} d={`M${x} 56 C${x-8+(i%2)*5} 90 ${x-12+(i%3)*4} 138 ${x-6+(i%2)*8} 206`} stroke={hairLo} strokeWidth="8.4" strokeLinecap="round" fill="none"/>)} </g>;
    }
    if(cfg.hair==="braidsLong"){
      return <g><path d="M55 58 C67 41 133 41 145 58" fill="none" stroke={hairLo} strokeWidth="10" strokeLinecap="round"/>{[56,70,84,98,114,128,142].map((x,i)=><g key={x}><path d={`M${x} 58 C${x-5} 90 ${x-4+(i%2)*3} 138 ${x-2} 204`} stroke={hairLo} strokeWidth="6.6" strokeLinecap="round" fill="none"/><path d={`M${x-5} 84 L${x+1} 90 M${x-5} 104 L${x+1} 110 M${x-4} 124 L${x+2} 130 M${x-4} 144 L${x+2} 150 M${x-3} 164 L${x+3} 170`} stroke={hairHi} strokeWidth="1.35" opacity=".34"/></g>)}</g>;
    }
    if(cfg.hair==="sideBraids"){
      return <g><path d="M58 66 C42 95 40 153 45 208" stroke={hairLo} strokeWidth="8" strokeLinecap="round" fill="none"/><path d="M142 66 C158 95 160 153 155 208" stroke={hairLo} strokeWidth="8" strokeLinecap="round" fill="none"/></g>;
    }
    if(cfg.hair==="longStraight"){
      return <g><path d="M52 54 C45 96 48 162 59 208 L74 208 C68 164 68 102 74 60" fill={hairLo}/><path d="M126 60 C132 102 132 164 126 208 L141 208 C152 162 155 96 148 54" fill={hairLo}/></g>;
    }
    if(cfg.hair==="spaceBuns"){
      return <g><circle cx="64" cy="39" r="19" fill={hairLo}/><circle cx="136" cy="39" r="19" fill={hairLo}/><path d="M55 64 C38 96 45 160 62 198 C71 174 74 131 72 96" fill={hairLo}/><path d="M145 64 C162 96 155 160 138 198 C129 174 126 131 128 96" fill={hairLo}/></g>;
    }
    if(cfg.hair==="locPonytail"){
      return <g><path d="M118 50 C150 68 160 124 145 205" stroke={hairLo} strokeWidth="11" strokeLinecap="round" fill="none"/>{[122,130,138].map((x,i)=><path key={x} d={`M${x} 64 C${x+18} 90 ${x+14} 142 ${x+5} 202`} stroke={hairLo} strokeWidth="7" strokeLinecap="round" fill="none"/> )}</g>;
    }
    if(["longWaves","bob","curlyBob","highPonytail"].includes(cfg.hair)){
      return <path d="M52 58 C35 96 42 164 60 206 C73 194 78 160 74 126 C70 90 80 60 100 51 C120 60 130 90 126 126 C122 160 127 194 140 206 C158 164 165 96 148 58 C133 37 67 37 52 58Z" fill={hairLo}/>;
    }
    if(cfg.hair==="afro"){
      return <g fill={hairLo}><ellipse cx="100" cy="61" rx="56" ry="42"/><circle cx="61" cy="66" r="27"/><circle cx="139" cy="66" r="27"/><circle cx="76" cy="43" r="26"/><circle cx="124" cy="43" r="26"/></g>;
    }
    if(cfg.hair==="afroPuff"){
      return <g><circle cx="63" cy="56" r="28" fill={hairLo}/><circle cx="137" cy="56" r="28" fill={hairLo}/><path d="M56 76 C72 54 128 54 144 76 C126 68 74 68 56 76Z" fill={hairLo}/></g>;
    }
    if(cfg.hair==="dreadsBun") return <g><circle cx="100" cy="27" r="21" fill={hairLo}/></g>;
    if(cfg.hair==="highPonytail") return <g><circle cx="102" cy="28" r="21" fill={hairLo}/></g>;
    return null;
  };

  const FrontHair=()=>{
    const band=<g><path d="M55 67 C75 51 125 51 145 67" stroke={green} strokeWidth="7" strokeLinecap="round"/><path d="M61 63 C79 55 121 55 139 63" stroke={gold} strokeWidth="4" strokeLinecap="round"/><path d="M68 60 C84 56 116 56 132 60" stroke={red} strokeWidth="3" strokeLinecap="round"/></g>;
    if(cfg.accessory==="bandana"||cfg.accessory==="bandanaGreen") return null;
    if(cfg.hair==="buzzFade") return <g><path d="M56 76 C66 48 134 48 144 76 C122 66 78 66 56 76Z" fill={hairLo}/><path d="M70 69 C82 62 118 62 130 69" stroke={hairHi} strokeWidth="3" opacity=".34" fill="none" strokeLinecap="round"/></g>;
    if(cfg.hair==="texturedCrop") return <g><path d="M52 80 C58 47 85 35 102 34 C125 34 142 47 148 72 C129 71 116 71 103 75 C88 79 69 82 52 80Z" fill={hairLo}/>{[64,76,88,100,112,124,136].map((x,i)=><path key={x} d={`M${x} ${64+(i%2)} C${x+3} 57 ${x+8} 54 ${x+11} 50`} stroke={hairHi} strokeWidth="2.6" opacity=".45" strokeLinecap="round" fill="none"/> )}</g>;
    if(cfg.hair==="sharpFade") return <g><path d="M51 82 C54 52 80 36 101 34 C123 34 143 48 149 73 C133 70 119 70 102 75 C84 80 66 83 51 82Z" fill={hairLo}/><path d="M66 66 C84 50 115 48 137 61" stroke={hairHi} strokeWidth="4.6" opacity=".42" strokeLinecap="round" fill="none"/><path d="M58 78 C72 71 128 71 142 78" stroke={hairHi} strokeWidth="2.2" opacity=".2" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="undercut") return <g><path d="M52 82 C57 55 90 36 147 63 C132 69 116 75 102 86 C84 84 66 82 52 82Z" fill={hairLo}/><path d="M89 57 C108 54 129 56 144 63" stroke={hairHi} strokeWidth="4" opacity=".42" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="mohawk") return <path d="M100 21 C83 48 91 71 100 89 C109 71 117 48 100 21Z" fill={hairLo} stroke={line} strokeWidth="1.4"/>;
    if(cfg.hair==="shortLocs") return <g>{[62,74,86,98,110,122,134].map((x,i)=><path key={x} d={`M${x} 62 C${x-1} 49 ${x+1} 46 ${x} 70`} stroke={hairLo} strokeWidth="8" strokeLinecap="round" fill="none"/>)}<path d="M58 68 C70 48 130 48 142 68" stroke={hairLo} strokeWidth="10" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="twistsTop") return <g>{[60,72,84,96,108,120,132].map((x,i)=><path key={x} d={`M${x} 64 C${x-6} 36 ${x+7} 34 ${x+1} 58`} stroke={hairLo} strokeWidth="7" strokeLinecap="round" fill="none"/>)}<path d="M58 69 C74 45 126 45 142 69" stroke={hairLo} strokeWidth="10" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="locPonytail") return <g>{band}<path d="M55 68 C74 47 118 48 136 60" stroke={hairLo} strokeWidth="11" strokeLinecap="round" fill="none"/>{[118,126,134].map((x,i)=><path key={x} d={`M${x} 58 C${x+16} 68 ${x+17} 84 ${x+8} 101`} stroke={hairLo} strokeWidth="6.8" strokeLinecap="round" fill="none"/> )}</g>;
    if(cfg.hair==="dreadsTop") return <g>{band}<path d="M55 73 C61 46 85 35 102 34 C120 35 139 46 145 70" fill="none" stroke={hairLo} strokeWidth="12" strokeLinecap="round"/>{[63,77,91,105,119,133].map((x,i)=><path key={x} d={`M${x} 61 C${x-10} 28 ${x+9} 22 ${x+1} 54`} stroke={hairLo} strokeWidth="9" strokeLinecap="round" fill="none"/> )}</g>;
    if(cfg.hair==="dreadsBun") return <g>{band}<circle cx="100" cy="28" r="21" fill={hairLo}/><path d="M56 72 C63 47 86 37 100 37 C114 37 137 47 144 72" fill="none" stroke={hairLo} strokeWidth="11" strokeLinecap="round"/>{[70,84,98,112,126].map(x=><path key={x} d={`M${x} 62 C${x-6} 40 ${x+7} 32 ${x+2} 55`} stroke={hairLo} strokeWidth="8.5" strokeLinecap="round" fill="none"/> )}</g>;
    if(cfg.hair==="dreadsLong") return <g>{band}<path d="M52 74 C58 47 84 34 102 34 C120 34 142 48 148 74" fill="none" stroke={hairLo} strokeWidth="12" strokeLinecap="round"/><path d="M57 74 C69 68 82 66 97 66 C117 66 132 68 143 74" fill="none" stroke={hairHi} strokeWidth="3" opacity=".22" strokeLinecap="round"/>{[58,72,128,142].map((x,i)=><path key={x} d={`M${x} 72 C${x+(i<2?-8:8)} 95 ${x+(i<2?-6:6)} 118 ${x+(i<2?-3:3)} 146`} stroke={hairLo} strokeWidth="7.2" strokeLinecap="round" fill="none"/> )}</g>;
    if(cfg.hair==="braidsLong") return <g><path d="M54 74 C61 48 84 37 102 37 C120 37 139 47 146 74" fill="none" stroke={hairLo} strokeWidth="10" strokeLinecap="round"/>{[63,79,95,111,127,143].map((x,i)=><g key={x}><path d={`M${x} 72 C${x+(i<3?-3:3)} 88 ${x+(i<3?-3:3)} 105 ${x} 124`} stroke={hairLo} strokeWidth="6.4" strokeLinecap="round" fill="none"/><path d={`M${x-3} 83 L${x+2} 88 M${x-2} 96 L${x+3} 101 M${x-1} 109 L${x+4} 114`} stroke={hairHi} strokeWidth="1.5" opacity=".34"/></g>)}</g>;
    if(cfg.hair==="afro") return <g><ellipse cx="100" cy="62" rx="58" ry="39" fill={hairLo}/><path d="M53 78 C70 58 130 58 147 78" stroke={hairHi} strokeWidth="5" opacity=".28" fill="none" strokeLinecap="round"/></g>;
    if(cfg.hair==="afroPuff") return <g><circle cx="65" cy="58" r="28" fill={hairLo}/><circle cx="135" cy="58" r="28" fill={hairLo}/><path d="M58 80 C75 59 125 59 142 80 C118 72 82 72 58 80Z" fill={hairLo}/><path d="M69 76 C80 67 120 67 131 76" stroke={hairHi} strokeWidth="4" opacity=".28" fill="none" strokeLinecap="round"/></g>;
    if(cfg.hair==="spaceBuns") return <g><circle cx="64" cy="36" r="18" fill={hairLo}/><circle cx="136" cy="36" r="18" fill={hairLo}/><path d="M56 79 C68 47 132 47 144 79 C120 68 80 68 56 79Z" fill={hairLo}/></g>;
    if(cfg.hair==="sideBraids") return <g><path d="M53 79 C61 47 83 37 100 37 C120 37 139 47 147 79 C122 69 78 69 53 79Z" fill={hairLo}/><path d="M58 76 C53 96 50 122 50 159" stroke={hairLo} strokeWidth="7.2" strokeLinecap="round" fill="none"/><path d="M142 76 C147 96 150 122 150 159" stroke={hairLo} strokeWidth="7.2" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="longStraight") return <g><path d="M53 80 C68 44 132 44 147 80 C122 69 78 69 53 80Z" fill={hairLo}/><path d="M70 79 L70 160 M88 76 L88 164 M112 76 L112 164 M130 79 L130 160" stroke={hairHi} strokeWidth="2" opacity=".23"/></g>;
    if(cfg.hair==="longWaves") return <g><path d="M52 80 C59 47 83 38 100 38 C120 38 141 48 148 80 C122 69 78 69 52 80Z" fill={hairLo}/><path d="M64 73 C78 60 122 60 136 73" stroke={hairHi} strokeWidth="5" opacity=".35" strokeLinecap="round" fill="none"/></g>;
    if(cfg.hair==="bob") return <g><path d="M53 80 C68 48 132 48 147 80 C122 70 78 70 53 80Z" fill={hairLo}/></g>;
    if(cfg.hair==="curlyBob") return <g><path d="M53 80 C68 46 132 46 147 80 C122 68 78 68 53 80Z" fill={hairLo}/><path d="M56 82 C62 92 68 95 75 98 M144 82 C138 92 132 95 125 98" stroke={hairHi} strokeWidth="3" opacity=".32" fill="none" strokeLinecap="round"/></g>;
    if(cfg.hair==="pixie") return <g><path d="M54 79 C65 47 131 45 145 70 C121 69 93 69 54 79Z" fill={hairLo}/><path d="M73 67 C90 58 118 58 134 65" stroke={hairHi} strokeWidth="4" opacity=".32" fill="none" strokeLinecap="round"/></g>;
    if(cfg.hair==="highPonytail") return <g><circle cx="100" cy="27" r="20" fill={hairLo}/><path d="M53 80 C68 46 132 46 147 80 C122 68 78 68 53 80Z" fill={hairLo}/><path d="M64 74 C80 59 120 59 136 74" stroke={hairHi} strokeWidth="5" opacity=".35" strokeLinecap="round" fill="none"/></g>;
    return <path d="M56 75 C67 43 133 43 144 75 C122 62 78 62 56 75Z" fill={hairLo}/>;
  };

  const FacialLayer=()=>{
    if(female||cfg.facial==="none") return null;
    if(cfg.facial==="stubble") return <path d="M73 146 C82 179 118 179 127 146 C115 161 85 161 73 146Z" fill={hairLo} opacity=".28"/>;
    if(cfg.facial==="moustache") return <path d="M80 143 C91 136 97 141 100 147 C103 141 109 136 120 143 C111 149 105 150 100 147 C95 150 89 149 80 143Z" fill={hairLo}/>;
    if(cfg.facial==="goatee") return <g><path d="M80 143 C91 138 97 142 100 147 C103 142 109 138 120 143 C111 149 105 150 100 147 C95 150 89 149 80 143Z" fill={hairLo}/><path d="M92 162 C96 177 104 177 108 162 C103 167 97 167 92 162Z" fill={hairLo}/></g>;
    if(cfg.facial==="shortBeard") return <path d="M71 143 C78 180 122 180 129 143 C117 160 83 160 71 143Z" fill={hairLo}/>;
    if(cfg.facial==="beard") return <path d="M68 140 C73 190 127 190 132 140 C120 166 80 166 68 140Z" fill={hairLo}/>;
    return <path d="M65 136 C70 199 130 199 135 136 C122 171 78 171 65 136Z" fill={hairLo}/>;
  };

  const AccessoryLayer=()=>{
    if(cfg.accessory==="none") return null;
    if(cfg.accessory==="glasses"||cfg.accessory==="glassesGold") return <g><circle cx="82" cy="101" r="13" fill="none" stroke={acc} strokeWidth="4"/><circle cx="118" cy="101" r="13" fill="none" stroke={acc} strokeWidth="4"/><path d="M95 101 L105 101" stroke={acc} strokeWidth="4"/></g>;
    if(cfg.accessory==="earring"||cfg.accessory==="hoopGold") return <g><circle cx="50" cy="126" r="5" fill="none" stroke={gold} strokeWidth="3"/><circle cx="150" cy="126" r="5" fill="none" stroke={gold} strokeWidth="3"/></g>;
    if(cfg.accessory==="bandana"||cfg.accessory==="bandanaGreen") return <g><path d="M54 66 C74 47 126 47 146 66" stroke={acc} strokeWidth="11" strokeLinecap="round"/><path d="M133 62 L167 47 L153 81Z" fill={acc}/><circle cx="100" cy="60" r="4" fill={gold}/></g>;
    if(cfg.accessory==="cap"||cfg.accessory==="capBlack"||cfg.accessory==="capGold") return <g><path d="M56 63 C68 34 132 34 144 63 L140 78 C118 68 82 68 60 78Z" fill={acc} stroke={line} strokeWidth="1.5"/><path d="M138 65 C157 63 172 70 178 78 C160 77 146 76 135 72Z" fill={acc}/></g>;
    if(cfg.accessory==="piercing") return <circle cx="113" cy="134" r="3" fill={gold}/>;
    if(cfg.accessory==="crown") return <path d="M77 44 L88 26 L100 45 L113 26 L124 44 L129 57 L71 57Z" fill={gold} stroke={line} strokeWidth="2"/>;
    if(cfg.accessory==="headphones") return <g><path d="M54 109 C54 69 146 69 146 109" fill="none" stroke="#263F4D" strokeWidth="6"/><rect x="42" y="105" width="17" height="33" rx="6" fill="#263F4D"/><rect x="141" y="105" width="17" height="33" rx="6" fill="#263F4D"/></g>;
    if(cfg.accessory==="flowers") return <g><circle cx="139" cy="72" r="6" fill="#E66A9A"/><circle cx="147" cy="74" r="5" fill="#F2CF75"/><circle cx="143" cy="66" r="4" fill="#fff"/></g>;
    return null;
  };

  const ScarTattooLayer=()=> <g>
    {cfg.scar==="cheek"&&<path d="M120 128 L136 122" stroke="#7B1E17" strokeWidth="2.2" strokeLinecap="round" opacity=".82"/>}
    {cfg.scar==="cross"&&<g opacity=".82"><path d="M124 121 L137 134" stroke="#7B1E17" strokeWidth="2.2"/><path d="M137 121 L124 134" stroke="#7B1E17" strokeWidth="2.2"/></g>}
    {cfg.scar==="brow"&&<path d="M121 88 L134 80" stroke="#7B1E17" strokeWidth="2.2" opacity=".82"/>}
    {cfg.scar==="jaw"&&<path d="M72 158 L87 166" stroke="#7B1E17" strokeWidth="2.2" opacity=".82"/>}
    {cfg.tattoo==="neck"&&<path d="M93 192 C100 186 107 192 100 199 C93 192 107 192 100 199" stroke="#223F36" fill="none" strokeWidth="2" opacity=".7"/>}
    {cfg.tattoo==="wave"&&<path d="M68 180 C77 171 88 171 94 180 C86 177 78 183 68 180Z" fill="#246D84" opacity=".55"/>}
  </g>;

  return <svg viewBox="0 0 200 240" width={size} height={size*1.18} style={{display:"block",overflow:"visible"}} role="img" aria-label="Avatar Rasta Cuts 2.0.4">
    <defs>
      <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={skinHi}/><stop offset="58%" stopColor={skin}/><stop offset="100%" stopColor={skinLo}/></linearGradient>
      <radialGradient id={`${uid}-soft`} cx="42%" cy="22%" r="70%"><stop offset="0" stopColor="rgba(255,255,255,.20)"/><stop offset="70%" stopColor="rgba(255,255,255,.03)"/><stop offset="100%" stopColor="rgba(0,0,0,.18)"/></radialGradient>
      <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity=".28"/></filter>
    </defs>
    <g style={animated?{animation:"avatarIdlePro 3.3s ease-in-out infinite",transformOrigin:"100px 118px"}:null}>
      <ellipse cx="100" cy="220" rx="62" ry="12" fill="rgba(0,0,0,.24)"/>
      <circle cx="100" cy="112" r="91" fill={`url(#${uid}-soft)`}/>
      {cfg.aura!=="none"&&<circle cx="100" cy="111" r="89" fill="none" stroke={auraColor} strokeWidth="5" opacity=".72"/>}
      <BackHair/>
      <g filter={`url(#${uid}-shadow)`}>
        <path d="M45 240 C52 197 74 184 92 184 L108 184 C126 184 148 197 155 240Z" fill={jacket} stroke={line} strokeWidth="2.2"/>
        <path d="M86 186 L114 186 C113 209 109 225 100 236 C91 225 87 209 86 186Z" fill={shirt}/>
        <path d="M85 168 L115 168 L115 202 C110 212 90 212 85 202Z" fill={`url(#${uid}-skin)`} stroke={skinDeep} strokeWidth="1.8"/>
        <ellipse cx="54" cy="115" rx="11" ry="21" fill={`url(#${uid}-skin)`} stroke={skinDeep} strokeWidth="1.7"/>
        <ellipse cx="146" cy="115" rx="11" ry="21" fill={`url(#${uid}-skin)`} stroke={skinDeep} strokeWidth="1.7"/>
        <path d={facePath} fill={`url(#${uid}-skin)`} stroke={skinDeep} strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M75 158 C86 176 114 176 125 158 C117 181 83 181 75 158Z" fill="rgba(65,30,18,.12)"/>
        <ellipse cx="76" cy="126" rx="10" ry="5" fill="#F1B56F" opacity=".30"/>
        <ellipse cx="124" cy="126" rx="10" ry="5" fill="#F1B56F" opacity=".30"/>
      </g>
      <FrontHair/>
      <AccessoryLayer/>
      <BrowsLayer/>
      <EyeLayer/>
      <NoseLayer/>
      <ScarTattooLayer/>
      <FacialLayer/>
      {female&&<g fill="#D96583" opacity=".20"><ellipse cx="75" cy="129" rx="8" ry="4"/><ellipse cx="125" cy="129" rx="8" ry="4"/></g>}
      <MouthLayer/>
      <path d="M72 207 C82 215 92 218 100 218 C108 218 118 215 128 207" stroke={gold} strokeWidth="3" fill="none" opacity=".68"/>
      <circle cx="92" cy="211" r="2.4" fill={red}/><circle cx="100" cy="214" r="2.4" fill={green}/><circle cx="108" cy="211" r="2.4" fill={gold}/>
      <path d="M68 62 C82 47 118 47 132 62" stroke="rgba(255,255,255,.18)" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </g>
  </svg>;
}


function AvatarBgScene({bg}){
  const common={position:"absolute",inset:0,pointerEvents:"none",opacity:.96};
  const style=(s)=>({position:"absolute",...s});
  if(bg==="office") return <div style={common}><div style={style({left:"10%",top:"10%",width:"80%",height:"40%",border:"2px solid rgba(255,255,255,.35)",borderRadius:10,background:"linear-gradient(180deg,rgba(255,255,255,.24),rgba(173,216,230,.12))"})}/><div style={style({left:"49%",top:"10%",width:2,height:"40%",background:"rgba(255,255,255,.25)"})}/><div style={style({left:"10%",top:"30%",width:"80%",height:2,background:"rgba(255,255,255,.18)"})}/><div style={style({left:"18%",bottom:"18%",width:"64%",height:"10%",borderRadius:999,background:"rgba(41,29,22,.42)"})}/><div style={style({right:"15%",bottom:"22%",width:"10%",height:"18%",background:"rgba(37,88,55,.52)",borderRadius:"6px 6px 10px 10px"})}/></div>;
  if(bg==="beach") return <div style={common}><div style={style({left:"12%",top:"14%",width:28,height:28,borderRadius:"50%",background:"rgba(255,225,138,.82)"})}/><div style={style({left:0,right:0,bottom:"32%",height:"4%",background:"rgba(255,255,255,.35)"})}/><div style={style({left:"76%",bottom:"28%",width:4,height:"30%",background:"rgba(89,64,39,.62)",transform:"rotate(10deg)",transformOrigin:"bottom center"})}/><div style={style({left:"72%",bottom:"48%",width:"10%",height:"7%",borderRadius:"50% 0 50% 0",background:"rgba(40,92,52,.65)",transform:"rotate(-35deg)"})}/><div style={style({left:"79%",bottom:"51%",width:"10%",height:"7%",borderRadius:"0 50% 0 50%",background:"rgba(40,92,52,.65)",transform:"rotate(35deg)"})}/></div>;
  if(bg==="setup") return <div style={common}><div style={style({left:"18%",bottom:"24%",width:"64%",height:"9%",background:"rgba(18,22,38,.60)",borderRadius:999})}/><div style={style({left:"24%",top:"22%",width:"52%",height:"28%",border:"2px solid rgba(95,215,255,.42)",borderRadius:10,background:"radial-gradient(circle at 50% 50%,rgba(123,63,161,.35),rgba(18,181,203,.24))"})}/><div style={style({left:"47%",top:"50%",width:"6%",height:"10%",background:"rgba(18,22,38,.55)"})}/><div style={style({left:"38%",top:"58%",width:"24%",height:"4%",background:"rgba(18,22,38,.55)",borderRadius:999})}/></div>;
  if(bg==="camper") return <div style={common}><div style={style({left:"9%",top:"15%",width:26,height:26,borderRadius:"50%",background:"rgba(255,225,138,.78)"})}/><div style={style({left:"16%",bottom:"25%",width:"68%",height:"16%",background:"rgba(90,64,34,.55)",borderRadius:16})}/><div style={style({left:"28%",bottom:"31%",width:"20%",height:"7%",background:"rgba(215,182,76,.78)",borderRadius:8})}/><div style={style({left:"53%",bottom:"31%",width:"12%",height:"6%",background:"rgba(173,216,230,.45)",borderRadius:6})}/><div style={style({left:"28%",bottom:"20%",width:"11%",height:"11%",borderRadius:"50%",background:"rgba(20,16,12,.70)"})}/><div style={style({left:"61%",bottom:"20%",width:"11%",height:"11%",borderRadius:"50%",background:"rgba(20,16,12,.70)"})}/></div>;
  if(bg==="terrace") return <div style={common}><div style={style({left:"8%",right:"8%",bottom:"20%",height:"8%",background:"rgba(122,74,40,.60)"})}/><div style={style({left:"18%",bottom:"28%",width:"12%",height:"18%",background:"rgba(44,98,55,.60)",borderRadius:"6px 6px 12px 12px"})}/><div style={style({left:"62%",bottom:"28%",width:"12%",height:"18%",background:"rgba(44,98,55,.60)",borderRadius:"6px 6px 12px 12px"})}/><div style={style({left:"20%",top:"18%",width:"60%",height:"20%",borderRadius:999,border:"2px solid rgba(255,255,255,.18)"})}/></div>;
  if(bg==="barberShop") return <div style={common}><div style={style({left:"16%",top:"12%",width:"68%",height:"24%",borderRadius:10,border:"2px solid rgba(255,255,255,.28)",background:"rgba(255,255,255,.08)"})}/><div style={style({left:"18%",bottom:"20%",width:"64%",height:"12%",background:"rgba(78,43,22,.55)",borderRadius:999})}/><div style={style({left:"22%",bottom:"34%",width:"8%",height:"14%",background:"rgba(215,182,76,.42)",borderRadius:4})}/><div style={style({left:"34%",bottom:"34%",width:"8%",height:"14%",background:"rgba(215,182,76,.42)",borderRadius:4})}/><div style={style({left:"46%",bottom:"34%",width:"8%",height:"14%",background:"rgba(215,182,76,.42)",borderRadius:4})}/></div>;
  if(bg==="reggae") return <div style={common}><div style={style({left:0,right:0,top:"22%",height:"10%",background:"rgba(28,77,47,.54)"})}/><div style={style({left:0,right:0,top:"32%",height:"10%",background:"rgba(215,182,76,.42)"})}/><div style={style({left:0,right:0,top:"42%",height:"10%",background:"rgba(167,40,34,.44)"})}/><div style={style({left:"25%",bottom:"23%",width:"6%",height:"22%",background:"rgba(20,16,12,.58)"})}/><div style={style({left:"58%",bottom:"23%",width:"6%",height:"22%",background:"rgba(20,16,12,.58)"})}/><div style={style({left:"18%",bottom:"42%",width:"20%",height:"4%",background:"rgba(20,16,12,.58)",transform:"rotate(-12deg)"})}/><div style={style({left:"56%",bottom:"42%",width:"20%",height:"4%",background:"rgba(20,16,12,.58)",transform:"rotate(12deg)"})}/></div>;
  if(bg==="vipRoom") return <div style={common}><div style={style({left:"12%",top:"12%",width:"76%",height:"20%",borderRadius:999,background:"rgba(255,241,168,.20)"})}/><div style={style({left:"22%",bottom:"22%",width:"56%",height:"14%",background:"rgba(75,24,72,.55)",borderRadius:18})}/><div style={style({left:"17%",bottom:"28%",width:"10%",height:"10%",background:"rgba(75,24,72,.55)",borderRadius:12})}/><div style={style({right:"17%",bottom:"28%",width:"10%",height:"10%",background:"rgba(75,24,72,.55)",borderRadius:12})}/></div>;
  return null;
}


/* ===== 2.1.3 limpieza técnica =====
   - Eliminadas claves duplicadas de labels.
   - hairColor brown pasa a hairBrown para no pisar el tono de piel brown.
   - longNose separa la etiqueta de nariz larga del tipo de cara long.
*/

/* ===== AVATAR EDITOR 2.8.0 — CLASH BARBER REBUILD =====
   Editor reconstruido con arte cartoon tipo videojuego: cabezas coherentes,
   peinados con volumen, categorías claras y capas independientes.
*/
function cleanColor(list,id,fallback){return (list.find(x=>x.id===id)||list.find(x=>x.id===fallback)||list[0]||{}).color||"#111"}
function shade(hex,amt=24){
  try{
    const h=String(hex).replace("#","");
    const n=parseInt(h.length===3?h.split("").map(x=>x+x).join(""):h,16);
    const r=Math.max(0,Math.min(255,(n>>16)+amt));
    const g=Math.max(0,Math.min(255,((n>>8)&255)+amt));
    const b=Math.max(0,Math.min(255,(n&255)+amt));
    return `rgb(${r},${g},${b})`
  }catch{return hex}
}
function CartoonAvatar({config,size=260,mini=false,focus="full"}){
  const cfg=normalizeAvatarV3(config);
  const skin=cleanColor(CLEAN_AVATAR_OPTIONS.skin,cfg.skin,"warm");
  const hair=cleanColor(CLEAN_AVATAR_OPTIONS.hairColor,cfg.hairColor,"black");
  const hairLight=shade(hair,42);
  const hairDark=shade(hair,-36);
  const skinDark=shade(skin,-45);
  const skinLight=shade(skin,32);
  const line="#201008";
  const female=cfg.model==="female";
  const stroke=mini?4.5:6.5;
  const uid=`rcav_${cfg.model}_${cfg.hair}_${cfg.skin}_${cfg.hairColor}_${cfg.face}_${cfg.accessory}_${cfg.hat}_${cfg.tattoo}_${cfg.glasses}_${cfg.bg}`.replace(/[^a-zA-Z0-9_]/g,"");
  const bgMap={
    plain:["#F8E6B2","#D5AE55"],
    barber:["#28130A","#B67B27"],
    beach:["#7DD3FC","#F5D483"],
    studio:["#2A1910","#C9993B"],
    workshop:["#3B2A1D","#8A6D42"],
    neon:["#0D1625","#21A8D8"],
    warm:["#4C210C","#E0A943"]
  };
  const bg=bgMap[cfg.bg]||bgMap.plain;
  const facePath={
    oval:"M70 97 C70 58 92 38 120 38 C148 38 170 58 170 97 C170 142 152 174 120 181 C88 174 70 142 70 97Z",
    round:"M64 100 C64 62 89 39 120 39 C151 39 176 62 176 100 C176 139 153 171 120 179 C87 171 64 139 64 100Z",
    square:"M67 91 C67 58 91 37 120 37 C149 37 173 58 173 91 L168 144 C158 172 139 183 120 183 C101 183 82 172 72 144Z",
    heart:"M67 96 C68 59 93 39 120 42 C147 39 172 59 173 96 C174 134 151 169 120 182 C89 169 66 134 67 96Z"
  }[cfg.face]||"M70 97 C70 58 92 38 120 38 C148 38 170 58 170 97 C170 142 152 174 120 181 C88 174 70 142 70 97Z";
  const hasHat=cfg.hat&&cfg.hat!=="none";
  const showHair=focus!=="bg"&&!hasHat;
  const showFaceFeatures=focus!=="bg";
  const showBeard=focus==="full"||focus==="beard";
  const showExtras=focus==="full"||focus==="extras";
  const HL=hairLight, HD=hairDark, sw=stroke;

  const loc=(x,y1,y2,w=14,flip=false,bend=8,idx=0)=>{
    const my=(y1+y2)/2;
    const cx1=x+(flip?bend:-bend), cx2=x+(flip?-bend/2:bend/2);
    const p=`M${x} ${y1} C${cx1} ${my-12},${cx2} ${my+12},${x+(flip?bend/3:-bend/3)} ${y2}`;
    const hp=`M${x-2} ${y1+4} C${cx1-2} ${my-10},${cx2-2} ${my+10},${x-2+(flip?bend/3:-bend/3)} ${y2-6}`;
    return <g key={`lc${idx}`}>
      <path d={p} fill="none" stroke={flip?HL:HD} strokeWidth={w+2} strokeLinecap="round"/>
      <path d={p} fill="none" stroke={hair} strokeWidth={w} strokeLinecap="round"/>
      <path d={hp} fill="none" stroke={HL} strokeWidth={Math.max(2,w*0.22)} strokeLinecap="round" opacity=".62"/>
    </g>;
  };

  const weave=(x,y,w=8,tight=false,idx=0)=>{
    const g=tight?9:12;
    return <g key={`wv${idx}`}>
      <path d={`M${x-4} ${y} C${x+5} ${y+g*.4},${x-5} ${y+g*.8},${x+4} ${y+g*1.2}`} fill="none" stroke={HD} strokeWidth={w} strokeLinecap="round"/>
      <path d={`M${x+4} ${y} C${x-5} ${y+g*.4},${x+5} ${y+g*.8},${x-4} ${y+g*1.2}`} fill="none" stroke={HL} strokeWidth={w*.7} strokeLinecap="round" opacity=".75"/>
    </g>;
  };

  const dreadCrown=(isTie=false,isFade=false)=><g key="dc">
    <path d="M66 80 C78 47 98 33 122 33 C149 33 168 49 175 80 C148 70 93 70 66 80Z" fill={hair} stroke={line} strokeWidth={sw} strokeLinejoin="round"/>
    <path d="M84 58 C106 43 140 45 160 60" stroke={HL} strokeWidth="10" strokeLinecap="round" opacity=".58"/>
    {isFade&&<g key="if"><path d="M68 84 L88 76 L82 88 L66 94Z" fill={HD} opacity=".48"/><path d="M172 84 L152 76 L158 88 L174 94Z" fill={HD} opacity=".48"/></g>}
    {isTie&&<g key="it"><ellipse cx="120" cy="32" rx="31" ry="22" fill={hair} stroke={line} strokeWidth={sw}/><ellipse cx="118" cy="26" rx="19" ry="13" fill={HL} opacity=".35"/><rect x="94" y="50" width="52" height="9" rx="4" fill="#C0392B" stroke={line} strokeWidth="2"/></g>}
    <path d="M72 78 C92 68 148 68 168 78" stroke={hair} strokeWidth="18" strokeLinecap="round"/>
  </g>;

  const hairLayer=()=>{
    if(!showHair)return null;

    if(cfg.hair==="buzz") return <g>
      <path d="M70 78 C80 54 99 43 120 43 C141 43 160 54 170 78 C148 70 92 70 70 78Z" fill={hair} stroke={line} strokeWidth={sw} strokeLinejoin="round"/>
      <path d="M80 68 C100 56 140 56 160 68" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
    </g>;

    if(["fadeLow","fadeMid","fadeHigh"].includes(cfg.hair)){
      const topY={fadeLow:60,fadeMid:46,fadeHigh:32}[cfg.hair];
      const fo={fadeLow:.32,fadeMid:.48,fadeHigh:.64}[cfg.hair];
      return <g>
        <path d={`M66 84 C78 ${topY+14} 100 ${topY} 124 ${topY} C150 ${topY} 168 ${topY+16} 174 84 C148 76 93 76 66 84Z`} fill={hair} stroke={line} strokeWidth={sw} strokeLinejoin="round"/>
        <path d={`M84 ${topY+14} C104 ${topY+2} 142 ${topY+4} 162 ${topY+16}`} stroke={HL} strokeWidth="10" strokeLinecap="round" opacity=".58"/>
        <path d="M66 84 L84 76 L80 88 L66 94Z" fill={HD} opacity={fo}/>
        <path d="M174 84 L156 76 L160 88 L174 94Z" fill={HD} opacity={fo}/>
        <path d="M68 88 C76 84 84 82 90 80" stroke={line} strokeWidth="2.5" strokeLinecap="round" opacity=".4"/>
        <path d="M172 88 C164 84 156 82 150 80" stroke={line} strokeWidth="2.5" strokeLinecap="round" opacity=".4"/>
      </g>;
    }

    if(cfg.hair==="crop") return <g>
      <path d="M64 82 C72 51 96 36 124 36 C152 36 170 53 177 83 C150 78 92 78 64 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M76 80 C100 90 134 88 164 80" stroke={HL} strokeWidth="9" strokeLinecap="round" opacity=".6"/>
      <path d="M80 82 L86 90 M104 80 L110 88 M130 80 L136 88" stroke={HD} strokeWidth="3.5" strokeLinecap="round" opacity=".55"/>
    </g>;

    if(cfg.hair==="quiff") return <g>
      <path d="M62 84 C68 51 92 38 119 30 C153 18 183 45 177 82 C148 70 92 72 62 84Z" fill={hair} stroke={line} strokeWidth={sw} strokeLinejoin="round"/>
      <path d="M90 57 C115 33 146 36 162 60" stroke={HL} strokeWidth="12" strokeLinecap="round" opacity=".65"/>
      <path d="M116 33 C110 46 112 60 120 70" stroke={HD} strokeWidth="5" strokeLinecap="round" opacity=".5"/>
    </g>;

    if(cfg.hair==="pompadour") return <g>
      <path d="M62 85 C64 52 91 38 112 25 C143 9 179 31 181 78 C150 66 92 71 62 85Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M87 62 C112 35 148 30 166 58" stroke={HL} strokeWidth="13" strokeLinecap="round" opacity=".68"/>
      <path d="M124 27 C118 44 122 60 136 72" stroke={HD} strokeWidth="5" strokeLinecap="round" opacity=".5"/>
      <path d="M100 54 C108 46 120 44 130 50" stroke={HL} strokeWidth="3" strokeLinecap="round" opacity=".5"/>
    </g>;

    if(cfg.hair==="mohawk") return <g>
      <path d="M109 34 C111 22 124 18 133 29 C139 45 138 70 132 90 L108 90 C102 70 103 50 109 34Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M118 30 C122 47 122 67 118 85" stroke={HL} strokeWidth="7" strokeLinecap="round" opacity=".7"/>
      <path d="M74 83 C88 74 100 72 108 82" stroke={HD} strokeWidth="10" strokeLinecap="round" opacity=".45"/>
      <path d="M132 82 C143 72 158 74 168 83" stroke={HD} strokeWidth="10" strokeLinecap="round" opacity=".45"/>
    </g>;

    if(["afroSmall","afroBig","curls"].includes(cfg.hair)){
      const big=cfg.hair==="afroBig", curl=cfg.hair==="curls";
      const pts=big?[[58,82,24],[73,58,25],[97,42,24],[122,35,26],[148,43,25],[170,60,25],[184,84,23],[80,90,21],[106,78,22],[130,76,22],[154,84,21]]:curl?[[72,73,17],[91,58,17],[112,51,18],[134,53,17],[154,64,17],[168,81,16],[90,83,15],[116,76,16],[144,82,15]]:[[75,74,18],[93,60,19],[118,53,20],[144,61,19],[164,77,18],[95,82,16],[120,77,17],[147,82,16]];
      return <g>
        {pts.map(([cx,cy,r],i)=><g key={i}><circle cx={cx} cy={cy} r={r} fill={i%3===0?HD:i%2?hair:HL} stroke={line} strokeWidth="3.5"/><ellipse cx={cx-r*.32} cy={cy-r*.38} rx={r*.42} ry={r*.28} fill={HL} opacity=".44" transform={`rotate(-28,${cx-r*.32},${cy-r*.38})`}/></g>)}
        <path d="M66 92 C84 80 156 80 174 92" stroke={hair} strokeWidth="16" strokeLinecap="round"/>
      </g>;
    }

    if(["dreadsShort","dreadsMed","dreadsLong","dreadsTie","dreadHighFade"].includes(cfg.hair)){
      const isTie=cfg.hair==="dreadsTie", isFade=cfg.hair==="dreadHighFade";
      const bot={dreadsShort:152,dreadsMed:178,dreadsLong:210,dreadsTie:162,dreadHighFade:154}[cfg.hair];
      const cols=[{x:58,b:bot-14,flip:false,w:15,bd:9},{x:66,b:bot,flip:true,w:14,bd:7},{x:74,b:bot-24,flip:false,w:13,bd:6},{x:166,b:bot-18,flip:true,w:15,bd:9},{x:174,b:bot,flip:false,w:14,bd:7},{x:182,b:bot-10,flip:true,w:13,bd:6}];
      return <g>
        <path d="M58 88 C50 110 46 148 52 180 L62 180 C58 152 60 116 66 94Z" fill={HD} opacity=".88"/>
        <path d="M182 88 C190 110 194 148 188 180 L178 180 C182 152 180 116 174 94Z" fill={HD} opacity=".88"/>
        {dreadCrown(isTie,isFade)}
        {cols.map((c,i)=>loc(c.x,86,c.b,c.w,c.flip,c.bd,i))}
        {cols.flatMap((c,i)=>[108,130,152,172,192].filter(y=>y<c.b).map((y,j)=>(
          <path key={`t${i}${j}`} d={`M${c.x-4} ${y} C${c.x} ${y+4},${c.x} ${y+6},${c.x+4} ${y+10}`} fill="none" stroke={HL} strokeWidth="1.8" strokeLinecap="round" opacity=".5"/>
        )))}
      </g>;
    }

    if(cfg.hair==="twists") return <g>
      <path d="M66 80 C79 50 100 38 123 38 C149 38 168 53 175 80 C148 71 93 71 66 80Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M84 62 C104 50 138 52 158 64" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
      {[[74,80,88,104,72,124],[168,80,178,104,170,124]].map((s,i)=><g key={i}>
        <path d={`M${s[0]} ${s[1]} C${s[2]} ${s[3]},${s[4]} ${s[5]-16},${s[4]} ${s[5]}`} fill="none" stroke={hair} strokeWidth="14" strokeLinecap="round"/>
        <path d={`M${s[0]-2} ${s[1]+4} C${s[2]-2} ${s[3]},${s[4]-2} ${s[5]-18},${s[4]-2} ${s[5]-4}`} fill="none" stroke={HL} strokeWidth="4" strokeLinecap="round" opacity=".6"/>
      </g>)}
    </g>;

    if(cfg.hair==="braids") return <g>
      <path d="M67 78 C79 48 100 36 123 36 C149 36 167 51 175 79 C148 70 93 70 67 78Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M84 63 C104 51 138 53 158 65" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
      {[{x:68,b:170,fl:false},{x:76,b:158,fl:true},{x:162,b:170,fl:true},{x:170,b:158,fl:false}].map((c,i)=><g key={i}>
        <path d={`M${c.x} 82 C${c.x+(c.fl?7:-7)} 110,${c.x+(c.fl?-5:5)} 136,${c.x} ${c.b}`} fill="none" stroke={hair} strokeWidth="11" strokeLinecap="round"/>
        {[96,114,132,150].filter(y=>y<c.b).map((y,j)=>weave(c.x,y,7,false,i*10+j))}
        <path d={`M${c.x-2} 86 C${c.x+(c.fl?6:-6)} 112,${c.x+(c.fl?-4:4)} 136,${c.x-1} ${c.b-6}`} fill="none" stroke={HL} strokeWidth="2.5" strokeLinecap="round" opacity=".55"/>
      </g>)}
      <path d="M72 78 C90 70 150 70 168 78" stroke={hair} strokeWidth="16" strokeLinecap="round"/>
    </g>;

    if(cfg.hair==="cornrows") return <g>
      <path d="M69 80 C80 51 100 39 123 39 C148 39 166 53 172 80 C148 72 93 72 69 80Z" fill={hair} stroke={line} strokeWidth={sw}/>
      {[82,93,104,115,126,137,148,159].map((x,i)=>(
        <path key={x} d={`M${x} 44 C${x-3} 60 ${x-2} 72 ${x-1} 80`} fill="none" stroke={i%2?HL:HD} strokeWidth="4.5" strokeLinecap="round" opacity=".82"/>
      ))}
      {[{x:68,fl:false},{x:172,fl:true}].map((b,i)=><g key={i}>
        <path d={`M${b.x} 82 C${b.x+(b.fl?8:-8)} 108,${b.x+(b.fl?6:-6)} 132,${b.x+(b.fl?4:-4)} 154`} fill="none" stroke={hair} strokeWidth="9" strokeLinecap="round"/>
        {[96,112,128,144].map((y,j)=>weave(b.x+(b.fl?3:-3),y,6,true,i*10+j))}
      </g>)}
    </g>;

    if(cfg.hair==="pixie") return <g>
      <path d="M67 82 C76 50 100 36 125 37 C152 39 171 56 176 91 C152 79 96 78 67 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M88 63 C106 50 136 51 156 67" stroke={HL} strokeWidth="10" strokeLinecap="round" opacity=".62"/>
      <path d="M90 72 C108 64 132 65 152 73" stroke={HL} strokeWidth="6" strokeLinecap="round" opacity=".38"/>
    </g>;

    if(cfg.hair==="bob") return <g>
      <path d="M65 80 C76 50 99 37 121 37 C151 37 173 57 179 85 C184 114 176 156 163 173 C158 130 158 104 151 88 C132 96 102 96 85 88 C80 105 80 132 77 172 C63 153 57 116 65 80Z" fill={hair} stroke={line} strokeWidth={sw} strokeLinejoin="round"/>
      <path d="M90 63 C112 51 140 54 158 72" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".58"/>
      <path d="M78 148 C100 154 140 154 162 148" stroke={HL} strokeWidth="5" strokeLinecap="round" opacity=".35"/>
    </g>;

    if(cfg.hair==="waves") return <g>
      <path d="M63 84 C72 50 98 36 123 37 C154 38 175 59 181 94 C187 129 176 164 160 180 C158 137 153 105 143 84 C121 98 95 95 76 85 C78 116 78 146 72 178 C55 156 54 115 63 84Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M82 79 C100 61 122 78 142 62 C154 54 164 65 170 77" stroke={HL} strokeWidth="7" strokeLinecap="round" fill="none" opacity=".65"/>
      <path d="M78 108 C96 92 118 108 138 94 C152 84 164 96 172 108" stroke={HL} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".45"/>
      <path d="M75 136 C92 122 114 136 134 122 C148 112 162 124 170 136" stroke={HL} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".32"/>
    </g>;

    if(cfg.hair==="ponytail") return <g>
      <path d="M66 81 C78 49 100 36 124 36 C151 36 169 53 176 82 C148 72 93 72 66 81Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M86 60 C106 47 136 49 156 63" stroke={HL} strokeWidth="9" strokeLinecap="round" opacity=".58"/>
      <path d="M167 83 C200 87 207 122 182 140 C170 120 166 104 167 83Z" fill={hair} stroke={line} strokeWidth="5"/>
      <path d="M172 94 C194 98 196 118 182 128" stroke={HL} strokeWidth="5" strokeLinecap="round" opacity=".6"/>
      <ellipse cx="167" cy="88" rx="5" ry="3" fill={HD} stroke={line} strokeWidth="2"/>
    </g>;

    if(cfg.hair==="bun") return <g>
      <path d="M67 80 C80 48 102 37 124 37 C150 37 168 52 176 81 C148 72 93 72 67 80Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <circle cx="120" cy="33" r="22" fill={hair} stroke={line} strokeWidth="5"/>
      <ellipse cx="116" cy="27" rx="14" ry="10" fill={HL} opacity=".42"/>
      <circle cx="120" cy="33" r="7" fill={HD} stroke={line} strokeWidth="2"/>
      <circle cx="120" cy="33" r="3" fill={HL} opacity=".6"/>
    </g>;

    if(cfg.hair==="long") return <g>
      <path d="M64 82 C73 50 98 36 123 37 C154 38 176 58 181 92 C189 137 178 186 163 204 C151 162 153 115 143 84 C123 96 96 96 77 85 C78 120 77 161 66 204 C51 179 53 118 64 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M82 77 C104 59 130 68 154 72" stroke={HL} strokeWidth="9" strokeLinecap="round" opacity=".6"/>
      <path d="M70 116 C78 108 78 130 72 140" stroke={HL} strokeWidth="4" strokeLinecap="round" opacity=".38"/>
      <path d="M170 116 C162 108 162 130 168 140" stroke={HL} strokeWidth="4" strokeLinecap="round" opacity=".38"/>
    </g>;


    if(cfg.hair==="taperFade") return <g>
      <path d="M66 82 C78 48 100 36 124 37 C151 38 169 54 175 84 C149 74 91 74 66 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M80 69 C100 54 142 56 163 72" stroke={HL} strokeWidth="9" strokeLinecap="round" opacity=".55"/>
      <path d="M67 91 C82 83 92 83 100 86" stroke={skinDark} strokeWidth="7" strokeLinecap="round" opacity=".42"/>
      <path d="M173 91 C158 83 148 83 140 86" stroke={skinDark} strokeWidth="7" strokeLinecap="round" opacity=".42"/>
    </g>;

    if(cfg.hair==="burstFade") return <g>
      <path d="M72 82 C78 48 103 34 128 38 C154 42 170 58 174 88 C148 78 94 76 72 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M90 62 C116 47 149 58 163 75" stroke={HL} strokeWidth="10" strokeLinecap="round" opacity=".55"/>
      <circle cx="76" cy="101" r="14" fill={skinDark} opacity=".32"/>
      <circle cx="164" cy="101" r="14" fill={skinDark} opacity=".32"/>
    </g>;

    if(cfg.hair==="mullet") return <g>
      <path d="M66 82 C80 45 104 35 127 38 C153 41 170 60 175 86 C149 76 93 76 66 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M62 92 C51 128 55 177 73 202 C82 160 82 122 78 92Z" fill={HD} stroke={line} strokeWidth="5"/>
      <path d="M178 92 C189 128 185 177 167 202 C158 160 158 122 162 92Z" fill={HD} stroke={line} strokeWidth="5"/>
      <path d="M86 64 C108 51 143 54 163 72" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
    </g>;

    if(cfg.hair==="afroTaper") return <g>
      {[[79,76,19],[97,55,22],[120,48,24],[143,56,22],[162,78,19],[82,98,18],[158,98,18]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill={i%2?hair:HL} stroke={line} strokeWidth="5"/>)}
      <path d="M66 115 C78 105 91 104 103 110" stroke={skinDark} strokeWidth="8" strokeLinecap="round" opacity=".35"/>
      <path d="M174 115 C162 105 149 104 137 110" stroke={skinDark} strokeWidth="8" strokeLinecap="round" opacity=".35"/>
    </g>;

    if(cfg.hair==="dreadsPony") return <g>
      {dreadCrown(false,false)}
      <path d="M158 90 C197 101 205 151 178 196" fill="none" stroke={HD} strokeWidth="18" strokeLinecap="round"/>
      <path d="M162 94 C193 107 196 148 176 184" fill="none" stroke={hair} strokeWidth="13" strokeLinecap="round"/>
      <path d="M58 96 C66 128 64 164 52 190" fill="none" stroke={HD} strokeWidth="13" strokeLinecap="round"/>
      <path d="M76 92 C82 124 80 154 72 178" fill="none" stroke={hair} strokeWidth="12" strokeLinecap="round"/>
      <rect x="151" y="83" width="20" height="10" rx="5" fill="#C0392B" stroke={line} strokeWidth="2"/>
    </g>;

    if(cfg.hair==="dreadsBunHigh") return <g>
      <ellipse cx="120" cy="34" rx="34" ry="24" fill={hair} stroke={line} strokeWidth={sw}/>
      {[[98,33,12],[114,24,13],[130,25,12],[142,37,11],[108,44,11],[126,45,12]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill={i%2?hair:HL} stroke={line} strokeWidth="3"/>)}
      <path d="M67 82 C81 56 100 48 120 49 C145 49 164 60 175 82 C149 74 92 74 67 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M78 78 C98 67 144 67 164 78" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".5"/>
    </g>;

    if(cfg.hair==="boxBraids") return <g>
      <path d="M66 82 C78 50 99 38 124 39 C150 40 170 55 176 84 C149 75 91 75 66 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      {[60,75,90,105,135,150,165,180].map((x,i)=><g key={i}>
        <path d={`M${x} 88 C${x+(i%2?7:-7)} 122 ${x+(i%2?-5:5)} 162 ${x} 203`} fill="none" stroke={i%2?HD:hair} strokeWidth="10" strokeLinecap="round"/>
        {[108,130,152,174].map((y,j)=><path key={j} d={`M${x-4} ${y} L${x+4} ${y+7}`} stroke={HL} strokeWidth="2.5" strokeLinecap="round" opacity=".55"/>)}
      </g>)}
    </g>;

    if(cfg.hair==="wolfCut") return <g>
      <path d="M63 82 C76 48 99 36 123 38 C151 40 172 58 179 88 C171 122 176 165 160 203 C150 165 148 121 141 88 C124 101 101 99 82 87 C84 122 80 164 66 202 C52 161 55 116 63 82Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M82 76 C101 62 132 65 158 78" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
      <path d="M98 71 C94 85 90 94 84 104" stroke={HD} strokeWidth="7" strokeLinecap="round"/>
    </g>;

    if(cfg.hair==="lowPonytail") return <g>
      <path d="M67 81 C80 50 101 38 124 38 C150 39 170 56 176 84 C150 75 91 75 67 81Z" fill={hair} stroke={line} strokeWidth={sw}/>
      <path d="M160 104 C193 129 187 177 157 202" fill="none" stroke={HD} strokeWidth="19" strokeLinecap="round"/>
      <path d="M78 74 C100 63 144 65 164 78" stroke={HL} strokeWidth="8" strokeLinecap="round" opacity=".55"/>
    </g>;

    return null;
  };

  const eyesLayer=()=>{
    const y=112;
    const ly=cfg.eyes==="happy"?115:y;
    if(cfg.eyes==="sleepy") return <g stroke={line} strokeWidth="5" strokeLinecap="round">
      <path d="M88 113 Q98 118 108 113"/>
      <path d="M132 113 Q142 118 152 113"/>
      {female&&<g stroke={line} strokeWidth="3" opacity=".7">
        <path d="M86 111 Q90 107 94 110"/><path d="M108 110 Q114 107 118 111"/>
        <path d="M130 111 Q134 107 138 110"/><path d="M152 110 Q158 107 162 111"/>
      </g>}
    </g>;
    const rx=cfg.eyes==="sharp"?13:12;
    const ry=cfg.eyes==="happy"?10:13;
    return <g>
      <ellipse cx="98" cy={ly} rx={rx} ry={ry} fill="#FFF7E1" stroke={line} strokeWidth="4"/>
      <ellipse cx="142" cy={ly} rx={rx} ry={ry} fill="#FFF7E1" stroke={line} strokeWidth="4"/>
      {/* iris */}
      <circle cx="98" cy={ly+1} r="6.5" fill="#16223D"/>
      <circle cx="142" cy={ly+1} r="6.5" fill="#16223D"/>
      {/* pupil */}
      <circle cx="98" cy={ly+1} r="3.5" fill="#080E1A"/>
      <circle cx="142" cy={ly+1} r="3.5" fill="#080E1A"/>
      {/* catchlights */}
      <circle cx="94" cy={ly-3} r="2.2" fill="#fff"/>
      <circle cx="138" cy={ly-3} r="2.2" fill="#fff"/>
      <circle cx="101" cy={ly+2} r="1.2" fill="#fff" opacity=".7"/>
      <circle cx="145" cy={ly+2} r="1.2" fill="#fff" opacity=".7"/>
      {/* lashes — thicker and more prominent on female */}
      {female
        ?<g fill="none" stroke={line} strokeLinecap="round">
          <path d={`M86 ${ly-12} C92 ${ly-18} 104 ${ly-18} 110 ${ly-12}`} strokeWidth="4.5"/>
          <path d={`M130 ${ly-12} C136 ${ly-18} 148 ${ly-18} 154 ${ly-12}`} strokeWidth="4.5"/>
          {/* extra lash tips */}
          <path d={`M87 ${ly-13} L84 ${ly-19}`} strokeWidth="2.5"/>
          <path d={`M93 ${ly-16} L92 ${ly-22}`} strokeWidth="2.5"/>
          <path d={`M101 ${ly-17} L102 ${ly-23}`} strokeWidth="2.5"/>
          <path d={`M109 ${ly-13} L112 ${ly-19}`} strokeWidth="2.5"/>
          <path d={`M131 ${ly-13} L128 ${ly-19}`} strokeWidth="2.5"/>
          <path d={`M137 ${ly-16} L136 ${ly-22}`} strokeWidth="2.5"/>
          <path d={`M145 ${ly-17} L146 ${ly-23}`} strokeWidth="2.5"/>
          <path d={`M153 ${ly-13} L156 ${ly-19}`} strokeWidth="2.5"/>
        </g>
        :<g fill="none" stroke={line} strokeLinecap="round">
          <path d={`M86 ${ly-12} C92 ${ly-17} 104 ${ly-17} 110 ${ly-12}`} strokeWidth="3.5"/>
          <path d={`M130 ${ly-12} C136 ${ly-17} 148 ${ly-17} 154 ${ly-12}`} strokeWidth="3.5"/>
        </g>
      }
      {cfg.eyes==="happy"&&<g fill="none" stroke={line} strokeLinecap="round">
        <path d={`M86 ${ly+10} C92 ${ly+15} 104 ${ly+15} 110 ${ly+10}`} strokeWidth="2.5"/>
        <path d={`M130 ${ly+10} C136 ${ly+15} 148 ${ly+15} 154 ${ly+10}`} strokeWidth="2.5"/>
      </g>}
    </g>
  };
  const mouthLayer=()=>{
    const lipColor=shade(skin,-58);
    if(cfg.mouth==="neutral") return female
      ?<g>
        <path d="M104 151 Q120 154 136 151" fill="none" stroke={lipColor} strokeWidth="4" strokeLinecap="round"/>
        <path d="M104 151 Q120 156 136 151" fill={shade(skin,-28)} stroke="none"/>
        <path d="M108 152 Q120 155 132 152" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".3"/>
      </g>
      :<path d="M104 151 Q120 154 136 151" fill="none" stroke={lipColor} strokeWidth="5" strokeLinecap="round"/>;
    if(cfg.mouth==="smirk") return female
      ?<g>
        <path d="M104 148 Q121 160 140 150" fill="none" stroke={lipColor} strokeWidth="4" strokeLinecap="round"/>
        <path d="M104 148 Q121 158 140 150" fill={shade(skin,-28)} stroke="none"/>
      </g>
      :<path d="M104 148 Q121 160 140 150" fill="none" stroke={lipColor} strokeWidth="5" strokeLinecap="round"/>;
    // smile
    return female
      ?<g>
        <path d="M102 148 Q120 140 138 148" fill="none" stroke={lipColor} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M102 148 Q120 165 138 148" fill={shade(skin,-22)} stroke={lipColor} strokeWidth="4" strokeLinecap="round"/>
        <path d="M102 148 Q120 163 138 148" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="5" strokeLinecap="round"/>
        <path d="M112 153 Q120 158 128 153" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".35"/>
      </g>
      :<path d="M102 148 Q120 164 140 148" fill="none" stroke={lipColor} strokeWidth="5" strokeLinecap="round"/>
  };
  const beardLayer=()=>{
    if(!showBeard||female||cfg.beard==="none")return null;
    if(cfg.beard==="stubble") return <path d="M91 146 C100 165 140 165 149 146 C145 171 132 181 120 182 C108 181 95 171 91 146Z" fill={hairDark} opacity=".32"/>;
    if(cfg.beard==="moustache") return <g>
      <path d="M99 138 C108 132 116 136 120 141 C112 147 104 146 96 141Z" fill={hair} stroke={line} strokeWidth="3"/>
      <path d="M141 138 C132 132 124 136 120 141 C128 147 136 146 144 141Z" fill={hair} stroke={line} strokeWidth="3"/>
    </g>;
    if(cfg.beard==="goatee") return <g>
      <path d="M101 139 C110 134 116 137 120 142 C112 147 104 147 97 142Z" fill={hair} stroke={line} strokeWidth="3"/>
      <path d="M139 139 C130 134 124 137 120 142 C128 147 136 147 143 142Z" fill={hair} stroke={line} strokeWidth="3"/>
      <path d="M111 158 C116 168 124 168 129 158 C128 174 112 174 111 158Z" fill={hair} stroke={line} strokeWidth="3"/>
    </g>;
    if(cfg.beard==="short") return <g>
      <path d="M88 143 C92 166 105 180 120 181 C135 180 148 166 152 143 C148 174 134 189 120 190 C106 189 92 174 88 143Z" fill={hair} stroke={line} strokeWidth="4"/>
      <path d="M99 151 C108 160 132 160 141 151" fill="none" stroke={shade(hair,36)} strokeWidth="4" strokeLinecap="round" opacity=".42"/>
    </g>;
    if(cfg.beard==="full") return <g>
      <path d="M84 136 C86 170 102 194 120 196 C138 194 154 170 156 136 C151 179 137 204 120 205 C103 204 89 179 84 136Z" fill={hair} stroke={line} strokeWidth="5"/>
      <path d="M98 157 C108 170 132 170 143 157" fill="none" stroke={shade(hair,38)} strokeWidth="5" strokeLinecap="round" opacity=".38"/>
    </g>;
    return null
  };
  const extrasLayer=()=>{
    if(!showExtras)return null;
    const items=[];

    // Tattoos / marcas pequeñas, colocados lejos de barba y accesorios.
    if(cfg.tattoo==="neckStar") items.push(<path key="ts" d="M120 191 L123 198 L131 198 L125 203 L127 211 L120 206 L113 211 L115 203 L109 198 L117 198Z" fill="#24324A" opacity=".82"/>);
    if(cfg.tattoo==="neckWave") items.push(<path key="tw" d="M101 194 C110 186 119 202 128 194 C135 188 140 190 146 197" fill="none" stroke="#24324A" strokeWidth="4" strokeLinecap="round" opacity=".78"/>);
    if(cfg.tattoo==="cheekBolt") items.push(<path key="tb" d="M86 128 L94 116 L92 127 L101 127 L90 143 L94 131Z" fill="#24324A" opacity=".72"/>);
    if(cfg.tattoo==="templeDots") items.push(<g key="td" fill="#24324A" opacity=".72"><circle cx="83" cy="105" r="2.6"/><circle cx="78" cy="113" r="2.2"/><circle cx="157" cy="105" r="2.6"/><circle cx="162" cy="113" r="2.2"/></g>);

    // Pendientes y piercings
    if(cfg.accessory==="earringSmall") items.push(<g key="es"><circle cx="67" cy="134" r="5" fill="#F5CF66" stroke={line} strokeWidth="2"/><circle cx="173" cy="134" r="5" fill="#F5CF66" stroke={line} strokeWidth="2"/></g>);
    if(cfg.accessory==="earringBig") items.push(<g key="eb" fill="none" stroke="#F5CF66" strokeWidth="4"><circle cx="66" cy="137" r="8"/><circle cx="174" cy="137" r="8"/></g>);
    if(cfg.accessory==="piercingNose") items.push(<circle key="pn" cx="128" cy="132" r="3.8" fill="#F5CF66" stroke={line} strokeWidth="1.5"/>);
    if(cfg.accessory==="piercingBrow") items.push(<path key="pb" d="M136 95 L148 91" stroke="#F5CF66" strokeWidth="4" strokeLinecap="round"/>);
    if(cfg.accessory==="lipRing") items.push(<circle key="pl" cx="132" cy="154" r="3.3" fill="#F5CF66" stroke={line} strokeWidth="1.4"/>);

    // Gorras / sombreros. Son opacos y tapan el pelo cuando están activos.
    if(cfg.hat==="cap") items.push(<g key="cap">
      <path d="M63 82 C74 47 100 30 127 31 C155 32 176 51 182 84 C153 75 92 75 63 82Z" fill="#102137" stroke={line} strokeWidth="7" strokeLinejoin="round"/>
      <path d="M81 70 C104 55 141 56 164 72" stroke="#365C91" strokeWidth="9" strokeLinecap="round" opacity=".82"/>
      <path d="M112 79 C146 68 184 79 201 94 C174 99 145 95 122 84Z" fill="#1E4F78" stroke={line} strokeWidth="6" strokeLinejoin="round"/>
      <path d="M129 80 C150 77 174 83 190 91" stroke="#5B89C0" strokeWidth="4" strokeLinecap="round" opacity=".72"/>
    </g>);
    if(cfg.hat==="beanie") items.push(<g key="bean">
      <path d="M66 82 C73 46 99 29 126 30 C153 31 175 53 179 84 C150 76 91 76 66 82Z" fill="#7A241B" stroke={line} strokeWidth="7"/>
      <path d="M70 84 C94 94 147 94 175 84" stroke="#B54531" strokeWidth="11" strokeLinecap="round"/>
      <path d="M84 58 C104 47 139 48 159 61" stroke="#D06A55" strokeWidth="6" strokeLinecap="round" opacity=".62"/>
    </g>);
    if(cfg.hat==="bucket") items.push(<g key="buck">
      <path d="M60 77 C73 45 98 31 124 31 C153 31 175 49 184 80 C151 73 91 73 60 77Z" fill="#DAB458" stroke={line} strokeWidth="7"/>
      <path d="M50 82 C80 100 161 101 191 82" fill="#B58D37" stroke={line} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M67 78 C95 87 151 87 175 78" stroke="#F2D779" strokeWidth="6" strokeLinecap="round" opacity=".78"/>
    </g>);
    if(cfg.hat==="bandana") items.push(<g key="band">
      <path d="M62 80 C85 68 154 68 178 80 L173 95 C150 88 90 88 67 95Z" fill="#27773A" stroke={line} strokeWidth="6"/>
      <path d="M76 79 C102 72 140 72 165 80" stroke="#6CC778" strokeWidth="5" strokeLinecap="round" opacity=".7"/>
      <circle cx="121" cy="83" r="4" fill="#F3DE87"/>
      <path d="M171 86 C184 89 192 96 197 108" stroke="#27773A" strokeWidth="10" strokeLinecap="round"/>
    </g>);
    if(cfg.hat==="visor") items.push(<g key="visor">
      <path d="M67 73 C92 57 149 57 174 74" fill="none" stroke="#14365E" strokeWidth="16" strokeLinecap="round"/>
      <path d="M120 74 C151 65 185 74 201 87 C177 92 148 89 125 81Z" fill="#2B6FA3" stroke={line} strokeWidth="6" strokeLinejoin="round"/>
      <path d="M84 68 C106 59 139 60 160 70" stroke="#67A3D5" strokeWidth="5" strokeLinecap="round" opacity=".7"/>
    </g>);

    if(cfg.glasses!=="none"){
      const col=cfg.glasses==="sun"?"#111":cfg.glasses==="round"?"#D7B24A":"#24180F";
      if(cfg.glasses==="round") items.push(<g key="gr" fill="rgba(255,255,255,.08)" stroke={col} strokeWidth="5"><circle cx="96" cy="116" r="16"/><circle cx="144" cy="116" r="16"/><path d="M112 116 L128 116"/></g>);
      if(cfg.glasses==="square") items.push(<g key="gs" fill="rgba(255,255,255,.08)" stroke={col} strokeWidth="5" strokeLinejoin="round"><rect x="80" y="104" width="32" height="25" rx="7"/><rect x="128" y="104" width="32" height="25" rx="7"/><path d="M112 116 L128 116"/></g>);
      if(cfg.glasses==="sun") items.push(<g key="gso" fill="#111" stroke="#201008" strokeWidth="4"><path d="M78 105 L113 108 L108 130 C92 132 82 125 78 105Z"/><path d="M162 105 L127 108 L132 130 C148 132 158 125 162 105Z"/><path d="M112 115 L128 115"/></g>);
    }
    return <g>{items}</g>;
  };
  return <svg viewBox="0 0 240 260" width={size} height={size} style={{display:"block",maxWidth:"100%",filter:mini?"drop-shadow(0 8px 10px rgba(34,18,6,.18))":"drop-shadow(0 20px 30px rgba(0,0,0,.45))"}}>
    <defs>
      <linearGradient id={`${uid}_bg`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={bg[0]}/><stop offset="1" stopColor={bg[1]}/></linearGradient>
      <linearGradient id={`${uid}_skin`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={skinLight}/><stop offset=".42" stopColor={skin}/><stop offset="1" stopColor={skinDark}/></linearGradient>
    </defs>
    <rect x="6" y="6" width="228" height="248" rx="42" fill={`url(#${uid}_bg)`} stroke="rgba(32,16,8,.9)" strokeWidth={mini?3:5}/>

    {/* Fondo visible en toda la tarjeta. Los detalles van a los bordes para que el avatar no los tape. */}
    {!mini&&cfg.bg==="beach"&&<g>
      <circle cx="196" cy="48" r="25" fill="#FFE27A" opacity=".95"/>
      <path d="M6 164 C42 145 78 148 110 160 C145 174 178 171 234 145 L234 254 L6 254Z" fill="#F6D78A" opacity=".82"/>
      <path d="M8 154 C46 139 78 143 111 156 C146 169 180 164 232 142" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity=".8"/>
      <path d="M22 96 C44 87 68 87 89 99" fill="none" stroke="#EFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".75"/>
      <path d="M33 236 C55 216 71 185 67 145" fill="none" stroke="#6B441F" strokeWidth="8" strokeLinecap="round" opacity=".75"/>
      <path d="M68 145 C48 132 33 128 17 132 M69 145 C87 129 104 124 121 128 M67 145 C72 122 84 107 101 99" fill="none" stroke="#236B3C" strokeWidth="7" strokeLinecap="round" opacity=".82"/>
    </g>}

    {!mini&&cfg.bg==="barber"&&<g>
      <rect x="22" y="36" width="196" height="178" rx="22" fill="#2A1208" opacity=".48"/>
      <path d="M30 66 H210 M30 104 H210 M30 142 H210" stroke="#F6D878" strokeWidth="5" opacity=".55"/>
      <rect x="24" y="184" width="192" height="26" rx="10" fill="#E5BC63" opacity=".45"/>
      <circle cx="54" cy="226" r="15" fill="#F6D878" opacity=".7"/>
      <circle cx="186" cy="226" r="15" fill="#F6D878" opacity=".7"/>
      <path d="M35 42 L65 72 M205 42 L175 72" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".55"/>
    </g>}

    {!mini&&cfg.bg==="studio"&&<g>
      <rect x="18" y="32" width="204" height="144" rx="22" fill="#2A140A" opacity=".55"/>
      <path d="M45 62 H195 M45 96 H195 M45 130 H195" stroke="#F5D483" strokeWidth="5" opacity=".7"/>
      <rect x="34" y="178" width="172" height="35" rx="13" fill="#E0B75D" opacity=".45"/>
      <circle cx="54" cy="216" r="19" fill="#F5D483" opacity=".82"/>
      <circle cx="186" cy="216" r="19" fill="#F5D483" opacity=".82"/>
      <path d="M58 214 H182" stroke="#4B230E" strokeWidth="7" opacity=".45"/>
    </g>}

    {!mini&&cfg.bg==="workshop"&&<g>
      <rect x="26" y="185" width="188" height="29" rx="8" fill="#3B2A1D" opacity=".72"/>
      <path d="M34 206 H206" stroke="#E7C777" strokeWidth="10" opacity=".75"/>
      <path d="M45 50 L111 116 M195 50 L129 116" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".55"/>
      <path d="M47 50 L37 72 M193 50 L203 72" stroke="#E7C777" strokeWidth="6" strokeLinecap="round" opacity=".65"/>
      <rect x="38" y="222" width="164" height="15" rx="6" fill="#7A5631" opacity=".75"/>
      <circle cx="42" cy="172" r="13" fill="#E7C777" opacity=".7"/>
      <circle cx="198" cy="172" r="13" fill="#E7C777" opacity=".7"/>
    </g>}

    {!mini&&cfg.bg==="neon"&&<g>
      <path d="M24 52 H216 V210 H24Z" fill="none" stroke="#5FD7FF" strokeWidth="6" opacity=".45"/>
      <path d="M48 72 H192 M48 190 H192" stroke="#FF5FD7" strokeWidth="5" opacity=".45"/>
      <circle cx="48" cy="216" r="18" fill="#5FD7FF" opacity=".38"/>
      <circle cx="192" cy="216" r="18" fill="#FF5FD7" opacity=".32"/>
    </g>}

    {!mini&&["plain","warm"].includes(cfg.bg)&&<g opacity=".25">
      <path d="M34 210 C76 184 164 184 206 210" stroke="#fff" strokeWidth="8" fill="none"/>
      <path d="M32 36 L208 224" stroke="#fff" strokeWidth="3"/>
      <path d="M208 36 L32 224" stroke="#fff" strokeWidth="3"/>
    </g>}
    {focus!=="bg"&&<g>
      {/* Shirt/body */}
      <path d="M78 213 C85 189 97 175 120 175 C143 175 155 189 162 213 C140 225 99 225 78 213Z" fill="#23344F" stroke={line} strokeWidth={stroke}/>
      {/* Neck */}
      <rect x="93" y="160" width="54" height="42" rx="18" fill={`url(#${uid}_skin)`} stroke={line} strokeWidth={stroke}/>
      {/* Face plate — always drawn BEFORE hair so hair sits on top */}
      <path d={facePath} fill={`url(#${uid}_skin)`} stroke={line} strokeWidth={stroke} strokeLinejoin="round"/>
      {/* Ears */}
      <path d="M78 112 C63 115 61 139 78 146" fill={skin} stroke={line} strokeWidth="5"/>
      <path d="M162 112 C177 115 179 139 162 146" fill={skin} stroke={line} strokeWidth="5"/>
      {/* Face features — only when not hair-only focus */}
      {showFaceFeatures&&<g>
        {eyesLayer()}
        <path d="M120 123 C116 133 117 139 126 140" fill="none" stroke={shade(skin,-62)} strokeWidth="4" strokeLinecap="round" opacity=".55"/>
        {mouthLayer()}
      </g>}
      {/* HAIR — painted last so it always sits on top of the face */}
      {hairLayer()}
      {beardLayer()}
      {extrasLayer()}
      {!mini&&<path d="M88 78 C101 52 139 50 154 76" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="8" strokeLinecap="round"/>}
    </g>}
  </svg>
}
const CleanAvatar=CartoonAvatar;
function PiecePreview({type,item,cfg,mini}){
  if(type==="hair") return <CartoonAvatar config={{...mini,hair:item.id,model:item.group==="mujer"?"female":"male",face:item.group==="mujer"?"heart":"round"}} size={104} mini focus="hair"/>;
  if(type==="beard") return <CartoonAvatar config={{...mini,model:"male",face:"square",hair:"fadeLow",beard:item.id}} size={104} mini focus="beard"/>;
  if(type==="glasses") return <CartoonAvatar config={{...mini,hair:"buzz",glasses:item.id,accessory:"none"}} size={104} mini focus="extras"/>;
  if(type==="accessory") return <CartoonAvatar config={{...mini,hair:"buzz",glasses:"none",accessory:item.id}} size={104} mini focus="extras"/>;
  if(type==="face") return <CartoonAvatar config={{...mini,face:item.id,hair:"buzz"}} size={104} mini focus="face"/>;
  if(type==="eyes") return <CartoonAvatar config={{...mini,eyes:item.id,hair:"buzz"}} size={104} mini focus="face"/>;
  if(type==="mouth") return <CartoonAvatar config={{...mini,mouth:item.id,hair:"buzz"}} size={104} mini focus="face"/>;
  return null
}
function BgPreview({id}){
  const m={plain:"linear-gradient(160deg,#F8E6B2,#D5AE55)",barber:"linear-gradient(160deg,#1B100B,#75411F)",neon:"linear-gradient(160deg,#0D1625,#21A8D8)",warm:"linear-gradient(160deg,#40200F,#E0A943)"};
  return <div style={{width:88,height:88,borderRadius:26,background:m[id]||m.plain,border:"5px solid rgba(19,10,6,.22)",boxShadow:"inset 0 18px 24px rgba(255,255,255,.16),0 10px 15px rgba(0,0,0,.16)"}}/>
}
function AvatarEditor({form,setForm,ownedKeys=[],user=null,onSave=null,onReset=null}){
  const current=form?.avatar_config||form?.avatarConfig||form?.avatarV3||{};
  const cfg=normalizeAvatarV3(current,user?.id||0);
  const female=cfg.model==="female";

  const setCfg=(next)=>setForm?.(f=>({...f,avatar_config:next,avatarConfig:next,avatarV3:next}));
  const patch=(k,v)=>setCfg(normalizeAvatarV3({...cfg,[k]:v},user?.id||0));
  const patchMany=(obj)=>setCfg(normalizeAvatarV3({...cfg,...obj},user?.id||0));

  const safeList=(arr=[])=>Array.isArray(arr)?arr:[];
  const optionById=(arr,id)=>safeList(arr).find(x=>x.id===id);
  const hairAllowed=(h)=> female ? (h.group==="mujer"||h.group==="rastas"||h.group==="trenzas"||h.group==="rizo") : h.group!=="mujer";
  const hairList=HAIR_STYLES.filter(hairAllowed);
  const beardList=female?[{id:"none",label:"Sin barba"}]:CLEAN_AVATAR_OPTIONS.beard;
  const accessoryList=CLEAN_AVATAR_OPTIONS.accessory||[{id:"none",label:"Nada"}];
  const hatList=CLEAN_AVATAR_OPTIONS.hat||[{id:"none",label:"Sin gorra"}];
  const tattooList=CLEAN_AVATAR_OPTIONS.tattoo||[{id:"none",label:"Sin tatuaje"}];
  const glassesList=CLEAN_AVATAR_OPTIONS.glasses||[{id:"none",label:"Sin gafas"}];

  const ensureIn=(list,key,fallback=null)=>{
    const ids=list.map(x=>x.id);
    if(ids.includes(cfg[key])) return cfg[key];
    return fallback ?? ids[0];
  };

  const cycle=(key,list,dir=1)=>{
    const clean=safeList(list).filter(Boolean);
    if(!clean.length)return;
    const ids=clean.map(x=>x.id);
    const cur=ids.includes(cfg[key])?cfg[key]:ids[0];
    const idx=ids.indexOf(cur);
    patch(key,ids[(idx+dir+ids.length)%ids.length]);
  };

  const randomize=()=>{
    const model=pick(["male","female"]);
    const femaleNext=model==="female";
    const availableHair=HAIR_STYLES.filter(h=>femaleNext?(h.group==="mujer"||["rastas","trenzas","rizo"].includes(h.group)):h.group!=="mujer");
    setCfg(normalizeAvatarV3({
      model,
      face:cleanPick(CLEAN_AVATAR_OPTIONS.face),
      skin:cleanPick(CLEAN_AVATAR_OPTIONS.skin),
      hair:pick(availableHair)?.id||"fadeMid",
      hairColor:cleanPick(CLEAN_AVATAR_OPTIONS.hairColor),
      eyes:cleanPick(CLEAN_AVATAR_OPTIONS.eyes),
      mouth:cleanPick(CLEAN_AVATAR_OPTIONS.mouth),
      beard:femaleNext?"none":pick(["none","stubble","goatee","short","full"]),
      glasses:pick(["none","none","round","square","sun"]),
      accessory:pick(["none","none","earringSmall","earringBig","piercingNose","lipRing"]),
      hat:pick(["none","none","cap","bandana","bucket","visor"]),
      tattoo:pick(["none","none","neckStar","neckWave","cheekBolt"]),
      bg:cleanPick(CLEAN_AVATAR_OPTIONS.bg)
    },user?.id||0));
  };

  const reset=()=>{setCfg(cleanAvatarDefaults(user?.id||0));onReset?.()};

  const chooseModel=(model)=>{
    const nextFemale=model==="female";
    const allowed=HAIR_STYLES.filter(h=>nextFemale?(h.group==="mujer"||["rastas","trenzas","rizo"].includes(h.group)):h.group!=="mujer");
    const currentHair=allowed.some(h=>h.id===cfg.hair)?cfg.hair:(nextFemale?"waves":"fadeMid");
    patchMany({
      model,
      hair:currentHair,
      beard:nextFemale?"none":(cfg.beard==="none"?cfg.beard:(cfg.beard||"stubble")),
      face:nextFemale?(cfg.face==="square"?"heart":cfg.face):(cfg.face==="heart"?"round":cfg.face)
    });
  };

  const ItemButton=({active,onClick,children})=>(
    <button type="button" className="bp" onClick={onClick} style={{
      border:"2px solid "+(active?"#1ad7ff":"rgba(114,77,35,.28)"),
      background:active?"linear-gradient(135deg,#FFE078,#BFFFD8,#BCE9FF)":"linear-gradient(180deg,#FFF2C9,#DAB96D)",
      color:"#14335C",
      borderRadius:18,
      padding:"10px 12px",
      fontWeight:900,
      boxShadow:active?"0 10px 22px rgba(20,190,255,.22), inset 0 2px 0 rgba(255,255,255,.75)":"inset 0 2px 0 rgba(255,255,255,.6),0 8px 16px rgba(50,25,8,.10)",
      cursor:"pointer",
      minHeight:44
    }}>{children}</button>
  );

  const StepRow=({title,sub,value,list,field,disabled=false})=>{
    const current=optionById(list,value)||list?.[0]||{label:""};
    return <div style={{
      display:"grid",
      gridTemplateColumns:"1fr auto",
      gap:10,
      alignItems:"center",
      background:"linear-gradient(180deg,rgba(255,246,218,.92),rgba(215,177,94,.58))",
      border:"2px solid rgba(111,72,28,.24)",
      borderRadius:22,
      padding:12,
      boxShadow:"inset 0 2px 0 rgba(255,255,255,.55)"
    }}>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:900,color:"#1B3766",fontSize:"1rem"}}>{title}</div>
        {sub&&<div style={{fontSize:".75rem",fontWeight:800,color:"#65431D"}}>{sub}</div>}
        <div style={{fontFamily:"Pirata One,cursive",fontSize:"1.45rem",color:"#4A2A12",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current?.label||"—"}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button type="button" className="bp" disabled={disabled} onClick={()=>cycle(field,list,-1)} style={{
          width:44,height:44,borderRadius:16,border:"2px solid #A77A27",background:"#FFF0B7",fontWeight:1000,fontSize:"1.15rem",color:"#193A6B",opacity:disabled?.45:1
        }}>‹</button>
        <button type="button" className="bp" disabled={disabled} onClick={()=>cycle(field,list,1)} style={{
          width:44,height:44,borderRadius:16,border:"2px solid #A77A27",background:"#FFF0B7",fontWeight:1000,fontSize:"1.15rem",color:"#193A6B",opacity:disabled?.45:1
        }}>›</button>
      </div>
    </div>
  };

  const ColorGrid=({title,list,field})=>(
    <div style={{background:"rgba(255,244,210,.58)",border:"1px solid rgba(112,72,28,.18)",borderRadius:20,padding:12}}>
      <div style={{fontWeight:1000,color:"#1B3766",marginBottom:8}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(46px,1fr))",gap:8}}>
        {list.map(o=><button key={o.id} type="button" title={o.label} onClick={()=>patch(field,o.id)} style={{
          height:44,
          borderRadius:15,
          border:"3px solid "+(cfg[field]===o.id?"#18D7FF":"rgba(68,42,15,.28)"),
          background:o.color||"#DDD",
          boxShadow:cfg[field]===o.id?"0 0 0 4px rgba(24,215,255,.16), inset 0 2px 0 rgba(255,255,255,.35)":"inset 0 2px 0 rgba(255,255,255,.25)",
          cursor:"pointer"
        }}/>)}
      </div>
    </div>
  );

  const avatarTitle=`Avatar ${female?"femenino":"masculino"} · ${(optionById(hairList,cfg.hair)||{}).label||"Pelo"}`;

  return <div style={{display:"grid",gap:14}}>
    <div style={{
      display:"grid",
      gridTemplateColumns:"minmax(210px,340px) 1fr",
      gap:18,
      alignItems:"stretch",
      padding:18,
      borderRadius:28,
      background:"linear-gradient(135deg,#3A1F10,#B97919 55%,#E4BD42)",
      border:"3px solid rgba(255,226,132,.42)",
      boxShadow:"0 18px 34px rgba(36,16,4,.24), inset 0 2px 0 rgba(255,255,255,.18)"
    }} className="avatar-game-editor">
      <div style={{display:"grid",placeItems:"center",background:"radial-gradient(circle at 50% 32%,rgba(255,225,105,.28),rgba(42,18,7,.72) 70%)",borderRadius:26,padding:14,border:"2px solid rgba(20,8,4,.25)"}}>
        <CartoonAvatar config={cfg} size={300}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12,justifyContent:"center"}}>
        <div>
          <div style={{fontFamily:"Pirata One,cursive",fontSize:"clamp(1.7rem,4vw,2.7rem)",lineHeight:1,color:"#14335C",textShadow:"0 2px 0 rgba(255,245,205,.75)"}}>Editor de Avatar</div>
          <div style={{fontWeight:900,color:"#3A260E",opacity:.9}}>{avatarTitle}</div>
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <ItemButton active={cfg.model==="male"} onClick={()=>chooseModel("male")}>Masculino</ItemButton>
          <ItemButton active={cfg.model==="female"} onClick={()=>chooseModel("female")}>Femenino</ItemButton>
          <ItemButton active={false} onClick={reset}>↩ Reset</ItemButton>
          <ItemButton active={false} onClick={randomize}>🎲 Random</ItemButton>
          <button type="button" className="bp" onClick={onSave} style={{
            border:"2px solid #315B12",
            background:"linear-gradient(180deg,#79B822,#3E850D)",
            color:"#FFF7C7",
            borderRadius:18,
            padding:"10px 18px",
            fontWeight:1000,
            boxShadow:"0 10px 0 #24500B,0 16px 22px rgba(30,10,0,.22)",
            minHeight:44
          }}>💾 Guardar</button>
        </div>

        <div style={{fontSize:".82rem",fontWeight:800,color:"#4A2A12",background:"rgba(255,242,196,.55)",padding:"8px 10px",borderRadius:14}}>
          Edita el personaje grande. Cada fila cambia una parte concreta del avatar, sin galerías enormes ni miniaturas repetidas.
        </div>
      </div>
    </div>

    <div style={{
      display:"grid",
      gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",
      gap:12
    }}>
      <StepRow title="Pelo" sub="Cortes, rastas, trenzas y melenas" value={ensureIn(hairList,"hair","fadeMid")} list={hairList} field="hair"/>
      <StepRow title="Cara" sub="Forma base del personaje" value={cfg.face} list={CLEAN_AVATAR_OPTIONS.face} field="face"/>
      <StepRow title="Ojos" sub="Expresión" value={cfg.eyes} list={CLEAN_AVATAR_OPTIONS.eyes} field="eyes"/>
      <StepRow title="Boca" sub="Gesto" value={cfg.mouth} list={CLEAN_AVATAR_OPTIONS.mouth} field="mouth"/>
      <StepRow title="Barba" sub={female?"Desactivada en femenino":"Barbería masculina"} value={ensureIn(beardList,"beard","none")} list={beardList} field="beard" disabled={female}/>
      <StepRow title="Gafas" sub="Ojos y estilo" value={cfg.glasses} list={glassesList} field="glasses"/>
      <StepRow title="Pendientes y piercings" sub="Orejas, nariz, ceja y labio" value={cfg.accessory} list={accessoryList} field="accessory"/>
      <StepRow title="Gorras y sombreros" sub="Snapback, bandana, gorro y bucket" value={cfg.hat} list={hatList} field="hat"/>
      <StepRow title="Tatuajes" sub="Detalles pequeños en cara/cuello" value={cfg.tattoo} list={tattooList} field="tattoo"/>
      <StepRow title="Fondo" sub="Playa, estudio, taller o neón" value={cfg.bg} list={CLEAN_AVATAR_OPTIONS.bg} field="bg"/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      <ColorGrid title="Color de piel" list={CLEAN_AVATAR_OPTIONS.skin} field="skin"/>
      <ColorGrid title="Color de pelo" list={CLEAN_AVATAR_OPTIONS.hairColor} field="hairColor"/>
    </div>

    <style>{`
      @media(max-width:760px){
        .avatar-game-editor{grid-template-columns:1fr!important;padding:12px!important}
        .avatar-game-editor svg{max-width:260px!important;height:auto!important}
      }
    `}</style>
  </div>
}


function mascotSourcesFromSettings(settings=null){
  const b=settings?.branding||{};
  return [
    b.mascota_rasta_url,
    b.rasta_mascota_url,
    b.imagen_mascota_url,
    b.imagen_rasta_url,
    b.logo_mascota_url,
    "/rasta-mascota.png",
    "/rasta_mascota.png",
    "/mascota-rasta.png",
    "/mascota_rasta.png",
    "/rasta.png",
    "/mascota.png",
    "/images/rasta-mascota.png",
    "/images/rasta.png",
    "/img/rasta-mascota.png",
    "/img/rasta.png"
  ].map(x=>String(x||"").trim()).filter(Boolean);
}

function RastaMascotImage({settings=null,compact=false}={}){
  const sources=useMemo(()=>mascotSourcesFromSettings(settings),[settings?.branding?.mascota_rasta_url,settings?.branding?.rasta_mascota_url,settings?.branding?.imagen_mascota_url,settings?.branding?.imagen_rasta_url,settings?.branding?.logo_mascota_url]);
  const [imgIndex,setImgIndex]=useState(0);
  useEffect(()=>{setImgIndex(0);},[sources.join("|")]);
  const src=sources[imgIndex];

  if(!src) return <HeroMascot/>;

  return (
    <div
      className="rasta-mascot-cutout-wrap"
      style={{
        width:"100%",
        maxWidth:compact?286:354,
        height:compact?214:268,
        margin:compact?"2px auto 4px":"2px auto 6px",
        position:"relative",
        animation:"mascotFloat 3.2s ease-in-out infinite"
      }}
    >
      <div style={{position:"absolute",inset:"6% 8% 7%",background:"radial-gradient(circle at 50% 58%,rgba(255,214,107,.30),transparent 44%)",filter:"blur(18px)",zIndex:0,pointerEvents:"none"}}/>
      <img
        key={src}
        className="rasta-mascot-cutout-img"
        src={src}
        alt="Mascota Rasta Cuts"
        draggable={false}
        onError={()=>setImgIndex(i=>i+1)}
        style={{position:"relative",zIndex:1,filter:"drop-shadow(0 20px 26px rgba(0,0,0,.32))"}}
      />
    </div>
  );
}


function brandLogoSourcesFromSettings(settings=null){
  const b=settings?.branding||{};
  return [
    b.logo_banner_url,
    b.logo_rastacuts_url,
    b.logo_titulo_url,
    b.imagen_titulo_url,
    "/rastacuts_logo.webp",
    "/rastacuts_logo.png",
    "/rasta-cuts-logo-banner.webp",
    "/rasta-cuts-logo-banner.png",
    "/images/rasta-cuts-logo-banner.webp",
    "/images/rasta-cuts-logo-banner.png",
    "/images/rastacuts_logo.webp",
    "/images/rastacuts_logo.png"
  ].map(x=>String(x||"").trim()).filter(Boolean);
}

function RastaBrandBannerImage({settings=null,compact=false}={}){
  const sources=useMemo(()=>brandLogoSourcesFromSettings(settings),[
    settings?.branding?.logo_banner_url,
    settings?.branding?.logo_rastacuts_url,
    settings?.branding?.logo_titulo_url,
    settings?.branding?.imagen_titulo_url
  ]);
  const [imgIndex,setImgIndex]=useState(0);
  useEffect(()=>{setImgIndex(0);},[sources.join("|")]);
  const src=sources[imgIndex];

  if(!src){
    return (
      <div style={{display:"grid",placeItems:"center",gap:8}}>
        <div style={{
          fontFamily:"'Pirata One','Rubik Wet Paint','Bangers',cursive",
          fontSize:compact?"2.3rem":"3.25rem",
          lineHeight:.88,
          letterSpacing:"1px",
          color:"#FFD66B",
          textShadow:"0 4px 0 #3A1607,0 10px 22px rgba(0,0,0,.54)",
          textAlign:"center"
        }}>Rasta Cuts</div>
        <RastaMascotImage settings={settings} compact={compact}/>
      </div>
    );
  }

  return (
    <div style={{position:"relative",width:"100%",display:"grid",placeItems:"center",padding:compact?"2px 0 6px":"4px 0 10px"}}>
      <div style={{position:"absolute",inset:"12% 8%",background:"radial-gradient(circle at 50% 50%,rgba(255,207,91,.30),transparent 52%)",filter:"blur(24px)",pointerEvents:"none"}}/>
      <img
        key={src}
        src={src}
        alt="Rasta Cuts"
        draggable={false}
        onError={()=>setImgIndex(i=>i+1)}
        style={{
          position:"relative",
          width:"100%",
          maxWidth:compact?390:620,
          height:"auto",
          display:"block",
          objectFit:"contain",
          filter:"drop-shadow(0 22px 24px rgba(0,0,0,.38))"
        }}
      />
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


function HelperHeroMascotFaceCrop({size=54}={}){
  // Versión mini del mismo Rasta del inicio/login.
  // Ya no recorta el HeroMascot grande porque el recorte podía quedar invisible en móvil.
  return (
    <svg
      className="helper-hero-face-crop"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{
        position:"absolute",
        left:"50%",
        top:"50%",
        transform:"translate(-50%,-50%)",
        display:"block",
        overflow:"visible",
        background:"transparent",
        pointerEvents:"none",
        zIndex:2,
        filter:"drop-shadow(0 4px 6px rgba(0,0,0,.20))"
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="helperHeroSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0B37E"/>
          <stop offset="100%" stopColor="#D89461"/>
        </linearGradient>
        <linearGradient id="helperHeroDread" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#25140B"/>
          <stop offset="62%" stopColor="#512D18"/>
          <stop offset="100%" stopColor="#8C5A31"/>
        </linearGradient>
      </defs>

      {/* RastaHelp 2.9.6d: sin aureola ni fondo, sólo dibujo sticker */}

      {/* rastas laterales, como el Rasta grande */}
      <g strokeLinecap="round" fill="none">
        <path d="M28 38 C14 46,12 64,22 81 C29 92,36 99,45 107" stroke="#25140B" strokeWidth="8"/>
        <path d="M36 30 C24 41,23 58,31 76 C36 88,41 96,46 104" stroke="#3A2113" strokeWidth="8"/>
        <path d="M46 25 C38 38,39 55,44 72 C48 84,51 93,54 101" stroke="url(#helperHeroDread)" strokeWidth="7"/>

        <path d="M92 38 C106 46,108 64,98 81 C91 92,84 99,75 107" stroke="#25140B" strokeWidth="8"/>
        <path d="M84 30 C96 41,97 58,89 76 C84 88,79 96,74 104" stroke="#3A2113" strokeWidth="8"/>
        <path d="M74 25 C82 38,81 55,76 72 C72 84,69 93,66 101" stroke="url(#helperHeroDread)" strokeWidth="7"/>
      </g>

      {/* moño/top knot */}
      <path d="M54 23 C51 14,54 8,61 8 C69 8,74 15,72 24" fill="#2A180D"/>
      <path d="M57 13 C64 10,72 14,76 21 C79 27,76 34,71 38" fill="none" stroke="#2A180D" strokeWidth="6" strokeLinecap="round"/>
      <ellipse cx="62" cy="21" rx="12" ry="6" fill="#2A180D"/>
      <rect x="53" y="30" width="17" height="5" rx="3" fill="#C0392B"/>

      {/* pelo superior + bandana roja */}
      <path d="M33 45 C38 27,48 20,60 20 C72 20,82 27,87 45 C78 38,70 35,60 35 C50 35,42 38,33 45Z" fill="#24140C"/>
      <path d="M36 43 C43 36,51 33,60 33 C69 33,77 36,84 43 L82 53 C75 48,68 46,60 46 C52 46,45 48,38 53Z" fill="#A72822"/>
      <path d="M48 41 C52 38,56 37,60 37 C64 37,68 38,72 41" fill="none" stroke="#F2C27E" strokeWidth="2" strokeLinecap="round" opacity=".8"/>

      {/* cara */}
      <path d="M36 55 C36 37,46 26,60 26 C74 26,84 37,84 55 C84 80,73 99,60 102 C47 99,36 80,36 55Z" fill="url(#helperHeroSkin)"/>
      <ellipse cx="36" cy="64" rx="4" ry="8" fill="#E9A578"/>
      <ellipse cx="84" cy="64" rx="4" ry="8" fill="#E9A578"/>
      <ellipse cx="45" cy="70" rx="6" ry="4" fill="#E69C7F" opacity=".50"/>
      <ellipse cx="75" cy="70" rx="6" ry="4" fill="#E69C7F" opacity=".50"/>

      {/* cejas y ojos: un ojo abierto y un guiño como el grande */}
      <path d="M46 52 C50 48,55 47,58 49" fill="none" stroke="#26160D" strokeWidth="3" strokeLinecap="round"/>
      <path d="M64 49 C69 47,74 48,78 52" fill="none" stroke="#26160D" strokeWidth="3" strokeLinecap="round"/>

      <ellipse cx="50" cy="62" rx="8" ry="8" fill="#FFF"/>
      <ellipse cx="50" cy="62" rx="4.3" ry="5" fill="#112435"/>
      <circle cx="48" cy="60" r="1.4" fill="#fff"/>

      <path d="M68 62 C72 58,78 58,81 62" fill="none" stroke="#17110D" strokeWidth="4" strokeLinecap="round"/>

      {/* nariz, sonrisa y barba ligera */}
      <path d="M58 68 C60 73,60 77,57 79" fill="none" stroke="#B86F4E" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M48 84 C54 91,66 91,72 84" fill="none" stroke="#8B2F1C" strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M47 79 C53 77,57 78,60 80 C63 78,67 77,73 79" fill="none" stroke="#2A170F" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M54 86 C57 91,63 91,66 86" fill="#321D12"/>

      {/* ganchillo pequeño en el hombro para que recuerde al HeroMascot */}
      <g transform="translate(86 76) rotate(22)">
        <path d="M0 0 L22 -20" stroke="#8B5529" strokeWidth="4" strokeLinecap="round"/>
        <path d="M21 -20 C27 -24,32 -20,29 -14 C27 -10,23 -10,21 -13" fill="none" stroke="#E2D6C2" strokeWidth="3" strokeLinecap="round"/>
      </g>
    </svg>
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
  const avatarConfig=normalizeAvatarV3(u.avatar_config || u.avatarConfig, u.id||u.avatar||0);
  const privacy=normalizePrivacy(u);
  return {
    id:u.id,
    nombre:u.nombre,
    email:u.email,
    rol:normalizeRole(u.role || u.rol),
    puntos:u.puntos||0,
    rc:Number(u.rc??u.rasta_coins??0)||0,
    xp:Number(u.xp??u.avatar_xp??0)||0,
    avatar_level:Number(u.avatar_level)||avatarLevelFromXP(Number(u.xp??u.avatar_xp??0)||0),
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


function RastaCardIllustration({type="arcade",accent="#F2C85B",size=118}={}){
  const key=String(type||"").toLowerCase();
  const dark="#07100D";
  const cream="#FFF7DA";
  const gold="#F2C85B";
  const teal="#3EE6C7";
  const red="#D94A35";
  const purple="#B14CFF";
  const common={width:size,height:Math.round(size*.78),viewBox:"0 0 160 126",fill:"none",style:{display:"block",overflow:"visible",filter:"drop-shadow(0 18px 20px rgba(0,0,0,.28))"},"aria-hidden":"true"};
  const glow=<><circle cx="122" cy="24" r="42" fill={accent} opacity=".16"/><circle cx="38" cy="88" r="40" fill={teal} opacity=".10"/></>;
  if(key.includes("tienda")||key.includes("shop")) return <svg {...common}>{glow}<path d="M50 48h70l10 58H40l10-58Z" fill="url(#bagG)" stroke={accent} strokeWidth="4"/><path d="M62 49c2-20 34-20 36 0" stroke={cream} strokeWidth="8" strokeLinecap="round" opacity=".85"/><path d="M30 74l42-8 9 32-42 8-9-32Z" fill={red} stroke={cream} strokeWidth="3"/><circle cx="51" cy="86" r="5" fill={gold}/><defs><linearGradient id="bagG" x1="43" y1="45" x2="126" y2="112"><stop stopColor="#3EE6C7"/><stop offset="1" stopColor="#12352B"/></linearGradient></defs></svg>;
  if(key.includes("mis")||key.includes("reto")) return <svg {...common}>{glow}<circle cx="72" cy="66" r="43" fill="#101C15" stroke={cream} strokeWidth="5"/><circle cx="72" cy="66" r="30" fill={red} opacity=".95"/><circle cx="72" cy="66" r="17" fill={cream}/><circle cx="72" cy="66" r="7" fill={teal}/><path d="M116 14L95 60h24l-29 52 9-38H78l38-60Z" fill={gold} stroke="#3A2108" strokeWidth="3"/></svg>;
  if(key.includes("comunidad")||key.includes("foro")) return <svg {...common}>{glow}<path d="M31 38h66c12 0 20 8 20 19v15c0 11-8 19-20 19H62l-26 19 7-19H31c-12 0-20-8-20-19V57c0-11 8-19 20-19Z" fill="url(#chatG)" stroke={accent} strokeWidth="4"/><path d="M77 22h43c10 0 17 7 17 16v12c0 9-7 16-17 16h-8l5 16-21-16H77c-10 0-17-7-17-16V38c0-9 7-16 17-16Z" fill="rgba(217,74,53,.92)" stroke={cream} strokeWidth="3"/><circle cx="48" cy="65" r="5" fill={cream}/><circle cx="66" cy="65" r="5" fill={cream}/><circle cx="84" cy="65" r="5" fill={cream}/><defs><linearGradient id="chatG" x1="14" y1="35" x2="116" y2="108"><stop stopColor="#1BC49B"/><stop offset="1" stopColor="#0D221C"/></linearGradient></defs></svg>;
  if(key.includes("perfil")||key.includes("avatar")) return <svg {...common}>{glow}<circle cx="78" cy="52" r="35" fill="#D59463" stroke={accent} strokeWidth="4"/><path d="M42 56c-2-32 18-48 36-48s38 16 36 48c-17-19-55-19-72 0Z" fill="#2B170C"/><path d="M43 109c7-20 22-30 35-30s28 10 35 30" fill="url(#avaG)" stroke={cream} strokeWidth="4"/><circle cx="64" cy="55" r="5" fill={dark}/><path d="M91 51c7 3 10 8 10 8" stroke={dark} strokeWidth="4" strokeLinecap="round"/><path d="M68 70c8 7 20 7 28 0" stroke="#7A2D1E" strokeWidth="5" strokeLinecap="round"/><path d="M113 16l8 16 18 2-13 12 4 18-17-9-16 9 3-18-12-12 17-2 8-16Z" fill={gold} stroke="#3A2108" strokeWidth="3"/><defs><linearGradient id="avaG" x1="44" y1="78" x2="112" y2="116"><stop stopColor="#3EE6C7"/><stop offset="1" stopColor="#15291F"/></linearGradient></defs></svg>;
  if(key.includes("gacha")) return <svg {...common}>{glow}<path d="M48 52h62l10 50H38l10-50Z" fill="#1A1528" stroke={purple} strokeWidth="4"/><circle cx="79" cy="42" r="31" fill="url(#orbG)" stroke={cream} strokeWidth="4"/><circle cx="66" cy="33" r="8" fill={cream} opacity=".55"/><circle cx="101" cy="84" r="10" fill={gold}/><circle cx="58" cy="88" r="8" fill={teal}/><path d="M58 104h44" stroke={accent} strokeWidth="6" strokeLinecap="round"/><defs><radialGradient id="orbG" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(66 28) rotate(52) scale(54)"><stop stopColor="#FFF7DA"/><stop offset=".45" stopColor="#B14CFF"/><stop offset="1" stopColor="#211037"/></radialGradient></defs></svg>;
  if(key.includes("tycoon")||key.includes("local")||key.includes("gestion")) return <svg {...common}>{glow}<path d="M28 58h94v48H28V58Z" fill="url(#shopG)" stroke={accent} strokeWidth="4"/><path d="M38 30h74l18 30H20l18-30Z" fill={red} stroke={cream} strokeWidth="4"/><path d="M45 70h26v36H45V70Z" fill="#0B1412" stroke={teal} strokeWidth="3"/><path d="M83 73h26" stroke={cream} strokeWidth="5" strokeLinecap="round"/><path d="M83 89h20" stroke={gold} strokeWidth="5" strokeLinecap="round"/><path d="M36 46h90" stroke={gold} strokeWidth="6" strokeLinecap="round"/><defs><linearGradient id="shopG" x1="28" y1="58" x2="122" y2="106"><stop stopColor="#17382B"/><stop offset="1" stopColor="#3B270E"/></linearGradient></defs></svg>;
  return <svg {...common}>{glow}<rect x="45" y="18" width="72" height="88" rx="16" fill="url(#gameG)" stroke={accent} strokeWidth="4"/><rect x="56" y="31" width="50" height="35" rx="8" fill="#07100D" stroke={teal} strokeWidth="3"/><circle cx="69" cy="84" r="9" fill={red}/><circle cx="95" cy="84" r="7" fill={gold}/><path d="M38 76h30" stroke={cream} strokeWidth="7" strokeLinecap="round"/><path d="M53 61v30" stroke={cream} strokeWidth="7" strokeLinecap="round"/><path d="M117 98c13-3 20-12 21-28" stroke={purple} strokeWidth="7" strokeLinecap="round"/><defs><linearGradient id="gameG" x1="45" y1="18" x2="117" y2="106"><stop stopColor="#223E66"/><stop offset="1" stopColor="#0E161B"/></linearGradient></defs></svg>;
}


function MiniRastaHelperFace({size=60,speaking=false}={}){
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{display:"block",overflow:"visible",filter:speaking?"drop-shadow(0 4px 6px rgba(0,0,0,.18))":"drop-shadow(0 3px 5px rgba(0,0,0,.14))"}} aria-hidden="true">
      <g strokeLinecap="round" fill="none">
        <path d="M27 35 C14 47,13 66,23 82" stroke="#22130B" strokeWidth="8"/>
        <path d="M35 28 C23 43,24 62,31 86" stroke="#3B2113" strokeWidth="8"/>
        <path d="M45 23 C37 41,39 61,47 82" stroke="#6A3B1F" strokeWidth="7"/>
        <path d="M93 35 C106 47,107 66,97 82" stroke="#22130B" strokeWidth="8"/>
        <path d="M85 28 C97 43,96 62,89 86" stroke="#3B2113" strokeWidth="8"/>
        <path d="M75 23 C83 41,81 61,73 82" stroke="#6A3B1F" strokeWidth="7"/>
      </g>
      <circle cx="32" cy="78" r="3" fill="#D4AF37"/>
      <circle cx="88" cy="78" r="3" fill="#2F6B42"/>
      <path d="M35 43 C38 25,47 16,60 16 C73 16,82 25,85 43 C78 36,69 32,60 32 C51 32,42 36,35 43Z" fill="#21130B"/>
      <path d="M36 43 C43 37,51 34,60 34 C69 34,77 37,84 43 L82 54 C75 50,68 48,60 48 C52 48,45 50,38 54Z" fill="#2F6B42"/>
      <path d="M38 50 H82" stroke="#D4AF37" strokeWidth="5"/>
      <path d="M39 55 C49 61,71 61,81 55" fill="#A72822"/>
      <path d="M37 56 C37 39,47 28,60 28 C73 28,83 39,83 56 C83 78,74 95,60 99 C46 95,37 78,37 56Z" fill="#D59463"/>
      <ellipse cx="37" cy="62" rx="3.8" ry="7" fill="#C9855C"/>
      <ellipse cx="83" cy="62" rx="3.8" ry="7" fill="#C9855C"/>
      <path d="M48 52 C52 49,56 49,59 51" stroke="#24140C" strokeWidth="2.7"/>
      <path d="M61 51 C64 49,68 49,72 52" stroke="#24140C" strokeWidth="2.7"/>
      <ellipse cx="52" cy="61" rx="4" ry="4.8" fill="#111E2A"/>
      <ellipse cx="68" cy="61" rx="4" ry="4.8" fill="#111E2A"/>
      <circle cx="51" cy="59.5" r="1.1" fill="#fff"/>
      <circle cx="67" cy="59.5" r="1.1" fill="#fff"/>
      <path d="M59 65 C61 71,60 75,57 77" stroke="#AD6A48" strokeWidth="2"/>
      <path d="M50 78 C54 75,57 75,60 77 C63 75,66 75,70 78" stroke="#2A170F" strokeWidth="4"/>
      <path d="M52 84 C56 88,64 88,68 84" stroke="#8B2F1C" strokeWidth="3"/>
      <path d="M53 80 C56 87,64 87,67 80" fill="#321D12"/>
    </svg>
  );
}

function RastaFaceAvatar({size=66,speaking=false,settings=null,forceInternal=false}={}){
  const customSources=useMemo(()=>{
    const b=settings?.branding||{};
    return [
      b.mascota_rasta_url,
      b.rasta_mascota_url,
      b.imagen_mascota_url,
      b.imagen_rasta_url,
      b.logo_mascota_url
    ].filter(Boolean).map(String).filter(Boolean);
  },[
    settings?.branding?.mascota_rasta_url,
    settings?.branding?.rasta_mascota_url,
    settings?.branding?.imagen_mascota_url,
    settings?.branding?.imagen_rasta_url,
    settings?.branding?.logo_mascota_url
  ]);

  const sources=forceInternal?[]:customSources;
  const [imgIndex,setImgIndex]=useState(0);

  useEffect(()=>{ setImgIndex(0); },[sources.join("|"),forceInternal]);

  const src=sources[imgIndex];
  const hasImage=Boolean(src);

  return (
    <div
      className="rasta-face-avatar rasta-helper-face-cutout"
      style={{
        width:size,
        height:size,
        position:"relative",
        overflow:"hidden",
        display:"grid",
        placeItems:"center",
        background:"transparent",
        border:"0",
        boxShadow:"none",
        animation:"helperBob 2.4s ease-in-out infinite",
        filter:speaking
          ? "drop-shadow(0 4px 7px rgba(0,0,0,.18))"
          : "drop-shadow(0 3px 5px rgba(0,0,0,.14))"
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display:"none",
          position:"absolute",
          inset:0,
          background:"transparent",
          pointerEvents:"none"
        }}
      />

      {hasImage ? (
        <img
          key={src}
          src={src}
          alt="Rasta ayuda"
          draggable={false}
          onError={()=>setImgIndex(i=>i+1)}
          style={{
            position:"absolute",
            left:"50%",
            top:"50%",
            width:size*1.18,
            height:size*1.18,
            transform:"translate(-50%,-50%)",
            objectFit:"contain",
            objectPosition:"center center",
            background:"transparent",
            border:"0",
            boxShadow:"none",
            display:"block",
            zIndex:1,
            pointerEvents:"none"
          }}
        />
      ) : (
        <HelperHeroMascotFaceCrop size={size}/>
      )}
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
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <RastaBrandBannerImage settings={settings} compact={compact}/>
        <div style={{
          display:"inline-flex",
          alignItems:"center",
          gap:8,
          marginTop:compact?-2:0,
          padding:"6px 14px",
          background:"rgba(255,244,214,.08)",
          border:"1px solid rgba(212,175,55,.28)",
          borderRadius:999,
          color:"#F5E6C8",
          fontWeight:950,
          fontSize:".75rem",
          letterSpacing:".08em",
          textTransform:"uppercase"
        }}>Cortes, rastas y estilo urbano</div>
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
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.32}}>Reserva, juega, sube tu avatar y vuelve cuando quieras. Tu estudio digital con recompensas, comunidad y estilo propio.</div>
        </div>
        {user&&(
          <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <Badge col="gold">💎 {user.puntos||0} RP</Badge><Badge col="blue">🪙 {user.rc||0} RC</Badge>
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
      
      <Particles/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480}}>
        <RastaLandingHero compact={false} settings={settings}/>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
          <LandingFeature icon="📅" title="Reservas" sub="Reserva tu hora y elige el servicio que necesitas." accent="#D4AF37"/>
          <LandingFeature icon="🎮" title="Juegos" sub="Minijuegos, récords y recompensas." accent="#4F602D"/>
          <LandingFeature icon="🛍️" title="Tienda" sub="Vales, recompensas y extras para tu perfil." accent="#B99A45"/>
          <LandingFeature icon="🌐" title="Actualidad" sub="Noticias, historias y comunidad." accent="#263F4D"/>
          <div style={{gridColumn:"1 / -1"}}>
            <LandingFeature icon="🎧" title="Música" sub="Reggae, rap, ska y ambiente para el estudio." accent="#4E3A76"/>
          </div>
        </div>

        <div style={{padding:"22px 18px",animation:"softPop3d 0.42s ease",background:"linear-gradient(180deg,rgba(8,14,11,.97) 0%,rgba(14,25,19,.99) 100%)",border:"1.5px solid rgba(212,175,55,.42)",borderRadius:24,boxShadow:"0 18px 40px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.05)"}}>
          <div style={{display:"flex",background:"rgba(255,244,214,.06)",border:"1px solid rgba(212,175,55,.16)",borderRadius:14,padding:4,marginBottom:18}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setFormError("");}} style={{flex:1,padding:"10px 8px",borderRadius:12,border:"none",background:mode===m?"linear-gradient(180deg,#6E3518,#A54C1E)":"transparent",color:mode===m?"#FFF7DA":"rgba(255,244,214,.92)",boxShadow:mode===m?"0 8px 18px rgba(0,0,0,.22)":"none",fontWeight:950,fontSize:"0.9rem",cursor:"pointer",transition:"all 0.2s"}}>
                {m==="login"?"Entrar":"Registrarse"}
              </button>
            ))}
          </div>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.5rem",color:"#FFF4D6",marginBottom:6,letterSpacing:".02em"}}>{mode==="login"?"Entra al estudio":"Crea tu ficha de cliente"}</div>
          <div style={{fontSize:".86rem",fontWeight:850,color:"rgba(255,244,214,.82)",lineHeight:1.45,marginBottom:16}}>
            {mode==="login"?"Accede a tus reservas, tu arcade, tu avatar y tus recompensas.":"Crea tu perfil y empieza a moverte por Rasta Cuts desde hoy mismo."}
          </div>
          {formError&&(
            <div style={{background:"rgba(255,235,238,.98)",border:"1.5px solid #B42318",color:"#8B0000",borderRadius:12,padding:"10px 12px",fontWeight:800,fontSize:"0.82rem",marginBottom:14}}>
              {formError}
            </div>
          )}
          {mode==="login"?(
            <div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".82rem",fontWeight:900,color:"#FFF4D6",marginBottom:6}}>Email</div>
                <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="tu@email.com" style={{width:"100%",padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(212,175,55,.34)",outline:"none",fontSize:"1rem",fontWeight:800,background:"#FFF4D6",color:"#21140B",boxSizing:"border-box"}} />
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:".82rem",fontWeight:900,color:"#FFF4D6",marginBottom:6}}>Contraseña</div>
                <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="••••••••" style={{width:"100%",padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(212,175,55,.34)",outline:"none",fontSize:"1rem",fontWeight:800,background:"#FFF4D6",color:"#21140B",boxSizing:"border-box"}} />
              </div>
              <Btn full col="green" onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar al estudio"}</Btn>
            </div>
          ):(
            <div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".82rem",fontWeight:900,color:"#FFF4D6",marginBottom:6}}>Nombre completo</div>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" style={{width:"100%",padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(212,175,55,.34)",outline:"none",fontSize:"1rem",fontWeight:800,background:"#FFF4D6",color:"#21140B",boxSizing:"border-box"}} />
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".82rem",fontWeight:900,color:"#FFF4D6",marginBottom:6}}>Email</div>
                <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="tu@email.com" style={{width:"100%",padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(212,175,55,.34)",outline:"none",fontSize:"1rem",fontWeight:800,background:"#FFF4D6",color:"#21140B",boxSizing:"border-box"}} />
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:".82rem",fontWeight:900,color:"#FFF4D6",marginBottom:6}}>Contraseña</div>
                <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Mínimo 6 caracteres" style={{width:"100%",padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(212,175,55,.34)",outline:"none",fontSize:"1rem",fontWeight:800,background:"#FFF4D6",color:"#21140B",boxSizing:"border-box"}} />
              </div>
              <Btn full col="green" onClick={handleRegister} disabled={loading}>{loading?"Registrando...":"Crear cuenta y entrar"}</Btn>
            </div>
          )}
        </div>

        <div style={{textAlign:"center",color:"rgba(255,244,214,.84)",fontSize:".82rem",fontWeight:950,lineHeight:1.35,marginTop:16,padding:"12px 14px",border:"1px solid rgba(212,175,55,.25)",borderRadius:18,background:"rgba(255,244,214,.06)",boxShadow:"0 10px 22px rgba(0,0,0,.18)"}}>
          {settings?.branding?.mensaje_login||"Forma parte de la comunidad Rasta Cuts."}
        </div>
      </div>
    </div>
  );
}

function DashboardAdmin({user,showToast,onOpenTab}={}){
  const [stats,setStats]=useState({citas:0,clientes:0,ingresos:0,stockBajo:0,pendientes:0,confirmadas:0,pedidos:0,mensajes:0,reportes:0,realizadas:0});
  const [citasHoy,setCitasHoy]=useState([]);
  const [urgencias,setUrgencias]=useState([]);
  const [loading,setLoading]=useState(true);
  const [updatedAt,setUpdatedAt]=useState(null);
  const CHECK_KEY="rasta_gestion_check_hoy_v1";
  const todayKey=new Date().toISOString().split("T")[0];
  const [checked,setChecked]=useState(()=>{
    try{return JSON.parse(localStorage.getItem(`${CHECK_KEY}_${todayKey}`)||"{}");}
    catch{return {};}
  });

  async function load(){
    setLoading(true);
    const today=new Date().toISOString().split("T")[0];
    const [citas,clientes,ventas,stock,pedidos,mensajes,reportes]=await Promise.all([
      dbGet("citas",`?fecha=gte.${today}&order=fecha.asc,hora.asc&limit=80&select=*`),
      dbGet("usuarios","?role=eq.client&select=id"),
      dbGet("cobros",`?fecha=gte.${today}&select=importe,estado`),
      dbGet("inventario","?stock=lte.5&select=id,nombre,stock"),
      dbGet("tienda_pedidos","?estado=in.(pendiente,preparando,listo)&order=created_at.desc&limit=80&select=*"),
      dbGet("mensajes_privados","?autor_rol=eq.client&leido_admin=eq.false&order=created_at.desc&limit=80&select=*"),
      dbGet("reportes_comunidad","?estado=eq.pendiente&order=created_at.desc&limit=80&select=*"),
    ]);
    const citasList=Array.isArray(citas)?citas:[];
    const pedidosList=Array.isArray(pedidos)?pedidos:[];
    const mensajesList=Array.isArray(mensajes)?mensajes:[];
    const reportesList=Array.isArray(reportes)?reportes:[];
    const stockList=Array.isArray(stock)?stock:[];
    const ventasList=Array.isArray(ventas)?ventas:[];
    const pendientes=citasList.filter(c=>String(c.estado||"pendiente").toLowerCase()==="pendiente").length;
    const confirmadas=citasList.filter(c=>String(c.estado||"pendiente").toLowerCase()==="confirmada").length;
    const realizadas=citasList.filter(c=>String(c.estado||"").toLowerCase()==="completada").length;
    const nextStats={
      citas:citasList.length,
      pendientes,
      confirmadas,
      realizadas,
      clientes:(Array.isArray(clientes)?clientes:[]).length,
      ingresos:ventasList.filter(v=>String(v.estado||"pagado").toLowerCase()!=="anulado").reduce((sum,v)=>sum+(Number(v.importe)||0),0),
      stockBajo:stockList.length,
      pedidos:pedidosList.length,
      mensajes:mensajesList.length,
      reportes:reportesList.length
    };
    const urgent=[];
    if(pendientes>0) urgent.push({id:"citas",icon:"📅",title:`${pendientes} citas pendientes`,sub:"Confirma o cancela las reservas que aún esperan respuesta.",tab:"citas",col:"gold"});
    if(mensajesList.length>0) urgent.push({id:"mensajes",icon:"📩",title:`${mensajesList.length} mensajes sin leer`,sub:"Clientes esperando respuesta en el buzón privado.",tab:"mensajes",col:"red"});
    if(pedidosList.length>0) urgent.push({id:"pedidos",icon:"🛍️",title:`${pedidosList.length} canjes activos`,sub:"Pedidos pendientes, preparando o listos para entregar.",tab:"pedidos",col:"blue"});
    if(stockList.length>0) urgent.push({id:"stock",icon:"📦",title:`${stockList.length} productos con stock bajo`,sub:"Revisa inventario antes de quedarte sin material.",tab:"stock",col:"red"});
    if(reportesList.length>0) urgent.push({id:"moderacion",icon:"🚩",title:`${reportesList.length} reportes pendientes`,sub:"Revisa contenido marcado por la comunidad.",tab:"moderacion",col:"red"});
    if(!urgent.length) urgent.push({id:"ok",icon:"✅",title:"Sin urgencias fuertes",sub:"La gestión no tiene avisos críticos ahora mismo.",tab:"agenda",col:"green"});
    setStats(nextStats);
    setUrgencias(urgent);
    setCitasHoy(citasList.slice(0,8));
    setUpdatedAt(new Date());
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  function toggleCheck(id){
    setChecked(prev=>{
      const next={...prev,[id]:!prev[id]};
      try{localStorage.setItem(`${CHECK_KEY}_${todayKey}`,JSON.stringify(next));}catch{}
      return next;
    });
  }

  function jump(tab){
    SFX.tab();
    if(onOpenTab) onOpenTab(tab);
  }

  async function updateCita(cita,patch,msg){
    const ok=await dbPatch("citas",`?id=eq.${cita.id}`,patch);
    if(ok){showToast?.(msg);SFX.success();await load();}
    else{showToast?.("No se pudo actualizar la cita");SFX.error();}
  }

  const checkItems=[
    {id:"citas",icon:"📅",text:"Revisar citas pendientes y confirmar lo que toque",tab:"citas"},
    {id:"mensajes",icon:"📩",text:"Responder mensajes privados de clientes",tab:"mensajes"},
    {id:"pedidos",icon:"🛍️",text:"Preparar o entregar canjes pendientes",tab:"pedidos"},
    {id:"stock",icon:"📦",text:"Mirar stock bajo y anotar reposición",tab:"stock"},
    {id:"caja",icon:"💰",text:"Revisar caja/resumen económico del día",tab:"facturacion"}
  ];
  const quick=[
    {id:"agenda",icon:"🗓️",label:"Agenda",sub:"Día por horas"},
    {id:"citas",icon:"📅",label:"Citas",sub:"Confirmar reservas"},
    {id:"clientes",icon:"👥",label:"Clientes",sub:"Fichas rápidas"},
    {id:"facturacion",icon:"💰",label:"Caja",sub:"Resumen dinero"},
    {id:"pedidos",icon:"🛍️",label:"Canjes",sub:"Pedidos tienda"},
    {id:"mensajes",icon:"📩",label:"Mensajes",sub:"Buzón privado"},
    {id:"moderacion",icon:"🛡️",label:"Moderar",sub:"Reportes"},
    {id:"stock",icon:"📦",label:"Stock",sub:"Inventario"},
  ];

  if(loading)return <Spinner/>;
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏠" title="Centro de mando" sub={new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})} action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>

      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#120806,#2B1A0D 48%,#D4AF37)",border:"2px solid rgba(255,244,214,.52)",color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-22,top:-26,fontSize:"6.8rem",opacity:.10}}>🧾</div>
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2.25rem"}}>🧭</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.45rem",lineHeight:1}}>Gestión al día</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Lo urgente primero: citas, mensajes, canjes, stock, caja y moderación en una sola vista.</div>
            {updatedAt&&<div style={{marginTop:6,fontSize:".68rem",fontWeight:850,opacity:.72}}>Actualizado: {updatedAt.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</div>}
          </div>
          <Badge col={(stats.pendientes||stats.mensajes||stats.pedidos||stats.stockBajo||stats.reportes)?"gold":"green"}>{(stats.pendientes||stats.mensajes||stats.pedidos||stats.stockBajo||stats.reportes)?"revisar":"ok"}</Badge>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        <StatCard icon="📅" label="Citas próximas" value={stats.citas} col="green"/>
        <StatCard icon="🟡" label="Pendientes" value={stats.pendientes} col="gold"/>
        <StatCard icon="📩" label="Mensajes" value={stats.mensajes} col={stats.mensajes?"red":"blue"}/>
        <StatCard icon="🛍️" label="Canjes activos" value={stats.pedidos} col={stats.pedidos?"gold":"green"}/>
        <StatCard icon="💰" label="Ingresos hoy" value={`${Number(stats.ingresos||0).toFixed(2)}€`} col="gold"/>
        <StatCard icon="📦" label="Stock bajo" value={stats.stockBajo} col={stats.stockBajo?"red":"blue"}/>
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>⚡ Lo urgente</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub}}>Pulsa una tarjeta para ir directo al bloque correcto.</div>
          </div>
          <Badge col="gold">acción</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
          {urgencias.map(u=><button key={u.id} onClick={()=>jump(u.tab)} style={{border:`1.5px solid ${u.col==="red"?T.red:u.col==="green"?"#4F602D":T.gold}`,background:u.col==="red"?"linear-gradient(180deg,#F0D3BB,#E4B59A)":u.col==="green"?"linear-gradient(180deg,#E8F0CF,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#EBD18D)",borderRadius:16,padding:12,textAlign:"left",cursor:"pointer",boxShadow:"0 8px 18px rgba(20,8,4,.10)"}}>
            <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
              <div style={{fontSize:"1.45rem",lineHeight:1}}>{u.icon}</div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:950,color:T.g800,fontSize:".88rem"}}>{u.title}</div>
                <div style={{fontSize:".74rem",fontWeight:820,color:T.textSub,lineHeight:1.3,marginTop:3}}>{u.sub}</div>
              </div>
            </div>
          </button>)}
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:9}}>🚀 Accesos rápidos</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))",gap:8}}>
          {quick.map(q=><button key={q.id} onClick={()=>jump(q.id)} style={{border:`1.5px solid ${T.g300}`,background:"rgba(255,255,255,.34)",borderRadius:15,padding:"10px 8px",fontWeight:950,color:T.g800,cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:"1.45rem",lineHeight:1}}>{q.icon}</div>
            <div style={{fontSize:".78rem",marginTop:4}}>{q.label}</div>
            <div style={{fontSize:".66rem",fontWeight:800,color:T.textSub,marginTop:2}}>{q.sub}</div>
          </button>)}
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:9}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>✅ Rutina rápida de hoy</div>
            <div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>Lista local del dispositivo. Sirve para no olvidar lo básico.</div>
          </div>
          <Badge col="blue">{Object.values(checked).filter(Boolean).length}/{checkItems.length}</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:7}}>
          {checkItems.map(item=><div key={item.id} style={{display:"flex",gap:7,alignItems:"stretch"}}>
            <button onClick={()=>toggleCheck(item.id)} style={{flex:1,border:`1.5px solid ${checked[item.id]?"#4F602D":T.g300}`,background:checked[item.id]?"linear-gradient(180deg,#E8F0CF,#D8BE87)":"rgba(255,244,214,.72)",borderRadius:13,padding:"9px 10px",fontWeight:900,color:T.g800,textAlign:"left",cursor:"pointer"}}>{checked[item.id]?"✅":"⬜"} {item.icon} {item.text}</button>
            <button onClick={()=>jump(item.tab)} style={{border:`1.5px solid ${T.g300}`,background:"rgba(255,244,214,.72)",borderRadius:13,padding:"0 10px",fontWeight:950,color:T.g700,cursor:"pointer"}}>Ir</button>
          </div>)}
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
  const [homeData,setHomeData]=useState({orders:[],coupons:[],scores:[],claims:[]});
  const [loadingHome,setLoadingHome]=useState(true);

  useEffect(()=>{
    let alive=true;
    async function safe(table,query){
      try{const rows=await dbGet(table,query);return Array.isArray(rows)?rows:[];}catch{return [];}
    }
    async function load(){
      setLoadingHome(true);
      const today=new Date().toISOString().split("T")[0];
      const uid=encodeURIComponent(String(user.id));
      const [citas,news,orders,coupons,scores,claims]=await Promise.all([
        safe("citas",`?usuario_id=eq.${uid}&fecha=gte.${today}&order=fecha.asc&limit=1&select=*`),
        safe("publicaciones","?tipo=eq.correo&order=created_at.desc&limit=3&select=*"),
        safe("tienda_pedidos",`?usuario_id=eq.${uid}&order=created_at.desc&limit=3&select=*`),
        safe("user_coupons",`?usuario_id=eq.${uid}&estado=eq.disponible&order=created_at.desc&limit=3&select=*`),
        safe("game_scores",`?usuario_id=eq.${uid}&order=created_at.desc&limit=5&select=*`),
        safe("user_mission_claims",`?usuario_id=eq.${uid}&order=created_at.desc&limit=8&select=*`),
      ]);
      if(!alive)return;
      setProxCita(citas?.[0]||null);
      setNoticias(news||[]);
      setHomeData({orders:orders||[],coupons:coupons||[],scores:scores||[],claims:claims||[]});
      setLoadingHome(false);
    }
    load();
    return()=>{alive=false;};
  },[user.id]);

  const xp=userXP(user);
  const progress=avatarLevelProgress(xp);
  const nivel=avatarLevelName(user?.avatar_level||progress.level);
  const pendingOrder=homeData.orders.find(o=>!["entregado","cancelado"].includes(String(o.estado||"").toLowerCase()));
  const bestRecent=[...(homeData.scores||[])].sort((a,b)=>(Number(b.score)||Number(b.points)||0)-(Number(a.score)||Number(a.points)||0))[0];
  const claimedToday=(homeData.claims||[]).filter(c=>String(c.period_key||"").includes(TODAY_KEY())).length;
  const availableCoupons=homeData.coupons||[];
  const dailyPreview=MISSION_DEFS.filter(m=>m.period==="day").slice(0,3);

  function HeroButton({children,to,variant="primary"}){
    const primary=variant==="primary";
    return <button onClick={()=>{SFX.tab();onNavigate?.(to);}} style={{
      border:primary?"1px solid rgba(100,255,211,.55)":"1px solid rgba(255,210,98,.55)",
      background:primary?"linear-gradient(135deg,#0FB890,#0C6D58)":"linear-gradient(135deg,rgba(255,210,98,.14),rgba(23,18,10,.66))",
      color:primary?"#F8FFE9":"#FFE7A4",
      borderRadius:16,
      padding:"12px 16px",
      fontWeight:1000,
      cursor:"pointer",
      boxShadow:primary?"0 14px 28px rgba(15,184,144,.22), inset 0 1px 0 rgba(255,255,255,.28)":"inset 0 1px 0 rgba(255,255,255,.14)",
      letterSpacing:".01em",
      minHeight:46
    }}>{children}</button>;
  }

  function FeatureCard({icon,title,sub,to,tone="green",art,artType}){
    const tones={
      green:["#0FB890","#144B32"],gold:["#E0B84F","#5A3D10"],blue:["#35B8D0","#123E52"],pink:["#B878FF","#39215F"],orange:["#E38B32","#613512"]
    };
    const [a,b]=tones[tone]||tones.green;
    return <button className={`rc-art-card rc-art-${tone||"green"}`} data-card-title={title} onClick={()=>{SFX.tab();onNavigate?.(to);}} style={{
      minHeight:168,
      textAlign:"left",
      border:`1px solid ${a}55`,
      background:`linear-gradient(155deg,rgba(10,14,12,.92),${b}D9), radial-gradient(circle at 80% 12%,${a}44,transparent 42%)`,
      borderRadius:22,
      padding:14,
      color:"#FFF7DA",
      cursor:"pointer",
      position:"relative",
      overflow:"hidden",
      boxShadow:"0 16px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.10)"
    }}>
      <div style={{position:"absolute",right:-10,top:4,opacity:.98,transform:"rotate(-3deg)"}}><RastaCardIllustration type={artType||title||to} accent={a} size={132}/></div>
      <div style={{position:"absolute",left:0,right:0,top:0,height:46,background:`linear-gradient(90deg,${a}24,rgba(255,255,255,.06),transparent)`,borderBottom:`1px solid ${a}22`}}/>
      <div style={{position:"relative",zIndex:1,maxWidth:"64%"}}>
        <div style={{fontSize:"1.35rem",lineHeight:1,width:42,height:42,borderRadius:15,display:"grid",placeItems:"center",background:"rgba(255,255,255,.08)",border:`1px solid ${a}33`}}>{icon}</div>
        <div className="rc-card-title" style={{fontWeight:1000,fontSize:"1.05rem",marginTop:10,color:a,textTransform:"uppercase",letterSpacing:".02em"}}>{title}</div>
        <div style={{fontSize:".78rem",fontWeight:800,lineHeight:1.35,color:"rgba(255,247,218,.82)",marginTop:5,maxWidth:190}}>{sub}</div>
        <div style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:8,fontSize:".72rem",fontWeight:1000,color:"#FFE7A4",borderTop:`1px solid ${a}44`,paddingTop:8}}>Abrir <span>→</span></div>
      </div>
    </button>;
  }

  function NewsMini({item}){
    return <div style={{display:"grid",gridTemplateColumns:"54px 1fr",gap:10,alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(255,231,164,.12)"}}>
      <div style={{height:46,borderRadius:14,display:"grid",placeItems:"center",background:"linear-gradient(135deg,rgba(15,184,144,.22),rgba(224,184,79,.16))",border:"1px solid rgba(255,231,164,.18)",fontSize:"1.45rem"}}>📣</div>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:950,color:"#FFF7DA",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.titulo||item.title||"Novedad Rasta Cuts"}</div>
        <div style={{fontSize:".72rem",fontWeight:780,color:"rgba(255,247,218,.66)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.contenido||item.descripcion||"Movimiento del estudio"}</div>
      </div>
    </div>;
  }

  return(
    <div className="premium-home rc-visual-rework" style={{animation:"fadeSlide 0.4s ease",display:"grid",gap:14}}>
      <section className="rc-hero-wall rc-hero-client" style={{
        borderRadius:30,
        overflow:"hidden",
        position:"relative",
        minHeight:360,
        border:"1px solid rgba(255,210,98,.35)",
        background:"linear-gradient(90deg,rgba(3,8,7,.96) 0%,rgba(9,23,18,.88) 42%,rgba(10,11,10,.30) 100%), radial-gradient(circle at 72% 24%,rgba(17,207,155,.26),transparent 34%), radial-gradient(circle at 78% 72%,rgba(224,184,79,.22),transparent 38%), linear-gradient(135deg,#07100D,#132719 54%,#2C1B0B)",
        boxShadow:"0 24px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.10)"
      }}>
        <div style={{position:"absolute",inset:0,opacity:.22,backgroundImage:"linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.04) 1px, transparent 1px)",backgroundSize:"42px 42px"}}/>
        <div style={{position:"absolute",right:-30,top:20,width:"52%",height:"82%",borderRadius:"34px 0 0 34px",background:"linear-gradient(145deg,rgba(255,210,98,.16),rgba(15,184,144,.08)), radial-gradient(circle at 48% 38%,rgba(255,242,190,.14),transparent 26%)",border:"1px solid rgba(255,210,98,.18)",transform:"skewX(-8deg)",boxShadow:"inset 0 0 70px rgba(0,0,0,.45)"}}/>
        <div className="rc-hero-sign" style={{position:"absolute",right:46,top:54,width:240,height:170,borderRadius:28,background:"linear-gradient(180deg,#2D1C0E,#0D1510)",border:"1px solid rgba(255,210,98,.30)",boxShadow:"0 20px 45px rgba(0,0,0,.38)",display:"grid",placeItems:"center",transform:"rotate(-2deg)"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"2.8rem",filter:"drop-shadow(0 0 16px #D9B35C)"}}>💈</div>
            <div style={{fontFamily:"'Pirata One',cursive",fontSize:"2.2rem",color:"#FFE7A4",lineHeight:.9,textShadow:"0 0 18px rgba(224,184,79,.5)"}}>RASTA</div>
            <div style={{fontWeight:1000,color:"#5EF0C8",letterSpacing:".22em",fontSize:".7rem"}}>CUTS</div>
          </div>
        </div>
        <div style={{position:"absolute",right:32,bottom:30,display:"flex",gap:10,alignItems:"end"}}>
          {['✂️','🎮','🎰','🛍️'].map((x,i)=><div key={x} style={{width:54,height:54,borderRadius:18,display:"grid",placeItems:"center",background:"rgba(3,8,7,.70)",border:"1px solid rgba(255,210,98,.22)",fontSize:"1.6rem",boxShadow:"0 12px 26px rgba(0,0,0,.32)",transform:`translateY(${i%2?12:0}px)`}}>{x}</div>)}
        </div>
        <div style={{position:"relative",zIndex:2,padding:"28px clamp(18px,4vw,42px)",maxWidth:720}}>
          <Badge col="gold">Puerta abierta del estudio</Badge>
          <h1 style={{fontFamily:"'Pirata One',cursive",fontSize:"clamp(3.1rem,8vw,6.8rem)",lineHeight:.82,margin:"16px 0 8px",color:"#FFF7DA",textShadow:"0 8px 0 rgba(0,0,0,.24),0 0 24px rgba(224,184,79,.24)",letterSpacing:".02em"}}>RASTA CUTS</h1>
          <div style={{fontSize:"clamp(1.05rem,2.2vw,1.45rem)",fontWeight:1000,color:"#FFE7A4",textTransform:"uppercase",letterSpacing:".02em"}}>Cortes, retos y recompensas con rollo propio.</div>
          <p style={{maxWidth:540,color:"rgba(255,247,218,.82)",fontWeight:780,lineHeight:1.55,margin:"12px 0 18px"}}>Entra al estudio, echa unas partidas, cuida tu avatar y consigue recompensas con estilo propio.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
            <HeroButton to="juegos">🎮 Jugar ahora</HeroButton>
            <HeroButton to="misiones" variant="ghost">🎯 Ver misiones</HeroButton>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",color:"#FFF7DA",fontWeight:900}}>💎 {userRP(user).toLocaleString("es-ES")} RP</span>
            <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",color:"#FFF7DA",fontWeight:900}}>🪙 {userRC(user).toLocaleString("es-ES")} RC</span>
            <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",color:"#FFF7DA",fontWeight:900}}>⭐ Nivel {Number(user?.avatar_level||progress.level)}</span>
          </div>
        </div>
      </section>

      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 310px",gap:14}} className="premium-home-grid-main">
        <div style={{display:"grid",gap:14}}>
          <div style={{
            borderRadius:24,
            padding:16,
            border:"1px solid rgba(255,210,98,.32)",
            background:"linear-gradient(100deg,rgba(22,16,9,.96),rgba(51,35,14,.88)), radial-gradient(circle at 82% 50%,rgba(224,184,79,.22),transparent 35%)",
            color:"#FFF7DA",
            boxShadow:"0 16px 38px rgba(0,0,0,.22)"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <div><div style={{fontSize:".72rem",fontWeight:1000,color:"#E0B84F",textTransform:"uppercase",letterSpacing:".08em"}}>Reto de temporada</div><div style={{fontSize:"1.35rem",fontWeight:1000}}>Corte legendario</div><div style={{fontSize:".82rem",fontWeight:780,color:"rgba(255,247,218,.72)"}}>Completa retos, sube en el ranking y desbloquea premios del estudio.</div></div>
              <button onClick={()=>onNavigate?.("misiones")} style={{border:"1px solid rgba(255,210,98,.48)",background:"linear-gradient(135deg,#E0B84F,#A56B1E)",borderRadius:14,padding:"10px 14px",fontWeight:1000,color:"#201407",cursor:"pointer"}}>Ver reto →</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <FeatureCard icon="🎮" title="Arcade" sub="Minijuegos, récords, RC, XP y ranking." to="juegos" tone="blue" art="🕹️" artType="arcade"/>
            <FeatureCard icon="🏪" title="Tycoon" sub="Mejora tu barbería paso a paso." to="juegos" tone="gold" art="🏗️" artType="tycoon"/>
            <FeatureCard icon="🎰" title="Gacha" sub="Tiradas limitadas, RC y XP." to="juegos" tone="pink" art="🔮" artType="gacha"/>
            <FeatureCard icon="🛍️" title="Tienda juegos" sub="Vales, tiradas y recompensas." to="tienda" tone="blue" art="🎫" artType="tienda"/>
            <FeatureCard icon="🧑‍🎤" title="Avatar" sub="Tu personaje, tu rol y tus insignias." to="perfil" tone="green" art="👑" artType="perfil"/>
            <FeatureCard icon="🌐" title="Comunidad" sub="Foro, tablón, historias y comunidad." to="comunidad" tone="orange" art="👥" artType="comunidad"/>
          </div>
        </div>

        <aside style={{display:"grid",gap:12}}>
          <div style={{borderRadius:24,padding:16,background:"linear-gradient(160deg,rgba(7,16,13,.96),rgba(31,42,23,.88))",border:"1px solid rgba(255,210,98,.30)",color:"#FFF7DA",boxShadow:"0 16px 38px rgba(0,0,0,.24)"}}>
            <div style={{fontWeight:1000,color:"#E0B84F",textTransform:"uppercase",fontSize:".78rem"}}>Ronda diaria</div>
            <div style={{fontSize:"3rem",margin:"12px 0",textAlign:"center",filter:"drop-shadow(0 0 18px rgba(224,184,79,.35))"}}>🎁</div>
            <div style={{fontSize:".83rem",fontWeight:780,color:"rgba(255,247,218,.76)",lineHeight:1.4}}>Pasa por el estudio, revisa retos y suma progreso cada día.</div>
            <button onClick={()=>onNavigate?.("misiones")} style={{marginTop:14,width:"100%",border:"none",borderRadius:14,padding:"11px 12px",background:"linear-gradient(135deg,#E0B84F,#B97D22)",fontWeight:1000,color:"#201407",cursor:"pointer"}}>🎯 Ver retos</button>
          </div>
          <div style={{borderRadius:24,padding:16,background:"linear-gradient(160deg,rgba(8,12,11,.96),rgba(17,37,31,.90))",border:"1px solid rgba(95,240,200,.26)",color:"#FFF7DA"}}>
            <div style={{fontWeight:1000,color:"#5EF0C8",textTransform:"uppercase",fontSize:".78rem"}}>Tu personaje</div>
            <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}><Av av={user.avatar} config={user.avatarConfig||user.avatar_config} size={54}/><div><div style={{fontWeight:1000}}>{nivel}</div><div style={{fontSize:".75rem",fontWeight:800,color:"rgba(255,247,218,.70)"}}>{progress.remaining} XP para subir</div></div></div>
            <div style={{marginTop:12,height:9,borderRadius:999,background:"rgba(255,255,255,.12)",overflow:"hidden"}}><div style={{height:"100%",width:`${progress.pct}%`,borderRadius:999,background:"linear-gradient(90deg,#5EF0C8,#E0B84F,#B878FF)"}}/></div>
            <div style={{marginTop:10}}><AvatarBadgesStrip user={user} limit={3} dark/></div>
          </div>
        </aside>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
        <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(18,29,22,.94))",border:"1px solid rgba(255,210,98,.25)",color:"#FFF7DA"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div style={{fontWeight:1000,color:"#E0B84F"}}>📰 Novedades</div><button onClick={()=>onNavigate?.("comunidad")} style={{border:"none",background:"transparent",color:"#5EF0C8",fontWeight:1000,cursor:"pointer"}}>Ver todas</button></div>
          {(noticias||[]).slice(0,2).length?(noticias||[]).slice(0,2).map(n=><NewsMini key={n.id||n.titulo} item={n}/>):<div style={{fontSize:".82rem",fontWeight:800,color:"rgba(255,247,218,.68)",marginTop:12}}>Aún no hay nada nuevo colgado en el estudio.</div>}
        </div>
        <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(20,24,15,.94))",border:"1px solid rgba(95,240,200,.22)",color:"#FFF7DA"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div style={{fontWeight:1000,color:"#5EF0C8"}}>🎯 Retos diarios</div><button onClick={()=>onNavigate?.("misiones")} style={{border:"none",background:"transparent",color:"#E0B84F",fontWeight:1000,cursor:"pointer"}}>Ver todas</button></div>
          <div style={{display:"grid",gap:8,marginTop:12}}>{dailyPreview.map(m=><div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",padding:"9px 10px",borderRadius:14,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)"}}><div><div style={{fontWeight:930}}>{m.icon} {m.title}</div><div style={{fontSize:".70rem",fontWeight:760,color:"rgba(255,247,218,.62)"}}>{m.desc}</div></div><Badge col="gold">+{m.rp||0} RP</Badge></div>)}</div>
        </div>
        <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(28,20,13,.94))",border:"1px solid rgba(255,210,98,.24)",color:"#FFF7DA"}}>
          <div style={{fontWeight:1000,color:"#E0B84F"}}>🏆 Movimiento arcade</div>
          <div style={{marginTop:12,display:"grid",gap:8}}>
            <div style={{padding:12,borderRadius:16,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)"}}><div style={{fontWeight:1000}}>Última partida</div><div style={{fontSize:".85rem",fontWeight:820,color:"rgba(255,247,218,.70)"}}>{bestRecent?`${bestRecent.game_id||"Juego"} · ${Number(bestRecent.score)||Number(bestRecent.points)||0}`:"Juega una ronda y deja tu marca aquí."}</div></div>
            {pendingOrder&&<div style={{padding:12,borderRadius:16,background:"rgba(224,184,79,.10)",border:"1px solid rgba(224,184,79,.22)"}}><div style={{fontWeight:1000}}>📦 Canje en marcha</div><div style={{fontSize:".8rem",fontWeight:820,color:"rgba(255,247,218,.70)"}}>{pendingOrder.item_nombre||"Pedido"} · {pendingOrder.estado||"pendiente"}</div></div>}
            {availableCoupons.length>0&&<div style={{padding:12,borderRadius:16,background:"rgba(95,240,200,.08)",border:"1px solid rgba(95,240,200,.20)"}}><div style={{fontWeight:1000}}>🎟️ Vale disponible</div><div style={{fontSize:".8rem",fontWeight:820,color:"rgba(255,247,218,.70)"}}>{availableCoupons[0].codigo||availableCoupons[0].nombre}</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ACTUALIDAD MAGAZINE + COMUNIDAD
const NEWS_CATEGORIES=[
  {id:"todo",label:"Lo destacado",short:"Selección",icon:"✨",desc:"lo que merece un vistazo"},
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
    const awarded=await awardWebPoints({user,setUser,showToast,showPoints,points,reason:description});
    return awarded>0;
  }catch(e){console.warn("No se pudieron dar RP de actualidad",e);return false;}
}
function NewsCard({item,compact=false,featured=false,onOpen,stats=null}){
  const openNews=()=>{SFX.tab();onOpen?.(item);};
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
  const openDetail=(e)=>{e?.stopPropagation?.();SFX.tab();onOpen?.(item);};
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
    if(!item?.id||!user?.id)return;
    setLoading(true);
    try{
      if(liked){
        await supabase.from("news_likes").delete().eq("news_id",String(item.id)).eq("usuario_id",String(user.id));
        setLiked(false);
        setLikes(n=>Math.max(0,n-1));
        onChanged?.(item.id,"unlike");
        SFX.success();
      }else{
        const {error}=await supabase.from("news_likes").insert({news_id:String(item.id),news_title:item.title,news_url:item.url,news_category:item.category,usuario_id:String(user.id),usuario_nombre:user.nombre});
        if(error){
          // Si ya existía por carrera o dispositivo, lo tratamos como estado activo.
          setLiked(true);
          SFX.success();
        }else{
          setLiked(true);
          setLikes(n=>n+1);
          onChanged?.(item.id,"like");
          await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:`news_like:${item.id}`,points:1,description:"Primer like en esta noticia"});
        }
      }
    }finally{setLoading(false);}
  }
  async function sendComment(){
    const clean=text.trim();
    if(!clean){showToast?.("Escribe un comentario");return;}
    setLoading(true);
    try{
      const hadComment=comments.some(c=>String(c.usuario_id)===String(user.id));
      const row={news_id:String(item.id),news_title:item.title,news_url:item.url,news_category:item.category,usuario_id:String(user.id),usuario_nombre:user.nombre,usuario_avatar:user.avatar||0,usuario_avatar_config:safeAvatarJson(user.avatarConfig||user.avatar_config),usuario_puntos:Number(user.puntos||0),usuario_rc:Number(user.rc||0),usuario_xp:Number(user.xp||0),usuario_avatar_level:Number(user.avatar_level||avatarLevelFromXP(userXP(user))),contenido:clean};
      const {data,error}=await supabase.from("news_comments").insert(row).select("*").single();
      if(error){showToast?.("No se pudo comentar. Revisa que hayas ejecutado el SQL de actualidad.");setLoading(false);return;}
      setComments(c=>[...c,data]);setText("");onChanged?.(item.id,"comment");SFX.success();showToast?.("Comentario publicado");
      if(!hadComment){
        await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:`news_comment:${item.id}`,points:3,description:"Primer comentario en esta noticia"});
        const {data:mine}=await supabase.from("news_comments").select("news_id").eq("usuario_id",String(user.id));
        const distinct=new Set((mine||[]).map(x=>String(x.news_id))).size;
        if(distinct>=3) await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:"news_comment_milestone_3",points:5,description:"Has comentado 3 noticias distintas"});
        if(distinct>=10) await grantNewsPoints({user,setUser,showToast,showPoints,eventKey:"news_comment_milestone_10",points:8,description:"Has comentado 10 noticias distintas"});
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
          <Btn small col={liked?"gold":"dark"} disabled={loading} onClick={like}>{liked?"💛 Quitar like":"🤍 Me gusta"}</Btn>
        </div>
        <div style={{display:"flex",gap:10,marginTop:10,fontSize:".75rem",fontWeight:900,color:T.g700}}><span>👍 {likes}</span><span>💬 {comments.length}</span><span>{formatNewsDate(item.date)}</span></div>
      </div>
      <Card style={{marginBottom:12,background:T.panel}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:7}}>Unirse al hilo</div>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Comenta algo útil: recomendación, experiencia, sitio parecido, opinión o dato que ayude a otros." rows={3} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"11px 12px",background:T.g50,resize:"none",outline:"none",fontSize:".9rem",fontWeight:750,color:T.text}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:9}}><div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>+5 RP por tu primer comentario en esta noticia. Bonos al comentar 3 y 10 noticias distintas.</div><Btn small onClick={sendComment} disabled={loading}>Comentar</Btn></div>
      </Card>
      <div style={{fontWeight:950,color:T.g800,margin:"4px 0 10px"}}>Comentarios</div>
      {comments.length===0?<EmptyState icon="💬" title="Sin comentarios todavía" sub="Sé el primero en abrir el hilo."/>:comments.map(c=><Card key={c.id} style={{marginBottom:9,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)"}}>
        <div style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:7}}><PublicAvatar profile={{...c,nombre:c.usuario_nombre,avatar:c.usuario_avatar,avatar_config:c.usuario_avatar_config,perfil_publico:c.perfil_publico,modo_incognito:c.modo_incognito,puntos:c.usuario_puntos,rc:c.usuario_rc,xp:c.usuario_xp,avatar_level:c.usuario_avatar_level}} size={32}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:950,color:T.g800,fontSize:".86rem"}}>{publicName({nombre:c.usuario_nombre,perfil_publico:c.perfil_publico,modo_incognito:c.modo_incognito})}</div><div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>{formatNewsDate(c.created_at)}</div><AvatarMiniIdentity profile={{...c,nombre:c.usuario_nombre,avatar:c.usuario_avatar,avatar_config:c.usuario_avatar_config,perfil_publico:c.perfil_publico,modo_incognito:c.modo_incognito,puntos:c.usuario_puntos,rc:c.usuario_rc,xp:c.usuario_xp,avatar_level:c.usuario_avatar_level}} limit={2}/></div></div>
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
const CITA_PACKS=[
  {id:"pack_corte_barba",icon:"💈",label:"Corte + barba",desc:"Arreglo rápido completo",servicios:["corte","barba"]},
  {id:"pack_degradado_barba",icon:"✂️",label:"Degradado + barba",desc:"Look limpio y perfilado",servicios:["degradado","barba"]},
  {id:"pack_rastas_mantenimiento",icon:"🪮",label:"Mantenimiento rastas",desc:"Revisión de raíces y forma",servicios:["rastas_mantenimiento","rastas_arreglo"]},
  {id:"pack_color_tratamiento",icon:"🎨",label:"Color + hidratación",desc:"Coloración con cuidado extra",servicios:["color","tratamiento"]},
  {id:"pack_evento",icon:"👑",label:"Evento / peinado",desc:"Lavado, peinado y acabado",servicios:["lavado","recogido"]}
];
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
  const [period,setPeriod]=useState("todas");
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
  function applyBookingPack(pack){
    if(!pack?.servicios?.length)return;
    SFX.tab();
    setForm(f=>({...f,servicios:[...pack.servicios]}));
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
    if(isAdmin){onNavigate?.("gestion");showToast?.("Abre Gestión &gt; Mensajes para responder al cliente");}
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
  const citasBase=view==="todas"?citas:citas.filter(c=>statusOf(c)===view);
  const citasVisibles=citasBase.filter(c=>periodMatch(c));
  const citasProximas=citas
    .filter(c=>!["cancelada","completada"].includes(statusOf(c)))
    .filter(c=>dateDiffFromToday(c.fecha)>=0)
    .sort((a,b)=>String(`${a.fecha||""} ${a.hora||""}`).localeCompare(String(`${b.fecha||""} ${b.hora||""}`)))
    .slice(0,6);
  function dayLabel(fecha){
    const diff=dateDiffFromToday(fecha);
    if(diff===0)return "Hoy";
    if(diff===1)return "Mañana";
    if(diff>=2&&diff<=7)return `En ${diff} días`;
    try{return new Date(String(fecha)+"T00:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"});}
    catch{return fecha||"Sin fecha";}
  }
  const citasActivas=citas.filter(c=>!["cancelada","completada"].includes(statusOf(c))&&dateDiffFromToday(c.fecha)>=0);
  const citasHoy=citasActivas.filter(c=>dateDiffFromToday(c.fecha)===0);
  const citasSemana=citasActivas.filter(c=>dateDiffFromToday(c.fecha)>=0&&dateDiffFromToday(c.fecha)<=7);
  const ingresoSemana=citasSemana.reduce((sum,c)=>sum+(Number(c.servicio_precio)||citaTotal(citaServices(c))),0);
  const minutosSemana=citasSemana.reduce((sum,c)=>sum+citaDuration(citaServices(c)),0);
  const pendientesCobro=citas.filter(c=>["confirmada","completada"].includes(statusOf(c))&&(Number(c.servicio_precio)||citaTotal(citaServices(c)))>0&&!pagoDe(c)).length;
  const kpiCards=isAdmin?[
    {icon:"☀️",label:"Hoy",value:citasHoy.length,sub:"citas activas"},
    {icon:"🗓️",label:"7 días",value:citasSemana.length,sub:"próximas citas"},
    {icon:"💶",label:"Previsto",value:`${ingresoSemana}€`,sub:"ingreso orientativo"},
    {icon:"⏱️",label:"Tiempo",value:formatDuration(minutosSemana),sub:"ocupación aprox."}
  ]:[
    {icon:"📅",label:"Próximas",value:citasActivas.length,sub:"reservas activas"},
    {icon:"🟡",label:"Pendientes",value:counts.pendiente||0,sub:"por confirmar"},
    {icon:"✅",label:"Confirmadas",value:counts.confirmada||0,sub:"listas"},
    {icon:"🔁",label:"Propuestas",value:counts.propuesta||0,sub:"por responder"}
  ];
  const eColor={pendiente:"gold",propuesta:"blue",confirmada:"green",cancelada:"red",completada:"blue"};
  const eLabel={pendiente:"pendiente",propuesta:"propuesta",confirmada:"confirmada",cancelada:"cancelada",completada:"realizada"};

  function todayIso(offset=0){
    const d=new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+offset);
    return d.toISOString().slice(0,10);
  }
  function dateDiffFromToday(fecha){
    if(!fecha)return 9999;
    const a=new Date(todayIso(0)+"T00:00:00");
    const b=new Date(String(fecha)+"T00:00:00");
    if(Number.isNaN(b.getTime()))return 9999;
    return Math.round((b-a)/86400000);
  }
  function periodMatch(cita,p=period){
    const diff=dateDiffFromToday(cita.fecha);
    if(p==="hoy")return diff===0;
    if(p==="manana")return diff===1;
    if(p==="semana")return diff>=0&&diff<=7;
    return true;
  }
  const periodTabs=[
    {id:"todas",icon:"📚",label:"Todas"},
    {id:"hoy",icon:"☀️",label:"Hoy"},
    {id:"manana",icon:"🌙",label:"Mañana"},
    {id:"semana",icon:"🗓️",label:"7 días"}
  ];
  const periodCounts=periodTabs.reduce((acc,p)=>({...acc,[p.id]:citas.filter(c=>periodMatch(c,p.id)).length}),{});

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
        <div style={{marginBottom:10}}>
          <div style={{fontSize:".72rem",fontWeight:950,color:T.g700,textTransform:"uppercase",letterSpacing:".04em",marginBottom:6}}>Agenda rápida</div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
            {periodTabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setPeriod(t.id);}} style={{flex:"0 0 auto",border:"none",borderRadius:999,padding:"8px 12px",background:period===t.id?T.gradGold:"rgba(255,244,214,.62)",color:period===t.id?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:period===t.id?"0 8px 18px rgba(18,8,4,.16)":"none"}}>{t.icon} {t.label} <span style={{opacity:.75}}>({periodCounts[t.id]||0})</span></button>)}
          </div>
        </div>

        <div style={{fontSize:".72rem",fontWeight:950,color:T.g700,textTransform:"uppercase",letterSpacing:".04em",marginBottom:6}}>Estado</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {statusTabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setView(t.id);}} style={{flex:"0 0 auto",border:"none",borderRadius:999,padding:"8px 12px",background:view===t.id?T.gradGold:"rgba(255,244,214,.62)",color:view===t.id?T.g900:T.g700,fontWeight:950,cursor:"pointer",boxShadow:view===t.id?"0 8px 18px rgba(18,8,4,.16)":"none"}}>{t.icon} {t.label} <span style={{opacity:.75}}>({counts[t.id]||0})</span></button>)}
        </div>
      </Card>

      {!loading&&<Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`1.5px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontWeight:1000,color:T.g800}}>📊 Resumen de agenda</div>
            <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35}}>
              {isAdmin?"Vista rápida de ocupación e ingresos orientativos.":"Estado rápido de tus reservas."}
            </div>
          </div>
          {isAdmin&&pendientesCobro>0&&<Badge col="red">{pendientesCobro} sin cobrar</Badge>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))",gap:8}}>
          {kpiCards.map(k=><div key={k.label} style={{border:`1px solid ${T.g300}`,background:"rgba(255,255,255,.34)",borderRadius:15,padding:"10px 9px"}}>
            <div style={{fontSize:"1.25rem",lineHeight:1}}>{k.icon}</div>
            <div style={{fontSize:"1.05rem",fontWeight:1000,color:T.g800,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k.value}</div>
            <div style={{fontSize:".68rem",fontWeight:950,color:T.g700,marginTop:2}}>{k.label}</div>
            <div style={{fontSize:".64rem",fontWeight:800,color:T.textSub,lineHeight:1.2,marginTop:1}}>{k.sub}</div>
          </div>)}
        </div>
      </Card>}

      {!loading&&citasProximas.length>0&&<Card style={{marginBottom:12,background:"linear-gradient(145deg,#120806,#183226 58%,#6E3518)",border:"2px solid rgba(242,200,91,.38)",color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-16,top:-24,fontSize:"6rem",opacity:.10}}>📅</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:1000,color:T.g50,fontSize:"1.02rem"}}>🗓️ Agenda próxima</div>
              <div style={{fontSize:".76rem",fontWeight:820,color:"rgba(255,247,218,.70)",lineHeight:1.35}}>Las próximas reservas activas de un vistazo.</div>
            </div>
            <Badge col="gold">{citasProximas.length}</Badge>
          </div>
          <div style={{display:"grid",gap:8}}>
            {citasProximas.map(c=>{
              const st=statusOf(c);
              const list=citaServices(c);
              const precio=Number(c.servicio_precio)||citaTotal(list);
              return <button key={`soon-${c.id}`} onClick={()=>{setView(st);setPeriod(dateDiffFromToday(c.fecha)===0?"hoy":dateDiffFromToday(c.fecha)===1?"manana":"semana");}} style={{textAlign:"left",display:"grid",gridTemplateColumns:"76px 1fr auto",gap:9,alignItems:"center",border:"1px solid rgba(255,244,214,.16)",background:"rgba(255,255,255,.07)",borderRadius:15,padding:"9px 10px",color:T.white,cursor:"pointer"}}>
                <div style={{borderRadius:12,background:"rgba(242,200,91,.12)",border:"1px solid rgba(242,200,91,.20)",padding:"7px 6px",textAlign:"center"}}>
                  <div style={{fontSize:".68rem",fontWeight:950,color:T.gold,lineHeight:1.05}}>{dayLabel(c.fecha)}</div>
                  <div style={{fontSize:".86rem",fontWeight:1000,color:T.g50,marginTop:2}}>{c.hora||"--:--"}</div>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:1000,color:T.g50,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.cliente_nombre||"Cliente"}</div>
                  <div style={{fontSize:".72rem",fontWeight:820,color:"rgba(255,247,218,.70)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {list.length?list.map(s=>s.label).join(" + "):(c.servicio_label||c.servicio||"Servicio")}
                  </div>
                </div>
                <div style={{display:"grid",gap:4,justifyItems:"end"}}>
                  <Badge col={eColor[st]||"gold"}>{eLabel[st]||st}</Badge>
                  {!!precio&&<span style={{fontSize:".72rem",fontWeight:950,color:T.gold}}>{precio}€</span>}
                </div>
              </button>;
            })}
          </div>
        </div>
      </Card>}

      {loading?<Spinner/>:citasVisibles.length===0?<EmptyState icon="📅" title="Sin citas" sub={period==="todas"?(view==="todas"?"Todavía no hay citas en esta vista":"No hay citas con este estado"):"No hay citas en este periodo con el estado elegido"}/>
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
          <div style={{fontSize:"0.82rem",fontWeight:950,color:T.g800,marginBottom:7}}>Packs rápidos</div>
          <div style={{fontSize:"0.76rem",fontWeight:750,color:T.textSub,marginBottom:10}}>Elige un pack y luego ajusta servicios si hace falta.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
            {CITA_PACKS.map(pack=>{
              const packServices=selectedServices(pack.servicios);
              const total=citaTotal(packServices);
              const duration=citaDuration(packServices);
              const active=pack.servicios.every(id=>form.servicios.includes(id))&&form.servicios.length===pack.servicios.length;
              return <button key={pack.id} onClick={()=>applyBookingPack(pack)} style={{textAlign:"left",border:`2px solid ${active?T.gold:T.g300}`,background:active?"linear-gradient(180deg,#FFF4D6,#E6C27A)":"rgba(255,244,214,.72)",borderRadius:16,padding:10,cursor:"pointer",boxShadow:active?"0 10px 18px rgba(18,8,4,.18)":"0 5px 12px rgba(20,8,4,.08)"}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:"1.35rem"}}>{pack.icon}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:950,color:T.g800,fontSize:".82rem",lineHeight:1.12}}>{pack.label}</div>
                    <div style={{fontSize:".68rem",fontWeight:800,color:T.textSub,lineHeight:1.2,marginTop:2}}>{pack.desc}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  <Badge col="gold">{total}€</Badge>
                  <Badge col="blue">⏱️ {formatDuration(duration)}</Badge>
                </div>
              </button>;
            })}
          </div>
        </div>

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
            <div><div style={{fontWeight:950,color:T.g800}}>Resumen de reserva</div><div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>{currentServices.length} tratamiento{currentServices.length===1?"":"s"} · precio orientativo</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:950,fontSize:"1.15rem",color:T.g800}}>{currentTotal}€</div><div style={{fontSize:".76rem",fontWeight:900,color:T.textSub}}>⏱️ {formatDuration(currentDuration)}</div></div>
          </div>
          {currentServices.length>0&&<div style={{marginTop:8,fontSize:".74rem",fontWeight:850,color:T.g800,lineHeight:1.32}}>
            {currentServices.map(s=>`${s.icon||"✂️"} ${s.label}`).join(" · ")}
          </div>}
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
              <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>RP</div>
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
                  Este cliente ha generado aproximadamente <b>{totalPuntosGanados}</b> RP por cobros registrados. Los RP son fidelidad, no dinero.
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
  if(!isInternalUser(user)) return <EmptyState icon="🔒" title="Acceso interno" sub="Sólo admin y staff pueden acceder a facturación."/>;
  const [cobros,setCobros]=useState([]);
  const [citasRealizadas,setCitasRealizadas]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [loading,setLoading]=useState(true);
  const [carrito,setCarrito]=useState([]);
  const [metodo,setMetodo]=useState("efectivo");
  const [clienteNombre,setClienteNombre]=useState("");
  const [citaCobro,setCitaCobro]=useState(null);
  const [cobroForm,setCobroForm]=useState({metodo_pago:"efectivo",importe:"",puntos_generados:"10",descripcion:""});
  const [puntosCitaDefault,setPuntosCitaDefault]=useState(5);

  const today=()=>new Date().toISOString().split("T")[0];
  const monthStart=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  };
  const money=n=>`${(Number(n)||0).toFixed(2)}€`;
  const metodoLabel=m=>({efectivo:"Efectivo",tarjeta:"Tarjeta",bizum:"Bizum",mixto:"Mixto"})[m]||m||"Sin método";

  async function sumarPuntosFidelidad(usuarioId,puntos=0){
    const add=Math.max(0,parseInt(puntos||0,10)||0);
    if(!usuarioId||!add)return 0;
    return await awardWebPointsByUserId({usuarioId,points:add,reason:"Cita cobrada"});
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
    const puntosDefault=Math.max(0,parseInt(puntosCfg.puntos_por_cita_cobrada??5,10)||5);
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
      SFX.collect();
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
      const puntosDados=await sumarPuntosFidelidad(citaCobro.usuario_id,puntosGenerados);
      SFX.collect();
      showToast?.(`Cita cobrada: ${money(importe)}${puntosGenerados?` · +${puntosDados}/${puntosGenerados} RP de fidelidad`:""}${puntosGenerados&&puntosDados<puntosGenerados?" · límite diario aplicado":""}`);
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
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Registra ventas manuales y cobra citas realizadas. Los RP son fidelidad, no dinero ni método de pago.</div>
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
            <Input label="RP de fidelidad a sumar" value={cobroForm.puntos_generados} onChange={v=>setCobroForm(f=>({...f,puntos_generados:v}))} type="number"/>
            <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`1.5px solid ${T.gold}`,padding:12}}>
              <div style={{fontWeight:950,color:T.g800}}>⭐ Puntos de fidelidad</div>
              <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>
                Los RP no equivalen a euros y no se usan como método de pago. Sólo se suman como fidelidad y luego se canjean por cupones, avatar, juegos o premios de tienda.
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
          motivo_baneo:banForm.motivo||"Bloqueado desde Gestión &gt; Usuarios",
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
  const [posts,setPosts]=useState([]);const [newPost,setNewPost]=useState("");const [loading,setLoading]=useState(true);const [profiles,setProfiles]=useState([]);const [selectedProfile,setSelectedProfile]=useState(null);const [likedPosts,setLikedPosts]=useState(()=>new Set(readLocalFeedLikes(user)));
  const canPost=normalizeRole(user.rol||user.role)!==ROLES.CLIENT;
  useEffect(()=>{load();},[]);
  async function load(){
    setLoading(true);
    const [raw,users]=await Promise.all([
      dbGet("publicaciones","?tipo=neq.foro&order=created_at.desc&limit=30&select=*"),
      dbGet("usuarios","?select=*")
    ]);
    const cleanPosts=Array.isArray(raw)?raw:[];
    setPosts(cleanPosts);
    setProfiles(await enrichProfilesWithAvatarConfigs(Array.isArray(users)?users:[]));
    let likedIds=readLocalFeedLikes(user);
    try{
      const rows=await dbGet("publicacion_likes",`?usuario_id=eq.${user.id}&select=publicacion_id`);
      if(Array.isArray(rows)&&rows.length){
        likedIds=[...new Set([...likedIds,...rows.map(r=>String(r.publicacion_id))])];
        saveLocalFeedLikes(user,likedIds);
      }
    }catch{}
    setLikedPosts(new Set(likedIds));
    setLoading(false);
  }
  function authorOf(post){return profiles.find(u=>String(u.id)===String(post.autor_id))||user;}
  async function publish(){
    if(!canPost){showToast("Solo admin y staff pueden publicar en el tablón");SFX.error();return;}
    if(!newPost.trim())return;
    await dbPost("publicaciones",{contenido:newPost.trim(),autor_id:user.id,tipo:"anuncio",likes_count:0});
    setNewPost("");SFX.success();showToast("Anuncio publicado");load();
  }
  async function likePost(post){
    if(!post?.id||!user?.id)return;
    const postId=String(post.id);
    const alreadyLiked=likedPosts.has(postId)||hasLocalFeedLike(user,postId);
    const delta=alreadyLiked?-1:1;
    const nextLikes=new Set(likedPosts);
    if(alreadyLiked){
      nextLikes.delete(postId);
      removeLocalFeedLike(user,postId);
    }else{
      nextLikes.add(postId);
      addLocalFeedLike(user,postId);
    }
    setLikedPosts(nextLikes);
    const nextCount=Math.max(0,(Number(post.likes_count)||0)+delta);
    setPosts(prev=>prev.map(p=>String(p.id)===postId?{...p,likes_count:Math.max(0,(Number(p.likes_count)||0)+delta)}:p));
    try{
      if(alreadyLiked){
        await dbDelete("publicacion_likes",`?publicacion_id=eq.${encodeURIComponent(postId)}&usuario_id=eq.${encodeURIComponent(String(user.id))}`);
      }else{
        await dbPost("publicacion_likes",{
          publicacion_id:postId,
          usuario_id:String(user.id),
          usuario_nombre:user.nombre||user.email||"Usuario",
          created_at:new Date().toISOString()
        });
      }
    }catch(e){
      console.warn("publicacion_likes no disponible; usando toggle local",e);
    }
    await dbPatch("publicaciones",`?id=eq.${post.id}`,{likes_count:nextCount});
    SFX.success();
  }
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="📌" title="Tablón del estudio" sub="Novedades del local. Para charlar, mejor el foro. Para historias, actualidad."/>
      <Card style={{marginBottom:16,background:'linear-gradient(180deg,#E9D9B7 0%,#DEC79A 100%)',border:`2px solid ${T.g300}`,boxShadow:'0 10px 24px rgba(20,8,4,.16)'}}>
        <div style={{fontWeight:950,fontSize:'.96rem',color:T.g800,marginBottom:8}}>📣 Nuevo aviso del estudio</div>
        {canPost? <>
          <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Escribe una promoción, aviso, norma, actualización o evento..." rows={4} style={{width:"100%",border:`2px solid ${T.g200}`,borderRadius:16,padding:"12px 13px",fontSize:"0.92rem",fontWeight:700,color:T.text,background:T.g150,resize:"none",outline:"none",boxShadow:'inset 0 2px 8px rgba(20,8,4,.06)'}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:8}}>
            <span style={{fontSize:"0.8rem",color:T.g700,fontWeight:900}}>Sólo admin/staff publican. Los usuarios reaccionan con likes.</span>
            <Btn small col="dark" onClick={publish} style={{fontWeight:900,letterSpacing:'.4px'}}>📌 Publicar</Btn>
          </div>
        </> : <div style={{fontSize:".86rem",fontWeight:800,color:T.textSub,lineHeight:1.45}}>Este tablón es para avisos rápidos. Puedes leer y dar like. Para debatir o abrir temas, entra al foro.</div>}
      </Card>
      {loading?<Spinner/>:posts.length===0?<EmptyState icon="📌" title="Sin anuncios" sub="Cuando el equipo publique novedades aparecerán aquí."/>:posts.map(p=>{
        const a=authorOf(p);
        return <Card key={p.id} style={{marginBottom:12,background:'linear-gradient(180deg,#EFE0BE 0%,#E4CFAB 100%)',border:`1.5px solid ${T.g200}`,boxShadow:'0 8px 18px rgba(20,8,4,.12)'}}>
          {p.imagen_url&&<img src={p.imagen_url} alt="" style={{width:"100%",borderRadius:14,marginBottom:10,objectFit:"cover",maxHeight:200}}/>}
          <div onClick={()=>setSelectedProfile(a)} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8,cursor:'pointer'}}><PublicAvatar profile={a} size={34}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:900,color:T.g800,fontSize:'.86rem'}}>{publicName(a)}</div><div style={{fontSize:'.68rem',fontWeight:800,color:T.textSub,textTransform:'uppercase'}}>{publicRoleLabel(a)}</div><AvatarMiniIdentity profile={a} currentUser={user} limit={2}/></div></div>
          <div style={{fontSize:"0.93rem",fontWeight:700,color:T.text,lineHeight:1.55,whiteSpace:'pre-wrap'}}>{p.contenido}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <span style={{fontSize:"0.76rem",color:T.textSub,fontWeight:800}}>{p.created_at?new Date(p.created_at).toLocaleDateString("es-ES"):""}</span>
            <button onClick={()=>likePost(p)} title={likedPosts.has(String(p.id))?"Quitar like":"Dar like"} style={{background:likedPosts.has(String(p.id))?T.gradGold:T.g150,border:`1.5px solid ${likedPosts.has(String(p.id))?T.gold:T.g200}`,cursor:"pointer",fontSize:"0.8rem",color:likedPosts.has(String(p.id))?T.g900:T.g700,fontWeight:900,padding:'7px 12px',borderRadius:999,opacity:1}}>{likedPosts.has(String(p.id))?"💛":"🤍"} {p.likes_count||0}</button>
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
  function topicAuthor(t){return {id:t.usuario_id,nombre:t.autor_nombre,avatar:t.autor_avatar,avatar_config:t.autor_avatar_config,perfil_publico:true,modo_incognito:false,role:"client",puntos:t.autor_puntos,rc:t.autor_rc,xp:t.autor_xp,avatar_level:t.autor_avatar_level};}
  function replyAuthor(r){return {id:r.usuario_id,nombre:r.autor_nombre,avatar:r.autor_avatar,avatar_config:r.autor_avatar_config,perfil_publico:true,modo_incognito:false,role:"client",puntos:r.autor_puntos,rc:r.autor_rc,xp:r.autor_xp,avatar_level:r.autor_avatar_level};}

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
      autor_puntos:Number(user.puntos||0),
      autor_rc:Number(user.rc||0),
      autor_xp:Number(user.xp||0),
      autor_avatar_level:Number(user.avatar_level||avatarLevelFromXP(userXP(user))),
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
      autor_puntos:Number(user.puntos||0),
      autor_rc:Number(user.rc||0),
      autor_xp:Number(user.xp||0),
      autor_avatar_level:Number(user.avatar_level||avatarLevelFromXP(userXP(user))),
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
    if(!target?.id||!user?.id)return;
    const id=target.id;
    const already=voted(tipo,id);
    const table=tipo==="tema"?"foro_temas":"foro_respuestas";
    const nextLikes=Math.max(0,(Number(target.likes)||0)+(already?-1:1));
    if(already){
      try{await dbDelete("foro_votos",`?usuario_id=eq.${encodeURIComponent(String(user.id))}&target_tipo=eq.${encodeURIComponent(tipo)}&target_id=eq.${encodeURIComponent(String(id))}`);}catch(e){console.warn("No se pudo borrar voto foro",e);}
      setVotes(prev=>prev.filter(v=>!(String(v.target_tipo)===tipo&&String(v.target_id)===String(id))));
    }else{
      const ok=await dbPost("foro_votos",{usuario_id:String(user.id),target_tipo:tipo,target_id:id});
      if(!ok){showToast("No se pudo votar");SFX.error();return;}
      setVotes(prev=>[...prev,{usuario_id:String(user.id),target_tipo:tipo,target_id:id}]);
    }
    await dbPatch(table,`?id=eq.${id}`,{likes:nextLikes});
    if(tipo==="tema"){
      setTopics(prev=>prev.map(t=>String(t.id)===String(id)?{...t,likes:nextLikes}:t));
      setActive(a=>a?.id===id?{...a,likes:nextLikes}:a);
    }else{
      setReplies(prev=>prev.map(r=>String(r.id)===String(id)?{...r,likes:nextLikes}:r));
    }
    SFX.success();
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
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Abre temas, responde dudas, vota ideas y habla sin llenar el tablón de ruido.</div>
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
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:950,color:T.g800}}>{publicName(topicAuthor(shown))}</div>
            <div style={{fontSize:".7rem",fontWeight:800,color:T.textSub}}>{shown.created_at?new Date(shown.created_at).toLocaleString("es-ES"):""}</div>
            <AvatarMiniIdentity profile={topicAuthor(shown)} currentUser={user} limit={3}/>
          </div>
        </div>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.42rem",color:T.g800,lineHeight:1.05}}>{shown.titulo||"Tema del foro"}</div>
        <div style={{fontSize:".9rem",fontWeight:750,lineHeight:1.5,whiteSpace:'pre-wrap',marginTop:8,color:T.text}}>{shown.contenido}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12,alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Badge col="blue">💬 {topicReplies(shown.id).length} respuestas</Badge>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small col={isFollowing(shown)?"green":"ghost"} onClick={()=>toggleFollow(shown)}>{isFollowing(shown)?"✓ Siguiendo":"Seguir"}</Btn>
            <Btn small col={voted("tema",shown.id)?"gold":"ghost"} onClick={()=>voteTarget(shown,"tema")}>{voted("tema",shown.id)?"💛":"🤍"} {shown.likes||0}</Btn>
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
            <div style={{flex:1,minWidth:0}}>
              <b style={{color:T.g800}}>{publicName(a)}</b>
              <div style={{fontSize:".66rem",fontWeight:800,color:T.textSub}}>{r.created_at?new Date(r.created_at).toLocaleString("es-ES"):""}</div>
              <AvatarMiniIdentity profile={a} currentUser={user} limit={2}/>
            </div>
          </div>
          <div style={{fontSize:".86rem",fontWeight:750,lineHeight:1.45,whiteSpace:'pre-wrap'}}>{r.contenido}</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8,flexWrap:"wrap"}}>
            {!canModerate&&<button onClick={()=>openReport("respuesta",r)} style={{background:"rgba(255,244,214,.72)",border:`1.5px solid ${T.g200}`,cursor:"pointer",fontSize:"0.76rem",color:T.g700,fontWeight:950,padding:'6px 10px',borderRadius:999}}>🚩 Reportar</button>}
            <button onClick={()=>voteTarget(r,"respuesta")} title={voted("respuesta",r.id)?"Quitar voto":"Votar"} style={{background:voted("respuesta",r.id)?T.gradGold:T.g150,border:`1.5px solid ${voted("respuesta",r.id)?T.gold:T.g200}`,cursor:"pointer",fontSize:"0.76rem",color:voted("respuesta",r.id)?T.g900:T.g700,fontWeight:950,padding:'6px 10px',borderRadius:999,opacity:1}}>{voted("respuesta",r.id)?"💛":"🤍"} {r.likes||0}</button>
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
            <div style={{fontSize:".75rem",fontWeight:800,color:T.textSub,marginTop:3}}>{publicName(a)} · 👍 {t.likes||0} · 💬 {respuestas}</div><AvatarMiniIdentity profile={a} currentUser={user} limit={2}/>
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

function shopCategoryLabel(cat){
  return {todo:"Todo",juegos:"Tienda juegos",productos:"Productos €",estilo:"Camino avatar",cupones:"Cupones desbloqueables",avatar:"Avatar",marcos:"Marcos",fondos:"Fondos",auras:"Auras",complementos:"Complementos",perfil:"Perfil",premios:"Premios ocultos"}[cat]||cat||"Tienda juegos";
}
function itemShopCategory(p){
  const slot=String(p.slot||"");
  const tipo=String(p.tipo||"").toLowerCase();
  const cat=String(p.categoria||"premios").toLowerCase();
  if(cat==="productos"||cat==="producto"||tipo.includes("producto_real")||tipo.includes("euros")||tipo.includes("euro")||p.requiere_pago_real)return "productos";
  if(cat==="juegos"||tipo.includes("gacha")||tipo.includes("bonus")||tipo.includes("tirada")||tipo.includes("pull"))return "juegos";
  if(slot==="frame")return "marcos";
  if(slot==="bg")return "fondos";
  if(slot==="aura")return "auras";
  if(slot==="accessory")return "complementos";
  if(slot==="profileTitle"||slot==="nameColor"||slot==="profileCard"||slot==="sticker"||tipo.includes("perfil"))return "perfil";
  if(cat==="avatar")return "estilo";
  return cat||"premios";
}
function itemPointPrice(p){return Math.max(0,Number(p?.puntos_precio??p?.precio_puntos??p?.puntos??0)||0);}
function itemEuroPrice(p){return Math.max(0,Number(p?.precio_euros??p?.precioEuros??0)||0);}
function isRealMoneyProduct(p){
  const tipo=String(p?.tipo||"").toLowerCase();
  const cat=String(p?.categoria||"").toLowerCase();
  return cat==="productos"||tipo==="producto_real"||tipo.includes("producto_real")||p?.requiere_pago_real===true||String(p?.moneda||"").toLowerCase()==="eur"||itemEuroPrice(p)>0;
}
function isGameVoucherItem(p){
  const tipo=String(p?.tipo||"").toLowerCase();
  const cat=String(p?.categoria||"").toLowerCase();
  const slot=String(p?.slot||"").toLowerCase();
  return cat==="juegos"||tipo.includes("gacha")||tipo.includes("tirada")||tipo.includes("pull")||slot==="gacha_pulls";
}
function gameVoucherAmount(p){
  const fromCol=Number(p?.juego_bonus_cantidad);
  if(Number.isFinite(fromCol)&&fromCol>0)return Math.floor(fromCol);
  const fromVal=Number(p?.valor);
  if(Number.isFinite(fromVal)&&fromVal>0)return Math.floor(fromVal);
  return 10;
}
function gameVoucherKind(p){
  const tipo=String(p?.juego_bonus_tipo||p?.slot||p?.tipo||"").toLowerCase();
  if(tipo.includes("gacha"))return "gacha_pulls";
  return "gacha_pulls";
}
function applyGameVoucher(user,item,qty=1){
  const amount=gameVoucherAmount(item)*Math.max(1,Number(qty)||1);
  const kind=gameVoucherKind(item);
  if(kind==="gacha_pulls"){
    const next=addGachaExtraPulls(user?.id,amount);
    try{window.dispatchEvent(new CustomEvent("rasta-gacha-pulls-updated"));}catch{}
    return {ok:true,kind,amount,total:next,label:`${amount} tiradas de Gacha añadidas`};
  }
  return {ok:false,kind,amount,total:0,label:"Vale de juego no reconocido"};
}
function rarityPriceRange(r){
  return {comun:"120–300 RP",raro:"350–900 RP",epico:"1.000–1.800 RP",legendario:"2.000–3.600 RP"}[r]||"Especial";
}
function shopItemPreview(p,user){
  const cfg=normalizeAvatarConfig(user?.avatarConfig||user?.avatar_config,user?.avatar||0);
  if(isAvatarPersonalizationItem(p)&&p.slot&&["accessory","frame","aura","bg"].includes(p.slot)){
    return <Av av={user?.avatar||0} config={{...cfg,...cosmeticPatch(p)}} size={76}/>;
  }
  const icon=p.icono||({perfil_titulo:"🏷️",perfil_color:"🎨",perfil_card:"🪪",perfil_sticker:"🏴‍☠️"}[p.tipo]||"🎁");
  return <div style={{fontSize:"2.15rem",filter:"drop-shadow(0 6px 8px rgba(0,0,0,.22))"}}>{icon}</div>;
}
function RewardNodeIcon({item,user,currentConfig,locked=false}){
  const preview=normalizeAvatarConfig({...currentConfig,...cosmeticPatch(item)},user.avatar);
  if(item?.slot&&["accessory","frame","aura","bg"].includes(item.slot)){
    return <Av av={user.avatar} config={preview} size={62}/>;
  }
  return <div style={{fontSize:"2rem",filter:locked?"grayscale(1) brightness(0)":"none"}}>{item.icono||"🎁"}</div>;
}


const SHOP_PHASE_LABEL = "Tienda Rasta";

function rewardRarityLabel(item={}){
  const r=String(item.rareza||item.rarity||"comun").toLowerCase();
  if(r.includes("legend"))return "legendario";
  if(r.includes("epic")||r.includes("épico")||r.includes("epico"))return "epico";
  if(r.includes("raro")||r.includes("rare"))return "raro";
  return "comun";
}
function rewardTypeLabel(item={}){
  const tipo=String(item.tipo||item.categoria||"recompensa").toLowerCase();
  if(tipo.includes("descuento"))return "Descuento";
  if(tipo.includes("servicio"))return "Servicio";
  if(tipo.includes("avatar")||tipo.includes("cosmetico"))return "Cosmético";
  if(tipo.includes("producto"))return "Producto";
  if(tipo.includes("perfil"))return "Perfil";
  return "Recompensa";
}
function rewardStockState(item={}){
  const stock=item.stock;
  if(stock===null||stock===undefined||stock==="")return {label:"stock libre",level:"ok"};
  const n=Number(stock);
  if(!Number.isFinite(n))return {label:"stock libre",level:"ok"};
  if(n<=0)return {label:"agotado",level:"bad"};
  if(n<=3)return {label:`quedan ${n}`,level:"warn"};
  return {label:`stock ${n}`,level:"ok"};
}
function canUserRedeem(user,item,settings={}){
  const points=Number(user?.puntos||0);
  const price=Number(item?.puntos_precio||item?.precio_puntos||item?.precio||0);
  const active=item?.activo!==false && item?.disabled!==true;
  const stock=rewardStockState(item);
  const min=Number(settings?.tienda?.puntos_minimos_canje||0);
  if(!active)return {ok:false,reason:"No disponible"};
  if(stock.level==="bad")return {ok:false,reason:"Agotado"};
  if(points<min)return {ok:false,reason:`Mínimo ${min} RP`};
  if(points<price)return {ok:false,reason:`Faltan ${Math.max(0,price-points)} RP`};
  return {ok:true,reason:"Canjear"};
}
function shopRedemptionTips(user={},items=[]){
  const pts=userRP(user);
  const rc=userRC(user);
  const xp=userXP(user);
  const lvl=Number(user?.avatar_level||avatarLevelFromXP(xp));
  const list=(items||[]).filter(x=>x?.activo!==false);
  const affordable=list.filter(x=>Number(x.puntos_precio||x.precio_puntos||x.precio||0)<=pts);
  const next=list
    .filter(x=>Number(x.puntos_precio||x.precio_puntos||x.precio||0)>pts)
    .sort((a,b)=>Number(a.puntos_precio||a.precio_puntos||a.precio||0)-Number(b.puntos_precio||b.precio_puntos||b.precio||0))[0];
  return {
    active:list.length,
    affordable:affordable.length,
    next,
    missing:next?Math.max(0,Number(next.puntos_precio||next.precio_puntos||next.precio||0)-pts):0
  };
}

function ShopCommandCenter({user,items=[],settings={},onFilter=null}){
  const info=shopRedemptionTips(user,items);
  const pts=userRP(user);
  const next=info.next;
  const lowStock=(items||[]).filter(x=>rewardStockState(x).level==="warn").length;
  return (
    <Card className="shop-command-center shop-visual-panel" style={{
      position:"relative",
      overflow:"hidden",
      background:"linear-gradient(140deg,#110B06 0%,#102018 52%,#2E1A0B 100%)",
      border:"1.5px solid rgba(240,200,92,.48)",
      color:"#FFF4D6",
      marginBottom:16,
      boxShadow:"0 22px 46px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.10)"
    }}>
      <div className="shop-graffiti-glow" aria-hidden="true"/>
      <div style={{position:"relative",zIndex:1,display:"grid",gridTemplateColumns:"1.35fr .9fr",gap:14,alignItems:"center"}} className="shop-command-layout">
        <div>
          <div style={{fontSize:".72rem",fontWeight:950,letterSpacing:".10em",textTransform:"uppercase",color:"rgba(255,244,214,.70)"}}>Tienda Rasta</div>
          <div style={{fontFamily:"'Rye','Pirata One',Georgia,serif",fontSize:"1.95rem",lineHeight:1,color:"#FFE7A4",textShadow:"0 4px 18px rgba(0,0,0,.45)"}}>Vales y recompensas</div>
          <div style={{fontSize:".86rem",fontWeight:850,color:"rgba(255,244,214,.84)",lineHeight:1.38,marginTop:6,maxWidth:560}}>
            Compra tiradas, pide productos del estudio y revisa qué puedes canjear con tus RP.
          </div>
          {next&&(
            <div style={{marginTop:12,display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,244,214,.08)",border:"1px solid rgba(240,200,92,.34)",borderRadius:999,padding:"8px 11px",fontWeight:950,color:"#FFF4D6"}}>
              <span>🎯</span><span>Próximo objetivo: {next.nombre||next.name||"recompensa"}</span><span style={{color:"#F2C85B"}}>faltan {info.missing} RP</span>
            </div>
          )}
        </div>
        <div className="shop-mini-stats" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          <div className="shop-mini-stat"><b>{pts}</b><span>RP disponibles</span></div>
          <div className="shop-mini-stat"><b>{info.affordable}</b><span>canjeables</span></div>
          <div className="shop-mini-stat"><b>{info.active}</b><span>artículos</span></div>
          <div className="shop-mini-stat"><b>{lowStock}</b><span>stock bajo</span></div>
        </div>
      </div>
      <div className="shop-action-row" style={{position:"relative",zIndex:1,display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
        {onFilter&&<Btn small col="gold" onClick={()=>onFilter("todos")}>Ver todo</Btn>}
        {onFilter&&<Btn small col="dark" onClick={()=>onFilter("juegos")}>Vales de juego</Btn>}
        {onFilter&&<Btn small col="ghost" onClick={()=>onFilter("productos")}>Productos €</Btn>}
      </div>
    </Card>
  );
}

function Tienda({user,setUser,showToast,showPoints,settings}){
  const [productos,setProductos]=useState([]);
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState("todo");
  const tiendaActiva=settings?.secciones?.tienda_activa!==false;
  useEffect(()=>{if(tiendaActiva)load();},[tiendaActiva]);
  if(!tiendaActiva)return <DisabledSection icon="🛍️" title="Tienda cerrada" sub="La tienda está pausada desde Gestión."/>;

  async function load(){
    setLoading(true);
    const data=await dbGet("tienda_items","?activo=eq.true&order=puntos_precio.asc&select=*");
    const pedidosRows=await dbGet("tienda_pedidos",`?usuario_id=eq.${user.id}&order=created_at.desc&limit=8&select=*`);
    const baseItems=Array.isArray(data)?data:[];
    const tiendaItems=baseItems.filter(p=>isGameVoucherItem(p)||isRealMoneyProduct(p)||["juegos","productos"].includes(itemShopCategory(p)));
    setProductos(tiendaItems);
    setPedidos(Array.isArray(pedidosRows)?pedidosRows:[]);
    setLoading(false);
  }

  async function canjear(p){
    const precio=itemPointPrice(p);
    const precioEuros=itemEuroPrice(p);
    const stockLimitado=p.stock!==null && p.stock!==undefined && String(p.stock)!=="";
    const isAvatar=isAvatarPersonalizationItem(p);
    const isGame=isGameVoucherItem(p);
    const isReal=isRealMoneyProduct(p);

    if(!isReal && (user.puntos||0)<precio){showToast("No tienes suficientes RP");SFX.error();return;}
    if(stockLimitado && Number(p.stock)<=0){showToast("Este artículo está agotado");SFX.error();return;}

    const nuevos=isReal?Number(user.puntos||0):Math.max(0,(user.puntos||0)-precio);

    if(!isReal){
      const okUser=await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
      if(!okUser){
        showToast("No se pudieron descontar los RP");
        SFX.error();
        return;
      }
    }

    const pedido=await createShopOrder({
      user,
      items:[p],
      totalPoints:isReal?0:precio,
      source:isAvatar?"personalizacion":isGame?"juegos":isReal?"producto_real":"tienda",
      status:(isAvatar||isGame)?"entregado":"pendiente",
      notes:isAvatar?"Personalización desbloqueada automáticamente.":isGame?"Vale de juego aplicado automáticamente.":isReal?"Producto real solicitado. Pendiente de pago/confirmación en tienda.":"Pedido creado desde tienda."
    });

    if(isReal && pedido?.id){
      try{await dbPatch("tienda_pedidos",`?id=eq.${pedido.id}`,{precio_euros:precioEuros,total_puntos:0,puntos_coste:0,estado:"pendiente",updated_at:new Date().toISOString()});}catch{}
    }

    try{
      await dbPost("canjes",{
        usuario_id:user.id,
        premio_id:p.id,
        premio_nombre:p.nombre,
        puntos_gastados:isReal?0:precio,
        item_key:p.item_key||null,
        categoria:p.categoria||"premios",
        tipo:p.tipo||"canje"
      });
    }catch{}

    if(stockLimitado){
      await dbPatch("tienda_items",`?id=eq.${p.id}`,{stock:Math.max(0,Number(p.stock)-1)});
    }

    if(isAvatar) await unlockCosmeticForUser(user,p);
    if(isGame){
      const applied=applyGameVoucher(user,p,1);
      if(!applied.ok){showToast(applied.label);SFX.error();return;}
    }

    if(!isReal){
      recordPointMovement(user.id,{amount:-precio,type:"spend",reason:`Canje: ${p.nombre}`,source:isAvatar?"personalizacion":isGame?"juegos":"tienda",balance:nuevos,meta:{item_id:p.id,item_key:p.item_key||null,pedido_id:pedido?.id||null,game_bonus:isGame?{kind:gameVoucherKind(p),amount:gameVoucherAmount(p)}:null}});
      setUser(u=>({...u,puntos:nuevos}));
    }
    SFX.collect();

    await createNotification({rol_destino:"admin",tipo:"pedido",titulo:isReal?"Nuevo pedido de producto real":"Nuevo pedido de tienda",mensaje:isReal?`${user.nombre||user.email||"Cliente"} solicitó ${p.nombre}${precioEuros?` por ${precioEuros.toFixed(2)} €`:""}.`:`${user.nombre||user.email||"Cliente"} pidió ${p.nombre} por ${precio} RP.`,entidad_tipo:"tienda_pedido",entidad_id:pedido?.id||p.id,importante:!isAvatar&&!isGame});
    await createNotification({usuario_id:user.id,rol_destino:"client",tipo:isAvatar?"avatar":isGame?"juegos":isReal?"pedido":"pedido",titulo:isAvatar?"Personalización desbloqueada":isGame?"Vale de juego aplicado":isReal?"Pedido enviado":"Pedido creado",mensaje:isAvatar?`Has desbloqueado ${p.nombre}. Ve a Perfil > Editor para equiparlo.`:isGame?`Has comprado ${gameVoucherAmount(p)} tiradas extra para el Gacha Barber.`:isReal?`Tu pedido de ${p.nombre} queda pendiente de confirmación/pago en tienda.`:`Tu pedido de ${p.nombre} queda pendiente de preparación.`,entidad_tipo:isAvatar?"avatar":isGame?"juego_bonus":"tienda_pedido",entidad_id:pedido?.id||p.id,importante:false});

    showToast(isAvatar?`${p.nombre} desbloqueado`:isGame?`${gameVoucherAmount(p)} tiradas de Gacha añadidas`:isReal?`${p.nombre} solicitado correctamente`:`${p.nombre} pedido correctamente`);
    await load();
  }

  function addCart(p){
    addToLocalCart(user,p,1);
    SFX.collect();
    showToast(`${p.nombre} añadido al carrito`);
  }


  const cats=[
    {id:"todo",label:"Todo",icon:"✨"},
    {id:"juegos",label:"Tienda juegos",icon:"🎮"},
    {id:"productos",label:"Productos €",icon:"🧴"}
  ];
  const visibles=cat==="todo"?productos:productos.filter(p=>itemShopCategory(p)===cat || String(p.categoria||"").toLowerCase()===cat);

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🛍️" title="Tienda Rasta" sub={`Vales, productos y recompensas · Tienes ${user.puntos||0} RP`}/> 
      {/* FASE131B_SHOP_COMMAND_CENTER */}
      <ShopCommandCenter
        user={user}
        items={productos||[]}
        settings={settings||{}}
        onFilter={(f)=>{ try{ if(f==='todos')setCat('todo'); else if(f==='avatar')setCat('estilo'); else if(f==='juegos')setCat('juegos'); else if(f==='productos')setCat('productos'); else if(f==='descuentos')setCat('cupones'); else if(f==='canjeables')setCat('todo'); }catch{} }}
      />

      <Card style={{background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",marginBottom:16,padding:"14px 16px",color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div><div style={{fontSize:"0.72rem",fontWeight:950,opacity:0.78,letterSpacing:".08em",textTransform:"uppercase"}}>RastaPoints</div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"2rem",lineHeight:1}}>{user.puntos||0} RP</div><div style={{fontSize:".78rem",fontWeight:800,opacity:.82,marginTop:3}}>Canjea vales, pide productos del estudio y revisa tus últimos pedidos. Los RC quedan para juegos y progreso.</div></div>
          <div className="icon3d" style={{fontSize:"2.8rem"}}>🎁</div>
        </div>
      </Card>

      {pedidos.length>0&&<Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🧾 Tus últimos pedidos</div>
        {pedidos.slice(0,3).map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",padding:"7px 0",borderTop:`1px solid ${T.g150}`}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:900,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.item_nombre}</div>
            <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{new Date(p.created_at).toLocaleDateString("es-ES")} · {p.puntos_coste||0} RP</div>
          </div>
          <Badge col={p.estado==="entregado"?"green":p.estado==="cancelado"?"red":p.estado==="listo"?"blue":"gold"}>{p.estado}</Badge>
        </div>)}
      </Card>}

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=><button key={c.id} onClick={()=>{SFX.tab();setCat(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${cat===c.id?T.gold:T.g300}`,background:cat===c.id?T.gradGold:"rgba(255,244,214,.84)",color:cat===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>
          {c.icon} {c.label}
        </button>)}
      </div>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin artículos todavía" sub="Aquí irán vales de juegos o productos reales. Los estilos y cupones están en el Camino de recompensas."/>
        :visibles.map(p=>{
          const precio=itemPointPrice(p);
          const precioEuros=itemEuroPrice(p);
          const realMoney=isRealMoneyProduct(p);
          const gameVoucher=isGameVoucherItem(p);
          const ok=realMoney || (user.puntos||0)>=precio;
          const stockLimitado=p.stock!==null && p.stock!==undefined && String(p.stock)!=="";
          const agotado=stockLimitado && Number(p.stock)<=0;
          return(
            <Card key={p.id||p.item_key} className="shop-reward-card" style={{marginBottom:12,border:ok&&!agotado?`2px solid ${T.gold}`:`2px solid #8E7957`,opacity:agotado?0.62:1,background:"linear-gradient(180deg,#FFF8E2,#E9D8B4 60%,#D4BD8F)",overflow:"hidden",padding:0}}>
              <div style={{display:"grid",gridTemplateColumns:"92px 1fr",gap:0}}>
                <div style={{minHeight:124,display:"grid",placeItems:"center",background:ok?"radial-gradient(circle at 50% 25%,rgba(213,178,79,.35),transparent 42%),linear-gradient(180deg,#304923,#10160F)":"linear-gradient(180deg,#3A2A18,#10160F)",borderRight:"2px solid #8E7957",position:"relative"}}>
                  <div style={{filter:ok||isAvatarPersonalizationItem(p)?"none":"grayscale(1) brightness(.55)",transform:"scale(1.03)"}}>{shopItemPreview(p,user)}</div>
                  {!ok&&<div style={{position:"absolute",top:7,right:7,background:"rgba(0,0,0,.66)",color:"#FFF8E2",borderRadius:999,padding:"2px 6px",fontSize:".62rem",fontWeight:950}}>🔒</div>}
                </div>
                <div style={{padding:12,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:950,color:T.g800,fontSize:".94rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
                      <div style={{fontSize:"0.78rem",color:T.textSub,marginTop:3,fontWeight:820,lineHeight:1.35}}>{p.descripcion}</div>
                      {gameVoucher&&<div style={{marginTop:7,background:"rgba(38,63,77,.10)",border:`1px solid ${T.g200}`,borderRadius:12,padding:"7px 9px",fontSize:".76rem",fontWeight:950,color:T.g800,lineHeight:1.35}}>
                        🎰 Vale de juego: pagas <b>{precio} RP</b> y recibes <b>+{gameVoucherAmount(p)} tiradas extra</b> para el Gacha. Se suma al momento y se puede repetir.
                      </div>}
                    </div>
                    <div style={{fontWeight:950,color:T.orange,fontSize:"1.02rem",whiteSpace:"nowrap"}}>{realMoney?(precioEuros?`${precioEuros.toFixed(2)} €`:"Consultar"): `${precio} RP`}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                    <Badge col="gold">{shopCategoryLabel(itemShopCategory(p))}</Badge>
                    {gameVoucher&&<Badge col="blue">+{gameVoucherAmount(p)} tiradas</Badge>}
                    {realMoney&&<Badge col="blue">Pago en tienda</Badge>}
                    <Badge col={p.rareza==="epico"?"pink":p.rareza==="raro"?"blue":p.rareza==="legendario"?"gold":"green"}>{rarityLabel(p.rareza||"comun")}</Badge>
                    {gameVoucher&&<Badge col="green">Canje repetible</Badge>}
                    {!gameVoucher&&!realMoney&&<Badge col="ghost">{rarityPriceRange(p.rareza||"comun")}</Badge>}
                    {stockLimitado&&<Badge col={agotado?"red":"green"}>Stock {Number(p.stock)||0}</Badge>}
                  </div>
                  <div style={{marginTop:10}}>
                    {agotado?<div style={{textAlign:"center",fontSize:"0.78rem",color:T.red,fontWeight:950}}>Agotado</div>:
                    <div style={{display:"grid",gridTemplateColumns:ok?"1fr 1fr":"1fr",gap:8}}>
                      <Btn full small col="ghost" onClick={()=>addCart(p)}>🛒 Añadir</Btn>
                      {ok?<Btn full small col="gold" onClick={()=>canjear(p)}>{realMoney?"Solicitar":gameVoucher?`Comprar +${gameVoucherAmount(p)} tiradas`:isAvatarPersonalizationItem(p)?"Desbloquear":"Canjear"}</Btn>:<div style={{textAlign:"center",fontSize:"0.78rem",color:T.textSub,fontWeight:850,alignSelf:"center"}}>Faltan {precio-(user.puntos||0)} RP</div>}
                    </div>}
                  </div>
                </div>
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
    SFX.collect();showToast(`${found.descuento}% de descuento - valido!`);
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
const GAME_DAILY_REWARDS={stitch:5,runner:4,jump:4,memoria:5,sopa:5,trivia:3,gacha:0};
const ARCADE_GAMES=[
  {id:"tycoon",icon:"🏪",title:"Rasta Cuts Tycoon",desc:"Gestión profunda con los RC globales de Rasta Cuts",pts:0},
  {id:"gacha",icon:"🎰",title:"Gacha Barber",desc:"Máquina de tiradas con premios de juego: RC, XP y tiradas extra",pts:GAME_DAILY_REWARDS.gacha},
  {id:"stitch",icon:"🪝",title:"Gancho Ninja",desc:"Llega a 100 puntos y termina",pts:GAME_DAILY_REWARDS.stitch},
  {id:"runner",icon:"✂️",title:"Rasta Runner",desc:"Peine protector, bloques y agujeros",pts:GAME_DAILY_REWARDS.runner},
  {id:"jump",icon:"🌤️",title:"Rasta Jump",desc:"Recoge utensilios y evita tijeras",pts:GAME_DAILY_REWARDS.jump},
  {id:"memoria",icon:"🧠",title:"Memoria Pro",desc:"12 parejas de peluquería",pts:GAME_DAILY_REWARDS.memoria},
  {id:"sopa",icon:"🔤",title:"Sopa diaria",desc:"Sopa 14x14 que cambia cada día",pts:GAME_DAILY_REWARDS.sopa},
  {id:"trivia",icon:"💈",title:"Trivia Barber",desc:"Preguntas capilares",pts:GAME_DAILY_REWARDS.trivia}
];
const GAME_DAILY_CAP=20;
const GACHA_DAILY_PULL_LIMIT=50;
function gachaPullsKey(uid){return `gacha_pulls_${uid||"anon"}_${TODAY_KEY()}`;}
function getGachaPullsToday(uid){try{return Number(localStorage.getItem(gachaPullsKey(uid))||0);}catch{return 0;}}
function setGachaPullsToday(uid,value){try{localStorage.setItem(gachaPullsKey(uid),String(Math.max(0,Number(value)||0)));}catch{}}
function gachaExtraPullsKey(uid){return `gacha_extra_pulls_${uid||"anon"}`;}
function getGachaExtraPulls(uid){try{return Number(localStorage.getItem(gachaExtraPullsKey(uid))||0);}catch{return 0;}}
function setGachaExtraPulls(uid,value){try{localStorage.setItem(gachaExtraPullsKey(uid),String(Math.max(0,Number(value)||0)));}catch{}}
function addGachaExtraPulls(uid,amount){const next=getGachaExtraPulls(uid)+(Number(amount)||0);setGachaExtraPulls(uid,next);return next;}
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
    SFX.tab();
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
  const [powered,setPowered]=useState(false);
  const yRef=useRef(0),vyRef=useRef(0),jumpRef=useRef(2),holdRef=useRef(false),holdMsRef=useRef(0),runningRef=useRef(false),poweredRef=useRef(false);
  const runnerBoardRef=useRef(null);
  const RUNNER_PLAYER_BOX={left:18,right:64};
  const RUNNER_HIT_Y=20;

  function resetAndStart(){
    yRef.current=0;vyRef.current=0;jumpRef.current=2;holdRef.current=false;holdMsRef.current=0;runningRef.current=true;poweredRef.current=false;
    setY(0);setJumpsLeft(2);setHolding(false);setPowered(false);setScore(0);setObstacles([{x:116,id:Date.now(),type:'scissor'}]);setGameOver(false);setRunning(true);
  }
  function pressJump(){
    if(!runningRef.current||gameOver) return;
    if(jumpRef.current<=0) return;
    SFX.jump();
    vyRef.current=jumpRef.current===2?13.8:12.4;
    jumpRef.current-=1;
    holdRef.current=true;
    holdMsRef.current=0;
    setHolding(true);setJumpsLeft(jumpRef.current);
  }
  function releaseJump(){holdRef.current=false;holdMsRef.current=0;setHolding(false);}
  function endGame(){
    setRunning(false);runningRef.current=false;setGameOver(true);SFX.hit();
  }
  function consumePower(){
    poweredRef.current=false;setPowered(false);SFX.collect();
  }

  useEffect(()=>{runningRef.current=running;},[running]);
  useEffect(()=>{poweredRef.current=powered;},[powered]);
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
      if(holdRef.current && holdMsRef.current<820 && vy>0){vy+=0.40;holdMsRef.current+=45;}
      vy-=1.05;
      yy+=vy;
      if(yy<=0){yy=0;vy=0;jumpRef.current=2;setJumpsLeft(2);}
      yRef.current=yy;vyRef.current=vy;setY(yy);

      setObstacles(prev=>{
        const dynamicSpeed=Math.min(3.35,1.55+score/190);
        let next=prev.map(o=>({...o,x:o.x-dynamicSpeed})).filter(o=>o.x>-22);
        const last=next[next.length-1];
        if(!last || last.x<50+Math.random()*24){
          const r=Math.random();
          let type='scissor';
          if(r<.16) type='comb';
          else if(r<.28) type='block';
          else if(r<.34) type='pit';
          next=[...next,{x:112+Math.random()*24,id:Date.now()+Math.random(),type}];
        }

        const boardW=runnerBoardRef.current?.clientWidth||360;
        next.forEach(o=>{
          if(o.done)return;
          const ox=(o.x/100)*boardW;
          const left=ox+4;
          const right=ox+(o.type==='pit'?38:28);
          const horizontal=right>=RUNNER_PLAYER_BOX.left && left<=RUNNER_PLAYER_BOX.right;
          if(!horizontal)return;

          if(o.type==='comb'){
            o.done=true;
            poweredRef.current=true;setPowered(true);
            setScore(s=>s+12);
            SFX.collect();
            return;
          }

          const needsJump=o.type==='block'||o.type==='pit';
          const verticalHit=needsJump ? yRef.current<RUNNER_HIT_Y+10 : yRef.current<RUNNER_HIT_Y;
          if(verticalHit){
            o.done=true;
            if(poweredRef.current){consumePower();return;}
            endGame();
          }
        });
        return next.filter(o=>!o.done);
      });
    },45);
    return()=>clearInterval(timer);
  },[running,score,gameOver]);

  const pts=Math.max(1,Math.min(12,Math.floor(score/30)));
  const jumpTxt=running?`Saltos: ${jumpsLeft} · ${powered?'peine activo':'sin poder'}`:'Peine = modo grande, una protección';
  return <Card style={{background:'linear-gradient(180deg,#F4E5BE,#E7CA8A)',border:`2px solid ${T.g300}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:8}}><div style={{fontWeight:900,color:T.g800}}>🦖✂️ Rasta Runner</div><Badge col={powered?'green':'gold'}>{powered?'Peine activo':'Runner'}</Badge></div>
    <div
      ref={runnerBoardRef}
      onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);pressJump();}}
      onPointerUp={releaseJump}
      onPointerCancel={releaseJump}
      onPointerLeave={releaseJump}
      style={{position:'relative',height:218,borderRadius:20,overflow:'hidden',background:'linear-gradient(180deg,#DDEBFF,#FFF0C9 72%,#C7A25C 72%)',border:'2px solid rgba(62,35,18,.15)',touchAction:'none',cursor:running?'pointer':'default'}}
    >
      <div style={{position:'absolute',left:0,right:0,bottom:28,height:4,background:'#6E3518'}}/>
      <div style={{position:'absolute',left:10,bottom:30+y,transition:'none',transform:powered?'scale(1.10)':'scale(1)',transformOrigin:'bottom center'}}>
        <Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={powered?78:66}/>
      </div>
      <div style={{position:'absolute',left:10,bottom:8,fontSize:'.76rem',fontWeight:900,color:T.g700}}>Distancia: {score}</div>
      <div style={{position:'absolute',right:10,bottom:8,fontSize:'.72rem',fontWeight:900,color:T.g700}}>{jumpTxt}</div>
      {obstacles.map((o,i)=>{
        const icon=o.type==='comb'?'🪮':o.type==='block'?'🧱':o.type==='pit'?'🕳️':'✂️';
        const bottom=o.type==='pit'?8:22;
        return <div key={o.id||i} style={{position:'absolute',left:`${o.x}%`,bottom,fontSize:o.type==='pit'?'2rem':o.type==='comb'?'1.55rem':'1.65rem',filter:'drop-shadow(0 3px 4px rgba(0,0,0,.22))'}}>{icon}</div>
      })}
      {!running && !gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,248,230,.42)',padding:18}}><div style={{textAlign:'center'}}><div style={{fontWeight:900,color:T.g800,marginBottom:10}}>Tu avatar corre en grande. Salta tijeras, bloques y agujeros. El peine te da una protección.</div><button type='button' onPointerDown={(e)=>{e.stopPropagation();e.preventDefault();resetAndStart();}} onClick={(e)=>{e.stopPropagation();}} style={{border:'2px solid #7A5A18',borderRadius:16,padding:'12px 18px',fontWeight:950,background:'linear-gradient(180deg,#FFF1A8,#D4AF37)',color:'#241006',boxShadow:'0 8px 16px rgba(0,0,0,.22)',cursor:'pointer'}}>▶ Empezar</button></div></div>}
      {gameOver && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(40,20,10,.56)',padding:16}}><div style={{textAlign:'center',color:T.white}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.45rem'}}>Runner terminado en {score}</div><div style={{fontWeight:800,margin:'8px 0 12px'}}>Récord de ronda: {pts} pts</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><button type='button' onPointerDown={(e)=>{e.stopPropagation();e.preventDefault();onWin(pts);}} onClick={(e)=>e.stopPropagation()} style={{border:'2px solid #7A5A18',borderRadius:16,padding:'10px 14px',fontWeight:950,background:'linear-gradient(180deg,#FFF1A8,#D4AF37)',color:'#241006',boxShadow:'0 8px 16px rgba(0,0,0,.22)',cursor:'pointer'}}>Guardar récord</button><button type='button' onPointerDown={(e)=>{e.stopPropagation();e.preventDefault();resetAndStart();}} onClick={(e)=>e.stopPropagation()} style={{border:'2px solid rgba(255,244,214,.45)',borderRadius:16,padding:'10px 14px',fontWeight:950,background:'rgba(255,244,214,.18)',color:'#fff',boxShadow:'0 8px 16px rgba(0,0,0,.22)',cursor:'pointer'}}>🔁 Reintentar</button></div></div></div>}
    </div>
    <div style={{marginTop:10,fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45}}>Toca y mantén para saltar más. El peine te hace grande y aguanta un golpe, pero no se acumula. Si chocas protegido, vuelves a normal.</div>
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
  const JUMP_HIT_MIN=91.6;
  const JUMP_HIT_MAX=94.4;
  function resetAndStart(){setLane(1);setItems([]);setScore(0);setSpeed(1);setGameOver(false);setRunning(true);}
  function move(dir){setLane(l=>Math.max(0,Math.min(2,l+dir)));SFX.tab();}
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
          if(!it.done && it.y>JUMP_HIT_MIN && it.y<JUMP_HIT_MAX && it.lane===lane){
            it.done=true;
            if(it.bad){setRunning(false);setGameOver(true);SFX.error();}
            else{setScore(s=>s+it.pts);SFX.collect();}
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
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontWeight:900,color:T.g800}}>🌤️ Rasta Jump</div><Badge col='pink'>Hitbox fina</Badge></div>
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
    <div style={{marginTop:10,fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45}}>El ritmo sube poco a poco. La recogida/daño ahora se calcula en una franja más baja y corta para evitar choques antes de tiempo.</div>
  </Card>;
}


function DreadStitchGame({onWin,user}){
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [items,setItems]=useState([]);
  const [hits,setHits]=useState(0);
  const [scissors,setScissors]=useState(0);
  const [roundPoints,setRoundPoints]=useState(0);
  const [bonusHits,setBonusHits]=useState(0);
  const [message,setMessage]=useState('Llega a 100 puntos. Al llegar a 100 termina la partida y cobras el récord.');
  const [lastAccuracy,setLastAccuracy]=useState(100);
  const [won,setWon]=useState(false);
  const accuracy=Math.round((hits/Math.max(1,hits+scissors))*100);
  const spawnMs=430;
  const lifeMs=1500;
  const scissorChance=.18;

  function resetRound(){setItems([]);setHits(0);setScissors(0);setRoundPoints(0);setBonusHits(0);setWon(false);}
  function start(){resetRound();setLastAccuracy(100);setMessage('Llega a 100 puntos. Dorado +5, ganchillo +3, normal +1. Si tocas 20 tijeras pierdes.');setFinished(false);setRunning(true);}
  function finishWin(){
    setRunning(false);setFinished(true);setWon(true);setItems([]);setLastAccuracy(accuracy);
    setMessage(`Partida completada con ${accuracy}% de precisión. Puedes guardar el récord y cobrar RP si no los cobraste hoy.`);
    SFX.success();
  }
  function finishLose(){
    setRunning(false);setFinished(true);setWon(false);setItems([]);setLastAccuracy(accuracy);
    setMessage(`Partida perdida: ${hits} aciertos y ${scissors} tijeras.`);
    SFX.error();
  }

  useEffect(()=>{
    if(!running)return;
    if(scissors>=20){finishLose();return;}
    if(roundPoints>=100){
      if(accuracy>=70) finishWin();
      else finishLose();
    }
  },[running,roundPoints,hits,scissors,accuracy]);

  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(()=>{
      setItems(prev=>{
        const now=Date.now();
        let next=prev.filter(it=>now-it.created<lifeMs);
        const r=Math.random();
        const kind=r<0.045?'bonus':r<0.16?'hook3':r<0.16+scissorChance?'scissor':'good';
        const icon=kind==='bonus'?'🎟️':kind==='hook3'?'🪝':kind==='scissor'?'✂️':(['〰️','🧵','💈'][Math.floor(Math.random()*3)]);
        next=[...next,{id:now+Math.random(),kind,icon,x:10+Math.random()*80,y:16+Math.random()*66,created:now}];
        return next.slice(-7);
      });
    },spawnMs);
    return()=>clearInterval(timer);
  },[running]);

  function tapItem(item){
    if(!running)return;
    setItems(prev=>prev.filter(i=>i.id!==item.id));
    if(item.kind==='scissor'){setScissors(s=>s+1);SFX.error();return;}
    if(item.kind==='bonus'){setBonusHits(b=>b+1);setHits(h=>h+5);setRoundPoints(p=>Math.min(100,p+5));SFX.collect();return;}
    if(item.kind==='hook3'){setHits(h=>h+3);setRoundPoints(p=>Math.min(100,p+3));SFX.action();return;}
    setHits(h=>h+1);setRoundPoints(p=>Math.min(100,p+1));SFX.tab();
  }

  const finalPts=won?Math.max(1,Math.min(10,Math.floor(lastAccuracy/18)+bonusHits)):0;
  return <Card style={{background:'linear-gradient(180deg,#F5E6C8,#E6C27A)',border:`2px solid ${T.gold}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:8,fontWeight:900,color:T.g800}}><Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={36}/> Gancho Ninja</div><Badge col={accuracy>=70?'green':'gold'}>{accuracy}%</Badge></div>
    <div style={{fontSize:'.82rem',fontWeight:800,color:T.textSub,lineHeight:1.45,marginBottom:10}}>Objetivo: <b>100 puntos y termina</b>. Ganchillo <b>+3</b>, ticket dorado <b>+5</b>, normales <b>+1</b>. Con <b>20 tijeras</b> pierdes.</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10,textAlign:'center'}}>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Objetivo</div>100</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Puntos</div>{roundPoints}/100</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Tijeras</div>{scissors}/20</div>
      <div style={{background:'rgba(255,244,214,.55)',borderRadius:14,padding:8,fontWeight:900,color:T.g800}}><div style={{fontSize:'.66rem',color:T.textSub}}>Dorados</div>{bonusHits}</div>
    </div>
    <div style={{height:280,position:'relative',overflow:'hidden',borderRadius:20,border:'2px solid rgba(62,35,18,.18)',background:'radial-gradient(circle at 25% 18%,rgba(255,214,107,.34),transparent 28%),linear-gradient(160deg,#24110A,#6E3518)',touchAction:'none',cursor:running?'crosshair':'default'}}>
      <div style={{position:'absolute',top:12,left:12,right:12,zIndex:2,height:9,borderRadius:999,background:'rgba(255,244,214,.18)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,roundPoints)}%`,background:roundPoints>=100?'linear-gradient(90deg,#2F6B42,#9BE7B0)':'linear-gradient(90deg,#D4AF37,#FFF1A8)',transition:'width .2s ease'}}/></div>
      {items.map(it=><button key={it.id} onPointerDown={(e)=>{e.preventDefault();tapItem(it)}} onClick={(e)=>e.preventDefault()} style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,transform:'translate(-50%,-50%)',width:it.kind==='bonus'?70:it.kind==='hook3'?64:60,height:it.kind==='bonus'?70:it.kind==='hook3'?64:60,borderRadius:'50%',border:'2px solid rgba(255,244,214,.82)',background:it.kind==='bonus'?'linear-gradient(180deg,#FFF8C8,#D4AF37)':it.kind==='hook3'?'linear-gradient(180deg,#DFFFE9,#3DAE5D)':it.kind==='scissor'?'linear-gradient(180deg,#FFEBEE,#C0392B)':'linear-gradient(180deg,#FFF4D6,#D4AF37)',boxShadow:'0 10px 20px rgba(0,0,0,.28)',fontSize:it.kind==='bonus'?'2rem':'1.8rem',display:'grid',placeItems:'center',cursor:'pointer',touchAction:'none',animation:it.kind==='bonus'?'rewardPulsePro 1.2s infinite':'none'}}>{it.icon}</button>)}
      {!running && !finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,244,214,.16)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:300}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem',marginBottom:8}}>100 puntos y partida cerrada</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.86,marginBottom:12}}>{message}</div><Btn col='gold' onClick={start}>▶ Empezar</Btn></div></div>}
      {finished && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(20,8,4,.72)',padding:16}}><div style={{textAlign:'center',color:T.white,maxWidth:320}}><div style={{fontFamily:"'Pirata One',cursive",fontSize:'1.55rem'}}>{won?'Partida completada':'Partida perdida'}</div><div style={{fontWeight:900,margin:'8px 0'}}>Puntos {roundPoints} · precisión {lastAccuracy}%</div><div style={{fontSize:'.82rem',fontWeight:800,opacity:.85,marginBottom:12}}>{message}</div><div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>{won&&<Btn col='gold' onClick={()=>onWin(finalPts)}>Guardar récord · {finalPts}</Btn>}<Btn col='ghost' onClick={start}>🔁 Jugar otra vez</Btn></div></div></div>}
    </div>
  </Card>;
}

function GachaSlotsGame({user,onWin,onCurrencyWin,settings,onBuyPulls,onActivity}){ 
  const uid=user?.id||"anon";
  const SYMBOLS={
    scissors:{icon:'✂️',name:'Tijeras'},
    comb:{icon:'🪮',name:'Peines'},
    hook:{icon:'🪝',name:'Ganchillos'},
    band:{icon:'🧵',name:'Gomas'},
    ticket:{icon:'🎟️',name:'Ticket dorado'},
    gem:{icon:'💎',name:'Cristal'},
    coin:{icon:'🪙',name:'Moneda'},
    star:{icon:'⭐',name:'XP'},
    clover:{icon:'🍀',name:'Suerte'}
  };
  const normal=['scissors','comb','hook','band','coin','star','clover'];
  const PRIZE_TABLE=[
    {id:'empty',chance:'52%',label:'Tirada registrada',desc:'Cuenta para actividad y misiones.',key:null,rp:0,rc:0,xp:0,rarity:'actividad'},
    {id:'xp_small',chance:'14%',label:'Impulso XP',desc:'+3 XP',key:'star',rp:0,rc:0,xp:3,rarity:'comun'},
    {id:'rc_small',chance:'13%',label:'Monedas RC',desc:'+5 RC',key:'coin',rp:0,rc:5,xp:0,rarity:'comun'},
    {id:'xp_medium',chance:'8%',label:'Subida XP',desc:'+8 XP',key:'clover',rp:0,rc:0,xp:8,rarity:'comun'},
    {id:'rc_medium',chance:'6%',label:'Pack RC',desc:'+10 RC',key:'scissors',rp:0,rc:10,xp:0,rarity:'comun'},
    {id:'rc_xp_mix',chance:'4%',label:'Mezcla arcade',desc:'+10 RC y +5 XP',key:'comb',rp:0,rc:10,xp:5,rarity:'raro'},
    {id:'extra_pull',chance:'2%',label:'Tirada extra',desc:'+1 tirada extra',key:'hook',rp:0,rc:0,xp:0,extraPulls:1,rarity:'raro'},
    {id:'rc_good',chance:'0,8%',label:'Pack RC especial',desc:'+25 RC y +10 XP',key:'gem',rp:0,rc:25,xp:10,rarity:'epico'},
    {id:'extra_pack',chance:'0,2%',label:'Pack de tiradas',desc:'+3 tiradas extra y +20 XP',key:'ticket',rp:0,rc:0,xp:20,extraPulls:3,rarity:'legendario'}
  ];
  const [reels,setReels]=useState(['scissors','comb','hook']);
  const [spinning,setSpinning]=useState(false);
  const [result,setResult]=useState(null);
  const [pulls,setPulls]=useState(()=>getGachaPullsToday(uid));
  const [extraPulls,setExtraPullsState]=useState(()=>getGachaExtraPulls(uid));
  const [claimed,setClaimed]=useState(false);
  const [showOdds,setShowOdds]=useState(false);
  const [history,setHistory]=useState(()=>readGachaLocalHistory(uid));
  const dailyLimit=Math.max(1,parseInt(settings?.puntos?.gacha_tiradas_dia??GACHA_DAILY_PULL_LIMIT,10)||GACHA_DAILY_PULL_LIMIT);

  function historyKey(){return `gacha_history_${uid}`;}
  function readGachaLocalHistory(){try{return JSON.parse(localStorage.getItem(historyKey())||"[]");}catch{return [];}}
  function writeGachaLocalHistory(items){try{localStorage.setItem(historyKey(),JSON.stringify((items||[]).slice(0,25)));}catch{}}
  function addHistory(row){const next=[{id:`gacha_${Date.now()}`,created_at:new Date().toISOString(),...row},...history].slice(0,25);setHistory(next);writeGachaLocalHistory(next);}

  useEffect(()=>{
    const reload=()=>setExtraPullsState(getGachaExtraPulls(uid));
    window.addEventListener("rasta-gacha-pulls-updated",reload);
    return()=>window.removeEventListener("rasta-gacha-pulls-updated",reload);
  },[uid]);

  const normalPullsLeft=Math.max(0,dailyLimit-pulls);
  const pullsLeft=normalPullsLeft+Math.max(0,extraPulls);
  const progress=Math.min(100,(pulls/dailyLimit)*100);

  function pickPrize(){
    const r=Math.random()*100;
    if(r<52)return {...PRIZE_TABLE[0],spinLabel:'Tirada registrada'};
    if(r<66)return {...PRIZE_TABLE[1],spinLabel:'Premio común: +3 XP'};
    if(r<79)return {...PRIZE_TABLE[2],spinLabel:'Premio común: +5 RC'};
    if(r<87)return {...PRIZE_TABLE[3],spinLabel:'Premio común: +8 XP'};
    if(r<93)return {...PRIZE_TABLE[4],spinLabel:'Premio común: +10 RC'};
    if(r<97)return {...PRIZE_TABLE[5],spinLabel:'Premio raro: +10 RC y +5 XP'};
    if(r<99)return {...PRIZE_TABLE[6],spinLabel:'Premio raro: +1 tirada extra'};
    if(r<99.8)return {...PRIZE_TABLE[7],spinLabel:'Premio épico: +25 RC y +10 XP'};
    return {...PRIZE_TABLE[8],spinLabel:'Premio legendario: +3 tiradas extra'};
  }

  function randomReels(){return [0,1,2].map(()=>normal[Math.floor(Math.random()*normal.length)]);}
  function safeNoMatch(){let out=randomReels();if(out[0]===out[1]&&out[1]===out[2])out[2]=normal[(normal.indexOf(out[2])+1)%normal.length];return out;}
  function rarityBadgeColor(r){return r==='legendario'?'gold':r==='epico'?'pink':r==='raro'?'blue':'green';}

  function spin(){
    if(spinning)return;
    if(pullsLeft<=0){SFX.error();setResult({id:'no_pulls',rp:0,rc:0,xp:0,key:null,label:'Sin tiradas disponibles',spinLabel:'Sin tiradas disponibles',rarity:'actividad'});return;}
    const usedExtra=normalPullsLeft<=0;
    if(!usedExtra){
      const nextPulls=pulls+1;setPulls(nextPulls);setGachaPullsToday(uid,nextPulls);
    }else{
      const nextExtra=Math.max(0,extraPulls-1);setExtraPullsState(nextExtra);setGachaExtraPulls(uid,nextExtra);
    }
    setSpinning(true);setResult(null);setClaimed(false);
    let ticks=0;const final=pickPrize();
    const spinTimer=setInterval(()=>{
      ticks++;setReels(randomReels());try{SFX.tab?.();}catch{}
      if(ticks>=20){
        clearInterval(spinTimer);
        let out;
        if(final.key) out=[final.key,final.key,final.key];
        else out=safeNoMatch();
        setReels(out);
        setResult({...final,usedExtra});
        const hasPrize=Number(final.rc||0)>0||Number(final.xp||0)>0||Number(final.extraPulls||0)>0||Number(final.rp||0)>0;
        if(!hasPrize){
          addHistory({label:final.spinLabel||final.label||'Tirada registrada',rarity:final.rarity||'base',rp:0,rc:0,xp:0,extraPulls:0,usedExtra:!!usedExtra});
        }
        try{
          onActivity?.({
            usedExtra:!!usedExtra,
            prize_id:final.id||'empty',
            label:final.spinLabel||final.label||'Tirada registrada',
            rarity:final.rarity||'base',
            hasPrize
          });
        }catch{}
        setSpinning(false);
        final.rarity==='base'?SFX.tab():SFX.success();
      }
    },82);
  }

  async function claim(){
    if(claimed||!result)return;
    const rp=Number(result?.rp||0);
    const rc=Number(result?.rc||0);
    const xp=Number(result?.xp||0);
    const bonusPulls=Number(result?.extraPulls||0);
    if(rp<=0&&rc<=0&&xp<=0&&bonusPulls<=0)return;
    setClaimed(true);
    if(bonusPulls>0){
      const next=addGachaExtraPulls(uid,bonusPulls);
      setExtraPullsState(next);
      try{window.dispatchEvent(new CustomEvent("rasta-gacha-pulls-updated"));}catch{}
    }
    if(rp>0) await onWin?.(rp);
    if((rc>0||xp>0)&&onCurrencyWin) await onCurrencyWin({rc,xp,reason:result?.spinLabel||"Gacha Barber"});
    addHistory({label:result.spinLabel||result.label,rarity:result.rarity,rp,rc,xp,extraPulls:bonusPulls,usedExtra:!!result.usedExtra});
    SFX.success();
  }

  async function buyPulls(){
    if(!onBuyPulls)return;
    const ok=await onBuyPulls(5,10);
    if(ok){
      const next=addGachaExtraPulls(uid,10);
      setExtraPullsState(next);
      try{window.dispatchEvent(new CustomEvent("rasta-gacha-pulls-updated"));}catch{}
      setResult({id:'shop_pulls',rp:0,rc:0,xp:0,key:null,label:'Has comprado 10 tiradas extra por 5 RP',spinLabel:'10 tiradas extra compradas',rarity:'raro'});
      addHistory({label:'Compra de 10 tiradas extra',rarity:'raro',rp:-5,rc:0,xp:0,extraPulls:10});
      SFX.collect();
    }
  }

  return <Card style={{background:'linear-gradient(180deg,#271006,#5C3317 55%,#D4AF37)',border:`2px solid ${T.gold}`,color:T.white}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12}}>
      <div><div style={{fontWeight:950,fontSize:'1.05rem'}}>🎰 Gacha Barber</div><div style={{fontSize:'.72rem',fontWeight:850,opacity:.82,marginTop:2}}>Premios de juego · RC, XP y tiradas extra</div></div>
      <Badge col={pullsLeft>0?'gold':'red'}>{pullsLeft} tiradas</Badge>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12,textAlign:'center'}}>
      <div style={{background:'rgba(255,248,230,.18)',border:'1px solid rgba(255,244,214,.28)',borderRadius:14,padding:8,fontWeight:950}}><div style={{fontSize:'.64rem',opacity:.8}}>Diarias</div>{normalPullsLeft}/{dailyLimit}</div>
      <div style={{background:'rgba(255,248,230,.18)',border:'1px solid rgba(255,244,214,.28)',borderRadius:14,padding:8,fontWeight:950}}><div style={{fontSize:'.64rem',opacity:.8}}>Extras</div>{extraPulls}</div>
      <div style={{background:'rgba(255,248,230,.18)',border:'1px solid rgba(255,244,214,.28)',borderRadius:14,padding:8,fontWeight:950}}><div style={{fontSize:'.64rem',opacity:.8}}>Coste vale</div>5 RP</div>
    </div>

    <div style={{height:8,background:'rgba(255,244,214,.22)',borderRadius:999,overflow:'hidden',marginBottom:14}}><div style={{height:'100%',width:`${progress}%`,background:T.gradGold,borderRadius:999,transition:'width .25s ease'}}/></div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
      {reels.map((key,i)=><div key={i} style={{height:106,borderRadius:22,display:'grid',placeItems:'center',background:'linear-gradient(180deg,#FFF8E6,#E8C477)',border:'3px solid rgba(255,244,214,.75)',boxShadow:'inset 0 8px 18px rgba(0,0,0,.16),0 10px 20px rgba(0,0,0,.22)',fontSize:'2.6rem',animation:spinning?'rewardPulsePro .38s infinite':'none'}}>{SYMBOLS[key]?.icon}</div>)}
    </div>

    {result&&<Card style={{background:'rgba(255,248,230,.92)',border:`2px solid ${result.rarity==='legendario'?T.gold:result.rarity==='epico'?T.pink:T.g300}`,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div style={{fontWeight:950,color:T.g800}}>{result.spinLabel||result.label}</div><Badge col={rarityBadgeColor(result.rarity)}>{result.rarity==='base'?'actividad':(result.rarity||'común')}</Badge></div>
      <div style={{fontSize:'.82rem',fontWeight:820,color:T.textSub,marginTop:5,lineHeight:1.38}}>
        {(result.rp||result.rc||result.xp||result.extraPulls)>0?`Premio: ${result.rc?`+${result.rc} RC `:''}${result.xp?`+${result.xp} XP `:''}${result.extraPulls?`+${result.extraPulls} tiradas`:''}`:pullsLeft<=0?'No quedan tiradas disponibles. Puedes usar tiradas extra o conseguir vales en la tienda.':'Tirada registrada. Cuenta para actividad y misiones.'}
      </div>
      {(result.rp||result.rc||result.xp||result.extraPulls)>0&&<div style={{marginTop:10}}><Btn full col={claimed?'green':'gold'} disabled={claimed} onClick={claim}>{claimed?'Premio cobrado':'Cobrar premio'}</Btn></div>}
    </Card>}

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      <Btn full col={pullsLeft>0?'gold':'ghost'} disabled={spinning||pullsLeft<=0} onClick={spin}>{spinning?'Girando...':pullsLeft>0?'🎰 Tirar':'Sin tiradas'}</Btn>
      <Btn full col='ghost' disabled={spinning||Number(user?.puntos||0)<5} onClick={buyPulls}>🛒 10 tiradas · 5 RP</Btn>
    </div>

    <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{fontSize:'.72rem',fontWeight:820,opacity:.82,lineHeight:1.35}}>Cada tirada cuenta como actividad. Los premios del Gacha son de juego: RC, XP o tiradas extra. Los RP se consiguen en retos y acciones limitadas.</div>
      <button onClick={()=>setShowOdds(v=>!v)} style={{border:'1px solid rgba(255,244,214,.38)',background:'rgba(255,248,230,.18)',color:T.white,borderRadius:999,padding:'7px 10px',fontWeight:950,cursor:'pointer'}}>{showOdds?'Ocultar':'Ver'} probabilidades</button>
    </div>

    {showOdds&&<Card style={{marginTop:10,background:'rgba(255,248,230,.94)',border:`1px solid ${T.g200}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Probabilidades del Gacha</div>
      <div style={{display:'grid',gap:7}}>{PRIZE_TABLE.map(p=><div key={p.id} style={{display:'grid',gridTemplateColumns:'58px 1fr auto',gap:8,alignItems:'center',fontSize:'.78rem',fontWeight:850,color:T.textSub}}><Badge col={rarityBadgeColor(p.rarity)}>{p.chance}</Badge><span><b style={{color:T.g800}}>{p.label}</b><br/>{p.desc}</span><span style={{fontSize:'1.15rem'}}>{p.key?SYMBOLS[p.key]?.icon:'▫️'}</span></div>)}</div>
    </Card>}

    {history.length>0&&<Card style={{marginTop:10,background:'rgba(255,248,230,.88)',border:`1px solid ${T.g200}`}}>
      <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Últimas tiradas</div>
      <div style={{display:'grid',gap:6}}>{history.slice(0,5).map(h=><div key={h.id} style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:'.78rem',fontWeight:850,color:T.textSub}}><span>{h.label}</span><span style={{whiteSpace:'nowrap'}}>{h.rp?`${h.rp>0?'+':''}${h.rp} RP `:''}{h.rc?`+${h.rc} RC `:''}{h.xp?`+${h.xp} XP`:''}{h.extraPulls?` +${h.extraPulls}🎰`:''}</span></div>)}</div>
    </Card>}
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
          Juega, mejora récords y consigue recompensas diarias para avanzar en tu perfil.
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
        <span style={{background:"#F3E2B5",color:T.g800,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:900}}>RP diarios</span>
        <span style={{background:"#F3E2B5",color:T.g800,borderRadius:999,padding:"5px 9px",fontSize:".68rem",fontWeight:900}}>premios y avatar</span>
      </div>

      {open&&<div style={{
        marginTop:12,
        borderTop:`1px solid ${T.g200}`,
        paddingTop:11,
        animation:"fadeSlide .22s ease"
      }}>
        <div style={{display:"grid",gap:8,fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.42}}>
          <div>Los récords sirven para competir, mejorar marcas y volver a intentarlo cada día.</div>
          <div>Cada juego puede contar para recompensa una vez al día. Después puedes rejugar para mejorar tu marca y subir en rankings.</div>
          <div>El Gacha Barber entrega premios de juego: RC, XP y tiradas extra. Cada tirada también cuenta como actividad.</div>
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
function RastaCutsTycoonGame({user,setUser,showToast,standalone=false,onExit}){
  const [state,setState]=useState(()=>loadTycoonState(user));
  const [tab,setTab]=useState("mapa");
  const [inspect,setInspect]=useState(null);
  const [nowTick,setNowTick]=useState(()=>Date.now());
  const tycoonRcSyncRef=useRef(null);
  const tycoonRcPendingDeltaRef=useRef(0);
  const tycoonRcLatestBalanceRef=useRef(null);
  const tycoonRcCommitTimerRef=useRef(null);
  const tycoonRcHydratingRef=useRef(false);
  const economy=useMemo(()=>tycoonEconomy(state),[state]);
  const selectedId=TYCOON_ROOM_DEFS[state.selectedRoom]?state.selectedRoom:"salon";
  const selectedRoom=state.rooms?.[selectedId]||tycoonBaseRoom(selectedId);
  const selectedDef=tycoonRoomDef(selectedId);
  const selectedTask=tycoonTaskFor(state,selectedId);
  const roomList=TYCOON_ROOM_ORDER.map(id=>({...(state.rooms?.[id]||tycoonBaseRoom(id)),...tycoonRoomDef(id),level:state.rooms?.[id]?.level??tycoonBaseRoom(id).level,unlocked:state.rooms?.[id]?.unlocked??tycoonBaseRoom(id).unlocked}));
  const maxQueue=1+Math.floor((state.rooms?.hall?.level||1)/4);
  const activeQueue=(state.buildQueue||[]).filter(t=>Number(t.endAt||0)>Date.now());
  const queueFull=activeQueue.length>=maxQueue;

  async function commitTycoonRcBalance(balance,delta,reason="Movimiento Tycoon"){
    if(!user?.id)return;
    const cleanBalance=Math.max(0,Math.round(Number(balance)||0));
    const cleanDelta=Math.round(Number(delta)||0);
    try{
      await dbPatch("usuarios",`?id=eq.${user.id}`,{rc:cleanBalance});
      if(cleanDelta!==0){
        await dbPost("economy_movements",{
          usuario_id:String(user.id),
          usuario_email:user.email||null,
          usuario_nombre:user.nombre||null,
          currency:"rc",
          amount:cleanDelta,
          type:cleanDelta>0?"earn":"spend",
          reason,
          source:"tycoon",
          balance:cleanBalance,
          meta:{game:"tycoon",local_save:true}
        });
      }
    }catch(e){
      console.warn("No se pudo sincronizar RC del Tycoon",e);
    }
  }

  function queueTycoonRcSync(balance,delta,reason){
    if(!user?.id)return;
    const cleanBalance=Math.max(0,Math.round(Number(balance)||0));
    const cleanDelta=Math.round(Number(delta)||0);
    tycoonRcPendingDeltaRef.current+=cleanDelta;
    tycoonRcLatestBalanceRef.current=cleanBalance;
    setUser?.(u=>u?({...u,rc:cleanBalance}):u);
    if(tycoonRcCommitTimerRef.current)clearTimeout(tycoonRcCommitTimerRef.current);
    tycoonRcCommitTimerRef.current=setTimeout(()=>{
      const pending=tycoonRcPendingDeltaRef.current;
      const latest=tycoonRcLatestBalanceRef.current;
      tycoonRcPendingDeltaRef.current=0;
      commitTycoonRcBalance(latest,pending,reason|| (pending>=0?"Ingresos Tycoon":"Gasto Tycoon"));
    },650);
  }

  function pushLog(prev,msg){return [{t:Date.now(),msg},...(prev.log||[])].slice(0,26);}
  function mutate(fn){
    setState(prev=>{
      const cleaned=completeTycoonTasks(prev);
      const next=fn({...cleaned,rooms:{...cleaned.rooms},stock:{...cleaned.stock},staff:{...cleaned.staff},decor:{...cleaned.decor},missions:{...cleaned.missions},buildQueue:[...(cleaned.buildQueue||[])],log:[...(cleaned.log||[])]});
      saveTycoonState(user,next);
      return next;
    });
  }

  useEffect(()=>{
    if(!user?.id)return;
    setState(prev=>{
      const globalRc=userRC(user);
      const localRc=Math.max(0,Math.round(Number(prev.rc)||0));
      const targetRc=Math.max(localRc,globalRc);
      tycoonRcSyncRef.current=targetRc;
      if(localRc>globalRc){
        setUser?.(u=>u?({...u,rc:localRc}):u);
        commitTycoonRcBalance(localRc,localRc-globalRc,"Migración de RC del Tycoon");
      }
      if(globalRc>localRc){
        tycoonRcHydratingRef.current=true;
        const next={...prev,rc:globalRc,lifetimeRC:Math.max(Number(prev.lifetimeRC||0),globalRc),log:pushLog(prev,"El Tycoon se sincronizó con tus RC globales.")};
        saveTycoonState(user,next);
        return next;
      }
      return prev;
    });
  },[user?.id]);

  useEffect(()=>{
    if(!user?.id)return;
    const current=Math.max(0,Math.round(Number(state.rc)||0));
    if(tycoonRcSyncRef.current===null){tycoonRcSyncRef.current=current;return;}
    const prev=tycoonRcSyncRef.current;
    if(tycoonRcHydratingRef.current){
      if(current!==prev)return;
      tycoonRcHydratingRef.current=false;
      return;
    }
    if(current===prev)return;
    const delta=current-prev;
    tycoonRcSyncRef.current=current;
    queueTycoonRcSync(current,delta,delta>=0?"Ingresos Tycoon":"Gasto Tycoon");
  },[state.rc,user?.id]);

  useEffect(()=>()=>{if(tycoonRcCommitTimerRef.current)clearTimeout(tycoonRcCommitTimerRef.current);},[]);

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
      setInspect({icon:def.icon,title:def.name,text:`Zona en obras. Tiempo: ${tycoonFormatTime(endAt-now)}.`});SFX.collect();return;
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
    SFX.collect();
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
    "Esto no es el Arcade normal: aquí construyes el estudio usando tus RC globales. No toca tus RP valiosos.",
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
    {tab==="guia"&&<Card style={{background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}><div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}><div style={{fontSize:"2.2rem"}}>🧔🏽‍♂️</div><div><div style={{fontWeight:950,color:T.g800}}>Guía de Rasta</div><div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>{guideTexts[state.guideStep%guideTexts.length]}</div><div style={{marginTop:10}}><Btn small col="gold" onClick={()=>mutate(prev=>({...prev,guideStep:(prev.guideStep||0)+1}))}>Siguiente consejo</Btn></div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}>{[{icon:"💰",t:"Economía RC",d:"Los RC son globales. Los ganas en Gacha, Arcade y Tycoon, y aquí sirven para stock, mejoras, equipo y decoración."},{icon:"🗺️",t:"Mapa",d:"Es la vista principal tipo Travian. Pulsa edificios para entrar o ver requisitos."},{icon:"🏠",t:"Salas",d:"Cada sala tiene objetos clicables. La escena cambia según el tipo de zona."},{icon:"📦",t:"Stock",d:"Sin productos no se atienden clientes y los RC/h bajan."},{icon:"🔨",t:"Obras",d:"Las mejoras tardan tiempo real y se completan solas."},{icon:"📈",t:"Progreso",d:"Hall atrae clientes, Peluquería sube ingresos, Almacén sostiene la economía."}].map(x=><div key={x.t} style={{background:"rgba(255,255,255,.38)",border:`1px solid ${T.g200}`,borderRadius:16,padding:12}}><div style={{fontWeight:950,color:T.g800}}>{x.icon} {x.t}</div><div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:4}}>{x.d}</div></div>)}</div><div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}><Btn small col="red" onClick={resetGame}>Reiniciar Tycoon</Btn></div></Card>}
    <Card style={{background:"linear-gradient(180deg,#E6CF9B,#D8BE87)"}}><div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Registro</div><div style={{display:"grid",gap:6,maxHeight:190,overflow:"auto"}}>{(state.log||[]).slice(0,12).map((l,i)=><div key={i} style={{fontSize:".75rem",fontWeight:820,color:T.textSub,lineHeight:1.35,borderBottom:`1px solid ${T.g200}`,paddingBottom:5}}>{new Date(l.t).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})} · {l.msg}</div>)}</div></Card>
  </div>;
}


function Juegos({user,setUser,showToast,showPoints,setHelperPage,onOpenTops,onOpenTycoon,settings}){
  const [activeGame,setActiveGame]=useState(null);
  const [category,setCategory]=useState("todos");
  const arcadeActiva=settings?.secciones?.arcade_activo!==false;
  const gachaActiva=settings?.secciones?.gacha_activo!==false;
  const gameDailyCap=Math.max(0,parseInt(settings?.puntos?.limite_diario_juegos??GAME_DAILY_CAP,10)||GAME_DAILY_CAP);
  const GAMES=ARCADE_GAMES.filter(g=>g.id!=="gacha"||gachaActiva);
  const uid=user?.id||"anon";

  useEffect(()=>{
    if(activeGame) startGameMusic(activeGame);
    else stopGameMusic();
    return ()=>stopGameMusic();
  },[activeGame]);

  useEffect(()=>{
    setHelperPage?.(activeGame?"game":"arcade");
    return ()=>setHelperPage?.(null);
  },[activeGame,setHelperPage]);

  if(!arcadeActiva)return <DisabledSection icon="🎮" title="Arcade desactivado" sub="El Arcade está pausado desde Gestión."/>;

  async function handleWin(gameId,score){
    const alreadyPlayed=getPlayedToday(gameId,uid);
    const rawScore=Math.max(0,Number(score)||0);
    const maxReward=GAME_DAILY_REWARDS[gameId]||10;
    const remaining=Math.max(0,gameDailyCap-getDailyGamePointsTotal(uid));
    const reward=Math.min(maxReward,rawScore,remaining);
    saveLocalGameScore(gameId,user,rawScore);
    try{ await dbPost("game_scores",{usuario_id:user.id,usuario_nombre:user.nombre,usuario_avatar:user.avatar,usuario_avatar_config:normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0),game_id:gameId,score:rawScore,week:weekKey()}); }catch{}
    if(alreadyPlayed){
      SFX.success();
      showToast(`Récord guardado. Los RP de ${gameMeta(gameId).short} ya estaban cobrados hoy.`);
      if(gameId!=="gacha")setActiveGame(null);
      return;
    }
    markPlayedToday(gameId,uid);
    if(reward<=0){
      SFX.success();
      showToast(`Récord guardado. Límite diario de ${gameDailyCap} RP alcanzado.`);
      if(gameId!=="gacha")setActiveGame(null);
      return;
    }
    const awarded=await awardWebPoints({user,setUser,showToast,showPoints,points:reward,reason:"Arcade"});
    if(awarded>0)addDailyGamePointsTotal(uid,awarded);
    if(gameId!=="gacha")setActiveGame(null);
  }

  async function awardGameCurrencyPrize({rc=0,xp=0,reason="Gacha Barber"}={}){
    if(!user?.id)return false;
    const addRc=Math.max(0,Number(rc)||0);
    const addXp=Math.max(0,Number(xp)||0);
    if(addRc<=0&&addXp<=0)return false;
    const nextRc=userRC(user)+addRc;
    const nextXp=userXP(user)+addXp;
    const nextLevel=avatarLevelFromXP(nextXp);
    try{
      await dbPatch("usuarios",`?id=eq.${user.id}`,{rc:nextRc,xp:nextXp,avatar_level:nextLevel});
      if(addRc>0) await dbPost("economy_movements",{usuario_id:String(user.id),usuario_email:user.email||null,usuario_nombre:user.nombre||null,currency:"rc",amount:addRc,type:"earn",reason,source:"gacha",balance:nextRc,meta:{game:"gacha"}});
      if(addXp>0) await dbPost("economy_movements",{usuario_id:String(user.id),usuario_email:user.email||null,usuario_nombre:user.nombre||null,currency:"xp",amount:addXp,type:"earn",reason,source:"gacha",balance:nextXp,meta:{game:"gacha",avatar_level:nextLevel}});
    }catch(e){console.warn("No se pudo guardar economía RC/XP",e);}
    setUser?.(u=>({...u,rc:nextRc,xp:nextXp,avatar_level:nextLevel}));
    showToast(`${addRc?`+${addRc} RC `:""}${addXp?`+${addXp} XP`:""}`.trim());
    return true;
  }

  async function buyGachaPulls(cost=5,amount=10){
    if(!user?.id)return false;
    const actual=Number(user.puntos||0);
    if(actual<cost){showToast(`Necesitas ${cost} RP para comprar ${amount} tiradas`);SFX.error();return false;}
    const nuevos=Math.max(0,actual-cost);
    try{await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});}catch{}
    setUser?.(u=>({...u,puntos:nuevos}));
    recordPointMovement(user.id,{amount:-cost,type:"spend",reason:`Compra ${amount} tiradas Gacha`,source:"gacha",balance:nuevos,meta:{cost,amount,currency:"rp"}});
    showToast(`Compradas ${amount} tiradas extra por ${cost} RP`);
    return true;
  }

  async function registerGachaActivity(meta={}){
    if(!user?.id)return false;
    try{
      await dbPost("game_scores",{
        usuario_id:String(user.id),
        usuario_nombre:user.nombre||user.email||"Cliente",
        usuario_avatar:user.avatar||0,
        usuario_avatar_config:normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0),
        game_id:"gacha",
        score:0,
        week:weekKey()
      });
      return true;
    }catch(e){
      console.warn("No se pudo registrar actividad de Gacha",e,meta);
      return false;
    }
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
        {activeGame==="gacha"&&<GachaSlotsGame user={user} settings={settings} onWin={pts=>handleWin("gacha",pts)} onCurrencyWin={awardGameCurrencyPrize} onBuyPulls={buyGachaPulls} onActivity={registerGachaActivity}/>} 
        {activeGame==="tycoon"&&<RastaCutsTycoonGame user={user} setUser={setUser} showToast={showToast}/>} 
      </div>
    );
  }

  const todayTotal=getDailyGamePointsTotal(uid);
  const todayPct=Math.min(100,Math.round((todayTotal/Math.max(1,gameDailyCap))*100));
  const playedCount=GAMES.filter(g=>getPlayedToday(g.id,uid)).length;
  const pendingCount=Math.max(0,GAMES.length-playedCount);
  const extraPulls=getGachaExtraPulls(uid);
  const categoryDefs=[
    {id:"todos",icon:"🎮",label:"Todos",sub:"Todo el Arcade",ids:GAMES.map(g=>g.id)},
    {id:"destacados",icon:"⭐",label:"Recomendados",sub:"Tycoon, Gacha y Runner",ids:["tycoon","gacha","runner"]},
    {id:"ranking",icon:"🏆",label:"Ranking",sub:"Piques y Top",ids:["runner","jump","stitch","memoria"]},
    {id:"clasicos",icon:"🕹️",label:"Clásicos",sub:"Partidas rápidas",ids:["memoria","sopa","trivia"]}
  ];
  const activeCat=categoryDefs.find(x=>x.id===category)||categoryDefs[0];
  const visibleGames=GAMES.filter(g=>activeCat.ids.includes(g.id));
  const bestOverall=Math.max(0,...GAMES.filter(g=>g.id!=="tycoon"&&g.id!=="gacha").map(g=>getMyBestScore(g.id,uid)));

  function GameCard({g,featured=false}){
    const played=getPlayedToday(g.id,uid);
    const best=getMyBestScore(g.id,uid);
    const isTycoon=g.id==="tycoon";
    const isGacha=g.id==="gacha";
    const toneMap={tycoon:["#E0B84F","#4A2F0D","local"],gacha:["#B878FF","#2A1747","gacha"],runner:["#35B8D0","#123E52","arcade"],jump:["#3EE6C7","#123F32","arcade"],stitch:["#D94A35","#4A1711","reto"],memoria:["#E0B84F","#3E3010","arcade"],sopa:["#0FB890","#143F2E","reto"],trivia:["#B878FF","#281A42","comunidad"]};
    const [accent,deep,artType]=toneMap[g.id]||["#3EE6C7","#123F32","arcade"];
    const status=isTycoon?"Progreso propio":isGacha?"RC + XP":played?"Cobrado hoy":"Pendiente hoy";
    return <Card hover style={{opacity:played&&!isTycoon?0.92:1,background:`linear-gradient(145deg,rgba(8,13,10,.97),${deep}F2), radial-gradient(circle at 88% 16%,${accent}33,transparent 38%)`,border:`1px solid ${played&&!isTycoon?"rgba(255,244,214,.18)":accent+"77"}`,position:"relative",overflow:"hidden",color:"#FFF7DA",padding:0,boxShadow:"0 18px 42px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.08)"}}>
      <div style={{position:"absolute",right:4,top:10,opacity:.38,transform:"rotate(-5deg)",pointerEvents:"none",zIndex:0}}><RastaCardIllustration type={artType} accent={accent} size={96}/></div>
      <div style={{position:"absolute",left:0,right:0,top:0,height:38,background:`linear-gradient(90deg,${accent}24,rgba(255,255,255,.045),transparent)`,borderBottom:`1px solid ${accent}18`,zIndex:0}}/>
      <div style={{position:"absolute",top:9,left:12,zIndex:2,display:"inline-flex",alignItems:"center",gap:6,padding:"5px 9px",borderRadius:999,background:"rgba(255,244,214,.88)",border:`1px solid ${accent}66`,fontSize:".62rem",fontWeight:1000,color:"#211407",textTransform:"uppercase",letterSpacing:".045em",boxShadow:"0 5px 12px rgba(0,0,0,.16)",maxWidth:"calc(100% - 120px)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
        {status}
      </div>
      <div style={{position:"relative",zIndex:1,padding:"46px 12px 12px",display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,alignItems:"end",minHeight:132}}>
        <div style={{minWidth:0,maxWidth:"78%"}}>
          <div className="rc-card-title" style={{fontWeight:1000,fontSize:featured?"1.16rem":"1.04rem",marginTop:0,color:accent,textTransform:"uppercase",letterSpacing:".02em",lineHeight:1}}>{g.title}</div>
          <div style={{fontSize:".74rem",fontWeight:800,lineHeight:1.25,color:"rgba(255,247,218,.78)",marginTop:5,maxWidth:210}}>{g.desc}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            {isTycoon?<Badge col="blue">🪙 RC global</Badge>:isGacha?<Badge col="gold">🎰 premios de juego</Badge>:<Badge col="gold">💎 hasta +{g.pts} RP</Badge>}
            {!isTycoon&&<Badge col="blue">🏆 récord {best}</Badge>}
            {isGacha&&extraPulls>0&&<Badge col="gold">+{extraPulls} tiradas</Badge>}
          </div>
        </div>
        <div style={{display:"grid",gap:7,justifyItems:"end",alignSelf:"end"}}>
          <button onClick={()=>isTycoon?onOpenTycoon?.():setActiveGame(g.id)} style={{border:`1px solid ${accent}88`,background:`linear-gradient(135deg,${accent},#FFF1A6)`,color:"#160D07",borderRadius:13,padding:"8px 10px",fontWeight:1000,cursor:"pointer",boxShadow:`0 10px 20px ${accent}22`,whiteSpace:"nowrap"}}>{isTycoon?"Gestionar":played&&!isGacha?"Rejugar":"Jugar"}</button>
          {!isTycoon&&<button onClick={()=>onOpenTops?.("games")} style={{border:"none",background:"transparent",color:"rgba(255,247,218,.78)",fontSize:".70rem",fontWeight:950,cursor:"pointer"}}>Ver top</button>}
        </div>
      </div>
    </Card>;
  }

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎮" title="Arcade Rasta" sub="Minijuegos, rankings, Gacha y Tycoon en una zona directa para jugar."/>

      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#171008,#2B331A 48%,#C9A43D)",border:`2px solid ${T.gold}`,color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-22,top:-34,fontSize:"7rem",opacity:.12,transform:"rotate(-10deg)"}}>🎮</div>
        <div style={{position:"relative",zIndex:1,display:"grid",gap:12}}>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={54}/>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.62rem",lineHeight:1}}>Centro Arcade</div>
              <div style={{fontSize:".82rem",fontWeight:850,opacity:.84,lineHeight:1.35}}>Juega, sube marcas y gana recompensas de juego con ritmo de arcade.</div>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <Badge col="gold">💎 {Number(user?.puntos||0)} RP</Badge>
              <Badge col="blue">🪙 {userRC(user)} RC</Badge>
              <Badge col="green">⭐ Nv. {userLevel(user)}</Badge>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
            <div style={{background:"rgba(255,244,214,.16)",border:"1px solid rgba(255,244,214,.32)",borderRadius:16,padding:10}}><div style={{fontSize:".68rem",fontWeight:850,opacity:.78}}>RP Arcade hoy</div><div style={{fontSize:"1.22rem",fontWeight:950}}>{todayTotal}/{gameDailyCap}</div></div>
            <div style={{background:"rgba(255,244,214,.16)",border:"1px solid rgba(255,244,214,.32)",borderRadius:16,padding:10}}><div style={{fontSize:".68rem",fontWeight:850,opacity:.78}}>Juegos cobrados</div><div style={{fontSize:"1.22rem",fontWeight:950}}>{playedCount}/{GAMES.length}</div></div>
            <div style={{background:"rgba(255,244,214,.16)",border:"1px solid rgba(255,244,214,.32)",borderRadius:16,padding:10}}><div style={{fontSize:".68rem",fontWeight:850,opacity:.78}}>Mejor marca</div><div style={{fontSize:"1.22rem",fontWeight:950}}>{bestOverall}</div></div>
          </div>
          <div style={{height:9,background:"rgba(255,244,214,.18)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${todayPct}%`,background:"linear-gradient(90deg,#FFF4D6,#C9A43D)",borderRadius:999,transition:"width .25s ease"}}/></div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <button onClick={()=>onOpenTops?.("games")} style={{border:`2px solid ${T.g300}`,borderRadius:20,padding:"13px 12px",background:"linear-gradient(135deg,#FFF4D6,#EBD7A8)",color:T.g800,fontWeight:950,cursor:"pointer",textAlign:"left",boxShadow:"0 8px 18px rgba(20,8,4,.13)"}}><div style={{fontSize:"1.6rem"}}>🏆</div><div>Ranking semanal</div><div style={{fontSize:".72rem",color:T.textSub,marginTop:3}}>Top por minijuego</div></button>
        <button onClick={()=>onOpenTops?.("general")} style={{border:`2px solid ${T.g300}`,borderRadius:20,padding:"13px 12px",background:"linear-gradient(135deg,#FFF4D6,#EBD7A8)",color:T.g800,fontWeight:950,cursor:"pointer",textAlign:"left",boxShadow:"0 8px 18px rgba(20,8,4,.13)"}}><div style={{fontSize:"1.6rem"}}>👑</div><div>Ranking general</div><div style={{fontSize:".72rem",color:T.textSub,marginTop:3}}>Juego y comunidad</div></button>
      </div>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF8E6,#F3E4BD)",border:`1.5px solid ${T.g200}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <div><div style={{fontWeight:950,color:T.g800}}>🎯 Estado de hoy</div><div style={{fontSize:".78rem",fontWeight:820,color:T.textSub}}>Pendientes: {pendingCount}. Puedes rejugar sin cobrar RP para mejorar récord.</div></div>
          <Btn small col="ghost" onClick={()=>setActiveGame("gacha")}>🎰 Gacha</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8}}>
          {GAMES.filter(g=>g.id!=="tycoon").slice(0,7).map(g=>{const played=getPlayedToday(g.id,uid);return <div key={g.id} style={{border:`1px solid ${played?T.g200:T.gold}`,background:played?"rgba(185,154,69,.14)":"rgba(255,255,255,.42)",borderRadius:16,padding:9,textAlign:"center"}}><div style={{fontSize:"1.35rem"}}>{g.icon}</div><div style={{fontSize:".68rem",fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.title}</div><div style={{fontSize:".64rem",fontWeight:900,color:played?T.g600:T.orange}}>{played?"cobrado":"pendiente"}</div></div>})}
        </div>
      </Card>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
        {categoryDefs.map(c=><button key={c.id} onClick={()=>{SFX.tab();setCategory(c.id);}} style={{minWidth:132,border:`2px solid ${category===c.id?T.gold:T.g200}`,borderRadius:18,padding:"10px 12px",background:category===c.id?"linear-gradient(135deg,#FFF4D6,#EBD081)":"rgba(255,244,214,.72)",color:T.g800,fontWeight:950,cursor:"pointer",textAlign:"left",boxShadow:category===c.id?"0 8px 18px rgba(185,154,69,.22)":"0 5px 12px rgba(20,8,4,.08)"}}><div>{c.icon} {c.label}</div><div style={{fontSize:".66rem",fontWeight:850,color:T.textSub,marginTop:2}}>{c.sub}</div></button>)}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",margin:"-2px 2px 10px",flexWrap:"wrap"}}>
        <div style={{fontSize:".78rem",fontWeight:900,color:T.textSub}}>
          Mostrando {visibleGames.length} de {GAMES.length} juegos. Cambia de pestaña sólo si quieres filtrar.
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setActiveGame("runner")} style={{border:`1px solid ${T.g300}`,background:"rgba(255,244,214,.70)",borderRadius:999,padding:"6px 9px",fontSize:".68rem",fontWeight:950,color:T.g800,cursor:"pointer"}}>✂️ Runner</button>
          <button onClick={()=>setActiveGame("gacha")} style={{border:`1px solid ${T.g300}`,background:"rgba(255,244,214,.70)",borderRadius:999,padding:"6px 9px",fontSize:".68rem",fontWeight:950,color:T.g800,cursor:"pointer"}}>🎰 Gacha</button>
          <button onClick={()=>onOpenTycoon?.()} style={{border:`1px solid ${T.g300}`,background:"rgba(255,244,214,.70)",borderRadius:999,padding:"6px 9px",fontSize:".68rem",fontWeight:950,color:T.g800,cursor:"pointer"}}>🏪 Tycoon</button>
        </div>
      </div>

      <div className="rc-arcade-games-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:16}}>
        {visibleGames.map(g=><GameCard key={g.id} g={g} featured={activeCat.id==="destacados"}/>) }
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
    {id:"total",icon:"💎",title:"General",sub:"RP actuales",unit:"RP"},
    {id:"games",icon:"🎮",title:"Juegos",sub:"Récords y piques de Arcade",unit:"RP"},
    {id:"shop",icon:"🛍️",title:"Tienda",sub:"RP gastados en vales, avatar, juegos y premios",unit:"RP"},
    {id:"community",icon:"🌐",title:"Comunidad",sub:"Foro, respuestas y participación",unit:"RP"},
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

  function RankRow({r,i,unit="RP"}){
    return <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 0",borderBottom:i<9?"1px solid rgba(255,244,214,.16)":"none"}}>
      <div style={{width:36,fontWeight:950,fontSize:"1.05rem",color:i<3?T.gold:T.white}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
      <PublicAvatar profile={r} currentUser={user} size={40}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:950,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(r,user)}</div>
        <div style={{fontSize:".68rem",fontWeight:800,opacity:.68}}>{r.created_at?new Date(r.created_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):section==="general"?generalMeta.sub:"marca guardada"}</div><AvatarMiniIdentity profile={r} currentUser={user} dark limit={2}/>
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
              <div style={{fontSize:"1.05rem",marginTop:5}}>Ranking general</div>
              <div style={{fontSize:".68rem",opacity:.76,lineHeight:1.25}}>clientes y actividad</div>
            </button>
          </div>
          <div style={{fontSize:".76rem",fontWeight:800,opacity:.82,lineHeight:1.35,marginTop:10}}>
            {section==="games"?"Top 10 de récords del Arcade: semanal, histórico y por minijuego.":"Ranking general dividido en RP, juegos, tienda y comunidad."}
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
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>Ranking general por categoría</div>
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
            <div><div style={{fontWeight:950,fontSize:"1.05rem"}}>{generalMeta.icon} Ranking general · {generalMeta.title}</div><div style={{fontSize:".74rem",opacity:.78,fontWeight:800}}>{generalMeta.sub}</div></div>
            <Badge col="gold">{generalRows.length}/10</Badge>
          </div>
          {generalLoading?<Spinner/>:generalRows.length===0?<EmptyState icon="👑" title="Sin datos todavía" sub="Cuando los clientes participen, jueguen o canjeen RP aparecerán aquí."/>:generalRows.map((r,i)=><RankRow key={`${r.user_id}-${generalKind}-${i}-${livePulse}`} r={r} i={i} unit={generalMeta.unit}/>)}
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
    await awardWebPoints({user,setUser,showToast,showPoints,points:Number(reto.puntos_premio)||0,reason:"Reto"});
    load();
  }
  function daysLeft(f){const d=Math.ceil((new Date(f)-new Date())/86400000);return d<=0?"Vence hoy":`${d} dias`;}
  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🎯" title="Retos" sub="Completa retos y gana RP"/>
      {loading?<Spinner/>:retos.length===0?<EmptyState icon="🎯" title="Sin retos activos" sub="Vuelve pronto"/>
        :retos.map(r=>{
          const prog=progresos[r.id];
          const pv=prog?.progreso||0,pct=Math.min((pv/r.meta)*100,100);
          const canClaim=pv>=r.meta&&prog&&!prog.completado,done=prog?.completado;
          return(
            <Card key={r.id} style={{marginBottom:12,border:canClaim?`2px solid ${T.g400}`:done?`2px solid ${T.g300}`:`1px solid ${T.g150}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{flex:1}}><div style={{fontWeight:800}}>{r.titulo}</div><div style={{fontSize:"0.8rem",color:T.textSub,marginTop:2}}>{r.descripcion}</div></div>
                <div style={{textAlign:"right",marginLeft:10}}><div style={{fontWeight:900,color:T.pink,fontSize:"1rem"}}>+{r.puntos_premio} RP</div><div style={{fontSize:"0.7rem",color:T.textSub}}>{daysLeft(r.fecha_fin)}</div></div>
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
function Ranking({user,onNavigate}){
  const [tab,setTab]=useState("general");
  const [game,setGame]=useState("runner");
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({users:[],scores:[],canjes:[],newsComments:[],newsLikes:[],foroTemas:[],foroRespuestas:[],foroVotos:[]});
  const [selectedProfile,setSelectedProfile]=useState(null);
  const [lastUpdate,setLastUpdate]=useState(null);

  const gameOptions=(typeof ARCADE_GAMES!=="undefined"?ARCADE_GAMES:[]).filter(g=>g.id!=="gacha");
  const selectedGame=gameMeta(game);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    try{
      const [usersRaw,scores,canjes,newsComments,newsLikes,foroTemas,foroRespuestas,foroVotos]=await Promise.all([
        safeList("usuarios","?select=id,nombre,email,puntos,rc,xp,avatar,avatar_config,avatar_level,perfil_publico,modo_incognito,role,rol&limit=600"),
        safeList("game_scores","?order=created_at.desc&limit=5000&select=*"),
        safeList("canjes","?select=usuario_id,puntos_gastados,created_at&limit=5000"),
        safeList("news_comments","?select=usuario_id,created_at&limit=5000"),
        safeList("news_likes","?select=usuario_id,created_at&limit=5000"),
        safeList("foro_temas","?select=usuario_id,likes,respuestas_count,fijado,created_at&limit=5000"),
        safeList("foro_respuestas","?select=usuario_id,likes,created_at&limit=5000"),
        safeList("foro_votos","?select=usuario_id,target_tipo,created_at&limit=5000")
      ]);
      const enriched=await enrichProfilesWithAvatarConfigs(Array.isArray(usersRaw)?usersRaw:[]);
      const users=(enriched||[]).filter(u=>{
        const r=normalizeRole(u.role||u.rol);
        return r!==ROLES.ADMIN && r!==ROLES.STAFF && !isBannedProfile(u);
      });
      setData({
        users,
        scores:Array.isArray(scores)?scores:[],
        canjes:Array.isArray(canjes)?canjes:[],
        newsComments:Array.isArray(newsComments)?newsComments:[],
        newsLikes:Array.isArray(newsLikes)?newsLikes:[],
        foroTemas:Array.isArray(foroTemas)?foroTemas:[],
        foroRespuestas:Array.isArray(foroRespuestas)?foroRespuestas:[],
        foroVotos:Array.isArray(foroVotos)?foroVotos:[]
      });
      setLastUpdate(new Date());
    }catch(e){
      console.warn("No se pudo cargar ranking inteligente",e);
      setData({users:[],scores:[],canjes:[],newsComments:[],newsLikes:[],foroTemas:[],foroRespuestas:[],foroVotos:[]});
    }
    setLoading(false);
  }

  function profileById(id,extra={}){
    const key=String(id||"");
    const found=(data.users||[]).find(u=>String(u.id)===key);
    if(found)return {...found,...extra,user_id:key};
    return {
      id:key,
      user_id:key,
      nombre:extra.usuario_nombre||extra.nombre||"Jugador",
      avatar:extra.usuario_avatar||extra.avatar||0,
      avatar_config:extra.usuario_avatar_config||extra.avatar_config||null,
      puntos:0,
      rc:0,
      xp:0,
      ...extra
    };
  }

  function communityScoreMap(){
    const values={};
    (data.newsComments||[]).forEach(r=>{const id=String(r.usuario_id||"");if(id)values[id]=(values[id]||0)+3;});
    (data.newsLikes||[]).forEach(r=>{const id=String(r.usuario_id||"");if(id)values[id]=(values[id]||0)+1;});
    (data.foroTemas||[]).forEach(r=>{const id=String(r.usuario_id||"");if(id)values[id]=(values[id]||0)+8+Number(r.likes||0)+Math.min(10,Number(r.respuestas_count||0));});
    (data.foroRespuestas||[]).forEach(r=>{const id=String(r.usuario_id||"");if(id)values[id]=(values[id]||0)+3+Number(r.likes||0);});
    (data.foroVotos||[]).forEach(r=>{const id=String(r.usuario_id||"");if(id)values[id]=(values[id]||0)+1;});
    return values;
  }

  function arcadeRows(){
    const byUser={};
    (data.scores||[]).forEach(s=>{
      const uid=String(s.usuario_id||s.user_id||"");
      const gid=String(s.game_id||s.juego||s.game||"");
      if(!uid||!gid)return;
      const score=Number(s.score)||Number(s.points)||Number(s.puntos)||0;
      if(!byUser[uid])byUser[uid]={bestByGame:{},plays:0,last:s};
      byUser[uid].plays+=1;
      byUser[uid].last=s;
      if(score>Number(byUser[uid].bestByGame[gid]||0))byUser[uid].bestByGame[gid]=score;
    });
    return Object.entries(byUser).map(([uid,info])=>{
      const totalBest=Object.values(info.bestByGame).reduce((sum,n)=>sum+Number(n||0),0);
      const variety=Object.keys(info.bestByGame).length;
      return {
        ...profileById(uid,info.last),
        score:Math.round(totalBest+info.plays*2+variety*25),
        sub:`${info.plays} partidas · ${variety} juegos`,
        unit:"pts"
      };
    });
  }

  function gameRows(){
    const byUser={};
    (data.scores||[]).filter(s=>String(s.game_id||s.juego||s.game||"")===String(game)).forEach(s=>{
      const uid=String(s.usuario_id||s.user_id||"");
      if(!uid)return;
      const score=Number(s.score)||Number(s.points)||Number(s.puntos)||0;
      if(!byUser[uid]||score>Number(byUser[uid].score||0))byUser[uid]={...s,score};
    });
    return Object.values(byUser).map(r=>({
      ...profileById(r.usuario_id||r.user_id,r),
      score:Number(r.score)||0,
      sub:r.created_at?`Mejor marca · ${new Date(r.created_at).toLocaleDateString("es-ES")}`:"Mejor marca",
      unit:"pts"
    }));
  }

  function shopRows(){
    const spent={};
    (data.canjes||[]).forEach(r=>{
      const id=String(r.usuario_id||"");
      if(id)spent[id]=(spent[id]||0)+Number(r.puntos_gastados||0);
    });
    return Object.entries(spent).map(([uid,score])=>({
      ...profileById(uid),
      score:Math.round(score),
      sub:"RP canjeados en tienda",
      unit:"RP"
    }));
  }

  function levelRows(){
    return (data.users||[]).map(u=>({
      ...u,
      user_id:String(u.id),
      score:Number(u.avatar_level||avatarLevelFromXP(userXP(u)))||0,
      sub:`${userXP(u)} XP · ${avatarLevelName(u.avatar_level||avatarLevelFromXP(userXP(u)))}`,
      unit:"Nv."
    }));
  }

  function communityRows(){
    const map=communityScoreMap();
    return (data.users||[]).map(u=>({
      ...u,
      user_id:String(u.id),
      score:Math.round(Number(map[String(u.id)]||0)),
      sub:"foro, actualidad y participación",
      unit:"pts"
    })).filter(r=>r.score>0);
  }

  function generalRows(){
    return (data.users||[]).map(u=>({
      ...u,
      user_id:String(u.id),
      score:Number(u.puntos||0)||0,
      sub:`${userRC(u)} RC · ${userXP(u)} XP`,
      unit:"RP"
    }));
  }

  const tabs=[
    {id:"general",icon:"👑",title:"General",sub:"RP acumulados"},
    {id:"arcade",icon:"🎮",title:"Arcade",sub:"actividad y mejores marcas"},
    {id:"game",icon:"🏆",title:"Por juego",sub:selectedGame.short||"minijuego"},
    {id:"community",icon:"🌐",title:"Comunidad",sub:"foro y actualidad"},
    {id:"shop",icon:"🛍️",title:"Tienda",sub:"canjes y recompensas"},
    {id:"level",icon:"⭐",title:"Nivel",sub:"avatar y XP"}
  ];

  function rawRows(){
    if(tab==="arcade")return arcadeRows();
    if(tab==="game")return gameRows();
    if(tab==="community")return communityRows();
    if(tab==="shop")return shopRows();
    if(tab==="level")return levelRows();
    return generalRows();
  }

  const clean=normalizeText(q);
  const allRows=rawRows()
    .filter(r=>{
      if(!clean)return true;
      const visibleName=isPrivateProfile(r,user)?"xxxxxx":publicName(r,user);
      return normalizeText(`${visibleName} ${r.sub||""} ${avatarLevelName(r.avatar_level||avatarLevelFromXP(userXP(r)))}`).includes(clean);
    })
    .sort((a,b)=>Number(b.score||0)-Number(a.score||0));

  const topRows=allRows.slice(0,15);
  const myIndex=allRows.findIndex(r=>String(r.user_id||r.id)===String(user?.id));
  const myRow=myIndex>=0?allRows[myIndex]:null;
  const activeMeta=tabs.find(t=>t.id===tab)||tabs[0];
  const totalScores=data.scores.length;
  const totalUsers=data.users.length;
  const bestRow=allRows[0];

  function formatScore(v,unit){
    const n=Number(v)||0;
    return `${n.toLocaleString("es-ES")} ${unit||"pts"}`;
  }

  function RankItem({r,i,forcePos=null}){
    const pos=forcePos??i;
    const isMe=String(r.user_id||r.id)===String(user?.id);
    const medal=pos===0?"🥇":pos===1?"🥈":pos===2?"🥉":`#${pos+1}`;
    return <Card key={`${r.user_id||r.id}-${tab}-${pos}`} hover onClick={()=>setSelectedProfile(r)} style={{marginBottom:8,background:isMe?"linear-gradient(180deg,#FFF1A8,#F6E5BE)":"linear-gradient(180deg,#FFF8E6,#E9D9B7)",border:isMe?`2px solid ${T.gold}`:`1.5px solid ${T.g200}`,padding:11}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="icon3d" style={{fontSize:pos<3?"1.55rem":"1rem",minWidth:36,textAlign:"center",fontWeight:950,color:T.g800}}>{medal}</div>
        <PublicAvatar profile={r} currentUser={user} size={44}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:1000,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(r,user)}{isMe?" · tú":""}</div>
          <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{isPrivateProfile(r,user)?"Perfil en modo incógnito":(r.sub||avatarStyleName(normalizeAvatarConfig(r.avatar_config||r.avatarConfig,r.avatar)))}</div>
          <AvatarMiniIdentity profile={r} currentUser={user} limit={3} showCurrency/>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:1000,color:T.orange,fontSize:"1.05rem",whiteSpace:"nowrap"}}>{formatScore(r.score,r.unit)}</div>
          <div style={{fontSize:".62rem",fontWeight:850,color:T.textSub}}>ranking</div>
        </div>
      </div>
    </Card>;
  }

  return(
    <div style={{animation:"fadeSlide 0.4s ease"}}>
      <SectionHeader icon="🏆" title="Rankings" sub="Liga de clientes, récords por juego y actividad de la comunidad." action={<Btn small col="ghost" onClick={load}>↻</Btn>}/>

      <Card style={{marginBottom:12,background:"linear-gradient(145deg,#120806,#3A2312 52%,#B99A45)",border:`2px solid ${T.gold}`,color:T.white,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",right:-22,top:-30,fontSize:"7rem",opacity:.12}}>♛</div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.55rem",lineHeight:1}}>Liga Rasta Cuts</div>
          <div style={{fontSize:".82rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.38,marginTop:5}}>Rankings limpios con avatar, nivel, RP, RC, XP y perfiles públicos sin mostrar datos personales.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}>
            <div style={{borderRadius:14,padding:10,background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.16)"}}><div style={{fontWeight:1000}}>{totalUsers}</div><div style={{fontSize:".68rem",fontWeight:850,opacity:.75}}>usuarios</div></div>
            <div style={{borderRadius:14,padding:10,background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.16)"}}><div style={{fontWeight:1000}}>{totalScores}</div><div style={{fontSize:".68rem",fontWeight:850,opacity:.75}}>partidas</div></div>
            <div style={{borderRadius:14,padding:10,background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.16)"}}><div style={{fontWeight:1000}}>{bestRow?publicName(bestRow,user):"--"}</div><div style={{fontSize:".68rem",fontWeight:850,opacity:.75}}>líder</div></div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#EAD5A7)",border:`1.5px solid ${T.g300}`}}>
        <Input label="Buscar en ranking" value={q} onChange={setQ} placeholder="Nombre, nivel, categoría..."/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setTab(t.id);}} style={{border:`2px solid ${tab===t.id?T.gold:T.g200}`,background:tab===t.id?T.gradGold:"rgba(255,244,214,.78)",color:tab===t.id?T.g900:T.g700,borderRadius:16,padding:"9px 5px",fontWeight:950,cursor:"pointer"}}>
            <div style={{fontSize:"1.25rem",lineHeight:1}}>{t.icon}</div>
            <div style={{fontSize:".72rem",marginTop:4}}>{t.title}</div>
          </button>)}
        </div>
      </Card>

      {tab==="game"&&<Card style={{marginBottom:12,background:"linear-gradient(180deg,#EFE0BE,#E4CFAB)",border:`1.5px solid ${T.g300}`}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🎮 Elegir minijuego</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {gameOptions.map(g=>{
            const active=game===g.id;
            return <button key={g.id} onClick={()=>{SFX.tab();setGame(g.id);}} style={{border:`2px solid ${active?T.gold:T.g200}`,background:active?T.gradGold:T.g50,color:active?T.g900:T.g700,borderRadius:15,padding:"9px 6px",fontWeight:950,cursor:"pointer"}}>
              <div style={{fontSize:"1.35rem",lineHeight:1}}>{g.icon}</div>
              <div style={{fontSize:".72rem",marginTop:4}}>{g.title}</div>
            </button>;
          })}
        </div>
      </Card>}

      <Card style={{marginBottom:12,background:"linear-gradient(160deg,#24110A,#6E3518)",color:T.white,border:"2px solid rgba(255,244,214,.35)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontWeight:1000,fontSize:"1.05rem"}}>{activeMeta.icon} {activeMeta.title}</div>
            <div style={{fontSize:".74rem",fontWeight:800,opacity:.75}}>{activeMeta.sub}{lastUpdate?` · ${lastUpdate.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`:""}</div>
          </div>
          <Badge col="gold">{allRows.length}</Badge>
        </div>
        {loading?<Spinner/>:topRows.length===0?<EmptyState icon="🏆" title="Sin datos todavía" sub="Cuando haya actividad, aparecerá aquí."/>:<div>{topRows.map((r,i)=><RankItem key={`${r.user_id||r.id}-${i}`} r={r} i={i}/>)}</div>}
      </Card>

      {myRow&&myIndex>14&&<Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF1A8,#F6E5BE)",border:`2px solid ${T.gold}`}}>
        <div style={{fontWeight:1000,color:T.g800,marginBottom:8}}>Tu posición</div>
        <RankItem r={myRow} i={myIndex} forcePos={myIndex}/>
      </Card>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn full col="ghost" onClick={()=>onNavigate?.("juegos")}>Ir al Arcade</Btn>
        <Btn full col="gold" onClick={()=>onNavigate?.("comunidad")}>Ver comunidad</Btn>
      </div>

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
    await awardWebPoints({user,setUser,showToast,showPoints,points:5,reason:"Reseña"});
    showToast("Gracias por tu reseña");
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
        <Btn full onClick={submit}>Enviar (+10 RP)</Btn>
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
    setText("");SFX.tab();load();
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
    {loading?<Spinner/>:total===0?<div style={{fontSize:".84rem",fontWeight:800,color:T.textSub,lineHeight:1.4}}>Todavía no has comentado ni dado like en Actualidad. Abre una noticia, aporta algo útil y empieza a sumar RP.</div>:<>
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
  // Economía austera 2.9.6h:
  // Las misiones sólo empujan al usuario a usar la app.
  // No deben ser la fuente principal de RC ni pueden imprimir RP sin control.
  {key:"daily_arcade",period:"day",icon:"🎮",title:"Una partida al día",desc:"Juega y guarda una partida de Arcade hoy. Premio pequeño para mantener el hábito.",goal:1,rp:2,rc:3,xp:5,points:2,type:"gamesToday",action:"juegos",actionLabel:"Ir al Arcade"},
  {key:"daily_gacha",period:"day",icon:"🎰",title:"Tirada Gacha",desc:"Haz una tirada en el Gacha Barber hoy para completar actividad y sumar progreso.",goal:1,rp:0,rc:1,xp:3,points:0,type:"gachaToday",action:"juegos",actionLabel:"Ir al Gacha"},
  {key:"daily_news_comment",period:"day",icon:"💬",title:"Deja tu huella",desc:"Comenta en el tablón o en actualidad y deja tu huella en la comunidad.",goal:1,rp:1,rc:0,xp:5,points:1,type:"commentsToday",action:"noticias",actionLabel:"Ir a Actualidad"},
  {key:"daily_news_like",period:"day",icon:"👍",title:"Marca algo útil",desc:"Da un like en Actualidad hoy. Premio simbólico de XP.",goal:1,rp:0,rc:0,xp:2,points:0,type:"likesToday",action:"noticias",actionLabel:"Ir a Actualidad"},
  {key:"daily_tycoon",period:"day",icon:"🏪",title:"Turno Tycoon",desc:"Atiende clientes o guarda actividad del Tycoon hoy. El RC fuerte lo genera el propio Tycoon, no la misión.",goal:1,rp:0,rc:3,xp:5,points:0,type:"tycoonToday",action:"juegos",actionLabel:"Ir al Tycoon"},
  {key:"weekly_arcade_5",period:"week",icon:"🕹️",title:"Pique Arcade",desc:"Guarda 5 partidas esta semana. Premio justo, sin pasarse.",goal:5,rp:4,rc:10,xp:20,points:4,type:"gamesWeek",action:"juegos",actionLabel:"Ir al Arcade"},
  {key:"weekly_comments_5",period:"week",icon:"🗣️",title:"Conversador semanal",desc:"Comenta 5 noticias esta semana. Premio centrado en XP.",goal:5,rp:3,rc:0,xp:25,points:3,type:"commentsWeek",action:"noticias",actionLabel:"Ir a Actualidad"},
  {key:"weekly_mixed",period:"week",icon:"🌐",title:"Barrio vivo",desc:"Juega, comenta y da un like esta semana.",goal:3,rp:3,rc:5,xp:15,points:3,type:"mixedWeek",action:"dashboard",actionLabel:"Ver Inicio"},
  {key:"weekly_tycoon",period:"week",icon:"💈",title:"Tycoon en marcha",desc:"Entra al Tycoon 3 veces esta semana. Bonus pequeño porque el juego ya genera RC.",goal:3,rp:2,rc:10,xp:20,points:2,type:"tycoonWeek",action:"juegos",actionLabel:"Ir al Tycoon"},
];
function missionRewards(m){
  const parts=[];
  const rp=Number(m.rp??m.points??0)||0;
  const rc=Number(m.rc||0)||0;
  const xp=Number(m.xp||0)||0;
  if(rp>0)parts.push(`+${rp} RP`);
  if(rc>0)parts.push(`+${rc} RC`);
  if(xp>0)parts.push(`+${xp} XP`);
  return parts.length?parts.join(" · "):"Recompensa";
}
const TROPHY_DEFS=[
  {key:"first_game",icon:"🎮",title:"Primer arcade",desc:"Guarda tu primera partida",condition:s=>s.gamesAll>=1},
  {key:"first_comment",icon:"💬",title:"Primera opinión",desc:"Deja tu primer comentario en Actualidad",condition:s=>s.commentsAll>=1},
  {key:"news_liker",icon:"👍",title:"Buen radar",desc:"Da 5 likes a contenidos útiles",condition:s=>s.likesAll>=5},
  {key:"weekly_player",icon:"🔥",title:"Semana activa",desc:"Guarda 3 partidas en una misma semana",condition:s=>s.gamesWeek>=3},
  {key:"commentator",icon:"🗣️",title:"Voz del barrio",desc:"Deja 5 comentarios en actualidad o comunidad",condition:s=>s.commentsAll>=5},
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
function MissionCard({m,value,claimed,onClaim,onGo}){
  const done=value>=m.goal;
  const pct=clampPct(value,m.goal);
  return <Card style={{marginBottom:10,padding:12,background:done?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"linear-gradient(180deg,#FFF4D6,#F5E6C8)",border:`2px solid ${done?T.gold:T.g200}`}}>
    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
      <div style={{width:42,height:42,borderRadius:16,display:"grid",placeItems:"center",fontSize:"1.35rem",background:done?T.gradGold:"rgba(255,244,214,.82)",boxShadow:"0 8px 16px rgba(20,8,4,.14)"}}>{m.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}><div style={{fontWeight:950,color:T.g800,lineHeight:1.1}}>{m.title}</div><div style={{fontWeight:950,color:done?T.orange:T.g600,fontSize:".76rem",textAlign:"right"}}>{missionRewards(m)}</div></div>
        <div style={{fontSize:".78rem",fontWeight:750,color:T.textSub,marginTop:3}}>{m.desc}</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",fontWeight:900,color:T.g700,marginTop:8}}><span>Progreso</span><span>{Math.min(value,m.goal)}/{m.goal}</span></div>
        <div style={{height:8,background:"rgba(110,53,24,.16)",borderRadius:999,overflow:"hidden",marginTop:4}}><div style={{height:"100%",width:`${pct}%`,background:done?T.gradGold:T.gradClient,borderRadius:999,transition:"width .3s ease"}}/></div>
      </div>
    </div>
    {claimed?<div style={{marginTop:9,fontSize:".78rem",fontWeight:900,color:T.g700,background:"rgba(255,244,214,.72)",borderRadius:12,padding:"8px 10px"}}>Reclamado</div>
      :done?<div style={{marginTop:9}}><Btn full small col="gold" onClick={onClaim}>Reclamar {missionRewards(m)}</Btn></div>
      :<div style={{marginTop:9,display:"grid",gap:7}}><div style={{fontSize:".76rem",fontWeight:800,color:T.textSub}}>Completa el objetivo para reclamarlo.</div>{m.action&&<Btn full small col="ghost" onClick={onGo}>{m.actionLabel||"Ir a completar"}</Btn>}</div>}
  </Card>;
}
function ObjetivosTrofeos({user,setUser,showToast,showPoints,onNavigate=null}){
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
    const [gamesAll,gamesToday,gamesWeek,commentsAll,commentsToday,commentsWeek,likesAll,likesToday,likesWeek,tycoonToday,tycoonWeek,gachaToday,claims,trophyRows]=await Promise.all([
      safeList("game_scores",`?usuario_id=eq.${uid}&select=game_id,score,created_at`),
      safeList("game_scores",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=game_id,score,created_at`),
      safeList("game_scores",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=game_id,score,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&select=news_category,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=news_category,created_at`),
      safeList("news_comments",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&created_at=gte.${day}&select=news_category,created_at`),
      safeList("news_likes",`?usuario_id=eq.${uid}&created_at=gte.${week}&select=news_category,created_at`),
      safeList("economy_movements",`?usuario_id=eq.${uid}&source=eq.tycoon&created_at=gte.${day}&select=id,created_at`),
      safeList("economy_movements",`?usuario_id=eq.${uid}&source=eq.tycoon&created_at=gte.${week}&select=id,created_at`),
      safeList("game_scores",`?usuario_id=eq.${uid}&game_id=eq.gacha&created_at=gte.${day}&select=game_id,created_at`),
      safeList("user_mission_claims",`?usuario_id=eq.${uid}&select=mission_key,period_key`),
      safeList("user_trophies",`?usuario_id=eq.${uid}&select=trophy_key`),
    ]);
    const nextStats={
      gamesAll:gamesAll.length,gamesToday:gamesToday.length,gamesWeek:gamesWeek.length,
      commentsAll:commentsAll.length,commentsToday:commentsToday.length,commentsWeek:commentsWeek.length,
      likesAll:likesAll.length,likesToday:likesToday.length,likesWeek:likesWeek.length,
      tycoonToday:tycoonToday.length,tycoonWeek:tycoonWeek.length,gachaToday:gachaToday.length,
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
    if(value<m.goal){showToast?.("Todavía falta progreso para esta misión");return;}
    const rp=Number(m.rp??m.points??0)||0;
    const rc=Number(m.rc||0)||0;
    const xp=Number(m.xp||0)||0;
    try{
      const {error}=await supabase.from("user_mission_claims").insert({
        usuario_id:String(user.id),
        mission_key:m.key,
        period_key:period,
        puntos:rp,
        rc,
        xp,
        created_at:new Date().toISOString()
      });
      if(error){showToast?.("Misión ya reclamada o no disponible");return;}
      if(rp>0){
        await awardWebPoints({user,setUser,showToast,showPoints,points:rp,reason:"Misión"});
      }
      if(rc>0||xp>0){
        const nextRc=(Number(user.rc)||0)+rc;
        const nextXp=userXP(user)+xp;
        const nextLevel=avatarLevelFromXP(nextXp);
        const patch={};
        if(rc>0)patch.rc=nextRc;
        if(xp>0){patch.xp=nextXp;patch.avatar_level=nextLevel;}
        await dbPatch("usuarios",`?id=eq.${user.id}`,patch);
        if(rc>0)await dbPost("economy_movements",{usuario_id:String(user.id),usuario_email:user.email||null,usuario_nombre:user.nombre||null,currency:"rc",amount:rc,type:"earn",reason:`Misión: ${m.title}`,source:"mission",balance:nextRc,meta:{mission_key:m.key,period_key:period}});
        if(xp>0)await dbPost("economy_movements",{usuario_id:String(user.id),usuario_email:user.email||null,usuario_nombre:user.nombre||null,currency:"xp",amount:xp,type:"earn",reason:`Misión: ${m.title}`,source:"mission",balance:nextXp,meta:{mission_key:m.key,period_key:period,avatar_level:nextLevel}});
        setUser?.(u=>({...u,...patch}));
      }
      setClaimed(v=>({...v,[key]:true}));
      SFX.success();
      showToast?.(`Misión completada: ${missionRewards(m)}`);
    }catch(e){
      console.warn("No se pudo reclamar misión",e);
      showToast?.("No se pudo reclamar la misión");
    }
  }
  const unlockedCount=Object.values(trophies).filter(Boolean).length;
  const available=MISSION_DEFS.filter(m=>missionValue(m,stats)>=m.goal&&!claimed[`${m.key}_${missionPeriodKey(m)}`]).length;
  return <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${available?T.gold:T.g300}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
      <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🎯 Objetivos y trofeos</div><div style={{fontSize:".8rem",fontWeight:800,color:T.textSub}}>Excusas buenas para volver cada día sin imprimir RP.</div></div>
      <Badge col={available?"gold":"green"}>{available} listos</Badge>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      <button onClick={()=>setTab("missions")} style={{border:`2px solid ${tab==="missions"?T.gold:T.g200}`,borderRadius:14,padding:"9px 10px",fontWeight:950,cursor:"pointer",background:tab==="missions"?T.gradGold:"rgba(255,244,214,.72)",color:tab==="missions"?T.g900:T.g700}}>Objetivos</button>
      <button onClick={()=>setTab("trophies")} style={{border:`2px solid ${tab==="trophies"?T.gold:T.g200}`,borderRadius:14,padding:"9px 10px",fontWeight:950,cursor:"pointer",background:tab==="trophies"?T.gradGold:"rgba(255,244,214,.72)",color:tab==="trophies"?T.g900:T.g700}}>Trofeos {unlockedCount}/{TROPHY_DEFS.length}</button>
    </div>
    {loading?<Spinner/>:tab==="missions"?<div>{MISSION_DEFS.map(m=><MissionCard key={m.key} m={m} value={missionValue(m,stats)} claimed={!!claimed[`${m.key}_${missionPeriodKey(m)}`]} onClaim={()=>claimMission(m)} onGo={()=>m.action&&onNavigate?.(m.action)}/>)}</div>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{TROPHY_DEFS.map(t=>{const on=!!trophies[t.key];return <div key={t.key} style={{border:`2px solid ${on?T.gold:T.g200}`,borderRadius:18,padding:12,background:on?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"rgba(255,244,214,.58)",opacity:on?1:.55,textAlign:"center"}}><div style={{fontSize:"2rem",filter:on?"drop-shadow(0 6px 8px rgba(212,175,55,.35))":"grayscale(1)"}}>{t.icon}</div><div style={{fontWeight:950,color:T.g800,fontSize:".86rem",lineHeight:1.1}}>{t.title}</div><div style={{fontSize:".7rem",fontWeight:800,color:T.textSub,marginTop:4,lineHeight:1.25}}>{t.desc}</div></div>})}</div>}
  </Card>;
}


function MisionesPage({user,setUser,showToast,showPoints,onNavigate}){
  return <div>
    <SectionHeader icon="🎯" title="Misiones" sub="Retos diarios y semanales con premio medido. RP y RC siguen bajo control."/>
    <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)",border:`2px solid ${T.g300}`}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
        <div><div style={{fontSize:"1.35rem"}}>💎</div><div style={{fontWeight:950,color:T.g800}}>RP</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>Tienda y cupones</div></div>
        <div><div style={{fontSize:"1.35rem"}}>🪙</div><div style={{fontWeight:950,color:T.g800}}>RC</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>Juegos y Tycoon</div></div>
        <div><div style={{fontSize:"1.35rem"}}>⭐</div><div style={{fontWeight:950,color:T.g800}}>XP</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>Nivel de avatar</div></div>
      </div>
    </Card>
    <ObjetivosTrofeos user={user} setUser={setUser} showToast={showToast} showPoints={showPoints} onNavigate={onNavigate}/>
  </div>;
}


function AvatarCosmeticShop({user,setUser,currentConfig,onApply,showToast,showPoints}){
  const [items,setItems]=useState(COSMETIC_CATALOG_FALLBACK);
  const [owned,setOwned]=useState([]);
  const [cat,setCat]=useState("todos");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{load();},[user.id]);
  async function load(){
    setLoading(true);
    let catalog=mergeRewardPathItems(COSMETIC_CATALOG_FALLBACK);
    try{
      const {data,error}=await supabase.from("avatar_cosmetics").select("*").eq("activo",true).order("puntos_precio",{ascending:true});
      if(!error && data?.length) catalog=mergeRewardPathItems(data);
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
    saveLocalOwnedCosmetics(user,keys);setOwned(keys);setUser?.(u=>({...u,puntos:nuevos}));showPoints?.(0);SFX.collect();showToast?.(`${item.nombre} desbloqueado`);
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
      <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🧢 Tienda de estilo</div><div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>Canjea RP por cosméticos del perfil. Se desbloquean para siempre.</div></div>
      <Badge col="gold">{user.puntos||0} pts</Badge>
    </div>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:8}}>{cats.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{whiteSpace:"nowrap",border:`2px solid ${cat===c.id?T.gold:T.g200}`,background:cat===c.id?T.gradGold:"rgba(255,244,214,.8)",borderRadius:999,padding:"7px 12px",fontWeight:950,color:cat===c.id?T.g900:T.g700,cursor:"pointer"}}>{c.label}</button>)}</div>
    {loading?<Spinner/>:<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{shown.map(item=>{const has=owned.includes(item.item_key);const active=isAvatarPathReward(item)&&normalizeAvatarConfig(currentConfig,user.avatar)[item.slot]===item.valor;return <div key={item.item_key} style={{background:active?"linear-gradient(180deg,#FFF8E1,#F6E5BE)":"rgba(255,244,214,.72)",border:`2px solid ${active?T.gold:T.g200}`,borderRadius:18,padding:10,boxShadow:"0 8px 18px rgba(20,8,4,.1)"}}>
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
function isAvatarPathReward(item={}){
  const slot=String(item.slot||"");
  const tipo=String(item.tipo||"").toLowerCase();
  const cat=String(item.categoria||"").toLowerCase();
  return ["accessory","frame","aura","bg","profileTitle","nameColor","profileCard","sticker"].includes(slot)||cat==="avatar"||tipo.includes("avatar")||tipo.includes("perfil")||tipo.includes("cosmetico");
}
function isCouponPathReward(item={}){
  const tipo=String(item.tipo||"").toLowerCase();
  const cat=String(item.categoria||"").toLowerCase();
  const slot=String(item.slot||"").toLowerCase();
  return cat==="cupones"||tipo.includes("coupon")||tipo.includes("cupon")||slot.includes("coupon")||slot.includes("cupon");
}

function couponDiscountFromReward(item={}){
  const raw=String(item.valor||item.descuento||item.discount||item.nombre||"");
  const found=raw.match(/\d+/);
  return Math.max(1,Math.min(90,Number(found?.[0]||10)));
}

function rewardCouponCode(user,item={}){
  const discount=couponDiscountFromReward(item);
  const uid=String(user?.id||user?.email||"USER").replace(/[^a-z0-9]/gi,"").slice(0,4).toUpperCase()||"USER";
  const key=String(item.item_key||item.nombre||"CUPON").replace(/[^a-z0-9]/gi,"").slice(-5).toUpperCase()||"CUPON";
  return `RASTA${discount}-${uid}-${key}`;
}

async function ensureRewardCouponForUser(user,item={}){
  if(!user?.id||!isCouponPathReward(item)||!item?.item_key)return null;
  const codigo=rewardCouponCode(user,item);
  const descuento=couponDiscountFromReward(item);
  try{
    const existing=await dbGet("user_coupons",`?usuario_id=eq.${user.id}&item_key=eq.${item.item_key}&select=*&limit=1`);
    if(Array.isArray(existing)&&existing.length)return existing[0];
  }catch{}
  try{
    const rows=await dbPost("user_coupons",{
      usuario_id:String(user.id),
      usuario_email:user.email||null,
      usuario_nombre:user.nombre||user.name||null,
      item_key:item.item_key,
      codigo,
      nombre:item.nombre||`Cupón ${descuento}%`,
      descripcion:item.descripcion||`Cupón desbloqueado en el Camino de recompensas.`,
      descuento,
      origen:"camino_recompensas",
      estado:"disponible",
      usado:false,
      created_at:new Date().toISOString()
    });
    return Array.isArray(rows)?rows?.[0]||null:rows;
  }catch(e){
    console.warn("No se pudo crear cupón de recompensa",e);
    return null;
  }
}
function rewardActionLabel(item={},owned=false,reached=false,active=false){
  if(isAvatarPathReward(item)) return owned?(active?"Equipado":"Equipar"):(reached?"Desbloquear estilo":"Silueta bloqueada");
  if(isCouponPathReward(item)) return owned?"Cupón desbloqueado":(reached?"Desbloquear cupón":"Cupón bloqueado");
  return owned?"Desbloqueado":(reached?"Desbloquear":"Bloqueado");
}
function RewardSilhouette({item,user,currentConfig,owned,reached,active,onClick}){
  const preview=normalizeAvatarConfig({...currentConfig,...cosmeticPatch(item)},user.avatar);
  const locked=!owned&&!reached;
  return <button type="button" onClick={onClick} style={{
    minWidth:78,
    maxWidth:78,
    border:"none",
    background:"transparent",
    padding:0,
    cursor:"pointer",
    position:"relative"
  }}>
    <div style={{
      height:66,
      width:66,
      margin:"0 auto",
      borderRadius:"50%",
      display:"grid",
      placeItems:"center",
      background:active?"linear-gradient(145deg,#FFF8E1,#E6C27A)":reached?"linear-gradient(145deg,#FFF4D6,#F0D39B)":"linear-gradient(145deg,#16100C,#3A2A1D)",
      border:`2px solid ${active?T.gold:owned?T.g300:reached?T.gold:"rgba(255,244,214,.22)"}`,
      boxShadow:active?"0 0 24px rgba(212,175,55,.55)":reached?"0 8px 18px rgba(212,175,55,.25)":"inset 0 10px 22px rgba(0,0,0,.35),0 8px 14px rgba(20,8,4,.18)",
      overflow:"hidden",
      animation:reached&&!owned?"rewardPulsePro 2.2s ease-in-out infinite":"none"
    }}>
      <div style={{filter:locked?"grayscale(1) brightness(0)":"none",opacity:locked?0.78:1,transform:"scale(.82)"}}>
        <RewardNodeIcon item={item} user={user} currentConfig={currentConfig} locked={locked}/>
      </div>
      {owned&&<div style={{position:"absolute",right:8,top:4,background:T.gradGold,color:T.g900,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontWeight:950,fontSize:".68rem"}}>✓</div>}
      {locked&&<div style={{position:"absolute",right:8,top:4,background:"rgba(0,0,0,.58)",color:T.white,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontSize:".68rem"}}>🔒</div>}
      {reached&&!owned&&<div style={{position:"absolute",right:7,top:4,background:T.gold,color:T.g900,borderRadius:"50%",width:20,height:20,display:"grid",placeItems:"center",fontWeight:950,fontSize:".68rem"}}>!</div>}
    </div>
    <div style={{height:18,width:3,background:owned||reached?T.gold:"rgba(255,244,214,.35)",margin:"-1px auto 0"}}/>
    <div style={{fontSize:".62rem",fontWeight:950,color:owned||reached?T.g800:T.textSub,lineHeight:1.05}}>
      Nv. {rewardLevelFor(item.puntos_precio)}
    </div>
    <div style={{fontSize:".58rem",fontWeight:850,color:T.textSub,lineHeight:1.05,marginTop:2}}>
      {item.puntos_precio} pts
    </div>
  </button>;
}
const REWARD_PATH_EXTRA_ITEMS=[
  {item_key:"reward_coupon_10_mid",nombre:"Cupón 10% descuento",descripcion:"Gran premio de mitad del camino. Descuento desbloqueable para usar en una visita.",categoria:"cupones",tipo:"reward_coupon",icono:"🎟️",puntos_precio:500,rareza:"raro",slot:"coupon_discount",valor:"10",activo:true},
  {item_key:"reward_coupon_20_final",nombre:"Cupón premium 20%",descripcion:"Gran premio final del camino. Cupón especial desbloqueable para una visita importante.",categoria:"cupones",tipo:"reward_coupon",icono:"🏆",puntos_precio:1500,rareza:"legendario",slot:"coupon_discount",valor:"20",activo:true}
];
function mergeRewardPathItems(catalog=[]){
  const map=new Map();
  [...(catalog||[]),...REWARD_PATH_EXTRA_ITEMS].forEach(x=>{if(x?.item_key)map.set(x.item_key,{...x});});
  return [...map.values()].filter(x=>x.activo!==false);
}
function AvatarRewardPath({user,setUser,currentConfig,onApply,showToast}){
  const [items,setItems]=useState(COSMETIC_CATALOG_FALLBACK);
  const [owned,setOwned]=useState(localOwnedCosmetics(user));
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);

  useEffect(()=>{load();},[user.id]);

  async function load(){
    setLoading(true);
    let catalog=mergeRewardPathItems(COSMETIC_CATALOG_FALLBACK);
    try{
      const {data,error}=await supabase.from("avatar_cosmetics").select("*").eq("activo",true).order("puntos_precio",{ascending:true});
      if(!error && data?.length) catalog=mergeRewardPathItems(data);
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
    if(owned.includes(item.item_key)){
      if(isAvatarPathReward(item)) apply(item);
      else showToast?.(`${item.nombre} ya está desbloqueado`);
      return;
    }
    const price=Number(item.puntos_precio||0);
    if((user.puntos||0)<price){
      showToast?.(`Necesitas ${price} RP para este desbloqueable`);
      SFX.error();
      return;
    }
    const nuevos=Math.max(0,(user.puntos||0)-price);
    const okUser=await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
    if(!okUser){showToast?.("No se pudieron descontar los RP");SFX.error();return;}
    try{
      await supabase.from("user_cosmetics").upsert({usuario_id:String(user.id),item_key:item.item_key,created_at:new Date().toISOString()},{onConflict:"usuario_id,item_key"});
    }catch{}
    let couponRow=null;
    if(isCouponPathReward(item)){
      couponRow=await ensureRewardCouponForUser(user,item);
    }
    const keys=[...new Set([...owned,item.item_key])];
    saveLocalOwnedCosmetics(user,keys);
    setOwned(keys);
    recordPointMovement(user.id,{amount:-price,type:"spend",reason:`Desbloqueo: ${item.nombre}`,source:isCouponPathReward(item)?"camino_cupones":"camino_avatar",balance:nuevos,meta:{item_key:item.item_key,coupon_code:couponRow?.codigo||null}});
    setUser?.(u=>({...u,puntos:nuevos}));
    SFX.success();
    showToast?.(couponRow?.codigo?`${item.nombre} desbloqueado: ${couponRow.codigo}`:`${item.nombre} desbloqueado por ${price} RP`);
    if(isAvatarPathReward(item)) apply(item,true);
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
  const selectedActive=selectedItem&&isAvatarPathReward(selectedItem)?normalizeAvatarConfig(currentConfig,user.avatar)[selectedItem.slot]===selectedItem.valor:false;
  const next=items.find(i=>!owned.includes(i.item_key) && Number(i.puntos_precio||0)>(user.puntos||0)) || items.find(i=>!owned.includes(i.item_key));

  return <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${T.gold}`,overflow:"hidden",padding:14}}>
    <div style={{display:"grid",gap:8,marginBottom:10}}>
      <div style={{minWidth:0}}>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"clamp(1.12rem,5.2vw,1.34rem)",color:T.g800,lineHeight:1.05}}>🎁 Camino de recompensas</div>
        <div style={{fontSize:".76rem",fontWeight:850,color:T.textSub,lineHeight:1.25,marginTop:3}}>Línea de desbloqueos: estilos, fondos, auras y cupones grandes. La tienda queda para juegos y productos reales.</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <Badge col="gold">Nv. {lvl.level}</Badge>
        <Badge col="blue">{user.puntos||0} pts</Badge>
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
      {next&&<div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,marginTop:7}}>Próximo desbloqueable: <b style={{color:T.g800}}>{next.puntos_precio} pts</b></div>}
    </div>

    {loading?<Spinner/>:<>
      <div style={{position:"relative",padding:"12px 0 8px",marginBottom:10}}>
        <div style={{position:"absolute",left:38,right:38,top:49,height:5,background:"linear-gradient(90deg,rgba(58,30,16,.25),rgba(212,175,55,.85),rgba(58,30,16,.25))",borderRadius:999}}/>
        <div style={{display:"flex",gap:4,overflowX:"auto",padding:"0 4px 8px",position:"relative",zIndex:2}}>
          {items.map((item)=>{
            const reached=(user.puntos||0)>=Number(item.puntos_precio||0);
            const has=owned.includes(item.item_key);
            const active=isAvatarPathReward(item)&&normalizeAvatarConfig(currentConfig,user.avatar)[item.slot]===item.valor;
            return <RewardSilhouette key={item.item_key} item={item} user={user} currentConfig={currentConfig} owned={has} reached={reached} active={active} onClick={()=>{SFX.tab();setSelected(item);}}/>;
          })}
        </div>
      </div>

      {selectedItem&&<div style={{display:"grid",gridTemplateColumns:"74px 1fr",gap:10,alignItems:"center",background:"rgba(255,248,225,.72)",border:`2px solid ${selectedReached?T.gold:T.g200}`,borderRadius:18,padding:10}}>
        <div style={{width:68,height:68,borderRadius:"50%",display:"grid",placeItems:"center",background:selectedReached?"linear-gradient(145deg,#FFF4D6,#E6C27A)":"linear-gradient(145deg,#16100C,#3A2A1D)",overflow:"hidden",boxShadow:"inset 0 8px 18px rgba(0,0,0,.18)"}}>
          <div style={{filter:selectedReached||selectedOwned?"none":"grayscale(1) brightness(0)",opacity:selectedReached||selectedOwned?1:.78}}>
            <RewardNodeIcon item={selectedItem} user={user} currentConfig={currentConfig} locked={!selectedReached&&!selectedOwned}/>
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
            {selectedItem.puntos_precio} pts · {rarityLabel(selectedItem.rareza||"comun")}
          </div>
          {selectedOwned?<Btn small full col={selectedActive?"ghost":"gold"} disabled={!isAvatarPathReward(selectedItem)} onClick={()=>isAvatarPathReward(selectedItem)?apply(selectedItem):null}>{rewardActionLabel(selectedItem,true,selectedReached,selectedActive)}</Btn>:
            <Btn small full col={selectedReached?"gold":"ghost"} disabled={!selectedReached} onClick={()=>reveal(selectedItem)}>{rewardActionLabel(selectedItem,false,selectedReached,false)}</Btn>}
        </div>
      </div>}
    </>}
  </Card>;
}


function UserRewardCouponsCard({user,showToast}){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{load();},[user?.id]);

  async function load(){
    if(!user?.id){setRows([]);setLoading(false);return;}
    setLoading(true);
    try{
      const data=await dbGet("user_coupons",`?usuario_id=eq.${user.id}&order=created_at.desc&select=*`);
      setRows(Array.isArray(data)?data:[]);
    }catch{
      setRows([]);
    }
    setLoading(false);
  }

  async function copyCode(code){
    try{await navigator.clipboard.writeText(code);showToast?.("Código de cupón copiado");SFX.success();}
    catch{showToast?.(code);}
  }

  return <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF8E2,#E6CF9B)",border:`2px solid ${T.gold}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10}}>
      <div>
        <div style={{fontWeight:950,color:T.g800}}>🎟️ Mis cupones desbloqueados</div>
        <div style={{fontSize:".76rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>Los cupones grandes ya no viven en la tienda. Se desbloquean en el Camino y quedan guardados aquí.</div>
      </div>
      <Badge col={rows.some(r=>!r.usado&&r.estado!=="usado")?"gold":"green"}>{rows.filter(r=>!r.usado&&r.estado!=="usado").length} activos</Badge>
    </div>
    {loading?<Spinner/>:rows.length===0?<div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>Aún no tienes cupones desbloqueados. Mira el Camino de recompensas: hay uno potente a mitad y otro al final.</div>:
      <div style={{display:"grid",gap:8}}>
        {rows.slice(0,4).map(c=>{
          const used=c.usado||c.estado==="usado";
          return <div key={c.id||c.codigo} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",background:used?"rgba(80,60,40,.14)":"rgba(255,244,214,.72)",border:`1px solid ${used?T.g200:T.gold}`,borderRadius:14,padding:"9px 10px",opacity:used?0.65:1}}>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.nombre||`Cupón ${c.descuento||""}%`}</div>
              <div style={{fontSize:".72rem",fontWeight:900,color:T.textSub}}>Código: <b style={{color:T.g800}}>{c.codigo}</b> · {Number(c.descuento||0)}%</div>
            </div>
            <Btn small col={used?"ghost":"gold"} disabled={used} onClick={()=>copyCode(c.codigo)}>{used?"Usado":"Copiar"}</Btn>
          </div>;
        })}
      </div>}
  </Card>;
}

function Perfil({user,setUser,onLogout,showToast,showPoints,onNavigate,onOpenAudioSettings=null,audioMode="random"}){
  const [tab,setTab]=useState("resumen");
  const [ownedCosmetics,setOwnedCosmetics]=useState(localOwnedCosmetics(user));
  const [privacy,setPrivacy]=useState(normalizePrivacy(user));
  const [form,setForm]=useState({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0),avatar_config:normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0)});
  useEffect(()=>{const savedCfg=normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0);setForm({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:savedCfg,avatar_config:savedCfg});setOwnedCosmetics(localOwnedCosmetics(user));setPrivacy(normalizePrivacy(user));},[user.id,user.nombre,user.avatar,user.avatarConfig,user.avatar_config,user.perfil_publico,user.modo_incognito]);
  async function save(){
    const cfg=normalizeAvatarV3(form.avatarConfig||form.avatar_config,user.id||form.avatar||0);
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
  const nivel=avatarLevelName(user?.avatar_level||avatarLevelFromXP(userXP(user)));
  const cfg=normalizeAvatarV3(form.avatarConfig||form.avatar_config,user.id||form.avatar||0);
  const tabs=[
    {id:"resumen",icon:"👤",label:"Resumen"},
    {id:"editar",icon:"🎨",label:"Editor"},
    {id:"camino",icon:"🎁",label:"Camino"},
    {id:"roles",icon:"⭐",label:"Roles"},
    {id:"logros",icon:"🏆",label:"Logros"},
    {id:"ajustes",icon:"⚙️",label:"Ajustes"},
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
              <Badge col="green">💎 {user.puntos||0} RP</Badge>
              <Badge col="blue">🪙 {user.rc||0} RC</Badge>
            </div>
            <AvatarBadgesStrip user={user} limit={3} dark/>
            <div style={{fontSize:".72rem",fontWeight:800,color:"rgba(255,244,214,.82)",marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{avatarStyleName(cfg)}</div>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:`repeat(${tabs.length},1fr)`,gap:8,marginBottom:12}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setTab(t.id);}} style={{border:`2px solid ${tab===t.id?T.gold:T.g300}`,background:tab===t.id?T.gradGold:"rgba(255,244,214,.82)",color:tab===t.id?T.g900:T.g700,borderRadius:16,padding:"9px 4px",fontWeight:950,cursor:"pointer",boxShadow:tab===t.id?"0 10px 22px rgba(212,175,55,.24)":"0 5px 12px rgba(20,8,4,.1)"}}>
          <div style={{fontSize:"1.1rem",lineHeight:1}}>{t.icon}</div>
          <div style={{fontSize:".68rem",marginTop:3}}>{t.label}</div>
        </button>)}
      </div>

      {tab==="resumen"&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E5BE)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
            <div><div style={{fontSize:"1.35rem"}}>💎</div><div style={{fontWeight:950,color:T.g800}}>{user.puntos||0}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>RP</div></div>
            <div><div style={{fontSize:"1.35rem"}}>🪙</div><div style={{fontWeight:950,color:T.g800}}>{user.rc||0}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>RC</div></div>
            <div><div style={{fontSize:"1.35rem"}}>⭐</div><div style={{fontWeight:950,color:T.g800}}>{userXP(user)}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>XP</div></div>
            <div><div style={{fontSize:"1.35rem"}}>🏆</div><div style={{fontWeight:950,color:T.g800}}>Nv. {user?.avatar_level||avatarLevelFromXP(userXP(user))}</div><div style={{fontSize:".68rem",fontWeight:850,color:T.textSub}}>nivel</div></div>
          </div>
        </Card>
        <AvatarLevelRolesPanel user={user} compact/>
        <AvatarBadgesPanel user={user} compact/>
        <UserRewardCouponsCard user={user} showToast={showToast}/>
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

      {tab==="ajustes"&&<Card style={{marginBottom:16,padding:14,background:"linear-gradient(180deg,#FFF4D6,#E6CF9B)",border:`2px solid ${T.g300}`}}>
        <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>⚙️ Ajustes del perfil</div>
        <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.38,marginTop:4}}>Opciones personales para que la app se adapte mejor a cómo la usas.</div>
        <div style={{display:"grid",gap:10,marginTop:12}}>
          <button onClick={()=>onOpenAudioSettings?.()} style={{border:`2px solid ${T.g200}`,background:"linear-gradient(180deg,#101C15,#07100D)",color:T.white,borderRadius:18,padding:12,textAlign:"left",cursor:"pointer",boxShadow:"0 8px 18px rgba(20,8,4,.16)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div><div style={{fontWeight:1000}}>🎧 Sonido y música</div><div style={{fontSize:".78rem",fontWeight:800,color:"rgba(255,247,218,.72)",lineHeight:1.34,marginTop:3}}>Modo actual: {audioMode==="ambient"?"ambientada por sección":"aleatoria en toda la app"}</div></div>
              <Badge col={audioMode==="ambient"?"blue":"gold"}>{audioMode==="ambient"?"Ambientada":"Aleatoria"}</Badge>
            </div>
          </button>
          <div style={{border:`1px solid ${T.g200}`,borderRadius:18,padding:12,background:"rgba(255,244,214,.62)"}}>
            <div style={{fontWeight:1000,color:T.g800}}>🕶️ Privacidad</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:3}}>La privacidad del perfil se gestiona desde el resumen del perfil.</div>
          </div>
          <div style={{border:`1px solid ${T.g200}`,borderRadius:18,padding:12,background:"rgba(255,244,214,.62)"}}>
            <div style={{fontWeight:1000,color:T.g800}}>🔔 Avisos</div>
            <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:3}}>Las notificaciones importantes aparecen en la campana superior.</div>
          </div>
        </div>
      </Card>}

      {tab==="editar"&&<Card style={{marginBottom:16,padding:12,background:"linear-gradient(180deg,#F6E8C8,#D4BD8F)",border:"2px solid #8E7957"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div><div style={{fontWeight:950,color:T.g800}}>Editor de personaje</div><div style={{fontSize:".78rem",color:T.textSub,fontWeight:800,lineHeight:1.3}}>Ahora se comporta como una ventana de juego: inventario, apariencia, objetos bloqueados, vista previa y guardado directo.</div></div>
          <div className="icon3d" style={{fontSize:"2rem"}}>🎮</div>
        </div>
        <Input label="Nombre" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/>
        <AvatarEditor
          form={form}
          setForm={setForm}
          ownedKeys={ownedCosmetics}
          user={user}
          onSave={save}
          onReset={()=>{const resetCfg=normalizeAvatarV3(user.avatarConfig||user.avatar_config,user.id||user.avatar||0);setForm({nombre:user.nombre,avatar:user.avatar||0,avatarConfig:resetCfg,avatar_config:resetCfg})}}
        />
      </Card>}

      {tab==="camino"&&<AvatarRewardPath user={user} setUser={setUser} currentConfig={cfg} onApply={(newCfg)=>{const clean=normalizeAvatarV3(newCfg,user.id||user.avatar||0);setForm(f=>({...f,avatarConfig:clean,avatar_config:clean}));setOwnedCosmetics(localOwnedCosmetics(user));}} showToast={showToast} showPoints={showPoints}/>}

      {tab==="roles"&&<AvatarLevelRolesPanel user={user}/>}

      {tab==="logros"&&<ObjetivosTrofeos user={user} setUser={setUser} showToast={showToast} showPoints={showPoints} onNavigate={onNavigate}/>}

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
    if(filter==="propia")return full.includes("propio")||full.includes("audio")||full.includes("archivo")||String(item.tipo)==="archivo"||String(item.tipo)==="audio"||Boolean(item.audio_url);
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
          <div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.75rem",lineHeight:1,color:"#FFD66B",textShadow:"0 4px 12px rgba(0,0,0,.35)"}}>Radio Rasta Cuts</div>
          <div style={{fontSize:".84rem",fontWeight:800,color:"rgba(255,244,214,.84)",lineHeight:1.35,marginTop:4}}>Música del local: enlaces, artistas y audios propios o libres bien puestos.</div>
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

    {loading?<Spinner/>:list.length===0?<EmptyState icon="🎧" title="Aquí aún no suena nada" sub="Añade artistas, enlaces o audios desde el panel de música."/>:
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
                  <Badge col={(item.tipo==="archivo"||item.tipo==="audio")?"green":"blue"}>{(item.tipo==="archivo"||item.tipo==="audio")?"Audio":"Enlace"}</Badge>
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
      <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>Para música comercial, mejor enlaces. Sube audios sólo si son tuyos, libres o tienes permiso.</div>
    </Card>
  </div>;
}


function ComunidadCentroPanel({tabs=[],activeId="feed",onSelect=()=>{},settings=null}={}){
  const [stats,setStats]=useState({posts:0,temas:0,respuestas:0,comentarios:0,loading:true});
  useEffect(()=>{
    let alive=true;
    async function load(){
      try{
        const [posts,temas,respuestas,comentarios]=await Promise.all([
          safeList("publicaciones","?tipo=neq.foro&select=id&limit=1000"),
          safeList("foro_temas","?select=id,cerrado,fijado&limit=1000"),
          safeList("foro_respuestas","?select=id&limit=1000"),
          safeList("news_comments","?select=id&limit=1000")
        ]);
        if(alive)setStats({posts:posts.length,temas:temas.length,respuestas:respuestas.length,comentarios:comentarios.length,loading:false});
      }catch(e){
        if(alive)setStats(prev=>({...prev,loading:false}));
      }
    }
    load();
    return()=>{alive=false;};
  },[]);
  const comunidad=settings?.comunidad||{};
  const normas=[
    "El tablón es para avisos del estudio.",
    "El foro es para dudas, propuestas, votaciones y charla entre usuarios.",
    "Los reportes sirven para mantener la comunidad limpia sin discusiones raras."
  ];
  const quick=tabs.slice(0,4);
  return <div style={{marginBottom:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:10}}>
      <StatCard icon="📌" label="Anuncios" value={stats.loading?"…":stats.posts} col="gold"/>
      <StatCard icon="🗣️" label="Temas foro" value={stats.loading?"…":stats.temas} col="green"/>
      <StatCard icon="💬" label="Respuestas" value={stats.loading?"…":stats.respuestas} col="blue"/>
      <StatCard icon="📰" label="Comentarios" value={stats.loading?"…":stats.comentarios} col="pink"/>
    </div>
    <Card style={{background:"linear-gradient(180deg,#FFF4D6,#F4E0B4)",border:`1.5px solid ${T.g200}`,boxShadow:"0 10px 22px rgba(20,8,4,.10)",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontFamily:"'Baloo 2','Plus Jakarta Sans','Outfit',system-ui,sans-serif",fontSize:"1.35rem",fontWeight:950,color:T.g800,lineHeight:1}}>Barrio Rasta Cuts</div>
          <div style={{fontSize:".84rem",fontWeight:820,color:T.textSub,lineHeight:1.38,marginTop:4}}>
            {comunidad.mensaje_comunidad||"Lee el tablón, participa en el foro y mantén una comunidad respetuosa."}
          </div>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {quick.map(t=><button key={t.id} onClick={()=>onSelect(t.id)} style={{border:`2px solid ${activeId===t.id?T.gold:T.g200}`,background:activeId===t.id?T.gradGold:"rgba(255,255,255,.42)",color:activeId===t.id?T.g900:T.g800,borderRadius:999,padding:"7px 10px",fontWeight:950,cursor:"pointer",boxShadow:activeId===t.id?"0 8px 16px rgba(185,154,69,.22)":"none"}}>{t.icon} {t.label}</button>)}
        </div>
      </div>
    </Card>
    <Card style={{background:"linear-gradient(135deg,rgba(33,20,12,.96),rgba(75,48,27,.92))",border:"1.5px solid rgba(255,244,214,.24)",color:T.white,padding:"12px 13px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>
        {normas.map((n,i)=><div key={n} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:".78rem",fontWeight:820,lineHeight:1.32,color:"rgba(255,244,214,.86)"}}><span style={{display:"grid",placeItems:"center",width:22,height:22,borderRadius:999,background:i===0?"#B99A45":i===1?"#4F602D":"#263F4D",color:"#FFF4D6",fontWeight:1000,flexShrink:0}}>{i+1}</span><span>{n}</span></div>)}
      </div>
    </Card>
  </div>;
}


function ComunidadPerfiles({user,showToast}={}){
  const [profiles,setProfiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState("");
  const [selected,setSelected]=useState(null);
  useEffect(()=>{load();},[]);
  async function load(){
    setLoading(true);
    try{
      const rows=await dbGet("usuarios","?select=*&order=puntos.desc&limit=80");
      const enriched=await enrichProfilesWithAvatarConfigs(Array.isArray(rows)?rows:[]);
      setProfiles(enriched.filter(p=>!isBannedProfile(p)));
    }catch(e){
      console.warn("No se pudieron cargar perfiles de comunidad",e);
      showToast?.("No se pudieron cargar perfiles");
    }
    setLoading(false);
  }
  const clean=normalizeText(q);
  const visibles=profiles.filter(p=>{
    if(!clean)return true;
    return normalizeText(`${p.nombre||""} ${p.email||""} ${avatarLevelName(p.avatar_level||avatarLevelFromXP(userXP(p)))}`).includes(clean);
  });
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <SectionHeader icon="👥" title="Gente del estudio" sub="Usuarios, niveles, insignias y progreso sin mezclarlo con el tablón ni el foro." action={<Btn small col="ghost" onClick={load}>↻</Btn>}/>
    <Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#F6E7C4)",border:`1.5px solid ${T.g200}`}}>
      <Input label="Buscar usuario" value={q} onChange={setQ} placeholder="Nombre, email, nivel o rol..."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        <StatCard icon="👥" label="Perfiles" value={profiles.length} col="blue"/>
        <StatCard icon="⭐" label="Nivel medio" value={profiles.length?Math.round(profiles.reduce((s,p)=>s+Number(p.avatar_level||avatarLevelFromXP(userXP(p))),0)/profiles.length):0} col="pink"/>
        <StatCard icon="💎" label="RP total" value={profiles.reduce((s,p)=>s+Number(p.puntos||0),0)} col="gold"/>
      </div>
    </Card>
    {loading?<Spinner/>:visibles.length===0?<EmptyState icon="👥" title="Sin perfiles" sub="Prueba otra búsqueda o espera a que haya más actividad."/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(158px,1fr))",gap:10}}>
        {visibles.map(p=><Card key={p.id||p.email} hover onClick={()=>setSelected(p)} style={{padding:12,background:"linear-gradient(180deg,#FFF8E6,#E9D9B7)",border:`1.5px solid ${T.g200}`}}>
          <div style={{display:"flex",gap:9,alignItems:"center"}}>
            <PublicAvatar profile={p} currentUser={user} size={42}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:950,color:T.g800,fontSize:".86rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{publicName(p,user)}</div>
              <div style={{fontSize:".68rem",fontWeight:850,color:T.textSub,textTransform:"uppercase"}}>{publicRoleLabel(p,user)}</div>
            </div>
          </div>
          <div style={{marginTop:9}}><AvatarMiniIdentity profile={p} currentUser={user} limit={3} showCurrency/></div>
        </Card>)}
      </div>
    }
    <Modal show={!!selected} onClose={()=>setSelected(null)} title={selected?publicName(selected,user):"Perfil"}>
      {selected&&<div>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
          <PublicAvatar profile={selected} currentUser={user} size={64}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:950,color:T.g800,fontSize:"1rem"}}>{publicName(selected,user)}</div>
            <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub}}>{avatarLevelName(selected.avatar_level||avatarLevelFromXP(userXP(selected)))}</div>
            <AvatarMiniIdentity profile={selected} currentUser={user} limit={4} showCurrency/>
          </div>
        </div>
        <AvatarBadgesPanel user={selected}/>
      </div>}
    </Modal>
  </div>;
}

function Comunidad(props){
  const {initialTab="feed",showToast,settings}=props;
  const sec=settings?.secciones||{};
  const [sub,setSub]=useState(initialTab||"feed");
  useEffect(()=>{setSub(initialTab||"feed");},[initialTab]);
  const tabs=[
    {id:"feed",icon:"📌",label:"Tablón",sub:"Avisos del estudio: novedades, promos, normas, eventos y cambios importantes.",enabled:true},
    {id:"foro",icon:"🗣️",label:"Foro",sub:"Temas abiertos por usuarios: dudas, propuestas, votaciones y conversación real.",enabled:sec.foro_activo!==false},
    {id:"noticias",icon:"📰",label:"Actualidad",sub:"Noticias y curiosidades con comentarios: rural, comida, sitios, peluquería y negocios locales.",enabled:sec.noticias_activas!==false},
    {id:"perfiles",icon:"👥",label:"Perfiles",sub:"Mira usuarios, niveles, insignias, RP, RC y progreso visible.",enabled:true},
    {id:"musica",icon:"🎧",label:"Música",sub:"Reggae, rap clásico, ska y rock con enlaces rápidos para descubrir buena música.",enabled:sec.musica_activa!==false},
  ].filter(t=>t.enabled);
  const active=tabs.find(t=>t.id===sub)||tabs[0]||{id:"feed",icon:"📌",label:"Tablón"};
  return <div style={{animation:"fadeSlide .32s ease"}}>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#162015 0%,#355533 48%,#D7B64C 118%)",border:"2px solid rgba(255,244,214,.62)",color:T.white,padding:"18px 16px",boxShadow:"0 16px 34px rgba(18,8,4,.26)"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Baloo 2','Plus Jakarta Sans','Outfit',system-ui,sans-serif",fontSize:"1.72rem",fontWeight:950,lineHeight:1,letterSpacing:"-.3px"}}>Comunidad Rasta</div>
          <div style={{fontSize:".86rem",fontWeight:850,color:"rgba(255,244,214,.88)",lineHeight:1.42,marginTop:5}}>Tablón del estudio, foro, actualidad y perfiles separados para que se entienda rápido dónde leer, participar o buscar a la gente.</div>
        </div>
        <div className="icon3d" style={{fontSize:"2.25rem"}}>🌐</div>
      </div>
    </Card>
    <ComunidadCentroPanel tabs={tabs} activeId={active.id} onSelect={(id)=>{SFX.tab();setSub(id);}} settings={settings}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(78px,1fr))",gap:8,marginBottom:12}}>
      {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setSub(t.id);}} style={{border:`2px solid ${active.id===t.id?T.gold:T.g300}`,background:active.id===t.id?T.gradGold:"rgba(255,244,214,.82)",color:active.id===t.id?T.g900:T.g700,borderRadius:16,padding:"10px 6px",fontWeight:950,cursor:"pointer",boxShadow:active.id===t.id?"0 10px 24px rgba(212,175,55,.25)":"0 6px 14px rgba(20,8,4,.1)",minHeight:64}}>
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
    {active.id==="perfiles"&&<ComunidadPerfiles {...props}/>} 
    {active.id==="musica"&&<MusicaComunidad {...props}/>} 
  </div>;
}


function GestionTienda({user,showToast}){
  if(!isAdminUser(user)) return <EmptyState icon="🔒" title="Sólo admin" sub="La tienda editable sólo puede gestionarla el administrador."/>;
  const empty={id:null,item_key:"",nombre:"",descripcion:"",categoria:"juegos",tipo:"gacha_pulls",icono:"🎰",puntos_precio:"5",precio_euros:"",stock:"",activo:"true",rareza:"comun",slot:"gacha_pulls",valor:"10",juego_bonus_tipo:"gacha_pulls",juego_bonus_cantidad:"10"};
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showEdit,setShowEdit]=useState(false);
  const [form,setForm]=useState(empty);
  const [filter,setFilter]=useState("todo");

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("tienda_items","?order=created_at.desc&select=*");
    const rows=Array.isArray(data)?data:[];
    setItems(rows.filter(x=>isGameVoucherItem(x)||isRealMoneyProduct(x)||["juegos","productos"].includes(itemShopCategory(x))));
    setLoading(false);
  }

  function openNew(){
    setForm({...empty,item_key:`item_${Date.now()}`});
    setShowEdit(true);
  }
  function openGachaVoucher(){
    setForm({...empty,item_key:`gacha_10_${Date.now()}`,nombre:"Vale 10 tiradas Gacha",descripcion:"Canje: pagas 5 RP y recibes 10 tiradas extra para el Gacha Barber. Se aplica al momento y queda guardado en tu perfil.",categoria:"juegos",tipo:"gacha_pulls",icono:"🎰",puntos_precio:"5",stock:"",rareza:"comun",slot:"gacha_pulls",valor:"10",juego_bonus_tipo:"gacha_pulls",juego_bonus_cantidad:"10"});
    setShowEdit(true);
  }
  function openRealProduct(){
    setForm({...empty,item_key:`producto_${Date.now()}`,nombre:"Producto peluquería",descripcion:"Producto físico de la peluquería. El pago se confirma en tienda.",categoria:"productos",tipo:"producto_real",icono:"🧴",puntos_precio:"0",precio_euros:"9.99",stock:"",rareza:"comun"});
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
      precio_euros:item.precio_euros===null||item.precio_euros===undefined?"":String(item.precio_euros),
      stock:item.stock===null||item.stock===undefined?"":String(item.stock),
      activo:String(item.activo!==false),
      rareza:item.rareza||"comun",
      slot:item.slot||"",
      valor:item.valor||"",
      juego_bonus_tipo:item.juego_bonus_tipo||"",
      juego_bonus_cantidad:item.juego_bonus_cantidad===null||item.juego_bonus_cantidad===undefined?"":String(item.juego_bonus_cantidad)
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
      precio_euros:form.precio_euros===""?null:Math.max(0,Number(String(form.precio_euros).replace(",","."))||0),
      moneda:form.categoria==="productos"?"EUR":"puntos",
      requiere_pago_real:form.categoria==="productos"||form.tipo==="producto_real",
      stock:form.stock===""?null:Math.max(0,parseInt(form.stock||"0",10)||0),
      activo:form.activo==="true",
      rareza:form.rareza,
      slot:form.slot.trim()||null,
      valor:form.valor.trim()||null,
      juego_bonus_tipo:form.juego_bonus_tipo.trim()||((form.tipo||"").includes("gacha")?"gacha_pulls":null),
      juego_bonus_cantidad:form.juego_bonus_cantidad===""?(form.tipo==="gacha_pulls"?Math.max(1,parseInt(form.valor||"10",10)||10):null):Math.max(1,parseInt(form.juego_bonus_cantidad||"0",10)||0),
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
    {id:"juegos",label:"Tienda juegos"},
    {id:"productos",label:"Productos €"}
  ];
  const visibles=filter==="todo"?items:items.filter(i=>itemShopCategory(i)===filter || String(i.categoria||"").toLowerCase()===filter);

  return(
    <div style={{animation:"fadeSlide .34s ease"}}>
      <SectionHeader icon="🛍️" title="Tienda juegos" sub={`${items.length} artículos configurados`} action={<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}><Btn small col="gold" onClick={openNew}>+ Producto</Btn><Btn small col="dark" onClick={openGachaVoucher}>+ Vale Gacha</Btn><Btn small col="ghost" onClick={openRealProduct}>+ Producto €</Btn></div>}/>
      <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="icon3d" style={{fontSize:"2rem"}}>🛠️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:950,fontSize:"1rem"}}>Administra vales de juegos y productos</div>
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.82,lineHeight:1.35}}>Crea vales de Gacha u otros extras de juegos. Los estilos, fondos y cupones van en Perfil &gt; Camino de recompensas.</div>
          </div>
        </div>
      </Card>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=><button key={c.id} onClick={()=>{SFX.tab();setFilter(c.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===c.id?T.gold:T.g300}`,background:filter===c.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===c.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{c.label}</button>)}
      </div>

      {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin artículos" sub="Crea un vale de Gacha o un producto real."/>:
        visibles.map(item=><Card key={item.id} style={{marginBottom:10,background:item.activo?"linear-gradient(180deg,#FFF4D6,#E9D9B7)":"linear-gradient(180deg,#E6CF9B,#D8BE87)",opacity:item.activo?1:.72}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div className="icon3d" style={{fontSize:"2rem"}}>{item.icono||"🎁"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <b style={{color:T.g800}}>{item.nombre}</b>
                <Badge col={item.activo?"green":"red"}>{item.activo?"activo":"oculto"}</Badge>
              </div>
              <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:3}}>{item.descripcion}</div>
              {isGameVoucherItem(item)&&<div style={{marginTop:7,background:"rgba(38,63,77,.10)",border:`1px solid ${T.g200}`,borderRadius:12,padding:"7px 9px",fontSize:".76rem",fontWeight:950,color:T.g800,lineHeight:1.35}}>
                Configuración visible: <b>{item.puntos_precio||0} pts</b> → <b>+{gameVoucherAmount(item)} tiradas Gacha</b>. Compra repetible y aplicada al momento.
              </div>}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                <Badge col="gold">{isRealMoneyProduct(item)?(itemEuroPrice(item)?`${itemEuroPrice(item).toFixed(2)} €`:"Producto €"):isGameVoucherItem(item)?`${item.puntos_precio||0} pts → +${gameVoucherAmount(item)} tiradas`:`${item.puntos_precio} pts`}</Badge>
                <Badge col="blue">{shopCategoryLabel(itemShopCategory(item))}</Badge>
                {isGameVoucherItem(item)&&<Badge col="green">Vale Gacha repetible</Badge>}
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
          <Input label="Precio en puntos" value={form.puntos_precio} onChange={v=>setForm(f=>({...f,puntos_precio:v}))} type="number"/>
        </div>
        <Input label="Precio euros opcional (sólo productos reales)" value={form.precio_euros} onChange={v=>setForm(f=>({...f,precio_euros:v}))} placeholder="9.99"/>
        <Select label="Categoría" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={[
          {value:"juegos",label:"Tienda juegos"},
          {value:"productos",label:"Productos reales €"}
        ]}/>
        <Select label="Tipo" value={form.tipo} onChange={v=>setForm(f=>({...f,tipo:v}))} options={[
          {value:"cupon",label:"Cupón"},
          {value:"avatar",label:"Avatar"},
          {value:"bonus",label:"Bonus juego"},
          {value:"gacha_pulls",label:"Vale Gacha tiradas"},
          {value:"producto_real",label:"Producto real €"},
          {value:"canje",label:"Canje/premio"}
        ]}/>
        {form.tipo==="gacha_pulls"&&<Card style={{marginBottom:12,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800}}>🎰 Ejemplo claro</div>
          <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>Precio en RP = lo que paga el usuario. Tiradas/cantidad que añade = lo que recibe en el Gacha. Para tu vale actual: <b>5 RP</b> y <b>10 tiradas</b>.</div>
        </Card>}
        <Select label="Rareza" value={form.rareza} onChange={v=>setForm(f=>({...f,rareza:v}))} options={[
          {value:"comun",label:"Común"},
          {value:"raro",label:"Raro"},
          {value:"epico",label:"Épico"},
          {value:"legendario",label:"Legendario"}
        ]}/>
        <Input label="Stock vacío = ilimitado" value={form.stock} onChange={v=>setForm(f=>({...f,stock:v}))} type="number"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Slot avatar/juego" value={form.slot} onChange={v=>setForm(f=>({...f,slot:v}))} placeholder="aura, bg, frame, gacha_pulls..."/>
          <Input label="Valor que se aplica" value={form.valor} onChange={v=>setForm(f=>({...f,valor:v}))} placeholder="warm, flame, 10..."/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Tipo bonus juego" value={form.juego_bonus_tipo} onChange={v=>setForm(f=>({...f,juego_bonus_tipo:v}))} placeholder="gacha_pulls"/>
          <Input label="Tiradas/cantidad que añade" value={form.juego_bonus_cantidad} onChange={v=>setForm(f=>({...f,juego_bonus_cantidad:v}))} type="number"/>
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
  branding:{nombre_tienda:"Rasta Cuts",slogan:"Reserva, juega, participa y desbloquea recompensas.",mensaje_login:"Forma parte de la comunidad Rasta Cuts.",emoji_principal:"🔥",mascota_rasta_url:""},
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
function DisabledSection({icon="🔒",title="Sección desactivada",sub="Esta sección está desactivada desde Gestión &gt; Ajustes."}){
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
    branding:{nombre_tienda:"Rasta Cuts",slogan:"Reserva, juega, participa y desbloquea recompensas.",mensaje_login:"Forma parte de la comunidad Rasta Cuts.",emoji_principal:"🔥",mascota_rasta_url:""},
    puntos:{puntos_por_cita_cobrada:10,puntos_por_comentario:3,puntos_por_like:1,limite_diario_juegos:75,gacha_tiradas_dia:50},
    secciones:{tienda_activa:true,arcade_activo:true,musica_activa:true,noticias_activas:true,foro_activo:true,gacha_activo:true},
    musica:{musica_activa_por_defecto:false,volumen_general:0.7,modo:"jazz_lofi_reggae",descripcion:"Música suave tipo jazz lofi reggae."},
    rasta_helper:{modo_ayuda_activo:true,tips_diarios:true,mostrar_bocadillos_automaticos:false,tono:"util_profesional_divertido"}
  };
  const META={
    branding:{icon:"🏷️",title:"Marca",sub:"Nombre, slogan y textos principales.",categoria:"general"},
    puntos:{icon:"💎",title:"RP",sub:"Fidelidad y límites de RP. No equivalen a euros.",categoria:"puntos"},
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
          <TextField k="branding" f="mascota_rasta_url" label="URL imagen mascota Rasta" placeholder="/rasta-mascota.png o https://..."/>
        </>}

        {active==="puntos"&&<>
          <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EBD8A8,#D7B777)",border:`1.5px solid ${T.gold}`,padding:12}}>
            <div style={{fontWeight:950,color:T.g800}}>Regla importante</div>
            <div style={{fontSize:".8rem",fontWeight:850,color:T.textSub,lineHeight:1.35,marginTop:4}}>Los RP son fidelidad y recompensas. No equivalen a euros ni se usan como dinero.</div>
          </Card>
          <NumberField k="puntos" f="puntos_por_cita_cobrada" label="RP por cita cobrada"/>
          <NumberField k="puntos" f="puntos_por_comentario" label="RP por comentario"/>
          <NumberField k="puntos" f="puntos_por_like" label="RP por like"/>
          <NumberField k="puntos" f="limite_diario_juegos" label="Límite diario de RP en juegos"/>
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
    {id:"archivo",label:"Audios"}
  ];
  const visibles=filter==="todo"?items:items.filter(i=>{
    if(filter==="archivo")return String(i.tipo)==="archivo"||String(i.tipo)==="audio"||Boolean(i.audio_url);
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
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Añade enlaces del estudio o sube audios propios/libres al bucket público musica.</div>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:14,background:"linear-gradient(180deg,#EFE0BE,#D6BE87)",border:`2px dashed ${T.g400}`}}>
        <div style={{fontWeight:950,color:T.g800}}>⚠️ Regla importante</div>
        <div style={{fontSize:".82rem",fontWeight:800,color:T.textSub,lineHeight:1.35,marginTop:4}}>No subas MP3 comerciales descargados. Para artistas conocidos usa enlaces externos; para audios, sólo música tuya, libre o con permiso.</div>
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
        <Input label="Título" value={form.titulo} onChange={v=>setForm(f=>({...f,titulo:v}))} placeholder="Ej: Morodo - búsqueda del estudio"/>
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
          {value:"archivo",label:"Audio propio/libre"}
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
      <SectionHeader icon="🗓️" title="Agenda" sub={modo==="dia"?"El día puesto en orden, hora por hora":"Vista semanal compacta"}/>
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
  if(!isInternalUser(user)) return <EmptyState icon="🔒" title="Acceso interno" sub="Sólo admin y staff pueden acceder a pedidos."/>;
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("pendiente");
  const [q,setQ]=useState("");
  const [edit,setEdit]=useState(null);
  const [detail,setDetail]=useState(null);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const data=await dbGet("tienda_pedidos","?order=created_at.desc&limit=500&select=*");
    setPedidos(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  function estadoPedido(p){return String(p?.estado||"pendiente").toLowerCase();}
  function pedidoItems(p){return Array.isArray(p?.items)?p.items:[];}
  function pedidoTotal(p){return Number(p?.total_puntos||p?.puntos_coste||0);}
  function pedidoNombre(p){return p?.item_nombre||p?.nombre||"Pedido";}
  function pedidoCliente(p){return p?.cliente_nombre||p?.usuario_nombre||p?.cliente_email||p?.usuario_id||"Cliente";}
  function estadoBadgeCol(estado){return estado==="entregado"?"green":estado==="cancelado"?"red":estado==="listo"?"blue":estado==="preparando"?"pink":"gold";}

  async function auditPedido(pedido,estado,extra={}){
    try{
      await dbPost("seguridad_auditoria",{
        tipo:"pedido_estado",
        entidad:"tienda_pedidos",
        entidad_id:String(pedido.id),
        usuario_afectado_id:pedido.usuario_id?String(pedido.usuario_id):null,
        usuario_afectado_email:pedido.cliente_email||null,
        valor_anterior:String(pedido.estado||"pendiente"),
        valor_nuevo:String(estado),
        detalle:`Pedido ${pedidoNombre(pedido)} cambiado de ${pedido.estado||"pendiente"} a ${estado}`,
        created_at:new Date().toISOString()
      });
    }catch(e){console.warn("No se pudo auditar pedido",e);}
  }

  async function setEstado(pedido,estado,extra={}){
    const now=new Date().toISOString();
    const anterior=estadoPedido(pedido);
    const patch={estado,updated_at:now,...extra};
    if(estado==="preparando") patch.preparado_por=user?.email||user?.nombre||"staff";
    if(estado==="listo") patch.fecha_preparado=now;
    if(estado==="entregado"){patch.fecha_entregado=now;patch.entregado_por=user?.email||user?.nombre||"staff";}
    if(estado==="cancelado") patch.fecha_cancelado=now;
    const ok=await dbPatch("tienda_pedidos",`?id=eq.${pedido.id}`,patch);
    if(ok){
      SFX.success();
      showToast?.(`Pedido ${estado}`);
      await auditPedido({...pedido,estado:anterior},estado,extra);
      await createNotification({usuario_id:pedido.usuario_id,rol_destino:"client",tipo:"pedido",titulo:`Pedido ${estado}`,mensaje:`Tu pedido de ${pedidoNombre(pedido)} está ${estado}.`,entidad_tipo:"tienda_pedido",entidad_id:pedido.id,importante:estado==="listo"});
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
    const pts=pedidoTotal(pedido);
    if(pts>0&&pedido.usuario_id){
      const rows=await dbGet("usuarios",`?id=eq.${pedido.usuario_id}&select=id,puntos,email,nombre&limit=1`);
      const actual=Number(rows?.[0]?.puntos||0);
      const nuevos=actual+pts;
      const okRefund=await dbPatch("usuarios",`?id=eq.${pedido.usuario_id}`,{puntos:nuevos});
      if(okRefund)recordPointMovement(pedido.usuario_id,{amount:pts,type:"refund",reason:`Devolución: ${pedidoNombre(pedido)}`,source:"devolucion",balance:nuevos,usuario_email:rows?.[0]?.email||pedido.cliente_email||null,usuario_nombre:rows?.[0]?.nombre||pedido.cliente_nombre||null,meta:{pedido_id:pedido.id}});
    }
    await setEstado(pedido,"cancelado",{motivo_cancelacion:"Cancelado desde gestión con devolución de RP"});
  }

  function copyPedido(p){
    const items=pedidoItems(p).map(it=>`- ${it.nombre||"Artículo"} x${it.qty||1} · ${Number(it.total_puntos||it.puntos||0)} RP`).join("\n");
    const txt=`Pedido Rasta Cuts\nCliente: ${pedidoCliente(p)}\nEmail: ${p.cliente_email||"sin email"}\nEstado: ${estadoPedido(p)}\nTotal: ${pedidoTotal(p)} RP\nPedido: ${pedidoNombre(p)}\n${items?`\nArtículos:\n${items}`:""}`;
    try{navigator.clipboard?.writeText(txt);showToast?.("Resumen copiado");SFX.success();}catch{showToast?.("No se pudo copiar");}
  }

  const tabs=[
    {id:"pendiente",label:"Pendientes"},{id:"preparando",label:"Preparando"},{id:"listo",label:"Listos"},{id:"entregado",label:"Entregados"},{id:"cancelado",label:"Cancelados"},{id:"todos",label:"Todos"}
  ];
  const query=normalizeText(q);
  const base=filter==="todos"?pedidos:pedidos.filter(p=>estadoPedido(p)===filter);
  const visibles=query?base.filter(p=>normalizeText(`${pedidoNombre(p)} ${pedidoCliente(p)} ${p.cliente_email||""} ${p.item_id||""} ${p.id||""}`).includes(query)):base;
  const countEstado=id=>id==="todos"?pedidos.length:pedidos.filter(p=>estadoPedido(p)===id).length;
  const activos=pedidos.filter(p=>["pendiente","preparando","listo"].includes(estadoPedido(p)));
  const listos=pedidos.filter(p=>estadoPedido(p)==="listo");
  const pendientes=pedidos.filter(p=>estadoPedido(p)==="pendiente");
  const puntosPendientes=activos.reduce((sum,p)=>sum+pedidoTotal(p),0);

  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="🛍️" title="Pedidos de tienda" sub="Canjes pendientes, preparación, entrega y auditoría" action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>🎁</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Gestión de canjes real</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Cada cambio de estado se notifica al cliente y queda registrado en auditoría. Puedes buscar por cliente, email, artículo o ID.</div>
        </div>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:12}}>
      <StatCard icon="⏳" label="Pendientes" value={pendientes.length} col={pendientes.length?"gold":"green"}/>
      <StatCard icon="📦" label="Activos" value={activos.length} col={activos.length?"pink":"green"}/>
      <StatCard icon="✅" label="Listos" value={listos.length} col={listos.length?"blue":"green"}/>
      <StatCard icon="⭐" label="RP activos" value={puntosPendientes} col="gold"/>
    </div>

    <Card style={{marginBottom:12,padding:12,background:"rgba(255,244,214,.78)",boxShadow:"none"}}>
      <Input label="Buscar pedido" value={q} onChange={setQ} placeholder="cliente, email, artículo, ID..."/>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setFilter(t.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===t.id?T.gold:T.g300}`,background:filter===t.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===t.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{t.label} ({countEstado(t.id)})</button>)}
      </div>
    </Card>

    {loading?<Spinner/>:visibles.length===0?<EmptyState icon="🛍️" title="Sin pedidos" sub="No hay pedidos en esta vista."/>:visibles.map(p=><Card key={p.id} style={{marginBottom:10,background:estadoPedido(p)==="cancelado"?"linear-gradient(180deg,#E6CF9B,#D8BE87)":"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:estadoPedido(p)==="pendiente"?`2px solid ${T.gold}`:`1.5px solid ${T.g300}`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}><Badge col={estadoBadgeCol(estadoPedido(p))}>{estadoPedido(p)}</Badge><Badge col="gold">{pedidoTotal(p)} pts</Badge>{pedidoItems(p).length>1&&<Badge col="blue">{pedidoItems(p).length} artículos</Badge>}</div>
          <div style={{fontWeight:950,color:T.g800}}>{pedidoNombre(p)}</div>
          {pedidoItems(p).length>0&&<div style={{marginTop:6,display:"grid",gap:4}}>{pedidoItems(p).slice(0,5).map((it,idx)=><div key={idx} style={{fontSize:".72rem",fontWeight:850,color:T.textSub,background:"rgba(255,244,214,.52)",borderRadius:9,padding:"5px 7px"}}>• {it.nombre||"Artículo"} x{it.qty||1} · {Number(it.total_puntos||it.puntos||0)} pts</div>)}{pedidoItems(p).length>5&&<div style={{fontSize:".7rem",fontWeight:850,color:T.textSub}}>+{pedidoItems(p).length-5} artículo(s) más</div>}</div>}
          <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,marginTop:3}}>👤 {pedidoCliente(p)} · {p.cliente_email||"sin email"}</div>
          <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub,marginTop:3}}>Creado: {p.created_at?new Date(p.created_at).toLocaleString("es-ES"):"sin fecha"}</div>
          {(p.preparado_por||p.entregado_por)&&<div style={{fontSize:".7rem",fontWeight:850,color:T.textSub,marginTop:3}}>Staff: {p.preparado_por||p.entregado_por}</div>}
          {p.notas_admin&&<div style={{fontSize:".74rem",fontWeight:850,color:T.g800,marginTop:6,background:"rgba(255,244,214,.52)",borderRadius:10,padding:7}}>🔒 {p.notas_admin}</div>}
          {p.motivo_cancelacion&&<div style={{fontSize:".74rem",fontWeight:850,color:T.red,marginTop:6}}>Motivo: {p.motivo_cancelacion}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
        {estadoPedido(p)==="pendiente"&&<Btn small col="gold" onClick={()=>setEstado(p,"preparando")}>Preparar</Btn>}
        {["pendiente","preparando"].includes(estadoPedido(p))&&<Btn small col="blue" onClick={()=>setEstado(p,"listo")}>Listo</Btn>}
        {["pendiente","preparando","listo"].includes(estadoPedido(p))&&<Btn small col="green" onClick={()=>setEstado(p,"entregado")}>Entregado</Btn>}
        {!["cancelado","entregado"].includes(estadoPedido(p))&&<Btn small col="red" onClick={()=>cancelarConDevolucion(p)}>Cancelar + devolver</Btn>}
        <Btn small col="ghost" onClick={()=>setDetail(p)}>Detalle</Btn>
        <Btn small col="ghost" onClick={()=>setEdit({...p})}>Notas</Btn>
        <Btn small col="ghost" onClick={()=>copyPedido(p)}>Copiar</Btn>
      </div>
    </Card>)}

    <Modal show={!!detail} onClose={()=>setDetail(null)} title="Detalle del pedido">
      {detail&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}><Badge col={estadoBadgeCol(estadoPedido(detail))}>{estadoPedido(detail)}</Badge><Badge col="gold">{pedidoTotal(detail)} pts</Badge></div>
          <div style={{fontWeight:950,color:T.g800}}>{pedidoNombre(detail)}</div>
          <div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>{pedidoCliente(detail)} · {detail.cliente_email||"sin email"}</div>
          <div style={{fontSize:".7rem",fontWeight:800,color:T.textSub,marginTop:4}}>ID: {detail.id}</div>
        </Card>
        <Card style={{marginBottom:12,padding:12}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Artículos</div>
          {pedidoItems(detail).length===0?<div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Este pedido no tiene JSON de artículos.</div>:pedidoItems(detail).map((it,idx)=><div key={idx} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 0",borderTop:idx?`1px solid ${T.g150}`:"none"}}>
            <div><div style={{fontWeight:950,color:T.g800}}>{it.nombre||"Artículo"}</div><div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{it.categoria||"sin categoría"} · {it.tipo||"tipo"}{it.item_key?` · ${it.item_key}`:""}</div></div>
            <div style={{fontWeight:950,color:T.g700,textAlign:"right"}}>x{it.qty||1}<br/><span style={{fontSize:".75rem"}}>{Number(it.total_puntos||it.puntos||0)} pts</span></div>
          </div>)}
        </Card>
        <Card style={{padding:12}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>Trazabilidad</div>
          <div style={{fontSize:".78rem",fontWeight:850,color:T.textSub,lineHeight:1.6}}>Creado: {detail.created_at?new Date(detail.created_at).toLocaleString("es-ES"):"sin fecha"}<br/>Actualizado: {detail.updated_at?new Date(detail.updated_at).toLocaleString("es-ES"):"sin fecha"}<br/>Preparado por: {detail.preparado_por||"—"}<br/>Entregado por: {detail.entregado_por||"—"}</div>
        </Card>
      </>}
    </Modal>

    <Modal show={!!edit} onClose={()=>setEdit(null)} title="Editar pedido">
      {edit&&<>
        <Card style={{marginBottom:12,background:"linear-gradient(180deg,#E6CF9B,#D8BE87)",padding:12}}><div style={{fontWeight:950,color:T.g800}}>{pedidoNombre(edit)}</div><div style={{fontSize:".78rem",fontWeight:800,color:T.textSub,marginTop:4}}>{pedidoCliente(edit)} · {estadoPedido(edit)}</div></Card>
        <Input label="Notas internas" value={edit.notas_admin||""} onChange={v=>setEdit(e=>({...e,notas_admin:v}))}/>
        <Input label="Motivo de cancelación" value={edit.motivo_cancelacion||""} onChange={v=>setEdit(e=>({...e,motivo_cancelacion:v}))}/>
        <Btn full col="gold" onClick={guardarNotas}>Guardar</Btn>
      </>}
    </Modal>
  </div>;
}


function GestionCuponesAdmin({user,showToast}){
  if(!isInternalUser(user)) return <EmptyState icon="🔒" title="Acceso interno" sub="Sólo admin y staff pueden acceder a cupones."/>;
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("activos");
  const [q,setQ]=useState("");

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    try{
      const data=await dbGet("user_coupons","?order=created_at.desc&limit=500&select=*");
      setRows(Array.isArray(data)?data:[]);
    }catch(e){
      console.warn("No se pudieron cargar cupones",e);
      setRows([]);
    }
    setLoading(false);
  }

  function estadoCupon(c={}){
    if(c.usado||String(c.estado||"").toLowerCase()==="usado")return "usado";
    const e=String(c.estado||"disponible").toLowerCase();
    return e||"disponible";
  }
  function estadoColor(e){return e==="usado"?"green":e==="cancelado"?"red":e==="caducado"?"pink":"gold";}
  function clienteCupon(c){return c.usuario_nombre||c.usuario_email||c.usuario_id||"Cliente";}
  function descCupon(c){return Number(c.descuento||0)||Number(String(c.valor||"0").replace(/\D/g,""))||0;}

  async function auditCupon(c,estado){
    try{
      await dbPost("seguridad_auditoria",{
        tipo:"cupon_estado",
        entidad:"user_coupons",
        entidad_id:String(c.id),
        usuario_afectado_id:c.usuario_id?String(c.usuario_id):null,
        usuario_afectado_email:c.usuario_email||null,
        valor_anterior:String(c.estado||"disponible"),
        valor_nuevo:String(estado),
        detalle:`Cupón ${c.codigo||c.nombre} cambiado a ${estado}`,
        created_at:new Date().toISOString()
      });
    }catch(e){console.warn("No se pudo auditar cupón",e);}
  }

  async function setEstado(c,estado){
    const now=new Date().toISOString();
    const patch={estado,usado:estado==="usado",used_at:estado==="usado"?now:null,usado_en:estado==="usado"?`Marcado por ${user?.email||user?.nombre||"staff"}`:null};
    const ok=await dbPatch("user_coupons",`?id=eq.${c.id}`,patch);
    if(ok){
      await auditCupon(c,estado);
      await createNotification({usuario_id:c.usuario_id,rol_destino:"client",tipo:"cupon",titulo:`Cupón ${estado}`,mensaje:`Tu cupón ${c.codigo||c.nombre} ahora está ${estado}.`,entidad_tipo:"user_coupon",entidad_id:c.id,importante:estado==="usado"});
      SFX.success();
      showToast?.(`Cupón ${estado}`);
      await load();
    }else{
      SFX.error();
      showToast?.("No se pudo actualizar el cupón");
    }
  }

  async function copyCode(code){
    try{await navigator.clipboard.writeText(code);showToast?.("Código copiado");SFX.success();}
    catch{showToast?.(code||"Sin código");}
  }

  const query=normalizeText(q);
  const filtered=rows.filter(c=>{
    const e=estadoCupon(c);
    if(filter==="activos" && e!=="disponible")return false;
    if(filter!=="todos" && filter!=="activos" && e!==filter)return false;
    if(!query)return true;
    return normalizeText(`${c.codigo||""} ${c.nombre||""} ${c.usuario_email||""} ${c.usuario_nombre||""} ${c.usuario_id||""}`).includes(query);
  });
  const activos=rows.filter(c=>estadoCupon(c)==="disponible");
  const usados=rows.filter(c=>estadoCupon(c)==="usado");
  const cancelados=rows.filter(c=>estadoCupon(c)==="cancelado");

  const tabs=[
    {id:"activos",label:"Activos"},
    {id:"usado",label:"Usados"},
    {id:"cancelado",label:"Cancelados"},
    {id:"caducado",label:"Caducados"},
    {id:"todos",label:"Todos"}
  ];
  const countFor=id=>id==="todos"?rows.length:id==="activos"?activos.length:rows.filter(c=>estadoCupon(c)===id).length;

  return <div style={{animation:"fadeSlide .34s ease"}}>
    <SectionHeader icon="🎟️" title="Cupones desbloqueados" sub="Códigos reales del Camino de recompensas: revisar, copiar y marcar como usados" action={<Btn small col="ghost" onClick={load}>Actualizar</Btn>}/>
    <Card style={{marginBottom:14,background:"linear-gradient(145deg,#24110A,#6E3518 58%,#D4AF37)",border:"2px solid rgba(255,244,214,.45)",color:T.white}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="icon3d" style={{fontSize:"2rem"}}>🎟️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:950,fontSize:"1rem"}}>Control de cupones reales</div>
          <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Los cupones ya no están en la tienda. Se desbloquean en el Camino y aquí puedes copiarlos, marcarlos como usados, cancelarlos o reactivarlos.</div>
        </div>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:12}}>
      <StatCard icon="🎟️" label="Activos" value={activos.length} col="gold"/>
      <StatCard icon="✅" label="Usados" value={usados.length} col="green"/>
      <StatCard icon="🚫" label="Cancelados" value={cancelados.length} col="red"/>
      <StatCard icon="📋" label="Total" value={rows.length} col="blue"/>
    </div>

    <Card style={{marginBottom:12,padding:12,background:"rgba(255,244,214,.78)",boxShadow:"none"}}>
      <Input label="Buscar cupón" value={q} onChange={setQ} placeholder="código, email, cliente..."/>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{SFX.tab();setFilter(t.id);}} style={{flex:"0 0 auto",border:`2px solid ${filter===t.id?T.gold:T.g300}`,background:filter===t.id?T.gradGold:"rgba(255,244,214,.84)",color:filter===t.id?T.g900:T.g700,borderRadius:999,padding:"8px 12px",fontWeight:950,cursor:"pointer"}}>{t.label} ({countFor(t.id)})</button>)}
      </div>
    </Card>

    {loading?<Spinner/>:filtered.length===0?<EmptyState icon="🎟️" title="Sin cupones" sub="No hay cupones en esta vista."/>:<div style={{display:"grid",gap:10}}>
      {filtered.map(c=>{
        const e=estadoCupon(c);
        return <Card key={c.id||c.codigo} style={{background:e==="usado"?"linear-gradient(180deg,#D8BE87,#C7A66B)":"linear-gradient(180deg,#FFF4D6,#F6E5BE)",border:`2px solid ${e==="disponible"?T.gold:T.g300}`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                <Badge col={estadoColor(e)}>{e}</Badge>
                <Badge col="gold">{descCupon(c)}%</Badge>
                <Badge col="blue">{c.origen||"camino"}</Badge>
              </div>
              <div style={{fontWeight:950,color:T.g800}}>{c.nombre||`Cupón ${descCupon(c)}%`}</div>
              <div style={{fontSize:".78rem",fontWeight:900,color:T.textSub,marginTop:3}}>👤 {clienteCupon(c)} · {c.usuario_email||"sin email"}</div>
              <div style={{fontSize:".76rem",fontWeight:950,color:T.g800,marginTop:6,background:"rgba(255,244,214,.62)",borderRadius:10,padding:"7px 9px",letterSpacing:".4px"}}>Código: {c.codigo}</div>
              <div style={{fontSize:".7rem",fontWeight:850,color:T.textSub,marginTop:5}}>Creado: {c.created_at?new Date(c.created_at).toLocaleString("es-ES"):"sin fecha"}{c.used_at?` · usado: ${new Date(c.used_at).toLocaleString("es-ES")}`:""}</div>
              {c.descripcion&&<div style={{fontSize:".74rem",fontWeight:850,color:T.textSub,marginTop:6,lineHeight:1.35}}>{c.descripcion}</div>}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
            <Btn small col="ghost" onClick={()=>copyCode(c.codigo)}>Copiar</Btn>
            <Btn small col="green" disabled={e==="usado"} onClick={()=>setEstado(c,"usado")}>Usado</Btn>
            <Btn small col="red" disabled={e==="cancelado"} onClick={()=>setEstado(c,"cancelado")}>Cancelar</Btn>
            <Btn small col="gold" disabled={e==="disponible"} onClick={()=>setEstado(c,"disponible")}>Reactivar</Btn>
          </div>
        </Card>;
      })}
    </div>}
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
            <div style={{fontSize:".78rem",fontWeight:800,opacity:.84,lineHeight:1.35}}>Mide citas, ingresos, pedidos, RP y actividad sin salir de Gestión.</div>
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
          <StatCard icon="⭐" label="RP movidos" value={puntosPedidos+puntosNoticias+puntosCanjes} col="gold"/>
        </div>

        <Card style={{marginBottom:14,background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)",border:`2px solid ${T.g300}`}}>
          <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>📈 Resumen rápido</div>
          <div style={{display:"grid",gap:8,fontSize:".84rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>
            <div>Ingresos registrados: <b style={{color:T.g800}}>{money(ingresos)}</b> en {cobrosOk.length} cobro{cobrosOk.length===1?"":"s"}.</div>
            <div>Citas: <b style={{color:T.g800}}>{data.citas.length}</b> totales, <b style={{color:T.g800}}>{citasRealizadas.length}</b> realizadas y <b style={{color:T.g800}}>{citasPendientes.length}</b> pendientes/propuestas.</div>
            <div>Comunidad: <b style={{color:T.g800}}>{data.foroTemas.length}</b> temas, <b style={{color:T.g800}}>{data.foroRespuestas.length}</b> respuestas y <b style={{color:T.g800}}>{data.newsEvents.length}</b> eventos de actualidad.</div>
            <div>Tienda: <b style={{color:T.g800}}>{data.pedidos.length}</b> pedidos y <b style={{color:T.g800}}>{puntosPedidos}</b> RP canjeados en pedidos.</div>
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
            Vista rápida de caja, cobros, citas realizadas, pedidos activos y RP canjeados.
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
        <StatCard icon="⭐" label="RP canjeados" value={puntosCanjeados} col="gold"/>
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
          <div style={{fontWeight:950,color:T.g800,marginBottom:8}}>🛍️ Tienda Rasta</div>
          <div style={{fontSize:".86rem",fontWeight:820,color:T.textSub,lineHeight:1.45}}>
            Pedidos activos: <b style={{color:T.g800}}>{pedidosActivos.length}</b>. RP canjeados: <b style={{color:T.g800}}>{puntosCanjeados}</b>.
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
            Resumen de premios, pedidos, canjes y stock de la tienda.
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
        <StatCard icon="⭐" label="RP canjeados" value={puntosCanjeados} col="gold"/>
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
    tienda:{canjes_activos:true,puntos_minimos_canje:0,mensaje_tienda:"Canjea tus RP por recompensas de Rasta Cuts."}
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
      tienda:{canjes_activos:true,puntos_minimos_canje:0,mensaje_tienda:"Canjea tus RP por recompensas de Rasta Cuts."}
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
          <Toggle label="Canjes activos" sub="Permite o bloquea nuevos canjes de RP." value={settings.tienda.canjes_activos!==false} onChange={v=>setTienda("canjes_activos",v)}/>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D9B7)"}}>
        <div style={{fontWeight:950,color:T.g800,marginBottom:10}}>⭐ Reglas de canje</div>
        <Input label="RP mínimos para canjear" type="number" value={String(settings.tienda.puntos_minimos_canje??0)} onChange={v=>setTienda("puntos_minimos_canje",Math.max(0,parseInt(v,10)||0))}/>
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
          <Input label="Límite diario de RP por juegos" type="number" value={String(settings.puntos.limite_diario_juegos??75)} onChange={v=>setPointValue("limite_diario_juegos",Math.max(0,parseInt(v,10)||0))}/>
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
            <Input label="Premio en RP" type="number" value={String(newReto.puntos_premio)} onChange={v=>setNewReto(r=>({...r,puntos_premio:v}))}/>
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
                  <Badge col="blue">Meta {r.meta}</Badge><Badge col="gold">+{r.puntos_premio} RP</Badge><Badge col={r.activo!==false?"green":"red"}>{r.activo!==false?"Activo":"Inactivo"}</Badge>
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
            Usuarios, roles y seguridad de la app.
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
            Cambios de rol registrados: <b style={{color:T.g800}}>{cambiosRol.length}</b>. Revisa los cambios importantes desde Seguridad.
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
        "Staff no ve Admin ni ajustes avanzados",
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

function GestionAdmin({user,setUser,showToast,showPoints,unread,onNavigate}){
  const role=normalizeRole(user?.rol||user?.role);
  const isAdmin=role===ROLES.ADMIN;
  const isStaff=role===ROLES.STAFF;
  const canAccess=isAdmin||isStaff;
  const [tab,setTab]=useState("resumen");
  const [gestionGroup,setGestionGroup]=useState("principal");

  const tabs=[
    {id:"resumen",icon:"🏠",label:"Resumen",sub:"Lo urgente del día sin abrir mil pestañas",staff:true,group:"principal"},
    {id:"agenda",icon:"🗓️",label:"Agenda",sub:"El día puesto en orden, hora por hora",staff:true,group:"principal"},
    {id:"citas",icon:"📅",label:"Citas",sub:"Reservas por revisar, confirmar o cerrar",staff:true,group:"principal"},
    {id:"clientes",icon:"👥",label:"Clientes",sub:"Gente que ya ha pasado por el estudio",staff:true,group:"principal"},

    {id:"facturacion",icon:"💰",label:"Resumen",sub:"Caja, cobros y movimiento del día sin rodeos",staff:true,group:"facturacion"},
    {id:"caja",icon:"🧾",label:"Caja",sub:"Cada cobro y venta con su sitio",staff:true,group:"facturacion"},
    {id:"estadisticas",icon:"📊",label:"Estadísticas",sub:"Números claros de citas, caja, pedidos, RP y comunidad",staff:true,group:"facturacion"},

    {id:"tienda_resumen",icon:"🛍️",label:"Resumen",sub:"Canjes, pedidos y stock que conviene mirar",staff:true,group:"tienda"},
    {id:"tienda_items",icon:"🎁",label:"Premios",sub:"Recompensas, vales y objetos que puedes preparar",staff:false,group:"tienda"},
    {id:"stock",icon:"📦",label:"Stock",sub:"Material del local y productos que no pueden faltar",staff:true,group:"tienda"},
    {id:"pedidos",icon:"📋",label:"Pedidos",sub:"Canjes para preparar y entregar",staff:true,group:"tienda"},
    {id:"cupones_admin",icon:"🎟️",label:"Cupones",sub:"Vales desbloqueados: copiar, usar o dejar listos",staff:true,group:"tienda"},
    {id:"tienda_ajustes",icon:"⚙️",label:"Ajustes",sub:"Encender o pausar tienda, canjes y reglas",staff:false,group:"tienda"},

    {id:"juegos_admin",icon:"🎮",label:"Juegos",sub:"Arcade, rankings y premios",staff:true,group:"juegos"},

    {id:"comunidad_resumen",icon:"🌐",label:"Resumen",sub:"Mensajes, foro, tablón, música y avisos en una sola vista",staff:true,group:"comunidad"},
    {id:"moderacion",icon:"🛡️",label:"Moderación",sub:"Reportes, moderación y convivencia",staff:true,group:"comunidad"},
    {id:"mensajes",icon:"📩",label:(unread?.admin?`Mensajes (${unread.admin})`:"Mensajes"),sub:"Mensajes privados de clientes",staff:true,group:"comunidad"},
    {id:"musica_admin",icon:"🎧",label:"Música",sub:"Artistas, playlists y audios del local",staff:false,group:"comunidad"},
    {id:"comunidad_ajustes",icon:"⚙️",label:"Ajustes",sub:"Encender o pausar foro, noticias, música y mensajes",staff:false,group:"comunidad"},

    {id:"admin_resumen",icon:"🔐",label:"Resumen",sub:"Usuarios, roles y seguridad de la app",staff:false,group:"admin"},
    {id:"usuarios",icon:"👥",label:"Usuarios",sub:"Perfiles de la app, roles y bloqueos",staff:false,group:"admin"},
    {id:"roles_permisos",icon:"👑",label:"Roles",sub:"Permisos de usuario y acceso",staff:false,group:"admin"},
    {id:"baneos",icon:"🚫",label:"Baneos",sub:"Cuentas bloqueadas y vuelta atrás rápida",staff:false,group:"admin"},
    {id:"seguridad",icon:"🧾",label:"Auditoría",sub:"Rastro de cambios importantes",staff:false,group:"admin"},
    {id:"supabase_rls",icon:"🧱",label:"Supabase",sub:"Preparar la seguridad fuerte de Supabase",staff:false,group:"admin"},
    {id:"checklist",icon:"✅",label:"Checklist",sub:"Repaso final antes de blindar Supabase",staff:false,group:"admin"},
    {id:"ajustes",icon:"⚙️",label:"Ajustes",sub:"Ajustes generales de Rasta Cuts",staff:false,group:"admin"},
  ].filter(t=>isAdmin||t.staff);

  const active=tabs.find(t=>t.id===tab)||tabs[0];

  const gestionGroups=[
    {id:"principal",icon:"🏠",label:"Principal",sub:"Agenda, reservas y clientes. Lo que se mira al abrir el local."},
    {id:"facturacion",icon:"💰",label:"Facturación",sub:"Caja, cobros y resumen del negocio."},
    {id:"tienda",icon:"🛍️",label:"Tienda",sub:"Canjes, premios, stock y entregas. La tienda por dentro."},
    {id:"juegos",icon:"🎮",label:"Juegos",sub:"Arcade, rankings, retos y premios de juego."},
    {id:"comunidad",icon:"🌐",label:"Comunidad",sub:"Foro, mensajes, música y ambiente de comunidad."},
    {id:"admin",icon:"🔐",label:"Admin",sub:"Usuarios, roles, bloqueos, Supabase y ajustes avanzados."}
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
    return <EmptyState icon="🔒" title="Acceso interno" sub="Sólo admin y staff pueden acceder a esta zona."/>;
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
              Herramientas principales para gestionar Rasta Cuts.
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

      {tab==="resumen"&&<DashboardAdmin user={user} showToast={showToast} onOpenTab={(id)=>{ const target=tabs.find(t=>t.id===id); if(target){ setGestionGroup(target.group); setTab(target.id); } }}/>}
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
      {tab==="cupones_admin"&&<GestionCuponesAdmin user={user} showToast={showToast}/>}
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



function InternalHomeDashboard({user,onNavigate,unread={}}={}){
  const role=normalizeRole(user?.rol||user?.role);
  const isAdmin=role===ROLES.ADMIN;
  const [home,setHome]=useState({orders:[],coupons:[],movs:[],scores:[],comments:[],missions:[]});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let alive=true;
    async function safe(table,query){try{const rows=await dbGet(table,query);return Array.isArray(rows)?rows:[];}catch{return [];}}
    async function load(){
      setLoading(true);
      const [orders,coupons,movs,scores,comments,missions]=await Promise.all([
        safe("tienda_pedidos","?order=created_at.desc&limit=8&select=*"),
        safe("user_coupons","?order=created_at.desc&limit=8&select=*"),
        safe("economy_movements","?order=created_at.desc&limit=10&select=*"),
        safe("game_scores","?order=created_at.desc&limit=10&select=*"),
        safe("news_comments","?order=created_at.desc&limit=6&select=*"),
        safe("user_mission_claims","?order=created_at.desc&limit=8&select=*"),
      ]);
      if(!alive)return;
      setHome({orders,coupons,movs,scores,comments,missions});
      setLoading(false);
    }
    load();
    return()=>{alive=false;};
  },[user?.id]);

  const pendingOrders=home.orders.filter(o=>!["entregado","cancelado"].includes(String(o.estado||"").toLowerCase()));
  const activeCoupons=home.coupons.filter(c=>String(c.estado||"").toLowerCase()==="disponible"||c.usado===false);
  const rcMovs=home.movs.filter(m=>String(m.currency||"").toLowerCase()==="rc");
  const rpMovs=home.movs.filter(m=>String(m.currency||"").toLowerCase()==="rp"||String(m.currency||"").toLowerCase()==="puntos");
  const bestScore=[...home.scores].sort((a,b)=>(Number(b.score)||Number(b.points)||0)-(Number(a.score)||Number(a.points)||0))[0];
  const progress=avatarLevelProgress(userXP(user));

  const cards=[
    {id:"gestion",icon:"💈",title:"Local",sub:"Pedidos, citas, vales y tienda.",tone:"gold",art:"🏪",artType:"local"},
    {id:"tienda",icon:"🛍️",title:"Tienda",sub:"Vales, productos y recompensas.",tone:"blue",art:"🎟️",artType:"tienda"},
    {id:"juegos",icon:"🎮",title:"Arcade",sub:"Gacha, Tycoon, rankings, RC y XP.",tone:"blue",art:"🕹️",artType:"arcade"},
    {id:"misiones",icon:"🎯",title:"Retos",sub:"Diarios, semanales y progreso.",tone:"green",art:"⚡",artType:"misiones"},
    {id:"comunidad",icon:"🌐",title:"Comunidad",sub:"Tablón, foro e historias del estudio.",tone:"orange",art:"📣",artType:"comunidad"},
    {id:"perfil",icon:"👤",title:"Perfil",sub:"Avatar, nivel, vales y cartera.",tone:"pink",art:"👑",artType:"perfil"},
  ];

  function AdminFeature({c}){
    const tones={green:["#0FB890","#143F2E"],gold:["#E0B84F","#5A3D10"],blue:["#35B8D0","#123E52"],pink:["#B878FF","#39215F"],orange:["#E38B32","#613512"]};
    const [a,b]=tones[c.tone]||tones.green;
    return <button className={`rc-art-card rc-art-${c.tone||"green"}`} data-card-title={c.title} onClick={()=>{SFX.tab();onNavigate?.(c.id);}} style={{
      textAlign:"left",
      minHeight:142,
      border:`1px solid ${a}55`,
      background:`linear-gradient(150deg,rgba(9,14,12,.96),${b}D9), radial-gradient(circle at 86% 12%,${a}33,transparent 42%)`,
      borderRadius:22,
      padding:14,
      color:"#FFF7DA",
      cursor:"pointer",
      boxShadow:"0 16px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.10)",
      position:"relative",
      overflow:"hidden"
    }}>
      <div style={{position:"absolute",right:-8,top:4,opacity:.96,transform:"rotate(-3deg)"}}><RastaCardIllustration type={c.artType||c.id} accent={a} size={118}/></div>
      <div style={{position:"absolute",left:0,right:0,top:0,height:42,background:`linear-gradient(90deg,${a}22,rgba(255,255,255,.06),transparent)`,borderBottom:`1px solid ${a}22`}}/>
      <div style={{position:"relative",zIndex:1,maxWidth:"62%"}}>
        <div style={{fontSize:"1.25rem",width:38,height:38,borderRadius:14,display:"grid",placeItems:"center",background:"rgba(255,255,255,.08)",border:`1px solid ${a}33`}}>{c.icon}</div>
        <div className="rc-card-title" style={{fontWeight:1000,color:a,marginTop:9,textTransform:"uppercase",letterSpacing:".02em"}}>{c.title}</div>
        <div style={{fontSize:".76rem",fontWeight:800,color:"rgba(255,247,218,.78)",lineHeight:1.35,marginTop:4}}>{c.sub}</div>
      </div>
    </button>;
  }

  return <div className="premium-home rc-visual-rework" style={{animation:"fadeSlide .34s ease",display:"grid",gap:14}}>
    <section className="rc-home-cover rc-home-cover-open" style={{
      position:"relative",
      overflow:"hidden",
      margin:"-18px -14px 8px",
      padding:0,
      borderRadius:0,
      border:"none",
      background:"linear-gradient(180deg,#050706 0%,#07100D 78%,transparent 100%)",
      boxShadow:"none"
    }}>
      <div style={{position:"relative",width:"100%",minHeight:"clamp(160px,31vw,390px)",display:"grid",placeItems:"center",overflow:"hidden"}}>
        <img
          src="/rastacuts_logo.webp"
          alt="Rasta Cuts"
          draggable={false}
          onError={e=>{e.currentTarget.style.display="none";}}
          style={{
            width:"100%",
            height:"auto",
            minHeight:"clamp(160px,31vw,390px)",
            objectFit:"contain",
            objectPosition:"center top",
            display:"block",
            filter:"saturate(1.05) contrast(1.04)",
            opacity:.92,
            pointerEvents:"none"
          }}
        />
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(5,7,6,.02) 0%,rgba(5,7,6,.08) 38%,rgba(5,7,6,.74) 100%), radial-gradient(circle at 50% 16%,rgba(242,200,91,.12),transparent 44%)",pointerEvents:"none"}}/>
      </div>
      <div style={{position:"relative",zIndex:2,margin:"-62px 14px 0",display:"grid",placeItems:"center",textAlign:"center",paddingBottom:12}}>
        <p style={{maxWidth:660,color:"rgba(255,247,218,.94)",fontWeight:900,lineHeight:1.5,margin:"0 auto 12px",fontSize:"clamp(.9rem,1.45vw,1.05rem)",textShadow:"0 4px 18px rgba(0,0,0,.70)"}}>
          Reservas, retos, comunidad y recompensas en un mismo sitio.
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
          <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(5,7,6,.72)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,231,164,.22)",color:"#FFF7DA",fontWeight:900}}>🔔 {Number(unread?.admin||0)} avisos</span>
          <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(5,7,6,.72)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,231,164,.22)",color:"#FFF7DA",fontWeight:900}}>📦 {pendingOrders.length} pedidos</span>
          <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(5,7,6,.72)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,231,164,.22)",color:"#FFF7DA",fontWeight:900}}>🎟️ {activeCoupons.length} cupones</span>
          <span style={{padding:"8px 12px",borderRadius:14,background:"rgba(5,7,6,.72)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,231,164,.22)",color:"#FFF7DA",fontWeight:900}}>⭐ Nivel {Number(user?.avatar_level||progress.level)}</span>
        </div>
      </div>
    </section>

    <div className="rc-home-live-panels" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
      <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(28,20,13,.94))",border:"1px solid rgba(255,210,98,.24)",color:"#FFF7DA",boxShadow:"0 18px 34px rgba(0,0,0,.22)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontWeight:1000,color:"#E0B84F",fontSize:"1.02rem"}}>📌 Hoy en Rasta Cuts</div>
            <div style={{fontSize:".78rem",fontWeight:820,color:"rgba(255,247,218,.68)",marginTop:4}}>Lo más importante para revisar de un vistazo.</div>
          </div>
          <div style={{width:46,height:46,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(242,200,91,.10)",border:"1px solid rgba(242,200,91,.24)",fontSize:"1.35rem"}}>💈</div>
        </div>
        {loading?<Spinner/>:<div style={{display:"grid",gap:8,marginTop:14}}>
          {pendingOrders[0]&&<button onClick={()=>onNavigate?.("gestion")} style={{textAlign:"left",border:"1px solid rgba(255,210,98,.22)",background:"rgba(255,255,255,.06)",borderRadius:16,padding:12,cursor:"pointer",color:"#FFF7DA"}}><div style={{fontWeight:1000}}>Pedido pendiente</div><div style={{fontSize:".78rem",fontWeight:820,opacity:.72}}>{pendingOrders[0].nombre||pendingOrders[0].cliente_nombre||"Nuevo pedido"} · {pendingOrders[0].estado||"pendiente"}</div></button>}
          {activeCoupons[0]&&<button onClick={()=>onNavigate?.("gestion")} style={{textAlign:"left",border:"1px solid rgba(95,240,200,.20)",background:"rgba(95,240,200,.06)",borderRadius:16,padding:12,cursor:"pointer",color:"#FFF7DA"}}><div style={{fontWeight:1000}}>Vale activo</div><div style={{fontSize:".78rem",fontWeight:820,opacity:.72}}>{activeCoupons[0].titulo||activeCoupons[0].codigo||"Cupón disponible"}</div></button>}
          {bestScore&&<button onClick={()=>onNavigate?.("juegos")} style={{textAlign:"left",border:"1px solid rgba(255,255,255,.10)",background:"rgba(255,255,255,.06)",borderRadius:16,padding:12,cursor:"pointer",color:"#FFF7DA"}}><div style={{fontWeight:1000}}>Mejor partida reciente</div><div style={{fontSize:".78rem",fontWeight:820,opacity:.72}}>{bestScore.game_id||bestScore.juego||"Arcade"} · {Number(bestScore.score||bestScore.points||0).toLocaleString("es-ES")} puntos de juego</div></button>}
          {!pendingOrders[0]&&!activeCoupons[0]&&!bestScore&&<div style={{fontSize:".84rem",fontWeight:850,color:"rgba(255,247,218,.74)",padding:"8px 0"}}>Todo tranquilo por ahora. Cuando haya pedidos, vales o partidas destacadas aparecerán aquí.</div>}
        </div>}
      </div>

      <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(17,37,31,.90))",border:"1px solid rgba(95,240,200,.26)",color:"#FFF7DA",boxShadow:"0 18px 34px rgba(0,0,0,.20)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontWeight:1000,color:"#5EF0C8",fontSize:"1.02rem"}}>⭐ Progreso del perfil</div>
            <div style={{fontSize:".78rem",fontWeight:820,color:"rgba(255,247,218,.68)",marginTop:4}}>Nivel, experiencia y saldo visible.</div>
          </div>
          <div style={{width:46,height:46,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(95,240,200,.10)",border:"1px solid rgba(95,240,200,.24)",overflow:"hidden"}}>
            <Av av={user?.avatar} config={user?.avatarConfig||user?.avatar_config} size={40}/>
          </div>
        </div>
        <div style={{marginTop:15,display:"grid",gap:10}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".8rem",fontWeight:950,color:"rgba(255,247,218,.84)",marginBottom:6}}>
              <span>Nivel {Number(user?.avatar_level||progress.level)}</span>
              <span>{Math.max(0,Math.min(100,Math.round(progress.percent||0)))}%</span>
            </div>
            <div style={{height:10,borderRadius:999,background:"rgba(255,255,255,.08)",overflow:"hidden",border:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{width:`${Math.max(5,Math.min(100,progress.percent||0))}%`,height:"100%",borderRadius:999,background:"linear-gradient(90deg,#5EF0C8,#E0B84F)",boxShadow:"0 0 18px rgba(95,240,200,.24)"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            <div style={{borderRadius:14,padding:"10px 8px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)"}}><div style={{fontSize:".7rem",fontWeight:900,opacity:.7}}>RP</div><div style={{fontWeight:1000,color:"#E0B84F"}}>{Number(user?.puntos||0).toLocaleString("es-ES")}</div></div>
            <div style={{borderRadius:14,padding:"10px 8px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)"}}><div style={{fontSize:".7rem",fontWeight:900,opacity:.7}}>RC</div><div style={{fontWeight:1000,color:"#5EF0C8"}}>{userRC(user).toLocaleString("es-ES")}</div></div>
            <div style={{borderRadius:14,padding:"10px 8px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)"}}><div style={{fontSize:".7rem",fontWeight:900,opacity:.7}}>XP</div><div style={{fontWeight:1000,color:"#FFF7DA"}}>{userXP(user).toLocaleString("es-ES")}</div></div>
          </div>
        </div>
      </div>

      <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(24,19,12,.94))",border:"1px solid rgba(255,210,98,.22)",color:"#FFF7DA",boxShadow:"0 18px 34px rgba(0,0,0,.20)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontWeight:1000,color:"#E0B84F",fontSize:"1.02rem"}}>🎯 Reto recomendado</div>
            <div style={{fontSize:".78rem",fontWeight:820,color:"rgba(255,247,218,.68)",marginTop:4}}>Un objetivo rápido para mover la app hoy.</div>
          </div>
          <div style={{width:46,height:46,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(217,74,53,.10)",border:"1px solid rgba(217,74,53,.24)",fontSize:"1.35rem"}}>⚡</div>
        </div>
        <div style={{marginTop:14,borderRadius:18,padding:14,background:"linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03))",border:"1px solid rgba(255,255,255,.10)"}}>
          <div style={{fontWeight:1000,color:"#FFF7DA"}}>Completa una acción diaria</div>
          <div style={{fontSize:".82rem",fontWeight:820,color:"rgba(255,247,218,.72)",lineHeight:1.45,marginTop:5}}>Revisa tus retos disponibles y reclama sólo lo que hayas completado.</div>
          <button onClick={()=>onNavigate?.("misiones")} style={{marginTop:12,border:"1px solid rgba(255,210,98,.36)",background:"linear-gradient(135deg,#E0B84F,#A56B1E)",borderRadius:14,padding:"10px 14px",fontWeight:1000,color:"#201407",cursor:"pointer"}}>Ver retos</button>
        </div>
      </div>

      <div style={{borderRadius:24,padding:16,background:"linear-gradient(180deg,rgba(10,17,14,.96),rgba(20,24,15,.94))",border:"1px solid rgba(255,210,98,.22)",color:"#FFF7DA",boxShadow:"0 18px 34px rgba(0,0,0,.20)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontWeight:1000,color:"#E0B84F",fontSize:"1.02rem"}}>🌐 Comunidad activa</div>
            <div style={{fontSize:".78rem",fontWeight:820,color:"rgba(255,247,218,.68)",marginTop:4}}>Comentarios, foro y novedades del estudio.</div>
          </div>
          <div style={{width:46,height:46,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(255,210,98,.10)",border:"1px solid rgba(255,210,98,.24)",fontSize:"1.35rem"}}>💬</div>
        </div>
        <div style={{marginTop:14,fontSize:".95rem",fontWeight:1000}}>💬 {home.comments.length} comentarios recientes</div>
        <div style={{marginTop:8,fontSize:".82rem",fontWeight:820,color:"rgba(255,247,218,.72)",lineHeight:1.45}}>Cuando haya movimiento en el tablón o en noticias aparecerá aquí.</div>
        <button onClick={()=>onNavigate?.("comunidad")} style={{marginTop:14,border:"1px solid rgba(95,240,200,.30)",background:"rgba(95,240,200,.12)",borderRadius:14,padding:"10px 14px",fontWeight:1000,color:"#5EF0C8",cursor:"pointer"}}>Ver comunidad</button>
      </div>
    </div>
  </div>;
}

const NAV_CFG={
  admin:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"perfil",icon:"👤",label:"Perfil"}],
  staff:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"gestion",icon:"🧾",label:"Gestión"},{id:"perfil",icon:"👤",label:"Perfil"}],
  client:[{id:"dashboard",icon:"🏠",label:"Inicio"},{id:"juegos",icon:"🎮",label:"Arcade"},{id:"tienda",icon:"🛍️",label:"Tienda"},{id:"comunidad",icon:"🌐",label:"Comunidad"},{id:"buzon",icon:"📩",label:"Buzón"},{id:"perfil",icon:"👤",label:"Perfil"}],
};
const GRAD_ROLE={admin:T.gradAdmin,staff:T.gradStaff,client:T.gradClient};


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


const RASTA_GENERAL_TIPS=[
  "Revisa tus retos diarios para ver qué recompensas puedes reclamar hoy.",
  "Tus RP sirven para canjes y recompensas. Se consiguen poco a poco con actividad real.",
  "Los RC son la moneda de juego para Arcade, Gacha y Tycoon.",
  "La XP sube tu nivel de avatar y desbloquea progreso visual.",
  "En Perfil puedes revisar tu avatar, tu nivel, tus vales y tu actividad.",
  "En Arcade puedes jugar para mejorar récords y subir en los rankings.",
  "En Tienda encontrarás vales, productos y recompensas disponibles.",
  "En Comunidad puedes leer novedades, comentar y participar en el foro.",
  "Las notificaciones aparecen en la campana superior cuando hay avisos nuevos.",
  "La cartera muestra tus RP, RC, XP y últimos movimientos.",
  "Si tienes una reserva o pedido pendiente, aparecerá en Inicio cuando toque revisarlo.",
  "El modo incógnito oculta tu nombre y avatar en zonas públicas.",
  "Los rankings enseñan tus mejores marcas y la actividad semanal.",
  "El botón de sonido activa o silencia la música de fondo.",
  "En móvil, usa el menú inferior o lateral para moverte rápido por la app.",
  "RastaHelp puede explicar una pantalla cuando necesites ayuda concreta.",
  "Si una acción da recompensa, la app te lo mostrará antes o después de reclamarla.",
  "Los vales disponibles aparecen en tu perfil y en las zonas de canje.",
  "La pantalla de Inicio resume lo importante sin tener que abrir cada sección.",
  "Las reservas, recompensas y juegos están conectados a tu perfil."
];

const RASTA_RARE_CULTURE_TIPS=[
  "Para una sesión tranquila, prueba una lista de reggae suave mientras navegas por la app.",
  "Si te va el rap español, la sección Música puede ayudarte a descubrir temas para el estudio.",
  "En el Arcade, juega para mejorar tu marca aunque ya hayas reclamado la recompensa del día.",
  "Un buen comentario en Comunidad aporta una idea, una duda o una experiencia útil.",
  "Las noticias son más cómodas cuando se leen rápido y tienen un debate claro debajo.",
  "El avatar gana más sentido cuando aparece igual en Perfil, Comunidad y rankings.",
  "La Tienda funciona mejor cuando los canjes son fáciles de entender y tienen valor real.",
  "Las reservas deben mostrar fecha, hora, servicio y precio con claridad.",
  "El ranking semanal mantiene movimiento y el histórico guarda las mejores marcas.",
  "Si quieres privacidad, activa el modo incógnito desde Perfil.",
  "Los retos diarios son pequeños objetivos para volver sin convertir la app en una obligación.",
  "La música debe acompañar la experiencia, no taparla.",
  "El foro sirve para conversaciones más largas que un comentario rápido.",
  "Los avisos importantes del estudio aparecen en zonas visibles de la app.",
  "Los cosméticos del avatar son una buena forma de enseñar progreso sin tocar datos personales.",
  "Las recompensas se entienden mejor cuando ves RP, RC y XP separados.",
  "La navegación en móvil está pensada para llegar a todo en pocos toques.",
  "La comunidad gana vida cuando hay novedades, rankings y pequeños retos."
];

const RASTA_DAILY_FUN_TIPS=[
  "Hoy puedes revisar tus retos, jugar una partida y mirar si tienes algún vale pendiente.",
  "Empieza por Inicio si quieres ver lo importante de un vistazo.",
  "En Arcade puedes probar distintos juegos y comparar tus marcas.",
  "Si subes de nivel, tu progreso se reflejará en Perfil.",
  "Revisa la Tienda de vez en cuando: los vales y recompensas pueden cambiar.",
  "Comunidad reúne novedades, comentarios y foro.",
  "Las reservas se gestionan mejor cuando eliges bien el servicio y la hora.",
  "Si tienes avisos nuevos, la campana superior te lo indicará.",
  "Tus RP, RC y XP están separados para que cada cosa tenga su función.",
  "El RastaHelp está para orientar, no para llenar la pantalla de texto.",
  "Una partida rápida puede mejorar tu ranking aunque no siempre dé recompensa.",
  "El progreso diario se ve mejor si reclamas sólo lo que ya has completado.",
  "La música de fondo puede activarse o silenciarse desde la cabecera.",
  "En Perfil puedes revisar cómo te ven otros usuarios.",
  "El modo ayuda explica botones y zonas cuando lo necesitas.",
  "Los comentarios y likes ayudan a dar movimiento a la comunidad.",
  "Si algo no carga, vuelve a Inicio y revisa avisos o conexión.",
  "La app está pensada para reservar, jugar, participar y canjear recompensas."
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
  if(page==="misiones")return "misiones";
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
  if(page==="perfil"||page==="cartera"||page==="carrito"||page==="misiones")return "success";
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
  if(page==="arcade"||page==="juegos")return "Arcade Rasta";
  if(page==="tienda")return "Rasta en tienda";
  if(page==="perfil")return "Tu estilo, mi pana";
  if(page==="misiones")return "Misiones del día";
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
    feed:"Estás en Tablón. Sirve para anuncios del estudio, promociones y novedades de la tienda.",
    foro:"Estás en Foro. Aquí los usuarios pueden abrir temas, comentar y debatir.",
    noticias:"Estás en Actualidad. Desliza noticias, abre debate, mira fuentes o enlaces de YouTube.",
    citas:"Estás en Citas. Aquí se piden, confirman o cancelan reservas.",
    clientes:"Estás en Clientes. Aquí se revisa información de clientes y actividad.",
    usuarios:"Estás en Usuarios. Aquí el admin gestiona perfiles, roles y datos básicos.",
    perfil:"Estás en Perfil. Aquí editas avatar, privacidad, nombre y opciones de cuenta.",
    misiones:"Estás en Misiones. Aquí ves objetivos diarios y semanales para ganar RP, RC y XP de forma controlada.",
    inventario:"Estás en Stock. Aquí se revisa inventario y productos.",
    caja:"Estás en Caja. Aquí se revisan ingresos, ventas y actividad económica.",
    ranking:"Estás en Ranking. Aquí se comparan RP y progreso entre clientes.",
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
  if(t.includes("confirmación")||t.includes("confirmar carrito")||t==="confirmar")return "Confirma el carrito: descuenta puntos, registra pedidos y desbloquea personalización de avatar/perfil si corresponde.";
  if(t.includes("top 10"))return "Top 10 abre los rankings de minijuegos: semanal e histórico por cada juego.";
  if(t.includes("top general"))return "Ranking general muestra estadísticas globales de clientes: puntos, juegos, tienda y comunidad.";
  if(t.includes("ver top")||t.includes("abrir top"))return "Este botón abre la página de rankings para ver los mejores jugadores y estadísticas.";
  if(t.includes("jugar ahora")||t==="jugar"||t.includes("▶ jugar")||t.includes("rejugar"))return "Abre el juego seleccionado. Puedes repetir para mejorar récord. Las recompensas diarias tienen límite, pero el ranking sigue contando. se cobran una vez al día.";
  if(t.includes("gacha"))return "Gacha Barber es una máquina de tiradas con límite diario. Puedes conseguir RC, XP o tiradas extra.";
  if(t.includes("guardar récord")||t.includes("guardar record"))return "Guarda tu puntuación para que aparezca en los rankings. Si ya cobraste hoy, sólo mejora la marca.";
  if(t.includes("nueva")||t.includes("+ nueva")||t.includes("nueva cita"))return "Crea una cita nueva. Puedes elegir varios tratamientos y la app suma duración y precio.";
  if(t.includes("confirmar"))return "Confirma esta cita. Pasará de pendiente a confirmada para que el cliente sepa que queda aceptada.";
  if(t.includes("cancelar"))return "Cancela esta acción o cita. Úsalo si no se puede aceptar o si quieres cerrar sin guardar.";
  if(t.includes("realizada"))return "Marca la cita como realizada. Esto servirá más adelante para historial, facturación y estadísticas.";
  if(t.includes("proponer"))return "Permite sugerir otra fecha u hora al cliente en vez de aceptar la reserva tal cual.";
  if(t.includes("publicar"))return "Publica el texto en el tablón, foro o comunidad según la sección donde estés.";
  if(t.includes("responder"))return "Añade una respuesta al tema o conversación actual.";
  if(t.includes("comentar")||t.includes("comentario"))return "Abre o añade comentarios. Participar en comunidad puede servir para RP y actividad.";
  if(t.includes("me gusta")||t.includes("like")||t.includes("👍"))return "Pulsa una vez para dar like y vuelve a pulsar para quitarlo. Sólo cuenta un like activo por usuario y publicación, tema, respuesta o noticia.";
  if(t.includes("youtube"))return "Abre una búsqueda o enlace de YouTube relacionado, normalmente para música o vídeos relacionados.";
  if(t.includes("fuente")||t.includes("leer fuente"))return "Abre la fuente original de la noticia fuera de la app.";
  if(t.includes("abrir debate"))return "Abre la conversación de esa noticia para poder leer o comentar.";
  if(t.includes("actualizar"))return "Actualiza los datos de esta sección para traer contenido o rankings más recientes.";
  if(t.includes("misiones")||t.includes("objetivos"))return "Abre Retos: objetivos diarios y semanales con recompensas de RP, RC y XP.";
  if(t.includes("perfil"))return "Entra en tu perfil para editar avatar, privacidad, nombre y opciones de cuenta.";
  if(t.includes("comunidad"))return "Abre Comunidad: tablón, foro y actualidad.";
  if(t.includes("inicio"))return "Vuelve al inicio, donde se ve el resumen general de la app.";
  if(t.includes("citas"))return "Abre la sección de citas para reservar o gestionar reservas.";
  if(t.includes("clientes"))return "Abre el panel de clientes, visible para admin o staff.";
  if(t.includes("usuarios"))return "Abre el panel de usuarios, normalmente sólo para admin.";
  if(t.includes("tienda"))return "Abre la tienda de RP, premios y canjes.";
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

function cleanRastaTipText(value){
  const txt=String(value||"").trim()
    .replace(/^Tip\s+(musical|de\s+comunidad|de\s+noticias|de\s+juegos|de\s+perfil|de\s+tienda|de\s+reservas|de\s+gestión|de\s+privacidad|de\s+rankings|de\s+sonido|de\s+móvil|de\s+caja|de\s+admin|de\s+foro|de\s+premios|de\s+actualidad|de\s+música|de\s+app|de\s+Rasta):\s*/i,"");
  const low=txt.toLowerCase();
  if(!txt)return "";
  if(low.includes("menos texto")||low.includes("modo ayuda debe explicar")||low.includes("sin regalar")||low.includes("hoja de cálculo"))return "";
  return txt;
}

function HelperMascot({page,settings=null,onOpenMissions=null}){
  const key=helperPageKey(page);
  const baseTips=HELP_TIPS[key]||HELP_TIPS.dashboard;
  const dailyTip=getDailyRastaTip(key);
  const tips=Array.from(new Set([
    dailyTip,
    ...baseTips,
    ...RASTA_GENERAL_TIPS,
    ...RASTA_DAILY_FUN_TIPS,
    ...RASTA_RARE_CULTURE_TIPS
  ].map(cleanRastaTipText).filter(Boolean)));
  const [open,setOpen]=useState(false);
  const [helpMode,setHelpMode]=useState(false);
  const [tipIndex,setTipIndex]=useState(0);
  const [rareTip,setRareTip]=useState(null);
  const [contextTip,setContextTip]=useState(null);
  const dragRef=useRef({down:false,moved:false,startX:0,startY:0,baseX:0,baseY:0});
  const [pos,setPos]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("rasta_helper_pos_v3")||"null");
      if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)) return saved;
    }catch{}
    if(typeof window==="undefined") return {x:360,y:620};
    const isMob=window.innerWidth<=520;
    return {
      x:Math.max(12,Math.min(window.innerWidth-74,window.innerWidth-(isMob?92:84))),
      y:Math.max(86,Math.min(window.innerHeight-(isMob?168:128),window.innerHeight-(isMob?178:150)))
    };
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
        const isMob=window.innerWidth<=520;
        const next={x:Math.max(8,Math.min(window.innerWidth-66,p.x)),y:Math.max(72,Math.min(window.innerHeight-(isMob?176:118),p.y))};
        try{localStorage.setItem("rasta_helper_pos_v3",JSON.stringify(next));}catch{}
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
      playRastaVoice("context");
      SFX.tab();
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
    playRastaVoice("tip");
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
    playRastaVoice("happy");
    setRareTip(rare);
  }

  function toggleHelp(e){
    e?.stopPropagation?.();
    setRareTip(null);
    setContextTip(null);
    setHelpMode(v=>!v);
    setOpen(true);
    playRastaVoice("help");
    SFX.tab();
  }

  function beginDrag(clientX,clientY){
    dragRef.current={down:true,moved:false,startX:clientX,startY:clientY,baseX:pos.x,baseY:pos.y,last:{...pos}};
  }

  function moveDrag(clientX,clientY){
    const d=dragRef.current;
    if(!d.down)return;
    const dx=clientX-d.startX;
    const dy=clientY-d.startY;
    if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;
    if(typeof window==="undefined")return;
    const isMob=window.innerWidth<=520;
    const next={
      x:Math.max(8,Math.min(window.innerWidth-(isMob?62:66),d.baseX+dx)),
      y:Math.max(72,Math.min(window.innerHeight-(isMob?176:118),d.baseY+dy))
    };
    dragRef.current.last=next;
    setPos(next);
  }

  function endDrag(){
    const d=dragRef.current;
    if(!d.down)return;
    dragRef.current={...d,down:false};
    const finalPos=d.last||pos;
    try{localStorage.setItem("rasta_helper_pos_v3",JSON.stringify(finalPos));}catch{}
    if(!d.moved){
      SFX.tab();
      setOpen(v=>{
        const nextOpen=!v;
        playRastaVoice(nextOpen?"open":"close");
        return nextOpen;
      });
    }
  }

  function pointerDown(e){
    if(e.pointerType==="mouse" && e.button!==0)return;
    e.preventDefault?.();
    beginDrag(e.clientX,e.clientY);
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
  }

  function pointerMove(e){
    e.preventDefault?.();
    moveDrag(e.clientX,e.clientY);
  }

  function pointerUp(e){
    e.preventDefault?.();
    try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    endDrag();
  }

  function touchStart(e){
    if(typeof window!=="undefined" && window.PointerEvent)return;
    const t=e.touches?.[0];
    if(!t)return;
    e.preventDefault?.();
    beginDrag(t.clientX,t.clientY);
  }

  function touchMove(e){
    if(typeof window!=="undefined" && window.PointerEvent)return;
    const t=e.touches?.[0];
    if(!t)return;
    e.preventDefault?.();
    moveDrag(t.clientX,t.clientY);
  }

  function touchEnd(e){
    if(typeof window!=="undefined" && window.PointerEvent)return;
    e.preventDefault?.();
    endDrag();
  }

  const closeBubble=(e)=>{
    e.stopPropagation();
    setOpen(false);
  };

  const bubbleSideStyle=isRight
    ? {right:62,bottom:6}
    : {left:62,bottom:6};

  const arrowStyle=isRight
    ? {right:-10,bottom:18,borderRight:`2px solid ${T.g200}`,borderBottom:`2px solid ${T.g200}`}
    : {left:-10,bottom:18,borderLeft:`2px solid ${T.g200}`,borderTop:`2px solid ${T.g200}`};

  return (
    <div
      data-rasta-helper="1"
      className="rasta-helper-fixed-safe"
      style={{
        "--helper-left": `${pos.x}px`,
        "--helper-top": `${pos.y}px`,
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
              <button onClick={(e)=>{e.stopPropagation();setHelpMode(false);setOpen(false);onOpenMissions?.();playRastaVoice("happy");SFX.success();}} style={{border:"none",background:"linear-gradient(180deg,#26331D,#4F602D)",color:T.white,borderRadius:999,padding:"7px 11px",fontWeight:950,cursor:"pointer",boxShadow:"0 6px 12px rgba(20,8,4,.16)"}}>🎯 Misiones</button>
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
          onTouchStart={touchStart}
          onTouchMove={touchMove}
          onTouchEnd={touchEnd}
          aria-label={open?"Ocultar consejos del rasta":"Abrir consejos del rasta"}
          title="Toca para abrir la ayuda de Rasta"
          style={{
            border:"none",
            background:"transparent",
            cursor:"grab",
            padding:0,
            width:70,
            height:70,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            gap:10,
            WebkitTapHighlightColor:"transparent",
            touchAction:"none",
            userSelect:"none"
          }}
        >
          <div style={{position:"relative"}}>
            <RastaFaceAvatar size={52} speaking={open} settings={settings} forceInternal/>
            <div style={{
              position:"absolute",
              right:-2,
              bottom:2,
              minWidth:24,
              height:24,
              borderRadius:999,
              background:helpMode?"linear-gradient(180deg,#4F602D,#26331D)":open?"linear-gradient(180deg,#E15B44,#A72822)":"linear-gradient(180deg,#F7D76D,#D99E22)",
              border:`2px solid ${T.g50}`,
              color:helpMode||open?T.white:T.g800,
              display:"grid",
              placeItems:"center",
              fontWeight:1000,
              fontSize:".86rem",
              boxShadow:"0 6px 12px rgba(20,8,4,.18)"
            }}>{helpMode?"i":open?"×":"💡"}</div>
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
  if(key==="misiones") return PAGE_THEMES.retos||PAGE_THEMES.dashboard;
  return PAGE_THEMES[key]||PAGE_THEMES[page]||PAGE_THEMES.dashboard;
}


function HelperInline({page,settings=null}){
  const [open,setOpen]=useState(false);
  const text=rastaPageHelpIntro(page);
  return <div style={{background:"rgba(255,248,230,.72)",border:`1px solid ${T.g200}`,borderRadius:18,padding:10}}>
    <button onClick={()=>setOpen(v=>!v)} style={{border:"none",background:"transparent",display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:0,width:"100%",textAlign:"left"}}>
      <RastaFaceAvatar size={34} speaking={open} settings={settings}/>
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
  const [history,setHistory]=useState(()=>readPointHistory(user?.id));
  const [historySource,setHistorySource]=useState("local");
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      const local=readPointHistory(user?.id);
      if(alive){setHistory(local);setHistorySource("local");}
      if(show&&user?.id){
        const remote=await readPointHistoryFromDb(user.id,60);
        if(alive&&Array.isArray(remote)&&remote.length){setHistory(remote);setHistorySource("supabase");}
      }
    };
    const reload=()=>load();
    window.addEventListener("rasta-points-history-updated",reload);
    load();
    return()=>{alive=false;window.removeEventListener("rasta-points-history-updated",reload);};
  },[user?.id,show]);
  if(!show)return null;
  const pts=userRP(user);
  const rc=userRC(user);
  const xp=userXP(user);
  const lvl=Number(user?.avatar_level||avatarLevelFromXP(xp));
  const dailyMax=50;
  const todayEarned=getWebPointsToday(user?.id);
  const pct=Math.max(0,Math.min(100,Math.round(todayEarned/dailyMax*100)));
  const fmtDate=v=>{try{return new Date(v).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch{return "";}};
  const movIcon=m=>m.type==="earn"?"➕":m.type==="spend"?"➖":m.type==="refund"?"↩️":"•";
  const movColor=m=>m.amount>0?T.g700:m.amount<0?T.red:T.textSub;
  const clear=()=>{clearPointHistory(user?.id);setHistory([]);};
  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,.62)",zIndex:710,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"64px 12px 90px"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,maxHeight:"calc(100dvh - 128px)",overflowY:"auto",background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:24,boxShadow:"0 24px 60px rgba(0,0,0,.34)",padding:14,animation:"fadeSlide .22s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
        <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>👛 Cartera</div><div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>RP, RC y XP separados para tienda, juegos y progresión.</div></div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,fontWeight:950,color:T.g700,cursor:"pointer"}}>×</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <Card style={{padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}><div style={{fontSize:"1.6rem"}}>💎</div><div style={{fontWeight:950,color:T.g800,fontSize:"1.3rem"}}>{pts}</div><div style={{fontSize:".76rem",fontWeight:850,color:T.textSub}}>RP · RastaPoints</div></Card>
        <Card style={{padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}><div style={{fontSize:"1.6rem"}}>🪙</div><div style={{fontWeight:950,color:T.g800,fontSize:"1.3rem"}}>{rc}</div><div style={{fontSize:".76rem",fontWeight:850,color:T.textSub}}>RC · RastaCoins</div></Card>
      </div>
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800,marginBottom:8}}><span>⭐ Avatar</span><span>Nivel {lvl}</span></div>
        <div style={{fontSize:".82rem",fontWeight:850,color:T.textSub,lineHeight:1.35}}>XP actual: <b>{xp}</b> · Rango: <b>{avatarLevelName(lvl)}</b>. La XP no se gasta, sólo sube nivel.</div>
      </Card>
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#FFF4D6,#E9D8B4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800,marginBottom:8}}><span>Límite diario normal RP</span><span>{todayEarned}/{dailyMax} RP</span></div>
        <div style={{height:10,borderRadius:999,background:"rgba(75,48,27,.15)",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#5F8E22,#D5B24F)",borderRadius:999}}/></div>
        <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:8}}>Referencia de economía: los RP se reservan para retos, canjes y recompensas importantes. El Gacha usa premios de juego como RC, XP y tiradas extra.</div>
      </Card>
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#F6E8C8,#D4BD8F)"}}>
        <div style={{fontWeight:950,color:T.g800}}>Economías separadas</div>
        <div style={{fontSize:".8rem",fontWeight:820,color:T.textSub,lineHeight:1.42,marginTop:6}}>RP: tienda, cupones, avatar y recompensas valiosas. RC: juegos, Gacha, Tycoon y mejoras futuras. XP: nivel de avatar, roles e insignias, nunca se gasta.</div>
      </Card>

      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#FFF8E6,#E9D8B4)",border:`2px solid ${T.g300}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:9}}>
          <div>
            <div style={{fontWeight:950,color:T.g800}}>📜 Historial de RP</div>
            <div style={{fontSize:".74rem",fontWeight:820,color:T.textSub}}>Últimos movimientos guardados en este navegador.</div>
          </div>
          <Btn small col="ghost" onClick={clear} disabled={!history.length}>Limpiar</Btn>
        </div>
        {history.length===0?<EmptyState icon="📜" title="Sin historial todavía" sub="A partir de ahora se registrarán ganancias, gastos y devoluciones de RP."/>:
          <div style={{display:"grid",gap:7,maxHeight:260,overflowY:"auto",paddingRight:2}}>
            {history.slice(0,30).map(m=><div key={m.id} style={{display:"grid",gridTemplateColumns:"30px 1fr auto",gap:8,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.g200}`}}>
              <div style={{width:28,height:28,borderRadius:999,background:"rgba(255,244,214,.78)",display:"grid",placeItems:"center",border:`1px solid ${T.g200}`}}>{movIcon(m)}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:".8rem",fontWeight:950,color:T.g800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.reason||"Movimiento"}</div>
                <div style={{fontSize:".68rem",fontWeight:800,color:T.textSub}}>{fmtDate(m.created_at)} · {m.source||m.type}{m.balance!==null&&m.balance!==undefined?` · saldo ${m.balance}`:""}</div>
              </div>
              <div style={{fontWeight:950,color:movColor(m),fontSize:".86rem",whiteSpace:"nowrap"}}>{m.amount>0?"+":""}{m.amount} RP</div>
            </div>)}
          </div>}
      </Card>
      <div style={{marginTop:10}}><HelperInline page="cartera"/></div>
    </div>
  </div>;
}

function CartPanel({show,onClose,user,setUser,showToast}){
  const [items,setItems]=useState(()=>readCart(user));
  useEffect(()=>{
    const reload=()=>setItems(readCart(user));
    window.addEventListener("rasta-cart-updated",reload);
    return()=>window.removeEventListener("rasta-cart-updated",reload);
  },[user?.id]);
  useEffect(()=>{writeCart(user,items);},[items,user?.id]);
  if(!show)return null;
  const hydratedItems=items.map(hydrateCartItem);
  const totalPts=hydratedItems.reduce((sum,it)=>sum+(isRealMoneyProduct(it)?0:(Number(it.precio_puntos||it.puntos||0)*Number(it.qty||1))),0);
  const totalEuros=hydratedItems.reduce((sum,it)=>sum+(itemEuroPrice(it)*Number(it.qty||1)),0);
  function clearCart(){setItems([]);showToast?.("Carrito vaciado");}
  function removeItem(i){setItems(items.filter((_,idx)=>idx!==i));SFX.tab();}
  async function confirmCart(){
    if(!hydratedItems.length)return;
    const pointItems=hydratedItems.filter(x=>!isRealMoneyProduct(x));
    const realItems=hydratedItems.filter(isRealMoneyProduct);
    const totalEuros=realItems.reduce((sum,it)=>sum+(itemEuroPrice(it)*Number(it.qty||1)),0);
    if((user.puntos||0)<totalPts){showToast?.(`Te faltan ${totalPts-(user.puntos||0)} RP`);SFX.error();return;}

    const nuevos=Math.max(0,(user.puntos||0)-totalPts);

    if(totalPts>0){
      const okUser=await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});
      if(!okUser){
        showToast?.("No se pudieron descontar los RP");
        SFX.error();
        return;
      }
    }

    const avatarItems=hydratedItems.filter(raw=>isAvatarPersonalizationItem(raw));
    const gameItems=hydratedItems.filter(raw=>isGameVoucherItem(raw));
    const allImmediate=(avatarItems.length+gameItems.length)===hydratedItems.length;

    const pedido=await createShopOrder({
      user,
      items:hydratedItems,
      totalPoints:totalPts,
      source:realItems.length?"carrito_mixto":gameItems.length?"juegos":avatarItems.length?"personalizacion":"carrito",
      status:allImmediate?"entregado":"pendiente",
      notes:allImmediate?"Carrito de desbloqueos aplicado automáticamente.":"Pedido creado desde carrito."
    });

    if(pedido?.id && totalEuros>0){
      try{await dbPatch("tienda_pedidos",`?id=eq.${pedido.id}`,{precio_euros:totalEuros,updated_at:new Date().toISOString()});}catch{}
    }

    for(const raw of hydratedItems){
      const qty=Math.max(1,Number(raw.qty||1));
      for(let n=0;n<qty;n++){
        const isAvatar=isAvatarPersonalizationItem(raw);
        const isGame=isGameVoucherItem(raw);
        if(isAvatar) await unlockCosmeticForUser(user,raw);
        if(isGame) applyGameVoucher(user,raw,1);
        try{
          await dbPost("canjes",{
            usuario_id:user.id,
            premio_id:raw.id||raw.item_key||null,
            premio_nombre:raw.nombre||"Artículo",
            puntos_gastados:isRealMoneyProduct(raw)?0:Number(raw.precio_puntos||raw.puntos||0),
            item_key:raw.item_key||null,
            categoria:raw.categoria||"premios",
            tipo:raw.tipo||"carrito"
          });
        }catch{}
      }
    }

    if(totalPts>0){
      recordPointMovement(user.id,{amount:-totalPts,type:"spend",reason:`Carrito confirmado (${hydratedItems.length} artículo${hydratedItems.length===1?"":"s"})`,source:"carrito",balance:nuevos,meta:{pedido_id:pedido?.id||null,items:hydratedItems.map(x=>x.item_key||x.id||x.nombre)}});
      setUser?.(u=>({...u,puntos:nuevos}));
    }

    try{
      if(avatarItems.length){
        await createNotification({usuario_id:user.id,rol_destino:"client",tipo:"avatar",titulo:"Personalización desbloqueada",mensaje:`Has desbloqueado ${avatarItems.length} artículo${avatarItems.length===1?"":"s"} para tu avatar/perfil. Ve a Perfil > Editor para equiparlo.`,entidad_tipo:"avatar",entidad_id:String(user.id),importante:false});
      }
      if(gameItems.length){
        await createNotification({usuario_id:user.id,rol_destino:"client",tipo:"juegos",titulo:"Vales de juego aplicados",mensaje:`Has añadido tiradas extra al Gacha Barber.`,entidad_tipo:"juego_bonus",entidad_id:String(user.id),importante:false});
      }
      await createNotification({rol_destino:"admin",tipo:"pedido",titulo:"Carrito confirmado",mensaje:`${user.nombre||user.email||"Cliente"} confirmó un carrito de ${hydratedItems.length} artículo${hydratedItems.length===1?"":"s"}${totalPts?` por ${totalPts} puntos`:""}${totalEuros?` y ${totalEuros.toFixed(2)} €`:""}.`,entidad_tipo:"tienda_pedido",entidad_id:pedido?.id||String(user.id),importante:!allImmediate});
    }catch{}

    setItems([]);
    SFX.collect();
    showToast?.(gameItems.length?`Carrito confirmado. Tiradas añadidas.`:avatarItems.length?`Carrito confirmado. Personalización desbloqueada.`:"Carrito confirmado");
    onClose?.();
  }

  return <div style={{position:"fixed",inset:0,background:"rgba(10,7,4,.62)",zIndex:710,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"64px 12px 90px"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,background:"linear-gradient(180deg,#FFF8E6,#F3E2BC)",border:`2px solid ${T.g300}`,borderRadius:24,boxShadow:"0 24px 60px rgba(0,0,0,.34)",padding:14,animation:"fadeSlide .22s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
        <div><div style={{fontFamily:"'Pirata One',cursive",fontSize:"1.35rem",color:T.g800}}>🛒 Carrito</div><div style={{fontSize:".78rem",fontWeight:850,color:T.textSub}}>Estilo, juegos y productos. Total: {totalPts} pts{totalEuros?` · ${totalEuros.toFixed(2)} €`:""}</div></div>
        <button onClick={onClose} style={{background:T.g150,border:"none",borderRadius:"50%",width:36,height:36,fontWeight:950,color:T.g700,cursor:"pointer"}}>×</button>
      </div>
      {items.length===0?<EmptyState icon="🛒" title="Carrito vacío" sub="Aquí guardaremos compras de tienda y personalización del avatar. El Tycoon queda aparte."/>:<div style={{display:"grid",gap:8}}>{items.map((it,i)=><Card key={`${it.id}-${i}`} style={{padding:10}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}><div style={{minWidth:0}}><div style={{fontWeight:950,color:T.g800,display:"flex",gap:7,alignItems:"center"}}><span>{it.icono||"🎁"}</span><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.nombre||it.titulo||"Artículo"}</span></div><div style={{fontSize:".76rem",fontWeight:820,color:T.textSub}}>{isGameVoucherItem(it)?`Vale juego · +${gameVoucherAmount(it)} tiradas`:isRealMoneyProduct(it)?"Producto real · pago en tienda":it.categoria==="avatar"?"Personalización avatar/perfil":(it.tipo||"tienda")} · x{it.qty||1}</div></div><div style={{display:"grid",gap:6,justifyItems:"end"}}><div style={{fontWeight:950,color:T.g800}}>{isRealMoneyProduct(it)?(itemEuroPrice(it)?`${(itemEuroPrice(it)*(it.qty||1)).toFixed(2)} €`:"Consultar"):`${Number(it.precio_puntos||it.puntos||0)*(it.qty||1)} pts`}</div><button onClick={()=>removeItem(i)} style={{border:`1px solid ${T.g200}`,background:"rgba(255,244,214,.72)",borderRadius:999,padding:"4px 8px",fontWeight:950,color:T.red,cursor:"pointer"}}>Quitar</button></div></div></Card>)}</div>}
      <Card style={{marginTop:10,padding:12,background:"linear-gradient(180deg,#F6E8C8,#D4BD8F)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800}}><span>Total puntos</span><span>{totalPts} pts</span></div>
        {totalEuros>0&&<div style={{display:"flex",justifyContent:"space-between",fontWeight:950,color:T.g800,marginTop:4}}><span>Total productos €</span><span>{totalEuros.toFixed(2)} €</span></div>}
        <div style={{fontSize:".76rem",fontWeight:820,color:T.textSub,lineHeight:1.35,marginTop:6}}>Los puntos se descuentan al confirmar. Los productos reales quedan como pedido pendiente de pago/confirmación en tienda.</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}><Btn small col="ghost" onClick={clearCart} disabled={!items.length}>Vaciar</Btn><Btn small col="gold" onClick={confirmCart} disabled={!hydratedItems.length}>Confirmar</Btn></div>
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


function clearRastaCutsClientData(){
  try{
    const keepTheme=localStorage.getItem("rastaCutsUiTheme");
    localStorage.clear();
    sessionStorage.clear();
    if(keepTheme) localStorage.setItem("rastaCutsUiTheme",keepTheme);
  }catch{}
  try{location.reload();}catch{window.location.reload();}
}

function makeDebugInfo({user=null,settings=null,checkingSession=false,sessionWarning=false}={}){
  let ua="";
  let width="";
  let online="";
  try{ua=navigator.userAgent||"";width=`${window.innerWidth}x${window.innerHeight}`;online=String(navigator.onLine);}catch{}
  return {
    version:APP_VERSION,
    build:APP_BUILD_DATE,
    user:user?.email||user?.nombre||"sin sesión",
    role:user?.rol||user?.role||"none",
    page:typeof window!=="undefined"?window.location.href:"",
    viewport:width,
    online,
    checkingSession:Boolean(checkingSession),
    sessionWarning:Boolean(sessionWarning),
    supabaseUrl:typeof SUPA_URL!=="undefined"?SUPA_URL:"no disponible",
    theme:typeof document!=="undefined"?document.body?.dataset?.rcTheme||"":"",
    settingsLoaded:Boolean(settings),
    userAgent:ua.slice(0,220)
  };
}

function SafetyVersionPanel({user=null,settings=null,checkingSession=false,sessionWarning=false}={}){
  const [open,setOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const [safeMode,setSafeMode]=useState(()=>{
    try{return localStorage.getItem(APP_SAFE_MODE_KEY)==="1";}catch{return false;}
  });
  const info=makeDebugInfo({user,settings,checkingSession,sessionWarning});
  async function copyInfo(){
    const txt=JSON.stringify(info,null,2);
    try{await navigator.clipboard.writeText(txt);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}
  }
  function toggleSafeMode(){
    const next=!safeMode;
    setSafeMode(next);
    try{localStorage.setItem(APP_SAFE_MODE_KEY,next?"1":"0");}catch{}
  }
  if(open){
    return (
      <div style={{position:"fixed",left:10,right:10,bottom:"calc(76px + env(safe-area-inset-bottom,0px))",zIndex:2500,display:"flex",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{width:"min(460px,100%)",pointerEvents:"auto",background:"linear-gradient(180deg,#FFF8E6,#E9D3A4)",color:T.g900,border:`2px solid ${sessionWarning?T.red:T.gold}`,borderRadius:18,boxShadow:"0 18px 46px rgba(0,0,0,.36)",padding:12,fontFamily:"'Outfit',system-ui,sans-serif"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
            <div>
              <div style={{fontWeight:1000,fontSize:".92rem",color:T.g900}}>🛡️ Diagnóstico Rasta Cuts</div>
              <div style={{fontSize:".72rem",fontWeight:850,color:T.textSub}}>{APP_VERSION_SHORT} · {APP_BUILD_DATE}</div>
            </div>
            <button onClick={()=>setOpen(false)} style={{border:0,borderRadius:999,width:30,height:30,background:T.g150,color:T.g800,fontWeight:1000,cursor:"pointer"}}>×</button>
          </div>
          {sessionWarning&&<div style={{background:"#FFF1C8",border:`1px solid ${T.orange}`,borderRadius:12,padding:9,marginBottom:8,fontSize:".78rem",fontWeight:900,color:T.g800}}>Supabase o la sesión están tardando más de lo normal. Si se queda cargando, limpia datos y recarga.</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,fontSize:".72rem",fontWeight:850,color:T.textSub,marginBottom:10}}>
            <div><b>Usuario:</b><br/>{info.user}</div>
            <div><b>Rol:</b><br/>{info.role}</div>
            <div><b>Pantalla:</b><br/>{info.viewport||"--"}</div>
            <div><b>Online:</b><br/>{info.online||"--"}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button onClick={copyInfo} style={{border:0,borderRadius:12,padding:"10px 8px",background:T.g700,color:T.white,fontWeight:1000,cursor:"pointer"}}>{copied?"Copiado":"Copiar debug"}</button>
            <button onClick={clearRastaCutsClientData} style={{border:0,borderRadius:12,padding:"10px 8px",background:T.red,color:T.white,fontWeight:1000,cursor:"pointer"}}>Limpiar datos</button>
            <button onClick={toggleSafeMode} style={{gridColumn:"1 / -1",border:`1px solid ${T.g300}`,borderRadius:12,padding:"9px 8px",background:safeMode?"#F8E0B4":"#FFF8E6",color:T.g800,fontWeight:1000,cursor:"pointer"}}>Modo seguro local: {safeMode?"ON":"OFF"}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <button onClick={()=>setOpen(true)} title={`Versión ${APP_VERSION_SHORT}`} style={{position:"fixed",left:10,bottom:"calc(84px + env(safe-area-inset-bottom,0px))",zIndex:2400,border:0,borderRadius:999,padding:"6px 9px",background:sessionWarning?"linear-gradient(180deg,#A72822,#672018)":"linear-gradient(180deg,#21140C,#130B06)",color:"#FFF4D6",fontWeight:1000,fontSize:".68rem",boxShadow:"0 8px 18px rgba(0,0,0,.26)",cursor:"pointer",opacity:.88}}>
      {sessionWarning?"⚠️":"🛡️"} {APP_VERSION_SHORT}
    </button>
  );
}


/* ===== Compatibilidad UI básica 2.5.1 =====
   Mantiene vivos los componentes globales usados por pantallas antiguas.
   Evita errores como: Particles is not defined, Toast is not defined, Av is not defined.
*/
function Av({av=0,config=null,size=36}){
  const raw=typeof config==="string"?(function(){try{return JSON.parse(config)}catch{return null}})():config;
  if(raw && (raw.model||raw.hairColor||raw.hat||raw.tattoo)){
    const cfg=normalizeAvatarV3(raw,av);
    return <div title={`${cfg.model==="female"?"Femenino":"Masculino"} · ${HAIR_STYLES.find(h=>h.id===cfg.hair)?.label||"Avatar"}`} style={{
      width:size,height:size,borderRadius:"28%",display:"flex",alignItems:"center",justifyContent:"center",
      overflow:"hidden",background:"linear-gradient(160deg,#2A160B,#C08A2A)",border:"2px solid rgba(255,244,214,.9)",
      boxShadow:"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)"
    }}>
      <CartoonAvatar config={cfg} size={size*1.42} mini/>
    </div>;
  }
  const cfg=normalizeAvatarConfig(config,av);
  const frame={none:`2px solid rgba(255,244,214,.9)`,bronze:`3px solid #C97934`,gold:`3px solid #D4AF37`,neon:`3px solid #5FD7FF`,legend:`3px solid #FFF1A8`}[cfg.frame]||`2px solid rgba(255,244,214,.9)`;
  const aura={none:"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)",warm:"0 0 22px rgba(212,175,55,.45), 0 8px 18px rgba(20,8,4,.28)",flame:"0 0 26px rgba(240,106,59,.55), 0 8px 18px rgba(20,8,4,.28)",ocean:"0 0 26px rgba(95,215,255,.45), 0 8px 18px rgba(20,8,4,.28)",vip:"0 0 30px rgba(255,241,168,.7), 0 8px 18px rgba(20,8,4,.28)"}[cfg.aura]||"0 8px 18px rgba(20,8,4,.28), inset 0 2px 0 rgba(255,255,255,.35)";
  return <div title={avatarStyleName(cfg)} style={{width:size,height:size,borderRadius:"28%",background:bgGradient(cfg.bg),display:"flex",alignItems:"center",justifyContent:"center",border:frame,boxShadow:aura,position:"relative",overflow:"hidden",perspective:500}}>
    {cfg.aura!=="none"&&<span style={{position:"absolute",inset:3,borderRadius:"28%",background:"radial-gradient(circle at 35% 18%,rgba(255,255,255,.28),transparent 42%)",pointerEvents:"none"}}/>}
    <AvatarFigure config={cfg} size={size*1.18} animated={size>=70}/>
  </div>;
}
function Toast({msg,show}){
  if(!show)return null;
  return <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:T.g800,color:T.white,padding:"12px 22px",borderRadius:50,fontWeight:900,fontSize:"0.88rem",zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 6px 24px rgba(27,67,50,0.35)",animation:"toastIn 0.3s ease"}}>{msg}</div>;
}
function PtsPopup({pts,show}){
  if(!show||!pts)return null;
  return <div style={{position:"fixed",top:"35%",left:"50%",transform:"translateX(-50%)",zIndex:9999,animation:"ptsFloat 1.8s ease forwards",pointerEvents:"none"}}><div style={{background:T.gradGold,color:T.white,borderRadius:50,padding:"10px 24px",fontWeight:900,fontSize:"1.4rem",boxShadow:"0 6px 24px rgba(255,183,3,0.5)"}}>+{pts} pts</div></div>;
}
function Particles(){
  const items=["✂","〰","◆","✦","•","⟡"];
  return <div aria-hidden="true" style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>{[...Array(10)].map((_,i)=><div key={i} style={{position:"absolute",left:`${6+i*10}%`,bottom:"-10%",fontSize:i%3===0?"1.35rem":"1rem",opacity:.09,animation:`floatUp ${13+i*2}s linear ${i*1.4}s infinite`}}>{items[i%items.length]}</div>)}</div>;
}


function GlobalUIPolishPatch(){
  return <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Pirata+One&family=Rye&family=Nunito:wght@500;700;800;900&family=Inter:wght@500;700;800;900&display=swap");
    /* Rasta Cuts 2.9.6d · polish global + RastaHelp sticker limpio */
    :root{
      --rc-font-body: Inter, Nunito, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --rc-font-title: "Pirata One", "Rye", "Georgia", serif;
      --rc-radius-card: 20px;
      --rc-shadow-soft: 0 12px 28px rgba(20,8,4,.16);
      --rc-shadow-card: 0 8px 18px rgba(20,8,4,.18);
    }
    html,body,#root{
      font-family:var(--rc-font-body)!important;
      text-rendering:optimizeLegibility;
      -webkit-font-smoothing:antialiased;
    }
    .app-shell{
      letter-spacing:.005em;
    }
    .studio-panel{
      border-radius:var(--rc-radius-card)!important;
      box-shadow:var(--rc-shadow-card)!important;
    }
    .studio-panel, .modal-panel-pro{
      color:var(--rc-text,#1A0F08)!important;
    }
    .section-title-pro,
    .community-title-pro,
    .home-title-pro{
      font-family:var(--rc-font-title)!important;
      letter-spacing:.01em;
    }
    .nav-tab-pro span,
    .header-action-pro,
    button{
      font-family:var(--rc-font-body)!important;
    }

    /* Helper sin recuadro: sólo el dibujo y una sombra de sticker */
    .rasta-helper-fixed-safe,
    .rasta-helper-fixed-safe *,
    .rasta-helper-fixed-safe button[aria-label],
    .rasta-helper-fixed-safe .rasta-face-avatar,
    .rasta-helper-fixed-safe .helper-hero-face-crop{
      background:transparent!important;
      background-color:transparent!important;
      border-color:transparent!important;
      box-shadow:none!important;
    }
    .rasta-helper-fixed-safe .rasta-face-avatar{
      overflow:visible!important;
      border:0!important;
      filter:none!important;
      width:54px!important;
      height:54px!important;
    }
    .rasta-helper-fixed-safe .rasta-face-avatar::before,
    .rasta-helper-fixed-safe .rasta-face-avatar::after,
    .rasta-helper-fixed-safe .rasta-face-avatar > div:first-child{
      content:none!important;
      display:none!important;
      opacity:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    .rasta-helper-fixed-safe .helper-hero-face-crop{
      overflow:visible!important;
      border-radius:0!important;
      filter:drop-shadow(0 9px 12px rgba(0,0,0,.28))!important;
      transform:translate(-50%,-50%) scale(1.08)!important;
    }
    .rasta-helper-fixed-safe .helper-hero-face-crop circle[fill*="255,214,107"],
    .rasta-helper-fixed-safe .helper-hero-face-crop circle[fill*="#FFF"],
    .rasta-helper-fixed-safe .helper-hero-face-crop rect[fill="transparent"]{
      display:none!important;
    }
    .rasta-helper-fixed-safe button[aria-label]{
      width:78px!important;
      height:78px!important;
      padding:0!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    .rasta-helper-fixed-safe button[aria-label] > div{
      background:transparent!important;
      box-shadow:none!important;
    }
    .rasta-helper-fixed-safe button[aria-label] > div > div:last-child{
      transform:scale(.82);
      transform-origin:center;
      box-shadow:0 5px 12px rgba(20,8,4,.20)!important;
    }

    /* 2.9.6i · Home premium real, sin usar imágenes externas */
    .premium-home{
      --premium-gold:#E0B84F;
      --premium-teal:#5EF0C8;
      --premium-ink:#07100D;
    }
    .premium-home button{transition:transform .18s ease, filter .18s ease, box-shadow .18s ease;}
    .premium-home button:hover{transform:translateY(-2px);filter:saturate(1.07) brightness(1.04);}
    .premium-home button:active{transform:translateY(0) scale(.985);}
    @media(max-width:860px){
      .premium-home-grid-main{grid-template-columns:1fr!important;}
    }

    .rc-header-actions{
      flex-wrap:nowrap!important;
      justify-content:flex-end!important;
      overflow:visible!important;
    }
    .rc-top-icon-btn{
      width:34px!important;
      height:34px!important;
      min-width:34px!important;
      display:inline-grid!important;
      place-items:center!important;
      padding:0!important;
      line-height:1!important;
      overflow:visible!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 12px rgba(0,0,0,.18)!important;
    }
    .rc-top-icon-btn .rc-btn-icon{
      display:block!important;
      font-size:1rem!important;
      line-height:1!important;
      transform:none!important;
    }
    .rc-profile-mini{
      overflow:hidden!important;
    }
    .rc-profile-mini > div{
      transform:scale(.88)!important;
      transform-origin:center!important;
    }

    @media(max-width:560px){
      .rc-header-actions{gap:3px!important;flex-shrink:0!important;max-width:calc(100vw - 150px)!important;}
      .rc-top-icon-btn{width:27px!important;height:27px!important;min-width:27px!important;border-radius:10px!important;}
      .rc-top-icon-btn .rc-btn-icon{font-size:.78rem!important;}
      .rc-profile-mini > div{transform:scale(.72)!important;transform-origin:center!important;}
      .rc-top-badge{top:-4px!important;right:-4px!important;min-width:14px!important;height:14px!important;font-size:.48rem!important;border-width:1px!important;}
      .rc-client-rp-chip{display:none!important;}
      .rasta-helper-fixed-safe{
        right:8px!important;
        bottom:calc(78px + env(safe-area-inset-bottom,0px))!important;
        transform:scale(.84)!important;
        transform-origin:bottom right!important;
        z-index:2300!important;
      }
      .rasta-helper-fixed-safe button[aria-label]{
        width:64px!important;
        height:64px!important;
      }
      .rasta-helper-fixed-safe .rasta-face-avatar{
        width:46px!important;
        height:46px!important;
      }

      .premium-home section{min-height:auto!important;}
      .premium-home h1{font-size:3.05rem!important;}
    }
    @media(max-width:520px){
      .rasta-helper-fixed-safe .rasta-face-avatar{width:50px!important;height:50px!important;}
      .rasta-helper-fixed-safe button[aria-label]{width:64px!important;height:64px!important;}
    }

    /* 2.9.7a · App Store UI Foundation
       Rollo graffiti/tattoo/rasta real en CSS, sin tocar Supabase ni economía. */
    :root{
      --rc-ink:#050706;
      --rc-night:#07100d;
      --rc-deep:#0b1711;
      --rc-card:rgba(12,20,15,.82);
      --rc-card-strong:rgba(8,13,10,.94);
      --rc-border:rgba(255,218,119,.22);
      --rc-gold:#f0c85c;
      --rc-teal:#36e0bc;
      --rc-red:#d94a35;
      --rc-cream:#fff3d0;
      --rc-muted:#c9b681;
      --rc-text:#fff7dc;
      --rc-glow:0 0 34px rgba(54,224,188,.18),0 18px 55px rgba(0,0,0,.38);
      --rc-font-body: Inter, Nunito, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --rc-font-title: "Pirata One", "Rye", "Georgia", serif;
    }

    html,body,#root{
      min-height:100%;
      background:
        radial-gradient(circle at 14% 8%,rgba(54,224,188,.15),transparent 26%),
        radial-gradient(circle at 92% 5%,rgba(240,200,92,.14),transparent 28%),
        radial-gradient(circle at 70% 92%,rgba(217,74,53,.10),transparent 30%),
        linear-gradient(135deg,#030504 0%,#07100d 45%,#100b07 100%)!important;
    }

    body::before{
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:0;
      opacity:.38;
      background-image:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,.035) 1px, transparent 1px),
        radial-gradient(circle at 18% 30%,rgba(54,224,188,.08),transparent 18%),
        radial-gradient(circle at 84% 38%,rgba(240,200,92,.08),transparent 20%);
      background-size:42px 42px,42px 42px,100% 100%,100% 100%;
      mask-image:linear-gradient(180deg,rgba(0,0,0,.95),rgba(0,0,0,.55));
    }

    body::after{
      content:"";
      display:none!important;
    }

    .app-shell{
      max-width:min(1180px,100vw)!important;
      background:
        radial-gradient(circle at 18% 0%,rgba(54,224,188,.14),transparent 28%),
        radial-gradient(circle at 92% 8%,rgba(240,200,92,.14),transparent 26%),
        radial-gradient(circle at 82% 92%,rgba(217,74,53,.08),transparent 30%),
        linear-gradient(180deg,rgba(6,12,9,.94),rgba(8,10,8,.98))!important;
      border-left:1px solid rgba(240,200,92,.16);
      border-right:1px solid rgba(240,200,92,.16);
      box-shadow:0 0 80px rgba(0,0,0,.45);
      overflow:hidden;
      isolation:isolate;
    }

    .app-shell::before{
      content:"";
      position:fixed;
      left:50%;
      top:76px;
      transform:translateX(-50%);
      width:min(1120px,92vw);
      height:260px;
      pointer-events:none;
      z-index:0;
      opacity:.68;
      background:
        radial-gradient(circle at 18% 30%,rgba(54,224,188,.20),transparent 22%),
        radial-gradient(circle at 72% 18%,rgba(240,200,92,.18),transparent 24%),
        linear-gradient(110deg,rgba(255,255,255,.05),transparent 30%,rgba(217,74,53,.06));
      border-radius:42px;
      filter:blur(2px);
    }

    .app-header-pro{
      margin:12px auto 0!important;
      width:calc(100% - 28px)!important;
      border:1px solid rgba(240,200,92,.28)!important;
      border-radius:24px!important;
      background:
        linear-gradient(135deg,rgba(5,7,6,.94),rgba(12,25,18,.92) 56%,rgba(53,34,14,.78))!important;
      box-shadow:0 18px 45px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.10)!important;
      backdrop-filter:blur(16px) saturate(1.1);
    }

    .brand-home-button{
      background:linear-gradient(135deg,rgba(255,244,214,.12),rgba(54,224,188,.05))!important;
      border:1px solid rgba(255,244,214,.14)!important;
      border-radius:16px!important;
      padding:7px 12px!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10)!important;
      color:var(--rc-cream)!important;
      font-family:"Pirata One","Rye",Georgia,serif!important;
      font-weight:400!important;
      letter-spacing:.02em!important;
      text-shadow:0 0 18px rgba(240,200,92,.22)!important;
    }
    .brand-scissors{filter:drop-shadow(0 0 8px rgba(54,224,188,.55));}

    .header-action-pro,
    .wallet-button-pro,
    .cart-button-pro,
    .theme-toggle-pro{
      background:rgba(255,244,214,.09)!important;
      border:1px solid rgba(255,244,214,.12)!important;
      color:var(--rc-cream)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;
      backdrop-filter:blur(10px);
    }

    .page-content-pro{
      position:relative;
      z-index:1;
      margin:14px auto 116px!important;
      width:calc(100% - 24px)!important;
      min-height:calc(100dvh - 210px);
      border:1px solid rgba(240,200,92,.14)!important;
      border-radius:32px!important;
      background:
        radial-gradient(circle at 12% 0%,rgba(54,224,188,.10),transparent 24%),
        radial-gradient(circle at 90% 8%,rgba(240,200,92,.10),transparent 28%),
        linear-gradient(180deg,rgba(6,16,12,.64),rgba(9,9,7,.70))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 18px 60px rgba(0,0,0,.28);
      overflow:visible;
    }

    .page-content-pro::before{
      content:"";
      position:absolute;
      inset:0;
      border-radius:32px;
      pointer-events:none;
      z-index:-1;
      opacity:.42;
      background-image:
        radial-gradient(circle at 6% 18%,rgba(255,244,214,.10) 0 1px,transparent 2px),
        radial-gradient(circle at 96% 24%,rgba(54,224,188,.12) 0 1px,transparent 2px),
        repeating-linear-gradient(135deg,transparent 0 19px,rgba(255,255,255,.026) 20px 21px);
      background-size:86px 86px,104px 104px,100% 100%;
    }

    .motion-strip{
      height:3px!important;
      background:linear-gradient(90deg,transparent,var(--rc-teal),var(--rc-gold),var(--rc-red),transparent)!important;
      border-radius:999px!important;
      opacity:.95!important;
      box-shadow:0 0 24px rgba(54,224,188,.32),0 0 34px rgba(240,200,92,.16)!important;
    }

    .studio-panel,
    .card,
    .modal-panel-pro{
      background:
        linear-gradient(155deg,rgba(255,244,214,.92),rgba(232,206,145,.88))!important;
      border:1px solid rgba(240,200,92,.32)!important;
      border-radius:22px!important;
      box-shadow:0 16px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.28)!important;
    }

    [data-rc-theme="night"] .studio-panel,
    [data-rc-theme="night"] .card,
    [data-rc-theme="night"] .modal-panel-pro{
      color:var(--rc-cream)!important;
      background:
        linear-gradient(155deg,rgba(16,28,21,.92),rgba(8,14,10,.88))!important;
      border:1px solid rgba(240,200,92,.24)!important;
      box-shadow:0 16px 34px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.08)!important;
    }

    .premium-home{
      gap:16px!important;
    }
    .premium-home section{
      border-radius:34px!important;
      border:1px solid rgba(240,200,92,.34)!important;
      background:
        linear-gradient(90deg,rgba(3,6,5,.98) 0%,rgba(8,22,16,.92) 46%,rgba(42,26,10,.52) 100%),
        radial-gradient(circle at 20% 26%,rgba(54,224,188,.23),transparent 26%),
        radial-gradient(circle at 76% 24%,rgba(240,200,92,.23),transparent 28%),
        radial-gradient(circle at 87% 78%,rgba(217,74,53,.12),transparent 28%),
        repeating-linear-gradient(-12deg,rgba(255,255,255,.045) 0 1px,transparent 1px 21px)!important;
      box-shadow:0 30px 80px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.12)!important;
    }
    .premium-home section::after{
      content:"";
      display:none!important;
    }

    .premium-home h1{
      font-family:"Pirata One","Rye",Georgia,serif!important;
      font-weight:400!important;
      font-size:clamp(2.45rem,6.2vw,5.35rem)!important;
      letter-spacing:.018em!important;
      color:var(--rc-cream)!important;
      text-shadow:0 6px 0 rgba(0,0,0,.30),0 0 26px rgba(240,200,92,.25)!important;
    }
    .premium-home h1::first-letter{
      color:var(--rc-gold);
    }

    .premium-home section p,
    .premium-home section div{
      text-wrap:pretty;
    }

    .premium-home section button,
    .premium-home button{
      border-radius:18px!important;
    }

    .premium-home > div > button,
    .premium-home-grid-main button{
      border-width:1px!important;
      border-color:rgba(240,200,92,.28)!important;
      background:
        linear-gradient(160deg,rgba(10,18,13,.96),rgba(17,30,22,.90) 58%,rgba(48,30,12,.72)),
        radial-gradient(circle at 85% 12%,rgba(54,224,188,.18),transparent 34%)!important;
      box-shadow:0 18px 42px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.10)!important;
    }
    .premium-home > div > button:nth-child(2n),
    .premium-home-grid-main button:nth-child(2n){
      background:
        linear-gradient(160deg,rgba(9,14,12,.96),rgba(30,20,12,.92) 58%,rgba(75,46,12,.66)),
        radial-gradient(circle at 80% 10%,rgba(240,200,92,.20),transparent 34%)!important;
    }
    .premium-home > div > button:nth-child(3n),
    .premium-home-grid-main button:nth-child(3n){
      background:
        linear-gradient(160deg,rgba(10,14,12,.96),rgba(24,17,31,.88) 58%,rgba(50,20,70,.46)),
        radial-gradient(circle at 80% 10%,rgba(177,76,255,.18),transparent 34%)!important;
    }

    .bottom-nav-pro{
      width:min(720px,calc(100% - 24px))!important;
      bottom:12px!important;
      border:1px solid rgba(240,200,92,.24)!important;
      border-radius:24px!important;
      padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px))!important;
      background:linear-gradient(135deg,rgba(5,7,6,.92),rgba(12,22,16,.92))!important;
      box-shadow:0 -6px 34px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.08)!important;
      backdrop-filter:blur(18px) saturate(1.1);
    }
    .nav-tab-pro{
      border-radius:17px!important;
      min-width:64px!important;
      padding:4px 7px!important;
      transition:transform .18s ease,background .18s ease!important;
    }
    .nav-tab-pro[data-active="true"]{
      background:linear-gradient(180deg,rgba(54,224,188,.18),rgba(240,200,92,.11))!important;
      box-shadow:inset 0 0 0 1px rgba(255,244,214,.11)!important;
      transform:translateY(-2px);
    }
    .nav-icon-pro{
      border-radius:16px!important;
      border:1px solid rgba(255,244,214,.10)!important;
      background:rgba(255,255,255,.05)!important;
    }

    .rasta-helper-fixed-safe{
      filter:drop-shadow(0 18px 22px rgba(0,0,0,.32));
    }

    input,textarea,select{
      border-radius:16px!important;
      border-color:rgba(240,200,92,.36)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.18)!important;
    }

    @media(min-width:900px){
      .app-shell{border-radius:0!important;}
      .page-content-pro{padding:24px!important;}
      .premium-home > div[style*="grid-template-columns:repeat"]{
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;
      }
    }
    @media(max-width:560px){
      .app-shell{width:100vw!important;max-width:100vw!important;overflow-x:hidden!important;border-left:0!important;border-right:0!important;}
      .app-header-pro{margin:6px auto 0!important;width:calc(100% - 10px)!important;border-radius:18px!important;padding:7px 8px!important;gap:6px!important;overflow:hidden!important;}
      .app-header-pro > div:first-child{flex:1 1 auto!important;min-width:0!important;gap:5px!important;overflow:hidden!important;}
      .app-header-pro > div:last-child{flex:0 0 auto!important;gap:4px!important;min-width:0!important;}
      .brand-home-button{max-width:128px!important;padding:5px 7px!important;gap:5px!important;font-size:1.02rem!important;border-radius:14px!important;}
      .brand-home-button .brand-rasta-mark{width:24px!important;height:24px!important;min-width:24px!important;}
      .brand-home-button .brand-rasta-mark svg{transform:scale(.78)!important;transform-origin:center!important;}
      .app-header-pro > div:first-child > span{display:none!important;}
      .header-action-pro{padding:0!important;display:inline-grid!important;place-items:center!important;line-height:1!important;}
      .header-action-pro svg,.header-action-pro img{max-width:24px!important;max-height:24px!important;}
      .wallet-button-pro,.cart-button-pro{font-size:.82rem!important;}
      .theme-toggle-pro .theme-word{display:none!important;}
      .theme-toggle-pro{width:27px!important;min-width:27px!important;}
      .app-header-pro .header-action-pro:last-child{width:27px!important;height:27px!important;padding:0!important;overflow:hidden!important;}
      .app-header-pro .header-action-pro:last-child > div,.app-header-pro .header-action-pro:last-child svg{transform:scale(.72)!important;transform-origin:center!important;}
      .page-content-pro{width:calc(100% - 10px)!important;margin-top:8px!important;border-radius:22px!important;padding:12px 8px calc(126px + env(safe-area-inset-bottom,0px))!important;overflow:hidden!important;min-height:calc(100dvh - 170px)!important;}
      .premium-home section{border-radius:22px!important;}
      .premium-home h1{font-size:clamp(2.15rem,12vw,3.4rem)!important;letter-spacing:.01em!important;line-height:.92!important;}
      .rc-home-cover{margin-left:-8px!important;margin-right:-8px!important;}
      .rc-home-cover img{max-height:230px!important;object-fit:contain!important;}
      .rc-home-cover [style*="padding:8px 12px"]{padding:6px 8px!important;font-size:.74rem!important;border-radius:12px!important;}
      .rc-home-live-panels{grid-template-columns:1fr!important;gap:10px!important;}
      .rc-home-live-panels > div{border-radius:18px!important;padding:12px!important;}
      .rc-home-live-panels [style*="grid-template-columns:repeat(3,1fr)"]{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;}
      .bottom-nav-pro{width:calc(100% - 10px)!important;border-radius:20px!important;padding:6px 5px calc(7px + env(safe-area-inset-bottom,0px))!important;gap:2px!important;}
      .nav-tab-pro{min-width:0!important;padding:2px 3px!important;gap:1px!important;}
      .nav-icon-pro{font-size:.95rem!important;padding:3px 5px!important;border-radius:12px!important;}
      .nav-tab-pro[data-active="true"] .nav-icon-pro{transform:scale(1.06)!important;}
      .nav-tab-pro span{font-size:.49rem!important;max-width:52px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
      .rc-arcade-games-grid{grid-template-columns:1fr!important;gap:9px!important;}
      .rc-arcade-games-grid .card{border-radius:18px!important;} .rc-arcade-games-grid .rc-card-title{line-height:.94!important;}
      .rasta-helper-fixed-safe{transform:scale(.86)!important;transform-origin:bottom right!important;}
    }

    @media(max-width:380px){
      .rc-header-actions{gap:2px!important;max-width:calc(100vw - 136px)!important;}
      .rc-top-icon-btn{width:25px!important;height:25px!important;min-width:25px!important;border-radius:9px!important;}
      .rc-top-icon-btn .rc-btn-icon{font-size:.72rem!important;}

      .brand-home-button{max-width:104px!important;font-size:.95rem!important;}
      .header-action-pro{width:28px!important;height:28px!important;min-width:28px!important;font-size:.72rem!important;}
      .app-header-pro{padding:6px 6px!important;}
      .nav-tab-pro span{font-size:.46rem!important;max-width:46px!important;}
      .nav-icon-pro{font-size:.9rem!important;padding:3px 4px!important;}
    }





    /* 2.9.8a · Botón de sonido con acceso largo a ajustes */
    @media(max-width:560px){
      .rc-balanced-topbar .rc-sound-mini{
        box-shadow:0 0 0 1px rgba(255,244,214,.12),0 4px 12px rgba(0,0,0,.20)!important;
      }
    }

    /* 2.9.7x · Cabecera Android equilibrada: izquierda cartera/puntos/carrito, derecha ajustes */
    .rc-balanced-topbar{
      grid-template-columns:minmax(0,1fr) auto!important;
      overflow:hidden!important;
    }
    .rc-balanced-topbar .rc-topbar-left,
    .rc-balanced-topbar .rc-topbar-right{
      min-width:0!important;
      flex-wrap:nowrap!important;
    }
    .rc-balanced-topbar .rc-mini-square,
    .rc-balanced-topbar .rc-profile-pill{
      width:32px!important;
      height:32px!important;
      min-width:32px!important;
      padding:0!important;
      display:grid!important;
      place-items:center!important;
      line-height:1!important;
    }
    .rc-balanced-topbar .rc-wallet-pill{
      height:32px!important;
      max-width:150px!important;
      min-width:72px!important;
      overflow:hidden!important;
      white-space:nowrap!important;
    }
    .rc-balanced-topbar .rc-wallet-points{
      max-width:66px!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-size:.78rem!important;
      line-height:1!important;
    }
    .rc-balanced-topbar .rc-wallet-unit{
      font-size:.62rem!important;
      opacity:.82!important;
      line-height:1!important;
    }
    .rc-balanced-topbar .rc-top-icon{
      display:block!important;
      font-size:.95rem!important;
      line-height:1!important;
      transform:none!important;
    }
    .rc-balanced-topbar .rc-profile-pill > div,
    .rc-balanced-topbar .rc-profile-pill svg{
      transform:scale(.84)!important;
      transform-origin:center!important;
    }

    @media(max-width:560px){
      .app-header-pro.rc-balanced-topbar{
        width:calc(100% - 10px)!important;
        margin:6px auto 0!important;
        padding:6px 7px!important;
        border-radius:17px!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        gap:5px!important;
      }
      .rc-balanced-topbar .rc-topbar-left{gap:4px!important;overflow:hidden!important;}
      .rc-balanced-topbar .rc-topbar-right{gap:3px!important;overflow:visible!important;}
      .rc-balanced-topbar .rc-mini-square,
      .rc-balanced-topbar .rc-profile-pill{
        width:28px!important;
        height:28px!important;
        min-width:28px!important;
        border-radius:10px!important;
      }
      .rc-balanced-topbar .rc-wallet-pill{
        height:28px!important;
        min-width:72px!important;
        max-width:106px!important;
        padding:0 7px!important;
        gap:4px!important;
        border-radius:12px!important;
      }
      .rc-balanced-topbar .rc-top-icon{font-size:.78rem!important;}
      .rc-balanced-topbar .rc-wallet-points{font-size:.68rem!important;max-width:45px!important;}
      .rc-balanced-topbar .rc-wallet-unit{font-size:.52rem!important;}
      .rc-balanced-topbar .rc-profile-pill > div,
      .rc-balanced-topbar .rc-profile-pill svg{
        transform:scale(.70)!important;
      }
      .rc-balanced-topbar .rc-top-badge{
        top:-4px!important;
        right:-4px!important;
        min-width:14px!important;
        height:14px!important;
        font-size:.46rem!important;
        border-width:1px!important;
      }
    }

    @media(max-width:380px){
      .app-header-pro.rc-balanced-topbar{padding:5px 6px!important;gap:4px!important;}
      .rc-balanced-topbar .rc-topbar-left{gap:3px!important;}
      .rc-balanced-topbar .rc-topbar-right{gap:2px!important;}
      .rc-balanced-topbar .rc-mini-square,
      .rc-balanced-topbar .rc-profile-pill{
        width:26px!important;
        height:26px!important;
        min-width:26px!important;
        border-radius:9px!important;
      }
      .rc-balanced-topbar .rc-wallet-pill{
        height:26px!important;
        min-width:62px!important;
        max-width:92px!important;
        padding:0 5px!important;
      }
      .rc-balanced-topbar .rc-top-icon{font-size:.72rem!important;}
      .rc-balanced-topbar .rc-wallet-points{font-size:.62rem!important;max-width:37px!important;}
      .rc-balanced-topbar .rc-wallet-unit{font-size:.48rem!important;}
    }

    /* 2.9.7f · Clean public copy: tono claro para clientes, staff y admin. */
    :root{
      --rc-font-title:"Pirata One","Rye",Georgia,serif;
      --rc-wall-pattern:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill='none' stroke='%23fff4d6' stroke-opacity='.14' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M35 41l28 28M63 41L35 69M48 32v45'/%3E%3Cpath d='M190 38c22 0 35 14 35 32s-13 32-35 32-35-14-35-32 13-32 35-32z'/%3E%3Cpath d='M174 70h32M190 54v32'/%3E%3Cpath d='M42 176c22-22 44-22 66 0M51 188c16-12 32-12 48 0'/%3E%3Cpath d='M160 178l23-38 23 38-23 14zM183 140v52'/%3E%3Cpath d='M215 210l10 20 22 3-16 15 4 22-20-11-20 11 4-22-16-15 22-3z' transform='scale(.62) translate(112 102)'/%3E%3C/g%3E%3Cg fill='%23f0c85c' fill-opacity='.10'%3E%3Ccircle cx='118' cy='55' r='5'/%3E%3Ccircle cx='222' cy='154' r='4'/%3E%3Ccircle cx='78' cy='224' r='4'/%3E%3C/g%3E%3C/svg%3E");
      --rc-spray-pattern:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='%23fff4d6' fill-opacity='.10'%3E%3Ccircle cx='23' cy='40' r='2'/%3E%3Ccircle cx='41' cy='58' r='1.5'/%3E%3Ccircle cx='142' cy='34' r='2.5'/%3E%3Ccircle cx='126' cy='118' r='1.7'/%3E%3Ccircle cx='54' cy='138' r='2.2'/%3E%3Ccircle cx='88' cy='82' r='1.3'/%3E%3C/g%3E%3C/svg%3E");
    }

    .app-shell{
      background:
        radial-gradient(circle at 8% 4%,rgba(54,224,188,.22),transparent 24%),
        radial-gradient(circle at 90% 10%,rgba(240,200,92,.18),transparent 26%),
        radial-gradient(circle at 72% 92%,rgba(217,74,53,.12),transparent 30%),
        var(--rc-wall-pattern),
        linear-gradient(180deg,rgba(3,7,5,.98),rgba(8,13,9,.98))!important;
      background-size:auto,auto,auto,260px 260px,auto!important;
    }

    .page-content-pro{
      background:
        linear-gradient(180deg,rgba(5,12,9,.72),rgba(5,7,6,.86)),
        var(--rc-spray-pattern),
        var(--rc-wall-pattern),
        radial-gradient(circle at 20% 0%,rgba(54,224,188,.14),transparent 25%),
        radial-gradient(circle at 85% 10%,rgba(240,200,92,.13),transparent 28%)!important;
      background-size:auto,180px 180px,260px 260px,auto,auto!important;
    }

    .page-content-pro::before{
      content:""!important;
      display:block!important;
      opacity:.34!important;
      background:
        linear-gradient(120deg,transparent 0 42%,rgba(240,200,92,.08) 44%,transparent 48%),
        radial-gradient(circle at 20% 18%,rgba(54,224,188,.16),transparent 22%),
        radial-gradient(circle at 82% 26%,rgba(217,74,53,.10),transparent 24%),
        var(--rc-wall-pattern)!important;
      background-size:auto,auto,auto,300px 300px!important;
      mix-blend-mode:screen;
    }

    .rc-visual-rework .rc-hero-wall{
      background:
        linear-gradient(90deg,rgba(2,6,5,.96) 0%,rgba(8,18,13,.90) 45%,rgba(37,21,9,.68) 100%),
        radial-gradient(circle at 76% 28%,rgba(240,200,92,.28),transparent 28%),
        radial-gradient(circle at 26% 24%,rgba(54,224,188,.20),transparent 28%),
        var(--rc-wall-pattern),
        linear-gradient(135deg,#06100c,#102419 56%,#2a1709)!important;
      background-size:auto,auto,auto,250px 250px,auto!important;
    }

    .rc-visual-rework .rc-hero-wall::before{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      z-index:1;
      opacity:.38;
      background:
        radial-gradient(circle at 18% 12%,rgba(255,244,214,.12),transparent 18%),
        linear-gradient(110deg,transparent 0 48%,rgba(240,200,92,.10) 49%,transparent 60%),
        var(--rc-spray-pattern);
      background-size:auto,auto,180px 180px;
      mix-blend-mode:screen;
    }

    .rc-hero-sign{
      background:
        linear-gradient(155deg,rgba(48,28,12,.96),rgba(8,16,12,.96)),
        var(--rc-wall-pattern)!important;
      background-size:auto,180px 180px!important;
      transform:rotate(-3deg)!important;
      box-shadow:0 24px 55px rgba(0,0,0,.45),0 0 42px rgba(240,200,92,.16),inset 0 1px 0 rgba(255,255,255,.12)!important;
    }
    .rc-hero-sign::after{
      content:"✦ tattoo flash ✦";
      position:absolute;
      left:18px;
      right:18px;
      bottom:12px;
      text-align:center;
      color:rgba(255,247,218,.58);
      font-size:.64rem;
      font-weight:950;
      letter-spacing:.16em;
      text-transform:uppercase;
    }

    .premium-home h1{
      font-family:"Rye","Pirata One",Georgia,serif!important;
      font-weight:400!important;
      letter-spacing:.025em!important;
      -webkit-text-stroke:1px rgba(240,200,92,.22);
      text-shadow:0 7px 0 rgba(0,0,0,.34),0 0 28px rgba(240,200,92,.26),0 0 42px rgba(54,224,188,.12)!important;
    }

    .rc-art-card{
      padding-top:64px!important;
      min-height:164px!important;
      border-radius:24px!important;
      isolation:isolate;
      transform:translateZ(0);
      background:
        linear-gradient(160deg,rgba(5,9,7,.96),rgba(14,25,18,.94) 54%,rgba(43,25,10,.78)),
        var(--rc-wall-pattern)!important;
      background-size:auto,220px 220px!important;
      box-shadow:0 20px 44px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.10)!important;
    }
    .rc-art-card::before{
      content:"";
      position:absolute;
      left:0;
      right:0;
      top:0;
      height:52px;
      z-index:0;
      background:
        linear-gradient(90deg,rgba(240,200,92,.26),rgba(54,224,188,.12),rgba(217,74,53,.18)),
        var(--rc-spray-pattern);
      background-size:auto,140px 140px;
      border-bottom:1px solid rgba(255,244,214,.14);
      opacity:.95;
    }
    .rc-art-card::after{
      content:attr(data-card-title);
      position:absolute;
      left:12px;
      top:14px;
      z-index:1;
      font-family:"Rye","Pirata One",Georgia,serif;
      color:rgba(255,247,218,.92);
      text-transform:uppercase;
      letter-spacing:.08em;
      font-size:.68rem;
      text-shadow:0 2px 8px rgba(0,0,0,.5);
    }
    .rc-art-card .rc-art-card-mark{
      right:12px!important;
      top:7px!important;
      opacity:.42!important;
      z-index:2!important;
      filter:drop-shadow(0 0 18px rgba(240,200,92,.35))!important;
    }
    .rc-card-title{
      font-family:"Rye","Pirata One",Georgia,serif!important;
      font-size:1.08rem!important;
      line-height:1.02!important;
      letter-spacing:.02em!important;
      color:#FFE7A4!important;
      text-shadow:0 3px 12px rgba(0,0,0,.42),0 0 18px rgba(240,200,92,.18)!important;
    }
    .rc-art-gold{border-color:rgba(240,200,92,.45)!important;}
    .rc-art-blue{border-color:rgba(54,224,188,.36)!important;}
    .rc-art-pink{border-color:rgba(177,76,255,.38)!important;}
    .rc-art-orange{border-color:rgba(217,74,53,.36)!important;}
    .rc-art-green{border-color:rgba(75,220,144,.34)!important;}
    .rc-art-gold::before{background:linear-gradient(90deg,rgba(240,200,92,.34),rgba(90,61,16,.22)),var(--rc-spray-pattern)!important;}
    .rc-art-blue::before{background:linear-gradient(90deg,rgba(54,224,188,.28),rgba(18,62,82,.22)),var(--rc-spray-pattern)!important;}
    .rc-art-pink::before{background:linear-gradient(90deg,rgba(177,76,255,.27),rgba(217,74,53,.14)),var(--rc-spray-pattern)!important;}
    .rc-art-orange::before{background:linear-gradient(90deg,rgba(217,74,53,.27),rgba(240,200,92,.15)),var(--rc-spray-pattern)!important;}
    .rc-art-green::before{background:linear-gradient(90deg,rgba(54,224,188,.22),rgba(75,220,144,.18)),var(--rc-spray-pattern)!important;}

    @media(max-width:760px){
      .rc-hero-sign{display:none!important;}
      .rc-art-card{padding-top:58px!important;min-height:150px!important;}
      .rc-art-card::before{height:48px;}
    }

    /* 2.9.7l · Login readability fix
       El login no debe heredar las tarjetas oscuras de la app interna. */
    .login-cyber-shell{
      color:#FFF7DA!important;
    }
    .login-cyber-shell .landing-feature-pro{
      background:
        linear-gradient(155deg,rgba(10,16,12,.96),rgba(22,13,7,.94))!important;
      border:1px solid rgba(240,200,92,.42)!important;
      color:#FFF7DA!important;
      box-shadow:0 16px 34px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.10)!important;
    }
    .login-cyber-shell .landing-feature-pro div{
      color:#FFF7DA!important;
    }
    .login-cyber-shell .landing-feature-pro div[style*="font-size: .72rem"],
    .login-cyber-shell .landing-feature-pro div[style*="font-size:.72rem"]{
      color:rgba(255,247,218,.84)!important;
    }
    .login-cyber-shell .landing-feature-pro .icon3d{
      opacity:1!important;
      filter:drop-shadow(0 0 12px rgba(240,200,92,.42))!important;
    }
    .login-cyber-shell .card,
    .login-cyber-shell .studio-panel.card{
      background:linear-gradient(180deg,#FFF6D8 0%,#EFD28F 100%)!important;
      color:#160D07!important;
      border:2px solid rgba(240,200,92,.72)!important;
      box-shadow:0 22px 48px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.72)!important;
    }
    .login-cyber-shell .card label,
    .login-cyber-shell .card div,
    .login-cyber-shell .card span{
      color:inherit;
    }
    .login-cyber-shell .card input,
    .login-cyber-shell .card textarea,
    .login-cyber-shell .card select{
      background:#FFF9DF!important;
      color:#160D07!important;
      border:2px solid rgba(86,54,16,.35)!important;
      box-shadow:inset 0 2px 0 rgba(255,255,255,.60)!important;
    }
    .login-cyber-shell .card input::placeholder{
      color:rgba(22,13,7,.55)!important;
    }
    .login-cyber-shell .card button{
      color:inherit;
    }
    .login-cyber-shell > div > div:last-child{
      color:#FFF7DA!important;
      background:rgba(5,8,6,.78)!important;
      border:1px solid rgba(240,200,92,.35)!important;
      text-shadow:0 2px 8px rgba(0,0,0,.45);
    }
    @media(max-width:560px){
      .login-cyber-shell{padding:12px 10px 26px!important;}
      .login-cyber-shell .landing-feature-pro{min-height:86px!important;}
    }


    /* 2.9.7m · Store polish */
    .shop-visual-panel::before{
      content:"";
      position:absolute;
      inset:-40px -20px auto auto;
      width:240px;
      height:220px;
      background:
        radial-gradient(circle at 50% 50%,rgba(240,200,92,.22),transparent 48%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160' viewBox='0 0 180 160'%3E%3Cg fill='none' stroke='%23F2C85B' stroke-opacity='.22' stroke-width='5' stroke-linecap='round'%3E%3Cpath d='M40 42h70l12 72H28L40 42Z'/%3E%3Cpath d='M58 44c3-24 36-24 40 0'/%3E%3Cpath d='M120 35l34 34M154 35l-34 34'/%3E%3Ccircle cx='137' cy='52' r='7'/%3E%3Cpath d='M47 113h60'/%3E%3C/g%3E%3C/svg%3E");
      background-size:cover;
      opacity:.7;
      transform:rotate(-5deg);
      pointer-events:none;
    }
    .shop-graffiti-glow{
      position:absolute;
      inset:0;
      background:
        radial-gradient(circle at 12% 20%,rgba(54,224,188,.16),transparent 26%),
        radial-gradient(circle at 76% 72%,rgba(217,74,53,.18),transparent 30%),
        repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 48px);
      pointer-events:none;
    }
    .shop-mini-stat{
      min-height:76px;
      border-radius:18px;
      padding:10px;
      background:rgba(255,244,214,.08);
      border:1px solid rgba(240,200,92,.28);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10);
      display:flex;
      flex-direction:column;
      justify-content:center;
    }
    .shop-mini-stat b{
      color:#FFE7A4;
      font-size:1.08rem;
      line-height:1;
    }
    .shop-mini-stat span{
      margin-top:5px;
      color:rgba(255,244,214,.72);
      font-weight:850;
      font-size:.70rem;
      line-height:1.15;
    }
    .shop-reward-card{
      transform:translateZ(0);
      box-shadow:0 16px 36px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.35)!important;
    }
    .shop-reward-card:hover{
      transform:translateY(-1px);
      box-shadow:0 20px 42px rgba(0,0,0,.28),0 0 0 1px rgba(240,200,92,.18)!important;
    }
    @media(max-width:720px){
      .shop-command-layout{grid-template-columns:1fr!important;}
      .shop-mini-stats{grid-template-columns:repeat(2,1fr)!important;}
    }


  `}</style>;
}


function audioZoneForPage(page,communityTab){
  const p=String(page||"dashboard");
  if(p==="dashboard")return "home";
  if(p==="juegos"||p==="ranking"||p==="retos")return "arcade";
  if(p==="tienda"||p==="cupones")return "shop";
  if(p==="perfil")return "profile";
  if(p==="comunidad")return communityTab==="musica"?"global":"community";
  if(p==="gestion"||p==="citas"||p==="clientes")return "shop";
  if(p==="buzon"||p==="notificaciones")return "global";
  return "global";
}

function audioZoneLabel(zone){
  const labels={
    home:"Inicio",
    login:"Login",
    shop:"Tienda",
    profile:"Perfil",
    arcade:"Arcade",
    community:"Comunidad",
    global:"Global"
  };
  return labels[zone]||"Global";
}

function AudioSettingsModal({show,onClose,mode,onModeChange,currentZone,musicOn,onToggleMusic,onNextTrack,uiTheme,onToggleTheme,trackName}){
  const selected=mode==="ambient"?"ambient":"random";

  function ModeButton({id,icon,title,desc,note}){
    const active=selected===id;
    return <button onClick={()=>onModeChange?.(id)} style={{
      border:`2px solid ${active?T.gold:T.g300}`,
      background:active?"linear-gradient(135deg,#7A5720,#F0C85C 65%,#FFE7A4)":"linear-gradient(180deg,#FFF4D6,#E7D1A0)",
      color:T.g900,
      borderRadius:18,
      padding:12,
      textAlign:"left",
      cursor:"pointer",
      boxShadow:active?"0 10px 22px rgba(20,8,4,.20)":"0 6px 14px rgba(20,8,4,.10)"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:34,height:34,borderRadius:13,display:"grid",placeItems:"center",background:active?"rgba(5,7,6,.14)":"rgba(110,53,24,.10)",fontSize:"1.1rem"}}>{icon}</div>
        <div style={{fontWeight:1000}}>{title}</div>
      </div>
      <div style={{fontSize:".78rem",fontWeight:800,color:active?T.g800:T.textSub,lineHeight:1.36,marginTop:8}}>{desc}</div>
      {note&&<div style={{fontSize:".7rem",fontWeight:900,color:active?T.g900:T.textSub,opacity:.8,marginTop:8}}>{note}</div>}
    </button>;
  }

  return <Modal show={show} onClose={onClose} title="Ajustes de sonido">
    <div style={{display:"grid",gap:12}}>
      <Card style={{background:"linear-gradient(180deg,#FFF4D6,#E9D3A3)",border:`1.5px solid ${T.g300}`}}>
        <div style={{fontWeight:1000,color:T.g800}}>🎧 Música de fondo</div>
        <div style={{fontSize:".8rem",fontWeight:800,color:T.textSub,lineHeight:1.38,marginTop:4}}>
          Elige cómo quieres que se comporte la playlist. Esta pantalla ya guarda tu preferencia para la próxima fase del motor de audio.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10,marginTop:12}}>
          <ModeButton id="random" icon="🔀" title="Aleatoria en toda la app" desc="Mezcla todas las canciones de la playlist sin importar la sección." note="Modo por defecto"/>
          <ModeButton id="ambient" icon="🌗" title="Ambientada por sección" desc="Deja preparado que Inicio, Tienda, Perfil y Arcade usen canciones de su ambiente." note="Se conectará al motor en la siguiente fase"/>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(180deg,#101C15,#07100D)",border:`1.5px solid ${T.g300}`,color:T.white}}>
        <div style={{fontWeight:1000,color:T.g150}}>Estado actual</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:10}}>
          <div style={{borderRadius:14,padding:10,background:"rgba(255,244,214,.08)",border:"1px solid rgba(255,244,214,.14)"}}>
            <div style={{fontSize:".68rem",fontWeight:900,opacity:.72}}>MODO</div>
            <div style={{fontWeight:1000}}>{selected==="ambient"?"Ambientada":"Aleatoria"}</div>
          </div>
          <div style={{borderRadius:14,padding:10,background:"rgba(255,244,214,.08)",border:"1px solid rgba(255,244,214,.14)"}}>
            <div style={{fontSize:".68rem",fontWeight:900,opacity:.72}}>ZONA</div>
            <div style={{fontWeight:1000}}>{audioZoneLabel(currentZone)}</div>
          </div>
        </div>
        <div style={{fontSize:".78rem",fontWeight:800,color:"rgba(255,247,218,.72)",lineHeight:1.38,marginTop:10}}>
          Tema actual: <b>{trackName||"Rasta Cuts Lounge"}</b>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:12}}>
          <Btn full small col={musicOn?"ghost":"gold"} onClick={onToggleMusic}>{musicOn?"🔇 Silenciar":"🔊 Activar"}</Btn>
          <Btn full small col="blue" onClick={onNextTrack}>⏭️ Cambiar tema</Btn>
          <Btn full small col="ghost" onClick={onToggleTheme}>{uiTheme==="night"?"☀️ Modo día":"🌙 Modo noche"}</Btn>
        </div>
      </Card>

      <div style={{fontSize:".76rem",fontWeight:800,color:T.textSub,lineHeight:1.35}}>
        Mantén pulsado el botón de sonido de la cabecera para volver a abrir estos ajustes.
      </div>
    </div>
  </Modal>;
}


function AppCore(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [navHistory,setNavHistory]=useState([]);
  const [communityTab,setCommunityTab]=useState("feed");
  const [toast,setToast]=useState({show:false,msg:""});
  const [ptsPopup,setPtsPopup]=useState({show:false,pts:0});
  const [musicOn,setMusicOn]=useState(false);
  const [audioSettingsOpen,setAudioSettingsOpen]=useState(false);
  const [audioMode,setAudioMode]=useState(()=>{
    if(typeof window==="undefined")return "random";
    try{
      const saved=localStorage.getItem("rasta_cuts_audio_mode");
      return saved==="ambient"?"ambient":"random";
    }catch{}
    return "random";
  });
  const musicPressTimer=useRef(null);
  const musicLongPressTriggered=useRef(false);
  const [uiTheme,setUiTheme]=useState(()=>{
    if(typeof window==="undefined")return "night";
    try{
      const saved=localStorage.getItem("rastaCutsUiTheme");
      if(saved==="day"||saved==="night")return saved;
    }catch{}
    return "night";
  });
  const [checkingSession,setCheckingSession]=useState(true);
  const [sessionWarning,setSessionWarning]=useState(false);
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

  useEffect(()=>{
    try{
      localStorage.setItem("rasta_cuts_audio_mode",audioMode==="ambient"?"ambient":"random");
    }catch{}
  },[audioMode]);


  function openTycoonPage(){
    if(typeof window!=="undefined") window.location.hash="#/tycoon";
    setTycoonRoute(true);
  }
  function closeTycoonPage(){
    if(typeof window!=="undefined"){
      window.history.pushState("",document.title,window.location.pathname+window.location.search);
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
    setMasterVolume(Number.isFinite(vol)?Math.max(0,Math.min(1.2,vol)):0.72);
    try{
      const savedMuted=localStorage.getItem("rasta_cuts_audio_muted")==="1";
      setMuted(savedMuted);
      setMusicOn(!savedMuted);
    }catch{}
    setBackgroundVolume();
  },[appSettings?.musica?.volumen_general]);

  useEffect(()=>{
    let alive=true;
    const warningTimer=setTimeout(()=>{if(alive) setSessionWarning(true);},3500);
    const fallbackTimer=setTimeout(()=>{
      if(alive) setCheckingSession(false);
    },6500);
    async function restoreSession(){
      try{
        if(!supabase){return;}
        const {data}=await supabase.auth.getSession();
        const sessionUser=data?.session?.user;
        if(sessionUser?.email){
          let perfil=await getUserProfileByEmail(sessionUser.email);
          if(!perfil){
            perfil=await createUserProfile({nombre:sessionUser.user_metadata?.nombre||sessionUser.email.split("@")[0],email:sessionUser.email});
          }
          if(perfil && alive){
            if(isBannedProfile(perfil)){
              try{await supabase.auth.signOut();}catch{}
            }else{
              setUser(toAppUser(perfil));
            }
          }
        }
      }catch(e){
        console.warn("No se pudo restaurar sesión",e);
      }finally{
        clearTimeout(warningTimer);
        clearTimeout(fallbackTimer);
        if(alive){setCheckingSession(false);setSessionWarning(false);}
      }
    }
    restoreSession();
    return()=>{alive=false;clearTimeout(warningTimer);clearTimeout(fallbackTimer);};
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

    if(!isMusicPlaying()){
      setMuted(false);
      setBackgroundDuckedForGame(false);
      setMusicOn(true);
      try{localStorage.setItem("rasta_cuts_audio_muted","0");}catch{}
      startMusic();
      setTimeout(()=>setBackgroundVolume(),120);
      showToast(`Sonido activado · ${isBackgroundAudioAvailable()?getBackgroundName():"Lofi Rasta"}`);
      return;
    }

    const nextMuted=!isMuted();
    muteMusicKeepTime(nextMuted);
    setMusicOn(!nextMuted);
    try{localStorage.setItem("rasta_cuts_audio_muted",nextMuted?"1":"0");}catch{}
    showToast(nextMuted?"Sonido silenciado. La canción sigue avanzando.":"Sonido activado");
  }
  function changeMusicTrack(){
    if(musicButtonClickTimer){clearTimeout(musicButtonClickTimer);musicButtonClickTimer=null;}
    setMuted(false);
    setMusicOn(true);
    try{localStorage.setItem("rasta_cuts_audio_muted","0");}catch{}
    if(!isMusicPlaying())setMusicPlaying(true);
    nextMusicTrack(false);
    SFX.tab();
    setTimeout(()=>showToast(`Tema aleatorio: ${getBackgroundName()}`),40);
  }
  function openAudioSettings(){
    if(musicPressTimer.current){clearTimeout(musicPressTimer.current);musicPressTimer.current=null;}
    setAudioSettingsOpen(true);
    SFX.tab();
  }
  function updateAudioMode(nextMode){
    const clean=nextMode==="ambient"?"ambient":"random";
    setAudioMode(clean);
    try{localStorage.setItem("rasta_cuts_audio_mode",clean);}catch{}
    showToast(clean==="ambient"?"Preferencia guardada: música ambientada por sección":"Preferencia guardada: música aleatoria");
  }
  function startMusicLongPress(){
    if(musicPressTimer.current)clearTimeout(musicPressTimer.current);
    musicLongPressTriggered.current=false;
    musicPressTimer.current=setTimeout(()=>{
      musicLongPressTriggered.current=true;
      openAudioSettings();
    },560);
  }
  function cancelMusicLongPress(){
    if(musicPressTimer.current){clearTimeout(musicPressTimer.current);musicPressTimer.current=null;}
  }
  function handleMusicButtonClick(){
    if(musicLongPressTriggered.current){
      musicLongPressTriggered.current=false;
      return;
    }
    const now=Date.now();
    const isDouble=(now-musicButtonLastTap)<330;
    musicButtonLastTap=now;

    if(musicButtonClickTimer){
      clearTimeout(musicButtonClickTimer);
      musicButtonClickTimer=null;
    }

    if(isDouble){
      musicButtonLastTap=0;
      changeMusicTrack();
      return;
    }

    musicButtonClickTimer=setTimeout(()=>{
      musicButtonClickTimer=null;
      toggleMusic();
    },260);
  }
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
    const nextCommunity=communityMap[id]||communityTab;
    const changed=target!==page || nextCommunity!==communityTab;
    if(changed){
      setNavHistory(prev=>{
        const last=prev[prev.length-1];
        if(last?.page===page && last?.communityTab===communityTab)return prev;
        return [...prev.slice(-18),{page,communityTab}];
      });
      playNavSound(id);
    }else{
      SFX.tab();
    }
    if(communityMap[id]) setCommunityTab(nextCommunity);
    setPage(target);
  };
  const goBack=()=>{
    setNavHistory(prev=>{
      const last=prev[prev.length-1];
      if(!last){SFX.error();return prev;}
      setHelperPage(null);
      setPage(last.page||"dashboard");
      setCommunityTab(last.communityTab||"feed");
      SFX.tab();
      return prev.slice(0,-1);
    });
  };
  const goHome=()=>{
    setHelperPage(null);
    setNavHistory([]);
    setCommunityTab("feed");
    setPage("dashboard");
    playNavSound("dashboard");
  };
  const logout=()=>{supabase?.auth.signOut();setUser(null);setPage("dashboard");setNavHistory([]);};

  if(checkingSession)return <div style={{fontFamily:"sans-serif",minHeight:"100vh",display:"grid",placeItems:"center",background:T.g100}}><Spinner/><SafetyVersionPanel user={null} settings={appSettings} checkingSession sessionWarning={sessionWarning}/></div>;
  if(!user)return (
    <>
      <Auth onLogin={u=>{setUser(u);setPage("dashboard");}} showToast={showToast} settings={appSettings}/>
      <SafetyVersionPanel user={null} settings={appSettings} checkingSession={false} sessionWarning={sessionWarning}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </>
  );

  const role=normalizeRole(user.rol || user.role);
  const rawNav=NAV_CFG[role]||NAV_CFG.client;
  const sec=appSettings?.secciones||{};
  const nav=rawNav.filter(n=>!(n.id==="tienda"&&sec.tienda_activa===false)&&!(n.id==="juegos"&&sec.arcade_activo===false));
  const grad=GRAD_ROLE[role]||GRAD_ROLE.client;
  const ap=page;
  const theme=pageTheme(ap,communityTab,role);
  const clinicAccent=uiTheme==="day"?"#23B6F2":"#43D6FF";
  const clinicAccent2=uiTheme==="day"?"#9C6BFF":"#9C7DFF";
  const currentUser={...user,rol:role};
  const sp={showToast,showPoints,user:currentUser,setUser,settings:appSettings,refreshUnread,unread,loadNotifications,onNavigate:navTo};
  const isAdmin=role===ROLES.ADMIN || role===ROLES.STAFF;

  if(tycoonRoute){
    return (
      <div className="rc-standalone-shell" data-rc-theme={uiTheme} style={{fontFamily:"'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100vh",background:uiTheme==="day"?"radial-gradient(circle at top,#FFF1D7 0,#FAF2E3 52%,#F1E6FF 100%)":"radial-gradient(circle at 50% 12%,rgba(212,175,55,.22),transparent 30%),radial-gradient(circle at 12% 80%,rgba(47,107,66,.22),transparent 28%),radial-gradient(circle at 88% 76%,rgba(167,40,34,.18),transparent 26%),linear-gradient(180deg,#050403,#130B06 48%,#080604)",color:"var(--rc-text,#EAF6FF)"}}>
        
        <Particles/>
        <RastaCutsTycoonGame user={currentUser} setUser={setUser} showToast={showToast} standalone onExit={closeTycoonPage}/>
        <Toast msg={toast.msg} show={toast.show}/>
      </div>
    );
  }

  const pages={
    dashboard:role===ROLES.CLIENT?<ClientDashboard user={currentUser} onNavigate={navTo} settings={appSettings}/>:<InternalHomeDashboard user={currentUser} onNavigate={navTo} unread={unread}/>,
    citas:<Citas {...sp} onNavigate={navTo}/>,clientes:<Clientes {...sp}/>,inventario:<Inventario {...sp}/>,
    gestion:<GestionAdmin {...sp}/>,caja:<Caja {...sp}/>,usuarios:<AdminUsuarios {...sp}/>,feed:<SocialFeed {...sp}/>,foro:<Foro {...sp}/>,
    noticias:<Noticias {...sp}/>,musica:<Comunidad {...sp} initialTab="musica"/>,comunidad:<Comunidad {...sp} initialTab={communityTab}/>,
    tienda:(sec.tienda_activa===false?<DisabledSection icon="🛍️" title="Tienda cerrada" sub="La tienda está pausada desde Gestión."/>:<Tienda {...sp}/>),juegos:(sec.arcade_activo===false?<DisabledSection icon="🎮" title="Arcade desactivado" sub="El Arcade está pausado desde Gestión."/>:<Juegos {...sp} setHelperPage={setHelperPage} onOpenTycoon={openTycoonPage} onOpenTops={(tab)=>{setTopsInitial(tab||"games");navTo("tops");}}/>),tops:<GameTopsPage user={currentUser} initialTab={topsInitial} onBack={()=>navTo("juegos")} onPlay={()=>navTo("juegos")}/>,retos:<Retos {...sp}/>,misiones:<MisionesPage {...sp} onNavigate={navTo}/>,
    ranking:<Ranking user={currentUser} onNavigate={navTo}/>,buzon:<BuzonPrivado {...sp}/>,perfil:<Perfil {...sp} onLogout={logout} onNavigate={navTo} onOpenAudioSettings={()=>setAudioSettingsOpen(true)} audioMode={audioMode}/>,
    galeria:<Galeria showToast={showToast} isAdmin={isAdmin}/>,
    reviews:<Reviews {...sp}/>,chat:<Chat user={currentUser} showToast={showToast}/>,
    cupones:<Cupones user={currentUser} showToast={showToast}/>,
  };

  return(
    <div className={`app-shell page-${ap} theme-${ap==="comunidad"?communityTab:ap}`} data-rc-theme={uiTheme} data-page={ap} data-community={communityTab} style={{fontFamily:"'Plus Jakarta Sans','Inter','Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:theme.shell,minHeight:"100vh",maxWidth:"var(--app-max-width,480px)",width:"100%",margin:"0 auto",paddingBottom:"var(--app-bottom-pad,82px)",position:"relative",boxShadow:`0 0 0 1px rgba(148,232,255,.18),0 0 42px rgba(0,0,0,.28),0 0 36px ${clinicAccent}22`,"--shineA":`color-mix(in srgb, ${clinicAccent} 28%, transparent)`,"--shineB":`color-mix(in srgb, ${clinicAccent2} 22%, transparent)`,"--shineSpeed":"7.2s","--pageGlowA":`color-mix(in srgb, ${clinicAccent} 20%, transparent)`,"--pageGlowB":`color-mix(in srgb, ${clinicAccent2} 18%, transparent)`,"--pageMark":theme.mark,"--pageMarkColor":`${clinicAccent}18`,"--pageAccent":clinicAccent,"--pageAccent2":clinicAccent2,"--pageShellModern":theme.shell}}>
      
      <Particles/>
      <PtsPopup pts={ptsPopup.pts} show={ptsPopup.show}/>
      <div className="app-header-pro rc-balanced-topbar" style={{background:role===ROLES.CLIENT?theme.header:grad,padding:"8px 10px",display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,alignItems:"center",position:"sticky",top:0,zIndex:50,boxShadow:`0 4px 20px rgba(0,0,0,0.22), inset 0 -1px 0 ${clinicAccent}55`}}>
        <div className="rc-topbar-left" style={{display:"flex",alignItems:"center",gap:6,minWidth:0,overflow:"hidden"}}>
          {navHistory.length>0&&<button className="header-action-pro rc-mini-square rc-back-mini" onClick={goBack} title="Volver" style={{background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,.22)",borderRadius:12,width:32,height:32,minWidth:32,cursor:"pointer",color:T.white,fontWeight:950,fontSize:".95rem",display:"grid",placeItems:"center",boxShadow:"0 4px 12px rgba(0,0,0,.16)"}}>←</button>}

          <button className="header-action-pro rc-wallet-pill" onClick={()=>setWalletOpen(true)} title="Cartera y puntos" style={{height:32,minWidth:0,display:"inline-flex",alignItems:"center",gap:6,border:"1px solid rgba(255,244,214,.14)",background:"rgba(255,244,214,.10)",borderRadius:14,padding:"0 9px",cursor:"pointer",color:T.white,fontWeight:950,boxShadow:"inset 0 1px 0 rgba(255,255,255,.08)"}}>
            <span className="rc-top-icon">👛</span>
            <span className="rc-wallet-points">{Number(currentUser.puntos||0).toLocaleString("es-ES")}</span>
            <span className="rc-wallet-unit">RP</span>
          </button>

          <button className="header-action-pro rc-mini-square rc-cart-mini" onClick={()=>setCartOpen(true)} title="Carrito" style={{background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.14)",borderRadius:12,width:32,height:32,minWidth:32,padding:0,cursor:"pointer",color:T.white,fontWeight:900,display:"grid",placeItems:"center"}}>
            <span className="rc-top-icon">🛒</span>
          </button>
        </div>

        <div className="rc-topbar-right" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,minWidth:0}}>
          <button className="header-action-pro rc-mini-square rc-notif-mini" onClick={()=>setNotifOpen(true)} title="Notificaciones" style={{position:"relative",background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.14)",borderRadius:12,width:32,height:32,minWidth:32,padding:0,cursor:"pointer",color:T.white,fontWeight:900,display:"grid",placeItems:"center"}}>
            <span className="rc-top-icon">🔔</span>
            {notifCount>0&&<span className="rc-top-badge" style={{position:"absolute",top:-5,right:-5,minWidth:16,height:16,borderRadius:999,background:"#A72822",color:"#FFF4D6",fontSize:".55rem",fontWeight:950,display:"grid",placeItems:"center",border:"1.5px solid #FFF4D6",boxShadow:"0 4px 10px rgba(0,0,0,.28)"}}>{notifCount>9?"9+":notifCount}</span>}
          </button>

          <button className="header-action-pro rc-mini-square rc-sound-mini" onClick={handleMusicButtonClick} onPointerDown={startMusicLongPress} onPointerUp={cancelMusicLongPress} onPointerLeave={cancelMusicLongPress} onPointerCancel={cancelMusicLongPress} onContextMenu={(e)=>{e.preventDefault();openAudioSettings();}} title={musicOn?`Silenciar música · mantener pulsado: ajustes (${getBackgroundName()})`:"Activar música · mantener pulsado: ajustes"} style={{background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.14)",borderRadius:12,width:32,height:32,minWidth:32,padding:0,cursor:"pointer",color:T.white,fontWeight:900,display:"grid",placeItems:"center"}}>
            <span className="rc-top-icon">{musicOn?"🔇":"🔊"}</span>
          </button>

          <button className="header-action-pro rc-mini-square rc-theme-mini" onClick={toggleUiTheme} title={uiTheme==="night"?"Cambiar a modo día":"Cambiar a modo noche"} style={{background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.14)",borderRadius:12,width:32,height:32,minWidth:32,padding:0,cursor:"pointer",color:T.white,fontWeight:900,display:"grid",placeItems:"center"}}>
            <span className="rc-top-icon">{uiTheme==="night"?"☀️":"🌙"}</span>
          </button>

          <button className="header-action-pro rc-profile-pill" onClick={()=>navTo("perfil")} title="Perfil" style={{width:32,height:32,minWidth:32,padding:0,display:"grid",placeItems:"center",cursor:"pointer",background:"rgba(255,244,214,.10)",border:"1px solid rgba(255,244,214,.14)",borderRadius:999,overflow:"hidden"}}>
            <Av av={currentUser.avatar} config={currentUser.avatarConfig} size={27}/>
          </button>
        </div>
      </div>
      <div key={`${ap}-${communityTab}`} className="page-content-pro" style={{padding:"18px 14px calc(132px + env(safe-area-inset-bottom,0px))",position:"relative"}}>
        <div className="motion-strip" style={{background:`linear-gradient(90deg,transparent,${clinicAccent}99,${clinicAccent2}77,transparent)`,margin:"0 18px 16px",boxShadow:`0 0 18px ${clinicAccent}44`,opacity:.92}}/>
        {pages[ap]||pages["dashboard"]}
        <HelperMascot page={helperPage || (ap==="dashboard"?"inicio":(ap==="comunidad"?communityTab:ap))} settings={appSettings} onOpenMissions={()=>navTo("misiones")}/>
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
      <AudioSettingsModal show={audioSettingsOpen} onClose={()=>setAudioSettingsOpen(false)} mode={audioMode} onModeChange={updateAudioMode} currentZone={audioZoneForPage(ap,communityTab)} musicOn={musicOn} onToggleMusic={toggleMusic} onNextTrack={changeMusicTrack} uiTheme={uiTheme} onToggleTheme={toggleUiTheme} trackName={getBackgroundName()}/>
      <NotificacionesPanel show={notifOpen} onClose={()=>setNotifOpen(false)} items={notifications} onRefresh={loadNotifications} onMarkAll={markNotificationsRead} onMarkOne={markNotificationRead} onOpenCitas={()=>navTo("citas")}/>
      <WalletPanel show={walletOpen} onClose={()=>setWalletOpen(false)} user={currentUser}/>
      <CartPanel show={cartOpen} onClose={()=>setCartOpen(false)} user={currentUser} setUser={setUser} showToast={showToast}/>
      <SafetyVersionPanel user={currentUser} settings={appSettings} checkingSession={false} sessionWarning={sessionWarning}/>
      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}


function MobileRuntimeGuard({children}){
  const [runtimeError,setRuntimeError]=useState(null);
  useEffect(()=>{
    const readError=(event)=>{
      try{
        const err=event?.error || event?.reason || event?.message || "Error desconocido";
        const msg=String(err?.message || err || "Error desconocido");
        const stack=String(err?.stack || "");
        setRuntimeError({msg,stack});
      }catch{
        setRuntimeError({msg:"Error desconocido",stack:""});
      }
    };
    window.addEventListener("error",readError);
    window.addEventListener("unhandledrejection",readError);
    return()=>{
      window.removeEventListener("error",readError);
      window.removeEventListener("unhandledrejection",readError);
    };
  },[]);
  if(runtimeError){
    return (
      <div style={{minHeight:"100vh",padding:18,background:"#120806",color:"#F0E0B8",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:680,width:"100%",background:"#21140C",border:"1px solid #B99A45",borderRadius:18,padding:18,boxShadow:"0 18px 50px rgba(0,0,0,.35)"}}>
          <h1 style={{margin:"0 0 8px",fontSize:22}}>Rasta Cuts se ha parado al cargar</h1><div style={{fontSize:".78rem",fontWeight:850,opacity:.8,marginBottom:8}}>{APP_VERSION_SHORT} · {APP_BUILD_DATE}</div>
          <p style={{margin:"0 0 12px",lineHeight:1.45}}>Este panel evita la pantalla en blanco y muestra el fallo para poder corregirlo.</p>
          <pre style={{whiteSpace:"pre-wrap",background:"#0B0705",borderRadius:12,padding:12,overflow:"auto",fontSize:12,color:"#FFE6A3"}}>{String(runtimeError.msg)+"\n\n"+String(runtimeError.stack||"").slice(0,1200)}</pre>
          <button onClick={()=>{try{localStorage.clear();sessionStorage.clear();}catch{};window.location.reload();}} style={{marginTop:12,border:0,borderRadius:12,padding:"12px 14px",fontWeight:900,background:"#B99A45",color:"#120806"}}>Limpiar datos y recargar</button>
        </div>
      </div>
    );
  }
  return children;
}

class RastaCutsErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null,info:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){
    try{console.error("RastaCuts render error",error,info);this.setState({info});}catch{}
  }
  render(){
    if(this.state.error){
      const msg=String(this.state.error?.message||this.state.error||"Error desconocido");
      const stack=String(this.state.error?.stack||"").slice(0,1200);
      return (
        <div style={{minHeight:"100vh",padding:18,background:"#120806",color:"#F0E0B8",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{maxWidth:680,width:"100%",background:"#21140C",border:"1px solid #B99A45",borderRadius:18,padding:18,boxShadow:"0 18px 50px rgba(0,0,0,.35)"}}>
            <h1 style={{margin:"0 0 8px",fontSize:22}}>Rasta Cuts se ha parado al cargar</h1>
            <p style={{margin:"0 0 12px",lineHeight:1.45}}>La web no se ha roto del todo: este panel muestra el error para poder corregirlo.</p>
            <pre style={{whiteSpace:"pre-wrap",background:"#0B0705",borderRadius:12,padding:12,overflow:"auto",fontSize:12,color:"#FFE6A3"}}>{msg+"\n\n"+stack}</pre>
            <button onClick={()=>{try{localStorage.clear();sessionStorage.clear();}catch{};location.reload();}} style={{marginTop:12,border:0,borderRadius:12,padding:"12px 14px",fontWeight:900,background:"#B99A45",color:"#120806"}}>Limpiar datos y recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  return (
    <MobileRuntimeGuard>
      <RastaCutsErrorBoundary>
        <GlobalUIPolishPatch/>
        <AppCore/>
      </RastaCutsErrorBoundary>
    </MobileRuntimeGuard>
  );
}

// RastaCuts 2.9.7a App Store UI Foundation
