import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminShell from '@/app/admin/_components/admin-shell';
import { isUserAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = isUserAdmin(user);
  
  // 디버깅 메시지 (터미널에서 확인 가능)
  console.log('[AdminGate] ➔', {
    userEmail: user?.email,
    adminEmailEnv: process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    isAdminResult: isAdmin,
    role: user?.app_metadata?.role,
  });

  if (!isAdmin) {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}
