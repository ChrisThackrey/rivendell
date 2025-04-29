import { supabase } from "./supabase-client";
import { captureException } from "./error-reporting";
import * as crypto from "crypto";
import { Json } from "./types/database.types";

/**
 * Generate a deterministic UUID v5 from any string input
 * This allows us to consistently create the same UUID for the same input string
 */
function generateDeterministicUuid(input: string): string {
  // We'll use a fixed namespace UUID (this is a UUID v4 I generated)
  const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

  try {
    // Use crypto module to create a SHA-1 hash
    const fullHash = crypto
      .createHash("sha1")
      .update(NAMESPACE)
      .update(input)
      .digest("hex");

    // Standard UUID format: 8-4-4-4-12 characters (total 32 hex chars + 4 hyphens = 36 chars)
    // Take just the first 32 characters of the hash to ensure proper UUID length
    return (
      fullHash.substring(0, 8) +
      "-" +
      fullHash.substring(8, 12) +
      "-" +
      fullHash.substring(12, 16) +
      "-" +
      fullHash.substring(16, 20) +
      "-" +
      fullHash.substring(20, 32)
    );
  } catch (error) {
    console.error("Error generating deterministic UUID:", error);
    // Fallback to a random UUID if crypto fails
    return crypto.randomUUID();
  }
}

/**
 * Ensure a document exists in the database
 * This will convert non-UUID IDs to deterministic UUIDs and create placeholder documents if needed
 *
 * @param documentId The document ID to ensure exists
 * @returns The actual UUID used in the database, or null if creation failed
 */
export async function ensureDocumentExists(
  documentId: string,
): Promise<string | null> {
  try {
    console.log(`Checking existence of document with ID: ${documentId}`);

    // Verify the ID looks usable (not empty and is a string)
    if (!documentId || typeof documentId !== "string") {
      console.error("Invalid document ID:", documentId);
      return null;
    }

    // Always convert step IDs to deterministic UUIDs first
    // This handles IDs like "step1-s1-run2" that aren't valid UUIDs
    const isValidUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        documentId,
      );

    const actualDocumentId = isValidUuid
      ? documentId
      : generateDeterministicUuid(documentId);
    const wasConverted = !isValidUuid;

    if (wasConverted) {
      console.log(`Converted non-UUID ID: ${documentId} → ${actualDocumentId}`);
    }

    // Check if the document already exists with the actual UUID
    const { data, error } = await supabase
      .from("documents")
      .select("id")
      .eq("id", actualDocumentId)
      .single();

    if (data) {
      console.log(`Document ${actualDocumentId} already exists`);
      return actualDocumentId;
    }

    // Handle errors
    if (error && error.code !== "PGRST116") {
      console.error("Error checking document existence:", error);
      return null;
    }

    // Document doesn't exist, create a placeholder document
    console.log(`Creating placeholder document with ID: ${actualDocumentId}`);
    const { error: insertError } = await supabase.from("documents").insert({
      id: actualDocumentId,
      content: '{"placeholder": true}',
      metadata: {
        isPlaceholder: true,
        createdAt: new Date().toISOString(),
        source: "document-service",
        originalId: wasConverted ? documentId : undefined,
      } as Json,
      embedding: null, // We're not using embeddings for placeholder documents
    });

    if (insertError) {
      // Check for duplicate key error (concurrent creation)
      if (
        insertError.code === "23505" ||
        insertError.message?.includes("duplicate key")
      ) {
        console.log(
          `Document ${actualDocumentId} was created concurrently, using it`,
        );
        return actualDocumentId;
      }

      console.error("Error creating placeholder document:", insertError);
      return null;
    }

    console.log(`Created placeholder document with ID: ${actualDocumentId}`);
    return actualDocumentId;
  } catch (error) {
    console.error("Error in ensureDocumentExists:", error);
    captureException(error);
    return null;
  }
}

/**
 * Get a document by ID, converting non-UUID IDs as needed
 */
export async function getDocumentById(documentId: string): Promise<{
  data: any | null;
  error: any | null;
  actualDocumentId: string | null;
}> {
  try {
    // First ensure the document exists and get the actual UUID
    const actualDocumentId = await ensureDocumentExists(documentId);
    if (!actualDocumentId) {
      return {
        data: null,
        error: { message: "Failed to ensure document exists" },
        actualDocumentId: null,
      };
    }

    // Fetch the document with the actual UUID
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", actualDocumentId)
      .single();

    return { data, error, actualDocumentId };
  } catch (error) {
    console.error("Error in getDocumentById:", error);
    captureException(error);
    return {
      data: null,
      error: { message: "Error retrieving document", details: error },
      actualDocumentId: null,
    };
  }
}

/**
 * Update a document's metadata with code files
 * This ensures the document's metadata correctly references code files in both places
 */
export async function updateDocumentCodeFiles(
  documentId: string,
  codeFiles: Array<{ filename: string; language: string; code: string }>,
): Promise<boolean> {
  try {
    // First ensure the document exists and get the actual UUID
    const actualDocumentId = await ensureDocumentExists(documentId);
    if (!actualDocumentId) {
      console.error(
        `Cannot update document code files - document ${documentId} does not exist`,
      );
      return false;
    }

    // Get current document metadata
    const { data, error } = await supabase
      .from("documents")
      .select("metadata")
      .eq("id", actualDocumentId)
      .single();

    if (error) {
      console.error(
        `Error getting document metadata for code files update:`,
        error,
      );
      return false;
    }

    // Prepare updated metadata
    const metadata = (data.metadata as Record<string, any>) || {};

    // Update the codeFiles field in metadata
    metadata.codeFiles = codeFiles.map((file) => ({
      filename: file.filename,
      language: file.language,
      code: file.code,
    }));

    // If there's a single code file, also store it in the 'code' field for backward compatibility
    if (codeFiles.length === 1) {
      metadata.code = codeFiles[0].code;
      metadata.filename = codeFiles[0].filename;
      metadata.language = codeFiles[0].language;
    }

    // Update the document metadata
    const { error: updateError } = await supabase
      .from("documents")
      .update({ metadata })
      .eq("id", actualDocumentId);

    if (updateError) {
      console.error(
        `Error updating document metadata with code files:`,
        updateError,
      );
      return false;
    }

    console.log(
      `Updated document ${actualDocumentId} metadata with ${codeFiles.length} code files`,
    );
    return true;
  } catch (error) {
    console.error("Error in updateDocumentCodeFiles:", error);
    captureException(error);
    return false;
  }
}
