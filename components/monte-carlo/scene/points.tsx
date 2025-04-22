"use client";

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { getModelColor } from '../utils';

interface PointsProps {
  data: PointWithCluster[];
  hoveredPoint: PointWithCluster | null;
  setHoveredPoint: (point: PointWithCluster | null) => void;
  setClosestPoints: (points: PointWithCluster[]) => void;
  selectedPoint: PointWithCluster | null;
  setSelectedPoint: (point: PointWithCluster | null) => void;
  selectedClusters: number[];
  isCameraMovingRef: React.RefObject<boolean>;
  filteredData: PointWithCluster[]; 
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
  const points = useRef<THREE.Points>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const selectionRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, mouse, invalidate } = useThree();

  // Create geometries for points
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    // Create position attribute
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);
    
    // Create a mapping from point ID to index
    const pointIdToIndex = new Map();
    
    data.forEach((point, i) => {
      // Store positions
      positions[i * 3] = point.position[0];
      positions[i * 3 + 1] = point.position[1];
      positions[i * 3 + 2] = point.position[2];
      
      // Store model colors from ModelLegend
      const color = getModelColor(point.model);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      // Store mapping
      pointIdToIndex.set(point.id, i);
    });
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Store reference to the mapping on the geometry itself for easy access
    (geo as any).pointIdToIndex = pointIdToIndex;
    
    return geo;
  }, [data]);
  
  // Material for points
  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      sizeAttenuation: true,
    });
  }, []);

  // Handle hover highlight
  useEffect(() => {
    if (highlightRef.current && hoveredPoint) {
      highlightRef.current.position.set(...hoveredPoint.position);
      highlightRef.current.visible = true;
    } else if (highlightRef.current) {
      highlightRef.current.visible = false;
    }
    
    invalidate();
  }, [hoveredPoint, invalidate]);
  
  // Handle selection highlight
  useEffect(() => {
    if (selectionRef.current && selectedPoint) {
      selectionRef.current.position.set(...selectedPoint.position);
      selectionRef.current.visible = true;
    } else if (selectionRef.current) {
      selectionRef.current.visible = false;
    }
    
    invalidate();
  }, [selectedPoint, invalidate]);

  // Handle raycasting for hover
  useFrame(() => {
    if (!points.current || isCameraMovingRef.current) return;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(points.current);
    
    if (intersects.length > 0) {
      const index = intersects[0].index;
      if (index !== undefined && index < data.length) {
        const point = data[index];
        if (hoveredPoint?.id !== point.id) {
          setHoveredPoint(point);
        }
      }
    } else if (hoveredPoint) {
      setHoveredPoint(null);
    }
  });

  // Handle click to select
  const handleClick = (event: THREE.Event) => {
    if (!points.current) return;
    
    event.stopPropagation();
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(points.current);
    
    if (intersects.length > 0) {
      const index = intersects[0].index;
      if (index !== undefined && index < data.length) {
        const point = data[index];
        // Check if in filtered data
        if (filteredData.some(p => p.id === point.id)) {
          setSelectedPoint(point);
        }
      }
    } else {
      setSelectedPoint(null);
    }
  };

  return (
    <group>
      <points 
        ref={points} 
        geometry={geometry} 
        material={material}
        onClick={handleClick}
      />
      
      {/* Highlight sphere for hover */}
      <mesh ref={highlightRef} visible={false} renderOrder={101}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#f97316" wireframe />
      </mesh>
      
      {/* Highlight sphere for selection */}
      <mesh ref={selectionRef} visible={false} renderOrder={102}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#f97316" wireframe={true} />
      </mesh>
    </group>
  );
}