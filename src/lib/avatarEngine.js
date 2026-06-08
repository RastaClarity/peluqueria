import { supabase } from "./supabaseClient.js";
import {
  AVATAR_LABELS,
  AVATAR_PRESETS,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_MALE_AVATAR,
  DEFAULT_FEMALE_AVATAR,
  AVATAR_OPTIONS,
  BEARD_VALUES,
  FEMALE_HAIR,
  MALE_HAIR,
  BASIC_ACCESSORIES
} from "../data/avatarShopData.js";

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
  cfg.version="2.1.0";
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
  if(!AVATAR_OPTIONS.nose.includes(cfg.nose)) cfg.nose=cfg.gender==="female"?"small":"soft";
  if(!AVATAR_OPTIONS.mouth.includes(cfg.mouth)) cfg.mouth=cfg.gender==="female"?"soft":"smile";
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
  if(!profile) return cleanAvatarDefaults(0);
  try{
    const local=localStorage.getItem(avatarStorageKey(profile));
    if(local) return normalizeAvatarV3(JSON.parse(local), profile.id||profile.avatar||0);
  }catch{}
  try{
    const {data,error}=await supabase.from("avatar_profiles").select("avatar_config").eq("usuario_id",String(profile.id)).maybeSingle();
    if(!error && data?.avatar_config){
      const cfg=normalizeAvatarV3(data.avatar_config, profile.id||profile.avatar||0);
      setLocalAvatarConfig(profile,cfg);
      return cfg;
    }
  }catch{}
  return normalizeAvatarV3(profile.avatar_config||profile.avatarConfig||null, profile.id||profile.avatar||0);
}
async function saveAvatarConfigForUser(user,cfg){
  const clean=normalizeAvatarV3(cfg,user?.id||user?.avatar||0);
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
      const clean=cfg?normalizeAvatarV3(cfg,u.id||u.avatar||0):normalizeAvatarV3(u.avatar_config||u.avatarConfig,u.id||u.avatar||0);
      return {...u,avatar_config:clean,avatarConfig:clean};
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
  const b={
    gold:"linear-gradient(180deg,#5B2E12 0%,#B7791F 48%,#F2D66D 100%)",
    dark:"linear-gradient(180deg,#110907 0%,#2A120B 52%,#7A4A28 100%)",
    red:"linear-gradient(180deg,#3A0909 0%,#8C1C13 48%,#F06A3B 100%)",
    blue:"linear-gradient(180deg,#13243D 0%,#1A5B8F 48%,#7ED6E8 100%)",
    paper:"linear-gradient(180deg,#815128 0%,#D7B177 38%,#FFF4D6 100%)",
    studio:"linear-gradient(180deg,#120A08 0%,#50301C 55%,#F2CF75 100%)",
    street:"linear-gradient(180deg,#120806 0%,#2B2430 40%,#556B8D 72%,#C97934 100%)",
    royal:"linear-gradient(180deg,#140806 0%,#3C0E17 38%,#7E0D28 64%,#D4AF37 100%)",
    office:"linear-gradient(180deg,#3C556F 0%,#94AFC9 56%,#E9D8B4 100%)",
    beach:"linear-gradient(180deg,#79D7F3 0%,#12B5CB 44%,#0077A6 48%,#F4C97B 49%,#DFA95C 100%)",
    setup:"linear-gradient(180deg,#090E19 0%,#17274C 44%,#263F8F 70%,#12B5CB 100%)",
    camper:"linear-gradient(180deg,#A7D6F8 0%,#8BA56D 46%,#D7B64C 47%,#8F5A34 100%)",
    terrace:"linear-gradient(180deg,#B9E3FF 0%,#77A45C 46%,#E7C57A 47%,#7A4A28 100%)",
    reggae:"linear-gradient(180deg,#1C4D2F 0%,#1C4D2F 33%,#D7B64C 33%,#D7B64C 66%,#A72822 66%,#A72822 100%)",
    barberShop:"linear-gradient(180deg,#1B1510 0%,#4E2B16 48%,#B99A45 100%)",
    vipRoom:"linear-gradient(180deg,#11080E 0%,#4B1848 58%,#D7B64C 100%)"
  };
  return b[bg]||b.gold;
}

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

function avatarColorForAccessory(value){
  const map={
    none:"transparent",
    earring:"#D7B64C",
    hoopGold:"#D7B64C",
    glasses:"#17110A",
    glassesGold:"#D7B64C",
    bandana:"#A72822",
    bandanaGreen:"#5F8E22",
    cap:"#17110A",
    capBlack:"#17110A",
    capGold:"#D7B64C",
    crown:"#D7B64C",
    piercing:"#D7B64C",
    flowers:"#E66A9A",
    headphones:"#263F4D"
  };
  return map[value]||"#D7B64C";
}

function avatarAuraColor(value){
  const map={
    none:"transparent",
    warm:"rgba(212,175,55,.55)",
    flame:"rgba(240,106,59,.62)",
    ocean:"rgba(95,215,255,.52)",
    vip:"rgba(255,241,168,.78)",
    green:"rgba(95,142,34,.55)",
    red:"rgba(167,40,34,.55)",
    gold:"rgba(215,182,76,.65)",
    neon:"rgba(85,215,255,.62)"
  };
  return map[value]||"rgba(212,175,55,.45)";
}

const HAIR_STYLES = [
  {id:"buzz",label:"Rapado",group:"barber"},
  {id:"fadeLow",label:"Fade bajo",group:"barber"},
  {id:"fadeMid",label:"Fade medio",group:"barber"},
  {id:"fadeHigh",label:"Fade alto",group:"barber"},
  {id:"taperFade",label:"Taper Fade",group:"barber"},
  {id:"burstFade",label:"Burst Fade",group:"barber"},
  {id:"crop",label:"French crop",group:"barber"},
  {id:"quiff",label:"Quiff",group:"barber"},
  {id:"pompadour",label:"Pompadour",group:"barber"},
  {id:"mullet",label:"Mullet moderno",group:"barber"},
  {id:"mohawk",label:"Mohawk",group:"barber"},
  {id:"afroSmall",label:"Afro corto",group:"rizo"},
  {id:"afroBig",label:"Afro grande",group:"rizo"},
  {id:"curls",label:"Rizos definidos",group:"rizo"},
  {id:"afroTaper",label:"Afro taper",group:"rizo"},
  {id:"dreadsShort",label:"Rastas cortas",group:"rastas"},
  {id:"dreadsMed",label:"Rastas medias",group:"rastas"},
  {id:"dreadsLong",label:"Rastas largas",group:"rastas"},
  {id:"dreadsTie",label:"Rastas recogidas",group:"rastas"},
  {id:"dreadsCrown",label:"Corona de rastas",group:"rastas"},
  {id:"braids",label:"Trenzas",group:"mujer"},
  {id:"waves",label:"Ondas largas",group:"mujer"},
  {id:"bobCut",label:"Bob moderno",group:"mujer"},
  {id:"pixie",label:"Pixie",group:"mujer"},
  {id:"pony",label:"Coleta alta",group:"mujer"},
  {id:"spaceBuns",label:"Moños dobles",group:"mujer"}
];

const CLEAN_AVATAR_OPTIONS = {
  model:[{id:"male",label:"Masculino"},{id:"female",label:"Femenino"}],
  face:[{id:"oval",label:"Ovalada"},{id:"round",label:"Redonda"},{id:"square",label:"Cuadrada"},{id:"heart",label:"Corazón"}],
  skin:[{id:"light",label:"Clara",color:"#F3C8A2"},{id:"warm",label:"Cálida",color:"#C98554"},{id:"bronze",label:"Bronce",color:"#9A5A35"},{id:"brown",label:"Morena",color:"#6A3A25"},{id:"dark",label:"Oscura",color:"#3D2418"}],
  hairColor:[{id:"black",label:"Negro",color:"#15110D"},{id:"brown",label:"Castaño",color:"#4A2B18"},{id:"gold",label:"Dorado",color:"#D4A431"},{id:"red",label:"Rojo",color:"#9D2B1E"},{id:"blue",label:"Azul",color:"#245D9D"},{id:"green",label:"Verde",color:"#236B37"},{id:"pink",label:"Rosa",color:"#D65C9C"},{id:"silver",label:"Plata",color:"#D6D8D8"}],
  eyes:[{id:"soft",label:"Suaves"},{id:"sharp",label:"Afilados"},{id:"happy",label:"Felices"},{id:"sleepy",label:"Relajados"},{id:"glam",label:"Glam"}],
  mouth:[{id:"smile",label:"Sonrisa"},{id:"smirk",label:"Media sonrisa"},{id:"serious",label:"Seria"},{id:"open",label:"Abierta"}],
  beard:[{id:"none",label:"Nada"},{id:"stubble",label:"Sombra"},{id:"goatee",label:"Perilla"},{id:"short",label:"Barba corta"},{id:"full",label:"Barba completa"}],
  glasses:[{id:"none",label:"Sin gafas"},{id:"round",label:"Redondas"},{id:"square",label:"Cuadradas"},{id:"sun",label:"Sol"}],
  accessory:[{id:"none",label:"Nada"},{id:"earringSmall",label:"Pendiente pequeño"},{id:"earringBig",label:"Aro grande"},{id:"piercingNose",label:"Piercing nariz"},{id:"piercingBrow",label:"Piercing ceja"},{id:"lipRing",label:"Piercing labio"}],
  hat:[{id:"none",label:"Sin gorra"},{id:"cap",label:"Snapback"},{id:"beanie",label:"Gorro lana"},{id:"bucket",label:"Bucket hat"},{id:"bandana",label:"Bandana"},{id:"visor",label:"Visera"}],
  tattoo:[{id:"none",label:"Sin tatuaje"},{id:"neckStar",label:"Estrella cuello"},{id:"neckWave",label:"Ola cuello"},{id:"cheekBolt",label:"Rayo mejilla"},{id:"templeDots",label:"Puntos sien"}],
  bg:[{id:"plain",label:"Limpio"},{id:"barber",label:"Barbería"},{id:"beach",label:"Playa"},{id:"studio",label:"Estudio"},{id:"workshop",label:"Taller"},{id:"neon",label:"Neón"},{id:"warm",label:"Cálido"}]
};
function cleanPick(arr){return arr[Math.floor(Math.random()*arr.length)]?.id}
function cleanAvatarDefaults(seed=0){
  const presets=[
    {model:"male",face:"square",skin:"warm",hair:"fadeMid",hairColor:"black",eyes:"sharp",mouth:"smirk",beard:"goatee",glasses:"none",accessory:"earringSmall",hat:"none",tattoo:"none",bg:"barber"},
    {model:"female",face:"heart",skin:"light",hair:"waves",hairColor:"brown",eyes:"soft",mouth:"smile",beard:"none",glasses:"none",accessory:"earringSmall",hat:"none",tattoo:"none",bg:"warm"},
    {model:"male",face:"round",skin:"bronze",hair:"dreadsMed",hairColor:"black",eyes:"happy",mouth:"smile",beard:"short",glasses:"none",accessory:"none",hat:"none",tattoo:"none",bg:"plain"},
    {model:"female",face:"round",skin:"brown",hair:"braids",hairColor:"black",eyes:"happy",mouth:"smile",beard:"none",glasses:"round",accessory:"none",hat:"none",tattoo:"none",bg:"plain"}
  ];
  return {...presets[Math.abs(Number(seed)||0)%presets.length]}
}
function normalizeAvatarV3(config={},seed=0){
  const fallback=cleanAvatarDefaults(seed);
  const base={...fallback,...(config||{})};
  const inList=(key,val,fb)=>(CLEAN_AVATAR_OPTIONS[key]||[]).some(x=>x.id===val)?val:fb;
  const hair=HAIR_STYLES.some(x=>x.id===base.hair)?base.hair:fallback.hair;
  const model=inList("model",base.model,"male");
  return {
    model,
    face:inList("face",base.face,model==="female"?"heart":"square"),
    skin:inList("skin",base.skin,"warm"),
    hair,
    hairColor:inList("hairColor",base.hairColor,"black"),
    eyes:inList("eyes",base.eyes,"soft"),
    mouth:inList("mouth",base.mouth,"smile"),
    beard:model==="female"?"none":inList("beard",base.beard,"none"),
    glasses:inList("glasses",base.glasses,"none"),
    accessory:inList("accessory",base.accessory,"none"),
    hat:inList("hat",base.hat,"none"),
    tattoo:inList("tattoo",base.tattoo,"none"),
    bg:inList("bg",base.bg,"plain")
  }
}

export {
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
};
