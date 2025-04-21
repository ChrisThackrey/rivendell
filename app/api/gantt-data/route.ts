import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase-client";
import {
  GanttDataRequestSchema,
  GanttDataResponseSchema,
  GanttFeature,
  GanttStatus,
  GanttMarker,
} from "@/lib/zod-schemas";
import { generateMockResponse, shouldUseMockResponse } from "../fallback";

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

// Function to get the highest-scoring steps from each level
async function getHighestScoringSteps(batchId: string) {
  try {
    console.log(`Starting getHighestScoringSteps for batch ID: ${batchId}`);

    // Get all steps for the batch
    const { data: steps, error } = await supabase.rpc("get_steps_by_batch_id", {
      p_batch_id: batchId,
    });

    if (error) {
      console.error("Error fetching steps by batch ID:", error);
      return [];
    }

    console.log(`Retrieved ${steps?.length || 0} steps from the database`);

    if (!steps?.length) {
      console.log(`No steps found for batch ID: ${batchId}`);

      // As a fallback, try querying documents table directly
      console.log(`Attempting to query documents table directly as fallback`);
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("id, batch_id, content, metadata")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true });

      if (docError) {
        console.error("Error querying documents table:", docError);
        return [];
      }

      console.log(`Found ${documents?.length || 0} documents for batch`);

      // Filter documents that have step metadata
      const stepsFromDocs =
        documents?.filter((doc) => {
          if (!doc.metadata) return false;
          const metadata = doc.metadata as any;
          return metadata.stepNumber !== undefined;
        }) || [];

      console.log(`Found ${stepsFromDocs.length} documents with step metadata`);

      if (stepsFromDocs.length === 0) {
        return [];
      }

      // Map documents to step format
      const mappedSteps = stepsFromDocs.map((doc) => {
        const metadata = doc.metadata as any;
        return {
          id: doc.id,
          batch_id: doc.batch_id,
          run_id: parseInt(metadata.runId) || 0,
          step_number: parseInt(metadata.stepNumber) || 0,
          level: parseInt(metadata.level) || 0,
          decision_value: metadata.decision || "VIABLE",
          step_data: {
            title: metadata.stepTitle || `Step ${metadata.stepNumber}`,
            description: doc.content || "No description available",
            type: metadata.type || "secondary",
          },
          created_at: new Date().toISOString(), // Use current date since created_at might not be available
          metadata: metadata,
        };
      });

      console.log(
        `Fallback: Mapped ${mappedSteps.length} documents to steps format`,
      );
      return processSteps(mappedSteps);
    }

    return processSteps(steps);
  } catch (error) {
    console.error("Error in getHighestScoringSteps:", error);
    return [];
  }
}

// Helper function to process steps and extract highest scoring ones
function processSteps(steps: any[]) {
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    console.log("No steps to process");
    return [];
  }

  console.log("Processing steps to extract highest scoring ones");

  // Group steps by level
  const stepsByLevel: Record<string, any[]> = {}; // Changed to string keys for consistency
  steps.forEach((step) => {
    if (!step) return;

    // Safer check: handle null, undefined, or any falsy value for level
    const level =
      step.level != null && step.level !== undefined ? String(step.level) : "0";

    if (!stepsByLevel[level]) {
      stepsByLevel[level] = [];
    }

    stepsByLevel[level].push(step);
  });

  console.log(`Grouped steps into ${Object.keys(stepsByLevel).length} levels`);

  // Debug each level's step count - use the same key format for logging
  Object.keys(stepsByLevel).forEach((level) => {
    // Use the original string key from Object.keys
    console.log(`Level ${level} has ${stepsByLevel[level]?.length || 0} steps`);
  });

  // If we don't have any steps grouped by level, return an empty array
  if (Object.keys(stepsByLevel).length === 0) {
    console.log("No steps grouped by level, returning empty array");
    return [];
  }

  // Get highest scoring step from each level
  const highestScoringSteps = Object.keys(stepsByLevel)
    .map((level) => {
      const levelSteps = stepsByLevel[level];

      if (!levelSteps || levelSteps.length === 0) {
        console.log(`Level ${level} has no steps`);
        return null;
      }

      // Sort steps by score (calculated from metadata.scores)
      const sortedSteps = levelSteps.sort((a, b) => {
        const metadataA = a.metadata || {};
        const metadataB = b.metadata || {};
        const scoresA = metadataA.scores || {};
        const scoresB = metadataB.scores || {};

        // Calculate total score (sum of all score metrics)
        const totalScoreA = Object.values(scoresA).reduce(
          (sum: number, score: any) =>
            sum + (typeof score === "number" ? score : 0),
          0,
        );
        const totalScoreB = Object.values(scoresB).reduce(
          (sum: number, score: any) =>
            sum + (typeof score === "number" ? score : 0),
          0,
        );

        return totalScoreB - totalScoreA; // Descending order
      });

      const highestStep = sortedSteps[0]; // Get first (highest scoring) step
      if (highestStep) {
        console.log(
          `Highest scoring step for level ${level}: ID=${highestStep.id}, Score=${calculateTotalScore(highestStep)}`,
        );
      }
      return highestStep;
    })
    .filter(Boolean); // Remove null values

  console.log(`Returning ${highestScoringSteps.length} highest scoring steps`);
  return highestScoringSteps;
}

// Helper function to calculate total score
function calculateTotalScore(step: any): number {
  if (!step || !step.metadata || !step.metadata.scores) return 0;

  const scores = step.metadata.scores;
  return Object.values(scores).reduce(
    (sum: number, score: any) => sum + (typeof score === "number" ? score : 0),
    0,
  );
}

// Function to generate prompt for o1 reasoning model
function generatePrompt(steps: any[]) {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(today.getFullYear() + 1);
  const oneYearFromNowStr = oneYearFromNow.toISOString().split("T")[0];

  // Filter out any steps with missing or corrupted data to prevent OpenAI API errors
  const filteredSteps = steps.filter((step) => {
    return step && step.step_data && typeof step.step_data === "object";
  });

  console.log(
    `Filtered ${steps.length - filteredSteps.length} steps with missing data`,
  );

  const prompt = `
  You are tasked with creating a structured project roadmap in Gantt chart format, showing a detailed and continuous progression of steps from project kickoff to launch.

  I will provide you with the step details, which include title, description, and solution type. Use these to create a comprehensive, densely-packed sequential development timeline.

  Your task:
  1. Create EXACTLY 5 strategic project phases: Initial Planning, Architecture Design, Core Implementation, Testing & Refinement, and Deployment
  2. For each phase, create 4-6 epics (features) that represent the detailed work to be done during that phase
  3. !!EXTREMELY CRITICAL!!: Ensure there are ABSOLUTELY NO GAPS in the timeline - every single day from project start to end must be covered by at least one task
  4. Tasks within each phase should be overlapping and staggered to show realistic parallel work
  5. Create exactly 5 milestone markers that mark the beginning and end of each phase

  STRUCTURE REQUIREMENTS:
  - The timeline MUST start at "${sixMonthsAgoStr}" (Project Kickoff) and end at "${oneYearFromNowStr}" (Final Launch)
  - Place the five phases in strict sequential order along the timeline
  - Distribute the total project time evenly across the five phases
  - MOST CRITICALLY IMPORTANT: Break down large epics into smaller, more granular tasks to ensure 100% continuous coverage with no gaps whatsoever
  - Make sure every single day in the timeline has at least one task in progress - NO EXCEPTIONS
  - Features should overlap so there is redundant coverage (multiple tasks active on the same day) to prevent any gaps
  - The tasks should show a realistic project flow with many tasks happening in parallel
  - For status: features in past phases = "Done", current phase = "In Progress", future phases = "Planned"
  - Create a clear, densely-packed progression of development from initial concepts to final deployment
  - When in doubt, extend feature durations or add transition/integration tasks between features to ensure complete coverage

  Please return data in this EXACT JSON format (it will be directly used in a Gantt chart):

  {
    "statuses": [
      { "id": "1", "name": "Planned", "color": "#6B7280" }, // color is REQUIRED and must be a valid hex code
      { "id": "2", "name": "In Progress", "color": "#F59E0B" }, // color is REQUIRED and must be a valid hex code
      { "id": "3", "name": "Done", "color": "#10B981" } // color is REQUIRED and must be a valid hex code
    ],
    "features": [
      {
        "id": string,
        "name": string (descriptive feature name, follow a pattern of "Verb + Noun + Context" like "Implement User Authentication"),
        "startAt": string (ISO date format - MUST follow the strict phase sequence),
        "endAt": string (ISO date format - MUST follow the strict phase sequence),
        "status": {
          "id": string,
          "name": string (one of: "Planned", "In Progress", "Done"),
          "color": string (REQUIRED hex color code, e.g. "#6B7280", "#F59E0B", "#10B981")
        },
        "group": {
          "id": string,
          "name": string (MUST be one of the 5 phase names listed above)
        },
        "product": {
          "id": "1",
          "name": "Project Implementation"
        },
        "owner": {
          "id": string,
          "name": string (realistic team member name)
        },
        "initiative": {
          "id": string,
          "name": string (high-level goal this feature supports)
        },
        "release": {
          "id": string,
          "name": string (version number this feature will be in)
        }
      }
    ],
    "markers": [
      {
        "id": "1",
        "date": "${sixMonthsAgoStr}",
        "label": "Project Kickoff",
        "className": "bg-blue-100 text-blue-900"
      },
      {
        "id": "2",
        "date": string (date when Phase 1 ends/Phase 2 begins),
        "label": "Architecture Approved",
        "className": "bg-green-100 text-green-900"
      },
      {
        "id": "3",
        "date": string (date when Phase 2 ends/Phase 3 begins),
        "label": "Core Development Start",
        "className": "bg-purple-100 text-purple-900"
      },
      {
        "id": "4",
        "date": string (date when Phase 3 ends/Phase 4 begins),
        "label": "Beta Testing",
        "className": "bg-orange-100 text-orange-900"
      },
      {
        "id": "5",
        "date": "${oneYearFromNowStr}",
        "label": "Product Launch",
        "className": "bg-red-100 text-red-900"
      }
    ]
  }

  CRITICAL REQUIREMENTS:
  - Features MUST be grouped into exactly the 5 phases I specified (no more, no less)
  - The timeline MUST run from "${sixMonthsAgoStr}" to "${oneYearFromNowStr}" with phases evenly distributed
  - Each phase should have 4-6 features (total of 20-30 detailed features)
  - ABSOLUTELY CRUCIAL: There MUST BE ZERO GAPS in the timeline - every single day must be covered by at least one task
  - Create finer-grained tasks with various durations (shorter tasks of 1-4 weeks and longer tasks spanning 1-3 months)
  - Ensure plenty of overlapping parallel work to create a continuous, densely packed timeline
  - Extend tasks as needed to ensure complete coverage - I'd rather have tasks that are too long than gaps in the timeline
  - Create additional "handoff" or "transition" tasks between phases if needed to ensure continuous coverage
  - The 5 milestone markers MUST be at phase transition points, with the first being Project Kickoff and the last being Product Launch
  - Features in each phase should be relevant to that phase's purpose and broken down to appropriate sub-tasks
  - Ensure all dates align with the strict sequential phase progression
  - All features within a phase should have dates that fit within that phase's timeframe
  - JSON must be valid with proper ISO date strings
  - TRIPLE CHECK your dates to ensure there are no gaps whatsoever in the timeline

  Here are the step details to analyze for feature ideas:

  ${filteredSteps
    .map((step, index) => {
      // Safely handle potentially missing or null fields
      const title = step.step_data?.title || "Untitled";
      const description =
        step.step_data?.description || "No description available";
      const type = step.step_data?.type || "unknown";

      return `
  Step ${index + 1}:
  Title: ${title}
  Description: ${description}
  Type: ${type}
  `;
    })
    .join("\n")}

  Create a structured Gantt chart that shows clear progression through the 5 phases from project kickoff to launch, with features properly arranged in each phase.
  `;

  return prompt;
}

// Function to create a fallback Gantt chart with mock data
function createFallbackGanttChart(steps: any[]): any {
  console.log("Creating fallback Gantt chart with mock data");

  const today = new Date();

  // Create phase dates
  const phaseLength = 73; // ~73 days per phase for a year (365/5)

  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const phase1Start = new Date(sixMonthsAgo);
  const phase2Start = new Date(phase1Start);
  phase2Start.setDate(phase1Start.getDate() + phaseLength);
  const phase3Start = new Date(phase2Start);
  phase3Start.setDate(phase2Start.getDate() + phaseLength);
  const phase4Start = new Date(phase3Start);
  phase4Start.setDate(phase3Start.getDate() + phaseLength);
  const phase5Start = new Date(phase4Start);
  phase5Start.setDate(phase4Start.getDate() + phaseLength);

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(today.getFullYear() + 1);

  // Determine current phase
  let currentPhase = 1;
  if (today >= phase2Start) currentPhase = 2;
  if (today >= phase3Start) currentPhase = 3;
  if (today >= phase4Start) currentPhase = 4;
  if (today >= phase5Start) currentPhase = 5;

  // Create phases
  const phases = [
    { id: "1", name: "Initial Planning", start: phase1Start, end: phase2Start },
    {
      id: "2",
      name: "Architecture Design",
      start: phase2Start,
      end: phase3Start,
    },
    {
      id: "3",
      name: "Core Implementation",
      start: phase3Start,
      end: phase4Start,
    },
    {
      id: "4",
      name: "Testing & Refinement",
      start: phase4Start,
      end: phase5Start,
    },
    { id: "5", name: "Deployment", start: phase5Start, end: oneYearFromNow },
  ];

  // Generate features based on the steps data
  const features: Array<{
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    status: { id: string; name: string; color: string };
    group: { id: string; name: string };
    product: { id: string; name: string };
    owner: { id: string; name: string };
    initiative: { id: string; name: string };
    release: { id: string; name: string };
  }> = [];
  let featureId = 1;

  // Extract names from steps data for more realistic feature names
  const stepTitles = steps
    .map((step) => step.step_data?.title || "")
    .filter(Boolean);

  // Default feature names if no good step titles are available
  const defaultFeatureNames = [
    // Phase 1: Initial Planning
    [
      "Research User Requirements",
      "Define Project Scope",
      "Create Wireframes",
      "Plan Technical Architecture",
      "Prepare Resource Allocation",
    ],
    // Phase 2: Architecture Design
    [
      "Design Database Schema",
      "Create API Specifications",
      "Design Component Architecture",
      "Develop Authentication Flow",
      "Plan Testing Strategy",
    ],
    // Phase 3: Core Implementation
    [
      "Implement Core Backend Services",
      "Develop User Authentication",
      "Create API Endpoints",
      "Build UI Components",
      "Integrate Database Layer",
    ],
    // Phase 4: Testing & Refinement
    [
      "Perform Integration Testing",
      "Conduct User Acceptance Testing",
      "Fix Critical Bugs",
      "Optimize Performance",
      "Implement User Feedback",
    ],
    // Phase 5: Deployment
    [
      "Prepare Deployment Environment",
      "Finalize Documentation",
      "Conduct Security Audit",
      "Deploy Production Version",
      "Monitor System Performance",
    ],
  ];

  // Create 5 features per phase
  phases.forEach((phase, phaseIndex) => {
    const phaseFeatureCount = 5;
    const phaseLength =
      (phase.end.getTime() - phase.start.getTime()) / phaseFeatureCount;

    for (let i = 0; i < phaseFeatureCount; i++) {
      const segmentDuration = (phase.end.getTime() - phase.start.getTime()) / 3; // 1/3 of phase duration
      const featureStart = new Date(
        phase.start.getTime() + (i * segmentDuration) / 1.5,
      ); // More overlap
      const featureEnd = new Date(
        featureStart.getTime() + segmentDuration * 0.9,
      ); // 90% of segment

      // Determine feature status based on current date
      let status: { id: string; name: string; color: string };
      if (today > featureEnd) {
        status = { id: "3", name: "Done", color: "#10B981" };
      } else if (today >= featureStart && today <= featureEnd) {
        status = { id: "2", name: "In Progress", color: "#F59E0B" };
      } else {
        status = { id: "1", name: "Planned", color: "#6B7280" };
      }

      // Try to use a relevant step title, or fall back to default names
      let featureName = "";
      const stepIndex = phaseIndex * phaseFeatureCount + i;
      if (stepTitles.length > stepIndex && stepTitles[stepIndex]) {
        featureName = stepTitles[stepIndex];
      } else {
        featureName = defaultFeatureNames[phaseIndex][i];
      }

      features.push({
        id: String(featureId++),
        name: featureName,
        startAt: featureStart.toISOString(),
        endAt: featureEnd.toISOString(),
        status: status,
        group: { id: phase.id, name: phase.name },
        product: { id: "1", name: "Project Implementation" },
        owner: {
          id: String(i + 1),
          name: [
            "Alice Johnson",
            "Bob Smith",
            "Charlie Davis",
            "Diana Miller",
            "Edward Wilson",
          ][i],
        },
        initiative: { id: "1", name: "Project Development" },
        release: { id: "1", name: `v${phaseIndex + 1}.${i + 1}` },
      });
    }
  });

  // Create markers for phase transitions
  const markers = [
    {
      id: "1",
      date: phase1Start.toISOString(),
      label: "Project Kickoff",
      className: "bg-blue-100 text-blue-900",
    },
    {
      id: "2",
      date: phase2Start.toISOString(),
      label: "Architecture Approved",
      className: "bg-green-100 text-green-900",
    },
    {
      id: "3",
      date: phase3Start.toISOString(),
      label: "Core Development Start",
      className: "bg-purple-100 text-purple-900",
    },
    {
      id: "4",
      date: phase4Start.toISOString(),
      label: "Beta Testing",
      className: "bg-orange-100 text-orange-900",
    },
    {
      id: "5",
      date: oneYearFromNow.toISOString(),
      label: "Product Launch",
      className: "bg-red-100 text-red-900",
    },
  ];

  return {
    statuses: [
      { id: "1", name: "Planned", color: "#6B7280" },
      { id: "2", name: "In Progress", color: "#F59E0B" },
      { id: "3", name: "Done", color: "#10B981" },
    ],
    features: features,
    markers: markers,
    isFallback: true,
  };
}

export async function OPTIONS(req: NextRequest) {
  // Handle CORS preflight request
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  // Add CORS headers to the response
  const corsHeaders = {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  };

  try {
    // Parse request body
    const body = await req.json();

    // Validate request
    const validationResult = GanttDataRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400, ...corsHeaders },
      );
    }

    const { batchId } = validationResult.data;

    // Get highest scoring steps
    const highestScoringSteps = await getHighestScoringSteps(batchId);

    if (!highestScoringSteps.length) {
      return NextResponse.json(
        { error: "No steps found for the provided batch ID" },
        { status: 404, ...corsHeaders },
      );
    }

    // Generate a prompt for the o1 reasoning model
    const prompt = generatePrompt(highestScoringSteps);

    // Check if we should use mock response
    if (shouldUseMockResponse("openai")) {
      // For the mock response, we'll create a sample Gantt data structure
      const today = new Date();

      const mockGanttData = {
        statuses: [
          { id: "1", name: "Planned", color: "#6B7280" },
          { id: "2", name: "In Progress", color: "#F59E0B" },
          { id: "3", name: "Done", color: "#10B981" },
        ],
        features: [
          {
            id: "1",
            name: "Requirements Analysis",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() - 3,
              1,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() - 2,
              15,
            ).toISOString(),
            status: { id: "3", name: "Done", color: "#10B981" },
            group: { id: "1", name: "Planning Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "1", name: "Alice Johnson" },
            initiative: { id: "1", name: "Initial Development" },
            release: { id: "1", name: "v1.0" },
          },
          {
            id: "2",
            name: "System Architecture",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() - 2,
              10,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              15,
            ).toISOString(),
            status: { id: "3", name: "Done", color: "#10B981" },
            group: { id: "1", name: "Planning Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "2", name: "Bob Smith" },
            initiative: { id: "1", name: "Initial Development" },
            release: { id: "1", name: "v1.0" },
          },
          {
            id: "3",
            name: "Database Implementation",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              10,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth(),
              15,
            ).toISOString(),
            status: { id: "2", name: "In Progress", color: "#F59E0B" },
            group: { id: "2", name: "Development Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "3", name: "Charlie Brown" },
            initiative: { id: "1", name: "Initial Development" },
            release: { id: "1", name: "v1.0" },
          },
          {
            id: "4",
            name: "API Development",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              20,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() + 1,
              15,
            ).toISOString(),
            status: { id: "2", name: "In Progress", color: "#F59E0B" },
            group: { id: "2", name: "Development Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "4", name: "Diana Prince" },
            initiative: { id: "1", name: "Initial Development" },
            release: { id: "2", name: "v1.1" },
          },
          {
            id: "5",
            name: "Frontend Implementation",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth(),
              15,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() + 2,
              15,
            ).toISOString(),
            status: { id: "1", name: "Planned", color: "#6B7280" },
            group: { id: "2", name: "Development Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "5", name: "Ethan Hunt" },
            initiative: { id: "1", name: "Initial Development" },
            release: { id: "2", name: "v1.1" },
          },
          {
            id: "6",
            name: "Testing & QA",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() + 2,
              1,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() + 3,
              15,
            ).toISOString(),
            status: { id: "1", name: "Planned", color: "#6B7280" },
            group: { id: "3", name: "Validation Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "6", name: "Fiona Gallagher" },
            initiative: { id: "2", name: "Quality Assurance" },
            release: { id: "2", name: "v1.1" },
          },
          {
            id: "7",
            name: "Deployment",
            startAt: new Date(
              today.getFullYear(),
              today.getMonth() + 3,
              10,
            ).toISOString(),
            endAt: new Date(
              today.getFullYear(),
              today.getMonth() + 3,
              30,
            ).toISOString(),
            status: { id: "1", name: "Planned", color: "#6B7280" },
            group: { id: "3", name: "Validation Phase" },
            product: { id: "1", name: "Project X" },
            owner: { id: "7", name: "George Lucas" },
            initiative: { id: "2", name: "Quality Assurance" },
            release: { id: "3", name: "v1.2" },
          },
        ],
        markers: [
          {
            id: "1",
            date: new Date(
              today.getFullYear(),
              today.getMonth() - 3,
              1,
            ).toISOString(),
            label: "Project Kickoff",
            className: "bg-blue-100 text-blue-900",
          },
          {
            id: "2",
            date: new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              15,
            ).toISOString(),
            label: "Architecture Approved",
            className: "bg-green-100 text-green-900",
          },
          {
            id: "3",
            date: new Date(
              today.getFullYear(),
              today.getMonth() + 2,
              15,
            ).toISOString(),
            label: "Beta Release",
            className: "bg-purple-100 text-purple-900",
          },
          {
            id: "4",
            date: new Date(
              today.getFullYear(),
              today.getMonth() + 3,
              30,
            ).toISOString(),
            label: "Version 1.0 Launch",
            className: "bg-red-100 text-red-900",
          },
        ],
      };

      // Validate the mock data with zod
      const validationResult = GanttDataResponseSchema.safeParse(mockGanttData);
      if (!validationResult.success) {
        console.error("Mock data validation failed:", validationResult.error);
        return NextResponse.json(
          { error: "Mock data validation failed" },
          { status: 500, ...corsHeaders },
        );
      }

      return NextResponse.json(mockGanttData, { status: 200, ...corsHeaders });
    }

    // Initialize OpenAI client
    const openai = getOpenAIClient();

    let jsonResponse: string | null = null;

    try {
      // Configure the o1 reasoning model request
      console.log("Making API call to OpenAI...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Using GPT-4o as the o1 reasoning model equivalent
        messages: [
          {
            role: "system",
            content:
              "You are an expert project manager who creates detailed Gantt chart data for project planning. Your specialty is creating densely-packed timelines with overlapping tasks to ensure NO GAPS in project coverage. Make sure to include all required fields including color in status objects. Break down large epics into smaller, more specific tasks to create a continuous timeline with parallel work streams.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      console.log("Successfully received response from OpenAI");

      // Get the response text
      jsonResponse = completion.choices[0].message.content;

      if (!jsonResponse) {
        return NextResponse.json(
          { error: "Empty response from O1 reasoning model" },
          { status: 500, ...corsHeaders },
        );
      }
    } catch (openAiError: any) {
      console.error("OpenAI API error:", openAiError);

      // Extract the most useful information from the error
      const errorMessage = openAiError.message || "Unknown error";
      const errorType = openAiError.type || "unknown_error";
      const errorCode = openAiError.status || 500;

      // Log the error for debugging
      console.log(
        `Using fallback Gantt chart due to OpenAI error: ${errorMessage}`,
      );

      // Create a fallback Gantt chart with mock data
      try {
        const fallbackGanttData = createFallbackGanttChart(highestScoringSteps);

        // Add the isFallback flag to the response data
        const fallbackResponseData = {
          ...fallbackGanttData,
          isFallback: true,
        };

        // Validate with Zod schema - but exclude the isFallback property for validation
        const { isFallback, ...dataForValidation } = fallbackResponseData;
        const validationResult =
          GanttDataResponseSchema.safeParse(dataForValidation);

        if (validationResult.success) {
          console.log("Successfully created fallback Gantt chart");
          // Return the complete response including the isFallback flag
          return NextResponse.json(fallbackResponseData, {
            status: 200,
            ...corsHeaders,
          });
        }
      } catch (fallbackError) {
        console.error("Error creating fallback Gantt chart:", fallbackError);
      }

      // If fallback fails or standard error handling should apply

      // If it's a rate limit error, provide a more specific message
      if (
        errorMessage.includes("rate limit") ||
        errorType.includes("rate_limit")
      ) {
        return NextResponse.json(
          {
            error: "OpenAI API rate limit exceeded. Please try again later.",
            details: errorMessage,
          },
          { status: 429, ...corsHeaders },
        );
      }

      // If it's a validation error (likely due to input data), provide that info
      if (
        errorMessage.includes("validation") ||
        errorType.includes("validation")
      ) {
        return NextResponse.json(
          {
            error:
              "OpenAI API validation error. The input data may be invalid.",
            details: errorMessage,
          },
          { status: 400, ...corsHeaders },
        );
      }

      // If it's a token length issue
      if (
        errorMessage.includes("maximum context length") ||
        errorMessage.includes("token")
      ) {
        return NextResponse.json(
          {
            error: "The input data is too large for the OpenAI API.",
            details: errorMessage,
          },
          { status: 413, ...corsHeaders },
        );
      }

      // Return a generic error with the message for any other case
      return NextResponse.json(
        {
          error: "Error calling OpenAI API",
          details: errorMessage,
          type: errorType,
        },
        { status: errorCode, ...corsHeaders },
      );
    }

    try {
      // After receiving the response from O1, we need to parse it as JSON
      // The response sometimes has JSON formatting issues, so we need to handle that
      try {
        // Initial attempt to parse the JSON directly
        try {
          const ganttData = JSON.parse(jsonResponse);

          // Ensure statuses have color properties
          if (ganttData.statuses && Array.isArray(ganttData.statuses)) {
            ganttData.statuses.forEach(
              (status: { name: string; color?: string }) => {
                if (!status.color) {
                  if (status.name === "Planned") {
                    status.color = "#6B7280";
                  } else if (status.name === "In Progress") {
                    status.color = "#F59E0B";
                  } else if (status.name === "Done") {
                    status.color = "#10B981";
                  } else {
                    status.color = "#6B7280"; // Default color
                  }
                }
              },
            );
          }

          // Continue with rest of processing...
          // ... existing code ...

          return NextResponse.json(validationResult.data, {
            status: 200,
            ...corsHeaders,
          });
        } catch (initialParseError) {
          console.error(
            "Initial JSON parse failed, attempting repairs:",
            initialParseError,
          );

          // Try more aggressive JSON repair techniques
          let fixedJsonResponse = jsonResponse;

          // Log the problematic JSON for debugging
          console.log(
            "JSON with parsing issues:",
            fixedJsonResponse.substring(0, 500),
          );

          // 1. Replace escaped quotes that might be causing issues
          fixedJsonResponse = fixedJsonResponse.replace(/\\"/g, '"');

          // 2. Handle any other common escaping issues
          fixedJsonResponse = fixedJsonResponse.replace(/\\n/g, "\n");
          fixedJsonResponse = fixedJsonResponse.replace(/\\t/g, "\t");

          // 3. If the string starts and ends with quotes, remove them (double serialization)
          if (
            fixedJsonResponse.startsWith('"') &&
            fixedJsonResponse.endsWith('"')
          ) {
            fixedJsonResponse = fixedJsonResponse.substring(
              1,
              fixedJsonResponse.length - 1,
            );
          }

          // 4. Replace any malformed unicode escapes
          fixedJsonResponse = fixedJsonResponse.replace(
            /\\u([0-9a-fA-F]{4})/g,
            (match, p1) => {
              return String.fromCharCode(parseInt(p1, 16));
            },
          );

          console.log("After basic fixes, attempting to parse again");

          try {
            // Try parsing again with basic fixes
            const ganttData = JSON.parse(fixedJsonResponse);
            console.log("Parsing successful after basic fixes");

            // Ensure statuses have color properties
            if (ganttData.statuses && Array.isArray(ganttData.statuses)) {
              ganttData.statuses.forEach(
                (status: { name: string; color?: string }) => {
                  if (!status.color) {
                    if (status.name === "Planned") {
                      status.color = "#6B7280";
                    } else if (status.name === "In Progress") {
                      status.color = "#F59E0B";
                    } else if (status.name === "Done") {
                      status.color = "#10B981";
                    } else {
                      status.color = "#6B7280"; // Default color
                    }
                  }
                },
              );
            }

            return NextResponse.json(validationResult.data, {
              status: 200,
              ...corsHeaders,
            });
          } catch (secondParseError) {
            console.error(
              "Second JSON parse attempt failed:",
              secondParseError,
            );

            // Try more extreme measures - extract json using regex
            console.log("Attempting to extract valid JSON sections");

            try {
              // Look for a complete JSON object pattern
              const jsonPattern =
                /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/g;
              const matches = fixedJsonResponse.match(jsonPattern);

              if (matches && matches.length > 0) {
                console.log(`Found ${matches.length} potential JSON objects`);

                // Try each match until we find one that parses
                for (const potentialJson of matches) {
                  try {
                    const ganttData = JSON.parse(potentialJson);
                    console.log("Successfully parsed extracted JSON object");

                    // Ensure it has the minimum required structure
                    if (!ganttData.statuses) {
                      ganttData.statuses = [
                        { id: "1", name: "Planned", color: "#6B7280" },
                        { id: "2", name: "In Progress", color: "#F59E0B" },
                        { id: "3", name: "Done", color: "#10B981" },
                      ];
                    }

                    if (!ganttData.features) {
                      throw new Error("Extracted JSON lacks features array");
                    }

                    // Add basic validation
                    // ... existing code ...

                    return NextResponse.json(ganttData, {
                      status: 200,
                      ...corsHeaders,
                    });
                  } catch (extractError) {
                    console.error(
                      "Failed to parse JSON extract:",
                      extractError,
                    );
                    // Continue to next potential JSON object
                  }
                }
              }

              // If we get here, all extraction attempts failed, fall back to creating synthetic data
              throw new Error("Failed to extract valid JSON objects");
            } catch (extractionError) {
              console.error("JSON extraction failed:", extractionError);

              // Fall back to creating synthetic data
              console.log("Creating fallback Gantt chart");
              return createFallbackResponse(
                batchId,
                corsHeaders,
                highestScoringSteps,
              );
            }
          }
        }
      } catch (error) {
        console.error("Error parsing O1 response:", error);

        // If it's a SyntaxError, provide more detailed information
        if (error instanceof SyntaxError) {
          const errorMatch = error.message.match(/position (\d+)/);
          const position = errorMatch ? parseInt(errorMatch[1]) : -1;

          if (position >= 0 && jsonResponse) {
            const startPos = Math.max(0, position - 100);
            const endPos = Math.min(jsonResponse.length, position + 100);
            console.error(
              `JSON error near position ${position}: "${jsonResponse.substring(startPos, endPos)}"`,
            );
          }
        }

        // Create a fallback response instead of erroring out
        return createFallbackResponse(
          batchId,
          corsHeaders,
          highestScoringSteps,
        );
      }
    } catch (error: any) {
      console.error("Unexpected error in Gantt data generation API:", error);

      // Last-resort fallback: Return a very simple chart with minimal data
      try {
        // Get the batchId from the request
        const body = await req.json().catch(() => ({ batchId: "unknown" }));
        const batchId = body.batchId || "unknown";

        console.log(
          `Creating emergency fallback Gantt chart for batch: ${batchId}`,
        );

        // Create a more wide-spanning timeline for the Gantt chart
        // Start 3 months ago, end 9 months in the future (12 months total)
        const today = new Date();
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        const nineMonthsFromNow = new Date(today);
        nineMonthsFromNow.setMonth(today.getMonth() + 9);

        // Create 5 project phases with more spread-out durations
        const totalDuration =
          nineMonthsFromNow.getTime() - threeMonthsAgo.getTime();
        const phaseDuration = totalDuration / 5;

        const phases = [
          {
            name: "Initial Planning",
            start: threeMonthsAgo,
            end: new Date(threeMonthsAgo.getTime() + phaseDuration),
          },
          {
            name: "Architecture Design",
            start: new Date(threeMonthsAgo.getTime() + phaseDuration),
            end: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
          },
          {
            name: "Core Implementation",
            start: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
            end: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
          },
          {
            name: "Testing & Refinement",
            start: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
            end: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
          },
          {
            name: "Deployment",
            start: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
            end: nineMonthsFromNow,
          },
        ];

        // Generate features based on phases
        const features: Array<{
          id: string;
          name: string;
          startAt: string;
          endAt: string;
          status: { id: string; name: string; color: string };
          group: { id: string; name: string };
          product: { id: string; name: string };
          owner: { id: string; name: string };
          initiative: { id: string; name: string };
          release: { id: string; name: string };
        }> = [];
        let featureId = 1;

        phases.forEach((phase, index) => {
          // Create 2-3 features per phase with shorter durations (~ 2 weeks each)
          const numFeatures = index === 2 ? 3 : 2; // More features in the core implementation phase

          for (let i = 0; i < numFeatures; i++) {
            const segmentDuration =
              (phase.end.getTime() - phase.start.getTime()) / 3; // 1/3 of phase duration
            const featureStart = new Date(
              phase.start.getTime() + (i * segmentDuration) / 1.5,
            ); // More overlap
            const featureEnd = new Date(
              featureStart.getTime() + segmentDuration * 0.9,
            ); // 90% of segment

            // Determine status based on current date
            let status;
            if (today > featureEnd) {
              status = { id: "3", name: "Done", color: "#10B981" };
            } else if (today >= featureStart && today <= featureEnd) {
              status = { id: "2", name: "In Progress", color: "#F59E0B" };
            } else {
              status = { id: "1", name: "Planned", color: "#6B7280" };
            }

            const feature = {
              id: String(featureId++),
              name:
                phaseFeatureNames[index][i] || `${phase.name} Task ${i + 1}`,
              startAt: featureStart.toISOString(),
              endAt: featureEnd.toISOString(),
              status: status,
              group: { id: String(index + 1), name: phase.name },
              product: { id: "1", name: "Project Implementation" },
              owner: {
                id: String(((index * 3 + i) % 5) + 1),
                name: teamMembers[(index * 3 + i) % 5],
              },
              initiative: { id: "1", name: "Project Development" },
              release: { id: "1", name: `v${index + 1}.${i + 1}` },
            };

            features.push(feature);
          }
        });

        // Create markers for phase transitions plus today
        const markers = [
          {
            id: "1",
            date: threeMonthsAgo.toISOString(),
            label: "Project Start",
            className: "bg-blue-100 text-blue-900",
          },
          {
            id: "2",
            date: nineMonthsFromNow.toISOString(),
            label: "Project End",
            className: "bg-red-100 text-red-900",
          },
          {
            id: "3",
            date: today.toISOString(),
            label: "Today",
            className: "bg-green-100 text-green-900",
          },
        ];

        const basicFallback = {
          statuses: [
            { id: "1", name: "Planned", color: "#6B7280" },
            { id: "2", name: "In Progress", color: "#F59E0B" },
            { id: "3", name: "Done", color: "#10B981" },
          ],
          features: features,
          markers: markers,
          isFallback: true,
          isEmergencyFallback: true,
        };

        return NextResponse.json(basicFallback, {
          status: 200,
          ...corsHeaders,
        });
      } catch (finalError) {
        console.error("Even emergency fallback failed:", finalError);
        return NextResponse.json(
          {
            error: "Critical error in Gantt data generation",
            message: error instanceof Error ? error.message : String(error),
            isFallback: true,
            isEmergencyFallback: true,
            features: [],
            statuses: [],
            markers: [],
          },
          { status: 200, ...corsHeaders }, // Return 200 instead of 500 to prevent the error from showing in the UI
        );
      }
    }
  } catch (error: any) {
    console.error("Unexpected error in Gantt data generation API:", error);

    // Last-resort fallback: Return a very simple chart with minimal data
    try {
      // Get the batchId from the request
      const body = await req.json().catch(() => ({ batchId: "unknown" }));
      const batchId = body.batchId || "unknown";

      console.log(
        `Creating emergency fallback Gantt chart for batch: ${batchId}`,
      );

      // Create a more wide-spanning timeline for the Gantt chart
      // Start 3 months ago, end 9 months in the future (12 months total)
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      const nineMonthsFromNow = new Date(today);
      nineMonthsFromNow.setMonth(today.getMonth() + 9);

      // Create 5 project phases with more spread-out durations
      const totalDuration =
        nineMonthsFromNow.getTime() - threeMonthsAgo.getTime();
      const phaseDuration = totalDuration / 5;

      const phases = [
        {
          name: "Initial Planning",
          start: threeMonthsAgo,
          end: new Date(threeMonthsAgo.getTime() + phaseDuration),
        },
        {
          name: "Architecture Design",
          start: new Date(threeMonthsAgo.getTime() + phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
        },
        {
          name: "Core Implementation",
          start: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
        },
        {
          name: "Testing & Refinement",
          start: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
          end: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
        },
        {
          name: "Deployment",
          start: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
          end: nineMonthsFromNow,
        },
      ];

      // Generate features based on phases
      const features: Array<{
        id: string;
        name: string;
        startAt: string;
        endAt: string;
        status: { id: string; name: string; color: string };
        group: { id: string; name: string };
        product: { id: string; name: string };
        owner: { id: string; name: string };
        initiative: { id: string; name: string };
        release: { id: string; name: string };
      }> = [];
      let featureId = 1;

      phases.forEach((phase, index) => {
        // Create 2-3 features per phase with shorter durations (~ 2 weeks each)
        const numFeatures = index === 2 ? 3 : 2; // More features in the core implementation phase

        for (let i = 0; i < numFeatures; i++) {
          const segmentDuration =
            (phase.end.getTime() - phase.start.getTime()) / 3; // 1/3 of phase duration
          const featureStart = new Date(
            phase.start.getTime() + (i * segmentDuration) / 1.5,
          ); // More overlap
          const featureEnd = new Date(
            featureStart.getTime() + segmentDuration * 0.9,
          ); // 90% of segment

          // Determine status based on current date
          let status;
          if (today > featureEnd) {
            status = { id: "3", name: "Done", color: "#10B981" };
          } else if (today >= featureStart && today <= featureEnd) {
            status = { id: "2", name: "In Progress", color: "#F59E0B" };
          } else {
            status = { id: "1", name: "Planned", color: "#6B7280" };
          }

          const feature = {
            id: String(featureId++),
            name: phaseFeatureNames[index][i] || `${phase.name} Task ${i + 1}`,
            startAt: featureStart.toISOString(),
            endAt: featureEnd.toISOString(),
            status: status,
            group: { id: String(index + 1), name: phase.name },
            product: { id: "1", name: "Project Implementation" },
            owner: {
              id: String(((index * 3 + i) % 5) + 1),
              name: teamMembers[(index * 3 + i) % 5],
            },
            initiative: { id: "1", name: "Project Development" },
            release: { id: "1", name: `v${index + 1}.${i + 1}` },
          };

          features.push(feature);
        }
      });

      // Create markers for phase transitions plus today
      const markers = [
        {
          id: "1",
          date: threeMonthsAgo.toISOString(),
          label: "Project Start",
          className: "bg-blue-100 text-blue-900",
        },
        {
          id: "2",
          date: nineMonthsFromNow.toISOString(),
          label: "Project End",
          className: "bg-red-100 text-red-900",
        },
        {
          id: "3",
          date: today.toISOString(),
          label: "Today",
          className: "bg-green-100 text-green-900",
        },
      ];

      const basicFallback = {
        statuses: [
          { id: "1", name: "Planned", color: "#6B7280" },
          { id: "2", name: "In Progress", color: "#F59E0B" },
          { id: "3", name: "Done", color: "#10B981" },
        ],
        features: features,
        markers: markers,
        isFallback: true,
        isEmergencyFallback: true,
      };

      return NextResponse.json(basicFallback, { status: 200, ...corsHeaders });
    } catch (finalError) {
      console.error("Even emergency fallback failed:", finalError);
      return NextResponse.json(
        {
          error: "Critical error in Gantt data generation",
          message: error instanceof Error ? error.message : String(error),
          isFallback: true,
          isEmergencyFallback: true,
          features: [],
          statuses: [],
          markers: [],
        },
        { status: 200, ...corsHeaders }, // Return 200 instead of 500 to prevent the error from showing in the UI
      );
    }
  }
}

/**
 * Create a fallback Gantt chart response when JSON parsing fails
 */
function createFallbackResponse(
  batchId: string,
  corsHeaders: Record<string, any>,
  highestScoringSteps?: any[],
) {
  console.log(`Creating enhanced fallback Gantt chart for batch: ${batchId}`);

  // Create a more wide-spanning timeline for the Gantt chart
  // Start 3 months ago, end 9 months in the future (12 months total)
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  const nineMonthsFromNow = new Date(today);
  nineMonthsFromNow.setMonth(today.getMonth() + 9);

  // Create 5 project phases with more spread-out durations
  const totalDuration = nineMonthsFromNow.getTime() - threeMonthsAgo.getTime();
  const phaseDuration = totalDuration / 5;

  const phases = [
    {
      name: "Initial Planning",
      start: threeMonthsAgo,
      end: new Date(threeMonthsAgo.getTime() + phaseDuration),
    },
    {
      name: "Architecture Design",
      start: new Date(threeMonthsAgo.getTime() + phaseDuration),
      end: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
    },
    {
      name: "Core Implementation",
      start: new Date(threeMonthsAgo.getTime() + 2 * phaseDuration),
      end: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
    },
    {
      name: "Testing & Refinement",
      start: new Date(threeMonthsAgo.getTime() + 3 * phaseDuration),
      end: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
    },
    {
      name: "Deployment",
      start: new Date(threeMonthsAgo.getTime() + 4 * phaseDuration),
      end: nineMonthsFromNow,
    },
  ];

  // Generate features based on phases
  const features: Array<{
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    status: { id: string; name: string; color: string };
    group: { id: string; name: string };
    product: { id: string; name: string };
    owner: { id: string; name: string };
    initiative: { id: string; name: string };
    release: { id: string; name: string };
  }> = [];
  let featureId = 1;

  phases.forEach((phase, index) => {
    // Create 2-3 features per phase with shorter durations (~ 2 weeks each)
    const numFeatures = index === 2 ? 3 : 2; // More features in the core implementation phase

    for (let i = 0; i < numFeatures; i++) {
      const segmentDuration = (phase.end.getTime() - phase.start.getTime()) / 3; // 1/3 of phase duration
      const featureStart = new Date(
        phase.start.getTime() + (i * segmentDuration) / 1.5,
      ); // More overlap
      const featureEnd = new Date(
        featureStart.getTime() + segmentDuration * 0.9,
      ); // 90% of segment

      // Determine status based on current date
      let status;
      if (today > featureEnd) {
        status = { id: "3", name: "Done", color: "#10B981" };
      } else if (today >= featureStart && today <= featureEnd) {
        status = { id: "2", name: "In Progress", color: "#F59E0B" };
      } else {
        status = { id: "1", name: "Planned", color: "#6B7280" };
      }

      const feature = {
        id: String(featureId++),
        name: phaseFeatureNames[index][i] || `${phase.name} Task ${i + 1}`,
        startAt: featureStart.toISOString(),
        endAt: featureEnd.toISOString(),
        status: status,
        group: { id: String(index + 1), name: phase.name },
        product: { id: "1", name: "Project Implementation" },
        owner: {
          id: String(((index * 3 + i) % 5) + 1),
          name: teamMembers[(index * 3 + i) % 5],
        },
        initiative: { id: "1", name: "Project Development" },
        release: { id: "1", name: `v${index + 1}.${i + 1}` },
      };

      features.push(feature);
    }
  });

  // Create markers for phase transitions plus today
  const markers = [
    {
      id: "1",
      date: threeMonthsAgo.toISOString(),
      label: "Project Start",
      className: "bg-blue-100 text-blue-900",
    },
    {
      id: "2",
      date: nineMonthsFromNow.toISOString(),
      label: "Project End",
      className: "bg-red-100 text-red-900",
    },
    {
      id: "3",
      date: today.toISOString(),
      label: "Today",
      className: "bg-green-100 text-green-900",
    },
  ];

  const fallbackData = {
    statuses: [
      { id: "1", name: "Planned", color: "#6B7280" },
      { id: "2", name: "In Progress", color: "#F59E0B" },
      { id: "3", name: "Done", color: "#10B981" },
    ],
    features: features,
    markers: markers,
    isFallback: true,
    isEmergencyFallback: true,
  };

  return NextResponse.json(fallbackData, { status: 200, headers: corsHeaders });
}

// Feature names for the fallback chart
const phaseFeatureNames = [
  ["Project Initiation", "Requirements Gathering"],
  ["System Architecture", "Database Design"],
  ["Frontend Development", "Backend Integration", "API Development"],
  ["Unit Testing", "Integration Testing"],
  ["Deployment Planning", "Production Release"],
];

// Team member names for the fallback chart
const teamMembers = [
  "Product Manager",
  "Software Architect",
  "Frontend Developer",
  "Backend Developer",
  "QA Engineer",
];
