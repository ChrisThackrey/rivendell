import { useBatchManager } from '@/components/hooks/useBatchManager';
import { getDocumentsByBatchId } from '@/lib/embedding-service';
import { getAvailableBatches, getStepsByBatchId, groupStepsByStepIndex } from '@/lib/step-service';
import { Solution } from '@/lib/types';
import { act, renderHook } from '@testing-library/react';

// Mock the service functions
jest.mock('@/lib/step-service', () => ({
  getAvailableBatches: jest.fn(),
  getStepsByBatchId: jest.fn(),
  groupStepsByStepIndex: jest.fn()
}));

jest.mock('@/lib/embedding-service', () => ({
  getDocumentsByBatchId: jest.fn()
}));

describe('useBatchManager', () => {
  // Mock data
  const mockBatches = [
    { batch_id: 'batch1', step_count: 6, latest_created_at: '2023-01-01' },
    { batch_id: 'batch2', step_count: 6, latest_created_at: '2023-01-02' }
  ];

  const mockSteps = [
    { id: 'step1', batch_id: 'batch1', step_index: 1, decision: 'accept', level: 1, run_id: 1, step_data: { type: 'accepted' }, decision_value: 'accept' },
    { id: 'step2', batch_id: 'batch1', step_index: 2, decision: 'accept', level: 2, run_id: 1, step_data: { type: 'accepted' }, decision_value: 'accept' },
    { id: 'step3', batch_id: 'batch1', step_index: 3, decision: 'reject', level: 3, run_id: 1, step_data: { type: 'rejected' }, decision_value: 'reject' }
  ];

  const mockDocuments = [
    { id: 'doc1', metadata: { batch_id: 'batch1', run_id: 1, decision: 'ACCEPTED', model: 'openai', stepNumber: 1 }, content: 'Test content 1' },
    { id: 'doc2', metadata: { batch_id: 'batch1', run_id: 2, decision: 'REJECTED', model: 'anthropic', stepNumber: 2 }, content: 'Test content 2' }
  ];

  const mockGroupedSteps = {
    1: [{ id: 'step1', title: 'Step 1', description: 'Description', type: 'accepted', stepIndex: 1 }],
    2: [{ id: 'step2', title: 'Step 2', description: 'Description', type: 'accepted', stepIndex: 2 }],
    3: [{ id: 'step3', title: 'Step 3', description: 'Description', type: 'rejected', stepIndex: 3 }]
  };

  // Mock mapper function
  const mockMapDecisionToSolutionType = (decision: string) => {
    if (decision === 'accept' || decision === 'ACCEPTED') return 'accepted';
    if (decision === 'reject' || decision === 'REJECTED') return 'rejected';
    return 'secondary';
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup the mock implementation
    (getAvailableBatches as jest.Mock).mockResolvedValue(mockBatches);
    (getStepsByBatchId as jest.Mock).mockResolvedValue(mockSteps);
    (getDocumentsByBatchId as jest.Mock).mockResolvedValue(mockDocuments);
    (groupStepsByStepIndex as jest.Mock).mockReturnValue(mockGroupedSteps);
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useBatchManager(mockMapDecisionToSolutionType));

    expect(result.current.availableBatches).toEqual([]);
    expect(result.current.selectedBatchId).toBe('');
    expect(result.current.currentBatchId).toBe('');
    expect(result.current.isLoadingBatch).toBe(false);
  });

  test('should fetch available batches', async () => {
    const { result } = renderHook(() =>
      useBatchManager(mockMapDecisionToSolutionType)
    );

    // Create a promise that will resolve when the state updates
    const fetchPromise = result.current.fetchAvailableBatches();

    // Wait for the async operation to complete
    await fetchPromise;

    // Check results after loading
    expect(result.current.availableBatches).toEqual(mockBatches);
    expect(getAvailableBatches).toHaveBeenCalledTimes(1);
  });

  test('should handle batch selection', async () => {
    const { result } = renderHook(() =>
      useBatchManager(mockMapDecisionToSolutionType)
    );

    // Select a batch
    act(() => {
      result.current.selectBatch('batch1');
    });

    // Check that selected batch was updated
    expect(result.current.selectedBatchId).toBe('batch1');

    // Load the selected batch
    const loadResult = await result.current.loadSelectedBatch();

    // Check results after loading
    expect(result.current.currentBatchId).toBe('batch1');
    expect(loadResult).toEqual({
      groupedSteps: mockGroupedSteps,
      similarityConnections: [],
      batchId: 'batch1'
    });

    // Check that all service functions were called
    expect(getStepsByBatchId).toHaveBeenCalledWith('batch1');
  });

  test('should load documents by batch ID', async () => {
    const { result } = renderHook(() =>
      useBatchManager(mockMapDecisionToSolutionType)
    );

    // Call the function to load documents
    const loadResult = await result.current.loadDocumentsByBatchId('batch1');

    // Check results
    expect(loadResult.batchId).toBe('batch1');
    expect(loadResult.groupedSteps).toEqual(mockGroupedSteps);
    expect(getDocumentsByBatchId).toHaveBeenCalledWith('batch1');
  });

  test('should handle batch loading with includeAllDecisionTypes=false', async () => {
    const { result } = renderHook(() =>
      useBatchManager(mockMapDecisionToSolutionType)
    );

    // Call load documents with includeAllDecisionTypes=false
    await result.current.loadDocumentsByBatchId('batch1', false);

    // Check that the parameter was passed correctly
    expect(getDocumentsByBatchId).toHaveBeenCalledWith('batch1');
  });

  test('should group solutions by step index', () => {
    const { result } = renderHook(() =>
      useBatchManager(mockMapDecisionToSolutionType)
    );

    const testSolutions: Solution[] = [
      { id: 'sol1', title: 'Solution 1', description: 'Description 1', type: 'accepted', stepIndex: 1 },
      { id: 'sol2', title: 'Solution 2', description: 'Description 2', type: 'secondary', stepIndex: 1 },
      { id: 'sol3', title: 'Solution 3', description: 'Description 3', type: 'rejected', stepIndex: 2 }
    ];

    const grouped = result.current.groupSolutionsByStepIndex(testSolutions);

    // Should be grouped by step index
    expect(Object.keys(grouped).length).toBe(2);
    expect(grouped[1].length).toBe(2);
    expect(grouped[2].length).toBe(1);

    // Should sort by solution type
    expect(grouped[1][0].type).toBe('accepted');
    expect(grouped[1][1].type).toBe('secondary');
  });
});