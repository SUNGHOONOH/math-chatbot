import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/schema';

type UserProfilesRow = Database['public']['Tables']['user_profiles']['Row'];

export type UserProfileSetupState = {
  profile: Pick<UserProfilesRow, 'nickname' | 'role' | 'has_consented' | 'grade_level'> | null;
  nickname: string;
  role: string;
  hasConsented: boolean;
  gradeLevel: string;
  isComplete: boolean;
};

export function isUserProfileComplete(
  profile: Pick<UserProfilesRow, 'nickname' | 'has_consented' | 'grade_level'> | null | undefined
) {
  return Boolean(profile?.has_consented && profile.nickname?.trim() && profile.grade_level);
}

export async function isNicknameTaken(
  supabase: SupabaseClient<Database>,
  nickname: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase
    .from('user_profiles')
    .select('id')
    .eq('nickname', nickname)
    .limit(1);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function getAvailableStudentNickname(
  supabase: SupabaseClient<Database>
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `학생_${suffix}`;
    const taken = await isNicknameTaken(supabase, candidate);

    if (!taken) {
      return candidate;
    }
  }

  return `학생_${Date.now().toString().slice(-6)}`;
}

export async function getUserProfileSetupState(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserProfileSetupState> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('nickname, role, has_consented, grade_level')
    .eq('id', userId)
    .maybeSingle();

  return {
    profile,
    nickname: profile?.nickname?.trim() ?? '',
    role: profile?.role ?? 'student',
    hasConsented: profile?.has_consented ?? false,
    gradeLevel: profile?.grade_level ?? '',
    isComplete: isUserProfileComplete(profile),
  };
}
