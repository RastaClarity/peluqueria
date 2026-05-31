import React from "react";
import studioMap from "./estudio tycoon peluqueria.png";

/**
 * Mapa principal del modo Rasta Cuts Tycoon.
 * Usa una imagen limpia del estudio como fondo y coloca zonas clicables encima.
 */
export default function TycoonMap({ onSelectRoom }) {
  const hotspots = [
    {
      id: "almacen",
      label: "Almacén",
      level: 1,
      style: { left: "8%", top: "12%", width: "25%", height: "25%" },
      badge: { left: "16%", top: "11%" },
    },
    {
      id: "corte",
      label: "Estudio principal",
      level: 1,
      style: { left: "36%", top: "14%", width: "32%", height: "34%" },
      badge: { left: "48%", top: "16%" },
    },
    // Estas zonas quedan preparadas para cuando creemos sus pantallas.
    // Ahora no se activan para evitar que el jugador entre en una pantalla vacía.
    {
      id: "bano",
      label: "Baño",
      level: 0,
      locked: true,
      style: { left: "14%", top: "42%", width: "20%", height: "24%" },
      badge: { left: "18%", top: "44%" },
    },
    {
      id: "chill",
      label: "Zona chill",
      level: 0,
      locked: true,
      style: { left: "73%", top: "25%", width: "22%", height: "28%" },
      badge: { left: "78%", top: "26%" },
    },
    {
      id: "terraza",
      label: "Terraza",
      level: 0,
      locked: true,
      style: { left: "57%", top: "56%", width: "31%", height: "31%" },
      badge: { left: "66%", top: "58%" },
    },
  ];

  const handleRoomClick = (room) => {
    if (room.locked) return;
    onSelectRoom?.(room.id);
  };

  return (
    <div
      className="tycoon-map-card"
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "16px",
        background: "linear-gradient(180deg,#101714,#050706)",
        color: "#F8E8B8",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, letterSpacing: ".08em", fontSize: "0.8rem", opacity: 0.8 }}>
            RASTA CUTS TYCOON
          </div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#FFD56A" }}>Mapa del estudio</h1>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            fontWeight: 900,
            fontSize: "0.85rem",
          }}
        >
          <span style={chipStyle}>🪙 RC: 100</span>
          <span style={chipStyle}>⭐ Fama: 0</span>
          <span style={chipStyle}>⚡ Energía: 10/10</span>
        </div>
      </div>

      <div
        className="tycoon-map-board"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          borderRadius: 24,
          overflow: "hidden",
          border: "2px solid rgba(255,213,106,.28)",
          boxShadow: "0 24px 70px rgba(0,0,0,.55)",
          background: "#070B08",
        }}
      >
        <img
          src={studioMap}
          alt="Mapa isométrico del estudio Rasta Cuts"
          style={{ width: "100%", display: "block" }}
        />

        {hotspots.map((room) => (
          <React.Fragment key={room.id}>
            <button
              type="button"
              aria-label={room.locked ? `${room.label} bloqueada` : `Entrar en ${room.label}`}
              title={room.locked ? `${room.label} bloqueada` : `Entrar en ${room.label}`}
              onClick={() => handleRoomClick(room)}
              style={{
                position: "absolute",
                ...room.style,
                border: room.locked ? "2px dashed rgba(255,255,255,.12)" : "2px solid rgba(255,213,106,.0)",
                background: room.locked ? "rgba(0,0,0,.05)" : "rgba(255,213,106,.01)",
                cursor: room.locked ? "not-allowed" : "pointer",
                borderRadius: 18,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = room.locked ? "rgba(255,255,255,.25)" : "rgba(255,213,106,.65)";
                e.currentTarget.style.background = room.locked ? "rgba(0,0,0,.16)" : "rgba(255,213,106,.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = room.locked ? "rgba(255,255,255,.12)" : "rgba(255,213,106,.0)";
                e.currentTarget.style.background = room.locked ? "rgba(0,0,0,.05)" : "rgba(255,213,106,.01)";
              }}
            />

            <button
              type="button"
              onClick={() => handleRoomClick(room)}
              style={{
                position: "absolute",
                ...room.badge,
                transform: "translate(-50%, -50%)",
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,213,106,.45)",
                background: room.locked
                  ? "linear-gradient(180deg,rgba(20,20,20,.88),rgba(0,0,0,.82))"
                  : "linear-gradient(180deg,rgba(26,20,6,.96),rgba(5,8,5,.92))",
                color: room.locked ? "#B7B7B7" : "#FFD56A",
                fontWeight: 950,
                fontSize: "0.75rem",
                boxShadow: "0 8px 22px rgba(0,0,0,.45)",
                cursor: room.locked ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              {room.locked ? "🔒 " : "⬢ "}{room.label}
              <div style={{ color: room.locked ? "#999" : "#F8E8B8", fontSize: "0.62rem", marginTop: 2 }}>
                {room.locked ? "Bloqueada" : `Nivel ${room.level}`}
              </div>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(0,0,0,.42)",
  border: "1px solid rgba(255,213,106,.24)",
  color: "#F8E8B8",
};
