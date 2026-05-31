import React from "react";

/**
 * StorageRoom represents the warehouse where the player manages supplies and
 * materials. This simple component demonstrates how you might structure the
 * UI; you can replace the placeholder actions with your own game logic.
 *
 * Props:
 * - onBack: function() => void. Called to return to the map.
 */
export default function StorageRoom({ onBack }) {
  return (
    <div style={{ padding: 16 }}>
      <h2>Almacén</h2>
      <p>Gestiona tu inventario de productos y herramientas aquí.</p>
      <div style={{ margin: "16px 0" }}>
        <button
          style={{ marginRight: 8 }}
          onClick={() => alert("Comprando productos... (lógica por implementar)")}
        >
          Comprar productos
        </button>
        <button
          style={{ marginRight: 8 }}
          onClick={() => alert("Mejorando capacidad... (lógica por implementar)")}
        >
          Mejorar capacidad
        </button>
        <button onClick={() => alert("Organizando inventario... (lógica por implementar)")}>Organizar inventario</button>
      </div>
      <button onClick={onBack}>Volver al mapa</button>
    </div>
  );
}