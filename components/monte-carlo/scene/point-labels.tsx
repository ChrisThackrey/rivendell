"use client";

import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { isPointInSelectedCluster, formatBatchId } from '../utils';

interface PointLabelsProps {
  data: PointWithCluster[];
  hoveredPoint: PointWithCluster | null;
  selectedPoint: PointWithCluster | null;
  closestPoints: PointWithCluster[]; // For hovered point
  selectedClosestPoints: PointWithCluster[]; // For selected point
  selectedClusters: number[];
}

export function PointLabels({
  data,
  hoveredPoint,
  selectedPoint,
  closestPoints,
  selectedClosestPoints,
  selectedClusters,
}: PointLabelsProps) {
  const visibleLabelPoints = useMemo(() => {
    const pointsToShow = new Set<string>();
    if (hoveredPoint) {
      pointsToShow.add(hoveredPoint.id);
      closestPoints.forEach((point) => pointsToShow.add(point.id));
    }
    if (selectedPoint) {
      pointsToShow.add(selectedPoint.id);
      selectedClosestPoints.forEach((point) => pointsToShow.add(point.id));
    }
    if (selectedClusters.length > 0) {
      data.filter(p => p.cluster && selectedClusters.includes(p.cluster))
          .slice(0, 10) // Limit labels for clusters
          .forEach(point => pointsToShow.add(point.id));
    }
    return pointsToShow;
  }, [hoveredPoint, selectedPoint, closestPoints, selectedClosestPoints, selectedClusters, data]);

  const hasSelectedClusters = selectedClusters.length > 0;

  return (
    <>
      {data.map((point) => {
        if (!visibleLabelPoints.has(point.id)) return null;

        const isSelected = selectedPoint?.id === point.id;
        const isHovered = hoveredPoint?.id === point.id;
        const isInSelectedCluster = isPointInSelectedCluster(point, selectedClusters);

        let bgColor = "bg-white/90";
        let textColor = "text-slate-800";

        if (isSelected) {
          bgColor = "bg-fuchsia-500/90"; textColor = "text-white font-medium";
        } else if (isHovered) {
          bgColor = hasSelectedClusters ? "bg-fuchsia-500/90" : "bg-green-300/90"; textColor = "text-white font-medium";
        } else if (isInSelectedCluster) {
          bgColor = "bg-green-300/90"; textColor = "text-white";
        }

        return (
          <Html key={`label-${point.id}`} position={[point.position[0], point.position[1] + 0.4, point.position[2]]} distanceFactor={10} occlude renderOrder={1000}>
            <div className={cn("flex flex-col items-center px-3 py-1.5 rounded-md shadow-md whitespace-nowrap text-center border border-gray-200", bgColor, textColor)} style={{ backdropFilter: "blur(4px)" }}>
              <div className="text-sm font-medium">{point.model}</div>
              <div className="text-xs">Run {point.runId}</div>
              {point.batchId && <div className="text-xs opacity-70">{formatBatchId(point.batchId)}</div>}
            </div>
          </Html>
        );
      })}
    </>
  );
} 