import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Đơn hàng | Maycha',
  description: 'Xác nhận đơn và lịch sử đặt đồ uống tại Maycha',
};

/** Khung chung cho /orders và /orders/[id]. */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </>
  );
}
