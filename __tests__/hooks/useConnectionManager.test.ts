import { useConnectionManager } from '@/components/hooks/useConnectionManager';
import { Connection, SimilarityConnection, Solution, Step } from '@/lib/types';
import { act, renderHook } from '@testing-library/react';

describe('useConnectionManager', () => {
  // Mock connection data
  const mockConnections: Connection[] = [
    { from: 'input', to: 's1', level: 0, type: 'accepted' },
    { from: 'input', to: 's2', level: 0, type: 'secondary' },
    { from: 's1', to: 's3', level: 1, type: 'accepted' },
    { from: 's2', to: 's4', level: 1, type: 'secondary' },
    { from: 's3', to: 'output', level: 2, type: 'accepted' },
    { from: 's4', to: 'output', level: 2, type: 'secondary' }
  ];

  const mockSimilarityConnections: SimilarityConnection[] = [
    { from: 's1', to: 's3', type: 'accepted', level: 1, color: '#22C55E' },
    { from: 's2', to: 's4', type: 'secondary', level: 1, color: '#3B82F6' }
  ];

  // Create mock solutions for steps
  const mockSolution1: Solution = { id: 'sol1', title: 'Solution 1', description: 'Description 1', type: 'accepted' };
  const mockSolution2: Solution = { id: 'sol2', title: 'Solution 2', description: 'Description 2', type: 'secondary' };
  const mockSolution3: Solution = { id: 'sol3', title: 'Solution 3', description: 'Description 3', type: 'accepted' };

  const mockSteps: Step[] = [
    { id: 'step1', title: 'Step 1', solutions: [mockSolution1], stepIndex: 1 },
    { id: 'step2', title: 'Step 2', solutions: [mockSolution2], stepIndex: 1 },
    { id: 'step3', title: 'Step 3', solutions: [mockSolution3], stepIndex: 2 }
  ];

  const mockGroupedSteps: Record<number, Solution[]> = {
    1: [
      { id: 'sol1', title: 'Solution 1', description: 'Description 1', type: 'accepted', runId: 1, stepIndex: 1 },
      { id: 'sol2', title: 'Solution 2', description: 'Description 2', type: 'secondary', runId: 2, stepIndex: 1 }
    ],
    2: [
      { id: 'sol3', title: 'Solution 3', description: 'Description 3', type: 'accepted', runId: 1, stepIndex: 2 },
      { id: 'sol4', title: 'Solution 4', description: 'Description 4', type: 'secondary', runId: 2, stepIndex: 2 }
    ]
  };

  // Mock the document.getElementById for connection validation
  let mockDomElements: Record<string, HTMLElement> = {};

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock DOM elements for connection validation
    mockDomElements = {
      'sol1': document.createElement('div'),
      'sol2': document.createElement('div'),
      'sol3': document.createElement('div'),
      'sol4': document.createElement('div')
    };

    // Setup document.getElementById mock
    document.getElementById = jest.fn().mockImplementation((id) => {
      return mockDomElements[id] || null;
    });
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useConnectionManager());

    expect(result.current.visibleConnections).toEqual([]);
    expect(result.current.currentLevel).toBe(0);
    expect(result.current.showOptimizedPath).toBe(false);
    expect(result.current.highlightedConnections.size).toBe(0);
    expect(result.current.similarityConnections).toEqual([]);
    expect(result.current.lineKey).toBe(0);
  });

  test('should update connections based on level', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Set visible connections
    act(() => {
      result.current.setVisibleConnections(mockConnections);
    });

    // Test setting level 0
    act(() => {
      result.current.setCurrentLevel(0);
    });

    // Check the level was set
    expect(result.current.currentLevel).toBe(0);
  });

  test('should update similarity connections', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Set similarity connections
    act(() => {
      result.current.setSimilarityConnections(mockSimilarityConnections);
    });

    // Check that connections were updated
    expect(result.current.similarityConnections).toEqual(mockSimilarityConnections);
  });

  test('should toggle optimized path', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Set visible connections
    act(() => {
      result.current.setVisibleConnections(mockConnections);
    });

    // Toggle optimized path on
    act(() => {
      result.current.setShowOptimizedPath(true);
    });

    // Check that optimized path is shown
    expect(result.current.showOptimizedPath).toBe(true);

    // Toggle off again
    act(() => {
      result.current.setShowOptimizedPath(false);
    });

    // Should be back to false
    expect(result.current.showOptimizedPath).toBe(false);
  });

  test('should handle connection highlighting', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Set up a connection to highlight
    const fromId = 's1';
    const toId = 's3';

    // Trigger hover
    act(() => {
      result.current.handleLineHover(fromId, toId, true);
    });

    // Check if the connection is highlighted
    expect(result.current.isConnectionHighlighted(fromId, toId)).toBe(true);

    // Trigger hover off
    act(() => {
      result.current.handleLineHover(fromId, toId, false);
    });

    // Should not be highlighted anymore
    expect(result.current.isConnectionHighlighted(fromId, toId)).toBe(false);
  });

  test('should reset the line key when explicitly set', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Initial line key should be 0
    expect(result.current.lineKey).toBe(0);

    // Reset the line key
    act(() => {
      result.current.setLineKey(prev => prev + 1);
    });

    // Line key should be incremented
    expect(result.current.lineKey).toBe(1);

    // Reset again
    act(() => {
      result.current.setLineKey(prev => prev + 1);
    });

    // Should increment again
    expect(result.current.lineKey).toBe(2);
  });

  test('should get visible connections for steps', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Get connections for single step
    const singleStepConnections = result.current.getVisibleConnectionsForSteps([mockSteps[0]]);

    // Should return level 0 connections only
    expect(singleStepConnections.every(conn => conn.level === 0)).toBe(true);

    // Get connections for multiple steps
    const multiStepConnections = result.current.getVisibleConnectionsForSteps(mockSteps);

    // Should include connections up to level 1 (since we have 3 steps with max level 1)
    expect(multiStepConnections.every(conn => conn.level <= 1)).toBe(true);
  });

  test('should validate connection IDs and DOM elements', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Valid UUIDs should be valid
    expect(result.current.isValidId('c8d8e8f8-94a3-4d13-b1f9-88e68501b343')).toBe(true);

    // Invalid or empty IDs should be invalid
    expect(result.current.isValidId(null)).toBe(false);
    expect(result.current.isValidId(undefined)).toBe(false);
    expect(result.current.isValidId('')).toBe(false);
    expect(result.current.isValidId('not-a-uuid')).toBe(false);

    // DOM elements that exist should be valid
    expect(result.current.validateConnection('sol1', 'sol2')).toBe(true);

    // DOM elements that don't exist should be invalid
    expect(result.current.validateConnection('sol1', 'nonexistent')).toBe(false);
  });

  test('should generate connection lines from grouped steps', () => {
    const { result } = renderHook(() => useConnectionManager());

    // Generate connections from grouped steps
    const connections = result.current.generateConnectionLinesFromGroupedSteps(mockGroupedSteps);

    // Should generate connections between steps with the same runId
    expect(connections.length).toBe(2);

    // The connections should match run IDs
    const connection1 = connections.find(c => c.from === 'sol1' && c.to === 'sol3');
    const connection2 = connections.find(c => c.from === 'sol2' && c.to === 'sol4');

    expect(connection1).toBeDefined();
    expect(connection2).toBeDefined();

    // Check connection properties
    if (connection1) {
      expect(connection1.type).toBe('accepted');
      expect(connection1.color).toBe('#22C55E');
    }

    if (connection2) {
      expect(connection2.type).toBe('secondary');
      expect(connection2.color).toBe('#3B82F6');
    }
  });
});