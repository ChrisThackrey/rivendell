import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { migrateCodeFilesFromDocument } from "../../../lib/codefile-service";
import { captureException } from "../../../lib/error-reporting";
import { ensureDocumentExists } from "../../../lib/document-service";
import crypto from "crypto";

// Schema for validating the request body
const MigrateCodeFilesRequestSchema = z
  .object({
    documentIds: z.array(z.string()).optional(),
    batchId: z.string().optional(),
    limit: z.number().min(1).max(1000).default(100),
    skipExisting: z.boolean().default(true),
    updateMetadata: z.boolean().default(true),
  })
  .refine((data) => data.documentIds || data.batchId, {
    message: "Either documentIds or batchId must be provided",
  });

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request
    const body = await request.json();
    const validatedData = MigrateCodeFilesRequestSchema.parse(body);

    // Set up results tracking
    const results = {
      totalDocuments: 0,
      processedDocuments: 0,
      skippedDocuments: 0,
      totalCodeFiles: 0,
      insertedCodeFiles: 0,
      failedCodeFiles: 0,
      details: [] as Array<{
        documentId: string;
        actualDocumentId?: string;
        totalFiles: number;
        insertedFiles: number;
        errors: number;
        success: boolean;
        metadataUpdated?: boolean;
        errorMessage?: string;
      }>,
    };

    // Get the document IDs to process
    let documentIds: string[] = [];

    if (validatedData.documentIds) {
      // Use the provided document IDs
      documentIds = validatedData.documentIds;
    } else if (validatedData.batchId) {
      // Get all document IDs for the batch
      const { data, error } = await supabase
        .from("documents")
        .select("id")
        .eq("batch_id", validatedData.batchId)
        .limit(validatedData.limit);

      if (error) {
        console.error("Error retrieving documents for batch:", error);
        return NextResponse.json(
          {
            error: "Failed to retrieve documents for batch",
            details: error.message,
          },
          { status: 500 },
        );
      }

      documentIds = data.map((doc) => doc.id);
    }

    // Process each document
    results.totalDocuments = documentIds.length;

    // Check if we should skip documents that already have code files
    if (validatedData.skipExisting) {
      // Get list of documents that already have code files
      const { data: existingDocs, error: existingError } = await supabase
        .from("codefiles")
        .select("document_id")
        .in("document_id", documentIds);

      if (!existingError && existingDocs && existingDocs.length > 0) {
        // Create a Set of document IDs that already have code files
        const existingDocIds = new Set(
          existingDocs.map((doc) => doc.document_id),
        );

        // Filter out documents that already have code files
        const filteredDocIds = documentIds.filter(
          (id) => !existingDocIds.has(id),
        );

        results.skippedDocuments = documentIds.length - filteredDocIds.length;
        documentIds = filteredDocIds;

        console.log(
          `Skipping ${results.skippedDocuments} documents that already have code files`,
        );
      }
    }

    // Also check metadata for documents already marked as migrated
    if (validatedData.skipExisting) {
      const { data: migratedDocs, error: migratedError } = await supabase
        .from("documents")
        .select("id")
        .in("id", documentIds)
        .eq("metadata->codeFilesMigrated", true);

      if (!migratedError && migratedDocs && migratedDocs.length > 0) {
        // Create a Set of documents already marked as migrated
        const migratedDocIds = new Set(migratedDocs.map((doc) => doc.id));

        // Filter out documents already marked as migrated
        const filteredDocIds = documentIds.filter(
          (id) => !migratedDocIds.has(id),
        );

        results.skippedDocuments += documentIds.length - filteredDocIds.length;
        documentIds = filteredDocIds;

        console.log(
          `Skipping ${documentIds.length - filteredDocIds.length} documents already marked as migrated`,
        );
      }
    }

    // Process each document (using concurrency to speed up processing while avoiding rate limits)
    const CONCURRENCY_LIMIT = 5; // Process up to 5 documents at a time

    // Function to process a single document
    const processDocument = async (documentId: string): Promise<void> => {
      try {
        // First ensure the document exists and handle non-UUID conversions
        let validDocumentId: string | null;

        try {
          validDocumentId = await ensureDocumentExists(documentId);
        } catch (convertError) {
          console.error(
            `Error converting document ID ${documentId}:`,
            convertError,
          );

          // Attempt a more robust conversion if the standard method fails
          try {
            // Generate a deterministic UUID manually
            const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
            const hash = crypto
              .createHash("sha1")
              .update(NAMESPACE)
              .update(documentId)
              .digest("hex");

            // Format the hash correctly as a UUID (first 32 chars only)
            validDocumentId =
              hash.substring(0, 8) +
              "-" +
              hash.substring(8, 12) +
              "-" +
              hash.substring(12, 16) +
              "-" +
              hash.substring(16, 20) +
              "-" +
              hash.substring(20, 32);

            console.log(
              `Manual UUID conversion for document ID: ${documentId} → ${validDocumentId}`,
            );
          } catch (manualConvertError) {
            console.error(
              `Failed to manually convert document ID ${documentId}:`,
              manualConvertError,
            );
            validDocumentId = null;
          }
        }

        if (!validDocumentId) {
          console.error(
            `Cannot migrate code files - document ${documentId} does not exist and couldn't be created`,
          );

          // Add failed document to results
          results.details.push({
            documentId,
            totalFiles: 0,
            insertedFiles: 0,
            errors: 1,
            success: false,
            errorMessage: "Failed to convert document ID to valid UUID",
          });

          results.processedDocuments++;
          results.failedCodeFiles++;
          return;
        }

        // If the ID was converted, log that information
        if (validDocumentId !== documentId) {
          console.log(
            `Using converted document ID for migration: ${documentId} → ${validDocumentId}`,
          );
        }

        // Migrate code files for this document
        const result = await migrateCodeFilesFromDocument(validDocumentId);

        // Update results
        results.processedDocuments++;
        results.totalCodeFiles += result.totalFiles;
        results.insertedCodeFiles += result.insertedFiles;
        results.failedCodeFiles += result.errors;

        let metadataUpdated = false;

        // Update document metadata to mark code files as migrated if requested
        if (
          validatedData.updateMetadata &&
          result.success &&
          result.insertedFiles > 0
        ) {
          try {
            // Update document metadata to mark code files as migrated using our helper function
            // First, get the current document metadata
            const { data: document, error: fetchError } = await supabase
              .from("documents")
              .select("metadata")
              .eq("id", validDocumentId)
              .single();

            if (fetchError) {
              console.error(
                `Error fetching document metadata for ${validDocumentId}:`,
                fetchError,
              );
              // Add error info to results
              results.details.push({
                documentId: validDocumentId,
                actualDocumentId: result.actualDocumentId,
                totalFiles: result.totalFiles,
                insertedFiles: result.insertedFiles,
                errors: result.errors + 1,
                success: result.success,
                metadataUpdated: false,
                errorMessage: `Failed to fetch metadata: ${fetchError.message}`,
              });
              return;
            }

            // Then update with the migration information
            const { data: updateResult, error: updateError } = await supabase
              .from("documents")
              .update({
                metadata: {
                  ...((document?.metadata as Record<string, any>) || {}),
                  codeFilesMigrated: true,
                  codeFilesMigratedAt: new Date().toISOString(),
                  codeFilesMigrationCount: result.insertedFiles,
                },
              })
              .eq("id", validDocumentId)
              .select("id")
              .single();

            if (!updateError && updateResult) {
              metadataUpdated = true;
              console.log(
                `Updated metadata for document ${validDocumentId} to mark code files as migrated`,
              );
            } else {
              console.error(
                `Error updating metadata for document ${validDocumentId}:`,
                updateError,
              );
            }
          } catch (updateError) {
            console.error(
              `Error updating metadata for document ${validDocumentId}:`,
              updateError,
            );
          }
        }

        // Add details for this document
        results.details.push({
          documentId: validDocumentId,
          actualDocumentId: result.actualDocumentId,
          totalFiles: result.totalFiles,
          insertedFiles: result.insertedFiles,
          errors: result.errors,
          success: result.success,
          metadataUpdated,
        });
      } catch (error) {
        console.error(
          `Error migrating code files for document ${documentId}:`,
          error,
        );

        // Add failed document to results
        results.details.push({
          documentId,
          totalFiles: 0,
          insertedFiles: 0,
          errors: 1,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });

        results.processedDocuments++;
        results.failedCodeFiles++;
      }
    };

    // Process documents in batches using Promise.all with concurrency limit
    for (let i = 0; i < documentIds.length; i += CONCURRENCY_LIMIT) {
      const batch = documentIds.slice(i, i + CONCURRENCY_LIMIT);
      console.log(
        `Processing batch of ${batch.length} documents (${i + 1} to ${Math.min(i + CONCURRENCY_LIMIT, documentIds.length)} of ${documentIds.length})`,
      );

      // Process this batch concurrently
      await Promise.all(batch.map((documentId) => processDocument(documentId)));

      // Small delay between batches to avoid rate limits
      if (i + CONCURRENCY_LIMIT < documentIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Return the results
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error in migrate-codefiles API:", error);
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
