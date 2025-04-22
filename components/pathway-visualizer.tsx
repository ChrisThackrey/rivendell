"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { generateText, getTemperatureFromIntensity } from "@/lib/ai-service";
import {
  storeDocumentWithEmbedding,
  evaluateResponse,
  getDocumentsByBatchId,
} from "@/lib/embedding-service";
import {
  getStepsByBatchId,
  getAvailableBatches,
  groupStepsByStepIndex,
} from "@/lib/step-service";
import { supabase, type CodeFile } from "@/lib/supabase-client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StepCarousel, {
  Solution as CarouselSolution,
} from "@/components/step-carousel";
import StepConnectionManager from "@/components/step-connection-manager";
import EnsembleConfigCard from "@/components/ensemble-config-card";
import type { ModelConfig } from "./ensemble-selection-modal";
import type {
  DocumentMetadata,
  DecisionType,
  ScoreMetrics,
} from "@/lib/supabase-client";
import LinesContainer from "@/components/lines-container";
import PathLine from "@/components/path-line";

type Metric = {
  executionTime: string;
  complexity: string;
  memoryUsage: string;
  lineCount: number;
  codeQuality?: number;
};

type Solution = {
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
  runId?: number;
  stepIndex?: number; // Index of the step in the solution sequence
  batchId?: string; // ID for grouping solutions from the same query
  embeddings?: {
    documentId: string | null;
    metadata: DocumentMetadata;
  };
  codeFiles?: CodeFile[]; // Add code files array
  fileTree?: string; // Add file tree representation
};

type Step = {
  id: string;
  title: string;
  solutions: Solution[];
  stepIndex?: number; // Position in the solution sequence (1-6)
  batchId?: string; // ID for grouping steps from the same query
};

type Connection = {
  from: string;
  to: string;
  type: "accepted" | "secondary" | "rejected";
  level: number; // Which level this connection belongs to
};

// Unused type - commented out to fix linting warning
// type StepComment = {
//   stepId: string
//   comment: string
// }

// Import Tech Option type from tech-stack-modal
import type { TechOption } from "@/components/tech-stack-modal";

// Update the props type
type PathwayVisualizerProps = {
  query: string;
  selectedModels: ModelConfig[];
  selectedIntensity: "low" | "medium" | "high";
  selectedTechStack: TechOption[];
  initialBatchId?: string | null;
  includeAllDecisionTypes?: boolean;
  showConnections?: boolean;
};

// Add new types for progress tracking
type ProgressStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "error";
  details?: string[];
  timestamp: number;
};

// Add new types for run tracking
type ModelRunStatus = {
  modelId: number;
  temperature: "low" | "medium" | "high";
  status: "pending" | "active" | "completed" | "error";
};

// Update the function signature
export default function PathwayVisualizer({
  query,
  selectedModels,
  selectedIntensity,
  selectedTechStack,
  initialBatchId = null,
  includeAllDecisionTypes = false,
  showConnections = false,
}: PathwayVisualizerProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  // These state variables are currently unused but may be used in future development

  const [, setVisibleConnections] = useState<Connection[]>([]);
  const [, setCurrentLevel] = useState(0);

  const [, setShowOptimizedPath] = useState(false);
  const [highlightedConnections, setHighlightedConnections] = useState<
    Set<string>
  >(new Set());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Comment-related state (commented out for now)
  // const [comments, setComments] = useState<StepComment[]>([])
  // const [currentComment, setCurrentComment] = useState("")

  const [isAnimating, setIsAnimating] = useState(false);
  const [allSteps, setAllSteps] = useState<Step[]>([]);
  // Continue button state (commented out but keeping the variable for future use)

  const [, setShowContinueButton] = useState(false);
  const [lineKey, setLineKey] = useState(0); // Key to force line re-render
  const [isLoading, setIsLoading] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [groupedSteps, setGroupedSteps] = useState<{
    [stepIndex: number]: Solution[];
  }>({});

  const [, setLoadingSteps] = useState<boolean>(false);
  // Add state for visible solutions by step index
  const [visibleSolutionsByStep, setVisibleSolutionsByStep] = useState<
    Record<number, Solution[]>
  >({});

  // Add state for carousel pagination
  const [carouselPage, setCarouselPage] = useState(0);
  const [maxCarouselPages, setMaxCarouselPages] = useState(1);

  // Add state for similarity connections between steps
  const [similarityConnections, setSimilarityConnections] = useState<
    {
      from: string;
      to: string;
      type: "accepted" | "secondary" | "rejected";
      color: string;
    }[]
  >([]);

  // Add state for available batches and selected batch - CRUCIAL to initialize with empty string
  const [availableBatches, setAvailableBatches] = useState<
    { batch_id: string; step_count: number; latest_created_at: string }[]
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  // Add new state for progress tracking
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [currentProgressStep, setCurrentProgressStep] = useState<string | null>(
    null,
  );
  const [completedRuns, setCompletedRuns] = useState<ModelRunStatus[]>([]);
  const [activeRuns, setActiveRuns] = useState<ModelRunStatus[]>([]);
  const [errorRuns, setErrorRuns] = useState<ModelRunStatus[]>([]);
  const [totalRunCount, setTotalRunCount] = useState<number>(0);
  const [completedRunCount, setCompletedRunCount] = useState<number>(0);
  const [errorRunCount, setErrorRunCount] = useState<number>(0);

  // Add state for storing code files
  const [solutionCodeFiles, setSolutionCodeFiles] = useState<
    Record<string, CodeFile[]>
  >({});
  const [loadingCodeFiles, setLoadingCodeFiles] = useState<
    Record<string, boolean>
  >({});

  // Function to update run status for a specific model and temperature
  const updateRunStatus = (
    modelId: number,
    temperature: "low" | "medium" | "high",
    status: "pending" | "active" | "completed" | "error",
  ) => {
    // Check if this run is already completed - avoid double counting
    const isAlreadyCompleted = completedRuns.some(
      (run) => run.modelId === modelId && run.temperature === temperature,
    );

    // Remove from all statuses first
    setActiveRuns((prev) =>
      prev.filter(
        (run) => !(run.modelId === modelId && run.temperature === temperature),
      ),
    );
    setCompletedRuns((prev) =>
      prev.filter(
        (run) => !(run.modelId === modelId && run.temperature === temperature),
      ),
    );
    setErrorRuns((prev) =>
      prev.filter(
        (run) => !(run.modelId === modelId && run.temperature === temperature),
      ),
    );

    // Add to appropriate state based on status
    const newRunStatus = { modelId, temperature, status };

    if (status === "active") {
      setActiveRuns((prev) => [...prev, newRunStatus]);
    } else if (status === "completed") {
      setCompletedRuns((prev) => [...prev, newRunStatus]);
      // Only increment completed count if this run wasn't already completed
      if (!isAlreadyCompleted) {
        setCompletedRunCount((prev) => {
          const newCount = prev + 1;
          console.log(`Completed run count updated: ${prev} → ${newCount}`);
          return newCount;
        });
      }
    } else if (status === "error") {
      setErrorRuns((prev) => [...prev, newRunStatus]);
      setErrorRunCount((prev) => prev + 1);
    }
  };

  // Function to update progress steps
  const updateProgress = (
    stepId: string,
    status: "pending" | "in-progress" | "completed" | "error",
    details?: string[],
  ) => {
    setProgressSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status,
              details: details || step.details,
              timestamp: Date.now(),
            }
          : step,
      ),
    );

    if (status === "in-progress") {
      setCurrentProgressStep(stepId);
    } else if (status === "completed" && currentProgressStep === stepId) {
      // Find next pending step
      const nextStep = progressSteps.find((s) => s.status === "pending");
      setCurrentProgressStep(nextStep?.id || null);
    }
  };

  // Function to add a detail to the current progress step
  const addProgressDetail = (stepId: string, detail: string) => {
    setProgressSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              details: [...(step.details || []), detail],
            }
          : step,
      ),
    );
  };

  // Function to fetch code files for a solution
  const fetchCodeFilesForSolution = useCallback(
    async (solution: Solution) => {
      // Skip if we already have code files or are currently loading them
      if (solutionCodeFiles[solution.id] || loadingCodeFiles[solution.id]) {
        return;
      }

      // Set loading state for this solution
      setLoadingCodeFiles((prev) => ({ ...prev, [solution.id]: true }));

      try {
        console.log(
          `Fetching code files for solution ${solution.id} (runId: ${solution.runId}, stepIndex: ${solution.stepIndex})`,
        );

        // First check if the solution already has code files in its metadata
        if (solution.embeddings?.metadata?.codeFiles) {
          const existingCodeFiles = solution.embeddings.metadata.codeFiles;
          if (
            Array.isArray(existingCodeFiles) &&
            existingCodeFiles.length > 0
          ) {
            console.log(
              `Found ${existingCodeFiles.length} code files in solution metadata`,
            );
            setSolutionCodeFiles((prev) => ({
              ...prev,
              [solution.id]: existingCodeFiles,
            }));
            setLoadingCodeFiles((prev) => ({ ...prev, [solution.id]: false }));
            return;
          }
        }

        // If the solution doesn't have code files, check if it has runId and stepIndex to fetch from API
        if (solution.runId && solution.stepIndex !== undefined) {
          console.log(
            `Calling API to fetch code files for runId: ${solution.runId}, step: ${solution.stepIndex}`,
          );

          const response = await fetch("/api/search-codefiles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "step",
              runId: solution.runId,
              stepNumber: solution.stepIndex,
              batchId: solution.batchId,
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch code files: ${response.status} ${response.statusText}`,
            );
          }

          const data = await response.json();

          if (data.success && data.files && Array.isArray(data.files)) {
            console.log(
              `Retrieved ${data.files.length} code files from API for solution ${solution.id}`,
            );

            // Convert API format to CodeFile format
            const codeFiles: CodeFile[] = data.files.map((file: any) => ({
              filename: file.filename,
              language: file.language || "plaintext",
              code: file.code,
            }));

            // Store the code files
            setSolutionCodeFiles((prev) => ({
              ...prev,
              [solution.id]: codeFiles,
            }));
          } else {
            console.log(
              `No code files found for solution ${solution.id} via API`,
            );
            setSolutionCodeFiles((prev) => ({ ...prev, [solution.id]: [] }));
          }
        } else if (solution.embeddings?.documentId) {
          // If we have a document ID but no runId/stepIndex, try to fetch code files by document ID
          console.log(
            `Fetching code files by document ID: ${solution.embeddings.documentId}`,
          );

          const response = await fetch("/api/search-codefiles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "document-metadata",
              documentId: solution.embeddings.documentId,
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch code files: ${response.status} ${response.statusText}`,
            );
          }

          const data = await response.json();

          if (
            data.success &&
            data.metadata?.codeFiles &&
            Array.isArray(data.metadata.codeFiles)
          ) {
            console.log(
              `Retrieved ${data.metadata.codeFiles.length} code files from document metadata for solution ${solution.id}`,
            );
            setSolutionCodeFiles((prev) => ({
              ...prev,
              [solution.id]: data.metadata.codeFiles,
            }));
          } else {
            console.log(
              `No code files found in document metadata for solution ${solution.id}`,
            );
            setSolutionCodeFiles((prev) => ({ ...prev, [solution.id]: [] }));
          }
        } else {
          console.log(
            `No runId/stepIndex or documentId available for solution ${solution.id}, can't fetch code files`,
          );
          setSolutionCodeFiles((prev) => ({ ...prev, [solution.id]: [] }));
        }
      } catch (error) {
        console.error(
          `Error fetching code files for solution ${solution.id}:`,
          error,
        );
        setSolutionCodeFiles((prev) => ({ ...prev, [solution.id]: [] }));
      } finally {
        setLoadingCodeFiles((prev) => ({ ...prev, [solution.id]: false }));
      }
    },
    [solutionCodeFiles],
  );

  // Initialize progress steps and run counts based on selected models and runs
  useEffect(() => {
    if (!isLoading) return;

    // Calculate total runs
    let runCount = 0;
    selectedModels.forEach((model) => {
      runCount += model.runsLow + model.runsMedium + model.runsHigh;
    });

    setTotalRunCount(runCount);
    setCompletedRunCount(0);
    setErrorRunCount(0);
    setCompletedRuns([]);
    setActiveRuns([]);
    setErrorRuns([]);

    // Create initial progress steps
    const initialProgressSteps: ProgressStep[] = [
      {
        id: "init",
        title: "Initialization",
        description: "Setting up the environment and preparing for generation",
        status: "in-progress",
        details: ["Configuring model parameters", "Preparing batch processing"],
        timestamp: Date.now(),
      },
      {
        id: "generate",
        title: "Content Generation",
        description: "Generating solutions across selected models",
        status: "pending",
        details: [],
        timestamp: Date.now(),
      },
      {
        id: "evaluate",
        title: "Evaluation",
        description: "Evaluating generated solutions with AI",
        status: "pending",
        details: [],
        timestamp: Date.now(),
      },
      {
        id: "store",
        title: "Storage & Embedding",
        description: "Storing and embedding solutions in the database",
        status: "pending",
        details: [],
        timestamp: Date.now(),
      },
      {
        id: "process",
        title: "Processing Results",
        description: "Processing and organizing final results",
        status: "pending",
        details: [],
        timestamp: Date.now(),
      },
    ];

    setProgressSteps(initialProgressSteps);
    setCurrentProgressStep("init");
  }, [isLoading, selectedModels]);

  // Fetch available batches separately to avoid dependency issues
  useEffect(() => {
    async function fetchAvailableBatches() {
      try {
        const batches = await getAvailableBatches();
        setAvailableBatches(batches);

        // Critical: Force selectedBatchId to empty string to ensure placeholder is shown
        // This must happen after batches are loaded to prevent auto-selection
        setSelectedBatchId("");
      } catch (error) {
        console.error("Error fetching batches:", error);
      }
    }

    fetchAvailableBatches();
  }, []); // Only run on mount

  // Initialize visibleSolutionsByStep with solutions from all types (RECOMMENDED, VIABLE, PROBLEMATIC)
  useEffect(() => {
    // Skip if no grouped steps
    if (Object.keys(groupedSteps).length === 0) return;

    // Create stable reference for the update operation
    const initialVisibleSolutions: Record<number, Solution[]> = {};

    // Get groups with unique step indices - important to avoid mixing steps
    Object.keys(groupedSteps).forEach((stepIndexStr) => {
      const stepIndex = Number(stepIndexStr);
      // Make sure we have valid solutions for this step
      if (groupedSteps[stepIndex] && groupedSteps[stepIndex].length > 0) {
        const stepSolutions = groupedSteps[stepIndex].filter(
          // Verify the solution actually belongs to this step index
          (solution) => solution.stepIndex === stepIndex,
        );

        // Ensure we have a balanced representation of all solution types
        const recommendedSolutions = stepSolutions.filter(
          (s) => s.type === "accepted",
        );
        const viableSolutions = stepSolutions.filter(
          (s) => s.type === "secondary",
        );
        const problematicSolutions = stepSolutions.filter(
          (s) => s.type === "rejected",
        );

        console.log(`Step ${stepIndex} available solutions by type:`, {
          recommended: recommendedSolutions.length,
          viable: viableSolutions.length,
          problematic: problematicSolutions.length,
          total: stepSolutions.length,
        });

        // Create balanced solution array with prioritized representation of all types
        const allSolutions = [];

        // First add recommended solutions - prioritize these
        const recommendedToAdd = Math.min(recommendedSolutions.length, 10);
        if (recommendedToAdd > 0) {
          console.log(
            `Adding ${recommendedToAdd} RECOMMENDED solutions to step ${stepIndex}`,
          );
          allSolutions.push(...recommendedSolutions.slice(0, recommendedToAdd));
        }

        // Then add problematic solutions - ensure these are represented
        const problematicToAdd = Math.min(problematicSolutions.length, 10);
        if (problematicToAdd > 0) {
          console.log(
            `Adding ${problematicToAdd} PROBLEMATIC solutions to step ${stepIndex}`,
          );
          allSolutions.push(...problematicSolutions.slice(0, problematicToAdd));
        }

        // Then add viable solutions
        const viableToAdd = Math.min(viableSolutions.length, 10);
        if (viableToAdd > 0) {
          console.log(
            `Adding ${viableToAdd} VIABLE solutions to step ${stepIndex}`,
          );
          allSolutions.push(...viableSolutions.slice(0, viableToAdd));
        }

        // Add remaining solutions up to a reasonable limit (50 total)
        const remainingSlots = 50 - allSolutions.length;
        if (remainingSlots > 0) {
          // Create a pool of remaining solutions not already added
          const addedIds = new Set(allSolutions.map((s) => s.id));
          const remainingSolutions = stepSolutions.filter(
            (s) => !addedIds.has(s.id),
          );

          if (remainingSolutions.length > 0) {
            const additionalToAdd = Math.min(
              remainingSolutions.length,
              remainingSlots,
            );
            console.log(
              `Adding ${additionalToAdd} additional solutions to step ${stepIndex}`,
            );
            allSolutions.push(...remainingSolutions.slice(0, additionalToAdd));
          }
        }

        // Only add if we have solutions for this step
        if (allSolutions.length > 0) {
          // De-duplicate in case there's overlap
          const uniqueIds = new Set<string>();
          initialVisibleSolutions[stepIndex] = allSolutions.filter(
            (solution) => {
              if (uniqueIds.has(solution.id)) return false;
              uniqueIds.add(solution.id);
              return true;
            },
          );

          // Log final distribution
          console.log(`Step ${stepIndex} initial solutions distribution:`, {
            recommended: initialVisibleSolutions[stepIndex].filter(
              (s) => s.type === "accepted",
            ).length,
            viable: initialVisibleSolutions[stepIndex].filter(
              (s) => s.type === "secondary",
            ).length,
            problematic: initialVisibleSolutions[stepIndex].filter(
              (s) => s.type === "rejected",
            ).length,
            total: initialVisibleSolutions[stepIndex].length,
          });
        }
      }
    });

    // Create stable string representations to compare
    const currentStateStr = JSON.stringify(visibleSolutionsByStep);
    const newStateStr = JSON.stringify(initialVisibleSolutions);

    // Only update state if there's an actual change to avoid re-renders
    if (currentStateStr !== newStateStr) {
      setVisibleSolutionsByStep(initialVisibleSolutions);
      // Force redraw of connection lines
      setLineKey((prevKey) => prevKey + 1);
    }
  }, [groupedSteps]); // Add groupedSteps as a dependency to update when steps change

  // Define the optimized solution path connections - currently unused but keeping for future implementation
  const _optimizedPath: Connection[] = [
    { from: "input", to: "s2", type: "accepted", level: 0 },
    { from: "s2", to: "s6", type: "accepted", level: 1 },
    { from: "s6", to: "s10", type: "accepted", level: 2 },
    { from: "s10", to: "s12", type: "accepted", level: 3 },
    { from: "s12", to: "s16", type: "accepted", level: 4 },
  ];

  // Define all possible connections with their levels
  const allConnections = useMemo<Connection[]>(
    () => [
      // Level 1: From input to first level (level 0)
      { from: "input", to: "s1", type: "rejected", level: 0 },
      { from: "input", to: "s2", type: "accepted", level: 0 },
      { from: "input", to: "s3", type: "secondary", level: 0 },
      { from: "input", to: "s4", type: "secondary", level: 0 },

      // Level 2: From first level to second level (level 1)
      { from: "s1", to: "s7", type: "rejected", level: 1 },
      { from: "s2", to: "s6", type: "accepted", level: 1 },
      { from: "s3", to: "s5", type: "secondary", level: 1 },
      { from: "s4", to: "s8", type: "secondary", level: 1 },

      // Level 3: From second level to third level (level 2)
      { from: "s5", to: "s9", type: "secondary", level: 2 },
      { from: "s6", to: "s10", type: "accepted", level: 2 },
      { from: "s8", to: "s11", type: "secondary", level: 2 },

      // Level 4: From third level to fourth level (level 3)
      { from: "s9", to: "s13", type: "secondary", level: 3 },
      { from: "s10", to: "s12", type: "accepted", level: 3 },
      { from: "s11", to: "s15", type: "secondary", level: 3 },
      { from: "s7", to: "s14", type: "rejected", level: 3 },

      // Level 5: From fourth level to final outcome (level 4)
      { from: "s12", to: "s16", type: "accepted", level: 4 },
      { from: "s13", to: "s16", type: "secondary", level: 4 },
      { from: "s15", to: "s16", type: "secondary", level: 4 },
    ],
    [],
  );

  // Build connection maps for forward and backward connections
  const forwardConnections = new Map<string, string[]>();
  const backwardConnections = new Map<string, string[]>();

  allConnections.forEach((conn) => {
    // Forward connections (from -> to)
    if (!forwardConnections.has(conn.from)) {
      forwardConnections.set(conn.from, []);
    }
    forwardConnections.get(conn.from)?.push(conn.to);

    // Backward connections (to -> from)
    if (!backwardConnections.has(conn.to)) {
      backwardConnections.set(conn.to, []);
    }
    backwardConnections.get(conn.to)?.push(conn.from);
  });

  // Function to find directly connected paths (only forward and backward from the hovered connection)
  const findDirectlyConnectedPaths = (
    fromId: string,
    toId: string,
  ): Set<string> => {
    const connectedPairs = new Set<string>();

    // Add the hovered connection
    connectedPairs.add(`${fromId}-${toId}`);

    // Find all forward connections from toId
    const forwardQueue = [toId];
    const forwardVisited = new Set<string>();

    while (forwardQueue.length > 0) {
      const currentId = forwardQueue.shift()!;
      if (forwardVisited.has(currentId)) continue;
      forwardVisited.add(currentId);

      const nextNodes = forwardConnections.get(currentId) || [];
      for (const nextNode of nextNodes) {
        connectedPairs.add(`${currentId}-${nextNode}`);
        forwardQueue.push(nextNode);
      }
    }

    // Find all backward connections from fromId
    const backwardQueue = [fromId];
    const backwardVisited = new Set<string>();

    while (backwardQueue.length > 0) {
      const currentId = backwardQueue.shift()!;
      if (backwardVisited.has(currentId)) continue;
      backwardVisited.add(currentId);

      const prevNodes = backwardConnections.get(currentId) || [];
      for (const prevNode of prevNodes) {
        connectedPairs.add(`${prevNode}-${currentId}`);
        backwardQueue.push(prevNode);
      }
    }

    return connectedPairs;
  };

  const handleLineHover = (
    fromId: string,
    toId: string,
    isHovering: boolean,
  ) => {
    if (isHovering) {
      // Find directly connected paths
      const connectedPaths = findDirectlyConnectedPaths(fromId, toId);
      setHighlightedConnections(connectedPaths);
    } else {
      setHighlightedConnections(new Set());
    }
  };

  // Check if a connection should be highlighted - unused for now but prepared for future functionality
  const isConnectionHighlighted = (fromId: string, toId: string): boolean => {
    return highlightedConnections.has(`${fromId}-${toId}`);
  };

  // Function to get all connections that should be visible based on visible cards
  const getVisibleConnectionsForSteps = useCallback(
    (visibleSteps: Step[]) => {
      if (visibleSteps.length <= 1) {
        // Only the first step is visible, show connections from input to first level
        return allConnections.filter((conn) => conn.level === 0);
      }

      // For all other cases, show connections up to and including the current level
      // This ensures connections within the last visible group are shown
      const lastVisibleStepIndex = visibleSteps.length - 1;
      return allConnections.filter(
        (conn) => conn.level <= lastVisibleStepIndex,
      );
    },
    [allConnections],
  );

  const proceedToNextStep = useCallback(
    (nextIndex: number) => {
      // Collect timer IDs for potential cleanup
      const timers: number[] = [];

      // Set animating state
      setIsAnimating(true);

      // First, clear existing connections to prepare for new ones
      setVisibleConnections([]);

      // Add the next step
      const updatedSteps = [...steps, allSteps[nextIndex]];
      setSteps(updatedSteps);
      setCurrentLevel(nextIndex);
      setCurrentStepIndex(nextIndex);

      // Wait for cards to appear
      const timer1 = window.setTimeout(() => {
        // After cards appear, show the connections with animation
        // Increment the key to force re-render and restart animation
        setLineKey((prevKey) => prevKey + 1);

        const newConnections = getVisibleConnectionsForSteps(updatedSteps);
        setVisibleConnections(newConnections);

        // After connections appear, show the continue button
        const timer2 = window.setTimeout(() => {
          setIsAnimating(false);

          // If this is the final step, show the optimized path after a delay
          if (nextIndex === allSteps.length - 1) {
            const timer3 = window.setTimeout(() => {
              // Show all connections for the final step
              setVisibleConnections(allConnections);

              // Show optimized path after all connections are visible
              const timer4 = window.setTimeout(() => {
                setShowOptimizedPath(true);
              }, 1000);

              timers.push(timer4);
            }, 1000);

            timers.push(timer3);
          } else {
            setShowContinueButton(true);
          }
        }, 1000); // Delay for connections to animate

        timers.push(timer2);
      }, 800); // Delay for cards to appear

      timers.push(timer1);

      // Return cleanup function
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    },
    [steps, allSteps, getVisibleConnectionsForSteps, allConnections],
  );

  // Function to map decision type from evaluation to solution type
  // Using useCallback to fix the dependency warning
  const mapDecisionToSolutionType = useCallback(
    (decision: DecisionType): "accepted" | "secondary" | "rejected" => {
      switch (decision) {
        case "RECOMMENDED":
          return "accepted";
        case "VIABLE":
          return "secondary";
        case "PROBLEMATIC":
          return "rejected";
        default:
          return "secondary";
      }
    },
    [],
  );

  // Commented out but keeping for future use
  const handleContinue = useCallback(() => {
    /*
    if (currentComment.trim()) {
      setComments([...comments, { stepId: steps[currentStepIndex].id, comment: currentComment }])
    }
    setCurrentComment("")
    */

    setShowContinueButton(false);

    if (currentStepIndex < allSteps.length - 1) {
      setIsAnimating(true);
      proceedToNextStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, allSteps.length, proceedToNextStep]);

  // Function to create metadata for embedding storage
  const createDocumentMetadata = (
    model: string,
    runtime: string,
    runId: number,
    temperature: number,
    scores: ScoreMetrics,
    decision: DecisionType,
  ): DocumentMetadata => {
    // Estimate the cost based on the model and runtime
    // This is a simplified calculation and could be refined
    const costMultiplier = model.includes("gpt-4o")
      ? 0.03
      : model.includes("claude")
        ? 0.025
        : 0.005;
    const runtimeMs = parseInt(runtime.replace(/[^0-9]/g, ""));
    const cost = (runtimeMs / 1000) * costMultiplier;

    return {
      model,
      runtime,
      cost,
      runId,
      temperature,
      scores,
      decision,
    };
  };

  // Update assignModelsToSolutions to process multiple runs based on ensemble configuration
  const assignModelsToSolutions = useCallback(async (): Promise<Step[]> => {
    if (!selectedModels || selectedModels.length === 0) {
      throw new Error("No models selected");
    }

    setIsLoading(true);
    setGenerationError(null);

    // After a short delay, update the initialization step to completed
    setTimeout(() => {
      updateProgress("init", "completed");
      updateProgress("generate", "in-progress", ["Starting model runs..."]);
    }, 1000);

    // Here's where you would integrate progress updates throughout the async function
    try {
      // Create empty step structures without placeholder data
      const createEmptyStepStructures = (): Step[] => {
        // First level of steps - initial approaches
        const step1: Step = {
          id: "step1",
          title: "Initial Solutions",
          solutions: [
            // Will be populated with real content only
            {
              id: "s1",
              title: "Initial Approach 1",
              description: "Placeholder description for approach 1",
              type: "rejected",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s2",
              title: "Initial Approach 2",
              description: "Placeholder description for approach 2",
              type: "accepted",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s3",
              title: "Initial Approach 3",
              description: "Placeholder description for approach 3",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s4",
              title: "Initial Approach 4",
              description: "Placeholder description for approach 4",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
          ],
        };

        // Second level of steps - refined solutions
        const step2: Step = {
          id: "step2",
          title: "Refined Solutions",
          solutions: [
            {
              id: "s6",
              title: "Refined Approach 1",
              description: "Placeholder for refined solution 1",
              type: "accepted",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s5",
              title: "Refined Approach 2",
              description: "Placeholder for refined solution 2",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s8",
              title: "Refined Approach 3",
              description: "Placeholder for refined solution 3",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s7",
              title: "Refined Approach 4",
              description: "Placeholder for refined solution 4",
              type: "rejected",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
          ],
        };

        // Third level of steps - implementation details
        const step3: Step = {
          id: "step3",
          title: "Implementation Details",
          solutions: [
            {
              id: "s10",
              title: "Implementation Detail 1",
              description: "Placeholder for implementation details 1",
              type: "accepted",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s9",
              title: "Implementation Detail 2",
              description: "Placeholder for implementation details 2",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s11",
              title: "Implementation Detail 3",
              description: "Placeholder for implementation details 3",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
          ],
        };

        // Fourth level of steps - final solutions
        const step4: Step = {
          id: "step4",
          title: "Final Solutions",
          solutions: [
            {
              id: "s12",
              title: "Final Solution 1",
              description: "Placeholder for final solution 1",
              type: "accepted",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s13",
              title: "Final Solution 2",
              description: "Placeholder for final solution 2",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s15",
              title: "Final Solution 3",
              description: "Placeholder for final solution 3",
              type: "secondary",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
            {
              id: "s14",
              title: "Final Solution 4",
              description: "Placeholder for final solution 4",
              type: "rejected",
              model: "",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 0,
              },
              frequency: {
                count: 0,
                models: [],
              },
            },
          ],
        };

        // Final outcome
        const step5: Step = {
          id: "step5",
          title: "Final Outcome",
          solutions: [
            {
              id: "s16",
              title: "Combined Solution",
              description: "Placeholder for the combined final solution",
              type: "accepted",
              model: "Combined",
              metrics: {
                executionTime: "0s",
                complexity: "O(n)",
                memoryUsage: "0MB",
                lineCount: 0,
              },
            },
          ],
        };

        return [step1, step2, step3, step4, step5];
      };

      // Create empty step containers that will be populated only with real data
      const emptyStepContainers: Step[] = [
        { id: "step1", title: "Initial Solutions", solutions: [] },
        { id: "step2", title: "Refined Solutions", solutions: [] },
        { id: "step3", title: "Implementation Details", solutions: [] },
        { id: "step4", title: "Final Solutions", solutions: [] },
        { id: "step5", title: "Final Outcome", solutions: [] },
      ];

      // Create a clean copy to work with
      const updatedSteps = [...emptyStepContainers];

      // techStackContext is generated only when needed in the processing loop for each run

      // Create a processing queue for all runs across all models
      const processingQueue: {
        modelConfig: ModelConfig;
        intensityLevel: "low" | "medium" | "high";
        temperature: number;
        runNumber: number;
      }[] = [];

      // For each model in the ensemble configuration
      for (const modelConfig of selectedModels) {
        // Get the number of runs for each intensity level
        const { runsLow, runsMedium, runsHigh } = modelConfig;
        const modelName = modelConfig.model;

        // Check if this is an 'o' series model (uses only one temperature setting)
        const isOModel =
          modelName === "o1" || modelName === "o3" || modelName === "o3-mini";

        if (isOModel) {
          // For 'o' series models, use only runsLow value and always use low intensity
          for (let i = 0; i < runsLow; i++) {
            processingQueue.push({
              modelConfig,
              intensityLevel: "low", // Always use low for 'o' models
              temperature: getTemperatureFromIntensity("low"),
              runNumber: i + 1,
            });
          }
        } else {
          // Normal models - use all three intensity levels
          // Add low intensity runs to the queue
          for (let i = 0; i < runsLow; i++) {
            processingQueue.push({
              modelConfig,
              intensityLevel: "low",
              temperature: getTemperatureFromIntensity("low"),
              runNumber: i + 1,
            });
          }

          // Add medium intensity runs to the queue
          for (let i = 0; i < runsMedium; i++) {
            processingQueue.push({
              modelConfig,
              intensityLevel: "medium",
              temperature: getTemperatureFromIntensity("medium"),
              runNumber: i + 1,
            });
          }

          // Add high intensity runs to the queue
          for (let i = 0; i < runsHigh; i++) {
            processingQueue.push({
              modelConfig,
              intensityLevel: "high",
              temperature: getTemperatureFromIntensity("high"),
              runNumber: i + 1,
            });
          }
        }
      }

      // Calculate total runs
      setTotalRunCount(processingQueue.length);

      // Update progress with total runs count
      addProgressDetail(
        "generate",
        `Processing ${processingQueue.length} total runs across ${selectedModels.length} models`,
      );

      // Track all solutions from all runs
      const allRunSolutions: Solution[] = [];

      // Process each run in sequence
      let currentRunId = 1;

      // Create a more robust run tracking mechanism
      // Store processed runs at the component level to maintain across renders
      if (typeof window !== "undefined") {
        // Add type declaration for window property
        interface ExtendedWindow extends Window {
          __processedModelRuns?: Set<string>;
        }
        const extWindow = window as ExtendedWindow;

        if (!extWindow.__processedModelRuns) {
          extWindow.__processedModelRuns = new Set<string>();
        }
      }

      // Define custom window type
      interface CustomWindow extends Window {
        __processedModelRuns?: Set<string>;
      }

      // Local set for this execution context - create it if needed
      const processedRuns =
        typeof window !== "undefined"
          ? (window as CustomWindow).__processedModelRuns || new Set<string>()
          : new Set<string>();

      console.log("Processing queue length:", processingQueue.length);

      for (const run of processingQueue) {
        const { modelConfig, temperature, intensityLevel } = run;
        const modelName = modelConfig.model;

        // Update run status to active
        updateRunStatus(modelConfig.id, intensityLevel, "active");

        // Create a unique run signature to avoid duplicates - include the batch ID
        // Create a unique run signature to avoid duplicates - include the batch ID
        const runSignature = `${currentBatchId}_${modelName}_${temperature}_${currentRunId}`;

        // Skip if we've already processed this exact run
        if (processedRuns.has(runSignature)) {
          console.log(`Skipping duplicate run: ${runSignature}`);
          currentRunId++; // Still increment the runId
          continue;
        }

        // Mark this run as processed
        processedRuns.add(runSignature);

        console.log(
          `Processing run ${currentRunId} with model ${modelName} at temperature ${temperature} (${intensityLevel})`,
        );

        // Update progress
        addProgressDetail(
          "generate",
          `Starting run ${currentRunId}: ${modelName} at ${temperature} temperature (${intensityLevel} intensity)`,
        );

        // Create a tech stack string from the selected tech options for this run
        const techStackContext = selectedTechStack
          .map((tech) => {
            return `${tech.category} (${tech.name})`;
          })
          .join(", ");

        try {
          // Check if document already exists for this run before generating
          const { data: existingDoc } = await supabase
            .from("documents")
            .select("id, content, metadata")
            .eq("batch_id", currentBatchId)
            .eq("metadata->runId", currentRunId)
            .maybeSingle();

          let result;
          let runtime;
          const documentId = existingDoc?.id || null;

          // Only call the AI API if we don't have existing results
          if (!existingDoc) {
            // Generate a single, structured solution for this entire run
            const startTime = Date.now();

            addProgressDetail(
              "generate",
              `Generating content with ${modelName}...`,
            );

            // Use our new structured solution endpoint
            result = await generateText(
              query, // Use the main query instead of step-specific prompts
              modelName,
              temperature,
              techStackContext,
              currentRunId, // Pass the runId to the API
              // Pass enableReasoning flag for 'o' series models
              modelConfig.enableReasoning,
            );

            const endTime = Date.now();
            runtime = `${endTime - startTime}ms`;

            addProgressDetail(
              "generate",
              `Content generation for run ${currentRunId} completed in ${runtime}`,
            );

            // Check if we got a structured solution
            if (!result || !result.structuredSolution) {
              console.error(
                `No structured solution returned for run ${currentRunId}`,
              );
              addProgressDetail(
                "generate",
                `Error: No structured solution returned for run ${currentRunId}`,
              );

              // If result exists but just missing structuredSolution, check if we got a fallback error solution
              if (
                result &&
                (result.title === "API Error" ||
                  result.description?.includes("problem with the") ||
                  result.fullContent?.includes("error"))
              ) {
                console.log(
                  `Got fallback error solution for run ${currentRunId}, will use simplified fallback instead of skipping`,
                );
                addProgressDetail(
                  "generate",
                  `Using fallback solution for run ${currentRunId}`,
                );

                // Create a minimal structuredSolution to continue processing
                result.structuredSolution = {
                  steps: Array(5).fill({
                    title: "API Error",
                    description:
                      result.description ||
                      `There was a problem with the ${modelName} API. Please try again.`,
                    metrics: {
                      executionTime: "0ms",
                      complexity: "O(1)",
                      memoryUsage: "0MB",
                      lineCount: 0,
                      codeQuality: 5,
                    },
                    codeFiles: [],
                  }),
                  finalSolution: {
                    title: "Error Solution",
                    description: `Failed to get a response from the ${modelName} model. Please try again or select a different model.`,
                    metrics: {
                      executionTime: "0ms",
                      complexity: "O(1)",
                      memoryUsage: "0MB",
                      lineCount: 0,
                    },
                  },
                  rawContent:
                    result.fullContent ||
                    JSON.stringify({ error: "Unknown error" }),
                };
              } else {
                // Skip this run if we can't create a fallback
                continue;
              }
            }
          } else {
            // Use existing data from the database
            console.log(
              `Using existing data for run ${currentRunId} from document ID: ${documentId}`,
            );

            // Extract data from existing document
            const metadata = existingDoc.metadata as DocumentMetadata;
            runtime = metadata.runtime || "0ms";

            // Reconstruct the result object from stored data
            result = {
              structuredSolution: {
                steps: metadata.structuredSteps || [],
                finalSolution: metadata.structuredFinalSolution || {
                  title: "Retrieved Solution",
                  description: existingDoc.content.substring(0, 200) + "...",
                  metrics: {
                    executionTime: runtime,
                    complexity: "O(n)",
                    memoryUsage: "Variable",
                    lineCount: existingDoc.content.split("\n").length,
                  },
                },
                rawContent: existingDoc.content,
              },
              fullContent: existingDoc.content,
            };
          }

          // Create metadata for the entire run (if not already retrieved)
          let metadata: DocumentMetadata;
          let decisionType: "accepted" | "secondary" | "rejected" = "secondary"; // Default to secondary

          if (!existingDoc) {
            // Create new metadata and save to database
            addProgressDetail(
              "evaluate",
              `Evaluating content from run ${currentRunId} (${modelName})...`,
            );

            const evalResult = await evaluateResponse(
              result.fullContent,
              result.fullContent,
              modelName,
              temperature,
            );

            addProgressDetail(
              "evaluate",
              `Evaluation complete for run ${currentRunId}: ${evalResult.decision}`,
            );

            metadata = createDocumentMetadata(
              modelName,
              runtime,
              currentRunId,
              temperature,
              evalResult.scores,
              evalResult.decision,
            );

            // We no longer store the complete solution as a document
            // Instead, we'll store each step as a separate document below
            // Generate a batch ID that will be used for all steps
            if (!currentBatchId) {
              // Use setCurrentBatchId function instead of direct assignment
              const newBatchId = `batch_${Date.now()}`;
              setCurrentBatchId(newBatchId);
              addProgressDetail(
                "store",
                `Generated batch ID: ${newBatchId} for run ${currentRunId}`,
              );
              console.log(
                `Generated consistent batch ID: ${newBatchId} for all steps in the run`,
              );
            }

            // Map the evaluation decision to a solution type
            decisionType = mapDecisionToSolutionType(evalResult.decision);

            addProgressDetail(
              "store",
              `Preparing to store solutions from run ${currentRunId}`,
            );

            // We're no longer storing a single document but will store individual steps
            console.log(
              `Prepared metadata for run ${currentRunId} with batch ID: ${currentBatchId}`,
            );
          } else {
            // Use existing metadata from the document
            metadata = existingDoc.metadata as DocumentMetadata;

            // Map the evaluation decision to a solution type
            // Add a null/undefined check for metadata.decision
            if (metadata.decision) {
              decisionType = mapDecisionToSolutionType(metadata.decision);
            }

            console.log(
              `Using existing document for run ${currentRunId} with ID: ${documentId}`,
            );
            addProgressDetail(
              "store",
              `Using existing data from document ID: ${documentId}`,
            );

            // For existing documents, we need to verify if it's a single step document
            // Check if it has a stepNumber in its metadata, which indicates it's a step document
            if (metadata.stepNumber) {
              console.log(
                `Found existing document for step ${metadata.stepNumber}, preparing to process as individual step`,
              );
              addProgressDetail(
                "store",
                `Found existing step ${metadata.stepNumber} document, processing...`,
              );
            }
          }

          // Extract steps from the structured solution (with safety checks)
          const steps = result?.structuredSolution?.steps || [];
          const finalSolution = result?.structuredSolution?.finalSolution || {
            title: "Solution",
            description: "Generated solution",
            metrics: {
              executionTime: runtime || "0ms",
              complexity: "O(n)",
              memoryUsage: "Variable",
              lineCount: 0,
            },
          };

          addProgressDetail(
            "store",
            `Processing ${steps.length} steps from run ${currentRunId}`,
          );

          // Decision type is now handled earlier

          // If we found an existing document with a stepNumber, we'll handle it separately
          if (
            existingDoc &&
            (existingDoc.metadata as DocumentMetadata).stepNumber
          ) {
            // Get the existing document's metadata
            const existingMetadata = existingDoc.metadata as DocumentMetadata;
            const stepNumber = existingMetadata.stepNumber;

            // Skip the loop for steps and process just this document
            console.log(`Processing existing document for step ${stepNumber}`);

            // Create a step ID based on the step number
            const stepId = `step${stepNumber}`;

            // Make sure stepNumber is defined
            const validStepNumber = stepNumber || 1; // Default to 1 if undefined

            // Determine solution type based on the existing metadata
            let solutionType = existingMetadata.type as
              | "accepted"
              | "secondary"
              | "rejected";
            if (!solutionType) {
              // If no type is specified, determine based on the decision
              if (validStepNumber <= 2) {
                // First 2 steps: use the evaluation to determine if accepted
                solutionType =
                  decisionType === "accepted" ? "accepted" : "secondary";
              } else if (validStepNumber <= 4) {
                // Middle steps are always secondary
                solutionType = "secondary";
              } else {
                // Last step: use evaluation to determine if rejected
                solutionType =
                  decisionType === "rejected" ? "rejected" : "secondary";
              }
            }

            // Create a unique solution ID
            const uniqueSolutionId = `${stepId}-s${stepNumber}-run${currentRunId}`;

            // Create a solution object for this step
            const stepSolution: Solution = {
              id: uniqueSolutionId,
              title: existingMetadata.stepTitle || `Step ${stepNumber}`,
              description: existingDoc.content,
              model: existingMetadata.model,
              type: solutionType,
              runId: currentRunId,
              stepIndex: stepNumber,
              batchId: currentBatchId,
              metrics: {
                executionTime: existingMetadata.runtime || "0ms",
                complexity: existingMetadata.scores?.computeEfficiency
                  ? `Score: ${existingMetadata.scores.computeEfficiency}%`
                  : "O(n)",
                memoryUsage: existingMetadata.scores?.memoryUsage
                  ? `Score: ${existingMetadata.scores.memoryUsage}%`
                  : "Medium",
                lineCount: existingDoc.content.split("\n").length,
                codeQuality: existingMetadata.scores?.readability || 8,
              },
              frequency: {
                count: 1,
                models: [existingMetadata.model],
              },
              embeddings: {
                documentId: existingDoc.id,
                metadata: existingMetadata,
              },
            };

            // Add this solution to the collection
            allRunSolutions.push(stepSolution);

            // If this is the final step (step 6), also process it as the final solution
            if (stepNumber === 6) {
              // This is already the final solution, so add it directly
              const finalStepSolution: Solution = {
                ...stepSolution,
                id: `step5-s16-run${currentRunId}`,
                type: "accepted", // Final solution is always accepted
                stepIndex: 6,
              };

              // Add the final solution to the collection
              allRunSolutions.push(finalStepSolution);
            }

            // Mark this run as completed
            updateRunStatus(modelConfig.id, intensityLevel, "completed");
          }
          // If we don't have an existing document with a stepNumber, process normally
          else {
            // Process each step from the structured solution
            for (let i = 0; i < Math.min(steps.length, 5); i++) {
              const stepData = steps[i];
              const stepId = `step${i + 1}`;

              // Determine solution type based on index and evaluation
              // First 2 steps -> accepted if evaluation is good, else secondary
              // Next 2 steps -> secondary
              // Last step -> rejected if evaluation is bad, else secondary
              let solutionType: "accepted" | "secondary" | "rejected";

              // Determine solution type based on step index and evaluation
              if (i < 2) {
                // First 2 steps: use the evaluation to determine if accepted
                const decisionStr = String(decisionType);
                solutionType =
                  decisionStr === "RECOMMENDED" || decisionStr === "VIABLE"
                    ? "accepted"
                    : "secondary";
              } else if (i < 4) {
                // Middle steps are always secondary
                solutionType = "secondary";
              } else {
                // Last step: use evaluation to determine if rejected
                const decisionStr = String(decisionType);
                solutionType =
                  decisionStr === "PROBLEMATIC" ? "rejected" : "secondary";
              }

              // Create a unique solution ID
              const uniqueSolutionId = `${stepId}-s${i + 1}-run${currentRunId}`;

              // Create a solution object for this step
              const stepSolution: Solution = {
                id: uniqueSolutionId,
                title: stepData.title,
                description: stepData.description,
                model: modelName,
                type: solutionType,
                runId: currentRunId,
                stepIndex: i + 1, // Step index (1-6)
                batchId: currentBatchId, // Add the batch ID for grouping
                metrics: {
                  executionTime: stepData.metrics.executionTime,
                  complexity: stepData.metrics.complexity,
                  memoryUsage: stepData.metrics.memoryUsage,
                  lineCount: stepData.metrics.lineCount,
                  codeQuality: stepData.metrics.codeQuality,
                },
                frequency: {
                  count: 1,
                  models: [modelName],
                },
                embeddings: {
                  documentId: null, // Each step will get its own document ID (updated after storing)
                  metadata,
                },
              };

              // Add frequency data based on solution type
              if (stepSolution.type === "accepted") {
                // Add up to 2 more models for accepted solutions
                const additionalModels = selectedModels
                  .filter((m) => m.model !== modelName)
                  .slice(0, 2)
                  .map((m) => m.model);

                stepSolution.frequency!.models = [
                  ...stepSolution.frequency!.models,
                  ...additionalModels,
                ];
                stepSolution.frequency!.count =
                  stepSolution.frequency!.models.length;
              } else if (stepSolution.type === "secondary" && i % 2 === 0) {
                // Add one more model for some secondary solutions
                const additionalModel = selectedModels
                  .filter((m) => m.model !== modelName)
                  .slice(0, 1)
                  .map((m) => m.model);

                stepSolution.frequency!.models = [
                  ...stepSolution.frequency!.models,
                  ...additionalModel,
                ];
                stepSolution.frequency!.count =
                  stepSolution.frequency!.models.length;
              }

              // Store each step as a separate document with proper metadata
              // This is crucial - each step must be stored as its own document row
              const stepMetadata: DocumentMetadata = {
                ...metadata,
                stepNumber: i + 1, // Important: Set the step number in metadata
                stepTitle: stepData.title,
                content: stepData.description, // Using content property instead of stepDescription
                level: i,
                // Preserve the overall run's decision, but we'll also evaluate each step separately
                type: solutionType,
                // Include full metrics for proper card display
                metrics: {
                  executionTime: stepData.metrics.executionTime,
                  complexity: stepData.metrics.complexity,
                  memoryUsage: stepData.metrics.memoryUsage,
                  lineCount: stepData.metrics.lineCount,
                  codeQuality: stepData.metrics.codeQuality || 8,
                },
              };

              // Store this step as its own document
              const stepDocumentId = await storeDocumentWithEmbedding(
                stepData.description, // Content is just this step's description
                stepMetadata,
                currentBatchId,
                stepSolution, // Pass the solution to enable step-specific evaluation
              );

              if (stepDocumentId) {
                console.log(
                  `Stored step ${i + 1} for run ${currentRunId} with document ID: ${stepDocumentId}`,
                );
                // Update the solution with the correct document ID
                stepSolution.embeddings = {
                  documentId: stepDocumentId,
                  metadata: stepSolution.embeddings?.metadata || metadata,
                };
              }

              // Add this solution to the collection
              allRunSolutions.push(stepSolution);
            }

            // Now handle the final solution
            const finalSolutionId = `step5-s16-run${currentRunId}`;

            // Create a solution object for the final solution
            const finalStepSolution: Solution = {
              id: finalSolutionId,
              title: finalSolution.title || "Final Implementation",
              description: finalSolution.description,
              model: modelName,
              type: "accepted", // The final solution is always accepted
              runId: currentRunId,
              stepIndex: 6, // Final solution is always step 6
              batchId: currentBatchId, // Add the batch ID for grouping
              metrics: {
                executionTime: finalSolution.metrics?.executionTime || "N/A",
                complexity: finalSolution.metrics?.complexity || "O(n)",
                memoryUsage: finalSolution.metrics?.memoryUsage || "N/A",
                lineCount: finalSolution.metrics?.lineCount || 0,
              },
              embeddings: {
                documentId: null, // Will be updated after storing the document
                metadata,
              },
            };

            // Store the final solution as its own document
            const finalStepMetadata: DocumentMetadata = {
              ...metadata,
              stepNumber: 6, // Important: Final step is always step 6
              stepTitle: finalSolution.title,
              content: finalSolution.description, // Using content property instead of stepDescription
              level: 5, // Level 5 for final step
              type: "accepted", // Final solution is always accepted
              // Include full metrics for proper card display
              metrics: {
                executionTime: finalSolution.metrics?.executionTime || "N/A",
                complexity: finalSolution.metrics?.complexity || "O(n)",
                memoryUsage: finalSolution.metrics?.memoryUsage || "N/A",
                lineCount: finalSolution.metrics?.lineCount || 0,
                codeQuality: 9, // High quality for final solution
              },
            };

            // Store the final step as its own document
            const finalStepDocumentId = await storeDocumentWithEmbedding(
              finalSolution.description, // Content is just the final solution description
              finalStepMetadata,
              currentBatchId,
              finalStepSolution, // Pass the solution to enable step-specific evaluation
            );

            if (finalStepDocumentId) {
              console.log(
                `Stored final step for run ${currentRunId} with document ID: ${finalStepDocumentId}`,
              );
              // Update the solution with the correct document ID
              finalStepSolution.embeddings = {
                documentId: finalStepDocumentId,
                metadata:
                  finalStepSolution.embeddings?.metadata || finalStepMetadata,
              };
            }

            // Add the final solution to the collection
            allRunSolutions.push(finalStepSolution);

            // Mark this run as completed
            updateRunStatus(modelConfig.id, intensityLevel, "completed");
          } // Close the else block for normal processing
        } catch (error) {
          console.error(
            `Failed to generate content for run ${currentRunId}:`,
            error,
          );

          // Update run status to show error
          updateRunStatus(modelConfig.id, intensityLevel, "error");

          // Add detailed error message to progress
          addProgressDetail(
            "generate",
            `Error in run ${currentRunId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );

          try {
            // Even on error, create a fallback solution so the UI has something to display
            const errorSolution: Solution = {
              id: `error-${currentRunId}-${Date.now()}`,
              title: "Error Generating Solution",
              description: `An error occurred while generating content with ${modelName}: ${error instanceof Error ? error.message : "Unknown error"}`,
              type: "rejected", // Mark as rejected so it's visually distinct
              model: modelName,
              runId: currentRunId,
              stepIndex: 1, // Put in first step by default
              batchId: currentBatchId,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 1, // Low quality score for error
              },
            };

            // Add this error solution to collection
            allRunSolutions.push(errorSolution);

            console.log(
              `Added fallback error solution for run ${currentRunId}`,
            );
          } catch (fallbackError) {
            // If even creating the fallback fails, just log and continue
            console.error("Failed to create fallback solution:", fallbackError);
          }

          // Continue to the next run if this one fails
        }

        // Increment the run ID for the next run
        currentRunId++;
      }

      // Group all solutions by step ID
      const solutionsByStepId: { [stepId: string]: Solution[] } = {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
      };

      // Organize all solutions by step ID
      for (const solution of allRunSolutions) {
        // Extract the step ID from the solution ID (format: step1-s1-run1)
        const stepId = solution.id.split("-")[0];

        if (stepId && solutionsByStepId[stepId]) {
          solutionsByStepId[stepId].push(solution);
        }
      }

      // Process all real solutions for each step
      for (let stepIndex = 0; stepIndex < updatedSteps.length; stepIndex++) {
        const step = updatedSteps[stepIndex];

        // Get all solutions for this step from all runs
        const stepSolutions = solutionsByStepId[step.id] || [];

        if (stepSolutions.length === 0) continue;

        addProgressDetail(
          "process",
          `Processing ${stepSolutions.length} solutions for step ${stepIndex + 1}`,
        );

        // Parse content for each solution to ensure it's fully processed
        const parsedSolutions = stepSolutions.map((solution) => {
          // Make sure we have structured content if available
          if (solution.embeddings?.metadata) {
            const metadata = solution.embeddings.metadata as DocumentMetadata;

            // If we have structured steps, use that data
            if (metadata.structuredSteps && metadata.stepNumber) {
              const stepData =
                metadata.structuredSteps[metadata.stepNumber - 1];
              if (stepData) {
                return {
                  ...solution,
                  title: stepData.title || solution.title,
                  description: stepData.description || solution.description,
                  metrics: {
                    ...solution.metrics,
                    executionTime:
                      stepData.metrics?.executionTime ||
                      solution.metrics?.executionTime ||
                      "0ms",
                    complexity:
                      stepData.metrics?.complexity ||
                      solution.metrics?.complexity ||
                      "O(n)",
                    memoryUsage:
                      stepData.metrics?.memoryUsage ||
                      solution.metrics?.memoryUsage ||
                      "0MB",
                    lineCount:
                      stepData.metrics?.lineCount ||
                      solution.metrics?.lineCount ||
                      0,
                    codeQuality:
                      stepData.metrics?.codeQuality ||
                      solution.metrics?.codeQuality ||
                      0,
                  },
                };
              }
            }
          }
          return solution;
        });

        // Group solutions by type (accepted, secondary, rejected)
        const solutionsByType: { [type: string]: Solution[] } = {
          accepted: parsedSolutions.filter((s) => s.type === "accepted"),
          secondary: parsedSolutions.filter((s) => s.type === "secondary"),
          rejected: parsedSolutions.filter((s) => s.type === "rejected"),
        };

        // Add solutions directly to the step - not using template placeholders
        const allTypeSolutions: Solution[] = [];

        // Add a few solutions of each type to ensure representation
        ["accepted", "secondary", "rejected"].forEach((type) => {
          // Get solutions of this type
          const typeSolutions = solutionsByType[type] || [];

          if (typeSolutions.length > 0) {
            // Sort solutions by runId and score
            const sortedSolutions = typeSolutions.sort((a, b) => {
              // If embeddings are available, use their scores as a secondary sort
              const scoreA = a.embeddings?.metadata.scores?.accuracy || 0;
              const scoreB = b.embeddings?.metadata.scores?.accuracy || 0;

              // First sort by run ID (higher/newer is better)
              const runDiff = (b.runId || 0) - (a.runId || 0);
              return runDiff !== 0 ? runDiff : scoreB - scoreA;
            });

            // Add up to 3 solutions of each type (real data only)
            allTypeSolutions.push(...sortedSolutions.slice(0, 3));
          }
        });

        // Replace the step's solutions with real solutions only
        step.solutions = allTypeSolutions;

        addProgressDetail(
          "process",
          `Added ${allTypeSolutions.length} solutions to step ${stepIndex + 1}`,
        );
      }

      // Process the final solution (step 6) with real data only
      try {
        // Handle the final outcome step
        addProgressDetail("process", `Processing final solutions...`);

        const finalStep = updatedSteps.find((step) => step.id === "step5");

        // Get all final solutions from our collection
        const finalSolutions = solutionsByStepId["step5"] || [];

        if (finalSolutions.length > 0) {
          // Sort by run ID (higher is more recent) and accuracy if available
          const sortedFinalSolutions = finalSolutions.sort((a, b) => {
            const scoreA = a.embeddings?.metadata.scores?.accuracy || 0;
            const scoreB = b.embeddings?.metadata.scores?.accuracy || 0;

            // First sort by run ID (higher/newer is better)
            const runDiff = (b.runId || 0) - (a.runId || 0);
            return runDiff !== 0 ? runDiff : scoreB - scoreA;
          });

          // Select the best final solution (most recent with highest score)
          const bestFinalSolution = sortedFinalSolutions[0];

          // Parse final solution content if structured data is available
          let enhancedFinalSolution = bestFinalSolution;
          if (bestFinalSolution.embeddings?.metadata) {
            const metadata = bestFinalSolution.embeddings
              .metadata as DocumentMetadata;
            if (metadata.structuredFinalSolution) {
              // Use structured final solution data if available
              enhancedFinalSolution = {
                ...bestFinalSolution,
                title:
                  metadata.structuredFinalSolution.title ||
                  bestFinalSolution.title,
                description:
                  metadata.structuredFinalSolution.description ||
                  bestFinalSolution.description,
                metrics: {
                  executionTime:
                    metadata.structuredFinalSolution.metrics?.executionTime ||
                    "Combined",
                  complexity:
                    metadata.structuredFinalSolution.metrics?.complexity ||
                    "Varies",
                  memoryUsage:
                    metadata.structuredFinalSolution.metrics?.memoryUsage ||
                    "Combined",
                  lineCount:
                    metadata.structuredFinalSolution.metrics?.lineCount || 0,
                },
              };
            }
          }

          // Add the best final solution to the step
          if (finalStep && enhancedFinalSolution) {
            finalStep.solutions = [enhancedFinalSolution];
            addProgressDetail(
              "process",
              `Added final solution from run ${enhancedFinalSolution.runId}`,
            );
          }
        } else if (finalStep) {
          // If no real data is available, create a minimal combined solution
          // This should rarely happen if everything is working correctly
          const combinedSolution: Solution = {
            id: `final-combined-solution-${Date.now()}`,
            title: "Combined Final Solution",
            description: "This is a combined solution based on all model runs.",
            model: "Combined Models",
            runId: 999999, // Special run ID for the combined solution
            type: "accepted",
            stepIndex: 6,
            batchId: currentBatchId,
            metrics: {
              executionTime: "Combined",
              complexity: "Varies",
              memoryUsage: "Combined",
              lineCount: 0,
            },
          };

          // Set this as the only solution for the final step
          finalStep.solutions = [combinedSolution];
          addProgressDetail("process", `Added fallback combined solution`);
        }
      } catch (error) {
        console.error("Error handling final solution:", error);
        addProgressDetail(
          "process",
          `Error processing final solution: ${(error as Error).message}`,
        );
      }

      // Final processing steps
      addProgressDetail("process", `Finalizing solution pathway...`);

      // Set loading to false and return the steps
      setIsLoading(false);
      addProgressDetail("process", `Process complete - displaying results`);

      return updatedSteps;
    } catch (error) {
      console.error("Error in model processing:", error);
      setGenerationError(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
      setIsLoading(false);
      throw error;
    } finally {
      // Set loading to false in finally block
      setIsLoading(false);
    }
  }, [
    query,
    selectedModels,
    selectedIntensity,
    selectedTechStack,
    initialBatchId,
    mapDecisionToSolutionType,
  ]);

  // Function to group solutions by step index with additional validation
  const groupSolutionsByStepIndex = useCallback((solutions: Solution[]) => {
    const groupedByStep: { [stepIndex: number]: Solution[] } = {};

    // Group valid solutions by their step index
    solutions.forEach((solution) => {
      // Ensure we have a valid step index
      if (solution.stepIndex && solution.stepIndex > 0) {
        // Create array for this step index if it doesn't exist
        if (!groupedByStep[solution.stepIndex]) {
          groupedByStep[solution.stepIndex] = [];
        }

        // Add solution to the appropriate step group
        // Make a clean copy with a guaranteed unique ID
        const solutionCopy = {
          ...solution,
          // Use deterministic ID based on existing fields, no random values
          id:
            solution.id ||
            `generated-${solution.stepIndex}-${solution.batchId || ""}-${solution.title.replace(/\s+/g, "-")}`,
        };

        groupedByStep[solution.stepIndex].push(solutionCopy);
      }
    });

    // Sort solutions within each step - but not by runId
    Object.keys(groupedByStep).forEach((stepKey) => {
      const stepIndex = parseInt(stepKey);

      // Deduplicate solutions by ID - in case we have duplicates
      const uniqueSolutions = groupedByStep[stepIndex].reduce(
        (unique: Solution[], item: Solution) => {
          // Check if we already have this item by ID
          const exists = unique.some((u) => u.id === item.id);
          if (!exists) {
            unique.push(item);
          }
          return unique;
        },
        [],
      );

      // Sort solutions ONLY by decision type for display grouping
      // DO NOT sort by runId as requested
      groupedByStep[stepIndex] = uniqueSolutions.sort((a, b) => {
        // Sort by type (accepted, secondary, rejected) to group them visually
        const typeOrder = { accepted: 0, secondary: 1, rejected: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      });
    });

    return groupedByStep;
  }, []);

  // Function to load document data from database by batch ID
  const loadDocumentsByBatchId = useCallback(
    async (batchId: string) => {
      setLoadingSteps(true);

      try {
        console.log(`Starting to load documents for batch ID: ${batchId}`);

        // First, try to load steps from the steps table
        const steps = await getStepsByBatchId(batchId);

        // Initialize empty steps array to ensure we have a structure to show
        const emptySteps: Step[] = [
          { id: "step1", title: "Initial Solutions", solutions: [] },
          { id: "step2", title: "Refined Solutions", solutions: [] },
          { id: "step3", title: "Implementation Details", solutions: [] },
          { id: "step4", title: "Final Solutions", solutions: [] },
          { id: "step5", title: "Final Outcome", solutions: [] },
        ];

        // Set the empty steps structure
        setAllSteps(emptySteps);
        setSteps(emptySteps);

        if (steps.length > 0) {
          console.log(
            `Found ${steps.length} steps for batch ID: ${batchId} in steps table`,
          );

          // Group steps by step index
          const grouped = groupStepsByStepIndex(steps);

          // Update the connections based on level information from steps
          const stepsWithLevels = steps.map((step) => ({
            id: step.id,
            level: step.level,
            stepIndex: step.step_number, // Changed from step_index to step_number
            runId: step.run_id,
            type: step.step_data.type as "accepted" | "secondary" | "rejected",
            decision: step.decision_value,
          }));

          // Generate connections based on level and run_id for continuity
          const newConnections: {
            from: string;
            to: string;
            type: "accepted" | "secondary" | "rejected";
            color: string;
          }[] = [];

          // Process steps by level
          const stepsByLevel: Record<number, typeof stepsWithLevels> = {};
          stepsWithLevels.forEach((step) => {
            if (!stepsByLevel[step.level]) {
              stepsByLevel[step.level] = [];
            }
            stepsByLevel[step.level].push(step);
          });

          // Build connections between steps across consecutive levels
          Object.keys(stepsByLevel).forEach((levelStr) => {
            const level = parseInt(levelStr);
            const nextLevel = level + 1;

            if (!stepsByLevel[nextLevel]) return;

            // For each step in current level
            stepsByLevel[level].forEach((currentStep) => {
              // First try to find steps in next level with same runId
              let nextLevelSteps = stepsByLevel[nextLevel].filter(
                (s) => s.runId === currentStep.runId,
              );

              // If none found, connect to steps of same type
              if (nextLevelSteps.length === 0) {
                nextLevelSteps = stepsByLevel[nextLevel].filter(
                  (s) => s.type === currentStep.type,
                );
              }

              // If still none, connect to first step in next level
              if (
                nextLevelSteps.length === 0 &&
                stepsByLevel[nextLevel].length > 0
              ) {
                nextLevelSteps = [stepsByLevel[nextLevel][0]];
              }

              // Connect current step to matching next level steps
              nextLevelSteps.forEach((nextStep) => {
                let color = "#3B82F6"; // Default blue for secondary/viable
                let connectionType: "accepted" | "secondary" | "rejected" =
                  "secondary";

                if (currentStep.type === "accepted") {
                  color = "#22C55E"; // Green for recommended
                  connectionType = "accepted";
                } else if (currentStep.type === "rejected") {
                  color = "#F97316"; // Orange for problematic
                  connectionType = "rejected";
                }

                // Add the connection
                newConnections.push({
                  from: currentStep.id,
                  to: nextStep.id,
                  type: connectionType,
                  color,
                });
              });
            });
          });

          // Set the similarity connections for visualization
          setSimilarityConnections(newConnections);

          console.log(
            "Setting grouped steps from steps table:",
            Object.keys(grouped).length,
          );
          setGroupedSteps(grouped as { [stepIndex: number]: Solution[] });

          // Initialize visibleSolutionsByStep with first page of solutions
          const initialVisibleSolutions: Record<number, Solution[]> = {};

          Object.keys(grouped).forEach((stepIndexStr) => {
            const stepIndex = Number(stepIndexStr);
            const stepSolutions = grouped[stepIndex] as Solution[];

            if (stepSolutions && stepSolutions.length > 0) {
              // Take a balance of each type for the first page (up to 5 of each type)
              const recommendedSolutions = stepSolutions
                .filter((s) => s.type === "accepted")
                .slice(0, 5);
              const viableSolutions = stepSolutions
                .filter((s) => s.type === "secondary")
                .slice(0, 5);
              const problematicSolutions = stepSolutions
                .filter((s) => s.type === "rejected")
                .slice(0, 5);

              // Combine all types
              const firstPageSolutions = [
                ...recommendedSolutions,
                ...viableSolutions,
                ...problematicSolutions,
              ].slice(0, 15); // Limit to 15 solutions total

              if (firstPageSolutions.length > 0) {
                initialVisibleSolutions[stepIndex] = firstPageSolutions;
                console.log(
                  `Step ${stepIndex} initialized with ${firstPageSolutions.length} visible solutions`,
                );
              }
            }
          });

          // Set initial visible solutions
          if (Object.keys(initialVisibleSolutions).length > 0) {
            setVisibleSolutionsByStep(initialVisibleSolutions);
          }

          // Force redraw of the connections
          setLineKey((prevKey) => prevKey + 1);

          setLoadingSteps(false);
          return;
        }

        // If no steps found, fall back to loading from documents table and processing them
        console.log(
          "No steps found in steps table, falling back to documents table",
        );
        const documents = await getDocumentsByBatchId(batchId);

        if (documents.length === 0) {
          console.log("No documents found for batch ID:", batchId);
          setLoadingSteps(false);
          return;
        }

        console.log(
          `Found ${documents.length} documents for batch ID: ${batchId}`,
        );

        // Convert documents to solutions
        const solutions: Solution[] = documents.map((doc) => {
          const metadata = doc.metadata as DocumentMetadata;
          const decision = metadata.decision || "VIABLE";
          const solutionType = mapDecisionToSolutionType(decision);

          // Extract structured steps from metadata if available
          const structuredSteps = metadata.structuredSteps || [];
          const stepIndex = metadata.stepNumber || 1; // Default to step 1 if not specified

          // Get the title from structured steps if available, otherwise generate one
          let title = "Solution Step";
          if (
            structuredSteps.length > 0 &&
            stepIndex <= structuredSteps.length
          ) {
            title =
              structuredSteps[stepIndex - 1]?.title ||
              `${solutionType.toUpperCase()} Solution`;
          } else if (metadata.stepTitle) {
            title = metadata.stepTitle;
          } else {
            // Generate a title based on solution type and model
            title = `${solutionType.charAt(0).toUpperCase() + solutionType.slice(1)} from ${metadata.model}`;
          }

          const solution = {
            id: doc.id,
            title: title,
            description: doc.content.substring(0, 500),
            type: solutionType,
            model: metadata.model,
            runId: metadata.runId,
            stepIndex: stepIndex,
            batchId: batchId,
            metrics: {
              executionTime: metadata.runtime || "0ms",
              complexity: metadata.scores?.computeEfficiency
                ? `Score: ${metadata.scores.computeEfficiency}%`
                : "O(n)",
              memoryUsage: metadata.scores?.memoryUsage
                ? `Score: ${metadata.scores.memoryUsage}%`
                : "Medium",
              lineCount: doc.content.split("\n").length,
              codeQuality: metadata.scores?.readability || 8,
            },
            embeddings: {
              documentId: doc.id,
              metadata: metadata,
            },
          };

          // Process and store the solution as a step for future use
          // Note: processAndStoreSteps has been replaced with processAndStoreStepAsDocument
          // which is called from storeDocumentWithEmbedding in the embedding-service
          console.log(`Using document ${doc.id} as step directly`);

          return solution;
        });

        // Group solutions by step index
        const grouped = groupSolutionsByStepIndex(solutions);

        // Ensure each step has at least one of each solution type (if available in the dataset)
        // Only include all decision types if the flag is set
        const enhancedGrouped = ensureAllSolutionTypesInSteps(
          grouped,
          solutions,
        );

        console.log(
          "Setting grouped steps with all solution types:",
          Object.keys(enhancedGrouped).length,
        );
        setGroupedSteps(enhancedGrouped);

        // Initialize visibleSolutionsByStep with first page of solutions
        const initialVisibleSolutions: Record<number, Solution[]> = {};

        Object.keys(enhancedGrouped).forEach((stepIndexStr) => {
          const stepIndex = Number(stepIndexStr);
          const stepSolutions = enhancedGrouped[stepIndex];

          if (stepSolutions && stepSolutions.length > 0) {
            // Take a balance of each type for the first page (up to 5 of each type)
            const recommendedSolutions = stepSolutions
              .filter((s) => s.type === "accepted")
              .slice(0, 5);
            const viableSolutions = stepSolutions
              .filter((s) => s.type === "secondary")
              .slice(0, 5);
            const problematicSolutions = stepSolutions
              .filter((s) => s.type === "rejected")
              .slice(0, 5);

            // Combine all types
            const firstPageSolutions = [
              ...recommendedSolutions,
              ...viableSolutions,
              ...problematicSolutions,
            ].slice(0, 15); // Limit to 15 solutions total

            if (firstPageSolutions.length > 0) {
              initialVisibleSolutions[stepIndex] = firstPageSolutions;
              console.log(
                `Step ${stepIndex} initialized with ${firstPageSolutions.length} visible solutions`,
              );
            }
          }
        });

        // Set initial visible solutions
        if (Object.keys(initialVisibleSolutions).length > 0) {
          setVisibleSolutionsByStep(initialVisibleSolutions);
        }

        // Force redraw of the connections
        setLineKey((prevKey) => prevKey + 1);

        setLoadingSteps(false);
      } catch (error) {
        console.error("Error loading documents by batch ID:", error);
        setLoadingSteps(false);
      }
    },
    [
      groupSolutionsByStepIndex,
      mapDecisionToSolutionType,
      setSimilarityConnections,
    ],
  );

  // Add effect to handle initialBatchId changes
  useEffect(() => {
    if (initialBatchId) {
      console.log(`Loading data for initial batch ID: ${initialBatchId}`);
      setCurrentBatchId(initialBatchId);

      // Set loading state to true while loading batch data
      setIsLoading(true);

      // Clear any existing visible solutions first to ensure a clean slate
      setVisibleSolutionsByStep({});

      // Reset carousel page
      setCarouselPage(0);

      // Load the documents (which will then update visible solutions)
      loadDocumentsByBatchId(initialBatchId)
        .then(() => {
          // After loading is complete, set loading to false
          setIsLoading(false);
          console.log("Finished loading batch data");
        })
        .catch((error) => {
          console.error("Error loading batch data:", error);
          setIsLoading(false);
        });
    }
  }, [initialBatchId]); // Only run when initialBatchId changes

  // Add debugging effect to log solution structures
  useEffect(() => {
    if (Object.keys(groupedSteps).length > 0) {
      // Log first solution from first step to see its structure
      const firstStepIndex = Object.keys(groupedSteps).sort()[0];
      const firstSolution = groupedSteps[Number(firstStepIndex)]?.[0];
      if (firstSolution) {
        console.log("Sample solution structure:", firstSolution);
        console.log("Solution has model:", firstSolution.model);
        console.log("Solution has metrics:", firstSolution.metrics);
        console.log(
          "Solution has description:",
          firstSolution.description?.substring(0, 50) + "...",
        );
      }
    }
  }, [groupedSteps]);

  // Helper function to ensure each step has all solution types if available
  const ensureAllSolutionTypesInSteps = useCallback(
    (
      groupedByStep: Record<number, Solution[]>,
      allSolutions: Solution[],
    ): Record<number, Solution[]> => {
      const result = { ...groupedByStep };

      // If includeAllDecisionTypes is false, just return the original grouping
      if (!includeAllDecisionTypes) {
        return result;
      }

      // Get all unique step indices
      const stepIndices = Object.keys(groupedByStep).map(Number);

      // For each step
      stepIndices.forEach((stepIndex) => {
        const stepSolutions = groupedByStep[stepIndex] || [];

        // Find all solutions of each type for this step index
        const stepIndexSolutions = allSolutions.filter(
          (s) => s.stepIndex === stepIndex,
        );
        const recommendedSolutions = stepIndexSolutions.filter(
          (s) => s.type === "accepted",
        );
        const viableSolutions = stepIndexSolutions.filter(
          (s) => s.type === "secondary",
        );
        const problematicSolutions = stepIndexSolutions.filter(
          (s) => s.type === "rejected",
        );

        console.log(`Step ${stepIndex} available solutions from database:`, {
          recommended: recommendedSolutions.length,
          viable: viableSolutions.length,
          problematic: problematicSolutions.length,
          total: stepIndexSolutions.length,
        });

        // Start with existing solutions
        const newSolutions: Solution[] = [...stepSolutions];

        // Keep track of solutions we're already using by ID
        const existingIds = new Set(stepSolutions.map((s) => s.id));

        // Add more RECOMMENDED solutions with higher priority (up to 10 or whatever is available)
        const additionalRecommended = recommendedSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalRecommended.length > 0) {
          console.log(
            `Adding ${additionalRecommended.length} more RECOMMENDED solutions to step ${stepIndex}`,
          );
          additionalRecommended.forEach((s) => existingIds.add(s.id));
          newSolutions.push(...additionalRecommended);
        }

        // Add more PROBLEMATIC solutions with next priority (up to 10 or whatever is available)
        const additionalProblematic = problematicSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalProblematic.length > 0) {
          console.log(
            `Adding ${additionalProblematic.length} more PROBLEMATIC solutions to step ${stepIndex}`,
          );
          additionalProblematic.forEach((s) => existingIds.add(s.id));
          newSolutions.push(...additionalProblematic);
        }

        // Add more VIABLE solutions (up to 10 or whatever is available)
        const additionalViable = viableSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalViable.length > 0) {
          console.log(
            `Adding ${additionalViable.length} more VIABLE solutions to step ${stepIndex}`,
          );
          additionalViable.forEach((s) => existingIds.add(s.id));
          newSolutions.push(...additionalViable);
        }

        // Ensure we don't have duplicates by using a Set for IDs
        const uniqueIds = new Set<string>();
        result[stepIndex] = newSolutions.filter((solution) => {
          if (uniqueIds.has(solution.id)) return false;
          uniqueIds.add(solution.id);
          return true;
        });

        // Log what we've added
        console.log(`Step ${stepIndex} final solution distribution:`, {
          recommended: result[stepIndex].filter((s) => s.type === "accepted")
            .length,
          viable: result[stepIndex].filter((s) => s.type === "secondary")
            .length,
          problematic: result[stepIndex].filter((s) => s.type === "rejected")
            .length,
          total: result[stepIndex].length,
        });
      });

      return result;
    },
    [includeAllDecisionTypes],
  );

  // Create a stable ref to track what we've already processed to prevent duplicate calls
  const processedConfigRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Skip if no query or models
    if (!query || !selectedModels || selectedModels.length === 0) return;

    // Create a stable configuration signature
    const modelStr = selectedModels
      .map((m) => `${m.model}-${m.runsLow}-${m.runsMedium}-${m.runsHigh}`)
      .join("_");
    const techStackStr = selectedTechStack
      .map((t) => `${t.category}-${t.name}`)
      .join("_");
    const configSignature = `${query}_${modelStr}_${selectedIntensity}_${techStackStr}`;

    // Skip if we've already processed this exact configuration
    if (processedConfigRef.current[configSignature]) {
      console.log("Skipping duplicate render of the same configuration");
      return;
    }

    // Mark this configuration as processed
    processedConfigRef.current[configSignature] = true;

    // Cleanup function for timers
    const timers: number[] = [];

    // Generate a stable, deterministic batch ID for this query
    // Using the current timestamp in seconds to ensure consistent batch IDs
    const timestamp = Math.floor(Date.now() / 1000);
    // Create a consistent hash from the query
    const queryHash = query
      .split("")
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(36)
      .replace("-", "");
    // Combine timestamp and query hash for uniqueness but consistency
    const newBatchId = `batch_${timestamp}_${queryHash}`;
    console.log(
      `Created consistent batch ID: ${newBatchId} for query: ${query.substring(0, 30)}...`,
    );

    // Generate steps based on query and models - wrapped in an async IIFE
    (async () => {
      // Set loading state
      setShowContinueButton(false);
      setIsLoading(true);
      setCurrentBatchId(newBatchId);

      try {
        // Generate and assign AI content to steps
        const stepsWithAIContent = await assignModelsToSolutions();

        // Set the full set of steps
        setAllSteps(stepsWithAIContent);

        // Extract all solutions from the steps with clean IDs
        const allSolutions: Solution[] = stepsWithAIContent.flatMap((step) =>
          step.solutions.map((solution) => {
            // Ensure solution has a deterministic ID
            const cleanId =
              solution.id ||
              `${step.id}-${solution.title.replace(/\W+/g, "-")}`;

            return {
              ...solution,
              id: cleanId,
              batchId: newBatchId, // Ensure batchId is set
            };
          }),
        );

        // Group solutions by step index
        const grouped = groupSolutionsByStepIndex(allSolutions);

        // Ensure we have a final solution card (stepIndex 6) for connections to work
        // If not already present, add the final solution from step 5 to step 6
        if (!grouped[6] && grouped[5] && grouped[5].length > 0) {
          // Only consider accepted or viable solutions from step 5, NEVER problematic
          const qualityFinalSolutions = grouped[5].filter(
            (s) => s.type === "accepted" || s.type === "secondary",
          );
          if (qualityFinalSolutions.length > 0) {
            // Take the first accepted solution if available, otherwise take a secondary/viable one
            const recommendedSolutions = qualityFinalSolutions.filter(
              (s) => s.type === "accepted",
            );
            const bestSolution =
              recommendedSolutions.length > 0
                ? recommendedSolutions[0]
                : qualityFinalSolutions[0];

            // Create a final solution based on it
            const finalSolution: Solution = {
              ...bestSolution,
              id: `final-${bestSolution.id}`,
              title: "Final Implementation",
              description: bestSolution.description,
              stepIndex: 6, // Ensure it's in step 6
              type: "accepted", // Final solutions are always marked as accepted
            };

            // Add to the grouped solutions
            grouped[6] = [finalSolution];
          }
        } else if (grouped[6]) {
          // If we already have final solutions, ensure none are problematic
          grouped[6] = grouped[6].filter((s) => s.type !== "rejected");

          // If we filtered out everything, try to use an accepted solution from step 5
          if (grouped[6].length === 0 && grouped[5] && grouped[5].length > 0) {
            const qualityFinalSolutions = grouped[5].filter(
              (s) => s.type === "accepted" || s.type === "secondary",
            );
            if (qualityFinalSolutions.length > 0) {
              const recommendedSolutions = qualityFinalSolutions.filter(
                (s) => s.type === "accepted",
              );
              const bestSolution =
                recommendedSolutions.length > 0
                  ? recommendedSolutions[0]
                  : qualityFinalSolutions[0];

              const finalSolution: Solution = {
                ...bestSolution,
                id: `final-${bestSolution.id}`,
                title: "Final Implementation",
                description: bestSolution.description,
                stepIndex: 6,
                type: "accepted",
              };

              grouped[6] = [finalSolution];
            }
          }
        }

        // Initially set steps from the AI model processing
        setGroupedSteps(grouped);

        // Auto-display all steps
        setSteps(stepsWithAIContent);
        setCurrentLevel(stepsWithAIContent.length - 1);
        setCurrentStepIndex(stepsWithAIContent.length - 1);

        // Show all connections after a delay - use clean reference to avoid state update after unmount
        const timer1 = window.setTimeout(() => {
          // Show all connections
          setVisibleConnections(allConnections);

          // Show the optimized path after a short delay
          const timer2 = window.setTimeout(() => {
            setShowOptimizedPath(true);
          }, 1000);

          timers.push(timer2);
        }, 1200);

        timers.push(timer1);

        // After initial rendering, load ALL documents from the database to get the full set
        // of solutions with different decision types
        const timer3 = window.setTimeout(async () => {
          console.log("Loading all documents for batch ID:", newBatchId);
          await loadDocumentsByBatchId(newBatchId);

          // After loading all documents, run similarity matching to connect cards
          const timer4 = window.setTimeout(async () => {
            console.log(
              "Running similarity matching for connections between steps",
            );
            await findSimilarSolutionsAcrossSteps();
          }, 1000); // Wait a second after loading documents

          timers.push(timer4);
        }, 2000); // Give some time for the initial display before reloading with all solution types

        timers.push(timer3);

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to generate AI content:", error);
        setGenerationError("Failed to generate AI content. Please try again.");

        // Create empty steps for fallback, no default placeholder content
        const emptySteps: Step[] = [
          { id: "step1", title: "Initial Solutions", solutions: [] },
          { id: "step2", title: "Refined Solutions", solutions: [] },
          { id: "step3", title: "Implementation Details", solutions: [] },
          { id: "step4", title: "Final Solutions", solutions: [] },
          { id: "step5", title: "Final Outcome", solutions: [] },
        ];

        // Set the empty steps
        setAllSteps(emptySteps);

        // No fallback solutions - only use real data from the database
        const grouped: Record<number, Solution[]> = {};

        // Set empty grouped steps
        setGroupedSteps(grouped);

        // Try to load actual documents from the database
        // This will happen asynchronously after the loading state is resolved
        setTimeout(async () => {
          try {
            await loadDocumentsByBatchId(newBatchId);
          } catch (loadError) {
            console.error("Failed to load documents by batch ID:", loadError);
          }
        }, 1000);

        // Display all empty steps at once
        setSteps(emptySteps);
        setCurrentLevel(emptySteps.length - 1);
        setCurrentStepIndex(emptySteps.length - 1);

        // Use clean references and provide cleanup for timers
        const timer1 = window.setTimeout(() => {
          setVisibleConnections(allConnections);

          // Show the optimized path after a short delay
          const timer2 = window.setTimeout(() => {
            setShowOptimizedPath(true);
          }, 1000);

          timers.push(timer2);
        }, 1200);

        timers.push(timer1);

        setIsLoading(false);
      }
    })();

    // Cleanup function
    return () => {
      // Clear all timers on unmount
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };

    // Use stable dependencies that won't change on re-render
  }, [
    query,
    assignModelsToSolutions,
    groupSolutionsByStepIndex,
    loadDocumentsByBatchId,
  ]);

  // Helper function to create empty step containers (no default content)
  const createEmptyStepContainers = () => {
    return [
      { id: "step1", title: "Initial Solutions", solutions: [] },
      { id: "step2", title: "Refined Solutions", solutions: [] },
      { id: "step3", title: "Implementation Details", solutions: [] },
      { id: "step4", title: "Final Output Draft", solutions: [] },
      { id: "step5", title: "Final Output", solutions: [] },
    ];
  };

  // Check if the current step is the final outcome step - currently unused but kept for future implementation
  const isFinalStep = (stepId: string) => stepId === "step5";

  // Define the findSimilarSolutionsAcrossSteps function first
  const findSimilarSolutionsAcrossSteps = useCallback(async () => {
    // Skip if we don't have steps or solutions
    if (!initialBatchId || !steps || steps.length < 2) {
      console.log("Skipping similarity search - insufficient steps");
      return;
    }

    console.log(
      "Starting similarity search for connecting solutions across steps...",
    );

    // Clear any existing connections
    setSimilarityConnections([]);

    // Track which steps have actual solutions
    const groupedSteps: Record<number, Solution[]> = {};
    const stepIndices: number[] = [];

    // Group solutions by step index
    steps.forEach((step) => {
      if (!step.stepIndex) return;

      if (!groupedSteps[step.stepIndex]) {
        groupedSteps[step.stepIndex] = [];
        stepIndices.push(step.stepIndex);
      }

      if (step.solutions && step.solutions.length > 0) {
        groupedSteps[step.stepIndex].push(...step.solutions);
      }
    });

    // Sort step indices
    stepIndices.sort((a, b) => a - b);

    if (stepIndices.length < 2) {
      console.log(
        "Skipping similarity search - need at least two steps with solutions",
      );
      return;
    }

    console.log(
      `Found ${stepIndices.length} steps with solutions for similarity search`,
    );

    // Create new connections array
    const newConnections: {
      from: string;
      to: string;
      type: "accepted" | "secondary" | "rejected";
      color: string;
    }[] = [];

    // Import searchSimilarDocuments from embedding-service
    const { searchSimilarDocuments } = await import("@/lib/embedding-service");

    // Track which cards already have input connections
    const cardsWithInputs = new Set<string>();

    // Track 'PROBLEMATIC' cards to prevent chains
    const problematicSources = new Set<string>();

    // Process each step index (except the last one)
    for (let i = 0; i < stepIndices.length - 1; i++) {
      const currentStepIndex = stepIndices[i];
      const nextStepIndex = stepIndices[i + 1];

      // Get all solutions for the current step
      const currentStepSolutions = groupedSteps[currentStepIndex] || [];

      // Skip if no solutions in current step
      if (currentStepSolutions.length === 0) continue;

      // First process RECOMMENDED cards
      const recommendedSolutions = currentStepSolutions.filter(
        (s) => s.type === "accepted",
      );
      const viableSolutions = currentStepSolutions.filter(
        (s) => s.type === "secondary",
      );
      const problematicSolutions = currentStepSolutions.filter(
        (s) => s.type === "rejected",
      );

      // Process solutions in specific order: RECOMMENDED first, then VIABLE, then PROBLEMATIC
      const processingOrder = [
        ...recommendedSolutions,
        ...viableSolutions,
        ...problematicSolutions,
      ];

      console.log(
        `Processing ${processingOrder.length} solutions for step ${currentStepIndex} in priority order`,
      );

      // Process each solution
      for (const solution of processingOrder) {
        try {
          // Skip if solution doesn't have a description
          if (!solution.description) {
            console.log(`Skipping solution ${solution.id} - no description`);
            continue;
          }

          // Skip PROBLEMATIC cards that have input from another PROBLEMATIC card
          if (
            solution.type === "rejected" &&
            problematicSources.has(solution.id)
          ) {
            console.log(
              `Skipping PROBLEMATIC solution ${solution.id} - already has PROBLEMATIC input`,
            );
            continue;
          }

          // Get solutions for the next step
          const nextStepSolutions = groupedSteps[nextStepIndex] || [];

          // Skip if no next step solutions
          if (nextStepSolutions.length === 0) continue;

          // Special handling for PROBLEMATIC cards - prioritize leftmost cards on next level
          if (solution.type === "rejected") {
            try {
              // Get leftmost cards by sorting on screen position
              const leftmostCards = [...nextStepSolutions]
                .map((target) => {
                  const elem = document.getElementById(target.id);
                  const left = elem
                    ? elem.getBoundingClientRect().left
                    : Infinity;
                  return { target, left };
                })
                .filter((item) => item.left !== Infinity) // Filter out any that don't have valid positions
                .sort((a, b) => a.left - b.left); // Sort by left position (leftmost first)

              // First try RECOMMENDED cards without input
              const leftmostRecommended = leftmostCards
                .filter(
                  (item) =>
                    item.target.type === "accepted" &&
                    !cardsWithInputs.has(item.target.id),
                )
                .map((item) => item.target);

              // Then try VIABLE cards without input
              const leftmostViable = leftmostCards
                .filter(
                  (item) =>
                    item.target.type === "secondary" &&
                    !cardsWithInputs.has(item.target.id),
                )
                .map((item) => item.target);

              // Then PROBLEMATIC cards without input (avoiding chains)
              const leftmostProblematic = leftmostCards
                .filter(
                  (item) =>
                    item.target.type === "rejected" &&
                    !cardsWithInputs.has(item.target.id) &&
                    item.target.id !== solution.id,
                ) // Avoid connecting to self
                .map((item) => item.target);

              // Combine in order of preference
              let targetOptions = [
                ...leftmostRecommended,
                ...leftmostViable,
                ...leftmostProblematic,
              ];

              // If no valid targets without inputs, consider cards with inputs too
              if (targetOptions.length === 0) {
                // Same preference order, but include those with inputs
                const allRecommended = leftmostCards
                  .filter((item) => item.target.type === "accepted")
                  .map((item) => item.target);

                const allViable = leftmostCards
                  .filter((item) => item.target.type === "secondary")
                  .map((item) => item.target);

                // Still avoid PROBLEMATIC chains
                const allProblematic = leftmostCards
                  .filter(
                    (item) =>
                      item.target.type === "rejected" &&
                      item.target.id !== solution.id,
                  )
                  .map((item) => item.target);

                targetOptions = [
                  ...allRecommended,
                  ...allViable,
                  ...allProblematic,
                ];
              }

              // Choose the first (leftmost) target that fits our criteria
              if (targetOptions.length > 0) {
                const targetSolution = targetOptions[0];

                // Create a connection with slate color
                newConnections.push({
                  from: solution.id,
                  to: targetSolution.id,
                  type: "rejected",
                  color: "#94A3B8", // Slate color for PROBLEMATIC connections
                });

                // Mark the target as having an input
                cardsWithInputs.add(targetSolution.id);

                // If we connected to a PROBLEMATIC card, mark it as part of a chain
                if (targetSolution.type === "rejected") {
                  problematicSources.add(targetSolution.id);
                }

                console.log(
                  `Created direct connection from PROBLEMATIC card ${solution.id} to leftmost target ${targetSolution.id}`,
                );

                // Continue to next solution since we've made our connection
                continue;
              }
            } catch (error) {
              console.error(
                `Error processing PROBLEMATIC card connections for ${solution.id}:`,
                error,
              );
              // Fall through to normal similarity search
            }
          }

          // For RECOMMENDED: Prioritize connecting to RECOMMENDED, then VIABLE, then PROBLEMATIC
          // Allow all connections including PROBLEMATIC-to-PROBLEMATIC
          const targetPriority = [...nextStepSolutions]
            .sort((a, b) => {
              // Updated sort order for RECOMMENDED source cards: VIABLE first
              if (solution.type === "accepted") {
                // For RECOMMENDED source, prioritize VIABLE targets
                if (a.type === "secondary" && b.type !== "secondary") return -1;
                if (a.type !== "secondary" && b.type === "secondary") return 1;
              }

              // Default sort by type: RECOMMENDED first, then VIABLE, then PROBLEMATIC
              const typeOrder = { accepted: 0, secondary: 1, rejected: 2 };
              return typeOrder[a.type] - typeOrder[b.type];
            })
            .filter((target) => {
              // Only filter based on input connections, allow PROBLEMATIC chains
              return !cardsWithInputs.has(target.id);
            });

          // If no valid targets after filtering, try again but allow connecting to cards with inputs
          let selectedTargets =
            targetPriority.length > 0 ? targetPriority : nextStepSolutions;

          // Limit targets based on source type
          if (solution.type === "accepted") {
            // RECOMMENDED can connect to at most one target
            selectedTargets = selectedTargets.slice(0, 1);
          } else if (solution.type === "rejected") {
            // PROBLEMATIC can connect to at most one target
            selectedTargets = selectedTargets.slice(0, 1);
          }

          // Use the content of the solution to find similar solutions in the next step
          console.log(
            `Searching for similar solutions to ${solution.id} in step ${nextStepIndex}`,
          );

          // Search for similar documents with the same batch ID
          const similarDocuments = await searchSimilarDocuments(
            solution.description,
            0.65,
            8,
          );

          console.log(
            `Found ${similarDocuments.length} similar documents for solution ${solution.id}`,
          );

          // Filter to only include documents from the next step
          const nextStepSimilarDocs = similarDocuments.filter((doc) => {
            const metadata = doc.metadata;
            return (
              metadata.stepNumber === nextStepIndex && // In the next step
              doc.similarity > 0.65 // Higher similarity threshold
            );
          });

          console.log(
            `Filtered to ${nextStepSimilarDocs.length} documents in step ${nextStepIndex}`,
          );

          // If we have similar documents in the next step, create connections
          if (nextStepSimilarDocs.length > 0) {
            // Get the top most similar documents
            const topSimilarDocs = nextStepSimilarDocs
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 2);

            // Track how many connections we've made from this source
            let connectionsCreated = 0;
            const maxConnections =
              solution.type === "accepted" || solution.type === "rejected"
                ? 1
                : 2;

            for (const doc of topSimilarDocs) {
              // Stop if we've reached the connection limit for this source
              if (connectionsCreated >= maxConnections) break;

              // Find the matching solution in the next step
              const matchingSolution = nextStepSolutions.find(
                (s) => s.embeddings?.documentId === doc.id || s.id === doc.id,
              );

              if (matchingSolution) {
                // Check if this would create a problematic chain
                if (
                  solution.type === "rejected" &&
                  matchingSolution.type === "rejected"
                ) {
                  console.log(
                    `Warning: Creating connection between PROBLEMATIC cards: ${solution.id} -> ${matchingSolution.id}`,
                  );
                  // Continue with the connection (removed the continue statement)
                }

                // Skip if target already has an input and we have better options
                if (
                  cardsWithInputs.has(matchingSolution.id) &&
                  selectedTargets.length > 1
                ) {
                  console.log(
                    `Skipping connection to ${matchingSolution.id} - already has input and better options exist`,
                  );
                  continue;
                }

                // Determine connection type based on source solution
                const connectionType = solution.type;

                // Determine color based on source type
                let color = "#93C5FD"; // Light blue for VIABLE (secondary)
                if (solution.type === "accepted") {
                  color = "#4ADE80"; // Light green for RECOMMENDED (accepted)
                } else if (solution.type === "rejected") {
                  color = "#94A3B8"; // Light gray for PROBLEMATIC (rejected)
                }

                // Add the connection
                newConnections.push({
                  from: solution.id,
                  to: matchingSolution.id,
                  type: connectionType,
                  color,
                });

                // Mark the target as having an input
                cardsWithInputs.add(matchingSolution.id);

                // If source is PROBLEMATIC, mark any target as potentially part of a PROBLEMATIC chain
                if (solution.type === "rejected") {
                  problematicSources.add(matchingSolution.id);
                }

                connectionsCreated++;

                console.log(
                  `Created similarity connection from ${solution.id} to ${matchingSolution.id} with similarity ${doc.similarity.toFixed(2)}`,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `Error finding similar solutions for ${solution.id}:`,
            error,
          );
        }
      }
    }

    console.log(`Created ${newConnections.length} similarity connections`);

    // Update connections state to trigger re-render
    setSimilarityConnections(newConnections);
  }, [initialBatchId, steps]);

  // Now add the connections effect AFTER the function is defined
  // Add connections for the current step when it's first loaded
  useEffect(() => {
    if (steps.length > 0 && !isAnimating) {
      const connections = getVisibleConnectionsForSteps(steps);
      setVisibleConnections(connections);

      // After initial connections, run similarity analysis to find connections
      // between solutions in consecutive steps
      if (currentBatchId && showConnections) {
        // Refresh connections for the current batch
        findSimilarSolutionsAcrossSteps().catch((err) =>
          console.error("Error finding similar solutions:", err),
        );
      }
    }
  }, [
    steps,
    isAnimating,
    getVisibleConnectionsForSteps,
    currentBatchId,
    findSimilarSolutionsAcrossSteps,
    showConnections,
  ]);

  // Add a separate effect to update connections when visibleSolutionsByStep changes
  useEffect(() => {
    // Skip if we're still loading or don't have any visible solutions
    if (isLoading || Object.keys(visibleSolutionsByStep).length === 0) return;

    // Only update lines when we have stable connections
    const timer = setTimeout(() => {
      // Force redraw of connection lines without changing any connection values
      // This helps re-render lines after cards are fully positioned in the DOM
      setLineKey((prevKey) => prevKey + 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [visibleSolutionsByStep, isLoading]);

  // No automatic loading when selectedBatchId changes
  // Loading is now only triggered by the "View Solutions" button

  // Handle carousel navigation (prev/next)
  const handleCarouselPrevious = () => {
    // Decrement current page but don't go below 0
    setCarouselPage((prev) => Math.max(0, prev - 1));
    // Force redraw connections when changing page
    setLineKey((prevKey) => prevKey + 1);
  };

  const handleCarouselNext = () => {
    // Increment current page but don't exceed maxPages
    setCarouselPage((prev) => Math.min(maxCarouselPages - 1, prev + 1));
    // Force redraw connections when changing page
    setLineKey((prevKey) => prevKey + 1);
  };

  // Calculate max possible pages based on all grouped steps
  useEffect(() => {
    if (Object.keys(groupedSteps).length === 0) return;

    // Find the maximum number of pages needed across all step groups
    let maxPages = 1;
    Object.values(groupedSteps).forEach((solutions) => {
      if (solutions.length > 0) {
        const pagesNeeded = Math.ceil(solutions.length / 5); // 5 items per page
        maxPages = Math.max(maxPages, pagesNeeded);
      }
    });

    setMaxCarouselPages(maxPages);
    // Reset to first page when steps change
    setCarouselPage(0);
  }, [groupedSteps]);

  // Handle page change in a carousel
  const handleCarouselPageChange = useCallback(
    (stepIndex: number, visibleSolutions: any[]) => {
      // Skip if no visible solutions
      if (!visibleSolutions || visibleSolutions.length === 0) return;

      console.log(
        `Carousel page changed for step ${stepIndex} with ${visibleSolutions.length} visible solutions`,
      );

      // Update visible solutions for this step
      setVisibleSolutionsByStep((prev) => {
        // Create a deep copy to avoid mutation
        const updated = { ...prev };
        // Cast to appropriate type to avoid type errors
        updated[stepIndex] = visibleSolutions as Solution[];
        return updated;
      });

      // Force redraw of connection lines after a brief delay to allow DOM to update
      setTimeout(() => {
        setLineKey((prevKey) => prevKey + 1);
      }, 150);
    },
    [],
  );

  // Get step title based on step index
  const getStepTitle = (stepIndex: number): string => {
    switch (stepIndex) {
      case 1:
        return "Initial Approach Analysis";
      case 2:
        return "Refinement of Approach";
      case 3:
        return "Implementation Details";
      case 4:
        return "Final Output Draft";
      case 5:
        return "Technical Validation";
      case 6:
        return "Final Output";
      default:
        return "Solution Step";
    }
  };

  // Add this utility function for validating IDs
  const isValidId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    // Basic check for UUID format
    return id.length > 8 && id.includes('-');
  };

  // Modify the validateConnection function to check for valid IDs first
  const validateConnection = (fromId: string, toId: string): boolean => {
    // First check if IDs are valid
    if (!isValidId(fromId) || !isValidId(toId)) {
      console.log(`Skipping invalid connection: Invalid ID format - fromId=${fromId}, toId=${toId}`);
      return false;
    }
    
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    
    // Check if both elements exist in the DOM
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);
    
    if (!fromElement || !toElement) {
      // Log the issue but don't throw a visible error
      console.log(`Skipping invalid connection: ${fromId} -> ${toId} (elements don't exist in DOM)`);
      return false;
    }
    
    return true;
  };

  const generateConnectionLinesFromGroupedSteps = (): (Connection & {
    color: string;
  })[] => {
    const connections: (Connection & { color: string })[] = [];

    // Loop through all step indices except the last one (6)
    for (let currentStepIndex = 1; currentStepIndex < 6; currentStepIndex++) {
      const currentStepSolutions = groupedSteps[currentStepIndex] || [];
      const nextStepSolutions = groupedSteps[currentStepIndex + 1] || [];

      // For each solution in the current step
      currentStepSolutions.forEach((currentSolution) => {
        // Find matching solutions in the next step with the same runId
        const matchingNextSolutions = nextStepSolutions.filter(
          (nextSolution) => nextSolution.runId === currentSolution.runId,
        );

        // If there's a matching solution, create a connection
        if (matchingNextSolutions.length > 0) {
          // Use the first matching solution
          const nextSolution = matchingNextSolutions[0];

          // Determine connection type based on decision value from current step
          let connectionType: "accepted" | "secondary" | "rejected" =
            "secondary";
          let color = "#3B82F6"; // Default blue for secondary/VIABLE

          if (currentSolution.type === "accepted") {
            connectionType = "accepted";
            color = "#22C55E"; // Green for accepted/RECOMMENDED
          } else if (currentSolution.type === "rejected") {
            connectionType = "rejected";
            color = "#F97316"; // Orange for rejected/PROBLEMATIC
          }

          connections.push({
            from: currentSolution.id,
            to: nextSolution.id,
            type: connectionType,
            level: currentStepIndex,
            color,
          });
        }
      });
    }

    // First filter to ensure we only have valid connection IDs
    const connectionsWithValidIds = connections.filter(
      (conn) => isValidId(conn.from) && isValidId(conn.to)
    );
    
    if (connectionsWithValidIds.length < connections.length) {
      console.log(`Filtered out ${connections.length - connectionsWithValidIds.length} connections with invalid IDs`);
    }
    
    // Then filter connections that might have valid IDs but don't exist in DOM
    const validConnections = connectionsWithValidIds.filter(conn => 
      validateConnection(conn.from, conn.to)
    );
    
    // Log if connections were filtered out
    if (validConnections.length < connectionsWithValidIds.length) {
      console.log(`Filtered out ${connectionsWithValidIds.length - validConnections.length} connections with valid IDs but missing DOM elements`);
    }
    
    return validConnections;
  };

  // Display loading state with progress timeline and Ensemble Config Card
  if (isLoading) {
    return (
      <div className="w-full flex flex-col justify-center items-center py-10">
        {/* Add EnsembleConfigCard to show run status */}
        <div className="w-full mb-8">
          <EnsembleConfigCard
            id={`loading-ensemble-config-${Date.now()}`}
            key={`loading-ensemble-config-${totalRunCount}-${completedRunCount}-${errorRunCount}`}
            models={selectedModels}
            selectedIntensity={selectedIntensity}
            completedRuns={completedRuns}
            activeRuns={activeRuns}
            errorRuns={errorRuns}
            totalRuns={totalRunCount}
            completedCount={completedRunCount}
            errorCount={errorRunCount}
          />
        </div>

        <div className="flex flex-col items-center gap-4 mb-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {initialBatchId
              ? "Loading saved solutions..."
              : "Generating solutions across multiple models..."}
          </p>
        </div>

        {/* Progress Timeline */}
        <div className="w-full max-w-2xl mx-auto mt-8 relative">
          <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-gray-200"></div>

          {progressSteps.map((step, index) => (
            <div key={step.id} className="relative mb-8">
              <div className="flex items-center mb-2">
                <div className="absolute left-1/2 transform -translate-x-1/2">
                  {step.status === "completed" ? (
                    <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : step.status === "in-progress" ? (
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white animate-pulse">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : step.status === "error" ? (
                    <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center text-white">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`ml-12 ${index % 2 === 0 ? "text-left" : "text-right mr-12 ml-0"}`}
              >
                <h3
                  className={`text-md font-medium ${
                    step.status === "completed"
                      ? "text-green-700"
                      : step.status === "in-progress"
                        ? "text-blue-700"
                        : step.status === "error"
                          ? "text-red-700"
                          : "text-gray-500"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 mb-1">{step.description}</p>

                {/* Details */}
                {step.details && step.details.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 border-l-2 border-gray-200 pl-2">
                    {step.details.slice(-3).map((detail, i) => (
                      <p key={i} className="mb-1">
                        • {detail}
                      </p>
                    ))}
                    {step.details.length > 3 && (
                      <p className="text-xs text-gray-400">
                        +{step.details.length - 3} more details
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Display error state
  if (generationError) {
    return (
      <div className="w-full flex justify-center items-center py-20">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{generationError}</p>
            <Button
              className="mt-4"
              onClick={() => {
                setGenerationError(null);
                assignModelsToSolutions();
              }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we have any grouped steps
  const hasAnySteps = Object.values(groupedSteps).some(
    (group) => group && group.length > 0,
  );

  // Safety check - if we have no data to show, display a message
  if (!hasAnySteps) {
    return (
      <div className="w-full flex justify-center items-center py-20">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-500">
            {initialBatchId
              ? "No solutions found for the selected batch. Please try a different batch."
              : "No solution data available. Please configure models and generate solutions."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <LinesContainer className="pb-12">
      {/* Input card (fixed at top) */}
      <div id="input" className="relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                DEV INPUT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                {query ||
                  (initialBatchId &&
                    `Loading solutions from batch: ${initialBatchId}`) ||
                  "No input provided"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Ensemble Config Card - Always display outside loading state */}
      {selectedModels && selectedModels.length > 0 && (
        <div className="w-full mb-8">
          <EnsembleConfigCard
            id={`ensemble-config-${Date.now()}`}
            key={`ensemble-config-${totalRunCount}-${completedRunCount}-${errorRunCount}`}
            models={selectedModels}
            selectedIntensity={selectedIntensity}
            completedRuns={completedRuns}
            activeRuns={activeRuns}
            errorRuns={errorRuns}
            totalRuns={totalRunCount}
            completedCount={completedRunCount}
            errorCount={errorRunCount}
          />
        </div>
      )}

      {/* Batch selector dropdown */}
      {availableBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mt-4">
            <label
              htmlFor="batch-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Select Solution Batch:
            </label>
            <select
              id="batch-select"
              className="p-2 rounded-md border border-gray-300 text-sm text-gray-700"
              value={selectedBatchId || ""}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              aria-label="Select a previous solution batch"
            >
              <option value="" className="text-gray-500">
                Select Batch
              </option>
              {availableBatches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>
                  {batch.batch_id.split("_").slice(1).join("_")} (
                  {batch.step_count} steps)
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="ml-2"
              onClick={() => {
                if (selectedBatchId) {
                  setCurrentBatchId(selectedBatchId);
                  loadDocumentsByBatchId(selectedBatchId);
                }
              }}
              disabled={!selectedBatchId}
            >
              View Solutions
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {initialBatchId
                ? "Loading saved solutions..."
                : "Generating solutions across multiple models..."}
            </p>

            {/* Progress Timeline */}
            <div className="w-full max-w-2xl mx-auto mt-8 relative">
              <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-gray-200"></div>

              {progressSteps.map((step, index) => (
                <div key={step.id} className="relative mb-8">
                  <div className="flex items-center mb-2">
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                      {step.status === "completed" ? (
                        <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      ) : step.status === "in-progress" ? (
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white animate-pulse">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      ) : step.status === "error" ? (
                        <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center text-white">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`ml-12 ${index % 2 === 0 ? "text-left" : "text-right mr-12 ml-0"}`}
                  >
                    <h3
                      className={`text-md font-medium ${
                        step.status === "completed"
                          ? "text-green-700"
                          : step.status === "in-progress"
                            ? "text-blue-700"
                            : step.status === "error"
                              ? "text-red-700"
                              : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-1">
                      {step.description}
                    </p>

                    {/* Details */}
                    {step.details && step.details.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500 border-l-2 border-gray-200 pl-2">
                        {step.details.slice(-3).map((detail, i) => (
                          <p key={i} className="mb-1">
                            • {detail}
                          </p>
                        ))}
                        {step.details.length > 3 && (
                          <p className="text-xs text-gray-400">
                            +{step.details.length - 3} more details
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="relative">
          {/* Only render step carousels if we have steps with solutions */}
          {hasAnySteps && (
            <>
              {/* Dynamically grouped steps by index using carousels (steps 1-5) */}
              {Object.keys(groupedSteps)
                .map(Number)
                .filter((stepIndex) => stepIndex !== 6) // Exclude step 6 (final solution) for now
                .sort((a, b) => a - b)
                .map((stepIndex) => (
                  <motion.div
                    key={`step-group-${stepIndex}`}
                    className="relative mb-16"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <StepCarousel
                      solutions={groupedSteps[stepIndex] || []}
                      itemsPerPage={30} // Increased from 15 to 30 to show more solutions
                      title={`Step ${stepIndex}: ${getStepTitle(stepIndex)}`}
                      onPageChange={(visibleSolutions) =>
                        handleCarouselPageChange(stepIndex, visibleSolutions)
                      }
                      carouselPage={carouselPage}
                      totalPages={maxCarouselPages}
                    />

                    {/* Add debugging info during development */}
                    <div className="text-xs text-slate-500 mt-1">
                      <span className="mr-2">
                        RECOMMENDED:{" "}
                        {groupedSteps[stepIndex]?.filter(
                          (s) => s.type === "accepted",
                        ).length || 0}
                      </span>
                      <span className="mr-2">
                        VIABLE:{" "}
                        {groupedSteps[stepIndex]?.filter(
                          (s) => s.type === "secondary",
                        ).length || 0}
                      </span>
                      <span>
                        PROBLEMATIC:{" "}
                        {groupedSteps[stepIndex]?.filter(
                          (s) => s.type === "rejected",
                        ).length || 0}
                      </span>
                    </div>
                  </motion.div>
                ))}

              {/* Add final solution (step 6) last, as a carousel synchronized with other steps */}
              {groupedSteps[6] && groupedSteps[6].length > 0 && (
                <motion.div
                  key="step-group-6"
                  className="relative mb-16 mt-24" // Extra margin to separate from other steps
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="mb-4 text-sm font-medium text-muted-foreground">
                    Final Output
                  </div>

                  {/* Use the StepCarousel component for final solutions too */}
                  <StepCarousel
                    solutions={groupedSteps[6] || []}
                    itemsPerPage={30} // Consistent with other carousels
                    title="Final Implementation"
                    onPageChange={(visibleSolutions) =>
                      handleCarouselPageChange(6, visibleSolutions)
                    }
                    carouselPage={carouselPage}
                    totalPages={maxCarouselPages}
                  />
                </motion.div>
              )}

              {/* Connection manager for dynamic connections between visible cards */}
              <StepConnectionManager
                visibleSolutionsByStep={visibleSolutionsByStep}
                lineKey={lineKey}
                onHover={handleLineHover}
                highlightedConnections={highlightedConnections}
                similarityConnections={similarityConnections}
                showConnections={showConnections}
              />
            </>
          )}

          {/* Sticky carousel navigation buttons at bottom */}
          {hasAnySteps && maxCarouselPages > 1 && (
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-sm py-2 px-4 rounded-full shadow-md z-50">
              <Button
                onClick={handleCarouselPrevious}
                disabled={carouselPage <= 0}
                className="rounded-full h-10 w-10 p-0 bg-white hover:bg-gray-100 pointer-events-auto"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </Button>

              <div className="flex items-center space-x-2 pointer-events-none">
                {Array.from({ length: maxCarouselPages }).map((_, i) => (
                  <div
                    key={`page-dot-${i}`}
                    className={`h-2 w-2 rounded-full ${i === carouselPage ? "bg-primary" : "bg-gray-300"}`}
                  />
                ))}
              </div>

              <Button
                onClick={handleCarouselNext}
                disabled={carouselPage >= maxCarouselPages - 1}
                className="rounded-full h-10 w-10 p-0 bg-white hover:bg-gray-100 pointer-events-auto flex-shrink-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </Button>
            </div>
          )}
        </div>
      )}

      {showConnections && (
        <div className="connection-lines-container">
          {generateConnectionLinesFromGroupedSteps().map((connection, i) => (
            validateConnection(connection.from, connection.to) && (
              <PathLine
                key={`${connection.from}-${connection.to}`}
                fromId={connection.from}
                toId={connection.to}
                type={connection.type}
                delay={0.1 + i * 0.05}
                isHighlighted={isConnectionHighlighted(connection.from, connection.to)}
                color={connection.color}
                onHover={handleLineHover}
              />
            )
          ))}
        </div>
      )}
    </LinesContainer>
  );
}
