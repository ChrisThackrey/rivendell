# Changelog

## [0.1.8] - 2025-05-10

### Fixed

- Fixed code file storage and lookup to ensure consistent data in both document metadata and codefiles table
- Added dual-storage mechanism to maintain code files in both locations for backwards compatibility
- Enhanced all API routes that create code files to update document metadata for redundancy
- Added step-specific tracking of code files in document metadata for improved lookups

## [0.1.7] - 2025-05-10

### Fixed

- Fixed issue with Step cards not displaying code files after refactoring to use the codefiles table
- Fixed document ID conversion for non-UUID document IDs to ensure code files are properly associated
- Enhanced extraction of code files to prioritize checking the codefiles table first
- Added optimization to prevent duplicate code file creation when document already has code files

### Added

- Created new SQL migration (20240510000001_enhance_document_codefile_relations.sql) with:
  - Enhanced `get_codefiles_by_document_id` function to handle document ID conversion
  - New `find_codefiles_by_any_id` function for flexible ID lookups
  - Created `document_codefile_relationships` view for debugging relationships
  - Added indexes to improve performance of codefile lookups
  - Enhanced `find_documents_without_codefiles` function to skip placeholder documents

### Changed

- Modified `getCodeFilesByDocumentId` in codefile-service.ts to validate document IDs
- Enhanced `extractCodeFilesFromDocument` to check for existing code files in codefiles table
- Updated create-sample-code API to check for existing code files before generating new ones
- Added additional logging in search-codefiles API for better debugging

## [0.1.6] - 2025-04-14

### Added

- File-Tree Tracking in Structured Solution Generation
  - Enhanced prompt system to include file-tree representation for each implementation step
  - Added comprehensive file-tree visualization showing project structure evolution
  - Implemented tracking of new and modified files across implementation steps
  - Added fileTree field to StepSchema and FinalSolutionSchema in Zod validation schemas
  - Updated SolutionCard component to display file trees in modal dialog
  - Enhanced OpenAI and Anthropic prompts with detailed file-tree tracking instructions
  - Added example file-tree representation in prompts for consistent formatting
  - Implemented detailed testing for file-tree display in solution cards
  - Created progressive step implementation guidelines for logical file organization

### Changed

- Enhanced Prompt Instructions for Structured Solutions
  - Improved step progression guidance with file type specifications for each step
  - Added strict requirements for substantial changes between implementation steps
  - Updated JSON response structure to include fileTree in each step and final solution
  - Enhanced code file implementation instructions for more comprehensive solutions
  - Added specific guidance on maintaining consistent file structure across steps

## [0.1.5] - 2025-04-14

### Added

- Enhanced Monte Carlo Visualization Component
  - Added model filtering capability for improved data analysis
  - Implemented PointDetectionResult interface for type safety in point detection
  - Added model count display in legend to show distribution statistics
  - Enhanced camera focusing mechanism with priority-based targeting
  - Improved deselection prevention system to avoid accidental point loss
  - Added optimized batch ID fetching and sorting with timestamp extraction
  - Enhanced data structures to ensure type safety across visualization pipeline

- Improved Code Block Component
  - Added copy-to-clipboard functionality with visual feedback
  - Implemented TooltipProvider for improved user experience
  - Added keyboard accessibility for code copying and interaction
  - Enhanced styling with backdrop blur and transition animations

- Code File Enhancement in Solution Cards
  - Added detailed change tracking for code files including line additions, removals, and modifications
  - Enhanced metadata display with percentage-based change indicators
  - Improved change summary visualization for significant code alterations
  - Implemented more accessible and visually clear file navigation

- Robust Structured Solution API Route
  - Added extensive JSON repair mechanisms for AI-generated responses
  - Enhanced error handling with multi-level fallback strategy
  - Added support for additional AI models (Claude-Sonnet-7, GPT-4o, o1, o3-mini)
  - Implemented retry mechanism with exponential backoff
  - Added code file extraction and storage from structured solutions
  - Improved validation with Zod schemas to ensure consistent data structure
  - Added deep code content analysis and correction for malformed responses

- Advanced JSON Error Recovery System
  - Added sophisticated JSON error detection and repair
  - Implemented specialized fixes for common AI response issues (unterminated strings, unbalanced braces)
  - Added aggressive structure repair for truncated responses
  - Created pattern-based extraction for valid JSON subsets
  - Implemented fallback solution generation when repairs fail
  - Added detailed logging for each repair attempt with context

### Changed

- Refactored Monte Carlo Service
  - Enhanced data fetching with combined batch ID and data point retrieval
  - Improved type safety with more explicit return types
  - Added robust error handling for data fetching operations
  - Optimized performance for large datasets through improved data processing

- Enhanced AI Model Support
  - Added proper mapping for new models (Claude-Sonnet-7, o1, o3, o3-mini)
  - Improved provider detection with comprehensive model registry
  - Optimized prompt generation based on model capabilities
  - Added reasoning capability for supported models
  - Enhanced API call configuration with model-specific optimizations

## [0.1.4] - 2025-04-14

### Changed

- Refactored AI solution evaluation system with stricter scoring thresholds
  - Increased RECOMMENDED threshold from ≥85 to ≥90 for all evaluation metrics
  - Raised PROBLEMATIC threshold from ≤30 to ≤35 for any evaluation metric
  - Adjusted VIABLE score range from 31-84 to 36-89
  - Modified target distribution from 20/65/15% to 10/75/15% (RECOMMENDED/VIABLE/PROBLEMATIC)
  - Enhanced evaluation prompt with stronger language for RECOMMENDED selections
  - Updated all related fallback and error handling logic to maintain consistency
  - Modified random decision generators to follow the new distribution percentages
  - Ensured minimal disruption to existing force-recommended behavior for level completion

## [0.1.3] - 2025-04-04

### Changed

- Completely refactored the pathway-visualizer to use structured solutions
  - Added new structured-solution API endpoint to generate complete solutions
  - Each AI model call now creates a single 6-step structured response
  - Run ID properly increments for each complete model run
  - Removed step IDs from metadata for simpler tracking
  - Switched to a flat array-based solution storage system
  - Added selection logic to pick the most recent best solutions
  - Enhanced type safety with proper string conversions
  - Updated the Ensemble Model Selection defaults

## [0.1.2] - 2025-04-04

### Fixed

- Fixed step and run ID tracking in pathway-visualizer
  - Each run now gets a unique run ID correctly incremented for each model and temperature
  - Each step properly records the run ID in its metadata
  - Solution embeddings now include correct run and step ID tracking
  - Solutions are now preserved for each individual run separately
  - The final solution combines all best solutions from all runs

## [0.1.1] - 2025-04-04

### Added

- Server-side API Routes for OpenAI Integration
  - Added `/api/embeddings` route for secure embedding generation
  - Added `/api/evaluate` route for secure AI response evaluation
  - Fixed client-side OpenAI API key security issue
  - Improved error handling for API failures

## [0.1.0] - 2025-04-04

### Added

- Supabase Database Integration
  - Created SQL schema with vector search support using pgvector extension
  - Added `documents` table for storing AI responses with vector embeddings
  - Added metadata JSONB column for storing evaluation metrics and run configurations
  - Added similarity search function for finding related documents
  - Added GIN and vector indexes for performance optimization

- OpenAI Embedding Integration
  - Added embedding generation service using OpenAI's text-embedding-3-small model
  - Implemented document storage with embeddings
  - Created utilities for vector similarity search

- AI Evaluation System
  - Implemented AI response evaluation using GPT-4o
  - Added comprehensive scoring metrics (accuracy, complexity, efficiency, etc.)
  - Created decision classification system (RECOMMENDED, VIABLE, PROBLEMATIC)
  - Integrated evaluation results into metadata storage

- Multiple Run Support in Pathway Visualizer
  - Refactored pathway-visualizer to support multiple runs per model
  - Implemented dynamic temperature adjustment based on intensity settings
  - Added embedding and metadata storage for each step and run
  - Added run tracking with unique run IDs for each execution
  - Added error handling and loading states for asynchronous operations

- TypeScript Type Definitions
  - Added database types for Supabase tables and functions
  - Added document metadata and evaluation metrics types
  - Updated solution types to include embedding and run information

### Changed

- Updated pathway-visualizer to store AI responses in Supabase
- Modified solution decision type mapping to use evaluation results
- Enhanced error handling with specific error messages
- Improved loading states with dedicated loading and error UI components

### Technical Details

- **Database Schema**: Implemented PostgreSQL schema with pgvector for similarity search.
- **Embedding Model**: Using OpenAI's text-embedding-3-small (1536 dimensions).
- **Vector Search**: Implemented cosine similarity search with configurable threshold.
- **Run Processing**: Fully sequential processing of configured runs for each model and temperature.
- **Metadata Storage**: Includes model info, runtime metrics, evaluation scores, and cost estimates.
- **Error Handling**: Graceful fallback to template steps when API or database operations fail.

### Notes

- The embedding service requires an OpenAI API key to be set in environment variables.
- The vector search functionality uses IVFFlat index which requires sufficient data volume for optimal performance.
- Cost estimates are based on simple heuristics and may not reflect actual API usage costs.
