/**
 * Service for ensemble configuration management
 */
import { supabase } from "./supabase-client";
import type { ModelConfig } from "@/components/ensemble-selection-modal";

export type EnsembleConfiguration = {
  id?: string;
  name: string;
  description?: string;
  models: ModelConfig[];
  selectedIntensity: "low" | "medium" | "high";
};

/**
 * Save an ensemble configuration to the database
 */
export async function saveEnsembleConfiguration(
  ensemble: EnsembleConfiguration,
): Promise<string | null> {
  try {
    // Prepare the ensemble data for saving
    const { name, description, models, selectedIntensity } = ensemble;

    // Insert into the ensembles table
    const { data, error } = await supabase
      .from("ensembles")
      .insert({
        name,
        description: description || null,
        configuration: {
          models,
          selectedIntensity,
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error saving ensemble configuration:", error);
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Failed to save ensemble configuration:", error);
    return null;
  }
}

/**
 * Update an existing ensemble configuration
 */
export async function updateEnsembleConfiguration(
  ensemble: EnsembleConfiguration,
): Promise<boolean> {
  if (!ensemble.id) {
    console.error("Cannot update ensemble without ID");
    return false;
  }

  try {
    const { id, name, description, models, selectedIntensity } = ensemble;

    const { error } = await supabase
      .from("ensembles")
      .update({
        name,
        description: description || null,
        configuration: {
          models,
          selectedIntensity,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating ensemble configuration:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to update ensemble configuration:", error);
    return false;
  }
}

/**
 * Get all saved ensemble configurations
 */
export async function getAllEnsembleConfigurations(): Promise<
  EnsembleConfiguration[]
> {
  try {
    const { data, error } = await supabase
      .from("ensembles")
      .select("id, name, description, configuration, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching ensemble configurations:", error);
      throw error;
    }

    // Map the database records to the EnsembleConfiguration type with safe type assertions
    return (data || []).map((record) => {
      // Safely cast configuration to expected structure
      const config = record.configuration as unknown as {
        models: ModelConfig[];
        selectedIntensity: "low" | "medium" | "high";
      };

      return {
        id: record.id,
        name: record.name,
        description: record.description || undefined,
        models: config?.models || [],
        selectedIntensity: (config?.selectedIntensity || "medium") as
          | "low"
          | "medium"
          | "high",
      };
    });
  } catch (error) {
    console.error("Failed to fetch ensemble configurations:", error);
    return [];
  }
}

/**
 * Get a specific ensemble configuration by ID
 */
export async function getEnsembleConfiguration(
  id: string,
): Promise<EnsembleConfiguration | null> {
  try {
    const { data, error } = await supabase
      .from("ensembles")
      .select("id, name, description, configuration")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching ensemble configuration:", error);
      throw error;
    }

    if (!data) {
      return null;
    }

    // Safely cast configuration to expected structure
    const config = data.configuration as unknown as {
      models: ModelConfig[];
      selectedIntensity: "low" | "medium" | "high";
    };

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      models: config?.models || [],
      selectedIntensity: (config?.selectedIntensity || "medium") as
        | "low"
        | "medium"
        | "high",
    };
  } catch (error) {
    console.error("Failed to fetch ensemble configuration:", error);
    return null;
  }
}

/**
 * Delete an ensemble configuration
 */
export async function deleteEnsembleConfiguration(
  id: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("ensembles").delete().eq("id", id);

    if (error) {
      console.error("Error deleting ensemble configuration:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete ensemble configuration:", error);
    return false;
  }
}
