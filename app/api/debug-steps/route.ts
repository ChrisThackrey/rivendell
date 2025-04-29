import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { type Json } from "@/lib/types/database.types";
import type { DecisionType, ScoreMetrics } from "@/lib/supabase-client";

type StepData = {
  title?: string;
  description?: string;
  type?: string;
  metrics?: {
    executionTime?: string;
    complexity?: string;
    memoryUsage?: string;
    lineCount?: number;
  };
  codeFiles?: Array<{
    filename: string;
    code: string;
    language?: string;
  }>;
};

// Define Step type to use throughout the file
type Step = {
  id: string;
  batch_id: string;
  document_id: string;
  run_id: number;
  step_index: number;
  level: number;
  decision_value: DecisionType;
  step_data: Json;
  created_at: string;
};

// Add OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(request: NextRequest) {
  // Add CORS headers
  const corsHeaders = {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  };

  try {
    // Get batch ID from URL query parameter
    const batchId = request.nextUrl.searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400, ...corsHeaders },
      );
    }

    console.log(`Debugging steps for batch ID: ${batchId}`);

    // First check if the batch exists
    const { data: batches, error: batchError } = await supabase.rpc(
      "get_available_batches",
    );

    if (batchError) {
      console.error("Error fetching available batches:", batchError);
      return NextResponse.json(
        { error: "Failed to check batch existence", details: batchError },
        { status: 500, ...corsHeaders },
      );
    }

    const batchExists = batches.some(
      (batch: any) => batch.batch_id === batchId,
    );

    if (!batchExists) {
      return NextResponse.json(
        { error: "Batch does not exist", batchId },
        { status: 404, ...corsHeaders },
      );
    }

    // Now fetch steps for this batch
    const { data: steps, error: stepsError } = await supabase.rpc(
      "get_steps_by_batch_id",
      {
        p_batch_id: batchId,
      },
    );

    if (stepsError) {
      console.error("Error fetching steps by batch ID:", stepsError);
      return NextResponse.json(
        { error: "Failed to fetch steps", details: stepsError },
        { status: 500, ...corsHeaders },
      );
    }

    // Also fetch raw documents for the batch to compare
    const { data: rawDocuments, error: docsError } = await supabase
      .from("documents")
      .select("id, batch_id, metadata")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (docsError) {
      console.error("Error fetching raw documents:", docsError);
    }

    // Check specifically for documents with step metadata
    const stepsFromDocs =
      rawDocuments?.filter((doc) => {
        if (!doc.metadata) return false;
        const metadata = doc.metadata as Record<string, Json>;
        return metadata.stepNumber !== undefined;
      }) || [];

    // Get steps by level for diagnostic info
    const stepsByLevel: Record<string, any[]> = {};
    steps?.forEach((step: Step) => {
      const level = step.level?.toString() || "unknown";
      if (!stepsByLevel[level]) {
        stepsByLevel[level] = [];
      }
      stepsByLevel[level].push(step);
    });

    // Calculate the highest scoring step from each level
    const highestScoringSteps = Object.keys(stepsByLevel).map((levelStr) => {
      const levelSteps = stepsByLevel[levelStr];

      // Sort steps by score (calculated from step_data.scores)
      return levelSteps.sort((a, b) => {
        const stepDataA = (a.step_data || {}) as Record<string, any>;
        const stepDataB = (b.step_data || {}) as Record<string, any>;
        const scoresA = stepDataA.scores || {};
        const scoresB = stepDataB.scores || {};

        // Calculate total score (sum of all score metrics)
        const totalScoreA = Object.values(scoresA).reduce(
          (sum: number, score: any) =>
            sum + (typeof score === "number" ? score : 0),
          0,
        );
        const totalScoreB = Object.values(scoresB).reduce(
          (sum: number, score: any) =>
            sum + (typeof score === "number" ? score : 0),
          0,
        );

        return totalScoreB - totalScoreA; // Descending order
      })[0]; // Get first (highest scoring) step
    });

    return NextResponse.json(
      {
        batchId,
        stepsCount: steps?.length || 0,
        docCount: rawDocuments?.length || 0,
        stepsInDocsCount: stepsFromDocs.length,
        levelCounts: Object.keys(stepsByLevel).map((level) => ({
          level,
          count: stepsByLevel[level].length,
        })),
        highestScoringSteps:
          highestScoringSteps?.map((step) => ({
            id: step.id,
            level: step.level,
            step_number: step.step_index,
            step_data: {
              title: (step.step_data as StepData)?.title || "Unknown",
              type: (step.step_data as StepData)?.type || "unknown",
            },
            metadata: {
              scores: ((step.step_data as Record<string, any>)?.scores || {}) as ScoreMetrics
            },
          })) || [],
        sampleSteps:
          steps?.slice(0, 3)?.map((step: Step) => ({
            id: step.id,
            level: step.level,
            step_number: step.step_index,
            step_data: {
              title: (step.step_data as StepData)?.title || "Unknown",
              type: (step.step_data as StepData)?.type || "unknown",
            },
          })) || [],
      },
      { status: 200, ...corsHeaders },
    );
  } catch (error) {
    console.error("Error in debug-steps API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, ...corsHeaders },
    );
  }
}
