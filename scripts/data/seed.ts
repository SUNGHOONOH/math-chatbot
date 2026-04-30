// ============================================================
// AHA v5 — CLI 시드 스크립트: concept_nodes_reference
// ============================================================
// 사용법: node scripts/data/seed.ts m2_json md_json
// .env.local의 SUPABASE_SERVICE_ROLE_KEY를 사용합니다.
// concept_code 기준 upsert로 중복 안전합니다.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
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
  definition?: string;
  description: string;
  keywords?: string[];
  prerequisites?: string[];
  examples_of_use?: string[];
}

async function main() {
  // 1. 실행 시 파일/디렉터리를 받을 수 있게 함
  // 예:
  // - pnpm tsx scripts/data/seed.ts m2_json
  // - pnpm tsx scripts/data/seed.ts md_json
  // - pnpm tsx scripts/data/seed.ts m2_json md_json
  const targets = process.argv.slice(2);
  const targetPaths = targets.length > 0 ? targets : ['m1_json/concept_nodes_m1.json'];
  const files = targetPaths.flatMap(resolveJsonFiles);
  const nodes = files.flatMap(readConceptNodes);

  if (nodes.length === 0) {
    console.error('❌ 시드할 개념 노드가 없습니다.');
    process.exit(1);
  }

  console.log(`📦 ${files.length}개 JSON 파일에서 ${nodes.length}개의 개념 노드를 시드합니다...`);

  // 2. Upsert (concept_code 기준, 중복 시 UPDATE)
  const { data, error } = await supabase
    .from('concept_nodes_reference')
    .upsert(
      nodes.map((n) => ({
        concept_code: n.concept_code,
        node_type: n.node_type || 'PD',
        title: n.title || '',
        definition: n.definition || '',
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

function resolveJsonFiles(targetPath: string): string[] {
  const absolutePath = resolve(__dirname, targetPath);

  if (!existsSync(absolutePath)) {
    console.error(`❌ 경로를 찾을 수 없습니다: ${absolutePath}`);
    process.exit(1);
  }

  if (statSync(absolutePath).isFile()) {
    return isSeedJsonFile(absolutePath) ? [absolutePath] : [];
  }

  return readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) => {
      const childPath = resolve(absolutePath, entry.name);
      return entry.isDirectory() ? resolveJsonFiles(childPath) : isSeedJsonFile(childPath) ? [childPath] : [];
    })
    .sort();
}

function isSeedJsonFile(filePath: string): boolean {
  return filePath.endsWith('.json') && !filePath.endsWith('README_index.json');
}

function readConceptNodes(filePath: string): ConceptNode[] {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed).flatMap((value) => Array.isArray(value) ? value as ConceptNode[] : []);
    }

    return [];
  } catch (err) {
    console.error(`❌ ${filePath} 파일을 읽을 수 없습니다:`, err);
    process.exit(1);
  }
}

main();
