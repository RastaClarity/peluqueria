import { SFX } from "../audio/audioEngine.js";
import { dbGet, dbPost, dbPatch } from "./db.js";
import { supabase } from "./supabaseClient.js";
import { COSMETIC_CATALOG_FALLBACK, PERSONALIZATION_SHOP_EXTRA } from "../data/avatarShopData.js";

const WEB_POINTS_DAILY_NORMAL_CAP=50;

function webPointsDayKey(uid){return `web_points_day_${uid||"anon"}_${new Date().toISOString().split("T")[0]}`;}
function getWebPointsToday(uid){try{return Number(localStorage.getItem(webPointsDayKey(uid))||0);}catch{return 0;}}
function addWebPointsToday(uid,pts){try{const next=getWebPointsToday(uid)+(Number(pts)||0);localStorage.setItem(webPointsDayKey(uid),String(next));return next;}catch{return 0;}}
function webPointsRemainingToday(uid){return Math.max(0,WEB_POINTS_DAILY_NORMAL_CAP-getWebPointsToday(uid));}

function pointHistoryKey(uid){return `web_points_history_${uid||"anon"}`;}
function readPointHistory(uid){
  try{return JSON.parse(localStorage.getItem(pointHistoryKey(uid))||"[]");}catch{return [];}
}
function writePointHistory(uid,items){
  try{localStorage.setItem(pointHistoryKey(uid),JSON.stringify((Array.isArray(items)?items:[]).slice(0,80)));}catch{}
}

async function readPointHistoryFromDb(uid,limit=60){
  if(!uid)return readPointHistory(uid);
  try{
    const safeLimit=Math.max(1,Math.min(100,Number(limit)||60));
    const rows=await dbGet("puntos_movimientos",`?usuario_id=eq.${uid}&order=created_at.desc&limit=${safeLimit}&select=*`);
    if(Array.isArray(rows)&&rows.length){
      return rows.map(r=>({
        id:r.id||`db_${r.created_at}_${r.amount}`,
        created_at:r.created_at,
        amount:Number(r.amount)||0,
        type:r.type||"info",
        reason:r.reason||"Movimiento",
        source:r.source||"supabase",
        balance:r.balance,
        meta:r.meta||{}
      }));
    }
  }catch(e){
    console.warn("No se pudo cargar historial de puntos desde Supabase",e);
  }
  return readPointHistory(uid);
}

function recordPointMovement(uid,{amount=0,type="info",reason="",source="",balance=null,meta={},usuario_email=null,usuario_nombre=null,entidad_tipo=null,entidad_id=null}={}){
  if(!uid)return;

  const row={
    id:`mov_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    created_at:new Date().toISOString(),
    amount:Number(amount)||0,
    type,
    reason,
    source,
    balance,
    meta
  };

  writePointHistory(uid,[row,...readPointHistory(uid)].slice(0,80));

  try{
    dbPost("puntos_movimientos",{
      usuario_id:String(uid),
      usuario_email:usuario_email||meta?.usuario_email||null,
      usuario_nombre:usuario_nombre||meta?.usuario_nombre||null,
      amount:Number(amount)||0,
      type:type||"info",
      reason:reason||null,
      source:source||null,
      balance:Number.isFinite(Number(balance))?Number(balance):null,
      entidad_tipo:entidad_tipo||meta?.entidad_tipo||null,
      entidad_id:entidad_id?String(entidad_id):(meta?.entidad_id?String(meta.entidad_id):null),
      meta:meta&&typeof meta==="object"?meta:{},
      created_at:new Date().toISOString()
    }).catch(()=>{});
  }catch{}

  try{window.dispatchEvent(new CustomEvent("rasta-points-history-updated"));}catch{}
}

function clearPointHistory(uid){
  writePointHistory(uid,[]);
  try{window.dispatchEvent(new CustomEvent("rasta-points-history-updated"));}catch{}
}

async function awardWebPoints({user,setUser,showToast,showPoints,points,reason="",excludeDailyCap=false}){
  const requested=Math.max(0,Number(points)||0);
  if(!user?.id||requested<=0)return 0;

  const allowed=excludeDailyCap?requested:Math.min(requested,webPointsRemainingToday(user.id));

  if(allowed<=0){
    showToast?.(`Límite diario normal de ${WEB_POINTS_DAILY_NORMAL_CAP} puntos alcanzado`);
    return 0;
  }

  if(!excludeDailyCap)addWebPointsToday(user.id,allowed);

  const nuevos=(Number(user.puntos)||0)+allowed;

  await dbPatch("usuarios",`?id=eq.${user.id}`,{puntos:nuevos});

  recordPointMovement(user.id,{
    amount:allowed,
    type:"earn",
    reason:reason||"Puntos añadidos",
    source:"web",
    balance:nuevos,
    usuario_email:user.email||null,
    usuario_nombre:user.nombre||user.name||null,
    meta:{requested,allowed,excludeDailyCap}
  });

  setUser?.(u=>({...u,puntos:nuevos}));
  showPoints?.(allowed);
  SFX.collect();

  showToast?.(`${reason||"Puntos añadidos"} +${allowed} pts${allowed<requested?` · límite diario aplicado`:``}`);

  return allowed;
}

async function awardWebPointsByUserId({usuarioId,points,reason="",excludeDailyCap=false}){
  const requested=Math.max(0,Number(points)||0);
  if(!usuarioId||requested<=0)return 0;

  const allowed=excludeDailyCap?requested:Math.min(requested,webPointsRemainingToday(usuarioId));
  if(allowed<=0)return 0;

  try{
    const rows=await dbGet("usuarios",`?id=eq.${usuarioId}&select=id,email,nombre,puntos&limit=1`);
    const actual=Number(rows?.[0]?.puntos||0);
    const nuevos=Math.max(0,actual+allowed);

    const ok=await dbPatch("usuarios",`?id=eq.${usuarioId}`,{puntos:nuevos});

    if(ok){
      if(!excludeDailyCap)addWebPointsToday(usuarioId,allowed);

      recordPointMovement(usuarioId,{
        amount:allowed,
        type:"earn",
        reason:reason||"Puntos añadidos",
        source:"staff/caja",
        balance:nuevos,
        usuario_email:rows?.[0]?.email||null,
        usuario_nombre:rows?.[0]?.nombre||null,
        meta:{requested,allowed,excludeDailyCap}
      });
    }

    return ok?allowed:0;
  }catch(e){
    console.warn(`No se pudieron sumar puntos web (${reason})`,e);
    return 0;
  }
}

function feedLikeStorageKey(user){return `feed_likes_${user?.id||"anon"}`;}

function readLocalFeedLikes(user){
  try{return JSON.parse(localStorage.getItem(feedLikeStorageKey(user))||"[]");}catch{return [];}
}

function saveLocalFeedLikes(user,ids){
  try{localStorage.setItem(feedLikeStorageKey(user),JSON.stringify([...new Set((ids||[]).map(String))]));}catch{}
}

function hasLocalFeedLike(user,postId){
  return readLocalFeedLikes(user).includes(String(postId));
}

function addLocalFeedLike(user,postId){
  const ids=[...new Set([...readLocalFeedLikes(user),String(postId)])];
  saveLocalFeedLikes(user,ids);
  return ids;
}

function removeLocalFeedLike(user,postId){
  const ids=readLocalFeedLikes(user).filter(id=>String(id)!==String(postId));
  saveLocalFeedLikes(user,ids);
  return ids;
}

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
      slot:item.slot||null,
      valor:item.valor||null,
      rareza:item.rareza||"comun",
      descripcion:item.descripcion||"",
      qty
    }];
  }

  writeCart(user,next);
  return next;
}

async function createShopOrder({user,items=[],totalPoints=null,source="tienda",status=null,notes=null}={}){
  if(!user?.id)return null;

  const normalized=(Array.isArray(items)?items:[]).map(raw=>{
    const h=hydrateCartItem(raw);
    const qty=Math.max(1,Number(h.qty||1));
    const puntos=Number(h.precio_puntos||h.puntos||h.puntos_precio||0);
    return {
      id:String(h.id||h.item_key||h.nombre||"item"),
      item_key:h.item_key||null,
      nombre:h.nombre||h.titulo||"Artículo",
      categoria:h.categoria||"premios",
      tipo:h.tipo||source||"tienda",
      slot:h.slot||null,
      valor:h.valor||null,
      rareza:h.rareza||null,
      qty,
      puntos,
      total_puntos:puntos*qty,
      avatar:isAvatarPersonalizationItem(h)
    };
  });

  if(!normalized.length)return null;

  const total=Number.isFinite(Number(totalPoints))?Number(totalPoints):normalized.reduce((sum,it)=>sum+Number(it.total_puntos||0),0);
  const first=normalized[0];
  const allAvatar=normalized.every(it=>it.avatar);
  const itemNombre=normalized.length===1?first.nombre:`Carrito (${normalized.length} artículo${normalized.length===1?"":"s"})`;
  const itemId=normalized.length===1?String(first.id||first.item_key||"item"):"cart";
  const itemCategoria=normalized.length===1?first.categoria:"carrito";
  const itemTipo=normalized.length===1?first.tipo:(source||"carrito");
  const estado=status || (allAvatar?"entregado":"pendiente");
  const now=new Date().toISOString();

  try{
    const rows=await dbPost("tienda_pedidos",{
      usuario_id:String(user.id),
      cliente_nombre:user.nombre||user.name||user.email||"Cliente",
      cliente_email:user.email||null,
      item_id:itemId,
      item_nombre:itemNombre,
      item_categoria:itemCategoria,
      item_tipo:itemTipo,
      puntos_coste:total,
      precio_euros:0,
      estado,
      items:normalized,
      total_puntos:total,
      notas:notes||null,
      notas_cliente:notes||null,
      updated_at:now
    });

    return Array.isArray(rows)?rows?.[0]||null:rows;
  }catch(e){
    console.warn("No se pudo crear pedido de tienda",e);
    return null;
  }
}

function catalogItemByKey(key){
  if(!key)return null;

  const all=[...avatarShopFallbackItems()];
  return all.find(x=>x.item_key===key || x.id===key)||null;
}

function hydrateCartItem(it){
  const found=catalogItemByKey(it.item_key||it.id);
  return {...(found||{}),...it};
}

function isAvatarPersonalizationItem(it){
  const h=hydrateCartItem(it);
  const c=String(h.categoria||"").toLowerCase();
  const t=String(h.tipo||"").toLowerCase();

  return c==="avatar"||t.includes("avatar")||t.includes("perfil")||!!h.slot;
}

async function unlockCosmeticForUser(user,item){
  const h=hydrateCartItem(item);
  if(!h.item_key)return false;

  const keys=[...new Set([...localOwnedCosmetics(user),h.item_key])];
  saveLocalOwnedCosmetics(user,keys);

  try{
    await supabase.from("user_cosmetics").upsert(
      {
        usuario_id:String(user.id),
        item_key:h.item_key,
        created_at:new Date().toISOString()
      },
      {onConflict:"usuario_id,item_key"}
    );
  }catch{}

  return true;
}

function rarityLabel(r){
  return {
    comun:"Común",
    raro:"Raro",
    epico:"Épico",
    legendario:"Legendario"
  }[r]||"Especial";
}

function rarityColor(r){
  return {
    comun:"green",
    raro:"blue",
    epico:"pink",
    legendario:"gold"
  }[r]||"green";
}

function cosmeticPatch(item){
  return item?.slot?{[item.slot]:item.valor}:{};
}

function ownedCosmeticKey(user){
  return `owned_cosmetics_${String(user?.id||user?.email||"anon")}`;
}

function localOwnedCosmetics(user){
  try{return JSON.parse(localStorage.getItem(ownedCosmeticKey(user))||"[]");}catch{return [];}
}

function saveLocalOwnedCosmetics(user,keys){
  try{localStorage.setItem(ownedCosmeticKey(user),JSON.stringify([...new Set(keys)]));}catch{}
}

export {
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
};
