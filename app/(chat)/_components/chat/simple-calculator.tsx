'use client';

// ============================================================
// AHA v5 — SimpleCalculator
// ============================================================
// 학생이 풀이 과정 중 검산용으로 쓰는 독립 계산기.
// 계산 결과는 채팅에 반영되지 않습니다 (의도된 설계).
// ============================================================

import { useState } from 'react';
import { X, Delete } from 'lucide-react';

interface SimpleCalculatorProps {
  onClose: () => void;
}

type CalcState = {
  display: string;     // 현재 화면 숫자
  prev: string;        // 이전 피연산자
  operator: string;    // 대기 중인 연산자
  waitingForNext: boolean; // 연산자 눌린 직후 상태
};

const INITIAL: CalcState = {
  display: '0',
  prev: '',
  operator: '',
  waitingForNext: false,
};

function evaluate(a: string, b: string, op: string): string {
  const x = parseFloat(a);
  const y = parseFloat(b);
  let result: number;
  switch (op) {
    case '+': result = x + y; break;
    case '−': result = x - y; break;
    case '×': result = x * y; break;
    case '÷':
      if (y === 0) return '오류';
      result = x / y;
      break;
    default: return b;
  }
  // 부동소수점 오류 방지: 소수 12자리 이상 반올림
  const rounded = parseFloat(result.toPrecision(12));
  return String(rounded);
}

export function SimpleCalculator({ onClose }: SimpleCalculatorProps) {
  const [state, setState] = useState<CalcState>(INITIAL);

  const pushDigit = (digit: string) => {
    setState((s) => {
      if (s.waitingForNext) {
        return { ...s, display: digit === '.' ? '0.' : digit, waitingForNext: false };
      }
      if (digit === '.' && s.display.includes('.')) return s;
      const newDisplay = s.display === '0' && digit !== '.' ? digit : s.display + digit;
      return { ...s, display: newDisplay };
    });
  };

  const pushOperator = (op: string) => {
    setState((s) => {
      if (s.operator && !s.waitingForNext) {
        const result = evaluate(s.prev, s.display, s.operator);
        return { display: result, prev: result, operator: op, waitingForNext: true };
      }
      return { ...s, prev: s.display, operator: op, waitingForNext: true };
    });
  };

  const pressEquals = () => {
    setState((s) => {
      if (!s.operator || !s.prev) return s;
      const result = evaluate(s.prev, s.display, s.operator);
      return { display: result, prev: '', operator: '', waitingForNext: true };
    });
  };

  const pressPercent = () => {
    setState((s) => {
      const val = parseFloat(s.display) / 100;
      return { ...s, display: String(val) };
    });
  };

  const pressToggleSign = () => {
    setState((s) => {
      const val = parseFloat(s.display) * -1;
      return { ...s, display: String(val) };
    });
  };

  const pressBackspace = () => {
    setState((s) => {
      if (s.display.length === 1 || s.display === '오류') {
        return { ...s, display: '0' };
      }
      return { ...s, display: s.display.slice(0, -1) };
    });
  };

  const pressAllClear = () => setState(INITIAL);

  // 버튼 레이아웃 정의
  type ButtonDef = {
    label: string;
    wide?: boolean;
    variant: 'fn' | 'op' | 'num' | 'eq';
    action: () => void;
  };

  const buttons: ButtonDef[] = [
    { label: 'AC', variant: 'fn', action: pressAllClear },
    { label: '+/−', variant: 'fn', action: pressToggleSign },
    { label: '%', variant: 'fn', action: pressPercent },
    { label: '÷', variant: 'op', action: () => pushOperator('÷') },

    { label: '7', variant: 'num', action: () => pushDigit('7') },
    { label: '8', variant: 'num', action: () => pushDigit('8') },
    { label: '9', variant: 'num', action: () => pushDigit('9') },
    { label: '×', variant: 'op', action: () => pushOperator('×') },

    { label: '4', variant: 'num', action: () => pushDigit('4') },
    { label: '5', variant: 'num', action: () => pushDigit('5') },
    { label: '6', variant: 'num', action: () => pushDigit('6') },
    { label: '−', variant: 'op', action: () => pushOperator('−') },

    { label: '1', variant: 'num', action: () => pushDigit('1') },
    { label: '2', variant: 'num', action: () => pushDigit('2') },
    { label: '3', variant: 'num', action: () => pushDigit('3') },
    { label: '+', variant: 'op', action: () => pushOperator('+') },

    { label: '0', variant: 'num', wide: true, action: () => pushDigit('0') },
    { label: '.', variant: 'num', action: () => pushDigit('.') },
    { label: '=', variant: 'eq', action: pressEquals },
  ];

  const variantClass: Record<string, string> = {
    fn: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300',
    op: 'bg-emerald-500 text-white hover:bg-emerald-400',
    num: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200',
    eq: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };

  return (
    <div className="bg-white border-t border-zinc-100 animate-in slide-in-from-bottom-2 duration-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🔢</span>
          <span className="text-xs font-semibold text-zinc-500">계산기</span>
          <span className="text-[10px] text-zinc-300">· 검산 전용, 채팅에 반영되지 않아요</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-400 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-4 pt-3 pb-4 max-w-xs mx-auto">
        {/* 디스플레이 */}
        <div className="bg-zinc-900 rounded-xl px-4 py-3 mb-3 flex items-end justify-between">
          <span className="text-zinc-500 text-xs font-mono min-h-[16px]">
            {state.operator ? `${state.prev} ${state.operator}` : ''}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="text-white font-light text-right overflow-hidden"
              style={{
                fontSize: state.display.length > 9 ? '18px' : '28px',
                maxWidth: '200px',
                wordBreak: 'break-all',
              }}
            >
              {state.display}
            </span>
            {state.display !== '0' && !state.waitingForNext && (
              <button
                onClick={pressBackspace}
                className="text-zinc-400 hover:text-zinc-200 transition-colors ml-1"
              >
                <Delete size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 버튼 그리드 */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className={[
                'rounded-xl py-4 text-base font-semibold transition-colors active:scale-95',
                btn.wide ? 'col-span-2 text-left pl-6' : '',
                variantClass[btn.variant],
              ].join(' ')}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
