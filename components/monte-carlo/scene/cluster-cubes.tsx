"use client";

import React, { useMemo, useCallback } from 'react';
import { Text, Line, Box } from '@react-three/drei';
import type { MonteCarloCluster } from "@/lib/monte-carlo-service"; // Import needed types
// No need to import MonteCarloDataPoint here as it's not directly used

interface ClusterCubesProps {
  clusters: MonteCarloCluster[];
  toggleClusterSelection: (clusterId: number) => void;
  selectedClusters: number[];
  // filteredData and selectedBatchId removed as they are not used here
}

export function ClusterCubes({
  clusters,
  toggleClusterSelection,
  selectedClusters,
}: ClusterCubesProps) {

  const createCubeEdges = useCallback((size: [number, number, number], isSelected: boolean) => {
    const halfWidth = size[0] / 2, halfHeight = size[1] / 2, halfDepth = size[2] / 2;
    const corners = [
      [-halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, -halfDepth],
      [halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, halfDepth],
      [-halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth],
      [halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    return edges.map(([a, b]) => ({
      points: [corners[a], corners[b]],
      color: isSelected ? "#4ade80" : "#d1d5db", // Green for selected, gray otherwise
      lineWidth: isSelected ? 3 : 2,
    }));
  }, []);

  return (
    <>
      {clusters.map((cluster) => (
        <group key={`cluster-${cluster.id}`} position={cluster.position}>
          {/* Interactive group for the label */}
          <group
             position={[0, cluster.size[1] / 2 + 0.8, 0]} // Position label above cube
             onPointerDown={(e) => { e.stopPropagation(); toggleClusterSelection(cluster.id); }}
             // Add cursor style on hover if desired
             // onPointerOver={(e) => (e.object.parent.parent.style.cursor = 'pointer')}
             // onPointerOut={(e) => (e.object.parent.parent.style.cursor = 'auto')}
           >
            {/* Background plane for the label */}
            <mesh position={[0, 0, 0]} renderOrder={5}> {/* Ensure background is behind text */}
              <planeGeometry args={[cluster.label ? 14 : 7, 1.1]} />
              <meshBasicMaterial
                 color={selectedClusters.includes(cluster.id) ? "#4ade80" : "#ffffff"} // Match edge color when selected
                 opacity={0.9}
                 transparent={true}
                 depthWrite={false} // Don't occlude points behind it
               />
            </mesh>
            {/* Cluster Label Text */}
            <Text
              position={[0, 0, 0.01]} // Slightly in front of background
              fontSize={0.45}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              renderOrder={6} // Ensure text is in front of background
            >
              {cluster.label || `Cluster ${cluster.id}`}
            </Text>
          </group>
          {/* Cube Edges (Lines) */}
          {createCubeEdges(cluster.size, selectedClusters.includes(cluster.id)).map((edge, i) => (
            <Line
              key={`edge-${i}`}
              points={edge.points as [number, number, number][]} // Cast points for Line component
              color={edge.color}
              lineWidth={edge.lineWidth}
              renderOrder={4} // Render edges behind label background
              raycast={() => null} // Disable raycasting on lines
             />
          ))}
          {/* Invisible Box for layout/bounding (optional if not needed) */}
          {/* <Box args={cluster.size} visible={false} raycast={() => null}>
            <meshBasicMaterial visible={false} />
          </Box> */}
        </group>
      ))}
    </>
  );
} 