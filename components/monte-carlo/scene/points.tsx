"use client";

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { findClosestPoints, MODEL_VIZ_COLORS, SELECTION_COLOR, CLUSTER_SELECTION_COLOR } from '../utils';

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
  const groupRef = useRef<THREE.Group>(null);
  const { raycaster, camera, mouse } = useThree();
  
  // Find closest points to selected/hovered
  const getRelatedPoints = useMemo(() => {
    const selectedClosestPoints = selectedPoint 
      ? findClosestPoints(selectedPoint, data, 4) 
      : [];
      
    const hoveredClosestPoints = hoveredPoint 
      ? findClosestPoints(hoveredPoint, data, 4) 
      : [];
      
    // Create an identifier map for quick lookups
    const relatedPoints = new Map<string, { 
      isSelected: boolean; 
      isHovered: boolean; 
      isClosestToSelected: boolean;
      isClosestToHovered: boolean;
      isInSelectedCluster: boolean;
    }>();
    
    // Mark all points first with defaults
    data.forEach(point => {
      const isInSelectedCluster = selectedClusters.includes(point.cluster ?? -1);
      
      relatedPoints.set(point.id, {
        isSelected: selectedPoint?.id === point.id,
        isHovered: hoveredPoint?.id === point.id,
        isClosestToSelected: selectedClosestPoints.some(p => p.id === point.id),
        isClosestToHovered: hoveredClosestPoints.some(p => p.id === point.id),
        isInSelectedCluster
      });
    });
    
    return relatedPoints;
  }, [data, selectedPoint, hoveredPoint, selectedClusters]);

  // Handle raycasting for hover/selection
  useFrame(() => {
    if (!groupRef.current || isCameraMovingRef.current) return;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(groupRef.current.children, true);
    
    if (intersects.length > 0) {
      // Get the index from the object's userData
      const userData = intersects[0].object.userData;
      if (userData && userData.pointId) {
        const point = data.find(p => p.id === userData.pointId);
        if (point && point.id !== hoveredPoint?.id) {
          setHoveredPoint(point);
          setClosestPoints(findClosestPoints(point, data, 4));
        }
      }
    } else if (hoveredPoint) {
      setHoveredPoint(null);
      setClosestPoints([]);
    }
  });

  // Handle point selection
  const handleClick = (pointId: string) => {
    const point = data.find(p => p.id === pointId);
    if (point && filteredData.some(p => p.id === point.id)) {
      setSelectedPoint(point === selectedPoint ? null : point);
    }
  };

  // Get color for a point based on its state
  const getPointColor = (pointId: string): string => {
    const pointState = getRelatedPoints.get(pointId);
    if (!pointState) return MODEL_VIZ_COLORS.other;
    
    const { isSelected, isHovered, isClosestToSelected, isClosestToHovered, isInSelectedCluster } = pointState;
    
    // Order of precedence for coloring
    if (isSelected || isClosestToSelected) {
      return SELECTION_COLOR;
    } else if (isHovered || isClosestToHovered) {
      return SELECTION_COLOR;
    } else if (isInSelectedCluster) {
      return CLUSTER_SELECTION_COLOR;
    }
    
    // Default: use model color based on the point's model
    const point = data.find(p => p.id === pointId);
    if (!point) return MODEL_VIZ_COLORS.other;
    
    const modelLower = point.model.toLowerCase().trim();
    if (modelLower.includes("gpt-4") || modelLower.includes("gpt4") || modelLower.includes("gpt-4o")) {
      return MODEL_VIZ_COLORS["gpt-4"];
    }
    if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
      return MODEL_VIZ_COLORS.claude;
    }
    if (modelLower.includes("o1")) {
      return MODEL_VIZ_COLORS.o1;
    }
    if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
      return MODEL_VIZ_COLORS.o3;
    }
    return MODEL_VIZ_COLORS.other;
  };

  // Add subtle effects based on state
  const getPointScale = (pointId: string): number => {
    const pointState = getRelatedPoints.get(pointId);
    if (!pointState) return 1;
    
    const { isSelected, isHovered } = pointState;
    if (isSelected) return 1.2; // Make selected points slightly larger 
    if (isHovered) return 1.1; // Make hovered points slightly larger
    return 1;
  };

  return (
    <group ref={groupRef}>
      <Instances limit={data.length}>
        {/* Use smaller radius for the spheres (0.12 instead of 0.15) */}
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial roughness={0.4} metalness={0.1} />
        
        {data.map((point, index) => (
          <Instance 
            key={point.id}
            position={[point.position[0], point.position[1], point.position[2]]}
            color={getPointColor(point.id)}
            scale={getPointScale(point.id)}
            userData={{ pointId: point.id, pointIndex: index }}
            onClick={() => handleClick(point.id)}
          />
        ))}
      </Instances>
    </group>
  );
}