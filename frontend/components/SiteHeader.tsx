'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cartCount, cartTotal, useCart } from '../lib/cart';
import { formatVnd } from '../lib/format';
import { AuthNav } from './AuthNav';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-leaf" aria-label="Maycha – về Menu">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="currentColor" />
        <path d="M9 21c0-7 5-11 14-12-1 8-5 13-12 13" fill="#e3ecd5" />
        <path d="M11 22c3-4 6-7 10-10" stroke="#2d5a3a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      <span className="font-display text-[22px] font-extrabold tracking-tight">Maycha</span>
    </Link>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" strokeLinejoin="round" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Thanh điều hướng chung. Ở trang Menu truyền `onCartClick` để mở giỏ
 * ngay trong trang; ở trang khác nút giỏ là link về `/?view=cart`.
 */
export function SiteHeader({ onCartClick }: { onCartClick?: () => void }) {
  const { cart } = useCart();
  const pathname = usePathname();
  const count = cartCount(cart);
  const total = cartTotal(cart);

  const cartInner = (
    <>
      <CartIcon />
      <span className="hidden sm:inline">Giỏ hàng</span>
      <span
        key={count}
        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px] font-bold tabular-nums ${
          count > 0 ? 'animate-bump bg-sugar text-white' : 'bg-white/20 text-white/80'
        }`}
      >
        {count}
      </span>
      {count > 0 && (
        <span className="hidden border-l border-white/25 pl-3 tabular-nums md:inline">{formatVnd(total)}</span>
      )}
    </>
  );
  const cartClass =
    'flex items-center gap-2.5 rounded-full bg-leaf px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-leaf-deep';

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      aria-current={pathname === href ? 'page' : undefined}
      className="rounded-full px-3 py-2 text-muted transition-colors hover:text-ink aria-[current=page]:bg-white aria-[current=page]:text-ink"
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-sage/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 text-[15px] font-medium sm:flex" aria-label="Chính">
            {navLink('/', 'Menu')}
            {navLink('/orders', 'Đơn của tôi')}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <AuthNav className="text-[15px]" />
          {onCartClick ? (
            <button type="button" onClick={onCartClick} className={cartClass} aria-label={`Giỏ hàng, ${count} món`}>
              {cartInner}
            </button>
          ) : (
            <Link href="/?view=cart" className={cartClass} aria-label={`Giỏ hàng, ${count} món`}>
              {cartInner}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
