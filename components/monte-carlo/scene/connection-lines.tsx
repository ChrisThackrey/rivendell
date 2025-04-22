"use client";

import React from 'react';
import { Line } from '@react-three/drei';
import type { PointWithCluster } from '@/lib/monte-carlo-service';

interface ConnectionLinesProps {
  point: PointWithCluster | null;
  closestPoints: PointWithCluster[];
  isSelected?: boolean;
}

export function ConnectionLines({
  point,
  closestPoints,
  isSelected = false,
}: ConnectionLinesProps) {
  if (!point || closestPoints.length === 0) return null;

  // Use orange-500 for user selections (same as in ModelLegend)
  const lineColor = "#f97316"; // orange-500 
  const lineWidth = isSelected ? 3 : 2;
  const opacity = isSelected ? 1 : 0.7;
  const renderOrderValue = isSelected ? 20 : 15;

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
        />
      ))}
    </>
  );
}