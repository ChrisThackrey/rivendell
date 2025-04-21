import { z } from "zod";
import { DecisionType } from "./supabase-client";

/**
 * Common Zod validation schemas for AI/LLM responses and requests
 */

// Code files schema
export const CodeFileSchema = z.object({
  filename: z.string(),
  language: z.string(),
  code: z.string(),
});

// Metrics schema for AI generated solutions
export const MetricsSchema = z.object({
  executionTime: z.string(),
  complexity: z.string(),
  memoryUsage: z.string(),
  lineCount: z.number(),
  codeQuality: z.number().min(0).max(100).optional(),
  convergenceScore: z.number().min(0).max(100).optional(),
});

// Score metrics schema for evaluations
export const ScoreMetricsSchema = z.object({
  accuracy: z.number().min(0).max(100),
  complexity: z.number().min(0).max(100),
  computeEfficiency: z.number().min(0).max(100),
  readability: z.number().min(0).max(100),
  costEfficiency: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  codeQuality: z.number().min(0).max(100).optional(),
});

// Step schema for structured solutions
export const StepSchema = z.object({
  title: z.string(),
  description: z.string(),
  metrics: MetricsSchema,
  fileTree: z.string().optional(),
  codeFiles: z.array(CodeFileSchema).optional(),
});

// Final solution schema for structured solutions
export const FinalSolutionSchema = z.object({
  title: z.string(),
  description: z.string(),
  metrics: z.object({
    executionTime: z.string(),
    complexity: z.string(),
    memoryUsage: z.string(),
    lineCount: z.number(),
  }),
  fileTree: z.string().optional(),
  codeFiles: z.array(CodeFileSchema).optional(),
});

// Decision type schema
export const DecisionTypeSchema = z.enum([
  "RECOMMENDED",
  "VIABLE",
  "PROBLEMATIC",
]);

// Structured solution response schema
export const StructuredSolutionSchema = z.object({
  steps: z.array(StepSchema).length(6),
  finalSolution: FinalSolutionSchema,
  rawContent: z.string(),
  reasoningProcess: z.string().optional(),
  structuredSolution: z.record(z.unknown()).optional(),
  batchId: z.string().optional(),
});

// OpenAI API request schema
export const OpenAIRequestSchema = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  model: z.string().optional().default("gpt-4o"),
  temperature: z.number().min(0).max(1).optional().default(0.7),
  enableReasoning: z.boolean().optional().default(false),
});

// OpenAI API response schema
export const OpenAIResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  fullContent: z.string(),
  metrics: MetricsSchema,
  model: z.string(),
  reasoningEnabled: z.boolean().optional(),
  codeFiles: z.array(CodeFileSchema).optional(),
});

// Anthropic API request schema
export const AnthropicRequestSchema = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  model: z.string().optional().default("claude-3-sonnet-20240229"),
  temperature: z.number().min(0).max(1).optional().default(0.7),
});

// Anthropic API response schema
export const AnthropicResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  fullContent: z.string(),
  metrics: MetricsSchema,
  model: z.string(),
  codeFiles: z.array(CodeFileSchema).optional(),
});

// Embedding request schema
export const EmbeddingRequestSchema = z.object({
  text: z
    .string()
    .min(1, { message: "Text is required for embedding generation" }),
});

// Embedding response schema
export const EmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
  isMock: z.boolean().optional(),
});

// Evaluation request schema
export const EvaluationRequestSchema = z.object({
  content: z.string().min(1, { message: "Content is required" }),
  model: z.string().min(1, { message: "Model is required" }),
  stepNumber: z.number().int().positive().optional(),
  batchId: z.string().optional(),
  runId: z.number().int().positive().optional(),
});

// Evaluation response schema
export const EvaluationResponseSchema = z.object({
  scores: ScoreMetricsSchema,
  decision: DecisionTypeSchema,
  reasoning: z.string(),
  comparisonNotes: z.string().optional(),
  evaluatedWithModel: z.string(),
  stepNumber: z.number().int().positive().optional(),
  batchId: z.string().optional(),
});

// Structured solution request schema
export const StructuredSolutionRequestSchema = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  model: z.string().min(1, { message: "Model is required" }),
  temperature: z.number().min(0).max(1),
  techStack: z.string().optional(),
  runId: z.number().optional(),
  enableReasoning: z.boolean().optional(),
  batchId: z.string().optional(),
});

// Gantt chart data schemas
export const GanttStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const GanttGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const GanttFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  startAt: z.string().or(z.date()), // Allow string ISO dates to be parsed into Date objects
  endAt: z.string().or(z.date()),
  status: GanttStatusSchema,
  group: GanttGroupSchema,
  product: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  owner: z
    .object({
      id: z.string(),
      image: z.string().optional(),
      name: z.string(),
    })
    .optional(),
  initiative: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  release: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

export const GanttMarkerSchema = z.object({
  id: z.string(),
  date: z.string().or(z.date()), // Allow string ISO dates to be parsed into Date objects
  label: z.string(),
  className: z.string().optional(),
});

export const GanttDataRequestSchema = z.object({
  batchId: z.string({ required_error: "Batch ID is required" }),
});

export const GanttDataResponseSchema = z.object({
  statuses: z.array(GanttStatusSchema),
  features: z.array(GanttFeatureSchema),
  markers: z.array(GanttMarkerSchema),
});

// Export inferred types
export type CodeFile = z.infer<typeof CodeFileSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type ScoreMetrics = z.infer<typeof ScoreMetricsSchema>;
export type Step = z.infer<typeof StepSchema>;
export type FinalSolution = z.infer<typeof FinalSolutionSchema>;
export type StructuredSolution = z.infer<typeof StructuredSolutionSchema>;
export type OpenAIRequest = z.infer<typeof OpenAIRequestSchema>;
export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;
export type AnthropicRequest = z.infer<typeof AnthropicRequestSchema>;
export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;
export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
export type StructuredSolutionRequest = z.infer<
  typeof StructuredSolutionRequestSchema
>;
export type GanttStatus = z.infer<typeof GanttStatusSchema>;
export type GanttGroup = z.infer<typeof GanttGroupSchema>;
export type GanttFeature = z.infer<typeof GanttFeatureSchema>;
export type GanttMarker = z.infer<typeof GanttMarkerSchema>;
export type GanttDataRequest = z.infer<typeof GanttDataRequestSchema>;
export type GanttDataResponse = z.infer<typeof GanttDataResponseSchema>;
