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
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lịch sử đơn hàng</h1>
          <p className="mt-1 text-sm text-stone-600">
            Các đơn bạn đã đặt, mới nhất ở trên cùng.
          </p>
        </div>
        {result?.ok && (
          <button
            type="button"
            onClick={reload}
            className="text-sm font-medium text-emerald-800 hover:underline"
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
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="font-medium">Bạn chưa có đơn nào.</p>
          <p className="mt-1 text-sm text-stone-600">
            Chọn một ly trà sữa hay cà phê để bắt đầu nhé.
          </p>
          <Link href="/" className={`${buttonStyles.primaryBtn} mt-5`}>
            Xem menu
          </Link>
        </div>
      )}

      {result?.ok && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-emerald-600 hover:shadow focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">Đơn {order.code}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-3 truncate text-sm text-stone-600">
                  {order.items
                    .map((i) => `${i.qty}× ${i.productName}`)
                    .join(', ')}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-stone-500">{order.itemCount} món</span>
                  <span className="font-semibold">
                    {formatVnd(order.total)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
