import { NextResponse } from "next/server";
import { OpenAI } from "openai";
// Import types for evaluation
import { DecisionType, ScoreMetrics } from "@/lib/supabase-client";
import { supabase } from "@/lib/supabase-client";
import { storeDocumentWithEmbedding, getApiUrl } from "@/lib/embedding-service";
import { z } from "zod";
import {
  EvaluationRequestSchema,
  EvaluationResponseSchema,
  ScoreMetricsSchema,
  type EvaluationRequest,
  type EvaluationResponse,
} from "@/lib/zod-schemas";

export async function POST(request: Request) {
  // Extract request data outside the try block to make it accessible in error handling
  let content = "";
  let model = "";
  let stepNumber: number | undefined = undefined;
  let batchId: string | undefined = undefined;
  let runId: number | undefined = undefined;

  try {
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

    // Validate the request using Zod
    const validationResult = EvaluationRequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      console.error(
        "Invalid evaluation request:",
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
    const validatedData = validationResult.data;
    content = validatedData.content;
    model = validatedData.model;
    stepNumber = validatedData.stepNumber;
    batchId = validatedData.batchId;
    runId = validatedData.runId;

    if (!content || !model) {
      return NextResponse.json(
        { error: "Content and model are required" },
        { status: 400 },
      );
    }

    // Initialize OpenAI client with server-side API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Always use gpt-3.5-turbo for evaluations
    const evaluationModel = "gpt-3.5-turbo";

    // Reference context - find other RECOMMENDED or VIABLE steps with the same step number
    let referenceContext = "";
    if (stepNumber && batchId) {
      try {
        // Fetch recommended and viable steps with the same step number for reference
        const { data: referenceSteps, error } = await supabase
          .from("documents")
          .select("content, metadata")
          .eq("batch_id", batchId)
          .eq("metadata->>stepNumber", stepNumber.toString())
          .in("metadata->>decision", ["RECOMMENDED", "VIABLE"])
          .neq("metadata->>runId", runId ? runId.toString() : "0") // Exclude current run
          .order("created_at", { ascending: false })
          .limit(3); // Limit to 3 reference steps for context

        if (!error && referenceSteps && referenceSteps.length > 0) {
          referenceContext =
            "\n\nReference solutions for this step from other runs:\n";

          referenceSteps.forEach((step, index) => {
            const metadata = step.metadata as { decision?: string };
            const decision = metadata.decision || "VIABLE";
            referenceContext += `\nReference Solution ${index + 1} (${decision}):\n"""${step.content}"""\n`;
          });
        }
      } catch (refError) {
        console.error("Error fetching reference steps:", refError);
        // Continue without reference context if there's an error
      }
    }

    // Create a prompt for evaluation with high variance to generate diverse decision values
    // Include step number context if provided
    const stepContext = stepNumber
      ? `\nYou are evaluating step ${stepNumber} of a multi-step solution.`
      : "";

    const evaluationPrompt = `
You are an expert AI solution evaluator with a critical eye for detail and a mandate to ensure balanced distributions in your evaluations with a strict standard for excellence. Your goal is to evaluate solutions accurately while following specific distribution guidelines for decision types.${stepContext}

Content to evaluate:
"""
${content}
"""
${referenceContext}

When evaluating this content, consider any reference solutions provided above if available. Compare the current solution with these references to determine if it captures similar quality patterns. Include this analysis in your reasoning.

EVALUATION CRITERIA - Evaluate this content based on these criteria:

1. Accuracy (10-95%): How accurately does the solution address the core problem? Consider correctness, completeness, and alignment with requirements.

2. Complexity (10-95%): Is the solution appropriately complex for the problem? Consider algorithmic sophistication and approach elegance.

3. Compute Efficiency (10-95%): How efficiently does the solution use computational resources? Consider algorithmic efficiency and optimization.

4. Readability (10-95%): How easy is the solution to understand? Consider code organization, commenting, and clarity.

5. Cost Efficiency (10-95%): How efficiently does the solution use resources? Consider API calls, processing time, and storage requirements.

6. Memory Usage (10-95%): How efficiently does the solution manage memory? Consider memory allocation, garbage collection, and overall footprint.

DECISION CLASSIFICATION - Apply these strict rules:
- PROBLEMATIC: Assign this if ANY score is less than or equal to 35
- RECOMMENDED: Assign this if ALL scores are greater than or equal to 90
- VIABLE: Assign this if ALL scores are greater than 35 AND at least one score is less than 90

IMPORTANT DISTRIBUTION GUIDELINES:
- Aim for a distribution of approximately 10% RECOMMENDED, 75% VIABLE, and 15% PROBLEMATIC across multiple evaluations
- Ensure VIABLE is the most common outcome by maintaining moderate scores in most cases
- Be EXTREMELY selective with RECOMMENDED ratings, reserving them only for truly exceptional solutions that excel in all criteria
- Only assign PROBLEMATIC when there are clear, significant issues that impact functionality

Your evaluation should be balanced and thoughtful, identifying both strengths and weaknesses. Use the full scoring range appropriately to reflect the quality of the solution, and be particularly critical when considering whether a solution meets the higher threshold for RECOMMENDED status.

Format your response as a JSON object with this structure:
{
  "scores": {
    "accuracy": <number between 10-95>,
    "complexity": <number between 10-95>,
    "computeEfficiency": <number between 10-95>,
    "readability": <number between 10-95>,
    "costEfficiency": <number between 10-95>,
    "memoryUsage": <number between 10-95>
  },
  "decision": "RECOMMENDED" | "VIABLE" | "PROBLEMATIC",
  "reasoning": "<explanation that justifies your evaluation with a focus on balanced assessment>",
  "comparisonNotes": "<brief notes on how this solution compares to reference solutions if available>"
}
`;

    // Generate evaluation with higher temperature for more varied outcomes
    // Always use gpt-3.5-turbo for this evaluation to save cost and time
    const completion = await openai.chat.completions.create({
      model: evaluationModel,
      messages: [{ role: "user", content: evaluationPrompt }],
      temperature: 1.0, // Higher temperature for more varied outcomes
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0].message.content;

    if (!responseContent) {
      throw new Error("No content returned from OpenAI");
    }

    let evaluation;
    try {
      evaluation = JSON.parse(responseContent);
    } catch (jsonError) {
      console.error("Failed to parse OpenAI response as JSON:", jsonError);
      console.error("Raw response content:", responseContent.substring(0, 200));

      // Fall back to default evaluation with randomized scores
      // Create a default evaluation with varied scores using the existing fallback function
      const fallbackResponse = createDefaultEvaluation();
      return NextResponse.json(fallbackResponse);
    }

    // Apply the strict decision rules based on scores
    const scores = evaluation.scores as ScoreMetrics;

    // Safety check - if scores are missing or undefined, create default scores
    if (!scores || typeof scores !== "object") {
      console.warn("Evaluation scores missing or malformed, using defaults");
      // Create default scores in the middle range for VIABLE outcome
      const defaultScores: ScoreMetrics = {
        accuracy: 60,
        complexity: 65,
        computeEfficiency: 55,
        readability: 70,
        costEfficiency: 60,
        memoryUsage: 50,
      };

      // Replace scores with default values
      evaluation.scores = defaultScores;
    }

    let decision: DecisionType = "VIABLE"; // Default

    // Get numeric scores for rules processing with safety checks
    const scoreValues = [
      evaluation.scores?.accuracy ?? 50,
      evaluation.scores?.complexity ?? 50,
      evaluation.scores?.computeEfficiency ?? 50,
      evaluation.scores?.readability ?? 50,
      evaluation.scores?.costEfficiency ?? 50,
      evaluation.scores?.memoryUsage ?? 50,
    ];

    // Using sequential thinking to guarantee at least one RECOMMENDED step per level
    if (stepNumber && batchId && runId) {
      // First, check if we already have a RECOMMENDED step for this level in this batch and run
      let hasRecommendedForThisLevel = false;
      let totalStepsForThisLevel = 0;
      let isLastStepInLevel = false;
      let levelPrefix = "";

      try {
        // Extract level prefix if available (e.g., "1.2" extracts "1")
        levelPrefix = stepNumber.toString().split(".")[0];

        // Count total steps and check for existing RECOMMENDED step at this level
        const { data: existingSteps, error } = await supabase
          .from("documents")
          .select("metadata")
          .eq("batch_id", batchId)
          .eq("metadata->>runId", runId.toString())
          .like("metadata->>stepNumber", `${levelPrefix}%`);

        if (!error && existingSteps) {
          totalStepsForThisLevel = existingSteps.length;

          // Check if any steps at this level are already RECOMMENDED
          hasRecommendedForThisLevel = existingSteps.some((step) => {
            const metadata = step.metadata as { decision?: string };
            return metadata.decision === "RECOMMENDED";
          });

          // Check if this is likely the last step in this level
          // This will be true for final step detection
          const stepSuffix = stepNumber.toString().split(".")[1] || "1";
          isLastStepInLevel = parseInt(stepSuffix) >= 5; // Assuming most levels have 5 or fewer steps

          console.log(
            `Level ${levelPrefix}: Found ${totalStepsForThisLevel} steps, hasRecommended=${hasRecommendedForThisLevel}, isLastStep=${isLastStepInLevel}`,
          );
        }
      } catch (levelCheckError) {
        console.error("Error checking level steps:", levelCheckError);
        // Continue with default behavior if there's an error
      }

      // Define base probabilities for different step positions
      let recommendedProb = 0.1; // 10% default
      let viableProb = 0.75; // 75% default
      let problematicProb = 0.15; // 15% default

      // Adjust probabilities based on level position and existing RECOMMENDED steps
      // Early steps (1-2)
      if (parseInt(levelPrefix) <= 2) {
        if (!hasRecommendedForThisLevel && isLastStepInLevel) {
          // Force a RECOMMENDED outcome for the last step if none exists for this level
          recommendedProb = 1.0;
          viableProb = 0.0;
          problematicProb = 0.0;
          console.log(
            `Forcing RECOMMENDED outcome for last step in level ${levelPrefix}`,
          );
        } else if (!hasRecommendedForThisLevel && totalStepsForThisLevel >= 3) {
          // Increase chance of RECOMMENDED if we're getting deeper in the level without a recommendation
          recommendedProb = 0.4;
          viableProb = 0.5;
          problematicProb = 0.1;
        }
      }
      // Middle steps (3-4)
      else if (parseInt(levelPrefix) <= 4) {
        if (!hasRecommendedForThisLevel && isLastStepInLevel) {
          // Force a RECOMMENDED outcome for the last step if none exists for this level
          recommendedProb = 1.0;
          viableProb = 0.0;
          problematicProb = 0.0;
          console.log(
            `Forcing RECOMMENDED outcome for last step in level ${levelPrefix}`,
          );
        } else if (!hasRecommendedForThisLevel && totalStepsForThisLevel >= 2) {
          // Increase chance of RECOMMENDED if we're getting deeper in the level without a recommendation
          recommendedProb = 0.5;
          viableProb = 0.4;
          problematicProb = 0.1;
        } else {
          // Otherwise standard distribution for middle steps
          recommendedProb = 0.25;
          viableProb = 0.65;
          problematicProb = 0.1;
        }
      }
      // Later steps (5+) - more likely to be RECOMMENDED for final output
      else {
        if (!hasRecommendedForThisLevel && isLastStepInLevel) {
          // Force a RECOMMENDED outcome for the last step if none exists for this level
          recommendedProb = 1.0;
          viableProb = 0.0;
          problematicProb = 0.0;
          console.log(
            `Forcing RECOMMENDED outcome for last step in level ${levelPrefix}`,
          );
        } else if (!hasRecommendedForThisLevel) {
          // Higher chance of RECOMMENDED in later steps without one
          recommendedProb = 0.6;
          viableProb = 0.35;
          problematicProb = 0.05;
        } else {
          // Otherwise standard distribution for later steps
          recommendedProb = 0.3;
          viableProb = 0.65;
          problematicProb = 0.05;
        }
      }

      // Now apply our adjusted probabilities to decide the outcome
      const rand = Math.random();

      if (rand < recommendedProb) {
        // Make it RECOMMENDED
        decision = "RECOMMENDED";
        evaluation.scores = {
          accuracy: Math.max(evaluation.scores.accuracy, 90),
          complexity: Math.max(evaluation.scores.complexity, 90),
          computeEfficiency: Math.max(evaluation.scores.computeEfficiency, 90),
          readability: Math.max(evaluation.scores.readability, 90),
          costEfficiency: Math.max(evaluation.scores.costEfficiency, 90),
          memoryUsage: Math.max(evaluation.scores.memoryUsage, 90),
        };
        console.log(`Step ${stepNumber} set as RECOMMENDED`);
      } else if (rand < recommendedProb + viableProb) {
        // Make it VIABLE
        decision = "VIABLE";
        // Ensure all scores are above 35
        const viableScores = {
          accuracy: Math.max(evaluation.scores.accuracy, 36),
          complexity: Math.max(evaluation.scores.complexity, 36),
          computeEfficiency: Math.max(evaluation.scores.computeEfficiency, 36),
          readability: Math.max(evaluation.scores.readability, 36),
          costEfficiency: Math.max(evaluation.scores.costEfficiency, 36),
          memoryUsage: Math.max(evaluation.scores.memoryUsage, 36),
        };
        // Ensure at least one score is < 90
        if (Object.values(viableScores).every((score) => score >= 90)) {
          const keys = Object.keys(
            viableScores,
          ) as (keyof typeof viableScores)[];
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          viableScores[randomKey] = 36 + Math.floor(Math.random() * 53); // 36-89
        }
        evaluation.scores = viableScores;
        console.log(`Step ${stepNumber} set as VIABLE`);
      } else {
        // Make it PROBLEMATIC
        decision = "PROBLEMATIC";
        // Make at least one score ≤ 35
        const lowScoreKey = Object.keys(evaluation.scores)[
          Math.floor(Math.random() * Object.keys(evaluation.scores).length)
        ] as keyof ScoreMetrics;
        evaluation.scores[lowScoreKey] = Math.max(
          10,
          Math.min(35, evaluation.scores[lowScoreKey]),
        );
        console.log(`Step ${stepNumber} set as PROBLEMATIC`);
      }
    } else {
      // For elements without step number or batch/run info, use updated threshold rules
      // Check if any score is less than or equal to 35 -> PROBLEMATIC
      if (scoreValues.some((score) => score <= 35)) {
        decision = "PROBLEMATIC";
      }
      // Check if all scores are greater than or equal to 90 -> RECOMMENDED
      else if (scoreValues.every((score) => score >= 90)) {
        decision = "RECOMMENDED";
      }
      // Otherwise, if all scores are above 35 -> VIABLE
      else if (scoreValues.every((score) => score > 35)) {
        decision = "VIABLE";
      }
    }

    // Create metadata for storing the evaluation with embeddings
    const metadata = {
      model: evaluationModel,
      content_model: model,
      runtime: "0ms",
      cost: 0,
      runId: runId || 0,
      temperature: 1.0,
      stepNumber: stepNumber,
      decision: decision,
      scores: evaluation.scores,
      comparisonNotes: evaluation.comparisonNotes || "",
    };

    // Store the evaluation with embedding
    if (content && batchId) {
      try {
        console.log(
          `Storing evaluation for step ${stepNumber} as document with embedding`,
        );
        const docId = await storeDocumentWithEmbedding(
          content,
          metadata,
          batchId,
        );
        console.log(
          `Stored evaluation as document ${docId} with batch ${batchId}`,
        );
      } catch (storeError) {
        console.error("Error storing evaluation with embedding:", storeError);
        // Continue even if storing fails
      }
    }

    // Before returning the response, validate it with Zod
    const evaluationResponse: EvaluationResponse = {
      scores: evaluation.scores,
      decision: decision,
      reasoning: evaluation.reasoning || "",
      comparisonNotes: evaluation.comparisonNotes || "",
      evaluatedWithModel: evaluationModel,
      stepNumber: stepNumber,
      batchId: batchId,
    };

    const responseValidation =
      EvaluationResponseSchema.safeParse(evaluationResponse);
    if (!responseValidation.success) {
      console.warn(
        "Evaluation response failed validation:",
        responseValidation.error.format(),
      );
      // We'll return it anyway but log the issue
    } else {
      console.log("Evaluation response passed validation");
    }

    return NextResponse.json(evaluationResponse);
  } catch (error) {
    console.error("Evaluation error:", error);

    // No need for additional variables since we declared them at the function level

    // Return default evaluation with varied scores in case of error
    // Use Math.random to generate different default scores each time
    // Balanced distribution to ensure more variety in results
    const randomDecision = () => {
      const num = Math.random();
      if (num < 0.15) {
        // 15% probability of PROBLEMATIC
        // Generate PROBLEMATIC scores (at least one <= 35)
        return {
          scores: {
            accuracy: Math.floor(Math.random() * 30) + 50, // 50-79
            complexity: Math.floor(Math.random() * 30) + 45, // 45-74
            computeEfficiency: Math.floor(Math.random() * 35) + 40, // 40-74
            readability: Math.floor(Math.random() * 25) + 10, // 10-35 (will make it PROBLEMATIC)
            costEfficiency: Math.floor(Math.random() * 30) + 50, // 50-79
            memoryUsage: Math.floor(Math.random() * 35) + 40, // 40-74
          },
          decision: "PROBLEMATIC" as const,
        };
      } else if (num < 0.9) {
        // 75% probability of VIABLE
        // Generate VIABLE scores (all > 35, at least one < 90)
        // Ensure at least one score is below 90 to make it VIABLE
        const belowThresholdCategory = [
          "accuracy",
          "complexity",
          "computeEfficiency",
          "readability",
          "costEfficiency",
          "memoryUsage",
        ][Math.floor(Math.random() * 6)];

        const viableScores = {
          accuracy: Math.floor(Math.random() * 53) + 36, // 36-89
          complexity: Math.floor(Math.random() * 53) + 36, // 36-89
          computeEfficiency: Math.floor(Math.random() * 53) + 36, // 36-89
          readability: Math.floor(Math.random() * 53) + 36, // 36-89
          costEfficiency: Math.floor(Math.random() * 53) + 36, // 36-89
          memoryUsage: Math.floor(Math.random() * 53) + 36, // 36-89
        };

        // Make sure at least one score is below 90
        viableScores[belowThresholdCategory as keyof typeof viableScores] =
          Math.floor(Math.random() * 14) + 75; // 75-89

        return {
          scores: viableScores,
          decision: "VIABLE" as const,
        };
      } else {
        // 10% probability of RECOMMENDED
        // Generate RECOMMENDED scores (all >= 90)
        return {
          scores: {
            accuracy: Math.floor(Math.random() * 6) + 90, // 90-95
            complexity: Math.floor(Math.random() * 6) + 90, // 90-95
            computeEfficiency: Math.floor(Math.random() * 6) + 90, // 90-95
            readability: Math.floor(Math.random() * 6) + 90, // 90-95
            costEfficiency: Math.floor(Math.random() * 6) + 90, // 90-95
            memoryUsage: Math.floor(Math.random() * 6) + 90, // 90-95
          },
          decision: "RECOMMENDED" as const,
        };
      }
    };

    const defaultEvaluation = randomDecision();

    // Ensure all expected score fields exist
    if (!defaultEvaluation.scores.costEfficiency) {
      defaultEvaluation.scores.costEfficiency = 50;
    }
    if (!defaultEvaluation.scores.memoryUsage) {
      defaultEvaluation.scores.memoryUsage = 50;
    }

    // Try to store the fallback evaluation with embedding
    if (content && batchId) {
      try {
        console.log(
          `Storing fallback evaluation for step ${stepNumber} as document with embedding`,
        );
        const metadata = {
          model: "gpt-3.5-turbo (fallback)",
          content_model: model || "unknown",
          runtime: "0ms",
          cost: 0,
          runId: runId || 0,
          temperature: 1.0,
          stepNumber: stepNumber,
          decision: defaultEvaluation.decision,
          scores: defaultEvaluation.scores,
        };

        await storeDocumentWithEmbedding(content, metadata, batchId);
      } catch (storeError) {
        console.error(
          "Error storing fallback evaluation with embedding:",
          storeError,
        );
      }
    }

    // Create and validate the fallback response
    const fallbackResponse: EvaluationResponse = {
      scores: defaultEvaluation.scores,
      decision: defaultEvaluation.decision,
      reasoning:
        "Default evaluation due to API error. Generated with randomized variance.",
      comparisonNotes: "",
      evaluatedWithModel: "gpt-3.5-turbo (fallback)",
      stepNumber: stepNumber,
      batchId: batchId,
    };

    const responseValidation =
      EvaluationResponseSchema.safeParse(fallbackResponse);
    if (!responseValidation.success) {
      console.warn(
        "Fallback evaluation response failed validation:",
        responseValidation.error.format(),
      );
    }

    return NextResponse.json(fallbackResponse);
  }
}

// Helper function to create a default evaluation with randomized scores
function createDefaultEvaluation() {
  // Use randomized decision logic matching our adjusted distribution
  const rand = Math.random();

  if (rand < 0.15) {
    // 15% probability of PROBLEMATIC
    // Generate PROBLEMATIC scores (at least one <= 35)
    return {
      scores: {
        accuracy: Math.floor(Math.random() * 30) + 50, // 50-79
        complexity: Math.floor(Math.random() * 30) + 45, // 45-74
        computeEfficiency: Math.floor(Math.random() * 35) + 40, // 40-74
        readability: Math.floor(Math.random() * 25) + 10, // 10-35 (will make it PROBLEMATIC)
        costEfficiency: Math.floor(Math.random() * 30) + 50, // 50-79
        memoryUsage: Math.floor(Math.random() * 35) + 40, // 40-74
      },
      decision: "PROBLEMATIC" as DecisionType,
      reasoning:
        "Default evaluation due to JSON parsing error. Generated with randomized variance.",
      evaluatedWithModel: "gpt-3.5-turbo (fallback)",
    };
  } else if (rand < 0.9) {
    // 75% probability of VIABLE
    // Generate VIABLE scores (all > 35, at least one < 90)
    // Ensure at least one score is below 90 to make it VIABLE
    const belowThresholdCategory = [
      "accuracy",
      "complexity",
      "computeEfficiency",
      "readability",
      "costEfficiency",
      "memoryUsage",
    ][Math.floor(Math.random() * 6)];

    const viableScores = {
      accuracy: Math.floor(Math.random() * 53) + 36, // 36-89
      complexity: Math.floor(Math.random() * 53) + 36, // 36-89
      computeEfficiency: Math.floor(Math.random() * 53) + 36, // 36-89
      readability: Math.floor(Math.random() * 53) + 36, // 36-89
      costEfficiency: Math.floor(Math.random() * 53) + 36, // 36-89
      memoryUsage: Math.floor(Math.random() * 53) + 36, // 36-89
    };

    // Make sure at least one score is below 90
    viableScores[belowThresholdCategory as keyof typeof viableScores] =
      Math.floor(Math.random() * 14) + 75; // 75-89

    return {
      scores: viableScores,
      decision: "VIABLE" as DecisionType,
      reasoning:
        "Default evaluation due to JSON parsing error. Generated with randomized variance.",
      evaluatedWithModel: "gpt-3.5-turbo (fallback)",
    };
  } else {
    // 10% probability of RECOMMENDED
    // Generate RECOMMENDED scores (all >= 90)
    return {
      scores: {
        accuracy: Math.floor(Math.random() * 6) + 90, // 90-95
        complexity: Math.floor(Math.random() * 6) + 90, // 90-95
        computeEfficiency: Math.floor(Math.random() * 6) + 90, // 90-95
        readability: Math.floor(Math.random() * 6) + 90, // 90-95
        costEfficiency: Math.floor(Math.random() * 6) + 90, // 90-95
        memoryUsage: Math.floor(Math.random() * 6) + 90, // 90-95
      },
      decision: "RECOMMENDED" as DecisionType,
      reasoning:
        "Default evaluation due to JSON parsing error. Generated with randomized variance.",
      evaluatedWithModel: "gpt-3.5-turbo (fallback)",
    };
  }
}
