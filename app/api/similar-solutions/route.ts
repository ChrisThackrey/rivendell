import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchSimilarDocuments } from "@/lib/embedding-service";
import { generateEmbedding } from "@/lib/embedding-service";
import { supabase } from "@/lib/supabase-client";
import { captureException } from "@/lib/error-reporting";
import { type Json } from "@/lib/database.types";
import { type DocumentMetadata } from "@/lib/supabase-client";

// Define types for document step processing
type DatabaseDocument = {
  id: string;
  content: string;
  metadata: Record<string, any>;
};

type ProcessedStep = {
  id: string;
  content: string;
  title: string;
  stepNumber?: number;
  decision?: string;
  type?: string;
  model?: string;
  codeFiles: any[];
};

// Define request schema
const RequestSchema = z.object({
  prompt: z.string().min(1),
  similarityThreshold: z.number().min(0).max(1).default(0.75),
  maxResults: z.number().min(1).max(20).default(5),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body as JSON:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate request using Zod
    const validationResult = RequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      console.error("Invalid request data:", validationResult.error.format());
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { prompt, similarityThreshold, maxResults } = validationResult.data;

    console.log(
      `Searching for similar solutions to prompt: "${prompt.substring(0, 100)}..."`,
    );

    // Search for similar documents
    const similarDocuments = await searchSimilarDocuments(
      prompt,
      similarityThreshold,
      maxResults,
    );

    if (similarDocuments.length === 0) {
      console.log("No similar solutions found");
      return NextResponse.json({
        success: true,
        foundSimilar: false,
        message: "No similar solutions found",
        similarSolutions: [],
      });
    }

    console.log(`Found ${similarDocuments.length} similar solutions`);

    // Transform the documents into a more usable format with structured solution data
    const transformedSolutions = await Promise.all(
      similarDocuments.map(async (doc) => {
        try {
          // Access metadata with type assertion
          const docMetadata = doc.metadata as Record<string, any>;

          // Get batch ID to fetch all related step documents
          const batchId = docMetadata.batch_id || docMetadata.batchId;
          let steps: ProcessedStep[] = [];

          // If we have a batch ID, fetch all steps in that batch
          if (batchId) {
            const { data: stepDocuments, error } = await supabase
              .from("documents")
              .select("id, content, metadata")
              .eq("batch_id", batchId)
              .order("metadata->>stepNumber", { ascending: true });

            if (!error && stepDocuments && stepDocuments.length > 0) {
              steps = stepDocuments.map((stepDoc) => {
                // Type assertion for the database document
                const step = stepDoc as unknown as DatabaseDocument;
                const metadata = step.metadata || {};

                return {
                  id: step.id,
                  content: step.content,
                  title:
                    metadata.stepTitle ||
                    metadata.title ||
                    `Step ${metadata.stepNumber || ""}`,
                  stepNumber: metadata.stepNumber,
                  decision: metadata.decision,
                  type: metadata.type,
                  model: metadata.model,
                  codeFiles: metadata.codeFiles || [],
                };
              });
            }
          }

          // Extract codeFiles from the document metadata
          const codeFiles = docMetadata.codeFiles || [];

          return {
            id: doc.id,
            batchId,
            prompt: docMetadata.originalPrompt || doc.content,
            solution: doc.content,
            model: docMetadata.model,
            similarity: doc.similarity,
            steps,
            codeFiles,
          };
        } catch (transformError) {
          console.error(
            `Error transforming document ${doc.id}:`,
            transformError,
          );
          // Return a minimal document representation if transformation fails
          return {
            id: doc.id,
            solution: doc.content,
            similarity: doc.similarity,
            model: doc.metadata.model || "unknown",
            steps: [],
            codeFiles: [],
          };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      foundSimilar: transformedSolutions.length > 0,
      similarSolutions: transformedSolutions,
    });
  } catch (error) {
    console.error("Error finding similar solutions:", error);
    captureException(error, { context: "similar-solutions-api" });

    return NextResponse.json(
      { success: false, error: "Server error finding similar solutions" },
      { status: 500 },
    );
  }
}
