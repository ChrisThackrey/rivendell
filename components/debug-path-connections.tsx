"use client";

import { useEffect, useState } from "react";
import PathLine from "./path-line";

export default function DebugPathConnections() {
  const [showCards, setShowCards] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [debug, setDebug] = useState(false);
  
  const cards = [
    { id: "card-1", top: 100, left: 100, width: 200, height: 120 },
    { id: "card-2", top: 300, left: 400, width: 200, height: 120 },
    { id: "card-3", top: 500, left: 100, width: 200, height: 120 }
  ];
  
  const connections = [
    { fromId: "card-1", toId: "card-2", type: "accepted" as const },
    { fromId: "card-2", toId: "card-3", type: "secondary" as const }
  ];

  return (
    <div className="p-8 relative min-h-screen bg-slate-50">
      <div className="controls fixed top-4 right-4 z-10 bg-white p-4 rounded-md shadow-md space-y-2">
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showCards}
              onChange={() => setShowCards(!showCards)}
            />
            <span>Show Cards</span>
          </label>
        </div>
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showConnections}
              onChange={() => setShowConnections(!showConnections)}
            />
            <span>Show Connections</span>
          </label>
        </div>
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={debug}
              onChange={() => setDebug(!debug)}
            />
            <span>Debug Mode</span>
          </label>
        </div>
      </div>

      <div className="pathway-container relative w-full" id="pathway-container">
        {showCards && cards.map((card) => (
          <div
            key={card.id}
            id={card.id}
            className="absolute border border-gray-300 rounded-md p-4 bg-white"
            style={{
              top: card.top,
              left: card.left,
              width: card.width,
              height: card.height
            }}
          >
            <div className="text-lg font-medium">{card.id}</div>
            <div className="text-sm text-gray-500">Test card for debugging path connections</div>
          </div>
        ))}

        {showConnections && connections.map((conn, i) => (
          <PathLine
            key={`${conn.fromId}-${conn.toId}`}
            fromId={conn.fromId}
            toId={conn.toId}
            type={conn.type}
            delay={i * 0.5}
            showManipulationControls={debug}
          />
        ))}
      </div>
    </div>
  );
}