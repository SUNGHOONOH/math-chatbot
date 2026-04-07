'use client';

import { useState } from 'react';

export default function EmbeddingGenerator() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{
    total?: number;
    generated?: number;
    failed?: number;
    message?: string;
    errors?: string[];
  } | null>(null);

  const handleGenerate = async () => {
    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/admin/api/generate-embeddings', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setResult({ message: data.error || '서버 오류' });
        return;
      }

      setStatus('success');
      setResult(data);
    } catch {
      setStatus('error');
      setResult({ message: '네트워크 오류가 발생했습니다.' });
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            생성 중...
          </>
        ) : (
          '🧠 미생성 임베딩 일괄 생성'
        )}
      </button>

      {result && status === 'success' && (
        <span className="text-sm font-medium text-emerald-600">
          ✅ {result.generated}/{result.total}개 생성 완료
          {result.failed ? ` (${result.failed}개 실패)` : ''}
          {result.generated === 0 && result.message ? ` — ${result.message}` : ''}
        </span>
      )}

      {result && status === 'error' && (
        <span className="text-sm font-medium text-red-600">
          ❌ {result.message}
        </span>
      )}
    </div>
  );
}
