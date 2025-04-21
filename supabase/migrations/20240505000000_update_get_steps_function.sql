-- Ensure decision_type enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_type') THEN
    CREATE TYPE decision_type AS ENUM ('RECOMMENDED', 'VIABLE', 'PROBLEMATIC');
  END IF;
END$$;

-- Update the get_steps_by_batch_id function to include codeFiles
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
