import { redirect } from 'next/navigation';
import { UserCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath } from '@/lib/auth';
import { ProfileForm } from './_components/profile-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath('/profile'));
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('nickname, role, grade_level')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-500">
          <UserCircle2 size={14} />
          Profile Settings
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">내 프로필</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500">
          학습 공간에서 사용할 닉네임을 관리합니다. 저장한 닉네임은 대시보드와 학생 전용 공간에 반영됩니다.
        </p>
      </header>

      <ProfileForm
        initialNickname={profile?.nickname ?? ''}
        initialEmail={user.email ?? ''}
        initialRole={profile?.role ?? 'student'}
        initialGradeLevel={profile?.grade_level ?? ''}
      />
    </div>
  );
}
