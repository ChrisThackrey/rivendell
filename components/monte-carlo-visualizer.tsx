"use client";

import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html, Box, Edges } from "@react-three/drei";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Thermometer,
  Flame,
  Snowflake,
  CheckCircle2,
  Circle,
  Loader2,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MonteCarloDataPoint,
  MonteCarloCluster,
  fetchMonteCarloData,
  generateClusters,
  generateClusterTitles,
  fetchAvailableBatchIds,
  fetchMonteCarloDataForBatch,
} from "@/lib/monte-carlo-service";
// Define DEBUG based on environment variable
const DEBUG = process.env.NODE_ENV !== 'production';

// Get color for a model (point colors)
const getModelColor = (model: string): THREE.Color => {
  // Normalize model name to lowercase and trim whitespace
  const modelLower = model.toLowerCase().trim();

  // Use even brighter, more vibrant colors for better visibility
  if (
    modelLower.includes("gpt-4o") ||
    modelLower.includes("gpt4o") ||
    modelLower.includes("gpt-4")
  ) {
    // Brighter blue for GPT-4o
    return new THREE.Color("#3b82f6"); // blue-500
  }
  if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
    // Brighter violet for Claude
    return new THREE.Color("#8b5cf6"); // violet-500
  }
  if (modelLower.includes("o1")) {
    // Brighter green for o1
    return new THREE.Color("#10b981"); // emerald-500
  }
  if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
    // Brighter amber for o3-mini
    return new THREE.Color("#f59e0b"); // amber-500
  }
  // Light slate for default
  return new THREE.Color("#94a3b8"); // slate-400 - slightly brighter
};

// Get hex color string for selection and lines
const getSelectionColor = (
  type: "point" | "cluster" | "hover" = "cluster",
  isClusterSelected = false,
): string => {
  if (type === "point") return "#f97316"; // Orange for selected points (changed from #d946ef)
  if (type === "hover") return "#f97316"; // Bright orange for hover state
  return "#4ade80"; // Brighter green for clusters
};

// Check if a point is in a selected cluster
const isPointInSelectedCluster = (
  point: MonteCarloDataPoint,
  selectedClusters: number[],
): boolean => {
  return selectedClusters.includes(point.cluster || 0);
};

// We now include cluster in MonteCarloDataPoint, but keeping this type alias for backwards compatibility
type PointWithCluster = MonteCarloDataPoint;

// Type for point detection results
interface PointDetectionResult {
  index: number;
  distance: number;
}

// Dynamic axis labels that follow the camera
function DynamicAxisLabels() {
  const [labels, setLabels] = useState({
    x: { position: [11, 0, 0] as [number, number, number], visible: true },
    y: { position: [0, 11, 0] as [number, number, number], visible: true },
    z: { position: [0, 0, 11] as [number, number, number], visible: true },
  });

  useFrame(({ camera }) => {
    // Get camera position in spherical coordinates
    const cameraPosition = new THREE.Vector3().copy(camera.position);
    const spherical = new THREE.Spherical().setFromVector3(cameraPosition);

    // Determine which planes are facing the camera
    const phi = spherical.phi; // vertical angle
    const theta = spherical.theta; // horizontal angle

    // Calculate positions for labels based on camera angle
    // This ensures labels are always on the visible side of the axis
    const xSign = Math.sin(theta) > 0 ? 1 : -1;
    const ySign = Math.cos(phi) < 0 ? 1 : -1;
    const zSign = Math.cos(theta) > 0 ? 1 : -1;

    // Position labels at the ends of the axes but slightly offset for better visibility
    // Using smaller values to match our new 6-unit axis scale
    setLabels({
      x: {
        position: [7 * xSign, 0.5, 0.5] as [number, number, number],
        visible: true,
      },
      y: {
        position: [0.5, 7 * ySign, 0.5] as [number, number, number],
        visible: true,
      },
      z: {
        position: [0.5, 0.5, 7 * zSign] as [number, number, number],
        visible: true,
      },
    });
  });

  return (
    <>
      <Text
        position={labels.x.position}
        color="black"
        fontSize={1.5}
        fontWeight="bold"
        anchorX={labels.x.position[0] > 0 ? "left" : "right"}
        renderOrder={1000}
      >
        X: Complexity
      </Text>
      <Text
        position={labels.y.position}
        color="black"
        fontSize={1.5}
        fontWeight="bold"
        anchorY={labels.y.position[1] > 0 ? "top" : "bottom"}
        renderOrder={1000}
      >
        Y: Performance
      </Text>
      <Text
        position={labels.z.position}
        color="black"
        fontSize={1.5}
        fontWeight="bold"
        anchorX={labels.z.position[2] > 0 ? "left" : "right"}
        renderOrder={1000}
      >
        Z: Memory Usage
      </Text>
    </>
  );
}

// Updated component for point labels
function PointLabels({
  data,
  hoveredPoint,
  selectedPoint,
  closestPoints,
  selectedClosestPoints,
  selectedClusters,
}: {
  data: PointWithCluster[];
  hoveredPoint: PointWithCluster | null;
  selectedPoint: PointWithCluster | null;
  closestPoints: PointWithCluster[];
  selectedClosestPoints: PointWithCluster[];
  selectedClusters: number[];
}) {
  // Determine which points should have visible labels
  const visibleLabelPoints = useMemo(() => {
    const pointsToShow = new Set<string>();

    // Add hovered point and its closest points
    if (hoveredPoint) {
      pointsToShow.add(hoveredPoint.id);
      closestPoints.forEach((point) => pointsToShow.add(point.id));
    }

    // Add selected point and its closest points
    if (selectedPoint) {
      pointsToShow.add(selectedPoint.id);
      selectedClosestPoints.forEach((point) => pointsToShow.add(point.id));
    }

    // Add points for any selected clusters (for better visualization) - limit to 10 to avoid crowding
    if (selectedClusters.length > 0) {
      const clusterPoints = data
        .filter((p) => p.cluster && selectedClusters.includes(p.cluster))
        .slice(0, 10);

      clusterPoints.forEach((point) => pointsToShow.add(point.id));
    }

    return pointsToShow;
  }, [
    hoveredPoint,
    selectedPoint,
    closestPoints,
    selectedClosestPoints,
    selectedClusters,
    data,
  ]);

  // Check if any clusters are selected
  const hasSelectedClusters = selectedClusters.length > 0;

  return (
    <>
      {data.map((point) => {
        // Only render labels for visible points
        if (!visibleLabelPoints.has(point.id)) return null;

        const isSelected = selectedPoint && selectedPoint.id === point.id;
        const isHovered = hoveredPoint && hoveredPoint.id === point.id;
        const isInSelectedCluster = isPointInSelectedCluster(
          point,
          selectedClusters,
        );

        // Determine label color based on state
        let bgColor = "bg-white/90";
        let textColor = "text-slate-800";

        if (isSelected) {
          // Selected point is always fuchsia
          bgColor = "bg-fuchsia-500/90";
          textColor = "text-white font-medium";
        } else if (isHovered) {
          // Hovered point is fuchsia if clusters are selected, otherwise green
          bgColor = hasSelectedClusters
            ? "bg-fuchsia-500/90"
            : "bg-green-300/90";
          textColor = "text-white font-medium";
        } else if (isInSelectedCluster) {
          // Points in selected clusters are green
          bgColor = "bg-green-300/90";
          textColor = "text-white";
        }

        return (
          <Html
            key={`label-${point.id}`}
            position={[
              point.position[0],
              point.position[1] + 0.4,
              point.position[2],
            ]}
            distanceFactor={10}
            occlude
            renderOrder={1000}
          >
            <div
              className={`flex flex-col items-center px-3 py-1.5 rounded-md shadow-md whitespace-nowrap text-center ${bgColor} ${textColor} border border-gray-200`}
              style={{ backdropFilter: "blur(4px)" }}
            >
              <div className="text-sm font-medium">{point.model}</div>
              <div className="text-xs">Run {point.runId}</div>
              {point.batchId && (
                <div className="text-xs opacity-70">
                  {formatBatchId(point.batchId)}
                </div>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

// Component for the 3D points
function Points({
  data,
  hoveredPoint,
  setHoveredPoint,
  setClosestPoints,
  selectedPoint,
  setSelectedPoint,
  selectedClusters,
  setSelectedClusters,
  isCameraMovingRef,
  isCameraMovingRecently,
  preventAutoDeselect,
  filteredData,
}: {
  data: PointWithCluster[];
  hoveredPoint: PointWithCluster | null;
  setHoveredPoint: (point: PointWithCluster | null) => void;
  closestPoints: PointWithCluster[];
  setClosestPoints: (points: PointWithCluster[]) => void;
  selectedPoint: PointWithCluster | null;
  setSelectedPoint: (point: PointWithCluster | null) => void;
  selectedClusters: number[];
  setSelectedClusters: React.Dispatch<React.SetStateAction<number[]>>;
  isCameraMovingRef: React.RefObject<boolean>;
  isCameraMovingRecently: () => boolean;
  preventAutoDeselect: boolean;
  filteredData: PointWithCluster[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const selectionRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, mouse, gl } = useThree();

  // Create a temporary object for raycasting and positioning
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  // Create refs for cluster point highlights
  const clusterHighlightRefs = useRef<THREE.Mesh[]>([]);

  // Set up instanced mesh
  useEffect(() => {
    if (!meshRef.current) return;

    // Use the tempObject safely
    const localTempObj = tempObject;

    // Position each instance
    data.forEach((point, i) => {
      // Only mutate the temporary object, not meshRef directly during iteration
      localTempObj.position.set(...point.position);
      localTempObj.updateMatrix();
      meshRef.current?.setMatrixAt(i, localTempObj.matrix);

      // Set color based on model - brighter version without material effects
      const color = getModelColor(point.model);
      meshRef.current?.setColorAt(i, color);
    });

    // Update the instance matrix once after all iterations
    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
      meshRef.current.renderOrder = 10;
    }
  }, [data]);

  // Add a new effect to update hover and selection state colors
  useEffect(() => {
    if (!meshRef.current || !meshRef.current.instanceColor) return;

    // Create a temporary color for manipulation
    const tempColor = new THREE.Color();

    // Reset all colors first
    data.forEach((point, i) => {
      const baseColor = getModelColor(point.model);
      if (meshRef.current?.instanceColor) {
        meshRef.current.setColorAt(i, baseColor);
      }
    });

    // Apply selection color to the selected point and its closest points
    if (selectedPoint) {
      // Find and color the selected point
      const selectedIndex = data.findIndex((p) => p.id === selectedPoint.id);
      if (selectedIndex !== -1 && meshRef.current) {
        // Selected point gets orange color
        tempColor.set("#f97316"); // orange-500
        meshRef.current.setColorAt(selectedIndex, tempColor);

        // Find the proximal points to the selected point
        const closestToSelected: PointWithCluster[] = findClosestPoints(
          selectedPoint,
          data,
          4,
        );

        // Color the proximal points also with orange (selected color)
        closestToSelected.forEach((closePoint) => {
          const closePointIndex = data.findIndex((p) => p.id === closePoint.id);
          if (closePointIndex !== -1 && meshRef.current) {
            tempColor.set("#f97316"); // orange-500
            meshRef.current.setColorAt(closePointIndex, tempColor);
          }
        });
      }
    }

    // Apply hover color if different from selected point and its proximal points
    if (hoveredPoint) {
      // Type the closest points to selected properly
      const closestToSelected: PointWithCluster[] = selectedPoint
        ? findClosestPoints(selectedPoint, data, 4)
        : [];

      const isSelectedOrProximalToSelected =
        (selectedPoint && hoveredPoint.id === selectedPoint.id) ||
        (selectedPoint &&
          closestToSelected.some((p) => p.id === hoveredPoint.id));

      if (!isSelectedOrProximalToSelected) {
        const hoverIndex = data.findIndex((p) => p.id === hoveredPoint.id);
        if (hoverIndex !== -1 && meshRef.current) {
          // Use orange for hover state
          tempColor.set("#f97316"); // orange-500
          meshRef.current.setColorAt(hoverIndex, tempColor);

          // Also color the proximal points to the hovered point
          const closestToHovered: PointWithCluster[] = findClosestPoints(
            hoveredPoint,
            data,
            4,
          );
          closestToHovered.forEach((closePoint) => {
            const closePointIndex = data.findIndex(
              (p) => p.id === closePoint.id,
            );
            if (closePointIndex !== -1 && meshRef.current) {
              tempColor.set("#f97316"); // orange-500
              meshRef.current.setColorAt(closePointIndex, tempColor);
            }
          });
        }
      }
    }

    // Also highlight points in selected clusters
    if (selectedClusters.length > 0) {
      data.forEach((point, i) => {
        // Type the closest points properly
        const closestToSelected: PointWithCluster[] = selectedPoint
          ? findClosestPoints(selectedPoint, data, 4)
          : [];
        const closestToHovered: PointWithCluster[] = hoveredPoint
          ? findClosestPoints(hoveredPoint, data, 4)
          : [];

        // Skip if already selected or one of its proximal points, or if hovered
        const isSelectedOrProximal =
          (selectedPoint &&
            (point.id === selectedPoint.id ||
              closestToSelected.some((p) => p.id === point.id))) ||
          (hoveredPoint &&
            (point.id === hoveredPoint.id ||
              closestToHovered.some((p) => p.id === point.id)));

        if (isSelectedOrProximal) {
          return;
        }

        // Apply cluster selection highlight
        if (
          point.cluster &&
          selectedClusters.includes(point.cluster) &&
          meshRef.current
        ) {
          // Use a bright green for points in selected clusters
          tempColor.set("#4ade80");
          meshRef.current.setColorAt(i, tempColor);
        }
      });
    }

    // Update the instance colors
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [data, hoveredPoint, selectedPoint, selectedClusters]);

  // Update highlight sphere position
  useEffect(() => {
    if (highlightRef.current && hoveredPoint) {
      highlightRef.current.position.set(...hoveredPoint.position);
      highlightRef.current.visible = true;
      highlightRef.current.renderOrder = 11;

      // Use orange for hover state
      if (highlightRef.current.material instanceof THREE.MeshBasicMaterial) {
        highlightRef.current.material.color = new THREE.Color("#f97316"); // orange-500
        highlightRef.current.material.opacity = 1.0;
      }
    } else if (highlightRef.current) {
      highlightRef.current.visible = false;
    }
  }, [hoveredPoint, selectedClusters]);

  // Update selection sphere position
  useEffect(() => {
    if (selectionRef.current && selectedPoint) {
      selectionRef.current.position.set(...selectedPoint.position);
      selectionRef.current.visible = true;
      selectionRef.current.renderOrder = 12;

      // Use orange for selected point
      if (selectionRef.current.material instanceof THREE.MeshBasicMaterial) {
        selectionRef.current.material.color = new THREE.Color("#f97316"); // orange-500
      }
    } else if (selectionRef.current) {
      selectionRef.current.visible = false;
    }
  }, [selectedPoint]);

  // Create and update highlight spheres for all points in selected clusters
  useEffect(() => {
    // Create shared geometry and material to reduce memory usage
    const geometry = new THREE.SphereGeometry(0.25, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: "#4ade80", // Bright green for clusters (matching the legend)
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });

    // Clear previous cluster highlight meshes
    clusterHighlightRefs.current.forEach((mesh) => {
      if (mesh && mesh.parent) {
        mesh.parent.remove(mesh);
        // Dispose of individual geometries/materials only if not using shared ones
        // (We're using shared ones now, so no need to dispose here)
      }
    });
    clusterHighlightRefs.current = [];

    if (selectedClusters.length === 0) return;

    // Create highlight meshes for all points in selected clusters
    const clusterPoints = data.filter(
      (point) => point.cluster && selectedClusters.includes(point.cluster),
    );

    clusterPoints.forEach((point) => {
      // Skip if this is the currently selected point (to avoid double highlighting)
      if (selectedPoint && point.id === selectedPoint.id) return;

      // Reuse geometry and material for all meshes
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...point.position);
      mesh.renderOrder = 11;

      if (meshRef.current && meshRef.current.parent) {
        meshRef.current.parent.add(mesh);
        clusterHighlightRefs.current.push(mesh);
      }
    });

    return () => {
      // Clean up meshes
      clusterHighlightRefs.current.forEach((mesh) => {
        if (mesh && mesh.parent) {
          mesh.parent.remove(mesh);
        }
      });

      // Dispose of shared resources on unmount
      geometry.dispose();
      material.dispose();
    };
  }, [selectedClusters, data, selectedPoint]);

  // Add the useFrame function for hover detection
  useFrame(() => {
    if (!meshRef.current) return;

    // Update raycaster with current mouse position
    raycaster.params.Points.threshold = 0.8; // Increased threshold
    raycaster.setFromCamera(mouse, camera);

    // First try standard raycasting
    const intersects = raycaster.intersectObject(meshRef.current, true);

    let foundPoint = false;

    if (intersects.length > 0) {
      // Get the index of the intersected instance
      const instanceId = intersects[0].instanceId;

      if (instanceId !== undefined && instanceId < data.length) {
        const hoveredData = data[instanceId];

        // Only update if it's a different point
        if (!hoveredPoint || hoveredPoint.id !== hoveredData.id) {
          setHoveredPoint(hoveredData);

          // Find 4 closest points
          const closest = findClosestPoints(hoveredData, data, 4);
          setClosestPoints(closest);
        }

        foundPoint = true;
      }
    }

    // If standard raycasting didn't find a point, try direct detection
    if (!foundPoint) {
      // Create direct array of point positions for detection
      const pointPositions: THREE.Vector3[] = [];
      const pointIndices: number[] = [];

      // Store a temporary object to avoid creating new ones
      const tempPosition = new THREE.Vector3();
      const tempMatrix = new THREE.Matrix4();

      // Extract all point positions directly from the instanced mesh
      if (meshRef.current) {
        for (let i = 0; i < data.length; i++) {
          meshRef.current.getMatrixAt(i, tempMatrix);
          tempPosition.setFromMatrixPosition(tempMatrix);

          // Store the position and index
          pointPositions.push(tempPosition.clone());
          pointIndices.push(i);
        }
      }

      // Find closest point by direct calculation (ignoring occlusion)
      let closestPoint: PointDetectionResult | null = null;
      const ray = raycaster.ray;

      pointPositions.forEach((position, arrayIndex) => {
        const dataIndex = pointIndices[arrayIndex];

        // Skip points outside the filtered data if filtering is active
        if (
          filteredData.length !== data.length &&
          !filteredData.some((p) => p.id === data[dataIndex].id)
        ) {
          return;
        }

        // Calculate closest point on ray to position (ignoring occlusion)
        const closestPointOnRay = new THREE.Vector3();
        ray.closestPointToPoint(position, closestPointOnRay);
        const distance = position.distanceTo(closestPointOnRay);

        // Consider as a hit if within threshold (0.6 units)
        if (distance < 0.6) {
          if (!closestPoint || distance < closestPoint.distance) {
            closestPoint = { index: dataIndex, distance };
          }
        }
      });

      // Hover on the closest point if found
      if (closestPoint) {
        const typedPoint = closestPoint as PointDetectionResult;
        const pointToHover = data[typedPoint.index];

        // Only update if it's a different point
        if (!hoveredPoint || hoveredPoint.id !== pointToHover.id) {
          setHoveredPoint(pointToHover);

          // Find 4 closest points
          const closest = findClosestPoints(pointToHover, data, 4);
          setClosestPoints(closest);
        }

        foundPoint = true;
      }
    }

    // Clear hover state when not hovering any point
    if (!foundPoint && hoveredPoint) {
      setHoveredPoint(null);
      setClosestPoints([]);
    }
  });

  // Fix handlePointClick function to handle the undefined index properly
  const handlePointClick = useCallback(
    (event: any) => {
      // Stop event propagation to prevent canvas click handler from triggering
      event.stopPropagation();

      console.log("Point click detected");

      if (hoveredPoint) {
        console.log("Using hover point for selection:", hoveredPoint.id);
        // Update selected point only when we have a valid hover point
        setSelectedPoint(hoveredPoint);
      } else {
        console.log("No hover point, using custom raycast detection");

        // Create a new raycaster for this specific detection
        const pointRaycaster = new THREE.Raycaster();
        pointRaycaster.params.Points.threshold = 0.8; // Increased threshold for easier selection
        pointRaycaster.setFromCamera(mouse, camera);

        // Create direct array of point positions for detection
        const pointPositions: THREE.Vector3[] = [];
        const pointIndices: number[] = [];

        // Store a temporary object to avoid creating new ones
        const tempPosition = new THREE.Vector3();
        const tempMatrix = new THREE.Matrix4();

        // Extract all point positions directly from the instanced mesh
        if (meshRef.current) {
          for (let i = 0; i < data.length; i++) {
            meshRef.current.getMatrixAt(i, tempMatrix);
            tempPosition.setFromMatrixPosition(tempMatrix);

            // Store the position and index
            pointPositions.push(tempPosition.clone());
            pointIndices.push(i);
          }
        }

        // Find closest point by direct calculation (ignoring occlusion)
        let closestPoint: PointDetectionResult | null = null;
        const ray = pointRaycaster.ray;

        pointPositions.forEach((position, arrayIndex) => {
          const dataIndex = pointIndices[arrayIndex];

          // Skip points outside the filtered data if filtering is active
          if (
            filteredData.length !== data.length &&
            !filteredData.some((p) => p.id === data[dataIndex].id)
          ) {
            return;
          }

          // Calculate closest point on ray to position (ignoring occlusion)
          const closestPointOnRay = new THREE.Vector3();
          ray.closestPointToPoint(position, closestPointOnRay);
          const distance = position.distanceTo(closestPointOnRay);

          // Consider as a hit if within threshold (0.8 units)
          if (distance < 0.8) {
            if (!closestPoint || distance < closestPoint.distance) {
              closestPoint = { index: dataIndex, distance };
            }
          }
        });

        // Select the closest point if found
        if (closestPoint) {
          const typedPoint = closestPoint as PointDetectionResult;
          const pointToSelect = data[typedPoint.index];
          console.log(
            "Selected point via custom detection:",
            pointToSelect.id,
            "distance:",
            typedPoint.distance,
          );
          setSelectedPoint(pointToSelect);
        } else {
          console.log("No point found via custom detection");

          // Fallback to regular raycasting as a last resort
          const intersects = raycaster.intersectObject(meshRef.current!, true);
          if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const pointIndex = intersects[0].instanceId;
            if (pointIndex < data.length) {
              const clickedPoint = data[pointIndex];
              console.log(
                "Selected point via fallback raycast:",
                clickedPoint.id,
              );
              setSelectedPoint(clickedPoint);
            }
          }
        }
      }
    },
    [
      hoveredPoint,
      setSelectedPoint,
      raycaster,
      mouse,
      camera,
      data,
      filteredData,
    ],
  );

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        onClick={handlePointClick}
        renderOrder={2000}
      >
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial
          transparent={true}
          alphaTest={0.01}
          depthWrite={true}
          depthTest={true}
        />
      </instancedMesh>

      {/* Highlight sphere for hovered point */}
      <mesh ref={highlightRef} visible={false} renderOrder={101}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshBasicMaterial color="#f97316" transparent={true} opacity={0.6} />
      </mesh>

      {/* Selection sphere for selected point */}
      <mesh ref={selectionRef} visible={false} renderOrder={102}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial
          color="#f97316"
          wireframe={true}
          transparent={true}
          opacity={1}
        />
      </mesh>
    </>
  );
}

// Component for connection lines
function ConnectionLines({
  point,
  closestPoints,
  isSelected = false,
  selectedClusters = [],
}: {
  point: PointWithCluster | null;
  closestPoints: PointWithCluster[];
  isSelected?: boolean;
  selectedClusters?: number[];
}) {
  if (!point || closestPoints.length === 0) return null;

  // All connections are orange now, regardless of type
  const lineColor = "#f97316"; // orange-500
  const lineWidth = isSelected ? 3 : 2;
  const opacity = isSelected ? 1 : 0.7;

  return (
    <>
      {closestPoints.map((closePoint) => (
        <Line
          key={`line-${point.id}-${closePoint.id}-${isSelected ? "selected" : "hover"}`}
          points={[point.position, closePoint.position]}
          color={lineColor}
          lineWidth={lineWidth}
          transparent
          opacity={opacity}
          renderOrder={20}
        />
      ))}
    </>
  );
}

// Component for cluster cubes
function ClusterCubes({
  clusters,
  toggleClusterSelection,
  selectedClusters,
  filteredData, // Add filtered data to determine which clusters to show
  selectedBatchId, // Add batch ID to filter clusters
}: {
  clusters: MonteCarloCluster[];
  toggleClusterSelection: (clusterId: number) => void;
  selectedClusters: number[];
  filteredData: MonteCarloDataPoint[];
  selectedBatchId: string | null;
}) {
  // Filter clusters that should be visible based on the current batch selection
  const visibleClusters = useMemo(() => {
    // Always show all clusters regardless of batch selection for better visualization
    return clusters;
  }, [clusters]);

  // Function to create cube edges as explicit line segments
  const createCubeEdges = useCallback(
    (size: [number, number, number], isSelected: boolean) => {
      const halfWidth = size[0] / 2;
      const halfHeight = size[1] / 2;
      const halfDepth = size[2] / 2;

      // Define the 8 corners of the cube
      const corners = [
        [-halfWidth, -halfHeight, -halfDepth], // 0: bottom-left-back
        [halfWidth, -halfHeight, -halfDepth], // 1: bottom-right-back
        [halfWidth, -halfHeight, halfDepth], // 2: bottom-right-front
        [-halfWidth, -halfHeight, halfDepth], // 3: bottom-left-front
        [-halfWidth, halfHeight, -halfDepth], // 4: top-left-back
        [halfWidth, halfHeight, -halfDepth], // 5: top-right-back
        [halfWidth, halfHeight, halfDepth], // 6: top-right-front
        [-halfWidth, halfHeight, halfDepth], // 7: top-left-front
      ];

      // Define the 12 edges of the cube as pairs of corner indices
      const edges = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0], // bottom edges
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4], // top edges
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7], // vertical edges
      ];

      // Return the points for all edges
      return edges.map(([a, b]) => ({
        points: [corners[a], corners[b]],
        color: isSelected ? "#4ade80" : "#d1d5db", // bright green for selected, light gray for unselected
        lineWidth: isSelected ? 3 : 2,
      }));
    },
    [],
  );

  return (
    <>
      {visibleClusters.map((cluster) => (
        <group key={`cluster-${cluster.id}`} position={cluster.position}>
          {/* Add cluster label above the cube */}
          <group
            position={[0, cluster.size[1] / 2 + 0.8, 0]}
            onClick={() => toggleClusterSelection(cluster.id)}
          >
            {/* Wider white background for label */}
            <mesh position={[0, 0, 0]} renderOrder={500}>
              <planeGeometry args={[cluster.label ? 14 : 7, 1.1]} />
              <meshBasicMaterial
                color={
                  selectedClusters.includes(cluster.id) ? "#4ade80" : "#ffffff"
                }
                opacity={0.9}
                transparent={true}
              />
            </mesh>

            {/* Label text - centered in background */}
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.45}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              renderOrder={1000}
            >
              {cluster.label || `Cluster ${cluster.id}`}
            </Text>
          </group>

          {/* Draw explicit line segments for cube edges - with disabled raycasting */}
          {createCubeEdges(
            cluster.size,
            selectedClusters.includes(cluster.id),
          ).map((edge, i) => (
            <Line
              key={`edge-${i}`}
              points={edge.points as [number, number, number][]}
              color={edge.color}
              lineWidth={edge.lineWidth}
              renderOrder={600}
              raycast={() => false} // Disable raycasting for edges
            />
          ))}

          {/* Invisible box for proper sizing - no click handler */}
          <Box
            args={cluster.size}
            visible={false}
            raycast={() => false} // Disable raycasting for box
          >
            <meshBasicMaterial
              visible={false}
              transparent={true}
              opacity={0}
              depthWrite={false} // Don't write to depth buffer
              depthTest={false} // Don't test against depth buffer
            />
          </Box>
        </group>
      ))}
    </>
  );
}

// Helper function to find closest points
function findClosestPoints(
  point: PointWithCluster,
  allPoints: PointWithCluster[],
  count: number,
): PointWithCluster[] {
  return allPoints
    .filter((p) => p.id !== point.id) // Exclude the point itself
    .map((p) => {
      // Calculate Euclidean distance in 3D space
      const dx = point.position[0] - p.position[0];
      const dy = point.position[1] - p.position[1];
      const dz = point.position[2] - p.position[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      return { point: p, distance };
    })
    .sort((a, b) => a.distance - b.distance) // Sort by distance
    .slice(0, count) // Take only the closest 'count' points
    .map((item) => item.point); // Extract just the point data
}

// Get model color for cards and badges
const getModelCardColor = (model: string) => {
  if (model.includes("GPT")) return "bg-blue-100 text-blue-500 border-blue-200";
  if (model.includes("Claude"))
    return "bg-violet-100 text-violet-500 border-violet-200";
  if (model.includes("o1"))
    return "bg-green-100 text-green-500 border-green-200";
  if (model.includes("o3"))
    return "bg-amber-100 text-amber-500 border-amber-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
};

// Model legend component to display model colors
function ModelLegend({
  selectedModelFilter,
  onModelFilterChange,
  data,
}: {
  selectedModelFilter: string | null;
  onModelFilterChange: (model: string | null) => void;
  data: PointWithCluster[];
}) {
  // These colors must match exactly with getModelColor function
  const modelColors = [
    { color: "#93c5fd", label: "GPT-4o", value: "gpt-4" }, // blue-300
    { color: "#c4b5fd", label: "Claude", value: "claude" }, // violet-300
    { color: "#86efac", label: "o1", value: "o1" }, // green-300
    { color: "#fcd34d", label: "o3-mini", value: "o3" }, // amber-300
    { color: "#cbd5e1", label: "Other", value: "other" }, // slate-300
  ];

  const interactionColors = [
    { color: "#f97316", label: "User Selection" }, // orange-500 (changed from fuchsia)
    { color: "#4ade80", label: "Cluster Selection" }, // green-400
  ];

  // Calculate counts for each model type
  const modelCounts = useMemo(() => {
    const counts = {
      "gpt-4": 0,
      claude: 0,
      o1: 0,
      o3: 0,
      other: 0,
    };

    data.forEach((point) => {
      const modelLower = point.model.toLowerCase();

      if (
        modelLower.includes("gpt-4") ||
        modelLower.includes("gpt4") ||
        modelLower.includes("gpt-4o")
      ) {
        counts["gpt-4"]++;
      } else if (modelLower.includes("claude")) {
        counts["claude"]++;
      } else if (modelLower.includes("o1") && !modelLower.includes("gpt")) {
        counts["o1"]++;
      } else if (modelLower.includes("o3") || modelLower.includes("o3-mini")) {
        counts["o3"]++;
      } else {
        counts["other"]++;
      }
    });

    return counts;
  }, [data]);

  return (
    <div className="bg-white p-3 rounded-md shadow-md border border-gray-200 z-10">
      <div className="text-xs font-medium mb-2 text-slate-700">
        Model Colors
      </div>
      <div className="flex flex-col gap-1.5">
        {modelColors.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-50 ${selectedModelFilter === item.value ? "bg-slate-100 font-medium" : ""}`}
            onClick={() =>
              onModelFilterChange(
                selectedModelFilter === item.value ? null : item.value,
              )
            }
            tabIndex={0}
            role="button"
            aria-pressed={selectedModelFilter === item.value}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onModelFilterChange(
                  selectedModelFilter === item.value ? null : item.value,
                );
              }
            }}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-900">{item.label}</span>
            <span className="text-slate-500 text-xs ml-auto mr-1">
              ({modelCounts[item.value as keyof typeof modelCounts]})
            </span>
            {selectedModelFilter === item.value && (
              <div className="ml-0">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 my-2" />

      <div className="text-xs font-medium mb-2 text-slate-700">
        Interactions
      </div>
      <div className="flex flex-col gap-1.5">
        {interactionColors.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-900">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Detail card component
function DetailCard({
  point,
  isMain = false,
  onSelect,
}: {
  point: PointWithCluster;
  isMain?: boolean;
  onSelect: (point: PointWithCluster) => void;
}) {
  const getTemperatureIcon = (temp: number) => {
    if (temp <= 0.3)
      return <Snowflake className="h-3.5 w-3.5 text-slate-600" />;
    if (temp <= 0.5)
      return <Thermometer className="h-3.5 w-3.5 text-amber-500" />;
    return <Flame className="h-3.5 w-3.5 text-red-500" />;
  };

  const getTemperatureText = (temp: number) => {
    if (temp <= 0.3) return "Low";
    if (temp <= 0.5) return "Medium";
    return "High";
  };

  // Use fuchsia for the main card border
  const selectionColor = "#d946ef"; // Bright fuchsia

  return (
    <Card
      className={cn(
        "w-full",
        isMain ? `border-l-4 border-[${selectionColor}]` : "",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">
            {isMain ? "Selected Run" : "Related Run"}
          </CardTitle>
          <Badge variant="outline" className={getModelCardColor(point.model)}>
            {point.model}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {getTemperatureIcon(point.temperature)}
            <span>
              {getTemperatureText(point.temperature)} ({point.temperature})
            </span>
          </Badge>
          <Badge variant="outline" className="bg-slate-50">
            Run #{point.runId}
          </Badge>
          {point.cluster && (
            <Badge variant="outline" className="bg-slate-50">
              Cluster {point.cluster}
            </Badge>
          )}
          {point.batchId && (
            <Badge variant="outline" className="bg-slate-50">
              {formatBatchId(point.batchId)}
            </Badge>
          )}
        </div>

        <div className="text-xs text-slate-700">
          <p className="font-medium mb-1">Approach:</p>
          <p>{point.approach}</p>
        </div>

        <div className="text-xs text-slate-700">
          <p className="font-medium mb-1">Summary:</p>
          <p>{point.solutionSummary}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Time:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.executionTime}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Complexity:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.complexity}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Memory:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.memoryUsage}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Lines:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.lineCount}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Quality:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.codeQuality}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Convergence:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.convergenceScore}%
            </span>
          </div>
        </div>

        {/* Add Select This Run button */}
        <Button
          size="sm"
          className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
          onClick={() => onSelect(point)}
        >
          Select This Run
        </Button>
      </CardContent>
    </Card>
  );
}

// Format a batch ID to be more readable
const formatBatchId = (batchId: string): string => {
  // Try to extract timestamp from batch_TIMESTAMP_xxx format
  const timestampMatch = batchId.match(/batch_(\d+)_/);
  if (timestampMatch && timestampMatch[1]) {
    const timestamp = parseInt(timestampMatch[1]);
    if (!isNaN(timestamp)) {
      // Convert timestamp to readable date
      try {
        const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
        const formattedDate = date.toLocaleString();
        // Return only the unique part after "batch_"
        const uniquePart = batchId.split("_").slice(2).join("_");
        return `${formattedDate} (${uniquePart})`;
      } catch (e) {
        // If date conversion fails, fall back to simpler format
        console.error("Error formatting date:", e);
      }
    }
  }

  // If timestamp extraction fails, just make it more readable
  // Replace underscores with spaces, capitalize "batch"
  return batchId.replace("batch_", "Batch ").replace(/_/g, " ");
};

// Update the Scene component to include the DynamicAxisLabels
const Scene = React.memo(function Scene({
  data,
  clusters,
  hoveredPoint,
  setHoveredPoint,
  closestPoints,
  setClosestPoints,
  selectedPoint,
  setSelectedPoint,
  selectedClosestPoints,
  selectedClusters,
  setSelectedClusters,
  toggleClusterSelection,
  selectedBatchId,
  filteredData,
  cameraState,
  controlsRef,
  onCameraChange,
  preventAutoDeselect,
  isCameraMovingRef,
  isCameraMovingRecently,
}: {
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
  setSelectedClusters: React.Dispatch<React.SetStateAction<number[]>>;
  toggleClusterSelection: (clusterId: number) => void;
  selectedBatchId: string | null;
  filteredData: PointWithCluster[];
  cameraState: {
    position: [number, number, number];
    target: [number, number, number];
  };
  controlsRef: React.RefObject<any>;
  onCameraChange: () => void;
  preventAutoDeselect: boolean;
  isCameraMovingRef: React.RefObject<boolean>;
  isCameraMovingRecently: () => boolean;
}) {
  // Initialize OrbitControls with saved target
  useEffect(() => {
    if (controlsRef.current) {
      const [x, y, z] = cameraState.target;
      controlsRef.current.target.set(x, y, z);
      controlsRef.current.update();
    }
  }, [cameraState.target, controlsRef]);

  // Memoize scene contents to prevent unnecessary re-renders
  const renderedData = useMemo(() => data, [data]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />

      <gridHelper args={[20, 20, "#cbd5e1", "#cbd5e1"]} />
      <axesHelper args={[6]} />

      {/* Use dynamic axis labels that follow the camera */}
      <DynamicAxisLabels />

      {/* Add the cluster cubes with batch filtering */}
      <ClusterCubes
        clusters={clusters}
        toggleClusterSelection={toggleClusterSelection}
        selectedClusters={selectedClusters}
        filteredData={filteredData}
        selectedBatchId={selectedBatchId}
      />

      {/* Render all points but make them more transparent if not in the current filtering */}
      <Points
        data={renderedData}
        hoveredPoint={hoveredPoint}
        setHoveredPoint={setHoveredPoint}
        closestPoints={closestPoints}
        setClosestPoints={setClosestPoints}
        selectedPoint={selectedPoint}
        setSelectedPoint={setSelectedPoint}
        selectedClusters={selectedClusters}
        setSelectedClusters={setSelectedClusters}
        isCameraMovingRef={isCameraMovingRef}
        isCameraMovingRecently={isCameraMovingRecently}
        preventAutoDeselect={preventAutoDeselect}
        filteredData={filteredData}
      />

      {/* Point labels */}
      <PointLabels
        data={renderedData}
        hoveredPoint={hoveredPoint}
        selectedPoint={selectedPoint}
        closestPoints={closestPoints}
        selectedClosestPoints={selectedClosestPoints}
        selectedClusters={selectedClusters}
      />

      {/* Show connection lines for both hovered and selected points */}
      {selectedPoint && (
        <ConnectionLines
          point={selectedPoint}
          closestPoints={selectedClosestPoints}
          isSelected={true}
        />
      )}

      {hoveredPoint && hoveredPoint.id !== selectedPoint?.id && (
        <ConnectionLines
          point={hoveredPoint}
          closestPoints={closestPoints}
          selectedClusters={selectedClusters}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.05}
        onChange={onCameraChange}
        makeDefault
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
});

// Update the main component to handle cluster selection, batch selection, and real data
export default function MonteCarloVisualizer({
  initialBatchId,
}: {
  initialBatchId?: string | null;
}) {
  const [data, setData] = useState<PointWithCluster[]>([]);
  const [clusters, setClusters] = useState<MonteCarloCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<PointWithCluster | null>(
    null,
  );
  const [closestPoints, setClosestPoints] = useState<PointWithCluster[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PointWithCluster | null>(
    null,
  );
  const [selectedClosestPoints, setSelectedClosestPoints] = useState<
    PointWithCluster[]
  >([]);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [selectedClusterPoints, setSelectedClusterPoints] = useState<
    PointWithCluster[]
  >([]);
  const [allBatchIds, setAllBatchIds] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    initialBatchId || null,
  );
  const [filteredData, setFilteredData] = useState<PointWithCluster[]>([]);
  const [isFetchingBatches, setIsFetchingBatches] = useState(false);

  // Add state to control automatic deselection behavior - prevent deselection by default
  const [preventAutoDeselect, setPreventAutoDeselect] = useState(true);

  // Add state for model filtering
  const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(
    null,
  );

  // Define model display names for UI
  const modelColorNames = {
    "gpt-4": "GPT-4o",
    claude: "Claude",
    o1: "o1",
    o3: "o3-mini",
    other: "Other",
  };

  // Reference to track camera movement state
  const isCameraMovingRef = useRef<boolean>(false);

  // Track last camera movement time
  const [lastCameraMovement, setLastCameraMovement] = useState(0);

  // Define camera state
  const [cameraState, setCameraState] = useState<{
    position: [number, number, number];
    target: [number, number, number];
  }>({
    position: [10, 5, 10],
    target: [0, 0, 0],
  });

  // Reference to the OrbitControls
  const controlsRef = useRef<any>(null);

  // Helper function to check if camera was moving recently (debounce)
  const isCameraMovingRecently = useCallback(() => {
    return Date.now() - lastCameraMovement < 500;
  }, [lastCameraMovement]);

  // Function to deselect all points and clusters
  const handleDeselectAll = useCallback(() => {
    setSelectedPoint(null);
    setSelectedClusters([]);
  }, []);

  // Save camera position when it changes - update both state and ref
  const handleCameraChange = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      const newState = {
        position: [camera.position.x, camera.position.y, camera.position.z] as [
          number,
          number,
          number,
        ],
        target: [target.x, target.y, target.z] as [number, number, number],
      };

      // Update both ref and state
      cameraRef.current = newState;
      setCameraState(newState);

      // Mark camera as moving and update the timestamp
      isCameraMovingRef.current = true;
      setLastCameraMovement(Date.now());
    }
  }, []);

  // Store camera state between renders using both state and ref
  const cameraRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
  }>({
    position: [8, 6, 10], // More isometric starting position for better view
    target: [0, 0, 0],
  });

  // Function to focus camera on all points - moved here to avoid reference error
  const focusCameraOnAllPoints = useCallback((points: PointWithCluster[]) => {
    if (!points || points.length === 0) return;

    // STEP 1: Log the start of the camera focusing process
    console.log(`Focusing camera on ${points.length} points`);

    // STEP 2: Calculate the bounding box of all points
    const bounds = {
      minX: Number.MAX_VALUE,
      minY: Number.MAX_VALUE,
      minZ: Number.MAX_VALUE,
      maxX: Number.MIN_VALUE,
      maxY: Number.MIN_VALUE,
      maxZ: Number.MIN_VALUE,
    };

    // STEP 3: Find the min and max coordinates by iterating through all points
    points.forEach((point) => {
      bounds.minX = Math.min(bounds.minX, point.position[0]);
      bounds.minY = Math.min(bounds.minY, point.position[1]);
      bounds.minZ = Math.min(bounds.minZ, point.position[2]);
      bounds.maxX = Math.max(bounds.maxX, point.position[0]);
      bounds.maxY = Math.max(bounds.maxY, point.position[1]);
      bounds.maxZ = Math.max(bounds.maxZ, point.position[2]);
    });

    // STEP 4: Calculate the center of the bounding box
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    };

    // STEP 5: Calculate dimensions of the bounding box
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const depth = Math.max(1, bounds.maxZ - bounds.minZ);

    // STEP 6: Calculate the optimal camera distance to fit all points
    // Use the largest dimension as the basis for the calculation
    const maxDim = Math.max(width, height, depth);
    const distance = maxDim * 1.5; // Add extra padding for better view

    // STEP 7: Set a minimum distance to prevent very small clusters from being too zoomed in
    const minDistance = 15;
    const finalDistance = Math.max(distance, minDistance);

    // STEP 8: Log the calculated camera parameters for debugging
    console.log(
      `Camera distance set to ${finalDistance}`,
      `Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
      `Bounds: ${width.toFixed(2)} x ${height.toFixed(2)} x ${depth.toFixed(2)}`,
    );

    // STEP 9: Set the camera state to the new position and target
    setCameraState({
      position: [center.x, center.y, center.z + finalDistance],
      target: [center.x, center.y, center.z],
    });

    // STEP 10: If we have the OrbitControls reference, update its target directly
    if (controlsRef.current) {
      controlsRef.current.target.set(center.x, center.y, center.z);
      controlsRef.current.update();
    }

    // STEP 11: Prevent auto-deselect to avoid immediate deselection when camera moves
    setPreventAutoDeselect(true);
    setTimeout(() => setPreventAutoDeselect(false), 1000);
  }, []);

  // Create a function to focus the camera that can be called from the Focus button
  const handleFocusCamera = useCallback(() => {
    // First priority: Focus on user-selected points if they exist
    if (selectedPoint) {
      if (DEBUG) console.debug("Focusing camera on user-selected point and related points");
      const pointsToFocus = [selectedPoint, ...selectedClosestPoints];
      focusCameraOnAllPoints(pointsToFocus);
    }
    // Second priority: Focus on cluster-selected points if they exist
    else if (selectedClusterPoints.length > 0) {
      if (DEBUG) console.debug("Focusing camera on selected cluster points");
      focusCameraOnAllPoints(selectedClusterPoints);
    }
    // Third priority (fallback): Focus on all points if no selection exists
    else if (filteredData.length > 0) {
      if (DEBUG) console.debug("Focusing camera on all points");
      focusCameraOnAllPoints(filteredData);
    }
  }, [
    selectedPoint,
    selectedClosestPoints,
    selectedClusterPoints,
    filteredData,
    focusCameraOnAllPoints,
  ]);

  // Add key press event listener for Esc key
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

  // Add a separate function to fetch batch IDs directly
  const fetchBatchIds = useCallback(async () => {
    if (DEBUG) console.debug("Fetching available batch IDs...");
    setIsFetchingBatches(true);

    try {
      // Get all available batch IDs from the database
      const batchIds = await fetchAvailableBatchIds();
      if (DEBUG) console.debug(`Fetched ${batchIds.length} batch IDs`);

      if (batchIds.length > 0) {
        // Sort batch IDs to ensure consistent ordering
        // Newer batches (higher timestamps) appear first
        const sortedBatchIds = [...batchIds].sort((a, b) => {
          // Extract timestamps if available (batch_TIMESTAMP_xxx format)
          const getTimestamp = (id: string) => {
            const match = id.match(/batch_(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };

          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);

          // Sort descending (newer first)
          return timeB - timeA;
        });

        setAllBatchIds(sortedBatchIds);
      } else {
        if (DEBUG) console.debug("No batch IDs found");
        setAllBatchIds([]);
      }
    } catch (error) {
      console.error("Error fetching batch IDs:", error);
    } finally {
      setIsFetchingBatches(false);
    }
  }, []);

  // Add an effect to fetch batch IDs if they're not available
  useEffect(() => {
    // Only fetch if we don't have any batch IDs and we're not in the loading state
    if (allBatchIds.length === 0 && !isFetchingBatches) {
      fetchBatchIds();
    }
  }, [allBatchIds.length, isFetchingBatches, fetchBatchIds]);

  // Handler for batch selection - use the fetch function and focus the camera
  const handleBatchChange = useCallback(async (value: string) => {
    // Set the selected batch and start loading
    setSelectedBatchId(value)
    setIsLoading(true)

    // Refresh the full batch list
    await fetchBatchIds()

    try {
      if (DEBUG) console.debug(`Loading data for batch ${value}...`);
      const { dataPoints } = await fetchMonteCarloDataForBatch(value)

      // STEP: If no data for this batch, clear and exit
      if (dataPoints.length === 0) {
        if (DEBUG) console.debug(`No data found for batch ${value}`);
        setData([])
        setFilteredData([])
        setClusters([])
        return
      }

      if (DEBUG) console.debug(`Generating clusters for ${dataPoints.length} points...`);
      const generatedClusters = await generateClusters(dataPoints)

      if (DEBUG) console.debug(`Assigning ${generatedClusters.length} clusters to data points...`);
      const dataWithClusters: PointWithCluster[] = dataPoints.map((point) => {
        const cluster = generatedClusters.find((c) =>
          c.points.some((p) => p.id === point.id),
        )
        return {
          ...point,
          cluster: cluster?.id,
        }
      })

      if (DEBUG) console.debug(`Generating titles for clusters...`);
      const clustersWithTitles = await generateClusterTitles(generatedClusters)

      if (DEBUG) console.debug(`Updating state with ${dataWithClusters.length} points and ${clustersWithTitles.length} clusters`);
      setData(dataWithClusters)
      setFilteredData(dataWithClusters)
      setClusters(clustersWithTitles)

      if (DEBUG) console.debug(`Focusing camera on points...`);
      focusCameraOnAllPoints(dataWithClusters)
    } catch (error) {
      console.error(`Error fetching data for batch ${value}:`, error);
      setData([])
      setFilteredData([])
      setClusters([])
    } finally {
      setIsLoading(false)
    }
  }, [
    fetchBatchIds,
    fetchMonteCarloDataForBatch,
    generateClusters,
    generateClusterTitles,
    focusCameraOnAllPoints,
  ])

  // Fetch real data from the database
  useEffect(() => {
    // Only load data if a batch ID is selected
    if (!selectedBatchId) {
      // Clear data when no batch is selected
      setData([]);
      setFilteredData([]);
      setClusters([]);
      setIsLoading(false);

      // Still make sure we fetch all available batch IDs
      fetchBatchIds();
      return;
    }

    // Track if the component is mounted to prevent state updates after unmounting
    let isMounted = true;

    async function loadData() {
      if (!isMounted) return;
      setIsLoading(true);
      try {
        // Refresh the full batch list from Supabase
        await fetchBatchIds()

        // Fetch Monte Carlo data for the selected batch
        const { dataPoints } = await fetchMonteCarloData(selectedBatchId)

        if (!isMounted) return

        if (dataPoints.length === 0) {
          console.log(
            `No data found for batch ${selectedBatchId}, showing empty state`,
          )
          setIsLoading(false)
          return
        }

        // Generate clusters from the data points
        const generatedClusters = await generateClusters(dataPoints);

        if (!isMounted) return;

        // Assign cluster IDs to each data point
        const dataWithClusters: PointWithCluster[] = dataPoints.map((point) => {
          // Find which cluster contains this point
          const cluster = generatedClusters.find((c) =>
            c.points.some((p) => p.id === point.id),
          );

          return {
            ...point,
            cluster: cluster?.id,
          };
        });

        // Generate titles for each cluster using GPT-4o
        const clustersWithTitles =
          await generateClusterTitles(generatedClusters);

        if (!isMounted) return;
        setData(dataWithClusters);
        setFilteredData(dataWithClusters);
        setClusters(clustersWithTitles);
        setIsLoading(false);

        // Focus camera on all points after loading
        focusCameraOnAllPoints(dataWithClusters);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading Monte Carlo data:", error);
        setIsLoading(false);

        // On error, still make sure we have all available batch IDs
        fetchBatchIds();
      }
    }

    loadData();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [selectedBatchId, focusCameraOnAllPoints, fetchBatchIds]);

  // Get the selected cluster title
  const getSelectedClusterTitle = () => {
    if (selectedClusters.length === 1) {
      const cluster = clusters.find((c) => c.id === selectedClusters[0]);
      return cluster ? cluster.label : "";
    } else if (selectedClusters.length > 1) {
      return "Multiple Clusters";
    }
    return "";
  };

  // Toggle cluster selection
  const toggleClusterSelection = (clusterId: number) => {
    setSelectedClusters((prev) => {
      // Check if the cluster is already selected
      if (prev.includes(clusterId)) {
        // If selected, remove it from selection
        console.log(`Deselecting cluster ${clusterId}`);

        // Clear any individual point selections within this cluster as well
        if (selectedPoint && selectedPoint.cluster === clusterId) {
          setSelectedPoint(null);
        }

        return prev.filter((id) => id !== clusterId);
      } else {
        // If not selected, add it to selection
        console.log(`Selecting cluster ${clusterId}`);

        // Find the first point in this cluster and select it as representative (if any)
        const clusterPoints = filteredData.filter(
          (point) => point.cluster === clusterId,
        );
        if (
          clusterPoints.length > 0 &&
          (!selectedPoint || selectedPoint.cluster !== clusterId)
        ) {
          // Select the first point from the cluster as representative
          setSelectedPoint(clusterPoints[0]);
        }

        return [...prev, clusterId];
      }
    });
  };

  // Update selected closest points when selected point changes
  useEffect(() => {
    if (selectedPoint && data.length > 0) {
      setSelectedClosestPoints(findClosestPoints(selectedPoint, data, 4));
    } else {
      setSelectedClosestPoints([]);
    }
  }, [selectedPoint, data]);

  // Update selected cluster points when selected clusters change
  useEffect(() => {
    if (selectedClusters.length > 0) {
      const points = filteredData.filter(
        (point) => point.cluster && selectedClusters.includes(point.cluster),
      );
      setSelectedClusterPoints(points);
    } else {
      setSelectedClusterPoints([]);
    }
  }, [selectedClusters, filteredData]);

  // Apply model filtering when selectedModelFilter changes
  useEffect(() => {
    if (selectedModelFilter === null) {
      // If no model filter is selected, show all points from original data
      setFilteredData(data);
    } else {
      // Filter points by model type
      const modelFilteredPoints = data.filter((point) => {
        const modelLower = point.model.toLowerCase();

        // Match based on the selected model value
        if (
          selectedModelFilter === "gpt-4" &&
          (modelLower.includes("gpt-4") ||
            modelLower.includes("gpt4") ||
            modelLower.includes("gpt-4o"))
        ) {
          return true;
        }
        if (selectedModelFilter === "claude" && modelLower.includes("claude")) {
          return true;
        }
        if (
          selectedModelFilter === "o1" &&
          modelLower.includes("o1") &&
          !modelLower.includes("gpt")
        ) {
          return true;
        }
        if (
          selectedModelFilter === "o3" &&
          (modelLower.includes("o3") || modelLower.includes("o3-mini"))
        ) {
          return true;
        }
        if (
          selectedModelFilter === "other" &&
          !modelLower.includes("gpt") &&
          !modelLower.includes("claude") &&
          !modelLower.includes("o1") &&
          !modelLower.includes("o3")
        ) {
          return true;
        }

        return false;
      });

      setFilteredData(modelFilteredPoints);

      // Update focus camera to show the filtered points
      if (modelFilteredPoints.length > 0) {
        focusCameraOnAllPoints(modelFilteredPoints);
      }
    }
  }, [selectedModelFilter, data, focusCameraOnAllPoints]);

  // Handler for selecting a point from the detail card
  const handleSelectPoint = (point: PointWithCluster) => {
    setSelectedPoint(point);
    const closest = findClosestPoints(point, data, 4);
    setSelectedClosestPoints(closest);

    // If the point belongs to a cluster, also select that cluster
    if (point.cluster && !selectedClusters.includes(point.cluster)) {
      setSelectedClusters((prev) => [...prev, point.cluster!]);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-12 gap-2 h-[calc(100vh-240px)]">
        {/* Batch Selection sidebar still visible during loading */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-full">
          <div className="p-3 bg-slate-50 border-b">
            <h3 className="text-sm font-medium text-slate-700 flex justify-between items-center">
              Batch Selection
              {isFetchingBatches && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              )}
            </h3>
          </div>

          <div className="h-[calc(100%-40px)] md:h-[calc(100%-48px)] overflow-y-auto p-2">
            {allBatchIds.length > 0 ? (
              <div className="space-y-1">
                {allBatchIds.map((batchId) => (
                  <button
                    key={batchId}
                    onClick={() => handleBatchChange(batchId)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedBatchId === batchId
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                    disabled={isLoading}
                  >
                    {formatBatchId(batchId)}
                  </button>
                ))}
              </div>
            ) : isFetchingBatches ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                Loading batches...
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                No batches available
              </div>
            )}
          </div>
        </div>

        {/* Loading indicator in the main content area */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 flex justify-center items-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
            <p className="text-slate-600">
              Loading Monte Carlo visualization data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="grid grid-cols-12 gap-2 h-[calc(100vh-240px)]">
        {/* Batch Selection sidebar still visible when no data */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-full">
          <div className="p-3 bg-slate-50 border-b">
            <h3 className="text-sm font-medium text-slate-700 flex justify-between items-center">
              Batch Selection
              {isFetchingBatches && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              )}
            </h3>
          </div>

          <div className="h-[calc(100%-40px)] md:h-[calc(100%-48px)] overflow-y-auto p-2">
            {allBatchIds.length > 0 ? (
              <div className="space-y-1">
                {allBatchIds.map((batchId) => (
                  <button
                    key={batchId}
                    onClick={() => handleBatchChange(batchId)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedBatchId === batchId
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                    disabled={isLoading}
                  >
                    {formatBatchId(batchId)}
                  </button>
                ))}
              </div>
            ) : isFetchingBatches ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                Loading batches...
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                No batches available
              </div>
            )}
          </div>
        </div>

        {/* Empty state message in the main content area */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 flex justify-center items-center">
          <div className="text-center bg-white p-8 rounded-xl shadow-md max-w-md">
            <h3 className="text-xl font-semibold mb-2">
              {selectedBatchId ? "No Data Available" : "Select a Batch"}
            </h3>
            <p className="text-slate-600 mb-4">
              {selectedBatchId
                ? "There are no solution runs stored for this batch. Run the ensemble to generate data that will be visualized here."
                : "Please select a batch from the sidebar to view Monte Carlo visualization data."}
            </p>
            {selectedBatchId && (
              <Button variant="outline" onClick={() => window.history.back()}>
                Return to Solution Pathway
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-2 h-[calc(100vh-240px)]">
      {/* Batch Selection List - Left Side */}
      <div className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-full">
        <div className="p-3 bg-slate-50 border-b">
          <h3 className="text-sm font-medium text-slate-700 flex justify-between items-center">
            Batch Selection
            {isFetchingBatches && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            )}
          </h3>
        </div>

        <div className="h-[calc(100%-40px)] md:h-[calc(100%-48px)] overflow-y-auto p-2">
          {allBatchIds.length > 0 ? (
            <div className="space-y-1">
              {allBatchIds.map((batchId) => (
                <button
                  key={batchId}
                  onClick={() => handleBatchChange(batchId)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedBatchId === batchId
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                  disabled={isLoading}
                >
                  {formatBatchId(batchId)}
                </button>
              ))}
            </div>
          ) : isFetchingBatches ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              Loading batches...
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              No batches available
            </div>
          )}
        </div>
      </div>

      {/* 3D Visualization - Center */}
      <div className="col-span-12 md:col-span-9 lg:col-span-7 bg-white rounded-lg shadow-md overflow-hidden h-full">
        <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Monte Carlo Visualization
            {selectedBatchId && (
              <span className="text-slate-500 ml-2">
                • Batch {formatBatchId(selectedBatchId)}
              </span>
            )}
            <span className="text-slate-500 ml-2">
              • {filteredData.length} points
            </span>
            {selectedModelFilter && (
              <span className="ml-2 inline-flex items-center bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded">
                Filtered by{" "}
                {selectedModelFilter in modelColorNames
                  ? modelColorNames[
                      selectedModelFilter as keyof typeof modelColorNames
                    ]
                  : selectedModelFilter}
              </span>
            )}
          </h3>
        </div>

        <div className="relative w-full h-full overflow-hidden">
          {/* Focus button - positioned in the top-left of the 3D view */}
          {filteredData.length > 0 && (
            <div className="absolute top-4 left-4 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFocusCamera}
                className="bg-white shadow-md hover:bg-slate-100 text-slate-700 border-slate-200 flex items-center gap-1"
                title="Focus camera on all points"
              >
                <Focus className="h-4 w-4" />
                <span>Focus</span>
              </Button>
            </div>
          )}

          {/* Show All Points button - appears when model filtering is active */}
          {selectedModelFilter !== null && (
            <div className="absolute top-4 left-32 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedModelFilter(null)}
                className="bg-white shadow-md hover:bg-slate-100 text-slate-700 border-slate-200"
                title="Reset model filter to show all points"
              >
                Show All Points
              </Button>
            </div>
          )}

          <Canvas
            className="absolute inset-0"
            camera={{ position: cameraRef.current.position, fov: 50 }}
            onCreated={({ gl, camera, size }) => {
              // Manage pixel ratio and sizing to match the canvas container
              gl.setPixelRatio(window.devicePixelRatio)
              gl.setSize(size.width, size.height)
              // Update camera projection for correct aspect
              const perspectiveCamera = camera as THREE.PerspectiveCamera
              perspectiveCamera.aspect = size.width / size.height
              perspectiveCamera.updateProjectionMatrix()
              // Handle WebGL context loss and restoration
              gl.domElement.addEventListener("webglcontextlost", (e) => {
                e.preventDefault()
                console.warn("WebGL context lost, attempting restore")
              })
              gl.domElement.addEventListener("webglcontextrestored", () => {
                console.log("WebGL context restored")
              })
            }}
            gl={{
              powerPreference: "high-performance",
              antialias: true,
              stencil: false,
              depth: true,
              alpha: true,
            }}
            dpr={[1, 2]} // Better handling of different pixel densities
            resize={{ scroll: false }}
            frameloop="demand"
            key="main-canvas" // Keep the key stable to prevent remounts
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(to bottom, #f8fafc, #f1f5f9)",
            }} // Light gradient background
          >
            <Scene
              data={filteredData}
              clusters={clusters}
              hoveredPoint={hoveredPoint}
              setHoveredPoint={setHoveredPoint}
              closestPoints={closestPoints}
              setClosestPoints={setClosestPoints}
              selectedPoint={selectedPoint}
              setSelectedPoint={setSelectedPoint}
              selectedClosestPoints={selectedClosestPoints}
              selectedClusters={selectedClusters}
              setSelectedClusters={setSelectedClusters}
              toggleClusterSelection={toggleClusterSelection}
              selectedBatchId={selectedBatchId}
              filteredData={filteredData}
              cameraState={cameraState}
              controlsRef={controlsRef}
              onCameraChange={handleCameraChange}
              preventAutoDeselect={preventAutoDeselect}
              isCameraMovingRef={isCameraMovingRef}
              isCameraMovingRecently={isCameraMovingRecently}
            />
          </Canvas>

          {/* Model legend */}
          <div className="absolute bottom-20 left-6">
            <ModelLegend
              selectedModelFilter={selectedModelFilter}
              onModelFilterChange={setSelectedModelFilter}
              data={filteredData}
            />
          </div>

          {/* Deselect button - positioned in the top-right of the 3D view */}
          {(selectedPoint || selectedClusters.length > 0) && (
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                className="bg-white shadow-md hover:bg-slate-100 text-slate-700 border-slate-200"
              >
                Deselect All
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Details Panel - Right Side */}
      <div className="col-span-12 md:col-span-12 lg:col-span-3 space-y-4 overflow-y-auto h-full pr-2 pb-4">
        {selectedClusterPoints.length > 0 ? (
          <>
            <div className="px-4 py-2 bg-green-100/40 rounded-md mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Cluster: {getSelectedClusterTitle()}
              </h3>
              <span className="text-sm text-slate-600">
                {selectedClusterPoints.length} Points
              </span>
            </div>
            <div className="space-y-3">
              {selectedClusterPoints.slice(0, 10).map((point) => (
                <DetailCard
                  key={point.id}
                  point={point}
                  onSelect={handleSelectPoint}
                />
              ))}
              {selectedClusterPoints.length > 10 && (
                <p className="text-xs text-center text-slate-500">
                  + {selectedClusterPoints.length - 10} more points not shown
                </p>
              )}
            </div>
          </>
        ) : selectedPoint ? (
          <>
            <DetailCard
              point={selectedPoint!}
              isMain={true}
              onSelect={handleSelectPoint}
            />
            <h3 className="text-sm font-medium text-slate-600 mt-4">
              Closest Related Runs
            </h3>
            <div className="space-y-3">
              {selectedClosestPoints.map((point) => (
                <DetailCard
                  key={point.id}
                  point={point}
                  onSelect={handleSelectPoint}
                />
              ))}
            </div>
          </>
        ) : hoveredPoint ? (
          <>
            <DetailCard
              point={hoveredPoint!}
              isMain={true}
              onSelect={handleSelectPoint}
            />
            <h3 className="text-sm font-medium text-slate-600 mt-4">
              Closest Related Runs
            </h3>
            <div className="space-y-3">
              {closestPoints.map((point) => (
                <DetailCard
                  key={point.id}
                  point={point}
                  onSelect={handleSelectPoint}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-slate-500">
            Click on any point in the visualization to select it and see
            details, or toggle a cluster to view all points in that group.
          </div>
        )}
      </div>
    </div>
  );
}
