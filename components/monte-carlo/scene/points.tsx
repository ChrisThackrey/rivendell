"use client";

import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { findClosestPoints, SELECTION_COLOR, CLUSTER_SELECTION_COLOR } from '../utils';

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

// Brighter colors for better visibility
const BRIGHT_COLORS = {
  "gpt-4": "#3b82f6",    // blue-500
  "claude": "#8b5cf6",   // violet-500
  "o1": "#22c55e",       // green-500
  "o3": "#f59e0b",       // amber-500
  "other": "#64748b",    // slate-500
};

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
  const { gl, scene, camera } = useThree();
  const spheres = useRef<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  
  // Store a reference to selected/hovered point IDs
  // This helps avoid re-computation in getPointColor
  const selectedId = selectedPoint?.id || null;
  const hoveredId = hoveredPoint?.id || null;
  
  // Get color for a specific point based on its state
  const getPointColor = (point: PointWithCluster): string => {
    // Selected point
    if (selectedId && point.id === selectedId) {
      return SELECTION_COLOR;
    }
    
    // Points closest to selected point
    if (selectedPoint) {
      const closestToSelected = findClosestPoints(selectedPoint, data, 4);
      if (closestToSelected.some(p => p.id === point.id)) {
        return SELECTION_COLOR;
      }
    }
    
    // Hovered point
    if (hoveredId && point.id === hoveredId) {
      return SELECTION_COLOR;
    }
    
    // Points closest to hovered point
    if (hoveredPoint) {
      const closestToHovered = findClosestPoints(hoveredPoint, data, 4);
      if (closestToHovered.some(p => p.id === point.id)) {
        return SELECTION_COLOR;
      }
    }
    
    // Points in selected cluster
    if (selectedClusters.length > 0 && 
        selectedClusters.includes(point.cluster ?? -1)) {
      return CLUSTER_SELECTION_COLOR;
    }
    
    // Default color based on model
    const modelLower = point.model.toLowerCase().trim();
    if (modelLower.includes("gpt-4") || modelLower.includes("gpt4") || modelLower.includes("gpt-4o")) {
      return BRIGHT_COLORS["gpt-4"];
    }
    if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
      return BRIGHT_COLORS.claude;
    }
    if (modelLower.includes("o1")) {
      return BRIGHT_COLORS.o1;
    }
    if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
      return BRIGHT_COLORS.o3;
    }
    return BRIGHT_COLORS.other;
  };
  
  // Determine scale for a point
  const getPointScale = (point: PointWithCluster): number => {
    if (selectedId && point.id === selectedId) {
      return 1.2; // Selected points are larger
    }
    if (hoveredId && point.id === hoveredId) {
      return 1.1; // Hovered points are slightly larger
    }
    return 1;
  };
  
  // Check if a point should be visible (is in filteredData)
  const isPointVisible = (point: PointWithCluster): boolean => {
    return filteredData.some(p => p.id === point.id);
  };
  
  // Create and manage all spheres
  useEffect(() => {
    console.log("Points component mounted - creating spheres");
    
    // Create spheres parent group
    const group = new THREE.Group();
    group.name = "monte-carlo-points";
    scene.add(group);
    
    // Create a sphere for each data point
    const newSpheres: THREE.Mesh[] = [];
    
    data.forEach((point, index) => {
      // Create geometry and material
      const geometry = new THREE.SphereGeometry(0.10, 24, 24);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(getPointColor(point)),
        toneMapped: false
      });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(point.position[0], point.position[1], point.position[2]);
      mesh.userData = { pointId: point.id, pointData: point };
      
      // Set initial visibility based on filteredData
      mesh.visible = isPointVisible(point);
      
      // Add to group and tracking array
      group.add(mesh);
      newSpheres.push(mesh);
    });
    
    // Store reference to spheres
    spheres.current = newSpheres;
    
    // Add canvas click handler
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Handle mousemove for hover effects
    const handleMouseMove = (event: MouseEvent) => {
      // Skip hover processing if camera is moving, but don't reset existing hover
      if (isCameraMovingRef.current) return;
      
      // Get normalized mouse position
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Set up raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Check for intersections with our spheres
      const intersects = raycaster.intersectObjects(spheres.current.filter(s => s.visible), false);
      
      if (intersects.length > 0) {
        // Get the first hit
        const hitMesh = intersects[0].object as THREE.Mesh;
        const pointId = hitMesh.userData.pointId;
        const pointData = hitMesh.userData.pointData;
        
        // If it's a different point than the current hover
        if (pointData && pointData.id !== hoveredId) {
          console.log(`HOVER on point: ${pointData.id}`);
          setHoveredPoint(pointData);
          setClosestPoints(findClosestPoints(pointData, filteredData, 4));
        }
      } else if (hoveredPoint) {
        // Clear hover if we're not hovering over any point
        setHoveredPoint(null);
        setClosestPoints([]);
      }
    };
    
    // Handle clicks for selection
    const handleClick = (event: MouseEvent) => {
      // Don't process clicks during camera movement to prevent accidental deselection
      if (isCameraMovingRef.current) return;
      
      // Get normalized mouse position
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Check for intersections
      const intersects = raycaster.intersectObjects(spheres.current.filter(s => s.visible), false);
      
      if (intersects.length > 0) {
        // Get the first hit
        const hitMesh = intersects[0].object as THREE.Mesh;
        const pointData = hitMesh.userData.pointData as PointWithCluster;
        
        // Redundant check - the point should always be in filteredData if it's visible
        if (!filteredData.some(p => p.id === pointData.id)) return;
        
        console.log(`CLICK on point: ${pointData.id} (model: ${pointData.model})`);
        
        // Visual debug feedback
        const debugGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const debugMaterial = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          wireframe: true,
          depthTest: false
        });
        const debugSphere = new THREE.Mesh(debugGeometry, debugMaterial);
        debugSphere.position.copy(hitMesh.position);
        scene.add(debugSphere);
        
        // Remove debug after 2 seconds
        setTimeout(() => {
          scene.remove(debugSphere);
        }, 2000);
        
        // Toggle selection
        if (selectedId === pointData.id) {
          console.log(`DESELECTING point: ${pointData.id}`);
          setSelectedPoint(null);
        } else {
          console.log(`SELECTING point: ${pointData.id}`);
          setSelectedPoint(pointData);
        }
        
        // Force update materials
        updatePointColors();
      }
    };
    
    // Add event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    // Update colors and visibility when state changes
    const updatePointColors = () => {
      // Log selection state for debugging
      console.log(`Updating colors - selectedId: ${selectedId}, hoveredId: ${hoveredId}, filtered points: ${filteredData.length}`);
      
      spheres.current.forEach(sphere => {
        const pointData = sphere.userData.pointData as PointWithCluster;
        if (!pointData) return;
        
        // Update visibility based on filteredData
        sphere.visible = isPointVisible(pointData);
        
        // Skip further updates if not visible
        if (!sphere.visible) return;
        
        // Update color - ensure selection colors take precedence
        const color = getPointColor(pointData);
        (sphere.material as THREE.MeshBasicMaterial).color.set(color);
        
        // Make selected points bigger for better visibility during camera movement
        let scale = 1.0;
        
        // Selected point or its closest points should be bigger
        if (selectedId && (pointData.id === selectedId || 
            (selectedPoint && findClosestPoints(selectedPoint, data, 4).some(p => p.id === pointData.id)))) {
          scale = 1.2;
        }
        // Hovered point should be slightly bigger (if not already selected)
        else if (hoveredId && pointData.id === hoveredId) {
          scale = 1.1;
        }
        
        sphere.scale.set(scale, scale, scale);
      });
    };
    
    // Update immediately after creation
    updatePointColors();
    
    // Set up interval to update colors - run more frequently to ensure selection remains visible
    const colorInterval = setInterval(updatePointColors, 50);
    
    // Clean up on unmount
    return () => {
      console.log("Points component unmounting - cleaning up");
      
      // Remove event listeners
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      
      // Clear update interval
      clearInterval(colorInterval);
      
      // Remove all spheres and group
      scene.remove(group);
      
      // Dispose geometries and materials
      spheres.current.forEach(sphere => {
        sphere.geometry.dispose();
        (sphere.material as THREE.MeshBasicMaterial).dispose();
      });
      
      // Clear reference
      spheres.current = [];
    };
  }, [
    scene, gl, camera, data, filteredData, 
    selectedPoint, hoveredPoint, selectedClusters,
    setSelectedPoint, setHoveredPoint, setClosestPoints,
    isCameraMovingRef, selectedId, hoveredId
  ]);
  
  // Return nothing - all rendering handled imperatively
  return null;
}