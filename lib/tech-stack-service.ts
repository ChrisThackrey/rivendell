import { supabase } from "./supabase-client";
import { TechOption } from "@/components/tech-stack-modal";

export type TechStackConfig = {
  id?: string;
  name: string;
  options: TechOption[];
};

/**
 * Save a tech stack configuration to the database
 */
export async function saveTechStackConfig(config: TechStackConfig) {
  try {
    const { data, error } = await supabase
      .from("configurations")
      .insert({
        name: config.name,
        tech_stack_config: {
          options: config.options,
        },
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving tech stack configuration:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Failed to save tech stack configuration:", error);
    throw error;
  }
}

/**
 * Fetch all saved tech stack configurations
 */
export async function getTechStackConfigs() {
  try {
    const { data, error } = await supabase
      .from("configurations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tech stack configurations:", error);
      throw error;
    }

    return data.map((item) => ({
      id: item.id,
      name: item.name,
      options: (item.tech_stack_config as { options: TechOption[] }).options,
    }));
  } catch (error) {
    console.error("Failed to fetch tech stack configurations:", error);
    throw error;
  }
}

/**
 * Delete a tech stack configuration
 */
export async function deleteTechStackConfig(id: string) {
  try {
    const { error } = await supabase
      .from("configurations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting tech stack configuration:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete tech stack configuration:", error);
    throw error;
  }
}
