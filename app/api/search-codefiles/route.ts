import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { captureException } from "@/lib/error-reporting";
import { supabase } from "@/lib/supabase-client";
import crypto from "crypto";
import { getCodeFilesByStepInfo } from "@/lib/codefile-service";

// Helper to determine language from filename
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  // Map common extensions to their languages
  const extensionToLanguage: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    java: "java",
    go: "go",
    rs: "rust",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
  };

  return extension
    ? extensionToLanguage[extension] || "plaintext"
    : "plaintext";
}

// Schema for validating the request body
const SearchCodeFilesRequestSchema = z.object({
  query: z.string().min(1).optional(),
  mode: z
    .enum(["search", "batch", "step", "document-metadata"])
    .default("search"),
  documentId: z.string().optional(),
  runId: z.number().optional(),
  stepNumber: z.number().optional(),
  batchId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request
    const body = await request.json();
    console.log("search-codefiles API request:", body);

    // Validate the request data
    const validationResult = SearchCodeFilesRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    // Handle document-metadata mode
    if (
      validatedData.mode === "document-metadata" &&
      validatedData.documentId
    ) {
      try {
        console.log(
          `Fetching document metadata for ${validatedData.documentId}`,
        );

        // Fetch document metadata
        const { data: document, error } = await supabase
          .from("documents")
          .select("metadata")
          .eq("id", validatedData.documentId)
          .single();

        if (error) {
          console.error("Error fetching document metadata:", error);
          return NextResponse.json(
            { success: false, error: "Error fetching document metadata" },
            { status: 500 },
          );
        }

        // Handle missing document
        if (!document) {
          return NextResponse.json(
            { success: false, error: "Document not found" },
            { status: 404 },
          );
        }

        // Extract metadata
        const metadata = document.metadata || {};

        return NextResponse.json({
          success: true,
          mode: "document-metadata",
          documentId: validatedData.documentId,
          metadata,
        });
      } catch (error) {
        console.error("Error handling document-metadata mode:", error);
        captureException(error, { context: "document-metadata mode error" });
        return NextResponse.json(
          { success: false, error: "Failed to retrieve document metadata" },
          { status: 500 },
        );
      }
    }

    // Handle step mode - just basic functionality
    if (validatedData.mode === "step") {
      try {
        const runId = validatedData.runId;
        const stepNumber = validatedData.stepNumber;
        const documentId = validatedData.documentId;
        const batchId = validatedData.batchId;

        console.log(
          `API: Processing step mode request with runId=${runId}, stepNumber=${stepNumber}, documentId=${documentId}, batchId=${batchId}`,
        );

        // If we have runId and stepNumber, try to find code files
        if (runId !== undefined && stepNumber !== undefined) {
          console.log(
            `Looking for code files for run ${runId}, step ${stepNumber}`,
          );

          // Use the getCodeFilesByStepInfo function from codefile-service to get code files
          // This function checks both the codefiles table and document metadata
          try {
            const codeFileRecords = await getCodeFilesByStepInfo(
              runId,
              stepNumber,
              batchId,
            );

            console.log(
              `Found ${codeFileRecords.length} code file records for run ${runId}, step ${stepNumber}`,
            );

            // Transform the CodeFileRecord objects to match the expected format
            const files = codeFileRecords.map((record) => ({
              filename: record.filename,
              code: record.code_content,
              language:
                record.language || getLanguageFromFilename(record.filename),
              id: record.id,
              documentId: record.document_id,
              batchId: record.batch_id,
              metadata: record.metadata || {},
              source: record.source || "codefiles_table",
            }));

            console.log(
              `Transformed ${files.length} code files for run ${runId}, step ${stepNumber}`,
            );

            return NextResponse.json({
              success: true,
              mode: "step",
              runId,
              stepNumber,
              batchId,
              files,
              totalFiles: files.length,
              source: "codefiles_service",
            });
          } catch (error) {
            console.error("Error fetching code files from service:", error);
            return NextResponse.json(
              {
                success: false,
                error: "Error fetching code files from service",
              },
              { status: 500 },
            );
          }
        }

        // If we have documentId, try to get metadata with code files
        if (documentId) {
          console.log(`Looking for code files for document ${documentId}`);

          // Fetch document metadata
          const { data: document, error } = await supabase
            .from("documents")
            .select("metadata")
            .eq("id", documentId)
            .single();

          if (error) {
            console.error("Error fetching document:", error);
            return NextResponse.json(
              { success: false, error: "Error fetching document" },
              { status: 500 },
            );
          }

          if (!document) {
            return NextResponse.json(
              { success: false, error: "Document not found" },
              { status: 404 },
            );
          }

          // Extract code files from metadata if present
          const metadata = document.metadata || {};

          // Safely check if metadata has codeFiles and it's an array
          const codeFiles =
            metadata &&
            typeof metadata === "object" &&
            "codeFiles" in metadata &&
            Array.isArray(metadata.codeFiles)
              ? metadata.codeFiles
              : [];

          return NextResponse.json({
            success: true,
            mode: "step",
            documentId,
            files: codeFiles,
            totalFiles: codeFiles.length,
            metadata,
          });
        }

        // If we have neither runId+stepNumber nor documentId, return error
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing required parameters. For step mode, provide either documentId or both runId and stepNumber.",
            mode: "step",
          },
          { status: 400 },
        );
      } catch (error) {
        console.error("Error handling step mode:", error);
        captureException(error, { context: "step mode error" });
        return NextResponse.json(
          {
            success: false,
            error: `Error in step mode: ${error instanceof Error ? error.message : "Unknown error"}`,
            mode: "step",
          },
          { status: 500 },
        );
      }
    }

    // Handle search mode (simplest implementation)
    if (validatedData.mode === "search") {
      // Require query for search mode
      if (!validatedData.query) {
        return NextResponse.json(
          { success: false, error: "Query is required for search mode" },
          { status: 400 },
        );
      }

      // Return empty results - implement actual search if needed
      return NextResponse.json({
        success: true,
        mode: "search",
        query: validatedData.query,
        results: [],
        totalResults: 0,
        message:
          "This is a simplified search implementation. Update to include actual search functionality.",
      });
    }

    // Default response for unhandled modes
    return NextResponse.json(
      {
        success: false,
        error: "Invalid mode or missing required parameters",
        mode: validatedData.mode,
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in search-codefiles API:", error);
    captureException(error, { context: "search-codefiles API error" });

    // Return a graceful error response
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
        message: "The server encountered an error processing your request.",
      },
      { status: 500 },
    );
  }
}
