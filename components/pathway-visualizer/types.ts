import type { ModelConfig } from "@/components/ensemble-selection-modal";
import type { TechOption } from "@/components/tech-stack-modal";
import type { CodeFile } from "@/lib/supabase-client";

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
  model: string;
  runId: number;
  stepIndex: number;
  batchId: string;
  metrics: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality: number;
  };
  embeddings: {
    documentId: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any; // This should be more specifically typed in a real app
  };
  frequency?: {
    count: number;
    models: string[];
  };
  codeFiles?: CodeFile[];
  fileTree?: string;
};

export type Step = {
  id: string;
  title: string;
  solutions: Solution[];
  stepIndex?: number;
  level?: number;
  batchId?: string; // ID for grouping steps from the same query
};

export type Connection = {
  from: string;
  to: string;
  type: "accepted" | "secondary" | "rejected";
  level?: number;
};

export type ProgressStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "error";
  details?: string[];
  timestamp: number;
};

export type ModelRunStatus = {
  modelId: number;
  temperature: "low" | "medium" | "high";
  status: "pending" | "active" | "completed" | "error";
};

export type PathwayVisualizerProps = {
  query: string;
  selectedModels: ModelConfig[];
  selectedIntensity: "low" | "medium" | "high";
  selectedTechStack: TechOption[];
  initialBatchId?: string | null;
  includeAllDecisionTypes?: boolean;
  showConnections?: boolean;
};