'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';

export function ReportRegenerateButton({
  sessionId,
  variant = 'default',
}: {
  sessionId: string;
  variant?: 'default' | 'compact';
}) {
  const router = useRouter();
  const regenerateLockRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonClassName = variant === 'compact'
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className={variant === 'compact' ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-2'}>
      <button
        type="button"
        disabled={isRefreshing}
        onClick={async () => {
          if (regenerateLockRef.current || isRefreshing) {
            return;
          }

          regenerateLockRef.current = true;
          setIsRefreshing(true);
          setError(null);

          try {
            const response = await fetch(`/api/sessions/${sessionId}/report`, {
              method: 'POST',
            });

            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload.error || '리포트 재생성에 실패했습니다.');
            }

            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : '리포트 재생성에 실패했습니다.');
            setIsRefreshing(false);
            regenerateLockRef.current = false;
          }
        }}
        className={buttonClassName}
      >
        {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
        {variant === 'compact' ? '재생성' : '다시 생성'}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
