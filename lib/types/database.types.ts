export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      codefiles: {
        Row: {
          batch_id: string | null
          code_content: string
          created_at: string
          document_id: string
          embedding: string | null
          filename: string
          id: string
          language: string
          metadata: Json
          run_id: number | null
          step_number: number | null
        }
        Insert: {
          batch_id?: string | null
          code_content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          filename: string
          id?: string
          language?: string
          metadata?: Json
          run_id?: number | null
          step_number?: number | null
        }
        Update: {
          batch_id?: string | null
          code_content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          filename?: string
          id?: string
          language?: string
          metadata?: Json
          run_id?: number | null
          step_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "codefiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_codefile_relationships"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "codefiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      configurations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tech_stack_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tech_stack_config: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tech_stack_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          batch_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
        }
        Insert: {
          batch_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          batch_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      ensembles: {
        Row: {
          configuration: Json
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          configuration: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      steps: {
        Row: {
          batch_id: string
          created_at: string
          decision_value: Database["public"]["Enums"]["decision_type"]
          document_id: string
          id: string
          level: number
          run_id: number
          step_data: Json
          step_index: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          decision_value: Database["public"]["Enums"]["decision_type"]
          document_id: string
          id?: string
          level: number
          run_id: number
          step_data: Json
          step_index: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          decision_value?: Database["public"]["Enums"]["decision_type"]
          document_id?: string
          id?: string
          level?: number
          run_id?: number
          step_data?: Json
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "steps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_codefile_relationships"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "steps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      debug_code_files: {
        Row: {
          batch_id: string | null
          code_details: Json | null
          code_files: Json | null
          code_files_count: number | null
          created_at: string | null
          document_id: string | null
          filenames: Json | null
          migration_status: Json | null
          run_id: number | null
          source: string | null
          step_number: number | null
          step_title: string | null
        }
        Relationships: []
      }
      document_codefile_relationships: {
        Row: {
          batch_id: string | null
          codefiles_count: number | null
          document_created: string | null
          document_id: string | null
          document_source: string | null
          has_codefiles: boolean | null
          has_metadata_codefiles: boolean | null
          is_placeholder: boolean | null
          original_id: string | null
          run_id: string | null
          step_number: string | null
        }
        Insert: {
          batch_id?: string | null
          codefiles_count?: never
          document_created?: string | null
          document_id?: string | null
          document_source?: never
          has_codefiles?: never
          has_metadata_codefiles?: never
          is_placeholder?: never
          original_id?: never
          run_id?: never
          step_number?: never
        }
        Update: {
          batch_id?: string | null
          codefiles_count?: never
          document_created?: string | null
          document_id?: string | null
          document_source?: never
          has_codefiles?: never
          has_metadata_codefiles?: never
          is_placeholder?: never
          original_id?: never
          run_id?: never
          step_number?: never
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      find_codefiles_by_any_id: {
        Args: { id_value: string }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          metadata: Json
          created_at: string
        }[]
      }
      find_documents_with_code: {
        Args: { search_term: string; max_results: number }
        Returns: {
          document_id: string
          document_content: Json
          document_metadata: Json
          document_created_at: string
          codefile_id: string
          filename: string
          code_content: string
          language: string
          embedding: string
        }[]
      }
      find_documents_with_parsing_errors: {
        Args: { doc_limit?: number }
        Returns: {
          id: string
          content: string
          metadata: Json
          batch_id: string
          created_at: string
        }[]
      }
      find_documents_without_codefiles: {
        Args: { limit_count?: number }
        Returns: {
          document_id: string
          batch_id: string
          content_preview: string
          created_at: string
          metadata_keys: string[]
          is_missing_codefiles: boolean
        }[]
      }
      get_all_codefiles_by_document_id: {
        Args: { doc_id: string }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          metadata: Json
          created_at: string
          source: string
        }[]
      }
      get_available_batches: {
        Args: Record<PropertyKey, never>
        Returns: {
          batch_id: string
          step_count: number
          latest_created_at: string
        }[]
      }
      get_codefiles_by_batch_id: {
        Args: { p_batch_id: string }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          metadata: Json
          created_at: string
        }[]
      }
      get_codefiles_by_document_id: {
        Args: { doc_id: string }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          embedding: string
          metadata: Json
          created_at: string
        }[]
      }
      get_codefiles_by_step_info: {
        Args: { p_run_id: number; p_step_number: number; p_batch_id?: string }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          embedding: string
          metadata: Json
          created_at: string
        }[]
      }
      get_document_codefile_relation: {
        Args: { doc_id: string }
        Returns: Json
      }
      get_document_metadata: {
        Args: { doc_id: string }
        Returns: Json
      }
      get_latest_run_id: {
        Args: { model_name: string }
        Returns: number
      }
      get_steps_by_batch_id: {
        Args: { p_batch_id: string }
        Returns: {
          id: string
          batch_id: string
          document_id: string
          run_id: number
          step_index: number
          level: number
          decision_value: Database["public"]["Enums"]["decision_type"]
          step_data: Json
          created_at: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      jsonb_set_multiple: {
        Args: { jsonb_obj: Json; set_path_vals: Json }
        Returns: Json
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      list_extensions: {
        Args: Record<PropertyKey, never> | { input: Json } | { input: Json }
        Returns: {
          extname: string
        }[]
      }
      mark_document_codefiles_migrated: {
        Args: { doc_id: string; files_count: number }
        Returns: boolean
      }
      match_codefiles: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          filter_language?: string
        }
        Returns: {
          id: string
          document_id: string
          batch_id: string
          run_id: number
          step_number: number
          filename: string
          language: string
          code_content: string
          metadata: Json
          similarity: number
          created_at: string
        }[]
      }
      match_documents: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      decision_type: "RECOMMENDED" | "VIABLE" | "PROBLEMATIC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      decision_type: ["RECOMMENDED", "VIABLE", "PROBLEMATIC"],
    },
  },
} as const
