'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { login, register } from '../../lib/api';
import { safeNextPath, setToken } from '../../lib/auth';
import { SiteHeader } from '../../components/SiteHeader';

type Mode = 'login' | 'register';

const inputClass =
  'mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[16px] outline-none transition-colors placeholder:text-muted/60 focus:border-leaf focus:ring-4 focus:ring-matcha';

/**
 * Đăng nhập / Đăng ký – gọi POST /auth/login, /auth/register (Task 7).
 * Thành công → lưu JWT rồi quay lại trang `?next=` (mặc định là Menu).
 */
function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const fromCheckout = next.includes('view=checkout');

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === 'register') {
      const reg = await register(email, password);
      if (!reg.ok) {
        setBusy(false);
        setError(
          reg.kind === 'conflict'
            ? 'Email này đã được đăng ký. Hãy đăng nhập.'
            : reg.message,
        );
        return;
      }
    }

    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setToken(res.data.accessToken);
    router.push(next);
  }

  const isLogin = mode === 'login';

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-10">
      {/* Chuyển đổi Đăng nhập / Đăng ký */}
      <div className="grid grid-cols-2 rounded-full bg-sage p-1 text-[15px] font-semibold" role="tablist">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-full py-2.5 transition-colors ${
              mode === m ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {m === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        ))}
      </div>

      <h1 className="mt-8 font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
        {isLogin ? 'Chào bạn quay lại' : 'Tạo tài khoản Maycha'}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {fromCheckout
          ? 'Đăng nhập để thanh toán. Giỏ hàng của bạn vẫn được giữ nguyên.'
          : isLogin
            ? 'Đăng nhập để thanh toán và xem lại các đơn đã đặt.'
            : 'Chỉ cần email và mật khẩu từ 8 đến 72 ký tự.'}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block text-[14px] font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="ban@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-[14px] font-medium">
          Mật khẩu
          <input
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            maxLength={72}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder={isLogin ? '' : 'Ít nhất 8 ký tự'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-leaf py-4 text-[16px] font-semibold text-white transition-colors hover:bg-leaf-deep disabled:opacity-60"
        >
          {busy ? 'Đang xử lý…' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản và đăng nhập'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
        {/* useSearchParams cần Suspense khi build production */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
