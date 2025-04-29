# Project Overview

This project is a web application built with Next.js 15, Tailwind CSS, and TypeScript. It is a platform for creating and managing AI agents.

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

## Code Style Guidelines

- **TypeScript**: Use strict types, interfaces preferred over types, avoid `any`, Zod schemas recommended
- **Components**: PascalCase for components/types, camelCase for variables/functions, "use client" for client components
- **Imports**: Order: React/Next.js, third-party, UI components, icons, utilities. Use `import type` for type-only imports
- **Formatting**: Double quotes, 2-space indent, no semicolons, use Tailwind with cn() for conditional classes
- **Functions**: Use descriptive names, event handlers with "handle" prefix, use default parameters and destructuring
- **Error Handling**: Use error-reporting.ts module, early returns, try/catch with specific handling
- Always run both `npm run lint` and `npm run typecheck` before submitting changes
- Always run tests with `npm run test` after making changes to code files functionality to ensure proper storage, retrieval, and validation of code files