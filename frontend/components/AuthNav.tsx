'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { clearToken, getToken, subscribeToken } from '../lib/auth';

/** Đọc trạng thái đăng nhập, an toàn khi render phía server (luôn "chưa đăng nhập"). */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(
    subscribeToken,
    () => getToken() !== null,
    () => false,
  );
}

/**
 * Đăng nhập / Đăng xuất (+ "Đơn của tôi" trên mobile, nơi thanh menu chính bị ẩn).
 */
export function AuthNav({ className = '' }: { className?: string }) {
  const loggedIn = useIsLoggedIn();
  const pathname = usePathname();

  const linkClass = 'whitespace-nowrap rounded-full px-2 py-2 text-muted transition-colors hover:text-ink sm:px-3';

  return (
    <div className={`flex items-center gap-1 font-medium ${className}`}>
      <Link href="/orders" className={`${linkClass} sm:hidden`}>
        Đơn
      </Link>
      {loggedIn ? (
        <button type="button" onClick={clearToken} className={linkClass}>
          Đăng xuất
        </button>
      ) : (
        pathname !== '/login' && (
          <Link
            href={`/login?next=${encodeURIComponent(pathname || '/')}`}
            className={linkClass}
          >
            Đăng nhập
          </Link>
        )
      )}
    </div>
  );
}
