"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MonteCarloVisualizer from "@/components/monte-carlo-visualizer";
// Unused import removed
// import { fetchAvailableBatchIds } from "@/lib/monte-carlo-service"

function MonteCarloContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [_isLoading, setIsLoading] = useState(true);

  // Get the most recent batch ID or use URL batch parameter
  useEffect(() => {
    const batch = searchParams.get("batch");
    if (batch) {
      console.log(`Using URL batch parameter: ${batch}`);
      setBatchId(batch);
      setIsLoading(false);
      return;
    }

    // No longer loading a default batch, just set loading to false
    console.log("No batch specified in URL, waiting for user selection");
    setIsLoading(false);
  }, [searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center p-2 md:p-3 bg-slate-50">
      <div className="w-full max-w-full">
        <div className="flex justify-between items-center mb-3">
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pathway
          </Button>
          <h1 className="text-2xl font-bold">
            Comprehensive Monte Carlo Results
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 mb-3">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">
              This visualization shows the distribution of solution outcomes
              across multiple runs with different models and parameters. Each
              point represents a single model run, and clusters indicate similar
              solution approaches. Hover over any point to see details and
              connections to the closest related solutions.
            </p>
            {batchId ? (
              <p className="text-sm font-medium text-indigo-600">
                Viewing data for batch: {batchId}
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-600">
                Select a batch from the sidebar to view visualization data.
              </p>
            )}
          </div>
        </div>

        <MonteCarloVisualizer initialBatchId={batchId} />
      </div>
    </main>
  );
}

export default function MonteCarloPage() {
  return (
    <Suspense
      fallback={<div className="p-8">Loading Monte Carlo visualization...</div>}
    >
      <MonteCarloContent />
    </Suspense>
  );
}
