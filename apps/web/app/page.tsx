"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  API_URL,
  type ApiResult,
  createSePayCheckout,
  createOrder,
  payOrder,
  type PaymentMethod,
} from "../lib/api";
import { getToken } from "../lib/auth";
import {
  type CartItem,
  cartCount,
  cartTotal,
  getAdjustedItemPrice,
  getSizePriceDelta,
  type Size,
  SIZES,
  TOPPING_OPTIONS,
  TOPPING_PRICE,
  toOrderItem,
  useCart,
} from "../lib/cart";
import { formatVnd } from "../lib/format";
import { SiteHeader } from "../components/SiteHeader";
import { DrinkImage, SizeCup } from "../components/DrinkVisual";

// Sau khi thanh toán, trang chuyển sang /orders/<id> (màn hình xác nhận thật),
// nên không còn màn "success" giả ở đây.
type Screen = "menu" | "detail" | "cart" | "checkout";

type Product = {
  id: string;
  code?: string;
  name: string;
  price: number;
  imageUrl?: string;
  stock?: number;
};

type LoadState = "loading" | "error" | "ready";

/** Ảnh chụp thật trong public/products, ưu tiên hơn imageUrl từ API. */
const productPhotos: Record<string, string> = {
  "1": "/products/winter-melon-tea.jpg",
  "2": "/products/peach-citrus-tea.jpg",
  "3": "/products/milk-coffee.jpg",
  "4": "/products/cappuccino.jpg",
};

const paymentMethods: { label: string; hint: string; method: PaymentMethod; icon: "wallet" | "card" }[] = [
  { label: "Ví điện tử", hint: "MoMo, ZaloPay, VNPay", method: "WALLET", icon: "wallet" },
  { label: "Thẻ ngân hàng", hint: "Thẻ ATM nội địa, Visa, Mastercard", method: "CARD", icon: "card" },
  { label: "SePay QR", hint: "Quét mã và chuyển khoản ngân hàng", method: "SEPAY", icon: "wallet" },
];

const parseProducts = (data: unknown): Product[] => {
  if (!Array.isArray(data)) throw new Error("Invalid products response");
  return data.map((value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid product in response");
    }
    const item = value as Record<string, unknown>;
    if (
      (typeof item.id !== "string" && typeof item.id !== "number") ||
      typeof item.name !== "string" ||
      !Number.isFinite(Number(item.price))
    ) {
      throw new Error("Invalid product fields in response");
    }
    const id = String(item.id);
    return {
      id,
      code: typeof item.code === "string" ? item.code : id.padStart(2, "0"),
      name: item.name,
      price: Number(item.price),
      imageUrl:
        productPhotos[id] ?? (typeof item.imageUrl === "string" ? item.imageUrl : undefined),
      stock: item.stock === undefined ? undefined : Number(item.stock),
    };
  });
};

export default function HomePage() {
  return (
    // useSearchParams cần Suspense khi build production
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [screenOverride, setScreen] = useState<Screen | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size>("M");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const { cart, setCart } = useCart();
  const [payment, setPayment] = useState<PaymentMethod>("WALLET");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Đơn đã tạo nhưng thanh toán chưa xong: thử lại thì dùng lại đơn này
  // (nếu giỏ không đổi) thay vì tạo đơn mới.
  const [pendingOrder, setPendingOrder] = useState<{ id: number; cartKey: string } | null>(null);

  // Quay về từ /login?next=/?view=checkout → mở lại đúng bước đang dở.
  const view = searchParams.get("view");
  const screen: Screen =
    screenOverride ??
    ((view === "cart" || view === "checkout") && cart.length > 0 ? (view as Screen) : "menu");

  const loadProducts = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch(`${API_URL ?? "/api"}/products`, {
        headers: { "ngrok-skip-browser-warning": "1" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch products");
      setProducts(parseProducts(await res.json()));
      setLoadState("ready");
    } catch (error) {
      console.error("Lỗi fetch API:", error);
      setProducts([]);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu lần đầu
    loadProducts();
  }, [loadProducts]);

  // Đổi màn hình → cuộn lên đầu trang.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const itemCount = useMemo(() => cartCount(cart), [cart]);
  const selectedItemPrice = selectedProduct
    ? getAdjustedItemPrice(selectedProduct.price, selectedSize, selectedToppings)
    : 0;

  const openDetail = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSize("M");
    setSelectedToppings([]);
    setScreen("detail");
  };

  const toggleTopping = (name: string) => {
    setSelectedToppings((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    const toppingKey = [...selectedToppings].sort().join("-");

    const newItem: CartItem = {
      id: `${selectedProduct.id}-${selectedSize}-${toppingKey || "no-toppings"}`,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      size: `Size ${selectedSize}`,
      quantity: 1,
      price: selectedItemPrice,
      toppings: selectedToppings,
      imageUrl: selectedProduct.imageUrl,
    };

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === newItem.id);

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
        };
        return next;
      }

      return [...prev, newItem];
    });

    setScreen("cart");
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    const targetItem = cart.find((item) => item.id === itemId);
    if (!targetItem) return;

    if (change < 0 && targetItem.quantity === 1 && cart.length === 1) {
      setScreen("menu");
    }

    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== itemId) return [item];
        const quantity = item.quantity + change;
        return quantity > 0 ? [{ ...item, quantity }] : [];
      }),
    );
  };

  const removeFromCart = (itemId: string) => {
    const remainingItems = cart.filter((item) => item.id !== itemId);
    if (remainingItems.length === 0) setScreen("menu");
    setCart(remainingItems);
  };

  const goBackToMenu = () => setScreen("menu");
  const goToCart = () => setScreen(cart.length > 0 ? "cart" : "menu");
  const goToLogin = () =>
    router.push(`/login?next=${encodeURIComponent("/?view=checkout")}`);

  // Luồng đặt hàng: xem giỏ → đăng nhập nếu cần → thanh toán.
  const proceedToCheckout = () => {
    if (!getToken()) {
      goToLogin();
      return;
    }
    setPayError(null);
    setScreen("checkout");
  };

  const failPayment = (res: Extract<ApiResult<unknown>, { ok: false }>) => {
    setPaying(false);
    if (res.kind === "unauthenticated") {
      goToLogin();
      return;
    }
    setPayError(res.message);
  };

  /** POST /orders (PENDING) → POST /payments → màn hình xác nhận /orders/<id>. */
  const confirmPayment = async () => {
    if (paying || cart.length === 0) return;
    if (!getToken()) {
      goToLogin();
      return;
    }
    setPaying(true);
    setPayError(null);

    const cartKey = JSON.stringify(cart);
    let orderId = pendingOrder?.cartKey === cartKey ? pendingOrder.id : null;
    if (orderId === null) {
      const created = await createOrder(cart.map(toOrderItem));
      if (!created.ok) return failPayment(created);
      orderId = created.data.id;
      setPendingOrder({ id: orderId, cartKey });
    }

    if (payment === "SEPAY" && !simulateFailure) {
      const checkout = await createSePayCheckout(orderId);
      if (!checkout.ok) return failPayment(checkout);
      setPaying(false);
      router.push(`/payments/sepay/${orderId}`);
      return;
    }

    const mockMethod = simulateFailure || payment === "SEPAY" ? "FAIL" : payment;
    const paid = await payOrder(orderId, mockMethod);
    if (!paid.ok) return failPayment(paid);

    // Thành công → xóa giỏ. Thất bại (PAYMENT_FAILED) → giữ nguyên giỏ để
    // khách thử lại (tiêu chí chấp nhận US-05).
    if (paid.data.status === "PAID") {
      setCart([]);
      setPendingOrder(null);
    }
    router.push(`/orders/${orderId}`);
  };

  return (
    <>
      <SiteHeader onCartClick={goToCart} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-16 md:pt-12">
        {screen === "menu" && (
          <MenuScreen
            products={products}
            loadState={loadState}
            onRetry={loadProducts}
            onPick={openDetail}
          />
        )}

        {screen === "detail" && selectedProduct && (
          <section>
            <BackButton onClick={goBackToMenu}>Menu</BackButton>

            <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12">
              <div className="md:sticky md:top-24 md:self-start">
                <DrinkImage
                  name={selectedProduct.name}
                  imageUrl={selectedProduct.imageUrl}
                  pearls={selectedToppings.includes("Trân châu")}
                  cream={selectedToppings.includes("Kem")}
                  className="aspect-square w-full rounded-[32px]"
                />
              </div>

              <div>
                <h1 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-[52px]">
                  {selectedProduct.name}
                </h1>
                <p className="mt-3 text-[17px] text-muted">
                  Giá gốc {formatVnd(selectedProduct.price)} cho size S. Pha ngay khi bạn đặt.
                </p>

                <fieldset className="mt-10">
                  <legend className="mb-4 text-[17px] font-semibold">Chọn size</legend>
                  <div className="grid grid-cols-3 gap-3">
                    {SIZES.map((size) => {
                      const active = selectedSize === size;
                      const delta = getSizePriceDelta(size);
                      return (
                        <label
                          key={size}
                          className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-3 pb-3 pt-4 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-matcha-strong ${
                            active
                              ? "border-leaf bg-matcha"
                              : "border-line bg-paper hover:border-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value={size}
                            checked={active}
                            onChange={() => setSelectedSize(size)}
                            className="sr-only"
                          />
                          <SizeCup size={size} active={active} />
                          <span className="font-display text-[22px] font-bold">{size}</span>
                          <span className="text-[13px] text-muted">
                            {delta > 0 ? `+${formatVnd(delta)}` : "Giá gốc"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-8">
                  <legend className="mb-4 text-[17px] font-semibold">
                    Thêm topping <span className="font-normal text-muted">(tuỳ chọn)</span>
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {TOPPING_OPTIONS.map((option) => {
                      const active = selectedToppings.includes(option);
                      return (
                        <label
                          key={option}
                          className={`flex cursor-pointer items-center gap-3 rounded-full border-2 py-2.5 pl-3 pr-5 text-[16px] font-medium transition-colors has-focus-visible:outline-3 has-focus-visible:outline-matcha-strong ${
                            active
                              ? "border-sugar bg-sugar-soft"
                              : "border-line bg-paper hover:border-muted/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleTopping(option)}
                            className="sr-only"
                          />
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                              active ? "border-sugar bg-sugar text-white" : "border-line"
                            }`}
                            aria-hidden="true"
                          >
                            {active && (
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          {option}
                          <span className="text-muted">+{formatVnd(TOPPING_PRICE)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Mobile: nút dính đáy màn hình; desktop: nằm ngay dưới lựa chọn */}
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-4 backdrop-blur md:static md:mt-10 md:border-0 md:bg-transparent md:p-0">
                  <button
                    type="button"
                    onClick={addToCart}
                    className="flex w-full items-center justify-between rounded-2xl bg-leaf px-6 py-4 text-[17px] font-semibold text-white transition-colors hover:bg-leaf-deep"
                  >
                    <span>Thêm vào giỏ</span>
                    <span className="font-display text-[20px] font-bold tabular-nums">
                      {formatVnd(selectedItemPrice)}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "cart" && (
          <section>
            <Stepper current={0} />
            <h1 className="mt-6 font-display text-[40px] font-extrabold tracking-[-0.03em] sm:text-[48px]">
              Giỏ hàng của bạn
            </h1>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
              <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
                {cart.map((item) => (
                  <li key={item.id} className="flex gap-4 p-4 sm:gap-5 sm:p-5">
                    <DrinkImage
                      name={item.name}
                      imageUrl={item.imageUrl}
                      pearls={item.toppings.includes("Trân châu")}
                      cream={item.toppings.includes("Kem")}
                      className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24"
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="font-display text-[19px] font-bold leading-tight">{item.name}</p>
                        <p className="mt-1 text-[14px] text-muted">
                          {item.size}
                          {item.toppings.length > 0 && `, ${item.toppings.join(", ").toLowerCase()}`}
                        </p>
                        <p className="mt-1 text-[14px] text-muted tabular-nums">{formatVnd(item.price)} / ly</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <QuantityStepper
                          name={item.name}
                          quantity={item.quantity}
                          onChange={(change) => updateCartQuantity(item.id, change)}
                        />
                        <span className="w-24 text-right font-semibold tabular-nums">
                          {formatVnd(item.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Xoá ${item.name} khỏi giỏ`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="M4 6h12M8 6V4.5h4V6m-6 0 .7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <aside className="rounded-3xl border border-line bg-paper p-6 lg:sticky lg:top-24">
                <dl className="space-y-3 text-[15px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">Số ly</dt>
                    <dd className="tabular-nums">{itemCount}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-4">
                    <dt className="font-semibold">Tổng cộng</dt>
                    <dd className="font-display text-[28px] font-extrabold tabular-nums">{formatVnd(total)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={proceedToCheckout}
                  className="mt-6 w-full rounded-2xl bg-leaf py-4 text-[17px] font-semibold text-white transition-colors hover:bg-leaf-deep"
                >
                  Thanh toán
                </button>
                <button
                  type="button"
                  onClick={goBackToMenu}
                  className="mt-3 w-full rounded-2xl py-3 text-[15px] font-medium text-leaf transition-colors hover:bg-matcha"
                >
                  Chọn thêm món
                </button>
              </aside>
            </div>
          </section>
        )}

        {screen === "checkout" && (
          <section>
            <Stepper current={1} />
            <h1 className="mt-6 font-display text-[40px] font-extrabold tracking-[-0.03em] sm:text-[48px]">
              Thanh toán
            </h1>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
              <div>
                <fieldset>
                  <legend className="mb-4 text-[17px] font-semibold">Trả bằng</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethods.map(({ label, hint, method, icon }) => {
                      const active = payment === method;
                      return (
                        <label
                          key={method}
                          className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-5 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-matcha-strong ${
                            active ? "border-leaf bg-matcha" : "border-line bg-paper hover:border-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment"
                            checked={active}
                            onChange={() => setPayment(method)}
                            className="sr-only"
                          />
                          <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                              active ? "bg-leaf text-white" : "bg-sage text-muted"
                            }`}
                          >
                            <PaymentIcon kind={icon} />
                          </span>
                          <span>
                            <span className="block text-[17px] font-semibold">{label}</span>
                            <span className="block text-[14px] text-muted">{hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <p className="mt-4 text-[14px] text-muted">Quán chỉ nhận thanh toán không tiền mặt.</p>

                {/* Cổng thanh toán là mock: cho phép demo nhánh PAYMENT_FAILED */}
                <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-dashed border-line p-4 text-[14px] text-muted">
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-danger"
                  />
                  <span>
                    <span className="font-medium text-ink">Giả lập thanh toán lỗi</span>
                    <br />
                    Chỉ dùng khi demo, để xem màn hình đơn thanh toán thất bại.
                  </span>
                </label>
              </div>

              <aside className="rounded-3xl border border-line bg-paper p-6 lg:sticky lg:top-24">
                <h2 className="text-[17px] font-semibold">Đơn của bạn</h2>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {cart.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4">
                      <span className="min-w-0">
                        <span className="tabular-nums">{item.quantity}×</span> {item.name}
                        <span className="block text-[13px] text-muted">
                          {item.size}
                          {item.toppings.length > 0 && `, ${item.toppings.join(", ").toLowerCase()}`}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatVnd(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="font-semibold">Tổng cộng</span>
                  <span className="font-display text-[28px] font-extrabold tabular-nums">{formatVnd(total)}</span>
                </div>

                {payError && (
                  <p role="alert" className="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
                    {payError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={confirmPayment}
                  disabled={paying || cart.length === 0}
                  className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-leaf py-4 text-[17px] font-semibold text-white transition-colors hover:bg-leaf-deep disabled:opacity-60"
                >
                  {paying && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  )}
                  {paying ? "Đang thanh toán…" : `Trả ${formatVnd(total)}`}
                </button>
                <button
                  type="button"
                  onClick={goToCart}
                  disabled={paying}
                  className="mt-3 w-full rounded-2xl py-3 text-[15px] font-medium text-leaf transition-colors hover:bg-matcha disabled:opacity-60"
                >
                  Sửa giỏ hàng
                </button>
              </aside>
            </div>
          </section>
        )}
      </main>

      {/* Thanh giỏ hàng nổi trên mobile ở màn Menu */}
      {screen === "menu" && itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4 md:hidden">
          <button
            type="button"
            onClick={goToCart}
            className="flex w-full items-center justify-between rounded-2xl bg-leaf px-5 py-4 text-white shadow-[0_10px_30px_-8px_rgba(34,70,45,0.6)]"
          >
            <span className="flex items-center gap-3 text-[16px] font-semibold">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-sugar px-2 text-[14px] tabular-nums">
                {itemCount}
              </span>
              Xem giỏ hàng
            </span>
            <span className="font-display text-[19px] font-bold tabular-nums">{formatVnd(total)}</span>
          </button>
        </div>
      )}
    </>
  );
}

function MenuScreen({
  products,
  loadState,
  onRetry,
  onPick,
}: {
  products: Product[];
  loadState: LoadState;
  onRetry: () => void;
  onPick: (product: Product) => void;
}) {
  return (
    <section>
      <div className="max-w-2xl">
        <h1 className="font-display text-[48px] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-[68px]">
          Hôm nay uống gì?
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted sm:text-[18px]">
          Chọn món, chỉnh size và topping theo ý bạn. Quán pha ngay khi bạn thanh toán.
        </p>
      </div>

      {loadState === "loading" && (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6" aria-busy="true" aria-label="Đang tải menu">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="aspect-4/5 animate-pulse rounded-[28px] bg-line/60" />
              <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-line/60" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-line/60" />
            </div>
          ))}
        </div>
      )}

      {loadState === "error" && (
        <div role="alert" className="mt-10 rounded-3xl border border-line bg-paper p-8 sm:p-10">
          <h2 className="font-display text-[24px] font-bold">Chưa tải được menu</h2>
          <p className="mt-2 max-w-prose text-muted">
            Không kết nối được tới máy chủ ({API_URL ?? "API proxy /api"}). Kiểm tra backend đã chạy
            chưa rồi thử lại.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-full bg-leaf px-6 py-3 font-semibold text-white transition-colors hover:bg-leaf-deep"
          >
            Tải lại menu
          </button>
        </div>
      )}

      {loadState === "ready" && products.length === 0 && (
        <p className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center text-muted">
          Menu hôm nay đang trống. Quay lại sau ít phút nhé.
        </p>
      )}

      {loadState === "ready" && products.length > 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
          {products.map((product) => {
            const soldOut = product.stock !== undefined && product.stock <= 0;
            const lowStock = !soldOut && product.stock !== undefined && product.stock <= 5;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  disabled={soldOut}
                  className="group block w-full rounded-[28px] text-left disabled:opacity-55"
                >
                  <div className="relative">
                    <DrinkImage
                      name={product.name}
                      imageUrl={product.imageUrl}
                      className="aspect-4/5 w-full rounded-[28px] transition-transform duration-300 group-enabled:group-hover:-translate-y-1"
                    />
                    <span className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-leaf shadow-sm transition-colors group-enabled:group-hover:bg-leaf group-enabled:group-hover:text-white">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                      </svg>
                    </span>
                    {(soldOut || lowStock) && (
                      <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-[13px] font-semibold text-sugar">
                        {soldOut ? "Hết hàng" : `Còn ${product.stock} ly`}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 font-display text-[19px] font-bold leading-tight sm:text-[21px]">
                    {product.name}
                  </p>
                  <p className="mt-1 text-[16px] font-semibold text-sugar tabular-nums">
                    {formatVnd(product.price)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-[15px] font-medium text-muted transition-colors hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 4 6 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </button>
  );
}

/** Ba bước thật của luồng đặt món. */
function Stepper({ current }: { current: number }) {
  const steps = ["Giỏ hàng", "Thanh toán", "Nhận mã đơn"];
  return (
    <ol className="flex items-center gap-2 text-[13px] sm:gap-3 sm:text-[14px]" aria-label="Các bước đặt món">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
            <span className={`flex items-center gap-1.5 whitespace-nowrap sm:gap-2 ${active ? "font-semibold text-ink" : "text-muted"}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                  active ? "bg-leaf text-white" : done ? "bg-matcha-strong text-white" : "border border-line bg-paper"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-3 bg-line sm:w-10" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function QuantityStepper({
  name,
  quantity,
  onChange,
}: {
  name: string;
  quantity: number;
  onChange: (change: number) => void;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full text-[18px] font-semibold text-ink transition-colors hover:bg-paper";
  return (
    <div className="flex items-center rounded-full bg-sage p-0.5">
      <button type="button" onClick={() => onChange(-1)} aria-label={`Giảm số lượng ${name}`} className={btn}>
        −
      </button>
      <span className="min-w-7 text-center font-semibold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button type="button" onClick={() => onChange(1)} aria-label={`Tăng số lượng ${name}`} className={btn}>
        +
      </button>
    </div>
  );
}

function PaymentIcon({ kind }: { kind: "wallet" | "card" }) {
  return kind === "wallet" ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" strokeLinecap="round" />
    </svg>
  );
}
