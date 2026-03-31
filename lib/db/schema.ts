export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      strategy_graphs: {
        Row: {
          id: string
          problem_id: string
          graph_data: Json
          is_human_verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          problem_id: string
          graph_data: Json
          is_human_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          problem_id?: string
          graph_data?: Json
          is_human_verified?: boolean
          created_at?: string
        }
      }
      operations: {
        Row: {
          id: string
          session_id: string
          student_id: string
          chunk_index: number
          dialog_transcript: string
          node_posterior: Json // 확률 분포 등
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          student_id: string
          chunk_index: number
          dialog_transcript: string
          node_posterior?: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          student_id?: string
          chunk_index?: number
          dialog_transcript?: string
          node_posterior?: Json
          created_at?: string
        }
      }
      validations: {
        Row: {
          id: string
          session_id: string
          raw_transcript: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          raw_transcript: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          raw_transcript?: string
          created_at?: string
        }
      }
      review_queue: {
        Row: {
          id: string
          session_id: string
          graph_id: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          graph_id: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          graph_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
