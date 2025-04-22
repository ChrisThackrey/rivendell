import React from "react"
import type { PointWithCluster, MonteCarloCluster } from "@/lib/monte-carlo-service"
import { DetailCard } from "./DetailCard" // Import the DetailCard component

interface DetailsPanelProps {
  selectedPoint: PointWithCluster | null
  selectedClosestPoints: PointWithCluster[]
  selectedClusterPoints: PointWithCluster[] // Points belonging to selected clusters
  selectedClusters: number[] // IDs of selected clusters
  hoveredPoint: PointWithCluster | null
  closestPoints: PointWithCluster[] // Closest to hovered point
  clusters: MonteCarloCluster[] // All clusters for title lookup
  handleSelectPoint: (point: PointWithCluster) => void
}

export function DetailsPanel({
  selectedPoint,
  selectedClosestPoints,
  selectedClusterPoints,
  selectedClusters,
  hoveredPoint,
  closestPoints,
  clusters,
  handleSelectPoint,
}: DetailsPanelProps) {
  // Helper to get the title for the selected cluster(s)
  const getSelectedClusterTitle = () => {
    if (selectedClusters.length === 1) {
      const cluster = clusters.find((c) => c.id === selectedClusters[0])
      return cluster ? cluster.label : ""
    } else if (selectedClusters.length > 1) {
      return "Multiple Clusters"
    }
    return ""
  }

  return (
    <div className="col-span-12 md:col-span-12 lg:col-span-3 space-y-4 overflow-y-auto h-full pr-2 pb-4">
      {selectedClusterPoints.length > 0 ? (
        // Case 1: Clusters are selected
        <>
          <div className="px-4 py-2 bg-green-100/40 rounded-md mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Cluster: {getSelectedClusterTitle()}
            </h3>
            <span className="text-sm text-slate-600">
              {selectedClusterPoints.length} Points
            </span>
          </div>
          <div className="space-y-3">
            {/* Show up to 10 points from the selected cluster(s) */}
            {selectedClusterPoints.slice(0, 10).map((point) => (
              <DetailCard
                key={`cluster-point-${point.id}`}
                point={point}
                onSelect={handleSelectPoint}
                isMain={selectedPoint?.id === point.id} // Highlight if it's also the selected point
              />
            ))}
            {selectedClusterPoints.length > 10 && (
              <p className="text-xs text-center text-slate-500">
                + {selectedClusterPoints.length - 10} more points not shown
              </p>
            )}
          </div>
        </>
      ) : selectedPoint ? (
        // Case 2: A specific point is selected
        <>
          <DetailCard
            key={`selected-${selectedPoint.id}`}
            point={selectedPoint}
            isMain={true}
            onSelect={handleSelectPoint}
          />
          <h3 className="text-sm font-medium text-slate-600 mt-4">
            Closest Related Runs
          </h3>
          <div className="space-y-3">
            {selectedClosestPoints.map((point) => (
              <DetailCard
                key={`selected-closest-${point.id}`}
                point={point}
                onSelect={handleSelectPoint}
              />
            ))}
          </div>
        </>
      ) : hoveredPoint ? (
        // Case 3: A point is hovered (and nothing is selected)
        <>
          <DetailCard
            key={`hovered-${hoveredPoint.id}`}
            point={hoveredPoint}
            isMain={true} // Treat hovered as the main focus when nothing else is selected
            onSelect={handleSelectPoint}
          />
          <h3 className="text-sm font-medium text-slate-600 mt-4">
            Closest Related Runs
          </h3>
          <div className="space-y-3">
            {closestPoints.map((point) => (
              <DetailCard
                key={`hovered-closest-${point.id}`}
                point={point}
                onSelect={handleSelectPoint}
              />
            ))}
          </div>
        </>
      ) : (
        // Case 4: Nothing selected or hovered
        <div className="bg-white rounded-lg shadow-md p-6 text-center text-slate-500 h-full flex items-center justify-center">
          <div>
            Click on any point in the visualization to select it and see details,
            or toggle a cluster to view all points in that group.
          </div>
        </div>
      )}
    </div>
  )
} 