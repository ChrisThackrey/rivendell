import { getDocumentsByBatchId } from "@/lib/embedding-service";
import { getAvailableBatches, getStepsByBatchId, groupStepsByStepIndex } from "@/lib/step-service";
import type { DocumentMetadata } from "@/lib/supabase-client";
import type { SimilarityConnection, Solution } from "@/lib/types";
import { useCallback, useState } from "react";

type BatchInfo = {
  batch_id: string;
  step_count: number;
  latest_created_at: string;
};

export function useBatchManager(mapDecisionToSolutionType: (decision: string) => "accepted" | "secondary" | "rejected") {
  const [availableBatches, setAvailableBatches] = useState<BatchInfo[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [isLoadingBatch, setIsLoadingBatch] = useState<boolean>(false);

  // Group solutions by step index with validation
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

        // Add solution to the appropriate step group with a guaranteed unique ID
        const solutionCopy = {
          ...solution,
          id: solution.id || `generated-${solution.stepIndex}-${solution.batchId || ""}-${solution.title.replace(/\s+/g, "-")}`,
        };

        groupedByStep[solution.stepIndex].push(solutionCopy);
      }
    });

    // Sort solutions within each step
    Object.keys(groupedByStep).forEach((stepKey) => {
      const stepIndex = parseInt(stepKey);

      // Deduplicate solutions by ID
      const uniqueSolutions = groupedByStep[stepIndex].reduce(
        (unique: Solution[], item: Solution) => {
          // Check if we already have this item by ID
          const exists = unique.some((u) => u.id === item.id);
          if (!exists) {
            unique.push(item);
          }
          return unique;
        },
        []
      );

      // Sort solutions by decision type for display grouping
      groupedByStep[stepIndex] = uniqueSolutions.sort((a, b) => {
        // Sort by type (accepted, secondary, rejected) to group them visually
        const typeOrder: Record<string, number> = { accepted: 0, secondary: 1, rejected: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      });
    });

    return groupedByStep;
  }, []);

  // Ensure all solution types are represented in each step
  const ensureAllSolutionTypesInSteps = useCallback(
    (
      groupedByStep: Record<number, Solution[]>,
      allSolutions: Solution[],
      includeAllDecisionTypes: boolean = true
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
          (s) => s.stepIndex === stepIndex
        );
        const recommendedSolutions = stepIndexSolutions.filter(
          (s) => s.type === "accepted"
        );
        const viableSolutions = stepIndexSolutions.filter(
          (s) => s.type === "secondary"
        );
        const problematicSolutions = stepIndexSolutions.filter(
          (s) => s.type === "rejected"
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

        // Add more RECOMMENDED solutions with higher priority (up to 10)
        const additionalRecommended = recommendedSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalRecommended.length > 0) {
          additionalRecommended.forEach((s) => existingIds.add(s.id));
          newSolutions.push(...additionalRecommended);
        }

        // Add more PROBLEMATIC solutions with next priority (up to 10)
        const additionalProblematic = problematicSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalProblematic.length > 0) {
          additionalProblematic.forEach((s) => existingIds.add(s.id));
          newSolutions.push(...additionalProblematic);
        }

        // Add more VIABLE solutions (up to 10)
        const additionalViable = viableSolutions
          .filter((s) => !existingIds.has(s.id))
          .slice(0, 10);

        if (additionalViable.length > 0) {
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
      });

      return result;
    },
    []
  );

  // Fetch available batches
  const fetchAvailableBatches = useCallback(async () => {
    try {
      const batches = await getAvailableBatches();
      setAvailableBatches(batches);

      // Force selectedBatchId to empty string to ensure placeholder is shown
      setSelectedBatchId("");
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  }, []);

  // Load documents by batch ID
  const loadDocumentsByBatchId = useCallback(
    async (batchId: string, includeAllDecisionTypes: boolean = true) => {
      setIsLoadingBatch(true);

      try {
        console.log(`Starting to load documents for batch ID: ${batchId}`);

        // First, try to load steps from the steps table
        const steps = await getStepsByBatchId(batchId);

        if (steps.length > 0) {
          console.log(
            `Found ${steps.length} steps for batch ID: ${batchId} in steps table`
          );

          // Group steps by step index
          const grouped = groupStepsByStepIndex(steps);

          // Update the connections based on level information from steps
          const stepsWithLevels = steps.map((step) => ({
            id: step.id,
            level: step.level,
            stepIndex: step.step_index,
            runId: step.run_id,
            type: step.step_data.type as "accepted" | "secondary" | "rejected",
            decision: step.decision_value,
          }));

          // Generate connections based on level and run_id for continuity
          const newConnections: SimilarityConnection[] = [];

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
                (s) => s.runId === currentStep.runId
              );

              // If none found, connect to steps of same type
              if (nextLevelSteps.length === 0) {
                nextLevelSteps = stepsByLevel[nextLevel].filter(
                  (s) => s.type === currentStep.type
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
                  level: level,
                  color,
                });
              });
            });
          });

          return {
            groupedSteps: grouped as { [stepIndex: number]: Solution[] },
            similarityConnections: newConnections,
            batchId
          };
        }

        // If no steps found, fall back to loading from documents table
        console.log(
          "No steps found in steps table, falling back to documents table"
        );
        const documents = await getDocumentsByBatchId(batchId);

        if (documents.length === 0) {
          console.log("No documents found for batch ID:", batchId);
          return { groupedSteps: {}, similarityConnections: [], batchId };
        }

        console.log(
          `Found ${documents.length} documents for batch ID: ${batchId}`
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

          return {
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
        });

        // Group solutions by step index
        const grouped = groupSolutionsByStepIndex(solutions);

        // Ensure each step has at least one of each solution type (if available in the dataset)
        const enhancedGrouped = ensureAllSolutionTypesInSteps(
          grouped,
          solutions,
          includeAllDecisionTypes
        );

        return {
          groupedSteps: enhancedGrouped,
          similarityConnections: [], // Empty for document-based loading
          batchId
        };
      } catch (error) {
        console.error("Error loading documents by batch ID:", error);
        return { groupedSteps: {}, similarityConnections: [], batchId };
      } finally {
        setIsLoadingBatch(false);
      }
    },
    [groupSolutionsByStepIndex, ensureAllSolutionTypesInSteps, mapDecisionToSolutionType]
  );

  // Handle batch selection
  const selectBatch = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
  }, []);

  // Load the currently selected batch
  const loadSelectedBatch = useCallback(async (includeAllDecisionTypes: boolean = true) => {
    if (!selectedBatchId) return null;

    setCurrentBatchId(selectedBatchId);
    return await loadDocumentsByBatchId(selectedBatchId, includeAllDecisionTypes);
  }, [selectedBatchId, loadDocumentsByBatchId]);

  return {
    availableBatches,
    selectedBatchId,
    currentBatchId,
    isLoadingBatch,
    fetchAvailableBatches,
    loadDocumentsByBatchId,
    selectBatch,
    loadSelectedBatch,
    setCurrentBatchId,
    groupSolutionsByStepIndex,
    ensureAllSolutionTypesInSteps
  };
}