import type { ModelRunStatus, ProgressStep } from "@/lib/types";
import { useCallback, useState } from "react";

export function useProgressTracker() {
  // Progress steps tracking
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [currentProgressStep, setCurrentProgressStep] = useState<string | null>(null);

  // Run status tracking
  const [completedRuns, setCompletedRuns] = useState<ModelRunStatus[]>([]);
  const [activeRuns, setActiveRuns] = useState<ModelRunStatus[]>([]);
  const [errorRuns, setErrorRuns] = useState<ModelRunStatus[]>([]);
  const [totalRunCount, setTotalRunCount] = useState<number>(0);
  const [completedRunCount, setCompletedRunCount] = useState<number>(0);
  const [errorRunCount, setErrorRunCount] = useState<number>(0);

  // Initialize progress steps
  const initializeProgress = useCallback((runCount: number) => {
    // Reset run counters
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

    // After a short delay, update the initialization step to completed
    setTimeout(() => {
      updateProgress("init", "completed");
      updateProgress("generate", "in-progress", ["Starting model runs..."]);
    }, 1000);
  }, []);

  // Function to update progress steps
  const updateProgress = useCallback(
    (stepId: string, status: "pending" | "in-progress" | "completed" | "error", details?: string[]) => {
      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === stepId
            ? {
                ...step,
                status,
                details: details || step.details,
                timestamp: Date.now(),
              }
            : step
        )
      );

      if (status === "in-progress") {
        setCurrentProgressStep(stepId);
      } else if (status === "completed" && currentProgressStep === stepId) {
        // Find next pending step
        const nextStep = progressSteps.find((s) => s.status === "pending");
        setCurrentProgressStep(nextStep?.id || null);
      }
    },
    [progressSteps, currentProgressStep]
  );

  // Function to add a detail to the current progress step
  const addProgressDetail = useCallback((stepId: string, detail: string) => {
    setProgressSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              details: [...(step.details || []), detail],
            }
          : step
      )
    );
  }, []);

  // Function to update run status for a specific model and temperature
  const updateRunStatus = useCallback(
    (
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
    },
    [completedRuns]
  );

  // Reset progress tracker
  const resetProgress = useCallback(() => {
    setProgressSteps([]);
    setCurrentProgressStep(null);
    setCompletedRuns([]);
    setActiveRuns([]);
    setErrorRuns([]);
    setTotalRunCount(0);
    setCompletedRunCount(0);
    setErrorRunCount(0);
  }, []);

  return {
    progressSteps,
    currentProgressStep,
    completedRuns,
    activeRuns,
    errorRuns,
    totalRunCount,
    completedRunCount,
    errorRunCount,
    initializeProgress,
    updateProgress,
    addProgressDetail,
    updateRunStatus,
    resetProgress
  };
}