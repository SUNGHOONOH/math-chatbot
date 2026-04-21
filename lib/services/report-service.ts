// ============================================================
// AHA v5 — Report Service (세션 리포트 단일 통제)
// ============================================================
// 세션 리포트 조회 시 required_concepts와 session_reports snapshot을
// 동기 생성/갱신합니다.
// ============================================================

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  extractAndUpdateRequiredConcepts,
  hfGenerateText,
  parseJsonObjectFromText,
  sanitizeDialogueMessageText,
  sessionInsightResponseFormat,
} from '@/lib/ai/ai-service';
import { TAGGING_MODEL } from '@/lib/ai/models';
import { insightAgentPrompt } from '@/lib/ai/prompts';
import type { Database, Json } from '@/lib/db/schema';

interface RawDialogueMessage {
  role?: string;
  content?: string;
}

interface RawBottleneckRow {
  id: string;
  mapped_concept_id: string | null;
  struggle_description: string;
  is_resolved_by_student: boolean;
  candidate_matches: Json;
  created_at: string;
}

type ReportServiceError = Error & {
  code?: string;
  status?: number;
};

export interface SessionReport {
  conceptDisplayMap: Record<string, string>;
  session: {
    id: string;
    status: string;
    extractedText: string;
    createdAt: string;
    problemHash: string;
  };
  analysis: {
    requiredConcepts: string[];
    baseDifficulty: number | null;
    isHumanVerified: boolean;
    wasAnalyzedOnDemand: boolean;
  };
  dialogueLogs: Array<{
    id: string;
    speaker: string;
    text: string;
    createdAt: string;
  }>;
  bottlenecks: Array<{
    id: string;
    conceptId: string | null;
    description: string;
    isResolved: boolean;
    candidates: Json;
    createdAt: string;
  }>;
  persistedReport: {
    id: string;
    masteredConcepts: string[];
    ahaMoments: Json;
    aiTutorSummary: string;
    performanceMetrics: Json;
    summaryStatus: 'ready' | 'fallback';
    createdAt: string;
    updatedAt: string;
  } | null;
  reportState: {
    persisted: boolean;
    summaryStatus: 'ready' | 'fallback';
    hasNewDialogueSinceReport: boolean;
  };
}

type SnapshotDialogueLog = SessionReport['dialogueLogs'][number];
type SnapshotBottleneck = SessionReport['bottlenecks'][number];
type PersistedSummaryPayload = {
  mastered_concepts: string[];
  aha_moments: Json;
  ai_tutor_summary: string;
  performance_metrics: Json;
  summary_status: 'ready' | 'fallback';
};

const FALLBACK_SUMMARY_PREFIX = '세션 리포트 생성 중 구조화 요약에 실패했습니다.';

function formatDurationMs(startTime: number): string {
  return `${Date.now() - startTime}ms`;
}

type PersistedReportRow = Database['public']['Tables']['session_reports']['Row'];
const SESSION_REPORT_SELECT = `
  id,
  session_id,
  problem_hash,
  session_status_snapshot,
  extracted_text_snapshot,
  session_created_at_snapshot,
  required_concepts_snapshot,
  base_difficulty_snapshot,
  is_human_verified_snapshot,
  was_analyzed_on_demand,
  dialogue_logs_snapshot,
  bottlenecks_snapshot,
  mastered_concepts,
  aha_moments,
  ai_tutor_summary,
  performance_metrics,
  report_version,
  created_at,
  updated_at
`;
const reportBuildLocks = new Map<string, Promise<SessionReport>>();

function fallbackConceptDisplayName(code: string): string {
  if (!code) return '';
  if (code === 'unmapped_bottleneck') return '아직 매핑되지 않은 병목';
  if (code.startsWith('IR-')) return `조건 해석: ${code.slice(3)}`;
  if (code.startsWith('SM-')) return `전략: ${code.slice(3)}`;
  if (code.startsWith('PC-')) return `계산 처리: ${code.slice(3)}`;
  if (code.endsWith('_PC')) return `${code.replace(/_PC$/, '')} 계산`;
  return code;
}

function collectConceptCodes(report: SessionReport): string[] {
  const codes = new Set<string>();

  for (const code of report.analysis.requiredConcepts) {
    if (code) codes.add(code);
  }

  for (const code of report.persistedReport?.masteredConcepts ?? []) {
    if (code) codes.add(code);
  }

  for (const bottleneck of report.bottlenecks) {
    if (bottleneck.conceptId) codes.add(bottleneck.conceptId);
  }

  return [...codes];
}

async function attachConceptDisplayMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  report: SessionReport
): Promise<SessionReport> {
  const conceptCodes = collectConceptCodes(report);
  if (conceptCodes.length === 0) {
    return {
      ...report,
      conceptDisplayMap: {},
    };
  }

  const { data: conceptRows } = await supabase
    .from('concept_nodes_reference')
    .select('concept_code, title')
    .in('concept_code', conceptCodes);

  const conceptDisplayMap: Record<string, string> = {};

  for (const code of conceptCodes) {
    conceptDisplayMap[code] = fallbackConceptDisplayName(code);
  }

  for (const row of conceptRows ?? []) {
    if (row.concept_code && row.title) {
      conceptDisplayMap[row.concept_code] = row.title;
    }
  }

  return {
    ...report,
    conceptDisplayMap,
  };
}

async function attachReportFreshness(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  report: SessionReport
): Promise<SessionReport> {
  const reportUpdatedAt = report.persistedReport?.updatedAt;

  if (!reportUpdatedAt) {
    return {
      ...report,
      reportState: {
        ...report.reportState,
        hasNewDialogueSinceReport: false,
      },
    };
  }

  const { data: dialogueRow } = await supabase
    .from('dialogue_logs')
    .select('updated_at')
    .eq('session_id', report.session.id)
    .maybeSingle();

  const hasNewDialogueSinceReport = Boolean(
    dialogueRow?.updated_at &&
      new Date(dialogueRow.updated_at).getTime() > new Date(reportUpdatedAt).getTime()
  );

  return {
    ...report,
    reportState: {
      ...report.reportState,
      hasNewDialogueSinceReport,
    },
  };
}

async function hydrateReport(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  report: SessionReport
): Promise<SessionReport> {
  const withConceptDisplayMap = await attachConceptDisplayMap(supabase, report);
  return attachReportFreshness(supabase, withConceptDisplayMap);
}

function buildDialogueTranscript(messages: RawDialogueMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role ?? 'assistant';
      const speaker = role === 'user' || role === 'student' ? '학생' : 'AI';
      const text = sanitizeDialogueMessageText(msg.content ?? '', role);
      return `${speaker}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildBottlenecksTranscript(bottlenecks: RawBottleneckRow[]): string {
  if (bottlenecks.length === 0) {
    return '감지된 병목 없음';
  }

  return bottlenecks
    .map((b, index) => {
      const concept = b.mapped_concept_id || 'unmapped_bottleneck';
      const status = b.is_resolved_by_student ? 'resolved' : 'unresolved';
      return `${index + 1}. [${concept}] (${status}) ${b.struggle_description}`;
    })
    .join('\n');
}

function buildFallbackPersistedReport(
  messages: RawDialogueMessage[],
  bottlenecks: RawBottleneckRow[]
): PersistedSummaryPayload {
  const totalTurns = messages.filter((msg) => msg.role === 'user' || msg.role === 'student').length;
  const aiInterventions = messages.filter((msg) => msg.role === 'assistant' || msg.role === 'ai_tutor').length;
  const resolvedBottlenecks = bottlenecks.filter((b) => b.is_resolved_by_student).length;

  return {
    mastered_concepts: [] as string[],
    aha_moments: [] as Json[],
    ai_tutor_summary:
      bottlenecks.length > 0
        ? `${FALLBACK_SUMMARY_PREFIX} 감지된 병목 ${bottlenecks.length}건을 기준으로 기본 리포트를 저장합니다.`
        : `${FALLBACK_SUMMARY_PREFIX} 감지된 병목 없이 기본 리포트를 저장합니다.`,
    performance_metrics: {
      total_turns: totalTurns,
      ai_interventions: aiInterventions,
      resolved_bottlenecks: resolvedBottlenecks,
    } satisfies Json,
    summary_status: 'fallback',
  };
}

async function buildPersistedSessionReport(
  messages: RawDialogueMessage[],
  bottlenecks: RawBottleneckRow[]
): Promise<PersistedSummaryPayload> {
  const startedAt = Date.now();
  const fallback = buildFallbackPersistedReport(messages, bottlenecks);
  const dialogueTranscript = buildDialogueTranscript(messages);
  const bottlenecksTranscript = buildBottlenecksTranscript(bottlenecks);

  try {
    const text = await hfGenerateText({
      model: TAGGING_MODEL,
      inputs: insightAgentPrompt(dialogueTranscript, bottlenecksTranscript),
      parameters: { max_new_tokens: 2048, temperature: 0.1 },
      responseFormat: sessionInsightResponseFormat,
    });

    console.log('[report-service] 세션 요약 LLM 완료:', {
      model: TAGGING_MODEL,
      duration: formatDurationMs(startedAt),
    });

    const parsed = parseJsonObjectFromText<{
      mastered_concepts?: string[];
      aha_moments?: Json;
      ai_tutor_summary?: string;
      performance_metrics?: Json;
    }>(text);

    if (!parsed || typeof parsed.ai_tutor_summary !== 'string') {
      return fallback;
    }

    return {
      mastered_concepts: Array.isArray(parsed.mastered_concepts)
        ? parsed.mastered_concepts.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
      aha_moments: Array.isArray(parsed.aha_moments) ? parsed.aha_moments : [],
      ai_tutor_summary: parsed.ai_tutor_summary.trim() || fallback.ai_tutor_summary,
      performance_metrics:
        parsed.performance_metrics && typeof parsed.performance_metrics === 'object'
          ? parsed.performance_metrics
          : fallback.performance_metrics,
      summary_status: 'ready',
    };
  } catch (err) {
    console.error('[report-service] session_reports 생성 실패, fallback 사용:', err);
    console.error('[report-service] 세션 요약 fallback 전환 시간:', formatDurationMs(startedAt));
    return fallback;
  }
}

function buildDialogueLogSnapshots(
  messages: RawDialogueMessage[],
  updatedAt: string | null
): SnapshotDialogueLog[] {
  return messages
    .map((msg, index) => {
      const role = msg.role ?? 'assistant';

      return {
        id: `msg-${index}`,
        speaker: role === 'user' || role === 'student' ? 'student' : 'ai_tutor',
        text: sanitizeDialogueMessageText(msg.content ?? '', role),
        createdAt: updatedAt || new Date().toISOString(),
      };
    })
    .filter((log) => log.text.length > 0);
}

function buildBottleneckSnapshots(rows: RawBottleneckRow[]): SnapshotBottleneck[] {
  return rows.map((row) => ({
    id: row.id,
    conceptId: row.mapped_concept_id,
    description: row.struggle_description,
    isResolved: row.is_resolved_by_student,
    candidates: row.candidate_matches,
    createdAt: row.created_at,
  }));
}

function normalizeDialogueLogSnapshots(value: unknown): SnapshotDialogueLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const speaker = record.speaker === 'student' ? 'student' : 'ai_tutor';
    const text = typeof record.text === 'string' ? record.text : '';
    const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
    const id = typeof record.id === 'string' ? record.id : `msg-${index}`;

    if (!text.trim()) {
      return [];
    }

    return [{ id, speaker, text, createdAt }];
  });
}

function normalizeBottleneckSnapshots(value: unknown): SnapshotBottleneck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const conceptId = typeof record.conceptId === 'string' ? record.conceptId : null;
    const description = typeof record.description === 'string' ? record.description : '';
    const isResolved = Boolean(record.isResolved);
    const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
    const candidates: Json = 'candidates' in record ? (record.candidates as Json) : null;

    if (!id || !description.trim()) {
      return [];
    }

    return [{ id, conceptId, description, isResolved, candidates, createdAt }];
  });
}

function buildSessionReportFromPersistedRow(row: PersistedReportRow): SessionReport {
  const summaryStatus = row.ai_tutor_summary.startsWith(FALLBACK_SUMMARY_PREFIX) ? 'fallback' : 'ready';

  return {
    conceptDisplayMap: {},
    session: {
      id: row.session_id,
      status: row.session_status_snapshot,
      extractedText: row.extracted_text_snapshot,
      createdAt: row.session_created_at_snapshot,
      problemHash: row.problem_hash,
    },
    analysis: {
      requiredConcepts: row.required_concepts_snapshot ?? [],
      baseDifficulty: row.base_difficulty_snapshot ?? null,
      isHumanVerified: row.is_human_verified_snapshot ?? false,
      wasAnalyzedOnDemand: row.was_analyzed_on_demand ?? false,
    },
    dialogueLogs: normalizeDialogueLogSnapshots(row.dialogue_logs_snapshot),
    bottlenecks: normalizeBottleneckSnapshots(row.bottlenecks_snapshot),
    persistedReport: {
      id: row.id,
      masteredConcepts: row.mastered_concepts ?? [],
      ahaMoments: row.aha_moments ?? [],
      aiTutorSummary: row.ai_tutor_summary,
      performanceMetrics: row.performance_metrics ?? {},
      summaryStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    reportState: {
      persisted: true,
      summaryStatus,
      hasNewDialogueSinceReport: false,
    },
  };
}

async function upsertSessionReportRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: Database['public']['Tables']['session_reports']['Insert']
) {
  const { data, error } = await supabase
    .from('session_reports')
    .upsert(payload, { onConflict: 'session_id' })
    .select(SESSION_REPORT_SELECT)
    .single();

  return { data, error };
}

async function buildAndPersistSessionReport(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  session: {
    id: string;
    session_status: string;
    problem_hash: string;
    extracted_text: string;
    created_at: string;
  }
): Promise<SessionReport> {
  const buildStartedAt = Date.now();
  console.log('[report-service] 리포트 빌드 시작:', {
    sessionId: session.id,
    startedAt: new Date(buildStartedAt).toISOString(),
  });

  const { data: graph } = await supabase
    .from('strategy_graphs')
    .select('required_concepts, base_difficulty, is_human_verified')
    .eq('problem_hash', session.problem_hash)
    .maybeSingle();

  const [{ data: logs }, { data: bottlenecks }] = await Promise.all([
    supabase
      .from('dialogue_logs')
      .select('messages, updated_at')
      .eq('session_id', session.id)
      .maybeSingle(),
    supabase
      .from('learning_bottlenecks')
      .select('id, mapped_concept_id, struggle_description, is_resolved_by_student, candidate_matches, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
  ]);

  const messagesArray = ((logs?.messages as RawDialogueMessage[] | null) ?? []);
  const bottleneckRows = (bottlenecks ?? []) as RawBottleneckRow[];
  const dialogueLogSnapshots = buildDialogueLogSnapshots(messagesArray, logs?.updated_at ?? null);
  const bottleneckSnapshots = buildBottleneckSnapshots(bottleneckRows);
  const fallbackSummary = buildFallbackPersistedReport(messagesArray, bottleneckRows);
  const now = new Date().toISOString();

  const baselinePayload: Database['public']['Tables']['session_reports']['Insert'] = {
    session_id: session.id,
    problem_hash: session.problem_hash,
    session_status_snapshot: session.session_status,
    extracted_text_snapshot: session.extracted_text,
    session_created_at_snapshot: session.created_at,
    required_concepts_snapshot: graph?.required_concepts ?? [],
    base_difficulty_snapshot: graph?.base_difficulty ?? null,
    is_human_verified_snapshot: graph?.is_human_verified ?? false,
    was_analyzed_on_demand: false,
    dialogue_logs_snapshot: dialogueLogSnapshots,
    bottlenecks_snapshot: bottleneckSnapshots,
    mastered_concepts: fallbackSummary.mastered_concepts,
    aha_moments: fallbackSummary.aha_moments,
    ai_tutor_summary: fallbackSummary.ai_tutor_summary,
    performance_metrics: fallbackSummary.performance_metrics,
    report_version: 1,
    updated_at: now,
  };

  const { data: baselineRow, error: baselineError } = await upsertSessionReportRow(supabase, baselinePayload);

  if (baselineError || !baselineRow) {
    console.error('[report-service] session_reports baseline upsert 실패:', baselineError);
    console.error('[report-service] baseline upsert 실패까지 걸린 시간:', formatDurationMs(buildStartedAt));

    return {
      conceptDisplayMap: {},
      session: {
        id: session.id,
        status: session.session_status,
        extractedText: session.extracted_text,
        createdAt: session.created_at,
        problemHash: session.problem_hash,
      },
      analysis: {
        requiredConcepts: graph?.required_concepts ?? [],
        baseDifficulty: graph?.base_difficulty ?? null,
        isHumanVerified: graph?.is_human_verified ?? false,
        wasAnalyzedOnDemand: false,
      },
      dialogueLogs: dialogueLogSnapshots,
      bottlenecks: bottleneckSnapshots,
      persistedReport: null,
      reportState: {
        persisted: false,
        summaryStatus: fallbackSummary.summary_status,
        hasNewDialogueSinceReport: false,
      },
    };
  }

  let analyzedGraph = {
    required_concepts: graph?.required_concepts ?? [],
    base_difficulty: graph?.base_difficulty ?? null,
    is_human_verified: graph?.is_human_verified ?? false,
  };

  const needsAnalysis = !graph?.required_concepts?.length;
  if (needsAnalysis) {
    const analysisStartedAt = Date.now();
    console.log('[report-service] required_concepts 동기 분석 시작:', {
      sessionId: session.id,
    });
    try {
      const extracted = await extractAndUpdateRequiredConcepts({
        sessionId: session.id,
        problemHash: session.problem_hash,
      });
      if (extracted) {
        analyzedGraph = {
          ...analyzedGraph,
          required_concepts: extracted.requiredConcepts,
          base_difficulty: extracted.baseDifficulty ?? analyzedGraph.base_difficulty,
        };
      }
      console.log('[report-service] required_concepts 동기 분석 완료:', {
        sessionId: session.id,
        duration: formatDurationMs(analysisStartedAt),
      });
    } catch (err) {
      console.error('[report-service] required_concepts 동기 분석 실패:', err);
      console.error('[report-service] required_concepts 실패까지 걸린 시간:', formatDurationMs(analysisStartedAt));
      return buildSessionReportFromPersistedRow(baselineRow);
    }
  }

  const persistedSummary = await buildPersistedSessionReport(messagesArray, bottleneckRows);
  const reportPayload: Database['public']['Tables']['session_reports']['Insert'] = {
    ...baselinePayload,
    required_concepts_snapshot: analyzedGraph.required_concepts,
    base_difficulty_snapshot: analyzedGraph.base_difficulty,
    is_human_verified_snapshot: analyzedGraph.is_human_verified,
    was_analyzed_on_demand: needsAnalysis,
    mastered_concepts: persistedSummary.mastered_concepts,
    aha_moments: persistedSummary.aha_moments,
    ai_tutor_summary: persistedSummary.ai_tutor_summary,
    performance_metrics: persistedSummary.performance_metrics,
    updated_at: new Date().toISOString(),
  };

  const { data: persistedReportRow, error: upsertError } = await upsertSessionReportRow(supabase, reportPayload);

  if (upsertError || !persistedReportRow) {
    console.error('[report-service] session_reports upsert 실패:', upsertError);
    console.error('[report-service] 최종 upsert 실패까지 걸린 시간:', formatDurationMs(buildStartedAt));
    return buildSessionReportFromPersistedRow(baselineRow);
  }

  console.log('[report-service] 리포트 빌드 완료:', {
    sessionId: session.id,
    duration: formatDurationMs(buildStartedAt),
    summaryStatus: persistedSummary.summary_status,
    requiredConceptCount: reportPayload.required_concepts_snapshot?.length ?? 0,
    bottleneckCount: bottleneckRows.length,
  });

  return buildSessionReportFromPersistedRow(persistedReportRow);
}

/**
 * 세션 리포트를 조회합니다.
 * required_concepts와 session_reports snapshot을 동기 생성/갱신한 뒤 최신 결과를 반환합니다.
 *
 * @throws 세션이 completed가 아닌 경우 { code: 'NOT_COMPLETED' } 오류
 */
export async function getOrBuildSessionReport(
  sessionId: string,
  studentId: string,
  options?: {
    forceRegenerate?: boolean;
  }
): Promise<SessionReport> {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();
  const forceRegenerate = options?.forceRegenerate ?? false;

  console.log('[report-service] 리포트 조회 시작:', {
    sessionId,
    forceRegenerate,
    startedAt: new Date(startedAt).toISOString(),
  });

  const { data: session } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash, extracted_text, created_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.student_id !== studentId) {
    const err: ReportServiceError = new Error('세션을 찾을 수 없습니다.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (session.session_status !== 'completed') {
    const err: ReportServiceError = new Error(`세션이 완료 상태가 아닙니다. 현재 상태: ${session.session_status}`);
    err.code = 'NOT_COMPLETED';
    err.status = 403;
    throw err;
  }

  if (!forceRegenerate) {
    const { data: existingReport } = await supabase
      .from('session_reports')
      .select(SESSION_REPORT_SELECT)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingReport) {
      console.log('[report-service] 기존 리포트 반환:', {
        sessionId,
        duration: formatDurationMs(startedAt),
      });
      return hydrateReport(supabase, buildSessionReportFromPersistedRow(existingReport));
    }
  }

  const existingLock = reportBuildLocks.get(sessionId);
  if (existingLock) {
    console.log('[report-service] 진행 중인 리포트 빌드 대기:', {
      sessionId,
      duration: formatDurationMs(startedAt),
    });
    return existingLock.then((report) => hydrateReport(supabase, report));
  }

  const buildPromise = buildAndPersistSessionReport(supabase, session);
  reportBuildLocks.set(sessionId, buildPromise);

  try {
    const report = await buildPromise;
    const hydratedReport = await hydrateReport(supabase, report);
    console.log('[report-service] 리포트 조회 완료:', {
      sessionId,
      duration: formatDurationMs(startedAt),
      summaryStatus: hydratedReport.reportState.summaryStatus,
      persisted: hydratedReport.reportState.persisted,
    });
    return hydratedReport;
  } finally {
    if (reportBuildLocks.get(sessionId) === buildPromise) {
      reportBuildLocks.delete(sessionId);
    }
  }
}
