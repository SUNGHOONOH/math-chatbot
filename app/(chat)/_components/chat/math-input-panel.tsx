'use client';

// ============================================================
// AHA v5 — MathInputPanel (수식 입력 전용, 계산 없음)
// ============================================================
// 학생이 자신의 식을 표현하고 채팅에 삽입하는 보조 도구.
// 계산/정답 기능은 의도적으로 제외합니다.
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { X, ChevronRight, FlaskConical } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathInputPanelProps {
  latex: string;
  onChange: (latex: string) => void;
  onInsert: () => void;
  onClose: () => void;
}

function renderPreview(latex: string): string {
  if (!latex.trim()) return '';
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      trust: false,
    });
  } catch {
    return '';
  }
}

function removeHangul(value: string): string {
  return value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
}

export function MathInputPanel({ latex, onChange, onInsert, onClose }: MathInputPanelProps) {
  const mathFieldRef = useRef<(HTMLElement & { value: string }) | null>(null);

  const showMathKeyboard = useCallback(() => {
    mathFieldRef.current?.focus();
    window.mathVirtualKeyboard?.show?.();
    window.setTimeout(() => {
      mathFieldRef.current?.focus();
      window.mathVirtualKeyboard?.show?.();
    }, 0);
    window.setTimeout(() => {
      mathFieldRef.current?.focus();
      window.mathVirtualKeyboard?.show?.();
    }, 180);
  }, []);

  // MathLive SSR 안전 로드
  useEffect(() => {
    import('mathlive')
      .then(() => showMathKeyboard())
      .catch(() => {});
  }, [showMathKeyboard]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      mathFieldRef.current?.focus();
      showMathKeyboard();
    }, 160);

    return () => window.clearTimeout(timer);
  }, []);

  // math-field ref 연결 + 이벤트 바인딩
  const setupMathField = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      mathFieldRef.current = el as HTMLElement & { value: string };
      el.addEventListener('beforeinput', (e: Event) => {
        const inputEvent = e as InputEvent;
        if (inputEvent.data && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(inputEvent.data)) {
          e.preventDefault();
        }
      });
      el.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLElement & { value: string };
        const cleaned = removeHangul(target.value ?? '');
        if (cleaned !== target.value) {
          target.value = cleaned;
        }
        onChange(cleaned);
      });
    },
    [onChange]
  );

  const previewHtml = renderPreview(latex);

  return (
    <div className="bg-white border-t border-zinc-100 animate-in slide-in-from-bottom-2 duration-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-emerald-500" />
          <span className="text-xs font-semibold text-zinc-500">수식 입력</span>
          <span className="text-[10px] text-zinc-300">· 내가 세운 식을 적어요</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-400 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* MathLive 입력 */}
        <div>
          {/* @ts-expect-error — MathLive web component (types/mathlive.d.ts) */}
          <math-field
            ref={setupMathField}
            virtual-keyboard-mode="onfocus"
            math-virtual-keyboard-policy="manual"
            virtualKeyboardMode="manual"
            mathVirtualKeyboardPolicy="manual"
            onFocus={showMathKeyboard}
            onPointerDown={showMathKeyboard}
            onClick={showMathKeyboard}
            style={{
              width: '100%',
              border: '1.5px solid #e4e4e7',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '18px',
              minHeight: '50px',
            }}
          />
          <p className="text-[10px] text-zinc-400 mt-1.5 pl-1">
            수식만 입력해 주세요. 한글 설명은 아래 채팅 입력창에 적어주세요.
          </p>
        </div>

        {/* KaTeX 미리보기 */}
        {previewHtml && (
          <div
            className="py-3 px-4 bg-zinc-50 rounded-xl overflow-x-auto text-center min-h-[48px] flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>

      {/* 삽입 버튼 */}
      <div className="px-4 pb-4">
        <button
          onClick={onInsert}
          disabled={!latex.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          채팅에 수식 넣기
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
