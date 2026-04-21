// ============================================================
// AHA v5 — 프로젝트 전역 편의 타입 별칭 (Convenience Type Aliases)
// ============================================================
// schema.ts의 Database 인터페이스에서 자주 사용되는 테이블 타입을 
// 짧은 이름으로 재export하여 import 편의성을 높입니다.
// ============================================================

import type { Database } from '@/lib/db/schema'

// ── Row 타입 (DB에서 읽어온 데이터) ──
export type StrategyGraph = Database['public']['Tables']['strategy_graphs']['Row']
export type ConceptNode = Database['public']['Tables']['concept_nodes_reference']['Row']
export type TutoringSession = Database['public']['Tables']['tutoring_sessions']['Row']
export type DialogueLog = Database['public']['Tables']['dialogue_logs']['Row']
export type LearningBottleneck = Database['public']['Tables']['learning_bottlenecks']['Row']
export type SessionReport = Database['public']['Tables']['session_reports']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// ── Insert 타입 (DB에 새로 삽입할 데이터) ──
export type StrategyGraphInsert = Database['public']['Tables']['strategy_graphs']['Insert']
export type ConceptNodeInsert = Database['public']['Tables']['concept_nodes_reference']['Insert']
export type TutoringSessionInsert = Database['public']['Tables']['tutoring_sessions']['Insert']
export type DialogueLogInsert = Database['public']['Tables']['dialogue_logs']['Insert']
export type LearningBottleneckInsert = Database['public']['Tables']['learning_bottlenecks']['Insert']
export type SessionReportInsert = Database['public']['Tables']['session_reports']['Insert']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']

// ── Update 타입 (DB 레코드 부분 수정) ──
export type TutoringSessionUpdate = Database['public']['Tables']['tutoring_sessions']['Update']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

// ── RPC 반환 타입 ──
export type ConceptMatch = Database['public']['Functions']['match_concept_nodes']['Returns'][number]

// ── 세션 상태 Enum ──
export type SessionStatus = TutoringSession['session_status']

// ── 발화자/발화유형 Enum ──
export type Speaker = 'student' | 'ai_tutor'
