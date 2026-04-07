// ============================================================
// AHA v5 — CLI 시드 스크립트: concept_nodes_reference
// ============================================================
// 사용법: npx tsx scripts/data/seed.ts
// .env.local의 SUPABASE_SERVICE_ROLE_KEY를 사용합니다.
// concept_code 기준 upsert로 중복 안전합니다.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// .env.local 로드
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ConceptNode {
  concept_code: string;
  node_type?: string;
  title?: string;
  description: string;
  keywords?: string[];
  prerequisites?: string[];
  examples_of_use?: string[];
}

async function main() {
  // 1. JSON 파일 읽기
  const filePath = resolve(__dirname, 'concept_nodes.json');
  let nodes: ConceptNode[];

  try {
    const raw = readFileSync(filePath, 'utf-8');
    nodes = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${filePath} 파일을 읽을 수 없습니다:`, err);
    process.exit(1);
  }

  console.log(`📦 ${nodes.length}개의 개념 노드를 시드합니다...`);

  // 2. Upsert (concept_code 기준, 중복 시 UPDATE)
  const { data, error } = await supabase
    .from('concept_nodes_reference')
    .upsert(
      nodes.map((n) => ({
        concept_code: n.concept_code,
        node_type: n.node_type || 'CU-PD',
        title: n.title || '',
        description: n.description,
        keywords: n.keywords || [],
        prerequisites: n.prerequisites || [],
        examples_of_use: n.examples_of_use || [],
        // embedding은 비워둠 → 배치에서 채울 예정
      })),
      { onConflict: 'concept_code' }
    )
    .select('concept_code');

  if (error) {
    console.error('❌ Upsert 실패:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${data?.length || 0}개의 개념 노드가 성공적으로 시드되었습니다.`);
  process.exit(0);
}

main();
