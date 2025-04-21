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
