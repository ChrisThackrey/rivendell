"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import * as THREE from "three"; // Added import for THREE types used in focusCameraOnAllPoints
import { Button } from "@/components/ui/button";
import { Loader2, Focus } from "lucide-react";
import { cn } from "@/lib/utils"; // Keep cn if used elsewhere, otherwise remove
import { useMonteCarloData } from "./monte-carlo/hooks/use-monte-carlo-data";
import type { PointWithCluster } from "@/lib/monte-carlo-service";
import { BatchSelectionPanel } from "./monte-carlo/batch-selection-panel";
import { DetailsPanel } from "./monte-carlo/details-panel";
// ModelLegend import removed as it's inside VisualizationCanvas
import { VisualizationCanvas } from "./monte-carlo/visualization-canvas";
import { findClosestPoints, formatBatchId } from "./monte-carlo/utils"; // Import formatBatchId

// Define DEBUG based on environment variable
const DEBUG = process.env.NODE_ENV !== 'production';

// Removed definitions for:
// - Scene and its sub-components (Points, PointLabels, ClusterCubes, etc.)
// - ModelLegend, DetailCard
// - Helper functions moved to utils.ts (getModelColor, getSelectionColor, etc.)

// --- Main Visualizer Component ---
export default function MonteCarloVisualizer({
  initialBatchId,
}: {
  initialBatchId?: string | null;
}) {
  // Use the custom hook
  const {
    data, clusters, allBatchIds, selectedBatchId,
    isLoadingData, isFetchingBatches, error: dataError,
    setSelectedBatchId,
  } = useMonteCarloData({ initialBatchId });

  // --- UI Interaction State ---
  const [hoveredPoint, setHoveredPoint] = useState<PointWithCluster | null>(null);
  const [closestPoints, setClosestPoints] = useState<PointWithCluster[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PointWithCluster | null>(null);
  const [selectedClosestPoints, setSelectedClosestPoints] = useState<PointWithCluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [selectedClusterPoints, setSelectedClusterPoints] = useState<PointWithCluster[]>([]);
  const [filteredData, setFilteredData] = useState<PointWithCluster[]>([]);
  const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null);
  const [preventAutoDeselect, setPreventAutoDeselect] = useState(true);
  const [dpr, setDpr] = useState<number>(1);

  // --- Refs & Camera State ---
  const isCameraMovingRef = useRef<boolean>(false);
  const invalidateRef = useRef<(() => void) | null>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<{ position: [number, number, number]; target: [number, number, number] }>({
    position: [20, 20, 20], target: [0, 0, 0],
  });
  const [cameraState, setCameraState] = useState(cameraRef.current);
  const [lastCameraMovement, setLastCameraMovement] = useState(0);

  // Update DPR on mount
  useEffect(() => { setDpr(Math.min(2, window.devicePixelRatio)); }, []);

  // --- Interaction Handlers ---
  const isCameraMovingRecently = useCallback(() => Date.now() - lastCameraMovement < 500, [lastCameraMovement]);
  const handleDeselectAll = useCallback(() => { 
    setSelectedPoint(null); 
    setSelectedClusters([]);
    // Ensure we don't prevent selection after deselection
    setPreventAutoDeselect(false);
    // Force invalidate to ensure re-render
    if (invalidateRef.current) {
      invalidateRef.current();
    }
  }, []);
  const handleCameraChange = useCallback(() => {
      if (controlsRef.current) {
        const camera = controlsRef.current.object;
        const target = controlsRef.current.target;
        const newState = {
          position: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
          target: [target.x, target.y, target.z] as [number, number, number],
        };
        cameraRef.current = newState;
        setCameraState(newState);
        isCameraMovingRef.current = true;
        setLastCameraMovement(Date.now());
        setPreventAutoDeselect(true);
        if (invalidateRef.current) invalidateRef.current();
      }
  }, []);

  const focusCameraOnAllPoints = useCallback((points: PointWithCluster[], zoomFactor = 1) => {
       if (points.length === 0 || !controlsRef.current) return;
       const box = new THREE.Box3();
       points.forEach(p => box.expandByPoint(new THREE.Vector3(...p.position)));
       if (box.isEmpty()) return;
       const center = new THREE.Vector3(); box.getCenter(center);
       const size = new THREE.Vector3(); box.getSize(size);
       const maxDim = Math.max(size.x, size.y, size.z);
       const camera = controlsRef.current.object as THREE.PerspectiveCamera;
       const fitHeightDistance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
       const fitWidthDistance = fitHeightDistance / camera.aspect;
       let distance = Math.max(fitHeightDistance, fitWidthDistance);
       let marginFactor = 1.05 * zoomFactor;
       if (points.length <= 5) marginFactor = 1.2 * zoomFactor;
       else if (points.length <= 10) marginFactor = 1.15 * zoomFactor;
       else if (points.length <= 20) marginFactor = 1.1 * zoomFactor;
       const minDistance = (points.length <= 5 ? 8 : 20) / zoomFactor;
       distance = Math.max(distance * marginFactor, minDistance);
       const offset = new THREE.Vector3(0, 0, distance);
       if (points.length <= 10) {
           offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(15));
           offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(15));
       }
       const finalPosition = center.clone().add(offset);
       const cameraPosition: [number, number, number] = [finalPosition.x, finalPosition.y, finalPosition.z];
       const newTarget: [number, number, number] = [center.x, center.y, center.z];
       setCameraState({ position: cameraPosition, target: newTarget });
       controlsRef.current.target.set(...newTarget);
       controlsRef.current.update();
       setPreventAutoDeselect(true);
       setTimeout(() => { if (!selectedPoint && selectedClusters.length === 0) setPreventAutoDeselect(false); }, 2000);
  }, [controlsRef, setCameraState, setPreventAutoDeselect, selectedPoint, selectedClusters]);

  const handleSelectPoint = useCallback((point: PointWithCluster) => {
      setSelectedPoint(point);
      const closest = findClosestPoints(point, data, 4);
      setSelectedClosestPoints(closest);
      setSelectedClusters([]);
      const pointsToFocus = [point, ...closest];
      focusCameraOnAllPoints(pointsToFocus, 0.5);
   }, [data, focusCameraOnAllPoints]);

   const toggleClusterSelection = useCallback((clusterId: number) => {
      let nextSelectedPoint: PointWithCluster | null = selectedPoint;
      let nextSelectedClusters: number[] = [];
      
      setSelectedClusters((prev) => {
         const isSelected = prev.includes(clusterId);
         if (isSelected) { 
            // Deselecting cluster
            nextSelectedClusters = prev.filter((id) => id !== clusterId); 
            if (selectedPoint?.cluster === clusterId) nextSelectedPoint = null; 
         } else { 
            // Selecting cluster - keep previous cluster selections and add new one
            nextSelectedClusters = [...prev, clusterId]; 
            
            // Get all points in this cluster
            const clusterPoints = filteredData.filter(p => p.cluster === clusterId);
            
            // Optionally select a representative point from the cluster
            if (clusterPoints.length > 0 && (selectedPoint?.cluster !== clusterId)) {
               // Keep existing selected point if there is one, or select the first point in the cluster
               nextSelectedPoint = selectedPoint || clusterPoints[0];
            }
         }
         return nextSelectedClusters;
      });
      
      // Update selected point if changed
      if (nextSelectedPoint !== selectedPoint) {
         setSelectedPoint(nextSelectedPoint);
      }
      
      // Focus camera on all selected points after a short delay
      setTimeout(() => {
          if (nextSelectedClusters.length > 0) { 
             // Get all points in the selected clusters
             const points = filteredData.filter(p => p.cluster && nextSelectedClusters.includes(p.cluster));
             if (points.length > 0) {
                // Focus camera on all points in the selected clusters
                focusCameraOnAllPoints(points, 0.8);
                console.log(`Focusing camera on ${points.length} points in ${nextSelectedClusters.length} selected clusters`);
             }
          } else if (nextSelectedPoint) { 
             // If just a single point is selected, focus on it and its closest points
             const closest = findClosestPoints(nextSelectedPoint, filteredData, 4); 
             focusCameraOnAllPoints([nextSelectedPoint, ...closest], 0.5); 
          }
      }, 50);
   }, [filteredData, selectedPoint, focusCameraOnAllPoints, data, selectedClusters]);

  const handleFocusCamera = useCallback(() => {
      if (selectedPoint) { 
        // Add a small delay to ensure the camera position updates correctly
        setTimeout(() => {
          const pointsToFocus = [selectedPoint, ...selectedClosestPoints]; 
          focusCameraOnAllPoints(pointsToFocus, 0.5);
          console.log("Focusing on selected point and closest points:", pointsToFocus.length);
        }, 50);
      }
      else if (selectedClusterPoints.length > 0) { 
        setTimeout(() => {
          focusCameraOnAllPoints(selectedClusterPoints, 0.8);
          console.log("Focusing on selected cluster points:", selectedClusterPoints.length);
        }, 50);
      }
      else if (filteredData.length > 0) { 
        setTimeout(() => {
          focusCameraOnAllPoints(filteredData);
          console.log("Focusing on all filtered data points:", filteredData.length);
        }, 50);
      }
   }, [selectedPoint, selectedClosestPoints, selectedClusterPoints, filteredData, focusCameraOnAllPoints]);

  // --- Effects ---
  // Filter data based on selected model filter
  useEffect(() => {
    if (selectedModelFilter === null) {
      setFilteredData(data);
    } else {
      const filtered = data.filter((point) => {
        const modelLower = point.model.toLowerCase();
        if (selectedModelFilter === "gpt-4" && (modelLower.includes("gpt-4") || modelLower.includes("gpt4") || modelLower.includes("gpt-4o"))) return true;
        if (selectedModelFilter === "claude" && modelLower.includes("claude")) return true;
        if (selectedModelFilter === "o1" && modelLower.includes("o1") && !modelLower.includes("gpt")) return true;
        if (selectedModelFilter === "o3" && (modelLower.includes("o3") || modelLower.includes("o3-mini"))) return true;
        if (selectedModelFilter === "other" && !modelLower.includes("gpt") && !modelLower.includes("claude") && !modelLower.includes("o1") && !modelLower.includes("o3")) return true;
        return false;
      });
      setFilteredData(filtered);
      
      // When applying a model filter, focus the camera on the filtered points
      if (filtered.length > 0) {
        // Use a short delay to ensure the points are updated first
        setTimeout(() => {
          // Only focus if we're filtering to a smaller set than the full data
          if (filtered.length < data.length) {
            console.log(`Focusing camera on ${filtered.length} filtered points for model: ${selectedModelFilter}`);
            focusCameraOnAllPoints(filtered, 0.9);
          }
        }, 100);
      }
    }
  }, [selectedModelFilter, data, focusCameraOnAllPoints]);
  
  // Update closest points when selected point changes
  useEffect(() => {
    if (selectedPoint && data.length > 0) {
      const closest = findClosestPoints(selectedPoint, data, 4);
      setSelectedClosestPoints(closest);
    } else {
      setSelectedClosestPoints([]);
    }
  }, [selectedPoint, data]);
  
  // Update selected cluster points when selected clusters change
  useEffect(() => {
    if (selectedClusters.length > 0) {
      // Get all points that belong to any of the selected clusters
      const points = filteredData.filter(
        (point) => point.cluster !== undefined && selectedClusters.includes(point.cluster)
      );
      console.log(`Updated cluster points: ${points.length} points in ${selectedClusters.length} clusters`);
      setSelectedClusterPoints(points);
    } else {
      setSelectedClusterPoints([]);
    }
  }, [selectedClusters, filteredData]);
  
  // Handle camera movement state
  useEffect(() => {
    const interval = setInterval(() => {
      if (isCameraMovingRecently()) {
        // Camera is still moving
        isCameraMovingRef.current = true;
      } else if (isCameraMovingRef.current) {
        // Camera just stopped moving
        console.log("Camera movement stopped");
        isCameraMovingRef.current = false;
        
        // Force a render update
        if (invalidateRef.current) {
          invalidateRef.current();
        }
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isCameraMovingRecently, selectedPoint, selectedClusters]);
  // ESC key handler to deselect all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDeselectAll();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDeselectAll]);

  // --- Loading / Error / Empty States ---
  if (isLoadingData && data.length === 0 && allBatchIds === null) { return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
  if (dataError) { return <div className="text-red-500 p-4">Error: {dataError.message}</div>; }
  if (!isFetchingBatches && allBatchIds && allBatchIds.length === 0) { return <div className="p-4 text-center">No batches found.</div>; }

  // --- Render Logic ---
  const getSelectedClusterTitle = (): string => {
      if (selectedClusters.length === 1) { const cluster = clusters.find(c => c.id === selectedClusters[0]); return cluster?.label || `Cluster ${selectedClusters[0]}`; }
      return selectedClusters.length > 1 ? "Multiple Clusters" : "";
  };
  const showLoadingOverlay = isLoadingData && data.length === 0 && !!selectedBatchId;

  return (
    <div className="grid grid-cols-12 gap-2 h-[calc(100vh-150px)]">

      {/* Batch Selection Panel */}
      <BatchSelectionPanel
        allBatchIds={allBatchIds}
        selectedBatchId={selectedBatchId}
        onBatchChange={setSelectedBatchId}
        isLoadingData={isLoadingData}
        isFetchingBatches={isFetchingBatches}
      />

      {/* Visualization Canvas Panel */}
      <div className="col-span-12 md:col-span-9 lg:col-span-7 bg-white rounded-lg shadow-md overflow-hidden h-full relative">
         {/* Header */}
          <div className="p-3 bg-slate-50 border-b flex items-center justify-between text-sm">
             <h3 className="font-medium text-slate-700 truncate">
                Monte Carlo Visualization
                {selectedBatchId && <span className="text-slate-500 ml-2">• {formatBatchId(selectedBatchId)}</span>} {/* Use imported helper */}
                <span className="text-slate-500 ml-2">• {filteredData.length} points</span>
                {selectedModelFilter && <span className="ml-2 inline-flex items-center bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded">Filtered</span>}
             </h3>
             {(selectedPoint || selectedClusters.length > 0) && (
                <Button variant="outline" size="sm" onClick={handleDeselectAll} className="ml-auto"> Deselect All </Button>
             )}
          </div>
         {/* Use VisualizationCanvas Component */}
         <VisualizationCanvas
            // Pass all required props
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
            onCameraChange={handleCameraChange}
            isCameraMovingRef={isCameraMovingRef}
            isLoading={isLoadingData}
            showLoadingOverlay={showLoadingOverlay}
            selectedModelFilter={selectedModelFilter}
            setSelectedModelFilter={setSelectedModelFilter}
            onFocusCamera={handleFocusCamera}
            dpr={dpr}
            invalidateRef={invalidateRef}
            canvasKey={selectedBatchId || 'no-batch'}
         />
      </div>

      {/* Details Panel */}
      <DetailsPanel
        selectedPoint={selectedPoint}
        hoveredPoint={hoveredPoint}
        selectedClosestPoints={selectedClosestPoints}
        closestPoints={closestPoints}
        selectedClusterPoints={selectedClusterPoints}
        selectedClusters={selectedClusters}
        getSelectedClusterTitle={getSelectedClusterTitle}
        onSelectPoint={handleSelectPoint}
      />
    </div>
  );
}
