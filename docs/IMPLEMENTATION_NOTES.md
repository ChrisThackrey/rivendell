# Supabase Database and Embedding Implementation Notes

## Overview

This implementation adds Supabase database integration with vector embeddings for AI responses. The system stores AI model responses as vector embeddings, along with comprehensive metadata including evaluation metrics, and supports similarity search for finding related responses.

## Components

### API Routes

- **/api/embeddings** (`/app/api/embeddings/route.ts`)
  - Server-side API route for generating embeddings
  - Uses OpenAI's `text-embedding-3-small` model
  - Handles API key securely server-side

- **/api/evaluate** (`/app/api/evaluate/route.ts`)
  - Server-side API route for evaluating AI responses
  - Uses OpenAI's GPT-4o model to assess quality
  - Returns comprehensive scoring metrics
  - Ensures API key security

### Database Schema (`/supabase/schema.sql`)

- Uses PostgreSQL with `pgvector` extension for vector similarity search
- Defines a `documents` table with vector embedding support (1536 dimensions)
- Creates necessary indexes for efficient querying:
  - GIN index on the metadata for JSON queries
  - Indexes on run_id and step_id metadata fields
  - IVFFlat vector similarity index for efficient vector search
- Implements a `match_documents` function for similarity search
- Adds a function to retrieve the latest run ID for a given model

### TypeScript Types (`/lib/database.types.ts`)

- Defines TypeScript interfaces for Supabase database schema
- Includes type definitions for the documents table with embedding vector support
- Defines the match_documents function interface
- Adds custom enums and types for document metadata

### Supabase Client (`/lib/supabase-client.ts`)

- Initializes the Supabase client using environment variables
- Defines custom types for document metadata and scoring metrics
- Implements a connection check function
- Provides metadata structure with:
  - Model information
  - Runtime metrics
  - Cost estimates
  - Run and step tracking
  - Evaluation scores

### Embedding Service (`/lib/embedding-service.ts`)

- Implements functions for generating embeddings via OpenAI
- Creates an AI response evaluation system using GPT-4o
- Provides:
  - Embedding generation
  - AI response evaluation
  - Document storage
  - Similarity search

### Server API Endpoints

- **/api/structured-solution** (`/app/api/structured-solution/route.ts`)
  - Creates a structured 6-step solution from a single API call
  - Models return complete solutions as structured JSON
  - Includes detailed metrics for each step
  - Ensures API key security and consistent formatting

- **/api/evaluate** (`/app/api/evaluate/route.ts`)
  - Evaluates complete solutions rather than individual steps
  - Works with full structured content for better context

### Pathway Visualizer (`/components/pathway-visualizer.tsx`)

- Completely refactored to use a structured approach:
  - Single AI call generates an entire 6-step solution
  - Extracts and processes all steps from the structured response
  - Properly increments run IDs for each full model run
  - Assigns appropriate solution types based on evaluation and position
  - Stores all solutions in a flat array for better management
  - Selects best solutions based on recency and evaluation scores
  - Creates final solution by picking the best final solution across runs
- Enhanced error handling with more specific fallbacks
- Improved state management with clearer separation of concerns
- Modified data flow to minimize database write operations

## Usage Flow

1. User configures models and runs in the Ensemble Configuration modal
2. For each model and intensity level:
   - The system generates AI responses
   - Each response is evaluated for quality
   - Responses are embedded and stored in Supabase
   - Metadata is attached including evaluation scores
3. The pathway-visualizer displays the generated solutions
4. The final solution is created by combining the best aspects of all solutions

## Implementation Details

### Run Processing
For each model in the ensemble, the system processes all configured runs at each temperature level (low, medium, high). Each run is tracked with a unique run ID, and each step within a run is stored with its corresponding metadata.

### Vector Embedding
AI responses are embedded using OpenAI's text-embedding-3-small model, which produces 1536-dimensional vectors. These vectors enable semantic similarity search.

### Evaluation System
Each AI response is evaluated using GPT-4o, which assesses:
- Accuracy
- Complexity
- Compute efficiency
- Readability
- Cost efficiency
- Memory usage

These scores are combined to classify the solution as RECOMMENDED, VIABLE, or PROBLEMATIC.

### Error Handling
The implementation includes comprehensive error handling with:
- Fallback to generic templates when API calls fail
- Detailed error logging
- User-friendly error displays with retry options
- Loading states for asynchronous operations

## Technical Constraints

- Requires OpenAI API key for embedding and evaluation
- Supabase needs to be configured with pgvector extension
- Vector index performance improves with more data
- The OpenAI Edge API has some limitations compared to the standard OpenAI API
