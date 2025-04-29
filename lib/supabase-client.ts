import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database.types";

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Type definition for code files
export type CodeFile = {
  filename: string;
  code: string;
  language?: string;
};

// Custom types for document metadata
export type ScoreMetrics = {
  accuracy: number; // 0-100%
  complexity: number; // 0-100%
  computeEfficiency: number; // 0-100%
  readability: number; // 0-100%
  costEfficiency: number; // 0-100%
  memoryUsage: number; // 0-100%
  codeQuality?: number;
};

export type DecisionType = "RECOMMENDED" | "VIABLE" | "PROBLEMATIC";

export type DocumentMetadata = {
  model: string;
  runtime: string;
  cost: number;
  runId: number;
  temperature: number;
  stepNumber?: number;
  level?: number;
  stepTitle?: string;
  enableReasoning?: boolean;
  decision?: DecisionType;
  type?: "accepted" | "secondary" | "rejected";
  scores?: ScoreMetrics;
  comparisonNotes?: string;
  content?: string;
  // Added metrics at top level for directly storing metrics with the document
  metrics?: {
    executionTime?: string;
    complexity?: string;
    memoryUsage?: string;
    lineCount?: number;
    codeQuality?: number;
  };
  structuredSolution?: Record<string, unknown>;
  structuredSteps?: Array<{
    title: string;
    description: string;
    metrics: {
      executionTime: string;
      complexity: string;
      memoryUsage: string;
      lineCount: number;
      codeQuality: number;
    };
  }>;
  structuredFinalSolution?: {
    title: string;
    description: string;
    metrics: {
      executionTime: string;
      complexity: string;
      memoryUsage: string;
      lineCount: number;
    };
  };
  // Added code files
  codeFiles?: CodeFile[];
  // File tree representation for this step/solution
  fileTree?: string;
  // List of filenames modified/created in this step
  modifiedFiles?: string[];
};

// Interface for vector similarity search results
export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  similarity: number;
}

// Create Supabase client
export const supabase = createClient<Database>(
  supabaseUrl || "",
  supabaseAnonKey || "",
);

// Check if Supabase client is connected
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from("documents").select("id").limit(1);

    // If there's an error with the query
    if (error) {
      if (error.code === "PGRST116") {
        // This is just a permissions error, which means the connection is working
        // but the table might not exist yet or the user doesn't have access
        console.log(
          'Connected to Supabase, but relation "documents" does not exist or is not accessible',
        );
        return true;
      }

      console.error("Supabase connection error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to connect to Supabase:", err);
    return false;
  }
}

// Debug function to directly query and check a document's metadata
export async function debugDocumentMetadata(documentId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("id, content, metadata")
      .eq("id", documentId)
      .single();

    if (error) {
      console.error("Error fetching document metadata:", error);
      return;
    }

    if (!data) {
      console.log("No document found with ID:", documentId);
      return;
    }

    console.log("Document metadata:", data.metadata);

    // Check specifically for codeFiles
    const metadata = data.metadata as DocumentMetadata;
    if (metadata.codeFiles) {
      console.log("codeFiles found in metadata:", metadata.codeFiles);
      console.log(
        "Number of code files:",
        Array.isArray(metadata.codeFiles)
          ? metadata.codeFiles.length
          : "Not an array",
      );
    } else {
      console.log("No codeFiles found in metadata");
    }

    return;
  } catch (error) {
    console.error("Error in debugDocumentMetadata:", error);
    return;
  }
}
