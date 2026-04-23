import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isNicknameTaken } from '@/lib/user-profile';
import { GRADE_LEVEL_VALUES } from '@/lib/profile-options';

const updateProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '닉네임을 입력해 주세요.')
    .max(24, '닉네임은 24자 이하로 입력해 주세요.'),
  hasConsented: z.boolean().optional(),
  gradeLevel: z.enum(GRADE_LEVEL_VALUES).optional(),
});

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nickname, hasConsented, gradeLevel } = updateProfileSchema.parse(body);

    const duplicate = await isNicknameTaken(supabase, nickname, user.id);
    if (duplicate) {
      return NextResponse.json({ error: '이미 사용중인 닉네임입니다.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          nickname,
          has_consented: hasConsented,
          grade_level: gradeLevel,
        },
        { onConflict: 'id' }
      )
      .select('id, nickname, has_consented, grade_level')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? '입력값이 올바르지 않습니다.' }, { status: 400 });
    }

    console.error('[api/user/profile] 프로필 업데이트 실패:', err);
    return NextResponse.json({ error: '프로필 업데이트에 실패했습니다.' }, { status: 500 });
  }
}
