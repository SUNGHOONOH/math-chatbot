import { sanitizeRedirectPath } from '@/lib/auth';
import LoginForm from '@/app/login/_components/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);

  return (
    <div className="app-height safe-top safe-bottom flex items-center justify-center bg-[#f7f8f6] px-4 py-6">
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
