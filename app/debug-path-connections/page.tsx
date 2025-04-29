"use client";

import { useState } from "react";
import PathLine from "@/components/path-line";
import FixedPathLine from "@/components/fixed-path-line";
import { motion } from "framer-motion";

export default function DebugPathConnections() {
  const [showOldPaths, setShowOldPaths] = useState(true);
  const [showNewPaths, setShowNewPaths] = useState(true);
  const [showManipulationControls, setShowManipulationControls] = useState(false);
  const [cardPositions, setCardPositions] = useState({
    card1: { x: 0, y: 0 },
    card2: { x: 0, y: 0 },
    card3: { x: 0, y: 0 },
    card4: { x: 0, y: 0 },
  });

  // Handle card movement
  const handleDragEnd = (id: string, info: any) => {
    setCardPositions((prev) => ({
      ...prev,
      [id]: {
        x: prev[id as keyof typeof prev].x + info.offset.x,
        y: prev[id as keyof typeof prev].y + info.offset.y,
      },
    }));
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Path Connection Debugging</h1>
      
      {/* Control Panel */}
      <div className="bg-white p-4 mb-6 rounded-lg shadow">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showOldPaths"
              checked={showOldPaths}
              onChange={() => setShowOldPaths(!showOldPaths)}
              className="w-4 h-4"
            />
            <label htmlFor="showOldPaths" className="cursor-pointer">
              Show Original Paths
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showNewPaths"
              checked={showNewPaths}
              onChange={() => setShowNewPaths(!showNewPaths)}
              className="w-4 h-4"
            />
            <label htmlFor="showNewPaths" className="cursor-pointer">
              Show Fixed Paths
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showControls"
              checked={showManipulationControls}
              onChange={() => setShowManipulationControls(!showManipulationControls)}
              className="w-4 h-4"
            />
            <label htmlFor="showControls" className="cursor-pointer">
              Show Path Controls
            </label>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>
            Drag the cards to test connection integrity. The fixed implementation should maintain proper connections
            even after animation and DOM changes.
          </p>
        </div>
      </div>
      
      {/* Cards Container */}
      <div className="relative w-full h-[600px] bg-white rounded-lg shadow mb-8 p-4">
        {/* Card 1 */}
        <motion.div
          id="card1"
          className="absolute w-64 p-4 bg-blue-100 rounded-lg shadow-md"
          style={{ 
            left: 100, 
            top: 100, 
            x: cardPositions.card1.x, 
            y: cardPositions.card1.y,
            zIndex: 10
          }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={(_, info) => handleDragEnd("card1", info)}
        >
          <h2 className="text-lg font-semibold">Card 1</h2>
          <p>Drag me to test connection paths</p>
        </motion.div>
        
        {/* Card 2 */}
        <motion.div
          id="card2"
          className="absolute w-64 p-4 bg-green-100 rounded-lg shadow-md"
          style={{ 
            left: 500, 
            top: 100, 
            x: cardPositions.card2.x, 
            y: cardPositions.card2.y,
            zIndex: 10
          }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={(_, info) => handleDragEnd("card2", info)}
        >
          <h2 className="text-lg font-semibold">Card 2</h2>
          <p>Connected to Card 1</p>
        </motion.div>
        
        {/* Card 3 */}
        <motion.div
          id="card3"
          className="absolute w-64 p-4 bg-yellow-100 rounded-lg shadow-md"
          style={{ 
            left: 100, 
            top: 300, 
            x: cardPositions.card3.x, 
            y: cardPositions.card3.y,
            zIndex: 10
          }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={(_, info) => handleDragEnd("card3", info)}
        >
          <h2 className="text-lg font-semibold">Card 3</h2>
          <p>Connected to Card 1</p>
        </motion.div>
        
        {/* Card 4 */}
        <motion.div
          id="card4"
          className="absolute w-64 p-4 bg-red-100 rounded-lg shadow-md"
          style={{ 
            left: 500, 
            top: 300, 
            x: cardPositions.card4.x, 
            y: cardPositions.card4.y,
            zIndex: 10
          }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={(_, info) => handleDragEnd("card4", info)}
        >
          <h2 className="text-lg font-semibold">Card 4</h2>
          <p>Connected to Card 2 and Card 3</p>
        </motion.div>
        
        {/* Original Paths */}
        {showOldPaths && (
          <>
            <PathLine 
              fromId="card1" 
              toId="card2" 
              type="accepted"
              color="blue"
              showManipulationControls={showManipulationControls}
            />
            <PathLine 
              fromId="card1" 
              toId="card3" 
              type="secondary"
              color="green"
              showManipulationControls={showManipulationControls}
            />
            <PathLine 
              fromId="card3" 
              toId="card4" 
              type="accepted"
              color="orange"
              showManipulationControls={showManipulationControls}
            />
            <PathLine 
              fromId="card2" 
              toId="card4" 
              type="secondary"
              color="purple"
              showManipulationControls={showManipulationControls}
            />
          </>
        )}
        
        {/* Fixed Paths */}
        {showNewPaths && (
          <>
            <FixedPathLine 
              fromId="card1" 
              toId="card2" 
              type="accepted"
              color="blue"
              showManipulationControls={showManipulationControls}
            />
            <FixedPathLine 
              fromId="card1" 
              toId="card3" 
              type="secondary"
              color="green"
              showManipulationControls={showManipulationControls}
            />
            <FixedPathLine 
              fromId="card3" 
              toId="card4" 
              type="accepted"
              color="orange"
              showManipulationControls={showManipulationControls}
            />
            <FixedPathLine 
              fromId="card2" 
              toId="card4" 
              type="secondary"
              color="purple"
              showManipulationControls={showManipulationControls}
            />
          </>
        )}
      </div>
      
      {/* Debug Information */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Debug Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium">Original Implementation</h3>
            <ul className="text-sm text-gray-700 list-disc pl-5">
              <li>Uses basic SVG container with x,y positioning</li>
              <li>May have clipping issues due to animation</li>
              <li>Recalculates on window resize and scroll</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium">Fixed Implementation</h3>
            <ul className="text-sm text-gray-700 list-disc pl-5">
              <li>Uses improved SVG container with optimized dimensions</li>
              <li>Better handling of connection points</li>
              <li>Prevents path clipping with enhanced calculations</li>
              <li>Improved animation handling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}