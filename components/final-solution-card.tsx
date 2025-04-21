"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Check,
  Clock,
  Code,
  Copy,
  Cpu,
  FileText,
  BarChart,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Metric = {
  executionTime: string;
  complexity: string;
  memoryUsage: string;
  lineCount: number;
};

type FinalSolutionCardProps = {
  id: string;
  title: string;
  description: string;
  type: "accepted" | "secondary" | "rejected";
  model?: string;
  metrics?: Metric;
  delay?: number;
  reasoningProcess?: string;
  batchId?: string;
  originalStructuredSolution?: Record<string, unknown>;
  query?: string;
  techStack?: string;
};

export default function FinalSolutionCard({
  id,
  title,
  type,
  model,
  metrics,
  delay = 0,
  reasoningProcess,
  batchId,
  originalStructuredSolution,
  query,
  techStack,
}: FinalSolutionCardProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enhancedExplanation, setEnhancedExplanation] = useState<string | null>(
    null,
  );
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const router = useRouter();

  // Define fetch function outside useEffect to make it available to the component
  const fetchEnhancedExplanation = async () => {
    if (!originalStructuredSolution) return;

    setLoading(true);
    try {
      const response = await fetch("/api/solution-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          structuredSolution: originalStructuredSolution,
          query,
          techStack,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch enhanced explanation");
      }

      const data = await response.json();
      setEnhancedExplanation(data.explanation);
    } catch (error) {
      console.error("Error fetching enhanced explanation:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate enhanced explanation on initial load if not available
  useEffect(() => {
    if (originalStructuredSolution && !enhancedExplanation && !loading) {
      fetchEnhancedExplanation();
    }
  }, [originalStructuredSolution, enhancedExplanation, loading]);

  const handleCopy = () => {
    // In a real app, this would copy the actual solution code
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewMonteCarlo = () => {
    if (batchId) {
      // Navigate to Monte Carlo page with batch ID as query parameter
      router.push(`/monte-carlo?batch=${batchId}`);
    } else {
      // Navigate to Monte Carlo page without specific batch
      router.push("/monte-carlo");
    }
  };

  const handleToggleExplanation = () => {
    setShowFullExplanation(!showFullExplanation);
  };

  const handleRefreshExplanation = () => {
    fetchEnhancedExplanation();
  };

  const typeStyles = {
    accepted: "border-green-500",
    secondary: "border-blue-500",
    rejected: "border-orange-500",
  };

  const modelColors = {
    "GPT-4o": "bg-emerald-100 text-emerald-800",
    "o3-mini": "bg-amber-100 text-amber-800",
    o1: "bg-purple-100 text-purple-800",
    "Claude-Sonnet-7": "bg-indigo-100 text-indigo-800",
    Combined: "bg-gray-100 text-gray-800",
  };

  // Format the enhanced explanation for display
  const formatExplanation = (explanation: string) => {
    if (!explanation) return "";

    // Split by paragraphs or sections
    const paragraphs = explanation.split("\n\n");

    // If we're showing the full explanation, return everything
    if (showFullExplanation) {
      return paragraphs.map((para, index) => (
        <p key={index} className="text-xs text-slate-700 mb-2">
          {para.startsWith("##") ? (
            <strong className="block text-sm text-slate-800 mb-1">
              {para.replace("##", "")}
            </strong>
          ) : (
            para
          )}
        </p>
      ));
    }

    // Otherwise, just show the first 2 paragraphs
    return paragraphs.slice(0, 2).map((para, index) => (
      <p key={index} className="text-xs text-slate-700 mb-2">
        {para.startsWith("##") ? (
          <strong className="block text-sm text-slate-800 mb-1">
            {para.replace("##", "")}
          </strong>
        ) : (
          para
        )}
      </p>
    ));
  };

  return (
    <motion.div
      id={id}
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className={cn("flex flex-col", `border-l-4 ${typeStyles[type]}`)}>
        <CardHeader className="pb-2">
          {/* Title and model */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <div className="flex gap-1.5 flex-wrap">
                {reasoningProcess && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm">
                    Enhanced with reasoning
                  </span>
                )}
                {enhancedExplanation && (
                  <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-sm">
                    Claude-powered explanation
                  </span>
                )}
                {batchId && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm">
                    Batch {batchId.substring(0, 8)}
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

        <CardContent className="flex-1 space-y-3 overflow-y-auto">
          {/* Performance Highlights */}
          <div className="grid grid-cols-2 gap-y-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Best performance: 4ms</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Low memory: 12MB</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Clean code: 7 lines</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Input validation</span>
            </div>
          </div>

          {/* Description or Enhanced Explanation */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Generating enhanced explanation...</span>
              </div>
            ) : enhancedExplanation ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm text-slate-800 font-medium">
                    Solution Strategy Analysis
                  </h3>
                  <button
                    onClick={handleRefreshExplanation}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                </div>

                <div className="text-xs text-slate-700">
                  {formatExplanation(enhancedExplanation)}

                  <button
                    onClick={handleToggleExplanation}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 mt-1"
                  >
                    {showFullExplanation ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> Read more
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700 font-medium">
                  This solution combines the best aspects of all AI submissions:
                </p>
                <ul className="text-xs text-slate-600 space-y-1 pl-4">
                  <li className="list-disc">
                    Input validation from Llama&apos;s solution
                  </li>
                  <li className="list-disc">
                    Efficient reduce pattern from GPT-4
                  </li>
                  <li className="list-disc">
                    Type checking from error handling solution
                  </li>
                  <li className="list-disc">
                    Clear formatting with functional style
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* Original metrics */}
          {metrics && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">{metrics.executionTime}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Code className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">{metrics.complexity}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Cpu className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">{metrics.memoryUsage}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <FileText className="h-3 w-3 text-slate-500" />
                <span className="text-slate-700">
                  {metrics.lineCount} lines
                </span>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-auto pt-2 border-t">
          <div className="flex flex-col w-full gap-2">
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy Solution
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-300 hover:bg-slate-100"
              onClick={handleViewMonteCarlo}
            >
              <BarChart className="mr-2 h-4 w-4" /> View Monte Carlo Output
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
