import { getAvailableBatches as fetchBatches } from '@/lib/step-service'; // Renaming import for clarity
import { checkSupabaseConnection } from '@/lib/supabase-client'; // Import connection check
import { captureException } from '@/lib/error-reporting'; // Import error reporting
import { useEffect, useState } from 'react';

export interface BatchManagerReturn {
  availableBatches: { batch_id: string; step_count: number; latest_created_at: string }[];
  selectedBatchId: string;
  setSelectedBatchId: React.Dispatch<React.SetStateAction<string>>;
  loadAvailableBatches: () => Promise<void>;
  isConnected: boolean; // Add connection status
}

export function useBatchManager(initialBatchId?: string | null): BatchManagerReturn {
  const [availableBatches, setAvailableBatches] = useState<
    { batch_id: string; step_count: number; latest_created_at: string }[]
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || "");
  const [isConnected, setIsConnected] = useState<boolean>(true); // Assume connection until proven otherwise

  const loadAvailableBatches = async () => {
    try {
      // First check if we're connected to Supabase
      const connected = await checkSupabaseConnection();
      setIsConnected(connected);

      if (!connected) {
        console.error("Cannot fetch batches - Supabase is not connected");
        captureException(new Error("Supabase connection failed"), {
          context: "Error fetching available batches",
          initialBatchId
        });
        setAvailableBatches([]); // Set to empty on connection error
        setSelectedBatchId("");
        return;
      }

      // If connected, proceed with fetching batches
      console.log("Fetching available batches...");
      const batches = await fetchBatches();

      console.log(`Fetched ${batches.length} batches`);
      setAvailableBatches(batches);

      // If an initialBatchId was provided and is valid, keep it, otherwise reset.
      // This handles the case where the initialBatchId might not be in the fetched list.
      if (initialBatchId && !batches.some(b => b.batch_id === initialBatchId)) {
        console.log(`Initial batch ID ${initialBatchId} not found in available batches`);
        setSelectedBatchId("");
      } else if (!initialBatchId) {
        setSelectedBatchId(""); // Ensure placeholder if no initial batch
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      captureException(error, {
        context: "Error fetching available batches",
        initialBatchId
      });
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
    isConnected, // Expose connection status
  };
}