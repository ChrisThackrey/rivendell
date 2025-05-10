# Project Overview

This project is a web application built with Next.js 15, Tailwind CSS, and TypeScript. It is a platform for creating and managing AI agents.

## Important Rules and Instructions

Carefully provide factually accurate, complete answers. Use sequential-thinking and clear-thought to plan and implement code changes. Use the filesystem and a web search if helpful to debug, identify, plan and fix any issues.

- Follow the user's requirements and instructions provided carefully
- First think step-by-step and describe your plan for what to build in pseudocode, written out in great detail. Confirm, then write code!
- When running `npm run dev`, `npm run build`, or `npm run start` set a timeout or run it as a background process and then kill the process once done.
- Fully implement all requested functionality and verify code is complete!, Leave NO todo's, placeholders or missing pieces.
- Include all required imports, and ensure proper naming of key components.
- Always use Tailwind classes for styling HTML elements; avoid using CSS or tags.
- Use clear-thought, along with stochastic-thinking if helpful to debug, identify and fix any issues.
- Use sequential-thinking and think deeply to plan and implement code.
- Write tests to verify the code is working as expected, and run them after implementing or refactoring code.
- Use playwright or puppeteer where needed to test and debug the application in the browser after running `npm run dev`, and find the root cause of any issues and the most recent information by performing a web search where needed to debug, identify, plan and fix any issues.
- Write tests covering all edge cases and scenarios after implementing or refactoring code.
- Write CHANGELOGS and JSDocs for all new components, functions, and features after implementing or refactoring code to ensure the code is well-documented and easily understandable.
- Fully implement all requested functionality and verify code is complete!, Leave NO todo's, placeholders or missing pieces.
- Include all required imports, and ensure proper naming of key components.
- Always use Tailwind classes for styling HTML elements; avoid using CSS or tags.
- Always run tests with `npm run test` after making changes to code files functionality to ensure proper storage, retrieval, and validation of code files.
- When fixing issues related to code files or embeddings, make sure to run the integration tests to verify the complete workflow from LLM response to database storage and retrieval.
- Always write new tests and run them against new edits when implementing or refactoring code, and think more to plan a new approach to fix and debug any tests that fail. Use testing implementations to validate any changes to the codebase that were made before considering the task complete, think and plan tests that test against the expected behavior, using memory tools, web search, clear-thought and sequential-thinking steps to integrate tests closely with the code. If a test keeps failing after 4 attempts, do not continue to test, but think more about what is causing test to fail and suggestions for code fixes, then check to make sure the test works and actually makes sense in context of the code.

## Additional Requirement Guidelines

1. Project Setup
   - Use the Next.js 15 app router
   - All data fetching should be done in a server component and pass the data down as props
   - Client components (useState, hooks, etc) require that 'use client' is set at the top of the file
   - Use early returns whenever possible to make the code more readable.

2. Coding Standards
    - Practice extending or re-using an existing set of themes, assets (the codebase should have a common set of fonts and icons like `geist` or `inter` across files), as well as utility functions, existing code patterns or tool integrations consistently in the code.
    - use the typestyle tool to keep the codebase clean and consistent across the codebase.
    - Avoid writing redundant code and check for existing code that can be reused.
    - Check for unused code and remove it. Avoid writing unused code and duplicate functions or functions that are not needed.

3. Functions
   - Use descriptive names: verbs & nouns (e.g., getUserData)
   - Use default parameters and object destructuring.
   - Prefer to use const when defining new functions, for example, "const toggle = () =>". Also, define a type if possible.
   - Use descriptive variable and function/const names. Also, event functions should be named with a "handle" prefix, like "handleClick" for onClick and "handleKeyDown" for onKeyDown.

4. Server-Side API Calls:
   - All interactions with external APIs (e.g., Reddit, OpenAI, Anthropic) should be performed server-side.
   - Create dedicated API routes for each external API interaction.
   - Client-side components should fetch data through these API routes, not directly from external APIs.

5. Environment Variables
   - Store all sensitive information (API keys, credentials) in environment variables.
   - Access environment variables only in server-side code or API routes.

6. Error Handling and Logging:
   - Implement comprehensive error handling in both client-side components and server-side API routes.
   - Log errors on the server-side for debugging purposes.
   - Display user-friendly error messages on the client-side.

7. Types and Interfaces
   - For any new types, prefer to create a Zod schema, and zod inference type for the created schema.
   - Create custom types/interfaces for complex structures
   - Use 'readonly' for immutable properties
   - If an import is only used as a type in the file, use 'import type' instead of 'import'
   - Prioritize type safety by avioding the use of the `any` type and prefer to use zod schemas and zod inference types for all new types instead.

8. API Client Initialization:
   - Initialize API clients (e.g., for Reddit, OpenAI, Anthropic) in server-side code only.
   - Implement checks to ensure API clients are properly initialized before use.

9. Data Fetching in Components:
   - Use React hooks (e.g., `useEffect`) for data fetching in client-side components.
   - Implement loading states and error handling for all data fetching operations.

10. Next.js Configuration:
    - Utilize `next.config.ts` for environment-specific configurations.
    - Use the `env` property in `next.config.ts` to make environment variables available to the application.

11. CORS and API Routes:
    - Use Next.js API routes to avoid CORS issues when interacting with external APIs.
    - Implement proper request validation in API routes.

12. Component Structure:
    - Separate concerns between client and server components.
    - Use server components for initial data fetching and pass that data as props to client components.
    - Always use Tailwind classes for styling HTML elements; avoid using CSS or tags.
    - Implement accessibility features on elements. For example, a tag should have a tabindex="0", aria-label, on:click, and on:keydown, and similar attributes.

13. Code Style:
    - React components: PascalCase function declarations with explicit Props interfaces/types
    - Imports order: React/Next.js, third-party libraries, UI components, icons, utilities
    - TypeScript: Use explicit return types and interface/type definitions for props
    - Naming: PascalCase for types/components, camelCase for variables/functions
    - Use double quotes for strings, no semicolons, 2-space indentation
    - Tailwind for styling with cn() utility for conditional classes
    - Error handling: Early returns, optional chaining, useEffect cleanup
    - State management: React hooks (useState, useEffect, useMemo, useRef)
    - Component patterns: Default exports, "use client" directive for client components
    - Three.js/React Three Fiber for 3D visualizations
    - Radix UI components for accessible UI elements
    - Always use descriptive variable names

14. Security:
    - Never expose API keys or sensitive credentials on the client-side.
    - Implement proper authentication and authorization for API routes if needed.

## Code Style & Conventions
- **TypeScript**: Use strict types, interfaces preferred over types, avoid `any`, Zod schemas recommended
- **Components**: PascalCase for components/types, camelCase for variables/functions, "use client" for client components
- **Imports**: Order: React/Next.js, third-party, UI components, icons, utilities. Use `import type` for type-only imports
- **Formatting**: Double quotes, 2-space indent, no semicolons, use Tailwind with cn() for conditional classes
- **Functions**: Use descriptive names, event handlers with "handle" prefix, use default parameters and destructuring
- **Error Handling**: Use error-reporting.ts module, early returns, try/catch with specific handling
- Always run both `npm run lint` and `npm run typecheck` before submitting changes
- Always run tests with `npm run test` after making changes to code files functionality to ensure proper storage, retrieval, and validation of code files
- TypeScript strict mode with explicit typing
- React components use functional style with hooks
- Use absolute imports with @ alias (e.g., `@/components/button`)
- Use Tailwind CSS with utility classes, combined with `cn` utility
- Component files use PascalCase, utility files use camelCase
- Radix UI components for accessible primitives
- Handle errors with try/catch and appropriate reporting
- React hooks prefer function form for state updates
- Tests use Vitest with Testing Library
- Three.js with React Three Fiber for 3D visualizations

## Project Architecture

### Core Services
- **AI Service** (`lib/ai-service.ts`): Manages API calls to OpenAI and Anthropic models
- **Embedding Service** (`lib/embedding-service.ts`): Handles vector embeddings for semantic search
- **Monte Carlo Service** (`lib/monte-carlo-service.ts`): Provides data and clustering for 3D visualizations
- **Document Service** (`lib/document-service.ts`): Manages storage and retrieval of code documents
- **Supabase Client** (`lib/supabase-client.ts`): Database connection and operations

### Key Components
- **Pathway Visualizer** (`components/pathway-visualizer.tsx`): Displays solution pathways from multiple AI models
- **Monte Carlo Visualizer** (`components/monte-carlo-visualizer.tsx`): 3D visualization of solution clusters
- **Solution Card** (`components/solution-card.tsx`): Displays individual AI solutions with metrics
- **Ensemble Selection** (`components/ensemble-selection-modal.tsx`): Configure multiple AI models to run in parallel

### Data Flow
1. User inputs query on the main page
2. Tech stack and ensemble configurations are selected
3. Multiple AI models generate structured solutions with 6 steps
4. Solutions are stored in Supabase with vector embeddings
5. Solutions are visualized in pathway format or 3D monte carlo visualization
6. Similar solutions can be found using semantic search
7. Final solution is aggregated from best parts of all solutions

### Database Structure
- Uses Supabase with PostgreSQL and pgvector extension
- `documents` table stores solutions with vector embeddings
- `match_documents` function for similarity search
- Documents are organized by batch ID and run ID
- Each solution includes metrics, code files, and evaluation scores

### API Endpoints
- `/api/openai` and `/api/anthropic`: Model-specific API proxies
- `/api/structured-solution`: Generates complete 6-step solutions
- `/api/embeddings`: Generates vector embeddings for search
- `/api/evaluate`: Evaluates solution quality using AI
- `/api/similar-solutions`: Finds semantically similar solutions

## Git Commit Rules

- Make the head / title of the commit message brief
- Include elaborate details in the body of the commit message
- Use bullet points in the body of the commit message to list the changes made
- Always follow the conventional commit message format
- Add two newlines after the commit message title

## Changelog Generation Rules

- Frequently document changes made in the `/docs/changelogs` directory by creating incrementally named Readme files in markdown to document each successfully completed task.
- Provide technically useful descriptions of the project working state after any updates of changes have been made to document and refer to as historical context for future tasks.
- Be concise, technical and capture the implementation details of any successful changes made to the codebase after each task is complete.
- You must perform a changelog generation step at the end of any final implementation step, output a `<changelog>` step to refer to this final process step.
- Always update the changelog after each task is complete.
- Use the `changelog` directory to store the changelog files.
- Use git and rivendell for supabase tools and diffs to make sure the changelog is up to date and accurate. Get the latest diffs from the `main` branch and use that to update the changelog.
- Use the memory tool to search for the latest changelog file and use that to update the changelog.

## Commands

- `npm run dev` - Start development server
  - When running `npm run dev` set a timeout or run it as a background process and then kill the process once done.
- `npm run dev:turbo` - Start development server with Turbopack
- `npm run build` - Build for production
  - When running `npm run build` set a timeout or run it as a background process and then kill the process once done.
- `npm run start` - Start production server
  - When running `npm run start` set a timeout or run it as a background process and then kill the process once done.
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run all Vitest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage reporting
- Single test: `npx vitest run __tests__/path/to/test.test.ts`
- Pattern test: `npx vitest run --testNamePattern="pattern"`
