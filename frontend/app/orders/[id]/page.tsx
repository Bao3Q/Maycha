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

type Headline = { title: string; text: string; tone: string; icon: 'check' | 'alert' | 'clock' | 'x' | 'cup' };

const HEADLINES: Partial<Record<OrderStatus, Headline>> = {
  PAID: {
    icon: 'check',
    title: 'Đặt hàng thành công',
    text: 'Quán đã nhận thanh toán và bắt đầu pha. Đọc mã đơn này tại quầy để nhận đồ uống.',
    tone: 'bg-leaf text-white',
  },
  PAYMENT_FAILED: {
    icon: 'alert',
    title: 'Thanh toán chưa thành công',
    text: 'Giao dịch bị từ chối và bạn chưa bị trừ tiền. Giỏ hàng vẫn được giữ, bạn có thể thanh toán lại.',
    tone: 'bg-danger text-white',
  },
  PENDING: {
    icon: 'clock',
    title: 'Đang chờ xác nhận thanh toán',
    text: 'Cổng thanh toán đang xử lý. Trang này tự cập nhật, bạn không cần tải lại.',
    tone: 'bg-sugar text-white',
  },
  CANCELLED: {
    icon: 'x',
    title: 'Đơn đã bị huỷ',
    text: 'Đơn này không còn hiệu lực.',
    tone: 'bg-muted text-white',
  },
};

const DEFAULT_HEADLINE: Headline = {
  icon: 'cup',
  title: 'Chi tiết đơn hàng',
  text: 'Theo dõi trạng thái đơn của bạn bên dưới.',
  tone: 'bg-leaf text-white',
};

function HeadlineIcon({ icon }: { icon: Headline['icon'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" {...common}>
      {icon === 'check' && <path d="M5 12.5 10 17.5 19 7" />}
      {icon === 'alert' && <path d="M12 6v7M12 17.5v.5" />}
      {icon === 'clock' && <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>}
      {icon === 'x' && <path d="M7 7l10 10M17 7 7 17" />}
      {icon === 'cup' && <path d="M6 8h12l-1.5 11a2 2 0 0 1-2 1.7h-5a2 2 0 0 1-2-1.7L6 8ZM9 8V5h6v3" />}
    </svg>
  );
}

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
          Xem đơn của tôi
        </Link>
      </ErrorCard>
    );
  }

  const order = result.data;
  const headline = HEADLINES[order.status] ?? DEFAULT_HEADLINE;
  const failed = order.status === 'PAYMENT_FAILED';

  return (
    <>
      <div className="mb-8 flex items-start gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${headline.tone} ${
            isPending ? 'animate-pulse' : ''
          }`}
        >
          <HeadlineIcon icon={headline.icon} />
        </span>
        <div>
          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]">
            {headline.title}
          </h1>
          <p className="mt-2 max-w-prose text-[16px] leading-relaxed text-muted">{headline.text}</p>
        </div>
      </div>

      {/* Hoá đơn */}
      <article className="receipt-edge bg-paper pb-10">
        <header className="border-b-2 border-dashed border-line px-6 pb-6 pt-8 text-center sm:px-10">
          <p className="text-[14px] text-muted">Mã đơn</p>
          <p
            className={`mt-1 font-display text-[72px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[88px] ${
              failed ? 'text-muted line-through decoration-4' : 'text-leaf'
            }`}
          >
            {order.code}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[14px] text-muted">
            <StatusBadge status={order.status} />
            <span>{formatDateTime(order.createdAt)}</span>
          </div>
        </header>

        <section className="px-6 pt-6 sm:px-10">
          <h2 className="sr-only">Món đã đặt</h2>
          <ul className="space-y-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-[15px]">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="tabular-nums">{item.qty}×</span> {item.productName}
                  </p>
                  <p className="text-[13px] text-muted">{describeItem(item)}</p>
                </div>
                <span className="shrink-0 tabular-nums">{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-baseline justify-between border-t-2 border-dashed border-line pt-5">
            <span className="font-semibold">
              Tổng cộng <span className="font-normal text-muted">({order.itemCount} ly)</span>
            </span>
            <span className="font-display text-[28px] font-extrabold tabular-nums">{formatVnd(order.total)}</span>
          </div>
        </section>
      </article>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <Link href="/orders" className={buttonStyles.secondaryBtn}>
          Xem đơn của tôi
        </Link>
        <Link href={failed ? '/?view=checkout' : '/'} className={buttonStyles.primaryBtn}>
          {failed ? 'Thanh toán lại' : 'Đặt thêm món'}
        </Link>
      </div>
    </>
  );
}
