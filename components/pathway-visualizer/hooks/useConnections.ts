import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_CONNECTIONS_DATA } from "../constants/pathwayConstants";
import type { Step } from "../types";
import type { Connection, SimilarityConnection } from "@/lib/types";
import {
    findDirectlyConnectedPaths as findDirectlyConnectedPathsUtil,
} from "../utils/pathwayUtils";
// We might need searchSimilarDocuments from embedding-service if that logic moves here
// import { searchSimilarDocuments } from "@/lib/embedding-service";

export interface ConnectionsReturn {
  highlightedConnections: Set<string>;
  similarityConnections: SimilarityConnection[];
  visibleConnections: Connection[]; // Connections based on ALL_CONNECTIONS_DATA and visible steps
  handleLineHover: (fromId: string, toId: string, isHovering: boolean) => void;
  isConnectionHighlighted: (fromId: string, toId: string) => boolean;
  getVisibleConnectionsForSteps: (visibleSteps: Step[]) => void; // This will set internal state
  findAndSetSimilarityConnections: (currentSteps: Step[], currentBatchId: string | null) => Promise<void>;
}

export function useConnections(initialSteps: Step[]): ConnectionsReturn {
  const [highlightedConnections, setHighlightedConnections] = useState<Set<string>>(new Set());
  const [similarityConnections, setSimilarityConnections] = useState<SimilarityConnection[]>([]);
  const [visibleConnections, setVisibleConnections] = useState<Connection[]>([]);

  // Memoize forward/backward maps from ALL_CONNECTIONS_DATA
  const { forwardConnections, backwardConnections } = useMemo(() => {
    const fwd = new Map<string, string[]>();
    const bwd = new Map<string, string[]>();
    ALL_CONNECTIONS_DATA.forEach((conn) => {
      if (!fwd.has(conn.from)) fwd.set(conn.from, []);
      fwd.get(conn.from)?.push(conn.to);
      if (!bwd.has(conn.to)) bwd.set(conn.to, []);
      bwd.get(conn.to)?.push(conn.from);
    });
    return { forwardConnections: fwd, backwardConnections: bwd };
  }, []);

  const handleLineHover = useCallback((fromId: string, toId: string, isHovering: boolean) => {
    if (isHovering) {
      // Use the memoized maps if findDirectlyConnectedPathsUtil is adapted or logic moved here
      const connectedPaths = findDirectlyConnectedPathsUtil(fromId, toId, ALL_CONNECTIONS_DATA);
      setHighlightedConnections(connectedPaths);
    } else {
      setHighlightedConnections(new Set());
    }
  }, [ALL_CONNECTIONS_DATA]); // findDirectlyConnectedPathsUtil dependency might make this complex if it's not pure regarding maps

  const isConnectionHighlighted = useCallback((fromId: string, toId: string): boolean => {
    return highlightedConnections.has(`${fromId}-${toId}`);
  }, [highlightedConnections]);

  const getVisibleConnectionsForSteps = useCallback((currentVisibleSteps: Step[]) => {
    if (currentVisibleSteps.length <= 1) {
      setVisibleConnections(ALL_CONNECTIONS_DATA.filter((conn) => (conn.level ?? 0) === 0));
      return;
    }
    const lastVisibleStepIndex = currentVisibleSteps.length - 1;
    setVisibleConnections(ALL_CONNECTIONS_DATA.filter((conn) => (conn.level ?? 0) <= lastVisibleStepIndex));
  }, [ALL_CONNECTIONS_DATA]);

  // Simplified findAndSetSimilarityConnections, actual DOM logic is tricky here
  // This hook will primarily manage the state of similarityConnections
  // The complex logic of findSimilarSolutionsAcrossSteps (especially DOM parts) is hard to fit purely in a hook
  // For now, this function will just be a placeholder or expect pre-calculated connections
  const findAndSetSimilarityConnections = useCallback(async (currentSteps: Step[], currentBatchId: string | null) => {
    // The original findSimilarSolutionsAcrossStepsLocal has DOM dependencies and complex logic.
    // A true refactor would abstract the DOM interactions or change the approach.
    // For this hook, we might expect the calling component to compute these and pass them,
    // or this function becomes very complex / takes many dependencies.
    // For now, let's assume it will eventually call a service or more abstracted utils.
    // eslint-disable-next-line no-console
    console.log("Placeholder: findAndSetSimilarityConnections called with steps:", currentSteps.length, "batch:", currentBatchId);
    // This is where the logic from findSimilarSolutionsAcrossStepsLocal would go,
    // ideally refactored to be less DOM-dependent or accept DOM-querying functions as parameters.
    // For simplicity in this step, it won't replicate the full original function yet.
    // setSimilarityConnections(calculatedConnections);
    return Promise.resolve();
  }, []);

  // Initialize visible connections based on initial steps
  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      getVisibleConnectionsForSteps(initialSteps);
    }
  }, [initialSteps, getVisibleConnectionsForSteps]);

  return {
    highlightedConnections,
    similarityConnections, // This would be set by findAndSetSimilarityConnections
    visibleConnections,    // Set by getVisibleConnectionsForSteps
    handleLineHover,
    isConnectionHighlighted,
    getVisibleConnectionsForSteps,
    findAndSetSimilarityConnections,
    // setVisibleConnections // Expose if component needs to override
  };
}