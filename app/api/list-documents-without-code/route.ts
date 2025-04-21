import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { captureException } from "../../../lib/error-reporting";

// Schema for validating the request
const ListDocumentsWithoutCodeSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  skipPlaceholders: z.boolean().default(false),
  batchId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request
    const body = await request.json();
    const validatedData = ListDocumentsWithoutCodeSchema.parse(body);

    // Find documents without code files
    let query = supabase
      .from("documents")
      .select("id, content, metadata, batch_id, created_at");

    // If batchId is provided, filter by it
    if (validatedData.batchId) {
      query = query.eq("batch_id", validatedData.batchId);
    }

    // Get documents that have code files in the codefiles table
    const { data: documentsWithCodeFiles, error: codefilesError } =
      await supabase.from("codefiles").select("document_id").limit(500);
    if (codefilesError) {
      console.error("Error finding documents with code files:", codefilesError);
      // Fallback: treat as if no documents have code files
    }
    // Get the document IDs that already have code files (empty if error)
    const documentIdsWithCode =
      documentsWithCodeFiles?.map((row) => row.document_id) || [];

    // Apply filter to get documents without code files
    if (documentIdsWithCode.length > 0) {
      // Exclude any documents whose IDs appear in the codefiles table
      const quotedIds = documentIdsWithCode.map((id) => `'${id}'`).join(",");
      // e.g. not in ('id1','id2',...)
      query = query.not("id", "in", `(${quotedIds})`);
    }

    // Skip placeholder documents if requested
    if (validatedData.skipPlaceholders) {
      query = query
        .not("content", "ilike", '%"placeholder": true%')
        .not("content", "ilike", '%"placeholder":true%')
        .not("metadata->isPlaceholder", "eq", "true");
    }

    // Limit the number of results
    query = query.limit(validatedData.limit);

    // Execute the query
    const { data: documentsWithoutCode, error: documentsError } = await query;

    if (documentsError) {
      console.error(
        "Error finding documents without code files:",
        documentsError,
      );
      // Fallback to empty result instead of error to avoid client-side exception
      return NextResponse.json({
        success: true,
        totalDocuments: 0,
        documents: [],
        filters: {
          batchId: validatedData.batchId,
          skipPlaceholders: validatedData.skipPlaceholders,
          limit: validatedData.limit,
        },
      });
    }

    // Prepare the response data
    const documents =
      documentsWithoutCode?.map((doc) => ({
        id: doc.id,
        contentSample:
          typeof doc.content === "string"
            ? doc.content.substring(0, 100) +
              (doc.content.length > 100 ? "..." : "")
            : "Non-string content",
        batchId: doc.batch_id,
        createdAt: doc.created_at,
        isPlaceholder:
          doc.content === '{"placeholder": true}' ||
          doc.content === '{"placeholder":true}' ||
          (doc.metadata &&
            (doc.metadata as Record<string, any>).isPlaceholder === true),
        metadataKeys: doc.metadata
          ? Object.keys(doc.metadata as Record<string, any>)
          : [],
      })) || [];

    return NextResponse.json({
      success: true,
      totalDocuments: documents.length,
      documents,
      filters: {
        batchId: validatedData.batchId,
        skipPlaceholders: validatedData.skipPlaceholders,
        limit: validatedData.limit,
      },
    });
  } catch (error) {
    console.error("Error in list-documents-without-code API:", error);
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
