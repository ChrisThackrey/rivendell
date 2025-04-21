-- Create the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create decision_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_type') THEN
    CREATE TYPE decision_type AS ENUM ('RECOMMENDED', 'VIABLE', 'PROBLEMATIC');
  END IF;
END$$;

-- Create documents table with vector support for embeddings
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI's text-embedding-3-small uses 1536 dimensions
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  batch_id TEXT, -- Added batch_id for grouping runs by query
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a GIN index on the metadata for faster JSON querying
CREATE INDEX IF NOT EXISTS documents_metadata_idx ON documents USING GIN (metadata);

-- Create an index on run_id and step_number in the metadata
CREATE INDEX IF NOT EXISTS documents_run_step_idx ON documents
  USING btree ((metadata->>'runId'), (metadata->>'stepNumber'));

-- Create an index on batch_id for faster lookups
CREATE INDEX IF NOT EXISTS documents_batch_id_idx ON documents (batch_id);

-- Create a vector similarity index using IVFFlat for faster similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to search for similar documents based on embedding similarity
-- This function will return documents sorted by similarity to the query embedding
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to find the latest run_id for a given model
CREATE OR REPLACE FUNCTION get_latest_run_id(model_name TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  latest_run INT;
BEGIN
  SELECT COALESCE(MAX((metadata->>'runId')::INT), 0)
  INTO latest_run
  FROM documents
  WHERE metadata->>'model' = model_name;

  RETURN latest_run;
END;
$$;

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS get_steps_by_batch_id(TEXT);

-- Function to get all steps for a specific batch from documents table
CREATE OR REPLACE FUNCTION get_steps_by_batch_id(p_batch_id TEXT)
RETURNS TABLE (
  id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  level INTEGER,
  decision_value decision_type,
  step_data JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.batch_id,
    (documents.metadata->>'runId')::INTEGER as run_id,
    (documents.metadata->>'stepNumber')::INTEGER as step_number,
    (documents.metadata->>'level')::INTEGER as level,
    (documents.metadata->>'decision')::decision_type as decision_value,
    jsonb_build_object(
      'title', documents.metadata->>'stepTitle',
      'description', documents.content,
      'type', CASE
               WHEN documents.metadata->>'decision' = 'RECOMMENDED' THEN 'accepted'
               WHEN documents.metadata->>'decision' = 'VIABLE' THEN 'secondary'
               WHEN documents.metadata->>'decision' = 'PROBLEMATIC' THEN 'rejected'
               ELSE 'secondary'
             END,
      'model', documents.metadata->>'model',
      'metrics', documents.metadata->'scores',
      'codeFiles', documents.metadata->'codeFiles'
    ) as step_data,
    documents.created_at
  FROM documents
  WHERE
    documents.batch_id = p_batch_id
    AND documents.metadata->>'stepNumber' IS NOT NULL
  ORDER BY level, step_number, created_at DESC;
END;
$$;

-- Get available batch_ids with count of steps for each batch
CREATE OR REPLACE FUNCTION get_available_batches()
RETURNS TABLE (
  batch_id TEXT,
  step_count INTEGER,
  latest_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.batch_id,
    COUNT(documents.id)::INTEGER as step_count,
    MAX(documents.created_at) as latest_created_at
  FROM documents
  WHERE documents.metadata->>'stepNumber' IS NOT NULL
  GROUP BY documents.batch_id
  ORDER BY latest_created_at DESC;
END;
$$;

-- Create the ensembles table to store saved ensemble configurations
CREATE TABLE IF NOT EXISTS ensembles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  configuration JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create an index on the name for faster lookups
CREATE INDEX IF NOT EXISTS ensembles_name_idx ON ensembles (name);

-- Add a comment to the table
COMMENT ON TABLE ensembles IS 'Stores model ensemble configurations including model selection and run settings';

-- Add comments to the columns
COMMENT ON COLUMN ensembles.id IS 'Unique identifier for the ensemble configuration';
COMMENT ON COLUMN ensembles.name IS 'User-friendly name for the ensemble configuration';
COMMENT ON COLUMN ensembles.description IS 'Optional description of the ensemble configuration';
COMMENT ON COLUMN ensembles.configuration IS 'JSON structure containing the complete ensemble configuration';
COMMENT ON COLUMN ensembles.created_at IS 'When the ensemble configuration was created';
COMMENT ON COLUMN ensembles.updated_at IS 'When the ensemble configuration was last updated';

-- Create configurations table (from create_configurations_table.sql)
CREATE TABLE IF NOT EXISTS configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tech_stack_config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS configurations_name_idx ON configurations (name);
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER update_configurations_timestamp
BEFORE UPDATE ON configurations
FOR EACH ROW
EXECUTE FUNCTION trigger_update_timestamp();

-- Create steps table (from create_steps_table.sql)
CREATE TABLE IF NOT EXISTS steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id),
  run_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  level INTEGER NOT NULL,
  decision_value decision_type NOT NULL,
  step_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS steps_batch_id_idx ON steps (batch_id);
CREATE INDEX IF NOT EXISTS steps_document_id_idx ON steps (document_id);
CREATE INDEX IF NOT EXISTS steps_level_idx ON steps (level);
CREATE INDEX IF NOT EXISTS steps_run_id_idx ON steps (run_id);
CREATE INDEX IF NOT EXISTS steps_step_index_idx ON steps (step_index);
CREATE INDEX IF NOT EXISTS steps_batch_level_idx ON steps (batch_id, level);
-- Function to get all steps for a specific batch
DROP FUNCTION IF EXISTS get_steps_by_batch_id(TEXT);
CREATE OR REPLACE FUNCTION get_steps_by_batch_id(p_batch_id TEXT)
RETURNS TABLE (
  id UUID,
  batch_id TEXT,
  document_id UUID,
  run_id INTEGER,
  step_index INTEGER,
  level INTEGER,
  decision_value decision_type,
  step_data JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    steps.id,
    steps.batch_id,
    steps.document_id,
    steps.run_id,
    steps.step_index,
    steps.level,
    steps.decision_value,
    steps.step_data,
    steps.created_at
  FROM steps
  WHERE steps.batch_id = p_batch_id
  ORDER BY steps.level, steps.step_index, steps.created_at DESC;
END;
$$;

-- Create a view to help debug the codeFiles content
CREATE OR REPLACE VIEW debug_code_files AS
SELECT
  id,
  batch_id,
  metadata->>'runId' as run_id,
  metadata->>'stepNumber' as step_number,
  metadata->>'stepTitle' as step_title,
  metadata->'codeFiles' as code_files,
  jsonb_array_length(COALESCE(metadata->'codeFiles', '[]'::jsonb)) as code_files_count,
  -- Extract filenames from the codeFiles array
  (SELECT jsonb_agg(cf->>'filename')
   FROM jsonb_array_elements(COALESCE(metadata->'codeFiles', '[]'::jsonb)) as cf) as filenames,
  -- Check if code fields exist and are populated
  (SELECT jsonb_agg(
     jsonb_build_object(
       'filename', cf->>'filename',
       'has_code', (cf->>'code') IS NOT NULL,
       'code_length', length(cf->>'code')
     )
   )
   FROM jsonb_array_elements(COALESCE(metadata->'codeFiles', '[]'::jsonb)) as cf) as code_details,
  created_at
FROM
  documents
WHERE
  metadata->'codeFiles' IS NOT NULL AND
  metadata->>'stepNumber' IS NOT NULL
ORDER BY
  created_at DESC;

-- Add codefiles table to separate code snippets from documents
CREATE TABLE IF NOT EXISTS codefiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'plaintext',
  code_content TEXT NOT NULL,
  embedding VECTOR(1536), -- Same dimensions as documents for embedding consistency
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS codefiles_document_id_idx ON codefiles (document_id);
CREATE INDEX IF NOT EXISTS codefiles_batch_id_idx ON codefiles (batch_id);
CREATE INDEX IF NOT EXISTS codefiles_run_step_idx ON codefiles (run_id, step_number);
CREATE INDEX IF NOT EXISTS codefiles_filename_idx ON codefiles (filename);
CREATE INDEX IF NOT EXISTS codefiles_language_idx ON codefiles (language);

-- Create a GIN index on the metadata for faster JSON querying
CREATE INDEX IF NOT EXISTS codefiles_metadata_idx ON codefiles USING GIN (metadata);

-- Create a vector similarity index for code search
CREATE INDEX IF NOT EXISTS codefiles_embedding_idx ON codefiles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Drop existing match_codefiles to allow return type change
DROP FUNCTION IF EXISTS match_codefiles(vector,double precision,integer,text);

-- Function to search for similar code files based on embedding similarity
CREATE OR REPLACE FUNCTION match_codefiles(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  filter_language TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    codefiles.id,
    codefiles.document_id,
    codefiles.batch_id,
    codefiles.run_id,
    codefiles.step_number,
    codefiles.filename,
    codefiles.language,
    codefiles.code_content,
    codefiles.metadata,
    1 - (codefiles.embedding <=> query_embedding) AS similarity,
    codefiles.created_at
  FROM codefiles
  WHERE
    1 - (codefiles.embedding <=> query_embedding) > match_threshold
    AND (filter_language IS NULL OR codefiles.language = filter_language)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to get all code files for a specific document
DROP FUNCTION IF EXISTS get_codefiles_by_document_id(UUID);
CREATE OR REPLACE FUNCTION get_codefiles_by_document_id(doc_id UUID)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check direct matches by document_id
  RETURN QUERY
  SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
         c.filename, c.language, c.code_content, c.embedding, c.metadata, c.created_at
  FROM codefiles c
  WHERE c.document_id = doc_id
  ORDER BY c.created_at DESC;

  -- Also check for document metadata entries that reference this document ID
  -- This helps with documents that might have references to the ID in their metadata
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
           c.filename, c.language, c.code_content, c.embedding, c.metadata, c.created_at
    FROM codefiles c
    WHERE c.metadata->>'originalDocumentId' = doc_id::TEXT
    ORDER BY c.created_at DESC;
  END IF;
END;
$$;

-- Function to get all code files for a specific batch
CREATE OR REPLACE FUNCTION get_codefiles_by_batch_id(p_batch_id TEXT)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    codefiles.id,
    codefiles.document_id,
    codefiles.batch_id,
    codefiles.run_id,
    codefiles.step_number,
    codefiles.filename,
    codefiles.language,
    codefiles.code_content,
    codefiles.metadata,
    codefiles.created_at
  FROM codefiles
  WHERE codefiles.batch_id = p_batch_id
  ORDER BY codefiles.run_id, codefiles.step_number, codefiles.filename;
END;
$$;

-- Enhanced debug_code_files view to include both document metadata and dedicated table
DROP VIEW IF EXISTS debug_code_files;

CREATE OR REPLACE VIEW debug_code_files AS
WITH metadata_files AS (
  -- Code files from document metadata
  SELECT
    documents.id AS document_id,
    documents.batch_id,
    (documents.metadata->>'runId')::INTEGER as run_id,
    (documents.metadata->>'stepNumber')::INTEGER as step_number,
    documents.metadata->>'stepTitle' as step_title,
    documents.metadata->'codeFiles' as code_files,
    jsonb_array_length(COALESCE(documents.metadata->'codeFiles', '[]'::jsonb)) as code_files_count,
    -- Extract filenames from the codeFiles array
    (SELECT jsonb_agg(cf->>'filename')
     FROM jsonb_array_elements(COALESCE(documents.metadata->'codeFiles', '[]'::jsonb)) as cf) as filenames,
    -- Check if code fields exist and are populated
    (SELECT jsonb_agg(
       jsonb_build_object(
         'filename', cf->>'filename',
         'has_code', (cf->>'code') IS NOT NULL AND (cf->>'code') <> '',
         'code_length', length(cf->>'code')
       )
     )
     FROM jsonb_array_elements(COALESCE(documents.metadata->'codeFiles', '[]'::jsonb)) as cf) as code_details,
    documents.created_at,
    'metadata' as source,
    CASE
      WHEN jsonb_array_length(COALESCE(documents.metadata->'codeFiles', '[]'::jsonb)) > 0 AND
           (SELECT bool_or((cf->>'code') IS NOT NULL AND (cf->>'code') <> '')
            FROM jsonb_array_elements(COALESCE(documents.metadata->'codeFiles', '[]'::jsonb)) as cf)
      THEN jsonb_build_object('codeFilesMigrated', true)
      ELSE jsonb_build_object('codeFilesMigrated', COALESCE((documents.metadata->>'codeFilesMigrated')::boolean, false))
    END as migration_status
  FROM
    documents
  WHERE
    documents.metadata->'codeFiles' IS NOT NULL AND
    documents.metadata->>'stepNumber' IS NOT NULL
),
table_files AS (
  -- Code files from dedicated codefiles table
  SELECT
    cf.document_id,
    MAX(cf.batch_id) as batch_id,
    MAX(cf.run_id) as run_id,
    MAX(cf.step_number) as step_number,
    MAX(d.metadata->>'stepTitle') as step_title,
    -- Format the code files similar to metadata structure for consistency
    jsonb_agg(
      jsonb_build_object(
        'filename', cf.filename,
        'language', cf.language,
        'code', cf.code_content
      )
    ) as code_files,
    COUNT(cf.id) as code_files_count,
    -- Extract filenames from the codefiles
    jsonb_agg(cf.filename) as filenames,
    -- Check if code fields exist and are populated
    jsonb_agg(
      jsonb_build_object(
        'filename', cf.filename,
        'has_code', cf.code_content IS NOT NULL AND cf.code_content <> '',
        'code_length', length(cf.code_content)
      )
    ) as code_details,
    MAX(cf.created_at) as created_at,
    'codefiles_table' as source,
    CASE
      WHEN BOOL_OR((d.metadata->>'codeFilesMigrated')::boolean) THEN
        jsonb_build_object('codeFilesMigrated', true)
      WHEN COUNT(cf.id) > 0 AND BOOL_OR(cf.code_content IS NOT NULL AND cf.code_content <> '') THEN
        jsonb_build_object('codeFilesMigrated', true)
      ELSE
        jsonb_build_object('codeFilesMigrated', false)
    END as migration_status
  FROM
    codefiles cf
  JOIN
    documents d ON cf.document_id = d.id
  GROUP BY
    cf.document_id
)

-- Union both sources and sort by created_at
SELECT * FROM metadata_files
UNION ALL
SELECT * FROM table_files
ORDER BY created_at DESC;

-- Create a helper function to get all code files for a document from both sources
CREATE OR REPLACE FUNCTION get_all_codefiles_by_document_id(doc_id UUID)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  source TEXT  -- 'metadata' or 'codefiles_table'
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First get code files from the codefiles table
  RETURN QUERY
  SELECT
    codefiles.id,
    codefiles.document_id,
    codefiles.batch_id,
    codefiles.run_id,
    codefiles.step_number,
    codefiles.filename,
    codefiles.language,
    codefiles.code_content,
    codefiles.metadata,
    codefiles.created_at,
    'codefiles_table'::TEXT as source
  FROM codefiles
  WHERE codefiles.document_id = doc_id;

  -- Then get code files from metadata (if any exist)
  RETURN QUERY
  SELECT
    gen_random_uuid() as id, -- Generate ID for metadata files
    d.id as document_id,
    d.batch_id,
    (d.metadata->>'runId')::INTEGER as run_id,
    (d.metadata->>'stepNumber')::INTEGER as step_number,
    cf->>'filename' as filename,
    COALESCE(cf->>'language', 'plaintext') as language,
    cf->>'code' as code_content,
    jsonb_build_object(
      'source', 'document_metadata',
      'original', true
    ) as metadata,
    d.created_at,
    'metadata'::TEXT as source
  FROM documents d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.metadata->'codeFiles', '[]'::jsonb)) as cf
  WHERE d.id = doc_id
  AND d.metadata->'codeFiles' IS NOT NULL
  AND jsonb_array_length(COALESCE(d.metadata->'codeFiles', '[]'::jsonb)) > 0;
END;
$$;

-- Function to find code files by step information (run_id, step_number)
CREATE OR REPLACE FUNCTION get_codefiles_by_step_info(
  p_run_id INTEGER,
  p_step_number INTEGER,
  p_batch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id UUID,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First try to get step code files from the codefiles table
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.batch_id,
    c.run_id,
    c.step_number,
    c.filename,
    c.language,
    c.code_content,
    c.embedding,
    c.metadata,
    c.created_at
  FROM
    codefiles c
  WHERE
    c.run_id = p_run_id AND
    c.step_number = p_step_number AND
    (p_batch_id IS NULL OR c.batch_id = p_batch_id)
  ORDER BY
    c.created_at DESC;

  -- If no files found with exact step info, try broader approach via document metadata
  -- This helps cover cases where code files exist but weren't properly associated with step info
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      gen_random_uuid() as id,
      d.id as document_id,
      d.batch_id,
      p_run_id as run_id,
      p_step_number as step_number,
      cf.filename,
      cf.language,
      cf.code as code_content,
      NULL as embedding,
      jsonb_build_object(
        'source', 'document_metadata',
        'extracted', true
      ) as metadata,
      d.created_at
    FROM
      documents d,
      jsonb_to_recordset(d.metadata->'codeFiles') as cf(filename text, language text, code text)
    WHERE
      d.metadata->>'runId' = p_run_id::text AND
      d.metadata->>'stepNumber' = p_step_number::text AND
      (p_batch_id IS NULL OR d.batch_id = p_batch_id) AND
      cf.filename IS NOT NULL AND
      cf.code IS NOT NULL AND
      length(cf.code) > 10; -- Skip placeholder files
  END IF;
END;
$$;

-- Add a comment to explain the view and functions
COMMENT ON VIEW debug_code_files IS 'Debugging view that combines code files from both document metadata and the dedicated codefiles table';
COMMENT ON FUNCTION get_all_codefiles_by_document_id IS 'Function to retrieve all code files for a document from both storage locations';

-- Add helper functions for working with JSONB in document metadata

-- Function to get a document's metadata by ID
CREATE OR REPLACE FUNCTION get_document_metadata(doc_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  doc_metadata JSONB;
BEGIN
  SELECT metadata INTO doc_metadata
  FROM documents
  WHERE id = doc_id;

  -- Return empty JSONB if not found
  RETURN COALESCE(doc_metadata, '{}'::JSONB);
END;
$$;

-- Function to set multiple fields in a JSONB object at once
CREATE OR REPLACE FUNCTION jsonb_set_multiple(
  jsonb_obj JSONB,
  set_path_vals JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := jsonb_obj;
  key TEXT;
  value JSONB;
BEGIN
  -- Iterate through all keys in set_path_vals
  FOR key, value IN SELECT * FROM jsonb_each(set_path_vals)
  LOOP
    -- Set each key-value pair in the original object
    result := jsonb_set(
      result,
      ARRAY[key],
      value,
      true  -- Create path if it doesn't exist
    );
  END LOOP;

  RETURN result;
END;
$$;

-- Function to update document migration status
CREATE OR REPLACE FUNCTION mark_document_codefiles_migrated(
  doc_id UUID,
  files_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  success BOOLEAN := FALSE;
  original_metadata JSONB;
  updated_metadata JSONB;
BEGIN
  -- Get the current metadata
  SELECT metadata INTO original_metadata
  FROM documents
  WHERE id = doc_id;

  -- Update the metadata with migration information
  updated_metadata := jsonb_set_multiple(
    COALESCE(original_metadata, '{}'::JSONB),
    jsonb_build_object(
      'codeFilesMigrated', 'true'::JSONB,
      'codeFilesMigratedAt', to_jsonb(now()),
      'codeFilesMigrationCount', to_jsonb(files_count)
    )
  );

  -- Update the document
  UPDATE documents
  SET metadata = updated_metadata
  WHERE id = doc_id;

  -- Check if the update was successful
  GET DIAGNOSTICS success = ROW_COUNT;

  RETURN success > 0;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_document_metadata IS 'Retrieves the metadata JSONB for a document by ID';
COMMENT ON FUNCTION jsonb_set_multiple IS 'Sets multiple key-value pairs in a JSONB object at once';
COMMENT ON FUNCTION mark_document_codefiles_migrated IS 'Marks a document as having its code files migrated to the dedicated table';

-- Migration to add cascade delete to codefiles table
-- This ensures that when a document is deleted, its related code files are also deleted

-- First drop the existing foreign key constraint
ALTER TABLE codefiles
DROP CONSTRAINT IF EXISTS codefiles_document_id_fkey;

-- Then recreate it with ON DELETE CASCADE
ALTER TABLE codefiles
ADD CONSTRAINT codefiles_document_id_fkey
FOREIGN KEY (document_id)
REFERENCES documents(id)
ON DELETE CASCADE;

-- Add a comment to explain the constraint
COMMENT ON CONSTRAINT codefiles_document_id_fkey ON codefiles IS
'Foreign key constraint that ensures when a document is deleted, all its related code files are also deleted';

-- Function to find documents that don't have any associated code files
DROP FUNCTION IF EXISTS find_documents_without_codefiles(integer);
CREATE OR REPLACE FUNCTION find_documents_without_codefiles(doc_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  batch_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH docs_with_codefiles AS (
    -- Get IDs of documents that have code files in the codefiles table
    SELECT DISTINCT document_id
    FROM codefiles
  ),
  docs_with_metadata_codefiles AS (
    -- Get IDs of documents that have code files in their metadata
    SELECT id
    FROM documents
    WHERE
      jsonb_array_length(COALESCE(metadata->'codeFiles', '[]'::jsonb)) > 0
  ),
  docs_with_error_codefiles AS (
    -- Find documents with error placeholder code files
    SELECT document_id
    FROM codefiles
    WHERE
      code_content LIKE '%Automatically generated step due to JSON parsing error%' OR
      code_content LIKE '%// Generated Step%'
  )
  -- Select documents that have error placeholder code files
  -- or don't have code files at all
  SELECT
    d.id,
    d.content,
    d.metadata,
    d.batch_id,
    d.created_at
  FROM documents d
  WHERE
    d.id IN (SELECT document_id FROM docs_with_error_codefiles) OR
    (
      d.id NOT IN (SELECT document_id FROM docs_with_codefiles) AND
      d.id NOT IN (SELECT id FROM docs_with_metadata_codefiles) AND
      -- Not a placeholder document
      (d.content <> '{"placeholder": true}' AND d.content <> '{"placeholder":true}') AND
      -- Doesn't explicitly have placeholder flag in metadata
      (d.metadata->>'isPlaceholder' IS NULL OR d.metadata->>'isPlaceholder' <> 'true') AND
      -- Looks like a step document (has stepNumber in metadata)
      d.metadata->>'stepNumber' IS NOT NULL
    )
  ORDER BY d.created_at DESC
  LIMIT doc_limit;
END;
$$;

-- Add a function to identify documents with JSON parsing errors specifically
CREATE OR REPLACE FUNCTION find_documents_with_parsing_errors(doc_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  batch_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    d.batch_id,
    d.created_at
  FROM documents d
  JOIN codefiles c ON d.id = c.document_id
  WHERE
    c.code_content LIKE '%Automatically generated step due to JSON parsing error%' OR
    c.code_content LIKE '%// Generated Step%'
  ORDER BY d.created_at DESC
  LIMIT doc_limit;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION find_documents_without_codefiles IS 'Finds documents that do not have any associated code files, either in the codefiles table or in their metadata';
COMMENT ON FUNCTION find_documents_with_parsing_errors IS 'Finds documents that have placeholder code files due to JSON parsing errors';

-- This migration enhances the relationship between documents and codefiles tables
-- It ensures proper handling of document IDs in various code file functions

-- Updated get_codefiles_by_document_id function
-- This enhances the existing function to handle document ID conversion
-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS get_codefiles_by_document_id(UUID);

CREATE OR REPLACE FUNCTION get_codefiles_by_document_id(doc_id UUID)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check direct matches by document_id
  RETURN QUERY
  SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
         c.filename, c.language, c.code_content, c.embedding, c.metadata, c.created_at
  FROM codefiles c
  WHERE c.document_id = doc_id
  ORDER BY c.created_at DESC;

  -- Also check for document metadata entries that reference this document ID
  -- This helps with documents that might have references to the ID in their metadata
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
           c.filename, c.language, c.code_content, c.embedding, c.metadata, c.created_at
    FROM codefiles c
    WHERE c.metadata->>'originalDocumentId' = doc_id::TEXT
    ORDER BY c.created_at DESC;
  END IF;
END;
$$;

-- Create a function to find codefiles by either a UUID or string ID
-- This handles cases where non-UUID IDs have been converted to UUIDs
CREATE OR REPLACE FUNCTION find_codefiles_by_any_id(id_value TEXT)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  batch_id TEXT,
  run_id INTEGER,
  step_number INTEGER,
  filename TEXT,
  language TEXT,
  code_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  is_valid_uuid BOOLEAN;
  original_id TEXT := id_value;
  valid_doc_id UUID;
BEGIN
  -- Check if the input is a valid UUID
  BEGIN
    valid_doc_id := id_value::UUID;
    is_valid_uuid := TRUE;
  EXCEPTION WHEN others THEN
    is_valid_uuid := FALSE;
  END;

  -- If it's a valid UUID, query directly
  IF is_valid_uuid THEN
    RETURN QUERY
    SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
           c.filename, c.language, c.code_content, c.metadata, c.created_at
    FROM codefiles c
    WHERE c.document_id = valid_doc_id;

    -- Also look for it in metadata
    IF NOT FOUND THEN
      RETURN QUERY
      SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
             c.filename, c.language, c.code_content, c.metadata, c.created_at
      FROM codefiles c
      WHERE c.metadata->>'originalDocumentId' = id_value;
    END IF;
  ELSE
    -- For non-UUID IDs, check metadata
    RETURN QUERY
    SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
           c.filename, c.language, c.code_content, c.metadata, c.created_at
    FROM codefiles c
    WHERE c.metadata->>'originalDocumentId' = id_value;

    -- If still not found, look for pattern matches
    IF NOT FOUND THEN
      RETURN QUERY
      SELECT c.id, c.document_id, c.batch_id, c.run_id, c.step_number,
             c.filename, c.language, c.code_content, c.metadata, c.created_at
      FROM codefiles c
      WHERE
        c.metadata->>'originalId' = id_value
        OR c.metadata->>'source_id' = id_value
        OR (c.metadata->'documentInfo'->>'id')::TEXT = id_value;
    END IF;
  END IF;
END;
$$;

-- Create a view to help diagnose document-codefile relationship issues
CREATE OR REPLACE VIEW document_codefile_relationships AS
SELECT
  d.id AS document_id,
  d.batch_id,
  d.created_at AS document_created,
  (d.metadata->>'runId')::TEXT AS run_id,
  (d.metadata->>'stepNumber')::TEXT AS step_number,
  (SELECT COUNT(*) FROM codefiles c WHERE c.document_id = d.id) AS codefiles_count,
  CASE
    WHEN (SELECT COUNT(*) FROM codefiles c WHERE c.document_id = d.id) > 0 THEN true
    ELSE false
  END AS has_codefiles,
  CASE
    WHEN d.metadata->>'codeFiles' IS NOT NULL THEN true
    ELSE false
  END AS has_metadata_codefiles,
  CASE
    WHEN d.metadata->>'isPlaceholder' = 'true' THEN true
    ELSE false
  END AS is_placeholder,
  d.metadata->>'originalId' AS original_id,
  d.metadata->>'source' AS document_source
FROM
  documents d;

-- Create an index on document_id in codefiles table to speed up lookups
CREATE INDEX IF NOT EXISTS idx_codefiles_document_id ON codefiles(document_id);

-- Create an index on document metadata's originalId field if it exists
CREATE INDEX IF NOT EXISTS idx_codefiles_original_document_id ON codefiles USING GIN ((metadata -> 'originalDocumentId'));

-- Create a function to find documents that need code files but don't have any
-- This enhances the existing function to check for placeholder documents
DROP FUNCTION IF EXISTS find_documents_without_codefiles(integer);
CREATE OR REPLACE FUNCTION find_documents_without_codefiles(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  document_id UUID,
  batch_id TEXT,
  content_preview TEXT,
  created_at TIMESTAMPTZ,
  metadata_keys TEXT[],
  is_missing_codefiles BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH docs_with_potential_codefiles AS (
    SELECT
      d.id,
      d.batch_id,
      d.content,
      d.created_at,
      array_agg(DISTINCT jsonb_object_keys(d.metadata)) as metadata_keys,
      CASE
        WHEN d.content ILIKE '%"codeFiles"%' OR d.metadata->>'codeFiles' IS NOT NULL THEN TRUE
        WHEN d.content ILIKE '%```%' OR d.content ILIKE '%function%' OR d.content ILIKE '%class%' THEN TRUE
        WHEN d.content ILIKE '%code%' OR d.metadata->>'code' IS NOT NULL THEN TRUE
        WHEN d.metadata->>'isPlaceholder' = 'true' THEN FALSE -- Skip placeholder documents
        ELSE FALSE
      END as might_have_code
    FROM documents d
    GROUP BY d.id, d.batch_id, d.content, d.created_at, d.metadata
  ),
  documents_without_codefiles AS (
    SELECT
      d.id,
      d.batch_id,
      d.content,
      d.created_at,
      d.metadata_keys,
      CASE
        WHEN (SELECT COUNT(*) FROM codefiles c WHERE c.document_id = d.id) = 0
        AND d.might_have_code = TRUE
        THEN TRUE
        ELSE FALSE
      END as is_missing_codefiles
    FROM docs_with_potential_codefiles d
  )
  SELECT
    dwc.id as document_id,
    dwc.batch_id,
    LEFT(dwc.content, 200) as content_preview,
    dwc.created_at,
    dwc.metadata_keys,
    dwc.is_missing_codefiles
  FROM documents_without_codefiles dwc
  WHERE dwc.is_missing_codefiles = TRUE
  ORDER BY dwc.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Add RPC function to make the document_codefile_relationships view accessible through the API
-- This allows for TypeScript compatibility in the code-snippets API

-- First, create a function to get document-codefile relationship information
CREATE OR REPLACE FUNCTION get_document_codefile_relation(doc_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  relation_data JSON;
BEGIN
  SELECT
    json_build_object(
      'document_id', d.id,
      'batch_id', d.batch_id,
      'run_id', (d.metadata->>'runId'),
      'step_number', (d.metadata->>'stepNumber'),
      'document_created', d.created_at,
      'has_codefiles', (SELECT COUNT(*) > 0 FROM codefiles c WHERE c.document_id = d.id),
      'codefiles_count', (SELECT COUNT(*) FROM codefiles c WHERE c.document_id = d.id),
      'has_metadata_codefiles', (d.metadata->>'codeFiles' IS NOT NULL),
      'is_placeholder', (d.metadata->>'isPlaceholder' = 'true'),
      'original_id', d.metadata->>'originalId',
      'document_source', d.metadata->>'source'
    ) INTO relation_data
  FROM
    documents d
  WHERE
    d.id = doc_id;

  RETURN relation_data;
END;
$$;

-- Add a comment to explain the function
COMMENT ON FUNCTION get_document_codefile_relation IS 'Function to get document-codefile relationship information for a specific document';

-- Add function for text-based search fallback when vector similarity fails
CREATE OR REPLACE FUNCTION find_documents_with_code(search_term TEXT, max_results INTEGER)
RETURNS TABLE (
  document_id UUID,
  document_content JSONB,
  document_metadata JSONB,
  document_created_at TIMESTAMPTZ,
  codefile_id UUID,
  filename TEXT,
  code_content TEXT,
  language TEXT,
  embedding vector(1536)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as document_id,
    d.content as document_content,
    d.metadata as document_metadata,
    d.created_at as document_created_at,
    c.id as codefile_id,
    c.filename,
    c.code_content,
    c.language,
    c.embedding
  FROM
    documents d
  JOIN
    codefiles c ON c.document_id = d.id
  WHERE
    c.filename ILIKE '%' || search_term || '%' OR
    c.code_content ILIKE '%' || search_term || '%'
  ORDER BY
    d.created_at DESC
  LIMIT max_results;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION find_documents_with_code IS 'Function to find documents with code content by search term without using vector embeddings';
