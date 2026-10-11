'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { createDemoSession, DEMO_ENABLED } from '../lib/api';
import { setToken } from '../lib/auth';

const card =
  'rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm';
const primaryBtn =
  'inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50';

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className={card} role="status" aria-live="polite">
      <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700" />
      <p className="text-sm text-stone-600">{label}</p>
    </div>
  );
}

export function ErrorCard({
  title,
  message,
  onRetry,
  children,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={card} role="alert">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm text-stone-600">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" className={primaryBtn} onClick={onRetry}>
            Thử lại
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Hiện khi chưa đăng nhập / token hết hạn. */
export function LoginRequiredCard({
  message,
  onLoggedIn,
}: {
  message: string;
  onLoggedIn: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function loginWithDemo() {
    setBusy(true);
    setDemoError(null);
    const res = await createDemoSession();
    setBusy(false);
    if (!res.ok) {
      setDemoError(
        res.kind === 'not-found'
          ? 'Backend chưa bật ENABLE_DEMO_SEED=true.'
          : res.message,
      );
      return;
    }
    setToken(res.data.accessToken);
    onLoggedIn();
  }

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-stone-900">Cần đăng nhập</h2>
      <p className="mt-1 text-sm text-stone-600">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/login" className={primaryBtn}>
          Đăng nhập
        </Link>
        {DEMO_ENABLED && (
          <button
            type="button"
            className={secondaryBtn}
            onClick={loginWithDemo}
            disabled={busy}
          >
            {busy ? 'Đang tạo…' : 'Dùng tài khoản demo'}
          </button>
        )}
      </div>
      {demoError && <p className="mt-3 text-sm text-red-700">{demoError}</p>}
    </div>
  );
}

export const buttonStyles = { primaryBtn, secondaryBtn };
