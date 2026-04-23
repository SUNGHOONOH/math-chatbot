# DB Security And pgvector Checks

Supabase Dashboard의 `SQL Editor`에서 아래 쿼리를 순서대로 실행하면 된다.

## 1. RLS 활성화 상태

```sql
select
  schemaname,
  tablename,
  rowsecurity,
  forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'user_profiles',
    'tutoring_sessions',
    'dialogue_logs',
    'learning_bottlenecks',
    'session_reports',
    'concept_nodes_reference',
    'concept_aliases',
    'strategy_graphs'
  )
order by tablename;
기대값:

위 8개 테이블은 모두 rowsecurity = true 이어야 한다.
학생 데이터 테이블과 관리자용 기준 테이블 모두 RLS를 켠 상태여야 한다.
2. 정책 목록
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'user_profiles',
    'tutoring_sessions',
    'dialogue_logs',
    'learning_bottlenecks',
    'session_reports',
    'concept_nodes_reference',
    'concept_aliases',
    'strategy_graphs'
  )
order by tablename, policyname;
현재 기준 최소 체크 포인트:

user_profiles는 자기 프로필만 읽기/수정 가능해야 한다.
tutoring_sessions, dialogue_logs, learning_bottlenecks, session_reports는 학생 본인 데이터만 접근 가능해야 한다.
dialogue_logs, learning_bottlenecks, session_reports는 필요하면 tutoring_sessions를 통해 세션 소유권 기준으로 제한될 수 있다.
concept_nodes_reference, concept_aliases, strategy_graphs는 일반 학생이 쓰기 가능하면 안 된다.
관리자 쓰기 또는 서버 전용 쓰기 경로가 분리되어 있어야 한다.
3. 정책이 아예 없는 테이블 찾기
with target_tables as (
  select unnest(array[
    'user_profiles',
    'tutoring_sessions',
    'dialogue_logs',
    'learning_bottlenecks',
    'session_reports',
    'concept_nodes_reference',
    'concept_aliases',
    'strategy_graphs'
  ]) as tablename
)
select
  t.tablename,
  pt.rowsecurity,
  count(pp.policyname) as policy_count
from target_tables t
left join pg_tables pt
  on pt.schemaname = 'public'
 and pt.tablename = t.tablename
left join pg_policies pp
  on pp.schemaname = 'public'
 and pp.tablename = t.tablename
group by t.tablename, pt.rowsecurity
order by t.tablename;
판단 기준:

policy_count = 0인 테이블은 즉시 점검 대상이다.
특히 학생 데이터가 담기는 테이블에 정책이 없으면 우선순위 높게 수정해야 한다.
4. pgvector 확장/컬럼 상태
select extname, extversion
from pg_extension
where extname = 'vector';
select
  table_schema,
  table_name,
  column_name,
  udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by table_name, column_name;
기대값:

vector 확장이 설치되어 있어야 한다.
아래 컬럼은 실제 vector 타입이어야 한다.
concept_nodes_reference.embedding
concept_aliases.embedding
learning_bottlenecks.searchable_vector
5. 벡터 인덱스 존재 여부
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by tablename, indexname;
기대값:

concept_nodes_reference.embedding에는 적어도 하나의 ANN 인덱스가 있어야 한다.
concept_aliases.embedding에도 적어도 하나의 ANN 인덱스가 있어야 한다.
예: using ivfflat (...) 또는 using hnsw (...)
learning_bottlenecks.searchable_vector는 현재 사용 패턴을 보고 인덱스 필요 여부를 판단한다.
6. 인덱스가 실제로 사용되는지 확인
아래 쿼리는 실제 벡터 한 개를 probe로 써서 실행 계획을 본다.

explain analyze
with probe as (
  select embedding
  from public.concept_nodes_reference
  where embedding is not null
  limit 1
)
select
  n.concept_code,
  n.embedding <=> probe.embedding as distance
from public.concept_nodes_reference n
cross join probe
where n.embedding is not null
order by n.embedding <=> probe.embedding
limit 5;
explain analyze
with probe as (
  select embedding
  from public.concept_aliases
  where embedding is not null
  limit 1
)
select
  a.concept_code,
  a.alias_text,
  a.embedding <=> probe.embedding as distance
from public.concept_aliases a
cross join probe
where a.embedding is not null
order by a.embedding <=> probe.embedding
limit 5;
판단 기준:

큰 테이블에서 Seq Scan만 보이면 인덱스 미구축 또는 planner 미사용 가능성이 크다.
Index Scan, Bitmap Index Scan, ivfflat, hnsw 관련 plan이 보이면 정상 가능성이 높다.
작은 테이블에서는 planner가 Seq Scan을 선택할 수 있으므로 row 수와 함께 해석해야 한다.
7. 테이블 크기 추정
select
  relname as table_name,
  reltuples::bigint as estimated_rows
from pg_class
where relname in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by relname;
해석 기준:

concept_nodes_reference는 기준 노드 테이블이므로 row 수 증가 속도는 상대적으로 완만해야 한다.
concept_aliases가 빠르게 커지면 중복 alias, 인덱스 상태, 검색 비용을 같이 점검해야 한다.
learning_bottlenecks는 운영 데이터이므로 증가 자체는 자연스럽지만 장기 보관/조회 전략은 별도 검토가 필요할 수 있다.
8. 운영 체크리스트
8-1. concept_aliases 중복 여부 확인
select
  concept_code,
  alias_text,
  count(*) as duplicate_count
from public.concept_aliases
group by concept_code, alias_text
having count(*) > 1
order by duplicate_count desc, concept_code, alias_text;
체크 포인트:

(concept_code, alias_text) 조합의 중복이 반복적으로 나오면 유니크 제약 또는 upsert 전략을 점검해야 한다.
8-2. match_concept_nodes RPC 존재 여부 확인
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'match_concept_nodes';
체크 포인트:

match_concept_nodes RPC가 실제 존재해야 한다.
현재 타입 정의 기준으로 query_embedding, match_count를 받는지 확인한다.
반환값에 최소한 source_table, concept_code, matched_text, similarity가 포함되는지 확인한다.
8-3. 관리자 경로 보안 점검
체크 포인트:

관리자 페이지가 브라우저 anon client 직접 쓰기에 의존하지 않는지 확인한다.
관리자 수정/삭제는 서버 라우트 또는 서버 전용 권한 경로를 통해 수행되어야 한다.
서비스 롤 키를 쓰는 경로가 있다면 반드시 서버 내부에서만 사용되어야 한다.
서비스 롤 키 사용 전에 관리자 권한 검사 또는 서버 소유권 검사가 있어야 한다.
8-4. RLS 우회 가능성 점검
체크 포인트:

관리자 페이지가 단순 클라이언트 렌더링만으로 민감 데이터를 직접 조회하지 않는지 확인한다.
서버 컴포넌트, 서버 라우트, 또는 권한 검증된 서버 유틸을 우선 사용해야 한다.
특히 concept_nodes_reference, concept_aliases, strategy_graphs의 쓰기 경로는 브라우저에서 직접 열려 있으면 안 된다.
9. 최종 점검 메모
현재 기준에서 가장 중요한 확인 순서는 아래와 같다.

RLS가 켜져 있는가
학생 소유 데이터 정책이 실제로 걸려 있는가
관리자/서버 전용 쓰기 경로가 분리되어 있는가
vector 확장과 임베딩 컬럼 타입이 정상인가
concept_nodes_reference, concept_aliases에 ANN 인덱스가 있는가
match_concept_nodes RPC가 실제 존재하고 예상 반환 형태를 따르는가
alias 중복과 운영 데이터 증가가 검색 품질을 해치고 있지 않은가