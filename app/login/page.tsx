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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
