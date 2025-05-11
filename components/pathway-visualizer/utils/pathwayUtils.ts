import type {
    Connection,
    Solution,
    Step,
} from "../types"; // Solution and Step from local types
import type {
    DecisionType,
    DocumentMetadata,
    ScoreMetrics,
} from "@/lib/supabase-client"; // These types come from supabase-client

export const mapDecisionToSolutionType = (
  decision: DecisionType,
): "accepted" | "secondary" | "rejected" => {
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
};

export const createDocumentMetadata = (
  model: string,
  runtime: string,
  runId: number,
  temperature: number,
  scores: ScoreMetrics,
  decision: DecisionType,
): DocumentMetadata => {
  const costMultiplier =
    model.includes("gpt-4o") ? 0.03
    : model.includes("claude") ? 0.025
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

export const getStepTitle = (stepIndex: number): string => {
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

export const groupSolutionsByStepIndex = (solutions: Solution[]): Record<number, Solution[]> => {
  const groupedByStep: { [stepIndex: number]: Solution[] } = {};

  solutions.forEach((solution) => {
    if (solution.stepIndex && solution.stepIndex > 0) {
      if (!groupedByStep[solution.stepIndex]) {
        groupedByStep[solution.stepIndex] = [];
      }
      const solutionCopy = {
        ...solution,
        id:
          solution.id ||
          `generated-${solution.stepIndex}-${solution.batchId || ""}-${solution.title.replace(/\s+/g, "-")}`,
      };
      groupedByStep[solution.stepIndex].push(solutionCopy);
    }
  });

  Object.keys(groupedByStep).forEach((stepKey) => {
    const stepIndex = parseInt(stepKey);
    const uniqueSolutions = groupedByStep[stepIndex].reduce(
      (unique: Solution[], item: Solution) => {
        const exists = unique.some((u) => u.id === item.id);
        if (!exists) {
          unique.push(item);
        }
        return unique;
      },
      [],
    );
    groupedByStep[stepIndex] = uniqueSolutions.sort((a, b) => {
      const typeOrder = { accepted: 0, secondary: 1, rejected: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
  });

  return groupedByStep;
};

export const ensureAllSolutionTypesInSteps = (
  groupedByStep: Record<number, Solution[]>,
  allSolutions: Solution[],
  includeAllDecisionTypes: boolean, // Added prop as argument
): Record<number, Solution[]> => {
  const result = { ...groupedByStep };
  if (!includeAllDecisionTypes) {
    return result;
  }
  const stepIndices = Object.keys(groupedByStep).map(Number);
  stepIndices.forEach((stepIndex) => {
    const stepSolutions = groupedByStep[stepIndex] || [];
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

    const newSolutions: Solution[] = [...stepSolutions];
    const existingIds = new Set(stepSolutions.map((s) => s.id));

    const additionalRecommended = recommendedSolutions
      .filter((s) => !existingIds.has(s.id))
      .slice(0, 10);
    if (additionalRecommended.length > 0) {
      additionalRecommended.forEach((s) => existingIds.add(s.id));
      newSolutions.push(...additionalRecommended);
    }

    const additionalProblematic = problematicSolutions
      .filter((s) => !existingIds.has(s.id))
      .slice(0, 10);
    if (additionalProblematic.length > 0) {
      additionalProblematic.forEach((s) => existingIds.add(s.id));
      newSolutions.push(...additionalProblematic);
    }

    const additionalViable = viableSolutions
      .filter((s) => !existingIds.has(s.id))
      .slice(0, 10);
    if (additionalViable.length > 0) {
      additionalViable.forEach((s) => existingIds.add(s.id));
      newSolutions.push(...additionalViable);
    }

    const uniqueIds = new Set<string>();
    result[stepIndex] = newSolutions.filter((solution) => {
      if (uniqueIds.has(solution.id)) return false;
      uniqueIds.add(solution.id);
      return true;
    });
  });
  return result;
};

export const createEmptyStepContainers = (): Step[] => { // Ensure Step type is available
  return [
    { id: "step1", title: "Initial Solutions", solutions: [] },
    { id: "step2", title: "Refined Solutions", solutions: [] },
    { id: "step3", title: "Implementation Details", solutions: [] },
    { id: "step4", title: "Final Output Draft", solutions: [] },
    { id: "step5", title: "Final Output", solutions: [] },
  ];
};

export const isFinalStep = (stepId: string): boolean => stepId === "step5";

export const findDirectlyConnectedPaths = (
  fromId: string,
  toId: string,
  // Assuming forwardConnections and backwardConnections are passed or derived from allConnections
  allConnections: Connection[],
): Set<string> => {
  const connectedPairs = new Set<string>();
  connectedPairs.add(`${fromId}-${toId}`);

  // Re-derive forward/backward maps here or expect them as params
  const forwardConnections = new Map<string, string[]>();
  const backwardConnections = new Map<string, string[]>();

  allConnections.forEach((conn) => {
    if (!forwardConnections.has(conn.from)) {
      forwardConnections.set(conn.from, []);
    }
    forwardConnections.get(conn.from)?.push(conn.to);

    if (!backwardConnections.has(conn.to)) {
      backwardConnections.set(conn.to, []);
    }
    backwardConnections.get(conn.to)?.push(conn.to);
  });

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

export const isValidId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return id.length > 8 && id.includes('-');
};

export const validateConnection = (
  fromId: string,
  toId: string
): boolean => {
  if (!isValidId(fromId) || !isValidId(toId)) {
    // console.log(`Skipping invalid connection: Invalid ID format - fromId=${fromId}, toId=${toId}`);
    return false;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const fromElement = document.getElementById(fromId);
  const toElement = document.getElementById(toId);
  if (!fromElement || !toElement) {
    // console.log(`Skipping invalid connection: ${fromId} -> ${toId} (elements don't exist in DOM)`);
    return false;
  }
  return true;
};

export const generateConnectionLinesFromGroupedSteps = (
  groupedSteps: Record<number, Solution[]>,
): (Connection & { color: string })[] => {
  const connections: (Connection & { color: string })[] = [];
  for (let currentStepIndex = 1; currentStepIndex < 6; currentStepIndex++) {
    const currentStepSolutions = groupedSteps[currentStepIndex] || [];
    const nextStepSolutions = groupedSteps[currentStepIndex + 1] || [];
    currentStepSolutions.forEach((currentSolution) => {
      const matchingNextSolutions = nextStepSolutions.filter(
        (nextSolution) => nextSolution.runId === currentSolution.runId,
      );
      if (matchingNextSolutions.length > 0) {
        const nextSolution = matchingNextSolutions[0];
        let connectionType: "accepted" | "secondary" | "rejected" = "secondary";
        let color = "#3B82F6";
        if (currentSolution.type === "accepted") {
          connectionType = "accepted";
          color = "#22C55E";
        } else if (currentSolution.type === "rejected") {
          connectionType = "rejected";
          color = "#F97316";
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

  const connectionsWithValidIds = connections.filter(
    (conn) => isValidId(conn.from) && isValidId(conn.to)
  );

  const validConnections = connectionsWithValidIds.filter((conn) =>
    validateConnection(conn.from, conn.to)
  );

  return validConnections;
};

export const createEmptyStepStructures = (): Step[] => {
  // First level of steps - initial approaches
  const step1: Step = {
    id: "step1",
    title: "Initial Solutions",
    solutions: [
      {
        id: "s1", title: "Initial Approach 1", description: "Placeholder description for approach 1", type: "rejected", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 1,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s2", title: "Initial Approach 2", description: "Placeholder description for approach 2", type: "accepted", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 1,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s3", title: "Initial Approach 3", description: "Placeholder description for approach 3", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 1,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s4", title: "Initial Approach 4", description: "Placeholder description for approach 4", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 1,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
    ],
  };
  const step2: Step = {
    id: "step2", title: "Refined Solutions", solutions: [
      {
        id: "s6", title: "Refined Approach 1", description: "Placeholder for refined solution 1", type: "accepted", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 2,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s5", title: "Refined Approach 2", description: "Placeholder for refined solution 2", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 2,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s8", title: "Refined Approach 3", description: "Placeholder for refined solution 3", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 2,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s7", title: "Refined Approach 4", description: "Placeholder for refined solution 4", type: "rejected", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 2,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
    ],
  };
  const step3: Step = {
    id: "step3", title: "Implementation Details", solutions: [
      {
        id: "s10", title: "Implementation Detail 1", description: "Placeholder for implementation details 1", type: "accepted", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 3,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s9", title: "Implementation Detail 2", description: "Placeholder for implementation details 2", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 3,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s11", title: "Implementation Detail 3", description: "Placeholder for implementation details 3", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 3,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
    ],
  };
  const step4: Step = {
    id: "step4", title: "Final Solutions", solutions: [
      {
        id: "s12", title: "Final Solution 1", description: "Placeholder for final solution 1", type: "accepted", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 4,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s13", title: "Final Solution 2", description: "Placeholder for final solution 2", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 4,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s15", title: "Final Solution 3", description: "Placeholder for final solution 3", type: "secondary", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 4,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
      {
        id: "s14", title: "Final Solution 4", description: "Placeholder for final solution 4", type: "rejected", model: "",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 }, 
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 4,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
    ],
  };
  const step5: Step = {
    id: "step5", title: "Final Outcome", solutions: [
      {
        id: "s16", title: "Combined Solution", description: "Placeholder for the combined final solution", type: "accepted", model: "Combined",
        metrics: { executionTime: "0s", complexity: "O(n)", memoryUsage: "0MB", lineCount: 0, codeQuality: 0 },
        frequency: { count: 0, models: [] },
        runId: 0,
        stepIndex: 5,
        batchId: "placeholder",
        embeddings: { documentId: null, metadata: {} }
      },
    ],
  };
  return [step1, step2, step3, step4, step5];
};