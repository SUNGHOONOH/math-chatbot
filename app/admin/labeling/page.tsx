'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  ChevronRight, 
  Search, 
  Database,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';

type CandidateMatch = {
  concept_code: string;
  concept_title?: string;
  matched_text: string;
  similarity: number;
};

type AdminBottleneck = {
  id: string;
  mapped_concept_id: string;
  mapped_concept_title?: string;
  failure_type: string | null;
  candidate_matches: CandidateMatch[];
  struggle_description: string;
  created_at: string;
  tutoring_sessions?: {
    extracted_text?: string;
  } | null;
};

const FAILURE_TYPES = [
  { id: 'concept_gap', label: '개념 부재 (Concept Gap)' },
  { id: 'misconception', label: '오개념 (Misconception)' },
  { id: 'strategy_failure', label: '전략 실패 (Strategy Failure)' },
  { id: 'calculation_error', label: '계산 실수 (Calculation Error)' },
  { id: 'condition_interpretation_failure', label: '조건 해석 실패 (Condition Interpretation)' },
];

export default function LabelingPage() {
  const [bottlenecks, setBottlenecks] = useState<AdminBottleneck[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unmapped'>('all');
  const [errorMessage, setErrorMessage] = useState('');

  // 선택된 항목의 수정용 상태
  const [editConcept, setEditConcept] = useState('');
  const [editType, setEditType] = useState('');
  const [syncToAlias, setSyncToAlias] = useState(true);

  useEffect(() => {
    fetchBottlenecks();
  }, []);

  async function fetchBottlenecks() {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/admin/api/bottlenecks');
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || '병목 목록을 불러오지 못했습니다.');
      }

      setBottlenecks(payload.bottlenecks ?? []);
    } catch (err) {
      console.error(err);
      setBottlenecks([]);
      setErrorMessage(err instanceof Error ? err.message : '병목 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const filteredBottlenecks = bottlenecks.filter(b => 
    filter === 'all' || b.mapped_concept_id === 'unmapped_bottleneck'
  );

  const selectedItem = bottlenecks.find(b => b.id === selectedId);

  useEffect(() => {
    if (selectedItem) {
      setEditConcept(selectedItem.mapped_concept_id);
      setEditType(selectedItem.failure_type || 'concept_gap');
    }
  }, [selectedId, selectedItem]);

  async function handleUpdate() {
    if (!selectedId) return;
    setSaving(true);
    
    try {
      const res = await fetch('/admin/api/bottlenecks/update', {
        method: 'PATCH',
        body: JSON.stringify({
          bottleneckId: selectedId,
          mapped_concept_id: editConcept,
          failure_type: editType,
          syncToAlias: syncToAlias
        })
      });

      if (res.ok) {
        alert('업데이트 성공!');
        fetchBottlenecks();
        setSelectedId(null);
      } else {
        alert('업데이트 실패');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* 왼쪽 리스트 섹션 */}
      <div className="w-1/2 border-r border-zinc-200 flex flex-col bg-white overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h1 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
            <Database size={20} className="text-blue-600" />
            AI 진단 라벨링 & 교정
          </h1>
          <p className="text-xs text-zinc-500 mt-1 mb-4">학생 대화에서 감지된 병목 지점을 확인하고 매핑을 교정합니다.</p>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filter === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
              전체 보기
            </button>
            <button 
              onClick={() => setFilter('unmapped')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filter === 'unmapped' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'}`}
            >
              미배정 (Candidate Bucket)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-zinc-400"><Loader2 className="animate-spin mx-auto mb-2" /> 로딩 중...</div>
          ) : (
            errorMessage ? (
              <div className="p-10 text-center text-sm text-rose-500">{errorMessage}</div>
            ) : filteredBottlenecks.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-400">표시할 병목 데이터가 없습니다.</div>
            ) : filteredBottlenecks.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`w-full text-left p-5 border-b border-zinc-50 transition-all flex items-center gap-4 hover:bg-zinc-50 ${
                  selectedId === b.id ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-100' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded">
                      {b.mapped_concept_title || b.mapped_concept_id}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      @{b.mapped_concept_id}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-tighter ${
                      b.failure_type ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {b.failure_type || 'unlabeled'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800 font-medium line-clamp-2 leading-relaxed">{b.struggle_description}</p>
                  <p className="text-[10px] text-zinc-400 mt-2 font-mono">
                    {new Date(b.created_at).toLocaleString()}
                  </p>
                </div>
                <ChevronRight size={16} className={selectedId === b.id ? 'text-blue-400' : 'text-zinc-300'} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽 상세/수정 섹션 */}
      <div className="w-1/2 overflow-y-auto bg-zinc-50/50 p-8">
        {selectedItem ? (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 상단 정보 영역 */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 overflow-hidden relative">
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">현재 진단 정보</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1.5 font-bold">학생의 어려움 분석 (Struggle)</label>
                  <p className="text-zinc-900 font-medium leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm italic font-serif">
                    "{selectedItem.struggle_description}"
                  </p>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1.5 font-bold">문제 원문</label>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm text-zinc-700">
                    {selectedItem.tutoring_sessions?.extracted_text ? (
                      <div className="prose prose-sm prose-zinc max-w-none leading-relaxed [&_*]:my-0">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {selectedItem.tutoring_sessions.extracted_text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>문제 원문이 없습니다.</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1.5 font-bold">RAG 기반 후보 매칭 (Candidate Matches)</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {Array.isArray(selectedItem.candidate_matches) && selectedItem.candidate_matches.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] bg-white border border-zinc-100 px-3 py-2 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-semibold text-blue-700 truncate">{c.concept_title || c.concept_code}</p>
                          <p className="font-mono text-[10px] text-zinc-400">{c.concept_code}</p>
                        </div>
                        <span className="text-zinc-500 truncate flex-1 mx-3">{c.matched_text}</span>
                        <span className="font-mono text-zinc-400">{(c.similarity * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 수정 폼 영역 */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-xl shadow-blue-900/5 p-6 space-y-6 ring-4 ring-blue-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-500" />
                진단 결과 교정
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 block mb-2">Mapped Concept ID (교정)</label>
                  <input
                    type="text"
                    value={editConcept}
                    onChange={(e) => setEditConcept(e.target.value)}
                    placeholder="예: log_base_change, log_definition"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:bg-white outline-none transition-all"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-zinc-400 mr-1">AI 제안:</span>
                    {Array.isArray(selectedItem.candidate_matches) && selectedItem.candidate_matches.slice(0, 3).map((c) => (
                      <button 
                        key={c.concept_code}
                        onClick={() => setEditConcept(c.concept_code)}
                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                      >
                        {c.concept_title || c.concept_code}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-500 block mb-2">실패 유형 (Failure Type)</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {FAILURE_TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setEditType(t.id)}
                        className={`text-left px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                          editType === t.id 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' 
                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-700">지식베이스(Alias) 즉시 등록</span>
                    <p className="text-[10px] text-zinc-400">이 케이스를 검색 데이터로 등록해 AI 성능을 향상시킵니다.</p>
                  </div>
                  <button 
                    onClick={() => setSyncToAlias(!syncToAlias)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${syncToAlias ? 'bg-blue-500' : 'bg-zinc-200'}`}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${syncToAlias ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="w-full py-4 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
                >
                  {saving ? '저장 중...' : '교정 완료 및 반영하기'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4">
            <div className="w-16 h-16 bg-white border border-dashed border-zinc-200 rounded-full flex items-center justify-center animate-pulse">
              <Search size={24} />
            </div>
            <p className="text-xs font-medium">데이터를 선택하여 분석을 시작하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
