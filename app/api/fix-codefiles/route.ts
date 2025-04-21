import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { generateEmbedding } from "../../../lib/embedding-service";
import { captureException } from "../../../lib/error-reporting";
import { type CodeFile } from "../../../lib/supabase-client";
import {
  extractCodeFilesFromDocument,
  storeCodeFileWithEmbedding,
} from "../../../lib/codefile-service";
import * as crypto from "crypto";
import { type Json } from "../../../lib/database.types";

// Import ensureDocumentExists explicitly
import { ensureDocumentExists } from "../../../lib/document-service";

// Schema for validating the request body
const FixCodeFilesRequestSchema = z
  .object({
    documentId: z.string().optional(),
    stepId: z.string().optional(),
  })
  .refine((data) => data.documentId || data.stepId, {
    message: "Either documentId or stepId must be provided",
    path: ["documentId"],
  });

// Helper function to generate sample code for placeholder documents
async function createSampleCodeForDocument(
  documentId: string,
  sampleType: string = "job-analyzer",
): Promise<CodeFile[]> {
  try {
    // Call the create-sample-code API internally
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/create-sample-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          sampleType,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `Failed to create sample code for document ${documentId}: ${response.statusText}`,
      );
      return [];
    }

    const data = await response.json();
    console.log(
      `Created ${data.totalCodeFiles} sample code files for document ${documentId}`,
    );

    // Extract sample code files from the response
    return data.results
      .filter((result: any) => result.status === "success")
      .map((result: any) => ({
        filename: result.filename,
        language: result.language || "plaintext",
        code: "/* Sample code generated for placeholder document */",
      }));
  } catch (error) {
    console.error(
      `Error creating sample code for document ${documentId}:`,
      error,
    );
    return [];
  }
}

// Helper function to check if a document is a placeholder
function isPlaceholderDocument(
  content: string,
  metadata: Record<string, any>,
): boolean {
  // Check content for placeholder signature
  if (typeof content === "string") {
    if (
      content === '{"placeholder": true}' ||
      content === '{"placeholder":true}' ||
      content.includes('"placeholder": true') ||
      content.includes('"created_by": "fix-codefiles-api"')
    ) {
      return true;
    }
  }

  // Check metadata for placeholder flag
  if (metadata && typeof metadata === "object") {
    if (
      metadata.isPlaceholder === true ||
      metadata.source === "fix-codefiles-api-fallback" ||
      metadata.source === "document-service"
    ) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // When parsing request body, log more details:
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body as JSON:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Log the full request body for debugging (but sanitize any sensitive content)
    console.log("fix-codefiles API full request:", {
      ...requestData,
      code: requestData.code
        ? `${requestData.code.substring(0, 50)}... (${requestData.code.length} chars)`
        : undefined,
    });

    // Try to validate the data
    let validatedData;
    try {
      validatedData = FixCodeFilesRequestSchema.parse(requestData);
    } catch (validationError) {
      console.error("Validation error:", validationError);

      // If there's a validation error but we still have some form of ID, try to proceed anyway
      if (requestData.documentId || requestData.stepId) {
        console.log("Proceeding with request despite validation error");
        validatedData = {
          documentId: requestData.documentId,
          stepId: requestData.stepId,
        };
      } else {
        throw validationError; // Re-throw if we can't recover
      }
    }

    // Special case: if stepId is provided but documentId is not, use stepId as documentId
    if (!validatedData.documentId && validatedData.stepId) {
      console.log(
        `Using stepId ${validatedData.stepId} as documentId since no documentId was provided`,
      );
      validatedData.documentId = validatedData.stepId;
    }

    // Get the document ID (or step ID which we'll use as document ID)
    const originalDocumentId = validatedData.documentId || validatedData.stepId;

    if (!originalDocumentId) {
      return NextResponse.json(
        { error: "Missing document ID or step ID" },
        { status: 400 },
      );
    }

    console.log(`Processing code files for document ID: ${originalDocumentId}`);

    try {
      // First, explicitly ensure the document exists and convert non-UUID IDs
      // This will create a placeholder document if it doesn't exist
      let validDocumentId = await ensureDocumentExists(originalDocumentId);

      // If we couldn't create/convert the document, create a basic document manually
      if (!validDocumentId) {
        console.error(
          `Failed to ensure document exists for ID: ${originalDocumentId}, attempting manual creation`,
        );

        // Generate deterministic UUID for non-UUID format IDs
        let documentUuid;
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            originalDocumentId,
          )
        ) {
          documentUuid = originalDocumentId;
        } else {
          try {
            // Create a deterministic UUID from the step ID
            // We'll create a SHA-1 hash and format it as a UUID
            const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
            const hash = crypto
              .createHash("sha1")
              .update(NAMESPACE)
              .update(originalDocumentId)
              .digest("hex");

            // Format the first 32 chars of the hash as a UUID v5
            documentUuid = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;

            console.log(
              `Manual conversion of ID: ${originalDocumentId} → ${documentUuid}`,
            );
          } catch (cryptoError) {
            console.error("Error generating UUID:", cryptoError);
            // Generate a simple hash-based ID if crypto fails
            const simpleHash = String(originalDocumentId)
              .split("")
              .reduce((acc, char) => {
                return ((acc << 5) - acc + char.charCodeAt(0)) >>> 0;
              }, 0);
            documentUuid = `fallback-${simpleHash}-${Date.now()}`;
            console.log(`Using fallback ID: ${documentUuid}`);
          }
        }

        // Once we have a documentUuid, check if it already exists before trying to create it
        const { data: existingDoc, error: checkError } = await supabase
          .from("documents")
          .select("id")
          .eq("id", documentUuid)
          .maybeSingle();

        if (existingDoc) {
          console.log(
            `Document with ID ${documentUuid} already exists, using it`,
          );
          validDocumentId = documentUuid;
        } else if (!checkError) {
          // Only create if it truly doesn't exist (no check error)
          try {
            const { data: insertData, error: insertError } = await supabase
              .from("documents")
              .insert({
                id: documentUuid,
                content:
                  '{"placeholder": true, "created_by": "fix-codefiles-api"}',
                metadata: {
                  isPlaceholder: true,
                  createdAt: new Date().toISOString(),
                  source: "fix-codefiles-api-fallback",
                  originalId: originalDocumentId,
                } as Json,
              })
              .select("id")
              .single();

            if (insertError) {
              // Double-check for duplicate key error (race condition)
              if (
                insertError.code === "23505" ||
                insertError.message?.includes("duplicate key")
              ) {
                console.log(
                  `Document with ID ${documentUuid} was created concurrently, using it`,
                );
                validDocumentId = documentUuid;
              } else {
                console.error("Manual document creation failed:", insertError);
                return NextResponse.json(
                  {
                    error: "Failed to create document after multiple attempts",
                    documentId: originalDocumentId,
                    details: insertError.message,
                  },
                  { status: 500 },
                );
              }
            } else {
              console.log(
                `Successfully created manual placeholder document: ${documentUuid}`,
              );
              validDocumentId = documentUuid;
            }
          } catch (insertError) {
            console.error("Error in manual document creation:", insertError);
            return NextResponse.json(
              {
                error: "Critical failure creating document",
                documentId: originalDocumentId,
                details:
                  insertError instanceof Error
                    ? insertError.message
                    : "Unknown error",
              },
              { status: 500 },
            );
          }
        } else {
          console.error("Error checking if document exists:", checkError);
          return NextResponse.json(
            {
              error: "Failed to check if document exists",
              documentId: originalDocumentId,
              details: checkError.message,
            },
            { status: 500 },
          );
        }
      }

      console.log(
        `Using document ID: ${validDocumentId} ${validDocumentId !== originalDocumentId ? `(converted from ${originalDocumentId})` : ""}`,
      );

      // Now get the document using the validated ID
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("content, metadata, batch_id")
        .eq("id", validDocumentId as string)
        .single();

      // Process any code files provided in the request
      let requestCodeFiles: CodeFile[] = [];

      // If body has code files, use them
      if (
        requestData.codeFiles &&
        Array.isArray(requestData.codeFiles) &&
        requestData.codeFiles.length > 0
      ) {
        requestCodeFiles = requestData.codeFiles.map((file: any) => ({
          filename: file.filename || "unknown.txt",
          language: file.language || "plaintext",
          code: file.code || "",
        }));
      }

      // If no code files provided in request, try to scan for them in other fields
      if (requestCodeFiles.length === 0 && requestData.code) {
        requestCodeFiles.push({
          filename: requestData.filename || "code.txt",
          language: requestData.language || "plaintext",
          code: requestData.code,
        });
      }

      // If document retrieval failed but we should have a placeholder
      if (documentError) {
        console.log(
          `Document ${validDocumentId} not accessible after ensuring existence: ${documentError.message}`,
        );

        // If we have code files in the request body, we can still store them
        if (requestCodeFiles.length > 0) {
          // Store the code files using the valid document ID
          const results = [];
          let insertCount = 0;
          let errorCount = 0;

          for (const codeFile of requestCodeFiles) {
            try {
              console.log(
                `Storing code file ${codeFile.filename} for document ${validDocumentId}...`,
              );
              const id = await storeCodeFileWithEmbedding(
                codeFile,
                validDocumentId as string, // We know it's not null at this point
                null, // batch_id
                null, // runId
                null, // stepNumber
                {
                  isPlaceholder: true,
                  source: "fix-codefiles-api",
                  originalId:
                    originalDocumentId !== validDocumentId
                      ? originalDocumentId
                      : undefined,
                },
              );

              if (id) {
                console.log(
                  `Successfully stored code file ${codeFile.filename} with ID ${id}`,
                );
                insertCount++;
                results.push({
                  filename: codeFile.filename,
                  language: codeFile.language || "plaintext",
                  code: codeFile.code,
                  status: "success",
                  id: id,
                });
              } else {
                console.error(`Failed to store code file ${codeFile.filename}`);
                errorCount++;
                results.push({
                  filename: codeFile.filename,
                  status: "error",
                  message: "Failed to insert code file",
                });
              }
            } catch (error) {
              console.error(
                `Error processing code file ${codeFile.filename}:`,
                error,
              );
              errorCount++;
              results.push({
                filename: codeFile.filename,
                status: "error",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return NextResponse.json({
            success: true,
            documentId: originalDocumentId,
            validDocumentId: validDocumentId,
            totalCodeFiles: requestCodeFiles.length,
            inserted: insertCount,
            errors: errorCount,
            files: results.map((result) => ({
              ...result,
              hasContent: true,
            })),
            sourcesChecked: ["request.codeFiles", "request.code"],
            createdPlaceholder: true,
          });
        } else {
          // No code files in request, but document should exist as a placeholder now
          // Create sample code for the placeholder document
          console.log(
            `Creating sample code for placeholder document ${validDocumentId}`,
          );
          const sampleCodeFiles = await createSampleCodeForDocument(
            validDocumentId as string,
          );

          if (sampleCodeFiles.length > 0) {
            console.log(
              `Generated ${sampleCodeFiles.length} sample code files`,
            );
            return NextResponse.json(
              {
                success: true,
                documentId: originalDocumentId,
                validDocumentId: validDocumentId,
                message: "Created sample code files for placeholder document",
                createdPlaceholder: true,
                codeFilesCount: sampleCodeFiles.length,
                generatedSampleCode: true,
              },
              { status: 200 },
            );
          } else {
            // We'll return a more informative 200 status rather than 404
            return NextResponse.json(
              {
                success: true,
                documentId: originalDocumentId,
                validDocumentId: validDocumentId,
                message:
                  "Placeholder document created, but failed to generate sample code",
                createdPlaceholder: true,
                codeFilesCount: 0,
              },
              { status: 200 },
            );
          }
        }
      }

      // Check if the document is a placeholder document
      const metadata = document.metadata as Record<string, any>;
      const isPlaceholder = isPlaceholderDocument(document.content, metadata);

      if (isPlaceholder) {
        console.log(
          `Document ${validDocumentId} is a placeholder document, creating sample code`,
        );
        // Create sample code for the placeholder document
        const sampleCodeFiles = await createSampleCodeForDocument(
          validDocumentId as string,
        );

        if (sampleCodeFiles.length > 0) {
          // Store the sample code files
          const results = [];
          let insertCount = 0;
          let errorCount = 0;

          for (const codeFile of sampleCodeFiles) {
            try {
              const id = await storeCodeFileWithEmbedding(
                codeFile,
                validDocumentId as string,
                document.batch_id || null,
                metadata.runId || null,
                metadata.stepNumber || null,
                {
                  ...metadata,
                  source: "fix-codefiles-api-sample",
                  generatedForPlaceholder: true,
                  originalId:
                    originalDocumentId !== validDocumentId
                      ? originalDocumentId
                      : undefined,
                },
              );

              if (id) {
                console.log(
                  `Inserted sample code file ${codeFile.filename} with ID ${id}`,
                );
                insertCount++;
                results.push({
                  filename: codeFile.filename,
                  language: codeFile.language || "plaintext",
                  status: "success",
                  id: id,
                });
              } else {
                console.error(
                  `Error inserting sample code file ${codeFile.filename}`,
                );
                errorCount++;
                results.push({
                  filename: codeFile.filename,
                  status: "error",
                  message: "Failed to insert code file",
                });
              }
            } catch (error) {
              console.error(
                `Error processing sample code file ${codeFile.filename}:`,
                error,
              );
              errorCount++;
              results.push({
                filename: codeFile.filename,
                status: "error",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return NextResponse.json({
            success: true,
            documentId: originalDocumentId,
            validDocumentId: validDocumentId,
            totalCodeFiles: sampleCodeFiles.length,
            inserted: insertCount,
            errors: errorCount,
            files: results,
            sourcesChecked: ["placeholder-document"],
            isPlaceholder: true,
            generatedSampleCode: true,
          });
        }
      }

      // Document found, extract code files from it
      let documentCodeFiles: CodeFile[] = [];
      let sourcesChecked = [];

      // Extract code files from document
      documentCodeFiles = await extractCodeFilesFromDocument(
        validDocumentId as string,
        document.content,
        document.metadata as Record<string, any>,
      );

      // If no code files were extracted, and it wasn't handled by the placeholder check,
      // create sample code
      if (documentCodeFiles.length === 0) {
        console.log(
          `No code files extracted from document ${validDocumentId}, creating sample code`,
        );
        const sampleCodeFiles = await createSampleCodeForDocument(
          validDocumentId as string,
        );

        if (sampleCodeFiles.length > 0) {
          documentCodeFiles = sampleCodeFiles;
          sourcesChecked = ["generated-sample"];
        } else {
          sourcesChecked = [
            "metadata.codeFiles",
            "document.content",
            "markdown_content",
          ];
        }
      } else {
        sourcesChecked = [
          "metadata.codeFiles",
          "document.content",
          "markdown_content",
        ];
      }

      // Combine code files from document and request
      const allCodeFiles = [...documentCodeFiles, ...requestCodeFiles];

      if (requestCodeFiles.length > 0) {
        sourcesChecked.push("request.body");
      }

      // Check if we found any code files
      if (allCodeFiles.length === 0) {
        console.log(
          `No code files found in document ${validDocumentId} after checking ${sourcesChecked.join(", ")}`,
        );
        return NextResponse.json(
          {
            success: true,
            message: "Document exists but no code files found",
            documentId: originalDocumentId,
            validDocumentId: validDocumentId,
            sourcesChecked,
          },
          { status: 200 },
        );
      }

      // Store the code files in the codefiles table
      const results = [];
      let insertCount = 0;
      let errorCount = 0;

      const runId = metadata.runId || null;
      const stepNumber = metadata.stepNumber || null;

      // Keep track of the original code content before storing
      const codeFileContents = allCodeFiles.map((file) => ({
        filename: file.filename,
        language: file.language || "plaintext",
        code: file.code,
      }));

      for (const codeFile of allCodeFiles) {
        try {
          // Store code file with embedding
          const id = await storeCodeFileWithEmbedding(
            codeFile,
            validDocumentId as string, // Use the validated ID
            document.batch_id || null,
            runId,
            stepNumber,
            {
              ...metadata,
              originalId:
                originalDocumentId !== validDocumentId
                  ? originalDocumentId
                  : undefined,
            },
          );

          if (id) {
            console.log(
              `Inserted code file ${codeFile.filename} with ID ${id}`,
            );
            insertCount++;
            results.push({
              filename: codeFile.filename,
              language: codeFile.language || "plaintext",
              code: codeFile.code,
              status: "success",
              id: id,
            });
          } else {
            console.error(`Error inserting code file ${codeFile.filename}`);
            errorCount++;
            results.push({
              filename: codeFile.filename,
              status: "error",
              message: "Failed to insert code file",
            });
          }
        } catch (error) {
          console.error(
            `Error processing code file ${codeFile.filename}:`,
            error,
          );
          errorCount++;
          results.push({
            filename: codeFile.filename,
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // After getting document content, analyze it better:
      if (document) {
        // Log document metadata and content sample for debugging
        console.log(`Document ${validDocumentId} metadata:`, {
          hasMetadata: !!metadata,
          metadataKeys: metadata ? Object.keys(metadata) : [],
          hasCodeFiles: metadata && metadata.codeFiles ? true : false,
          codeFilesCount:
            metadata && metadata.codeFiles
              ? Array.isArray(metadata.codeFiles)
                ? metadata.codeFiles.length
                : "Not an array"
              : "No codeFiles",
          runId: metadata?.runId,
          stepNumber: metadata?.stepNumber,
          batchId: document.batch_id,
        });

        // Log content sample for troubleshooting
        const contentSample = document.content
          ? typeof document.content === "string"
            ? document.content.substring(0, 150) +
              (document.content.length > 150 ? "..." : "")
            : "Content not a string"
          : "No content";
        console.log(
          `Document ${validDocumentId} content sample:`,
          contentSample,
        );
      }

      return NextResponse.json({
        success: true,
        documentId: originalDocumentId,
        validDocumentId: validDocumentId,
        totalCodeFiles: allCodeFiles.length,
        inserted: insertCount,
        errors: errorCount,
        files: results.map((result) => ({
          ...result,
          hasContent: true,
        })),
        sourcesChecked,
        contentSample: document.content
          ? document.content.substring(0, 100) + "..."
          : "No content",
        metadataInfo: {
          hasCodeFiles: (document.metadata as Record<string, any>)?.codeFiles
            ? true
            : false,
          keys: document.metadata
            ? Object.keys(document.metadata as Record<string, any>)
            : [],
        },
      });
    } catch (dbError) {
      console.error("Database error in fix-codefiles API:", dbError);
      return NextResponse.json(
        {
          error: "Database error",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in fix-codefiles API:", error);
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
