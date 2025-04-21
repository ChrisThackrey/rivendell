import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase-client";
import { captureException } from "../../../lib/error-reporting";
import { z } from "zod";

// Define types for document records
interface DocumentRecord {
  id: string;
  content?: string;
  metadata?: Record<string, any>;
  batch_id?: string;
  created_at?: string;
}

const BatchAddSampleCodeSchema = z.object({
  batchId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  sampleType: z
    .enum(["job-analyzer", "text-classifier", "api-wrapper", "data-processor"])
    .default("job-analyzer"),
  dryRun: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request
    const body = await request.json();
    const validatedData = BatchAddSampleCodeSchema.parse(body);

    // Find documents with missing code files
    // First, find documents that are placeholders or have placeholder content
    const { data: placeholderDocs, error: placeholderError } = await supabase
      .from("documents")
      .select("id, content, metadata, batch_id, created_at")
      .or(
        'content.eq.{"placeholder": true},content.eq.{"placeholder":true},metadata->isPlaceholder.eq.true',
      )
      .limit(validatedData.limit);

    if (placeholderError) {
      console.error("Error finding placeholder documents:", placeholderError);
      return NextResponse.json(
        {
          error: "Failed to find placeholder documents",
          details: placeholderError.message,
        },
        { status: 500 },
      );
    }

    // Also find documents that have stepNumber in metadata but no codeFiles array
    // These are not placeholders but still don't have code
    const { data: missingCodeDocs, error: missingCodeError } = await supabase
      .from("documents")
      .select("id, content, metadata, batch_id, created_at")
      .not("metadata->stepNumber", "is", null) // Has stepNumber (is a step document)
      .is("metadata->codeFiles", null) // No codeFiles in metadata
      .limit(validatedData.limit);

    if (missingCodeError) {
      console.error(
        "Error finding documents without code files:",
        missingCodeError,
      );
      // Continue with placeholder docs only if the query fails
    }

    // Combine the two document sets (if we got both)
    const docsToProcess: DocumentRecord[] = [
      ...((placeholderDocs || []) as DocumentRecord[]),
      ...((missingCodeDocs || []) as DocumentRecord[]),
    ]
      // Remove duplicates by ID
      .filter(
        (doc, index, self) => index === self.findIndex((d) => d.id === doc.id),
      );

    console.log(`Found ${docsToProcess.length} documents to process`);

    if (docsToProcess.length === 0) {
      return NextResponse.json({
        message: "No documents found that need code files",
      });
    }

    // If dry run, just return the list of documents we would process
    if (validatedData.dryRun) {
      return NextResponse.json({
        dryRun: true,
        documentsToProcess: docsToProcess.map((doc) => ({
          id: doc.id,
          contentSample:
            typeof doc.content === "string"
              ? doc.content.substring(0, 50) +
                (doc.content.length > 50 ? "..." : "")
              : "Non-string content",
          hasMetadata: !!doc.metadata,
          metadataKeys: doc.metadata ? Object.keys(doc.metadata) : [],
        })),
      });
    }

    // Process each document
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const doc of docsToProcess) {
      try {
        // Call the create-sample-code API for each document
        const response = await fetch(
          new URL("/api/create-sample-code", request.url),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentId: doc.id,
              sampleType: validatedData.sampleType,
            }),
          },
        );

        if (response.ok) {
          const result = await response.json();
          console.log(`Successfully added code files to document ${doc.id}`);
          successCount++;
          results.push({
            documentId: doc.id,
            status: "success",
            filesAdded: result.totalCodeFiles,
          });
        } else {
          const errorData = await response.json();
          console.error(
            `Failed to add code files to document ${doc.id}:`,
            errorData,
          );
          errorCount++;
          results.push({
            documentId: doc.id,
            status: "error",
            error: errorData,
          });
        }
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        errorCount++;
        results.push({
          documentId: doc.id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Brief pause to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      totalProcessed: docsToProcess.length,
      successCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error("Error in batch-add-sample-code API:", error);
    captureException(error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
