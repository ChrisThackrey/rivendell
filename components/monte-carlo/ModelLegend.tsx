import React, { useMemo } from "react"
import type { PointWithCluster } from "@/lib/monte-carlo-service"

interface ModelLegendProps {
  selectedModelFilter: string | null
  onModelFilterChange: (model: string | null) => void
  data: PointWithCluster[] // Needed to calculate counts
}

// Define model display names for UI (can be moved to constants if needed)
const modelColorNames: Record<string, string> = {
  "gpt-4": "GPT-4o",
  claude: "Claude",
  o1: "o1",
  o3: "o3-mini",
  other: "Other",
}

export function ModelLegend({
  selectedModelFilter,
  onModelFilterChange,
  data,
}: ModelLegendProps) {
  // These colors should ideally come from a central config or utils
  const modelColors = [
    { color: "#93c5fd", label: "GPT-4o", value: "gpt-4" }, // blue-300
    { color: "#c4b5fd", label: "Claude", value: "claude" }, // violet-300
    { color: "#86efac", label: "o1", value: "o1" }, // green-300
    { color: "#fcd34d", label: "o3-mini", value: "o3" }, // amber-300
    { color: "#cbd5e1", label: "Other", value: "other" }, // slate-300
  ]

  const interactionColors = [
    { color: "#f97316", label: "User Selection" }, // orange-500
    { color: "#4ade80", label: "Cluster Selection" }, // green-400
  ]

  // Calculate counts for each model type based on the *provided* data
  const modelCounts = useMemo(() => {
    const counts: Record<string, number> = {
      "gpt-4": 0,
      claude: 0,
      o1: 0,
      o3: 0,
      other: 0,
    }

    data.forEach((point) => {
      const modelLower = point.model.toLowerCase()
      if (modelLower.includes("gpt-4") || modelLower.includes("gpt4") || modelLower.includes("gpt-4o")) {
        counts["gpt-4"]++
      } else if (modelLower.includes("claude")) {
        counts["claude"]++
      } else if (modelLower.includes("o1") && !modelLower.includes("gpt")) {
        counts["o1"]++
      } else if (modelLower.includes("o3") || modelLower.includes("o3-mini")) {
        counts["o3"]++
      } else {
        counts["other"]++
      }
    })
    return counts
  }, [data])

  return (
    <div className="bg-white p-3 rounded-md shadow-md border border-gray-200 z-10">
      <div className="text-xs font-medium mb-2 text-slate-700">
        Model Colors (Click to Filter)
      </div>
      <div className="flex flex-col gap-1.5">
        {modelColors.map((item) => (
          <div
            key={item.value}
            className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-50 ${selectedModelFilter === item.value ? "bg-slate-100 font-medium" : ""}`}
            onClick={() => onModelFilterChange(selectedModelFilter === item.value ? null : item.value)}
            tabIndex={0}
            role="button"
            aria-pressed={selectedModelFilter === item.value}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onModelFilterChange(selectedModelFilter === item.value ? null : item.value)
              }
            }}
          >
            <div
              className="h-3 w-3 rounded-full border border-gray-300" // Added border for lighter colors
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-900">{item.label}</span>
            <span className="text-slate-500 text-xs ml-auto mr-1">
              ({modelCounts[item.value]})
            </span>
            {selectedModelFilter === item.value && (
              <div className="ml-0">
                {/* Simple indicator for selection */}
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 my-2" />

      <div className="text-xs font-medium mb-2 text-slate-700">
        Interactions
      </div>
      <div className="flex flex-col gap-1.5">
        {interactionColors.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="h-3 w-3 rounded-full border border-gray-300" // Added border
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-900">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
} 