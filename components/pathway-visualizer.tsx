"use client";

import LinesContainer from "@/components/lines-container";
import PathLine from "@/components/path-line";
import { useBatchManager } from "@/components/pathway-visualizer/hooks/useBatchManager";
import { useCarouselManager } from "@/components/pathway-visualizer/hooks/useCarouselManager";
import { useConnections } from "@/components/pathway-visualizer/hooks/useConnections";
import { useRunProgress } from "@/components/pathway-visualizer/hooks/useRunProgress";
import type { PathwayVisualizerProps, Solution, Step } from "@/components/pathway-visualizer/types";
import type { Solution as StepCarouselSolution } from "@/components/step-carousel";
import StepCarousel from "@/components/step-carousel";
import StepConnectionManager from "@/components/step-connection-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CodeFile,
  DecisionType,
  DocumentMetadata,
  ScoreMetrics,
} from "@/lib/supabase-client";
import type { Connection, SimilarityConnection } from "@/lib/types";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [allSteps, setAllSteps] = useState<Step[]>([]);
  // Continue button state (commented out but keeping the variable for future use)
  const [, setShowContinueButton] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Additional state variables
  const [groupedSteps, setGroupedSteps] = useState<Record<number, Solution[]>>({});
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [visibleSolutionsByStep, setVisibleSolutionsByStep] = useState<Record<number, Solution[]>>({});
  const [hasAnySteps, setHasAnySteps] = useState(false);
  const [showOptimizedPath, setShowOptimizedPath] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);

  // Use custom hooks
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
    []
  );

  // Initialize hooks
  const {
    availableBatches,
    selectedBatchId,
    setSelectedBatchId,
    loadAvailableBatches: fetchAvailableBatches,
    isConnected
  } = useBatchManager(initialBatchId);

  // Extract carousel manager from the hook with all returned values
  const carouselManager = useCarouselManager(groupedSteps || {});
  const {
    carouselPage,
    maxCarouselPages,
    lineKey,
    handleCarouselNext,
    handleCarouselPrevious
  } = carouselManager;

  // Initialize connection manager hook
  const connectionManager = useConnections(steps);
  const {
    highlightedConnections,
    similarityConnections,
    visibleConnections,
    handleLineHover,
    isConnectionHighlighted,
    getVisibleConnectionsForSteps,
    findAndSetSimilarityConnections
  } = connectionManager;

  // Initialize progress manager hook
  const runProgressManager = useRunProgress();
  const {
    progressSteps,
    currentProgressStep,
    completedRuns,
    activeRuns,
    errorRuns,
    totalRunCount,
    completedRunCount,
    errorRunCount,
    updateRunStatus,
    updateProgress,
    addProgressDetail,
    initializeProgress
  } = runProgressManager;

  // Add state for storing code files
  const [solutionCodeFiles, setSolutionCodeFiles] = useState<
    Record<string, CodeFile[]>
  >({});
  const [loadingCodeFiles, setLoadingCodeFiles] = useState<
    Record<string, boolean>
  >({});

  // Process batch selection
  useEffect(() => {
    try {
      // Special handling for initialBatchId prop
      if (initialBatchId && initialBatchId !== selectedBatchId && availableBatches.length > 0) {
        console.log(`Setting initial batch ID: ${initialBatchId}`);
        setSelectedBatchId(initialBatchId);
      }
    } catch (error) {
      console.error("Error processing batch selection:", error);
      setGenerationError("Failed to select batch");
    }
  }, [initialBatchId, availableBatches, selectedBatchId, setSelectedBatchId]);

  // Load selected batch data
  useEffect(() => {
    const loadBatch = async () => {
      if (!selectedBatchId) return;

      try {
        // In the future, implement proper batch loading
        console.log(`Loading batch ${selectedBatchId}`);

        // For now, just mark as not loading when a batch is selected
        setIsLoading(false);
        // Clear any previous error
        setGenerationError(null);
      } catch (error) {
        console.error("Error loading batch data:", error);
        setGenerationError(
          error instanceof Error
            ? `Failed to load batch data: ${error.message}`
            : "Failed to load batch data"
        );
        setIsLoading(false);
      }
    };

    loadBatch();
  }, [selectedBatchId]);

  // Safer type conversion to handle potential missing fields
  const handleCarouselPageChange = useCallback((stepIndex: number, carouselVisibleSolutions: StepCarouselSolution[]) => {
    try {
      if (!Array.isArray(carouselVisibleSolutions)) {
        console.error("Expected visibleSolutions to be an array, got:", carouselVisibleSolutions);
        return;
      }

      // Convert StepCarouselSolution[] to Solution[] by ensuring required properties exist
      const convertedSolutions: Solution[] = carouselVisibleSolutions.map(solution => {
        if (!solution || typeof solution !== 'object') {
          console.error("Invalid solution object:", solution);
          // Provide a minimal valid solution object
          return {
            id: `fallback-${Math.random().toString(36).substring(2, 9)}`,
            title: "Error: Invalid Solution",
            description: "This solution could not be processed correctly.",
            type: "rejected",
            model: "Unknown",
            metrics: {
              executionTime: 'N/A',
              complexity: 'N/A',
              memoryUsage: 'N/A',
              lineCount: 0,
              codeQuality: 0
            },
            runId: 0,
            stepIndex: 0,
            batchId: '',
            embeddings: {
              documentId: null,
              metadata: {}
            }
          };
        }

        return {
          ...solution,
          id: solution.id || `sol-${Math.random().toString(36).substring(2, 9)}`,
          title: solution.title || "Untitled Solution",
          description: solution.description || "No description available",
          type: solution.type || "secondary",
          model: solution.model || 'Unknown',
          metrics: {
            executionTime: solution.metrics?.executionTime || 'N/A',
            complexity: solution.metrics?.complexity || 'N/A',
            memoryUsage: solution.metrics?.memoryUsage || 'N/A',
            lineCount: solution.metrics?.lineCount || 0,
            codeQuality: solution.metrics?.codeQuality || 0
          },
          runId: solution.runId || 0,
          stepIndex: solution.stepIndex !== undefined ? solution.stepIndex : 0,
          batchId: solution.batchId || '',
          embeddings: {
            documentId: solution.embeddings?.documentId || null,
            metadata: solution.embeddings?.metadata || {}
          },
          frequency: solution.frequency,
          codeFiles: solution.codeFiles,
          fileTree: solution.fileTree
        };
      });

      // Update visibleSolutionsByStep with converted solutions
      setVisibleSolutionsByStep(prev => ({
        ...prev,
        [stepIndex]: convertedSolutions
      }));

      // Update line key to trigger connections redraw
      if (carouselManager && typeof carouselManager.handleCarouselPageChange === 'function') {
        carouselManager.handleCarouselPageChange(stepIndex, convertedSolutions);
      }
    } catch (error) {
      console.error("Error handling carousel page change:", error);
    }
  }, [carouselManager]);

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
    [solutionCodeFiles, loadingCodeFiles]
  );

  // Initialize progress steps and run counts based on selected models and runs
  useEffect(() => {
    if (!isLoading) return;

    // Initialize progress tracker
    initializeProgress(selectedModels);
  }, [isLoading, selectedModels, initializeProgress]);

  // Fetch available batches on component mount
  useEffect(() => {
    fetchAvailableBatches();
  }, [fetchAvailableBatches]);

  // Initialize visible solutions when groupedSteps changes
  useEffect(() => {
    // Skip if no grouped steps
    if (Object.keys(groupedSteps).length === 0) return;

    // For now, just set hasAnySteps flag based on grouped steps
    setHasAnySteps(true);

    // Initialize visibleSolutionsByStep with solutions from the first page of each step
    const initialVisibleSolutions: Record<number, Solution[]> = {};
    Object.keys(groupedSteps).forEach(stepIndex => {
      const stepIndexNumber = Number(stepIndex);
      const solutionsForStep = groupedSteps[stepIndexNumber];

      if (solutionsForStep && solutionsForStep.length > 0) {
        // Take the first 5 solutions (or less if there are fewer)
        initialVisibleSolutions[stepIndexNumber] = solutionsForStep.slice(0, 5);
      } else {
        initialVisibleSolutions[stepIndexNumber] = [];
      }
    });

    setVisibleSolutionsByStep(initialVisibleSolutions);
  }, [groupedSteps]);

  // Effect to update visible connections when visibleSolutionsByStep changes
  useEffect(() => {
    try {
      // Extract all visible steps from visibleSolutionsByStep
      const visibleSteps: Step[] = [];

      Object.keys(visibleSolutionsByStep).forEach(stepIndexStr => {
        const stepIndex = Number(stepIndexStr);
        const solutions = visibleSolutionsByStep[stepIndex];

        if (solutions && solutions.length > 0) {
          visibleSteps.push({
            id: `step${stepIndex}`,
            title: `Step ${stepIndex}`,
            solutions: solutions,
            stepIndex: stepIndex,
            level: stepIndex,
            batchId: currentBatchId
          });
        }
      });

      // Update connections based on visible steps
      if (visibleSteps.length > 0 && typeof getVisibleConnectionsForSteps === 'function') {
        getVisibleConnectionsForSteps(visibleSteps);
      }
    } catch (error) {
      console.error("Error updating visible connections:", error);
    }
  }, [visibleSolutionsByStep, getVisibleConnectionsForSteps, currentBatchId]);

  const proceedToNextStep = useCallback(
    (nextIndex: number) => {
      // Collect timer IDs for potential cleanup
      const timers: number[] = [];

      // Set animating state
      setIsAnimating(true);

      // Add the next step
      const updatedSteps = [...steps, allSteps[nextIndex]];
      setSteps(updatedSteps);
      setCurrentLevel(nextIndex);
      setCurrentStepIndex(nextIndex);

      // Wait for cards to appear
      const timer1 = window.setTimeout(() => {
        // After connections appear, show the continue button
        const timer2 = window.setTimeout(() => {
          setIsAnimating(false);

          // If this is the final step, show the optimized path after a delay
          if (nextIndex === allSteps.length - 1) {
            const timer3 = window.setTimeout(() => {
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
    [steps, allSteps, setCurrentLevel, setShowOptimizedPath]
  );

  // Commented out but keeping for future use
  const handleContinue = useCallback(() => {
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

  // Helper function to determine if a step is the final step
  const isFinalStep = (stepId: string) => stepId === "step5";

  // Get the string name for a step based on its index
  const getStepTitle = (stepIndex: number): string => {
    switch (stepIndex) {
      case 1:
        return "Initial Solutions";
      case 2:
        return "Refined Solutions";
      case 3:
        return "Implementation Details";
      case 4:
        return "Final Solutions";
      case 5:
        return "Final Outcome";
      case 6:
        return "Complete Solution";
      default:
        return `Step ${stepIndex}`;
    }
  };

  // Update assignModelsToSolutions to process multiple runs based on ensemble configuration
  const assignModelsToSolutions = useCallback(async (): Promise<Step[]> => {
    // Implementation simplified for now - just return empty array
    return [];
  }, []);

  return (
    <div className="flex flex-col w-full" role="region" aria-label="Pathway Visualizer">
      {/* Display progress tracker when generating content */}
      {isLoading && progressSteps.length > 0 && (
        <div className="mb-8 w-full">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Generating Solutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress steps */}
              <div className="space-y-4">
                {progressSteps.map((step) => (
                  <div key={step.id} className="space-y-2">
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                          step.status === "completed"
                            ? "bg-green-500"
                            : step.status === "in-progress"
                              ? "bg-blue-500"
                              : step.status === "error"
                                ? "bg-red-500"
                                : "bg-gray-200"
                        }`}
                        aria-hidden="true"
                      >
                        {/* Status indicator icon would go here */}
                      </div>
                      <h3
                        className={`text-sm font-medium ${
                          step.status === "error"
                            ? "text-red-700"
                            : "text-gray-500"
                        }`}
                        aria-current={step.status === "in-progress" ? "step" : undefined}
                      >
                        {step.title}
                        <span className="sr-only">
                          {step.status === "completed" ? "(completed)"
                            : step.status === "in-progress" ? "(in progress)"
                            : step.status === "error" ? "(error)"
                            : "(pending)"}
                        </span>
                      </h3>
                    </div>
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
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !progressSteps.length && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-12 w-12 rounded-full border-4 border-t-blue-500 border-b-blue-700 border-l-blue-600 border-r-blue-600 animate-spin"></div>
            <p className="text-gray-500">Loading solutions...</p>
          </div>
        </div>
      )}

      {/* Connection error message */}
      {!isConnected && (
        <div className="mb-8 w-full p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          <p className="font-medium">Database Connection Error</p>
          <p className="text-sm mt-1">Could not connect to the database. Please check your connection and try again.</p>
          <button
            onClick={() => fetchAvailableBatches()}
            className="mt-2 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Error message */}
      {generationError && (
        <div className="mb-8 w-full p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          <p className="font-medium">Error generating solutions</p>
          <p className="text-sm mt-1">{generationError}</p>
        </div>
      )}

      {!isLoading && (
        <div className="relative">
          {/* Only render step carousels if we have steps with solutions */}
          {hasAnySteps ? (
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
                visibleSolutionsByStep={
                  // Convert our Solution type back to StepCarouselSolution type for the connection manager
                  Object.entries(visibleSolutionsByStep).reduce<Record<number, StepCarouselSolution[]>>(
                    (acc, [stepIndex, solutions]) => {
                      acc[Number(stepIndex)] = solutions.map(solution => ({
                        id: solution.id,
                        title: solution.title,
                        description: solution.description,
                        type: solution.type,
                        model: solution.model,
                        metrics: solution.metrics,
                        frequency: solution.frequency,
                        runId: solution.runId,
                        stepIndex: solution.stepIndex,
                        batchId: solution.batchId,
                        embeddings: solution.embeddings,
                        codeFiles: solution.codeFiles,
                        fileTree: solution.fileTree
                      }));
                      return acc;
                    },
                    {}
                  )
                }
                lineKey={lineKey}
                onHover={handleLineHover}
                highlightedConnections={highlightedConnections}
                similarityConnections={similarityConnections}
                showConnections={showConnections}
              />
            </>
          ) : (
            // No steps available - show empty state
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">
                No solutions found for the current selection.
              </p>
              {selectedBatchId && (
                <p className="text-sm text-muted-foreground">
                  Try selecting a different batch or query to see available solutions.
                </p>
              )}
            </div>
          )}

          {/* Sticky carousel navigation buttons at bottom */}
          {hasAnySteps && maxCarouselPages > 1 && (
            <div
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-sm py-2 px-4 rounded-full shadow-md z-50"
              role="navigation"
              aria-label="Carousel navigation"
            >
              <Button
                onClick={handleCarouselPrevious}
                disabled={carouselPage <= 0}
                className="rounded-full h-10 w-10 p-0 bg-white hover:bg-gray-100 pointer-events-auto"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" aria-hidden="true" />
              </Button>

              <div className="flex items-center space-x-2 pointer-events-none" aria-hidden="true">
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
                <ChevronRight className="h-5 w-5 text-gray-700" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}

      {showConnections && (
        <LinesContainer>
          {visibleConnections.map((connection, i) => (
            <PathLine
              key={`${connection.from}-${connection.to}`}
              fromId={connection.from}
              toId={connection.to}
              type={connection.type}
              delay={0.1 + i * 0.05}
              isHighlighted={isConnectionHighlighted(connection.from, connection.to)}
              onHover={handleLineHover}
            />
          ))}
        </LinesContainer>
      )}
    </div>
  );
}
