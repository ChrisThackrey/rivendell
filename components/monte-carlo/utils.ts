import * as THREE from "three"
import type { PointWithCluster } from "@/lib/monte-carlo-service"
import { normalizeAndSpreadPoints, addJitterToPoints } from "@/lib/monte-carlo-service"

// Legend colors exactly as shown in the ModelLegend component
export const MODEL_LEGEND_COLORS = {
  "gpt-4": "#93c5fd",   // Light blue (GPT-4o)
  "claude": "#c4b5fd",  // Light purple (Claude)
  "o1": "#86efac",      // Light green (o1)
  "o3": "#fcd34d",      // Light amber (o3-mini)
  "other": "#cbd5e1",   // Light gray (Other)
};

// Visualization colors - bright 500-level colors for better visibility in 3D view
export const MODEL_VIZ_COLORS = {
  "gpt-4": "#3b82f6",   // blue-500 - Bright blue (GPT-4o)
  "claude": "#8b5cf6",  // violet-500 - Bright purple (Claude)
  "o1": "#22c55e",      // green-500 - Bright green (o1)
  "o3": "#f59e0b",      // amber-500 - Bright amber (o3-mini)
  "other": "#64748b",   // slate-500 - Medium gray (Other)
};

// Get color for a model (point colors) - for the 3D view
export const getModelColor = (model: string): THREE.Color => {
  const modelLower = model.toLowerCase().trim()
  if (modelLower.includes("gpt-4o") || modelLower.includes("gpt4o") || modelLower.includes("gpt-4")) {
    return new THREE.Color(MODEL_VIZ_COLORS["gpt-4"])
  }
  if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
    return new THREE.Color(MODEL_VIZ_COLORS.claude)
  }
  if (modelLower.includes("o1")) {
    return new THREE.Color(MODEL_VIZ_COLORS.o1)
  }
  if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
    return new THREE.Color(MODEL_VIZ_COLORS.o3)
  }
  return new THREE.Color(MODEL_VIZ_COLORS.other)
}

// Get the legend color for a model (for UI display)
export const getModelLegendColor = (model: string): string => {
  const modelLower = model.toLowerCase().trim()
  if (modelLower.includes("gpt-4o") || modelLower.includes("gpt4o") || modelLower.includes("gpt-4")) {
    return MODEL_LEGEND_COLORS["gpt-4"]
  }
  if (modelLower.includes("claude-sonnet") || modelLower.includes("claude")) {
    return MODEL_LEGEND_COLORS.claude
  }
  if (modelLower.includes("o1")) {
    return MODEL_LEGEND_COLORS.o1
  }
  if (modelLower.includes("o3-mini") || modelLower.includes("o3")) {
    return MODEL_LEGEND_COLORS.o3
  }
  return MODEL_LEGEND_COLORS.other
}

// Selection colors from the legend - these match the screenshot exactly
export const SELECTION_COLOR = "#f97316";  // orange-500 - User Selection
export const CLUSTER_SELECTION_COLOR = "#4ade80"; // green-400 - Cluster Selection

// Get hex color string for selection and lines
export const getSelectionColor = (
  type: "point" | "cluster" | "hover" = "cluster",
): string => {
  if (type === "point") return SELECTION_COLOR // Orange-500 for selected points
  if (type === "hover") return SELECTION_COLOR // Same orange for hover state
  return CLUSTER_SELECTION_COLOR // Green-400 for clusters
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