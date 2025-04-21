import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { shouldUseMockResponse } from "../fallback";
import { z } from "zod";
import {
  EmbeddingRequestSchema,
  EmbeddingResponseSchema,
  type EmbeddingRequest,
  type EmbeddingResponse,
} from "@/lib/zod-schemas";

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

/**
 * Generate embeddings for a given text using the most efficient model
 */
export async function POST(req: NextRequest) {
  try {
    // Check environment first to avoid unnecessary processing
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your_openai_api_key_here"
    ) {
      console.log(
        "Using mock response for embeddings (API key not configured properly)",
      );
      return createMockEmbeddingResponse();
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body as JSON:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate request using Zod
    const validationResult = EmbeddingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error(
        "Invalid embedding request:",
        validationResult.error.format(),
      );
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    // Extract validated data
    const { text } = validationResult.data;

    // Check if we should use mock response
    if (shouldUseMockResponse("openai")) {
      console.log("Using mock response for OpenAI API (API key not set)");
      return createMockEmbeddingResponse();
    }

    try {
      // Initialize the client
      const openai = getOpenAIClient();

      // Use the most efficient embedding model available
      const embeddingModel = "text-embedding-3-small";

      console.log(`Generating embedding with model: ${embeddingModel}`);

      // Generate embeddings using OpenAI
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: text,
        encoding_format: "float",
      });

      // Extract embedding from the response
      const embedding = response.data[0].embedding;

      // Ensure the embedding has the expected dimensionality
      if (!embedding || embedding.length !== 1536) {
        console.error(
          `Invalid embedding generated: expected 1536 dimensions, got ${embedding?.length || 0}`,
        );
        throw new Error("Invalid embedding generated");
      }

      console.log(
        `Successfully generated ${embedding.length}-dimension embedding`,
      );

      // Create and validate the response
      const responseData: EmbeddingResponse = { embedding };
      const responseValidation =
        EmbeddingResponseSchema.safeParse(responseData);

      if (!responseValidation.success) {
        console.warn(
          "Embedding response failed validation:",
          responseValidation.error.format(),
        );
        // We'll return it anyway but log the issue
      } else {
        console.log("Embedding response passed validation");
      }

      // Ensure response is properly serializable
      try {
        // Verify JSON serializability
        JSON.stringify(responseData);
        return NextResponse.json(responseData);
      } catch (serializationError) {
        console.error(
          "Failed to serialize embedding response:",
          serializationError,
        );
        return createMockEmbeddingResponse();
      }
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);

      // Fall back to mock response if API fails
      console.log("Falling back to mock embeddings due to API error");
      return createMockEmbeddingResponse();
    }
  } catch (error) {
    console.error("Embedding generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding" },
      { status: 500 },
    );
  }
}

// Helper function to create a consistent mock embedding response
function createMockEmbeddingResponse() {
  // Generate a mock embedding with 1536 dimensions
  const mockEmbedding = Array.from(
    { length: 1536 },
    () => Math.random() * 2 - 1,
  );

  // Normalize the embedding to unit length (L2 norm = 1)
  const norm = Math.sqrt(
    mockEmbedding.reduce((sum, val) => sum + val * val, 0),
  );
  const normalizedEmbedding = mockEmbedding.map((val) => val / norm);

  console.log("Generated mock embedding with 1536 dimensions");

  // Create and validate the mock response
  const mockResponse: EmbeddingResponse = {
    embedding: normalizedEmbedding,
    isMock: true,
  };

  // Validate the mock response
  const responseValidation = EmbeddingResponseSchema.safeParse(mockResponse);
  if (!responseValidation.success) {
    console.warn(
      "Mock embedding response failed validation:",
      responseValidation.error.format(),
    );
  } else {
    console.log("Mock embedding response passed validation");
  }

  return NextResponse.json(mockResponse);
}
