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

/** Link "Đơn của tôi" + Đăng nhập / Đăng xuất, dùng chung ở mọi trang. */
export function AuthNav({ className = '' }: { className?: string }) {
  const loggedIn = useIsLoggedIn();
  const pathname = usePathname();

  return (
    <div className={`flex items-center gap-4 text-sm font-medium ${className}`}>
      <Link href="/orders" className="hover:text-emerald-800">
        Đơn của tôi
      </Link>
      {loggedIn ? (
        <button
          type="button"
          onClick={clearToken}
          className="hover:text-emerald-800"
        >
          Đăng xuất
        </button>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(pathname || '/')}`}
          className="hover:text-emerald-800"
        >
          Đăng nhập
        </Link>
      )}
    </div>
  );
}
