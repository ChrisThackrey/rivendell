# Product Requirements Document: Rivendell: AI-Powered Coding Solution Platform

## 1. Product Overview

Rivendell is a Next.js web application that visualizes AI model solutions for development tasks using OpenAI and Anthropic APIs. The platform allows users to submit development tasks to multiple AI models in parallel, compare different approaches, and generate final combined solutions from the best parts.

## MVP Action Plan

## Introduction (Derived from PRD.md and project context)

This document outlines the Minimum Viable Product (MVP) action plan for Rivendell, an AI-powered coding solution platform. Rivendell aims to provide a sophisticated interface for users to submit programming tasks, receive solutions from multiple AI models, compare these solutions based on various metrics, and iteratively refine them. The platform will incorporate features for project management, AI model integration (OpenAI, Anthropic), ensemble configurations, tech stack customization, advanced solution visualization, semantic search, and robust backend infrastructure using Supabase and Vercel.

This action plan details the steps required to build the MVP, incorporating information from the Product Requirements Document (`prd.txt`) and specific task breakdown files (`task_001.txt` - `task_015.txt`). Tasks will be marked with their status (e.g., pending, completed) as indicated in these source files.

## Core MVP Features (Derived from prd.txt and task files)

1.  **User Authentication & Management:** Secure sign-up, sign-in, profile management.
2.  **Project Management:** Create and manage coding projects with problem statements, languages, and criteria.
3.  **AI Model Integration:** Connect to OpenAI and Anthropic models for solution generation. Submit development tasks to multiple AI models in parallel (OpenAI and Anthropic)
4.  **Ensemble Configuration:** Allow users to define and manage configurations of multiple AI models. Configure ensemble model settings with different temperatures
5.  **Tech Stack Selection:** UI for users to specify target technology stacks for solutions.
6.  **Tech Stack Configuration** Select and configure tech stack options for AI solutions.
7.  **Configuration Management** Save and load ensemble configurations for reuse, add custom model combinations.
8.  **AI Solution Generation:** Submit project details to selected AI models/ensembles and retrieve solutions.
9.  **Code File Storage & Embeddings:** Store code files and generate embeddings for search and analysis.
10. **Semantic Search:** Allow users to search for relevant code snippets using natural language.
11. **Solution Pathway Visualization:** Basic and advanced (3D) visualization of AI solution generation paths. Interactive UI to visualize solution pathways and compare different AI approaches.
12. **Solution Comparison:** Side-by-side comparison of solutions with diffing and metrics. Compare solutions from different models to the same problem.
13. **Solution Generation** Generate final combined solutions from the best parts.
14. **Solution Refinement:** Tools to combine best parts of different solutions.
15. **Code File Management** Store and retrieve code files with embedding-based similarity.
16. **Secure Sandbox (Conceptual):** (Note: Actual sandboxing is complex; MVP might focus on displaying code, with execution being a future goal or simplified).
17. **Basic Metrics & Analysis:** Display metrics for generated solutions.
18. **Error Handling & Performance:** Robust error management and application optimization.
19. **Deployment:** Hosted on Vercel with Supabase backend.

## Technical Architecture

- Frontend: Next.js 15 app router with React 19 and TypeScript
- Styling: Tailwind CSS with Shadcn UI components
- 3D Visualization: Three.js / React Three Fiber
- API Integration:
  - OpenAI API for GPT models like GPT-4o
  - Anthropic API for Claude models like Claude-3-Sonnet
- Database: Supabase for storing code files, embeddings, and configurations
- Authentication: To be implemented

---

## Detailed Action Plan Steps

### Step 1: Initial Project Setup & Configuration (Derived from task_001.txt)

#### Detailed technical explanation

Initialize the Next.js project with TypeScript, Tailwind CSS, and Shadcn/UI. Set up basic project structure, linting, formatting, and necessary development tools. This forms the foundational boilerplate for the application.

#### Task Breakdown (task_001.txt)

##### SubTask 1.1: Initialize Next.js Project [STATUS: as per task_001.txt]

- Description: Create a new Next.js application using `create-next-app` with TypeScript.
- /relative/path/of/changed/file: Project Root
- Operation: Create

##### SubTask 1.2: Integrate Tailwind CSS [STATUS: as per task_001.txt]

- Description: Install and configure Tailwind CSS for utility-first styling.
- /relative/path/of/changed/file: `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`
- Operation: Create/Update

##### SubTask 1.3: Set up Shadcn/UI [STATUS: as per task_001.txt]

- Description: Initialize Shadcn/UI for pre-built, accessible UI components.
- /relative/path/of/changed/file: `components.json`, `lib/utils.ts`, `components/ui/`
- Operation: Create/Update

##### SubTask 1.4: Configure ESLint and Prettier [STATUS: as per task_001.txt]

- Description: Set up ESLint for code linting and Prettier for code formatting to maintain code quality and consistency.
- /relative/path/of/changed/file: `.eslintrc.json`, `.prettierrc.json`, `package.json` (scripts)
- Operation: Create/Update

##### SubTask 1.5: Basic Project Structure Setup [STATUS: as per task_001.txt]

- Description: Organize directories for components, lib, app router pages, etc.
- /relative/path/of/changed/file: `app/`, `components/`, `lib/`
- Operation: Create

### Step 2: Environment Setup & Supabase Integration (Derived from existing plan Step 1, task_003.txt, and schema files)

#### Detailed technical explanation

Set up the development environment, configure environment variables (Supabase, AI APIs), establish Supabase connection, and define the initial database schema based on `00001_initial_rivendell.sql` and `schema.md`.

#### Task Breakdown

##### SubTask 2.1: Supabase Project Setup (Manual) [STATUS: Pending/Assumed from task_003.txt]

- Description: Create Supabase project, note URL and anon key.
- Details: As per `task_003.txt` (Subtask 1).

##### SubTask 2.2: Configure Environment Variables [STATUS: Pending as per task_003.txt]

- Description: Create `.env.local` with Supabase keys, placeholders for OpenAI, Anthropic.
- /relative/path/of/changed/file: `.env.local`
- Operation: Create
- Details: As per `task_003.txt` (Subtask 1) and current plan.

##### SubTask 2.3: Create Supabase Client Utilities [STATUS: Pending as per task_003.txt]

- Description: Implement `lib/supabase/client.ts` and `lib/supabase/server.ts`.
- /relative/path/of/changed/file: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- Operation: Create
- Details: As per `task_003.txt` (Subtask 1) and current plan.

##### SubTask 2.4: Define and Apply Initial Database Schema [STATUS: Partially Implemented, based on provided SQL/schema.md]

- Description: Implement the database schema provided in `00001_initial_rivendell.sql` and documented in `schema.md`. This includes tables for `users` (via auth), `profiles`, `projects`, `ai_models`, `code_solutions`, `solution_metrics`, `test_cases`, `solution_test_results`, `api_keys`, `organizations`, `organization_members`, `project_members`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`, `embeddings`, `app_configuration`, `ensemble_configurations`, `tech_stack_options`, `configuration_tech_stacks` and related functions/triggers.
- /relative/path/of/changed/file: Supabase SQL Editor / Migrations
- Operation: Create/Update (Schema)
- Details: The schema from `00001_initial_rivendell.sql` should be applied. `task_003.txt` (Subtask 2 & 3) also describe schema for code files, embeddings, configurations which should be reconciled with the main SQL file.
  - **Key Tables from `00001_initial_rivendell.sql` to verify/implement:**
    - `organizations`, `profiles` (linking to `auth.users`)
    - `projects`, `project_members`
    - `api_keys` (for user/project API access)
    - `ai_models` (configurable list of AI models)
    - `code_solutions`, `solution_metrics`, `solution_files`
    - `test_cases`, `solution_test_results`
    - `roles`, `permissions`, `role_permissions`, `user_roles`
    - `audit_logs`
    - `embeddings` (pgvector)
    - `app_configuration`
    - RLS policies and helper functions as defined in the SQL file.

##### SubTask 2.5: Update `tsconfig.json` for path aliases [STATUS: as per current plan]

- Description: Configure path aliases.
- /relative/path/of/changed/file: `tsconfig.json`
- Operation: Update

### Step 3: User Authentication & Management (Derived from existing plan Step 2, prd.txt)

#### Detailed technical explanation

Implement core user authentication (sign-up, sign-in, sign-out, password recovery, email verification) using Supabase Auth. Manage user profiles linked to `auth.users`.

#### Task Breakdown

##### SubTask 3.1: Ensure `profiles` Table and Triggers [STATUS: Defined in Step 2.4]

- Description: The `profiles` table and `handle_new_user` trigger (from `00001_initial_rivendell.sql`) should be in place.

##### SubTask 3.2: Create Authentication UI Components [STATUS: Pending, similar to current plan]

- Description: Develop Sign Up, Sign In, Forgot Password forms using Shadcn/UI.
- /relative/path/of/changed/file: `components/auth/SignUpForm.tsx`, etc.
- Operation: Create

##### SubTask 3.3: Implement Sign Up, Sign In, Sign Out Logic [STATUS: Pending, similar to current plan]

- Description: Implement client-side logic using Supabase client.
- /relative/path/of/changed/file: `app/auth/...`, `components/auth/...`
- Operation: Create

##### SubTask 3.4: Session Management & Protected Routes (Middleware) [STATUS: Pending, similar to current plan]

- Description: Implement Next.js middleware for session management.
- /relative/path/of/changed/file: `middleware.ts`, `lib/supabase/middleware.ts`
- Operation: Create

##### SubTask 3.5: User Profile Page (Basic) [STATUS: Pending, similar to current plan]

- Description: Page for users to view/update their profile (`full_name`, `avatar_url` from `profiles` table).
- /relative/path/of/changed/file: `app/dashboard/profile/page.tsx`
- Operation: Create

##### SubTask 3.6: Email Verification & Password Recovery [STATUS: Pending, similar to current plan]

- Description: Configure and implement these Supabase Auth features.
- Operation: Create/Configure

### Step 4: Basic Application Layout & Navigation (Derived from existing plan Step 3, task_002.txt)

#### Detailed technical explanation

Create the main application layout (header, sidebar, content area) and basic navigation structure using components from Shadcn/UI, based on `task_002.txt`.

#### Task Breakdown (task_002.txt)

##### SubTask 4.1: Define Global Layout [STATUS: Pending as per task_002.txt (Subtask 1)]

- Description: Create `app/layout.tsx` with providers, theme, global styles.
- /relative/path/of/changed/file: `app/layout.tsx`
- Operation: Create/Update

##### SubTask 4.2: Implement Main Navigation (Header/Sidebar) [STATUS: Pending as per task_002.txt (Subtask 2)]

- Description: Develop `Header.tsx`, `Sidebar.tsx` with navigation links, user menu.
- /relative/path/of/changed/file: `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`
- Operation: Create

##### SubTask 4.3: Create Dashboard Layout [STATUS: Pending as per task_002.txt (Subtask 3)]

- Description: Specific layout for authenticated areas (`app/dashboard/layout.tsx`).
- /relative/path/of/changed/file: `app/dashboard/layout.tsx`
- Operation: Create

##### SubTask 4.4: Implement Page Structure and Content Areas [STATUS: Pending as per task_002.txt (Subtask 4)]

- Description: Define structure for main content display within layouts.
- Operation: Create

##### SubTask 4.5: Implement Responsive Design [STATUS: Pending as per task_002.txt (Subtask 5)]

- Description: Ensure layout is responsive across devices.
- Operation: Update (CSS/Components)

### Step 5: Project Management (Derived from existing plan Step 4, prd.txt, schema)

#### Detailed technical explanation

Allow users to create, view, update, and delete projects. Projects store problem statements, target languages, and link to evaluation criteria and test cases (schema defined in Step 2.4).

#### Task Breakdown

##### SubTask 5.1: Project Listing Page [STATUS: Pending]

- Description: UI to display a list of user's projects with options to create new or open existing.
- /relative/path/of/changed/file: `app/dashboard/projects/page.tsx`
- Operation: Create

##### SubTask 5.2: Create/Edit Project Form [STATUS: Pending]

- Description: Form for creating and editing project details (name, problem statement, target language).
- /relative/path/of/changed/file: `components/projects/ProjectForm.tsx`
- Operation: Create

##### SubTask 5.3: API Endpoints for Project CRUD [STATUS: Pending]

- Description: Next.js Route Handlers for creating, reading, updating, deleting projects in Supabase `projects` table.
- /relative/path/of/changed/file: `app/api/projects/[projectId]/route.ts`, `app/api/projects/route.ts`
- Operation: Create

##### SubTask 5.4: Manage Evaluation Criteria for a Project (UI + API) [STATUS: Pending]

- Description: Interface to add/edit/remove evaluation criteria (linked to `evaluation_criteria` table).
- Operation: Create

##### SubTask 5.5: Manage Test Cases for a Project (UI + API) [STATUS: Pending]

- Description: Interface to add/edit/remove test cases (linked to `test_cases` table).
- Operation: Create

### Step 6: AI Model Integrations (Derived from task_004.txt, task_005.txt)

#### Detailed technical explanation

Integrate with OpenAI and Anthropic APIs to enable solution generation. Includes API key management, service layers, and basic interaction functions.

#### Task Breakdown

##### SubTask 6.1: OpenAI API Integration (task_004.txt) [STATUS: Pending as per task_004.txt]

- Description: Set up environment variables, create API route handlers, service functions for GPT models, error handling, streaming.
- Subtasks from task_004.txt:
  - 6.1.1: Set up environment variables and config for OpenAI API.
  - 6.1.2: Create OpenAI service with core API interaction functions.
  - 6.1.3: Implement streaming response handling.
  - 6.1.4: Add robust error handling and rate limiting.
  - 6.1.5: Create API route handlers for frontend integration.
- /relative/path/of/changed/file: `lib/openai/service.ts`, `app/api/openai/...`
- Operation: Create

##### SubTask 6.2: Anthropic API Integration (task_005.txt) [STATUS: Pending as per task_005.txt]

- Description: Set up environment variables, API handlers, service functions for Claude models, error handling, streaming.
- Subtasks from task_005.txt:
  - 6.2.1: Set up Anthropic API configuration and environment variables.
  - 6.2.2: Implement core Anthropic service functions.
  - 6.2.3: Implement streaming response handling for Anthropic API.
  - 6.2.4: Add rate limiting and optimization for Anthropic API calls.
  - 6.2.5: Create API route handlers for Anthropic model interactions.
- /relative/path/of/changed/file: `lib/anthropic/service.ts`, `app/api/anthropic/...`
- Operation: Create

### Step 7: Ensemble Configuration Management (Derived from task_006.txt)

#### Detailed technical explanation

Implement functionality for users to create, save, and load configurations of multiple AI models (ensembles) to be used for solution generation.

#### Task Breakdown (task_006.txt)

##### SubTask 7.1: Design/Implement Ensemble Configuration UI [STATUS: Pending as per task_006.txt (Subtask 1)]

- Description: UI for selecting models, setting parameters (e.g., temperature), naming configurations.
- Operation: Create

##### SubTask 7.2: State Management for Ensemble Configurations [STATUS: Pending as per task_006.txt (Subtask 2)]

- Description: Manage state for creating/editing configurations.
- Operation: Create

##### SubTask 7.3: Supabase Integration for Saving/Loading Configurations [STATUS: Pending as per task_006.txt (Subtask 3)]

- Description: Save/load ensemble configurations to/from `ensemble_configurations` table in Supabase.
- Operation: Create

##### SubTask 7.4: Default and Quick Start Configurations [STATUS: Pending as per task_006.txt (Subtask 4)]

- Description: Provide default configurations.
- Operation: Create

### Step 8: Tech Stack Selection UI (Derived from task_007.txt)

#### Detailed technical explanation

Create an interface for users to select and configure target technology stack options (e.g., frontend framework, backend language, database) to guide AI solution generation.

#### Task Breakdown (task_007.txt)

##### SubTask 8.1: Categorized Tech Stack Selection UI Components [STATUS: Pending as per task_007.txt (Subtask 1)]

- Description: UI components for selecting tech stack options by category.
- Operation: Create

##### SubTask 8.2: State Management for Tech Stack Selection [STATUS: Pending as per task_007.txt (Subtask 2)]

- Description: Manage state of selected tech stack options.
- Operation: Create

##### SubTask 8.3: Save/Load Tech Stack Presets [STATUS: Pending as per task_007.txt (Subtask 3)]

- Description: Allow users to save/load preferred tech stack presets (using `tech_stack_options` table).
- Operation: Create

##### SubTask 8.4: Integrate Tech Stack Config with Prompt Generation [STATUS: Pending as per task_007.txt (Subtask 4)]

- Description: Ensure selected tech stack influences AI prompts.
- Operation: Update (Prompt logic)

### Step 9: Core AI Solution Generation Workflow (Derived from existing plan Step 5)

#### Detailed technical explanation

Orchestrate the process of taking a user's project (problem statement, language, criteria, tech stack), submitting it to the selected AI model(s)/ensemble, and retrieving the generated solutions.

#### Task Breakdown

##### SubTask 9.1: Solution Generation Request UI [STATUS: Pending]

- Description: Interface within a project to trigger solution generation, select AI model/ensemble, and confirm tech stack.
- Operation: Create

##### SubTask 9.2: Backend Orchestration Service [STATUS: Pending]

- Description: Service to manage requests to AI APIs (OpenAI, Anthropic) based on project details and configurations. Handle parallel requests if using ensembles.
- /relative/path/of/changed/file: `lib/ai/orchestrator.ts`
- Operation: Create

##### SubTask 9.3: Store Generated Solutions [STATUS: Pending]

- Description: Save retrieved AI solutions to the `code_solutions` table in Supabase, linking to the project and AI model used.
- Operation: Create (API/Service logic)

### Step 10: Code File Storage & Embedding Generation (Derived from task_012.txt)

#### Detailed technical explanation

Implement functionality to store user-uploaded or AI-generated code files in Supabase Storage and generate semantic embeddings for these files using OpenAI API for similarity search.

#### Task Breakdown (task_012.txt)

##### SubTask 10.1: Code File Storage in Supabase [STATUS: Pending as per task_012.txt (Subtask 1)]

- Description: Set up Supabase Storage buckets for code files. API routes for upload/retrieval.
- Operation: Create/Configure

##### SubTask 10.2: Embedding Generation and Storage [STATUS: Pending as per task_012.txt (Subtask 3)]

- Description: Generate embeddings for code files using OpenAI API and store them in the `embeddings` table (pgvector) in Supabase.
- Operation: Create

##### SubTask 10.3: Metadata Extraction and Versioning (Conceptual) [STATUS: Pending as per task_012.txt (Subtask 4)]

- Description: Plan for metadata extraction and code file versioning.
- Operation: Create

### Step 11: Semantic Search for Code Snippets (Derived from task_013.txt)

#### Detailed technical explanation

Implement embedding-based similarity search for users to find relevant code snippets or solutions stored in the system.

#### Task Breakdown (task_013.txt)

##### SubTask 11.1: Vector Similarity Search API [STATUS: Pending as per task_013.txt (Subtask 2)]

- Description: Backend API endpoint to take a search query, generate its embedding, and query Supabase (pgvector) for similar code snippet embeddings.
- /relative/path/of/changed/file: `app/api/search/code/route.ts`
- Operation: Create

##### SubTask 11.2: Search Ranking and Filtering Logic [STATUS: Pending as per task_013.txt (Subtask 3)]

- Description: Implement ranking for search results and filters (language, framework).
- Operation: Create

##### SubTask 11.3: Search Interface and Result Display [STATUS: Pending as per task_013.txt (Subtask 4)]

- Description: Frontend UI for code snippet search, displaying results with code previews. Implement caching.
- Operation: Create

### Step 12: Solution Pathway & Comparison Visualization (Derived from task_008.txt, task_009.txt, task_010.txt, task_011.txt, existing plan Step 7)

#### Detailed technical explanation

Develop UI for visualizing AI solution pathways and comparing solutions from different models side-by-side, potentially using 2D and 3D representations.

#### Task Breakdown

##### SubTask 12.1: Basic Solution Pathway Visualization (task_008.txt) [STATUS: Pending as per task_008.txt]

- Description: Design data model for pathways, implement solution card components with code highlighting, visualize step connections.
- Subtasks from task_008.txt:
  - 12.1.1: Design Solution Pathway Data Model and API Integration.
  - 12.1.2: Implement Solution Card Components with Code Highlighting.
  - 12.1.3: Visualize Step Connections and Pathways.
  - 12.1.4: Add Interactivity and Model Comparison Layout.
- Operation: Create

##### SubTask 12.2: Three.js/React Three Fiber Integration (task_009.txt) [STATUS: Pending as per task_009.txt]

- Description: Set up 3D visualization capabilities.
- Subtasks from task_009.txt:
  - 12.2.1: Install and Configure Three.js and React Three Fiber.
  - 12.2.2: Create Basic 3D Scene Components.
  - 12.2.3: Implement Camera Controls, Viewport Management, Reusable 3D Components.
  - 12.2.4: Optimize 3D Rendering Performance and Implement Responsive 3D Views.
- Operation: Create

##### SubTask 12.3: Enhance Pathway Visualization with Three.js (task_010.txt) [STATUS: Pending as per task_010.txt]

- Description: Improve pathway visualization using 3D for interactive displays, animations, model differentiation.
- Operation: Create

##### SubTask 12.4: Implement Solution Comparison Functionality (task_011.txt) [STATUS: Pending as per task_011.txt]

- Description: Side-by-side comparison view, code diff visualization, metrics display, highlighting strengths/weaknesses.
- Subtasks from task_011.txt:
  - 12.4.1: Develop Side-by-Side Solution Comparison UI.
  - 12.4.2: Implement Code Diff Visualization.
  - 12.4.3: Compute and Display Solution Comparison Metrics.
  - 12.4.4: Highlight Strengths and Weaknesses of Each Solution.
- Operation: Create

### Step 13: Solution Generation from Best Parts (Derived from task_014.txt)

#### Detailed technical explanation

Create advanced functionality to allow users to select the

### Step 16: Codebase File Structure (Derived from user-provided file tree)

#### Detailed technical explanation

This section outlines the overall file and directory structure of the Rivendell codebase. Understanding this structure is crucial for navigating the project, locating specific modules, and maintaining consistency as the project grows.

#### File Tree

```
├── .cursorignore
├── .gitignore
├── .vercelignore
├── __tests__
│   ├── .eslintrc.json
│   ├── basic.test.ts
│   ├── components
│   │   ├── monte-carlo
│   │   │   ├── model-filtering.test.tsx
│   │   │   └── utils.test.ts
│   │   ├── solution-card.test.tsx
│   │   └── ui
│   │       ├── code-block.test.tsx
│   │       └── test-metadata.test.tsx
│   ├── lib
│   │   ├── codefile-service.test.ts
│   │   ├── embedding-service.test.ts
│   │   ├── integration-tests.test.ts
│   │   └── integration.test.ts
│   ├── log.txt
│   └── setup.ts
├── ai_docs
├── app
│   ├── api
│   │   ├── anthropic
│   │   │   └── route.ts
│   │   ├── batch-add-sample-code
│   │   │   └── route.ts
│   │   ├── check-database
│   │   │   ├── match-test
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── code-snippets
│   │   │   └── route.ts
│   │   ├── create-sample-code
│   │   │   └── route.ts
│   │   ├── create-test-documents
│   │   │   └── route.ts
│   │   ├── debug
│   │   │   └── route.ts
│   │   ├── debug-steps
│   │   │   └── route.ts
│   │   ├── delete-batch
│   │   │   └── route.ts
│   │   ├── embeddings
│   │   │   └── route.ts
│   │   ├── evaluate
│   │   │   └── route.ts
│   │   ├── fallback.ts
│   │   ├── fix-codefiles
│   │   │   └── route.ts
│   │   ├── fix-json-parsing
│   │   │   └── route.ts
│   │   ├── gantt-data
│   │   │   └── route.ts
│   │   ├── list-documents-without-code
│   │   │   └── route.ts
│   │   ├── migrate-codefiles
│   │   │   └── route.ts
│   │   ├── openai
│   │   │   └── route.ts
│   │   ├── search-codefiles
│   │   │   └── route.ts
│   │   ├── sentry-example-api
│   │   │   └── route.ts
│   │   ├── similar-solutions
│   │   │   └── route.ts
│   │   ├── solution-explanation
│   │   │   └── route.ts
│   │   ├── structured-solution
│   │   │   └── route.ts
│   │   └── validate-codefiles
│   │       └── route.ts
│   ├── code-example
│   │   └── page.tsx
│   ├── code-fixer
│   │   └── page.tsx
│   ├── debug-path-connections
│   │   └── page.tsx
│   ├── debug-paths
│   │   └── page.tsx
│   ├── gantt
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── global-error.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── lib
│   │   ├── port-detection.ts
│   │   ├── prompts
│   │   │   ├── anthropic-prompt.ts
│   │   │   ├── index.ts
│   │   │   └── openai-prompt.ts
│   │   └── utils.ts
│   ├── monte-carlo
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── page.tsx
│   ├── silence-warnings.js
│   └── test-metadata
│       └── page.tsx
├── codex.md
├── components
│   ├── code-file-provider.tsx
│   ├── code-snippets-search.tsx
│   ├── connection-styles.tsx
│   ├── debug-path-connections.tsx
│   ├── ensemble-config-card.tsx
│   ├── ensemble-selection-modal.tsx
│   ├── error-boundary.tsx
│   ├── final-solution-card.tsx
│   ├── fixed-path-line.tsx
│   ├── highlight-path-line.tsx
│   ├── hooks
│   │   ├── use-expandable.ts
│   │   ├── use-expandable.tsx
│   │   └── use-solution-code.ts
│   ├── lines-container.tsx
│   ├── monte-carlo
│   │   ├── batch-selection-panel.tsx
│   │   ├── BatchSelectionSidebar.tsx
│   │   ├── DetailCard.tsx
│   │   ├── details-panel.tsx
│   │   ├── DetailsPanel.tsx
│   │   ├── DynamicAxisLabels.tsx
│   │   ├── hooks
│   │   │   ├── use-monte-carlo-data.ts
│   │   │   ├── useCameraAndControls.ts
│   │   │   ├── useMonteCarloData.ts
│   │   │   └── useVisualizationState.ts
│   │   ├── ModelLegend.tsx
│   │   ├── PointLabels.tsx
│   │   ├── Points.tsx
│   │   ├── scene
│   │   │   ├── cluster-cubes.tsx
│   │   │   ├── connection-lines.tsx
│   │   │   ├── dynamic-axis-labels.tsx
│   │   │   ├── point-labels.tsx
│   │   │   ├── points.tsx
│   │   │   ├── scene.tsx
│   │   │   └── webgl-context-lost-manager.tsx
│   │   ├── utils.ts
│   │   └── visualization-canvas.tsx
│   ├── monte-carlo-visualizer.tsx
│   ├── nav-tabs.tsx
│   ├── navigation-tabs.tsx
│   ├── path-line.tsx
│   ├── pathway-visualizer.tsx
│   ├── similar-solutions-section.tsx
│   ├── solution-card-fixed.tsx
│   ├── solution-card.tsx
│   ├── solution-code-modal.tsx
│   ├── step-carousel.tsx
│   ├── step-connection-manager.tsx
│   ├── tech-stack-card.tsx
│   ├── tech-stack-modal.tsx
│   └── ui
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── code-block-demo.tsx
│       ├── code-block.tsx
│       ├── context-menu.tsx
│       ├── demo-gantt.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── gantt-client-wrapper.tsx
│       ├── gantt.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── switch.tsx
│       ├── tabs.tsx
│       ├── test-metadata.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── tooltip.tsx
│       ├── use-toast.ts
│       └── weekly-gantt.tsx
├── components.json
├── debug-findings.md
├── debug-path-connections.js
├── debug-paths.js
├── debug-selection.js
├── debugger.html
├── docs
│   ├── 00001_initial_rivendell.sql
│   ├── CHANGELOG.md
│   ├── changelogs
│   │   ├── 04-21-2025-19:12.md
│   │   ├── 04-21-2025-19:45.md
│   │   ├── 04-21-2025-19:48.md
│   │   ├── 04-21-2025-19:55.md
│   │   ├── 04-22-2025-14:36.md
│   │   ├── 04-22-2025-18:26.md
│   │   ├── 04-22-2025-18:33.md
│   │   ├── 04-22-2025-18:36.md
│   │   ├── 04-22-2025-18:41.md
│   │   ├── 04-22-2025-18:44.md
│   │   ├── 04-22-2025-18:48.md
│   │   ├── 04-22-2025-18:52.md
│   │   ├── 04-22-2025-19:12.md
│   │   ├── 04-22-2025-19:21.md
│   │   ├── 04-22-2025-19:31.md
│   │   ├── 04-22-2025-19:40.md
│   │   ├── 04-22-2025-19:45.md
│   │   ├── 04-22-2025-19:55.md
│   │   ├── 04-22-2025-22:30.md
│   │   ├── 04-22-2025-22:45.md
│   │   ├── 04-22-2025-23:15.md
│   │   ├── 04-23-2025-00:15.md
│   │   ├── 04-23-2025-00:45.md
│   │   ├── 04-23-2025-01:15.md
│   │   ├── 04-29-2025-06:35.md
│   │   ├── 05-09-2025-10:00.md
│   │   ├── 05-09-2025-10:30.md
│   │   ├── 05-09-2025-11:00.md
│   │   ├── 05-09-2025-11:30.md
│   │   └── 05-09-2025-12:00.md
│   ├── deployment.md
│   ├── IMPLEMENTATION_NOTES.md
│   ├── MONTE_CARLO_REFACTOR.md
│   └── schema.md
├── environment.md
├── eslint.config.mjs
├── instrumentation.js
├── jest.config.js
├── lib
│   ├── ai-service.ts
│   ├── codefile-service.ts
│   ├── document-service.ts
│   ├── embedding-service.ts
│   ├── ensemble-service.ts
│   ├── error-reporting.ts
│   ├── metrics-utils.ts
│   ├── monte-carlo-service.ts
│   ├── step-service.ts
│   ├── supabase-client.ts
│   ├── tech-stack-service.ts
│   ├── types
│   │   ├── database.types.ts
│   │   ├── json-parse-even-better-errors.d.ts
│   │   └── lodash.throttle.d.ts
│   ├── utils.ts
│   └── zod-schemas.ts
├── LICENSE
├── monte-carlo-debug.js
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── PRD.md
├── public
│   ├── favicon.ico
│   ├── file.svg
│   ├── fonts
│   │   └── .gitkeep
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README-task-master.md
├── README.md
├── rivendell-files
│   ├── .cursorignore
│   ├── .gitignore
│   ├── .vercelignore
│   ├── codex.md
│   ├── public
│   │   ├── favicon.ico
│   │   ├── file.svg
│   │   ├── fonts
│   │   │   └── .gitkeep
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   ├── README-task-master.md
│   ├── scripts
│   │   ├── deploy-vercel.js
│   │   ├── example_prd.txt
│   │   └── prd.txt
│   ├── supabase
│   │   ├── .branches
│   │   │   └── _current_branch
│   │   ├── config.toml
│   │   ├── migrations
│   │   │   └── 00001_initial_rivendell.sql
│   │   └── schema.md
│   ├── tools
│   │   └── screenshot.js
│   └── vercel.json
├── scripts
│   ├── deploy-vercel.js
│   ├── example_prd.txt
│   └── prd.txt
├── sentry.client.config.js
├── sentry.edge.config.js
├── sentry.edge.config.ts.backup
├── sentry.server.config.js
├── sentry.server.config.ts.backup
├── supabase
│   ├── .gitignore
│   ├── config.toml
│   └── migrations
│       └── 20250429165355_remote_schema.sql
├── system-diagram.svg
├── tailwind.config.ts
├── tools
│   └── screenshot.js
├── tsconfig.json
├── turbo.config.ts
├── vercel.json
└── vitest.config.ts
```

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

### Key Directories and Their Purpose

- **`/app`**: Contains all application routes, layouts, and pages, following the Next.js App Router conventions.
  - **`/app/(auth)`**: Routes related to user authentication (sign-in, sign-up).
  - **`/app/(dashboard)`**: Protected routes accessible after user authentication, forming the main application area.
  - **`/app/api`**: API route handlers for backend logic, interacting with Supabase and AI services.
- **`/components`**: Reusable React components used throughout the application.
  - **`/components/auth`**: Authentication-specific UI components.
  - **`/components/dashboard`**: Components used within the main dashboard sections.
  - **`/components/layout`**: Global layout components like Header, Sidebar, Footer.
  - **`/components/three`**: Components related to 3D visualizations using Three.js and React Three Fiber.
  - **`/components/ui`**: UI primitives and components, likely from Shadcn/UI.
- **`/lib`**: Utility functions, service integrations, type definitions, and other shared logic.
  - **`/lib/ai-service.ts`**: Logic for interacting with AI models (OpenAI, Anthropic).
  - **`/lib/supabase-client.ts`**: Supabase client initialization and helper functions.
  - **`/lib/types`**: TypeScript type definitions, including generated Supabase types.
- **`/public`**: Static assets like images, fonts, and icons.
- **`/docs`**: Project documentation, including database schema files, changelogs, and implementation notes.
- **`/supabase`**: Supabase local development configuration and migration files.
- **Configuration Files (Root)**: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `prettierrc.json`, etc., for project setup and tooling.

This structure promotes modularity and separation of concerns, making the codebase easier to understand, maintain, and scale.

---

(The rest of the action plan steps will follow, ensuring this new section is logically placed, likely towards the end or as a dedicated appendix.)

## Development Roadmap

### Phase 1: Core Functionality

- Implement basic UI components and layout
- Set up API routes for OpenAI and Anthropic
- Create ensemble configuration management
- Implement tech stack selection UI
- Set up basic visualization of solution pathways

### Phase 2: Enhanced Visualization

- Improve pathway visualization with Three.js
- Implement interactive solution comparison
- Add solution cards with code highlighting
- Create modal views for detailed solution examination
- Implement step connections for visualizing solution paths

### Phase 3: Code Management & Search

- Implement code file storage and retrieval
- Create embedding generation and storage
- Build semantic search functionality for code snippets
- Add similar solutions section
- Implement code validation and syntax highlighting

### Phase 4: Performance & Polish

- Optimize API calls and database queries
- Implement caching strategies for improved performance
- Add error handling and recovery mechanisms
- Improve accessibility and responsive design
- Implement user feedback mechanisms

## Logical Dependency Chain

- Set up Next.js foundation with Tailwind and TypeScript
- Implement basic UI components before complex visualizations
- Establish API integrations before implementing ensemble features
- Create data models and storage before implementing search functionality
- Implement core visualization before adding interactive features
- Focus on functionality first, then performance optimizations

## Risks and Mitigations

- API Cost Management: Implement rate limiting and usage tracking
- Complex Visualization Performance: Use optimized Three.js techniques and lazy loading
- Data Storage Scalability: Implement efficient embedding storage and retrieval
- Browser Compatibility: Use polyfills and feature detection for broad support
- Error Handling: Implement robust error boundaries and fallback mechanisms

## Appendix

- API Documentation:
  - OpenAI API: https://platform.openai.com/docs/api-reference
  - Anthropic API: https://docs.anthropic.com/claude/reference
- Technologies:
  - Next.js: https://nextjs.org/docs
  - Tailwind CSS: https://tailwindcss.com/docs
  - Three.js: https://threejs.org/docs
  - Supabase: https://supabase.com/docs

### 1.1 Vision Statement

Create a comprehensive AI development tool that functions as "version control for reasoning" - allowing developers to generate multiple AI-powered code solutions, compare their effectiveness, and merge the best parts into an optimized final product.

### 1.2 Objectives

- Enable parallel generation of diverse coding solutions from multiple AI models
- Provide objective metrics for comparing solution quality
- Create an intuitive interface for merging preferred parts of different solutions
- Track reasoning processes that led to each solution
- Gamify the process to incentivize high-quality outputs
- Support both internal developers and external clients
- Make AI development more deterministic and transparent

### 1.3 Key Differentiators

- Parallel AI solution generation and comparison
- Reasoning version control
- Interactive merging interface
- Objective quality metrics
- Secure sandboxed execution
- Performance analytics by model and problem type

## 2. Target Audience

### 2.1 User Personas

- **Internal Developers**: Engineers working within the company who need to rapidly prototype and optimize code solutions
- **External Clients**: Organizations leveraging the tool to improve their own AI-powered development
- **AI Engineers**: Specialists focusing on improving prompt engineering and AI architecture
- **Project Managers**: Overseeing development and requiring insight into solution quality

### 2.2 Use Cases

- Developing new features efficiently
- Optimizing existing code
- Solving complex algorithmic problems
- Evaluating different AI approaches to the same problem
- Learning from different solution strategies
- Creating more maintainable and efficient code

## 3. Domain Model

### 3.1 Core Domains

#### 3.1.1 User Domain

```typescript
interface User {
  id: string;
  email: string;
  password: string; // Hashed
  userType: "internal" | "client";
  createdAt: Date;
  updatedAt: Date;
  projects: Project[];
  preferences: UserPreferences;
}

interface UserPreferences {
  defaultLanguage: "javascript" | "typescript" | "python";
  preferredAiModels: string[];
  uiSettings: {
    theme: "light" | "dark" | "system";
    codeEditorSettings: CodeEditorSettings;
  };
}
```

#### 3.1.2 Project Domain

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  owner: User;
  collaborators: User[];
  createdAt: Date;
  updatedAt: Date;
  problemStatement: string;
  originalCode?: string;
  language: "javascript" | "typescript" | "python";
  evaluationCriteria: EvaluationCriteria;
  testCases: TestCase[];
  solutions: Solution[];
  mergedSolution?: MergedSolution;
  status: "draft" | "processing" | "reviewing" | "completed";
}

interface EvaluationCriteria {
  prioritizeExecutionTime: boolean;
  prioritizeMemoryUsage: boolean;
  prioritizeCodeComplexity: boolean;
  prioritizeLinesOfCode: boolean;
  prioritizeDependencyCounts: boolean;
  customCriteria: { name: string; weight: number }[];
}

interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput: string;
  timeoutMs: number;
}
```

#### 3.1.3 Solution Domain

```typescript
interface Solution {
  id: string;
  projectId: string;
  aiModel: string;
  prompt: string;
  generatedCode: string;
  reasoning: string[];
  executionMetrics: ExecutionMetrics;
  staticAnalysis: StaticAnalysisResult;
  testResults: TestResult[];
  score: number;
  selectedLineRanges: LineRange[];
  createdAt: Date;
}

interface ExecutionMetrics {
  executionTimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent: number;
}

interface StaticAnalysisResult {
  complexity: number;
  linesOfCode: number;
  warnings: StaticWarning[];
  dependencyCounts: number;
  maintainabilityIndex: number;
}

interface StaticWarning {
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
  lineNumber: number;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  executionTimeMs: number;
  memoryUsageBytes: number;
  error?: string;
}

interface LineRange {
  startLine: number;
  endLine: number;
}
```

#### 3.1.4 Merged Solution Domain

```typescript
interface MergedSolution {
  id: string;
  projectId: string;
  code: string;
  contributors: {
    solutionId: string;
    aiModel: string;
    lineRanges: LineRange[];
    contributionPercentage: number;
  }[];
  executionMetrics: ExecutionMetrics;
  staticAnalysis: StaticAnalysisResult;
  testResults: TestResult[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
```

#### 3.1.5 Analytics Domain

```typescript
interface AnalyticsData {
  aiModelPerformance: {
    modelId: string;
    problemsSolved: number;
    averageScore: number;
    contributionRate: number;
    performanceByProblemType: Record<string, number>;
  }[];
  userActivity: {
    userId: string;
    projectsCreated: number;
    solutionsReviewed: number;
    timeSpentMerging: number;
  }[];
  systemPerformance: {
    averageProcessingTime: number;
    concurrentProjects: number;
    sandboxUtilization: number;
  };
}
```

## 4. Feature Specifications

### 4.1 User Authentication & Management

#### 4.1.1 User Registration and Login

- Standard email/password authentication
- User profile with preferences and settings
- Distinction between internal and client users

**Acceptance Criteria:**

- Users can register with email and password
- Email verification process
- Password recovery functionality
- Profile management interface
- User type assignment (internal/client)

### 4.2 Project Management

#### 4.2.1 Project Creation

- Create new projects with a problem statement
- Option to upload existing code for optimization
- Define language and evaluation criteria
- Create test cases for validation

**Acceptance Criteria:**

- Users can create projects with all required fields
- Support for uploading existing code files
- Language selection (JavaScript, TypeScript, Python)
- Custom evaluation criteria configuration
- Test case creation interface
- Project dashboard showing all user projects

### 4.3 AI Solution Generation

#### 4.3.1 Parallel AI Processing

- Submit problem statement to multiple AI models
- Process and normalize AI responses
- Execute generated code in sandbox environments
- Collect performance metrics and test results

**Acceptance Criteria:**

- Integration with at least 3 AI models initially
- Parallel processing of AI responses
- Standardized solution format across models
- Proper error handling for failed generations
- Maximum wait time of 60 seconds for solution generation

#### 4.3.2 Secure Sandbox Execution

- Execute code in isolated environments
- Run against provided test cases
- Collect objective metrics
- Static analysis for code quality

**Acceptance Criteria:**

- Secure execution with resource limits
- Support for all target languages
- Complete test suite execution
- Collection of all specified metrics
- Static analysis integration

### 4.4 Solution Comparison and Merging

#### 4.4.1 Diff and Merge Interface

- Side-by-side comparison of solutions
- Syntax-highlighted code display
- Performance metrics visualization
- Interactive selection and merging tools

**Acceptance Criteria:**

- Display up to 4 solutions simultaneously
- Color-coded performance metrics
- Line-by-line selection capability
- Conflict resolution tools
- Real-time merged solution preview
- Editing capability for manual adjustments

#### 4.4.2 Reasoning Tracking

- Display AI reasoning process
- Track which reasoning led to which code
- Version control for selected reasoning paths

**Acceptance Criteria:**

- Clear visualization of AI reasoning steps
- Connection between reasoning and code segments
- Ability to compare reasoning approaches
- Preservation of reasoning history across versions

### 4.5 Analytics and Scoring

#### 4.5.1 Performance Analytics

- Track AI model performance over time
- Analyze effectiveness by problem type
- Monitor user modification patterns
- Generate insights for AI improvement

**Acceptance Criteria:**

- Comprehensive analytics dashboard
- Filtering by time period, model, and problem type
- Exportable reports
- Trend visualization
- Actionable insights presentation

#### 4.5.2 Gamification System

- Score AI solutions based on selection rate
- Complex scoring algorithm considering multiple factors
- Leaderboard of AI model performance
- Historical performance tracking

**Acceptance Criteria:**

- Clear scoring system with transparent metrics
- Dynamic leaderboard updating
- Historical performance graphs
- Score breakdown by evaluation criteria

### 4.6 Integration Features

#### 4.6.1 Version Control Integration

- GitHub/GitLab integration
- Push/pull from existing repositories
- Commit history tracking
- Branch management

**Acceptance Criteria:**

- Connect to GitHub/GitLab accounts
- Repository selection interface
- Ability to push merged solutions
- Proper commit message generation
- Branch selection and creation

## 5. Technical Architecture

### 5.1 Frontend Architecture

#### 5.1.1 Technology Stack

- React with TypeScript
- Tailwind CSS for styling
- shadcn UI for component library
- Code editor component (Monaco or CodeMirror)
- Diff viewer component
- Chart.js for analytics visualization

#### 5.1.2 Key Components

```typescript
// Example component structure
interface AppComponents {
  auth: {
    LoginForm: React.FC;
    RegistrationForm: React.FC;
    ProfileManager: React.FC;
  };
  projects: {
    ProjectList: React.FC;
    ProjectCreator: React.FC;
    ProjectDetail: React.FC;
    TestCaseEditor: React.FC;
  };
  solutions: {
    SolutionComparer: React.FC;
    DiffViewer: React.FC;
    MergeTool: React.FC;
    ReasoningViewer: React.FC;
    MetricsDisplay: React.FC;
  };
  analytics: {
    Dashboard: React.FC;
    PerformanceCharts: React.FC;
    ModelComparison: React.FC;
    ScoreboardDisplay: React.FC;
  };
}
```

### 5.2 Backend Architecture

#### 5.2.1 API Layer

- RESTful API with Express
- GraphQL API for complex queries
- Authentication middleware
- Rate limiting
- CORS configuration

#### 5.2.2 Service Layer

```typescript
// Example service interfaces
interface Services {
  authService: {
    registerUser(
      email: string,
      password: string,
      userType: string
    ): Promise<User>;
    authenticateUser(email: string, password: string): Promise<AuthToken>;
    resetPassword(email: string): Promise<void>;
  };
  projectService: {
    createProject(projectData: ProjectInput, userId: string): Promise<Project>;
    getProjects(userId: string): Promise<Project[]>;
    getProjectById(projectId: string): Promise<Project>;
    updateProject(
      projectId: string,
      updates: Partial<Project>
    ): Promise<Project>;
  };
  aiService: {
    generateSolutions(projectId: string): Promise<Solution[]>;
    querySingleModel(modelId: string, prompt: string): Promise<Solution>;
    optimizePrompt(originalPrompt: string): Promise<string>;
  };
  sandboxService: {
    executeCode(
      code: string,
      language: string,
      testCases: TestCase[]
    ): Promise<ExecutionResult>;
    performStaticAnalysis(
      code: string,
      language: string
    ): Promise<StaticAnalysisResult>;
  };
  mergeService: {
    createMergedSolution(
      projectId: string,
      selectedRanges: Record<string, LineRange[]>
    ): Promise<MergedSolution>;
    updateMergedSolution(
      mergedSolutionId: string,
      updates: Partial<MergedSolution>
    ): Promise<MergedSolution>;
  };
  analyticsService: {
    getModelPerformance(
      filters?: AnalyticsFilters
    ): Promise<ModelPerformance[]>;
    getUserActivity(userId: string): Promise<UserActivity>;
    getSystemMetrics(): Promise<SystemMetrics>;
  };
}
```

#### 5.2.3 Database Schema

- PostgreSQL for relational data
- Redis for caching and real-time features

### 5.3 AI Integration Architecture

#### 5.3.1 Model Connectors

- OpenAI API integration
- Anthropic API integration
- Other model integrations
- Standardization layer for consistent I/O

#### 5.3.2 Prompt Management

- Template system
- Dynamic prompt generation
- Context handling
- Optimization strategies

### 5.4 Sandbox Architecture

#### 5.4.1 Execution Environments

- Docker containers for isolation
- Language-specific runtimes
- Resource monitoring and limiting
- Security scanning

## 6. UI Design Principles

### 6.1 Layout and Navigation

- Clean, professional interface
- Sidebar navigation for main sections
- Context-aware action buttons
- Progressive disclosure for complex features

### 6.2 Solution Comparison Interface

- Side-by-side code panels
- Collapsible sections for metrics and details
- Syntax highlighting
- Line-by-line selection tools
- Visual cues for performance differences

### 6.3 Analytics Dashboard

- Clean data visualization
- Filters for different views
- Drill-down capability
- Exportable reports
- Interactive charts

## 7. Security Considerations

### 7.1 Code Execution Security

- Strict isolation of execution environments
- Resource limits to prevent DOS attacks
- Code scanning for malicious patterns
- Timeout enforcement
- No network access in sandboxes

### 7.2 Authentication Security

- Secure password storage (bcrypt)
- Rate limiting on authentication attempts
- Session management
- CSRF protection
- XSS prevention

### 7.3 Data Security

- Encryption of sensitive data
- Access controls based on user type
- Audit logging
- Regular security reviews

## 8. Development Phases

### 8.1 Phase 1: Foundation (Months 1-3)

- User authentication system
- Basic project creation and management
- Integration with 2-3 key AI models
- Simple sandboxed execution environment
- Basic diff view for comparing solutions
- Deployment infrastructure on Vercel

**Milestone Deliverables:**

- Functional authentication system
- Project CRUD operations
- Initial AI model integration
- Basic code execution sandbox
- Simple solution comparison UI
- Deployment pipeline

### 8.2 Phase 2: Core Functionality (Months 4-6)

- Enhanced code editor and merge interface
- Expanded language support
- More sophisticated metrics and analysis
- Integration with GitHub/GitLab
- Basic analytics dashboard

**Milestone Deliverables:**

- Full-featured diff and merge interface
- Support for all target languages
- Comprehensive metrics collection
- Working VCS integration
- Initial analytics implementation

### 8.3 Phase 3: Advanced Features (Months 7-9)

- Complex scoring and gamification system
- AI-driven solution recommendation system
- Advanced reasoning visualization
- Performance optimization
- Extended API for integrations

**Milestone Deliverables:**

- Complete gamification system
- Intelligent merge recommendations
- Interactive reasoning visualization
- Optimized system performance
- Public API documentation

### 8.4 Phase 4: Enterprise Features (Months 10-12)

- Team collaboration features
- Advanced access controls
- Custom AI model integration
- White-labeling options for clients
- Enterprise reporting and analytics

**Milestone Deliverables:**

- Multi-user collaboration tools
- Role-based access control
- Custom model integration framework
- White-labeling system
- Enterprise reporting dashboard

## 9. Potential Challenges and Solutions

### 9.1 Technical Challenges

#### 9.1.1 Secure Code Execution

**Challenge:** Executing unknown code securely while collecting accurate metrics
**Solution:**

- Implement strict containerization with resource limits
- Pre-scan code for malicious patterns
- Use proven sandbox technologies with proper isolation

#### 9.1.2 Solution Comparison Complexity

**Challenge:** Creating an intuitive interface for comparing multiple solutions
**Solution:**

- Implement progressive disclosure for complex features
- Use visual aids to highlight differences
- Provide intelligent default selections
- Allow customizable views based on user preferences

#### 9.1.3 AI Model Consistency

**Challenge:** Different AI models produce varying output formats
**Solution:**

- Create a standardization layer for model outputs
- Implement robust parsing for different response formats
- Define clear prompt templates for consistency

### 9.2 User Experience Challenges

#### 9.2.1 Learning Curve

**Challenge:** Complex features may intimidate new users
**Solution:**

- Implement guided tours for first-time users
- Create progressive onboarding experiences
- Provide clear documentation and examples
- Start with simplified views and expand

#### 9.2.2 Performance Perception

**Challenge:** Users may perceive slowness during AI processing
**Solution:**

- Implement background processing with status updates
- Show interesting intermediate results
- Provide estimated completion times
- Optimize critical rendering paths

## 10. Future Expansion Possibilities

### 10.1 Additional Languages

- Support for additional programming languages
- Domain-specific language support
- Natural language processing capabilities

### 10.2 Advanced Collaboration

- Real-time collaborative editing
- Team workspaces
- Role-based permissions
- Commenting and review systems

### 10.3 Learning System

- AI improvement based on user selections
- Custom model fine-tuning
- Learning from historical project patterns

### 10.4 Enterprise Integration

- Integration with CI/CD pipelines
- Custom workflow support
- Enterprise SSO integration
- Advanced compliance features

## 11. Technical Implementation Examples

### 11.1 Project Creation Component

```tsx
// ProjectCreator.tsx
import { useState } from "react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { useProjectService } from "@/hooks/useProjectService";

const ProjectCreator: React.FC = () => {
  const [projectData, setProjectData] = useState({
    name: "",
    description: "",
    language: "typescript",
    problemStatement: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const { createProject, isLoading, error } = useProjectService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("projectData", JSON.stringify(projectData));
      if (file) {
        formData.append("codeFile", file);
      }

      await createProject(formData);
      // Handle success, redirect, etc.
    } catch (err) {
      // Handle error
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <Input
              id="name"
              value={projectData.name}
              onChange={(e) =>
                setProjectData({ ...projectData, name: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-1"
            >
              Description
            </label>
            <Textarea
              id="description"
              value={projectData.description}
              onChange={(e) =>
                setProjectData({ ...projectData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium mb-1"
            >
              Programming Language
            </label>
            <Select
              id="language"
              value={projectData.language}
              onValueChange={(value) =>
                setProjectData({ ...projectData, language: value })
              }
            >
              <Select.Option value="javascript">JavaScript</Select.Option>
              <Select.Option value="typescript">TypeScript</Select.Option>
              <Select.Option value="python">Python</Select.Option>
            </Select>
          </div>

          <div>
            <label
              htmlFor="problemStatement"
              className="block text-sm font-medium mb-1"
            >
              Problem Statement
            </label>
            <Textarea
              id="problemStatement"
              value={projectData.problemStatement}
              onChange={(e) =>
                setProjectData({
                  ...projectData,
                  problemStatement: e.target.value,
                })
              }
              rows={5}
              required
              placeholder="Describe the problem or task you want the AI to solve..."
            />
          </div>

          <div>
            <label
              htmlFor="codeFile"
              className="block text-sm font-medium mb-1"
            >
              Existing Code (Optional)
            </label>
            <Input
              id="codeFile"
              type="file"
              accept=".js,.ts,.py"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload existing code for optimization or extension
            </p>
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProjectCreator;
```

### 11.2 Solution Comparison Component

```tsx
// SolutionComparer.tsx
import { useState, useEffect } from "react";
import { useMergeService } from "@/hooks/useMergeService";
import { Button, Tabs, Card } from "@/components/ui";
import { CodeEditor } from "@/components/CodeEditor";
import { MetricsDisplay } from "@/components/MetricsDisplay";
import { ReasoningViewer } from "@/components/ReasoningViewer";

interface SolutionComparerProps {
  projectId: string;
  solutions: Solution[];
}

const SolutionComparer: React.FC<SolutionComparerProps> = ({
  projectId,
  solutions,
}) => {
  const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<
    Record<string, LineRange[]>
  >({});
  const [mergedCode, setMergedCode] = useState("");
  const { createMergedSolution, isLoading } = useMergeService();

  // Toggle solution selection
  const toggleSolution = (solutionId: string) => {
    if (selectedSolutions.includes(solutionId)) {
      setSelectedSolutions(selectedSolutions.filter((id) => id !== solutionId));
    } else if (selectedSolutions.length < 4) {
      setSelectedSolutions([...selectedSolutions, solutionId]);
    }
  };

  // Handle range selection in a specific solution
  const handleRangeSelect = (solutionId: string, range: LineRange) => {
    const currentRanges = selectedRanges[solutionId] || [];
    setSelectedRanges({
      ...selectedRanges,
      [solutionId]: [...currentRanges, range],
    });
  };

  // Create merged solution
  const handleCreateMerge = async () => {
    try {
      const result = await createMergedSolution(projectId, selectedRanges);
      setMergedCode(result.code);
    } catch (err) {
      // Handle error
    }
  };

  const filteredSolutions = solutions.filter((s) =>
    selectedSolutions.includes(s.id)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Available Solutions</h3>
        <div className="flex flex-wrap gap-2">
          {solutions.map((solution) => (
            <Button
              key={solution.id}
              variant={
                selectedSolutions.includes(solution.id) ? "default" : "outline"
              }
              onClick={() => toggleSolution(solution.id)}
              className="flex items-center gap-2"
            >
              <span>{solution.aiModel}</span>
              <span className="bg-gray-100 text-xs px-2 py-0.5 rounded-full">
                Score: {solution.score}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSolutions.map((solution) => (
          <Card key={solution.id} className="overflow-hidden">
            <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <span className="font-medium">{solution.aiModel}</span>
                <span className="text-xs text-gray-500 ml-2">
                  Score: {solution.score}
                </span>
              </div>
              <Tabs defaultValue="code">
                <Tabs.List>
                  <Tabs.Trigger value="code">Code</Tabs.Trigger>
                  <Tabs.Trigger value="metrics">Metrics</Tabs.Trigger>
                  <Tabs.Trigger value="reasoning">Reasoning</Tabs.Trigger>
                </Tabs.List>
              </Tabs>
            </div>

            <Tabs.Content value="code" className="p-0">
              <CodeEditor
                code={solution.generatedCode}
                language={solutions[0].language}
                onRangeSelect={(range) => handleRangeSelect(solution.id, range)}
                highlightRanges={selectedRanges[solution.id] || []}
                readonly
              />
            </Tabs.Content>

            <Tabs.Content value="metrics">
              <MetricsDisplay
                metrics={solution.executionMetrics}
                staticAnalysis={solution.staticAnalysis}
              />
            </Tabs.Content>

            <Tabs.Content value="reasoning">
              <ReasoningViewer reasoning={solution.reasoning} />
            </Tabs.Content>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="p-3 bg-gray-50 border-b">
          <h3 className="font-medium">Merged Solution</h3>
        </div>
        <div className="p-4">
          <CodeEditor
            code={mergedCode}
            language={solutions[0].language}
            readonly={false}
          />
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleCreateMerge}
              disabled={isLoading || Object.keys(selectedRanges).length === 0}
            >
              {isLoading ? "Creating..." : "Create Merged Solution"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SolutionComparer;
```

### 11.3 Backend Service Example

````typescript
// aiService.ts
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { Solution, Project, TestCase } from "@/types";
import { SandboxService } from "./sandboxService";

export class AiService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private sandboxService: SandboxService;

  constructor(
    openaiApiKey: string,
    anthropicApiKey: string,
    sandboxService: SandboxService
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.sandboxService = sandboxService;
  }

  async generateSolutions(project: Project): Promise<Solution[]> {
    // Define which models to use
    const models = [
      { id: "gpt-4", provider: "openai" },
      { id: "claude-3", provider: "anthropic" },
      // Add more models as needed
    ];

    // Generate solutions in parallel
    const solutionPromises = models.map((model) =>
      this.generateSingleSolution(model, project)
    );

    return Promise.all(solutionPromises);
  }

  private async generateSingleSolution(
    model: { id: string; provider: string },
    project: Project
  ): Promise<Solution> {
    // Construct the prompt
    const prompt = this.constructPrompt(project, model.id);

    // Generate code from the appropriate provider
    let generatedCode: string;
    let reasoning: string[];

    try {
      if (model.provider === "openai") {
        const response = await this.openai.chat.completions.create({
          model: model.id,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        generatedCode = response.choices[0].message.content || "";
        reasoning = this.extractReasoning(
          response.choices[0].message.content || ""
        );
      } else if (model.provider === "anthropic") {
        const response = await this.anthropic.messages.create({
          model: model.id,
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        });
        generatedCode = response.content[0].text || "";
        reasoning = this.extractReasoning(response.content[0].text || "");
      } else {
        throw new Error(`Unsupported provider: ${model.provider}`);
      }

      // Execute the code and get metrics
      const executionResult = await this.sandboxService.executeCode(
        generatedCode,
        project.language,
        project.testCases
      );

      // Perform static analysis
      const staticAnalysis = await this.sandboxService.performStaticAnalysis(
        generatedCode,
        project.language
      );

      // Calculate score based on metrics and project criteria
      const score = this.calculateScore(
        executionResult,
        staticAnalysis,
        project.evaluationCriteria
      );

      return {
        id: `${model.provider}-${model.id}-${Date.now()}`,
        projectId: project.id,
        aiModel: model.id,
        prompt,
        generatedCode,
        reasoning,
        executionMetrics: executionResult.metrics,
        staticAnalysis,
        testResults: executionResult.testResults,
        score,
        selectedLineRanges: [],
        createdAt: new Date(),
      };
    } catch (error) {
      console.error(`Error generating solution with ${model.id}:`, error);
      // Return a solution object with error information
      return {
        id: `${model.provider}-${model.id}-${Date.now()}`,
        projectId: project.id,
        aiModel: model.id,
        prompt,
        generatedCode: "// Error generating code",
        reasoning: [`Error: ${error.message}`],
        executionMetrics: {
          executionTimeMs: 0,
          memoryUsageBytes: 0,
          cpuUsagePercent: 0,
        },
        staticAnalysis: {
          complexity: 0,
          linesOfCode: 0,
          warnings: [],
          dependencyCounts: 0,
          maintainabilityIndex: 0,
        },
        testResults: [],
        score: 0,
        selectedLineRanges: [],
        createdAt: new Date(),
      };
    }
  }

  private constructPrompt(project: Project, modelId: string): string {
    // Create a competition-style prompt
    return `You are participating in a coding competition. Your solution will be compared against other AI models.

Problem: ${project.problemStatement}

${
  project.originalCode
    ? `Existing code to optimize or extend:\n\`\`\`${project.language}\n${project.originalCode}\n\`\`\`\n`
    : ""
}

Language: ${project.language}

Test Cases:
${project.testCases
  .map(
    (test) => `Input: ${test.input}\nExpected Output: ${test.expectedOutput}`
  )
  .join("\n\n")}

Evaluation Criteria:
- Execution Time${
      project.evaluationCriteria.prioritizeExecutionTime
        ? " (HIGH PRIORITY)"
        : ""
    }
- Memory Usage${
      project.evaluationCriteria.prioritizeMemoryUsage ? " (HIGH PRIORITY)" : ""
    }
- Code Complexity${
      project.evaluationCriteria.prioritizeCodeComplexity
        ? " (HIGH PRIORITY)"
        : ""
    }
- Lines of Code${
      project.evaluationCriteria.prioritizeLinesOfCode ? " (HIGH PRIORITY)" : ""
    }
- Dependency Count${
      project.evaluationCriteria.prioritizeDependencyCounts
        ? " (HIGH PRIORITY)"
        : ""
    }

Instructions:
1. Solve the problem efficiently.
2. Provide your reasoning for your approach.
3. The code will be automatically executed against the test cases.
4. Your solution will be scored based on the evaluation criteria.
5. The higher your score, the more of your code will be included in the final solution.

Format your response as follows:
\`\`\`${project.language}
// Your code here
\`\`\`

Reasoning:
- First, explain your overall approach.
- Then explain key decisions in your implementation.
- Finally, mention any trade-offs or alternative approaches you considered.`;
  }

  private extractReasoning(response: string): string[] {
    // Extract reasoning section from the response
    const reasoningMatch = response.match(/Reasoning:([\s\S]*?)($|```)/i);
    if (reasoningMatch && reasoningMatch[1]) {
      return reasoningMatch[1]
        .trim()
        .split(/\n\s*-\s*/)
        .filter(Boolean)
        .map((line) => line.trim());
    }
    return ["No explicit reasoning provided"];
  }

  private calculateScore(
    executionResult: any,
    staticAnalysis: any,
    criteria: any
  ): number {
    // Implement scoring algorithm based on criteria
    let score = 0;
    const weights = {
      executionTime: criteria.prioritizeExecutionTime ? 2 : 1,
      memoryUsage: criteria.prioritizeMemoryUsage ? 2 : 1,
      complexity: criteria.prioritizeCodeComplexity ? 2 : 1,
      linesOfCode: criteria.prioritizeLinesOfCode ? 2 : 1,
      dependencyCounts: criteria.prioritizeDependencyCounts ? 2 : 1,
      testsPassed: 3, // Always high priority
    };

    // Calculate test passing percentage
    const passedTests = executionResult.testResults.filter(
      (t) => t.passed
    ).length;
    const totalTests = executionResult.testResults.length;
    const testPassRate = totalTests > 0 ? passedTests / totalTests : 0;

    // Add weighted scores
    score += testPassRate * 100 * weights.testsPassed;

    // Add inverse scores for metrics where lower is better
    // These would be normalized against all solutions in a real implementation
    score +=
      (1000 / Math.max(1, executionResult.metrics.executionTimeMs)) *
      10 *
      weights.executionTime;
    score +=
      (1000 / Math.max(1, executionResult.metrics.memoryUsageBytes / 1024)) *
      10 *
      weights.memoryUsage;
    score +=
      (100 / Math.max(1, staticAnalysis.complexity)) * 10 * weights.complexity;
    score +=
      (100 / Math.max(1, staticAnalysis.linesOfCode)) *
      10 *
      weights.linesOfCode;
    score +=
      (10 / Math.max(1, staticAnalysis.dependencyCounts)) *
      10 *
      weights.dependencyCounts;

    // Add penalty for warnings
    const warningsPenalty = staticAnalysis.warnings.reduce(
      (penalty, warning) =>
        penalty +
        (warning.severity === "high"
          ? 20
          : warning.severity === "medium"
          ? 10
          : 5),
      0
    );
    score = Math.max(0, score - warningsPenalty);

    return Math.round(score);
  }
}
````

## 12. Conclusion

This AI Development Tool represents a significant advancement in making AI code generation more deterministic, transparent, and effective. By enabling parallel solution generation, objective comparison, and interactive merging, the tool will help both internal developers and clients achieve higher quality code with greater efficiency.

The modular architecture ensures the system can evolve and expand over time, while the phased development approach allows for incremental delivery of value. Security considerations are built in from the ground up, ensuring safe execution of generated code.

With its innovative "version control for reasoning" concept, the tool provides unprecedented insight into the AI decision-making process, making it easier for developers to understand, trust, and optimize AI-generated code.
