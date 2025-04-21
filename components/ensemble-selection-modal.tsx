"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  Thermometer,
  Flame,
  Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Removed unused popover imports

// Import ensemble service functions
import {
  saveEnsembleConfiguration,
  updateEnsembleConfiguration,
  getAllEnsembleConfigurations,
  deleteEnsembleConfiguration,
  type EnsembleConfiguration,
} from "@/lib/ensemble-service";

// Import from our AI service
import { modelMapping } from "@/lib/ai-service";

// Update the ModelConfig type to include reasoning flag
export type ModelConfig = {
  id: number;
  model: string;
  runsLow: number;
  runsMedium: number;
  runsHigh: number;
  enableReasoning?: boolean; // Optional flag to enable reasoning for supported models
};

export type EnsembleConfig = {
  models: ModelConfig[];
  selectedIntensity: "low" | "medium" | "high";
};

type EnsembleSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: EnsembleConfig) => void;
};

// Use the keys from modelMapping as our available models
const availableModels = Object.keys(modelMapping);

export default function EnsembleSelectionModal({
  isOpen,
  onClose,
  onSubmit,
}: EnsembleSelectionModalProps) {
  // Update the initial state with new default values
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([
    { id: 1, model: "GPT-4o", runsLow: 1, runsMedium: 0, runsHigh: 1 },
    { id: 2, model: "Claude-Sonnet-7", runsLow: 1, runsMedium: 0, runsHigh: 1 },
    {
      id: 3,
      model: "o1",
      runsLow: 1,
      runsMedium: 0,
      runsHigh: 1,
      enableReasoning: true,
    },
    {
      id: 4,
      model: "o3-mini",
      runsLow: 1,
      runsMedium: 0,
      runsHigh: 1,
      enableReasoning: true,
    },
  ]);

  const [intensityLevel, setIntensityLevel] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [activeTab, setActiveTab] = useState<string>("configure");
  const [savedEnsembles, setSavedEnsembles] = useState<EnsembleConfiguration[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ensembleName, setEnsembleName] = useState<string>("");
  const [ensembleDescription, setEnsembleDescription] = useState<string>("");
  const [currentEnsembleId, setCurrentEnsembleId] = useState<
    string | undefined
  >(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingEnsembles, setIsLoadingEnsembles] = useState<boolean>(false);

  // Reset to Configure tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("configure");
    }
  }, [isOpen]);

  // Generate a unique ID for new model rows
  const getNextId = () => {
    return Math.max(0, ...modelConfigs.map((config) => config.id)) + 1;
  };

  // Add a new model row
  const addModelRow = () => {
    // Get the first available model
    const firstModel = availableModels[0];

    // Check if it's an 'o' series model
    const isOModel =
      firstModel === "o1" || firstModel === "o3" || firstModel === "o3-mini";

    // Create config based on model type
    const newConfig: ModelConfig = {
      id: getNextId(),
      model: firstModel,
      runsLow: 1,
      // For 'o' models, medium and high runs should be 0
      runsMedium: isOModel ? 0 : 1,
      runsHigh: isOModel ? 0 : 1,
      // Add reasoning flag for 'o' models
      ...(isOModel ? { enableReasoning: false } : {}),
    };

    setModelConfigs([...modelConfigs, newConfig]);
  };

  // Remove a model row
  const removeModelRow = (id: number) => {
    // Don't allow removing the last row
    if (modelConfigs.length <= 1) return;
    setModelConfigs(modelConfigs.filter((config) => config.id !== id));
  };

  const handleModelChange = (
    id: number,
    field: keyof ModelConfig,
    value: string | number | boolean,
  ) => {
    // Create a completely new array with the updated config
    const newConfigs = modelConfigs.map((config) => {
      // Only update the config with matching id
      if (config.id !== id) {
        return config; // Return other configs unchanged
      }

      // Create a new config object
      const updatedConfig = { ...config };

      // Handle model field specifically
      if (field === "model" && typeof value === "string") {
        const currentModel = config.model;
        const newModel = value;
        const wasOModel =
          currentModel === "o1" ||
          currentModel === "o3" ||
          currentModel === "o3-mini";
        const isNowOModel =
          newModel === "o1" || newModel === "o3" || newModel === "o3-mini";

        // Update the model field
        updatedConfig.model = newModel;

        // If switching model type, adjust temperature runs accordingly
        if (wasOModel !== isNowOModel) {
          if (isNowOModel) {
            // Switching to an 'o' model - keep the runsLow value and zero out others
            // Don't change the runsLow value, preserve whatever was there
            updatedConfig.runsMedium = 0;
            updatedConfig.runsHigh = 0;
            // Add reasoning flag when switching to 'o' model
            updatedConfig.enableReasoning = false;
          } else {
            // Switching from an 'o' model to regular - initialize medium/high runs
            updatedConfig.runsMedium = 0;
            updatedConfig.runsHigh = config.runsLow > 0 ? 1 : 0; // Initialize high runs if low runs exist
            // Remove reasoning flag when switching away from 'o' model
            delete updatedConfig.enableReasoning;
          }
        }
      } else if (field === "enableReasoning" && typeof value === "boolean") {
        // Handle toggling the reasoning flag
        updatedConfig.enableReasoning = value;
      } else if (field !== "model") {
        // For non-model fields, ensure proper type handling
        if (
          field === "runsLow" ||
          field === "runsMedium" ||
          field === "runsHigh"
        ) {
          updatedConfig[field] =
            typeof value === "number" ? value : parseInt(value as string) || 0;
        } else if (field === "id") {
          // For id field, ensure it's a number
          updatedConfig.id =
            typeof value === "number" ? value : parseInt(value as string) || 0;
        }
        // Note: We don't have any other fields in ModelConfig that aren't handled above
      }

      return updatedConfig;
    });

    // Set the new configs array
    setModelConfigs([...newConfigs]);
  };

  const setIntensity = (level: "low" | "medium" | "high") => {
    setIntensityLevel(level);
  };

  // Custom close handler to reset form state
  const handleClose = () => {
    // Only reset some states if we're actually closing
    // This will ensure a fresh state when reopened
    setActiveTab("configure");

    // Call the original onClose
    onClose();
  };

  const handleSubmit = () => {
    onSubmit({
      models: modelConfigs,
      selectedIntensity: intensityLevel,
    });
    handleClose();
  };

  // Load all saved ensembles
  const loadEnsembles = async () => {
    console.log("Loading ensembles...");
    setIsLoadingEnsembles(true);
    try {
      const ensembles = await getAllEnsembleConfigurations();
      console.log(`Loaded ${ensembles.length} ensembles:`, ensembles);
      setSavedEnsembles(ensembles);
    } catch (error) {
      console.error("Failed to load ensembles:", error);
      // Show error visually if needed
      // setLoadError("Failed to load ensemble configurations")
    } finally {
      setIsLoadingEnsembles(false);
    }
  };

  // Load ensembles when the tab changes to 'load'
  useEffect(() => {
    if (activeTab === "load" && isOpen) {
      console.log("Tab changed to 'load', fetching ensembles...");
      loadEnsembles();
    }
  }, [activeTab, isOpen]);

  // Save the current ensemble configuration
  const saveEnsemble = async () => {
    if (!ensembleName.trim()) {
      setSaveError("Please provide a name for this ensemble configuration");
      return;
    }

    setIsLoading(true);
    setSaveError(null);

    try {
      const ensembleConfig: EnsembleConfiguration = {
        id: currentEnsembleId,
        name: ensembleName,
        description: ensembleDescription,
        models: modelConfigs,
        selectedIntensity: intensityLevel,
      };

      if (currentEnsembleId) {
        // Update existing ensemble
        const success = await updateEnsembleConfiguration(ensembleConfig);
        if (!success) {
          throw new Error("Failed to update ensemble configuration");
        }
      } else {
        // Save new ensemble
        const id = await saveEnsembleConfiguration(ensembleConfig);
        if (!id) {
          throw new Error("Failed to save ensemble configuration");
        }
        setCurrentEnsembleId(id);
      }

      // Reload ensembles
      await loadEnsembles();

      // Switch to the load tab to show the saved ensemble
      setActiveTab("load");
    } catch (error) {
      console.error("Error saving ensemble:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save ensemble configuration",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Load a specific ensemble configuration
  const loadEnsemble = (ensemble: EnsembleConfiguration) => {
    console.log(`Loading ensemble: ${ensemble.name}`, ensemble);

    // Set all configuration values
    setModelConfigs(ensemble.models);
    setIntensityLevel(ensemble.selectedIntensity);
    setEnsembleName(ensemble.name);
    setEnsembleDescription(ensemble.description || "");
    setCurrentEnsembleId(ensemble.id);

    // Important: First update the state, then change the tab
    // Use a slightly longer timeout to ensure state updates are processed
    setTimeout(() => {
      console.log("Switching to configure tab with loaded ensemble");
      setActiveTab("configure");
    }, 100);
  };

  // Delete an ensemble configuration
  const handleDeleteEnsemble = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the load ensemble action

    if (
      !window.confirm(
        "Are you sure you want to delete this ensemble configuration?",
      )
    ) {
      return;
    }

    setIsLoadingEnsembles(true);
    try {
      const success = await deleteEnsembleConfiguration(id);
      if (!success) {
        throw new Error("Failed to delete ensemble configuration");
      }

      // If the deleted ensemble was the current one, reset the form
      if (id === currentEnsembleId) {
        setCurrentEnsembleId(undefined);
      }

      // Reload the ensembles list
      await loadEnsembles();
    } catch (error) {
      console.error("Error deleting ensemble:", error);
      alert("Failed to delete ensemble configuration");
    } finally {
      setIsLoadingEnsembles(false);
    }
  };

  // Make sure Tab uses 'value' instead of 'defaultValue' to stay in sync with state
  // by adding a button click handler for the Load Saved tab
  const handleLoadSavedClick = () => {
    setActiveTab("load");
    setTimeout(() => {
      // Force reload of ensembles when tab is clicked
      loadEnsembles();
    }, 50);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ensemble Model Selection</DialogTitle>
          <DialogDescription>
            Configure the AI models ensemble for your solution pathway.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-between">
            <TabsTrigger value="configure" className="w-[48%]">
              Configure
            </TabsTrigger>
            <TabsTrigger
              value="load"
              className="w-[48%]"
              onClick={handleLoadSavedClick}
            >
              Load Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="space-y-6 py-4">
            {/* Save controls */}
            <div className="pb-4 border-b">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ensembleName">Ensemble Name</Label>
                  <Input
                    id="ensembleName"
                    value={ensembleName}
                    onChange={(e) => setEnsembleName(e.target.value)}
                    placeholder="My Ensemble Configuration"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ensembleDescription">
                    Description (Optional)
                  </Label>
                  <Input
                    id="ensembleDescription"
                    value={ensembleDescription}
                    onChange={(e) => setEnsembleDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
              </div>
              {saveError && (
                <p className="text-sm text-red-500 mt-2">{saveError}</p>
              )}
              <Button
                onClick={saveEnsemble}
                className="mt-4 w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {currentEnsembleId ? "Update Ensemble" : "Save Ensemble"}
                  </>
                )}
              </Button>
            </div>

            {/* Intensity Defaults */}
            <div className="pb-4 border-b">
              <Label className="block mb-2">Default Intensity</Label>
              <div className="flex gap-3">
                <Button
                  variant={intensityLevel === "low" ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    intensityLevel === "low"
                      ? "bg-slate-600 text-white"
                      : "bg-slate-100",
                  )}
                  onClick={() => setIntensity("low")}
                >
                  <Snowflake className="mr-2 h-4 w-4" /> Low (0.3)
                </Button>
                <Button
                  variant={intensityLevel === "medium" ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    intensityLevel === "medium"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-50 text-amber-700",
                  )}
                  onClick={() => setIntensity("medium")}
                >
                  <Thermometer className="mr-2 h-4 w-4" /> Medium (0.5)
                </Button>
                <Button
                  variant={intensityLevel === "high" ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    intensityLevel === "high"
                      ? "bg-red-500 text-white"
                      : "bg-red-50 text-red-700",
                  )}
                  onClick={() => setIntensity("high")}
                >
                  <Flame className="mr-2 h-4 w-4" /> High (0.7)
                </Button>
              </div>
            </div>

            {/* Matrix heading */}
            <div className="mb-2">
              <h3 className="text-sm font-medium">
                Choose number of runs at each temperature
              </h3>
            </div>

            {/* Matrix header */}
            <div className="grid grid-cols-12 gap-4 text-center text-sm font-medium text-muted-foreground">
              <div className="col-span-5">Model</div>
              <div className="col-span-2 flex items-center justify-center gap-1">
                <Snowflake className="h-3.5 w-3.5" /> Low (0.3)
              </div>
              <div className="col-span-2 flex items-center justify-center gap-1">
                <Thermometer className="h-3.5 w-3.5" /> Medium (0.5)
              </div>
              <div className="col-span-2 flex items-center justify-center gap-1">
                <Flame className="h-3.5 w-3.5" /> High (0.7)
              </div>
              <div className="col-span-1 text-center">Actions</div>
            </div>

            {/* Model rows */}
            {modelConfigs.map((config) => {
              const isOModel =
                config.model === "o1" ||
                config.model === "o3" ||
                config.model === "o3-mini";

              return (
                <div
                  key={config.id}
                  className="grid grid-cols-12 gap-4 items-center"
                >
                  <div className="col-span-5">
                    <Select
                      key={`select-${config.id}`}
                      value={config.model}
                      onValueChange={(value) => {
                        console.log(
                          `Changing model for row ${config.id} to ${value}`,
                        );
                        handleModelChange(config.id, "model", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem
                            key={`${config.id}-${model}`}
                            value={model}
                          >
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isOModel ? (
                    // For 'o' series models, allow setting runs in the low temperature cell
                    <>
                      <div className="col-span-2">
                        <Input
                          key={`runLow-${config.id}`}
                          type="number"
                          min={1}
                          max={10}
                          value={config.runsLow}
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value) || 1;
                            handleModelChange(config.id, "runsLow", value);
                          }}
                          className="text-center"
                        />
                      </div>

                      {/* Disabled inputs for medium and high temperatures */}
                      <div className="col-span-2">
                        <div className="relative group">
                          <Input
                            key={`runMedium-${config.id}`}
                            type="number"
                            disabled
                            value={0}
                            className="text-center opacity-50 cursor-not-allowed"
                          />
                          <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 p-2 bg-black text-white text-xs rounded shadow-lg w-48 z-10">
                            O-series models only support one temperature setting
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="relative group">
                          <Input
                            key={`runHigh-${config.id}`}
                            type="number"
                            disabled
                            value={0}
                            className="text-center opacity-50 cursor-not-allowed"
                          />
                          <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 p-2 bg-black text-white text-xs rounded shadow-lg w-48 z-10">
                            O-series models only support one temperature setting
                          </div>
                        </div>
                      </div>

                      {/* Reasoning toggle for 'o' series models - moved to actions column */}
                      <div className="col-span-1 flex flex-col items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeModelRow(config.id)}
                          disabled={modelConfigs.length <= 1}
                          className="h-8 w-8 text-red-500 mb-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <div className="relative group">
                          <label className="flex items-center cursor-pointer mt-1">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={!!config.enableReasoning}
                              onChange={(e) =>
                                handleModelChange(
                                  config.id,
                                  "enableReasoning",
                                  e.target.checked,
                                )
                              }
                              title="Enable reasoning steps"
                            />
                          </label>
                          <div className="hidden group-hover:block absolute right-0 bottom-full mb-2 p-2 bg-black text-white text-xs rounded shadow-lg w-48 z-10">
                            Enable access to intermediate reasoning steps
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // For regular models, show all temperature inputs
                    <>
                      <div className="col-span-2">
                        <Input
                          key={`runLow-${config.id}`}
                          type="number"
                          min={0}
                          max={10}
                          value={config.runsLow}
                          onChange={(e) =>
                            handleModelChange(
                              config.id,
                              "runsLow",
                              Number.parseInt(e.target.value) || 0,
                            )
                          }
                          className="text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          key={`runMedium-${config.id}`}
                          type="number"
                          min={0}
                          max={10}
                          value={config.runsMedium}
                          onChange={(e) =>
                            handleModelChange(
                              config.id,
                              "runsMedium",
                              Number.parseInt(e.target.value) || 0,
                            )
                          }
                          className="text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          key={`runHigh-${config.id}`}
                          type="number"
                          min={0}
                          max={10}
                          value={config.runsHigh}
                          onChange={(e) =>
                            handleModelChange(
                              config.id,
                              "runsHigh",
                              Number.parseInt(e.target.value) || 0,
                            )
                          }
                          className="text-center"
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeModelRow(config.id)}
                          disabled={modelConfigs.length <= 1}
                          className="h-8 w-8 text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add model button */}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={addModelRow}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Model
            </Button>
          </TabsContent>

          <TabsContent value="load" className="py-4">
            {isLoadingEnsembles ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : savedEnsembles.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p>No saved ensembles found.</p>
                <p className="text-sm mt-2">
                  Configure and save an ensemble to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedEnsembles.map((ensemble) => (
                  <div
                    key={ensemble.id}
                    className="border rounded-md p-4 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => loadEnsemble(ensemble)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{ensemble.name}</h3>
                        {ensemble.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {ensemble.description}
                          </p>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Models:</span>{" "}
                          {ensemble.models.length} configured
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">
                            Default Intensity:
                          </span>{" "}
                          {ensemble.selectedIntensity}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={(e) => handleDeleteEnsemble(ensemble.id!, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Confirm Selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
