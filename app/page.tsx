"use client";

import { useState, useEffect, type FormEvent } from "react";
import * as Sentry from "@sentry/nextjs";
import { Send, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PathwayVisualizer from "@/components/pathway-visualizer";
import TechStackModal, { type TechOption } from "@/components/tech-stack-modal";
import TechStackCard from "@/components/tech-stack-card";
import EnsembleSelectionModal, {
  type EnsembleConfig,
} from "@/components/ensemble-selection-modal";
import EnsembleConfigCard from "@/components/ensemble-config-card";
import { getAvailableBatches, type BatchSummary } from "@/lib/step-service";
import SimilarSolutionsSection from "@/components/similar-solutions-section";
// Unused imports removed
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast";
import {
  generateSolution,
  generateEnsembleSolution,
  generateSolutionFromSimilar,
} from "@/lib/ai-service";
import CodeSnippetsSearch from "@/components/code-snippets-search";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

// Define the new color map using Tailwind colors
const MODEL_COLOR_MAP = {
  "GPT-4o": {
    name: "GPT-4o",
    hexColor: "#93c5fd",
    tailwindClass: "bg-blue-300",
  },
  "Claude-Sonnet-7": {
    name: "Claude-Sonnet-7",
    hexColor: "#c4b5fd",
    tailwindClass: "bg-violet-300",
  },
  o1: { name: "o1", hexColor: "#86efac", tailwindClass: "bg-green-300" },
  "o3-mini": {
    name: "o3-mini",
    hexColor: "#fcd34d",
    tailwindClass: "bg-amber-300",
  },
  default: {
    name: "Other",
    hexColor: "#cbd5e1",
    tailwindClass: "bg-slate-300",
  }, // Fallback color
} as const; // Use 'as const' for stricter typing

// Update getModelColor to use the map
const getModelColor = (model: string): { r: number; g: number; b: number } => {
  // Check if the model exists in the map, otherwise use default
  const colorInfo =
    model in MODEL_COLOR_MAP
      ? MODEL_COLOR_MAP[model as keyof typeof MODEL_COLOR_MAP]
      : MODEL_COLOR_MAP.default;
  const color = { r: 0, g: 0, b: 0 };
  // Convert hex to RGB values
  const hex = colorInfo.hexColor.replace("#", "");
  color.r = parseInt(hex.substring(0, 2), 16) / 255;
  color.g = parseInt(hex.substring(2, 4), 16) / 255;
  color.b = parseInt(hex.substring(4, 6), 16) / 255;
  return color;
};

// Get hex color string for selection and lines (Keep existing function)
const getSelectionColor = (
  type: "point" | "cluster" | "hover" = "cluster",
  isClusterSelected = false,
): string => {
  if (type === "point") return "#d946ef"; // Bright fuchsia for selected points
  if (type === "hover" && isClusterSelected) return "#d946ef"; // Bright fuchsia for hover when cluster is selected
  return "#4ade80"; // Brighter green for clusters and default hover
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPathways, setShowPathways] = useState(false);
  const [showTechStackModal, setShowTechStackModal] = useState(false);
  const [showEnsembleModal, setShowEnsembleModal] = useState(false);
  const [selectedTechOptions, setSelectedTechOptions] = useState<TechOption[]>(
    [],
  );
  const [ensembleConfig, setEnsembleConfig] = useState<EnsembleConfig | null>(
    null,
  );
  const [techStackSelected, setTechStackSelected] = useState(false);
  const [ensembleSelected, setEnsembleSelected] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  // State for model selection - setters not used but kept for future functionality

  // For navigation
  const router = useRouter();

  // Define model options
  const MODELS = [
    { value: "gpt-4o", display: "GPT-4o" },
    { value: "claude-3-sonnet-20240229", display: "Claude-Sonnet-7" },
    { value: "anthropic/claude-3-opus", display: "Claude-3-Opus" },
  ];

  // Batch selection state
  const [availableBatches, setAvailableBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a state variable to track if we're using a similar solution
  const [usingSimilarSolution, setUsingSimilarSolution] = useState(false);
  const [selectedSimilarSolution, setSelectedSimilarSolution] =
    useState<any>(null);

  // Add state for selected code snippets
  const [selectedCodeSnippets, setSelectedCodeSnippets] = useState<any[]>([]);
  // State for model selection and generation parameters
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [ensembleMode, setEnsembleMode] = useState<boolean>(false);

  // Fetch available batches on component mount
  useEffect(() => {
    const loadBatches = async () => {
      setIsLoadingBatches(true);
      setError(null);
      try {
        const batches = await getAvailableBatches();
        setAvailableBatches(batches);

        // Remove auto-selection of first batch
      } catch (error) {
        console.error("Error loading batches:", error);
        setError("Failed to load batches. Please try again.");

        // Track the error in Sentry
        Sentry.captureException(error, {
          tags: { component: "Home", action: "loadBatches" },
          extra: { context: "Fetching available batches" },
        });
      } finally {
        setIsLoadingBatches(false);
      }
    };

    loadBatches();
  }, [selectedBatchId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add a breadcrumb for query submission
    Sentry.addBreadcrumb({
      category: "user-action",
      message: "User submitted query",
      level: "info",
      data: { query_length: query.length },
    });

    setIsGenerating(true);
    setError(null);

    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setShowTechStackModal(true);
    }, 1000);
  };

  const handleTechStackSubmit = (options: TechOption[]) => {
    try {
      setSelectedTechOptions(options);
      setTechStackSelected(true);
      setShowEnsembleModal(true);

      // Track tech stack selection in Sentry breadcrumbs
      Sentry.addBreadcrumb({
        category: "user-action",
        message: "User selected tech stack options",
        level: "info",
        data: {
          optionsCount: options.length,
          options: options.map((opt) => opt.name),
        },
      });
    } catch (error) {
      console.error("Error handling tech stack submission:", error);

      // Track the error in Sentry
      Sentry.captureException(error, {
        tags: { component: "Home", action: "handleTechStackSubmit" },
      });
    }
  };

  const handleEnsembleSubmit = (config: EnsembleConfig) => {
    try {
      setEnsembleConfig(config);
      setEnsembleSelected(true);
      setShowPathways(true);

      // Track ensemble selection in Sentry breadcrumbs
      Sentry.addBreadcrumb({
        category: "user-action",
        message: "User submitted ensemble configuration",
        level: "info",
        data: {
          modelCount: config.models.length,
          intensity: config.selectedIntensity,
        },
      });
    } catch (error) {
      console.error("Error handling ensemble submission:", error);

      // Track the error in Sentry
      Sentry.captureException(error, {
        tags: { component: "Home", action: "handleEnsembleSubmit" },
      });
    }
  };

  const handleBatchChange = (batchId: string) => {
    // Just store the selected batch ID, no other actions until View Solutions is clicked
    setSelectedBatchId(batchId);

    // Track batch selection in Sentry breadcrumbs
    Sentry.addBreadcrumb({
      category: "user-action",
      message: "User selected a batch",
      level: "info",
      data: { batchId },
    });
  };

  // Add a new function for the View Solutions button that will handle all the batch processing
  const handleViewSolutions = () => {
    try {
      if (selectedBatchId) {
        setCurrentBatchId(selectedBatchId);
        // Reset tech stack and ensemble state since we're viewing a previous batch
        setTechStackSelected(false);
        setEnsembleSelected(false);
        setShowPathways(true);

        // Track view solutions action in Sentry breadcrumbs
        Sentry.addBreadcrumb({
          category: "user-action",
          message: "User viewed solutions for batch",
          level: "info",
          data: { batchId: selectedBatchId },
        });
      }
    } catch (error) {
      console.error("Error handling view solutions:", error);

      // Track the error in Sentry
      Sentry.captureException(error, {
        tags: { component: "Home", action: "handleViewSolutions" },
      });
    }
  };

  const handleGenerate = async () => {
    const finalBatchId = currentBatchId || `batch-${Date.now()}`;

    try {
      setIsGenerating(true);
      setSteps([]);

      let solution;
      const selectedModelOption = MODELS.find((m) => m.value === selectedModel);
      const modelName = selectedModelOption?.display || selectedModel;

      if (usingSimilarSolution && selectedSimilarSolution) {
        // Use the similar solution as a base
        console.log("Generating solution based on similar solution");
        solution = await generateSolutionFromSimilar(
          query,
          selectedSimilarSolution,
          selectedModel,
          temperature,
          finalBatchId,
          // Pass the selected code snippets to similar solution generation
          selectedCodeSnippets.length > 0 ? selectedCodeSnippets : undefined,
        );
      } else if (ensembleMode && ensembleConfig) {
        // Generate ensemble solution with multiple models
        solution = await generateEnsembleSolution(
          query,
          ensembleConfig.models, // Pass just the models array from the config
          temperature,
          finalBatchId,
          // Pass the selected code snippets
          selectedCodeSnippets.length > 0 ? selectedCodeSnippets : undefined,
        );
      } else {
        // Generate solution with single model
        solution = await generateSolution(
          query,
          selectedModel,
          temperature,
          selectedTechOptions.map((opt) => opt.name).join(","), // Join tech options into a string
          finalBatchId,
          true, // enableReasoning
          // Pass the selected code snippets
          selectedCodeSnippets.length > 0 ? selectedCodeSnippets : undefined,
        );
      }

      setSteps(solution.steps);
      router.push(
        `/gant?batch=${finalBatchId}&mode=${ensembleMode ? "ensemble" : "single"}`,
      );
    } catch (error) {
      console.error("Error generating solution:", error);
      toast({
        title: "Error",
        description: "An error occurred while generating the solution.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a function to handle importing code snippets
  const handleImportCodeSnippets = (
    snippets: { filename: string; description?: string }[],
  ) => {
    setSelectedCodeSnippets(snippets as any[]);

    // Optionally update the prompt to include references to the snippets
    if (snippets.length > 0) {
      const snippetsList = snippets
        .map((s) => `- ${s.filename}: ${s.description || "No description"}`)
        .join("\n");

      const updatedPrompt =
        query +
        `\n\nPlease include the following code components from my previous projects:\n${snippetsList}\n`;

      setQuery(updatedPrompt);

      toast({
        title: "Code snippets added",
        description: `${snippets.length} snippet${snippets.length > 1 ? "s" : ""} included in your prompt.`,
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-slate-50">
      <div className="w-full max-w-6xl">
        <Card className="mb-8 max-w-4xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Dev Pathway Visualizer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  placeholder="What would you like to build?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full min-h-[120px] text-lg p-4 rounded-md border border-input bg-background resize-y"
                  disabled={isGenerating || techStackSelected}
                />
              </div>
              <div className="flex flex-col justify-end mb-[1px]">
                <Button
                  type="submit"
                  size="icon"
                  className="h-14 w-14"
                  disabled={isGenerating || !query.trim() || techStackSelected}
                >
                  {isGenerating ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </form>

            {/* Show error message if any */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remove the redundant Solution Batch Selector card */}

        {techStackSelected && (
          <div className="mb-8" id="tech-stack">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Tech Stack Configuration
            </div>
            <TechStackCard
              id="tech-stack-card"
              selectedOptions={selectedTechOptions}
            />
          </div>
        )}

        {ensembleSelected && ensembleConfig && !showPathways && (
          <div className="mb-8" id="ensemble-config">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Ensemble Selection
            </div>
            <EnsembleConfigCard
              id="ensemble-config-card"
              models={ensembleConfig.models}
              selectedIntensity={ensembleConfig.selectedIntensity}
            />
          </div>
        )}

        {showPathways && (
          <PathwayVisualizer
            query={query}
            selectedModels={ensembleConfig?.models || []}
            selectedIntensity={ensembleConfig?.selectedIntensity || "medium"}
            selectedTechStack={selectedTechOptions}
            initialBatchId={currentBatchId || ""}
            includeAllDecisionTypes={true}
            showConnections={true}
          />
        )}

        {/* Always show the batch selector at the bottom */}
        <div className="mt-8 max-w-4xl mx-auto w-full">
          {!showPathways && (
            <div className="flex items-center mb-4">
              <div className="text-sm font-medium text-slate-700 mr-2">
                Select Solution Batch:
              </div>
              {isLoadingBatches ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="text-sm text-slate-500">Loading...</span>
                </div>
              ) : availableBatches.length > 0 ? (
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={selectedBatchId || undefined}
                    onValueChange={handleBatchChange}
                  >
                    <SelectTrigger className="h-9 w-64 text-sm border-slate-300 bg-white">
                      <SelectValue placeholder="Select Batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBatches.map((batch) => (
                        <SelectItem
                          key={batch.batch_id}
                          value={batch.batch_id || "placeholder-value"}
                          className="text-sm"
                        >
                          {batch.batch_id.substring(6, 14)} ({batch.step_count}{" "}
                          steps)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    onClick={handleViewSolutions}
                    disabled={!selectedBatchId}
                    className="bg-black hover:bg-gray-800"
                  >
                    View Solutions
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-slate-500">
                  No saved solutions available
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <TechStackModal
        isOpen={showTechStackModal}
        onClose={() => setShowTechStackModal(false)}
        onSubmit={handleTechStackSubmit}
      />

      <EnsembleSelectionModal
        isOpen={showEnsembleModal}
        onClose={() => setShowEnsembleModal(false)}
        onSubmit={handleEnsembleSubmit}
      />

      {query && query.trim().length > 20 && !usingSimilarSolution && (
        <SimilarSolutionsSection
          prompt={query}
          similarityThreshold={0.7}
          maxResults={3}
          onUseSolution={(solution) => {
            setUsingSimilarSolution(true);
            setSelectedSimilarSolution(solution);
            toast({
              title: "Using similar solution",
              description: `Starting with an existing solution (${(solution.similarity * 100).toFixed(1)}% match) as a base`,
            });
          }}
        />
      )}

      {usingSimilarSolution && selectedSimilarSolution && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                Using similar solution as template
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUsingSimilarSolution(false);
                setSelectedSimilarSolution(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Similarity: {(selectedSimilarSolution.similarity * 100).toFixed(1)}%
          </p>
        </div>
      )}

      {/* Add the CodeSnippetsSearch component in the prompt section */}
      <div className="flex items-center gap-2 mt-2">
        <CodeSnippetsSearch
          onImportSnippets={handleImportCodeSnippets}
          currentPrompt={query}
        />

        {selectedCodeSnippets.length > 0 && (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
            {selectedCodeSnippets.length} snippet
            {selectedCodeSnippets.length > 1 ? "s" : ""} included
          </Badge>
        )}
      </div>
    </main>
  );
}
