import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Flame, Snowflake } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PointWithCluster } from "@/lib/monte-carlo-service"
import { getModelCardColor, formatBatchId } from "./utils" // Use helpers from utils

interface DetailCardProps {
  point: PointWithCluster
  isMain?: boolean
  onSelect: (point: PointWithCluster) => void
}

export function DetailCard({ point, isMain = false, onSelect }: DetailCardProps) {
  const getTemperatureIcon = (temp: number) => {
    if (temp <= 0.3) return <Snowflake className="h-3.5 w-3.5 text-slate-600" />
    if (temp <= 0.5) return <Thermometer className="h-3.5 w-3.5 text-amber-500" />
    return <Flame className="h-3.5 w-3.5 text-red-500" />
  }

  const getTemperatureText = (temp: number) => {
    if (temp <= 0.3) return "Low"
    if (temp <= 0.5) return "Medium"
    return "High"
  }

  // Using orange for consistency with the 3D selection/hover color
  const selectionColor = "#f97316"

  return (
    <Card
      className={cn(
        "w-full",
        isMain ? `border-l-4 border-[${selectionColor}]` : "",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">
            {isMain ? "Selected Run" : "Related Run"}
          </CardTitle>
          <Badge variant="outline" className={getModelCardColor(point.model)}>
            {point.model}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap"> {/* Added flex-wrap */}
          <Badge variant="outline" className="flex items-center gap-1">
            {getTemperatureIcon(point.temperature)}
            <span>
              {getTemperatureText(point.temperature)} ({point.temperature})
            </span>
          </Badge>
          <Badge variant="outline" className="bg-slate-50">
            Run #{point.runId}
          </Badge>
          {point.cluster && (
            <Badge variant="outline" className="bg-slate-50">
              Cluster {point.cluster}
            </Badge>
          )}
          {point.batchId && (
            <Badge variant="outline" className="bg-slate-50">
              {formatBatchId(point.batchId)}
            </Badge>
          )}
        </div>

        <div className="text-xs text-slate-700">
          <p className="font-medium mb-1">Approach:</p>
          <p>{point.approach}</p>
        </div>

        <div className="text-xs text-slate-700">
          <p className="font-medium mb-1">Summary:</p>
          <p>{point.solutionSummary}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Time:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.executionTime}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Complexity:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.complexity}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Memory:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.memoryUsage}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Lines:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.lineCount}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Quality:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.codeQuality}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Convergence:</span>
            <span className="text-slate-700 font-medium">
              {point.metrics.convergenceScore}%
            </span>
          </div>
        </div>

        {/* Changed button color to match selection color */}
        <Button
          size="sm"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => onSelect(point)}
        >
          Select This Run
        </Button>
      </CardContent>
    </Card>
  )
} 