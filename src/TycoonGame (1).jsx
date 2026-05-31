import React, { useState } from "react";
import TycoonMap from "./TycoonMap.jsx";
import MainRoom from "./MainRoom.jsx";
import StorageRoom from "./StorageRoom.jsx";

/**
 * TycoonGame is the root component for the barber studio tycoon. It manages the
 * current active view (map or one of the rooms) and holds the shared game
 * state, such as the player's RC currency and the unlocked rooms. This
 * simplified version focuses on navigation and map interaction; you can extend
 * it with your existing game logic (economy, missions, timers, etc.).
 */
export default function TycoonGame() {
  // activeRoom controls which screen is displayed: "map", "corte", "almacen", etc.
  const [activeRoom, setActiveRoom] = useState("map");

  // Handler to enter a room from the map.
  const handleSelectRoom = (roomId) => {
    setActiveRoom(roomId);
  };

  // Handler to return to the map.
  const handleBackToMap = () => {
    setActiveRoom("map");
  };

  return (
    <div style={{ background: "#f1e9d6", minHeight: "100vh", padding: 16 }}>
      {/* Header with currency could go here */}
      {activeRoom === "map" && <TycoonMap onSelectRoom={handleSelectRoom} />}
      {activeRoom === "corte" && <MainRoom onBack={handleBackToMap} />}
      {activeRoom === "almacen" && <StorageRoom onBack={handleBackToMap} />}
      {/* Add additional room components as you create them */}
    </div>
  );
}