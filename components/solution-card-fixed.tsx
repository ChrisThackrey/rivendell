"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Clock,
  Code,
  Cpu,
  FileText,
  BarChart,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExpandable } from "@/components/hooks/use-expandable";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockTabs,
  type CodeFile,
} from "@/components/ui/code-block";

// Helper function to get language from filename
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    py: "python",
    rb: "ruby",
    java: "java",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    swift: "swift",
    kt: "kotlin",
  };

  return languageMap[extension] || "plaintext";
}

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
  hasReasoning?: boolean;
  codeFiles?: CodeFile[]; // Added for code files
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
  hasReasoning,
  codeFiles = [],
}: SolutionCardProps) {
  const { isExpanded, toggleExpand, animatedHeight } = useExpandable(false);
  const [activeCodeTab, setActiveCodeTab] = useState(0);
  const [fixedCodeFiles, setFixedCodeFiles] = useState<CodeFile[]>(codeFiles);
  const [isLoadingCodeFiles, setIsLoadingCodeFiles] = useState(false);

  // Improved logic for detecting code files
  const hasAnyCodeFiles = fixedCodeFiles.length > 0 || codeFiles.length > 0;

  // Check if any code files have valid content
  const hasValidCodeContent = useMemo(() => {
    return fixedCodeFiles.some((file) => file.code && file.code.trim() !== "");
  }, [fixedCodeFiles]);

  // Always allow expanding if we have an ID
  const couldHaveCodeFiles = !!id;

  // Check if code files are empty objects (missing actual content)
  const codeFilesHaveEmptyContent = useMemo(() => {
    return (
      codeFiles.length > 0 &&
      codeFiles.every(
        (file) =>
          !file.code ||
          file.code.trim() === "" ||
          !file.filename ||
          file.filename.trim() === "",
      )
    );
  }, [codeFiles]);

  // Enhanced function to fetch code files with better handling of undefined code
  const fetchCodeFiles = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoadingCodeFiles(true);
      console.log(`SolutionCard ${id}: Fetching code files from API`);

      const response = await fetch("/api/fix-codefiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Response from fix-codefiles API:`, data);

        if (data.success && data.files && data.files.length > 0) {
          // Extract and process code files from the results
          const processedFiles = data.files.map((file: any) => ({
            filename: file.filename || "unknown.txt",
            language:
              file.language ||
              getLanguageFromFilename(file.filename || "unknown.txt"),
            code: file.code || "// No code content available for this file",
            id: file.id,
          }));

          setFixedCodeFiles(processedFiles);
          console.log(
            `SolutionCard ${id}: Processed ${processedFiles.length} code files`,
          );
        } else if (codeFiles && codeFiles.length > 0) {
          // If API didn't return any files but we have codeFiles props, use those
          // with default content for missing code
          const fallbackFiles = codeFiles.map((file) => ({
            filename: file.filename || "unknown.txt",
            language: file.language || "plaintext",
            code: file.code || "// No code content available for this file",
            id: id + "_" + (file.filename || "unknown"),
          }));

          setFixedCodeFiles(fallbackFiles);
          console.log(
            `SolutionCard ${id}: Using ${fallbackFiles.length} fallback code files`,
          );
        } else {
          // Create a minimal fallback file if nothing else is available
          const fallbackFile = {
            filename: "sample.txt",
            language: "plaintext",
            code: "// No code files available for this solution\n// This is a placeholder",
            id: id + "_fallback",
          };

          setFixedCodeFiles([fallbackFile]);
          console.log(`SolutionCard ${id}: Created fallback code file`);
        }
      } else {
        console.error("Error fetching code files:", await response.text());
      }
    } catch (error) {
      console.error("Error in fetchCodeFiles:", error);
    } finally {
      setIsLoadingCodeFiles(false);
    }
  }, [id, codeFiles]);

  // Fetch code files initially if needed
  useEffect(() => {
    if (codeFilesHaveEmptyContent && id) {
      fetchCodeFiles();
    } else if (
      codeFiles.length > 0 &&
      codeFiles.some((file) => file.code && file.code.length > 0)
    ) {
      // If original codeFiles have content, use them
      setFixedCodeFiles(codeFiles);
    }
  }, [id, codeFiles, codeFilesHaveEmptyContent, fetchCodeFiles]);

  // When expanding the code section, try to fetch code files if needed
  useEffect(() => {
    if (isExpanded && !hasValidCodeContent && !isLoadingCodeFiles && id) {
      fetchCodeFiles();
    }
  }, [isExpanded, hasValidCodeContent, isLoadingCodeFiles, id, fetchCodeFiles]);

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

  // Get the files to display in tabs, ensuring we always have something to show
  const filesToDisplay = useMemo(() => {
    if (fixedCodeFiles.length > 0) {
      return fixedCodeFiles;
    } else if (codeFiles.length > 0) {
      return codeFiles.map((file) => ({
        filename: file.filename || "Unknown",
        language: file.language || "plaintext",
        code: file.code || "// No code content available",
      }));
    } else {
      return [
        {
          filename: "example.txt",
          language: "plaintext",
          code: "// No code files available for this solution",
        },
      ];
    }
  }, [fixedCodeFiles, codeFiles]);

  return (
    <motion.div
      id={id}
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className={cn("flex flex-col", `border-l-4 ${typeStyles[type]}`)}>
        <CardHeader className="pb-2 space-y-3">
          {/* Status tag at the very top */}
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

          {/* Title and model */}
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

        <CardContent className="flex-1 space-y-3 overflow-y-auto">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
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

        <CardFooter className="mt-auto pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs flex items-center justify-center"
            onClick={toggleExpand}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" /> Hide Code
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                {isLoadingCodeFiles ? "Loading Code..." : "View Code"}
              </>
            )}
          </Button>
        </CardFooter>

        {/* Expandable code section - Single clean implementation */}
        <motion.div
          className="overflow-hidden"
          style={{
            height: isExpanded ? "auto" : "0px",
            opacity: animatedHeight.get(),
          }}
        >
          {isLoadingCodeFiles ? (
            <div className="p-3 border-t border-border flex justify-center items-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-xs text-slate-500">
                  Loading code files...
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 border-t border-border">
              <CodeBlock>
                <CodeBlockTabs
                  files={filesToDisplay}
                  activeTab={activeCodeTab}
                  onTabChange={setActiveCodeTab}
                />
                <CodeBlockCode
                  code={
                    filesToDisplay[activeCodeTab]?.code ||
                    "// No code content available"
                  }
                  language={
                    filesToDisplay[activeCodeTab]?.language || "plaintext"
                  }
                />
              </CodeBlock>
            </div>
          )}
        </motion.div>
      </Card>
    </motion.div>
  );
}
