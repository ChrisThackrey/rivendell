# Rivendell Database Schema

This document details the schema of the Rivendell Supabase database, including tables, columns, data types, relationships, and examples.

## Database Overview

Rivendell is a PostgreSQL-powered database with pgvector extension for vector similarity search. The database stores documents, code files, steps, and various configurations for AI agent workflows.

## Custom Types

### `decision_type` Enum
- Values: `RECOMMENDED`, `VIABLE`, `PROBLEMATIC`
- Used to categorize decision quality in steps

## Tables

### `documents`

Stores text content with vector embeddings for similarity search.

| Column      | Type          | Description                                    | Example                                          |
|-------------|---------------|------------------------------------------------|--------------------------------------------------|
| id          | UUID          | Primary key                                    | `123e4567-e89b-12d3-a456-426614174000`           |
| content     | TEXT          | Document text content                          | `This is a step description...`                   |
| embedding   | VECTOR(1536)  | OpenAI's text-embedding-3-small vector         | `[0.1, 0.2, ...]`                                |
| metadata    | JSONB         | Additional document info                       | `{"runId": "123", "stepNumber": "1", ...}`       |
| batch_id    | TEXT          | For grouping runs by query                     | `query-20240505-123456`                          |
| created_at  | TIMESTAMPTZ   | Creation timestamp                             | `2024-05-05T12:34:56Z`                           |

**Indexes:**
- `documents_metadata_idx` (GIN) - For faster JSON querying
- `documents_run_step_idx` (btree) - On metadata->>'runId' and metadata->>'stepNumber'
- `documents_batch_id_idx` (btree) - On batch_id
- `documents_embedding_idx` (ivfflat) - On embedding using vector_cosine_ops

### `codefiles`

Stores code snippets associated with documents.

| Column        | Type          | Description                              | Example                                         |
|---------------|---------------|------------------------------------------|--------------------------------------------------|
| id            | UUID          | Primary key                              | `123e4567-e89b-12d3-a456-426614174001`          |
| document_id   | UUID          | Foreign key to documents (CASCADE)       | `123e4567-e89b-12d3-a456-426614174000`          |
| batch_id      | TEXT          | Batch identifier                         | `query-20240505-123456`                         |
| run_id        | INTEGER       | Run identifier                           | `123`                                           |
| step_number   | INTEGER       | Step number within run                   | `1`                                             |
| filename      | TEXT          | Name of the code file                    | `app.tsx`                                       |
| language      | TEXT          | Programming language                     | `typescript`                                    |
| code_content  | TEXT          | Actual code content                      | `export function App() { return <div>...</div> }` |
| embedding     | VECTOR(1536)  | Vector embedding for similarity search   | `[0.1, 0.2, ...]`                               |
| metadata      | JSONB         | Additional metadata                      | `{"originalDocumentId": "123", ...}`            |
| created_at    | TIMESTAMPTZ   | Creation timestamp                       | `2024-05-05T12:34:56Z`                          |

**Indexes:**
- `codefiles_document_id_idx` (btree) - On document_id
- `codefiles_batch_id_idx` (btree) - On batch_id
- `codefiles_run_step_idx` (btree) - On run_id and step_number
- `codefiles_filename_idx` (btree) - On filename
- `codefiles_language_idx` (btree) - On language
- `codefiles_metadata_idx` (GIN) - For faster JSON querying
- `codefiles_embedding_idx` (ivfflat) - On embedding using vector_cosine_ops
- `idx_codefiles_document_id` (btree) - On document_id
- `idx_codefiles_original_document_id` (GIN) - On metadata->'originalDocumentId'

**Relationships:**
- Foreign key to `documents(id)` with CASCADE delete

### `steps`

Stores structured step information from documents.

| Column         | Type           | Description                     | Example                                |
|----------------|----------------|---------------------------------|----------------------------------------|
| id             | UUID           | Primary key                     | `123e4567-e89b-12d3-a456-426614174002` |
| batch_id       | TEXT           | Batch identifier                | `query-20240505-123456`                |
| document_id    | UUID           | Foreign key to documents        | `123e4567-e89b-12d3-a456-426614174000` |
| run_id         | INTEGER        | Run identifier                  | `123`                                  |
| step_index     | INTEGER        | Step index number               | `1`                                    |
| level          | INTEGER        | Step depth/level                | `0`                                    |
| decision_value | decision_type  | Decision category               | `RECOMMENDED`                          |
| step_data      | JSONB          | Step details                    | `{"title": "First step", ...}`         |
| created_at     | TIMESTAMPTZ    | Creation timestamp              | `2024-05-05T12:34:56Z`                 |

**Indexes:**
- `steps_batch_id_idx` (btree) - On batch_id
- `steps_document_id_idx` (btree) - On document_id
- `steps_level_idx` (btree) - On level
- `steps_run_id_idx` (btree) - On run_id
- `steps_step_index_idx` (btree) - On step_index
- `steps_batch_level_idx` (btree) - On batch_id and level

**Relationships:**
- Foreign key to `documents(id)`

### `ensembles`

Stores ensemble configurations.

| Column        | Type          | Description                                | Example                                 |
|---------------|---------------|--------------------------------------------|------------------------------------------|
| id            | UUID          | Primary key                                | `123e4567-e89b-12d3-a456-426614174003`  |
| name          | TEXT          | User-friendly name                         | `"Production Ensemble"`                  |
| description   | TEXT          | Optional description                       | `"Optimized for production use cases"`   |
| configuration | JSONB         | Complete ensemble configuration            | `{"models": [...], "settings": {...}}`   |
| created_at    | TIMESTAMPTZ   | Creation timestamp                         | `2024-05-05T12:34:56Z`                   |
| updated_at    | TIMESTAMPTZ   | Last update timestamp                      | `2024-05-06T09:12:34Z`                   |

**Indexes:**
- `ensembles_name_idx` (btree) - On name

### `configurations`

Stores tech stack configurations.

| Column           | Type          | Description                     | Example                                |
|------------------|--------------|---------------------------------|----------------------------------------|
| id               | UUID          | Primary key                     | `123e4567-e89b-12d3-a456-426614174004` |
| name             | TEXT          | Configuration name              | `"NextJS + Tailwind"`                  |
| tech_stack_config| JSONB         | Tech stack configuration        | `{"framework": "next", "styling": "tailwind"}` |
| created_at       | TIMESTAMPTZ   | Creation timestamp              | `2024-05-05T12:34:56Z`                 |
| updated_at       | TIMESTAMPTZ   | Last update timestamp           | `2024-05-06T09:12:34Z`                 |

**Indexes:**
- `configurations_name_idx` (btree) - On name

## Views

### `debug_code_files`

A view for debugging code file content and metadata, combining information from both `documents` and `codefiles` tables.

### `document_codefile_relationships`

A view showing relationships between documents and code files.

## Functions

### Vector Search Functions

- `match_documents(query_embedding, match_threshold, match_count)` - Search for similar documents
- `match_codefiles(query_embedding, match_threshold, match_count, filter_language)` - Search for similar code files

### Document Functions

- `get_latest_run_id(model_name)` - Find the latest run_id for a model
- `get_steps_by_batch_id(p_batch_id)` - Get all steps for a batch
- `get_available_batches()` - Get batch_ids with step counts
- `get_document_metadata(doc_id)` - Get a document's metadata
- `jsonb_set_multiple(jsonb_obj, set_path_vals)` - Set multiple fields in JSONB
- `mark_document_codefiles_migrated(doc_id, files_count)` - Update migration status

### Code File Functions

- `get_codefiles_by_document_id(doc_id)` - Get code files for a document
- `get_all_codefiles_by_document_id(doc_id)` - Get all code files from both sources
- `get_codefiles_by_batch_id(p_batch_id)` - Get code files for a batch
- `get_codefiles_by_step_info(p_run_id, p_step_number, p_batch_id)` - Find code files by step
- `find_codefiles_by_any_id(id_value)` - Find code files by any ID type
- `get_document_codefile_relation(doc_id)` - Get relationship information
- `find_documents_with_code(search_term, max_results)` - Text-based code search

### Diagnostics and Troubleshooting

- `find_documents_without_codefiles(limit_count)` - Find documents missing code files
- `find_documents_with_parsing_errors(doc_limit)` - Find documents with JSON parsing errors

## Table Relationships

1. `codefiles.document_id` → `documents.id` (CASCADE delete)
2. `steps.document_id` → `documents.id`

## Migrations and Triggers

- `trigger_update_timestamp()` - Updates the `updated_at` column before update
- `update_configurations_timestamp` - Trigger for configurations table updates

## Database Extensions

- `vector` - Enables vector similarity search using pgvector