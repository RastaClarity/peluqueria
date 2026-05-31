import React, { useEffect, useMemo, useState } from "react";
import studioMap from "./estudio tycoon peluqueria.png";

const STORAGE_KEY = "rasta_cuts_tycoon_fase105";
const MAX_QUEUE = 2;

const ROOM_DEFS = {
  corte: {
    id: "corte",
    name: "Estudio principal",
    icon: "✂️",
    unlockedAtStart: true,
    description: "Zona de trabajo principal. Aquí atiendes clientes, mejoras sillas, espejos y herramientas.",
    mapHotspot: { left: 39, top: 28, width: 30, height: 34 },
    roomBg: { size: 185, x: 58, y: 42 },
    hotspots: [
      { id: "silla", label: "Sillas", icon: "💈", x: 44, y: 58, w: 20, h: 22 },
      { id: "espejos", label: "Espejos", icon: "🪞", x: 31, y: 26, w: 34, h: 22 },
      { id: "herramientas", label: "Herramientas", icon: "🧰", x: 61, y: 30, w: 20, h: 18 },
      { id: "plantas", label: "Ambiente", icon: "🌿", x: 22, y: 63, w: 16, h: 18 },
    ],
    objects: {
      silla: {
        name: "Sillas de corte",
        description: "Sube los ingresos por cada cliente atendido.",
        baseCost: 170,
        baseDuration: 45,
        maxLevel: 10,
      },
      espejos: {
        name: "Espejos e iluminación",
        description: "Aumenta la fama y mejora la satisfacción de los clientes.",
        baseCost: 140,
        baseDuration: 40,
        maxLevel: 10,
      },
      herramientas: {
        name: "Herramientas profesionales",
        description: "Reduce esfuerzo y aumenta el valor de los servicios.",
        baseCost: 190,
        baseDuration: 55,
        maxLevel: 10,
      },
      plantas: {
        name: "Decoración y ambiente",
        description: "Hace que el estudio parezca más vivo y atrae clientes mejores.",
        baseCost: 95,
        baseDuration: 28,
        maxLevel: 8,
      },
    },
    quickActions: ["client", "clean"],
  },
  almacen: {
    id: "almacen",
    name: "Almacén",
    icon: "📦",
    unlockedAtStart: true,
    description: "Gestiona productos, estanterías, cajas y reposiciones.",
    mapHotspot: { left: 9, top: 15, width: 28, height: 29 },
    roomBg: { size: 210, x: 15, y: 19 },
    hotspots: [
      { id: "estanterias", label: "Estanterías", icon: "🗄️", x: 25, y: 30, w: 36, h: 26 },
      { id: "cajas", label: "Cajas", icon: "📦", x: 52, y: 52, w: 25, h: 25 },
      { id: "puerta", label: "Acceso", icon: "🚪", x: 72, y: 25, w: 14, h: 23 },
    ],
    objects: {
      estanterias: {
        name: "Estanterías",
        description: "Aumentan la capacidad máxima de stock.",
        baseCost: 130,
        baseDuration: 35,
        maxLevel: 10,
      },
      cajas: {
        name: "Cajas de reserva",
        description: "Permiten guardar más productos para trabajos largos.",
        baseCost: 90,
        baseDuration: 25,
        maxLevel: 8,
      },
      puerta: {
        name: "Acceso del almacén",
        description: "Mejora la velocidad de reposición y pedidos.",
        baseCost: 160,
        baseDuration: 42,
        maxLevel: 8,
      },
    },
    quickActions: ["stock", "organize"],
  },
  bano: {
    id: "bano",
    name: "Baño",
    icon: "🚿",
    unlockedAtStart: false,
    unlockCost: 650,
    requires: "Estudio principal nivel 2",
    requiresFn: (state) => state.rooms.corte.level >= 2,
    description: "Aumenta la satisfacción, higiene y reputación del local.",
    mapHotspot: { left: 17, top: 47, width: 21, height: 22 },
    roomBg: { size: 225, x: 24, y: 58 },
    hotspots: [
      { id: "lavabo", label: "Lavabo", icon: "🚰", x: 29, y: 43, w: 22, h: 22 },
      { id: "higiene", label: "Higiene", icon: "🧼", x: 53, y: 36, w: 20, h: 28 },
    ],
    objects: {
      lavabo: { name: "Lavabo", description: "Mejora higiene y satisfacción.", baseCost: 210, baseDuration: 55, maxLevel: 8 },
      higiene: { name: "Kit de higiene", description: "Mejora la valoración general del estudio.", baseCost: 180, baseDuration: 45, maxLevel: 8 },
    },
    quickActions: ["clean"],
  },
  chill: {
    id: "chill",
    name: "Zona chill",
    icon: "🎧",
    unlockedAtStart: false,
    unlockCost: 900,
    requires: "Fama 80 + Almacén nivel 2",
    requiresFn: (state) => state.fame >= 80 && state.rooms.almacen.level >= 2,
    description: "Zona de descanso para atraer clientes especiales y aumentar fama.",
    mapHotspot: { left: 73, top: 36, width: 22, height: 26 },
    roomBg: { size: 200, x: 83, y: 43 },
    hotspots: [
      { id: "sofa", label: "Sofá", icon: "🛋️", x: 39, y: 56, w: 30, h: 22 },
      { id: "musica", label: "Música", icon: "🔊", x: 64, y: 28, w: 20, h: 25 },
      { id: "luces", label: "Luces", icon: "💡", x: 24, y: 28, w: 19, h: 25 },
    ],
    objects: {
      sofa: { name: "Sofá chill", description: "Aumenta el tiempo que los clientes se quedan en el local.", baseCost: 260, baseDuration: 60, maxLevel: 8 },
      musica: { name: "Equipo de música", description: "Sube fama y atrae eventos especiales.", baseCost: 320, baseDuration: 70, maxLevel: 8 },
      luces: { name: "Luces de ambiente", description: "Mejora la estética y la reputación.", baseCost: 240, baseDuration: 55, maxLevel: 8 },
    },
    quickActions: ["event", "client"],
  },
  terraza: {
    id: "terraza",
    name: "Terraza",
    icon: "🌴",
    unlockedAtStart: false,
    unlockCost: 1200,
    requires: "Zona chill nivel 2",
    requiresFn: (state) => state.rooms.chill.unlocked && state.rooms.chill.level >= 2,
    description: "Espacio exterior para eventos, clientes VIP y bonus de fama.",
    mapHotspot: { left: 59, top: 62, width: 28, height: 25 },
    roomBg: { size: 190, x: 71, y: 73 },
    hotspots: [
      { id: "mesas", label: "Mesas", icon: "☕", x: 41, y: 48, w: 29, h: 25 },
      { id: "plantas", label: "Plantas", icon: "🌿", x: 68, y: 26, w: 20, h: 25 },
      { id: "eventos", label: "Eventos", icon: "🎤", x: 23, y: 30, w: 20, h: 28 },
    ],
    objects: {
      mesas: { name: "Mesas exteriores", description: "Permiten eventos pequeños y clientes VIP.", baseCost: 360, baseDuration: 80, maxLevel: 8 },
      plantas: { name: "Jardinería", description: "Sube fama y sensación premium.", baseCost: 240, baseDuration: 55, maxLevel: 8 },
      eventos: { name: "Zona de eventos", description: "Desbloquea encargos especiales con alta recompensa.", baseCost: 520, baseDuration: 105, maxLevel: 6 },
    },
    quickActions: ["event"],
  },
};

const ACTIONS = {
  client: {
    label: "Atender cliente",
    icon: "💇",
    duration: 18,
    energy: 1,
    reward: (state, room) => 55 + room.level * 18 + getObjectLevel(room, "silla") * 12 + getObjectLevel(room, "herramientas") * 10,
    fame: (state, room) => 4 + getObjectLevel(room, "espejos") * 2,
    description: "Servicio rápido. Consume 1 energía y genera RC.",
  },
  stock: {
    label: "Reponer stock",
    icon: "🧴",
    duration: 22,
    cost: 60,
    amount: (state) => 8 + state.rooms.almacen.level * 3,
    description: "Compra productos para el almacén.",
  },
  organize: {
    label: "Organizar inventario",
    icon: "🗃️",
    duration: 16,
    reward: 25,
    fame: 1,
    description: "Pequeña acción de gestión para ganar RC y eficiencia.",
  },
  clean: {
    label: "Limpiar zona",
    icon: "🧽",
    duration: 14,
    reward: 18,
    fame: 5,
    description: "Sube fama y deja el estudio más cuidado.",
  },
  event: {
    label: "Organizar evento",
    icon: "🎉",
    duration: 45,
    cost: 120,
    reward: 260,
    fame: 35,
    description: "Evento especial. Cuesta RC, pero da fama y recompensa alta.",
  },
};

function getObjectLevel(room, objectId) {
  return Number(room?.objects?.[objectId] || 0);
}

function createInitialState() {
  const rooms = Object.fromEntries(
    Object.values(ROOM_DEFS).map((room) => [
      room.id,
      {
        level: 1,
        unlocked: Boolean(room.unlockedAtStart),
        objects: Object.fromEntries(Object.keys(room.objects || {}).map((key) => [key, 1])),
      },
    ])
  );

  return {
    version: 105,
    rastaCuts: 500,
    fame: 0,
    energy: 10,
    maxEnergy: 10,
    stock: 12,
    servedClients: 0,
    completedEvents: 0,
    queue: [],
    rooms,
    lastEnergyAt: Date.now(),
    lastSavedAt: Date.now(),
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !saved.rooms) return createInitialState();
    const base = createInitialState();
    return {
      ...base,
      ...saved,
      rooms: {
        ...base.rooms,
        ...(saved.rooms || {}),
      },
      queue: Array.isArray(saved.queue) ? saved.queue : [],
    };
  } catch {
    return createInitialState();
  }
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

function upgradeCost(roomId, objectId, state) {
  const room = state.rooms[roomId];
  const object = ROOM_DEFS[roomId].objects[objectId];
  const level = getObjectLevel(room, objectId);
  return Math.round(object.baseCost * Math.pow(1.42, level - 1));
}

function upgradeDuration(roomId, objectId, state) {
  const room = state.rooms[roomId];
  const object = ROOM_DEFS[roomId].objects[objectId];
  const level = getObjectLevel(room, objectId);
  return Math.round(object.baseDuration * Math.pow(1.16, level - 1));
}

function roomTotalLevel(roomState) {
  const objectSum = Object.values(roomState.objects || {}).reduce((acc, val) => acc + Number(val || 0), 0);
  return Number(roomState.level || 1) + objectSum;
}

function canUnlock(roomDef, state) {
  if (!roomDef || roomDef.unlockedAtStart) return false;
  return !roomDef.requiresFn || roomDef.requiresFn(state);
}

export default function TycoonGame() {
  const [state, setState] = useState(loadState);
  const [screen, setScreen] = useState("map");
  const [activeRoom, setActiveRoom] = useState("corte");
  const [selectedObject, setSelectedObject] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("Rasta dice: pulsa una sala del estudio para entrar y gestionarla.");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setState((prev) => processFinishedTasks(regenEnergy(prev, now), now, setMessage));
  }, [now]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
    } catch {}
  }, [state]);

  const activeRoomDef = ROOM_DEFS[activeRoom];
  const activeRoomState = state.rooms[activeRoom];

  const stats = useMemo(() => {
    const totalRoomLevels = Object.values(state.rooms).reduce((acc, room) => acc + roomTotalLevel(room), 0);
    return {
      prestige: Math.max(1, Math.floor((state.fame + totalRoomLevels * 8) / 25)),
      stockCap: 40 + state.rooms.almacen.level * 18 + getObjectLevel(state.rooms.almacen, "estanterias") * 14 + getObjectLevel(state.rooms.almacen, "cajas") * 10,
    };
  }, [state]);

  function enterRoom(roomId) {
    const roomDef = ROOM_DEFS[roomId];
    const roomState = state.rooms[roomId];
    if (!roomState?.unlocked) {
      setActiveRoom(roomId);
      setScreen("unlock");
      setMessage(`Rasta dice: ${roomDef.name} está cerrado. Cumple el requisito y paga la reforma para abrirlo.`);
      return;
    }
    setActiveRoom(roomId);
    setSelectedObject(roomDef.hotspots?.[0]?.id || null);
    setScreen("room");
    setMessage(`Rasta dice: estás en ${roomDef.name}. Pulsa objetos de la sala para mejorarlos.`);
  }

  function unlockRoom(roomId) {
    const roomDef = ROOM_DEFS[roomId];
    if (!roomDef) return;
    if (state.rooms[roomId]?.unlocked) return enterRoom(roomId);
    if (!canUnlock(roomDef, state)) {
      setMessage(`Rasta dice: aún falta requisito para abrir ${roomDef.name}: ${roomDef.requires || "progreso"}.`);
      return;
    }
    if (state.rastaCuts < roomDef.unlockCost) {
      setMessage(`Rasta dice: necesitas ${roomDef.unlockCost} RC para abrir ${roomDef.name}.`);
      return;
    }
    setState((prev) => ({
      ...prev,
      rastaCuts: prev.rastaCuts - roomDef.unlockCost,
      rooms: {
        ...prev.rooms,
        [roomId]: { ...prev.rooms[roomId], unlocked: true },
      },
    }));
    setMessage(`Rasta dice: ${roomDef.name} desbloqueado. Ahora puedes entrar y gestionarlo.`);
    setScreen("room");
  }

  function startUpgrade(objectId) {
    const roomId = activeRoom;
    const roomDef = ROOM_DEFS[roomId];
    const objectDef = roomDef.objects[objectId];
    const objectLevel = getObjectLevel(state.rooms[roomId], objectId);
    if (objectLevel >= objectDef.maxLevel) {
      setMessage("Rasta dice: ese objeto ya está al máximo nivel.");
      return;
    }
    if (state.queue.length >= MAX_QUEUE) {
      setMessage("Rasta dice: tu cola de trabajo está llena. Espera a que termine una mejora.");
      return;
    }
    const cost = upgradeCost(roomId, objectId, state);
    if (state.rastaCuts < cost) {
      setMessage(`Rasta dice: faltan RC. Necesitas ${cost} RC.`);
      return;
    }
    const duration = upgradeDuration(roomId, objectId, state);
    const task = {
      id: `upgrade-${roomId}-${objectId}-${Date.now()}`,
      type: "upgrade",
      roomId,
      objectId,
      label: `Mejorar ${objectDef.name} a nivel ${objectLevel + 1}`,
      startedAt: Date.now(),
      endsAt: Date.now() + duration * 1000,
    };
    setState((prev) => ({
      ...prev,
      rastaCuts: prev.rastaCuts - cost,
      queue: [...prev.queue, task],
    }));
    setMessage(`Rasta dice: mejora iniciada. ${objectDef.name} estará listo en ${formatTime(duration * 1000)}.`);
  }

  function startAction(actionId) {
    const action = ACTIONS[actionId];
    const room = state.rooms[activeRoom];
    if (!action || !room) return;
    if (state.queue.length >= MAX_QUEUE) {
      setMessage("Rasta dice: cola llena. Espera a que termine una acción.");
      return;
    }
    const cost = Number(action.cost || 0);
    const energy = Number(action.energy || 0);
    if (cost && state.rastaCuts < cost) {
      setMessage(`Rasta dice: necesitas ${cost} RC para iniciar esa acción.`);
      return;
    }
    if (energy && state.energy < energy) {
      setMessage("Rasta dice: te falta energía. Espera un poco o recarga desde el panel.");
      return;
    }
    if (actionId === "client" && state.stock <= 0) {
      setMessage("Rasta dice: no queda stock. Entra al almacén y repón productos.");
      return;
    }
    const reward = typeof action.reward === "function" ? action.reward(state, room) : Number(action.reward || 0);
    const fame = typeof action.fame === "function" ? action.fame(state, room) : Number(action.fame || 0);
    const amount = typeof action.amount === "function" ? action.amount(state, room) : Number(action.amount || 0);
    const task = {
      id: `action-${activeRoom}-${actionId}-${Date.now()}`,
      type: "action",
      actionId,
      roomId: activeRoom,
      label: action.label,
      reward,
      fame,
      amount,
      energy,
      cost,
      startedAt: Date.now(),
      endsAt: Date.now() + action.duration * 1000,
    };
    setState((prev) => ({
      ...prev,
      rastaCuts: prev.rastaCuts - cost,
      energy: Math.max(0, prev.energy - energy),
      lastEnergyAt: energy ? Date.now() : prev.lastEnergyAt,
      stock: actionId === "client" ? Math.max(0, prev.stock - 1) : prev.stock,
      queue: [...prev.queue, task],
    }));
    setMessage(`Rasta dice: ${action.label} en marcha. Termina en ${formatTime(action.duration * 1000)}.`);
  }

  function resetGame() {
    if (!window.confirm("¿Reiniciar solo el progreso local del Tycoon?")) return;
    const fresh = createInitialState();
    setState(fresh);
    setScreen("map");
    setActiveRoom("corte");
    setMessage("Rasta dice: estudio reiniciado. Nueva partida lista.");
  }

  return (
    <div className="rcTycoon">
      <style>{TYCOON_CSS}</style>
      <TopBar state={state} stats={stats} />

      {screen === "map" && (
        <MapScreen
          state={state}
          now={now}
          message={message}
          onEnterRoom={enterRoom}
          onUnlockRoom={unlockRoom}
          onResetGame={resetGame}
        />
      )}

      {screen === "unlock" && (
        <UnlockScreen
          state={state}
          roomDef={activeRoomDef}
          roomState={activeRoomState}
          onBack={() => setScreen("map")}
          onUnlock={() => unlockRoom(activeRoom)}
        />
      )}

      {screen === "room" && (
        <RoomScreen
          state={state}
          stats={stats}
          roomDef={activeRoomDef}
          roomState={activeRoomState}
          selectedObject={selectedObject}
          setSelectedObject={setSelectedObject}
          now={now}
          message={message}
          onBack={() => setScreen("map")}
          onUpgrade={startUpgrade}
          onAction={startAction}
        />
      )}
    </div>
  );
}

function TopBar({ state, stats }) {
  return (
    <div className="tyTopbar">
      <div className="tyBrand">
        <div className="tyCoinLogo">RC</div>
        <div>
          <strong>Rasta Cuts Tycoon</strong>
          <span>Gestión del estudio</span>
        </div>
      </div>
      <Resource icon="🪙" label="Rasta Cuts" value={state.rastaCuts} />
      <Resource icon="⭐" label="Fama" value={state.fame} />
      <Resource icon="⚡" label="Energía" value={`${state.energy}/${state.maxEnergy}`} />
      <Resource icon="🧴" label="Stock" value={state.stock} />
      <Resource icon="👑" label="Prestigio" value={stats.prestige} />
    </div>
  );
}

function Resource({ icon, label, value }) {
  return (
    <div className="tyResource">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MapScreen({ state, now, message, onEnterRoom, onUnlockRoom, onResetGame }) {
  return (
    <div className="tyLayout">
      <aside className="tySidebar">
        <button className="tyMenuActive">🗺️ Mapa</button>
        <button>⚙️ Gestión</button>
        <button>📦 Stock</button>
        <button>👥 Clientes</button>
        <button>🎯 Misiones</button>
        <button>📘 Guía</button>
        <button onClick={onResetGame}>♻️ Reiniciar</button>
      </aside>

      <main className="tyMapWrap">
        <div className="tyStudioMap">
          <img src={studioMap} alt="Mapa isométrico del estudio Rasta Cuts" />
          {Object.values(ROOM_DEFS).map((room) => {
            const roomState = state.rooms[room.id];
            const locked = !roomState?.unlocked;
            return (
              <button
                key={room.id}
                className={`tyRoomPin ${locked ? "locked" : ""}`}
                style={{
                  left: `${room.mapHotspot.left}%`,
                  top: `${room.mapHotspot.top}%`,
                  width: `${room.mapHotspot.width}%`,
                  height: `${room.mapHotspot.height}%`,
                }}
                onClick={() => (locked ? onUnlockRoom(room.id) : onEnterRoom(room.id))}
                title={locked ? `${room.name} bloqueado` : `Entrar en ${room.name}`}
              >
                <span className="tyPinLabel">
                  <b>{room.icon} {room.name}</b>
                  <small>{locked ? "Bloqueado" : `Nivel ${roomState.level}`}</small>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <aside className="tyRightPanel">
        <GuideCard message={message} />
        <QueuePanel queue={state.queue} now={now} />
        <MissionPanel state={state} />
      </aside>
    </div>
  );
}

function UnlockScreen({ state, roomDef, onBack, onUnlock }) {
  const ready = canUnlock(roomDef, state);
  const enough = state.rastaCuts >= Number(roomDef.unlockCost || 0);
  return (
    <div className="tyRoomPage">
      <div className="tyRoomHeader">
        <button onClick={onBack}>← Volver al mapa</button>
        <div>
          <h1>{roomDef.icon} {roomDef.name}</h1>
          <p>{roomDef.description}</p>
        </div>
      </div>
      <div className="tyUnlockBox">
        <h2>Reforma pendiente</h2>
        <p>Esta zona todavía no está disponible. Cuando la abras, aparecerá como una sala navegable con sus propios objetos, menús y mejoras.</p>
        <div className="tyReqGrid">
          <div><small>Coste</small><strong>{roomDef.unlockCost || 0} RC</strong></div>
          <div><small>Requisito</small><strong>{roomDef.requires || "Sin requisito"}</strong></div>
          <div><small>Estado</small><strong>{ready ? "Listo" : "Bloqueado"}</strong></div>
        </div>
        <button className="tyPrimaryBtn" disabled={!ready || !enough} onClick={onUnlock}>
          {enough ? "Abrir sala" : "Faltan RC"}
        </button>
      </div>
    </div>
  );
}

function RoomScreen({ state, stats, roomDef, roomState, selectedObject, setSelectedObject, now, message, onBack, onUpgrade, onAction }) {
  const selected = selectedObject || roomDef.hotspots?.[0]?.id;
  const objectDef = roomDef.objects[selected];
  const objectLevel = getObjectLevel(roomState, selected);
  const cost = objectDef ? upgradeCost(roomDef.id, selected, state) : 0;
  const duration = objectDef ? upgradeDuration(roomDef.id, selected, state) : 0;
  const roomBusyObjects = new Set(state.queue.filter((q) => q.roomId === roomDef.id && q.objectId).map((q) => q.objectId));
  const isBusy = roomBusyObjects.has(selected);

  return (
    <div className="tyRoomPage">
      <div className="tyRoomHeader">
        <button onClick={onBack}>← Volver al mapa</button>
        <div>
          <h1>{roomDef.icon} {roomDef.name}</h1>
          <p>{roomDef.description}</p>
        </div>
      </div>

      <div className="tyRoomGrid">
        <section className="tyRoomScene">
          <div
            className="tyRoomBackground"
            style={{
              backgroundImage: `url(${studioMap})`,
              backgroundSize: `${roomDef.roomBg.size}%`,
              backgroundPosition: `${roomDef.roomBg.x}% ${roomDef.roomBg.y}%`,
            }}
          >
            <div className="tyRoomShade" />
            {roomDef.hotspots.map((hot) => {
              const level = getObjectLevel(roomState, hot.id);
              const selectedClass = selected === hot.id ? "selected" : "";
              return (
                <button
                  key={hot.id}
                  className={`tyObjectHotspot ${selectedClass}`}
                  style={{ left: `${hot.x}%`, top: `${hot.y}%`, width: `${hot.w}%`, height: `${hot.h}%` }}
                  onClick={() => setSelectedObject(hot.id)}
                >
                  <span>{hot.icon}</span>
                  <b>{hot.label}</b>
                  <small>Nivel {level}</small>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="tyRoomMenu">
          <GuideCard message={message} compact />
          <div className="tyPanel">
            <h2>{objectDef?.name || "Objeto"}</h2>
            <p>{objectDef?.description}</p>
            <div className="tyStatsLine">
              <span>Nivel actual</span><b>{objectLevel}</b>
            </div>
            <div className="tyStatsLine">
              <span>Mejora</span><b>{cost} RC</b>
            </div>
            <div className="tyStatsLine">
              <span>Tiempo</span><b>{formatTime(duration * 1000)}</b>
            </div>
            <button className="tyPrimaryBtn" disabled={isBusy || objectLevel >= objectDef?.maxLevel || state.rastaCuts < cost} onClick={() => onUpgrade(selected)}>
              {isBusy ? "Mejora en curso" : objectLevel >= objectDef?.maxLevel ? "Máximo" : "Mejorar objeto"}
            </button>
          </div>

          <div className="tyPanel">
            <h2>Acciones de sala</h2>
            <div className="tyActionList">
              {(roomDef.quickActions || []).map((actionId) => {
                const action = ACTIONS[actionId];
                return (
                  <button key={actionId} onClick={() => onAction(actionId)}>
                    <span>{action.icon}</span>
                    <div>
                      <b>{action.label}</b>
                      <small>{action.description}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <QueuePanel queue={state.queue} now={now} />
          <div className="tyPanel">
            <h2>Datos de sala</h2>
            <div className="tyStatsLine"><span>Nivel sala</span><b>{roomState.level}</b></div>
            <div className="tyStatsLine"><span>Prestigio total</span><b>{stats.prestige}</b></div>
            <div className="tyStatsLine"><span>Clientes atendidos</span><b>{state.servedClients}</b></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function GuideCard({ message, compact = false }) {
  return (
    <div className={`tyGuide ${compact ? "compact" : ""}`}>
      <div className="tyRastaFace">🧔🏾‍♂️</div>
      <p>{message}</p>
    </div>
  );
}

function QueuePanel({ queue, now }) {
  return (
    <div className="tyPanel">
      <h2>Cola de trabajo</h2>
      {queue.length === 0 ? (
        <p className="tyEmpty">No hay mejoras ni acciones en curso.</p>
      ) : (
        <div className="tyQueueList">
          {queue.map((task) => {
            const total = Math.max(1, task.endsAt - task.startedAt);
            const done = Math.min(100, Math.max(0, ((now - task.startedAt) / total) * 100));
            return (
              <div className="tyQueueItem" key={task.id}>
                <div><b>{task.label}</b><small>{formatTime(task.endsAt - now)}</small></div>
                <div className="tyProgress"><span style={{ width: `${done}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MissionPanel({ state }) {
  const missions = [
    { label: "Atiende 10 clientes", progress: state.servedClients, target: 10 },
    { label: "Alcanza 150 de fama", progress: state.fame, target: 150 },
    { label: "Abre la zona chill", progress: state.rooms.chill.unlocked ? 1 : 0, target: 1 },
  ];
  return (
    <div className="tyPanel">
      <h2>Misiones</h2>
      {missions.map((m) => (
        <div className="tyMission" key={m.label}>
          <div><b>{m.label}</b><small>{Math.min(m.progress, m.target)} / {m.target}</small></div>
          <div className="tyProgress"><span style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function regenEnergy(state, now) {
  const last = Number(state.lastEnergyAt || now);
  if (state.energy >= state.maxEnergy) return state;
  const gained = Math.floor((now - last) / 60000);
  if (gained <= 0) return state;
  const newEnergy = Math.min(state.maxEnergy, state.energy + gained);
  return { ...state, energy: newEnergy, lastEnergyAt: now };
}

function processFinishedTasks(state, now, setMessage) {
  if (!Array.isArray(state.queue) || state.queue.length === 0) return state;
  const finished = state.queue.filter((task) => task.endsAt <= now);
  if (finished.length === 0) return state;

  let next = { ...state, queue: state.queue.filter((task) => task.endsAt > now), rooms: { ...state.rooms } };
  const messages = [];

  for (const task of finished) {
    if (task.type === "upgrade") {
      const room = next.rooms[task.roomId];
      const objectLevel = getObjectLevel(room, task.objectId);
      const newObjects = { ...room.objects, [task.objectId]: objectLevel + 1 };
      const newRoomLevel = Math.max(room.level, Math.floor(Object.values(newObjects).reduce((a, b) => a + b, 0) / 3));
      next.rooms[task.roomId] = { ...room, objects: newObjects, level: Math.max(1, newRoomLevel) };
      next.fame += 5;
      messages.push(`${task.label} completado`);
    }

    if (task.type === "action") {
      next.rastaCuts += Number(task.reward || 0);
      next.fame += Number(task.fame || 0);
      if (task.actionId === "stock") next.stock = Math.min(999, next.stock + Number(task.amount || 0));
      if (task.actionId === "client") next.servedClients += 1;
      if (task.actionId === "event") next.completedEvents += 1;
      messages.push(`${task.label} terminado`);
    }
  }

  if (messages.length) setMessage(`Rasta dice: ${messages.join(". ")}.`);
  return next;
}

const TYCOON_CSS = `
.rcTycoon{min-height:100vh;background:#07100b;color:#f5e6c8;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;background-image:radial-gradient(circle at top,#193824 0,#07100b 46%,#030503 100%)}
.tyTopbar{position:sticky;top:0;z-index:50;display:flex;gap:10px;align-items:center;padding:10px 14px;background:linear-gradient(180deg,rgba(20,15,8,.96),rgba(8,8,5,.88));border-bottom:1px solid rgba(224,189,92,.35);box-shadow:0 12px 30px rgba(0,0,0,.35);overflow-x:auto}
.tyBrand{display:flex;align-items:center;gap:10px;min-width:230px}.tyBrand strong{display:block;font-size:1rem;letter-spacing:.02em}.tyBrand span{display:block;font-size:.72rem;color:#c5a869}.tyCoinLogo{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#ffd15d,#8b5a16);color:#180b04;font-weight:1000;border:2px solid rgba(255,240,180,.5)}
.tyResource{display:flex;align-items:center;gap:8px;min-width:120px;padding:7px 10px;border:1px solid rgba(229,190,94,.32);border-radius:14px;background:rgba(0,0,0,.34)}.tyResource span{font-size:1.25rem}.tyResource small{display:block;color:#bda56b;font-size:.66rem}.tyResource strong{display:block;color:#fff1bc;font-size:.94rem}
.tyLayout{display:grid;grid-template-columns:150px minmax(0,1fr) 300px;gap:12px;padding:12px;min-height:calc(100vh - 64px)}
.tySidebar,.tyRightPanel{display:flex;flex-direction:column;gap:10px}.tySidebar{padding:10px;border:1px solid rgba(229,190,94,.22);border-radius:18px;background:rgba(0,0,0,.42);height:max-content}.tySidebar button{width:100%;text-align:left;border:0;border-radius:12px;padding:12px 11px;background:rgba(255,255,255,.06);color:#dfc98d;font-weight:900;cursor:pointer}.tySidebar button:hover,.tySidebar .tyMenuActive{background:linear-gradient(135deg,#d5a83a,#7c4b13);color:#130802}
.tyMapWrap{min-width:0}.tyStudioMap{position:relative;border-radius:22px;overflow:hidden;border:1px solid rgba(229,190,94,.30);box-shadow:0 24px 80px rgba(0,0,0,.42);background:#090b07}.tyStudioMap img{display:block;width:100%;height:auto;user-select:none}.tyStudioMap:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at center,transparent 48%,rgba(0,0,0,.28))}
.tyRoomPin{position:absolute;z-index:3;border:0;background:transparent;cursor:pointer}.tyRoomPin:before{content:"";position:absolute;left:50%;top:50%;width:38px;height:38px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(167,255,85,.18);border:3px solid #d7ff65;box-shadow:0 0 18px rgba(170,255,80,.6);transition:.18s}.tyRoomPin:hover:before{transform:translate(-50%,-50%) scale(1.24);background:rgba(255,210,83,.28);border-color:#ffd452}.tyRoomPin.locked:before{background:rgba(0,0,0,.28);border-color:#856f49;box-shadow:none}.tyPinLabel{position:absolute;left:50%;top:6%;transform:translateX(-50%);min-width:138px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,220,130,.48);background:rgba(10,8,4,.82);color:#ffe28a;text-transform:uppercase;box-shadow:0 10px 24px rgba(0,0,0,.35)}.tyPinLabel b,.tyPinLabel small{display:block}.tyPinLabel b{font-size:.78rem}.tyPinLabel small{font-size:.64rem;color:#d4c28f}
.tyPanel,.tyGuide,.tyUnlockBox{border:1px solid rgba(229,190,94,.28);border-radius:18px;background:linear-gradient(180deg,rgba(29,22,12,.92),rgba(7,8,5,.86));box-shadow:0 14px 32px rgba(0,0,0,.28);padding:14px}.tyPanel h2{margin:0 0 10px;font-size:1rem;color:#ffe19a}.tyEmpty{color:#bba773;margin:0;font-size:.88rem}.tyGuide{display:flex;gap:10px;align-items:center}.tyGuide.compact{align-items:flex-start}.tyGuide p{margin:0;color:#eedaa4;line-height:1.35;font-size:.9rem}.tyRastaFace{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#714718,#1f1208);display:grid;place-items:center;font-size:1.55rem;flex:0 0 auto;border:1px solid rgba(255,220,130,.3)}
.tyQueueList,.tyActionList{display:flex;flex-direction:column;gap:9px}.tyQueueItem,.tyMission{display:flex;flex-direction:column;gap:6px;padding:9px;border-radius:12px;background:rgba(255,255,255,.055)}.tyQueueItem div:first-child,.tyMission div:first-child{display:flex;justify-content:space-between;gap:8px}.tyQueueItem b,.tyMission b{font-size:.82rem}.tyQueueItem small,.tyMission small{color:#c9b276;font-size:.72rem}.tyProgress{height:8px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.09)}.tyProgress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#80c342,#ffd34f)}
.tyRoomPage{padding:14px}.tyRoomHeader{display:flex;align-items:center;gap:14px;margin-bottom:14px}.tyRoomHeader button{border:1px solid rgba(229,190,94,.34);border-radius:999px;background:rgba(0,0,0,.38);color:#f5e6c8;padding:10px 14px;font-weight:900;cursor:pointer}.tyRoomHeader h1{margin:0;color:#ffe19a;font-size:1.55rem}.tyRoomHeader p{margin:3px 0 0;color:#c8b788}.tyRoomGrid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px}.tyRoomScene{min-height:580px;border-radius:22px;overflow:hidden;border:1px solid rgba(229,190,94,.28);box-shadow:0 22px 70px rgba(0,0,0,.42);background:#050604}.tyRoomBackground{position:relative;min-height:580px;background-repeat:no-repeat;background-color:#080907}.tyRoomShade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.44));pointer-events:none}.tyObjectHotspot{position:absolute;border:1px solid rgba(255,224,128,.50);border-radius:14px;background:rgba(11,8,4,.66);color:#ffe7a8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;backdrop-filter:blur(4px);box-shadow:0 10px 24px rgba(0,0,0,.32);transition:.18s}.tyObjectHotspot:hover,.tyObjectHotspot.selected{transform:translateY(-3px) scale(1.03);background:rgba(131,85,18,.82);border-color:#ffe16c}.tyObjectHotspot span{font-size:1.55rem}.tyObjectHotspot b{font-size:.8rem}.tyObjectHotspot small{font-size:.68rem;color:#d8c891}
.tyRoomMenu{display:flex;flex-direction:column;gap:12px}.tyStatsLine{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08);color:#c8b788}.tyStatsLine b{color:#fff0b2}.tyPrimaryBtn{width:100%;margin-top:12px;border:0;border-radius:14px;padding:12px 14px;background:linear-gradient(135deg,#ffd55c,#946013);color:#180b04;font-weight:1000;cursor:pointer;box-shadow:0 10px 22px rgba(0,0,0,.24)}.tyPrimaryBtn:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.5)}.tyActionList button{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid rgba(255,220,130,.18);border-radius:13px;background:rgba(255,255,255,.055);color:#f4dfaa;padding:10px;cursor:pointer}.tyActionList button span{font-size:1.4rem}.tyActionList button b{display:block}.tyActionList button small{display:block;color:#bda56b;line-height:1.25;margin-top:2px}.tyActionList button:hover{background:rgba(255,213,92,.14)}
.tyUnlockBox{max-width:720px;margin:34px auto;padding:24px}.tyUnlockBox h2{margin:0 0 8px;color:#ffe19a}.tyReqGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.tyReqGrid div{padding:12px;border-radius:14px;background:rgba(255,255,255,.06)}.tyReqGrid small,.tyReqGrid strong{display:block}.tyReqGrid small{color:#bfa971}.tyReqGrid strong{color:#fff1bc;margin-top:3px}
@media(max-width:980px){.tyLayout{grid-template-columns:1fr}.tySidebar{display:grid;grid-template-columns:repeat(3,1fr)}.tyRightPanel{display:grid;grid-template-columns:1fr}.tyRoomGrid{grid-template-columns:1fr}.tyRoomScene,.tyRoomBackground{min-height:440px}.tyPinLabel{min-width:112px;font-size:.72rem}.tyRoomPin:before{width:28px;height:28px}.tyTopbar{align-items:stretch}.tyBrand{min-width:190px}.tyResource{min-width:104px}.tyReqGrid{grid-template-columns:1fr}}
@media(max-width:560px){.tyLayout,.tyRoomPage{padding:8px}.tySidebar{grid-template-columns:repeat(2,1fr)}.tyRoomScene,.tyRoomBackground{min-height:360px}.tyPinLabel{display:none}.tyRoomHeader{align-items:flex-start;flex-direction:column}.tyRoomHeader h1{font-size:1.25rem}.tyRoomMenu{gap:10px}}
`;
