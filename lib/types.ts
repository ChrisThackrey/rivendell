import type { DocumentMetadata } from "@/lib/supabase-client";

export type Metric = {
  executionTime: string;
  complexity: string;
  memoryUsage: string;
  lineCount: number;
  codeQuality?: number;
};

export type Solution = {
  id: string;
  title: string;
  description: string;
  type: "accepted" | "secondary" | "rejected";
  model?: string;
  metrics?: Metric;
  frequency?: {
    count: number;
    models: string[];
  };
  runId?: number;
  stepIndex?: number; // Index of the step in the solution sequence
  batchId?: string; // ID for grouping solutions from the same query
  embeddings?: {
    documentId: string | null;
    metadata: DocumentMetadata;
  };
  codeFiles?: CodeFile[]; // Add code files array
  fileTree?: string; // Add file tree representation
};

export type Step = {
  id: string;
  title: string;
  solutions: Solution[];
  stepIndex?: number; // Position in the solution sequence (1-6)
  batchId?: string; // ID for grouping steps from the same query
};

export type Connection = {
  from: string;
  to: string;
  type: "accepted" | "secondary" | "rejected";
  level: number; // Which level this connection belongs to
};

export type SimilarityConnection = Connection & {
  color: string;
};

export type CodeFile = {
  filename: string;
  language: string;
  code: string;
};

export type ModelConfig = {
  id: number;
  model: string;
  runsLow: number;
  runsMedium: number;
  runsHigh: number;
  enableReasoning?: boolean;
};

export type ModelRunStatus = {
  modelId: number;
  temperature: "low" | "medium" | "high";
  status: "pending" | "active" | "completed" | "error";
};

export type ProgressStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "error";
  details?: string[];
  timestamp: number;
};