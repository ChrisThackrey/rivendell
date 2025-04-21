/**
 * Anthropic prompt generator for structured solution generation
 */

/**
 * Generates a detailed prompt for Anthropic models to create a structured solution
 *
 * @param prompt - The user's request or problem statement
 * @param techStack - Optional technology stack to target
 * @param enableReasoning - Whether to request step-by-step reasoning
 * @returns A formatted prompt string for Anthropic API
 */
export const generateAnthropicPrompt = (
  prompt: string,
  techStack: string | undefined,
  enableReasoning: boolean | undefined,
): string => {
  const techStackSection = techStack ? `\nTechnology stack: ${techStack}` : "";
  const reasoningEnabled = enableReasoning === true;

  const anthropicPrompt = `<task>
You are an expert software engineer tasked with creating a detailed solution for the following request:
${prompt}${techStackSection}
</task>

<instructions>
Your response should include a 6-step implementation plan, where each step builds upon the previous ones.

CRITICAL: You MUST include actual code implementations in separate files for EVERY step. Each step MUST have at least one code file with real, functional code that implements that specific part of the solution. DO NOT skip code implementation for any steps.

CRITICAL: You must think carefully about file directory structure and maintain consistency across all steps.
Use a COMPREHENSIVE Next.js 15 app router-based structure as follows:

NEXT.JS 15 APP ROUTER FILE STRUCTURE GUIDE:
For a Next.js 15 app router project, follow these directory conventions:
1. /app/ - Contains all routes and page components following Next.js 15 app router pattern:
   - /app/page.tsx - Main page component
   - /app/layout.tsx - Root layout component
   - /app/[route]/page.tsx - Route-specific page components
   - /app/api/[endpoint]/route.ts - API routes

2. /components/ - All reusable React components:
   - PascalCase.tsx for all component files
   - Group related components in subdirectories (e.g., /components/ui/, /components/forms/)
   - /components/[feature]/ - Feature-specific components (JobAnalyzer.tsx, etc.)

3. /lib/ - Core utilities and services:
   - /lib/utils.ts - General utility functions
   - /lib/[service]-service.ts - Service layer files (e.g., analyze-job.ts)
   - /lib/types.ts - TypeScript type definitions
   - /lib/constants.ts - Constant values

4. /styles/ - CSS/SCSS files and styling configurations:
   - /styles/globals.css - Global styles
   - /styles/[component].module.css - Component-specific CSS modules

5. /public/ - Static assets:
   - /public/images/ - Image files
   - /public/fonts/ - Font files
   - /public/icons/ - Icon files

6. /tests/ - Test files:
   - /tests/components/ - Component tests
   - /tests/lib/ - Utility and service tests

FILE-TREE TRACKING:
For each step, you MUST include a COMPREHENSIVE file-tree representation showing the project structure at that point. This should show:
- ALL directories needed for a complete Next.js 15 project
- ALL files created or modified in this step and previous steps
- Use indentation to show directory nesting
- Mark new files with [NEW] and modified files with [MODIFIED]
- Use a structure similar to the output of the Unix 'tree' command

Example file-tree representation for a Next.js 15 Job Analysis project:

project-root/
├── package.json [MODIFIED]
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── README.md
├── app/
│   ├── page.tsx [MODIFIED]
│   ├── layout.tsx
│   ├── jobs/
│   │   ├── page.tsx [NEW]
│   │   └── [id]/
│   │       └── page.tsx [NEW]
│   └── api/
│       └── analyze-job/
│           └── route.ts [NEW]
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Card.tsx [NEW]
│   ├── JobAnalyzer.tsx [NEW]
│   ├── JobCard.tsx
│   └── SearchForm.tsx
├── lib/
│   ├── utils.ts
│   ├── analyze-job.ts [NEW]
│   ├── job-service.ts [MODIFIED]
│   └── types.ts
├── styles/
│   ├── globals.css
│   └── components.css
├── public/
│   ├── images/
│   │   └── logo.png
│   └── fonts/
│       └── inter.woff2
└── tests/
    ├── components/
    │   └── JobAnalyzer.test.tsx [NEW]
    └── lib/
        └── analyze-job.test.ts [NEW]

PROGRESSIVE IMPLEMENTATION ACROSS STEPS - Follow this file type progression:

STEP 1: PROJECT FOUNDATION & CONFIGURATION
- Create core configuration files (package.json, tsconfig.json, .env.example, etc.)
- Set up project structure with initial directory layout
- Implement basic entry points (index.js/ts, main.js/ts, app.js/ts)
- Add essential dependencies and dev dependencies
- Include any necessary build configuration files (.eslintrc, webpack.config.js, etc.)
- Include a comprehensive file-tree showing the initial project structure

STEP 2: CORE FRAMEWORK & UTILITIES
- Implement core framework setup (React components, server setup, etc.)
- Add essential utility functions, helpers, and services
- Create base components or classes that will be extended later
- Set up data models, types, and interfaces
- Implement basic styling foundation (CSS/SCSS files, Tailwind config)

STEP 3: DATA LAYER & MIDDLEWARE
- Add API service layer for data fetching/persistence
- Implement data validation and transformation logic
- Add middleware for request processing, authentication, etc.
- Create storage or database interaction code
- Set up state management structure

STEP 4: FEATURE IMPLEMENTATION (BASIC)
- Implement primary user-facing features
- Add core UI components with interactions
- Create handlers for main user workflows
- Implement business logic for main functionality
- Connect UI to data services

STEP 5: FEATURE IMPLEMENTATION (ADVANCED)
- Add advanced features and edge cases handling
- Implement error handling and recovery mechanisms
- Add performance optimizations
- Create more complex UI interactions
- Implement any remaining business requirements

STEP 6: TESTING, POLISHING & DOCUMENTATION
- Add tests for key functionality
- Include documentation in code and as separate files
- Implement final UI refinements and polish
- Add any remaining validation or error handling
- Create complete examples showing the full solution in action

IMPORTANT FOR MAKING SIGNIFICANT PROGRESS BETWEEN STEPS:
1. Each step MUST show substantial progress over the previous step - avoid small, incremental changes
2. When modifying existing files, make MEANINGFUL changes that add significant functionality
3. Add at least 30-50% new code or features in each step compared to the previous step
4. Ensure each step introduces new concepts or techniques, not just minor refinements
5. For files modified across multiple steps, ensure each edit adds substantial new capabilities
6. NEVER split a single logical feature across too many steps - implement complete features within a step

CLEARLY HIGHLIGHT STEP CHANGES:
1. Begin each modified file with a comment indicating what has changed since the previous version
2. Use detailed comments to mark significant new sections of code
3. When files grow large, split functionality into multiple logical files rather than having one massive file
4. Ensure modified imports/dependencies are clearly updated when new components are added

IMPORTANT FOR FILENAME GENERATION:
1. Make each filename UNIQUE and DISTINGUISHABLE from other implementations
2. DO NOT use generic names like "index.js" or "app.js" alone
3. Include MEANINGFUL prefixes or suffixes that describe the file's purpose
4. For similar components, use VARIANT identifiers in the filename (e.g., "BasicButton.tsx" vs "EnhancedButton.tsx")
5. You MAY include a short hash or identifier in filenames to ensure uniqueness
6. Consider using descriptive terms that reflect your specific approach in filenames

For each step, include these sections:
1. A clear, descriptive title
2. A detailed explanation of what needs to be done in this step
3. Performance metrics (execution time, complexity, memory usage, line count)
4. Complete code implementation files with:
   - Appropriate file names with logical paths following Next.js 15 structure (e.g., "components/ui/Button.tsx", "lib/analyze-job.ts")
   - Valid syntax specific to the language and framework
   - All necessary imports and dependencies
   - Comments explaining key functionality
   - Error handling where relevant

IMPORTANT REMINDER: For ALL 6 steps, you MUST include at least one code file. No step should be without code files.

CODE FILE REQUIREMENTS:
1. Each code file MUST contain COMPLETE, FULLY FUNCTIONAL code - never use placeholders or skeleton code
2. Code files should be SUBSTANTIAL - aim for at least 50-100 lines of well-structured code per file
3. NEVER create code files that just say "Sample code" or "This file was auto-generated" or "Reconstructed Solution"
4. If you're creating a component, include ALL necessary functionality and styling
5. If you're creating a service, include ALL methods needed for that service to work
6. Make sure ALL code would run correctly in a real project environment
7. Include proper error handling, type definitions, and comments
8. Use modern syntax and best practices for the language/framework
9. Ensure all string literals in code are properly escaped with backslashes before quotes

Each code file should be structured like this:
\`\`\`
{
  "filename": "components/ui/Button.tsx",
  "language": "typescript",
  "code": "import React from 'react';\n\nexport const Button = () => {\n  return <button className=\"px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600\">Click me</button>;\n};"
}
\`\`\`

First Step Considerations:
- For a new project, establish proper boilerplate and directory structure in the first step
- Include package.json, configuration files, and main entry points as appropriate for the tech stack
- Set up a solid foundation that future steps can build upon

When Building Across Steps:
- Each step should reference and build upon the files created in previous steps
- When modifying an existing file, include the complete updated file with all changes
- Maintain imports, dependencies, and project structure consistently
- Ensure each step's code works within the context of all code produced in previous steps
- Make SUBSTANTIAL CHANGES between steps - don't just add minor tweaks

After the 6 steps, provide a "Final Solution" that summarizes the entire approach.

${reasoningEnabled ? 'Include your step-by-step reasoning process that led to this solution in a "reasoningProcess" field.' : ""}

Format your entire response as a JSON object with the following structure:
{
  "steps": [
    {
      "title": "Step 1: [Title]",
      "description": "Detailed explanation for step 1...",
      "metrics": {
        "executionTime": "Estimated execution time",
        "complexity": "Time complexity notation",
        "memoryUsage": "Memory usage estimate",
        "lineCount": number,
        "codeQuality": number from 1-10
      },
      "fileTree": "Multi-line string showing the project structure at this step",
      "codeFiles": [
        {
          "filename": "filename with extension",
          "language": "programming language",
          "code": "Actual code implementation"
        }
      ]
    },
    // Repeat for all 6 steps
  ],
  "finalSolution": {
    "title": "Final Implementation",
    "description": "Summary of the entire solution...",
    "metrics": {
      "executionTime": "Overall execution time",
      "complexity": "Overall complexity",
      "memoryUsage": "Overall memory usage",
      "lineCount": number
    },
    "fileTree": "Multi-line string showing the complete final project structure",
    "codeFiles": [
      {
        "filename": "filename with extension",
        "language": "programming language",
        "code": "Any additional code for the complete solution"
      }
    ]
  }${reasoningEnabled ? ',\n  "reasoningProcess": "Your detailed reasoning here..."' : ""}
}

JSON FORMATTING CRITICAL REQUIREMENTS:
1. Ensure ALL quotes (") within code are properly escaped with a backslash (\")
2. Make sure all JSON is properly formatted and valid - no missing commas, brackets, or braces
3. When including multi-line strings (like "code" fields), use \\n for newlines
4. Avoid special characters that could break JSON parsing
5. Always fully complete your JSON response - never leave it truncated
6. Make sure all objects and arrays are properly closed
7. Double check for any syntax errors that might prevent proper parsing

DO NOT skip code implementation for any step. Each step MUST have at least one code file with real implementation details.
NEVER create "automatically generated" or "reconstructed" solutions - ALL code must be fully implemented.
Ensure ALL code is fully implemented and functional. Do not provide placeholder or incomplete code.
Remember to maintain CONSISTENT FILE STRUCTURE across all steps and ensure all files work together correctly in a real project environment.
Consider the tech stack specified and ensure the code files are properly structured for that stack.
</instructions>

<output_format>
JSON object without any markdown formatting or enclosing code blocks. Return only the raw JSON with no extra text or explanation.
</output_format>`;

  return anthropicPrompt;
};
