"use client";

import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from '@/components/ui/button';
import { Loader2, Focus } from 'lucide-react';
import { ModelLegend } from './ModelLegend';
import { Scene } from './scene/scene';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import type { MonteCarloCluster } from '@/lib/monte-carlo-service';

interface VisualizationCanvasProps {
  // Data and State Props for Scene
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

  // Camera and Controls Props
  cameraState: { position: [number, number, number]; target: [number, number, number]; };
  controlsRef: React.RefObject<any>;
  onCameraChange: () => void;
  isCameraMovingRef: React.RefObject<boolean>;

  // UI Overlay Props
  isLoading: boolean;
  showLoadingOverlay: boolean;
  selectedModelFilter: string | null;
  setSelectedModelFilter: (filter: string | null) => void;
  onFocusCamera: () => void;

  // Canvas Props
  dpr: number;
  invalidateRef: React.MutableRefObject<(() => void) | null>;
  canvasKey: string;
}

export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  // Scene Props
  data, clusters, hoveredPoint, setHoveredPoint, closestPoints, setClosestPoints,
  selectedPoint, setSelectedPoint, selectedClosestPoints, selectedClusters,
  toggleClusterSelection, selectedBatchId, filteredData,
  // Camera/Controls Props
  cameraState, controlsRef, onCameraChange, isCameraMovingRef,
  // UI Overlay Props
  isLoading, showLoadingOverlay, selectedModelFilter, setSelectedModelFilter, onFocusCamera,
  // Canvas Props
  dpr, invalidateRef, canvasKey,
}) => {
  const [canvasRendered, setCanvasRendered] = useState(false);
  
  // Force a remount of the Canvas component when selectedBatchId changes
  useEffect(() => {
    setCanvasRendered(false);
    const timer = setTimeout(() => {
      setCanvasRendered(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedBatchId]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="absolute inset-0 bg-white/80 flex justify-center items-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Controls positioned over the canvas */}
      <div className="absolute top-2 left-2 z-40 flex gap-2">
        {/* Focus button */}
        {(data.length > 0 || clusters.length > 0) && (
          <Button variant="outline" size="sm" onClick={onFocusCamera} title="Focus camera">
            <Focus className="h-3 w-3 mr-1" /> Focus
          </Button>
        )}
        {/* Show All button */}
        {selectedModelFilter && (
          <Button variant="outline" size="sm" onClick={() => setSelectedModelFilter(null)}>
            Show All Points
          </Button>
        )}
      </div>

      {/* Canvas */}
      {(data.length > 0 || (!isLoading && selectedBatchId)) && canvasRendered ? (
        <Canvas
          key={`monte-carlo-canvas-${canvasKey}`}
          className="absolute inset-0"
          camera={{ position: cameraState.position, fov: 75 }}
          frameloop="demand"
          gl={{
            powerPreference: "default",
            antialias: true,
            alpha: true,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: true,
          }}
          dpr={1} // Use lower DPR for better performance
          resize={{ scroll: false }}
          onCreated={({ invalidate }) => {
            invalidateRef.current = invalidate;
          }}
          style={{ background: "linear-gradient(to bottom, #f8fafc, #f1f5f9)" }}
        >
          <Scene
            data={data}
            clusters={clusters}
            hoveredPoint={hoveredPoint}
            setHoveredPoint={setHoveredPoint}
            closestPoints={closestPoints}
            setClosestPoints={setClosestPoints}
            selectedPoint={selectedPoint}
            setSelectedPoint={setSelectedPoint}
            selectedClosestPoints={selectedClosestPoints}
            selectedClusters={selectedClusters}
            toggleClusterSelection={toggleClusterSelection}
            selectedBatchId={selectedBatchId}
            filteredData={filteredData}
            cameraState={cameraState}
            controlsRef={controlsRef}
            onCameraChange={onCameraChange}
            isCameraMovingRef={isCameraMovingRef}
          />
        </Canvas>
      ) : (!selectedBatchId && !isLoading) ? (
        // Message when no batch is selected
        <div className="flex justify-center items-center h-full text-slate-500">
          Select a batch to view visualization.
        </div>
      ) : null /* Loading handled by overlay */}

      {/* Model Legend */}
      {(data.length > 0 || clusters.length > 0) && (
        <div className="absolute bottom-4 left-4 z-40">
          <ModelLegend
            selectedModelFilter={selectedModelFilter}
            onModelFilterChange={setSelectedModelFilter}
            data={data}
          />
        </div>
      )}
    </div>
  );
};