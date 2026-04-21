// ============================================================
// AHA v5 — Supabase Database Type Definitions
// ============================================================
// init.sql의 6개 테이블 구조를 TypeScript로 1:1 대응시킨 타입입니다.
// Supabase JS v2.101+ 호환 구조.
// ============================================================

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
      // ── Table 0: strategy_graphs ──
      strategy_graphs: {
        Row: {
          problem_hash: string
          problem_text: string | null
          required_concepts: string[]
          base_difficulty: number
          intended_path: string[]
          graph_data: Json
          is_human_verified: boolean
          is_deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          created_at: string
        }
        Insert: {
          problem_hash: string
          problem_text?: string | null
          required_concepts?: string[]
          base_difficulty: number
          intended_path?: string[]
          graph_data?: Json
          is_human_verified?: boolean
          is_deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string
        }
        Update: {
          problem_hash?: string
          problem_text?: string | null
          required_concepts?: string[]
          base_difficulty?: number
          intended_path?: string[]
          graph_data?: Json
          is_human_verified?: boolean
          is_deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ── Table 1: concept_nodes_reference ──
      concept_nodes_reference: {
        Row: {
          id: string
          concept_code: string
          node_type: string
          title: string
          definition: string
          description: string
          keywords: string[]
          prerequisites: string[]
          examples_of_use: string[]
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          concept_code: string
          node_type?: string
          title?: string
          definition?: string
          description: string
          keywords?: string[]
          prerequisites?: string[]
          examples_of_use?: string[]
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          concept_code?: string
          node_type?: string
          title?: string
          definition?: string
          description?: string
          keywords?: string[]
          prerequisites?: string[]
          examples_of_use?: string[]
          embedding?: number[] | null
          created_at?: string
        }
        Relationships: []
      }

      // ── Table 1.5: concept_aliases (NEW) ──
      concept_aliases: {
        Row: {
          id: string
          concept_code: string
          alias_text: string
          failure_type: string
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          concept_code: string
          alias_text: string
          failure_type: string
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          concept_code?: string
          alias_text?: string
          failure_type?: string
          embedding?: number[] | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_aliases_concept_code_fkey"
            columns: ["concept_code"]
            isOneToOne: false
            referencedRelation: "concept_nodes_reference"
            referencedColumns: ["concept_code"]
          }
        ]
      }

      // ── Table 1.6: user_profiles ──
      user_profiles: {
        Row: {
          id: string
          nickname: string
          role: string
          has_consented: boolean
          grade_level: string | null
          created_at: string
        }
        Insert: {
          id: string
          nickname?: string
          role?: string
          has_consented?: boolean
          grade_level?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nickname?: string
          role?: string
          has_consented?: boolean
          grade_level?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }

      // ── Table 2: tutoring_sessions ──
      tutoring_sessions: {
        Row: {
          id: string
          student_id: string
          problem_hash: string
          extracted_text: string
          session_status: string
          has_student_consent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          problem_hash: string
          extracted_text: string
          session_status?: string
          has_student_consent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          problem_hash?: string
          extracted_text?: string
          session_status?: string
          has_student_consent?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_sessions_problem_hash_fkey"
            columns: ["problem_hash"]
            isOneToOne: false
            referencedRelation: "strategy_graphs"
            referencedColumns: ["problem_hash"]
          },
        ]
      }

      // ── Table 3: dialogue_logs ──
      dialogue_logs: {
        Row: {
          session_id: string
          messages: Json
          updated_at: string
        }
        Insert: {
          session_id: string
          messages?: Json
          updated_at?: string
        }
        Update: {
          session_id?: string
          messages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogue_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }

      // ── Table 4: learning_bottlenecks ──
      learning_bottlenecks: {
        Row: {
          id: string
          session_id: string
          mapped_concept_id: string
          failure_type: string | null
          candidate_matches: Json
          struggle_description: string
          searchable_vector: number[]
          is_resolved_by_student: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          mapped_concept_id: string
          failure_type?: string | null
          candidate_matches?: Json
          struggle_description: string
          searchable_vector: number[]
          is_resolved_by_student?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          mapped_concept_id?: string
          failure_type?: string | null
          candidate_matches?: Json
          struggle_description?: string
          searchable_vector?: number[]
          is_resolved_by_student?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_bottlenecks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }

      // ── Table 5: session_reports ──
      session_reports: {
        Row: {
          id: string
          session_id: string
          problem_hash: string
          session_status_snapshot: string
          extracted_text_snapshot: string
          session_created_at_snapshot: string
          required_concepts_snapshot: string[]
          base_difficulty_snapshot: number | null
          is_human_verified_snapshot: boolean
          was_analyzed_on_demand: boolean
          dialogue_logs_snapshot: Json
          bottlenecks_snapshot: Json
          mastered_concepts: string[]
          aha_moments: Json
          ai_tutor_summary: string
          performance_metrics: Json
          report_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          problem_hash: string
          session_status_snapshot: string
          extracted_text_snapshot: string
          session_created_at_snapshot: string
          required_concepts_snapshot?: string[]
          base_difficulty_snapshot?: number | null
          is_human_verified_snapshot?: boolean
          was_analyzed_on_demand?: boolean
          dialogue_logs_snapshot?: Json
          bottlenecks_snapshot?: Json
          mastered_concepts?: string[]
          aha_moments?: Json
          ai_tutor_summary: string
          performance_metrics?: Json
          report_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          problem_hash?: string
          session_status_snapshot?: string
          extracted_text_snapshot?: string
          session_created_at_snapshot?: string
          required_concepts_snapshot?: string[]
          base_difficulty_snapshot?: number | null
          is_human_verified_snapshot?: boolean
          was_analyzed_on_demand?: boolean
          dialogue_logs_snapshot?: Json
          bottlenecks_snapshot?: Json
          mastered_concepts?: string[]
          aha_moments?: Json
          ai_tutor_summary?: string
          performance_metrics?: Json
          report_version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      match_concept_nodes: {
        Args: {
          query_embedding: string
          match_count?: number
        }
        Returns: {
          source_table: string
          concept_code: string
          matched_text: string
          similarity: number
        }[]
      }
    }

    Enums: {
      [_ in never]: never
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}
