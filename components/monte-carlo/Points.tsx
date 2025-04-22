import React, { useRef, useMemo, useEffect, useCallback } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { PointWithCluster } from "@/lib/monte-carlo-service"
import { findClosestPoints, getModelColor } from "./utils"

// Type for point detection results (local to this component)
interface PointDetectionResult {
  index: number;
  distance: number;
}

interface PointsProps {
  data: PointWithCluster[]; // All points for the current batch
  filteredData: PointWithCluster[]; // Points currently visible based on filtering
  hoveredPoint: PointWithCluster | null;
  setHoveredPoint: (point: PointWithCluster | null) => void;
  setClosestPoints: (points: PointWithCluster[]) => void; // Setter for closest points to hovered
  selectedPoint: PointWithCluster | null;
  setSelectedPoint: (point: PointWithCluster | null) => void;
  selectedClusters: number[];
  // Props related to camera movement for optimizing hover detection
  isCameraMovingRef: React.RefObject<boolean>;
  preventAutoDeselect: boolean; // May not be needed directly here, depends on final interaction logic
}

// Component for the 3D points using InstancedMesh
export function Points({
  data,
  filteredData,
  hoveredPoint,
  setHoveredPoint,
  setClosestPoints,
  selectedPoint,
  setSelectedPoint,
  selectedClusters,
  isCameraMovingRef,
  // preventAutoDeselect, // This might be handled higher up now
}: PointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const highlightRef = useRef<THREE.Mesh>(null) // Hover highlight
  const selectionRef = useRef<THREE.Mesh>(null) // Selection highlight
  const { raycaster, camera, mouse, invalidate } = useThree()

  // Track touch interaction state for better mobile experience
  const touchStartTimeRef = useRef<number | null>(null)
  const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null)
  const isTapRef = useRef(false)

  // Create a temporary object for matrix updates
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  // Create temporary color object
  const tempColor = useMemo(() => new THREE.Color(), [])

  // Set up instanced mesh positions and base colors
  useEffect(() => {
    if (!meshRef.current || !data.length) return

    const localTempObj = tempObject // Use local variable

    data.forEach((point, i) => {
      localTempObj.position.set(...point.position)
      localTempObj.updateMatrix()
      meshRef.current?.setMatrixAt(i, localTempObj.matrix)

      const color = getModelColor(point.model)
      meshRef.current?.setColorAt(i, color)
    })

    if (meshRef.current) {
      meshRef.current.count = data.length // Ensure count matches data length
      meshRef.current.instanceMatrix.needsUpdate = true
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true
      }
    }
    invalidate() // Initial render
  }, [data, invalidate, tempObject]) // Rerun if data changes

  // Update instance colors based on hover, selection, and cluster selection
  useEffect(() => {
    if (!meshRef.current || !data.length) return

    // Create a color object for reuse
    const tempColor = new THREE.Color()
    
    // Store initial model colors to use as base
    const baseColors = data.map(p => getModelColor(p.model))
    
    // Find points close to selected/hovered
    const closestToSelected = selectedPoint ? findClosestPoints(selectedPoint, data, 4) : []
    const closestToHovered = hoveredPoint ? findClosestPoints(hoveredPoint, data, 4) : []

    data.forEach((point, i) => {
      const isSelected = selectedPoint?.id === point.id
      const isClosestToSelected = closestToSelected.some(p => p.id === point.id)
      const isHovered = hoveredPoint?.id === point.id
      const isClosestToHovered = closestToHovered.some(p => p.id === point.id)
      const isInSelectedCluster = point.cluster && selectedClusters.includes(point.cluster)

      // Order of precedence: Selected > Hovered > Cluster Selection > Base Model Color
      if (isSelected || isClosestToSelected) {
        tempColor.set("#f97316") // Orange for selected and its connections
        meshRef.current?.setColorAt(i, tempColor)
      } else if (isHovered || isClosestToHovered) {
        tempColor.set("#f97316") // Orange for hovered and its connections
        meshRef.current?.setColorAt(i, tempColor)
      } else if (isInSelectedCluster) {
        tempColor.set("#4ade80") // Green for points in selected clusters
        meshRef.current?.setColorAt(i, tempColor)
      } else {
        // Use the base model color directly
        meshRef.current?.setColorAt(i, baseColors[i])
      }
    })

    // Ensure the instance color buffer is updated
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
    invalidate()
  }, [data, hoveredPoint, selectedPoint, selectedClusters, invalidate])

  // Update highlight sphere (hover)
  useEffect(() => {
    if (highlightRef.current && hoveredPoint) {
      // Only show hover highlight if the point is not already selected
      const isSelected = selectedPoint?.id === hoveredPoint.id
      highlightRef.current.position.set(...hoveredPoint.position)
      highlightRef.current.visible = !isSelected // Hide if selected
      if (!isSelected && highlightRef.current.material instanceof THREE.MeshBasicMaterial) {
        highlightRef.current.material.color.set("#f97316") // Orange
      }
    } else if (highlightRef.current) {
      highlightRef.current.visible = false
    }
    invalidate()
  }, [hoveredPoint, selectedPoint, invalidate])

  // Update selection sphere (selected)
  useEffect(() => {
    if (selectionRef.current && selectedPoint) {
      selectionRef.current.position.set(...selectedPoint.position)
      selectionRef.current.visible = true
    } else if (selectionRef.current) {
      selectionRef.current.visible = false
    }
    invalidate()
  }, [selectedPoint, invalidate])

  // Hover detection logic
  useFrame(() => {
    if (!meshRef.current || isCameraMovingRef.current) return // Skip if moving camera

    raycaster.params.Points.threshold = 0.8
    raycaster.setFromCamera(mouse, camera)

    const intersects = raycaster.intersectObject(meshRef.current, false) // false: Don't test children
    let foundPointData: PointWithCluster | null = null

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId
      if (instanceId < data.length) {
        foundPointData = data[instanceId]
      }
    } else {
       // Optional: Add direct distance check if raycast fails often (more compute intensive)
       // Consider performance impact before enabling
    }

    // Update hover state if changed
    if (hoveredPoint?.id !== foundPointData?.id) {
      setHoveredPoint(foundPointData)
      if (foundPointData) {
        setClosestPoints(findClosestPoints(foundPointData, data, 4))
      } else {
        setClosestPoints([])
      }
    }
  })

  // Helper function to select a point using raycasting - reused by mouse/touch
  const selectPointFromRaycast = useCallback(() => {
    if (!meshRef.current) return
    console.log("Selecting point via raycast/proximity check...")

    const pointRaycaster = new THREE.Raycaster()
    pointRaycaster.params.Points.threshold = 0.8
    pointRaycaster.setFromCamera(mouse, camera)

    const intersects = pointRaycaster.intersectObject(meshRef.current, false)

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId
      if (instanceId < data.length) {
          const clickedPoint = data[instanceId]
          // Check if this point is part of the filtered data before selecting
           if (filteredData.some(p => p.id === clickedPoint.id)) {
               console.log("Selected point via raycast:", clickedPoint.id)
               setSelectedPoint(clickedPoint)
               return; // Found via raycast
           } else {
                console.log("Raycast hit point not in filtered data:", clickedPoint.id);
           }
      }
    }

    // Fallback: Direct proximity check (more robust for sparse points / filtering)
     let closestPoint: PointDetectionResult | null = null;
     const ray = pointRaycaster.ray;
     const tempPosition = new THREE.Vector3();
     const tempMatrix = new THREE.Matrix4();

     for (let i = 0; i < data.length; i++) {
         // Only check against points in the *filtered* data set
         if (!filteredData.some(p => p.id === data[i].id)) continue;

         meshRef.current.getMatrixAt(i, tempMatrix);
         tempPosition.setFromMatrixPosition(tempMatrix);

         const closestPointOnRay = new THREE.Vector3();
         ray.closestPointToPoint(tempPosition, closestPointOnRay);
         const distance = tempPosition.distanceTo(closestPointOnRay);

         if (distance < 0.8) { // Threshold for direct proximity
             if (!closestPoint || distance < closestPoint.distance) {
                 closestPoint = { index: i, distance };
             }
         }
     }

     if (closestPoint) {
         const pointToSelect = data[closestPoint.index];
         console.log("Selected point via proximity:", pointToSelect.id, "distance:", closestPoint.distance.toFixed(2));
         setSelectedPoint(pointToSelect);
     } else {
         console.log("No point found near click/tap.");
     }


  }, [setSelectedPoint, mouse, camera, data, filteredData, meshRef]) // Include filteredData

  // Pointer down handler (mouse clicks / touch starts)
  const handlePointerDown = useCallback((event: any) => {
      event.stopPropagation()
      if (event.pointerType === 'touch') {
        touchStartTimeRef.current = Date.now()
        touchStartPositionRef.current = { x: event.clientX, y: event.clientY }
        isTapRef.current = true // Assume it's a tap initially
      } else {
         // For mouse clicks, select based on the hovered point or raycast
         if (hoveredPoint && filteredData.some(p => p.id === hoveredPoint.id)) {
             setSelectedPoint(hoveredPoint)
         } else {
             selectPointFromRaycast() // Raycast if not hovering a valid point
         }
      }
    }, [hoveredPoint, setSelectedPoint, selectPointFromRaycast, filteredData]) // Include filteredData

  // Pointer move handler (to differentiate tap vs drag on touch)
  const handlePointerMove = useCallback((event: any) => {
      if (event.pointerType === 'touch' && touchStartPositionRef.current && isTapRef.current) {
        const moveX = Math.abs(event.clientX - touchStartPositionRef.current.x)
        const moveY = Math.abs(event.clientY - touchStartPositionRef.current.y)
        if (moveX > 10 || moveY > 10) {
          isTapRef.current = false // It's a drag
        }
      }
    }, [])

  // Pointer up handler (primarily for touch end)
  const handlePointerUp = useCallback((event: any) => {
      if (event.pointerType === 'touch' && touchStartTimeRef.current && isTapRef.current) {
        const touchDuration = Date.now() - touchStartTimeRef.current
        if (touchDuration < 300) { // It was a tap
           // Select based on hovered point or raycast
           if (hoveredPoint && filteredData.some(p => p.id === hoveredPoint.id)) {
               setSelectedPoint(hoveredPoint)
           } else {
               selectPointFromRaycast()
           }
        }
      }
      // Reset touch tracking state
      touchStartTimeRef.current = null
      touchStartPositionRef.current = null
      isTapRef.current = false
    }, [hoveredPoint, setSelectedPoint, selectPointFromRaycast, filteredData]) // Include filteredData

  return (
    <>
      {/* Instanced mesh for all points */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, data.length]} // Use data.length for allocation
        frustumCulled={false} // Adjust if needed based on scene size
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // Consider onPointerMissed to deselect if clicking background? Needs careful handling with OrbitControls.
        // onPointerMissed={(event) => event.button === 0 && handleDeselectAll()}
      >
        {/* Use a slightly smaller sphere for better visual separation */}
        <sphereGeometry args={[0.15, 16, 16]} />
        {/* Material properties simplified for better performance */}
        <meshBasicMaterial vertexColors={true} />
      </instancedMesh>

      {/* Highlight sphere for hovered point */}
      <mesh ref={highlightRef} visible={false} renderOrder={101}>
        <sphereGeometry args={[0.25, 24, 24]} /> {/* Slightly larger than points */}
        <meshBasicMaterial color="#f97316" transparent={true} opacity={0.6} wireframe />
      </mesh>

      {/* Selection sphere for selected point */}
      <mesh ref={selectionRef} visible={false} renderOrder={102}>
        <sphereGeometry args={[0.25, 24, 24]} /> {/* Same size as hover */}
        <meshBasicMaterial color="#f97316" wireframe={true} />
      </mesh>
    </>
  )
} 