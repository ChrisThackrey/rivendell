import React, { useMemo } from "react"
import { Html } from "@react-three/drei"
import type { PointWithCluster } from "@/lib/monte-carlo-service"
import { isPointInSelectedCluster, formatBatchId } from "./utils"

interface PointLabelsProps {
  data: PointWithCluster[]; // All points data
  hoveredPoint: PointWithCluster | null;
  selectedPoint: PointWithCluster | null;
  closestPoints: PointWithCluster[]; // Closest to hovered
  selectedClosestPoints: PointWithCluster[]; // Closest to selected
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
  // Determine which points should have visible labels
  const visibleLabelPoints = useMemo(() => {
    const pointsToShow = new Set<string>()

    // Add hovered point and its closest points
    if (hoveredPoint) {
      pointsToShow.add(hoveredPoint.id)
      closestPoints.forEach((point) => pointsToShow.add(point.id))
    }

    // Add selected point and its closest points
    if (selectedPoint) {
      pointsToShow.add(selectedPoint.id)
      selectedClosestPoints.forEach((point) => pointsToShow.add(point.id))
    }

    // Add points for any selected clusters (limit to avoid crowding)
    if (selectedClusters.length > 0) {
      const clusterPoints = data
        .filter((p) => p.cluster && selectedClusters.includes(p.cluster))
        .slice(0, 10) // Limit to 10 labels for clusters

      clusterPoints.forEach((point) => pointsToShow.add(point.id))
    }

    return pointsToShow
  }, [
    hoveredPoint,
    selectedPoint,
    closestPoints,
    selectedClosestPoints,
    selectedClusters,
    data,
  ])

  // Check if any clusters are selected to adjust styling
  const hasSelectedClusters = selectedClusters.length > 0

  return (
    <>
      {data.map((point) => {
        // Only render labels for points in the visible set
        if (!visibleLabelPoints.has(point.id)) return null

        const isSelected = selectedPoint?.id === point.id
        const isHovered = hoveredPoint?.id === point.id
        const isInSelectedCluster = isPointInSelectedCluster(point, selectedClusters)

        // Determine label style based on state (consistent with original logic)
        let bgColor = "bg-white/90"
        let textColor = "text-slate-800"

        if (isSelected) {
          bgColor = "bg-orange-500/90" // Use orange for selected
          textColor = "text-white font-medium"
        } else if (isHovered) {
          bgColor = "bg-orange-500/90" // Use orange for hovered
          textColor = "text-white font-medium"
        } else if (isInSelectedCluster) {
          bgColor = "bg-green-300/90" // Green for points in selected clusters
          textColor = "text-slate-800" // Adjust text color for better contrast on green
        }

        return (
          <Html
            key={`label-${point.id}`}
            position={[
              point.position[0],
              point.position[1] + 0.25, // Adjust vertical offset slightly
              point.position[2],
            ]}
            distanceFactor={10} // Controls scaling with distance
            occlude // Hides label if behind other geometry
            center // Centers the HTML content on the position
            zIndexRange={[100, 0]} // Render labels on top
            className="pointer-events-none select-none" // Prevent interaction with labels
            transform // Apply transform to keep labels upright
          >
            <div
              className={`flex flex-col items-center px-2 py-1 rounded-md shadow text-center ${bgColor} ${textColor} border border-gray-200/50 whitespace-nowrap`}
              style={{ backdropFilter: "blur(2px)", fontSize: '10px' }} // Smaller font size
            >
              <div className="font-medium">{point.model}</div>
              <div className="opacity-80">Run {point.runId}</div>
              {point.batchId && (
                <div className="opacity-60">
                  {formatBatchId(point.batchId).split('(')[0]} {/* Show only date part */}
                </div>
              )}
            </div>
          </Html>
        )
      })}
    </>
  )
} 