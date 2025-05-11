import type { Solution } from "@/lib/types";
import { useCallback, useState } from "react";

export function useCarouselManager() {
  const [carouselPage, setCarouselPage] = useState(0);
  const [maxCarouselPages, setMaxCarouselPages] = useState(1);
  const [visibleSolutionsByStep, setVisibleSolutionsByStep] = useState<Record<number, Solution[]>>({});
  const [lineKey, setLineKey] = useState(0);

  // Handle carousel pagination
  const handleCarouselPrevious = useCallback(() => {
    setCarouselPage((prev) => Math.max(0, prev - 1));
    // Force redraw connections when changing page
    setLineKey((prevKey) => prevKey + 1);
  }, []);

  const handleCarouselNext = useCallback(() => {
    setCarouselPage((prev) => Math.min(maxCarouselPages - 1, prev + 1));
    // Force redraw connections when changing page
    setLineKey((prevKey) => prevKey + 1);
  }, [maxCarouselPages]);

  // Calculate max pages based on grouped steps
  const updateMaxPages = useCallback((groupedSteps: Record<number, Solution[]>) => {
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
  }, []);

  // Handle page change in a carousel
  const handleCarouselPageChange = useCallback(
    (stepIndex: number, visibleSolutions: Solution[]) => {
      // Skip if no visible solutions
      if (!visibleSolutions || visibleSolutions.length === 0) return;

      console.log(
        `Carousel page changed for step ${stepIndex} with ${visibleSolutions.length} visible solutions`
      );

      // Update visible solutions for this step
      setVisibleSolutionsByStep((prev) => {
        // Create a deep copy to avoid mutation
        const updated = { ...prev };
        updated[stepIndex] = visibleSolutions;
        return updated;
      });

      // Force redraw of connection lines after a brief delay to allow DOM to update
      setTimeout(() => {
        setLineKey((prevKey) => prevKey + 1);
      }, 150);
    },
    []
  );

  // Initialize visible solutions for a step
  const initializeVisibleSolutions = useCallback(
    (stepIndex: number, solutions: Solution[], itemsPerPage: number = 5) => {
      if (!solutions || solutions.length === 0) return;

      // Take a balance of each type for the first page
      const recommendedSolutions = solutions
        .filter((s) => s.type === "accepted")
        .slice(0, Math.ceil(itemsPerPage / 3));

      const viableSolutions = solutions
        .filter((s) => s.type === "secondary")
        .slice(0, Math.ceil(itemsPerPage / 3));

      const problematicSolutions = solutions
        .filter((s) => s.type === "rejected")
        .slice(0, Math.ceil(itemsPerPage / 3));

      // Combine all types
      const firstPageSolutions = [
        ...recommendedSolutions,
        ...viableSolutions,
        ...problematicSolutions,
      ].slice(0, itemsPerPage); // Limit to itemsPerPage solutions total

      if (firstPageSolutions.length > 0) {
        setVisibleSolutionsByStep((prev) => ({
          ...prev,
          [stepIndex]: firstPageSolutions,
        }));

        console.log(
          `Step ${stepIndex} initialized with ${firstPageSolutions.length} visible solutions`
        );
      }
    },
    []
  );

  // Initialize visible solutions for multiple steps
  const initializeAllVisibleSolutions = useCallback(
    (groupedSteps: Record<number, Solution[]>, itemsPerPage: number = 5) => {
      // Clear current visible solutions
      setVisibleSolutionsByStep({});

      // Initialize visible solutions for each step
      Object.keys(groupedSteps).forEach((stepIndexStr) => {
        const stepIndex = Number(stepIndexStr);
        const stepSolutions = groupedSteps[stepIndex];

        if (stepSolutions && stepSolutions.length > 0) {
          initializeVisibleSolutions(stepIndex, stepSolutions, itemsPerPage);
        }
      });

      // Force redraw of the connections
      setLineKey((prevKey) => prevKey + 1);
    },
    [initializeVisibleSolutions]
  );

  // Reset carousel state
  const resetCarousel = useCallback(() => {
    setCarouselPage(0);
    setMaxCarouselPages(1);
    setVisibleSolutionsByStep({});
  }, []);

  return {
    carouselPage,
    maxCarouselPages,
    visibleSolutionsByStep,
    lineKey,
    handleCarouselPrevious,
    handleCarouselNext,
    updateMaxPages,
    handleCarouselPageChange,
    initializeVisibleSolutions,
    initializeAllVisibleSolutions,
    resetCarousel,
    setLineKey
  };
}