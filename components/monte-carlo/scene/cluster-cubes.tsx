"use client";

import React, { useCallback } from 'react';
import { Text, Line } from '@react-three/drei';
import type { MonteCarloCluster } from "@/lib/monte-carlo-service";

interface ClusterCubesProps {
  clusters: MonteCarloCluster[];
  toggleClusterSelection: (clusterId: number) => void;
  selectedClusters: number[];
}

export function ClusterCubes({
  clusters,
  toggleClusterSelection,
  selectedClusters,
}: ClusterCubesProps) {
  // Color for selection matches the legend (green-400)
  const SELECTION_COLOR = "#4ade80";
  const DEFAULT_COLOR = "#d1d5db";

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
      color: isSelected ? SELECTION_COLOR : DEFAULT_COLOR,
      lineWidth: isSelected ? 3 : 2,
    }));
  }, []);

  return (
    <>
      {clusters.map((cluster) => {
        const isSelected = selectedClusters.includes(cluster.id);
        
        return (
          <group key={`cluster-${cluster.id}`} position={cluster.position}>
            {/* Cluster label */}
            <group
              position={[0, cluster.size[1] / 2 + 0.8, 0]}
              onClick={(e) => { 
                e.stopPropagation(); 
                toggleClusterSelection(cluster.id); 
              }}
            >
              {/* Background for label */}
              <mesh position={[0, 0, 0]} renderOrder={5}>
                <planeGeometry args={[cluster.label ? 14 : 7, 1.1]} />
                <meshBasicMaterial
                  color={isSelected ? SELECTION_COLOR : "#ffffff"}
                  opacity={0.9}
                  transparent={true}
                  depthWrite={false}
                />
              </mesh>
              
              {/* Label text */}
              <Text
                position={[0, 0, 0.01]}
                fontSize={0.45}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                renderOrder={6}
              >
                {cluster.label || `Cluster ${cluster.id}`}
              </Text>
            </group>
            
            {/* Cube edges */}
            {createCubeEdges(cluster.size, isSelected).map((edge, i) => (
              <Line
                key={`edge-${i}`}
                points={edge.points as [number, number, number][]}
                color={edge.color}
                lineWidth={edge.lineWidth}
                renderOrder={4}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  toggleClusterSelection(cluster.id); 
                }}
              />
            ))}
          </group>
        );
      })}
    </>
  );
}