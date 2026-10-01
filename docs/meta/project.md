# Rivendell -- Multi-model AI solution comparison and evaluation platform

## Problem
  Manual comparison of AI model outputs for development tasks is slow, unstructured, and lacks quantitative scoring. Rivendell automates multi-model solution generation, structured evaluation, and visual comparison to surface the best approach across providers.

## System Overview
  - Multi-model ensemble pipeline (OpenAI GPT-4o/o1/o3 + Anthropic Claude)
  - 6-step structured solution decomposition per query
  - Embedding-based similarity search (text-embedding-3-small, 1536 dims, pgvector)
  - GPT-3.5-turbo automated evaluation with 6-dimension scoring (accuracy, complexity, compute efficiency, readability, cost efficiency, memory)
  - Decision classification: RECOMMENDED / VIABLE / PROBLEMATIC
  - 3D Monte Carlo visualization (Three.js/React Three Fiber) with K-means clustering
  - Gantt chart timeline view for solution step sequencing
  - Pathway visualizer with directed step connections
  - Code file dual-write architecture for redundant storage + fast retrieval

## Engineering and Deployment
  - Next.js 15 App Router with React 19, TypeScript strict mode
  - Supabase PostgreSQL with pgvector extension for vector similarity
  - ~20 API routes proxying OpenAI/Anthropic (server-side only, no client-side key exposure)
  - Zod schema validation on all request/response boundaries
  - Vercel deployment (iad1 region) with Edge Runtime support
  - Vitest test suite with jsdom environment, mocked Supabase client
  - Sentry error tracking and reporting integration
  - Vercel Analytics + Speed Insights for production monitoring

## Results
  - Embedding search: <100ms vector similarity queries via pgvector
  - Solution generation: 6-step structured output per model run
  - Evaluation pipeline: 6-dimension scoring with balanced distribution (~10% recommended, ~75% viable, ~15% problematic)
  - 3D visualization: demand-based rendering, DPR=1 optimization, memoized scene components
  - Code file dual-write for redundant storage + fast retrieval
  - Scenario: compare 3 models on same prompt, visually cluster solutions by quality metrics, identify optimal approach in seconds

### Tech Stack
Next.js 15, React 19, TypeScript 5, Three.js, React Three Fiber, Tailwind CSS v4, Supabase (pgvector), OpenAI SDK, Anthropic SDK, Zod, Framer Motion, Radix UI, Jotai, Vitest, Vercel, Sentry
