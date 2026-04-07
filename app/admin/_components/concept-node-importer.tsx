'use client';

import { useState } from 'react';

export default function ConceptNodeImporter() {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const nodes = JSON.parse(jsonInput);
      if (!Array.isArray(nodes)) {
        setStatus('error');
        setMessage('JSON 배열 형식이어야 합니다. (예: [{ "concept_code": "...", ... }])');
        return;
      }

      const res = await fetch('/admin/api/concept-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '서버 오류');
        return;
      }

      setStatus('success');
      setMessage(`✅ ${data.count}개의 개념 노드가 성공적으로 삽입/업데이트되었습니다.`);
      setJsonInput('');
    } catch {
      setStatus('error');
      setMessage('❌ JSON 파싱 실패. 올바른 JSON 배열인지 확인하세요.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-zinc-700 mb-2">
          JSON 배열 입력
        </label>
        <textarea
          className="w-full h-48 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-y"
          placeholder={`[\n  {\n    "concept_code": "CU-PD-001",\n    "node_type": "CU-PD",\n    "title": "미분계수의 정의",\n    "description": "...",\n    "keywords": ["미분계수", "극한"],\n    "prerequisites": [],\n    "examples_of_use": ["접선의 기울기"]\n  }\n]`}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleImport}
          disabled={!jsonInput.trim() || status === 'loading'}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {status === 'loading' ? '삽입 중...' : '📥 DB 삽입 (Upsert)'}
        </button>

        {message && (
          <span className={`text-sm font-medium ${status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
