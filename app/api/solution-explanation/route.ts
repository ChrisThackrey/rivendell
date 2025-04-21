import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { shouldUseMockResponse } from "../fallback";

// Function to get Anthropic client with error checking
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    throw new Error(
      "Missing or invalid ANTHROPIC_API_KEY in environment variables",
    );
  }

  return new Anthropic({ apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { structuredSolution, query, techStack } = body;

    if (!structuredSolution) {
      return NextResponse.json(
        { error: "structuredSolution is required" },
        { status: 400 },
      );
    }

    // Check if we should use mock response
    if (shouldUseMockResponse("anthropic")) {
      console.log("Using mock response for Anthropic API (API key not set)");
      const mockExplanation =
        "This is a mock enhanced explanation of the solution strategy and approach.";
      return NextResponse.json({ explanation: mockExplanation });
    }

    // Initialize the client
    const anthropic = getAnthropicClient();

    // Always use Claude-Sonnet-7 for this task
    const modelToUse = "claude-3-5-sonnet-20240620"; // Corresponds to Claude-Sonnet-7

    // Extract the structured solution data
    const finalSolution = structuredSolution.finalSolution || {};

    // Create the explanation prompt
    const prompt = `
You are tasked with explaining the strategic decision-making process and technical reasoning behind a multi-step AI solution approach.

PROBLEM:
${query || "Solving a programming problem"}

TECH STACK:
${techStack || "Not specified"}

SOLUTION PATH:
The solution was developed through the following steps:
${structuredSolution.steps
  .map(
    (step: { title: string; description: string }, index: number) =>
      `Step ${index + 1}: ${step.title}
  ${step.description}`,
  )
  .join("\n\n")}

FINAL SOLUTION:
${finalSolution.title}
${finalSolution.description}

Your task is to provide a comprehensive explanation of:
1. The overall strategy and why this approach was chosen
2. How each step builds upon the previous one to create the final solution
3. The key technical decisions and their justifications
4. How the solution leverages the specified tech stack effectively
5. The strengths of this solution compared to alternative approaches

Respond with an insightful, technically precise explanation that would help a software engineer understand the reasoning process and strategy behind this solution path. Keep your response concise but comprehensive.

CRITICALLY IMPORTANT: When describing code implementations, always mention SPECIFIC, CONCRETE details. Do NOT refer to placeholder code examples or generic implementations. Highlight the actual technical implementation details from the solution steps, not hypothetical code. Be precise and accurate about what the code actually implements.
`;

    try {
      console.log(`Making Anthropic API call with model: ${modelToUse}`);

      // Get an explanation from Claude
      const message = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: 1500,
        temperature: 0.3, // Keep it factual and precise
        system:
          "You are an expert software engineering consultant who provides clear, technical explanations of AI-generated solution strategies.",
        messages: [{ role: "user", content: prompt }],
      });

      console.log("Anthropic API call successful");

      // Extract the response content
      const explanation =
        message.content[0].type === "text" ? message.content[0].text : "";

      return NextResponse.json({ explanation });
    } catch (apiError) {
      console.error("Anthropic API call failed:", apiError);

      // Create a fallback response for debugging
      const fallbackExplanation =
        "Failed to generate an enhanced explanation. This could be due to API limits, authentication issues, or other technical problems.";

      return NextResponse.json({
        explanation: fallbackExplanation,
        error: apiError instanceof Error ? apiError.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Solution explanation generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate enhanced explanation" },
      { status: 500 },
    );
  }
}

// Function to generate a mock explanation for testing - unused but kept for reference
function generateMockExplanation(
  _structuredSolution: Record<string, unknown>,
): string {
  return `
## Strategic Approach

This solution follows a systematic approach that prioritizes both performance and maintainability. The strategy begins with a careful analysis of the problem constraints and builds through iterative refinement to deliver a robust implementation.

## Key Technical Decisions

1. **Initial Decomposition**: The problem was broken down into manageable components, allowing for modular development and clear separation of concerns.

2. **Algorithm Selection**: An efficient algorithm was chosen based on time complexity analysis, with O(n) performance for the primary operations.

3. **Error Handling**: Comprehensive error handling was implemented to ensure the solution remains robust under various input conditions.

4. **Optimization**: Performance bottlenecks were identified and addressed, resulting in memory usage optimization and improved execution time.

## Technology Leverage

The solution effectively utilizes the specified tech stack, taking advantage of built-in capabilities for data transformation and validation. Modern language features are employed to maintain clean, concise code while ensuring maximum compatibility.

## Comparative Advantages

Compared to alternative approaches, this solution offers superior maintainability without sacrificing performance. The clean architecture makes future extensions straightforward, while the optimized core logic ensures excellent performance metrics.
`;
}
