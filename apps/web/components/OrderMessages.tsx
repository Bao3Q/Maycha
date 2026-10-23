'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { createDemoSession, DEMO_ENABLED } from '../lib/api';
import { setToken } from '../lib/auth';

const card = 'rounded-3xl border border-line bg-paper p-8 text-center';
const primaryBtn =
  'inline-flex items-center justify-center rounded-full bg-leaf px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-leaf-deep disabled:opacity-60';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-full border border-line bg-paper px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:border-muted/50 hover:bg-sage disabled:opacity-60';

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className={card} role="status" aria-live="polite">
      <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-leaf" />
      <p className="text-[15px] text-muted">{label}</p>
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
      <h2 className="font-display text-[24px] font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
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
  const pathname = usePathname();
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
      <h2 className="font-display text-[24px] font-bold">Đăng nhập để tiếp tục</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/login?next=${encodeURIComponent(pathname || '/orders')}`}
          className={primaryBtn}
        >
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
      {demoError && <p className="mt-4 text-[14px] text-danger">{demoError}</p>}
    </div>
  );
}

export const buttonStyles = { primaryBtn, secondaryBtn };
