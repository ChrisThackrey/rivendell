/**
 * OpenAI prompt generator for structured solution generation
 */

/**
 * Generates a detailed prompt for OpenAI models to create a structured solution
 *
 * @param prompt - The user's request or problem statement
 * @param techStack - Optional technology stack to target
 * @param enableReasoning - Whether to request step-by-step reasoning
 * @returns A formatted prompt string for OpenAI API
 */
export const generateOpenAIPrompt = (
  prompt: string,
  techStack: string | undefined,
  enableReasoning: boolean | undefined,
): string => {
  const techStackSection = techStack ? `\nTechnology stack: ${techStack}` : "";
  const reasoningEnabled = enableReasoning === true;

  return `You are an expert software engineer tasked with creating a detailed solution for the following request:
${prompt}${techStackSection}

Your response should include a 6-step implementation plan, where each step builds upon the previous ones.

IMPORTANT: For EACH step, you MUST include actual code implementations in separate files. Each step should have at least one code file with real, functional code that implements that specific part of the solution.

CRITICAL: You must think carefully about file directory structure and maintain consistency across all steps:
1. Consider how files relate to each other within a proper project structure
2. Design a logical directory layout that would work in a real project
3. Use consistent naming conventions for files and directories
4. Reference correct relative paths when importing between files
5. If adding a new file in a later step, make sure it fits logically with files from previous steps
6. When modifying existing files, maintain all relevant imports and dependencies

FILE-TREE TRACKING:
For each step, you MUST include a file-tree representation showing the project structure at that point. This should show:
- All directories created so far
- All files created or modified in this step and previous steps
- Use indentation to show directory nesting
- Mark new files with [NEW] and modified files with [MODIFIED]
- Use a structure similar to the output of the Unix 'tree' command

Example file-tree representation:
\`\`\`
project-root/
├── package.json [MODIFIED]
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts [MODIFIED]
│   ├── config/
│   │   └── app-config.ts [NEW]
│   └── components/
│       └── Button.tsx [NEW]
\`\`\`

PROGRESSIVE IMPLEMENTATION ACROSS STEPS - Follow this file type progression:

STEP 1: PROJECT FOUNDATION & CONFIGURATION
- Create core configuration files (package.json, tsconfig.json, .env.example, etc.)
- Set up project structure with initial directory layout
- Implement basic entry points (index.js/ts, main.js/ts, app.js/ts)
- Add essential dependencies and dev dependencies
- Include any necessary build configuration files (.eslintrc, webpack.config.js, etc.)
- Include a detailed file-tree showing the initial project structure

STEP 2: CORE FRAMEWORK & UTILITIES
- Implement core framework setup (React components, server setup, etc.)
- Add essential utility functions, helpers, and services
- Create base components or classes that will be extended later
- Set up data models, types, and interfaces
- Implement basic styling foundation (CSS/SCSS files, Tailwind config)
- Include an updated file-tree showing additions and modifications from the previous step

STEP 3: DATA LAYER & MIDDLEWARE
- Add API service layer for data fetching/persistence
- Implement data validation and transformation logic
- Add middleware for request processing, authentication, etc.
- Create storage or database interaction code
- Set up state management structure
- Include an updated file-tree showing additions and modifications from the previous step

STEP 4: FEATURE IMPLEMENTATION (BASIC)
- Implement primary user-facing features
- Add core UI components with interactions
- Create handlers for main user workflows
- Implement business logic for main functionality
- Connect UI to data services
- Include an updated file-tree showing additions and modifications from the previous step

STEP 5: FEATURE IMPLEMENTATION (ADVANCED)
- Add advanced features and edge cases handling
- Implement error handling and recovery mechanisms
- Add performance optimizations
- Create more complex UI interactions
- Implement any remaining business requirements
- Include an updated file-tree showing additions and modifications from the previous step

STEP 6: TESTING, POLISHING & DOCUMENTATION
- Add tests for key functionality
- Include documentation in code and as separate files
- Implement final UI refinements and polish
- Add any remaining validation or error handling
- Create complete examples showing the full solution in action
- Include a final file-tree showing the complete project structure

IMPORTANT FOR MAKING SIGNIFICANT PROGRESS BETWEEN STEPS:
1. Each step MUST show substantial progress over the previous step - avoid small, incremental changes
2. When modifying an existing file, include the complete updated file with all changes
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
4. A file-tree representation showing the project structure at this step
5. Complete code implementation with:
   - Appropriate file names with logical paths following Next.js 15 structure (e.g., "components/ui/Button.tsx", "lib/analyze-job.ts")
   - Valid syntax specific to the language and framework
   - Necessary imports and dependencies
   - Comments explaining key functionality
   - Error handling where relevant

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
- Create a comprehensive file-tree showing the initial project structure

When Building Across Steps:
- Each step should reference and build upon the files created in previous steps
- When modifying an existing file, include the complete updated file with all changes
- Maintain imports, dependencies, and project structure consistently
- Ensure each step's code works within the context of all code produced in previous steps
- Make SUBSTANTIAL CHANGES between steps - don't just add minor tweaks
- The file-tree in each step should grow consistently with your implementation

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

CRITICAL: NEVER use placeholder code like "Sample code generated for placeholder document" or "This file was auto-generated...". If you can't generate actual implementation code for a step, provide a MINIMAL WORKING EXAMPLE that demonstrates the core concept of that step with real, executable code.

NEVER create "automatically generated" or "reconstructed" solutions - ALL code must be fully implemented.
Make sure each step includes REAL code that implements the necessary functionality, not just code comments or placeholders. Any file containing ONLY comments or placeholder text will be rejected.

Ensure ALL code is fully implemented and functional. Do not skip important implementation details.

Remember to maintain CONSISTENT FILE STRUCTURE across all steps and ensure all files work together correctly in a real project environment. The file-tree should accurately reflect all files created and modified in each step, growing progressively as the implementation develops.`;
};
