import React from "react";

/**
 * MainRoom represents the primary cutting area of the barber studio. In a full
 * version this component could display an illustration of the room and
 * interactive objects such as chairs, mirrors and tools. Here we include a
 * placeholder layout with buttons to perform typical actions. You can
 * customise the UI and logic to match your game mechanics.
 *
 * Props:
 * - onBack: function() => void. Called when the player wants to return to
 *   the map.
 */
export default function MainRoom({ onBack }) {
  return (
    <div style={{ padding: 16 }}>
      <h2>Zona de corte</h2>
      <p>Bienvenido a la sala principal. Aquí es donde atiendes a tus clientes y mejoras tu negocio.</p>
      <div style={{ margin: "16px 0" }}>
        <button
          style={{ marginRight: 8 }}
          onClick={() => alert("Atendiendo a un cliente... (lógica por implementar)")}
        >
          Atender cliente
        </button>
        <button
          style={{ marginRight: 8 }}
          onClick={() => alert("Mejorando la silla... (lógica por implementar)")}
        >
          Mejorar silla
        </button>
        <button onClick={() => alert("Comprando decoración... (lógica por implementar)")}>Comprar decoración</button>
      </div>
      <button onClick={onBack}>Volver al mapa</button>
    </div>
  );
}
