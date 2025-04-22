"use client";

import React, { useEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { DynamicAxisLabels } from './dynamic-axis-labels';
import { ClusterCubes } from './cluster-cubes';
import { Points } from './points';
import { PointLabels } from './point-labels';
import { ConnectionLines } from './connection-lines';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import type { MonteCarloCluster } from '@/lib/monte-carlo-service';

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
  selectedBatchId: string | null;
  filteredData: PointWithCluster[];
  cameraState: { position: [number, number, number]; target: [number, number, number]; };
  controlsRef: React.RefObject<any>;
  onCameraChange: () => void;
  isCameraMovingRef: React.RefObject<boolean>;
}

export const Scene = React.memo(function Scene({
  data, clusters, hoveredPoint, setHoveredPoint, closestPoints, setClosestPoints,
  selectedPoint, setSelectedPoint, selectedClosestPoints, selectedClusters,
  toggleClusterSelection, selectedBatchId, filteredData,
  cameraState, controlsRef, onCameraChange, isCameraMovingRef,
}: SceneProps) {

  // Initialize OrbitControls target
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraState.target);
      controlsRef.current.update();
    }
  }, [cameraState.target, controlsRef]);

  return (
    <>
      {/* Basic scene elements */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 10]} intensity={0.5} color="#ffffff" />
      
      {/* Background elements */}
      <gridHelper args={[100, 100, "#e2e8f0", "#e2e8f0"]} position={[0, -0.5, 0]} />
      
      {/* Points cloud */}
      <Points
        data={data}
        hoveredPoint={hoveredPoint}
        setHoveredPoint={setHoveredPoint}
        setClosestPoints={setClosestPoints}
        selectedPoint={selectedPoint}
        setSelectedPoint={setSelectedPoint}
        selectedClusters={selectedClusters}
        isCameraMovingRef={isCameraMovingRef}
        filteredData={filteredData}
      />
      
      {/* Labels */}
      <DynamicAxisLabels />
      
      {/* Clusters */}
      <ClusterCubes
        clusters={clusters}
        toggleClusterSelection={toggleClusterSelection}
        selectedClusters={selectedClusters}
      />
      
      {/* Point labels (simplified for performance) */}
      {(selectedPoint || hoveredPoint) && (
        <PointLabels
          data={[...(selectedPoint ? [selectedPoint] : []), ...(hoveredPoint && hoveredPoint.id !== selectedPoint?.id ? [hoveredPoint] : [])]}
          hoveredPoint={hoveredPoint}
          selectedPoint={selectedPoint}
          closestPoints={closestPoints}
          selectedClosestPoints={selectedClosestPoints}
          selectedClusters={selectedClusters}
        />
      )}
      
      {/* Connection lines for selected point (simplified) */}
      {selectedPoint && selectedClosestPoints.length > 0 && (
        <ConnectionLines
          point={selectedPoint}
          closestPoints={selectedClosestPoints.slice(0, 3)} // Limit for performance
          isSelected={true}
        />
      )}
      
      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.05}
        onChange={onCameraChange}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        minDistance={2}
        maxDistance={100}
      />
    </>
  );
});

Scene.displayName = 'MonteCarloScene';