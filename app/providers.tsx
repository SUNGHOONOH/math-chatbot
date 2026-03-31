'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key) {
      console.log('[PostHog] API Key가 없어 비활성화됩니다.');
      return;
    }

    posthog.init(key, {
      api_host: host || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      loaded: () => {
        console.log('[PostHog] 초기화 완료');
      },
    });
  }, []);

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
