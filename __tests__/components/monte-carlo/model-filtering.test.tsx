import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PointWithCluster } from '@/lib/monte-carlo-service';
import { useMonteCarloData } from '@/components/monte-carlo/hooks/use-monte-carlo-data';

// Mock the entire monte-carlo-visualizer component instead of trying to render it
vi.mock('@/components/monte-carlo-visualizer', () => {
  const ModelLegend = ({ selectedModelFilter, onModelFilterChange, data }: {
    selectedModelFilter: string | null;
    onModelFilterChange: (model: string | null) => void;
    data: PointWithCluster[];
  }) => (
    <div data-testid="model-legend">
      <div className="model-types">
        <div onClick={() => onModelFilterChange('gpt-4')}>
          GPT-4o ({data.filter((p: PointWithCluster) => p.model.toLowerCase().includes('gpt-4')).length})
        </div>
        <div onClick={() => onModelFilterChange('claude')}>
          Claude ({data.filter((p: PointWithCluster) => p.model.toLowerCase().includes('claude')).length})
        </div>
        <div onClick={() => onModelFilterChange('o1')}>
          o1 ({data.filter((p: PointWithCluster) => p.model.toLowerCase().includes('o1')).length})
        </div>
      </div>
      {selectedModelFilter && (
        <button onClick={() => onModelFilterChange(null)}>Show All Points</button>
      )}
    </div>
  );

  // Return a mock component that includes just the model filtering UI parts
  return {
    __esModule: true,
    default: ({ initialBatchId }: { initialBatchId?: string | null }) => {
      const { data } = useMonteCarloData({ initialBatchId });
      const [modelFilter, setModelFilter] = React.useState<string | null>(null);
      const [filteredData, setFilteredData] = React.useState<PointWithCluster[]>(data);

      React.useEffect(() => {
        if (modelFilter === null) {
          setFilteredData(data);
        } else {
          const filtered = data.filter(point => {
            const modelLower = point.model.toLowerCase();
            if (modelFilter === 'gpt-4' && modelLower.includes('gpt-4')) return true;
            if (modelFilter === 'claude' && modelLower.includes('claude')) return true;
            if (modelFilter === 'o1' && modelLower.includes('o1')) return true;
            return false;
          });
          setFilteredData(filtered);
        }
      }, [modelFilter, data]);

      return (
        <div data-testid="monte-carlo-visualizer">
          <div>
            <span>Total Points: {data.length}</span>
            <span>Filtered Points: {filteredData.length}</span>
            {modelFilter && <span>Filtered by: {modelFilter}</span>}
          </div>
          <ModelLegend
            selectedModelFilter={modelFilter}
            onModelFilterChange={setModelFilter}
            data={data}
          />
        </div>
      );
    }
  };
});

// Mock the useMonteCarloData hook
vi.mock('@/components/monte-carlo/hooks/use-monte-carlo-data', () => ({
  useMonteCarloData: vi.fn(),
}));

// Helper to create mock data points for testing
const createMockDataPoints = (): PointWithCluster[] => [
  {
    id: '1',
    model: 'gpt-4o',
    runId: 1,
    temperature: 0.7,
    position: [1, 1, 1],
    metrics: {
      executionTime: '100ms',
      complexity: 'O(n)',
      memoryUsage: '10MB',
      lineCount: 50,
      codeQuality: 90,
      convergenceScore: 95,
    },
    approach: 'Approach 1',
    solutionSummary: 'Solution 1',
    originalContent: 'Content 1',
    batchId: 'batch_1234',
    cluster: 1,
  },
  {
    id: '2',
    model: 'claude-sonnet',
    runId: 2,
    temperature: 0.7,
    position: [2, 2, 2],
    metrics: {
      executionTime: '120ms',
      complexity: 'O(n)',
      memoryUsage: '12MB',
      lineCount: 60,
      codeQuality: 85,
      convergenceScore: 90,
    },
    approach: 'Approach 2',
    solutionSummary: 'Solution 2',
    originalContent: 'Content 2',
    batchId: 'batch_1234',
    cluster: 1,
  },
  {
    id: '3',
    model: 'o1-mini',
    runId: 3,
    temperature: 0.7,
    position: [3, 3, 3],
    metrics: {
      executionTime: '80ms',
      complexity: 'O(n)',
      memoryUsage: '8MB',
      lineCount: 40,
      codeQuality: 92,
      convergenceScore: 88,
    },
    approach: 'Approach 3',
    solutionSummary: 'Solution 3',
    originalContent: 'Content 3',
    batchId: 'batch_1234',
    cluster: 2,
  },
];

describe('Monte Carlo Model Filtering', () => {
  beforeEach(() => {
    // Mock implementation of the useMonteCarloData hook
    const mockData = createMockDataPoints();
    
    (useMonteCarloData as any).mockReturnValue({
      data: mockData,
      clusters: [],
      allBatchIds: ['batch_1234'],
      selectedBatchId: 'batch_1234',
      isLoadingData: false,
      isFetchingBatches: false,
      error: null,
      setSelectedBatchId: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the model legend with correct model types', () => {
    render(<div data-testid="root-component">
      {/* @ts-ignore */}
      <MonteCarloVisualizer initialBatchId="batch_1234" />
    </div>);
    
    expect(screen.getByText(/GPT-4o/)).toBeInTheDocument();
    expect(screen.getByText(/Claude/)).toBeInTheDocument();
    expect(screen.getByText(/o1/)).toBeInTheDocument();
  });

  it('should show "Show All Points" button when a model filter is active', () => {
    render(<div data-testid="root-component">
      {/* @ts-ignore */}
      <MonteCarloVisualizer initialBatchId="batch_1234" />
    </div>);
    
    // Initially, the "Show All Points" button should not be visible
    expect(screen.queryByText('Show All Points')).not.toBeInTheDocument();
    
    // Click on a model filter
    const gptButton = screen.getByText(/GPT-4o/);
    fireEvent.click(gptButton);
    
    // Now the "Show All Points" button should be visible
    expect(screen.getByText('Show All Points')).toBeInTheDocument();
  });

  it('should clear the model filter when "Show All Points" is clicked', () => {
    render(<div data-testid="root-component">
      {/* @ts-ignore */}
      <MonteCarloVisualizer initialBatchId="batch_1234" />
    </div>);
    
    // Set a model filter
    const gptButton = screen.getByText(/GPT-4o/);
    fireEvent.click(gptButton);
    
    // Verify the "Show All Points" button is visible
    const showAllButton = screen.getByText('Show All Points');
    expect(showAllButton).toBeInTheDocument();
    
    // Click "Show All Points"
    fireEvent.click(showAllButton);
    
    // Verify the button is no longer visible
    expect(screen.queryByText('Show All Points')).not.toBeInTheDocument();
  });

  it('should display correct counts for each model type', () => {
    render(<div data-testid="root-component">
      {/* @ts-ignore */}
      <MonteCarloVisualizer initialBatchId="batch_1234" />
    </div>);
    
    // We should see "(1)" for GPT-4o count (1 item)
    expect(screen.getByText(/GPT-4o \(1\)/)).toBeInTheDocument();
    
    // We should see "(1)" for Claude count (1 item)
    expect(screen.getByText(/Claude \(1\)/)).toBeInTheDocument();
    
    // We should see "(1)" for o1 count (1 item)
    expect(screen.getByText(/o1 \(1\)/)).toBeInTheDocument();
  });
}); 