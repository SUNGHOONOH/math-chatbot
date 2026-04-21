'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { GRADE_LEVEL_OPTIONS, type GradeLevel } from '@/lib/profile-options';

type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken';

interface WelcomeOnboardingFormProps {
  initialNickname: string;
  initialEmail: string;
  initialGradeLevel: string;
  nextPath: string;
}

export function WelcomeOnboardingForm({
  initialNickname,
  initialEmail,
  initialGradeLevel,
  nextPath,
}: WelcomeOnboardingFormProps) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [hasConsented, setHasConsented] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>(
    initialNickname.trim() ? 'available' : 'idle'
  );
  const [nicknameStatusMessage, setNicknameStatusMessage] = useState<string>(
    initialNickname.trim() ? '사용가능한 아이디입니다.' : ''
  );

  const trimmedNickname = useMemo(() => nickname.trim(), [nickname]);
  const canSubmit =
    hasConsented &&
    trimmedNickname.length > 0 &&
    gradeLevel.length > 0 &&
    nicknameStatus === 'available' &&
    !isSaving;

  useEffect(() => {
    if (!trimmedNickname) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setNicknameStatus('checking');
        const response = await fetch(
          `/api/user/profile/check-nickname?nickname=${encodeURIComponent(trimmedNickname)}`,
          {
            method: 'GET',
            signal: controller.signal,
          }
        );
        const payload = await response.json().catch(() => ({}));

        if (!active) return;

        if (!response.ok) {
          setNicknameStatus('idle');
          setNicknameStatusMessage(payload.error || '');
          return;
        }

        setNicknameStatus(payload.available ? 'available' : 'taken');
        setNicknameStatusMessage(payload.message || '');
      } catch (err) {
        if ((err as Error).name === 'AbortError' || !active) {
          return;
        }

        setNicknameStatus('idle');
        setNicknameStatusMessage('');
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedNickname]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLockRef.current || isSaving) {
      return;
    }

    if (!trimmedNickname) {
      setError('이름 또는 닉네임을 입력해 주세요.');
      return;
    }

    if (!gradeLevel) {
      setError('학년을 선택해 주세요.');
      return;
    }

    if (!hasConsented) {
      setError('학습 데이터 활용 동의에 체크해야 계속할 수 있습니다.');
      return;
    }

    if (nicknameStatus !== 'available') {
      setError('사용 가능한 닉네임을 선택해 주세요.');
      return;
    }

    submitLockRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: trimmedNickname,
          hasConsented: true,
          gradeLevel,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || '프로필 저장에 실패했습니다.');
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 저장 중 오류가 발생했습니다.');
      setIsSaving(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="w-full rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] md:p-10">
      <div className="mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Profile Setup
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
          딱 한 번, 학습용 프로필을 완성합니다.
        </h2>
        <p className="text-sm leading-6 text-zinc-500">
          실명도 좋고 닉네임도 괜찮습니다. 이 이름과 학년 정보가 리포트와 학습 히스토리에 연결됩니다.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">이름 또는 닉네임</span>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 focus-within:border-zinc-400 focus-within:bg-white">
            <UserRound size={18} className="text-zinc-400" />
            <input
              value={nickname}
              onChange={(event) => {
                const nextValue = event.target.value;
                setNickname(nextValue);
                if (!nextValue.trim()) {
                  setNicknameStatus('idle');
                  setNicknameStatusMessage('');
                }
                setError(null);
              }}
              maxLength={24}
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              placeholder="예: 민서, mathcat, 김도윤"
            />
          </div>
          <div className="flex min-h-5 items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              로그인 계정: <span className="font-medium text-zinc-700">{initialEmail || '이메일 정보 없음'}</span>
            </p>
            {nicknameStatusMessage ? (
              <p
                className={`text-xs font-medium ${
                  nicknameStatus === 'available'
                    ? 'text-emerald-600'
                    : nicknameStatus === 'taken'
                      ? 'text-red-600'
                      : 'text-zinc-500'
                }`}
              >
                {nicknameStatus === 'checking' ? '닉네임 확인 중...' : nicknameStatusMessage}
              </p>
            ) : null}
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">학년</span>
          <select
            value={gradeLevel}
            onChange={(event) => {
              setGradeLevel(event.target.value as GradeLevel);
              setError(null);
            }}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white"
          >
            <option value="">학년을 선택해 주세요</option>
            {GRADE_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-pressed={hasConsented}
              onClick={() => {
                setHasConsented((value) => !value);
                setError(null);
              }}
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                hasConsented
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-zinc-300 bg-white text-transparent'
              }`}
            >
              <Check size={14} />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                AI 학습 진단 및 리포트 생성을 위한 데이터 활용에 동의합니다.
              </div>
              <p className="text-sm leading-6 text-zinc-600">
                문제 풀이 대화와 세션 리포트는 학습 병목 진단, 요약 리포트, 개인화된 학습 경험 개선에 사용됩니다.
                공개되지 않는 내부 학습 데이터로만 취급되며, 언제든 운영 정책에 따라 조정될 수 있습니다.
              </p>
            </div>
          </div>
        </label>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          학습 공간 시작하기
        </button>
      </form>
    </div>
  );
}
