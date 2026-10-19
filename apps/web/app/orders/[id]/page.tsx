'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  fetchOrder,
  updateOrderStatus,
  fetchLoyaltyPoints,
  type ApiResult,
  type Order,
  type OrderStatus,
} from '../../../lib/api';
import { describeItem, formatDateTime, formatVnd } from '../../../lib/format';
import { StatusBadge } from '../../../components/StatusBadge';
import {
  buttonStyles,
  ErrorCard,
  LoadingCard,
  LoginRequiredCard,
} from '../../../components/OrderMessages';

/** Khi đơn còn PENDING (đang chờ cổng thanh toán), tự hỏi lại trạng thái. */
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

const HEADLINES: Partial<
  Record<
    OrderStatus,
    { icon: string; title: string; text: string; tone: string }
  >
> = {
  PAID: {
    icon: '✓',
    title: 'Đặt hàng thành công!',
    text: 'Quán đã nhận thanh toán. Đồ uống của bạn sẽ được pha chế ngay.',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  PREPARING: {
    icon: '🍵',
    title: 'Đang pha chế đồ uống',
    text: 'Barista đang chuẩn bị đồ uống theo yêu cầu của bạn.',
    tone: 'bg-sky-100 text-sky-700',
  },
  READY: {
    icon: '🔔',
    title: 'Đồ uống đã sẵn sàng!',
    text: 'Mời bạn tới quầy nhận nước thơm ngon.',
    tone: 'bg-indigo-100 text-indigo-700',
  },
  COMPLETED: {
    icon: '★',
    title: 'Đơn hàng hoàn thành',
    text: 'Cảm ơn bạn đã ghé thăm và thưởng thức đồ uống Maycha!',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  PAYMENT_FAILED: {
    icon: '!',
    title: 'Thanh toán thất bại',
    text: 'Giao dịch không thành công, bạn chưa bị trừ tiền. Vui lòng thử lại.',
    tone: 'bg-red-100 text-red-700',
  },
  PENDING: {
    icon: '…',
    title: 'Đang chờ thanh toán',
    text: 'Đang xác nhận với cổng thanh toán, trang sẽ tự cập nhật.',
    tone: 'bg-amber-100 text-amber-700',
  },
  CANCELLED: {
    icon: '×',
    title: 'Đơn đã bị hủy',
    text: 'Đơn hàng này không còn hiệu lực.',
    tone: 'bg-stone-200 text-stone-600',
  },
};

const DEFAULT_HEADLINE = {
  icon: '☕',
  title: 'Chi tiết đơn hàng',
  text: 'Theo dõi trạng thái đơn của bạn bên dưới.',
  tone: 'bg-sky-100 text-sky-700',
};

/**
 * Màn hình Xác nhận đơn – gọi GET /orders/:id (cần JWT).
 * Task 8: sau khi POST /payments xong, chuyển hướng tới `/orders/<id>`.
 */
export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [result, setResult] = useState<ApiResult<Order> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [polls, setPolls] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Tải đơn và điểm tích lũy
  useEffect(() => {
    let cancelled = false;
    fetchOrder(id).then((res) => {
      if (!cancelled) setResult(res);
    });
    fetchLoyaltyPoints().then((res) => {
      if (!cancelled && res.ok) setLoyaltyPoints(res.data.loyaltyPoints);
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Tự cập nhật khi đơn đang PENDING
  const isPending = result?.ok === true && result.data.status === 'PENDING';
  useEffect(() => {
    if (!isPending || polls >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      fetchOrder(id).then((res) => {
        setResult(res);
        setPolls((n) => n + 1);
      });
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [id, isPending, polls]);

  const reload = () => {
    setResult(null);
    setPolls(0);
    setActionError(null);
    setActionSuccess(null);
    setReloadKey((k) => k + 1);
  };

  const handleStatusChange = async (targetStatus: OrderStatus) => {
    setActionError(null);
    setActionSuccess(null);
    setIsUpdating(true);

    const res = await updateOrderStatus(id, targetStatus);
    setIsUpdating(false);

    if (res.ok) {
      setResult({ ok: true, data: res.data });
      setActionSuccess(`Đã chuyển trạng thái đơn sang "${targetStatus}" thành công!`);
      fetchLoyaltyPoints().then((r) => {
        if (r.ok) setLoyaltyPoints(r.data.loyaltyPoints);
      });
    } else {
      setActionError(`[Backend assertTransition] ${res.message}`);
    }
  };

  if (result === null) {
    return <LoadingCard label="Đang tải đơn hàng…" />;
  }

  if (!result.ok) {
    if (result.kind === 'unauthenticated') {
      return (
        <LoginRequiredCard
          message={`${result.message} Đăng nhập để xem đơn hàng.`}
          onLoggedIn={reload}
        />
      );
    }
    const notFound =
      result.kind === 'not-found' || result.kind === 'bad-request';
    return (
      <ErrorCard
        title={notFound ? 'Không tìm thấy đơn hàng' : 'Không tải được đơn hàng'}
        message={
          notFound
            ? 'Đơn không tồn tại hoặc không thuộc tài khoản của bạn.'
            : result.message
        }
        onRetry={notFound ? undefined : reload}
      >
        <Link href="/orders" className={buttonStyles.secondaryBtn}>
          Xem lịch sử đơn
        </Link>
      </ErrorCard>
    );
  }

  const order = result.data;
  const headline = HEADLINES[order.status] ?? DEFAULT_HEADLINE;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="border-b border-stone-100 p-6 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${headline.tone}`}
          aria-hidden="true"
        >
          {headline.icon}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{headline.title}</h1>
        <p className="mt-1 text-sm text-stone-600">{headline.text}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl bg-stone-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">
              Mã đơn
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">
              {order.code}
            </dd>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">
              Trạng thái
            </dt>
            <dd className="mt-1.5">
              <StatusBadge status={order.status} />
            </dd>
          </div>
        </dl>

        {loyaltyPoints !== null && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            <span className="font-semibold">⭐ Điểm tích lũy Loyalty:</span>
            <span className="font-bold text-sm">{loyaltyPoints} điểm</span>
          </div>
        )}

        <p className="mt-3 text-xs text-stone-500">
          Đặt lúc {formatDateTime(order.createdAt)}
        </p>
      </header>

      <section className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Món đã đặt ({order.itemCount})
        </h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.qty}× {item.productName}
                </p>
                <p className="text-xs text-stone-500">{describeItem(item)}</p>
              </div>
              <span className="shrink-0 tabular-nums">
                {formatVnd(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        {/* Hiển thị Voucher nếu có (Task 10.4) */}
        {order.voucherCode && order.discountAmount && order.discountAmount > 0 ? (
          <div className="mt-4 space-y-1.5 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Tạm tính</span>
              <span>{formatVnd(order.subtotal ?? order.total)}</span>
            </div>
            <div className="flex justify-between font-medium text-emerald-700">
              <span>🎟️ Mã giảm giá ({order.voucherCode})</span>
              <span>-{formatVnd(order.discountAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold">
              <span>Tổng thanh toán</span>
              <span className="tabular-nums">{formatVnd(order.total)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex justify-between border-t border-stone-200 pt-4 text-base font-bold">
            <span>Tổng cộng</span>
            <span className="tabular-nums">{formatVnd(order.total)}</span>
          </div>
        )}
      </section>


      <section className="border-t border-stone-200 bg-stone-50/80 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
            Bảng điều khiển State Machine
          </h3>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
            {order.status}
          </span>
        </div>

        {actionSuccess && (
          <div className="mb-3 rounded-lg bg-emerald-100 p-2.5 text-xs text-emerald-800 font-medium">
            ✅ {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mb-3 rounded-lg bg-red-100 p-2.5 text-xs text-red-800 font-medium">
            ❌ {actionError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {order.status === 'PENDING' && (
            <>
              <button disabled={isUpdating} onClick={() => handleStatusChange('PAID')}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
                ✓ Thanh toán (→ PAID)
              </button>
              <button disabled={isUpdating} onClick={() => handleStatusChange('PAYMENT_FAILED')}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
                ✗ Lỗi thanh toán (→ PAYMENT_FAILED)
              </button>
              <button disabled={isUpdating} onClick={() => handleStatusChange('CANCELLED')}
                className="rounded-lg bg-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-400 disabled:opacity-50">
                Hủy đơn (→ CANCELLED)
              </button>
            </>
          )}

          {order.status === 'PAID' && (
            <>
              <button disabled={isUpdating} onClick={() => handleStatusChange('PREPARING')}
                className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-50">
                🍵 Pha chế (→ PREPARING)
              </button>
              <button disabled={isUpdating} onClick={() => handleStatusChange('CANCELLED')}
                className="rounded-lg bg-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-400 disabled:opacity-50">
                Hủy đơn (→ CANCELLED)
              </button>
            </>
          )}

          {order.status === 'PREPARING' && (
            <button disabled={isUpdating} onClick={() => handleStatusChange('READY')}
              className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50">
              🔔 Pha xong (→ READY)
            </button>
          )}

          {order.status === 'READY' && (
            <button disabled={isUpdating} onClick={() => handleStatusChange('COMPLETED')}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
              ★ Giao khách (→ COMPLETED)
            </button>
          )}

          {order.status === 'PAYMENT_FAILED' && (
            <>
              <button disabled={isUpdating} onClick={() => handleStatusChange('PAID')}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
                Thanh toán lại (→ PAID)
              </button>
              <button disabled={isUpdating} onClick={() => handleStatusChange('CANCELLED')}
                className="rounded-lg bg-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-400 disabled:opacity-50">
                Hủy đơn (→ CANCELLED)
              </button>
            </>
          )}

          {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
            <p className="text-xs text-stone-500 italic">Đơn ở trạng thái kết thúc – không thể chuyển tiếp.</p>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap justify-center gap-3 border-t border-stone-100 bg-stone-50 p-4">
        <Link href="/orders" className={buttonStyles.secondaryBtn}>
          Xem lịch sử đơn
        </Link>
        <Link href="/" className={buttonStyles.primaryBtn}>
          {order.status === 'PAYMENT_FAILED' ? 'Đặt lại' : 'Tiếp tục đặt món'}
        </Link>
      </footer>
    </article>
  );
}
