'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser as supabase } from '@/lib/supabase/browser';
import {
  BookOpen,
  Search,
  Loader2,
  CheckCircle2,
  BrainCircuit,
  Save,
  X,
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';

type TabId = 'concepts' | 'aliases';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'concepts', label: '개념 노드', icon: <BrainCircuit size={14} /> },
  { id: 'aliases', label: '개념 Alias', icon: <Tag size={14} /> },
];

const NODE_TYPES = ['PD', 'PP', 'PC'] as const;

interface ConceptNode {
  id: string;
  concept_code: string;
  node_type: string;
  title: string;
  definition: string;
  description: string;
  keywords: string[];
  prerequisites: string[];
  examples_of_use: string[];
  embedding: number[] | null;
}

type ConceptNodeListItem = Pick<ConceptNode, 'id' | 'concept_code' | 'node_type' | 'title'>;

interface ConceptAlias {
  id: string;
  concept_code: string;
  alias_text: string;
  failure_type: string;
  created_at: string;
  embedding?: number[] | null;
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-bold text-zinc-500 block mb-1.5">{children}</label>;
}

export default function KnowledgeManagementPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('concepts');
  const [stats, setStats] = useState({ referenceNull: 0, aliasNull: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  async function fetchStats() {
    const [{ count: refCount }, { count: aliasCount }] = await Promise.all([
      supabase.from('concept_nodes_reference').select('id', { count: 'exact', head: true }).is('embedding', null),
      supabase.from('concept_aliases').select('id', { count: 'exact', head: true }).is('embedding', null),
    ]);
    setStats({ referenceNull: refCount || 0, aliasNull: aliasCount || 0 });
  }

  async function handleGenerateEmbeddings() {
    setIsGenerating(true);
    try {
      const res = await fetch('/admin/api/generate-embeddings', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.generated}개의 임베딩이 생성되었습니다.`);
        await fetchStats();
        triggerRefresh();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden text-zinc-900">
      <header className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <BookOpen className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">개념 노드 · Alias 관리</h1>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">Administration Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 px-4 py-2 rounded-2xl">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Needs Vector</span>
              <div className="flex gap-2 mt-0.5">
                <span className={`text-[10px] font-mono font-bold ${stats.referenceNull > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>
                  Ref:{stats.referenceNull}
                </span>
                <span className={`text-[10px] font-mono font-bold ${stats.aliasNull > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>
                  Alias:{stats.aliasNull}
                </span>
              </div>
            </div>
            <button
              onClick={handleGenerateEmbeddings}
              disabled={isGenerating || (stats.referenceNull === 0 && stats.aliasNull === 0)}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-zinc-200 transition-all flex items-center gap-2 shadow-md shadow-emerald-100 active:scale-95"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
              {isGenerating ? '생성 중...' : '임베딩 생성'}
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-zinc-200 px-8 shrink-0">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'concepts' && <ConceptNodesTab onStatsChange={fetchStats} refreshKey={refreshKey} />}
        {activeTab === 'aliases' && <ConceptAliasesTab onStatsChange={fetchStats} refreshKey={refreshKey} />}
      </main>
    </div>
  );
}

function ConceptNodesTab({ onStatsChange, refreshKey }: { onStatsChange: () => void, refreshKey: number }) {
  const [concepts, setConcepts] = useState<ConceptNodeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConceptNode | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ConceptNode>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConcepts();
  }, [refreshKey]);

  useEffect(() => {
    if (selected && !concepts.some(c => c.id === selected.id)) {
      setSelected(null);
      setEditForm({});
    }
  }, [concepts, selected]);

  async function fetchConcepts() {
    setLoading(true);
    const { data } = await supabase
      .from('concept_nodes_reference')
      .select('id, concept_code, title, node_type')
      .order('concept_code', { ascending: true });
    if (data) setConcepts(data as ConceptNodeListItem[]);
    setLoading(false);
  }

  const applySelectedConcept = useCallback((concept: ConceptNode) => {
    setSelected(concept);
    setEditForm({
      title: concept.title,
      node_type: concept.node_type,
      definition: concept.definition,
      description: concept.description,
      keywords: [...(concept.keywords || [])],
      prerequisites: [...(concept.prerequisites || [])],
      examples_of_use: [...(concept.examples_of_use || [])],
    });
  }, []);

  const fetchConceptDetail = useCallback(async (id: string) => {
    setSelectedLoading(true);
    const { data, error } = await supabase
      .from('concept_nodes_reference')
      .select('id, concept_code, node_type, title, definition, description, keywords, prerequisites, examples_of_use, embedding')
      .eq('id', id)
      .single();

    if (error) {
      alert(`개념 상세 조회 실패: ${error.message}`);
    } else if (data) {
      applySelectedConcept(data as ConceptNode);
    }

    setSelectedLoading(false);
  }, [applySelectedConcept]);

  const selectConcept = useCallback((c: ConceptNodeListItem) => {
    fetchConceptDetail(c.id);
  }, [fetchConceptDetail]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('concept_nodes_reference')
        .update({
          title: editForm.title,
          node_type: editForm.node_type,
          definition: editForm.definition,
          description: editForm.description,
          keywords: editForm.keywords,
          prerequisites: editForm.prerequisites,
          examples_of_use: editForm.examples_of_use,
          embedding: null,
        })
        .eq('id', selected.id);
      if (error) throw error;
      alert('저장되었습니다.');
      await fetchConcepts();
      await fetchConceptDetail(selected.id);
      onStatsChange();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConcept() {
    if (!selected) return;
    const confirmed = confirm(
      `개념 노드 "${selected.concept_code}"를 삭제하시겠습니까?\n연결된 concept alias도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/admin/api/concept-nodes/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selected.id,
          concept_code: selected.concept_code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      alert('삭제되었습니다.');
      setSelected(null);
      setEditForm({});
      await fetchConcepts();
      onStatsChange();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = concepts.filter(
    (c) =>
      c.concept_code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full">
      <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="코드 또는 제목 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 pl-1">{filtered.length}개 노드</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={18} /></div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConcept(c)}
                className={`w-full text-left p-4 border-b border-zinc-50 transition-all hover:bg-zinc-50 flex flex-col gap-1.5 ${selected?.id === c.id ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-100' : ''
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {c.concept_code}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-300 uppercase">{c.node_type}</span>
                </div>
                <p className="text-xs font-bold text-zinc-800 line-clamp-1">{c.title}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-8">
        {selectedLoading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : !selected ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            <div className="text-center space-y-2">
              <BrainCircuit size={32} className="mx-auto text-zinc-300" />
              <p>좌측에서 개념을 선택하세요</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <span className="text-emerald-600 font-mono">@{selected.concept_code}</span>
                <span className="text-zinc-300">편집</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteConcept}
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
                  변경사항 저장
                </button>
              </div>
            </div>

            <div>
              <FieldLabel>Title (표시명)</FieldLabel>
              <input
                value={editForm.title || ''}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <FieldLabel>Node Type</FieldLabel>
              <div className="flex gap-1.5">
                {NODE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditForm({ ...editForm, node_type: t })}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${editForm.node_type === t
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Definition (정의)</FieldLabel>
              <textarea
                rows={3}
                value={editForm.definition || ''}
                onChange={(e) => setEditForm({ ...editForm, definition: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y"
              />
            </div>

            <div>
              <FieldLabel>Description (검색/진단용 설명)</FieldLabel>
              <textarea
                rows={4}
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y"
              />
            </div>

            <div>
              <FieldLabel>Keywords</FieldLabel>
              <TagInput
                value={editForm.keywords || []}
                onChange={(v) => setEditForm({ ...editForm, keywords: v })}
                placeholder="키워드 입력 후 Enter"
              />
            </div>

            <div>
              <FieldLabel>Prerequisites (선이수 개념 코드)</FieldLabel>
              <TagInput
                value={editForm.prerequisites || []}
                onChange={(v) => setEditForm({ ...editForm, prerequisites: v })}
                placeholder="concept_code 입력 후 Enter"
              />
            </div>

            <div>
              <FieldLabel>Examples of Use</FieldLabel>
              <TagInput
                value={editForm.examples_of_use || []}
                onChange={(v) => setEditForm({ ...editForm, examples_of_use: v })}
                placeholder="활용 예시 입력 후 Enter"
              />
            </div>

            <div className="bg-zinc-50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">임베딩 상태: {(selected.embedding && selected.embedding.length > 0) ? '✅ 생성됨' : '⚠️ 미생성'}</span>
              <span className="text-[10px] text-zinc-400 font-mono">id: {selected.id.slice(0, 8)}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptAliasesTab({ onStatsChange, refreshKey }: { onStatsChange: () => void, refreshKey: number }) {
  const [concepts, setConcepts] = useState<{ concept_code: string; title: string }[]>([]);
  const [aliases, setAliases] = useState<ConceptAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAliasText, setNewAliasText] = useState('');
  const [newFailureType, setNewFailureType] = useState('concept_gap');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editFailureType, setEditFailureType] = useState('');

  const FAILURE_TYPES = [
    'concept_gap',
    'misconception',
    'strategy_failure',
    'calculation_error',
    'condition_interpretation_failure',
  ] as const;

  useEffect(() => {
    fetchConcepts();
    if (selectedCode) fetchAliases(selectedCode);
  }, [refreshKey]);

  async function fetchConcepts() {
    setLoading(true);
    const { data } = await supabase.from('concept_nodes_reference').select('concept_code, title').order('concept_code', { ascending: true });
    if (data) setConcepts(data);
    setLoading(false);
  }

  const fetchAliases = useCallback(async (code: string) => {
    const { data } = await supabase
      .from('concept_aliases')
      .select('id, concept_code, alias_text, failure_type, created_at')
      .eq('concept_code', code)
      .order('created_at', { ascending: false });
    if (data) setAliases(data as any[]);
  }, []);

  const selectConcept = useCallback((code: string) => {
    setSelectedCode(code);
    fetchAliases(code);
    setEditingId(null);
  }, [fetchAliases]);

  async function handleAddAlias() {
    if (!selectedCode || !newAliasText.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('concept_aliases').insert({
        concept_code: selectedCode,
        alias_text: newAliasText.trim(),
        failure_type: newFailureType,
      });
      if (error) throw error;
      setNewAliasText('');
      await fetchAliases(selectedCode);
      onStatsChange();
    } catch (err: any) {
      alert(`추가 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateAlias(id: string) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('concept_aliases')
        .update({
          alias_text: editText.trim(),
          failure_type: editFailureType,
          embedding: null,
        })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      if (selectedCode) await fetchAliases(selectedCode);
      onStatsChange();
    } catch (err: any) {
      alert(`수정 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAlias(id: string) {
    if (!confirm('이 별칭을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('concept_aliases').delete().eq('id', id);
      if (error) throw error;
      if (selectedCode) await fetchAliases(selectedCode);
      onStatsChange();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  }

  const filteredConcepts = concepts.filter(
    (c) =>
      c.concept_code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full">
      <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="개념 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={18} /></div>
          ) : (
            filteredConcepts.map((c) => (
              <button
                key={c.concept_code}
                onClick={() => selectConcept(c.concept_code)}
                className={`w-full text-left p-4 border-b border-zinc-50 transition-all hover:bg-zinc-50 ${selectedCode === c.concept_code ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-100' : ''
                  }`}
              >
                <span className="text-[9px] font-mono font-bold text-emerald-600">{c.concept_code}</span>
                <p className="text-xs font-bold text-zinc-800 mt-0.5 line-clamp-1">{c.title}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-8">
        {!selectedCode ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            <div className="text-center space-y-2">
              <Tag size={32} className="mx-auto text-zinc-300" />
              <p>좌측에서 개념을 선택하세요</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-base font-bold">
              <span className="text-emerald-600 font-mono">@{selectedCode}</span>
              <span className="text-zinc-400 ml-2">별칭 관리</span>
            </h2>

            <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-700 flex items-center gap-2">
                <Plus size={14} className="text-emerald-500" />
                새 별칭 추가
              </h3>
              <div>
                <FieldLabel>Alias Text (학생이 쓸 법한 표현 / 병목 상황 설명)</FieldLabel>
                <textarea
                  rows={3}
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  placeholder="예: 로그 밑변환을 할 때 분모 분자를 헷갈려요"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>
              <div>
                <FieldLabel>Failure Type</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {FAILURE_TYPES.map((ft) => (
                    <button
                      key={ft}
                      onClick={() => setNewFailureType(ft)}
                      className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all ${newFailureType === ft
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleAddAlias}
                disabled={saving || !newAliasText.trim()}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                별칭 추가
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-500">등록된 별칭 ({aliases.length}개)</h3>
              {aliases.length === 0 ? (
                <p className="text-xs text-zinc-400 p-4 bg-zinc-50 rounded-xl text-center">별칭이 없습니다.</p>
              ) : (
                aliases.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3 hover:border-zinc-300 transition-all"
                  >
                    {editingId === a.id ? (
                      <>
                        <textarea
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                        />
                        <div className="flex flex-wrap gap-1">
                          {FAILURE_TYPES.map((ft) => (
                            <button
                              key={ft}
                              onClick={() => setEditFailureType(ft)}
                              className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${editFailureType === ft ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-400'
                                }`}
                            >
                              {ft}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateAlias(a.id)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-zinc-200 text-zinc-600 text-[10px] font-bold rounded-lg"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-zinc-700 leading-relaxed">{a.alias_text}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded">
                            {a.failure_type}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setEditingId(a.id);
                                setEditText(a.alias_text);
                                setEditFailureType(a.failure_type);
                              }}
                              className="text-[10px] font-bold text-zinc-400 hover:text-emerald-600 transition-colors px-2 py-1"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteAlias(a.id)}
                              className="text-[10px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
