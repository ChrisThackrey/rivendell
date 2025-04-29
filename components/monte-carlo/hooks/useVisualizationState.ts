import { useState, useEffect, useCallback, useMemo } from "react"
import type { MonteCarloDataPoint, PointWithCluster, MonteCarloCluster } from "@/lib/monte-carlo-service"
import { findClosestPoints } from "../utils" // Assuming utils.ts is in the parent directory

export function useVisualizationState(
  data: PointWithCluster[], // Full dataset from useMonteCarloData
) {
  const [hoveredPoint, setHoveredPoint] = useState<PointWithCluster | null>(null)
  const [closestPoints, setClosestPoints] = useState<PointWithCluster[]>([]) // Closest to hovered
  const [selectedPoint, setSelectedPoint] = useState<PointWithCluster | null>(null)
  const [selectedClosestPoints, setSelectedClosestPoints] = useState<PointWithCluster[]>([]) // Closest to selected
  const [selectedClusters, setSelectedClusters] = useState<number[]>([])
  const [selectedClusterPoints, setSelectedClusterPoints] = useState<PointWithCluster[]>([])
  const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null)

  // Calculate filtered data based on the model filter
  const filteredData = useMemo(() => {
    if (selectedModelFilter === null) {
      return data
    } else {
      return data.filter((point) => {
        const modelLower = point.model.toLowerCase()
        if (selectedModelFilter === "gpt-4" && (modelLower.includes("gpt-4") || modelLower.includes("gpt4") || modelLower.includes("gpt-4o"))) return true
        if (selectedModelFilter === "claude" && modelLower.includes("claude")) return true
        if (selectedModelFilter === "o1" && modelLower.includes("o1") && !modelLower.includes("gpt")) return true
        if (selectedModelFilter === "o3" && (modelLower.includes("o3") || modelLower.includes("o3-mini"))) return true
        if (selectedModelFilter === "other" && !modelLower.includes("gpt") && !modelLower.includes("claude") && !modelLower.includes("o1") && !modelLower.includes("o3")) return true
        return false
      })
    }
  }, [selectedModelFilter, data])

  // Update selected closest points when selected point changes
  useEffect(() => {
    if (selectedPoint && data.length > 0) {
      setSelectedClosestPoints(findClosestPoints(selectedPoint, data, 4))
    } else {
      setSelectedClosestPoints([])
    }
  }, [selectedPoint, data])

  // Update selected cluster points when selected clusters change or filteredData changes
  useEffect(() => {
    if (selectedClusters.length > 0) {
      const points = filteredData.filter(
        (point) => point.cluster && selectedClusters.includes(point.cluster),
      )
      setSelectedClusterPoints(points)
    } else {
      setSelectedClusterPoints([])
    }
  }, [selectedClusters, filteredData])

  // Function to deselect all points and clusters
  const handleDeselectAll = useCallback(() => {
    setSelectedPoint(null)
    setSelectedClusters([])
    setHoveredPoint(null) // Also clear hover on deselect
    setClosestPoints([])
  }, [])

  // Toggle cluster selection
  const toggleClusterSelection = useCallback((clusterId: number) => {
    setSelectedClusters((prev) => {
      if (prev.includes(clusterId)) {
        // Deselecting
        if (selectedPoint && selectedPoint.cluster === clusterId) {
          setSelectedPoint(null) // Deselect point if it was in the deselected cluster
        }
        return prev.filter((id) => id !== clusterId)
      } else {
        // Selecting
        // Optionally select the first point in the cluster as representative
        // const clusterPoints = filteredData.filter((point) => point.cluster === clusterId);
        // if (clusterPoints.length > 0 && (!selectedPoint || selectedPoint.cluster !== clusterId)) {
        //   setSelectedPoint(clusterPoints[0]);
        // }
        return [...prev, clusterId]
      }
    })
  }, [selectedPoint, filteredData]) // Add filteredData dependency if selecting first point

  // Handler for selecting a point (e.g., from DetailCard)
  const handleSelectPoint = useCallback((point: PointWithCluster) => {
    // If we're selecting the same point that's already selected, keep the selection state
    // This prevents toggling off selection when clicking "Select This Run" on the current point
    if (selectedPoint?.id === point.id) {
      return; // Do nothing if it's already the selected point
    }
    
    setSelectedPoint(point)
    // Don't automatically select the cluster - focus only on the point
    setSelectedClusters([]) // Clear cluster selection when a specific point is chosen
  }, [selectedPoint])

  // Add key press event listener for Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDeselectAll()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleDeselectAll])

  return {
    hoveredPoint,
    setHoveredPoint,
    closestPoints,
    setClosestPoints,
    selectedPoint,
    setSelectedPoint, // Expose setter if needed by Points component
    selectedClosestPoints,
    selectedClusters,
    setSelectedClusters, // Expose setter if needed
    selectedClusterPoints,
    selectedModelFilter,
    setSelectedModelFilter, // Expose setter for ModelLegend
    filteredData,
    handleDeselectAll,
    toggleClusterSelection,
    handleSelectPoint,
  }
} 