"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MonteCarloVisualizer from "@/components/monte-carlo-visualizer";
import { ErrorBoundary } from "react-error-boundary";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// Assume Solution type exists alongside EnsembleConfig
import type { EnsembleConfig, Solution } from "@/lib/types/mc";
import { fetchEnsembleConfigs, fetchAllSolutions } from "@/lib/data/monte-carlo";
// Unused import removed
// import { fetchAvailableBatchIds } from "@/lib/monte-carlo-service"

export const revalidate = 0; // Force dynamic rendering

interface MonteCarloPageProps {
  searchParams?: {
    ensembleId?: string;
  };
}

const MonteCarloPage = async ({ searchParams }: MonteCarloPageProps) => {
  const ensembleId = searchParams?.ensembleId;
  let ensembleConfigs: EnsembleConfig[] = [];
  let selectedConfig: EnsembleConfig | null = null;
  // Use the specific Solution type instead of any[]
  let allSolutions: Solution[] = [];

  try {
    ensembleConfigs = await fetchEnsembleConfigs();
    // Fetch all solutions regardless of whether an ensembleId is selected
    // This might be needed for other parts of the page or future features
    allSolutions = await fetchAllSolutions(); // Fetch all solutions (assuming fetchAllSolutions returns Solution[])
  } catch (error) {
    console.error("Error fetching data for Monte Carlo page:", error);
    // Handle error appropriately, maybe show an error message to the user
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense
        fallback={
          <div className="p-8">Loading Monte Carlo visualization...</div>
        }
      >
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
                {ensembleId ? (
                  <p className="text-sm font-medium text-indigo-600">
                    Viewing data for ensemble: {ensembleId}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-amber-600">
                    Select an ensemble from the sidebar to view visualization data.
                  </p>
                )}
              </div>
            </div>

            <ResizablePanelGroup>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={75}>
                <MonteCarloVisualizer
                  ensembleConfigs={ensembleConfigs}
                  initialSelectedConfigId={ensembleId}
                  allSolutions={allSolutions}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </main>
      </Suspense>
    </ErrorBoundary>
  );
};

export default dynamic(() => Promise.resolve(MonteCarloPage), {
  ssr: false,
});
