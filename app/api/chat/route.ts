// ============================================================
// AHA v5 — Part 1: 실시간 소크라틱 대화 API Route
// ============================================================
// 프론트에서 이미지를 Supabase Storage에 업로드한 뒤
// 공개 URL을 텍스트에 포함시켜 보냅니다.
// 서버는 URL을 파싱하여 VLM에 이미지로 전달하고,
// AI 응답이 끝나면 Storage에서 이미지를 즉시 삭제합니다.
// ============================================================

import { streamText, UIMessage } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import { VISION_MODEL } from '@/lib/ai/models';
import { socraticTutorPrompt, fullSolutionPrompt } from '@/lib/ai/prompts';
import { onSessionEnd } from '@/lib/ai/session-end';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// Supabase Storage URL에서 파일 경로 추출
function extractStoragePaths(messages: any[]): string[] {
  const paths: string[] = [];
  const regex = /\/storage\/v1\/object\/public\/chat-images\/([^\s)]+)/g;

  for (const m of messages) {
    const text = m.parts
      ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      : typeof m.content === 'string' ? m.content : '';

    let match;
    while ((match = regex.exec(text)) !== null) {
      paths.push(match[1]);
    }
  }
  return paths;
}

// 텍스트에서 이미지 URL 추출
function extractImageUrls(text: string): string[] {
  const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// UI 메시지 → streamText 형식으로 변환
// 이미지 URL이 포함된 경우 VLM이 이해하는 image content로 변환
function convertMessages(messages: UIMessage[]) {
  return messages.map((m: any) => {
    const rawText = m.parts
      ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      : typeof m.content === 'string' ? m.content : '';

    const imageUrls = extractImageUrls(rawText);

    // 이미지가 없으면 순수 텍스트 메시지
    if (imageUrls.length === 0) {
      // [첨부...] 라벨 제거
      const cleanText = rawText
        .replace(/\[첨부된 수학 문제 이미지\]\n?/g, '')
        .trim();
      return { role: m.role, content: cleanText || rawText };
    }

    // 이미지가 있으면 멀티모달 content 배열 구성
    const content: any[] = [];

    // 이미지 parts 추가
    for (const url of imageUrls) {
      content.push({ type: 'image' as const, image: new URL(url) });
    }

    // 이미지 마크다운과 라벨을 제거한 순수 텍스트
    const cleanText = rawText
      .replace(/\[첨부된 수학 문제 이미지\]\n?/g, '')
      .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)\n*/g, '')
      .trim();

    if (cleanText) {
      content.push({ type: 'text' as const, text: cleanText });
    } else {
      content.push({ type: 'text' as const, text: '이 수학 문제를 분석해 주세요.' });
    }

    return { role: m.role, content };
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, sessionId = `session-${Date.now()}` } = body;

  // Supabase Auth 세션에서 실제 유저의 아이디를 가져옵니다.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const studentId = user?.id || 'anonymous';

  // "전체 풀이 보기" (포기) 특수 메시지가 맨 마지막에 있는지 확인
  const lastMessage = messages[messages.length - 1];
  const isShowFullSolution =
    lastMessage?.role === 'user' &&
    typeof lastMessage?.content === 'string' &&
    lastMessage.content.includes('[SYSTEM:SHOW_FULL_SOLUTION]');

  // Storage에서 나중에 삭제할 이미지 경로 추출
  const imagePaths = extractStoragePaths(messages);

  const modelMessages = convertMessages(messages);

  const result = streamText({
    model: huggingface(VISION_MODEL),
    system: isShowFullSolution ? fullSolutionPrompt : socraticTutorPrompt,
    messages: modelMessages as any,
    onFinish: async ({ text }) => {
      // 1. Storage 이미지 즉시 삭제 (AI가 이미 읽었으므로 더 이상 필요 없음)
      if (imagePaths.length > 0) {
        try {
          const supabaseAdmin = getSupabaseAdmin();
          await supabaseAdmin.storage.from('chat-images').remove(imagePaths);
          console.log('[chat/route] Storage 이미지 삭제 완료:', imagePaths);
        } catch (err) {
          console.error('[chat/route] Storage 이미지 삭제 실패:', err);
        }
      }

      // 2. Part 2: onSessionEnd — 대화 데이터 파싱 & DB 저장
      const fullMessages = messages.map((m: any) => {
        const msgText = m.parts
          ? m.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('')
          : typeof m.content === 'string'
            ? m.content
            : '';
        return { role: m.role, content: msgText };
      });
      fullMessages.push({ role: 'assistant', content: text });

      onSessionEnd({ sessionId, studentId, messages: fullMessages }).catch((err: any) => {
        console.error('[chat/route] onSessionEnd 실패:', err);
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
