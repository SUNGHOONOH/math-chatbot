-- 1. pgvector 익스텐션 활성화 (RAG용)
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================
-- [Layer 1] 공용 컨텐츠 DB (문제 은행 및 기준점)
-- ==========================================

-- Table 1: strategy_graphs (전략 그래프)
CREATE TABLE public.strategy_graphs (
    problem_hash text PRIMARY KEY,
    required_concepts text[] NOT NULL DEFAULT '{}',
    base_difficulty smallint NOT NULL CHECK (base_difficulty >= 1 AND base_difficulty <= 5),
    intended_path text[] NOT NULL DEFAULT '{}',
    graph_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_human_verified boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table 2: concept_nodes_reference (개념 마스터 리스트)
CREATE TABLE public.concept_nodes_reference (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_code text NOT NULL UNIQUE,
    node_type text NOT NULL DEFAULT 'PD',         -- PD, PP, IR, SM, PC
    title text NOT NULL DEFAULT '',                -- 사람이 읽을 수 있는 짧은 제목
    definition text NOT NULL DEFAULT '',           -- 개념의 명확한 정의/공식
    description text NOT NULL,
    keywords text[] NOT NULL DEFAULT '{}',         -- 검색/매칭용 키워드 배열
    prerequisites text[] NOT NULL DEFAULT '{}',    -- 선수 개념 concept_code 배열
    examples_of_use text[] NOT NULL DEFAULT '{}',  -- 이 개념이 쓰이는 문제 유형 예시
    embedding vector(1024),                        -- intfloat/multilingual-e5-large-instruct (1024차원)
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ==========================================
-- [Layer 2] 학생 활동 기록 (초경량 3+1 운영 DB)
-- ==========================================

-- Table 3: tutoring_sessions (세션 중앙 제어)
CREATE TABLE public.tutoring_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_hash text NOT NULL REFERENCES public.strategy_graphs(problem_hash) ON DELETE CASCADE,
    extracted_text text NOT NULL,
    session_status text NOT NULL CHECK (session_status IN ('in_progress', 'completed', 'abandoned', 'viewed_answer')),
    has_student_consent boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table 4: dialogue_logs (대화 원문)
CREATE TABLE public.dialogue_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
    speaker text NOT NULL CHECK (speaker IN ('student', 'ai_tutor')),
    message_text text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table 5: learning_bottlenecks (학습 병목)
CREATE TABLE public.learning_bottlenecks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
    mapped_concept_id text NOT NULL, -- 매핑 실패 시 'NEW_NODE'
    candidate_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
    struggle_description text NOT NULL,
    searchable_vector vector(1024) NOT NULL,       -- 검색용 벡터 (1024차원)
    is_resolved_by_student boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table 6: session_reports (종합 진단 보고서)
CREATE TABLE public.session_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
    mastered_concepts text[] NOT NULL DEFAULT '{}',
    aha_moments jsonb NOT NULL DEFAULT '[]'::jsonb,
    ai_tutor_summary text NOT NULL,
    performance_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ==========================================
-- 인덱스 (조회 및 FK 성능 최적화)
-- ==========================================
CREATE INDEX idx_sessions_student_id ON public.tutoring_sessions(student_id);
CREATE INDEX idx_logs_session_id ON public.dialogue_logs(session_id);
CREATE INDEX idx_bottlenecks_session_id ON public.learning_bottlenecks(session_id);
CREATE INDEX idx_reports_session_id ON public.session_reports(session_id);
-- 벡터 검색 성능 향상을 위한 HNSW 인덱스 (선택 사항이나 권장됨)
CREATE INDEX idx_concept_nodes_embedding ON public.concept_nodes_reference USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_bottlenecks_vector ON public.learning_bottlenecks USING hnsw (searchable_vector vector_cosine_ops);

-- ==========================================
-- Row Level Security (RLS) 활성화
-- ==========================================
ALTER TABLE public.strategy_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_nodes_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialogue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_bottlenecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

-- (선택 사항) 기본 접근 정책 예시 (필요에 따라 수정하세요)
-- 관리자(admin)는 모든 권한을 가지고, 학생은 자신의 데이터만 볼 수 있게 설정하는 기본 정책 템플릿입니다.
/*
CREATE POLICY "Users can view their own sessions" 
ON public.tutoring_sessions FOR SELECT 
USING (auth.uid() = student_id);
*/
