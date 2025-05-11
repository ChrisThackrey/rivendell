import { useCallback, useEffect, useState } from 'react';
import type { Solution } from '../types'; // Assuming Solution type is needed for onPageChange

export interface CarouselManagerReturn {
  carouselPage: number;
  maxCarouselPages: number;
  lineKey: number; // If managed here
  handleCarouselPrevious: () => void;
  handleCarouselNext: () => void;
  handleCarouselPageChange: (stepIndex: number, visibleSolutions: Solution[]) => void;
  // setLineKey: React.Dispatch<React.SetStateAction<number>>; // If lineKey is exposed
}

// groupedSteps will be passed as a dependency to calculate max pages
export function useCarouselManager(
    groupedSteps: Record<number, Solution[]>,
    initialLineKey?: number
  ): CarouselManagerReturn {
  const [carouselPage, setCarouselPage] = useState(0);
  const [maxCarouselPages, setMaxCarouselPages] = useState(1);
  const [lineKey, setLineKey] = useState(initialLineKey || 0); // Manage lineKey here

  // Calculate max possible pages based on all grouped steps
  useEffect(() => {
    if (Object.keys(groupedSteps).length === 0) {
      setMaxCarouselPages(1); // Default to 1 page if no steps
      setCarouselPage(0);
      return;
    }

    let maxPages = 1;
    Object.values(groupedSteps).forEach((solutionsInStep) => {
      if (solutionsInStep && solutionsInStep.length > 0) {
        const pagesNeeded = Math.ceil(solutionsInStep.length / 5); // Assuming 5 items per page, make this configurable?
        maxPages = Math.max(maxPages, pagesNeeded);
      }
    });
    setMaxCarouselPages(maxPages);
    setCarouselPage(0); // Reset to first page when steps change
  }, [groupedSteps]);

  const handleCarouselPrevious = useCallback(() => {
    setCarouselPage((prev) => Math.max(0, prev - 1));
    setLineKey((prevKey) => prevKey + 1); // Force redraw connections
  }, []);

  const handleCarouselNext = useCallback(() => {
    setCarouselPage((prev) => Math.min(maxCarouselPages - 1, prev + 1));
    setLineKey((prevKey) => prevKey + 1); // Force redraw connections
  }, [maxCarouselPages]);

  // This will be called by StepCarousel component's onPageChange
  // The actual update to visibleSolutionsByStep will happen in the main component or another hook
  // For now, this hook can simply manage page state and lineKey updates.
  // If onPageChange directly updates states used by this hook, it can be more integrated.
  const handleCarouselPageChange = useCallback((stepIndex: number, visibleSolutions: Solution[]) => {
    // The primary responsibility of this hook for this event is to update lineKey
    // The actual setVisibleSolutionsByStep is still in PathwayVisualizer
    // For a cleaner abstraction, StepCarousel could just report new page index,
    // and PathwayVisualizer (or a new useVisibleSolutions hook) handles the rest.
    // For now, just ensure lineKey is updated if a page change implies a visual update requiring line redraw.
    setLineKey((prevKey) => prevKey + 1);
    // console.log(`Carousel page change for step ${stepIndex}, visible: ${visibleSolutions.length}. LineKey: ${lineKey +1}`);
  }, []);

  return {
    carouselPage,
    maxCarouselPages,
    lineKey,
    handleCarouselPrevious,
    handleCarouselNext,
    handleCarouselPageChange,
    // setLineKey, // Expose if other parts of the app need to trigger line redraws
  };
}