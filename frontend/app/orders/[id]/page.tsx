'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  fetchOrder,
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

  // Tải đơn (lần đầu, khi đổi id, khi bấm thử lại)
  useEffect(() => {
    let cancelled = false;
    fetchOrder(id).then((res) => {
      if (!cancelled) setResult(res);
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
    setReloadKey((k) => k + 1);
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
        <div className="mt-2 flex justify-between border-t border-stone-200 pt-4 text-base font-bold">
          <span>Tổng cộng</span>
          <span className="tabular-nums">{formatVnd(order.total)}</span>
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
