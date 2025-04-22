"use client";

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { getModelColor, findClosestPoints, PointDetectionResult } from '../utils'; // Import helper

interface PointsProps {
  data: PointWithCluster[];
  hoveredPoint: PointWithCluster | null;
  setHoveredPoint: (point: PointWithCluster | null) => void;
  setClosestPoints: (points: PointWithCluster[]) => void;
  selectedPoint: PointWithCluster | null;
  setSelectedPoint: (point: PointWithCluster | null) => void;
  selectedClusters: number[];
  isCameraMovingRef: React.RefObject<boolean>;
  filteredData: PointWithCluster[]; // Needed for direct detection filtering
}

export function Points({
  data,
  hoveredPoint,
  setHoveredPoint,
  setClosestPoints,
  selectedPoint,
  setSelectedPoint,
  selectedClusters,
  isCameraMovingRef,
  filteredData,
}: PointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const selectionRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, mouse, invalidate } = useThree();
  const touchStartTimeRef = useRef<number | null>(null);
  const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isTapRef = useRef(false);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const clusterHighlightRefs = useRef<THREE.Mesh[]>([]);

  // Setup Instanced Mesh Geometry & Base Colors
  useEffect(() => {
    if (!meshRef.current || !data.length) return;
    const localTempObj = tempObject;
    data.forEach((point, i) => {
      localTempObj.position.set(...point.position);
      localTempObj.updateMatrix();
      meshRef.current!.setMatrixAt(i, localTempObj.matrix);
      meshRef.current!.setColorAt(i, getModelColor(point.model));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.count = data.length; // Ensure count matches data length
    // Three.js typing fix - instanceCount doesn't exist in type definitions but works at runtime
    (meshRef.current.geometry as any).instanceCount = data.length; // Required for older three versions
  }, [data, tempObject]);

  // Update Instance Colors based on state
  useEffect(() => {
    if (!meshRef.current || !meshRef.current.instanceColor || !data.length) return;
    const tempColor = new THREE.Color();
    const baseColors = data.map(p => getModelColor(p.model));

    data.forEach((point, i) => {
        let finalColor = baseColors[i]; // Start with base color

        const isSelected = selectedPoint?.id === point.id;
        const isHovered = hoveredPoint?.id === point.id;
        const isInSelectedCluster = selectedClusters.includes(point.cluster ?? -1);

        const closestToSelected = selectedPoint ? findClosestPoints(selectedPoint, data, 4) : [];
        const isProximalToSelected = closestToSelected.some(p => p.id === point.id);

        const closestToHovered = hoveredPoint ? findClosestPoints(hoveredPoint, data, 4) : [];
        const isProximalToHovered = closestToHovered.some(p => p.id === point.id);

        // Order of precedence: Selected > Hovered > Cluster Selection
        if (isSelected || isProximalToSelected) {
            finalColor = tempColor.set("#f97316"); // Orange
        } else if (isHovered || isProximalToHovered) {
             finalColor = tempColor.set("#f97316"); // Orange
        } else if (isInSelectedCluster) {
            finalColor = tempColor.set("#4ade80"); // Green
        }

        meshRef.current!.setColorAt(i, finalColor);
    });

    meshRef.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [data, hoveredPoint, selectedPoint, selectedClusters, invalidate]);


  // Update hover highlight sphere
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.visible = !!hoveredPoint;
      if (hoveredPoint) {
        highlightRef.current.position.set(...hoveredPoint.position);
        (highlightRef.current.material as THREE.MeshBasicMaterial).color.set("#f97316"); // Orange
      }
      if(hoveredPoint) invalidate();
    }
  }, [hoveredPoint, invalidate]);

  // Update selection highlight sphere
  useEffect(() => {
    if (selectionRef.current) {
      selectionRef.current.visible = !!selectedPoint;
      if (selectedPoint) {
        selectionRef.current.position.set(...selectedPoint.position);
         (selectionRef.current.material as THREE.MeshBasicMaterial).color.set("#f97316"); // Orange
      }
       if(selectedPoint) invalidate();
    }
  }, [selectedPoint, invalidate]);

   // Update cluster highlight spheres
   useEffect(() => {
      const geometry = new THREE.SphereGeometry(0.25, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: "#4ade80", wireframe: true, transparent: true, opacity: 0.6 });

      clusterHighlightRefs.current.forEach(mesh => mesh.parent?.remove(mesh));
      clusterHighlightRefs.current = [];

      if (selectedClusters.length > 0 && meshRef.current?.parent) {
          const parent = meshRef.current.parent;
          data.filter(point => point.cluster && selectedClusters.includes(point.cluster) && point.id !== selectedPoint?.id)
              .forEach(point => {
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(...point.position);
                  mesh.renderOrder = 11;
                  parent.add(mesh);
                  clusterHighlightRefs.current.push(mesh);
              });
          invalidate();
      }

      return () => {
         clusterHighlightRefs.current.forEach(mesh => mesh.parent?.remove(mesh));
         geometry.dispose();
         material.dispose();
      };
   }, [selectedClusters, data, selectedPoint, invalidate]);


  // Hover detection frame loop
  useFrame(() => {
     if (!meshRef.current || (isCameraMovingRef.current && (selectedPoint || selectedClusters.length > 0))) return;

     raycaster.params.Points.threshold = 0.8;
     raycaster.setFromCamera(mouse, camera);
     const intersects = raycaster.intersectObject(meshRef.current, false); // Don't intersect children

     let foundInstanceId: number | undefined = undefined;
     if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
         foundInstanceId = intersects[0].instanceId;
     } else {
        // Direct detection if no intersection
         const pointPositions = data.map(p => new THREE.Vector3(...p.position));
         let closestPoint: PointDetectionResult | null = null;
         const ray = raycaster.ray;

         pointPositions.forEach((position, index) => {
             if (filteredData.length !== data.length && !filteredData.some(p => p.id === data[index].id)) return; // Check filter
             const closestPointOnRay = new THREE.Vector3();
             ray.closestPointToPoint(position, closestPointOnRay);
             const distance = position.distanceTo(closestPointOnRay);
             if (distance < 0.6 && (!closestPoint || distance < closestPoint.distance)) {
                 closestPoint = { index, distance };
             }
         });
         if(closestPoint) foundInstanceId = (closestPoint as PointDetectionResult).index;
     }

     const currentHoverId = hoveredPoint?.id;
     let nextHoveredPoint: PointWithCluster | null = null;
     if (foundInstanceId !== undefined && foundInstanceId < data.length) {
         nextHoveredPoint = data[foundInstanceId];
     }

     if (currentHoverId !== nextHoveredPoint?.id) {
         setHoveredPoint(nextHoveredPoint);
         setClosestPoints(nextHoveredPoint ? findClosestPoints(nextHoveredPoint, data, 4) : []);
     }
  });

  // --- Pointer Handlers (Simplified for brevity, keep original logic) ---
  const selectPointFromRaycast = useCallback(() => {/* ... original logic using raycaster/direct detection ... */}, [/* deps */]);
  const handlePointerDown = useCallback((e: any) => { e.stopPropagation(); /* ... original logic ... */ }, [/* deps */]);
  const handlePointerUp = useCallback((e: any) => { /* ... original logic ... */ }, [/* deps */]);
  const handlePointerMove = useCallback((e: any) => { /* ... original logic ... */ }, [/* deps */]);


  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, data.length]} // Ensure args match data length
        frustumCulled={false}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        renderOrder={10} // Default render order
      >
        <sphereGeometry args={[0.15, 24, 24]} />
        {/* Use MeshStandardMaterial for better lighting effects if needed, else Basic is fine */}
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} />
        {/* <meshBasicMaterial vertexColors transparent={true} alphaTest={0.01} depthWrite={true} depthTest={true} /> */}
      </instancedMesh>

      {/* Highlight sphere for hovered point */}
      <mesh ref={highlightRef} visible={false} renderOrder={101}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshBasicMaterial color="#f97316" transparent={true} opacity={0.6} />
      </mesh>

      {/* Selection sphere for selected point */}
      <mesh ref={selectionRef} visible={false} renderOrder={102}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshBasicMaterial color="#f97316" wireframe={true} transparent={true} opacity={1} />
      </mesh>
    </>
  );
} 