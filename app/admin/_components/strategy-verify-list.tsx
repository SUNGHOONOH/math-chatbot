'use client';

import { useState, useOptimistic, useTransition } from 'react';

interface StrategyItem {
  problem_hash: string;
  is_human_verified: boolean;
  required_concepts: string[];
  base_difficulty: number;
  created_at: string;
}

export default function StrategyVerifyList({
  initialData,
}: {
  initialData: StrategyItem[];
}) {
  const [items, setItems] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (problemHash: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // 낙관적 업데이트
    setItems((prev) =>
      prev.map((item) =>
        item.problem_hash === problemHash
          ? { ...item, is_human_verified: newValue }
          : item
      )
    );

    const res = await fetch('/admin/api/strategy-verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemHash, isHumanVerified: newValue }),
    });

    if (!res.ok) {
      // 실패 시 롤백
      setItems((prev) =>
        prev.map((item) =>
          item.problem_hash === problemHash
            ? { ...item, is_human_verified: currentValue }
            : item
        )
      );
      alert('업데이트 실패');
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500">
        아직 등록된 문제가 없습니다.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {/* 헤더 */}
      <div className="grid grid-cols-[1fr_120px_100px_80px] gap-4 px-6 py-3 bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        <span>문제 해시</span>
        <span>개념 노드 수</span>
        <span>난이도</span>
        <span className="text-center">검증됨</span>
      </div>

      {items.map((item) => (
        <div
          key={item.problem_hash}
          className="grid grid-cols-[1fr_120px_100px_80px] gap-4 px-6 py-4 items-center hover:bg-zinc-50 transition-colors"
        >
          {/* 해시 (앞 12자리) */}
          <div>
            <code className="text-xs font-mono text-zinc-700 bg-zinc-100 px-2 py-1 rounded">
              {item.problem_hash.slice(0, 12)}…
            </code>
            {item.required_concepts.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.required_concepts.slice(0, 3).map((c) => (
                  <span key={c} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    {c}
                  </span>
                ))}
                {item.required_concepts.length > 3 && (
                  <span className="text-[10px] text-zinc-400">
                    +{item.required_concepts.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 개념 노드 수 */}
          <span className="text-sm text-zinc-600 font-medium">
            {item.required_concepts.length}개
          </span>

          {/* 난이도 */}
          <span className="text-sm text-zinc-600">
            {'⭐'.repeat(item.base_difficulty)}
          </span>

          {/* 검증 토글 */}
          <div className="flex justify-center">
            <button
              onClick={() => handleToggle(item.problem_hash, item.is_human_verified)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                item.is_human_verified
                  ? 'bg-emerald-500'
                  : 'bg-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  item.is_human_verified ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
