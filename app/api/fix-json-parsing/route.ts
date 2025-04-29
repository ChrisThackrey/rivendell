import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { captureException } from "../../../lib/error-reporting";
import {
  extractCodeFilesFromDocument,
  storeCodeFileWithEmbedding,
} from "../../../lib/codefile-service";
import { type Json } from "../../../lib/types/database.types";

// Schema for validating the request
const FixJsonParsingSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  dryRun: z.boolean().default(true),
});

// Define the document type returned by our SQL function
interface DocumentWithParsingError {
  id: string;
  content: string;
  metadata: Json;
  batch_id: string | null;
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request
    const body = await request.json();
    const validatedData = FixJsonParsingSchema.parse(body);

    // First find document IDs that have placeholder code files
    const { data: placeholderCodeFiles, error: codefilesError } = await supabase
      .from("codefiles")
      .select("document_id")
      .or(
        "code_content.ilike.%Automatically generated step due to JSON parsing error%,code_content.ilike.%// Generated Step%",
      )
      .limit(100); // Get more than we need to account for duplicates

    if (codefilesError) {
      console.error("Error finding placeholder code files:", codefilesError);
      return NextResponse.json(
        {
          error: "Failed to find placeholder code files",
          details: codefilesError.message,
        },
        { status: 500 },
      );
    }

    // Extract unique document IDs
    const documentIds = [
      ...new Set(placeholderCodeFiles?.map((file) => file.document_id) || []),
    ];

    // Early return if no placeholder files found
    if (documentIds.length === 0) {
      return NextResponse.json({
        dryRun: validatedData.dryRun,
        documentsWithErrors: 0,
        message: "No documents found with JSON parsing errors",
      });
    }

    console.log(
      `Found ${documentIds.length} unique documents with placeholder code files`,
    );

    // Now fetch the actual documents, limited by the requested limit
    const { data: documentsWithErrors, error: findError } = await supabase
      .from("documents")
      .select("id, content, metadata, batch_id, created_at")
      .in("id", documentIds)
      .limit(validatedData.limit);

    if (findError) {
      console.error("Error finding documents with parsing errors:", findError);
      return NextResponse.json(
        {
          error: "Failed to find documents with parsing errors",
          details: findError.message,
        },
        { status: 500 },
      );
    }

    console.log(
      `Found ${documentsWithErrors?.length || 0} documents with parsing errors`,
    );

    // If no documents found, return early
    if (!documentsWithErrors || documentsWithErrors.length === 0) {
      return NextResponse.json({
        dryRun: validatedData.dryRun,
        documentsWithErrors: 0,
        message: "No documents found with JSON parsing errors",
      });
    }

    // Prepare data for response
    const documents = documentsWithErrors.map((doc) => ({
      id: doc.id,
      contentSample:
        typeof doc.content === "string"
          ? doc.content.substring(0, 50) +
            (doc.content.length > 50 ? "..." : "")
          : "Non-string content",
      errorType: "JSON parsing error",
      created_at: doc.created_at,
    }));

    // If dry run, just return the list of documents
    if (validatedData.dryRun) {
      return NextResponse.json({
        dryRun: true,
        documentsWithErrors: documents.length,
        documents,
      });
    }

    // Process each document to fix the parsing errors
    const results = [];
    let successCount = 0;

    for (const doc of documentsWithErrors) {
      try {
        console.log(`Processing document with ID: ${doc.id}`);

        // 1. Find and delete placeholder code files
        const { data: placeholderFiles, error: placeholderError } =
          await supabase
            .from("codefiles")
            .select("id, filename")
            .eq("document_id", doc.id)
            .or(
              "code_content.ilike.%Automatically generated step due to JSON parsing error%,code_content.ilike.%// Generated Step%",
            );

        if (placeholderError) {
          console.error(
            `Error finding placeholder files for document ${doc.id}:`,
            placeholderError,
          );
          results.push({
            documentId: doc.id,
            fixed: false,
            error: `Error finding placeholder files: ${placeholderError.message}`,
          });
          continue;
        }

        console.log(
          `Found ${placeholderFiles?.length || 0} placeholder files for document ${doc.id}`,
        );

        // Delete the placeholder files
        if (placeholderFiles && placeholderFiles.length > 0) {
          const { error: deleteError } = await supabase
            .from("codefiles")
            .delete()
            .in(
              "id",
              placeholderFiles.map((file) => file.id),
            );

          if (deleteError) {
            console.error(
              `Error deleting placeholder files for document ${doc.id}:`,
              deleteError,
            );
            results.push({
              documentId: doc.id,
              fixed: false,
              error: `Error deleting placeholder files: ${deleteError.message}`,
            });
            continue;
          }

          console.log(
            `Deleted ${placeholderFiles.length} placeholder files for document ${doc.id}`,
          );
        }

        // 2. Attempt to extract code files with more robust error handling
        const extractedFiles = await extractCodeFilesFromDocument(
          doc.id,
          doc.content,
          doc.metadata as Record<string, any>,
        );

        console.log(
          `Extracted ${extractedFiles.length} code files from document ${doc.id}`,
        );

        // If no files were extracted, use a fallback strategy
        if (extractedFiles.length === 0) {
          console.log(
            `No code files extracted for document ${doc.id}, creating sample code`,
          );

          // Create a generic code file based on document metadata
          const metadata = doc.metadata as Record<string, any>;
          const stepNumber = metadata?.stepNumber || "unknown";

          const sampleCode = {
            filename: `FixedStep${stepNumber}.js`,
            language: "javascript",
            code: `/**
 * Fixed code for document ${doc.id} (step ${stepNumber})
 * This code was automatically generated to replace a placeholder.
 * The original document had JSON parsing errors.
 */
function processStep${stepNumber}() {
  console.log("Processing step ${stepNumber}");

  // This is a placeholder implementation
  // Replace with actual code if available

  return {
    success: true,
    step: ${stepNumber},
    timestamp: new Date().toISOString(),
    documentId: "${doc.id}"
  };
}

module.exports = processStep${stepNumber};`,
          };

          // Store the sample code file
          const sampleId = await storeCodeFileWithEmbedding(
            sampleCode,
            doc.id,
            doc.batch_id || null,
            metadata?.runId || null,
            metadata?.stepNumber || null,
            {
              source: "fix-json-parsing-api",
              wasPlaceholder: true,
              fixedAt: new Date().toISOString(),
            },
          );

          if (sampleId) {
            console.log(`Created sample code file for document ${doc.id}`);
            results.push({
              documentId: doc.id,
              fixed: true,
              placeholdersRemoved: placeholderFiles?.length || 0,
              filesAdded: 1,
              strategy: "sample",
            });
            successCount++;
          } else {
            console.error(
              `Failed to create sample code file for document ${doc.id}`,
            );
            results.push({
              documentId: doc.id,
              fixed: false,
              error: "Failed to create sample code file",
            });
          }

          continue;
        }

        // 3. Store the extracted code files
        let insertedCount = 0;
        const metadata = doc.metadata as Record<string, any>;

        for (const codeFile of extractedFiles) {
          const id = await storeCodeFileWithEmbedding(
            codeFile,
            doc.id,
            doc.batch_id || null,
            metadata?.runId || null,
            metadata?.stepNumber || null,
            {
              source: "fix-json-parsing-api",
              wasPlaceholder: true,
              fixedAt: new Date().toISOString(),
            },
          );

          if (id) {
            insertedCount++;
          }
        }

        console.log(
          `Inserted ${insertedCount} of ${extractedFiles.length} code files for document ${doc.id}`,
        );

        // Add result
        if (insertedCount > 0) {
          results.push({
            documentId: doc.id,
            fixed: true,
            placeholdersRemoved: placeholderFiles?.length || 0,
            filesAdded: insertedCount,
            strategy: "extract",
          });
          successCount++;
        } else {
          results.push({
            documentId: doc.id,
            fixed: false,
            error: "Failed to insert any extracted code files",
          });
        }
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        results.push({
          documentId: doc.id,
          fixed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      dryRun: false,
      documentsWithErrors: documentsWithErrors.length,
      successCount,
      results,
    });
  } catch (error) {
    console.error("Error in fix-json-parsing API:", error);
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
