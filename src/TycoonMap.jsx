import React from "react";

// Import the map illustration. You should place your studio map image in
// the same directory as this component and update the import path accordingly.
// For example, if you save your map illustration as studioMap.png in the
// "public" or "tycoon" folder, adjust the path below. In this template
// we reference a file named "bd93c686-9024-4a3b-9f97-aac625b9b614.png" that
// was previously generated. Replace it with your own image when ready.
import studioMap from "./bd93c686-9024-4a3b-9f97-aac625b9b614.png";

/**
 * TycoonMap displays an illustrated map of the barber studio with interactive
 * hotspots. Each hotspot corresponds to a room (e.g. the main cutting area or
 * the warehouse) and calls onSelectRoom when clicked. The coordinates and
 * sizes of the hotspots are defined in percentages so the layout adapts to
 * different screen sizes.
 *
 * Props:
 * - onSelectRoom: function(roomId) => void. Called when a hotspot is
 *   clicked with the id of the room (e.g. "corte" or "almacen").
 */
export default function TycoonMap({ onSelectRoom }) {
  // Define the hotspots on the map. You can fine‑tune the positions and
  // dimensions of these areas to match your illustration. Each entry
  // contains an id and a style object with left, top, width and height
  // expressed as percentages relative to the image size.
  const hotspots = [
    {
      id: "corte",
      style: {
        left: "33%",
        top: "42%",
        width: "20%",
        height: "28%",
      },
    },
    {
      id: "almacen",
      style: {
        left: "65%",
        top: "60%",
        width: "20%",
        height: "25%",
      },
    },
    // Add additional hotspots here for other rooms (e.g. zona chill, terraza)
  ];

  return (
    <div
      className="tycoon-map"
      style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto" }}
    >
      {/* The main map illustration */}
      <img
        src={studioMap}
        alt="Mapa del estudio"
        style={{ width: "100%", display: "block" }}
      />
      {/* Render each hotspot as an invisible button */}
      {hotspots.map((hotspot) => (
        <button
          key={hotspot.id}
          aria-label={`Abrir ${hotspot.id}`}
          onClick={() => onSelectRoom(hotspot.id)}
          style={{
            position: "absolute",
            background: "rgba(0,0,0,0)",
            border: 0,
            padding: 0,
            cursor: "pointer",
            ...hotspot.style,
          }}
        />
      ))}
    </div>
  );
}