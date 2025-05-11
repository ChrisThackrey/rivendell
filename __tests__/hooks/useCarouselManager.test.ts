import { useCarouselManager } from '@/components/hooks/useCarouselManager';
import { Solution } from '@/lib/types';
import { act, renderHook } from '@testing-library/react';

describe('useCarouselManager', () => {
  // Mock solution data
  const mockSolutions: Solution[] = [
    {
      id: 'solution1',
      title: 'Solution 1',
      description: 'Description 1',
      type: 'accepted',
      stepIndex: 1
    },
    {
      id: 'solution2',
      title: 'Solution 2',
      description: 'Description 2',
      type: 'secondary',
      stepIndex: 1
    },
    {
      id: 'solution3',
      title: 'Solution 3',
      description: 'Description 3',
      type: 'rejected',
      stepIndex: 1
    },
    {
      id: 'solution4',
      title: 'Solution 4',
      description: 'Description 4',
      type: 'accepted',
      stepIndex: 1
    },
    {
      id: 'solution5',
      title: 'Solution 5',
      description: 'Description 5',
      type: 'secondary',
      stepIndex: 1
    },
    {
      id: 'solution6',
      title: 'Solution 6',
      description: 'Description 6',
      type: 'rejected',
      stepIndex: 1
    },
  ];

  const mockGroupedSteps = {
    1: mockSolutions,
    2: mockSolutions.map(s => ({ ...s, id: `s2-${s.id}`, stepIndex: 2 }))
  };

  // Mock the setTimeout function
  jest.useFakeTimers();

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Make sure we reset the DOM
    document.body.innerHTML = '';
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useCarouselManager());

    expect(result.current.carouselPage).toBe(0);
    expect(result.current.maxCarouselPages).toBe(1);
    expect(result.current.visibleSolutionsByStep).toEqual({});
    expect(result.current.lineKey).toBe(0);
  });

  test('should handle carousel navigation correctly', () => {
    const { result } = renderHook(() => useCarouselManager());

    // Set max pages to 3 for testing
    act(() => {
      result.current.updateMaxPages({
        1: new Array(15).fill(null) // 15 items = 3 pages of 5 items each
      });
    });

    expect(result.current.maxCarouselPages).toBe(3);

    // Test next navigation
    act(() => {
      result.current.handleCarouselNext();
    });
    expect(result.current.carouselPage).toBe(1);

    act(() => {
      result.current.handleCarouselNext();
    });
    expect(result.current.carouselPage).toBe(2);

    // Test that we can't go beyond max pages
    act(() => {
      result.current.handleCarouselNext();
    });
    expect(result.current.carouselPage).toBe(2); // Still 2, not 3

    // Test previous navigation
    act(() => {
      result.current.handleCarouselPrevious();
    });
    expect(result.current.carouselPage).toBe(1);

    act(() => {
      result.current.handleCarouselPrevious();
    });
    expect(result.current.carouselPage).toBe(0);

    // Test that we can't go below 0
    act(() => {
      result.current.handleCarouselPrevious();
    });
    expect(result.current.carouselPage).toBe(0); // Still 0, not -1
  });

  test('should update visible solutions correctly', () => {
    const { result } = renderHook(() => useCarouselManager());

    const stepIndex = 1;
    const visibleSolutions = mockSolutions.slice(0, 3);

    act(() => {
      result.current.handleCarouselPageChange(stepIndex, visibleSolutions);
    });

    // Check that visible solutions were updated
    expect(result.current.visibleSolutionsByStep[stepIndex]).toEqual(visibleSolutions);

    // Run timers to trigger the line redraw
    act(() => {
      jest.runAllTimers();
    });

    // Check that lineKey was incremented to force redraw
    expect(result.current.lineKey).toBe(1);
  });

  test('should initialize visible solutions for a step', () => {
    const { result } = renderHook(() => useCarouselManager());

    const stepIndex = 1;

    // Initialize visible solutions with 3 items per page
    act(() => {
      result.current.initializeVisibleSolutions(stepIndex, mockSolutions, 3);
    });

    // Should include at least one of each type (accepted, secondary, rejected)
    const visibleSolutions = result.current.visibleSolutionsByStep[stepIndex];
    expect(visibleSolutions.length).toBeLessThanOrEqual(3);

    // Check that we have at least one of each type if available
    const hasAccepted = visibleSolutions.some(s => s.type === 'accepted');
    const hasSecondary = visibleSolutions.some(s => s.type === 'secondary');
    const hasRejected = visibleSolutions.some(s => s.type === 'rejected');

    expect(hasAccepted).toBe(true);
    expect(hasSecondary).toBe(true);
    expect(hasRejected).toBe(true);
  });

  test('should initialize all visible solutions', () => {
    const { result } = renderHook(() => useCarouselManager());

    // Initialize all visible solutions
    act(() => {
      result.current.initializeAllVisibleSolutions(mockGroupedSteps, 3);
    });

    // Should have initialized solutions for both step indices
    expect(Object.keys(result.current.visibleSolutionsByStep).length).toBe(2);
    expect(result.current.visibleSolutionsByStep[1]).toBeDefined();
    expect(result.current.visibleSolutionsByStep[2]).toBeDefined();

    // Check that lineKey was incremented to force redraw
    expect(result.current.lineKey).toBe(1);
  });

  test('should reset carousel state', () => {
    const { result } = renderHook(() => useCarouselManager());

    // First set some state
    act(() => {
      result.current.updateMaxPages(mockGroupedSteps);
      result.current.handleCarouselNext();
      result.current.initializeAllVisibleSolutions(mockGroupedSteps);
    });

    // Verify that state was set
    expect(result.current.carouselPage).toBe(1);
    expect(result.current.maxCarouselPages).toBeGreaterThan(1);
    expect(Object.keys(result.current.visibleSolutionsByStep).length).toBe(2);

    // Reset carousel state
    act(() => {
      result.current.resetCarousel();
    });

    // Verify that state was reset
    expect(result.current.carouselPage).toBe(0);
    expect(result.current.maxCarouselPages).toBe(1);
    expect(result.current.visibleSolutionsByStep).toEqual({});
  });
});