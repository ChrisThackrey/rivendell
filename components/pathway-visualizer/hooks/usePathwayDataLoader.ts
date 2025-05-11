import type { ModelConfig } from "@/components/ensemble-selection-modal";
import {
    generateText,
    getTemperatureFromIntensity
} from '@/lib/ai-service';
import {
    evaluateResponse,
    getDocumentsByBatchId
} from '@/lib/embedding-service';
import {
    getStepsByBatchId,
    groupStepsByStepIndex
} from '@/lib/step-service';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    PathwayVisualizerProps,
    Solution,
    Step,
} from '../types';
import {
    createDocumentMetadata,
    createEmptyStepStructures,
    ensureAllSolutionTypesInSteps,
    groupSolutionsByStepIndex,
    mapDecisionToSolutionType
} from '../utils/pathwayUtils';

// Internal type for connections
interface Connection {
  from: string;
  to: string;
  type: "accepted" | "secondary" | "rejected";
  color: string;
}

export interface RunProgressUpdaters {
  initializeProgress: (models: ModelConfig[]) => void;
  updateProgress: (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'error', details?: string[]) => void;
  addProgressDetail: (stepId: string, detail: string) => void;
  updateRunStatus: (modelId: number, temperature: 'low' | 'medium' | 'high', status: 'pending' | 'active' | 'completed' | 'error') => void;
}

export interface PathwayDataLoaderReturn {
  isLoading: boolean;
  generationError: string | null;
  allSteps: Step[];
  groupedSteps: Record<number, Solution[]>;
  currentBatchId: string;
  // Consider exposing a function to trigger generation/loading manually if needed
  // triggerDataLoad: (mode: 'generate' | 'loadBatch', batchId?: string) => void;
}

// Props needed by this hook
type DataLoaderProps = Pick<PathwayVisualizerProps, 'query' | 'selectedModels' | 'selectedIntensity' | 'selectedTechStack' | 'initialBatchId'>;

export function usePathwayDataLoader(
  props: DataLoaderProps,
  runProgressUpdaters: RunProgressUpdaters,
): PathwayDataLoaderReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [allSteps, setAllSteps] = useState<Step[]>([]);
  const [groupedSteps, setGroupedSteps] = useState<Record<number, Solution[]>>({});
  const [currentBatchId, setCurrentBatchId] = useState<string>(props.initialBatchId || "");

  const processedConfigRef = useRef<Record<string, boolean>>({});

  // --- assignModelsToSolutions (Internal Logic - to be fully implemented) ---
  const assignModelsToSolutionsInternal = useCallback(async (
    batchIdToUse: string,
    currentQuery: string,
    currentSelectedModels: ModelConfig[],
    currentSelectedIntensity: 'low' | 'medium' | 'high',
    currentSelectedTechStack: PathwayVisualizerProps['selectedTechStack']
  ): Promise<Step[]> => {
    runProgressUpdaters.initializeProgress(currentSelectedModels);
    runProgressUpdaters.updateProgress("init", "completed");
    runProgressUpdaters.updateProgress("generate", "in-progress", ["Starting model runs..."]);

    const processingQueue: {
      modelConfig: ModelConfig;
      intensityLevel: "low" | "medium" | "high";
      temperature: number;
      runNumber: number;
    }[] = [];

    for (const modelConfig of currentSelectedModels) {
      const { runsLow, runsMedium, runsHigh, model } = modelConfig;
      const isOModel = model === "o1" || model === "o3" || model === "o3-mini";
      const intensities = isOModel
        ? [{ level: 'low' as const, runs: runsLow }]
        : [
            { level: 'low' as const, runs: runsLow },
            { level: 'medium' as const, runs: runsMedium },
            { level: 'high' as const, runs: runsHigh }
          ];

      for (const intensity of intensities) {
        for (let i = 0; i < intensity.runs; i++) {
          processingQueue.push({
            modelConfig,
            intensityLevel: intensity.level,
            temperature: getTemperatureFromIntensity(intensity.level),
            runNumber: i + 1, // This runNumber might need to be global for batchId+runId uniqueness
          });
        }
      }
    }

    runProgressUpdaters.addProgressDetail("generate", `Processing ${processingQueue.length} total runs.`);
    const allRunSolutions: Solution[] = [];
    let globalRunIdCounter = 1; // Ensure unique run IDs within this batch generation

    // This Set should ideally be managed if runs can truly be identical across different higher-level operations
    // For now, it's reset per call to assignModelsToSolutionsInternal
    const localProcessedRuns = new Set<string>();


    for (const run of processingQueue) {
      const { modelConfig, temperature, intensityLevel } = run;
      const modelName = modelConfig.model;
      const currentRunIdForThisIteration = globalRunIdCounter++; // Use a globally incrementing ID for the run

      runProgressUpdaters.updateRunStatus(modelConfig.id, intensityLevel, "active");
      const runSignature = `${batchIdToUse}_${modelName}_${temperature}_${currentRunIdForThisIteration}`;

      if (localProcessedRuns.has(runSignature)) {
        console.log(`Hook: Skipping duplicate run: ${runSignature}`);
        continue;
      }
      localProcessedRuns.add(runSignature);
      runProgressUpdaters.addProgressDetail("generate", `Run ${currentRunIdForThisIteration}: ${modelName} (${intensityLevel})`);

      const techStackContext = currentSelectedTechStack.map((tech) => `${tech.category} (${tech.name})`).join(", ");

      try {
        // Get existing documents for this runId if any - getDocumentsByBatchId needs fixing
        const documents = await getDocumentsByBatchId(batchIdToUse);
        const existingDoc = documents.find(doc => doc.metadata.runId === currentRunIdForThisIteration);

        let result: any; // Type for 'result' from generateText
        let runtime: string;

        if (!existingDoc) {
          const startTime = Date.now();
          result = await generateText(currentQuery, modelName, temperature, techStackContext, currentRunIdForThisIteration, modelConfig.enableReasoning);
          runtime = `${Date.now() - startTime}ms`;
          runProgressUpdaters.addProgressDetail("generate", `Run ${currentRunIdForThisIteration} generated in ${runtime}.`);

          if (!result || !result.structuredSolution) {
            throw new Error("No structured solution from AI");
          }
        } else {
          console.log(`Hook: Using existing doc for run ${currentRunIdForThisIteration}`);
          runtime = existingDoc.metadata.runtime || "0ms";
          result = { structuredSolution: { steps: existingDoc.metadata.structuredSteps || [], finalSolution: existingDoc.metadata.structuredFinalSolution, rawContent: existingDoc.content }, fullContent: existingDoc.content};
        }

        runProgressUpdaters.updateProgress("evaluate", "in-progress");
        const evalResult = await evaluateResponse(result.fullContent, result.fullContent, modelName, temperature);
        const metadata = createDocumentMetadata(modelName, runtime, currentRunIdForThisIteration, temperature, evalResult.scores, evalResult.decision);
        const decisionTypeMapped = mapDecisionToSolutionType(evalResult.decision);

        const aiSteps = result.structuredSolution.steps || [];
        const aiFinalSolution = result.structuredSolution.finalSolution;

        runProgressUpdaters.updateProgress("store", "in-progress");
        for (let i = 0; i < Math.min(aiSteps.length, 5); i++) {
          const stepData = aiSteps[i];
          // ... (logic to create stepSolution, stepMetadata, call storeDocumentWithEmbedding)
          // This part is complex and involves determining solutionType, frequency, etc.
          // For brevity, an actual Solution object would be constructed and pushed.
          // Example:
          const stepSolution: Solution = { id: `step${i+1}-run${currentRunIdForThisIteration}`, title: stepData.title, description: stepData.description, type: decisionTypeMapped, model: modelName, runId: currentRunIdForThisIteration, stepIndex: i+1, batchId: batchIdToUse, metrics: stepData.metrics, embeddings: { documentId: null, metadata }};
          // const docId = await storeDocumentWithEmbedding(stepData.description, {...metadata, stepNumber: i+1, ...}, batchIdToUse, stepSolution);
          // stepSolution.embeddings.documentId = docId;
          allRunSolutions.push(stepSolution);
        }
        if (aiFinalSolution) {
           // ... (logic to create finalStepSolution, finalStepMetadata, call storeDocumentWithEmbedding)
           // Example:
           const finalStepSolution: Solution = { id: `final-run${currentRunIdForThisIteration}`, title: aiFinalSolution.title, description: aiFinalSolution.description, type: 'accepted', model: modelName, runId: currentRunIdForThisIteration, stepIndex: 6, batchId: batchIdToUse, metrics: aiFinalSolution.metrics, embeddings: { documentId: null, metadata }};
           // const finalDocId = await storeDocumentWithEmbedding(aiFinalSolution.description, {...metadata, stepNumber: 6, ...}, batchIdToUse, finalStepSolution);
           // finalStepSolution.embeddings.documentId = finalDocId;
           allRunSolutions.push(finalStepSolution);
        }
        runProgressUpdaters.updateRunStatus(modelConfig.id, intensityLevel, "completed");
      } catch (error: any) {
        console.error(`Hook: Error in run ${currentRunIdForThisIteration}:`, error);
        runProgressUpdaters.addProgressDetail("generate", `Error in run ${currentRunIdForThisIteration}: ${error.message}`);
        runProgressUpdaters.updateRunStatus(modelConfig.id, intensityLevel, "error");
      }
    }
    runProgressUpdaters.updateProgress("generate", "completed");
    runProgressUpdaters.updateProgress("evaluate", "completed");
    runProgressUpdaters.updateProgress("store", "completed");

    // This part should use the actual results from storing embeddings
    const finalGeneratedSteps = createEmptyStepStructures();
    // Populate finalGeneratedSteps based on allRunSolutions and their document IDs after storage
    // For now, this is simplified.
    let tempGrouped = groupSolutionsByStepIndex(allRunSolutions);
    finalGeneratedSteps.forEach(stepShell => {
        const solutionsForThisStep = tempGrouped[stepShell.stepIndex || 0];
        if(solutionsForThisStep) {
            stepShell.solutions = solutionsForThisStep.slice(0, 5); // Example: take top 5
        }
    });

    return finalGeneratedSteps;

  }, [runProgressUpdaters]); // Add props when they are directly used

  // --- loadDocumentsByBatchId (Internal Logic - to be fully implemented) ---
  const loadDocumentsByBatchIdInternal = useCallback(async (batchIdToLoad: string): Promise<{
    steps: Step[],
    groupedSteps: Record<number, Solution[]>,
    connections: Connection[],
    visibleSolutionsByStep: Record<number, Solution[]>
  }> => {
    runProgressUpdaters.updateProgress("init", "in-progress", [`Loading batch: ${batchIdToLoad}`]);
    try {
      console.log(`Starting to load documents for batch ID: ${batchIdToLoad}`);

      // First, try to load steps from the steps table
      const steps = await getStepsByBatchId(batchIdToLoad);

      // Initialize empty steps array to ensure we have a structure to show
      const emptySteps: Step[] = createEmptyStepStructures();

      // Container for connections between steps
      const connections: Connection[] = [];

      // Container for visible solutions by step
      const initialVisibleSolutions: Record<number, Solution[]> = {};

      if (steps.length > 0) {
        console.log(
          `Found ${steps.length} steps for batch ID: ${batchIdToLoad} in steps table`,
        );

        // Group steps by step index
        const grouped = groupStepsByStepIndex(steps);

        // Update the connections based on level information from steps
        const stepsWithLevels = steps.map((step) => ({
          id: step.id,
          level: step.level,
          stepIndex: step.step_index, // Use step_index instead of step_number
          runId: step.run_id,
          type: step.step_data.type as "accepted" | "secondary" | "rejected",
          decision: step.decision_value,
        }));

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
              connections.push({
                from: currentStep.id,
                to: nextStep.id,
                type: connectionType,
                color,
              });
            });
          });
        });

        console.log(
          "Setting grouped steps from steps table:",
          Object.keys(grouped).length,
        );

        // Initialize visibleSolutionsByStep with first page of solutions
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

        // Populate the empty steps with solutions
        for (let i = 0; i < emptySteps.length; i++) {
          const stepIndex = i + 1;
          const stepSolutions = grouped[stepIndex] as Solution[] || [];
          emptySteps[i].solutions = stepSolutions;
        }

        runProgressUpdaters.updateProgress("init", "completed");
        return {
          steps: emptySteps,
          groupedSteps: grouped as Record<number, Solution[]>,
          connections,
          visibleSolutionsByStep: initialVisibleSolutions
        };
      }

      // If no steps found, fall back to loading from documents table and processing them
      console.log(
        "No steps found in steps table, falling back to documents table",
      );
      // Get all documents for this batch - note getDocumentsByBatchId only takes batchId, no runId
      const documents = await getDocumentsByBatchId(batchIdToLoad);

      if (documents.length === 0) {
        console.log("No documents found for batch ID:", batchIdToLoad);
        runProgressUpdaters.updateProgress("init", "completed", ["No data found for this batch"]);
        return {
          steps: emptySteps,
          groupedSteps: {},
          connections: [],
          visibleSolutionsByStep: {}
        };
      }

      console.log(
        `Found ${documents.length} documents for batch ID: ${batchIdToLoad}`,
      );

      // Convert documents to solutions
      const solutions: Solution[] = documents.map((doc) => {
        const metadata = doc.metadata as any; // Using any for simplicity
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

        return {
          id: doc.id,
          title: title,
          description: doc.content.substring(0, 500),
          type: solutionType,
          model: metadata.model,
          runId: metadata.runId,
          stepIndex: stepIndex,
          batchId: batchIdToLoad,
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
      });

      // Group solutions by step index
      const grouped = groupSolutionsByStepIndex(solutions);

      // Ensure each step has at least one of each solution type (if available in the dataset)
      // Only include all decision types if the flag is set - this was passed as includeAllDecisionTypes in original
      const enhancedGrouped = ensureAllSolutionTypesInSteps(
        grouped,
        solutions,
        true, // Default to including all decision types
      );

      console.log(
        "Setting grouped steps with all solution types:",
        Object.keys(enhancedGrouped).length,
      );

      // Initialize visibleSolutionsByStep with first page of solutions
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

      // Populate the empty steps with solutions
      for (let i = 0; i < emptySteps.length; i++) {
        const stepIndex = i + 1;
        const stepSolutions = enhancedGrouped[stepIndex] || [];
        emptySteps[i].solutions = stepSolutions;
      }

      // Create connections based on solution relationships
      // This is simplified compared to the original, as we don't have step levels from documents
      const solutionsByStep: Record<number, Solution[]> = {};
      solutions.forEach(solution => {
        const stepIndex = solution.stepIndex || 1;
        if (!solutionsByStep[stepIndex]) {
          solutionsByStep[stepIndex] = [];
        }
        solutionsByStep[stepIndex].push(solution);
      });

      // Create connections between steps
      for (let i = 1; i < 5; i++) {
        const currentStepSols = solutionsByStep[i] || [];
        const nextStepSols = solutionsByStep[i + 1] || [];

        if (currentStepSols.length > 0 && nextStepSols.length > 0) {
          // Connect each solution to the next step's solutions of the same type or run
          currentStepSols.forEach(currentSol => {
            // Find matching solutions in next step by run ID
            let matchingSols = nextStepSols.filter(s => s.runId === currentSol.runId);

            // If no matches by run, try by type
            if (matchingSols.length === 0) {
              matchingSols = nextStepSols.filter(s => s.type === currentSol.type);
            }

            // If still no matches, use first solution
            if (matchingSols.length === 0 && nextStepSols.length > 0) {
              matchingSols = [nextStepSols[0]];
            }

            // Create connections
            matchingSols.forEach(nextSol => {
              let color = "#3B82F6"; // Default blue
              let connectionType: "accepted" | "secondary" | "rejected" = "secondary";

              if (currentSol.type === "accepted") {
                color = "#22C55E"; // Green
                connectionType = "accepted";
              } else if (currentSol.type === "rejected") {
                color = "#F97316"; // Orange
                connectionType = "rejected";
              }

              connections.push({
                from: currentSol.id,
                to: nextSol.id,
                type: connectionType,
                color
              });
            });
          });
        }
      }

      runProgressUpdaters.updateProgress("init", "completed");
      return {
        steps: emptySteps,
        groupedSteps: enhancedGrouped,
        connections,
        visibleSolutionsByStep: initialVisibleSolutions
      };
    } catch (error: any) {
      console.error("Error loading documents by batch ID:", error);
      runProgressUpdaters.updateProgress("init", "error", [`Error: ${error.message || "Unknown error"}`]);
      return {
        steps: createEmptyStepStructures(),
        groupedSteps: {},
        connections: [],
        visibleSolutionsByStep: {}
      };
    }
  }, [runProgressUpdaters]);

  // Effect to load batch data when initialBatchId changes
  useEffect(() => {
    if (props.initialBatchId) {
      console.log(`Loading data for initial batch ID: ${props.initialBatchId}`);
      setCurrentBatchId(props.initialBatchId);
      setIsLoading(true);

      loadDocumentsByBatchIdInternal(props.initialBatchId)
        .then(({ steps, groupedSteps }) => {
          setAllSteps(steps);
          setGroupedSteps(groupedSteps);
          setIsLoading(false);
          console.log("Finished loading batch data");
        })
        .catch((error) => {
          console.error("Error loading batch data:", error);
          setGenerationError(`Error loading batch: ${error.message}`);
          setIsLoading(false);
        });
    }
  }, [props.initialBatchId, loadDocumentsByBatchIdInternal]);

  // Return hook state and functions
  return {
    isLoading,
    generationError,
    allSteps,
    groupedSteps,
    currentBatchId,
  };
}
