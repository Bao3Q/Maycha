'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { login, register } from '../../lib/api';
import { safeNextPath, setToken } from '../../lib/auth';

type Mode = 'login' | 'register';

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

/**
 * Đăng nhập / Đăng ký – gọi POST /auth/login, /auth/register (Task 7).
 * Thành công → lưu JWT rồi quay lại trang `?next=` (mặc định là Menu).
 */
function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));

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
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold">
        {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        {isLogin
          ? 'Đăng nhập để thanh toán và xem lịch sử đơn.'
          : 'Chỉ cần email và mật khẩu (8–72 ký tự).'}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate={false}>
        <label className="block text-sm font-medium text-stone-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Mật khẩu
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-emerald-700 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? 'Đang xử lý…' : isLogin ? 'Đăng nhập' : 'Đăng ký & đăng nhập'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-600">
        {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? 'register' : 'login');
            setError(null);
          }}
          className="font-semibold text-emerald-800 hover:underline"
        >
          {isLogin ? 'Đăng ký' : 'Đăng nhập'}
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-emerald-800">
            Maycha
          </Link>
          <Link href="/" className="text-sm font-medium text-stone-600 hover:text-emerald-800">
            Menu
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-md px-4 py-10">
        {/* useSearchParams cần Suspense khi build production */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
