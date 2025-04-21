import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase-client";
import { searchSimilarDocuments } from "@/lib/embedding-service";
import { searchSimilarCodeFiles } from "@/lib/codefile-service";
import { captureException } from "@/lib/error-reporting";

// Define the CodeFileSearchResult type to ensure TypeScript compatibility
// This should match the return type from lib/codefile-service.ts searchSimilarCodeFiles
type CodeFileSearchResult = {
  id: string;
  document_id: string;
  batch_id: string | null;
  run_id: number | null;
  step_number: number | null;
  filename: string;
  language: string;
  code_content: string;
  metadata: any;
  similarity: number;
  created_at: string;
};

// Define request schema for searching
const SearchRequestSchema = z.object({
  query: z.string().min(1),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  maxResults: z.number().min(1).max(50).default(10),
  codeOnly: z.boolean().default(true), // Whether to return only docs with code
  fileType: z.string().optional(), // Filter by file type (.js, .py, etc.)
  componentType: z.string().optional(), // Filter by component type ("currency", "converter", etc.)
});

// Define request schema for retrieving snippets by ID
const GetSnippetRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10),
});

// Extract code snippets from a document
function extractCodeSnippets(content: string, metadata: any) {
  const snippets = [];

  // First check if there are explicit code files in metadata
  if (metadata?.codeFiles && Array.isArray(metadata.codeFiles)) {
    for (const file of metadata.codeFiles) {
      if (file.code && file.filename) {
        snippets.push({
          id: `${metadata.id || "unknown"}_${file.filename}`,
          filename: file.filename,
          language: file.language || getLanguageFromFilename(file.filename),
          code: file.code,
          description:
            getDescriptionFromCode(file.code) || `Code from ${file.filename}`,
          source: "metadata.codeFiles",
        });
      }
    }
  }

  // If no code files in metadata, try to extract from content
  if (snippets.length === 0) {
    // Try to extract code blocks from markdown format
    const codeBlockRegex =
      /```([a-zA-Z0-9]+)?\s*(?:\/\/\s*([a-zA-Z0-9_.\-]+))?\s*\n([\s\S]*?)```/g;
    let match;
    let counter = 1;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || "plaintext";
      // Use the filename from the comment or generate one
      const filename =
        match[2] ||
        `snippet${counter}.${getFileExtensionForLanguage(language)}`;
      const code = match[3] || "";

      if (code.trim()) {
        snippets.push({
          id: `${metadata.id || "unknown"}_${counter}`,
          filename,
          language,
          code,
          description:
            getDescriptionFromCode(code) || `Code snippet ${counter}`,
          source: "content.codeBlocks",
        });
        counter++;
      }
    }

    // Also try to parse as JSON and extract code
    try {
      let jsonContent;

      try {
        // First attempt direct parsing
        jsonContent = JSON.parse(content);
      } catch (initialJsonError: any) {
        // JSON parsing failed, attempt repair
        console.log("JSON parsing failed, attempting repair...");

        let repairedJson = content;

        // Apply common fixes
        if (!repairedJson.trim().endsWith("}")) {
          console.log("JSON missing closing bracket, adding it");
          repairedJson = repairedJson.trim() + "}";
        }

        // Try to balance braces and brackets
        const openBraces = (repairedJson.match(/{/g) || []).length;
        const closeBraces = (repairedJson.match(/}/g) || []).length;
        if (openBraces > closeBraces) {
          console.log(
            `Adding ${openBraces - closeBraces} missing closing braces`,
          );
          repairedJson = repairedJson + "}".repeat(openBraces - closeBraces);
        }

        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
          console.log(
            `Adding ${openBrackets - closeBrackets} missing closing brackets`,
          );
          repairedJson =
            repairedJson + "]".repeat(openBrackets - closeBrackets);
        }

        try {
          jsonContent = JSON.parse(repairedJson);
          console.log("Successfully repaired and parsed JSON");
        } catch (repairError: any) {
          console.log(`JSON repair failed: ${repairError.message}`);

          // Try extracting any valid JSON objects
          const jsonObjectRegex = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
          const potentialMatches = content.match(jsonObjectRegex);

          if (potentialMatches && potentialMatches.length > 0) {
            console.log(
              `Found ${potentialMatches.length} potential JSON objects`,
            );

            for (const match of potentialMatches) {
              try {
                jsonContent = JSON.parse(match);
                console.log("Found valid JSON object segment");
                break;
              } catch (matchError) {
                // Continue to the next potential match
              }
            }
          }

          if (!jsonContent) {
            throw new Error("Could not repair JSON content");
          }
        }
      }

      if (jsonContent.steps && Array.isArray(jsonContent.steps)) {
        for (const step of jsonContent.steps) {
          if (step.codeFiles && Array.isArray(step.codeFiles)) {
            let stepCounter = 1;
            for (const file of step.codeFiles) {
              if (file.code && file.filename) {
                snippets.push({
                  id: `${metadata.id || "unknown"}_${step.title || "step"}_${stepCounter}`,
                  filename: file.filename,
                  language:
                    file.language || getLanguageFromFilename(file.filename),
                  code: file.code,
                  description:
                    getDescriptionFromCode(file.code) ||
                    `Code from ${file.filename} (${step.title || "unknown step"})`,
                  source: "content.steps.codeFiles",
                  stepTitle: step.title,
                });
                stepCounter++;
              }
            }
          }
        }
      }

      // Also check for final solution code files
      if (jsonContent.finalSolution && jsonContent.finalSolution.codeFiles) {
        let finalCounter = 1;
        for (const file of jsonContent.finalSolution.codeFiles) {
          if (file.code && file.filename) {
            snippets.push({
              id: `${metadata.id || "unknown"}_final_${finalCounter}`,
              filename: file.filename,
              language: file.language || getLanguageFromFilename(file.filename),
              code: file.code,
              description:
                getDescriptionFromCode(file.code) ||
                `Final code from ${file.filename}`,
              source: "content.finalSolution.codeFiles",
            });
            finalCounter++;
          }
        }
      }

      // Also check for direct code property
      if (
        jsonContent.code &&
        typeof jsonContent.code === "string" &&
        jsonContent.code.trim()
      ) {
        snippets.push({
          id: `${metadata.id || "unknown"}_direct`,
          filename: jsonContent.filename || "code.txt",
          language: jsonContent.language || "plaintext",
          code: jsonContent.code,
          description:
            getDescriptionFromCode(jsonContent.code) || "Direct code content",
          source: "content.code",
        });
      }
    } catch (jsonError) {
      // Not JSON content or couldn't repair it, no need to log error
    }
  }

  return snippets;
}

// Helper to get a description from code comments
function getDescriptionFromCode(code: string): string | null {
  if (!code) return null;

  // Look for JS/TS/Java style comments with decent descriptions
  const jsCommentMatch = code.match(/\/\*\*?\s*([\s\S]*?)\s*\*\//);
  if (jsCommentMatch && jsCommentMatch[1]) {
    return jsCommentMatch[1].replace(/\s*\*\s*/g, " ").trim();
  }

  // Look for single-line comments at the start
  const lines = code.split("\n").slice(0, 5);
  const commentLines = lines
    .filter(
      (line) => line.trim().startsWith("//") || line.trim().startsWith("#"),
    )
    .map((line) => line.replace(/^[\s]*\/\/|^[\s]*#/, "").trim());

  if (commentLines.length > 0) {
    return commentLines.join(" ");
  }

  return null;
}

// Helper function to get file extension for a language
function getFileExtensionForLanguage(language: string): string {
  const extensionMap: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    jsx: "jsx",
    tsx: "tsx",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    python: "py",
    ruby: "rb",
    java: "java",
    csharp: "cs",
    go: "go",
    rust: "rs",
    php: "php",
    swift: "swift",
    kotlin: "kt",
    plaintext: "txt",
  };

  return extensionMap[language.toLowerCase()] || "txt";
}

// Helper function to get language from filename
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    py: "python",
    rb: "ruby",
    java: "java",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    swift: "swift",
    kt: "kotlin",
  };

  return languageMap[extension] || "plaintext";
}

// Function to filter snippets by file type and component type
function filterSnippets(
  snippets: any[],
  fileType?: string,
  componentType?: string,
) {
  let filtered = snippets;

  // Filter by file type
  if (fileType) {
    filtered = filtered.filter((snippet) => {
      const ext = snippet.filename.split(".").pop()?.toLowerCase();
      return ext === fileType.replace(".", "").toLowerCase();
    });
  }

  // Filter by component type (search in code and description)
  if (componentType) {
    const typeKeywords = componentType.toLowerCase().split(/[\s,]+/);
    filtered = filtered.filter((snippet) => {
      const searchText =
        `${snippet.description} ${snippet.code} ${snippet.filename}`.toLowerCase();
      return typeKeywords.some((keyword) => searchText.includes(keyword));
    });
  }

  return filtered;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body as JSON:", parseError);
      captureException(parseError, {
        context: "Failed to parse request body as JSON",
      });
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate request using Zod
    const validationResult = SearchRequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      console.error("Invalid request data:", validationResult.error.format());
      captureException(new Error("Invalid request data"), {
        context: "Invalid code snippet search request data",
        details: JSON.stringify(validationResult.error.format()),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const {
      query,
      similarityThreshold,
      maxResults,
      codeOnly,
      fileType,
      componentType,
    } = validationResult.data;

    console.log(`Searching for code snippets matching: "${query}"`);

    // Convert fileType to language format for direct code file search
    let filterLanguage: string | undefined;
    if (fileType && fileType !== "all") {
      switch (fileType) {
        case "js":
          filterLanguage = "javascript";
          break;
        case "ts":
          filterLanguage = "typescript";
          break;
        case "jsx":
          filterLanguage = "jsx";
          break;
        case "tsx":
          filterLanguage = "tsx";
          break;
        case "css":
          filterLanguage = "css";
          break;
        case "py":
          filterLanguage = "python";
          break;
        case "html":
          filterLanguage = "html";
          break;
        default:
          filterLanguage = undefined;
      }
    }

    // STEP 1: Search for similar code files directly using the dedicated function
    // This now searches exclusively the codefiles table with proper embeddings
    // and correctly uses document_codefile_relationships
    console.log(
      `Searching code files with query "${query}", threshold ${similarityThreshold}, language filter: ${filterLanguage || "none"}`,
    );

    // First, check if there are any code files at all in the codefiles table
    const { count: codefilesCount, error: countError } = await supabase
      .from("codefiles")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("Error counting codefiles:", countError);
      captureException(countError, { context: "Error counting codefiles" });
    }

    console.log(`Total codefiles in database: ${codefilesCount || 0}`);

    // Initialize an array to hold the code file search results
    let similarCodeFiles: CodeFileSearchResult[] = [];

    // If there are no code files at all, we should fall back to document search immediately
    if (!codefilesCount || codefilesCount === 0) {
      console.log(
        "No code files in codefiles table, will search through documents directly",
      );

      // Log the issue for debugging
      console.log(
        "No code files found in codefiles table at all - skipping embeddings search",
      );

      return NextResponse.json({
        success: true,
        snippets: [],
        total: 0,
        message: "No code files found in the database",
      });
    } else {
      // Proceed with regular search
      // Lower the similarity threshold to get more results
      const effectiveThreshold =
        similarityThreshold < 0.5
          ? similarityThreshold
          : Math.max(0.3, similarityThreshold - 0.2);
      console.log(
        `Using effective similarity threshold: ${effectiveThreshold} (original: ${similarityThreshold})`,
      );

      try {
        similarCodeFiles = await searchSimilarCodeFiles(
          query,
          effectiveThreshold, // Use a lower threshold to ensure we get some results
          maxResults,
          filterLanguage,
        );

        console.log(
          `Found ${similarCodeFiles.length} direct code file matches from codefiles table`,
        );

        // Log details of found files for debugging
        if (similarCodeFiles.length > 0) {
          similarCodeFiles.forEach((file, index) => {
            console.log(
              `CodeFile #${index + 1}: ${file.filename} (docId: ${file.document_id}, similarity: ${file.similarity.toFixed(3)})`,
            );
          });
        } else {
          console.log(
            `No code files found in codefiles table for query "${query}" - this may indicate an issue with embeddings or the search function`,
          );
        }
      } catch (searchError) {
        console.error("Error searching for similar code files:", searchError);
        similarCodeFiles = []; // Ensure we have an empty array if search fails
      }

      // If no results found with vector search, try text search as fallback
      if (similarCodeFiles.length === 0) {
        // If no similar code files found with vector search, let's check for basic text matching
        // as a fallback - this doesn't require embeddings to work
        console.log("Trying direct SQL text search as fallback...");

        try {
          // Simple text search with ILIKE
          const { data: directMatchFiles, error: directMatchError } =
            await supabase
              .from("codefiles")
              .select("*")
              .or(`filename.ilike.%${query}%, code_content.ilike.%${query}%`)
              .limit(maxResults);

          if (directMatchError) {
            console.error("Error in direct text search:", directMatchError);
          }

          if (directMatchFiles && directMatchFiles.length > 0) {
            console.log(
              `Found ${directMatchFiles.length} code files with direct text search`,
            );

            // Format results as CodeFileSearchResult[]
            const textMatchResults: CodeFileSearchResult[] =
              directMatchFiles.map((file) => ({
                ...file,
                similarity: 0.6, // Default similarity for text matches
              }));

            // Use these results
            similarCodeFiles = textMatchResults;
          } else {
            console.log("No results from direct text search either");
          }
        } catch (textSearchError) {
          console.error("Error in fallback text search:", textSearchError);
        }
      }
    }

    // Format code file results - check if we have any results first
    if (similarCodeFiles.length === 0) {
      // No results found after all attempts, return empty array
      console.log("No code files found after all search attempts");
      return NextResponse.json({
        success: true,
        snippets: [],
        total: 0,
        message: "No code snippets found matching your query",
      });
    }

    // Process the results we found
    const codeFileSnippetsPromises = similarCodeFiles.map(async (codeFile) => {
      // Extract document title or step title from metadata
      const metadata = codeFile.metadata as any;
      const documentTitle =
        typeof metadata === "object" && metadata
          ? metadata.stepTitle || metadata.title || codeFile.filename
          : codeFile.filename;

      // Need to find model information from documents table based on document_id
      // Using document_codefile_relationships view when possible
      let modelUsed = "Unknown model";
      try {
        // First get the document directly using document_id
        if (codeFile.document_id) {
          console.log(
            `Looking for model info for document_id: ${codeFile.document_id}`,
          );

          // Simply get the document directly since we have its ID
          // This avoids TypeScript issues with the view
          const { data: documentData, error: documentError } = await supabase
            .from("documents")
            .select("metadata, batch_id")
            .eq("id", codeFile.document_id)
            .single();

          // Also get code files count from codefiles table directly
          const { count, error: countError } = await supabase
            .from("codefiles")
            .select("id", { count: "exact", head: true })
            .eq("document_id", codeFile.document_id);

          // Construct our own relation data
          const relationData = documentData
            ? {
                document_id: codeFile.document_id,
                batch_id: documentData.batch_id,
                run_id:
                  documentData.metadata &&
                  typeof documentData.metadata === "object"
                    ? (documentData.metadata as any).runId
                    : null,
                document_created: new Date().toISOString(),
                has_codefiles: count && count > 0,
                codefiles_count: count || 0,
              }
            : null;

          const relationError = documentError || countError;

          if (relationError) {
            console.error(
              "Error querying document_codefile_relationships:",
              relationError,
            );
          }

          if (relationData) {
            console.log(
              `Found document relationship data: batch=${relationData.batch_id}, run=${relationData.run_id}`,
            );

            // Now get the document to extract model info
            const { data: document, error: docError } = await supabase
              .from("documents")
              .select("metadata")
              .eq("id", codeFile.document_id)
              .single();

            if (docError) {
              console.error("Error getting document:", docError);
            }

            if (document && document.metadata) {
              const docMetadata = document.metadata as any;
              if (docMetadata.model) {
                console.log(
                  `Found model in document metadata: ${docMetadata.model}`,
                );
                modelUsed = docMetadata.model;
              }
            }
          } else {
            // Fallback to direct document query if relationship view doesn't return results
            console.log(
              "No relationship data found, querying document directly",
            );

            const { data: document, error: docError } = await supabase
              .from("documents")
              .select("metadata, batch_id")
              .eq("id", codeFile.document_id)
              .single();

            if (docError) {
              console.error("Error getting document:", docError);
            }

            if (document && document.metadata) {
              const docMetadata = document.metadata as any;
              if (docMetadata.model) {
                console.log(
                  `Found model in direct document query: ${docMetadata.model}`,
                );
                modelUsed = docMetadata.model;
              }
            }
          }
        }
        // If we still don't have a model, try batch_id and run_id as fallback
        else if (codeFile.batch_id && codeFile.run_id) {
          console.log(
            `Looking for model info using batch_id: ${codeFile.batch_id}, run_id: ${codeFile.run_id}`,
          );

          // Try exact match on runId in metadata
          const { data: matchingDocument } = await supabase
            .from("documents")
            .select("id, metadata")
            .eq("batch_id", codeFile.batch_id)
            .eq(
              "metadata->>runId",
              codeFile.run_id ? codeFile.run_id.toString() : "",
            )
            .maybeSingle();

          if (matchingDocument && matchingDocument.metadata) {
            // Extract model name from document metadata
            const docMetadata = matchingDocument.metadata as any;
            if (docMetadata.model) {
              console.log(
                `Found model by runId exact match: ${docMetadata.model}`,
              );
              modelUsed = docMetadata.model;
            }
          }
        }
      } catch (err) {
        console.error(`Error finding model information for code file:`, err);
        captureException(err, {
          context: "Error finding model information",
          documentId: codeFile.document_id,
          batchId: codeFile.batch_id,
          runId: codeFile.run_id,
        });
      }

      // Additional fallback strategies if model is still unknown
      if (modelUsed === "Unknown model") {
        // Check direct metadata on the codeFile
        if (typeof metadata === "object" && metadata) {
          if (metadata.model) {
            console.log(
              `Using model from codeFile metadata: ${metadata.model}`,
            );
            modelUsed = metadata.model;
          } else if (
            metadata.documentMetadata &&
            typeof metadata.documentMetadata === "object" &&
            metadata.documentMetadata.model
          ) {
            console.log(
              `Using model from codeFile.metadata.documentMetadata: ${metadata.documentMetadata.model}`,
            );
            modelUsed = metadata.documentMetadata.model;
          }
        }

        // Last attempt: try to get the parent document by document_id
        if (codeFile.document_id) {
          try {
            console.log(
              `Trying to get model info from parent document: ${codeFile.document_id}`,
            );
            const { data: parentDocument } = await supabase
              .from("documents")
              .select("metadata")
              .eq("id", codeFile.document_id)
              .single();

            if (parentDocument && parentDocument.metadata) {
              const parentMetadata = parentDocument.metadata as any;
              if (parentMetadata.model) {
                console.log(
                  `Found model from parent document: ${parentMetadata.model}`,
                );
                modelUsed = parentMetadata.model;
              }
            }
          } catch (err) {
            console.error(
              `Error finding model from parent document ${codeFile.document_id}:`,
              err,
            );
          }
        }
      }

      // Generate a description
      let description = "";
      if (typeof metadata === "object" && metadata) {
        if (metadata.description) {
          description = metadata.description;
        } else if (metadata.purpose) {
          description = metadata.purpose;
        } else if (metadata.stepTitle) {
          description = `From ${metadata.stepTitle}`;
        }
      }

      // If no description is available, try to extract from code
      if (!description) {
        const extractedDescription = getDescriptionFromCode(
          codeFile.code_content,
        );
        if (extractedDescription) {
          description = extractedDescription;
        } else {
          // Create a basic description based on file info
          const fileType =
            codeFile.language === "typescript" || codeFile.language === "tsx"
              ? "TypeScript"
              : codeFile.language === "javascript" ||
                  codeFile.language === "jsx"
                ? "JavaScript"
                : codeFile.language;

          const componentMatch = codeFile.code_content.match(
            /(?:function|class|const)\s+(\w+)/,
          );
          const componentName = componentMatch ? componentMatch[1] : "";

          if (componentName) {
            description = `${fileType} ${componentName} component`;
          } else {
            description = `${fileType} code snippet`;
          }
        }
      }

      // If we still don't have a model name, use a default with more context
      if (modelUsed === "Unknown model") {
        modelUsed = `Model Unknown (Batch: ${codeFile.batch_id?.substring(0, 8) || "none"}, Run: ${codeFile.run_id || "none"})`;
      }

      return {
        id: codeFile.id,
        documentId: codeFile.document_id,
        documentTitle,
        documentBatchId: codeFile.batch_id,
        filename: codeFile.filename,
        language: codeFile.language,
        code: codeFile.code_content,
        description,
        similarity: codeFile.similarity,
        modelUsed,
        createdAt: codeFile.created_at || new Date().toISOString(),
        source: "codefiles",
        stepTitle:
          typeof metadata === "object" && metadata && metadata.stepTitle,
        runId: codeFile.run_id,
        stepNumber: codeFile.step_number,
      };
    });

    // Wait for all promises to resolve
    const codeFileSnippets = await Promise.all(codeFileSnippetsPromises);

    // STEP 2: Also search in documents (legacy approach for backward compatibility)
    // If we already have enough results from direct code files, skip this step
    let documentSnippets: any[] = [];

    // Create a set of already-found document IDs to avoid duplicates
    const foundDocumentIds = new Set(
      codeFileSnippets.map((snippet) => snippet.documentId).filter(Boolean),
    );

    // If we're in an empty database scenario with no code files, return early
    if (codefilesCount === 0) {
      return NextResponse.json({
        success: true,
        snippets: [],
        total: 0,
        message:
          "No code files found in the database. Try uploading some code first.",
      });
    }

    if (codeFileSnippets.length < maxResults) {
      // Calculate how many more snippets we need
      const additionalNeeded = maxResults - codeFileSnippets.length;

      console.log(
        `Need ${additionalNeeded} more snippets, searching documents...`,
      );

      // Search for similar documents
      const similarDocuments = await searchSimilarDocuments(
        query,
        similarityThreshold,
        additionalNeeded,
      );

      if (similarDocuments.length > 0) {
        console.log(
          `Found ${similarDocuments.length} similar documents to extract code from`,
        );

        // Extract code snippets from each document
        for (const doc of similarDocuments) {
          // Skip documents we already have code files for
          if (foundDocumentIds.has(doc.id)) {
            console.log(
              `Skipping document ${doc.id} as we already have its code files`,
            );
            continue;
          }

          // First check if this document has code files in the codefiles table
          // Try to get code files from document_codefile_relationships
          try {
            // Get document info directly
            const { data: documentData, error: documentError } = await supabase
              .from("documents")
              .select("batch_id")
              .eq("id", doc.id)
              .single();

            // Get code files count
            const { count, error: countError } = await supabase
              .from("codefiles")
              .select("id", { count: "exact", head: true })
              .eq("document_id", doc.id);

            // Create our own relation data
            const relationData = documentData
              ? {
                  document_id: doc.id,
                  batch_id: documentData.batch_id,
                  has_codefiles: count && count > 0,
                  codefiles_count: count || 0,
                }
              : null;

            if (documentError || countError) {
              console.error(
                "Error querying document or codefiles count:",
                documentError || countError,
              );
            }

            if (
              relationData &&
              relationData.has_codefiles &&
              relationData.codefiles_count > 0
            ) {
              console.log(
                `Document ${doc.id} has ${relationData.codefiles_count} code files in codefiles table, fetching them...`,
              );

              // Get code files from codefiles table
              const { data: codefilesData, error: codefilesError } =
                await supabase
                  .from("codefiles")
                  .select("*")
                  .eq("document_id", doc.id);

              if (codefilesError) {
                console.error(
                  `Error fetching code files for document ${doc.id}:`,
                  codefilesError,
                );
              }

              if (codefilesData && codefilesData.length > 0) {
                // Format code files
                const docCodeSnippets = codefilesData.map((file) => ({
                  id: file.id,
                  documentId: doc.id,
                  documentTitle:
                    (doc.metadata as any).stepTitle ||
                    (doc.metadata as any).title ||
                    "Unknown",
                  documentBatchId:
                    file.batch_id || (doc.metadata as any).batchId,
                  filename: file.filename,
                  language: file.language,
                  code: file.code_content,
                  description:
                    getDescriptionFromCode(file.code_content) ||
                    `Code from ${file.filename}`,
                  similarity: doc.similarity * 0.9, // Slight penalty as this is from document search
                  modelUsed: (doc.metadata as any).model || "Unknown",
                  createdAt: file.created_at || new Date().toISOString(),
                  source: "codefiles_table_via_document",
                  stepTitle: (doc.metadata as any).stepTitle,
                  runId: file.run_id,
                  stepNumber: file.step_number,
                }));

                documentSnippets.push(...docCodeSnippets);

                // Add document ID to foundDocumentIds to avoid duplication
                foundDocumentIds.add(doc.id);
                continue;
              }
            }
          } catch (err) {
            console.error(
              `Error checking document_codefile_relationships for ${doc.id}:`,
              err,
            );
          }

          // Fallback to legacy approach: extract from document content/metadata
          console.log(
            `Falling back to extract code snippets from document ${doc.id} content/metadata`,
          );
          const snippets = extractCodeSnippets(doc.content, {
            ...doc.metadata,
            id: doc.id,
          });

          if (snippets.length > 0) {
            // Add document info to each snippet
            const enhancedSnippets = snippets.map((snippet) => ({
              ...snippet,
              documentId: doc.id,
              documentTitle:
                (doc.metadata as any).stepTitle ||
                (doc.metadata as any).title ||
                "Unknown",
              documentBatchId:
                (doc.metadata as any).batchId || (doc.metadata as any).batch_id,
              modelUsed: (doc.metadata as any).model || "Unknown",
              similarity: doc.similarity,
              createdAt:
                (doc.metadata as any).createdAt || new Date().toISOString(),
            }));

            documentSnippets.push(...enhancedSnippets);

            // Add document ID to foundDocumentIds to avoid duplication
            foundDocumentIds.add(doc.id);
          }
        }
      }

      // Filter document snippets if needed
      if (fileType || componentType) {
        documentSnippets = filterSnippets(
          documentSnippets,
          fileType,
          componentType,
        );
      }
    }

    // Combine both sources and remove duplicates (prefer codefiles over document extracts)
    let allSnippets = [...codeFileSnippets];

    // Add document snippets that don't already exist in code file snippets
    // (avoiding duplicates by comparing filename and code content)
    for (const docSnippet of documentSnippets) {
      const isDuplicate = allSnippets.some(
        (snippet) =>
          snippet.filename === docSnippet.filename &&
          snippet.code === docSnippet.code,
      );

      if (!isDuplicate) {
        allSnippets.push(docSnippet);
      }
    }

    // Sort by similarity
    allSnippets.sort((a, b) => b.similarity - a.similarity);

    // Limit to requested count
    allSnippets = allSnippets.slice(0, maxResults);

    return NextResponse.json({
      success: true,
      snippets: allSnippets,
      total: allSnippets.length,
    });
  } catch (error) {
    console.error("Error finding code snippets:", error);
    captureException(error, { context: "code-snippets-api" });

    return NextResponse.json(
      { success: false, error: "Server error finding code snippets" },
      { status: 500 },
    );
  }
}
