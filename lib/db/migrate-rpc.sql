-- ==========================================
-- AHA v5 — RAG Vector RPC
-- Supabase SQL Editor에서 init.sql 실행 후 이 파일도 실행하세요.
-- ==========================================

-- ==========================================
-- [RPC] match_concept_nodes
-- ==========================================

-- 코사인 유사도로 비교하여 상위 N개 후보를 반환합니다.
CREATE OR REPLACE FUNCTION public.match_concept_nodes(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  concept_code text,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cnr.id,
    cnr.concept_code,
    cnr.description,
    1 - (cnr.embedding <=> query_embedding) AS similarity
  FROM public.concept_nodes_reference cnr
  WHERE 1 - (cnr.embedding <=> query_embedding) > match_threshold
  ORDER BY cnr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
