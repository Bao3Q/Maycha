"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "../../../../components/SiteHeader";
import {
  createSePayCheckout,
  fetchOrder,
  type Order,
  type SePayCheckoutResponse,
} from "../../../../lib/api";
import { useCart } from "../../../../lib/cart";
import { formatVnd } from "../../../../lib/format";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

export default function SePayPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { setCart } = useCart();
  const [checkout, setCheckout] = useState<SePayCheckoutResponse | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const orderId = Number(id);
  const validOrderId = Number.isSafeInteger(orderId) && orderId > 0;

  useEffect(() => {
    let cancelled = false;
    if (!validOrderId) return;

    const load = async () => {
      const orderResult = await fetchOrder(id);
      if (cancelled) return;
      if (!orderResult.ok) {
        setError(orderResult.message);
        return;
      }
      setOrder(orderResult.data);
      if (orderResult.data.status === "PAID") {
        setCart([]);
        return;
      }

      const checkoutResult = await createSePayCheckout(orderId);
      if (cancelled) return;
      if (!checkoutResult.ok) {
        setError(checkoutResult.message);
        return;
      }
      setCheckout(checkoutResult.data);
      setError(null);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, retryKey, setCart, validOrderId, orderId]);

  useEffect(() => {
    if (
      !checkout ||
      !order ||
      (order.status !== "PENDING" && order.status !== "PAYMENT_FAILED") ||
      polls >= MAX_POLLS
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchOrder(id).then((result) => {
        if (result.ok) {
          setOrder(result.data);
          setError(null);
          if (result.data.status === "PAID") setCart([]);
        } else {
          setError(result.message);
        }
        setPolls((count) => count + 1);
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [checkout, id, order, polls, setCart]);

  const retry = () => {
    setError(null);
    setPolls(0);
    setRetryKey((key) => key + 1);
  };

  const paid = order?.status === "PAID";
  const pageError = validOrderId ? error : "Mã đơn hàng không hợp lệ.";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-8 sm:px-6 md:pt-12">
        <Link
          href={`/orders/${id}`}
          className="text-sm font-medium text-leaf hover:underline"
        >
          ← Xem đơn hàng
        </Link>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Thanh toán SePay
        </h1>

        {paid ? (
          <section className="mt-8 rounded-3xl border border-line bg-paper p-6 sm:p-8">
            <p className="text-xl font-semibold text-leaf">Thanh toán thành công</p>
            <p className="mt-2 text-muted">
              SePay đã xác nhận giao dịch cho đơn hàng #{id}.
            </p>
            <Link
              href={`/orders/${id}`}
              className="mt-6 inline-flex rounded-xl bg-leaf px-5 py-3 font-semibold text-white hover:bg-leaf-deep"
            >
              Xem đơn hàng
            </Link>
          </section>
        ) : checkout ? (
          <section className="mt-8 grid gap-6 rounded-3xl border border-line bg-paper p-6 sm:grid-cols-[1fr_320px] sm:p-8">
            <div>
              <p className="text-muted">Đơn hàng #{checkout.orderId}</p>
              <p className="mt-2 font-display text-3xl font-extrabold">
                {formatVnd(checkout.amount)}
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <p>
                  <span className="text-muted">Ngân hàng: </span>
                  <strong>{checkout.bankCode}</strong>
                </p>
                <p>
                  <span className="text-muted">Số tài khoản: </span>
                  <strong>{checkout.accountNumber}</strong>
                </p>
                <p>
                  <span className="text-muted">Chủ tài khoản: </span>
                  <strong>{checkout.accountName}</strong>
                </p>
                <p>
                  <span className="text-muted">Nội dung chuyển khoản: </span>
                  <strong className="select-all">{checkout.transferDescription}</strong>
                </p>
              </div>
              <p className="mt-6 rounded-xl bg-matcha px-4 py-3 text-sm text-ink">
                Quét mã QR và giữ nguyên số tiền cùng nội dung chuyển khoản. Trang
                sẽ tự cập nhật khi SePay gửi xác nhận.
              </p>
              {polls >= MAX_POLLS && (
                <button
                  type="button"
                  onClick={retry}
                  className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-matcha"
                >
                  Kiểm tra lại trạng thái
                </button>
              )}
            </div>
            <div className="flex flex-col items-center justify-center">
              <Image
                src={checkout.qrUrl}
                alt={`Mã QR thanh toán SePay cho đơn hàng ${checkout.orderId}`}
                width={300}
                height={300}
                unoptimized
                className="h-auto w-full max-w-[300px] rounded-2xl border border-line bg-white p-2"
              />
              <p className="mt-3 text-center text-sm text-muted">
                Đang chờ xác nhận thanh toán…
              </p>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-line bg-paper p-6 sm:p-8">
            <p className="text-muted">
              {pageError ?? "Đang tạo mã QR thanh toán…"}
            </p>
            {pageError && validOrderId && (
              <button
                type="button"
                onClick={retry}
                className="mt-5 rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-matcha"
              >
                Thử lại
              </button>
            )}
          </section>
        )}
        {error && checkout && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            Chưa kiểm tra được trạng thái đơn: {error}
          </p>
        )}
      </main>
    </>
  );
}
