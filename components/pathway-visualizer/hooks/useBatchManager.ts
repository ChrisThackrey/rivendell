import { getAvailableBatches as fetchBatches } from '@/lib/step-service'; // Renaming import for clarity
import { useEffect, useState } from 'react';

export interface BatchManagerReturn {
  availableBatches: { batch_id: string; step_count: number; latest_created_at: string }[];
  selectedBatchId: string;
  setSelectedBatchId: React.Dispatch<React.SetStateAction<string>>;
  loadAvailableBatches: () => Promise<void>;
}

export function useBatchManager(initialBatchId?: string | null): BatchManagerReturn {
  const [availableBatches, setAvailableBatches] = useState<
    { batch_id: string; step_count: number; latest_created_at: string }[]
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || "");

  const loadAvailableBatches = async () => {
    try {
      const batches = await fetchBatches();
      setAvailableBatches(batches);
      // If an initialBatchId was provided and is valid, keep it, otherwise reset.
      // This handles the case where the initialBatchId might not be in the fetched list.
      if (initialBatchId && !batches.some(b => b.batch_id === initialBatchId)) {
        setSelectedBatchId("");
      } else if (!initialBatchId) {
        setSelectedBatchId(""); // Ensure placeholder if no initial batch
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      setAvailableBatches([]); // Set to empty on error
      setSelectedBatchId("");
    }
  };

  useEffect(() => {
    loadAvailableBatches();
  }, []); // Runs on mount

  // Effect to update selectedBatchId if initialBatchId prop changes after mount
  useEffect(() => {
    if (initialBatchId) {
        setSelectedBatchId(initialBatchId);
    } else {
        // If initialBatchId becomes null/undefined, and we don't want to keep the old selection,
        // uncomment the next line. For now, it keeps the selection if initialBatchId is removed.
        // setSelectedBatchId("");
    }
  }, [initialBatchId]);

  return {
    availableBatches,
    selectedBatchId,
    setSelectedBatchId,
    loadAvailableBatches, // Expose if manual refresh is needed
  };
}