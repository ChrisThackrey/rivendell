import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { captureException } from "../../../lib/error-reporting";
import { storeCodeFileWithEmbedding } from "../../../lib/codefile-service";
import { ensureDocumentExists } from "../../../lib/document-service";
import { type Json } from "../../../lib/database.types";

// Define metadata type to avoid TypeScript errors
interface DocumentMetadata {
  codeFiles?: Array<{
    filename: string;
    language?: string;
    code?: string;
  }>;
  runId?: number;
  stepNumber?: number;
  codeFilesMigrated?: boolean;
  codeFilesMigratedAt?: string;
  codeFilesMigrationCount?: number;
  [key: string]: any;
}

// Define the schema for the request
const ValidateCodeFilesSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    stepId: z.string().optional(),
    reprocessExisting: z.boolean().default(false),
  })
  .refine((data) => data.documentId || data.stepId, {
    message: "Either documentId or stepId must be provided",
  });

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request
    const body = await request.json();
    const validatedData = ValidateCodeFilesSchema.parse(body);

    // Use either documentId or stepId
    const documentId = validatedData.documentId || validatedData.stepId;

    if (!documentId) {
      return NextResponse.json(
        { error: "No valid document ID provided" },
        { status: 400 },
      );
    }

    // Ensure the document exists (this function handles non-UUID IDs)
    const validDocumentId = await ensureDocumentExists(documentId);

    if (!validDocumentId) {
      return NextResponse.json(
        { error: "Failed to locate or create document" },
        { status: 404 },
      );
    }

    // Get document details
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("metadata, content, batch_id")
      .eq("id", validDocumentId)
      .single();

    if (documentError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve document metadata",
          details: documentError.message,
        },
        { status: 500 },
      );
    }

    // Check for existing code files
    const { data: existingCodeFiles, error: codeFilesError } = await supabase
      .from("codefiles")
      .select("id, filename, code_content")
      .eq("document_id", validDocumentId);

    if (codeFilesError) {
      console.error("Error checking existing code files:", codeFilesError);
    }

    // Analyze the document metadata and check for code files
    const metadata = (document.metadata as DocumentMetadata) || {};
    const codeFiles = metadata.codeFiles || [];

    // Check if code files exist in metadata
    const hasMetadataCodeFiles =
      Array.isArray(codeFiles) &&
      codeFiles.length > 0 &&
      codeFiles.some((file) => file.code && file.code.trim() !== "");

    // Check if code files exist in dedicated table
    const hasTableCodeFiles =
      existingCodeFiles &&
      existingCodeFiles.length > 0 &&
      existingCodeFiles.some(
        (file) => file.code_content && file.code_content.trim() !== "",
      );

    const results = {
      documentId: validDocumentId,
      originalId: documentId !== validDocumentId ? documentId : undefined,
      hasMetadataCodeFiles,
      hasTableCodeFiles,
      metadataCodeFilesCount: Array.isArray(codeFiles) ? codeFiles.length : 0,
      tableCodeFilesCount: existingCodeFiles ? existingCodeFiles.length : 0,
      processedFiles: 0,
      codeFilesFixed: 0,
      actions: [] as string[],
    };

    // If we should reprocess existing code files or if no valid code files exist
    if (
      validatedData.reprocessExisting ||
      (!hasMetadataCodeFiles && !hasTableCodeFiles)
    ) {
      // Try to extract code files from metadata if available
      if (Array.isArray(codeFiles) && codeFiles.length > 0) {
        results.actions.push(
          `Found ${codeFiles.length} code files in metadata`,
        );

        for (const file of codeFiles) {
          // Skip files without code or filename
          if (!file.filename || typeof file.filename !== "string") {
            results.actions.push(`Skipped file with missing filename`);
            continue;
          }

          results.processedFiles++;

          // Check if the code content is empty or undefined
          const hasValidCode =
            file.code &&
            typeof file.code === "string" &&
            file.code.trim() !== "";

          if (!hasValidCode) {
            results.actions.push(
              `File ${file.filename} has no valid code content`,
            );

            // Create a placeholder code file
            const language =
              file.language || file.filename.split(".").pop() || "txt";
            const placeholderCode = `// Placeholder code for ${file.filename}\n// Original code was missing or empty\n\n// This is an automatically generated placeholder\n`;

            // Store it in the codefiles table
            const id = await storeCodeFileWithEmbedding(
              {
                filename: file.filename,
                language,
                code: placeholderCode,
              },
              validDocumentId,
              document.batch_id || null,
              metadata.runId || null,
              metadata.stepNumber || null,
              {
                source: "validate-codefiles-api",
                isPlaceholder: true,
                originalMetadata: file,
              },
            );

            if (id) {
              results.codeFilesFixed++;
              results.actions.push(`Created placeholder for ${file.filename}`);
            } else {
              results.actions.push(
                `Failed to create placeholder for ${file.filename}`,
              );
            }
          } else {
            // Code content exists but might not be in the database table yet
            const existingFile = existingCodeFiles?.find(
              (ef) =>
                ef.filename === file.filename &&
                ef.code_content &&
                ef.code_content.trim() !== "",
            );

            if (!existingFile) {
              // Store the code file in the database table
              const id = await storeCodeFileWithEmbedding(
                {
                  filename: file.filename,
                  language:
                    file.language || file.filename.split(".").pop() || "txt",
                  code: file.code || "",
                },
                validDocumentId,
                document.batch_id || null,
                metadata.runId || null,
                metadata.stepNumber || null,
                {
                  source: "validate-codefiles-api",
                  fromMetadata: true,
                },
              );

              if (id) {
                results.codeFilesFixed++;
                results.actions.push(
                  `Stored code file ${file.filename} in database table`,
                );
              } else {
                results.actions.push(
                  `Failed to store code file ${file.filename}`,
                );
              }
            } else if (validatedData.reprocessExisting) {
              results.actions.push(
                `Skipped existing code file ${file.filename} with valid content`,
              );
            }
          }
        }
      } else {
        results.actions.push("No code files found in metadata");

        // Try to parse content as JSON and extract code
        try {
          // Create a simple fallback code file
          const stepNumber = metadata.stepNumber || "unknown";
          const runId = metadata.runId || "unknown";

          const filename = `Step${stepNumber}_Run${runId}.js`;
          const placeholderCode = `
/**
 * Placeholder code for Step ${stepNumber}, Run ${runId}
 *
 * This file was auto-generated because no code files were found
 * for this document. The actual implementation would depend on
 * the specific task requirements.
 */

function processStep${stepNumber}() {
  console.log("Processing step ${stepNumber} from run ${runId}");
  return {
    status: "success",
    message: "Step ${stepNumber} processed successfully",
    timestamp: new Date().toISOString()
  };
}

module.exports = processStep${stepNumber};
`;

          // Store the placeholder in the codefiles table
          const id = await storeCodeFileWithEmbedding(
            {
              filename,
              language: "javascript",
              code: placeholderCode,
            },
            validDocumentId,
            document.batch_id || null,
            metadata.runId || null,
            metadata.stepNumber || null,
            {
              source: "validate-codefiles-api",
              isPlaceholder: true,
              generated: true,
            },
          );

          if (id) {
            results.codeFilesFixed++;
            results.actions.push(`Created fallback code file ${filename}`);
          } else {
            results.actions.push(`Failed to create fallback code file`);
          }
        } catch (parseError) {
          results.actions.push(
            `Failed to parse content as JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          );
        }
      }

      // Update the document to mark code files as migrated
      if (results.codeFilesFixed > 0) {
        // Need to cast metadata to object to spread properties
        const updatedMetadata = {
          ...(metadata as Record<string, any>),
          codeFilesMigrated: true,
          codeFilesMigratedAt: new Date().toISOString(),
          codeFilesMigrationCount: results.codeFilesFixed,
        };

        const { error: updateError } = await supabase
          .from("documents")
          .update({
            metadata: updatedMetadata as Json,
          })
          .eq("id", validDocumentId);

        if (updateError) {
          console.error("Error updating document metadata:", updateError);
          results.actions.push(
            `Failed to update document metadata: ${updateError.message}`,
          );
        } else {
          results.actions.push(
            `Updated document metadata to mark code files as migrated`,
          );
        }
      }
    } else {
      results.actions.push(
        "Code files already exist and reprocessExisting is false",
      );
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error in validate-codefiles API:", error);
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
