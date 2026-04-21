'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mail, PencilLine, Save, ShieldCheck, UserRound } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { GRADE_LEVEL_OPTIONS, getGradeLabel, type GradeLevel } from '@/lib/profile-options';

type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken';

interface ProfileFormProps {
  initialNickname: string;
  initialEmail: string;
  initialRole: string;
  initialGradeLevel: string;
}

export function ProfileForm({
  initialNickname,
  initialEmail,
  initialRole,
  initialGradeLevel,
}: ProfileFormProps) {
  const submitLockRef = useRef(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>(
    initialNickname.trim() ? 'available' : 'idle'
  );
  const [nicknameStatusMessage, setNicknameStatusMessage] = useState<string>(
    initialNickname.trim() ? '사용가능한 아이디입니다.' : ''
  );

  const trimmedNickname = useMemo(() => nickname.trim(), [nickname]);
  const canSubmit =
    trimmedNickname.length > 0 &&
    gradeLevel.length > 0 &&
    nicknameStatus === 'available' &&
    !isSaving;

  useEffect(() => {
    let active = true;

    startTransition(() => {
      void supabaseBrowser.auth.getUser().then(({ data }) => {
        if (!active) return;
        if (data.user?.email) {
          setEmail(data.user.email);
        }
      });
    });

    return () => {
      active = false;
    };
  }, []);

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
      setError('닉네임을 입력해 주세요.');
      setSuccess(null);
      return;
    }

    if (!gradeLevel) {
      setError('학년을 선택해 주세요.');
      setSuccess(null);
      return;
    }

    if (nicknameStatus !== 'available') {
      setError('사용 가능한 닉네임을 선택해 주세요.');
      setSuccess(null);
      return;
    }

    submitLockRef.current = true;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmedNickname, gradeLevel }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || '프로필 저장에 실패했습니다.');
      }

      setNickname(payload.profile?.nickname ?? trimmedNickname);
      setGradeLevel(payload.profile?.grade_level ?? gradeLevel);
      setSuccess('프로필이 저장되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 저장 중 오류가 발생했습니다.');
    } finally {
      submitLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <PencilLine size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">프로필 수정</h2>
            <p className="text-sm text-zinc-500">닉네임과 학년을 바꾸면 학습 공간 전반에 바로 반영됩니다.</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">닉네임</span>
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
                  setSuccess(null);
                }}
                maxLength={24}
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder="사용할 닉네임을 입력하세요"
              />
            </div>
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
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">학년</span>
            <select
              value={gradeLevel}
              onChange={(event) => {
                setGradeLevel(event.target.value as GradeLevel);
                setError(null);
                setSuccess(null);
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

          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-zinc-400" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">이메일</p>
                <p className="text-sm text-zinc-700">{email || '이메일 정보 없음'}</p>
              </div>
            </div>
            <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-500">
              읽기 전용
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            저장하기
          </button>
        </form>
      </section>

      <aside className="rounded-3xl border border-zinc-200 bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-6 text-white shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">계정 정보</h2>
            <p className="text-sm text-zinc-300">현재 로그인한 계정의 기본 정보입니다.</p>
          </div>
        </div>

        <dl className="space-y-4">
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <dt className="text-xs uppercase tracking-[0.18em] text-zinc-400">현재 닉네임</dt>
            <dd className="mt-2 text-base font-medium text-white">{nickname || '닉네임 없음'}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <dt className="text-xs uppercase tracking-[0.18em] text-zinc-400">학년</dt>
            <dd className="mt-2 text-sm font-medium text-zinc-100">{getGradeLabel(gradeLevel)}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <dt className="text-xs uppercase tracking-[0.18em] text-zinc-400">이메일</dt>
            <dd className="mt-2 break-all text-sm text-zinc-200">{email || '이메일 정보 없음'}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <dt className="text-xs uppercase tracking-[0.18em] text-zinc-400">역할</dt>
            <dd className="mt-2 text-sm font-medium text-zinc-100">{initialRole || 'student'}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
