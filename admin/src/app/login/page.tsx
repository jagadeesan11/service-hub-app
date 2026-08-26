import { Suspense } from 'react';

import { LoginForm } from '@/components/login-form';
import { NexoraMark } from '@/components/nexora-mark';

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <NexoraMark className="size-10 text-foreground" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Nexora Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your catalogue and bookings.
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
