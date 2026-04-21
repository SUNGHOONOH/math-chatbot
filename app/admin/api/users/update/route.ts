import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/auth';

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. 요청자가 관리자인지 확인
    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId, newRole, newNickname } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 2. user_profiles 정보 업데이트
    let updatePayload: any = {};
    if (newRole) updatePayload.role = newRole;
    if (newNickname) updatePayload.nickname = newNickname;

    if (Object.keys(updatePayload).length > 0) {
      const { error: profileError } = await admin
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', targetUserId);

      if (profileError) throw profileError;
    }

    // 3. (중요) 역할(role)이 변경되었다면 auth.users의 app_metadata도 동기화
    // 이러면 isUserAdmin() 등 세션/미들웨어 레벨의 권한 체크가 즉시 반영됨
    if (newRole) {
      const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
        app_metadata: { role: newRole }
      });
      if (authError) throw authError;
    }

    return NextResponse.json({ success: true, message: '사용자 정보가 성공적으로 수정되었습니다.' });

  } catch (err: any) {
    console.error('[AdminAPI] User Update Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
