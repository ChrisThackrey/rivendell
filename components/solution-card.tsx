"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, useMotionValueEvent } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Code, Cpu, FileText, BarChart, Users, RefreshCw, CodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExpandable } from "@/components/hooks/use-expandable";
import type { CodeFile } from "@/components/ui/code-block";
import { useSolutionCode } from "@/components/hooks/use-solution-code";
import { SolutionCodeModal } from "./solution-code-modal";

type Metric = {
  executionTime: string;
  complexity: string;
  memoryUsage: string;
  lineCount: number;
  codeQuality?: number; // Percentage score for code quality
};

type SolutionCardProps = {
  id: string;
  title: string;
  description: string;
  type: "accepted" | "secondary" | "rejected";
  model?: string;
  metrics?: Metric;
  frequency?: {
    count: number;
    models: string[];
  };
  delay?: number;
  runId?: number;
  stepIndex?: number;
  hasReasoning?: boolean;
  codeFiles?: CodeFile[];
  onExpand?: (expanded: boolean, cardId: string) => void;
  metadata?: Record<string, any>;
};

export default function SolutionCard({
  id,
  title,
  description,
  type,
  model,
  metrics,
  frequency,
  delay = 0,
  runId,
  stepIndex,
  hasReasoning,
  codeFiles = [],
  onExpand,
  metadata = {},
}: SolutionCardProps) {
  const { isExpanded, toggleExpand, animatedHeight } = useExpandable(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [hasNotifiedExpansion, setHasNotifiedExpansion] = useState(false);

  const {
    filesToDisplay,
    displayFileTree,
    isLoading: isLoadingCodeFiles,
    error: codeError,
    refetch: fetchCodeFiles,
  } = useSolutionCode({
    id,
    runId,
    stepIndex,
    title,
    metadata,
    initialCodeFiles: codeFiles,
  });

  const noMeaningfulCodeAvailable = useMemo(() => {
    return filesToDisplay.length === 1 && filesToDisplay[0].source?.startsWith('placeholder');
  }, [filesToDisplay]);

  useEffect(() => {
    if (showCodeModal && noMeaningfulCodeAvailable && !isLoadingCodeFiles) {
      console.log("Modal opened with placeholder, triggering refetch.");
      fetchCodeFiles();
    }
  }, [showCodeModal, noMeaningfulCodeAvailable, isLoadingCodeFiles, fetchCodeFiles]);

  useEffect(() => {
    if (onExpand && id) {
      const timer = setTimeout(() => {
        onExpand(isExpanded, id);
        setHasNotifiedExpansion(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, id, onExpand]);

  useMotionValueEvent(animatedHeight, "change", (latest) => {
    if (hasNotifiedExpansion && latest > 0 && latest < 1 && onExpand && id) {
      onExpand(isExpanded, id);
    }
    const cardElement = document.getElementById(id);
    if (cardElement) {
      if (latest > 0 && latest < 1) {
        cardElement.setAttribute("data-animating", "true");
      } else {
        cardElement.removeAttribute("data-animating");
      }
    }
  });

  const handleToggleExpand = () => {
    setHasNotifiedExpansion(false);
    const cardElement = document.getElementById(id);
    if (cardElement) {
      cardElement.setAttribute(
        "data-resize-trigger",
        isExpanded ? "collapsed" : "expanded",
      );
    }
    toggleExpand();
  };

  const typeStyles = {
    accepted: "border-green-500",
    secondary: "border-blue-500",
    rejected: "border-orange-500",
  };

  const typeLabels = {
    accepted: "RECOMMENDED",
    secondary: "VIABLE",
    rejected: "PROBLEMATIC",
  };

  const modelColors = {
    "GPT-4o": "bg-emerald-100 text-emerald-800",
    "o3-mini": "bg-amber-100 text-amber-800",
    o1: "bg-purple-100 text-purple-800",
    "Claude-Sonnet-7": "bg-indigo-100 text-indigo-800",
    Combined: "bg-gray-100 text-gray-800",
  };

  return (
    <motion.div
      id={id}
      className="relative w-full solution-card"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      layout
      data-expanded={isExpanded ? "true" : "false"}
      data-card-type={type}
      data-step-index={stepIndex || 0}
      data-run-id={runId || 0}
    >
      <div
        id={`${id}-top`}
        className="connection-point-top"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "10px",
          height: "10px"
        }}
      />
      <div
        id={`${id}-bottom`}
        className="connection-point-bottom"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "10px",
          height: "10px"
        }}
      />

      <div
        id={`${id}-top-marker`}
        className="endpoint-marker endpoint-marker-top"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: "rgba(0, 0, 255, 0.6)",
          border: "2px solid white",
          boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
          zIndex: 20
        }}
      />
      <div
        id={`${id}-bottom-marker`}
        className="endpoint-marker endpoint-marker-bottom"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: "rgba(255, 0, 0, 0.6)",
          border: "2px solid white",
          boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
          zIndex: 20
        }}
      />

      <Card
        className={cn(
          "flex flex-col min-h-[240px] max-h-[400px]",
          `border-l-4 ${typeStyles[type]}`,
        )}
      >
        <CardHeader className="pb-2 space-y-3 flex-shrink-0">
          <div className="flex justify-start">
            <span
              className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                type === "accepted"
                  ? "bg-green-100 text-green-800"
                  : type === "secondary"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-orange-100 text-orange-800",
              )}
            >
              {typeLabels[type]}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <div className="flex gap-2 items-center">
                {runId && (
                  <span className="text-xs text-muted-foreground">
                    Run #{runId}
                  </span>
                )}
                {hasReasoning && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm">
                    Reasoning
                  </span>
                )}
              </div>
            </div>
            {model && (
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap",
                  model in modelColors
                    ? modelColors[model as keyof typeof modelColors]
                    : "bg-gray-100 text-gray-800",
                )}
              >
                {model}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 space-y-3 overflow-y-auto">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>

          {metrics && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">
                  {metrics.executionTime || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Code className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">
                  {metrics.complexity || "O(n)"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Cpu className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">
                  {metrics.memoryUsage || "Variable"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <FileText className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">
                  {metrics.lineCount || 0} lines
                </span>
              </div>
              {metrics.codeQuality !== undefined && (
                <div className="flex items-center gap-1 text-xs">
                  <BarChart className="h-3 w-3 text-slate-500" />
                  <span className="text-slate-700">
                    Quality: {metrics.codeQuality}%
                  </span>
                </div>
              )}
              {frequency && frequency.count > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3 text-slate-500" />
                  <span className="text-slate-700">
                    Frequency: {frequency.count}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-auto pt-2 border-t flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className={`w-full text-xs flex items-center justify-center ${
              !isLoadingCodeFiles && noMeaningfulCodeAvailable
                ? "opacity-70 hover:opacity-100"
                : ""
            }`}
            onClick={() => {
              if (!isLoadingCodeFiles && noMeaningfulCodeAvailable) {
                fetchCodeFiles();
              }
              setShowCodeModal(true);
            }}
            disabled={isLoadingCodeFiles}
          >
            {isLoadingCodeFiles ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                Loading Code...
              </>
            ) : codeError ? (
              <>
                <CodeIcon className="mr-1 h-3 w-3 text-red-500" />
                Error Loading
              </>
            ) : noMeaningfulCodeAvailable ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3" />
                Check for Code
              </>
            ) : (
              <>
                <Code className="mr-1 h-3 w-3" />
                View Code ({filesToDisplay.length} {" "}
                {filesToDisplay.length === 1 ? "file" : "files"})
              </>
            )}
          </Button>
        </CardFooter>

        <SolutionCodeModal
          isOpen={showCodeModal}
          onOpenChange={setShowCodeModal}
          title={title}
          description={description}
          filesToDisplay={filesToDisplay}
          displayFileTree={displayFileTree}
          isLoading={isLoadingCodeFiles}
          error={codeError}
          model={model}
          stepIndex={stepIndex}
          runId={runId}
          onRefetch={fetchCodeFiles}
        />
      </Card>
    </motion.div>
  );
}
