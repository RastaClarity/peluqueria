import { dbPost } from "./db.js";

async function createNotification(payload = {}) {
  try {
    if (!payload?.titulo) return null;

    return await dbPost("notificaciones", {
      usuario_id: payload.usuario_id ? String(payload.usuario_id) : null,
      rol_destino: payload.rol_destino || "admin",
      tipo: payload.tipo || "general",
      titulo: payload.titulo,
      mensaje: payload.mensaje || null,
      entidad_tipo: payload.entidad_tipo || null,
      entidad_id: payload.entidad_id ? String(payload.entidad_id) : null,
      leida: false,
      importante: Boolean(payload.importante),
    });
  } catch (e) {
    console.warn("No se pudo crear notificación", e);
    return null;
  }
}

function notificationIcon(tipo = "general") {
  const map = {
    cita: "📅",
    cita_nueva: "📅",
    cita_cancelada: "❌",
    cita_propuesta: "🔁",
    cita_propuesta_aceptada: "✅",
    cita_propuesta_rechazada: "⚠️",
    mensaje: "📩",
    canje: "🎁",
    pedido: "🛍️",
    cobro: "💰",
    reporte: "🚩",
    moderacion: "🛡️",
    general: "🔔",
  };

  return map[tipo] || "🔔";
}

export {
  createNotification,
  notificationIcon
};
