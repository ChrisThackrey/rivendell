"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  Flame,
  Snowflake,
  Check,
  X,
  Play,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { ModelConfig } from "./ensemble-selection-modal";
import { cn } from "@/lib/utils";

// Add types for tracking run status
type ModelRunStatus = {
  modelId: number;
  temperature: "low" | "medium" | "high";
  status: "pending" | "active" | "completed" | "error";
};

type EnsembleConfigCardProps = {
  id: string;
  models: ModelConfig[];
  selectedIntensity: "low" | "medium" | "high";
  delay?: number;
  // Add new props for tracking run status
  completedRuns?: ModelRunStatus[];
  activeRuns?: ModelRunStatus[];
  errorRuns?: ModelRunStatus[];
  totalRuns?: number;
  completedCount?: number;
  errorCount?: number;
};

export default function EnsembleConfigCard({
  id,
  models,
  selectedIntensity,
  delay = 0,
  completedRuns = [],
  activeRuns = [],
  errorRuns = [],
  totalRuns = 0,
  completedCount = 0,
  errorCount = 0,
}: EnsembleConfigCardProps) {
  const getModelColor = (model: string) => {
    if (model.includes("GPT"))
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (model.includes("Claude"))
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (model.includes("o1"))
      return "bg-purple-50 text-purple-700 border-purple-200";
    if (model.includes("o3"))
      return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getIntensityIcon = (intensity: "low" | "medium" | "high") => {
    if (intensity === "low")
      return <Snowflake className="h-3.5 w-3.5 text-slate-600" />;
    if (intensity === "medium")
      return <Thermometer className="h-3.5 w-3.5 text-amber-500" />;
    return <Flame className="h-3.5 w-3.5 text-red-500" />;
  };

  const getIntensityText = (intensity: "low" | "medium" | "high") => {
    if (intensity === "low") return "Low (0.3)";
    if (intensity === "medium") return "Medium (0.5)";
    return "High (0.7)";
  };

  const getIntensityClass = (intensity: "low" | "medium" | "high") => {
    if (intensity === "low") return "bg-slate-100 text-slate-600";
    if (intensity === "medium") return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  // Function to check if a specific model/temperature combination is completed
  const isRunCompleted = (
    modelId: number,
    temperature: "low" | "medium" | "high",
  ) => {
    return completedRuns.some(
      (run) => run.modelId === modelId && run.temperature === temperature,
    );
  };

  // Function to check if a specific model/temperature combination is active
  const isRunActive = (
    modelId: number,
    temperature: "low" | "medium" | "high",
  ) => {
    return activeRuns.some(
      (run) => run.modelId === modelId && run.temperature === temperature,
    );
  };

  // Function to check if a specific model/temperature combination had an error
  const hasRunError = (
    modelId: number,
    temperature: "low" | "medium" | "high",
  ) => {
    return errorRuns.some(
      (run) => run.modelId === modelId && run.temperature === temperature,
    );
  };

  // Function to get model status (pending, active, completed, mixed)
  const getModelStatus = (modelId: number) => {
    // Check if all runs for this model are completed
    const modelRuns = models.find((m) => m.id === modelId);
    if (!modelRuns) return "pending";

    const totalModelRuns =
      modelRuns.runsLow + modelRuns.runsMedium + modelRuns.runsHigh;
    const completedModelRuns = completedRuns.filter(
      (run) => run.modelId === modelId,
    ).length;
    const activeModelRuns = activeRuns.filter(
      (run) => run.modelId === modelId,
    ).length;
    const errorModelRuns = errorRuns.filter(
      (run) => run.modelId === modelId,
    ).length;

    if (completedModelRuns === totalModelRuns) return "completed";
    if (activeModelRuns > 0) return "active";
    if (
      errorModelRuns > 0 &&
      completedModelRuns + activeModelRuns + errorModelRuns === totalModelRuns
    )
      return "error";
    if (completedModelRuns + activeModelRuns + errorModelRuns === 0)
      return "pending";
    return "mixed";
  };

  // Function to get model status icon
  const getModelStatusIcon = (modelId: number) => {
    const status = getModelStatus(modelId);

    switch (status) {
      case "completed":
        return (
          <div className="h-5 w-5 rounded-full border border-green-300 bg-green-50 flex items-center justify-center">
            <Check className="h-3 w-3 text-green-500" />
          </div>
        );
      case "active":
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "mixed":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-300" />;
    }
  };

  return (
    <motion.div
      id={id}
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className="w-full max-w-2xl mx-auto border-l-4 border-violet-500">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-medium">
              Ensemble Configuration
            </CardTitle>

            {/* Add badges for run status */}
            <div className="flex flex-col gap-1 items-end">
              {totalRuns > 0 && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                  {completedCount}/{totalRuns} runs complete
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                  {errorCount} errors
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected intensity */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Default Intensity:</span>
            <Badge
              className={cn(
                "font-medium",
                getIntensityClass(selectedIntensity),
              )}
            >
              {getIntensityIcon(selectedIntensity)}
              <span className="ml-1">
                {getIntensityText(selectedIntensity)}
              </span>
            </Badge>
          </div>

          {/* Models */}
          <div className="space-y-3">
            {models.map((model, index) => (
              <div
                key={index}
                className="flex flex-col p-2 rounded-md bg-slate-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Add model status icon */}
                    <span className="mr-1">{getModelStatusIcon(model.id)}</span>
                    <Badge
                      variant="outline"
                      className={getModelColor(model.model)}
                    >
                      {model.model}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded",
                      model.runsLow > 0
                        ? "bg-slate-100"
                        : "bg-slate-50 text-slate-400",
                    )}
                  >
                    <div className="flex items-center">
                      <Snowflake className="h-3 w-3 mr-1 text-slate-600" />
                      <span>Low (0.3)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">{model.runsLow} runs</span>
                      {model.runsLow > 0 && isRunCompleted(model.id, "low") && (
                        <div className="ml-1 h-4 w-4 rounded-full border border-green-300 bg-green-50 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-green-500" />
                        </div>
                      )}
                      {model.runsLow > 0 && isRunActive(model.id, "low") && (
                        <Play className="ml-1 h-3.5 w-3.5 text-blue-500 animate-pulse" />
                      )}
                      {model.runsLow > 0 && hasRunError(model.id, "low") && (
                        <X className="ml-1 h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded",
                      model.runsMedium > 0
                        ? "bg-amber-50"
                        : "bg-slate-50 text-slate-400",
                    )}
                  >
                    <div className="flex items-center">
                      <Thermometer className="h-3 w-3 mr-1 text-amber-500" />
                      <span>Med (0.5)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">
                        {model.runsMedium} runs
                      </span>
                      {model.runsMedium > 0 &&
                        isRunCompleted(model.id, "medium") && (
                          <div className="ml-1 h-4 w-4 rounded-full border border-green-300 bg-green-50 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-green-500" />
                          </div>
                        )}
                      {model.runsMedium > 0 &&
                        isRunActive(model.id, "medium") && (
                          <Play className="ml-1 h-3.5 w-3.5 text-blue-500 animate-pulse" />
                        )}
                      {model.runsMedium > 0 &&
                        hasRunError(model.id, "medium") && (
                          <X className="ml-1 h-3.5 w-3.5 text-red-500" />
                        )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded",
                      model.runsHigh > 0
                        ? "bg-red-50"
                        : "bg-slate-50 text-slate-400",
                    )}
                  >
                    <div className="flex items-center">
                      <Flame className="h-3 w-3 mr-1 text-red-500" />
                      <span>High (0.7)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">{model.runsHigh} runs</span>
                      {model.runsHigh > 0 &&
                        isRunCompleted(model.id, "high") && (
                          <div className="ml-1 h-4 w-4 rounded-full border border-green-300 bg-green-50 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-green-500" />
                          </div>
                        )}
                      {model.runsHigh > 0 && isRunActive(model.id, "high") && (
                        <Play className="ml-1 h-3.5 w-3.5 text-blue-500 animate-pulse" />
                      )}
                      {model.runsHigh > 0 && hasRunError(model.id, "high") && (
                        <X className="ml-1 h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
