import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { generateMockResponse, shouldUseMockResponse } from "../fallback";
import { captureException } from "@/lib/error-reporting";
import { z } from "zod";
import {
  StructuredSolutionRequestSchema,
  StructuredSolutionSchema,
  StepSchema,
  FinalSolutionSchema,
} from "@/lib/zod-schemas";
import {
  extractCodeFilesFromDocument,
  storeCodeFileWithEmbedding,
  isPlaceholderOrEmptyCode,
} from "@/lib/codefile-service";
import { type CodeFile } from "@/lib/supabase-client";
import { updateDocumentCodeFiles } from "@/lib/document-service";
import crypto from "crypto";
import {
  generateOpenAIPrompt,
  generateAnthropicPrompt,
} from "@/app/lib/prompts";
import JSON5 from "json5";
import parseJsonWithErrors from "json-parse-even-better-errors";

// Zod schema for metrics
const MetricsSchema = z.object({
  executionTime: z.string(),
  complexity: z.string(),
  memoryUsage: z.string(),
  lineCount: z.number(),
  codeQuality: z.number().min(1).max(10).optional(),
});

// Zod schema for code files
const CodeFileSchema = z.object({
  filename: z.string(),
  language: z.string(),
  code: z.string(),
});

// Function to extract and store code files from a structured solution
async function extractAndStoreCodeFilesFromStructuredSolution(
  documentId: string,
  parsedSolution: any,
  metadata: Record<string, any>,
): Promise<void> {
  try {
    console.log(
      `Extracting code files from structured solution with document ID: ${documentId}`,
    );

    // Track all code files for document metadata update
    const allCodeFiles: CodeFile[] = [];

    // Process steps first
    if (parsedSolution.steps && Array.isArray(parsedSolution.steps)) {
      console.log(
        `Processing ${parsedSolution.steps.length} steps for code files`,
      );

      const batchId = metadata.batchId || null;

      for (let i = 0; i < parsedSolution.steps.length; i++) {
        const step = parsedSolution.steps[i];
        const stepNumber = i + 1;

        if (
          step.codeFiles &&
          Array.isArray(step.codeFiles) &&
          step.codeFiles.length > 0
        ) {
          console.log(
            `Found ${step.codeFiles.length} code files in step ${stepNumber}`,
          );

          // Add to overall code files collection
          allCodeFiles.push(...step.codeFiles);

          for (const codeFile of step.codeFiles) {
            try {
              const id = await storeCodeFileWithEmbedding(
                codeFile,
                documentId,
                batchId,
                metadata.runId || null,
                stepNumber,
                {
                  ...metadata,
                  stepTitle: step.title,
                  stepDescription: step.description,
                  stepNumber,
                },
              );

              if (id) {
                console.log(
                  `Stored step ${stepNumber} code file ${codeFile.filename} with ID ${id}`,
                );
              } else {
                console.error(
                  `Failed to store step ${stepNumber} code file ${codeFile.filename}`,
                );
              }
            } catch (error) {
              console.error(
                `Error storing step ${stepNumber} code file ${codeFile.filename}:`,
                error,
              );
              captureException(error, {
                context: "structured_solution_codefile_storage",
                filename: codeFile.filename,
                stepNumber,
              });
            }
          }
        } else {
          console.log(`No code files found in step ${stepNumber}`);
        }
      }
    }

    // Process final solution code files
    if (
      parsedSolution.finalSolution &&
      parsedSolution.finalSolution.codeFiles &&
      Array.isArray(parsedSolution.finalSolution.codeFiles) &&
      parsedSolution.finalSolution.codeFiles.length > 0
    ) {
      console.log(
        `Found ${parsedSolution.finalSolution.codeFiles.length} code files in final solution`,
      );

      // Add to overall code files collection
      allCodeFiles.push(...parsedSolution.finalSolution.codeFiles);

      for (const codeFile of parsedSolution.finalSolution.codeFiles) {
        try {
          const id = await storeCodeFileWithEmbedding(
            codeFile,
            documentId,
            metadata.batchId || null,
            metadata.runId || null,
            9999, // Use a high number to indicate final solution
            {
              ...metadata,
              isFinalSolution: true,
              finalSolutionTitle: parsedSolution.finalSolution.title,
              finalSolutionDescription:
                parsedSolution.finalSolution.description,
            },
          );

          if (id) {
            console.log(
              `Stored final solution code file ${codeFile.filename} with ID ${id}`,
            );
          } else {
            console.error(
              `Failed to store final solution code file ${codeFile.filename}`,
            );
          }
        } catch (error) {
          console.error(
            `Error storing final solution code file ${codeFile.filename}:`,
            error,
          );
          captureException(error, {
            context: "structured_solution_final_codefile_storage",
            filename: codeFile.filename,
          });
        }
      }
    } else {
      console.log("No code files found in final solution");
    }

    // Update document metadata with all code files for redundancy
    if (allCodeFiles.length > 0) {
      try {
        console.log(
          `Updating document ${documentId} metadata with ${allCodeFiles.length} code files`,
        );
        // Ensure all code files have a non-undefined language property
        const sanitizedCodeFiles = allCodeFiles.map((file) => ({
          ...file,
          language: file.language || "text", // Default to 'text' if language is undefined
        }));
        await updateDocumentCodeFiles(documentId, sanitizedCodeFiles);
      } catch (error) {
        console.error(
          "Error updating document metadata with all code files:",
          error,
        );
        captureException(error, {
          context: "structured_solution_metadata_update",
        });
      }
    }
  } catch (error) {
    console.error(
      "Error extracting and storing code files from structured solution:",
      error,
    );
    captureException(error, {
      context: "structured_solution_codefile_extraction",
    });
  }
}

// Zod schema for structured solution
const StructuredSolutionResponseSchema = z.object({
  steps: z.array(StepSchema).length(6),
  finalSolution: FinalSolutionSchema,
  rawContent: z.string(),
  reasoningProcess: z.string().optional(),
  structuredSolution: z.record(z.unknown()).optional(),
  batchId: z.string().optional(),
});

// Define the types for our structured solution response
type SolutionStep = {
  title: string;
  description: string;
  metrics: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality: number;
  };
  codeFiles?: {
    filename: string;
    language: string;
    code: string;
  }[];
};

type StructuredSolution = {
  steps: SolutionStep[];
  finalSolution: {
    title: string;
    description: string;
    metrics: {
      executionTime: string;
      complexity: string;
      memoryUsage: string;
      lineCount: number;
    };
  };
  rawContent: string;
  reasoningProcess?: string; // Optional field for models with reasoning capabilities
  structuredSolution?: Record<string, unknown>; // Store the original parsed structured solution for explanation API
  batchId?: string; // Optional batch ID for correlating steps
};

// Function to get Anthropic client with error checking
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log(`API Key exists: ${!!apiKey}, Length: ${apiKey?.length || 0}`);

  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    console.error(
      "Missing or invalid ANTHROPIC_API_KEY in environment variables",
    );
    throw new Error(
      "Missing or invalid ANTHROPIC_API_KEY in environment variables",
    );
  }

  return new Anthropic({ apiKey });
}

// Map model providers
const modelProviders: Record<string, string> = {
  // OpenAI models
  "gpt-4o": "openai",
  "gpt-4o-mini": "openai",
  "gpt-3.5-turbo": "openai",
  "gpt-3.5": "openai",
  o3: "openai",
  "o3-mini": "openai",
  o1: "openai",

  // Anthropic models
  "claude-3-5-sonnet": "anthropic",
  "claude-3-5-sonnet-20240620": "anthropic",
  "claude-3-sonnet-20240229": "anthropic",
  "claude-3-opus-20240229": "anthropic",
  "claude-3-haiku-20240307": "anthropic",
  "claude-3-sonnet": "anthropic",
  "claude-3-opus": "anthropic",
  "claude-3-haiku": "anthropic",
  "Claude-Sonnet-5": "anthropic",
  "Claude-Sonnet-7": "anthropic",
};

// Extract code blocks from JSON to preserve LLM-generated code
function extractCodeBlocks(
  jsonStr: string,
): Array<{ filename?: string; language?: string; code: string }> {
  const codeBlocks: Array<{
    filename?: string;
    language?: string;
    code: string;
  }> = [];

  try {
    // Look for code blocks in the format: "code": "..."
    const codeRegex = /"code"\s*:\s*"((?:\\"|[^"])*?)"/g;
    let codeMatch;

    while ((codeMatch = codeRegex.exec(jsonStr)) !== null) {
      if (codeMatch[1] && codeMatch[1].trim().length > 0) {
        // Unescape any escaped quotes in the code
        const code = codeMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");

        // Try to find the filename and language near this code block
        const contextBeforeCode = jsonStr.substring(
          Math.max(0, codeMatch.index - 200),
          codeMatch.index,
        );

        const filenameMatch = contextBeforeCode.match(
          /"filename"\s*:\s*"([^"]+)"/,
        );
        const languageMatch = contextBeforeCode.match(
          /"language"\s*:\s*"([^"]+)"/,
        );

        if (!isPlaceholderOrEmptyCode(code)) {
          codeBlocks.push({
            filename: filenameMatch ? filenameMatch[1] : undefined,
            language: languageMatch ? languageMatch[1] : "text", // Default to "text" to avoid undefined language
            code,
          });
          console.log(
            `Extracted code block${filenameMatch ? ` for ${filenameMatch[1]}` : ""}, length: ${code.length} chars`,
          );
        } else {
          console.log(
            `Skipped placeholder or empty code block${filenameMatch ? ` for ${filenameMatch[1]}` : ""}`,
          );
        }
      }
    }

    console.log(`Total real code blocks extracted: ${codeBlocks.length}`);
    return codeBlocks;
  } catch (extractError) {
    console.log(
      `Error extracting code blocks: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
    );
    return [];
  }
}

// Add an interface to extend Function with the extractCodeBlocks property
interface RepairJsonFunction {
  (json: string): string;
  extractCodeBlocks?: typeof extractCodeBlocks;
}

// Enhanced JSON parsing and repair function using JSON5 and json-parse-even-better-errors
const repairJson: RepairJsonFunction = function (json: string): string {
  console.log("Attempting to repair malformed JSON with enhanced tools");

  // Make the extractCodeBlocks function available to external callers
  repairJson.extractCodeBlocks = extractCodeBlocks;

  // First, try to parse with JSON5 which is more forgiving than standard JSON
  try {
    const parsedJson = JSON5.parse(json);
    console.log("Successfully parsed JSON using JSON5");

    // If we successfully parsed with JSON5, return stringified standard JSON
    return JSON.stringify(parsedJson);
  } catch (json5Error) {
    console.log(
      `JSON5 parsing failed: ${json5Error instanceof Error ? json5Error.message : "Unknown error"}`,
    );

    // Try with parse-even-better-errors for more detailed error information
    try {
      parseJsonWithErrors(json);
      // If it parses successfully, return the original (this is unlikely to happen if JSON5 failed)
      return json;
    } catch (parseError) {
      if (parseError instanceof Error) {
        console.log(
          `Enhanced JSON parsing failed with error: ${parseError.message}`,
        );

        // Get detailed error information to guide our repairs
        const errorMessage = parseError.message;
        const positionMatch = errorMessage.match(/position (\d+)/);
        const errorPos = positionMatch ? parseInt(positionMatch[1]) : -1;

        if (errorPos >= 0) {
          console.log(
            `Error at position ${errorPos}, surrounding: "${json.substring(Math.max(0, errorPos - 20), Math.min(json.length, errorPos + 20))}"`,
          );

          // Extract code blocks to preserve them even if JSON structure is invalid
          // This is a key part of the user's requirement to preserve LLM-generated code
          const extractedCodeBlocks = extractCodeBlocks(json);

          // First, try to fix the JSON structure
          let fixedJson = fixJsonStructuralIssues(json, errorPos);

          // Try parsing after structural fixes
          try {
            JSON.parse(fixedJson);
            console.log("Successfully fixed JSON structure");
            return fixedJson;
          } catch (structuralFixError) {
            console.log(
              "Structural fixes didn't resolve the issue, trying more aggressive repairs",
            );

            // Try more aggressive repair techniques
            fixedJson = tryAggressiveJsonRepair(json);

            try {
              JSON.parse(fixedJson);
              console.log("Aggressive JSON repair successful");
              return fixedJson;
            } catch (aggressiveFixError) {
              console.log(
                "Aggressive repair failed, attempting to rebuild JSON with preserved code blocks",
              );

              // If all repairs fail, rebuild a minimal valid structure but with the extracted code blocks
              const rebuiltJson =
                rebuildJsonWithPreservedCode(extractedCodeBlocks);

              try {
                JSON.parse(rebuiltJson);
                console.log(
                  "Successfully rebuilt JSON with preserved code blocks",
                );
                return rebuiltJson;
              } catch (rebuildError) {
                console.log(
                  "All JSON repair attempts failed, using fallback minimal structure",
                );
                return createMinimalValidJson(json);
              }
            }
          }
        } else {
          // If we can't identify the position, try general repairs
          return tryGeneralJsonRepairs(json);
        }
      }
    }
  }

  // Extract code blocks from JSON to preserve LLM-generated code
  function extractCodeBlocks(
    jsonStr: string,
  ): Array<{ filename?: string; language?: string; code: string }> {
    const codeBlocks: Array<{
      filename?: string;
      language?: string;
      code: string;
    }> = [];

    try {
      if (!jsonStr || typeof jsonStr !== "string") {
        console.log("Invalid input for code extraction, returning empty array");
        return [];
      }

      // Look for code blocks in the format: "code": "..."
      const codeRegex = /"code"\s*:\s*"((?:\\"|[^"])*?)"/g;
      let codeMatch;

      while ((codeMatch = codeRegex.exec(jsonStr)) !== null) {
        if (codeMatch[1] && codeMatch[1].trim().length > 0) {
          // Unescape any escaped quotes in the code
          const code = codeMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, "\n")
            .replace(/\\\\/g, "\\");

          // Try to find the filename and language near this code block
          const contextBeforeCode = jsonStr.substring(
            Math.max(0, codeMatch.index - 200),
            codeMatch.index,
          );

          const filenameMatch = contextBeforeCode.match(
            /"filename"\s*:\s*"([^"]+)"/,
          );
          const languageMatch = contextBeforeCode.match(
            /"language"\s*:\s*"([^"]+)"/,
          );

          if (!isPlaceholderOrEmptyCode(code)) {
            codeBlocks.push({
              filename: filenameMatch ? filenameMatch[1] : undefined,
              language: languageMatch ? languageMatch[1] : "text", // Default to "text" to avoid undefined language
              code,
            });
            console.log(
              `Extracted code block${filenameMatch ? ` for ${filenameMatch[1]}` : ""}, length: ${code.length} chars`,
            );
          } else {
            console.log(
              `Skipped placeholder or empty code block${filenameMatch ? ` for ${filenameMatch[1]}` : ""}`,
            );
          }
        }
      }

      console.log(`Total real code blocks extracted: ${codeBlocks.length}`);
      return codeBlocks;
    } catch (extractError) {
      console.log(
        `Error extracting code blocks: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
      );
      return [];
    }
  }

  // Fix common structural issues in JSON
  function fixJsonStructuralIssues(
    jsonStr: string,
    errorPosition: number,
  ): string {
    try {
      let fixedJson = jsonStr;

      // Get context around the error
      const beforeError = jsonStr.substring(
        Math.max(0, errorPosition - 50),
        errorPosition,
      );
      const afterError = jsonStr.substring(
        errorPosition,
        Math.min(jsonStr.length, errorPosition + 50),
      );

      // Fix unclosed objects
      if (!fixedJson.trim().endsWith("}") && fixedJson.includes("{")) {
        console.log("Adding missing closing braces");
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;

        if (missingBraces > 0) {
          fixedJson += "}".repeat(missingBraces);
        }
      }

      // Fix unclosed arrays
      if (fixedJson.includes("[") && !fixedJson.includes("]")) {
        console.log("Adding missing closing brackets");
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;
        const missingBrackets = openBrackets - closeBrackets;

        if (missingBrackets > 0) {
          fixedJson += "]".repeat(missingBrackets);
        }
      }

      // Fix missing quotes around property values
      if (
        beforeError.match(/:\s*[^",{\[\s]*$/) &&
        afterError.match(/^[^",}\]\s]*/)
      ) {
        console.log("Fixing missing quotes around property value");
        const beforeMatch = beforeError.match(/[^",{\[\s]*$/);
        const afterMatch = afterError.match(/^[^",}\]\s]*/);

        if (beforeMatch && afterMatch) {
          fixedJson =
            fixedJson.substring(0, errorPosition - beforeMatch[0].length) +
            '"' +
            beforeMatch[0] +
            afterMatch[0] +
            '"' +
            fixedJson.substring(errorPosition + afterMatch[0].length);
        }
      }

      // Fix missing commas between properties
      if (beforeError.match(/"\s*}$/) && afterError.match(/^\s*"/)) {
        console.log("Adding missing comma between properties");
        fixedJson =
          fixedJson.substring(0, errorPosition) +
          "," +
          fixedJson.substring(errorPosition);
      }

      // Fix trailing commas
      fixedJson = fixedJson.replace(/,(\s*[\]}])/g, "$1");

      return fixedJson;
    } catch (fixError) {
      console.log(
        `Error during structural fixes: ${fixError instanceof Error ? fixError.message : "Unknown error"}`,
      );
      return jsonStr;
    }
  }

  // Try more aggressive repair techniques
  function tryAggressiveJsonRepair(jsonStr: string): string {
    try {
      let fixedJson = jsonStr;

      // Handle unterminated strings
      const unbalancedQuotes = (fixedJson.match(/"/g) || []).length % 2 !== 0;
      if (unbalancedQuotes) {
        console.log("Fixing unterminated string");
        fixedJson += '"';
      }

      // Handle incomplete steps array
      if (
        fixedJson.includes('"steps"') &&
        !fixedJson.includes('"finalSolution"')
      ) {
        console.log("Fixing incomplete steps array");

        // Find the steps array end or add it if missing
        if (!fixedJson.includes('"steps": [')) {
          const stepsIndex = fixedJson.indexOf('"steps"');
          if (stepsIndex >= 0) {
            fixedJson =
              fixedJson.substring(0, stepsIndex + 8) +
              ": [" +
              fixedJson.substring(stepsIndex + 8);
          }
        }

        // Close the steps array if it's open
        if (fixedJson.includes('"steps": [') && !fixedJson.includes("]")) {
          fixedJson += "]";
        }

        // Add finalSolution section
        if (!fixedJson.includes('"finalSolution"')) {
          if (!fixedJson.endsWith(",")) {
            fixedJson += ",";
          }

          fixedJson += `"finalSolution": {
            "title": "Generated Final Solution",
            "description": "This solution preserves the LLM-generated code but was reconstructed due to JSON parsing issues.",
            "metrics": {
              "executionTime": "0ms",
              "complexity": "O(1)",
              "memoryUsage": "0MB",
              "lineCount": 0
            },
            "codeFiles": []
          }`;
        }

        // Ensure the JSON object is closed
        if (!fixedJson.endsWith("}")) {
          fixedJson += "}";
        }
      }

      return fixedJson;
    } catch (aggressiveFixError) {
      console.log(
        `Error during aggressive fixes: ${aggressiveFixError instanceof Error ? aggressiveFixError.message : "Unknown error"}`,
      );
      return jsonStr;
    }
  }

  // Try general JSON repairs when we can't identify the specific issue
  function tryGeneralJsonRepairs(jsonStr: string): string {
    try {
      // First try JSON5 to get a cleaner version
      try {
        const parsed = JSON5.parse(jsonStr);
        return JSON.stringify(parsed);
      } catch (json5Error) {
        // If JSON5 fails, continue with manual repairs
      }

      // Try to balance braces and brackets
      let fixedJson = jsonStr;

      // Remove any trailing commas
      fixedJson = fixedJson.replace(/,(\s*[\]}])/g, "$1");

      // Balance braces
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        fixedJson += "}".repeat(openBraces - closeBraces);
      }

      // Balance brackets
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        fixedJson += "]".repeat(openBrackets - closeBrackets);
      }

      try {
        JSON.parse(fixedJson);
        console.log("General repairs fixed JSON");
        return fixedJson;
      } catch (parseError) {
        // If still invalid, try extracting code and rebuilding
        const extractedCode = extractCodeBlocks(jsonStr);
        return rebuildJsonWithPreservedCode(extractedCode);
      }
    } catch (generalFixError) {
      console.log(
        `Error during general fixes: ${generalFixError instanceof Error ? generalFixError.message : "Unknown error"}`,
      );
      return createMinimalValidJson(jsonStr);
    }
  }

  // Rebuild JSON with the preserved code blocks
  function rebuildJsonWithPreservedCode(
    codeBlocks: Array<{ filename?: string; language?: string; code: string }>,
  ): string {
    try {
      console.log("Rebuilding JSON structure with preserved code blocks");

      // Extract any titles and descriptions from the original JSON
      const titleMatches = json.match(/"title"\s*:\s*"([^"]+)"/g) || [];
      const descMatches = json.match(/"description"\s*:\s*"([^"]+)"/g) || [];

      const titles = titleMatches.map((m) =>
        m.replace(/"title"\s*:\s*"/, "").replace(/"$/, ""),
      );
      const descriptions = descMatches.map((m) =>
        m.replace(/"description"\s*:\s*"/, "").replace(/"$/, ""),
      );

      // Create a basic structure that conforms to our expected format
      // NOTE: Ensure rawContent is a string, not an object, to pass Zod validation
      const structure: any = {
        steps: [],
        finalSolution: {
          title: titles[titles.length - 1] || "Final Solution",
          description:
            descriptions[descriptions.length - 1] ||
            "Reconstructed solution preserving LLM-generated code.",
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: codeBlocks.reduce(
              (total, block) => total + (block.code.split("\n").length || 0),
              0,
            ),
          },
          codeFiles: [],
        },
        // Include rawContent as a string to pass Zod validation - store the original JSON if possible
        rawContent:
          json.length > 50
            ? json
            : "This content was reconstructed from extracted code blocks due to JSON parsing issues.",
        reasoningProcess:
          "The original response had JSON parsing issues, but the code was salvaged.",
      };

      // Distribute code blocks across steps and final solution
      if (codeBlocks.length > 0) {
        // Calculate how many blocks to put in each step (at least one per step)
        const numSteps = Math.min(
          6,
          Math.max(1, Math.ceil(codeBlocks.length / 2)),
        );
        const blocksPerStep = Math.max(
          1,
          Math.floor(codeBlocks.length / numSteps),
        );

        console.log(
          `Distributing ${codeBlocks.length} code blocks across ${numSteps} steps`,
        );

        // Create steps with the code blocks
        for (let i = 0; i < numSteps; i++) {
          const stepCodeBlocks = codeBlocks.slice(
            i * blocksPerStep,
            i === numSteps - 1 ? codeBlocks.length : (i + 1) * blocksPerStep,
          );

          const stepCodeFiles = stepCodeBlocks.map((block, index) => ({
            filename:
              block.filename || `file${index + 1}.${block.language || "js"}`,
            language: block.language || "javascript", // Always use a string value
            code: block.code,
          }));

          const step = {
            title: titles[i] || `Step ${i + 1}`,
            description:
              descriptions[i] || `Step ${i + 1} with preserved code.`,
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: stepCodeBlocks.reduce(
                (total, block) => total + (block.code.split("\n").length || 0),
                0,
              ),
              codeQuality: 7,
            },
            codeFiles: stepCodeFiles,
          };

          structure.steps.push(step);
        }

        // Fill in remaining steps if needed
        while (structure.steps.length < 6) {
          structure.steps.push({
            title: `Step ${structure.steps.length + 1}`,
            description: `Generated step ${structure.steps.length + 1}.`,
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
            codeFiles: [],
          });
        }

        // Add the most complex code blocks to the final solution as well
        if (codeBlocks.length > 0) {
          const sortedByComplexity = [...codeBlocks].sort(
            (a, b) =>
              b.code.length +
              b.code.split("\n").length * 10 -
              (a.code.length + a.code.split("\n").length * 10),
          );

          const topBlocks = sortedByComplexity.slice(
            0,
            Math.min(3, sortedByComplexity.length),
          );

          structure.finalSolution.codeFiles = topBlocks.map((block, index) => ({
            filename:
              block.filename ||
              `solution_file${index + 1}.${block.language || "js"}`,
            language: block.language || "javascript",
            code: block.code,
          }));
        }
      } else {
        // If no code blocks were extracted, create empty steps
        for (let i = 0; i < 6; i++) {
          structure.steps.push({
            title: titles[i] || `Step ${i + 1}`,
            description: descriptions[i] || `Generated step ${i + 1}.`,
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
            codeFiles: [],
          });
        }
      }

      return JSON.stringify(structure);
    } catch (rebuildError) {
      console.log(
        `Error rebuilding JSON: ${rebuildError instanceof Error ? rebuildError.message : "Unknown error"}`,
      );
      return createMinimalValidJson(json);
    }
  }

  // Create a minimal valid JSON structure as a last resort
  function createMinimalValidJson(jsonStr: string): string {
    console.log("Creating minimal valid JSON structure");

    // Try to extract any useful information from the original JSON
    const titleMatches = jsonStr.match(/"title"\s*:\s*"([^"]+)"/g) || [];
    const descMatches = jsonStr.match(/"description"\s*:\s*"([^"]+)"/g) || [];

    const titles = titleMatches.map((m) =>
      m.replace(/"title"\s*:\s*"/, "").replace(/"$/, ""),
    );
    const descriptions = descMatches.map((m) =>
      m.replace(/"description"\s*:\s*"/, "").replace(/"$/, ""),
    );

    // Create minimal structure
    const structure = {
      steps: Array.from({ length: 6 }, (_, i) => ({
        title: titles[i] || `Step ${i + 1}`,
        description: descriptions[i] || `Generated step ${i + 1}.`,
        metrics: {
          executionTime: "0ms",
          complexity: "O(1)",
          memoryUsage: "0MB",
          lineCount: 0,
          codeQuality: 5,
        },
        codeFiles: [],
      })),
      finalSolution: {
        title: "Final Solution",
        description:
          "This solution was generated due to parsing issues with the LLM response.",
        metrics: {
          executionTime: "0ms",
          complexity: "O(1)",
          memoryUsage: "0MB",
          lineCount: 0,
        },
        codeFiles: [],
      },
      // Include required fields to pass Zod validation, ensuring rawContent is a string
      // Store the original JSON content if it's substantial
      rawContent:
        jsonStr.length > 100
          ? jsonStr
          : "This is a minimal valid JSON structure created due to parsing issues.",
      reasoningProcess:
        "The original response had JSON parsing issues that could not be resolved.",
    };

    return JSON.stringify(structure);
  }

  // Fallback to a default emergency structure as a last resort
  return createMinimalValidJson(json);
};

// All prompt definitions have been moved to dedicated files in app/lib/prompts/

// Add this retry function above the POST handler
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000,
): Promise<T> {
  let retries = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      retries++;

      // If we've reached max retries or it's not an overloaded error, throw
      if (
        retries >= maxRetries ||
        !(error?.status === 529 && error?.error?.type === "overloaded_error")
      ) {
        throw error;
      }

      console.log(
        `Anthropic API overloaded (attempt ${retries}/${maxRetries}), retrying in ${delay}ms...`,
      );

      // Wait for the delay period
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff - double the delay for next retry
      delay *= 2;
    }
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();

    // Validate request data using Zod
    const validationResult =
      StructuredSolutionRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Invalid request data:", validationResult.error.format());
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    // Extract validated data
    const {
      prompt,
      model,
      temperature,
      techStack,
      runId,
      enableReasoning,
      batchId,
    } = validationResult.data;

    // Determine model provider based on model name
    const provider = model in modelProviders ? modelProviders[model] : "openai";
    console.log(`Using model provider: ${provider} for model: ${model}`);

    // Create the prompt using the proper generator based on the provider
    let structuredPrompt;
    if (provider === "anthropic") {
      structuredPrompt = generateAnthropicPrompt(
        prompt,
        techStack,
        enableReasoning,
      );
    } else {
      // Default to OpenAI prompt format for other providers
      structuredPrompt = generateOpenAIPrompt(
        prompt,
        techStack,
        enableReasoning,
      );
    }

    // Create batch ID if not provided
    const finalBatchId =
      batchId ||
      `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let responseContent: string | null = null;

    // Handle model specific API calls
    if (provider === "anthropic") {
      try {
        // Check if we should use mock response
        if (shouldUseMockResponse("anthropic")) {
          console.log(
            "Using mock response for Anthropic API (API key not set)",
          );
          const mockResult = generateMockResponse(prompt, model);
          return NextResponse.json(mockResult);
        }

        // Validate the model name and use fallback if necessary
        let modelToUse = model;

        // Handle new model names and ensure compatibility
        if (
          modelToUse === "Claude-Sonnet-7" ||
          modelToUse.toLowerCase().includes("claude-sonnet-7")
        ) {
          // Map user-friendly model name to API model name
          modelToUse = "claude-3-5-sonnet-20240620";
        } else if (
          modelToUse === "Claude-Sonnet-5" ||
          modelToUse.toLowerCase().includes("claude-sonnet-5")
        ) {
          // Map user-friendly model name to API model name
          modelToUse = "claude-3-sonnet-20240229";
        } else if (modelToUse === "o1") {
          modelToUse = "gpt-4o"; // Map to GPT-4o instead of GPT-4
        } else if (modelToUse === "o3") {
          modelToUse = "gpt-4o"; // Map to OpenAI equivalent
        } else if (modelToUse === "o3-mini") {
          modelToUse = "gpt-4o-mini"; // Map to OpenAI equivalent
        }

        console.log(`Using Anthropic model: ${modelToUse}`);

        // Initialize Anthropic client
        const anthropic = getAnthropicClient();

        console.log(
          "Anthropic client created successfully, making API call...",
        );

        try {
          console.log(
            `Making Anthropic API call with model: ${modelToUse}, temperature: ${temperature}`,
          );

          // Get a structured solution from Anthropic Claude
          const message = await retryWithExponentialBackoff(() =>
            anthropic.messages.create({
              model: modelToUse,
              max_tokens: 4000,
              temperature: temperature,
              system:
                "You are a helpful assistant that responds with valid JSON following the exact format requested. IMPORTANT: Your response must ONLY contain the raw JSON object without ANY markdown formatting or code blocks. Do not add ```json or ``` tags around your response. Output ONLY the JSON object and nothing else.",
              messages: [{ role: "user", content: structuredPrompt }],
            }),
          );

          console.log("Anthropic API call successful");

          // Extract the response content with improved error handling
          if (!message.content || message.content.length === 0) {
            console.warn("Anthropic returned empty content array");
            responseContent = "";
          } else {
            // Check if we have text content in the first element
            if (message.content[0].type === "text") {
              const originalContent = message.content[0].text || "";

              // Use our JSON repair function to handle malformed JSON in Anthropic responses
              try {
                if (originalContent.trim() === "") {
                  console.warn("Anthropic returned empty text in content");
                  responseContent = "";
                } else {
                  // Clean up the response content to remove any markdown code block indicators
                  const cleanedContent = originalContent
                    .replace(/^```json\s*/gm, "") // Remove opening ```json
                    .replace(/^```\s*$/gm, "") // Remove closing ```
                    .trim();

                  // Use our enhanced repairJson function to fix any issues
                  responseContent = repairJson(cleanedContent);
                  console.log(
                    `Successfully repaired Anthropic JSON response, length: ${responseContent?.length || 0}`,
                  );
                }
              } catch (repairError) {
                console.error(
                  "Error repairing Anthropic JSON response:",
                  repairError,
                );
                // Still preserve the original content even if repair fails
                responseContent = originalContent;
              }
            } else {
              console.warn(
                `Anthropic returned non-text content type: ${message.content[0].type}`,
              );
              responseContent = "";
            }
          }
          console.log(
            `Response content length: ${responseContent?.length || 0}`,
          );
        } catch (apiError) {
          console.error("Anthropic API call failed:", apiError);
          console.error(
            `API Error details: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
          );
          console.error(
            `API Error stack: ${apiError instanceof Error ? apiError.stack : "No stack available"}`,
          );

          // Track the API error in Sentry with context
          captureException(apiError, {
            provider: "anthropic",
            model: modelToUse,
            prompt_length: structuredPrompt.length,
            temperature,
          });

          if (
            apiError instanceof Error &&
            apiError.message.includes("invalid_api_key")
          ) {
            console.error(
              "API key appears to be invalid. Check your ANTHROPIC_API_KEY environment variable.",
            );
          }

          if (apiError instanceof Error && apiError.message.includes("model")) {
            console.error(`Model error. Requested model was: ${modelToUse}`);
          }

          // Create a fallback response for debugging
          const fallbackResponse = {
            steps: Array(6).fill({
              title: "API Error Step",
              description: `Error occurred: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 5,
              },
            }),
            finalSolution: {
              title: "API Error Solution",
              description: `Failed to get response from Anthropic API. Please check API keys and try again.`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
              },
            },
            // Ensure rawContent is a string, not a stringified object
            rawContent: `Error calling Anthropic API: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
          };

          return NextResponse.json(fallbackResponse);
        }
      } catch (clientError) {
        console.error("Error creating Anthropic client:", clientError);

        // Track client initialization error in Sentry
        captureException(clientError, {
          context: "anthropic_client_init",
          model: model,
        });

        throw clientError;
      }
    } else {
      try {
        console.log(`Initializing OpenAI client for model: ${model}`);

        // Check if OpenAI API key is present
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === "your_openai_api_key_here") {
          console.log("Using mock response for OpenAI API (API key not set)");
          const mockResult = generateMockResponse(prompt, model);
          return NextResponse.json(mockResult);
        }

        // Initialize OpenAI client with server-side API key
        const openai = new OpenAI({
          apiKey,
        });

        // Check if the model supports reasoning and if it should be enabled
        const supportsReasoning =
          model === "gpt-4o" ||
          model === "gpt-4o-mini" ||
          model === "o3" ||
          model === "o3-mini" ||
          model === "o1";
        const shouldUseReasoning =
          supportsReasoning && enableReasoning === true;

        console.log(
          `Making OpenAI API call with model: ${model}, temperature: ${temperature}, reasoning: ${shouldUseReasoning}`,
        );

        // Base request configuration
        const requestConfig: Record<string, unknown> = {
          model: model,
          // Different models use different parameters
          ...(model === "o1" || model === "o3-mini" || model === "o3"
            ? {
                max_completion_tokens: 4000, // o1, o3, and o3-mini require max_completion_tokens instead of max_tokens
                // Temperature may not be supported by all these models, but some may accept it
                ...(model !== "o1" && { temperature: temperature || 0.7 }), // Only include temperature if not o1
              }
            : model.startsWith("o")
              ? {
                  max_tokens: 4000, // Other 'o' models use max_tokens
                  temperature: temperature || 0.7, // Use provided temperature or default
                }
              : {
                  max_tokens: 4000, // older models use max_tokens
                  temperature: temperature, // older models use temperature
                }),
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that provides structured JSON solutions for programming problems. Your responses must be valid JSON matching the required format. IMPORTANT: Ensure your response is complete, properly terminated JSON without truncation.",
            },
            { role: "user", content: structuredPrompt },
            {
              role: "system",
              content:
                "CRITICAL REMINDER: Each step in your response MUST include code files with actual implementations. The codeFiles array for each step MUST NOT be empty and MUST include filename, language, and complete code implementation for each file. The code should be properly escaped JSON strings. Omitting code files or providing empty implementations will result in an incomplete solution.",
            },
          ],
        };

        // Add response_format for all models that support it
        // This ensures properly formatted JSON responses
        if (
          model.includes("gpt-4o") ||
          model.includes("gpt-3.5-turbo") ||
          model.startsWith("o")
        ) {
          requestConfig.response_format = { type: "json_object" };
        }

        // Add reasoning configuration if supported and enabled
        if (shouldUseReasoning) {
          requestConfig.tool_choice = {
            type: "function",
            function: { name: "structured_solution_with_reasoning" },
          };
          requestConfig.tools = [
            {
              type: "function",
              function: {
                name: "structured_solution_with_reasoning",
                description: "Generate a structured solution with reasoning",
                parameters: {
                  type: "object",
                  properties: {
                    reasoning_process: {
                      type: "string",
                      description:
                        "Step by step reasoning process used to create the solution",
                    },
                    steps: {
                      type: "array",
                      description: "Array of solution steps",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          metrics: {
                            type: "object",
                            properties: {
                              executionTime: { type: "string" },
                              complexity: { type: "string" },
                              memoryUsage: { type: "string" },
                              lineCount: { type: "number" },
                              codeQuality: { type: "number" },
                            },
                          },
                          codeFiles: {
                            type: "array",
                            description:
                              "Array of code files with implementations",
                            items: {
                              type: "object",
                              properties: {
                                filename: {
                                  type: "string",
                                  description:
                                    "Name of the file (e.g., 'Button.tsx')",
                                },
                                language: {
                                  type: "string",
                                  description:
                                    "Programming language (e.g., 'tsx', 'css', 'typescript')",
                                },
                                code: {
                                  type: "string",
                                  description:
                                    "The actual code content as a properly escaped string",
                                },
                              },
                              required: ["filename", "language", "code"],
                            },
                          },
                        },
                      },
                    },
                    finalSolution: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        metrics: {
                          type: "object",
                          properties: {
                            executionTime: { type: "string" },
                            complexity: { type: "string" },
                            memoryUsage: { type: "string" },
                            lineCount: { type: "number" },
                          },
                        },
                        codeFiles: {
                          type: "array",
                          description:
                            "Array of code files with implementations for the final solution",
                          items: {
                            type: "object",
                            properties: {
                              filename: {
                                type: "string",
                                description:
                                  "Name of the file (e.g., 'Button.tsx')",
                              },
                              language: {
                                type: "string",
                                description:
                                  "Programming language (e.g., 'tsx', 'css', 'typescript')",
                              },
                              code: {
                                type: "string",
                                description:
                                  "The actual code content as a properly escaped string",
                              },
                            },
                            required: ["filename", "language", "code"],
                          },
                        },
                      },
                    },
                  },
                  required: ["reasoning_process", "steps", "finalSolution"],
                },
              },
            },
          ];
        }

        // Generate the structured solution with OpenAI
        // Cast to any to avoid TypeScript errors with the dynamic structure
        const completion = await openai.chat.completions.create(
          requestConfig as any,
        );

        console.log("OpenAI API call successful");

        // Verify that we have completion choices
        if (!completion.choices || completion.choices.length === 0) {
          console.warn("OpenAI returned empty choices array");
          responseContent = "";
        } else {
          if (shouldUseReasoning && completion.choices[0].message.tool_calls) {
            // Extract the reasoning and structured solution from the tool call
            try {
              // Check if we have valid tool calls array
              if (
                !completion.choices[0].message.tool_calls ||
                completion.choices[0].message.tool_calls.length === 0
              ) {
                console.warn(
                  "OpenAI returned empty tool_calls array despite shouldUseReasoning being true",
                );
                responseContent = completion.choices[0].message.content || "";
              } else {
                const toolCall = completion.choices[0].message.tool_calls[0];
                if (
                  toolCall &&
                  toolCall.function.name ===
                    "structured_solution_with_reasoning"
                ) {
                  try {
                    // Use our enhanced repairJson function to handle potentially malformed JSON
                    const repairedArgs = repairJson(
                      toolCall.function.arguments,
                    );
                    let toolArgs;

                    try {
                      // Try to parse the repaired arguments
                      toolArgs = JSON.parse(repairedArgs);
                    } catch (jsonError) {
                      console.warn(
                        "Error parsing repaired tool call arguments:",
                        jsonError,
                      );
                      console.log(
                        "Attempting to extract usable parts from the tool call...",
                      );

                      // If JSON parsing still fails, try to extract structured parts
                      // Call the extractCodeBlocks function from the outer scope
                      const extractedCodeBlocks = repairJson.extractCodeBlocks
                        ? repairJson.extractCodeBlocks(
                            toolCall.function.arguments,
                          )
                        : [];
                      if (extractedCodeBlocks.length > 0) {
                        console.log(
                          `Successfully extracted ${extractedCodeBlocks.length} code blocks from tool call`,
                        );
                        // Use parseJSON to parse the formatted JSON
                        toolArgs = JSON.parse(
                          repairJson(toolCall.function.arguments),
                        );
                      } else {
                        throw new Error(
                          "Failed to extract any code from tool call arguments",
                        );
                      }
                    }

                    // Check if the parsed arguments have the expected structure
                    if (
                      !toolArgs ||
                      !toolArgs.steps ||
                      !toolArgs.finalSolution
                    ) {
                      console.warn(
                        "Tool call arguments missing required fields",
                      );
                      throw new Error("Invalid tool call arguments structure");
                    }

                    // Construct the solution object with the reasoning process
                    // Ensure rawContent field is included as a string to pass Zod validation
                    // This is critical for the Zod schema validation to pass
                    responseContent = JSON.stringify({
                      steps: toolArgs.steps,
                      finalSolution: toolArgs.finalSolution,
                      reasoningProcess: toolArgs.reasoning_process,
                      // Always ensure rawContent is included and is a valid string
                      rawContent: (() => {
                        // Check if rawContent exists and is a string
                        if (
                          toolArgs.rawContent &&
                          typeof toolArgs.rawContent === "string"
                        ) {
                          return toolArgs.rawContent;
                        }
                        // Otherwise use the original arguments as string
                        if (
                          toolCall &&
                          toolCall.function &&
                          toolCall.function.arguments
                        ) {
                          return typeof toolCall.function.arguments === "string"
                            ? toolCall.function.arguments
                            : JSON.stringify(toolCall.function.arguments);
                        }
                        // Fallback to a default value if nothing else is available
                        return "Original LLM response preserved and reconstructed";
                      })(),
                    });

                    // Extra check for empty response
                    if (
                      !responseContent ||
                      responseContent.trim() === "" ||
                      responseContent === "{}"
                    ) {
                      console.warn(
                        "Generated empty JSON from tool call arguments",
                      );
                      // Use the regular message content as fallback
                      responseContent =
                        completion.choices[0].message.content || "";
                    }
                  } catch (jsonParseError) {
                    console.error(
                      "Error parsing tool call arguments as JSON:",
                      jsonParseError,
                    );
                    responseContent =
                      completion.choices[0].message.content || "";
                  }
                } else {
                  console.warn(
                    `Tool call with unexpected function name: ${toolCall?.function?.name || "undefined"}`,
                  );
                  responseContent = completion.choices[0].message.content || "";
                }
              }
            } catch (parseError) {
              console.error("Error parsing reasoning tool call:", parseError);
              // Fall back to regular content
              responseContent = completion.choices[0].message.content || "";
            }
          } else {
            // Standard response without reasoning
            responseContent = completion.choices[0].message.content || "";

            // Extra check for empty response
            if (!responseContent || responseContent.trim() === "") {
              console.warn("OpenAI returned empty message content");
            }
          }
        }

        // Log the response content length
        console.log(
          `OpenAI response content length: ${responseContent?.length || 0}`,
        );

        console.log(`Response content length: ${responseContent?.length || 0}`);
      } catch (openaiError) {
        console.error("OpenAI API call failed:", openaiError);
        console.error(
          `API Error details: ${openaiError instanceof Error ? openaiError.message : "Unknown error"}`,
        );

        // Track OpenAI API errors in Sentry with context
        captureException(openaiError, {
          provider: "openai",
          model: model,
          temperature,
          reasoning_enabled: enableReasoning,
        });

        // Create a fallback response for debugging
        const fallbackResponse = {
          steps: Array(6).fill({
            title: "API Error Step",
            description: `Error occurred: ${openaiError instanceof Error ? openaiError.message : "Unknown error"}`,
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
          }),
          finalSolution: {
            title: "API Error Solution",
            description: `Failed to get response from OpenAI API. Please check API keys and try again.`,
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
            },
          },
          // Ensure rawContent is a string, not a stringified object
          rawContent: `Error calling OpenAI API: ${openaiError instanceof Error ? openaiError.message : "Unknown error"}`,
        };

        return NextResponse.json(fallbackResponse);
      }
    }

    if (!responseContent) {
      console.warn(
        `Empty response received from ${provider} using model ${model}`,
      );

      // Create a fallback response instead of throwing an error
      console.log(
        "Generating fallback structured solution due to empty AI response",
      );

      // Create a meaningful fallback response based on the prompt
      const promptFirstLine = prompt.split("\n")[0].substring(0, 50) + "...";
      const fallbackResponse = {
        steps: Array(6)
          .fill(0)
          .map((_, i) => ({
            title: `Step ${i + 1}: Fallback Implementation for ${promptFirstLine}`,
            description:
              "This step was automatically generated because the AI provider returned an empty response.",
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
            fileTree: `project-root/
├── package.json [GENERATED]
├── tsconfig.json [GENERATED]
├── next.config.js [GENERATED]
├── tailwind.config.js [GENERATED]
├── postcss.config.js [GENERATED]
├── .env.example [GENERATED]
├── README.md [GENERATED]
├── app/
│   ├── page.tsx [GENERATED]
│   ├── layout.tsx [GENERATED]
│   ├── globals.css [GENERATED]
│   ├── jobs/
│   │   ├── page.tsx [GENERATED]
│   │   └── [id]/
│   │       └── page.tsx [GENERATED]
│   └── api/
│       └── ${i === 1 ? "analyze-job/" : `endpoint${i}/`}
│           └── route.ts [GENERATED]
├── components/
│   ├── ui/
│   │   ├── Button.tsx [GENERATED]
│   │   ├── Card.tsx [GENERATED]
│   │   └── Input.tsx [GENERATED]
│   ├── ${i === 2 ? "JobAnalyzer.tsx [GENERATED]" : `Component${i + 1}.tsx [GENERATED]`}
│   └── ${i === 3 ? "SearchForm.tsx [GENERATED]" : `Feature${i}.tsx [GENERATED]`}
├── lib/
│   ├── utils.ts [GENERATED]
│   ├── types.ts [GENERATED]
│   ├── ${i === 1 ? "analyze-job.ts [GENERATED]" : `service${i}.ts [GENERATED]`}
│   └── ${i === 4 ? "data-service.ts [GENERATED]" : `helper${i}.ts [GENERATED]`}
├── styles/
│   ├── globals.css [GENERATED]
│   └── components.css [GENERATED]
├── public/
│   ├── images/
│   │   └── logo.png [GENERATED]
│   └── fonts/
│       └── inter.woff2 [GENERATED]
└── tests/
    ├── components/
    │   └── ${i === 2 ? "JobAnalyzer.test.tsx [GENERATED]" : `Component${i + 1}.test.tsx [GENERATED]`}
    └── lib/
        └── ${i === 1 ? "analyze-job.test.ts [GENERATED]" : `service${i}.test.ts [GENERATED]`}`,
            codeFiles: [
              {
                filename:
                  i === 2
                    ? "components/JobAnalyzer.tsx"
                    : `components/Component${i + 1}.tsx`,
                language: "typescript",
                code:
                  i === 2
                    ? `"use client"

import { useState, useEffect } from 'react';
import { analyzeJob, type JobData, type AnalysisResult } from '@/lib/analyze-job';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Job Analyzer Component
 *
 * Displays and analyzes job details, showing match score and recommendations
 */
export function JobAnalyzer({ jobId }: { jobId: string }) {
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndAnalyzeJob() {
      try {
        setLoading(true);

        // Fetch job data from API
        const response = await fetch(\`/api/jobs/\${jobId}\`);

        if (!response.ok) {
          throw new Error(\`Failed to fetch job data: \${response.status}\`);
        }

        const data = await response.json();
        setJobData(data);

        // Analyze the job data
        const jobAnalysis = await analyzeJob(data);
        setAnalysis(jobAnalysis);
        setError(null);
      } catch (error) {
        console.error("Error analyzing job:", error);
        setError(error instanceof Error ? error.message : "Failed to analyze job");
      } finally {
        setLoading(false);
      }
    }

    loadAndAnalyzeJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
        <Button
          className="mt-4 bg-red-100 text-red-800 hover:bg-red-200"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!jobData || !analysis) {
    return <div className="text-gray-500">No job data available</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{jobData.title}</h2>
            {jobData.company && (
              <p className="text-gray-600">{jobData.company}</p>
            )}
          </div>
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {jobData.salary ? \`$\${jobData.salary.toLocaleString()}\` : 'Salary not specified'}
          </div>
        </div>

        <div className="mt-4 text-gray-700">{jobData.description}</div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3">Requirements</h3>
          <ul className="space-y-2">
            {jobData.requirements.map((req, index) => (
              <li key={index} className="flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                {req}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3">Analysis</h3>

          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span>Match Score</span>
              <span className="font-medium">{analysis.matchScore}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: \`\${analysis.matchScore}%\` }}
              ></div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">Key Skills</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {analysis.keySkills.map((skill, i) => (
                  <span key={i} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Skill Gaps</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {analysis.skillGaps.length > 0 ? (
                  analysis.skillGaps.map((skill, i) => (
                    <span key={i} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-green-600 text-sm">No skill gaps identified!</span>
                )}
              </div>
            </div>

            {analysis.recommendedTraining && analysis.recommendedTraining.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700">Recommended Training</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {analysis.recommendedTraining.map((training, i) => (
                    <li key={i} className="text-blue-600 hover:underline cursor-pointer">
                      {training}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button className="bg-green-600 text-white hover:bg-green-700">
          Apply for this Job
        </Button>
      </div>
    </div>
  );
}`
                    : i === 3
                      ? `// Job listing page component
"use client"

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchForm } from '@/components/SearchForm';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: number;
  description: string;
  postedDate: string;
  requirements: string[];
}

interface JobListingProps {
  initialJobs?: Job[];
}

export default function JobsPage({ initialJobs = [] }: JobListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get search parameters from URL
  const query = searchParams.get('query') || '';
  const location = searchParams.get('location') || '';
  const page = Number(searchParams.get('page') || '1');

  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch jobs when search parameters change
  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);

        // Construct search URL with parameters
        const searchUrl = new URL('/api/jobs/search', window.location.origin);
        if (query) searchUrl.searchParams.append('query', query);
        if (location) searchUrl.searchParams.append('location', location);
        searchUrl.searchParams.append('page', page.toString());

        const response = await fetch(searchUrl);

        if (!response.ok) {
          throw new Error(\`Search failed: \${response.status}\`);
        }

        const data = await response.json();

        if (data.success) {
          setJobs(data.results);
          setTotalPages(data.pagination.totalPages);
        } else {
          throw new Error(data.error || 'Failed to fetch jobs');
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
        // Show error state
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [query, location, page]);

  // Handle search submission
  const handleSearch = (formData: { query: string; location: string }) => {
    const params = new URLSearchParams();
    if (formData.query) params.append('query', formData.query);
    if (formData.location) params.append('location', formData.location);
    params.append('page', '1'); // Reset to first page on new search

    router.push(\`/jobs?\${params.toString()}\`);
  };

  // Handle pagination
  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(\`/jobs?\${params.toString()}\`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Find Your Next Job</h1>

      <div className="mb-8">
        <SearchForm
          initialQuery={query}
          initialLocation={location}
          onSearch={handleSearch}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-6">
          {jobs.map(job => (
            <Card key={job.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-blue-700 hover:underline cursor-pointer"
                      onClick={() => router.push(\`/jobs/\${job.id}\`)}>
                    {job.title}
                  </h2>
                  <p className="text-gray-600">{job.company} • {job.location}</p>
                </div>
                <div className="text-green-700 font-medium">
                  {job.salary ? \`\$\${job.salary.toLocaleString()}\` : 'Salary N/A'}
                </div>
              </div>

              <p className="mt-3 text-gray-700 line-clamp-2">{job.description}</p>

              <div className="mt-4 flex justify-between items-center">
                <div className="flex flex-wrap gap-2">
                  {job.requirements.slice(0, 3).map((req, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 text-xs rounded">
                      {req}
                    </span>
                  ))}
                  {job.requirements.length > 3 && (
                    <span className="text-gray-500 text-xs">+{job.requirements.length - 3} more</span>
                  )}
                </div>

                <Button
                  className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => router.push(\`/jobs/\${job.id}\`)}
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="flex space-x-2">
                <Button
                  className="border"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = page <= 3
                    ? i + 1
                    : page >= totalPages - 2
                      ? totalPages - 4 + i
                      : page - 2 + i;

                  if (pageNum <= totalPages) {
                    return (
                      <Button
                        key={pageNum}
                        className={page === pageNum
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 border"
                        }
                        onClick={() => goToPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  }
                  return null;
                })}

                <Button
                  className="border"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-medium text-gray-700 mb-2">No jobs found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search criteria</p>
          <Button onClick={() => router.push('/jobs')}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}`
                      : `// Component for Step ${i + 1}
"use client"

import { useState } from 'react';

export default function Component${i + 1}() {
  const [data, setData] = useState(null);

  return (
    <div className="component-${i + 1}">
      <h2>Step ${i + 1} Component</h2>
      <p>This is a sample component for step ${i + 1}</p>
    </div>
  );
}`,
              },
              {
                filename: i === 1 ? "lib/analyze-job.ts" : `lib/service${i}.ts`,
                language: "typescript",
                code:
                  i === 1
                    ? `/**
 * Job Analysis Service
 * Provides utilities for analyzing job descriptions and matching skills
 */

import { z } from 'zod';

// Define our schema using Zod for runtime type validation
export const JobDataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Job title is required"),
  description: z.string().min(10, "Job description must be at least 10 characters"),
  requirements: z.array(z.string()),
  salary: z.number().positive().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  postedDate: z.string().optional(),
  applicationUrl: z.string().url().optional(),
});

// Export type inferred from the schema
export type JobData = z.infer<typeof JobDataSchema>;

// Analysis result type
export interface AnalysisResult {
  matchScore: number;
  keySkills: string[];
  salaryRange: string;
  skillGaps: string[];
  recommendedTraining?: string[];
  industryTrends?: string[];
}

/**
 * Analyze job data and provide insights
 *
 * @param jobData The job data to analyze
 * @returns Analysis result object
 */
export async function analyzeJob(jobData: JobData): Promise<AnalysisResult> {
  try {
    // Validate input data
    JobDataSchema.parse(jobData);

    // Process job data
    const keySkills = extractKeySkills(jobData.description, jobData.requirements);
    const matchScore = calculateMatchScore(keySkills, jobData.requirements);
    const salaryRange = analyzeSalary(jobData.salary);
    const skillGaps = identifySkillGaps(jobData.requirements);

    return {
      matchScore,
      keySkills,
      salaryRange,
      skillGaps,
      recommendedTraining: generateRecommendations(skillGaps),
    };
  } catch (error) {
    console.error("Error analyzing job data:", error);
    throw new Error("Failed to analyze job data");
  }
}

/**
 * Extract important skills from job description
 */
function extractKeySkills(description: string, requirements: string[]): string[] {
  // Process description to extract skills
  const descLower = description.toLowerCase();

  // Check for each requirement in the description
  return requirements.filter(req =>
    descLower.includes(req.toLowerCase())
  );
}

/**
 * Calculate match score based on skills
 */
function calculateMatchScore(matchedSkills: string[], allSkills: string[]): number {
  if (allSkills.length === 0) return 0;
  return Math.round((matchedSkills.length / allSkills.length) * 100);
}

/**
 * Analyze job salary information
 */
function analyzeSalary(salary?: number): string {
  if (!salary) return 'Information not available';

  if (salary < 50000) return 'Entry level ($30k-$50k)';
  if (salary < 90000) return 'Mid-level ($50k-$90k)';
  if (salary < 150000) return 'Senior level ($90k-$150k)';
  return 'Executive level ($150k+)';
}

/**
 * Identify potential skill gaps
 */
function identifySkillGaps(requirements: string[]): string[] {
  // This would connect to a database of user skills in a real app
  const userSkills = ["JavaScript", "React", "CSS"];

  return requirements.filter(skill =>
    !userSkills.some(userSkill =>
      userSkill.toLowerCase() === skill.toLowerCase()
    )
  );
}

/**
 * Generate training recommendations based on skill gaps
 */
function generateRecommendations(skillGaps: string[]): string[] {
  // Map skill gaps to recommended courses or resources
  const recommendationMap: Record<string, string> = {
    "TypeScript": "TypeScript Fundamentals Course",
    "Node.js": "Server-Side Development with Node.js",
    "Python": "Python for Data Science",
    "AWS": "AWS Certified Solutions Architect",
    "Docker": "Docker and Kubernetes Essentials"
  };

  return skillGaps
    .map(skill => recommendationMap[skill] || \`Training for \${skill}\`)
    .filter(Boolean);
}`
                    : i === 5
                      ? `/**
 * API Route for job search functionality
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Job search request validation schema
const SearchParamsSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  minSalary: z.coerce.number().optional(),
  maxResults: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

/**
 * API route for job search
 * GET /api/jobs/search
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate search parameters
    const { searchParams } = new URL(request.url);
    const validatedParams = SearchParamsSchema.parse(Object.fromEntries(searchParams));

    // Process the search parameters
    const { query, location, minSalary, maxResults, page } = validatedParams;

    // In a real app, this would query a database or external API
    const results = await searchJobs({
      query,
      location,
      minSalary,
      limit: maxResults,
      offset: (page - 1) * maxResults
    });

    // Return search results
    return NextResponse.json({
      success: true,
      results,
      pagination: {
        page,
        pageSize: maxResults,
        totalResults: 120, // This would be dynamic in a real app
        totalPages: Math.ceil(120 / maxResults)
      }
    });
  } catch (error) {
    console.error('Error processing job search:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid search parameters', details: error.errors },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { success: false, error: 'Failed to process job search' },
      { status: 500 }
    );
  }
}

/**
 * Mock job search function
 * In a real app, this would query a database
 */
async function searchJobs({
  query,
  location,
  minSalary,
  limit,
  offset
}: {
  query?: string;
  location?: string;
  minSalary?: number;
  limit: number;
  offset: number;
}) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Generate mock search results
  return Array.from({ length: limit }, (_, i) => ({
    id: \`job-\${offset + i + 1}\`,
    title: \`\${query || 'Software'} Engineer \${offset + i + 1}\`,
    company: \`Company \${(offset + i) % 10 + 1}\`,
    location: location || 'Remote',
    salary: minSalary ? minSalary + (i * 10000) : 80000 + (i * 10000),
    description: \`This is a job for a \${query || 'Software'} Engineer with great benefits.\`,
    postedDate: new Date(Date.now() - i * 86400000).toISOString(),
    requirements: ['JavaScript', 'React', 'TypeScript', 'Next.js']
  }));
}`
                      : `/**
 * Utility functions for ${i === 3 ? "data processing" : i === 4 ? "API integration" : `step ${i + 1}`}
 */
import { z } from 'zod';

/**
 * Type definition for processed data
 */
export interface ProcessedData {
  id: string;
  name: string;
  value: number;
  category: string;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Data validation schema
 */
export const DataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  value: z.number(),
  category: z.string(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).optional()
});

/**
 * Process and validate data
 */
export function processData(rawData: unknown): ProcessedData {
  // Validate the data structure
  const validData = DataSchema.parse(rawData);

  // Process the data
  return {
    ...validData,
    // Add additional processing as needed
    value: Math.round(validData.value * 100) / 100,
    tags: validData.tags.map(tag => tag.toLowerCase())
  };
}

/**
 * Calculate metrics from a list of values
 */
export function calculateMetrics(values: number[]): {
  sum: number;
  average: number;
  max: number
} {
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    sum,
    average: sum / values.length,
    max: Math.max(...values)
  };
}

export default {
  formatData,
  calculateMetrics
};`,
              },
              {
                filename: "app/page.tsx",
                language: "typescript",
                code: `// Main page component for the application
"use client"

import { useState } from 'react';
import JobAnalyzer from '../components/JobAnalyzer';

export default function HomePage() {
  const [jobId, setJobId] = useState('job-123');

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Job Analysis Tool</h1>
      <p className="mb-4">Use this tool to analyze job descriptions and requirements.</p>

      <div className="mb-6">
        <label htmlFor="jobId" className="block mb-2">Enter Job ID:</label>
        <input
          type="text"
          id="jobId"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        />
      </div>

      <div className="border p-4 rounded bg-gray-50">
        <JobAnalyzer jobId={jobId} />
      </div>
    </main>
  );
}`,
              },
            ],
          })),
        finalSolution: {
          title: "Fallback Solution",
          description:
            "This solution was generated as a fallback because the AI provider returned an empty response. Please try again or use a different model.",
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
          },
          fileTree: `project-root/
├── app/
│   ├── page.tsx [GENERATED]
│   └── layout.tsx [GENERATED]
├── components/
│   ├── JobAnalyzer.tsx [GENERATED]
│   └── FinalComponent.tsx [GENERATED]
├── lib/
│   ├── analyze-job.ts [GENERATED]
│   └── utils.ts [GENERATED]
├── public/
│   └── assets/
├── README.md [GENERATED]`,
          codeFiles: [
            {
              filename: "components/JobAnalyzer.tsx",
              language: "typescript",
              code: `// Component for analyzing job details
"use client"

import { useState, useEffect } from 'react';
import { analyzeJob } from '../lib/analyze-job';

interface JobData {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  salary?: number;
}

export default function JobAnalyzer({ jobId }: { jobId: string }) {
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAndAnalyzeJob() {
      try {
        // Simulate fetching job data
        const data: JobData = {
          id: jobId,
          title: "Software Engineer",
          description: "Building web applications",
          requirements: ["JavaScript", "React", "TypeScript"]
        };

        setJobData(data);

        // Analyze the job data
        const jobAnalysis = await analyzeJob(data);
        setAnalysis(jobAnalysis);
      } catch (error) {
        console.error("Error analyzing job:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAndAnalyzeJob();
  }, [jobId]);

  if (loading) return <div>Loading job analysis...</div>;

  return (
    <div className="job-analyzer">
      <h2>{jobData?.title}</h2>
      <div className="job-description">{jobData?.description}</div>
      <div className="requirements">
        <h3>Requirements:</h3>
        <ul>
          {jobData?.requirements.map((req, index) => (
            <li key={index}>{req}</li>
          ))}
        </ul>
      </div>
      <div className="analysis">
        <h3>Analysis:</h3>
        <p>{analysis}</p>
      </div>
    </div>
  );
}`,
            },
            {
              filename: "lib/analyze-job.ts",
              language: "typescript",
              code: `// Utility function for analyzing job data

/**
 * Interface for job data structure
 */
export interface JobData {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  salary?: number;
}

/**
 * Analyze job data and provide insights
 *
 * @param jobData The job data to analyze
 * @returns Analysis result as a string
 */
export async function analyzeJob(jobData: JobData): Promise<string> {
  // In a real implementation, this might:
  // 1. Use ML or LLM to analyze the job description
  // 2. Compare against market data
  // 3. Evaluate requirements against user profile

  // Simple example implementation
  const keywordMatches = checkKeywords(jobData.description, jobData.requirements);
  const salaryAnalysis = analyzeSalary(jobData.salary);

  return \`Job Analysis Results:
- This position requires \${jobData.requirements.length} key skills
- Key matching keywords: \${keywordMatches}
- \${salaryAnalysis}\`;
}

/**
 * Check for important keywords in the description
 */
function checkKeywords(description: string, requirements: string[]): string {
  const matches = requirements.filter(req =>
    description.toLowerCase().includes(req.toLowerCase())
  );

  return matches.join(', ');
}

/**
 * Analyze job salary information
 */
function analyzeSalary(salary?: number): string {
  if (!salary) return 'No salary information provided';

  if (salary < 50000) return 'Entry level compensation';
  if (salary < 100000) return 'Mid-level compensation';
  return 'Senior level compensation';
}`,
            },
            {
              filename: "app/page.tsx",
              language: "typescript",
              code: `// Main page component for the application
"use client"

import { useState } from 'react';
import JobAnalyzer from '../components/JobAnalyzer';

export default function HomePage() {
  const [jobId, setJobId] = useState('job-123');

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Job Analysis Tool</h1>
      <p className="mb-4">Use this tool to analyze job descriptions and requirements.</p>

      <div className="mb-6">
        <label htmlFor="jobId" className="block mb-2">Enter Job ID:</label>
        <input
          type="text"
          id="jobId"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        />
      </div>

      <div className="border p-4 rounded bg-gray-50">
        <JobAnalyzer jobId={jobId} />
      </div>
    </main>
  );
}`,
            },
            {
              filename: "components/FinalComponent.tsx",
              language: "typescript",
              code: `// Final component in the solution
"use client"

import React from 'react';

export default function FinalComponent() {
  return (
    <div className="final-component">
      <h2>Final Component</h2>
      <p>This is the final component in our solution.</p>
    </div>
  );
}`,
            },
          ],
        },
        // Ensure rawContent is a string, not a stringified object
        rawContent: `Fallback content generated due to empty AI provider response. Provider: ${provider}, Model: ${model}, Time: ${new Date().toISOString()}`,
        batchId: finalBatchId,
      };

      // Log the fallback event to Sentry without throwing an error
      captureException(
        new Error("Empty response from AI provider - fallback generated"),
        {
          provider,
          model,
          temperature,
          has_response: false,
          fallback_generated: true,
        },
      );

      // Return the fallback response
      return NextResponse.json(fallbackResponse);
    }

    try {
      // Clean the response content of any markdown code block indicators
      let cleanedResponse = responseContent
        .replace(/^```json\s*/gm, "") // Remove opening ```json
        .replace(/^```\s*$/gm, "") // Remove closing ```
        .trim();

      // Try to repair the JSON before parsing
      cleanedResponse = repairJson(cleanedResponse);

      // Now parse the repaired JSON
      let parsedSolution;
      try {
        parsedSolution = JSON.parse(cleanedResponse);

        // Ensure rawContent is present and is a string - this is required by Zod
        // Important: If this field is missing, Zod validation will fail
        if (!parsedSolution.rawContent) {
          console.log("Missing rawContent field, adding it");
          parsedSolution.rawContent = responseContent || cleanedResponse; // Use the original response content
        } else if (typeof parsedSolution.rawContent !== "string") {
          console.log("rawContent is not a string, converting to string");
          parsedSolution.rawContent = JSON.stringify(parsedSolution.rawContent);
        }

        // Extra validation for rawContent field
        if (
          !parsedSolution.rawContent ||
          typeof parsedSolution.rawContent !== "string" ||
          parsedSolution.rawContent.trim() === ""
        ) {
          console.log(
            "rawContent is empty or invalid, setting to a safe default",
          );
          parsedSolution.rawContent =
            responseContent || "Response content preserved from LLM output";
        }

        // Perform Zod validation of the parsed solution
        const validationResult =
          StructuredSolutionSchema.safeParse(parsedSolution);

        if (!validationResult.success) {
          console.log(
            "Parsed solution failed Zod validation:",
            validationResult.error.format(),
          );
          // We continue and will fix structures as needed
        } else {
          console.log("Parsed solution passed Zod validation");
        }

        // Add additional validation and fix for code files in each step
        if (parsedSolution.steps && Array.isArray(parsedSolution.steps)) {
          console.log(
            "Checking for code files in each step and fixing if necessary",
          );

          // Ensure each step has at least one code file
          let codeFilesFixed = false;
          parsedSolution.steps.forEach((step: any, index: number) => {
            if (
              !step.codeFiles ||
              !Array.isArray(step.codeFiles) ||
              step.codeFiles.length === 0
            ) {
              console.log(
                `Step ${index + 1} missing code files, adding a placeholder`,
              );

              // Create a placeholder code file based on the step title and information
              const stepNumber = index + 1;
              const sanitizedTitle = step.title
                ? step.title.replace(/[^a-zA-Z0-9]/g, "")
                : `Step${stepNumber}`;

              // Determine appropriate language and file extension based on the technology stack
              const language = techStack?.toLowerCase().includes("node")
                ? "javascript"
                : techStack?.toLowerCase().includes("react")
                  ? "jsx"
                  : techStack?.toLowerCase().includes("python")
                    ? "python"
                    : "javascript"; // Default

              const fileExtension =
                language === "javascript"
                  ? ".js"
                  : language === "jsx"
                    ? ".jsx"
                    : language === "python"
                      ? ".py"
                      : ".js"; // Default

              // Create code content based on step description
              const description =
                step.description || `Implementation for step ${stepNumber}`;
              const code =
                language === "python"
                  ? `# ${step.title || `Step ${stepNumber}`}\n# ${description}\n\ndef main():\n    print("Implementing: ${description}")\n    # TODO: Add actual implementation\n    return True\n\nif __name__ == "__main__":\n    main()`
                  : `// ${step.title || `Step ${stepNumber}`}\n// ${description}\n\n/**\n * Implementation for ${sanitizedTitle}\n */\nfunction ${sanitizedTitle}() {\n  console.log("Implementing: ${description}");\n  // TODO: Add actual implementation\n  return true;\n}\n\nmodule.exports = ${sanitizedTitle};\n`;

              // Add the placeholder code file
              step.codeFiles = [
                {
                  filename: `${sanitizedTitle}${fileExtension}`,
                  language,
                  code,
                },
              ];

              codeFilesFixed = true;
            }
          });

          if (codeFilesFixed) {
            console.log("Fixed missing code files in one or more steps");
          }
        }

        // Also ensure the finalSolution has code files
        if (
          parsedSolution.finalSolution &&
          (!parsedSolution.finalSolution.codeFiles ||
            !Array.isArray(parsedSolution.finalSolution.codeFiles) ||
            parsedSolution.finalSolution.codeFiles.length === 0)
        ) {
          console.log(
            "Final solution missing code files, adding a placeholder",
          );

          // Determine appropriate language and file extension based on the technology stack
          const language = techStack?.toLowerCase().includes("node")
            ? "javascript"
            : techStack?.toLowerCase().includes("react")
              ? "jsx"
              : techStack?.toLowerCase().includes("python")
                ? "python"
                : "javascript"; // Default

          const fileExtension =
            language === "javascript"
              ? ".js"
              : language === "jsx"
                ? ".jsx"
                : language === "python"
                  ? ".py"
                  : ".js"; // Default

          // Create code content based on final solution description
          const finalSolutionTitle =
            parsedSolution.finalSolution.title || "Final Implementation";
          const description =
            parsedSolution.finalSolution.description || "Final implementation";
          const sanitizedTitle =
            finalSolutionTitle.replace(/[^a-zA-Z0-9]/g, "") || "FinalSolution";

          const code =
            language === "python"
              ? `# ${finalSolutionTitle}\n# ${description}\n\ndef main():\n    print("Final implementation: ${description}")\n    # TODO: Add actual implementation\n    return True\n\nif __name__ == "__main__":\n    main()`
              : `// ${finalSolutionTitle}\n// ${description}\n\n/**\n * Final implementation for ${sanitizedTitle}\n */\nfunction ${sanitizedTitle}() {\n  console.log("Final implementation: ${description}");\n  // TODO: Add actual implementation\n  return true;\n}\n\nmodule.exports = ${sanitizedTitle};\n`;

          // Determine the appropriate directory based on file type
          let directoryPath = "";
          if (language === "jsx" || sanitizedTitle.match(/^[A-Z]/)) {
            // React component - use components directory
            directoryPath = "components/";
          } else if (
            language === "python" ||
            sanitizedTitle.includes("Service") ||
            sanitizedTitle.includes("Utils") ||
            sanitizedTitle.includes("Helper")
          ) {
            // Service or utility - use lib directory
            directoryPath = "lib/";
          } else if (sanitizedTitle.includes("Page")) {
            // Page component - use app directory
            directoryPath = "app/";
          } else if (
            sanitizedTitle.includes("Api") ||
            sanitizedTitle.includes("Route")
          ) {
            // API route - use app/api directory
            directoryPath = "app/api/";
          } else {
            // Default to lib for utility functions
            directoryPath = "lib/";
          }

          // Add the placeholder code file with proper directory structure
          parsedSolution.finalSolution.codeFiles = [
            {
              filename: `${directoryPath}${sanitizedTitle}${fileExtension}`,
              language,
              code,
            },
          ];

          console.log("Fixed missing code files in final solution");
        }
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error(
          "First 200 chars of content:",
          cleanedResponse.substring(0, 200),
        );
        console.error(
          "Last 200 chars of content:",
          cleanedResponse.substring(cleanedResponse.length - 200),
        );

        // Track JSON parsing errors in Sentry with samples of the content
        captureException(parseError, {
          context: "json_parse_error",
          content_sample_start: cleanedResponse.substring(0, 200),
          content_sample_end: cleanedResponse.substring(
            cleanedResponse.length - 200,
          ),
          provider,
          model,
        });

        // Fallback: return a basic structured solution
        return NextResponse.json({
          steps: Array(6).fill({
            title: "API Error",
            description:
              "The AI model returned an invalid JSON response. Please try again.",
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
          }),
          finalSolution: {
            title: "Error Solution",
            description:
              "Failed to get a valid response from the model API. Please try again.",
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
            },
          },
          rawContent: `Error parsing AI model response: ${parseError instanceof Error ? parseError.message : "Invalid JSON structure"}.`,
          batchId: finalBatchId,
        });
      }

      // Validate the structure
      if (
        !parsedSolution.steps ||
        !Array.isArray(parsedSolution.steps) ||
        parsedSolution.steps.length !== 6
      ) {
        console.warn("Solution has invalid steps structure, attempting to fix");

        // Fix: If steps is missing or not an array, create a valid steps array
        if (!parsedSolution.steps || !Array.isArray(parsedSolution.steps)) {
          parsedSolution.steps = Array(6).fill({
            title: "Generated Step",
            description:
              "This step was automatically generated due to missing step data.",
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5,
            },
          });
        }
        // Fix: If steps array has wrong length, pad or trim to exactly 6 steps
        else if (parsedSolution.steps.length !== 6) {
          if (parsedSolution.steps.length < 6) {
            // Pad with default steps
            const defaultStep = {
              title: "Generated Step",
              description: "This step was automatically generated.",
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 5,
              },
            };
            while (parsedSolution.steps.length < 6) {
              parsedSolution.steps.push(defaultStep);
            }
          } else {
            // Trim to 6 steps
            parsedSolution.steps = parsedSolution.steps.slice(0, 6);
          }
        }
      }

      if (!parsedSolution.finalSolution) {
        console.warn("Solution missing finalSolution, creating default");
        // Create a default final solution if missing
        parsedSolution.finalSolution = {
          title: "Generated Final Solution",
          description:
            "This solution was automatically generated due to missing data.",
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
          },
        };
      }

      // Return the structured solution with the raw content and batchId
      // Ensure rawContent is a string (not an object) to pass Zod validation
      const result: StructuredSolution = {
        steps: parsedSolution.steps,
        finalSolution: parsedSolution.finalSolution,
        // Always ensure rawContent is a string
        rawContent:
          parsedSolution.rawContent &&
          typeof parsedSolution.rawContent === "string"
            ? parsedSolution.rawContent // Use existing rawContent if it's a string
            : responseContent, // Otherwise use the original response content
        reasoningProcess:
          parsedSolution.reasoningProcess || parsedSolution.reasoning_process,
        // Store the original structured solution for use with the explanation API
        structuredSolution: parsedSolution,
        // Pass through the batchId for correlation of steps
        batchId: finalBatchId,
      };

      // Log presence of code files for each step
      console.log("Code files in structured solution:");
      parsedSolution.steps.forEach((step: SolutionStep, index: number) => {
        console.log(
          `Step ${index + 1} codeFiles:`,
          step.codeFiles ? `${step.codeFiles.length} files found` : "undefined",
        );

        if (step.codeFiles && step.codeFiles.length > 0) {
          console.log(`  First file: ${step.codeFiles[0].filename}`);
        }
      });

      // Log code files in final solution
      console.log(
        `Final solution codeFiles:`,
        parsedSolution.finalSolution.codeFiles
          ? `${parsedSolution.finalSolution.codeFiles.length} files found`
          : "undefined",
      );

      // Validate the final result with Zod before returning
      const finalValidation =
        StructuredSolutionResponseSchema.safeParse(result);
      if (!finalValidation.success) {
        console.warn(
          "Final structured solution response failed Zod validation:",
          finalValidation.error.format(),
        );
        // Continue and return the result anyway as we've already done our best to fix it
        console.log("Returning result despite validation issues");
      } else {
        console.log("Final structured solution response passed Zod validation");
      }

      // Generate a proper UUID for this structured solution
      const structuredSolutionId = crypto.randomUUID();

      // Create metadata for extracting and storing code files
      const structuredSolutionMetadata = {
        model: model,
        temperature: temperature,
        batchId: finalBatchId,
        runId: runId || null,
        prompt: prompt,
        createdAt: new Date().toISOString(),
        techStack: techStack || null,
        reasoningEnabled: enableReasoning || false,
      };

      // Extract and store code files from the parsed solution
      // This is non-blocking, so we don't await it
      extractAndStoreCodeFilesFromStructuredSolution(
        structuredSolutionId,
        parsedSolution,
        structuredSolutionMetadata,
      ).catch((error) => {
        console.error(
          "Error in extractAndStoreCodeFilesFromStructuredSolution:",
          error,
        );
        captureException(error, {
          context: "structured_solution_codefile_extraction_background",
        });
      });

      return NextResponse.json(result);
    } catch (parseError) {
      console.error("Failed to parse structured solution:", parseError);

      // Track parsing errors in Sentry
      captureException(parseError, {
        context: "structured_solution_parse_error",
        provider,
        model,
        response_length: responseContent?.length,
      });

      // Return a fallback solution with error information
      return NextResponse.json({
        steps: Array(6).fill({
          title: "Error Processing Solution",
          description: `Error: ${parseError instanceof Error ? parseError.message : "Unknown error parsing response"}`,
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
            codeQuality: 5,
          },
        }),
        finalSolution: {
          title: "Error Solution",
          description:
            "Failed to process the model response. Please try again.",
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
          },
        },
        rawContent: responseContent
          ? responseContent.substring(0, 1000)
          : "No response content",
        batchId: finalBatchId,
      });
    }
  } catch (error: unknown) {
    console.error("Structured solution generation error:", error);

    // Track overall errors in Sentry
    captureException(error, {
      context: "structured_solution_generation",
      route: "POST /api/structured-solution",
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate structured solution";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
