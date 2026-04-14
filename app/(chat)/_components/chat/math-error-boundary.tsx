'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface MathErrorBoundaryProps {
  /** 에러 발생 시 보여줄 원본 텍스트 */
  rawText: string;
  children: ReactNode;
}

interface MathErrorBoundaryState {
  hasError: boolean;
}

/**
 * KaTeX / ReactMarkdown 렌더링 중 수식 문법 오류가 발생해도
 * 앱 전체가 crash되지 않도록 메시지 단위로 감싸는 Error Boundary.
 *
 * 에러 시 원본 텍스트를 fallback으로 표시한다.
 */
export class MathErrorBoundary extends Component<MathErrorBoundaryProps, MathErrorBoundaryState> {
  constructor(props: MathErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MathErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn('[MathErrorBoundary] 수식 렌더링 에러:', error.message, errorInfo.componentStack);
  }

  componentDidUpdate(prevProps: MathErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.rawText !== this.props.rawText) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="space-y-2">
          {/* 에러 알림 */}
          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
            <AlertTriangle size={13} />
            <span>수식 렌더링 중 오류가 발생하여 원본 텍스트를 표시합니다</span>
          </div>
          {/* 원본 텍스트 fallback */}
          <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-zinc-700 bg-amber-50/50 rounded-lg p-3 border border-amber-100">
            {this.props.rawText}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
