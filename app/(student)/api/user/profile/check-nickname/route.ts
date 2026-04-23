import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isNicknameTaken } from '@/lib/user-profile';

const nicknameQuerySchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '닉네임을 입력해 주세요.')
    .max(24, '닉네임은 24자 이하로 입력해 주세요.'),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const { nickname } = nicknameQuerySchema.parse({
      nickname: searchParams.get('nickname') ?? '',
    });

    const taken = await isNicknameTaken(supabase, nickname, user.id);

    return NextResponse.json({
      nickname,
      available: !taken,
      message: taken ? '이미 사용중인 닉네임입니다.' : '사용가능한 아이디입니다.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    console.error('[api/user/profile/check-nickname] 닉네임 확인 실패:', err);
    return NextResponse.json({ error: '닉네임 확인에 실패했습니다.' }, { status: 500 });
  }
}
