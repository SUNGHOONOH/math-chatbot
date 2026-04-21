// MathLive 커스텀 엘리먼트 타입 선언
// React 19 + Next.js App Router 환경에서 <math-field> JSX를 사용하기 위한 선언입니다.

import type { MathfieldElement } from 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          'virtual-keyboard-mode'?: string;
          'math-virtual-keyboard-policy'?: string;
          value?: string;
        },
        MathfieldElement
      >;
    }
  }
}

export {};
