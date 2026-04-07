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
          required_concepts: string[]
          base_difficulty: number
          intended_path: string[]
          graph_data: Json
          is_human_verified: boolean
          created_at: string
        }
        Insert: {
          problem_hash: string
          required_concepts?: string[]
          base_difficulty: number
          intended_path?: string[]
          graph_data?: Json
          is_human_verified?: boolean
          created_at?: string
        }
        Update: {
          problem_hash?: string
          required_concepts?: string[]
          base_difficulty?: number
          intended_path?: string[]
          graph_data?: Json
          is_human_verified?: boolean
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
          description?: string
          keywords?: string[]
          prerequisites?: string[]
          examples_of_use?: string[]
          embedding?: number[] | null
          created_at?: string
        }
        Relationships: []
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
          id: string
          session_id: string
          speaker: string
          message_text: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          speaker: string
          message_text: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          speaker?: string
          message_text?: string
          created_at?: string
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
          mastered_concepts: string[]
          aha_moments: Json
          ai_tutor_summary: string
          performance_metrics: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          mastered_concepts?: string[]
          aha_moments?: Json
          ai_tutor_summary: string
          performance_metrics?: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          mastered_concepts?: string[]
          aha_moments?: Json
          ai_tutor_summary?: string
          performance_metrics?: Json
          created_at?: string
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
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          concept_code: string
          description: string
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
