'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchMyOrders, type ApiResult, type Order } from '../../lib/api';
import { formatDateTime, formatVnd } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import {
  buttonStyles,
  ErrorCard,
  LoadingCard,
  LoginRequiredCard,
} from '../../components/OrderMessages';

/**
 * Lịch sử đơn hàng – gọi GET /orders/me (cần JWT).
 * Đơn mới nhất ở đầu, bấm vào một đơn để mở màn hình xác nhận / chi tiết.
 */
export default function OrderHistoryPage() {
  const [result, setResult] = useState<ApiResult<Order[]> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMyOrders().then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setResult(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] sm:text-[48px]">
            Đơn của tôi
          </h1>
          <p className="mt-3 text-[16px] text-muted">Đơn mới nhất ở trên cùng.</p>
        </div>
        {result?.ok && (
          <button
            type="button"
            onClick={reload}
            className="rounded-full px-3 py-2 text-[15px] font-medium text-leaf transition-colors hover:bg-matcha"
          >
            Làm mới
          </button>
        )}
      </div>

      {result === null && <LoadingCard label="Đang tải lịch sử đơn…" />}

      {result && !result.ok && result.kind === 'unauthenticated' && (
        <LoginRequiredCard
          message={`${result.message} Đăng nhập để xem các đơn đã đặt.`}
          onLoggedIn={reload}
        />
      )}

      {result && !result.ok && result.kind !== 'unauthenticated' && (
        <ErrorCard
          title="Không tải được lịch sử đơn"
          message={result.message}
          onRetry={reload}
        />
      )}

      {result?.ok && result.data.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-paper p-10 text-center">
          <p className="font-display text-[22px] font-bold">Bạn chưa đặt đơn nào</p>
          <p className="mt-2 text-[15px] text-muted">
            Chọn một ly trà hay cà phê để bắt đầu.
          </p>
          <Link href="/" className={`${buttonStyles.primaryBtn} mt-6`}>
            Xem menu
          </Link>
        </div>
      )}

      {result?.ok && result.data.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
          {result.data.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 p-5 transition-colors hover:bg-sage/60 focus-visible:-outline-offset-3 sm:grid-cols-[6rem_1fr_auto] sm:gap-x-6"
              >
                <span className="font-display text-[26px] font-extrabold tabular-nums tracking-tight text-leaf sm:row-span-2 sm:text-[28px]">
                  {order.code}
                </span>
                <span className="justify-self-end sm:order-last sm:row-span-2 sm:flex sm:flex-col sm:items-end sm:gap-2">
                  <StatusBadge status={order.status} />
                  <span className="hidden font-semibold tabular-nums sm:block">{formatVnd(order.total)}</span>
                </span>
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="block truncate text-[15px] font-medium">
                    {order.items.map((i) => `${i.qty}× ${i.productName}`).join(', ')}
                  </span>
                  <span className="mt-1 flex justify-between gap-3 text-[13px] text-muted">
                    <span>{formatDateTime(order.createdAt)}</span>
                    <span className="font-semibold text-ink tabular-nums sm:hidden">{formatVnd(order.total)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
