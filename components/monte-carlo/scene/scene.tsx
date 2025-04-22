"use client";

import React from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { DynamicAxisLabels } from './dynamic-axis-labels';
import { ClusterCubes } from './cluster-cubes';
import { Points } from './points';
import { PointLabels } from './point-labels';
import { ConnectionLines } from './connection-lines';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import type { MonteCarloCluster } from '@/lib/monte-carlo-service'; // Import needed type

interface SceneProps {
  data: PointWithCluster[];
  clusters: MonteCarloCluster[];
  hoveredPoint: PointWithCluster | null;
  setHoveredPoint: (point: PointWithCluster | null) => void;
  closestPoints: PointWithCluster[];
  setClosestPoints: (points: PointWithCluster[]) => void;
  selectedPoint: PointWithCluster | null;
  setSelectedPoint: (point: PointWithCluster | null) => void;
  selectedClosestPoints: PointWithCluster[];
  selectedClusters: number[];
  toggleClusterSelection: (clusterId: number) => void;
  selectedBatchId: string | null; // Keep for potential future use in Scene sub-components if needed
  filteredData: PointWithCluster[];
  cameraState: { position: [number, number, number]; target: [number, number, number]; };
  controlsRef: React.RefObject<any>; // Consider using specific OrbitControls type if available
  onCameraChange: () => void;
  isCameraMovingRef: React.RefObject<boolean>;
  // preventAutoDeselect and isCameraMovingRecently removed as they are handled in parent/visualizer
}

// Type for point detection results (if needed within Scene, else remove)
// interface PointDetectionResult { index: number; distance: number; }

export const Scene = React.memo(function Scene({
  data, clusters, hoveredPoint, setHoveredPoint, closestPoints, setClosestPoints,
  selectedPoint, setSelectedPoint, selectedClosestPoints, selectedClusters,
  toggleClusterSelection, selectedBatchId, filteredData, // removed setSelectedClusters from destructuring
  cameraState, controlsRef, onCameraChange, isCameraMovingRef,
}: SceneProps) {

  // Initialize OrbitControls target
  React.useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraState.target);
      controlsRef.current.update();
    }
  }, [cameraState.target, controlsRef]);


  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 7]} intensity={0.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />

      {/* Helpers */}
      <gridHelper args={[100, 100, "#e2e8f0", "#e2e8f0"]} />
      <axesHelper args={[8]} />

      {/* Scene Content */}
      <DynamicAxisLabels />

      <ClusterCubes
        clusters={clusters}
        toggleClusterSelection={toggleClusterSelection}
        selectedClusters={selectedClusters}
      />

      <Points
        data={data} // Pass raw data for instancing & color logic
        hoveredPoint={hoveredPoint}
        setHoveredPoint={setHoveredPoint}
        setClosestPoints={setClosestPoints}
        selectedPoint={selectedPoint}
        setSelectedPoint={setSelectedPoint} // Points component needs this for direct selection logic
        selectedClusters={selectedClusters}
        isCameraMovingRef={isCameraMovingRef}
        filteredData={filteredData} // Pass filtered data for raycasting/direct detection filter
      />

      <PointLabels
        data={filteredData} // Labels should respect filtering
        hoveredPoint={hoveredPoint}
        selectedPoint={selectedPoint}
        closestPoints={closestPoints}
        selectedClosestPoints={selectedClosestPoints}
        selectedClusters={selectedClusters}
      />

      {/* Connection lines for selected point */}
      {selectedPoint && (
        <ConnectionLines
          point={selectedPoint}
          closestPoints={selectedClosestPoints}
          isSelected={true}
        />
      )}

      {/* Connection lines for hovered point (only if different from selected) */}
      {hoveredPoint && hoveredPoint.id !== selectedPoint?.id && (
        <ConnectionLines
          point={hoveredPoint}
          closestPoints={closestPoints} // Pass closestPoints for hover
          isSelected={false} // Indicate it's for hover
        />
      )}

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.05}
        onChange={onCameraChange}
        makeDefault
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        minDistance={2}
        maxDistance={100}
        enablePan={true}
      />
    </>
  );
});
Scene.displayName = 'MonteCarloScene';