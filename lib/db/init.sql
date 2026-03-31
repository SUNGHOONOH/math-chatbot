-- AHA v5 MVP 초기 DB 세팅 SQL 스크립트
-- Supabase 대시보드 -> SQL Editor 에 복사/붙여넣기 하셔서 실행하면 표들이 생성됩니다.

-- 1. 전략 그래프 DB (문제별 소크라틱 접근법 저장)
CREATE TABLE public.strategy_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id TEXT NOT NULL,
    graph_data JSONB NOT NULL,
    is_human_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 운영 DB (학생의 학습 데이터 누적 및 노드 확률 분포 저장)
CREATE TABLE public.operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    dialog_transcript TEXT NOT NULL,
    node_posterior JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 검증 DB (관리자 조회용 전체 원문 대화 저장)
CREATE TABLE public.validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    raw_transcript TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 검토 큐 (인간 튜터 승인 대기열)
CREATE TABLE public.review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    graph_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 보안: 서버사이드(Admin Key)에서만 접근하므로 기본적으로 RLS는 활성화하지 않거나, 
-- 익명 읽기를 막고 Service Role에게만 열어둘 경우 활성화합니다. MVP 단계에서는 주석 처리해둡니다.
-- ALTER TABLE public.strategy_graphs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
