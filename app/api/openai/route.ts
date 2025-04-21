import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateMockResponse, shouldUseMockResponse } from "../fallback";
import { z } from "zod";
import {
  OpenAIRequestSchema,
  OpenAIResponseSchema,
  MetricsSchema,
} from "@/lib/zod-schemas";
import {
  extractCodeFilesFromDocument,
  storeCodeFileWithEmbedding,
} from "@/lib/codefile-service";
import { type CodeFile } from "@/lib/supabase-client";
import { captureException } from "@/lib/error-reporting";
import { updateDocumentCodeFiles } from "@/lib/document-service";
import crypto from "crypto";
import {
  calculateExecutionTime,
  estimateComplexity,
  estimateMemoryUsage,
  countCodeLines,
  calculateCodeQuality,
  calculateConvergenceScore,
  generateTitleFromContent,
} from "@/lib/metrics-utils";

// Type for validated request
type ValidatedRequest = z.infer<typeof OpenAIRequestSchema>;

// Function to get OpenAI client with error checking
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "your_openai_api_key_here") {
    throw new Error(
      "Missing or invalid OPENAI_API_KEY in environment variables",
    );
  }

  return new OpenAI({ apiKey });
}

// System messages for different model types
const systemMessages = {
  default:
    "You are a helpful assistant that provides well-reasoned solutions to programming problems. CRITICAL: NEVER use placeholder code like 'Sample code generated for placeholder document' or 'This file was auto-generated...'. If you provide code examples, always give REAL code with actual implementation details, not just comments or placeholders. When creating multiple code files, ensure they form a consistent file structure with proper directory organization and maintain correct import paths between files.",

  reasoning: `You are a helpful assistant that uses step-by-step reasoning to solve problems.
When presented with a task or problem:
1. Break down the problem systematically
2. Consider different approaches and trade-offs
3. Provide detailed explanations for your choices
4. Begin your response with a clear, concise title summarizing your approach
5. Make sure your solution is complete and correct
6. If the problem involves code, ensure your solution is efficient and follows best practices

When suggesting code solutions:
1. Create proper file structure with logical directory organization (e.g., src/components/, src/utils/, etc.)
2. Use consistent naming conventions for files and folders
3. Maintain correct import paths between files
4. Consider the project context and ensure files work together as a cohesive system
5. For new projects, include necessary configuration files, package.json, and entry points
6. When modifying existing code, maintain all relevant imports and dependencies

CRITICAL: NEVER use placeholder code like "Sample code generated for placeholder document" or "This file was auto-generated...". If you provide code examples, always give REAL code with actual implementation details, not just comments or placeholders. If you can't generate fully implemented code for a specific case, provide a minimal working example that demonstrates the core concept.`,

  code: `You are a helpful coding assistant that specializes in writing clean, efficient code.
When presented with a coding task:
1. Begin your response with a concise title that summarizes your implementation approach
2. Provide a clear explanation of your solution strategy
3. Write code that is well-structured, commented, and follows best practices
4. Consider edge cases and error handling
5. Focus on performance and scalability when relevant
6. Ensure your code works correctly for all valid inputs

When implementing code spanning multiple files:
1. Create a logical file structure with appropriate directories (e.g., src/components/, src/utils/)
2. Maintain consistent naming conventions across files and directories
3. Use correct relative import paths between files that would work in a real project
4. Include all necessary configuration files and boilerplate
5. Ensure all files would work together in a real project environment
6. For new projects, start with basic project structure including package.json, configuration files
7. Consider the overall architecture to create maintainable, extensible code

CRITICAL: NEVER provide placeholder code like "Sample code generated for placeholder document" or "This file was auto-generated...". Always implement REAL, functional code with complete and meaningful implementation details. Empty or placeholder implementations will be rejected. Prioritize quality over quantity - a small but well-implemented code sample is preferable to multiple placeholder files.`,
};

// Model-specific configurations
const modelConfigurations = {
  // GPT-4o models
  "gpt-4o": {
    max_tokens: 4096,
    supports_reasoning: true,
    supports_json_mode: true,
    supports_vision: true,
    supports_tools: true,
  },
  "gpt-4o-mini": {
    max_tokens: 4096,
    supports_reasoning: true,
    supports_json_mode: true,
    supports_vision: true,
    supports_tools: true,
  },

  // o3 models (mapped to OpenAI models)
  o3: {
    max_tokens: 4096, // Use max_tokens consistently across all models
    supports_reasoning: true,
    supports_json_mode: true,
    supports_vision: true,
    supports_tools: true,
  },
  "o3-mini": {
    max_tokens: 4096, // Use max_tokens consistently across all models
    supports_reasoning: true,
    supports_json_mode: true,
    supports_vision: true,
    supports_tools: true,
  },
  o1: {
    max_tokens: 4096, // Use max_tokens consistently across all models
    supports_reasoning: true,
    supports_json_mode: true,
    supports_vision: true,
    supports_tools: true,
  },

  // GPT-3.5 models
  "gpt-3.5-turbo": {
    max_tokens: 4096,
    supports_reasoning: false,
    supports_json_mode: true,
    supports_vision: false,
    supports_tools: false,
  },
};

// Get the mode based on prompt content
function getPromptMode(prompt: string): "reasoning" | "code" | "default" {
  const lowerPrompt = prompt.toLowerCase();
  if (
    lowerPrompt.includes("step by step") ||
    lowerPrompt.includes("reason") ||
    lowerPrompt.includes("explain") ||
    lowerPrompt.includes("think through")
  ) {
    return "reasoning";
  } else if (
    lowerPrompt.includes("code") ||
    lowerPrompt.includes("implement") ||
    lowerPrompt.includes("function") ||
    lowerPrompt.includes("programming")
  ) {
    return "code";
  }
  return "default";
}

// Function to extract and store code files from a response
async function extractAndStoreCodeFiles(
  documentId: string,
  content: string,
  metadata: Record<string, any>,
): Promise<CodeFile[]> {
  try {
    // Extract code files from response content
    const codeFiles = await extractCodeFilesFromDocument(
      documentId,
      content,
      metadata,
    );

    if (codeFiles.length === 0) {
      console.log("No code files found in OpenAI response");
      return [];
    }

    console.log(`Found ${codeFiles.length} code files in OpenAI response`);

    // Store each code file
    const runId = metadata.runId || null;
    const stepNumber = metadata.stepNumber || null;
    const batchId = metadata.batchId || null;

    const storedCodeFiles: CodeFile[] = [];

    for (const codeFile of codeFiles) {
      try {
        // Store code file with embedding
        const id = await storeCodeFileWithEmbedding(
          codeFile,
          documentId,
          batchId,
          runId,
          stepNumber,
          metadata,
        );

        if (id) {
          console.log(`Stored code file ${codeFile.filename} with ID ${id}`);
          storedCodeFiles.push(codeFile);
        } else {
          console.error(`Failed to store code file ${codeFile.filename}`);
        }
      } catch (error) {
        console.error(`Error storing code file ${codeFile.filename}:`, error);
        captureException(error, {
          context: "openai_codefile_storage",
          filename: codeFile.filename,
        });
      }
    }

    return storedCodeFiles;
  } catch (error) {
    console.error("Error extracting and storing code files:", error);
    captureException(error, { context: "openai_codefile_extraction" });
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request data using Zod
    const validationResult = OpenAIRequestSchema.safeParse(body);

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
    const { prompt, model, temperature, enableReasoning } =
      validationResult.data;

    // Check if we should use mock response
    if (shouldUseMockResponse("openai")) {
      console.log("Using mock response for OpenAI API (API key not set)");
      const mockResult = generateMockResponse(prompt, model || "gpt-4o");
      return NextResponse.json(mockResult);
    }

    // Initialize the client
    const openai = getOpenAIClient();

    // Ensure we're using a valid model name
    const modelToUse = model || "gpt-4o";

    // Get model configuration or use default if model not in our config
    const modelConfig = (modelToUse &&
      modelConfigurations[modelToUse as keyof typeof modelConfigurations]) || {
      max_tokens: 4096,
      supports_reasoning: false,
      supports_json_mode: true,
      supports_vision: false,
      supports_tools: false,
    };

    // Determine if we should use reasoning based on user preference and model support
    const shouldUseReasoning =
      enableReasoning === true && modelConfig.supports_reasoning;

    // Determine the mode based on the prompt content
    const promptMode = getPromptMode(prompt);

    // Select appropriate system message
    let systemMessage = systemMessages.default;
    if (shouldUseReasoning && promptMode === "reasoning") {
      systemMessage = systemMessages.reasoning;
    } else if (promptMode === "code") {
      systemMessage = systemMessages.code;
    }

    // Build the API request parameters - use OpenAI's type
    const messages = [
      { role: "system" as const, content: systemMessage },
      { role: "user" as const, content: prompt },
    ];

    // Base configuration object - handle different models appropriately
    const baseConfig: Record<string, unknown> = {
      model: modelToUse,
      messages,
    };

    // Use max_tokens parameter for all models consistently
    baseConfig.max_tokens = modelConfig.max_tokens || 4096;

    // Add temperature parameter for all models
    // Even for 'o' models which previously didn't support temperature
    baseConfig.temperature = temperature || 0.7;

    // Create tools configuration if needed
    let requestConfig: Record<string, unknown>;

    // Add reasoning configuration if supported and enabled
    if (shouldUseReasoning) {
      const reasoningTools = [
        {
          type: "function" as const,
          function: {
            name: "reasoning",
            description:
              "Use step by step reasoning to think through a problem or question",
            parameters: {
              type: "object",
              properties: {
                reasoning: {
                  type: "string",
                  description: "Step by step reasoning process",
                },
                final_answer: {
                  type: "string",
                  description: "Final answer after reasoning",
                },
              },
              required: ["reasoning", "final_answer"],
            },
          },
        },
      ];

      requestConfig = {
        ...baseConfig,
        tool_choice: {
          type: "function" as const,
          function: { name: "reasoning" },
        },
        tools: reasoningTools,
      };
    } else if (modelConfig.supports_tools) {
      // For models with tool support that aren't using reasoning,
      // still provide an empty tools array to ensure proper API behavior
      requestConfig = {
        ...baseConfig,
        tools: [],
      };
    } else {
      // Just use the base config
      requestConfig = baseConfig;
    }

    console.log(
      `Using OpenAI model: ${modelToUse}, Reasoning enabled: ${shouldUseReasoning}`,
    );

    // Get a chat completion from OpenAI
    // Cast to any to avoid TypeScript errors with the dynamic structure
    const completion = await openai.chat.completions.create(
      requestConfig as any,
    );

    // Extract the response content
    let content = "";
    let reasoning = "";

    if (shouldUseReasoning && completion.choices[0].message.tool_calls) {
      // Extract the reasoning and final answer from the tool call
      const toolCall = completion.choices[0].message.tool_calls[0];
      if (toolCall && toolCall.function.name === "reasoning") {
        try {
          const toolArgs = JSON.parse(toolCall.function.arguments);
          reasoning = toolArgs.reasoning || "";
          content = toolArgs.final_answer || "";
        } catch (e) {
          console.error("Error parsing reasoning function arguments:", e);
          content = "Error extracting reasoning results.";
        }
      }
    } else {
      // Normal response
      content = completion.choices[0].message.content || "";
    }

    // Add documentId generation before creating metadata
    // Generate a proper UUID for this response
    const documentId = crypto.randomUUID();

    // Replace existing metrics logic with utility function calls
    const metadata = {
      title: generateTitleFromContent(content) || "Strategic Implementation",
      executionTime: calculateExecutionTime(content),
      complexity: estimateComplexity(content),
      memoryUsage: estimateMemoryUsage(content),
      codeLines: countCodeLines(content),
      codeQuality: calculateCodeQuality(content),
      convergenceScore: calculateConvergenceScore("gpt-4", content),
      modelName: model,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: body.userId,
      documentId,
      projectId: body.projectId,
    };

    // Extract and store code files from the response
    const fullContent = reasoning ? `${reasoning}\n\n${content}` : content;
    console.log(
      `Extracting code files from OpenAI response with document ID: ${documentId}`,
    );
    const codeFiles = await extractAndStoreCodeFiles(
      documentId,
      fullContent,
      metadata,
    );
    console.log(
      `Extracted and stored ${codeFiles.length} code files for OpenAI response`,
    );

    // Also update the document metadata directly for redundancy
    if (codeFiles.length > 0) {
      try {
        console.log(
          `Updating document ${documentId} metadata with ${codeFiles.length} code files`,
        );
        // Ensure all code files have a non-undefined language property
        const sanitizedCodeFiles = codeFiles.map((file) => ({
          ...file,
          language: file.language || "text", // Default to 'text' if language is undefined
        }));
        await updateDocumentCodeFiles(documentId, sanitizedCodeFiles);
      } catch (error) {
        console.error(
          "Error updating document metadata with code files:",
          error,
        );
        // Non-critical error, don't fail the request
      }
    }

    // Prepare the final response
    const response = {
      title: metadata.title,
      description: content,
      fullContent,
      metrics: metadata,
      model: modelToUse,
      reasoningEnabled: shouldUseReasoning,
      codeFiles: codeFiles.length > 0 ? codeFiles : undefined,
    };

    // Validate response data using Zod
    const responseValidation = OpenAIResponseSchema.safeParse(response);
    if (!responseValidation.success) {
      console.warn(
        "Response data failed Zod validation:",
        responseValidation.error.format(),
      );
      // Return the response anyway, as we've done our best
    } else {
      console.log("Response data passed Zod validation");
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response from OpenAI" },
      { status: 500 },
    );
  }
}
