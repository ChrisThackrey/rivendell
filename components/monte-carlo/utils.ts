import * as THREE from "three"
import type { PointWithCluster } from "@/lib/monte-carlo-service"
import { normalizeAndSpreadPoints, addJitterToPoints } from "@/lib/monte-carlo-service"

// Get color for a model (point colors)
export const getModelColor = (model: string): THREE.Color => {
  const modelLower = model.toLowerCase().trim()
  if (modelLower.includes("gpt-4o") || modelLower.includes("gpt4o") || modelLower.includes("gpt-4")) {
    return new THREE.Color("#93c5fd") // blue-300 - matches ModelLegend
  }
  if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
    return new THREE.Color("#c4b5fd") // violet-300 - matches ModelLegend
  }
  if (modelLower.includes("o1")) {
    return new THREE.Color("#86efac") // green-300 - matches ModelLegend
  }
  if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
    return new THREE.Color("#fcd34d") // amber-300 - matches ModelLegend
  }
  return new THREE.Color("#cbd5e1") // slate-300 - matches ModelLegend
}

// Get hex color string for selection and lines
export const getSelectionColor = (
  type: "point" | "cluster" | "hover" = "cluster",
): string => {
  if (type === "point") return "#f97316" // Orange for selected points
  if (type === "hover") return "#f97316" // Bright orange for hover state
  return "#4ade80" // Brighter green for clusters
}

// Check if a point is in a selected cluster
export const isPointInSelectedCluster = (
  point: PointWithCluster,
  selectedClusters: number[],
): boolean => {
  return selectedClusters.includes(point.cluster ?? -1)
}

// Helper function to find closest points
export function findClosestPoints(point: PointWithCluster, allPoints: PointWithCluster[], count: number): PointWithCluster[] {
  return allPoints
    .filter((p) => p.id !== point.id)
    .map((p) => {
      const dx = point.position[0] - p.position[0]
      const dy = point.position[1] - p.position[1]
      const dz = point.position[2] - p.position[2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      return { point: p, distance }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((item) => item.point)
}

// Get model color for cards and badges
export const getModelCardColor = (model: string) => {
  if (model.includes("GPT")) return "bg-blue-100 text-blue-500 border-blue-200"
  if (model.includes("Claude")) return "bg-violet-100 text-violet-500 border-violet-200"
  if (model.includes("o1")) return "bg-green-100 text-green-500 border-green-200"
  if (model.includes("o3")) return "bg-amber-100 text-amber-500 border-amber-200"
  return "bg-slate-100 text-slate-500 border-slate-200"
}

// Format a batch ID to be more readable
export const formatBatchId = (batchId: string): string => {
  const timestampMatch = batchId.match(/batch_(\d+)_/)
  if (timestampMatch && timestampMatch[1]) {
    const timestamp = parseInt(timestampMatch[1], 10)
    if (!isNaN(timestamp)) {
      try {
        const date = new Date(timestamp * 1000)
        const formattedDate = date.toLocaleString()
        const uniquePart = batchId.split("_").slice(2).join("_")
        // Limit unique part length if needed
        const displayPart = uniquePart.length > 15 ? uniquePart.substring(0, 12) + "..." : uniquePart
        return `${formattedDate} (${displayPart})`
      } catch (e) {
        console.error("Error formatting date:", e)
      }
    }
  }
  return batchId.replace("batch_", "Batch ").replace(/_/g, " ").substring(0, 30) + (batchId.length > 30 ? "..." : "")
}

// Type for point detection results
export interface PointDetectionResult {
  index: number
  distance: number
} 