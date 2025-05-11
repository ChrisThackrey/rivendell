import type { Connection, SimilarityConnection, Solution, Step } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";

export function useConnectionManager() {
  const [visibleConnections, setVisibleConnections] = useState<Connection[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [showOptimizedPath, setShowOptimizedPath] = useState(false);
  const [highlightedConnections, setHighlightedConnections] = useState<Set<string>>(new Set());
  const [similarityConnections, setSimilarityConnections] = useState<SimilarityConnection[]>([]);
  const [lineKey, setLineKey] = useState(0);

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
    []
  );

  // Build connection maps for forward and backward connections
  const forwardConnections = useMemo(() => {
    const map = new Map<string, string[]>();
    allConnections.forEach((conn) => {
      // Forward connections (from -> to)
      if (!map.has(conn.from)) {
        map.set(conn.from, []);
      }
      map.get(conn.from)?.push(conn.to);
    });
    return map;
  }, [allConnections]);

  const backwardConnections = useMemo(() => {
    const map = new Map<string, string[]>();
    allConnections.forEach((conn) => {
      // Backward connections (to -> from)
      if (!map.has(conn.to)) {
        map.set(conn.to, []);
      }
      map.get(conn.to)?.push(conn.from);
    });
    return map;
  }, [allConnections]);

  // Function to find directly connected paths (forward and backward from the hovered connection)
  const findDirectlyConnectedPaths = useCallback((fromId: string, toId: string): Set<string> => {
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
  }, [forwardConnections, backwardConnections]);

  // Handle line hover event
  const handleLineHover = useCallback((fromId: string, toId: string, isHovering: boolean) => {
    if (isHovering) {
      // Find directly connected paths
      const connectedPaths = findDirectlyConnectedPaths(fromId, toId);
      setHighlightedConnections(connectedPaths);
    } else {
      setHighlightedConnections(new Set());
    }
  }, [findDirectlyConnectedPaths]);

  // Check if a connection should be highlighted
  const isConnectionHighlighted = useCallback((fromId: string, toId: string): boolean => {
    return highlightedConnections.has(`${fromId}-${toId}`);
  }, [highlightedConnections]);

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
        (conn) => conn.level <= lastVisibleStepIndex
      );
    },
    [allConnections]
  );

  // Utility function for validating IDs
  const isValidId = useCallback((id: string | null | undefined): boolean => {
    if (!id) return false;
    // Basic check for UUID format
    return id.length > 8 && id.includes('-');
  }, []);

  // Validate connection elements in DOM
  const validateConnection = useCallback((fromId: string, toId: string): boolean => {
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
  }, [isValidId]);

  // Generate connections from grouped steps
  const generateConnectionLinesFromGroupedSteps = useCallback((groupedSteps: Record<number, Solution[]>): SimilarityConnection[] => {
    const connections: SimilarityConnection[] = [];

    // Loop through all step indices except the last one (6)
    for (let currentStepIndex = 1; currentStepIndex < 6; currentStepIndex++) {
      const currentStepSolutions = groupedSteps[currentStepIndex] || [];
      const nextStepSolutions = groupedSteps[currentStepIndex + 1] || [];

      // For each solution in the current step
      currentStepSolutions.forEach((currentSolution) => {
        // Find matching solutions in the next step with the same runId
        const matchingNextSolutions = nextStepSolutions.filter(
          (nextSolution) => nextSolution.runId === currentSolution.runId
        );

        // If there's a matching solution, create a connection
        if (matchingNextSolutions.length > 0) {
          // Use the first matching solution
          const nextSolution = matchingNextSolutions[0];

          // Determine connection type based on decision value from current step
          let connectionType: "accepted" | "secondary" | "rejected" = "secondary";
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
  }, [isValidId, validateConnection]);

  return {
    visibleConnections,
    setVisibleConnections,
    currentLevel,
    setCurrentLevel,
    showOptimizedPath,
    setShowOptimizedPath,
    highlightedConnections,
    setHighlightedConnections,
    similarityConnections,
    setSimilarityConnections,
    lineKey,
    setLineKey,
    allConnections,
    handleLineHover,
    isConnectionHighlighted,
    getVisibleConnectionsForSteps,
    isValidId,
    validateConnection,
    generateConnectionLinesFromGroupedSteps
  };
}