"use client";

import React from 'react';
import { Line } from '@react-three/drei';
import type { PointWithCluster } from '../hooks/use-monte-carlo-data';

interface ConnectionLinesProps {
  point: PointWithCluster | null;
  closestPoints: PointWithCluster[];
  isSelected?: boolean;
  // selectedClusters prop removed as it's not used for styling lines anymore
}

export function ConnectionLines({
  point,
  closestPoints,
  isSelected = false,
}: ConnectionLinesProps) {
  if (!point || closestPoints.length === 0) return null;

  const lineColor = "#f97316"; // Orange for all connections (selected or hovered)
  const lineWidth = isSelected ? 3 : 2; // Thicker line if the central point is selected
  const opacity = isSelected ? 1 : 0.7; // More opaque if the central point is selected
  const renderOrderValue = isSelected ? 20 : 15; // Ensure lines are above points, selected lines are higher

  return (
    <>
      {closestPoints.map((closePoint) => (
        <Line
          key={`line-${point.id}-${closePoint.id}-${isSelected ? 'selected' : 'hover'}`}
          points={[point.position, closePoint.position]}
          color={lineColor}
          lineWidth={lineWidth}
          transparent
          opacity={opacity}
          renderOrder={renderOrderValue}
          // Optional: Add material props if needed for dashed lines, etc.
          // material={new THREE.LineBasicMaterial({ color: lineColor, linewidth: lineWidth, transparent: true, opacity: opacity })}
        />
      ))}
    </>
  );
} 