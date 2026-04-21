'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser as supabase } from '@/lib/supabase/browser';
import {
  FileText,
  Search,
  Loader2,
  Save,
  Database as DatabaseIcon,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface StrategyGraph {
  problem_hash: string;
  problem_text: string | null;
  required_concepts: string[];
  base_difficulty: number;
  intended_path: string[];
  graph_data: any;
  is_human_verified: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 text-[11px] font-mono px-2 py-1 rounded-lg"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? '입력 후 Enter'}
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="px-2.5 py-1.5 bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-bold hover:bg-zinc-300 transition-colors"
        >
          추가
        </button>
      </div>
    </div>
  );
}

function JsonEditor({
  value,
  onChange,
  rows = 6,
}: {
  value: any;
  onChange: (v: any) => void;
  rows?: number;
}) {
  const [raw, setRaw] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  const handleChange = (text: string) => {
    setRaw(text);
    try {
      const parsed = JSON.parse(text);
      setError(null);
      onChange(parsed);
    } catch {
      setError('유효하지 않은 JSON 형식');
    }
  };

  return (
    <div>
      <textarea
        rows={rows}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full bg-zinc-50 border rounded-xl p-4 text-xs font-mono leading-relaxed outline-none resize-y ${
          error ? 'border-red-300 focus:ring-red-200' : 'border-zinc-200 focus:ring-emerald-500/20'
        } focus:ring-2`}
      />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-bold text-zinc-500 block mb-1.5">{children}</label>;
}

export default function ProblemBankPanel() {
  const [graphs, setGraphs] = useState<StrategyGraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StrategyGraph | null>(null);
  const [saving, setSaving] = useState(false);
  const [graphForm, setGraphForm] = useState<Partial<StrategyGraph>>({});

  useEffect(() => {
    fetchGraphs();
  }, []);

  async function fetchGraphs() {
    setLoading(true);
    const { data } = await supabase
      .from('strategy_graphs')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setGraphs(data as StrategyGraph[]);
    setLoading(false);
  }

  async function handleSearchGraphs() {
    if (!search.trim()) {
      await fetchGraphs();
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('strategy_graphs')
      .select('*')
      .eq('is_deleted', false)
      .ilike('problem_text', `%${search}%`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      setGraphs(data as StrategyGraph[]);
    }

    setLoading(false);
  }

  const selectGraph = useCallback((graph: StrategyGraph) => {
    setSelected(graph);
    setGraphForm({
      problem_text: graph.problem_text,
      required_concepts: [...(graph.required_concepts || [])],
      base_difficulty: graph.base_difficulty,
      intended_path: [...(graph.intended_path || [])],
      graph_data: graph.graph_data,
      is_human_verified: graph.is_human_verified,
    });
  }, []);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('strategy_graphs')
        .update({
          problem_text: graphForm.problem_text ?? null,
          required_concepts: graphForm.required_concepts ?? [],
          base_difficulty: graphForm.base_difficulty ?? 3,
          intended_path: graphForm.intended_path ?? [],
          graph_data: graphForm.graph_data ?? {},
          is_human_verified: graphForm.is_human_verified ?? false,
        })
        .eq('problem_hash', selected.problem_hash);

      if (error) throw error;

      alert('저장되었습니다.');
      await fetchGraphs();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGraph() {
    if (!selected) return;
    const confirmed = confirm(
      '이 문제 은행 항목을 숨김 처리하시겠습니까?\nstrategy_graphs row는 soft delete 되고, 세션/병목 데이터는 유지됩니다.'
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const res = await fetch('/admin/api/strategy-graphs/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problem_hash: selected.problem_hash,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      alert('삭제되었습니다.');
      setSelected(null);
      setGraphForm({});
      await fetchGraphs();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden text-zinc-900">
      <header className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <FileText className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">문제은행 관리</h1>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">STRATEGY GRAPHS ONLY</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-96 border-r border-zinc-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-100 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="문제 원문 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchGraphs()}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <button
                onClick={handleSearchGraphs}
                className="bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-700 shrink-0"
              >
                검색
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 pl-1">{graphs.length}개 전략 그래프</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin mx-auto" size={18} />
              </div>
            ) : (
              graphs.map((graph) => (
                <button
                  key={graph.problem_hash}
                  onClick={() => selectGraph(graph)}
                  className={`w-full text-left p-4 border-b border-zinc-50 transition-all hover:bg-zinc-50 ${
                    selected?.problem_hash === graph.problem_hash ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      graph.is_human_verified
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {graph.is_human_verified ? 'verified' : 'auto'}
                    </span>
                    <span className="text-[9px] text-zinc-300 font-mono">
                      {new Date(graph.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 line-clamp-2 leading-relaxed">
                    {graph.problem_text?.trim() || '문제 원문 없음'}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-8">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
              <div className="text-center space-y-2">
                <DatabaseIcon size={32} className="mx-auto text-zinc-300" />
                <p>좌측에서 전략 그래프를 선택하세요</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">strategy_graphs 편집</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteGraph}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 disabled:bg-zinc-100 disabled:text-zinc-400 transition-all"
                  >
                    <Trash2 size={14} />
                    삭제
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:bg-zinc-200 transition-all"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    저장
                  </button>
                </div>
              </div>

              <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-5">
                <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-2 border-b border-zinc-100 pb-3">
                  <DatabaseIcon size={14} className="text-emerald-500" />
                  strategy_graphs
                  <span className="text-[9px] text-zinc-300 font-mono ml-auto">{selected.problem_hash.slice(0, 16)}…</span>
                </h3>

                <div>
                  <FieldLabel>Problem Text (정리된 문제 원문)</FieldLabel>
                  <textarea
                    rows={4}
                    value={graphForm.problem_text || ''}
                    onChange={(e) => setGraphForm({ ...graphForm, problem_text: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y leading-relaxed"
                  />
                </div>

                <div>
                  <FieldLabel>Required Concepts</FieldLabel>
                  <TagInput
                    value={graphForm.required_concepts || []}
                    onChange={(v) => setGraphForm({ ...graphForm, required_concepts: v })}
                    placeholder="concept_code 입력 후 Enter"
                  />
                </div>

                <div>
                  <FieldLabel>Base Difficulty (1~5)</FieldLabel>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button
                        key={d}
                        onClick={() => setGraphForm({ ...graphForm, base_difficulty: d })}
                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                          graphForm.base_difficulty === d
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Intended Path</FieldLabel>
                  <TagInput
                    value={graphForm.intended_path || []}
                    onChange={(v) => setGraphForm({ ...graphForm, intended_path: v })}
                    placeholder="풀이 순서 노드 입력 후 Enter"
                  />
                </div>

                <div>
                  <FieldLabel>Graph Data (JSON)</FieldLabel>
                  <JsonEditor
                    value={graphForm.graph_data ?? {}}
                    onChange={(v) => setGraphForm({ ...graphForm, graph_data: v })}
                    rows={8}
                  />
                </div>

                <div className="flex items-center justify-between bg-zinc-50 rounded-xl p-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-700">Human Verified</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">사람이 검수한 전략 그래프인지 표시</p>
                  </div>
                  <button
                    onClick={() => setGraphForm({ ...graphForm, is_human_verified: !graphForm.is_human_verified })}
                    className="transition-colors"
                  >
                    {graphForm.is_human_verified ? (
                      <ToggleRight size={32} className="text-emerald-600" />
                    ) : (
                      <ToggleLeft size={32} className="text-zinc-300" />
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
