# Rivendell: AI-Powered Coding Solution Platform - MVP Action Plan

## Introduction (Derived from PRD.md and project context)

This document outlines the Minimum Viable Product (MVP) action plan for Rivendell, an AI-powered coding solution platform. Rivendell aims to provide a sophisticated interface for users to submit programming tasks, receive solutions from multiple AI models, compare these solutions based on various metrics, and iteratively refine them. The platform will incorporate features for project management, AI model integration (OpenAI, Anthropic), ensemble configurations, tech stack customization, advanced solution visualization, semantic search, and robust backend infrastructure using Supabase and Vercel.

This action plan details the steps required to build the MVP, incorporating information from the Product Requirements Document (`prd.txt`) and specific task breakdown files (`task_001.txt` - `task_015.txt`). Tasks will be marked with their status (e.g., pending, completed) as indicated in these source files.

## Core MVP Features (Derived from prd.txt and task files)

1.  **User Authentication & Management:** Secure sign-up, sign-in, profile management.
2.  **Project Management:** Create and manage coding projects with problem statements, languages, and criteria.
3.  **AI Model Integration:** Connect to OpenAI and Anthropic models for solution generation.
4.  **Ensemble Configuration:** Allow users to define and manage configurations of multiple AI models.
5.  **Tech Stack Selection:** UI for users to specify target technology stacks for solutions.
6.  **AI Solution Generation:** Submit project details to selected AI models/ensembles and retrieve solutions.
7.  **Code File Storage & Embeddings:** Store code files and generate embeddings for search and analysis.
8.  **Semantic Search:** Allow users to search for relevant code snippets using natural language.
9.  **Solution Pathway Visualization:** Basic and advanced (3D) visualization of AI solution generation paths.
10. **Solution Comparison:** Side-by-side comparison of solutions with diffing and metrics.
11. **Solution Refinement:** Tools to combine best parts of different solutions.
12. **Secure Sandbox (Conceptual):** (Note: Actual sandboxing is complex; MVP might focus on displaying code, with execution being a future goal or simplified).
13. **Basic Metrics & Analysis:** Display metrics for generated solutions.
14. **Error Handling & Performance:** Robust error management and application optimization.
15. **Deployment:** Hosted on Vercel with Supabase backend.

---

## Detailed Action Plan Steps

### Step 1: Initial Project Setup & Configuration (Derived from task_001.txt)

#### Detailed technical explanation
Initialize the Next.js project with TypeScript, Tailwind CSS, and Shadcn/UI. Set up basic project structure, linting, formatting, and necessary development tools. This forms the foundational boilerplate for the application.

#### Task Breakdown (task_001.txt)

##### SubTask 1.1: Initialize Next.js Project [STATUS: as per task_001.txt]
*   Description: Create a new Next.js application using `create-next-app` with TypeScript.
*   /relative/path/of/changed/file: Project Root
*   Operation: Create

##### SubTask 1.2: Integrate Tailwind CSS [STATUS: as per task_001.txt]
*   Description: Install and configure Tailwind CSS for utility-first styling.
*   /relative/path/of/changed/file: `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`
*   Operation: Create/Update

##### SubTask 1.3: Set up Shadcn/UI [STATUS: as per task_001.txt]
*   Description: Initialize Shadcn/UI for pre-built, accessible UI components.
*   /relative/path/of/changed/file: `components.json`, `lib/utils.ts`, `components/ui/`
*   Operation: Create/Update

##### SubTask 1.4: Configure ESLint and Prettier [STATUS: as per task_001.txt]
*   Description: Set up ESLint for code linting and Prettier for code formatting to maintain code quality and consistency.
*   /relative/path/of/changed/file: `.eslintrc.json`, `.prettierrc.json`, `package.json` (scripts)
*   Operation: Create/Update

##### SubTask 1.5: Basic Project Structure Setup [STATUS: as per task_001.txt]
*   Description: Organize directories for components, lib, app router pages, etc.
*   /relative/path/of/changed/file: `app/`, `components/`, `lib/`
*   Operation: Create

### Step 2: Environment Setup & Supabase Integration (Derived from existing plan Step 1, task_003.txt, and schema files)

#### Detailed technical explanation
Set up the development environment, configure environment variables (Supabase, AI APIs), establish Supabase connection, and define the initial database schema based on `00001_initial_rivendell.sql` and `schema.md`.

#### Task Breakdown

##### SubTask 2.1: Supabase Project Setup (Manual) [STATUS: Pending/Assumed from task_003.txt]
*   Description: Create Supabase project, note URL and anon key.
*   Details: As per `task_003.txt` (Subtask 1).

##### SubTask 2.2: Configure Environment Variables [STATUS: Pending as per task_003.txt]
*   Description: Create `.env.local` with Supabase keys, placeholders for OpenAI, Anthropic.
*   /relative/path/of/changed/file: `.env.local`
*   Operation: Create
*   Details: As per `task_003.txt` (Subtask 1) and current plan.

##### SubTask 2.3: Create Supabase Client Utilities [STATUS: Pending as per task_003.txt]
*   Description: Implement `lib/supabase/client.ts` and `lib/supabase/server.ts`.
*   /relative/path/of/changed/file: `lib/supabase/client.ts`, `lib/supabase/server.ts`
*   Operation: Create
*   Details: As per `task_003.txt` (Subtask 1) and current plan.

##### SubTask 2.4: Define and Apply Initial Database Schema [STATUS: Partially Implemented, based on provided SQL/schema.md]
*   Description: Implement the database schema provided in `00001_initial_rivendell.sql` and documented in `schema.md`. This includes tables for `users` (via auth), `profiles`, `projects`, `ai_models`, `code_solutions`, `solution_metrics`, `test_cases`, `solution_test_results`, `api_keys`, `organizations`, `organization_members`, `project_members`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`, `embeddings`, `app_configuration`, `ensemble_configurations`, `tech_stack_options`, `configuration_tech_stacks` and related functions/triggers.
*   /relative/path/of/changed/file: Supabase SQL Editor / Migrations
*   Operation: Create/Update (Schema)
*   Details: The schema from `00001_initial_rivendell.sql` should be applied. `task_003.txt` (Subtask 2 & 3) also describe schema for code files, embeddings, configurations which should be reconciled with the main SQL file.
    *   **Key Tables from `00001_initial_rivendell.sql` to verify/implement:**
        *   `organizations`, `profiles` (linking to `auth.users`)
        *   `projects`, `project_members`
        *   `api_keys` (for user/project API access)
        *   `ai_models` (configurable list of AI models)
        *   `code_solutions`, `solution_metrics`, `solution_files`
        *   `test_cases`, `solution_test_results`
        *   `roles`, `permissions`, `role_permissions`, `user_roles`
        *   `audit_logs`
        *   `embeddings` (pgvector)
        *   `app_configuration`
        *   RLS policies and helper functions as defined in the SQL file.

##### SubTask 2.5: Update `tsconfig.json` for path aliases [STATUS: as per current plan]
*   Description: Configure path aliases.
*   /relative/path/of/changed/file: `tsconfig.json`
*   Operation: Update

### Step 3: User Authentication & Management (Derived from existing plan Step 2, prd.txt)

#### Detailed technical explanation
Implement core user authentication (sign-up, sign-in, sign-out, password recovery, email verification) using Supabase Auth. Manage user profiles linked to `auth.users`.

#### Task Breakdown

##### SubTask 3.1: Ensure `profiles` Table and Triggers [STATUS: Defined in Step 2.4]
*   Description: The `profiles` table and `handle_new_user` trigger (from `00001_initial_rivendell.sql`) should be in place.

##### SubTask 3.2: Create Authentication UI Components [STATUS: Pending, similar to current plan]
*   Description: Develop Sign Up, Sign In, Forgot Password forms using Shadcn/UI.
*   /relative/path/of/changed/file: `components/auth/SignUpForm.tsx`, etc.
*   Operation: Create

##### SubTask 3.3: Implement Sign Up, Sign In, Sign Out Logic [STATUS: Pending, similar to current plan]
*   Description: Implement client-side logic using Supabase client.
*   /relative/path/of/changed/file: `app/auth/...`, `components/auth/...`
*   Operation: Create

##### SubTask 3.4: Session Management & Protected Routes (Middleware) [STATUS: Pending, similar to current plan]
*   Description: Implement Next.js middleware for session management.
*   /relative/path/of/changed/file: `middleware.ts`, `lib/supabase/middleware.ts`
*   Operation: Create

##### SubTask 3.5: User Profile Page (Basic) [STATUS: Pending, similar to current plan]
*   Description: Page for users to view/update their profile (`full_name`, `avatar_url` from `profiles` table).
*   /relative/path/of/changed/file: `app/dashboard/profile/page.tsx`
*   Operation: Create

##### SubTask 3.6: Email Verification & Password Recovery [STATUS: Pending, similar to current plan]
*   Description: Configure and implement these Supabase Auth features.
*   Operation: Create/Configure

### Step 4: Basic Application Layout & Navigation (Derived from existing plan Step 3, task_002.txt)

#### Detailed technical explanation
Create the main application layout (header, sidebar, content area) and basic navigation structure using components from Shadcn/UI, based on `task_002.txt`.

#### Task Breakdown (task_002.txt)

##### SubTask 4.1: Define Global Layout [STATUS: Pending as per task_002.txt (Subtask 1)]
*   Description: Create `app/layout.tsx` with providers, theme, global styles.
*   /relative/path/of/changed/file: `app/layout.tsx`
*   Operation: Create/Update

##### SubTask 4.2: Implement Main Navigation (Header/Sidebar) [STATUS: Pending as per task_002.txt (Subtask 2)]
*   Description: Develop `Header.tsx`, `Sidebar.tsx` with navigation links, user menu.
*   /relative/path/of/changed/file: `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`
*   Operation: Create

##### SubTask 4.3: Create Dashboard Layout [STATUS: Pending as per task_002.txt (Subtask 3)]
*   Description: Specific layout for authenticated areas (`app/dashboard/layout.tsx`).
*   /relative/path/of/changed/file: `app/dashboard/layout.tsx`
*   Operation: Create

##### SubTask 4.4: Implement Page Structure and Content Areas [STATUS: Pending as per task_002.txt (Subtask 4)]
*   Description: Define structure for main content display within layouts.
*   Operation: Create

##### SubTask 4.5: Implement Responsive Design [STATUS: Pending as per task_002.txt (Subtask 5)]
*   Description: Ensure layout is responsive across devices.
*   Operation: Update (CSS/Components)

### Step 5: Project Management (Derived from existing plan Step 4, prd.txt, schema)

#### Detailed technical explanation
Allow users to create, view, update, and delete projects. Projects store problem statements, target languages, and link to evaluation criteria and test cases (schema defined in Step 2.4).

#### Task Breakdown

##### SubTask 5.1: Project Listing Page [STATUS: Pending]
*   Description: UI to display a list of user's projects with options to create new or open existing.
*   /relative/path/of/changed/file: `app/dashboard/projects/page.tsx`
*   Operation: Create

##### SubTask 5.2: Create/Edit Project Form [STATUS: Pending]
*   Description: Form for creating and editing project details (name, problem statement, target language).
*   /relative/path/of/changed/file: `components/projects/ProjectForm.tsx`
*   Operation: Create

##### SubTask 5.3: API Endpoints for Project CRUD [STATUS: Pending]
*   Description: Next.js Route Handlers for creating, reading, updating, deleting projects in Supabase `projects` table.
*   /relative/path/of/changed/file: `app/api/projects/[projectId]/route.ts`, `app/api/projects/route.ts`
*   Operation: Create

##### SubTask 5.4: Manage Evaluation Criteria for a Project (UI + API) [STATUS: Pending]
*   Description: Interface to add/edit/remove evaluation criteria (linked to `evaluation_criteria` table).
*   Operation: Create

##### SubTask 5.5: Manage Test Cases for a Project (UI + API) [STATUS: Pending]
*   Description: Interface to add/edit/remove test cases (linked to `test_cases` table).
*   Operation: Create

### Step 6: AI Model Integrations (Derived from task_004.txt, task_005.txt)

#### Detailed technical explanation
Integrate with OpenAI and Anthropic APIs to enable solution generation. Includes API key management, service layers, and basic interaction functions.

#### Task Breakdown

##### SubTask 6.1: OpenAI API Integration (task_004.txt) [STATUS: Pending as per task_004.txt]
*   Description: Set up environment variables, create API route handlers, service functions for GPT models, error handling, streaming.
*   Subtasks from task_004.txt:
    *   6.1.1: Set up environment variables and config for OpenAI API.
    *   6.1.2: Create OpenAI service with core API interaction functions.
    *   6.1.3: Implement streaming response handling.
    *   6.1.4: Add robust error handling and rate limiting.
    *   6.1.5: Create API route handlers for frontend integration.
*   /relative/path/of/changed/file: `lib/openai/service.ts`, `app/api/openai/...`
*   Operation: Create

##### SubTask 6.2: Anthropic API Integration (task_005.txt) [STATUS: Pending as per task_005.txt]
*   Description: Set up environment variables, API handlers, service functions for Claude models, error handling, streaming.
*   Subtasks from task_005.txt:
    *   6.2.1: Set up Anthropic API configuration and environment variables.
    *   6.2.2: Implement core Anthropic service functions.
    *   6.2.3: Implement streaming response handling for Anthropic API.
    *   6.2.4: Add rate limiting and optimization for Anthropic API calls.
    *   6.2.5: Create API route handlers for Anthropic model interactions.
*   /relative/path/of/changed/file: `lib/anthropic/service.ts`, `app/api/anthropic/...`
*   Operation: Create

### Step 7: Ensemble Configuration Management (Derived from task_006.txt)

#### Detailed technical explanation
Implement functionality for users to create, save, and load configurations of multiple AI models (ensembles) to be used for solution generation.

#### Task Breakdown (task_006.txt)

##### SubTask 7.1: Design/Implement Ensemble Configuration UI [STATUS: Pending as per task_006.txt (Subtask 1)]
*   Description: UI for selecting models, setting parameters (e.g., temperature), naming configurations.
*   Operation: Create

##### SubTask 7.2: State Management for Ensemble Configurations [STATUS: Pending as per task_006.txt (Subtask 2)]
*   Description: Manage state for creating/editing configurations.
*   Operation: Create

##### SubTask 7.3: Supabase Integration for Saving/Loading Configurations [STATUS: Pending as per task_006.txt (Subtask 3)]
*   Description: Save/load ensemble configurations to/from `ensemble_configurations` table in Supabase.
*   Operation: Create

##### SubTask 7.4: Default and Quick Start Configurations [STATUS: Pending as per task_006.txt (Subtask 4)]
*   Description: Provide default configurations.
*   Operation: Create

### Step 8: Tech Stack Selection UI (Derived from task_007.txt)

#### Detailed technical explanation
Create an interface for users to select and configure target technology stack options (e.g., frontend framework, backend language, database) to guide AI solution generation.

#### Task Breakdown (task_007.txt)

##### SubTask 8.1: Categorized Tech Stack Selection UI Components [STATUS: Pending as per task_007.txt (Subtask 1)]
*   Description: UI components for selecting tech stack options by category.
*   Operation: Create

##### SubTask 8.2: State Management for Tech Stack Selection [STATUS: Pending as per task_007.txt (Subtask 2)]
*   Description: Manage state of selected tech stack options.
*   Operation: Create

##### SubTask 8.3: Save/Load Tech Stack Presets [STATUS: Pending as per task_007.txt (Subtask 3)]
*   Description: Allow users to save/load preferred tech stack presets (using `tech_stack_options` table).
*   Operation: Create

##### SubTask 8.4: Integrate Tech Stack Config with Prompt Generation [STATUS: Pending as per task_007.txt (Subtask 4)]
*   Description: Ensure selected tech stack influences AI prompts.
*   Operation: Update (Prompt logic)

### Step 9: Core AI Solution Generation Workflow (Derived from existing plan Step 5)

#### Detailed technical explanation
Orchestrate the process of taking a user's project (problem statement, language, criteria, tech stack), submitting it to the selected AI model(s)/ensemble, and retrieving the generated solutions.

#### Task Breakdown

##### SubTask 9.1: Solution Generation Request UI [STATUS: Pending]
*   Description: Interface within a project to trigger solution generation, select AI model/ensemble, and confirm tech stack.
*   Operation: Create

##### SubTask 9.2: Backend Orchestration Service [STATUS: Pending]
*   Description: Service to manage requests to AI APIs (OpenAI, Anthropic) based on project details and configurations. Handle parallel requests if using ensembles.
*   /relative/path/of/changed/file: `lib/ai/orchestrator.ts`
*   Operation: Create

##### SubTask 9.3: Store Generated Solutions [STATUS: Pending]
*   Description: Save retrieved AI solutions to the `code_solutions` table in Supabase, linking to the project and AI model used.
*   Operation: Create (API/Service logic)

### Step 10: Code File Storage & Embedding Generation (Derived from task_012.txt)

#### Detailed technical explanation
Implement functionality to store user-uploaded or AI-generated code files in Supabase Storage and generate semantic embeddings for these files using OpenAI API for similarity search.

#### Task Breakdown (task_012.txt)

##### SubTask 10.1: Code File Storage in Supabase [STATUS: Pending as per task_012.txt (Subtask 1)]
*   Description: Set up Supabase Storage buckets for code files. API routes for upload/retrieval.
*   Operation: Create/Configure

##### SubTask 10.2: Embedding Generation and Storage [STATUS: Pending as per task_012.txt (Subtask 3)]
*   Description: Generate embeddings for code files using OpenAI API and store them in the `embeddings` table (pgvector) in Supabase.
*   Operation: Create

##### SubTask 10.3: Metadata Extraction and Versioning (Conceptual) [STATUS: Pending as per task_012.txt (Subtask 4)]
*   Description: Plan for metadata extraction and code file versioning.
*   Operation: Create

### Step 11: Semantic Search for Code Snippets (Derived from task_013.txt)

#### Detailed technical explanation
Implement embedding-based similarity search for users to find relevant code snippets or solutions stored in the system.

#### Task Breakdown (task_013.txt)

##### SubTask 11.1: Vector Similarity Search API [STATUS: Pending as per task_013.txt (Subtask 2)]
*   Description: Backend API endpoint to take a search query, generate its embedding, and query Supabase (pgvector) for similar code snippet embeddings.
*   /relative/path/of/changed/file: `app/api/search/code/route.ts`
*   Operation: Create

##### SubTask 11.2: Search Ranking and Filtering Logic [STATUS: Pending as per task_013.txt (Subtask 3)]
*   Description: Implement ranking for search results and filters (language, framework).
*   Operation: Create

##### SubTask 11.3: Search Interface and Result Display [STATUS: Pending as per task_013.txt (Subtask 4)]
*   Description: Frontend UI for code snippet search, displaying results with code previews. Implement caching.
*   Operation: Create

### Step 12: Solution Pathway & Comparison Visualization (Derived from task_008.txt, task_009.txt, task_010.txt, task_011.txt, existing plan Step 7)

#### Detailed technical explanation
Develop UI for visualizing AI solution pathways and comparing solutions from different models side-by-side, potentially using 2D and 3D representations.

#### Task Breakdown

##### SubTask 12.1: Basic Solution Pathway Visualization (task_008.txt) [STATUS: Pending as per task_008.txt]
*   Description: Design data model for pathways, implement solution card components with code highlighting, visualize step connections.
*   Subtasks from task_008.txt:
    *   12.1.1: Design Solution Pathway Data Model and API Integration.
    *   12.1.2: Implement Solution Card Components with Code Highlighting.
    *   12.1.3: Visualize Step Connections and Pathways.
    *   12.1.4: Add Interactivity and Model Comparison Layout.
*   Operation: Create

##### SubTask 12.2: Three.js/React Three Fiber Integration (task_009.txt) [STATUS: Pending as per task_009.txt]
*   Description: Set up 3D visualization capabilities.
*   Subtasks from task_009.txt:
    *   12.2.1: Install and Configure Three.js and React Three Fiber.
    *   12.2.2: Create Basic 3D Scene Components.
    *   12.2.3: Implement Camera Controls, Viewport Management, Reusable 3D Components.
    *   12.2.4: Optimize 3D Rendering Performance and Implement Responsive 3D Views.
*   Operation: Create

##### SubTask 12.3: Enhance Pathway Visualization with Three.js (task_010.txt) [STATUS: Pending as per task_010.txt]
*   Description: Improve pathway visualization using 3D for interactive displays, animations, model differentiation.
*   Operation: Create

##### SubTask 12.4: Implement Solution Comparison Functionality (task_011.txt) [STATUS: Pending as per task_011.txt]
*   Description: Side-by-side comparison view, code diff visualization, metrics display, highlighting strengths/weaknesses.
*   Subtasks from task_011.txt:
    *   12.4.1: Develop Side-by-Side Solution Comparison UI.
    *   12.4.2: Implement Code Diff Visualization.
    *   12.4.3: Compute and Display Solution Comparison Metrics.
    *   12.4.4: Highlight Strengths and Weaknesses of Each Solution.
*   Operation: Create

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

*   **`/app`**: Contains all application routes, layouts, and pages, following the Next.js App Router conventions.
    *   **`/app/(auth)`**: Routes related to user authentication (sign-in, sign-up).
    *   **`/app/(dashboard)`**: Protected routes accessible after user authentication, forming the main application area.
    *   **`/app/api`**: API route handlers for backend logic, interacting with Supabase and AI services.
*   **`/components`**: Reusable React components used throughout the application.
    *   **`/components/auth`**: Authentication-specific UI components.
    *   **`/components/dashboard`**: Components used within the main dashboard sections.
    *   **`/components/layout`**: Global layout components like Header, Sidebar, Footer.
    *   **`/components/three`**: Components related to 3D visualizations using Three.js and React Three Fiber.
    *   **`/components/ui`**: UI primitives and components, likely from Shadcn/UI.
*   **`/lib`**: Utility functions, service integrations, type definitions, and other shared logic.
    *   **`/lib/ai-service.ts`**: Logic for interacting with AI models (OpenAI, Anthropic).
    *   **`/lib/supabase-client.ts`**: Supabase client initialization and helper functions.
    *   **`/lib/types`**: TypeScript type definitions, including generated Supabase types.
*   **`/public`**: Static assets like images, fonts, and icons.
*   **`/docs`**: Project documentation, including database schema files, changelogs, and implementation notes.
*   **`/supabase`**: Supabase local development configuration and migration files.
*   **Configuration Files (Root)**: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `prettierrc.json`, etc., for project setup and tooling.

This structure promotes modularity and separation of concerns, making the codebase easier to understand, maintain, and scale.

---

(The rest of the action plan steps will follow, ensuring this new section is logically placed, likely towards the end or as a dedicated appendix.)
