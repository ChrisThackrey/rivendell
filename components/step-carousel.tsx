"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import SolutionCard from "@/components/solution-card";
import { type CodeFile } from "@/lib/supabase-client";
// import { cn } from "@/lib/utils" - unused import

export type Solution = {
  id: string;
  title: string;
  description: string;
  type: "accepted" | "secondary" | "rejected";
  model?: string;
  metrics?: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality?: number;
  };
  frequency?: {
    count: number;
    models: string[];
  };
  runId?: number;
  stepIndex?: number;
  batchId?: string;
  embeddings?: {
    documentId: string | null;
    metadata: Record<string, unknown>;
  };
  codeFiles?: CodeFile[];
  fileTree?: string; // Add fileTree property to Solution type
};

type StepCarouselProps = {
  solutions: Solution[];
  itemsPerPage?: number;
  title: string;
  onPageChange?: (visibleSolutions: Solution[]) => void;
};

export default function StepCarousel({
  solutions,
  itemsPerPage = 25, // Increased from 15 to 25
  title,
  onPageChange,
  carouselPage = 0,
  totalPages = 1,
}: StepCarouselProps & { carouselPage?: number; totalPages?: number }) {
  // Ensure we have a balanced representation of all solution types
  const balancedSolutions = useMemo(() => {
    // First, filter out automatically generated or reconstructed solutions
    // These should typically be considered as lower quality
    const filteredSolutions = solutions.filter((s) => {
      // Check for automatically generated or reconstructed content markers
      const isAutomaticallyGenerated =
        s.description.includes("automatically generated") ||
        s.description.includes("reconstructed") ||
        s.title.includes("Fallback Implementation") ||
        s.title.includes("Reconstructed Solution");

      // If it's an automatically generated solution, override its type to "rejected"
      // This ensures these low-quality solutions don't appear as recommended or viable
      if (isAutomaticallyGenerated && s.type !== "rejected") {
        console.log(
          `Re-scoring automatically generated/reconstructed solution as rejected: ${s.title}`,
        );
        s.type = "rejected";
      }

      return true; // Keep all solutions but with adjusted scores
    });

    // Group solutions by type
    const recommended = filteredSolutions.filter((s) => s.type === "accepted");
    const viable = filteredSolutions.filter((s) => s.type === "secondary");
    const problematic = filteredSolutions.filter((s) => s.type === "rejected");

    console.log(`StepCarousel ${title} received:`, {
      recommended: recommended.length,
      viable: viable.length,
      problematic: problematic.length,
      total: filteredSolutions.length,
      automaticallyGenerated: solutions.length - filteredSolutions.length,
    });

    // Increase minimum counts for each type to ensure better representation
    const minRecommended = Math.min(recommended.length, 15); // Increased from 10
    const minProblematic = Math.min(problematic.length, 10); // Reduced from 15 to show fewer problematic solutions
    const minViable = Math.min(viable.length, 15); // Increased from 10

    // Calculate how many slots we have left after including minimum counts
    const usedSlots = minRecommended + minProblematic + minViable;
    const remainingSlots = Math.max(0, itemsPerPage - usedSlots);

    // Distribute remaining slots proportionally across types
    // Give higher priority to RECOMMENDED solutions (previously it was split with PROBLEMATIC)
    let additionalRecommended = 0;
    let additionalProblematic = 0;
    let additionalViable = 0;

    if (remainingSlots > 0) {
      // First, allocate more slots to RECOMMENDED if available (higher priority now)
      const extraForRecommended = Math.floor(remainingSlots * 0.6); // 60% for recommended (increased from 50%)
      const extraForOthers = remainingSlots - extraForRecommended;

      // Add more RECOMMENDED solutions first (higher allocation)
      additionalRecommended = Math.min(
        recommended.length - minRecommended,
        extraForRecommended,
      );

      // Split remaining slots between PROBLEMATIC and VIABLE
      // Allocate more to VIABLE (70%) and less to PROBLEMATIC (30%)
      const extraForViable = Math.floor(extraForOthers * 0.7);
      const extraForProblematic = extraForOthers - extraForViable;

      // Then add more VIABLE solutions (higher priority than PROBLEMATIC)
      additionalViable = Math.min(viable.length - minViable, extraForViable);

      // Then add more PROBLEMATIC solutions (lowest priority)
      additionalProblematic = Math.min(
        problematic.length - minProblematic,
        extraForProblematic,
      );

      // Redistribute any unused slots to RECOMMENDED and VIABLE
      const unusedSlots =
        extraForRecommended -
        additionalRecommended +
        (extraForProblematic - additionalProblematic) +
        (extraForViable - additionalViable);

      if (unusedSlots > 0) {
        // Try to add more RECOMMENDED solutions first
        const extraRecommended = Math.min(
          recommended.length - (minRecommended + additionalRecommended),
          unusedSlots,
        );
        additionalRecommended += extraRecommended;

        // Then try to add more VIABLE solutions with any remaining slots
        const remainingUnusedSlots = unusedSlots - extraRecommended;
        if (remainingUnusedSlots > 0) {
          additionalViable += Math.min(
            viable.length - (minViable + additionalViable),
            remainingUnusedSlots,
          );
        }
      }
    }

    // Create final balanced array
    const totalRecommended = minRecommended + additionalRecommended;
    const totalProblematic = minProblematic + additionalProblematic;
    const totalViable = minViable + additionalViable;

    console.log(`StepCarousel ${title} displaying:`, {
      recommended: totalRecommended,
      viable: totalViable,
      problematic: totalProblematic,
      total: totalRecommended + totalProblematic + totalViable,
    });

    // Sort solutions within each type to prioritize higher quality solutions
    // This ensures higher quality solutions appear first within their category

    // For RECOMMENDED, sort by metrics.codeQuality if available (higher first)
    const sortedRecommended = recommended
      .sort((a, b) => {
        // First prioritize solutions that are not automatically generated/reconstructed
        const aIsAuto =
          a.description.includes("automatically generated") ||
          a.description.includes("reconstructed");
        const bIsAuto =
          b.description.includes("automatically generated") ||
          b.description.includes("reconstructed");
        if (aIsAuto !== bIsAuto) return aIsAuto ? 1 : -1;

        // Then sort by code quality if available
        return (b.metrics?.codeQuality || 5) - (a.metrics?.codeQuality || 5);
      })
      .slice(0, totalRecommended);

    // For VIABLE, similar sorting approach
    const sortedViable = viable
      .sort((a, b) => {
        // First prioritize solutions that are not automatically generated/reconstructed
        const aIsAuto =
          a.description.includes("automatically generated") ||
          a.description.includes("reconstructed");
        const bIsAuto =
          b.description.includes("automatically generated") ||
          b.description.includes("reconstructed");
        if (aIsAuto !== bIsAuto) return aIsAuto ? 1 : -1;

        // Then sort by code quality if available
        return (b.metrics?.codeQuality || 5) - (a.metrics?.codeQuality || 5);
      })
      .slice(0, totalViable);

    // For PROBLEMATIC, we want to show the least problematic ones first
    const sortedProblematic = problematic
      .sort((a, b) => {
        // Prioritize solutions that are not automatically generated/reconstructed over those that are
        const aIsAuto =
          a.description.includes("automatically generated") ||
          a.description.includes("reconstructed");
        const bIsAuto =
          b.description.includes("automatically generated") ||
          b.description.includes("reconstructed");
        if (aIsAuto !== bIsAuto) return aIsAuto ? 1 : -1;

        // Then sort by code quality if available (higher quality first)
        return (b.metrics?.codeQuality || 5) - (a.metrics?.codeQuality || 5);
      })
      .slice(0, totalProblematic);

    // Log any RECOMMENDED solutions found for debugging
    if (sortedRecommended.length > 0) {
      console.log(
        `Found ${sortedRecommended.length} RECOMMENDED solutions for ${title}`,
      );
    }

    // When returning the balanced solutions, prioritize RECOMMENDED items by placing them first
    return [
      ...sortedRecommended, // RECOMMENDED solutions first
      ...sortedViable, // VIABLE solutions next
      ...sortedProblematic, // PROBLEMATIC solutions last
    ];
  }, [solutions, itemsPerPage, title]);

  // Check if this is the final solution carousel
  const isFinalSolutionCarousel = title === "Final Implementation";

  // Calculate pagination for the carousel - adjust items per page for final solution carousel
  const itemsPerCarouselPage = isFinalSolutionCarousel ? 2 : 5; // Show 2 items for final solution, 5 for others
  const startIndex = carouselPage * itemsPerCarouselPage;
  const endIndex = Math.min(
    startIndex + itemsPerCarouselPage,
    balancedSolutions.length,
  );
  const visibleSolutions = balancedSolutions.slice(startIndex, endIndex);

  // Notify parent component about which solutions are currently visible
  useEffect(() => {
    if (onPageChange && visibleSolutions.length > 0) {
      // Use a stable reference for the solutions to avoid unnecessary re-renders
      const stableSolutions = [...visibleSolutions];

      // Use a debounced callback to prevent update cycles
      const timer = setTimeout(() => {
        onPageChange(stableSolutions);
      }, 300); // Added longer delay to prevent rapid updates

      return () => clearTimeout(timer); // Clear timeout on cleanup
    }
    // Remove JSON.stringify dependency which causes excessive updates
  }, [carouselPage, visibleSolutions.length]); // Only depend on page changes and array length, not contents

  // Get counts for each solution type for display in the header
  const recommendedCount = solutions.filter(
    (s) => s.type === "accepted",
  ).length;
  const viableCount = solutions.filter((s) => s.type === "secondary").length;
  const problematicCount = solutions.filter(
    (s) => s.type === "rejected",
  ).length;

  // Prevent excessive code files fetching by using a memoized solutionIds array for dependency
  const solutionIds = useMemo(() => solutions.map((s) => s.id), [solutions]);

  // Improved code file fetching for all steps in a batch when view is loaded
  useEffect(() => {
    // Only run if we have steps and they're fully loaded
    if (solutionIds.length === 0) return;

    // Look for a batch ID in the solutions to fetch all code files for the batch at once
    const batchId = solutions.find((s) => s.batchId)?.batchId;

    if (batchId) {
      console.log(`Fetching code files for all steps in batch ${batchId}`);

      // Fetch code files for the entire batch at once using the codefiles table only
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for batch loading

          const response = await fetch("/api/search-codefiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              batchId,
              mode: "batch",
              direct: true, // Ensure we only use the codefiles table
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            if (data.success) {
              console.log(
                `Successfully loaded ${data.files?.length || 0} code files for batch ${batchId} from codefiles table`,
              );
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name !== "AbortError") {
            console.error(
              `Error fetching batch code files for batch ${batchId}:`,
              error,
            );
          }
        }
      })();
    } else {
      // Fallback to loading code files for visible solutions only
      const fetchedIds = new Set(); // Track which IDs we've already fetched

      // Only check visible solutions to avoid fetching all at once
      visibleSolutions.forEach(async (step) => {
        if (!step.id || fetchedIds.has(step.id)) return;
        fetchedIds.add(step.id);

        // Check if this step has code files with content
        const hasCodeFiles =
          step.codeFiles &&
          Array.isArray(step.codeFiles) &&
          step.codeFiles.length > 0 &&
          step.codeFiles.some((file) => file.code && file.code.trim() !== "");

        if (!hasCodeFiles) {
          try {
            console.log(
              `Fetching code files for individual step ${step.id} from codefiles table`,
            );
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            // Use search-codefiles API instead of validate-codefiles to ensure we use the codefiles table
            const response = await fetch("/api/search-codefiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId: step.id,
                mode: "step",
                direct: true, // Ensure we only use the codefiles table
                runId: step.runId,
                stepNumber: step.stepIndex,
                batchId: step.batchId,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();

              if (data.success) {
                console.log(
                  `Successfully fetched ${data.files?.length || 0} code files for step ${step.id} from codefiles table`,
                );
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name !== "AbortError") {
              console.error(
                `Error fetching code files for step ${step.id}:`,
                error,
              );
            }
          }
        }
      });
    }
    // Only run this once when the carousel is first loaded with solutions
  }, [solutionIds.length > 0]);

  // Add this function in the component
  const handleCardExpand = (expanded: boolean, cardId: string) => {
    // Avoid triggering a full re-render of the component
    // Just log the change instead of updating state
    console.log(`Card ${cardId} ${expanded ? "expanded" : "collapsed"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">{title}</h3>

        {solutions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                {recommendedCount} Recommended
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {viableCount} Viable
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800">
                {problematicCount} Problematic
              </span>
              <span className="text-xs text-slate-500">
                {carouselPage + 1}/
                {totalPages ||
                  Math.ceil(balancedSolutions.length / itemsPerCarouselPage) ||
                  1}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Use a different grid layout for final solution cards to make them slightly less than twice as wide */}
      <div
        className={`grid grid-cols-1 ${isFinalSolutionCarousel ? "md:grid-cols-2" : "md:grid-cols-5"} gap-4 pb-4 overflow-visible step-grid`}
      >
        {visibleSolutions.map((solution, index) => (
          <motion.div
            key={solution.id}
            className={`flex-shrink-0 w-full ${isFinalSolutionCarousel ? "max-w-[95%]" : ""}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            layout // Added to help with layout transitions
          >
            <SolutionCard
              id={solution.id}
              title={solution.title}
              description={solution.description}
              type={solution.type}
              model={solution.model}
              metrics={solution.metrics}
              frequency={solution.frequency}
              delay={0}
              runId={solution.runId}
              stepIndex={solution.stepIndex}
              hasReasoning={
                solution.embeddings?.metadata?.enableReasoning === true
              }
              codeFiles={solution.codeFiles}
              onExpand={handleCardExpand}
              metadata={{
                batchId: solution.batchId,
                ...solution.embeddings?.metadata,
              }}
            />
          </motion.div>
        ))}

        {/* Add placeholders if we have fewer than expected items based on grid layout */}
        {visibleSolutions.length <
          (isFinalSolutionCarousel ? 2 : itemsPerCarouselPage) &&
          Array.from({
            length:
              (isFinalSolutionCarousel ? 2 : itemsPerCarouselPage) -
              visibleSolutions.length,
          }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="flex-shrink-0 w-full opacity-0 pointer-events-none"
            >
              <div className="h-48"></div>{" "}
              {/* Placeholder with same height as cards */}
            </div>
          ))}
      </div>
    </div>
  );
}
