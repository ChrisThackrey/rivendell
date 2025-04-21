"use client";

import { Button } from "@/components/ui/button";
import { GanttClientWrapper } from "@/components/ui/gantt-client-wrapper";
import { WeeklyGanttWrapper } from "@/components/ui/weekly-gantt";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAvailableBatches } from "@/lib/step-service";
import type { GanttDataResponse } from "@/lib/zod-schemas";
import { AlertCircle, RefreshCw } from "lucide-react";

// Alert component direct imports to avoid errors
interface AlertProps {
  children: React.ReactNode;
  variant?: "default" | "destructive";
  className?: string;
}

const Alert = ({
  children,
  variant = "default",
  className = "",
}: AlertProps) => (
  <div
    className={`relative w-full rounded-lg border p-4 ${
      variant === "destructive"
        ? "border-red-500/50 text-red-500"
        : "bg-background text-foreground"
    } ${className}`}
  >
    {children}
  </div>
);

interface AlertTitleProps {
  children: React.ReactNode;
  className?: string;
}

const AlertTitle = ({ children, className = "" }: AlertTitleProps) => (
  <h5 className={`mb-1 font-medium leading-none tracking-tight ${className}`}>
    {children}
  </h5>
);

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const AlertDescription = ({
  children,
  className = "",
}: AlertDescriptionProps) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`}>{children}</div>
);

// Import or declare the port detection utilities
const getApiBaseUrl = (path: string = ""): string => {
  // Default to relative URL for production or server-side
  if (typeof window === "undefined") {
    return path;
  }

  const currentUrl = window.location;
  const isLocalhost =
    currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1";

  // If we're not on localhost, just use the relative path
  if (!isLocalhost) {
    return path;
  }

  // For localhost, we need to handle port detection
  // First, try to get the port from localStorage if previously detected
  const storedPort = localStorage.getItem("api_port");

  // If we have a stored port and it's a reasonable number, use it
  if (storedPort && /^\d{4,5}$/.test(storedPort)) {
    return `${currentUrl.protocol}//${currentUrl.hostname}:${storedPort}${path}`;
  }

  // If we're on port 3000, but the API might be on another port (common in development)
  // Ports 3000-3006 are commonly used by Next.js
  const possibleApiPorts = ["3004", "3001", "3002", "3003", "3005", "3006"];

  // If current port is in our list, use it first, otherwise try other ports
  const allPorts = currentUrl.port
    ? [
        currentUrl.port,
        ...possibleApiPorts.filter((p) => p !== currentUrl.port),
      ]
    : possibleApiPorts;

  // Return first option for immediate use
  return `${currentUrl.protocol}//${currentUrl.hostname}:${allPorts[0]}${path}`;
};

const detectWorkingApiPort = async (): Promise<string | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  const currentUrl = window.location;
  const isLocalhost =
    currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1";

  // Only run detection on localhost
  if (!isLocalhost) {
    return null;
  }

  // Possible ports to try
  const possibleApiPorts = [
    "3004",
    "3001",
    "3002",
    "3003",
    "3005",
    "3006",
    "3000",
  ];

  // If current port is in our list, try it first, otherwise try all ports
  const allPorts = currentUrl.port
    ? [
        currentUrl.port,
        ...possibleApiPorts.filter((p) => p !== currentUrl.port),
      ]
    : possibleApiPorts;

  // Try each port sequentially
  for (const port of allPorts) {
    try {
      // Make a test request to the debug endpoint which should be lighter
      const url = `${currentUrl.protocol}//${currentUrl.hostname}:${port}/api/debug`;
      const response = await fetch(url, {
        method: "OPTIONS",
        mode: "cors",
        cache: "no-cache",
      });

      if (response.status === 204) {
        // Found working port, store it
        localStorage.setItem("api_port", port);
        console.log(`API port detection successful: ${port}`);
        return port;
      }
    } catch (_error) {
      console.log(`Port ${port} not working or CORS error`);
    }
  }

  console.error("Could not detect a working API port");
  return null;
};

// Add a type for the feature
interface GanttFeature {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: { id: string; name: string; color: string };
  group: { id: string; name: string };
  product: { id: string; name: string };
  owner: { id: string; name: string };
  initiative: { id: string; name: string };
  release: { id: string; name: string };
}

// Client component that handles useSearchParams hook
function GanttPageContent() {
  const searchParams = useSearchParams();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [availableBatches, setAvailableBatches] = useState<
    Array<{ batch_id: string; step_count: number }>
  >([]);
  const [ganttData, setGanttData] = useState<GanttDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<{
    message: string;
    type: "fetch" | "gantt" | "general";
    status?: number;
  } | null>(null);
  const [title, setTitle] = useState("Project Roadmap");
  const [isFetchingBatches, setIsFetchingBatches] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [_retryCount, setRetryCount] = useState(0);
  const [isPortDetecting, setIsPortDetecting] = useState(false);
  const [_detectedPort, setDetectedPort] = useState<string | null>(null);
  // Add state for view mode (weekly or monthly)
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");

  // Fetch available batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      setIsFetchingBatches(true);
      setError(null);

      try {
        const batches = await getAvailableBatches();
        setAvailableBatches(batches);

        if (batches.length === 0) {
          setError({
            message:
              "No batches found. Please create a batch with steps first.",
            type: "fetch",
          });
          return;
        }

        // If a batch ID is provided in the URL, use it
        const batchIdFromUrl = searchParams.get("batchId");
        if (
          batchIdFromUrl &&
          batches.some((batch) => batch.batch_id === batchIdFromUrl)
        ) {
          setBatchId(batchIdFromUrl);
        } else if (batches.length > 0) {
          // Otherwise use the first available batch
          setBatchId(batches[0].batch_id);
        }
      } catch (error) {
        console.error("Error fetching batches:", error);
        setError({
          message: "Failed to load available batches. Please try again later.",
          type: "fetch",
        });
      } finally {
        setIsFetchingBatches(false);
      }
    };

    fetchBatches();
  }, [searchParams]);

  // Run port detection on mount once
  useEffect(() => {
    const detectPort = async () => {
      if (typeof window === "undefined") return;

      setIsPortDetecting(true);
      try {
        const port = await detectWorkingApiPort();
        setDetectedPort(port);
        console.log(`API port detection result: ${port}`);
      } catch (error) {
        console.error("Port detection failed:", error);
      } finally {
        setIsPortDetecting(false);
      }
    };

    detectPort();
  }, []);

  // Function to generate Gantt chart data from the API
  const generateGanttData = async () => {
    if (!batchId) {
      setError({
        message: "No batch ID selected. Please select a batch first.",
        type: "gantt",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsFallback(false);

    try {
      // Use our port detection utility for API URL
      const apiBaseUrl = getApiBaseUrl("/api/gantt-data");
      console.log(`Sending request to: ${apiBaseUrl}`);

      const response = await fetch(apiBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batchId }),
        mode: "cors",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific error cases with user-friendly messages
        if (
          response.status === 404 &&
          errorData.error &&
          errorData.error.includes("No steps found")
        ) {
          setError({
            message: `No steps found for this batch. Please try another batch or add steps to this batch first.`,
            type: "gantt",
            status: 404,
          });
          return;
        }

        if (response.status === 400) {
          setError({
            message:
              "Invalid request. Please ensure you have a valid batch ID.",
            type: "gantt",
            status: 400,
          });
          return;
        }

        if (response.status === 500) {
          setError({
            message:
              "Server error while generating Gantt data. Please try again later or contact support.",
            type: "gantt",
            status: 500,
          });
          return;
        }

        throw new Error(
          `API error (${response.status}): ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();

      // Check if this is a fallback response
      if (data.isFallback) {
        setIsFallback(true);
      }

      setGanttData(data);
      setTitle(
        data.isFallback
          ? "AI-Generated Project Roadmap (Fallback)"
          : "AI-Generated Project Roadmap",
      );
    } catch (error) {
      console.error("Error generating Gantt data:", error);
      setError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate Gantt data",
        type: "gantt",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Retry batch fetching
  const retryFetchBatches = async () => {
    const fetchBatches = async () => {
      setIsFetchingBatches(true);
      setError(null);

      try {
        const batches = await getAvailableBatches();
        setAvailableBatches(batches);

        if (batches.length === 0) {
          setError({
            message:
              "No batches found. Please create a batch with steps first.",
            type: "fetch",
          });
          return;
        }

        // If a batch ID is provided in the URL, use it
        const batchIdFromUrl = searchParams.get("batchId");
        if (
          batchIdFromUrl &&
          batches.some((batch) => batch.batch_id === batchIdFromUrl)
        ) {
          setBatchId(batchIdFromUrl);
        } else if (batches.length > 0) {
          // Otherwise use the first available batch
          setBatchId(batches[0].batch_id);
        }
      } catch (error) {
        console.error("Error fetching batches:", error);
        setError({
          message: "Failed to load available batches. Please try again later.",
          type: "fetch",
        });
      } finally {
        setIsFetchingBatches(false);
      }
    };

    await fetchBatches();
  };

  // Render error message with retry option
  const renderError = () => {
    if (!_error) return null;

    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{_error.message}</span>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={
                _error.type === "fetch" ? retryFetchBatches : generateGanttData
              }
              disabled={isLoading || isFetchingBatches}
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Retry with API
            </Button>

            {_error.type === "gantt" && (
              <Button
                variant="default"
                size="sm"
                className="self-start bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleUseFallbackData}
                disabled={isLoading}
              >
                Generate Chart Locally (Recommended)
              </Button>
            )}
          </div>

          {_error.type === "gantt" && (
            <p className="text-xs mt-1">
              <strong>Tip:</strong> The &quot;Generate Chart Locally&quot;
              option creates the chart directly in your browser without
              requiring the API.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  // Handler for using fallback data
  const handleUseFallbackData = () => {
    setRetryCount((count) => count + 1);
    void generateFallbackData();
  };

  // Function to generate fallback data
  const generateFallbackData = async () => {
    if (!batchId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use our port detection utility for API URL
      const apiDebugUrl = getApiBaseUrl(`/api/debug-steps?batchId=${batchId}`);
      console.log(`Using debug URL: ${apiDebugUrl}`);

      // Rather than using the complex gantt-data endpoint, use our simpler debug endpoint
      const debugResponse = await fetch(apiDebugUrl, {
        mode: "cors",
        credentials: "same-origin",
      });

      if (!debugResponse.ok) {
        throw new Error(`Debug API error: ${debugResponse.status}`);
      }

      const debugData = await debugResponse.json();
      console.log("Using step data from debug API:", debugData);

      // Create a more wide-spanning timeline for the Gantt chart
      // Start 3 months ago, end 9 months in the future (12 months total)
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      const nineMonthsFromNow = new Date(today);
      nineMonthsFromNow.setMonth(today.getMonth() + 9);

      // Create 5 phases with more spread-out timeframes
      const totalDuration =
        nineMonthsFromNow.getTime() - threeMonthsAgo.getTime();
      const phaseDuration = totalDuration / 5; // 5 phases over 12 months

      const phases = [
        {
          name: "Initial Planning",
          start: threeMonthsAgo,
          end: new Date(threeMonthsAgo.getTime() + phaseDuration),
        },
        {
          name: "Architecture Design",
          start: new Date(threeMonthsAgo.getTime() + phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
        },
        {
          name: "Core Implementation",
          start: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
        },
        {
          name: "Testing & Refinement",
          start: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
        },
        {
          name: "Deployment",
          start: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
          end: nineMonthsFromNow,
        },
      ];

      // Get step titles to use for features
      const stepTitles =
        debugData.highestScoringSteps?.map(
          (step: any) => step.step_data?.title,
        ) || [];

      // Create gantt data structure
      const features: GanttFeature[] = [];
      let featureId = 1;

      // Create features for each phase with wider durations
      phases.forEach((phase, phaseIndex) => {
        // Default feature names if no step titles available
        const defaultNames = [
          "Project Setup",
          "Requirements Analysis",
          "Research",
          "Design Planning",
          "Resource Allocation",
        ];

        // Add features to this phase - aim for 3-4 features per phase instead of 5
        const numFeatures = Math.min(3, stepTitles.length - phaseIndex * 3);
        for (let i = 0; i < numFeatures; i++) {
          // Wider feature durations - approximately 4-6 weeks each with more overlap
          const segmentDuration =
            (phase.end.getTime() - phase.start.getTime()) / 3; // 1/3 of phase duration
          const featureStart = new Date(
            phase.start.getTime() + (i * segmentDuration) / 1.5,
          ); // More overlap between features
          const featureEnd = new Date(
            featureStart.getTime() + segmentDuration * 0.9,
          ); // 90% of segment

          // Determine status based on current date
          let status;
          if (today > featureEnd) {
            status = { id: "3", name: "Done", color: "#10B981" };
          } else if (today >= featureStart && today <= featureEnd) {
            status = { id: "2", name: "In Progress", color: "#F59E0B" };
          } else {
            status = { id: "1", name: "Planned", color: "#6B7280" };
          }

          // Get feature name from step titles or use default
          const stepIndex = phaseIndex * 3 + i;
          const featureName =
            stepTitles[stepIndex] ||
            defaultNames[i % defaultNames.length] ||
            `Feature ${featureId}`;

          features.push({
            id: String(featureId++),
            name: featureName,
            startAt: featureStart.toISOString(),
            endAt: featureEnd.toISOString(),
            status: status,
            group: { id: String(phaseIndex + 1), name: phase.name },
            product: { id: "1", name: "Project Implementation" },
            owner: { id: String(i + 1), name: "Team Member" },
            initiative: { id: "1", name: "Project Development" },
            release: { id: "1", name: `v${phaseIndex + 1}.${i + 1}` },
          });
        }
      });

      // Create markers for phase transitions
      const markers = phases.map((phase, index) => ({
        id: String(index + 1),
        date: phase.start.toISOString(),
        label: index === 0 ? "Project Kickoff" : phase.name + " Start",
        className: "bg-blue-100 text-blue-900",
      }));

      // Add final marker
      markers.push({
        id: String(phases.length + 1),
        date: nineMonthsFromNow.toISOString(),
        label: "Project Launch",
        className: "bg-red-100 text-red-900",
      });

      // Add current date marker
      markers.push({
        id: String(phases.length + 2),
        date: today.toISOString(),
        label: "Today",
        className: "bg-green-100 text-green-900",
      });

      const ganttData = {
        statuses: [
          { id: "1", name: "Planned", color: "#6B7280" },
          { id: "2", name: "In Progress", color: "#F59E0B" },
          { id: "3", name: "Done", color: "#10B981" },
        ],
        features: features,
        markers: markers,
        isFallback: true,
        isClientFallback: true,
      };

      setGanttData(ganttData);
      setTitle("AI-Generated Project Roadmap (Local Fallback)");
      setIsFallback(true);
    } catch (error) {
      console.error("Error using fallback data:", error);
      setError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate fallback data",
        type: "gantt",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">
            Interactive Gantt chart visualization for project planning and
            management.
          </p>

          {/* Add view mode toggle */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">View Mode:</span>
            <div className="flex gap-1 p-1 border rounded-md">
              <button
                className={`px-3 py-1 text-sm rounded-sm ${
                  viewMode === "weekly"
                    ? "bg-primary text-white"
                    : "hover:bg-muted"
                }`}
                onClick={() => setViewMode("weekly")}
              >
                Weekly
              </button>
              <button
                className={`px-3 py-1 text-sm rounded-sm ${
                  viewMode === "monthly"
                    ? "bg-primary text-white"
                    : "hover:bg-muted"
                }`}
                onClick={() => setViewMode("monthly")}
              >
                Monthly
              </button>
            </div>
          </div>

          {batchId && !ganttData && (
            <div className="mt-2 space-y-2">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md mb-2">
                <p className="text-blue-800 text-sm flex items-center justify-between">
                  <span>
                    <span className="font-semibold">Tip:</span> If you&apos;re
                    experiencing API errors, try generating the chart locally.
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-blue-500 hover:bg-blue-600 ml-2"
                    onClick={handleUseFallbackData}
                    disabled={isLoading}
                  >
                    Generate Chart Locally
                  </Button>
                </p>
              </div>

              {isPortDetecting && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm flex items-center">
                    <span className="mr-2">
                      <svg
                        className="animate-spin h-4 w-4 text-blue-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </span>
                    <span>Detecting optimal API port...</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {renderError()}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {ganttData
                ? "AI-Generated Development Timeline"
                : "Video Editor Pro Roadmap"}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#6B7280]" />
                <span className="text-sm">Planned</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                <span className="text-sm">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                <span className="text-sm">Done</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Drag items to adjust dates. Right-click for actions. Scroll to
            navigate timeline.
          </p>
        </div>

        {ganttData && (
          <div className="mt-2 mb-4">
            {isFallback ? (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-amber-800 text-sm">
                  <span className="font-semibold">Note:</span> Using expanded
                  timeline with 12-month duration (3 months ago to 9 months
                  ahead).
                  {viewMode === "weekly"
                    ? " The chart shows features aligned to weekly boundaries for better sprint planning."
                    : " The chart shows wider epics with 4-6 week durations and increased overlap for better visibility of project scope."}
                </p>
              </div>
            ) : (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 text-sm">
                  <span className="font-semibold">Success:</span> Gantt chart
                  generated successfully with AI-optimized task durations.
                  {viewMode === "weekly"
                    ? " Displaying weekly view for granular sprint planning."
                    : " Displaying monthly view for broader project planning."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Conditionally render either the weekly or monthly gantt chart */}
        {viewMode === "weekly" ? (
          <WeeklyGanttWrapper ganttData={ganttData || undefined} />
        ) : (
          <GanttClientWrapper ganttData={ganttData || undefined} />
        )}

        <div className="rounded-lg border p-4 bg-muted/50">
          <h3 className="font-medium mb-2">How It Works</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              • The Gantt chart automatically selects the highest-scoring step
              from each level
            </li>
            <li>
              • AI analyzes these steps to create a strategic project timeline
              with 5 phases
            </li>
            <li>
              • Each phase contains 4-6 epics (features) derived from your
              highest-quality steps
            </li>
            <li>
              • The timeline ensures continuous coverage with no gaps between
              tasks
            </li>
            <li>
              • Current date determines which tasks are marked as
              &quot;Done&quot;, &quot;In Progress&quot;, or &quot;Planned&quot;
            </li>
            <li>
              • Toggle between weekly and monthly views to plan your project at
              different time scales
            </li>
          </ul>
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h3 className="font-medium mb-2">Usage Instructions</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              • Toggle between weekly and monthly views using the view mode
              buttons
            </li>
            <li>
              • Hover between time periods and click the plus icon to add a new
              feature
            </li>
            <li>• Drag features to reschedule them</li>
            <li>• Click and drag the edges of a feature to resize</li>
            <li>• Right-click on a feature for additional options</li>
            <li>• Hover at the top of the timeline to add markers</li>
          </ul>
        </div>

        {availableBatches.length > 0 && (
          <div className="w-full mt-4">
            <Button
              onClick={generateGanttData}
              disabled={isLoading || !batchId || isFetchingBatches}
              className="w-full"
              size="lg"
            >
              {isLoading
                ? "Generating..."
                : "View Recommended Epics on Gantt Chart"}
            </Button>

            {batchId && (
              <>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Using batch: {batchId} (
                  {availableBatches.find((b) => b.batch_id === batchId)
                    ?.step_count || 0}{" "}
                  steps) — The Gantt chart will select the highest-scoring steps
                  from each level to create the timeline
                </p>

                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      console.log(`Debugging batch: ${batchId}`);
                      try {
                        // Use our port detection utility for API URL
                        const debugUrl = getApiBaseUrl(
                          `/api/debug-steps?batchId=${batchId}`,
                        );
                        console.log(`Debug URL: ${debugUrl}`);

                        const response = await fetch(debugUrl, {
                          mode: "cors",
                          credentials: "same-origin",
                        });
                        const data = await response.json();
                        console.log("Debug report for batch:", data);
                        alert(
                          `Debug report for batch: ${batchId}\n\nFound ${data.stepsCount} steps (${data.stepsInDocsCount} in document table)\n\nCheck browser console for full details`,
                        );
                      } catch (error) {
                        console.error("Error fetching debug data:", error);
                        alert(
                          "Error fetching debug data. Check console for details.",
                        );
                      }
                    }}
                  >
                    Debug Batch Data
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Main export with Suspense boundary
export default function GantPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8 px-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Project Roadmap
              </h1>
              <p className="text-muted-foreground">
                Loading Gantt chart visualization...
              </p>
            </div>
            <div className="w-full h-[600px] flex items-center justify-center bg-muted/20 rounded-lg border">
              <div className="flex flex-col items-center justify-center">
                <svg
                  className="animate-spin h-10 w-10 text-primary/50 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <GanttPageContent />
    </Suspense>
  );
}
