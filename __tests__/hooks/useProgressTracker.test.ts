import { useProgressTracker } from '@/components/hooks/useProgressTracker';
import { ModelRunStatus, ProgressStep } from '@/lib/types';
import { act, renderHook } from '@testing-library/react';

describe('useProgressTracker', () => {
  // Mock data
  const mockProgressSteps: ProgressStep[] = [
    {
      id: 'step1',
      title: 'Initializing models',
      description: 'Setting up AI models for the run',
      status: 'completed',
      timestamp: Date.now() - 5000
    },
    {
      id: 'step2',
      title: 'Generating solutions',
      description: 'Creating solutions for each step',
      status: 'in-progress',
      timestamp: Date.now() - 3000
    },
    {
      id: 'step3',
      title: 'Finalizing results',
      description: 'Completing the process',
      status: 'pending',
      timestamp: Date.now()
    }
  ];

  const mockModelStatus: ModelRunStatus[] = [
    { modelId: 1, temperature: 'low', status: 'completed' },
    { modelId: 2, temperature: 'medium', status: 'active' },
    { modelId: 3, temperature: 'high', status: 'error' }
  ];

  // Mock timers
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useProgressTracker());

    expect(result.current.progressSteps).toEqual([]);
    expect(result.current.currentProgressStep).toBe(null);
    expect(result.current.completedRuns).toEqual([]);
    expect(result.current.activeRuns).toEqual([]);
    expect(result.current.errorRuns).toEqual([]);
    expect(result.current.totalRunCount).toBe(0);
    expect(result.current.completedRunCount).toBe(0);
    expect(result.current.errorRunCount).toBe(0);
  });

  test('should initialize progress with default steps', () => {
    const { result } = renderHook(() => useProgressTracker());

    // Initialize progress with run count
    act(() => {
      result.current.initializeProgress(3);
    });

    // Should create default steps
    expect(result.current.progressSteps.length).toBe(5);
    expect(result.current.currentProgressStep).toBe('init');
    expect(result.current.totalRunCount).toBe(3);

    // First step should be in-progress
    const initialStep = result.current.progressSteps.find(step => step.id === 'init');
    expect(initialStep?.status).toBe('in-progress');

    // Advance timers to trigger the timeout that updates steps
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Now 'init' should be completed and 'generate' should be in-progress
    const updatedInitStep = result.current.progressSteps.find(step => step.id === 'init');
    const generateStep = result.current.progressSteps.find(step => step.id === 'generate');

    expect(updatedInitStep?.status).toBe('completed');
    expect(generateStep?.status).toBe('in-progress');
    expect(result.current.currentProgressStep).toBe('generate');
  });

  test('should update progress step', () => {
    const { result } = renderHook(() => useProgressTracker());

    // First set some progress steps using Redux state directly for testing
    act(() => {
      result.current.initializeProgress(3);
      jest.advanceTimersByTime(1100); // Skip the initial timeout
    });

    // Update a step status
    act(() => {
      result.current.updateProgress('generate', 'completed', ['All models completed successfully']);
    });

    // Check that the step was updated
    const updatedStep = result.current.progressSteps.find(step => step.id === 'generate');
    expect(updatedStep?.status).toBe('completed');
    expect(updatedStep?.details).toContain('All models completed successfully');

    // Current step should move to the next pending step (evaluate)
    expect(result.current.currentProgressStep).toBe('evaluate');
  });

  test('should add progress detail', () => {
    const { result } = renderHook(() => useProgressTracker());

    // Initialize progress
    act(() => {
      result.current.initializeProgress(3);
    });

    // Add a detail to the current step
    act(() => {
      result.current.addProgressDetail('init', 'Connected to model API');
    });

    // Check that the detail was added
    const step = result.current.progressSteps.find(s => s.id === 'init');
    expect(step?.details).toContain('Connected to model API');
  });

  test('should update run status', () => {
    const { result } = renderHook(() => useProgressTracker());

    // Set total run count
    act(() => {
      result.current.initializeProgress(3);
    });

    // Update a run status to active
    act(() => {
      result.current.updateRunStatus(1, 'medium', 'active');
    });

    // Check that the run was added to active runs
    expect(result.current.activeRuns.length).toBe(1);
    expect(result.current.activeRuns[0]).toEqual({ modelId: 1, temperature: 'medium', status: 'active' });

    // Update to completed
    act(() => {
      result.current.updateRunStatus(1, 'medium', 'completed');
    });

    // Run should be moved to completed
    expect(result.current.activeRuns.length).toBe(0);
    expect(result.current.completedRuns.length).toBe(1);
    expect(result.current.completedRunCount).toBe(1);

    // Update another run to error
    act(() => {
      result.current.updateRunStatus(2, 'high', 'error');
    });

    // Should add to error runs
    expect(result.current.errorRuns.length).toBe(1);
    expect(result.current.errorRunCount).toBe(1);
  });

  test('should not double-count completed runs', () => {
    const { result } = renderHook(() => useProgressTracker());

    // Initialize progress
    act(() => {
      result.current.initializeProgress(2);
    });

    // Update a run to completed
    act(() => {
      result.current.updateRunStatus(1, 'medium', 'completed');
    });

    expect(result.current.completedRunCount).toBe(1);

    // Update the same run to completed again
    act(() => {
      result.current.updateRunStatus(1, 'medium', 'completed');
    });

    // Completed count should still be 1
    expect(result.current.completedRunCount).toBe(1);
  });

  test('should reset progress tracker state', () => {
    const { result } = renderHook(() => useProgressTracker());

    // Initialize with some data
    act(() => {
      result.current.initializeProgress(3);
      result.current.updateRunStatus(1, 'medium', 'completed');
    });

    // Verify data was loaded
    expect(result.current.progressSteps.length).toBeGreaterThan(0);
    expect(result.current.totalRunCount).toBe(3);
    expect(result.current.completedRunCount).toBe(1);

    // Reset the state
    act(() => {
      result.current.resetProgress();
    });

    // Check that all state was reset
    expect(result.current.progressSteps).toEqual([]);
    expect(result.current.currentProgressStep).toBe(null);
    expect(result.current.completedRuns).toEqual([]);
    expect(result.current.activeRuns).toEqual([]);
    expect(result.current.errorRuns).toEqual([]);
    expect(result.current.totalRunCount).toBe(0);
    expect(result.current.completedRunCount).toBe(0);
    expect(result.current.errorRunCount).toBe(0);
  });
});