export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          content: string;
          metadata: Json;
          embedding: number[] | null;
          created_at: string;
          batch_id: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
          batch_id?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
          batch_id?: string | null;
        };
      };
      codefiles: {
        Row: {
          id: string;
          filename: string;
          code: string;
          language: string | null;
          document_id: string | null;
          created_at: string;
          embedding: number[] | null;
          batch_id: string | null;
          run_id: number | null;
          step_number: number | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          filename: string;
          code: string;
          language?: string | null;
          document_id?: string | null;
          created_at?: string;
          embedding?: number[] | null;
          batch_id?: string | null;
          run_id?: number | null;
          step_number?: number | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          filename?: string;
          code?: string;
          language?: string | null;
          document_id?: string | null;
          created_at?: string;
          embedding?: number[] | null;
          batch_id?: string | null;
          run_id?: number | null;
          step_number?: number | null;
          metadata?: Json | null;
        };
      };
      document_codefile_relationships: {
        Row: {
          id: string;
          document_id: string;
          codefile_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          codefile_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          codefile_id?: string;
          created_at?: string;
        };
      };
      steps: {
        Row: {
          id: string;
          batch_id: string;
          step_number: number;
          level: number;
          run_id: number | null;
          step_data: Json;
          created_at: string;
          metadata: Json | null;
          decision_value: string | null;
        };
        Insert: {
          id?: string;
          batch_id: string;
          step_number: number;
          level: number;
          run_id?: number | null;
          step_data: Json;
          created_at?: string;
          metadata?: Json | null;
          decision_value?: string | null;
        };
        Update: {
          id?: string;
          batch_id?: string;
          step_number?: number;
          level?: number;
          run_id?: number | null;
          step_data?: Json;
          created_at?: string;
          metadata?: Json | null;
          decision_value?: string | null;
        };
      };
    };
    Functions: {
      get_available_batches: {
        Args: Record<string, never>;
        Returns: Array<{
          batch_id: string;
          step_count: number;
          latest_created_at: string;
        }>;
      };
      get_steps_by_batch_id: {
        Args: {
          p_batch_id: string;
        };
        Returns: Array<{
          id: string;
          batch_id: string;
          step_number: number;
          level: number;
          run_id: number | null;
          step_data: Json;
          created_at: string;
          metadata: Json | null;
          decision_value: string | null;
        }>;
      };
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
        };
        Returns: Array<{
          id: string;
          content: string;
          metadata: Json;
          similarity: number;
        }>;
      };
    };
  };
}
