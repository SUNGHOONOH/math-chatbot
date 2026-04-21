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
```

기대값:

- 학생 개인정보/학습 데이터 테이블은 `rowsecurity = true`
- 관리자 전용 테이블도 최소한 `rowsecurity = true`

## 2. 정책 목록

```sql
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
```

최소 체크 포인트:

- `tutoring_sessions`, `dialogue_logs`, `learning_bottlenecks`, `session_reports`는 `auth.uid()` 기준 자기 데이터만 허용
- `user_profiles`는 자기 프로필만 읽기/수정 허용
- `concept_aliases`, `strategy_graphs`의 쓰기는 관리자만 허용

## 3. 정책이 아예 없는 테이블 찾기

```sql
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
```

`policy_count = 0`인 테이블은 바로 점검 대상이다.

## 4. pgvector 확장/컬럼 상태

```sql
select extname, extversion
from pg_extension
where extname = 'vector';
```

```sql
select
  table_schema,
  table_name,
  column_name,
  udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by table_name, column_name;
```

기대값:

- `vector` 확장이 설치되어 있어야 함
- 임베딩 컬럼이 실제 `vector` 타입이어야 함

## 5. 벡터 인덱스 존재 여부

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by tablename, indexname;
```

기대값:

- `concept_nodes_reference.embedding`
- `concept_aliases.embedding`

위 두 컬럼에는 적어도 하나의 ANN 인덱스가 있어야 한다.
예: `using ivfflat (...)` 또는 `using hnsw (...)`

## 6. 인덱스가 실제로 사용되는지 확인

아래 쿼리는 실제 벡터 한 개를 probe로 써서 실행 계획을 본다.

```sql
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
```

```sql
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
```

판단 기준:

- 큰 테이블에서 `Seq Scan`만 보이면 인덱스 미구축 또는 planner 미사용 가능성 큼
- `Index Scan`, `Bitmap Index Scan`, `ivfflat`, `hnsw` 관련 plan이 보이면 정상 가능성 높음

## 7. 테이블 크기 추정

```sql
select
  relname as table_name,
  reltuples::bigint as estimated_rows
from pg_class
where relname in ('concept_nodes_reference', 'concept_aliases', 'learning_bottlenecks')
order by relname;
```

`concept_aliases`가 빠르게 커지는데 인덱스/정책/아카이빙 전략이 없으면 검색 품질과 비용이 같이 악화된다.

## 8. 운영 체크리스트

- `concept_aliases`에 `(concept_code, alias_text)` 유니크 제약이 있는지 확인
- `match_concept_nodes` RPC 내부에서 source weight, threshold, dedupe가 있는지 확인
- 관리자 페이지가 브라우저 anon client 직접 조회에 의존하지 않는지 확인
- 서비스 롤 키를 쓰는 경로는 모두 `isUserAdmin()` 또는 서버 소유권 검사를 통과해야 함
