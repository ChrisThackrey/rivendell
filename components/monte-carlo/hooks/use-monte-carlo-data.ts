import { useState, useEffect, useCallback, useRef } from "react";
import {
  MonteCarloDataPoint,
  MonteCarloCluster,
  fetchMonteCarloDataForBatch,
  generateClusters,
  generateClusterTitles,
  fetchAvailableBatchIds,
  normalizeAndSpreadPoints,
  addJitterToPoints,
  PointWithCluster,
} from "@/lib/monte-carlo-service";

interface UseMonteCarloDataProps {
  initialBatchId?: string | null;
}

interface UseMonteCarloDataReturn {
  data: PointWithCluster[];
  clusters: MonteCarloCluster[];
  allBatchIds: string[] | null; // Allow null initially
  selectedBatchId: string | null;
  isLoadingData: boolean; // Renamed for clarity
  isFetchingBatches: boolean;
  error: Error | null;
  setSelectedBatchId: React.Dispatch<React.SetStateAction<string | null>>;
  refetchBatches: () => Promise<void>;
  refetchDataForBatch: (batchId: string) => Promise<void>;
}

// Helper to sort batch IDs (newest first based on timestamp)
const sortBatchIds = (batchIds: string[]): string[] => {
   return [...batchIds].sort((a, b) => {
      const getTimestamp = (id: string) => {
         const match = id.match(/batch_(\d+)/);
         return match ? parseInt(match[1], 10) : 0;
      };
      return getTimestamp(b) - getTimestamp(a); // Descending order
   });
}


export function useMonteCarloData({ initialBatchId = null }: UseMonteCarloDataProps): UseMonteCarloDataReturn {
  const [data, setData] = useState<PointWithCluster[]>([]);
  const [clusters, setClusters] = useState<MonteCarloCluster[]>([]);
  const [allBatchIds, setAllBatchIds] = useState<string[] | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isFetchingBatches, setIsFetchingBatches] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refetchBatches = useCallback(async () => {
    if (!isMounted.current) return;
    setIsFetchingBatches(true);
    setError(null); // Clear previous errors
    try {
      console.log("Hook: Fetching available batch IDs...");
      const batchIds = await fetchAvailableBatchIds();
      if (!isMounted.current) return;
      const sortedBatchIds = sortBatchIds(batchIds);
      console.log(`Hook: Fetched and sorted ${sortedBatchIds.length} batch IDs.`);
      setAllBatchIds(sortedBatchIds);
    } catch (err) {
      console.error("Hook: Error fetching batch IDs:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setAllBatchIds([]); // Provide empty array on error
      }
    } finally {
      if (isMounted.current) setIsFetchingBatches(false);
    }
  }, []); // isMounted is a ref, doesn't need to be dependency

  const refetchDataForBatch = useCallback(async (batchId: string) => {
    if (!isMounted.current) return;
    console.log(`Hook: Fetching data for batch ${batchId}...`);
    setIsLoadingData(true);
    setError(null);
    setData([]);
    setClusters([]);
    try {
      // 1. Fetch raw data points
      const { dataPoints } = await fetchMonteCarloDataForBatch(batchId);
      if (!isMounted.current) return;
      if (dataPoints.length === 0) {
         console.log(`Hook: No data points found for batch ${batchId}.`);
         setData([]);
         setClusters([]);
         return; // Exit early
      }
      console.log(`Hook: Fetched ${dataPoints.length} raw data points.`);

      // 2. Process points (normalize, spread, jitter)
      // Assuming normalizeAndSpreadPoints and addJitterToPoints exist and are imported
      const spreadPoints = normalizeAndSpreadPoints(dataPoints);
      const processedPoints = addJitterToPoints(spreadPoints);
      console.log(`Hook: Processed ${processedPoints.length} points (spread/jitter).`);

      // 3. Generate clusters
      const generatedClusters = await generateClusters(processedPoints);
      if (!isMounted.current) return;
      console.log(`Hook: Generated ${generatedClusters.length} clusters.`);

      // 4. Assign cluster IDs to points
      const dataWithClusters: PointWithCluster[] = processedPoints.map(point => ({
        ...point,
        cluster: generatedClusters.find(c => c.points.some(p => p.id === point.id))?.id,
      }));

      // 5. Generate cluster titles
      const clustersWithTitles = await generateClusterTitles(generatedClusters);
      if (!isMounted.current) return;
      console.log(`Hook: Generated titles for ${clustersWithTitles.length} clusters.`);

      // 6. Update state
      setData(dataWithClusters);
      setClusters(clustersWithTitles);
      console.log(`Hook: Data update complete for batch ${batchId}.`);

    } catch (err) {
      console.error(`Hook: Error fetching data for batch ${batchId}:`, err);
      if (isMounted.current) {
         setError(err instanceof Error ? err : new Error(String(err)));
         setData([]); // Clear data on error
         setClusters([]);
      }
    } finally {
      if (isMounted.current) setIsLoadingData(false);
    }
  }, []); // Add imported helpers normalizeAndSpreadPoints, addJitterToPoints if they are stable refs/functions

  // Effect to fetch batch list on mount
  useEffect(() => {
    refetchBatches();
  }, [refetchBatches]);

  // Effect to fetch data when selected batch changes
  useEffect(() => {
    if (selectedBatchId) {
      refetchDataForBatch(selectedBatchId);
    } else {
      // Clear data if no batch is selected
      setData([]);
      setClusters([]);
      setError(null);
      setIsLoadingData(false); // Not loading if no batch selected
    }
  }, [selectedBatchId, refetchDataForBatch]);

  return {
    data,
    clusters,
    allBatchIds,
    selectedBatchId,
    isLoadingData,
    isFetchingBatches,
    error,
    setSelectedBatchId,
    refetchBatches,
    refetchDataForBatch,
  };
} 