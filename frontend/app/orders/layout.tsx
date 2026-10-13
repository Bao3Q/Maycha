import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Đơn hàng | Maycha',
  description: 'Xác nhận đơn và lịch sử đặt đồ uống tại Maycha',
};

/** Khung chung cho /orders và /orders/[id]. */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-emerald-800">
            Maycha
          </Link>
          <div className="flex gap-4 text-sm font-medium text-stone-600">
            <Link href="/" className="hover:text-emerald-800">
              Menu
            </Link>
            <Link href="/orders" className="hover:text-emerald-800">
              Đơn của tôi
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
