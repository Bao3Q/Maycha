'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  fetchOrder,
  updateOrderStatus,
  fetchLoyaltyPoints,
  payOrder,
  type ApiResult,
  type Order,
  type OrderStatus,
} from '../../../lib/api';
import { useCart } from '../../../lib/cart';
import { describeItem, formatDateTime, formatVnd, STATUS_META } from '../../../lib/format';
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

type Icon = 'check' | 'alert' | 'clock' | 'x' | 'cup' | 'bell' | 'star';
type Headline = { title: string; text: string; tone: string; icon: Icon };

const HEADLINES: Partial<Record<OrderStatus, Headline>> = {
  PAID: {
    icon: 'check',
    title: 'Đặt hàng thành công',
    text: 'Quán đã nhận thanh toán và bắt đầu pha. Đọc mã đơn này tại quầy để nhận đồ uống.',
    tone: 'bg-leaf text-white',
  },
  PREPARING: {
    icon: 'cup',
    title: 'Đang pha chế đồ uống',
    text: 'Barista đang chuẩn bị đồ uống theo yêu cầu của bạn.',
    tone: 'bg-sky-700 text-white',
  },
  READY: {
    icon: 'bell',
    title: 'Đồ uống đã sẵn sàng',
    text: 'Mời bạn tới quầy, đọc mã đơn để nhận đồ uống.',
    tone: 'bg-sugar text-white',
  },
  COMPLETED: {
    icon: 'star',
    title: 'Đơn hàng hoàn thành',
    text: 'Cảm ơn bạn đã ghé Maycha. Hẹn gặp lại!',
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

/** Các bước chuyển trạng thái đơn hàng hợp lệ. */
const TRANSITIONS: Partial<Record<OrderStatus, { to: OrderStatus; label: string; danger?: boolean }[]>> = {
  PENDING: [
    { to: 'PAID', label: 'Xác nhận đã thanh toán' },
    { to: 'PAYMENT_FAILED', label: 'Đánh dấu thanh toán lỗi', danger: true },
    { to: 'CANCELLED', label: 'Huỷ đơn', danger: true },
  ],
  PAID: [
    { to: 'PREPARING', label: 'Bắt đầu pha chế' },
    { to: 'CANCELLED', label: 'Huỷ đơn', danger: true },
  ],
  PREPARING: [{ to: 'READY', label: 'Pha xong, gọi khách' }],
  READY: [{ to: 'COMPLETED', label: 'Đã giao cho khách' }],
  PAYMENT_FAILED: [
    { to: 'PAID', label: 'Thanh toán lại thành công' },
    { to: 'CANCELLED', label: 'Huỷ đơn', danger: true },
  ],
};

function HeadlineIcon({ icon }: { icon: Icon }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" {...common}>
      {icon === 'check' && <path d="M5 12.5 10 17.5 19 7" />}
      {icon === 'alert' && <path d="M12 6v7M12 17.5v.5" />}
      {icon === 'clock' && <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>}
      {icon === 'x' && <path d="M7 7l10 10M17 7 7 17" />}
      {icon === 'cup' && <path d="M6 8h12l-1.5 11a2 2 0 0 1-2 1.7h-5a2 2 0 0 1-2-1.7L6 8ZM9 8V5h6v3" />}
      {icon === 'bell' && <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5h4" />}
      {icon === 'star' && <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6L12 4Z" />}
    </svg>
  );
}

/**
 * Màn hình Xác nhận đơn – gọi GET /orders/:id (cần JWT).
 * Sau khi thanh toán, chuyển hướng tới `/orders/<id>`.
 * Hiển thị điểm loyalty, voucher và các bước chuyển trạng thái.
 */
export default function OrderConfirmationPage() {
  const { setCart } = useCart();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [result, setResult] = useState<ApiResult<Order> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [polls, setPolls] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Retry the order shown on this page, including after reload. Do not send
  // the customer back to a checkout whose in-memory pendingOrder was lost.
  const retryPayment = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setActionError(null);
    const response = await payOrder(Number(id), 'WALLET', crypto.randomUUID());
    setIsUpdating(false);
    if (!response.ok) {
      setActionError(response.message);
      return;
    }
    if (response.data.status === 'PAID') {
      setCart((current) => {
        if (!result?.ok) return current;
        const orderItems = result.data.items;
        const sameCart = current.length === orderItems.length && current.every((item) =>
          orderItems.some((line) =>
            line.productId === (item.productId ?? item.id.split('-')[0]) &&
            line.size === item.size.replace(/^Size\s+/, '') &&
            line.qty === item.quantity &&
            JSON.stringify([...line.toppings].sort()) === JSON.stringify([...item.toppings].sort()),
          ),
        );
        return sameCart ? [] : current;
      });
      setReloadKey((value) => value + 1);
    }
  };

  // Tải đơn và điểm tích luỹ (lần đầu, khi đổi id, khi bấm thử lại)
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
      setActionSuccess(`Đã chuyển đơn sang "${STATUS_META[targetStatus]?.label ?? targetStatus}".`);
      fetchLoyaltyPoints().then((r) => {
        if (r.ok) setLoyaltyPoints(r.data.loyaltyPoints);
      });
    } else {
      setActionError(`Không chuyển được trạng thái: ${res.message}`);
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
          Xem đơn của tôi
        </Link>
      </ErrorCard>
    );
  }

  const order = result.data;
  const headline = HEADLINES[order.status] ?? DEFAULT_HEADLINE;
  const failed = order.status === 'PAYMENT_FAILED';
  const voided = failed || order.status === 'CANCELLED';
  const hasVoucher = Boolean(order.voucherCode && order.discountAmount && order.discountAmount > 0);
  const transitions = TRANSITIONS[order.status] ?? [];

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
              voided ? 'text-muted line-through decoration-4' : 'text-leaf'
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

          <div className="mt-6 space-y-2 border-t-2 border-dashed border-line pt-5 text-[15px]">
            {hasVoucher && (
              <>
                <div className="flex justify-between text-muted">
                  <span>Tạm tính</span>
                  <span className="tabular-nums">{formatVnd(order.subtotal ?? order.total)}</span>
                </div>
                <div className="flex justify-between font-medium text-leaf">
                  <span>Mã giảm giá {order.voucherCode}</span>
                  <span className="tabular-nums">−{formatVnd(order.discountAmount ?? 0)}</span>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-semibold">
                {hasVoucher ? 'Tổng thanh toán' : 'Tổng cộng'}{' '}
                <span className="font-normal text-muted">({order.itemCount} ly)</span>
              </span>
              <span className="font-display text-[28px] font-extrabold tabular-nums">{formatVnd(order.total)}</span>
            </div>
          </div>

          {loyaltyPoints !== null && (
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-sugar-soft px-4 py-3 text-[14px]">
              <span className="font-medium text-sugar">Điểm tích luỹ của bạn</span>
              <span className="font-display text-[20px] font-bold tabular-nums text-sugar">
                {loyaltyPoints} điểm
              </span>
            </div>
          )}
        </section>
      </article>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <Link href="/orders" className={buttonStyles.secondaryBtn}>
          Xem đơn của tôi
        </Link>
        {failed ? (
          <button type="button" disabled={isUpdating} onClick={retryPayment} className={buttonStyles.primaryBtn}>
            {isUpdating ? 'Đang thanh toán…' : 'Thanh toán lại bằng ví'}
          </button>
        ) : (
          <Link href="/" className={buttonStyles.primaryBtn}>Đặt thêm món</Link>
        )}
      </div>

      {/* Bảng chuyển trạng thái đơn hàng */}
      <section className="mt-12 rounded-3xl border border-dashed border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Chuyển trạng thái đơn (demo State Machine)</h2>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Dành cho quầy pha chế. Backend chỉ cho phép các bước chuyển hợp lệ.
        </p>

        {actionSuccess && (
          <p role="status" className="mt-4 rounded-xl bg-matcha px-4 py-2.5 text-[14px] font-medium text-leaf-deep">
            {actionSuccess}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-[14px] text-danger">
            {actionError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {transitions.map(({ to, label, danger }) => (
            <button
              key={to}
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusChange(to)}
              className={`rounded-full px-4 py-2 text-[14px] font-semibold transition-colors disabled:opacity-50 ${
                danger
                  ? 'border border-line bg-paper text-danger hover:bg-danger-soft'
                  : 'bg-leaf text-white hover:bg-leaf-deep'
              }`}
            >
              {label}
            </button>
          ))}
          {transitions.length === 0 && (
            <p className="text-[14px] text-muted">Đơn đã ở trạng thái kết thúc, không thể chuyển tiếp.</p>
          )}
        </div>
      </section>
    </>
  );
}
