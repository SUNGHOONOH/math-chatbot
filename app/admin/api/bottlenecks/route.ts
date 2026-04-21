import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isUserAdmin } from '@/lib/auth';

type CandidateMatch = {
  concept_code?: string;
  matched_text?: string;
  similarity?: number;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: bottlenecks, error } = await admin
      .from('learning_bottlenecks')
      .select('*, tutoring_sessions(extracted_text)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const conceptCodes = Array.from(
      new Set(
        (bottlenecks ?? []).flatMap((item) => {
          const directCode = item.mapped_concept_id ? [item.mapped_concept_id] : [];
          const candidateCodes = Array.isArray(item.candidate_matches)
            ? (item.candidate_matches as CandidateMatch[])
                .map((candidate) => candidate.concept_code)
                .filter((value): value is string => Boolean(value))
            : [];
          return [...directCode, ...candidateCodes];
        }),
      ),
    );

    const conceptTitleMap = new Map<string, string>();

    if (conceptCodes.length > 0) {
      const { data: concepts, error: conceptError } = await admin
        .from('concept_nodes_reference')
        .select('concept_code, title')
        .in('concept_code', conceptCodes);

      if (conceptError) {
        throw conceptError;
      }

      for (const concept of concepts ?? []) {
        conceptTitleMap.set(concept.concept_code, concept.title);
      }
    }

    const enriched = (bottlenecks ?? []).map((item) => ({
      ...item,
      mapped_concept_title:
        conceptTitleMap.get(item.mapped_concept_id) ?? item.mapped_concept_id ?? '미배정',
      candidate_matches: Array.isArray(item.candidate_matches)
        ? (item.candidate_matches as CandidateMatch[]).map((candidate) => ({
            ...candidate,
            concept_title: candidate.concept_code
              ? conceptTitleMap.get(candidate.concept_code) ?? candidate.concept_code
              : '',
          }))
        : [],
    }));

    return NextResponse.json({ bottlenecks: enriched });
  } catch (err) {
    console.error('[AdminAPI] Bottlenecks Fetch Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
