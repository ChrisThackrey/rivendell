"use client";

import { useEffect, useRef, useState } from "react";
import PathLine from "@/components/path-line";
import { Solution } from "@/components/step-carousel";

type Connection = {
  from: string;
  to: string;
  type: "accepted" | "secondary" | "rejected";
  level: number;
  color: string;
};

type StepConnectionManagerProps = {
  visibleSolutionsByStep: Record<number, Solution[]>;
  lineKey: number;
  onHover?: (fromId: string, toId: string, isHovering: boolean) => void;
  highlightedConnections?: Set<string>;
  similarityConnections?: {
    from: string;
    to: string;
    type: "accepted" | "secondary" | "rejected";
    color: string;
  }[];
  showConnections?: boolean;
};

export default function StepConnectionManager({
  visibleSolutionsByStep,
  lineKey,
  onHover,
  highlightedConnections = new Set(),
  similarityConnections = [],
  showConnections = true,
}: StepConnectionManagerProps) {
  // Use a ref instead of state to avoid render loops
  const connectionsRef = useRef<Connection[]>([]);

  // Function to determine if a connection should be highlighted
  const isConnectionHighlighted = (fromId: string, toId: string): boolean => {
    return highlightedConnections.has(`${fromId}-${toId}`);
  };

  // We need to force a re-render when the connections ref changes
  const [, forceRender] = useState<Record<string, never>>({});

  // Create a stable display object from the connections ref
  const connections = connectionsRef.current;

  // Add a helper function to check if a step index is a final solution step
  const isFinalSolutionStep = (stepIndex: number): boolean => {
    return stepIndex === 6; // Step index 6 corresponds to "Final Output"
  };

  // Use a memo to compute connections efficiently
  useEffect(() => {
    // Skip DOM operations during SSR
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    // Prevent multiple recalculations by using debounce
    let animationFrame: number | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    // Function to calculate connections efficiently
    const calculateConnections = () => {
      // Clear any existing timers or animation frames
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      // Use a debounce to avoid rapid recalculations
      debounceTimer = setTimeout(() => {
        // Schedule the actual calculation in animation frame for better performance
        animationFrame = requestAnimationFrame(() => {
          // Get stable step indices
          const stepIndices = Object.keys(visibleSolutionsByStep)
            .map(Number)
            .filter((index) => index > 0) // Ensure valid step indices only
            .sort();

          // Exit early if no steps or just one step
          if (stepIndices.length <= 1) {
            connectionsRef.current = [];
            forceRender({});
            return;
          }

          // Create new connections array
          const newConnections: Connection[] = [];

          // Track processed connections to avoid duplicates
          const processedConnections = new Set<string>();

          // Track connections by target ID to limit incoming connections
          const connectionsPerTarget = new Map<
            string,
            {
              sources: Array<{
                id: string;
                element: HTMLElement;
                type: "accepted" | "secondary" | "rejected";
                left: number;
              }>;
              target: {
                id: string;
                element: HTMLElement;
                type: "accepted" | "secondary" | "rejected";
              };
            }
          >();

          // Track which cards already have input connections
          const cardsWithInputs = new Set<string>();

          // Track the number of input connections for each card
          const inputConnectionCount = new Map<string, number>();

          // Track 'PROBLEMATIC' cards to prevent chains
          const problematicSources = new Set<string>();

          // Reset tracking for Final Output cards
          const resetFinalOutputTracking = () => {
            // Clear existing tracking data
            cardsWithInputs.clear();
            processedConnections.clear();
            inputConnectionCount.clear();

            // Pre-check Final Output cards and mark any that have visible path line connections
            // This helps prevent reconnecting to cards that already have lines
            if (visibleSolutionsByStep[6]) {
              const finalOutputCards = visibleSolutionsByStep[6];

              finalOutputCards.forEach((finalCard) => {
                // Check for any visible connection lines pointing to this Final Output card
                const incomingConnections = document.querySelectorAll(
                  `[data-to-id="${finalCard.id}"]`,
                );
                if (incomingConnections.length > 0) {
                  console.log(
                    `Final Output card ${finalCard.id} already has ${incomingConnections.length} visible connections - marking as having inputs`,
                  );
                  cardsWithInputs.add(finalCard.id);
                  inputConnectionCount.set(
                    finalCard.id,
                    incomingConnections.length,
                  );

                  // If this card already has 2 or more connections, ensure we don't add more
                  if (incomingConnections.length >= 2) {
                    console.log(
                      `Final Output card ${finalCard.id} already has maximum connections (${incomingConnections.length}) - enforcing limit`,
                    );
                  }
                }
              });
            }
          };

          // Call the reset function to ensure clean tracking
          resetFinalOutputTracking();

          // Process each step index sequentially
          for (let i = 0; i < stepIndices.length - 1; i++) {
            const currentStepIndex = stepIndices[i];
            const nextStepIndex = stepIndices[i + 1];

            // Get solutions for the current and next step
            const currentStepSolutions =
              visibleSolutionsByStep[currentStepIndex] || [];
            const nextStepSolutions =
              visibleSolutionsByStep[nextStepIndex] || [];

            if (
              currentStepSolutions.length === 0 ||
              nextStepSolutions.length === 0
            )
              continue;

            // Check if next step is the Final Output step
            const isNextStepFinal = isFinalSolutionStep(nextStepIndex);

            // Process solutions in specific order: RECOMMENDED first, then VIABLE, then PROBLEMATIC
            const orderedSolutions = [
              ...currentStepSolutions.filter((s) => s.type === "accepted"),
              ...currentStepSolutions.filter((s) => s.type === "secondary"),
              ...currentStepSolutions.filter((s) => s.type === "rejected"),
            ];

            // Helper function to sort targets by leftmost position
            const sortByLeftPosition = (solutions: Solution[]) => {
              return [...solutions].sort((a, b) => {
                const elemA = document.getElementById(a.id);
                const elemB = document.getElementById(b.id);
                if (!elemA || !elemB) return 0;
                return (
                  elemA.getBoundingClientRect().left -
                  elemB.getBoundingClientRect().left
                );
              });
            };

            // Helper function to sort targets by total score (if available)
            const sortByTotalScore = (solutions: Solution[]) => {
              return [...solutions].sort((a, b) => {
                // Get scores from metadata if available
                const scoresA = a.embeddings?.metadata?.scores || {};
                const scoresB = b.embeddings?.metadata?.scores || {};

                // Calculate total scores - sum of all score values
                const totalA = Object.values(scoresA).reduce(
                  (sum: number, score: any) =>
                    sum + (typeof score === "number" ? score : 0),
                  0,
                );
                const totalB = Object.values(scoresB).reduce(
                  (sum: number, score: any) =>
                    sum + (typeof score === "number" ? score : 0),
                  0,
                );

                // Sort by higher score first
                return totalB - totalA;
              });
            };

            // If next step has solutions, try to connect current solutions to them
            if (nextStepSolutions.length > 0) {
              // Track cards that have output connections in current step
              const cardsWithOutputs = new Set<string>();

              // For each solution in the current step (in priority order)
              orderedSolutions.forEach((currentSolution) => {
                // Skip PROBLEMATIC cards that have input from another PROBLEMATIC card
                if (
                  currentSolution.type === "rejected" &&
                  problematicSources.has(currentSolution.id)
                ) {
                  console.log(
                    `Skipping PROBLEMATIC solution ${currentSolution.id} - already has PROBLEMATIC input`,
                  );
                  return;
                }

                // Find potential targets based on decision type
                let potentialTargets: Solution[] = [];
                let maxConnections = 1; // Default max connections

                // Group targets by type
                const targetsByType = {
                  accepted: nextStepSolutions.filter(
                    (s) => s.type === "accepted",
                  ),
                  secondary: nextStepSolutions.filter(
                    (s) => s.type === "secondary",
                  ),
                  rejected: nextStepSolutions.filter(
                    (s) => s.type === "rejected",
                  ),
                };

                // Filter out Final Output targets that already have 2 inputs
                if (isNextStepFinal) {
                  // Filter target options to only include final cards with less than 2 inputs
                  Object.keys(targetsByType).forEach((type) => {
                    const key = type as "accepted" | "secondary" | "rejected";
                    targetsByType[key] = targetsByType[key].filter(
                      (solution) => {
                        const inputCount =
                          inputConnectionCount.get(solution.id) || 0;
                        return inputCount < 2; // Final Output cards can only have 2 inputs maximum
                      },
                    );
                  });

                  // Log how many available final output cards are left after filtering
                  console.log(
                    `Final Output cards available for connection: RECOMMENDED=${targetsByType.accepted.length}, VIABLE=${targetsByType.secondary.length}, PROBLEMATIC=${targetsByType.rejected.length}`,
                  );
                }

                // Target prioritization based on source type
                if (currentSolution.type === "accepted") {
                  // RECOMMENDED cards: prioritize connecting to VIABLE cards one level higher
                  maxConnections = 2; // RECOMMENDED cards get up to 2 connections

                  // First try to connect to VIABLE cards with no inputs
                  const viableWithoutInputs = targetsByType.secondary.filter(
                    (s) => !cardsWithInputs.has(s.id),
                  );

                  if (viableWithoutInputs.length > 0) {
                    potentialTargets = sortByLeftPosition(
                      viableWithoutInputs,
                    ).slice(0, 2);
                    console.log(
                      `Found ${potentialTargets.length} VIABLE targets without inputs for RECOMMENDED card ${currentSolution.id}`,
                    );
                  }

                  // If no VIABLE without inputs, try same run cards
                  if (potentialTargets.length === 0 && currentSolution.runId) {
                    const sameRunTargets = nextStepSolutions.filter(
                      (s) =>
                        s.runId === currentSolution.runId &&
                        !cardsWithInputs.has(s.id),
                    );

                    if (sameRunTargets.length > 0) {
                      potentialTargets = sameRunTargets;
                    }
                  }

                  // If still no targets, try highest score VIABLE cards (even with inputs)
                  if (potentialTargets.length === 0) {
                    const highestScoreViable = sortByTotalScore(
                      targetsByType.secondary,
                    );
                    if (highestScoreViable.length > 0) {
                      potentialTargets = highestScoreViable.slice(0, 2);
                    }
                  }

                  // If still no viable targets, use RECOMMENDED cards
                  if (
                    potentialTargets.length === 0 &&
                    targetsByType.accepted.length > 0
                  ) {
                    potentialTargets = sortByLeftPosition(
                      targetsByType.accepted.filter(
                        (s) => !cardsWithInputs.has(s.id),
                      ),
                    ).slice(0, 1);
                  }

                  // If still no targets, use all possible targets with type priority
                  if (potentialTargets.length === 0) {
                    potentialTargets = [
                      ...targetsByType.secondary, // Prioritize VIABLE first
                      ...targetsByType.accepted,
                      ...targetsByType.rejected,
                    ];
                  }
                } else if (currentSolution.type === "secondary") {
                  // VIABLE cards: connect to same run first, then highest score VIABLE

                  // First try to connect to same run cards
                  if (currentSolution.runId) {
                    const sameRunTargets = nextStepSolutions.filter(
                      (s) =>
                        s.runId === currentSolution.runId &&
                        !cardsWithInputs.has(s.id),
                    );

                    if (sameRunTargets.length > 0) {
                      potentialTargets = sameRunTargets;
                    }
                  }

                  // If no same run targets, try VIABLE with highest scores
                  if (potentialTargets.length === 0) {
                    const highestScoreViable = sortByTotalScore(
                      targetsByType.secondary,
                    );
                    if (highestScoreViable.length > 0) {
                      potentialTargets = [highestScoreViable[0]]; // Get the highest score VIABLE card
                    }
                  }

                  // If still no targets, use all possible targets with type priority
                  if (potentialTargets.length === 0) {
                    potentialTargets = [
                      ...targetsByType.secondary,
                      ...targetsByType.accepted,
                      ...targetsByType.rejected,
                    ];
                  }
                } else if (currentSolution.type === "rejected") {
                  // PROBLEMATIC cards: follow modified logic to connect to leftmost cards without inputs

                  // First, sort all target solutions by left position (get the leftmost ones first)
                  const allPotentialTargets = [...nextStepSolutions];

                  // Get DOM elements for all nextStepSolutions and calculate their left positions
                  const targetPositions = allPotentialTargets
                    .map((target) => {
                      const elem = document.getElementById(target.id);
                      const left = elem
                        ? elem.getBoundingClientRect().left
                        : Infinity;
                      return { target, left };
                    })
                    .filter((item) => item.left !== Infinity) // Filter out any that don't have valid positions
                    .sort((a, b) => a.left - b.left); // Sort by left position (leftmost first)

                  // First prefer leftmost RECOMMENDED with no inputs
                  const leftmostRecommended = targetPositions
                    .filter(
                      (item) =>
                        item.target.type === "accepted" &&
                        !cardsWithInputs.has(item.target.id),
                    )
                    .map((item) => item.target);

                  // Then prefer leftmost VIABLE with no inputs
                  const leftmostViable = targetPositions
                    .filter(
                      (item) =>
                        item.target.type === "secondary" &&
                        !cardsWithInputs.has(item.target.id),
                    )
                    .map((item) => item.target);

                  // Then leftmost PROBLEMATIC with no inputs
                  const leftmostProblematic = targetPositions
                    .filter(
                      (item) =>
                        item.target.type === "rejected" &&
                        !cardsWithInputs.has(item.target.id),
                    )
                    .map((item) => item.target);

                  // Combine in order of preference - no inputs first
                  potentialTargets = [
                    ...leftmostRecommended,
                    ...leftmostViable,
                    ...leftmostProblematic,
                  ];

                  // If no targets without inputs, repeat with all targets
                  if (potentialTargets.length === 0) {
                    // Same order of preference but including those with inputs
                    const allRecommended = targetPositions
                      .filter((item) => item.target.type === "accepted")
                      .map((item) => item.target);

                    const allViable = targetPositions
                      .filter((item) => item.target.type === "secondary")
                      .map((item) => item.target);

                    const allProblematic = targetPositions
                      .filter((item) => item.target.type === "rejected")
                      .map((item) => item.target);

                    potentialTargets = [
                      ...allRecommended,
                      ...allViable,
                      ...allProblematic,
                    ];
                  }

                  // If still no targets, just use any target on the next level, sorted by left position
                  if (potentialTargets.length === 0) {
                    potentialTargets = targetPositions.map(
                      (item) => item.target,
                    );
                  }

                  // Take just one target - always the first (leftmost) in our preference order
                  potentialTargets = potentialTargets.slice(0, 1);
                }

                // Prioritize targets without existing inputs
                const targetsWithoutInput = potentialTargets.filter(
                  (target) => !cardsWithInputs.has(target.id),
                );

                // Use targets without inputs if available, otherwise use any valid target
                const finalTargets =
                  targetsWithoutInput.length > 0
                    ? targetsWithoutInput
                    : potentialTargets;

                // Limit targets based on max connections
                const limitedTargets = finalTargets.slice(0, maxConnections);

                // Check if we have any targets
                if (limitedTargets.length === 0) return;

                // Process each target solution for connection
                limitedTargets.forEach((nextSolution) => {
                  // Create a unique connection ID to avoid duplicates
                  const connectionId = `${currentSolution.id}-${nextSolution.id}`;

                  // Skip if already processed
                  if (processedConnections.has(connectionId)) return;

                  // Get DOM elements
                  const fromElement = document.getElementById(
                    currentSolution.id,
                  );
                  const toElement = document.getElementById(nextSolution.id);

                  if (!fromElement || !toElement) return;

                  // Check if we're at the input limit for a Final Output card
                  if (isNextStepFinal) {
                    const currentInputCount =
                      inputConnectionCount.get(nextSolution.id) || 0;

                    // Hard limit at 2 connections for Final Output cards, no exceptions
                    if (currentInputCount >= 2) {
                      console.log(
                        `Skipping connection to Final Output card ${nextSolution.id} - already has ${currentInputCount} inputs (max: 2)`,
                      );
                      return; // Skip this connection
                    }

                    // Also check if this card already has a processed connection from another source
                    // This helps prevent the race condition where multiple connections are added simultaneously
                    const existingConnectionToTarget = [
                      ...processedConnections,
                    ].some(
                      (connId) =>
                        connId.endsWith(`-${nextSolution.id}`) &&
                        !connId.startsWith(`${currentSolution.id}-`),
                    );

                    if (existingConnectionToTarget && currentInputCount >= 1) {
                      console.log(
                        `Skipping redundant connection to Final Output card ${nextSolution.id} - already has a connection and would exceed limit`,
                      );
                      return; // Skip this connection
                    }
                  }

                  // Determine connection type based on source solution
                  const connectionType = currentSolution.type;

                  // Determine color based on source type
                  let color = "#93C5FD"; // Light blue for VIABLE (secondary)
                  if (currentSolution.type === "accepted") {
                    color = "#4ADE80"; // Light green for RECOMMENDED (accepted)
                  } else if (currentSolution.type === "rejected") {
                    color = "#94A3B8"; // Light gray for PROBLEMATIC (rejected)
                  }

                  // Add this connection
                  newConnections.push({
                    from: currentSolution.id,
                    to: nextSolution.id,
                    type: connectionType,
                    level: currentStepIndex,
                    color,
                  });

                  // Mark this connection as processed
                  processedConnections.add(connectionId);

                  // Mark the target as having an input
                  cardsWithInputs.add(nextSolution.id);

                  // Increment the input connection count for the target
                  inputConnectionCount.set(
                    nextSolution.id,
                    (inputConnectionCount.get(nextSolution.id) || 0) + 1,
                  );

                  // Log when connecting to a Final Output card
                  if (isNextStepFinal) {
                    console.log(
                      `Connected to Final Output card ${nextSolution.id} - now has ${inputConnectionCount.get(nextSolution.id)} inputs`,
                    );
                  }

                  // Mark the source as having an output
                  cardsWithOutputs.add(currentSolution.id);

                  // If source is PROBLEMATIC, mark target as potentially part of a PROBLEMATIC chain
                  if (currentSolution.type === "rejected") {
                    problematicSources.add(nextSolution.id);
                  }
                });
              });

              // Process cards without output connections
              orderedSolutions.forEach((currentSolution) => {
                // Skip if already has an output connection
                if (cardsWithOutputs.has(currentSolution.id)) return;

                let potentialTargets: Solution[] = [];
                const maxConnections =
                  currentSolution.type === "accepted" ? 2 : 1;

                // Skip if PROBLEMATIC card has input from another PROBLEMATIC
                if (
                  currentSolution.type === "rejected" &&
                  problematicSources.has(currentSolution.id)
                ) {
                  return;
                }

                console.log(
                  `Finding connections for ${currentSolution.type} card without outputs: ${currentSolution.id}`,
                );

                // Special handling for VIABLE cards without output connections
                if (currentSolution.type === "secondary") {
                  console.log(
                    `VIABLE card ${currentSolution.id} has no output connection, prioritizing cards with no input`,
                  );

                  // Sort all targets by left position first
                  const sortedTargets = sortByLeftPosition(nextStepSolutions);

                  // Prioritize targets without inputs
                  const targetsWithoutInput = sortedTargets.filter(
                    (s) => !cardsWithInputs.has(s.id),
                  );

                  if (targetsWithoutInput.length > 0) {
                    console.log(
                      `Found ${targetsWithoutInput.length} cards without input in next step for VIABLE card ${currentSolution.id}`,
                    );
                    potentialTargets = targetsWithoutInput.slice(0, 1); // Take the leftmost without input
                  } else {
                    // If all cards have inputs, use any leftmost card
                    potentialTargets = sortedTargets.slice(0, 1);
                  }
                } else {
                  // Default behavior for RECOMMENDED and PROBLEMATIC cards
                  // Try to find any viable target that doesn't have an input yet
                  potentialTargets = nextStepSolutions.filter(
                    (s) => !cardsWithInputs.has(s.id),
                  );

                  // If no targets without inputs, try any target
                  if (potentialTargets.length === 0) {
                    potentialTargets = nextStepSolutions;
                  }
                }

                // Log a warning but allow PROBLEMATIC chains
                if (currentSolution.type === "rejected") {
                  // Only log the warning, don't filter out PROBLEMATIC targets
                  const problematicTargets = potentialTargets.filter(
                    (target) => target.type === "rejected",
                  );
                  if (problematicTargets.length > 0) {
                    console.log(
                      `Warning: Allowing ${problematicTargets.length} PROBLEMATIC targets for PROBLEMATIC card ${currentSolution.id}`,
                    );
                  }
                }

                // Limit targets based on max connections
                const limitedTargets = potentialTargets.slice(
                  0,
                  maxConnections,
                );

                // Skip if no valid targets
                if (limitedTargets.length === 0) return;

                // Process each target solution for connection
                limitedTargets.forEach((nextSolution) => {
                  // Create a unique connection ID to avoid duplicates
                  const connectionId = `${currentSolution.id}-${nextSolution.id}`;

                  // Skip if already processed
                  if (processedConnections.has(connectionId)) return;

                  // Get DOM elements
                  const fromElement = document.getElementById(
                    currentSolution.id,
                  );
                  const toElement = document.getElementById(nextSolution.id);

                  if (!fromElement || !toElement) return;

                  // Determine connection type based on source solution
                  const connectionType = currentSolution.type;

                  // Check if we're at the input limit for a Final Output card
                  if (isNextStepFinal) {
                    const currentInputCount =
                      inputConnectionCount.get(nextSolution.id) || 0;

                    // Hard limit at 2 connections for Final Output cards, no exceptions
                    if (currentInputCount >= 2) {
                      console.log(
                        `Skipping fallback connection to Final Output card ${nextSolution.id} - already has ${currentInputCount} inputs (max: 2)`,
                      );
                      return; // Skip this connection
                    }

                    // Also check if this card already has a processed connection from another source
                    // This helps prevent the race condition where multiple connections are added simultaneously
                    const existingConnectionToTarget = [
                      ...processedConnections,
                    ].some(
                      (connId) =>
                        connId.endsWith(`-${nextSolution.id}`) &&
                        !connId.startsWith(`${currentSolution.id}-`),
                    );

                    if (existingConnectionToTarget && currentInputCount >= 1) {
                      console.log(
                        `Skipping redundant fallback connection to Final Output card ${nextSolution.id} - already has a connection and would exceed limit`,
                      );
                      return; // Skip this connection
                    }
                  }

                  // Determine color based on source type
                  let color = "#93C5FD"; // Light blue for VIABLE (secondary)
                  if (currentSolution.type === "accepted") {
                    color = "#4ADE80"; // Light green for RECOMMENDED (accepted)
                  } else if (currentSolution.type === "rejected") {
                    color = "#94A3B8"; // Light gray for PROBLEMATIC (rejected)
                  }

                  // Add this connection
                  newConnections.push({
                    from: currentSolution.id,
                    to: nextSolution.id,
                    type: connectionType,
                    level: currentStepIndex,
                    color,
                  });

                  console.log(
                    `Created fallback connection from ${currentSolution.id} to ${nextSolution.id}`,
                  );

                  // Mark this connection as processed
                  processedConnections.add(connectionId);

                  // Mark the target as having an input
                  cardsWithInputs.add(nextSolution.id);

                  // Increment the input connection count for the target
                  inputConnectionCount.set(
                    nextSolution.id,
                    (inputConnectionCount.get(nextSolution.id) || 0) + 1,
                  );

                  // Log when connecting to a Final Output card
                  if (isNextStepFinal) {
                    console.log(
                      `Connected fallback to Final Output card ${nextSolution.id} - now has ${inputConnectionCount.get(nextSolution.id)} inputs`,
                    );
                  }

                  // If source is PROBLEMATIC, mark target as potentially part of a PROBLEMATIC chain
                  if (currentSolution.type === "rejected") {
                    problematicSources.add(nextSolution.id);
                  }
                });
              });
            }
          }

          // Add similarity connections to the mix
          if (similarityConnections.length > 0) {
            // Convert similarity connections to the Connection type
            const formattedSimilarityConnections = similarityConnections
              .map((conn) => {
                // Verify DOM elements exist before adding the connection
                const fromElement = document.getElementById(conn.from);
                const toElement = document.getElementById(conn.to);

                // Only add if both elements exist
                if (fromElement && toElement) {
                  return {
                    from: conn.from,
                    to: conn.to,
                    type: conn.type,
                    level: 0, // Default level
                    color: conn.color, // Use color from similarity connection
                  };
                }
                return null;
              })
              .filter(Boolean) as Connection[];

            // Add similarity connections to newConnections
            newConnections.push(...formattedSimilarityConnections);

            console.log(
              `Added ${formattedSimilarityConnections.length} similarity connections`,
            );
          }

          // Use hash comparison to check for actual changes
          const connectionsHash = JSON.stringify(
            newConnections.map((c) => `${c.from}-${c.to}-${c.type}`).sort(),
          );
          const currentHash = JSON.stringify(
            connectionsRef.current
              .map((c) => `${c.from}-${c.to}-${c.type}`)
              .sort(),
          );

          // Only update if connections have actually changed
          if (connectionsHash !== currentHash) {
            // Store connections in the ref
            connectionsRef.current = newConnections;

            // Force a re-render with the new connections
            forceRender({});
          }
        });
      }, 200); // Debounce for 200ms
    };

    // Execute calculation
    calculateConnections();

    // Set up resize observer for responsive behavior
    const resizeObserver = new ResizeObserver(() => {
      if (connectionsRef.current.length > 0) {
        calculateConnections();
      }
    });

    // Observe document body for size changes
    resizeObserver.observe(document.body);

    // Clean up on unmount or when dependencies change
    return () => {
      resizeObserver.disconnect();

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [visibleSolutionsByStep, lineKey, similarityConnections]); // Keep lineKey and similarityConnections in dependencies

  return (
    <div
      key={lineKey}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    >
      {showConnections &&
        connections.map((connection, index) => (
          <PathLine
            key={`${connection.from}-${connection.to}-${lineKey}-${index}`}
            fromId={connection.from}
            toId={connection.to}
            type={connection.type}
            delay={0.2 + index * 0.05}
            isHighlighted={isConnectionHighlighted(
              connection.from,
              connection.to,
            )}
            onHover={onHover}
            color={connection.color}
          />
        ))}
    </div>
  );
}
