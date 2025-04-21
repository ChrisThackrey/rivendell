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
import { Clock, Code, Cpu, FileText, BarChart, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExpandable } from "@/components/hooks/use-expandable";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockTabs,
  type CodeFile,
} from "@/components/ui/code-block";
import { useCodeFiles } from "./code-file-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, MinusIcon, EditIcon, CodeIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw } from "lucide-react";

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
  fileTree?: string; // Added for file-tree display
  onExpand?: (expanded: boolean, cardId: string) => void; // New event handler for expansion
  stepIndex?: number;
  metadata?: Record<string, any>; // Added for additional metadata
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
  fileTree,
  onExpand,
  stepIndex,
  metadata = {},
}: SolutionCardProps) {
  const { isExpanded, toggleExpand, animatedHeight } = useExpandable(false);
  const [activeCodeTab, setActiveCodeTab] = useState(0);
  const [fixedCodeFiles, setFixedCodeFiles] = useState<CodeFile[]>(codeFiles);
  const [isLoadingCodeFiles, setIsLoadingCodeFiles] = useState(false);
  const [hasNotifiedExpansion, setHasNotifiedExpansion] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const { getCodeFiles, cachedFiles } = useCodeFiles();

  // For file tree management
  const [displayFileTree, setDisplayFileTree] = useState<string | undefined>(
    fileTree,
  );

  // Improved logic for detecting code files
  // Enhanced code file detection logic to also check step-specific cache keys
  const cacheKey =
    runId !== undefined && stepIndex !== undefined
      ? `${id}_run${runId}_step${stepIndex}`
      : id;
  const hasAnyCodeFiles =
    fixedCodeFiles.length > 0 ||
    codeFiles.length > 0 ||
    (id && (cachedFiles[id]?.length > 0 || cachedFiles[cacheKey]?.length > 0));

  // Check if any code files have valid content
  const hasValidCodeContent = useMemo(() => {
    // First check the cache (with both standard ID and step-specific cache key)
    if (
      id &&
      (cachedFiles[id]?.length > 0 || cachedFiles[cacheKey]?.length > 0)
    ) {
      return true;
    }

    // Then check fixed files
    return fixedCodeFiles.some(
      (file: any) =>
        file &&
        typeof file === "object" &&
        file.code &&
        typeof file.code === "string" &&
        file.code.trim() !== "",
    );
  }, [fixedCodeFiles, id, cacheKey, cachedFiles]);

  // Track if fileTree was fetched from document
  const [fetchedFileTree, setFetchedFileTree] = useState<string | null>(null);

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

  // Refactored function to exclusively fetch code files from codefiles table
  const fetchCodeFiles = useCallback(async () => {
    if (!id) return;

    // Generate a cache key that includes step information
    // IMPORTANT: Must use both stepIndex and runId to ensure unique cache keys per step
    const cacheKey =
      runId !== undefined && stepIndex !== undefined
        ? `step_${runId}_${stepIndex}`
        : `doc_${id}`;

    console.log(
      `SolutionCard: Using cache key ${cacheKey} for card ${id} (step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"})`,
    );

    // First check if files are already in cache with the specific step info
    if (cachedFiles[cacheKey]?.length > 0) {
      console.log(`SolutionCard ${cacheKey}: Using cached code files`);
      setFixedCodeFiles(cachedFiles[cacheKey]);
      return;
    }

    try {
      setIsLoadingCodeFiles(true);

      // Primary approach - prefer step-specific code files when available
      if (runId !== undefined && stepIndex !== undefined) {
        console.log(
          `SolutionCard ${cacheKey}: Fetching code files for step ${stepIndex + 1} in run ${runId}`,
        );

        try {
          // First try structured retrieval approach from Find Code Snippets feature

          // Use step title or document title as search term if available
          let searchQuery = "";
          if (title) {
            searchQuery = title; // Use step title as primary search term
          } else if ((metadata as any)?.stepTitle) {
            searchQuery = (metadata as any).stepTitle;
          }

          // Always include step number for context
          if (!searchQuery.includes(`step ${stepIndex + 1}`)) {
            searchQuery += ` step ${stepIndex + 1}`;
          }

          console.log(
            `Using search query: "${searchQuery}" for step ${stepIndex + 1}`,
          );

          // Fetch code files using the same approach as Find Code Snippets
          const apiParams: any = {
            mode: "step",
            runId: runId,
            stepNumber: stepIndex,
            batchId: (metadata as any)?.batchId || null, // Include batch ID if available
            query: searchQuery, // Add search query
            similarityThreshold: 0.4, // Lower threshold for better recall
            maxResults: 10, // Get more potential matches
          };

          // First attempt: use step-specific fetching
          const response = await fetch("/api/search-codefiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(apiParams),
          });

          if (response.ok) {
            const data = await response.json();

            if (data.success && data.files && data.files.length > 0) {
              console.log(
                `Found ${data.files.length} code files for step ${stepIndex + 1} (source: ${data.source || "api"})`,
              );

              // Format files for display and add details for tracking source
              const stepFiles = data.files.map((file: any) => ({
                filename: file.filename || "unknown.txt",
                language:
                  file.language ||
                  getLanguageFromFilename(file.filename || "unknown.txt"),
                code: file.code || "// No code content available for this file",
                id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
                documentId: file.documentId,
                stepInfo: { runId, stepNumber: stepIndex }, // Add step information to help track context
                cacheKey, // Add cacheKey to file to ensure we can identify source
                source: file.source || "api",
              }));

              // Filter out placeholder or empty files
              const meaningfulFiles = stepFiles.filter(
                (file: CodeFile) => !isPlaceholderOrEmptyCode(file.code),
              );

              if (meaningfulFiles.length > 0) {
                console.log(
                  `SolutionCard ${cacheKey}: Retrieved ${meaningfulFiles.length} meaningful code files for step ${stepIndex + 1}, run ${runId}`,
                );

                // First update our local state
                setFixedCodeFiles(meaningfulFiles);

                // Then manually update the global cache with our step-specific key
                const codeFilesContext = document.querySelector(
                  "[data-code-files-context]",
                );
                if (codeFilesContext) {
                  const event = new CustomEvent("update-code-files-cache", {
                    detail: {
                      key: cacheKey,
                      files: meaningfulFiles,
                    },
                  });
                  codeFilesContext.dispatchEvent(event);
                  console.log(
                    `SolutionCard: Dispatched cache update event for key ${cacheKey} (${meaningfulFiles.length} files)`,
                  );
                }
                return;
              } else {
                console.log(
                  `All files for step ${stepIndex + 1} were placeholders or empty - trying fallback methods`,
                );
              }
            } else {
              console.log(
                `Step API returned no files for step ${stepIndex + 1}, run ${runId} - message: ${data.message || "No message"}`,
              );
            }
          } else {
            console.error(
              `API error for step ${stepIndex + 1}, run ${runId}:`,
              response.statusText,
            );
          }
        } catch (searchError) {
          console.error(
            `Error searching for code files for step ${stepIndex + 1}:`,
            searchError,
          );
        }

        // If step-based fetching failed, try document ID directly from codefiles table
        console.log(
          `Step-based code fetching failed, trying document ID directly`,
        );
      }

      // Alternative approach - try direct document_id lookup from codefiles table
      console.log(
        `SolutionCard ${cacheKey}: Fetching code files by document ID ${id}`,
      );
      const contextFiles = await getCodeFiles(id);

      if (contextFiles.length > 0) {
        // Add step info to the context files
        const processedContextFiles = contextFiles.map((file) => ({
          ...file,
          id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
          stepInfo: { runId, stepNumber: stepIndex },
          cacheKey, // Add cacheKey to file to ensure we can identify source
        }));

        // Update our local state
        setFixedCodeFiles(processedContextFiles);
        console.log(
          `SolutionCard ${cacheKey}: Used ${processedContextFiles.length} files from codefiles table via context (step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"})`,
        );

        // Also update the global cache with our step-specific key
        const codeFilesContext = document.querySelector(
          "[data-code-files-context]",
        );
        if (codeFilesContext) {
          const event = new CustomEvent("update-code-files-cache", {
            detail: {
              key: cacheKey,
              files: processedContextFiles,
            },
          });
          codeFilesContext.dispatchEvent(event);
        }
        return;
      }

      // Last resort - direct call to codefiles table with document_id from document_codefile_relationships
      try {
        console.log(
          `SolutionCard ${cacheKey}: Making direct codefiles API call for doc ${id}`,
        );
        const directResponse = await fetch("/api/search-codefiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: id,
            mode: "step",
            runId: runId,
            stepNumber: stepIndex,
            direct: true, // Flag to indicate this is a direct lookup from codefiles table
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();

          if (
            directData.success &&
            directData.files &&
            directData.files.length > 0
          ) {
            // Format files for display
            const directFiles = directData.files.map((file: any) => ({
              filename: file.filename || "unknown.txt",
              language:
                file.language ||
                getLanguageFromFilename(file.filename || "unknown.txt"),
              code: file.code || "// No code content available for this file",
              id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
              documentId: file.documentId,
              stepInfo: { runId, stepNumber: stepIndex },
              cacheKey, // Add cacheKey to file to ensure we can identify source
            }));

            // Update our local state
            setFixedCodeFiles(directFiles);
            console.log(
              `SolutionCard ${cacheKey}: Direct API call successful with ${directFiles.length} files (step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"})`,
            );

            // Also update the global cache
            const codeFilesContext = document.querySelector(
              "[data-code-files-context]",
            );
            if (codeFilesContext) {
              const event = new CustomEvent("update-code-files-cache", {
                detail: {
                  key: cacheKey,
                  files: directFiles,
                },
              });
              codeFilesContext.dispatchEvent(event);
            }
            return;
          }
        }
      } catch (directError) {
        console.error(`Error in direct code files API call:`, directError);
      }

      // Create a placeholder if no code files found in codefiles table
      const placeholderFile = [
        {
          filename: "No Code Files.txt",
          language: "plaintext",
          code: `// No code files found in codefiles table for document ID: ${id}\n// Step: ${stepIndex !== undefined ? stepIndex + 1 : "N/A"}, Run: ${runId || "N/A"}`,
          id: `${cacheKey}_no_codefiles`,
          stepInfo: { runId, stepNumber: stepIndex },
          cacheKey, // Add cacheKey to file to ensure we can identify source
        },
      ];

      // Update our local state
      setFixedCodeFiles(placeholderFile);
      console.log(
        `Using placeholder file for ${cacheKey} (step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"})`,
      );

      // Add to cache so this persists
      const codeFilesContext = document.querySelector(
        "[data-code-files-context]",
      );
      if (codeFilesContext) {
        const event = new CustomEvent("update-code-files-cache", {
          detail: {
            key: cacheKey,
            files: placeholderFile,
          },
        });
        codeFilesContext.dispatchEvent(event);
      }
    } catch (error) {
      console.error(`Error fetching code files for ${cacheKey}:`, error);
      // Handle errors with a placeholder
      const errorFile = [
        {
          filename: "Error.txt",
          language: "plaintext",
          code: `// Error fetching code files for step ${stepIndex !== undefined ? stepIndex + 1 : ""} of run ${runId || "unknown"}:\n// ${error instanceof Error ? error.message : String(error)}`,
          id: `${cacheKey}_error`,
          stepInfo: { runId, stepNumber: stepIndex },
          cacheKey, // Add cacheKey to file to ensure we can identify source
        },
      ];

      setFixedCodeFiles(errorFile);

      // Add to cache so this persists
      const codeFilesContext = document.querySelector(
        "[data-code-files-context]",
      );
      if (codeFilesContext) {
        const event = new CustomEvent("update-code-files-cache", {
          detail: {
            key: cacheKey,
            files: errorFile,
          },
        });
        codeFilesContext.dispatchEvent(event);
      }
    } finally {
      setIsLoadingCodeFiles(false);
    }
  }, [id, runId, stepIndex, cachedFiles, getCodeFiles, metadata]);

  // Function to organize files into proper Next.js project structure
  const organizeFileTree = useCallback((codeFiles: CodeFile[]): string => {
    // Initialize directory structure
    const directories: Record<string, string[]> = {
      components: [],
      app: [],
      "app/api": [],
      lib: [],
      utils: [],
      types: [],
      pages: [],
      styles: [],
      public: [],
      tests: [],
      other: [],
    };

    // Process each file and determine its appropriate directory
    codeFiles.forEach((file) => {
      const filename = file.filename;
      const extension = filename.split(".").pop()?.toLowerCase() || "";

      // React component files (PascalCase .tsx or .jsx files)
      if (
        (extension === "tsx" || extension === "jsx") &&
        /^[A-Z][A-Za-z0-9]*\.(tsx|jsx)$/.test(filename)
      ) {
        // Special case for components that might belong in specific subdirectories
        if (
          filename.includes("Page") ||
          filename.endsWith("Page.tsx") ||
          filename.endsWith("Page.jsx")
        ) {
          directories["app"].push(filename);
        } else {
          directories["components"].push(filename);
        }
      }
      // Page files for Next.js app router
      else if (
        filename === "page.tsx" ||
        filename === "page.jsx" ||
        filename === "layout.tsx"
      ) {
        directories["app"].push(filename);
      }
      // API route files
      else if (
        filename === "route.ts" ||
        filename === "route.js" ||
        filename.startsWith("api")
      ) {
        directories["app/api"].push(filename);
      }
      // Utility/helper files
      else if (extension === "ts" || extension === "js") {
        // Specific file patterns for lib vs utils
        if (
          filename.includes("service") ||
          filename.includes("client") ||
          filename.includes("provider") ||
          filename.includes("store")
        ) {
          directories["lib"].push(filename);
        } else {
          directories["utils"].push(filename);
        }
      }
      // CSS/SCSS files
      else if (extension === "css" || extension === "scss") {
        directories["styles"].push(filename);
      }
      // Test files
      else if (filename.includes(".test.") || filename.includes(".spec.")) {
        directories["tests"].push(filename);
      }
      // Type definition files
      else if (extension === "d.ts") {
        directories["types"].push(filename);
      }
      // Other files
      else {
        directories["other"].push(filename);
      }

      // Special case handling for specific files from the prompt example
      if (filename === "analyze-job.ts") {
        // Remove from wherever it was placed
        Object.keys(directories).forEach((dir) => {
          directories[dir] = directories[dir].filter((f) => f !== filename);
        });
        // Add to lib directory
        directories["lib"].push(filename);
      } else if (filename === "JobAnalyzer.tsx") {
        // Remove from wherever it was placed
        Object.keys(directories).forEach((dir) => {
          directories[dir] = directories[dir].filter((f) => f !== filename);
        });
        // Add to components directory
        directories["components"].push(filename);
      }
    });

    // Generate the formatted file tree
    let fileTree = "project-root/\n";

    // Add directories and their files to the tree
    Object.entries(directories).forEach(([dir, files]) => {
      // Skip empty directories
      if (files.length === 0) return;

      // Add directory to tree
      fileTree += `├── ${dir}/\n`;

      // Add files to directory
      files.forEach((file, index) => {
        const isLast = index === files.length - 1;
        fileTree += `│   ${isLast ? "└" : "├"}── ${file} [GENERATED]\n`;
      });
    });

    return fileTree;
  }, []);

  // Function to fetch file tree from document if not already available

  const fetchFileTree = useCallback(async () => {
    // Skip if we already have a file tree or don't have document ID
    if (
      (fileTree && fileTree.trim() !== "") ||
      fetchedFileTree ||
      !id ||
      !runId ||
      stepIndex === undefined
    ) {
      return;
    }

    try {
      console.log(
        `Fetching file tree for document ID ${id}, run ${runId}, step ${stepIndex}`,
      );
      // Fetch document metadata to get file tree
      const response = await fetch("/api/search-codefiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "document-metadata",
          documentId: id,
          runId: runId,
          stepNumber: stepIndex,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.metadata) {
          // Check for fileTree in metadata
          if (data.metadata.fileTree) {
            console.log(
              `Found fileTree in document metadata for step ${stepIndex + 1}:`,
              data.metadata.fileTree.substring(0, 50) +
                (data.metadata.fileTree.length > 50 ? "..." : ""),
            );
            setFetchedFileTree(data.metadata.fileTree);
          } else {
            console.log(
              `No fileTree found in document metadata for step ${stepIndex + 1}`,
            );
            // Create an organized file tree if none exists
            if (fixedCodeFiles.length > 0) {
              const generatedFileTree = organizeFileTree(fixedCodeFiles);
              setFetchedFileTree(generatedFileTree);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching file tree for document ${id}:`, error);
    }
  }, [
    id,
    runId,
    stepIndex,
    fileTree,
    fetchedFileTree,
    fixedCodeFiles,
    organizeFileTree,
  ]);

  // Fetch code files initially if needed - with debouncing to prevent rapid requests
  useEffect(() => {
    // Generate cache key for this step
    const cacheKey =
      runId !== undefined && stepIndex !== undefined
        ? `step_${runId}_${stepIndex}`
        : `doc_${id}`;

    // Skip if we're already loading or have valid content for the current step
    const hasValidContent =
      hasValidCodeContent &&
      // Check if fixedCodeFiles has content for this specific step
      (fixedCodeFiles.some(
        (file: any) =>
          file.cacheKey === cacheKey ||
          (file.stepInfo?.runId === runId &&
            file.stepInfo?.stepNumber === stepIndex),
      ) ||
        // Or if the cache has content for this specific step
        cachedFiles[cacheKey]?.length > 0);

    if (isLoadingCodeFiles || hasValidContent) {
      return;
    }

    // Use a timeout to prevent too many rapid requests
    const fetchTimer = setTimeout(() => {
      // Only fetch if we have an ID and need to
      if (id && !hasValidContent && !isLoadingCodeFiles) {
        console.log(
          `Initial fetch for step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"}, cacheKey ${cacheKey}`,
        );
        fetchCodeFiles();
      }
    }, 300); // Reduced timeout for faster loading

    return () => clearTimeout(fetchTimer);
  }, [
    id,
    runId,
    stepIndex,
    fetchCodeFiles,
    hasValidCodeContent,
    isLoadingCodeFiles,
    fixedCodeFiles,
    cachedFiles,
  ]);

  // When opening the code modal, try to fetch code files if needed
  useEffect(() => {
    if (!showCodeModal || !id) {
      return;
    }

    // Generate cache key for this step to check if we already have the right files
    const cacheKey =
      runId !== undefined && stepIndex !== undefined
        ? `step_${runId}_${stepIndex}`
        : `doc_${id}`;

    // Skip if we already have valid content for the current step
    const hasValidContent =
      hasValidCodeContent &&
      // Check if fixedCodeFiles has content for this specific step
      (fixedCodeFiles.some(
        (file: any) =>
          file.cacheKey === cacheKey ||
          (file.stepInfo?.runId === runId &&
            file.stepInfo?.stepNumber === stepIndex),
      ) ||
        // Or if the cache has content for this specific step
        cachedFiles[cacheKey]?.length > 0);

    // Add a delay to prevent immediate API calls when opening modal
    const modalTimer = setTimeout(() => {
      // Fetch code files if needed for this specific step
      if (!hasValidContent && !isLoadingCodeFiles) {
        console.log(
          `Modal opening triggered fetch for step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"}, cacheKey ${cacheKey}`,
        );
        fetchCodeFiles();
      } else {
        console.log(
          `Modal opened with existing files for step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"}, cacheKey ${cacheKey}`,
        );
      }

      // Fetch file tree if needed
      fetchFileTree();
    }, 100); // Reduced timeout for faster response

    return () => clearTimeout(modalTimer);
  }, [
    showCodeModal,
    hasValidCodeContent,
    isLoadingCodeFiles,
    id,
    runId,
    stepIndex,
    fetchCodeFiles,
    fetchFileTree,
    fixedCodeFiles,
    cachedFiles,
  ]);

  // Update displayFileTree whenever fetchedFileTree changes
  useEffect(() => {
    if (fetchedFileTree) {
      setDisplayFileTree(fetchedFileTree);
      console.log(
        "Updated display file tree with fetched data:",
        fetchedFileTree.substring(0, 30) +
          (fetchedFileTree.length > 30 ? "..." : ""),
      );
    } else if (fixedCodeFiles.length > 0 && !displayFileTree) {
      // Generate structured file tree using the organizer function
      const generatedFileTree = organizeFileTree(fixedCodeFiles);
      setDisplayFileTree(generatedFileTree);
      console.log("Generated organized file tree from fixed code files");
    }
  }, [fetchedFileTree, fixedCodeFiles, displayFileTree, organizeFileTree]);

  // Notify parent component when expansion state changes
  useEffect(() => {
    if (onExpand && id) {
      // Add slight delay to allow animation to start
      const timer = setTimeout(() => {
        onExpand(isExpanded, id);
        setHasNotifiedExpansion(true);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isExpanded, id, onExpand]);

  // Listen to animation height changes to update line connections during animation
  useMotionValueEvent(animatedHeight, "change", (latest) => {
    // Only trigger additional updates during animation
    if (hasNotifiedExpansion && latest > 0 && latest < 1 && onExpand && id) {
      onExpand(isExpanded, id);
    }

    // Add a class to the card element during animation to help PathLine detect changes
    const cardElement = document.getElementById(id);
    if (cardElement) {
      if (latest > 0 && latest < 1) {
        cardElement.setAttribute("data-animating", "true");
      } else {
        cardElement.removeAttribute("data-animating");
      }
    }
  });

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

  // Import improved isPlaceholderOrEmptyCode function with enhanced code quality checks
  const isPlaceholderOrEmptyCode = (
    content: string | null | undefined,
  ): boolean => {
    // If content is null, undefined, or empty
    if (!content || content.trim() === "") {
      return true;
    }

    const trimmedCode = content.trim();

    // If content is very short (less than 30 chars), consider it placeholder
    // Increased from 10 to 30 chars for better quality filtering
    if (trimmedCode.length < 30) {
      return true;
    }

    // Common placeholder patterns - expanded to catch more cases
    const placeholderPatterns = [
      // Sample code or placeholder text
      /sample code generated for placeholder/i,
      /This file was auto-generated/i,
      /auto(?:\s|-)?generated/i,
      /reconstructed/i,
      /placeholder document/i,
      /placeholder implementation/i,
      /placeholder code/i,
      /no code files were found/i,
      /no code content available/i,
      /actual implementation would depend/i,
      // Template/placeholder language
      /Lorem ipsum/i,
      // AI-generated placeholders
      /\[code would go here\]/i,
      /\[code\]/i,
      /\[insert code\]/i,
      /TODO: Implement/i,
      /to be implemented/i,
      // Empty file indicators
      /file intentionally left empty/i,
      /^\/\/ empty$/i,
      // Comments only patterns
      /^(\s*\/\/.*|\s*\/\*[\s\S]*?\*\/\s*)*$/,
      // Placeholder functions
      /^function\s+\w+\(\)\s*{\s*\/\/.*\s*}$/,
      // Stub functions with minimal implementation
      /function\s+\w+\(\)\s*{\s*return\s+null;\s*}/i,
      /function\s+\w+\(\)\s*{\s*return\s+undefined;\s*}/i,
      /function\s+\w+\(\)\s*{\s*return\s+'';\s*}/i,
      // Common error patterns
      /fallback implementation/i,
      /error generating code/i,
      // Quick returns with no implementation
      /return\s*\{\s*\}/i,
      /return\s*\[\s*\]/i,
    ];

    // Check for common placeholder patterns
    for (const pattern of placeholderPatterns) {
      if (pattern.test(trimmedCode)) {
        return true;
      }
    }

    // Check if it's just comments with no actual code
    const contentWithoutComments = trimmedCode
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // If after removing comments the content is just whitespace
    if (contentWithoutComments.trim() === "") {
      return true;
    }

    // Enhanced code quality checks

    // Check for minimum line count (at least 5 non-empty lines of code)
    const nonEmptyLines = contentWithoutComments
      .split("\n")
      .filter((line) => line.trim() !== "").length;
    if (nonEmptyLines < 5) {
      return true;
    }

    // Check for code complexity - must have at least one control structure or function definition
    const hasControlStructures =
      /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|function\s+\w+\s*\(|=>\s*{/.test(
        contentWithoutComments,
      );
    if (!hasControlStructures) {
      // If it's just variable declarations or simple statements, it's probably not substantial code
      return true;
    }

    return false;
  };

  // Get files to display - prioritize cached files with step info and filter out placeholders
  const filesToDisplay = useMemo(() => {
    // Create a cache key that matches the one used in fetchCodeFiles
    const cacheKey =
      runId !== undefined && stepIndex !== undefined
        ? `step_${runId}_${stepIndex}`
        : `doc_${id}`;

    console.log(
      `FilesToDisplay: Looking for files with cache key ${cacheKey} for step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"}`,
    );

    // First, get all potential files
    let allFiles: CodeFile[] = [];

    // Check step-specific cache first (highest priority)
    if (cachedFiles[cacheKey]?.length > 0) {
      console.log(
        `Found ${cachedFiles[cacheKey].length} files in step-specific cache ${cacheKey}`,
      );
      allFiles = cachedFiles[cacheKey];
    }
    // Then check if we have files in the fixed state for this specific step
    else if (fixedCodeFiles.length > 0) {
      // Check if these files belong to the current step
      const currentStepFiles = fixedCodeFiles.filter(
        (file: any) =>
          file.cacheKey === cacheKey ||
          (file.stepInfo?.runId === runId &&
            file.stepInfo?.stepNumber === stepIndex),
      );

      if (currentStepFiles.length > 0) {
        console.log(
          `Using ${currentStepFiles.length} files from fixed state that match current step`,
        );
        allFiles = currentStepFiles.map((file) => ({
          filename: file.filename || "Unknown",
          language: file.language || "plaintext",
          code: file.code || "// No code content available for this file",
          id: file.id,
          stepInfo: { runId, stepNumber: stepIndex }, // Ensure stepInfo is current
          cacheKey, // Add cacheKey to ensure association with this step
        }));
      } else {
        console.log(
          `Fixed code files don't match current step, using all ${fixedCodeFiles.length} files`,
        );
        allFiles = fixedCodeFiles.map((file) => ({
          filename: file.filename || "Unknown",
          language: file.language || "plaintext",
          code: file.code || "// No code content available for this file",
          id: file.id,
          stepInfo: { runId, stepNumber: stepIndex }, // Set to current step
          cacheKey, // Add cacheKey to ensure association with this step
        }));
      }
    }
    // Check document cache (no step info, lower priority)
    else if (id && cachedFiles[id]?.length > 0) {
      console.log(
        `Using ${cachedFiles[id].length} files from document cache ${id}`,
      );
      allFiles = cachedFiles[id].map((file) => ({
        ...file,
        // Add step info to help with context
        stepInfo: { runId, stepNumber: stepIndex },
        cacheKey, // Add cacheKey to ensure association with this step
      }));
    }
    // Then props as last resort
    else if (codeFiles.length > 0) {
      console.log(`Using ${codeFiles.length} files from props for ${cacheKey}`);
      allFiles = codeFiles.map((file) => ({
        filename: file.filename || "Unknown",
        language: file.language || "plaintext",
        code: file.code || "// No code content available for this file",
        id: file.id || `${cacheKey}_${file.filename}`,
        // Add step info to help with context
        stepInfo: { runId, stepNumber: stepIndex },
        cacheKey, // Add cacheKey to ensure association with this step
      }));
    }

    // Add sequential thinking info to file content
    const filesWithContext = allFiles.map((file) => {
      // Skip if we don't have step info or it's already a placeholder
      if (isPlaceholderOrEmptyCode(file.code) || !stepIndex) {
        return file;
      }

      // Add sequential context header to the code
      return {
        ...file,
        code: `// Step ${stepIndex + 1}: ${title}\n// This code represents the implementation at step ${stepIndex + 1} of the solution\n\n${file.code}`,
      };
    });

    // Filter out placeholder or empty files
    const meaningfulFiles = filesWithContext.filter(
      (file) => !isPlaceholderOrEmptyCode(file.code),
    );

    if (filesWithContext.length > 0 && meaningfulFiles.length === 0) {
      console.log(
        `All ${filesWithContext.length} code files for step ${title} were placeholders or empty`,
      );
    } else if (filesWithContext.length > meaningfulFiles.length) {
      console.log(
        `Filtered out ${filesWithContext.length - meaningfulFiles.length} placeholder/empty files from step ${title}`,
      );
    }

    // If we have meaningful files, return them
    if (meaningfulFiles.length > 0) {
      return meaningfulFiles;
    }

    // Fallback with an informative message when no meaningful files are found
    return [
      {
        filename: "No Code Available",
        language: "plaintext",
        code: `// No meaningful code files available for step ${stepIndex !== undefined ? stepIndex + 1 : ""}: ${title}\n// The solution might be a concept demonstration or reference only.`,
        id: `${cacheKey}_no_code`,
        stepInfo: { runId, stepNumber: stepIndex },
      },
    ];
  }, [fixedCodeFiles, codeFiles, id, cachedFiles, title, runId, stepIndex]);

  // Custom toggle function to ensure connections update
  const handleToggleExpand = () => {
    setHasNotifiedExpansion(false); // Reset notification flag

    // Add a resize attribute to help observers detect the change
    const cardElement = document.getElementById(id);
    if (cardElement) {
      // Set a different value each toggle to ensure mutation is detected
      cardElement.setAttribute(
        "data-resize-trigger",
        isExpanded ? "collapsed" : "expanded",
      );
    }

    toggleExpand();
  };

  return (
    <motion.div
      id={id}
      className="relative w-full solution-card"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      layout // Added to help with dynamic layout changes
      data-expanded={isExpanded ? "true" : "false"}
      data-card-type={type}
      data-step-index={stepIndex || 0}
      data-run-id={runId || 0}
    >
      {/* Invisible connection point for path calculation (top) */}
      <div
        className="connection-point-top"
        data-connection-id={`${id}-top`}
        id={`${id}-top`}
      />

      {/* Visible endpoint marker for top connection (decorative) */}
      <div
        className="endpoint-marker endpoint-marker-top"
        data-marker-id={`${id}-top-marker`}
        id={`${id}-top-marker`}
      />

      <Card
        className={cn(
          "flex flex-col min-h-[240px] max-h-[400px]",
          `border-l-4 ${typeStyles[type]}`,
        )}
      >
        <CardHeader className="pb-2 space-y-3 flex-shrink-0">
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
              !isLoadingCodeFiles &&
              filesToDisplay.length === 1 &&
              filesToDisplay[0].filename === "No Code Available"
                ? "opacity-70 hover:opacity-100"
                : ""
            }`}
            onClick={() => {
              // If no code files are available, trigger a refresh when clicking the button
              if (
                !isLoadingCodeFiles &&
                filesToDisplay.length === 1 &&
                filesToDisplay[0].filename === "No Code Available"
              ) {
                fetchCodeFiles(); // Try again
              }
              setShowCodeModal(true);
            }}
          >
            {isLoadingCodeFiles ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                Loading Code...
              </>
            ) : filesToDisplay.length === 1 &&
              filesToDisplay[0].filename === "No Code Available" ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3" />
                Check for Code
              </>
            ) : (
              <>
                <Code className="mr-1 h-3 w-3" />
                View Code
              </>
            )}
          </Button>
        </CardFooter>

        {/* Code File Modal */}
        <Dialog
          open={showCodeModal}
          onOpenChange={(open) => setShowCodeModal(open)}
        >
          <DialogContent className="sm:max-w-7xl h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle>{title}</DialogTitle>
                {stepIndex !== undefined && (
                  <span className="text-xs font-normal text-slate-500">
                    Step {stepIndex + 1}
                  </span>
                )}
              </div>
              <DialogDescription>{description}</DialogDescription>

              {/* File Tree Display */}
              {displayFileTree && (
                <div className="mt-4 px-4 py-2 border border-slate-200 rounded-md bg-slate-50">
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <FileText className="h-4 w-4 text-slate-500 mr-2" />
                    Project Structure
                  </h3>
                  <pre className="text-xs whitespace-pre overflow-x-auto max-h-[200px] overflow-y-auto p-2 bg-white rounded border border-slate-200 font-mono">
                    {displayFileTree}
                  </pre>
                </div>
              )}
              {/* Enhanced debugging for file tree issues - this runs on render and doesn't affect display */}
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden">
              {isLoadingCodeFiles ? (
                <div className="h-full flex items-center justify-center py-10">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary/50" />
                    <span className="text-sm text-slate-500">
                      Loading code...
                    </span>
                  </div>
                </div>
              ) : filesToDisplay.length > 0 &&
                filesToDisplay[0].filename !== "No Code Available" ? (
                <ScrollArea className="h-full">
                  <div className="space-y-6 px-4 pb-4">
                    {/* Log current step info for debugging */}
                    {(() => {
                      console.log(
                        `Rendering code files for step ${stepIndex !== undefined ? stepIndex + 1 : "unknown"}, run ${runId || "unknown"}, files: ${filesToDisplay.length}`,
                      );
                      return null;
                    })()}

                    {filesToDisplay.map((file, index) => {
                      // Extract file metadata to detect changes
                      const metadata = (file as any).metadata || {};
                      const isNewFile = metadata.isNewFile === true;
                      const hasChanges = metadata.previousStepInfo?.changes;

                      // Log file association to verify correct files are displayed with each step
                      // Log with proper type handling
                      (() => {
                        console.log(
                          `File ${index + 1}/${filesToDisplay.length}: ${file.filename}, stepInfo: ${(file as any).stepInfo?.stepNumber !== undefined ? (file as any).stepInfo?.stepNumber + 1 : "none"}`,
                        );
                        return null;
                      })();

                      return (
                        <div
                          key={`${file.id || index}-${file.filename}`}
                          className="relative"
                        >
                          {/* File header with enhancement information */}
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center">
                              <h3 className="text-base font-medium text-slate-800 mr-2">
                                {file.filename}
                              </h3>

                              {/* New file badge */}
                              {isNewFile && (
                                <Badge className="bg-blue-50 hover:bg-blue-50 text-blue-700 border-blue-100 mr-2">
                                  New file
                                </Badge>
                              )}

                              {/* File change indicators */}
                              {hasChanges && (
                                <Badge
                                  className={cn(
                                    "border",
                                    hasChanges.changePercentage >= 40
                                      ? "bg-yellow-50 hover:bg-yellow-50 text-amber-700 border-amber-200"
                                      : hasChanges.changePercentage >= 20
                                        ? "bg-green-50 hover:bg-green-50 text-green-700 border-green-200"
                                        : "bg-slate-50 hover:bg-slate-50 text-slate-700 border-slate-200",
                                  )}
                                >
                                  {hasChanges.summary}
                                </Badge>
                              )}
                            </div>

                            {/* Change statistics */}
                            {hasChanges && (
                              <div className="flex items-center text-xs space-x-3 text-slate-500">
                                <span className="flex items-center">
                                  <PlusIcon className="h-3 w-3 text-green-500 mr-1" />
                                  {hasChanges.linesAdded}
                                </span>
                                <span className="flex items-center">
                                  <MinusIcon className="h-3 w-3 text-red-500 mr-1" />
                                  {hasChanges.linesRemoved}
                                </span>
                                <span className="flex items-center">
                                  <EditIcon className="h-3 w-3 text-blue-500 mr-1" />
                                  {hasChanges.linesChanged}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Show a brief change summary for significant changes */}
                          {hasChanges && hasChanges.changePercentage >= 20 && (
                            <div className="mb-2 text-xs bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
                              <span className="font-medium">
                                Changes from previous step:{" "}
                              </span>
                              {hasChanges.summary}({hasChanges.linesAdded} lines
                              added, {hasChanges.linesRemoved} lines removed,{" "}
                              {hasChanges.linesChanged} lines modified)
                            </div>
                          )}

                          {/* Code preview component */}
                          <CodeBlock>
                            <CodeBlockCode
                              code={file.code}
                              language={file.language || "plaintext"}
                              showMetadata={true}
                              changesHighlight={
                                hasChanges
                                  ? {
                                      isNewFile: isNewFile,
                                      linesAdded: hasChanges.linesAdded,
                                      linesRemoved: hasChanges.linesRemoved,
                                      linesChanged: hasChanges.linesChanged,
                                      changePercentage:
                                        hasChanges.changePercentage,
                                      summary: hasChanges.summary,
                                    }
                                  : isNewFile
                                    ? { isNewFile: true }
                                    : undefined
                              }
                              metadata={{
                                model: model || "Unknown",
                                runId: runId,
                                source: file.filename,
                              }}
                            />
                          </CodeBlock>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex items-center justify-center py-10">
                  <div className="text-center">
                    <CodeIcon className="h-12 w-12 mx-auto text-slate-300" />
                    <p className="mt-4 text-sm text-slate-500">
                      No code files available for this solution
                    </p>
                    <p className="mt-2 text-xs text-slate-400 max-w-md">
                      This step might be a concept explanation or reference
                      description. Try using the search feature to find relevant
                      code snippets.
                    </p>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs flex items-center gap-1"
                        onClick={fetchCodeFiles} // Add refresh capability
                      >
                        <RefreshCw className="h-3 w-3" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between items-center flex-shrink-0 mt-4">
              <div className="text-xs text-slate-500">
                {model && <span>Generated with {model}</span>}
              </div>
              <Button variant="outline" onClick={() => setShowCodeModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Invisible connection point for path calculation (bottom) */}
      <div
        className="connection-point-bottom"
        data-connection-id={`${id}-bottom`}
        id={`${id}-bottom`}
      />

      {/* Visible endpoint marker for bottom connection (decorative) */}
      <div
        className="endpoint-marker endpoint-marker-bottom"
        data-marker-id={`${id}-bottom-marker`}
        id={`${id}-bottom-marker`}
      />
    </motion.div>
  );
}
