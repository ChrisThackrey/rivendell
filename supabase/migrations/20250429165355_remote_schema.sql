SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
COMMENT ON SCHEMA "public" IS 'standard public schema';
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
CREATE TYPE "public"."decision_type" AS ENUM (
    'RECOMMENDED',
    'VIABLE',
    'PROBLEMATIC'
);
ALTER TYPE "public"."decision_type" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."find_codefiles_by_any_id"("id_value" "text") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "text", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."find_codefiles_by_any_id"("id_value" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) RETURNS TABLE("document_id" "uuid", "document_content" "jsonb", "document_metadata" "jsonb", "document_created_at" timestamp with time zone, "codefile_id" "uuid", "filename" "text", "code_content" "text", "language" "text", "embedding" "public"."vector")
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) OWNER TO "postgres";
COMMENT ON FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) IS 'Function to find documents with code content by search term without using vector embeddings';
CREATE OR REPLACE FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "batch_id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer) OWNER TO "postgres";
COMMENT ON FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer) IS 'Finds documents that have placeholder code files due to JSON parsing errors';
CREATE OR REPLACE FUNCTION "public"."find_documents_without_codefiles"("limit_count" integer DEFAULT 50) RETURNS TABLE("document_id" "uuid", "batch_id" "text", "content_preview" "text", "created_at" timestamp with time zone, "metadata_keys" "text"[], "is_missing_codefiles" boolean)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."find_documents_without_codefiles"("limit_count" integer) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "text", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "source" "text")
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") IS 'Function to retrieve all code files for a document from both storage locations';
CREATE OR REPLACE FUNCTION "public"."get_available_batches"() RETURNS TABLE("batch_id" "text", "step_count" integer, "latest_created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_available_batches"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_codefiles_by_batch_id"("p_batch_id" "text") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "text", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_codefiles_by_batch_id"("p_batch_id" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_codefiles_by_document_id"("doc_id" "uuid") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "text", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "embedding" "public"."vector", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_codefiles_by_document_id"("doc_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_codefiles_by_step_info"("p_run_id" integer, "p_step_number" integer, "p_batch_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "uuid", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "embedding" "public"."vector", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_codefiles_by_step_info"("p_run_id" integer, "p_step_number" integer, "p_batch_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") IS 'Function to get document-codefile relationship information for a specific document';
CREATE OR REPLACE FUNCTION "public"."get_document_metadata"("doc_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_document_metadata"("doc_id" "uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."get_document_metadata"("doc_id" "uuid") IS 'Retrieves the metadata JSONB for a document by ID';
CREATE OR REPLACE FUNCTION "public"."get_latest_run_id"("model_name" "text") RETURNS integer
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_latest_run_id"("model_name" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_steps_by_batch_id"("p_batch_id" "text") RETURNS TABLE("id" "uuid", "batch_id" "text", "document_id" "uuid", "run_id" integer, "step_index" integer, "level" integer, "decision_value" "public"."decision_type", "step_data" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."get_steps_by_batch_id"("p_batch_id" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") IS 'Sets multiple key-value pairs in a JSONB object at once';
CREATE OR REPLACE FUNCTION "public"."list_extensions"() RETURNS TABLE("extname" "text")
    LANGUAGE "sql"
    AS $$
  SELECT extname FROM pg_extension;
$$;
ALTER FUNCTION "public"."list_extensions"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."list_extensions"("input" "json") RETURNS TABLE("extname" "text")
    LANGUAGE "sql"
    AS $$
  SELECT extname FROM pg_extension;
$$;
ALTER FUNCTION "public"."list_extensions"("input" "json") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."list_extensions"("input" "jsonb") RETURNS TABLE("extname" "text")
    LANGUAGE "sql"
    AS $$
  SELECT extname FROM pg_extension;
$$;
ALTER FUNCTION "public"."list_extensions"("input" "jsonb") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) RETURNS boolean
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) OWNER TO "postgres";
COMMENT ON FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) IS 'Marks a document as having its code files migrated to the dedicated table';
CREATE OR REPLACE FUNCTION "public"."match_codefiles"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_language" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "document_id" "uuid", "batch_id" "text", "run_id" integer, "step_number" integer, "filename" "text", "language" "text", "code_content" "text", "metadata" "jsonb", "similarity" double precision, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."match_codefiles"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_language" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
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
ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."trigger_update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."trigger_update_timestamp"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_ensembles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_ensembles_updated_at"() OWNER TO "postgres";
SET default_tablespace = '';
SET default_table_access_method = "heap";
CREATE TABLE IF NOT EXISTS "public"."codefiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "batch_id" "text",
    "run_id" integer,
    "step_number" integer,
    "filename" "text" NOT NULL,
    "language" "text" DEFAULT 'plaintext'::"text" NOT NULL,
    "code_content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."codefiles" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "tech_stack_config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."configurations" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "batch_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."documents" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."debug_code_files" AS
 WITH "metadata_files" AS (
         SELECT "documents"."id" AS "document_id",
            "documents"."batch_id",
            (("documents"."metadata" ->> 'runId'::"text"))::integer AS "run_id",
            (("documents"."metadata" ->> 'stepNumber'::"text"))::integer AS "step_number",
            ("documents"."metadata" ->> 'stepTitle'::"text") AS "step_title",
            ("documents"."metadata" -> 'codeFiles'::"text") AS "code_files",
            "jsonb_array_length"(COALESCE(("documents"."metadata" -> 'codeFiles'::"text"), '[]'::"jsonb")) AS "code_files_count",
            ( SELECT "jsonb_agg"(("cf"."value" ->> 'filename'::"text")) AS "jsonb_agg"
                   FROM "jsonb_array_elements"(COALESCE(("documents"."metadata" -> 'codeFiles'::"text"), '[]'::"jsonb")) "cf"("value")) AS "filenames",
            ( SELECT "jsonb_agg"("jsonb_build_object"('filename', ("cf"."value" ->> 'filename'::"text"), 'has_code', ((("cf"."value" ->> 'code'::"text") IS NOT NULL) AND (("cf"."value" ->> 'code'::"text") <> ''::"text")), 'code_length', "length"(("cf"."value" ->> 'code'::"text")))) AS "jsonb_agg"
                   FROM "jsonb_array_elements"(COALESCE(("documents"."metadata" -> 'codeFiles'::"text"), '[]'::"jsonb")) "cf"("value")) AS "code_details",
            "documents"."created_at",
            'metadata'::"text" AS "source",
                CASE
                    WHEN (("jsonb_array_length"(COALESCE(("documents"."metadata" -> 'codeFiles'::"text"), '[]'::"jsonb")) > 0) AND ( SELECT "bool_or"(((("cf"."value" ->> 'code'::"text") IS NOT NULL) AND (("cf"."value" ->> 'code'::"text") <> ''::"text"))) AS "bool_or"
                       FROM "jsonb_array_elements"(COALESCE(("documents"."metadata" -> 'codeFiles'::"text"), '[]'::"jsonb")) "cf"("value"))) THEN "jsonb_build_object"('codeFilesMigrated', true)
                    ELSE "jsonb_build_object"('codeFilesMigrated', COALESCE((("documents"."metadata" ->> 'codeFilesMigrated'::"text"))::boolean, false))
                END AS "migration_status"
           FROM "public"."documents"
          WHERE ((("documents"."metadata" -> 'codeFiles'::"text") IS NOT NULL) AND (("documents"."metadata" ->> 'stepNumber'::"text") IS NOT NULL))
        ), "table_files" AS (
         SELECT "cf"."document_id",
            "max"("cf"."batch_id") AS "batch_id",
            "max"("cf"."run_id") AS "run_id",
            "max"("cf"."step_number") AS "step_number",
            "max"(("d"."metadata" ->> 'stepTitle'::"text")) AS "step_title",
            "jsonb_agg"("jsonb_build_object"('filename', "cf"."filename", 'language', "cf"."language", 'code', "cf"."code_content")) AS "code_files",
            "count"("cf"."id") AS "code_files_count",
            "jsonb_agg"("cf"."filename") AS "filenames",
            "jsonb_agg"("jsonb_build_object"('filename', "cf"."filename", 'has_code', (("cf"."code_content" IS NOT NULL) AND ("cf"."code_content" <> ''::"text")), 'code_length', "length"("cf"."code_content"))) AS "code_details",
            "max"("cf"."created_at") AS "created_at",
            'codefiles_table'::"text" AS "source",
                CASE
                    WHEN "bool_or"((("d"."metadata" ->> 'codeFilesMigrated'::"text"))::boolean) THEN "jsonb_build_object"('codeFilesMigrated', true)
                    WHEN (("count"("cf"."id") > 0) AND "bool_or"((("cf"."code_content" IS NOT NULL) AND ("cf"."code_content" <> ''::"text")))) THEN "jsonb_build_object"('codeFilesMigrated', true)
                    ELSE "jsonb_build_object"('codeFilesMigrated', false)
                END AS "migration_status"
           FROM ("public"."codefiles" "cf"
             JOIN "public"."documents" "d" ON (("cf"."document_id" = "d"."id")))
          GROUP BY "cf"."document_id"
        )
 SELECT "metadata_files"."document_id",
    "metadata_files"."batch_id",
    "metadata_files"."run_id",
    "metadata_files"."step_number",
    "metadata_files"."step_title",
    "metadata_files"."code_files",
    "metadata_files"."code_files_count",
    "metadata_files"."filenames",
    "metadata_files"."code_details",
    "metadata_files"."created_at",
    "metadata_files"."source",
    "metadata_files"."migration_status"
   FROM "metadata_files"
UNION ALL
 SELECT "table_files"."document_id",
    "table_files"."batch_id",
    "table_files"."run_id",
    "table_files"."step_number",
    "table_files"."step_title",
    "table_files"."code_files",
    "table_files"."code_files_count",
    "table_files"."filenames",
    "table_files"."code_details",
    "table_files"."created_at",
    "table_files"."source",
    "table_files"."migration_status"
   FROM "table_files"
  ORDER BY 10 DESC;
ALTER TABLE "public"."debug_code_files" OWNER TO "postgres";
COMMENT ON VIEW "public"."debug_code_files" IS 'Debugging view that combines code files from both document metadata and the dedicated codefiles table';
CREATE OR REPLACE VIEW "public"."document_codefile_relationships" AS
 SELECT "d"."id" AS "document_id",
    "d"."batch_id",
    "d"."created_at" AS "document_created",
    ("d"."metadata" ->> 'runId'::"text") AS "run_id",
    ("d"."metadata" ->> 'stepNumber'::"text") AS "step_number",
    ( SELECT "count"(*) AS "count"
           FROM "public"."codefiles" "c"
          WHERE ("c"."document_id" = "d"."id")) AS "codefiles_count",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "public"."codefiles" "c"
              WHERE ("c"."document_id" = "d"."id")) > 0) THEN true
            ELSE false
        END AS "has_codefiles",
        CASE
            WHEN (("d"."metadata" ->> 'codeFiles'::"text") IS NOT NULL) THEN true
            ELSE false
        END AS "has_metadata_codefiles",
        CASE
            WHEN (("d"."metadata" ->> 'isPlaceholder'::"text") = 'true'::"text") THEN true
            ELSE false
        END AS "is_placeholder",
    ("d"."metadata" ->> 'originalId'::"text") AS "original_id",
    ("d"."metadata" ->> 'source'::"text") AS "document_source"
   FROM "public"."documents" "d";
ALTER TABLE "public"."document_codefile_relationships" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."ensembles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "configuration" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."ensembles" OWNER TO "postgres";
COMMENT ON TABLE "public"."ensembles" IS 'Stores model ensemble configurations including model selection and run settings';
COMMENT ON COLUMN "public"."ensembles"."id" IS 'Unique identifier for the ensemble configuration';
COMMENT ON COLUMN "public"."ensembles"."name" IS 'User-friendly name for the ensemble configuration';
COMMENT ON COLUMN "public"."ensembles"."description" IS 'Optional description of the ensemble configuration';
COMMENT ON COLUMN "public"."ensembles"."configuration" IS 'JSON structure containing the complete ensemble configuration';
COMMENT ON COLUMN "public"."ensembles"."created_at" IS 'When the ensemble configuration was created';
COMMENT ON COLUMN "public"."ensembles"."updated_at" IS 'When the ensemble configuration was last updated';
CREATE TABLE IF NOT EXISTS "public"."steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "text" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "run_id" integer NOT NULL,
    "step_index" integer NOT NULL,
    "level" integer NOT NULL,
    "decision_value" "public"."decision_type" NOT NULL,
    "step_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."steps" OWNER TO "postgres";
ALTER TABLE ONLY "public"."codefiles"
    ADD CONSTRAINT "codefiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."configurations"
    ADD CONSTRAINT "configurations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."ensembles"
    ADD CONSTRAINT "ensembles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."steps"
    ADD CONSTRAINT "steps_pkey" PRIMARY KEY ("id");
CREATE INDEX "codefiles_batch_id_idx" ON "public"."codefiles" USING "btree" ("batch_id");
CREATE INDEX "codefiles_document_id_idx" ON "public"."codefiles" USING "btree" ("document_id");
CREATE INDEX "codefiles_embedding_idx" ON "public"."codefiles" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');
CREATE INDEX "codefiles_filename_idx" ON "public"."codefiles" USING "btree" ("filename");
CREATE INDEX "codefiles_language_idx" ON "public"."codefiles" USING "btree" ("language");
CREATE INDEX "codefiles_metadata_idx" ON "public"."codefiles" USING "gin" ("metadata");
CREATE INDEX "codefiles_run_step_idx" ON "public"."codefiles" USING "btree" ("run_id", "step_number");
CREATE INDEX "configurations_name_idx" ON "public"."configurations" USING "btree" ("name");
CREATE INDEX "documents_batch_id_idx" ON "public"."documents" USING "btree" ("batch_id");
CREATE INDEX "documents_embedding_idx" ON "public"."documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');
CREATE INDEX "documents_metadata_idx" ON "public"."documents" USING "gin" ("metadata");
CREATE INDEX "documents_run_step_idx" ON "public"."documents" USING "btree" ((("metadata" ->> 'runId'::"text")), (("metadata" ->> 'stepNumber'::"text")));
CREATE INDEX "ensembles_name_idx" ON "public"."ensembles" USING "btree" ("name");
CREATE INDEX "idx_codefiles_document_id" ON "public"."codefiles" USING "btree" ("document_id");
CREATE INDEX "idx_codefiles_original_document_id" ON "public"."codefiles" USING "gin" ((("metadata" -> 'originalDocumentId'::"text")));
CREATE INDEX "steps_batch_id_idx" ON "public"."steps" USING "btree" ("batch_id");
CREATE INDEX "steps_batch_level_idx" ON "public"."steps" USING "btree" ("batch_id", "level");
CREATE INDEX "steps_document_id_idx" ON "public"."steps" USING "btree" ("document_id");
CREATE INDEX "steps_level_idx" ON "public"."steps" USING "btree" ("level");
CREATE INDEX "steps_run_id_idx" ON "public"."steps" USING "btree" ("run_id");
CREATE INDEX "steps_step_index_idx" ON "public"."steps" USING "btree" ("step_index");
CREATE OR REPLACE TRIGGER "update_configurations_timestamp" BEFORE UPDATE ON "public"."configurations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_timestamp"();
CREATE OR REPLACE TRIGGER "update_ensembles_timestamp" BEFORE UPDATE ON "public"."ensembles" FOR EACH ROW EXECUTE FUNCTION "public"."update_ensembles_updated_at"();
ALTER TABLE ONLY "public"."codefiles"
    ADD CONSTRAINT "codefiles_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;
COMMENT ON CONSTRAINT "codefiles_document_id_fkey" ON "public"."codefiles" IS 'Foreign key constraint that ensures when a document is deleted, all its related code files are also deleted';
ALTER TABLE ONLY "public"."steps"
    ADD CONSTRAINT "steps_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id");
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_codefiles_by_any_id"("id_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_codefiles_by_any_id"("id_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_codefiles_by_any_id"("id_value" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_documents_with_code"("search_term" "text", "max_results" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_documents_with_parsing_errors"("doc_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."find_documents_without_codefiles"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_documents_without_codefiles"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_documents_without_codefiles"("limit_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_codefiles_by_document_id"("doc_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_available_batches"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_batches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_batches"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_batch_id"("p_batch_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_batch_id"("p_batch_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_batch_id"("p_batch_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_document_id"("doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_document_id"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_document_id"("doc_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_step_info"("p_run_id" integer, "p_step_number" integer, "p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_step_info"("p_run_id" integer, "p_step_number" integer, "p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_codefiles_by_step_info"("p_run_id" integer, "p_step_number" integer, "p_batch_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_document_codefile_relation"("doc_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_document_metadata"("doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_document_metadata"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_document_metadata"("doc_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_latest_run_id"("model_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_run_id"("model_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_run_id"("model_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_steps_by_batch_id"("p_batch_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_steps_by_batch_id"("p_batch_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_steps_by_batch_id"("p_batch_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";
GRANT ALL ON FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb_set_multiple"("jsonb_obj" "jsonb", "set_path_vals" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."list_extensions"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_extensions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_extensions"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "json") TO "service_role";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_extensions"("input" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_document_codefiles_migrated"("doc_id" "uuid", "files_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."match_codefiles"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_language" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_codefiles"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_language" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_codefiles"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_language" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."trigger_update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_timestamp"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_ensembles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ensembles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ensembles_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";
GRANT ALL ON TABLE "public"."codefiles" TO "anon";
GRANT ALL ON TABLE "public"."codefiles" TO "authenticated";
GRANT ALL ON TABLE "public"."codefiles" TO "service_role";
GRANT ALL ON TABLE "public"."configurations" TO "anon";
GRANT ALL ON TABLE "public"."configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."configurations" TO "service_role";
GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";
GRANT ALL ON TABLE "public"."debug_code_files" TO "anon";
GRANT ALL ON TABLE "public"."debug_code_files" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_code_files" TO "service_role";
GRANT ALL ON TABLE "public"."document_codefile_relationships" TO "anon";
GRANT ALL ON TABLE "public"."document_codefile_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."document_codefile_relationships" TO "service_role";
GRANT ALL ON TABLE "public"."ensembles" TO "anon";
GRANT ALL ON TABLE "public"."ensembles" TO "authenticated";
GRANT ALL ON TABLE "public"."ensembles" TO "service_role";
GRANT ALL ON TABLE "public"."steps" TO "anon";
GRANT ALL ON TABLE "public"."steps" TO "authenticated";
GRANT ALL ON TABLE "public"."steps" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
RESET ALL;
