"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  API_URL,
  type ApiResult,
  createOrder,
  type CreateOrderItem,
  payOrder,
  type PaymentMethod,
} from "../lib/api";
import { getToken } from "../lib/auth";
import { AuthNav } from "../components/AuthNav";

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

type CartItem = {
  id: string;
  /** Id sản phẩm gửi lên POST /orders (giỏ cũ chưa có thì tách từ `id`). */
  productId?: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  toppings: string[];
};

type CartContextValue = {
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
};

const toppingOptions = ["Trân châu", "Kem"];
const toppingPrice = 5000;
const cartStorageKey = "maycha-cart";
const productPhotos: Record<string, string> = {
  "1": "/products/winter-melon-tea.jpg",
  "2": "/products/peach-citrus-tea.jpg",
  "3": "/products/milk-coffee.jpg",
  "4": "/products/cappuccino.jpg",
};
const CartContext = createContext<CartContextValue | null>(null);
let cartSnapshot: CartItem[] = [];
let cartStoreInitialized = false;
const cartListeners = new Set<() => void>();
const emptyCart: CartItem[] = [];

const isCartItem = (value: unknown): value is CartItem => {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.productId === undefined || typeof item.productId === "string") &&
    typeof item.name === "string" &&
    typeof item.size === "string" &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.price === "number" &&
    Array.isArray(item.toppings) &&
    item.toppings.every((topping) => typeof topping === "string")
  );
};

const initializeCartStore = () => {
  if (cartStoreInitialized || typeof window === "undefined") return;

  try {
    const savedCart = window.localStorage.getItem(cartStorageKey);
    if (savedCart) {
      const parsedCart: unknown = JSON.parse(savedCart);
      if (!Array.isArray(parsedCart)) {
        throw new Error("Saved cart data has an invalid format");
      }
      const validCart = parsedCart.filter(isCartItem);
      if (validCart.length !== parsedCart.length) {
        throw new Error("Saved cart contains invalid items");
      }
      cartSnapshot = validCart;
    }
  } catch (error) {
    console.error("Không thể tải giỏ hàng đã lưu:", error);
  } finally {
    cartStoreInitialized = true;
  }
};

const subscribeToCart = (listener: () => void) => {
  cartListeners.add(listener);
  initializeCartStore();
  listener();
  return () => {
    cartListeners.delete(listener);
  };
};

const getCartSnapshot = () => cartSnapshot;
const getServerCartSnapshot = () => emptyCart;

const setCartState: Dispatch<SetStateAction<CartItem[]>> = (action) => {
  initializeCartStore();
  cartSnapshot = typeof action === "function" ? action(cartSnapshot) : action;

  try {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cartSnapshot));
  } catch (error) {
    console.error("Không thể lưu giỏ hàng:", error);
  }

  cartListeners.forEach((listener) => listener());
};

const getSizePriceDelta = (size: string) => {
  switch (size) {
    case "S":
      return 0;
    case "M":
      return 5000;
    case "L":
      return 10000;
    default:
      return 0;
  }
};

const getAdjustedItemPrice = (basePrice: number, size: string, toppings: string[]) =>
  basePrice + getSizePriceDelta(size) + toppings.length * toppingPrice;

function ProductPhoto({
  product,
  className,
}: {
  product: Product;
  className: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageUrl = productPhotos[product.id] ?? product.imageUrl;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#e5efec] ${className}`}
    >
      {imageUrl && !loadFailed ? (
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={`Ảnh ${product.name} đang được cập nhật`}
          className="flex h-full min-h-40 flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#e5efec] to-[#f8e9d8] text-[#0a6b5f]"
        >
          <span aria-hidden="true" className="text-5xl">🥤</span>
          <span className="px-3 text-center text-sm font-medium">{product.name}</span>
        </div>
      )}
    </div>
  );
}

const paymentMethods: { label: string; method: PaymentMethod }[] = [
  { label: "Ví điện tử", method: "WALLET" },
  { label: "Thẻ ngân hàng", method: "CARD" },
];

/** Món trong giỏ → dòng gửi lên POST /orders. */
const toOrderItem = (item: CartItem): CreateOrderItem => ({
  productId: item.productId ?? item.id.split("-")[0],
  productName: item.name,
  size: item.size.replace(/^Size\s+/, "") as CreateOrderItem["size"],
  toppings: item.toppings,
  qty: item.quantity,
  unitPrice: item.price,
});

const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function CartProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );

  return (
    <CartContext.Provider value={{ cart, setCart: setCartState }}>
      {children}
    </CartContext.Provider>
  );
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

export default function HomePage() {
  return (
    <CartProvider>
      {/* useSearchParams cần Suspense khi build production */}
      <Suspense fallback={null}>
        <HomePageContent />
      </Suspense>
    </CartProvider>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsStatus, setProductsStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsRetry, setProductsRetry] = useState(0);
  const [screenOverride, setScreen] = useState<Screen | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState("M");
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

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setProductsStatus("loading");
      setProductsError(null);

      try {
        const res = await fetch(`${API_URL ?? "/api"}/products`, {
          headers: { "ngrok-skip-browser-warning": "1" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch products");
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid products response");
        }
        const mapped = data.map((value: unknown) => {
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
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
            stock: Number(item.stock ?? 0),
          };
        });
        if (!active) return;
        setProducts(mapped);
        setProductsStatus("loaded");
      } catch (error) {
        console.error("Lỗi fetch API:", error);
        if (!active) return;
        setProductsError(
          "Không thể tải menu lúc này. Vui lòng kiểm tra kết nối rồi thử lại.",
        );
        setProductsStatus("error");
      }
    };

    fetchProducts();
    return () => {
      active = false;
    };
  }, [productsRetry]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartItemCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart],
  );
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
    };

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === newItem.id);

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
          toppings: next[existingIndex].toppings,
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

    setCart((prev) => {
      const next = prev.flatMap((item) => {
        if (item.id !== itemId) return [item];
        const quantity = item.quantity + change;
        return quantity > 0 ? [{ ...item, quantity }] : [];
      });
      return next;
    });
  };

  const removeFromCart = (itemId: string) => {
    const remainingItems = cart.filter((item) => item.id !== itemId);
    if (remainingItems.length === 0) setScreen("menu");
    setCart(remainingItems);
  };

  const goBackToMenu = () => setScreen("menu");
  const goToCart = () => setScreen("cart");
  const goToLogin = () =>
    router.push(`/login?next=${encodeURIComponent("/?view=checkout")}`);

  // Luồng nghiệp vụ (Mục 5 đề bài): Xem giỏ → Đăng nhập (nếu chưa) → Thanh toán.
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

    const paid = await payOrder(
      orderId,
      simulateFailure ? "FAIL" : payment,
      newIdempotencyKey(),
    );
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
    <main className="min-h-screen bg-[#f3f3f3] px-4 py-6 text-[#0f172a] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-300">
        {screen === "menu" && (
          <section className="rounded-[28px] bg-transparent">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#d8dde4] pb-6">
              <div className="flex items-center gap-6 text-[#1f2937]">
                <Link href="/" className="text-[26px] font-black text-[#0a6b5f]">
                  Maycha
                </Link>
                <AuthNav className="text-[16px]" />
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/orders"
                  className="flex items-center gap-2 rounded-[18px] border border-[#0d8b7b] bg-[#dff5f0] px-5 py-3 text-[16px] font-semibold text-[#0a6b5f] shadow-sm transition hover:bg-[#cceed6]"
                >
                  📜 Đơn hàng & Lịch sử
                </Link>
                <button
                  onClick={goToCart}
                  className="flex items-center gap-3 rounded-[18px] border border-[#d7dfe6] bg-[#f5f7f8] px-5 py-3 text-[16px] font-medium text-[#1f2937] shadow-sm transition hover:bg-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3h7l1.5 9h8.5l-1.5 9H7.5L5 3H3zm3.5 15.5h8.5M8 7h8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Xem giỏ hàng ({cartItemCount})
                </button>
              </div>
            </header>

            <div className="mx-auto max-w-245 pt-2">
              <p className="mb-4 text-[18px] font-bold uppercase tracking-[0.08em] text-[#0f766e]">Menu hôm nay</p>
              <h1 className="mb-3 text-[62px] font-black leading-[0.95] tracking-tighter text-[#0f172a]">
                Chọn thức uống
              </h1>
              <p className="mb-10 text-[17px] text-[#4b5563]">
                Bốn món quen thuộc, được pha ngay sau khi bạn đặt.
              </p>

              {productsStatus === "loading" ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
                >
                  <span className="sr-only">Đang tải menu...</span>
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      aria-hidden="true"
                      className="min-h-100 animate-pulse rounded-3xl border border-[#d7dfe6] bg-[#f7f8f9] p-5"
                    >
                      <div className="mb-5 aspect-[4/3] rounded-2xl bg-[#e5e9ec]" />
                      <div className="mb-3 h-5 w-3/4 rounded bg-[#e5e9ec]" />
                      <div className="mb-6 h-5 w-1/3 rounded bg-[#e5e9ec]" />
                      <div className="h-12 rounded-2xl bg-[#e5e9ec]" />
                    </div>
                  ))}
                </div>
              ) : productsStatus === "error" ? (
                <div
                  role="alert"
                  className="rounded-3xl border border-red-200 bg-red-50 px-6 py-10 text-center"
                >
                  <p className="text-lg font-semibold text-red-800">
                    {productsError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductsRetry((attempt) => attempt + 1)}
                    className="mt-5 rounded-full bg-[#0a6b5f] px-6 py-3 font-semibold text-white transition hover:bg-[#085c51]"
                  >
                    Thử tải lại
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div
                  role="status"
                  className="rounded-3xl border border-[#d7dfe6] bg-[#f7f8f9] px-6 py-12 text-center"
                >
                  <p className="text-xl font-semibold text-[#1f2937]">
                    Menu hiện chưa có món nào.
                  </p>
                  <p className="mt-2 text-[#4b5563]">
                    Vui lòng quay lại sau để xem các món mới.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex min-h-100 flex-col justify-between rounded-3xl border border-[#d7dfe6] bg-[#f7f8f9] p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                    >
                      <div className="relative mb-5">
                        <ProductPhoto
                          product={product}
                          className="aspect-[4/3] w-full"
                        />
                        <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-sm font-bold text-[#475569] shadow-sm">
                          {product.code}
                        </div>
                      </div>

                      <div className="mb-6 flex flex-1 items-end justify-between gap-3">
                        <span className="text-[18px] font-semibold text-[#1f2937]">
                          {product.name}
                        </span>
                        <span className="text-[18px] font-semibold text-[#1f2937]">
                          {product.price.toLocaleString("vi-VN")}đ
                        </span>
                      </div>

                      <button
                        onClick={() => openDetail(product)}
                        className="rounded-2xl border-2 border-[#0d8b7b] bg-transparent px-4 py-3 text-[18px] font-semibold text-[#0d8b7b] transition hover:bg-[#eafaf7]"
                      >
                        Chọn món
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {screen === "detail" && selectedProduct && (
          <section className="mx-auto max-w-245 px-2 pb-8 pt-4">
            <button
              onClick={goBackToMenu}
              className="mb-8 flex items-center gap-3 text-[24px] font-medium text-[#0f172a]"
            >
              <span className="text-[30px]">←</span>
              <span>Quay lại Menu</span>
            </button>

            <div className="mx-auto max-w-190 text-center">
              <ProductPhoto
                product={selectedProduct}
                key={selectedProduct.id}
                className="mx-auto mb-8 aspect-[4/3] w-full max-w-105"
              />
              <h2 className="text-[64px] font-black tracking-tighter text-[#0f172a]">
                {selectedProduct.name}
              </h2>
              <p className="mt-3 text-[30px] font-semibold text-[#0f172a]">
                Giá hiện tại: {selectedItemPrice.toLocaleString("vi-VN")}đ
              </p>
            </div>

            <div className="mt-12 space-y-10">
              <div>
                <h3 className="mb-5 text-[30px] font-bold text-[#0f172a]">Size</h3>
                <div className="grid grid-cols-3 gap-6">
                  {['S', 'M', 'L'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`flex items-center justify-center rounded-[18px] border-2 px-6 py-5 text-[22px] font-semibold transition ${
                        selectedSize === size
                          ? "border-[#0d8b7b] bg-[#dff5f0] text-[#0f172a] shadow-sm"
                          : "border-[#d7dfe6] bg-[#f8fafb] text-[#0f172a]"
                      }`}
                    >
                      <span className="mr-3 inline-block h-5 w-5 rounded-full border-2 border-[#0d8b7b] bg-transparent relative">
                        {selectedSize === size && (
                          <span className="absolute inset-0.75 rounded-full bg-[#0d8b7b]" />
                        )}
                      </span>
                      {size} {getSizePriceDelta(size) > 0 && `(+${getSizePriceDelta(size) / 1000}k)`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-5 text-[30px] font-bold text-[#0f172a]">Topping</h3>
                <div className="grid grid-cols-2 gap-6">
                  {toppingOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => toggleTopping(option)}
                      className={`flex items-center justify-center rounded-[18px] border-2 px-6 py-5 text-[22px] font-semibold transition ${
                        selectedToppings.includes(option)
                          ? "border-[#0d8b7b] bg-[#dff5f0] text-[#0f172a]"
                          : "border-[#d7dfe6] bg-[#f8fafb] text-[#0f172a]"
                      }`}
                    >
                      <span className="mr-3 inline-block h-5 w-5 rounded-full border-2 border-[#0d8b7b] bg-transparent relative">
                        {selectedToppings.includes(option) && (
                          <span className="absolute inset-0.75 rounded-full bg-[#0d8b7b]" />
                        )}
                      </span>
                      {option} (+{toppingPrice / 1000}k)
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={addToCart}
                className="mt-8 w-full rounded-[18px] bg-[#0a6b5f] py-5 text-center text-[28px] font-bold text-white shadow-[0_8px_18px_rgba(15,118,110,0.25)] transition hover:bg-[#085c51]"
              >
                · Thêm vào giỏ ·
              </button>
            </div>
          </section>
        )}

        {screen === "cart" && (
          <section className="mx-auto max-w-275 px-2 pb-8 pt-4">
            <div className="mb-6">
              <p className="mb-3 text-[26px] font-bold uppercase tracking-[0.06em] text-[#0f766e]">Đơn hàng của bạn</p>
              <h1 className="text-[70px] font-black leading-[0.95] tracking-[-0.06em] text-[#0f172a]">
                Giỏ hàng
              </h1>
              <p className="mt-4 text-[18px] text-[#4b5563]">
                Kiểm tra lại món và số lượng trước khi thanh toán.
              </p>
            </div>

            <div className="rounded-3xl border border-[#d7dfe6] bg-[#f7f8f9] p-0 overflow-hidden">
              <div className="grid grid-cols-[1.6fr_1fr_0.7fr_0.6fr] items-center border-b border-[#d7dfe6] bg-transparent px-8 py-5 text-[18px] font-semibold uppercase tracking-[0.04em] text-[#5b6a7b]">
                <span>Tên món</span>
                <span>Phân loại</span>
                <span className="text-right">Số lượng</span>
                <span className="text-right">Xoá</span>
              </div>

              {cart.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.6fr_1fr_0.7fr_0.6fr] items-center gap-4 border-b border-[#d7dfe6] px-8 py-6 text-[24px] text-[#1f2937] last:border-b-0"
                >
                  <div>
                    <span className="font-bold">{item.name}</span>
                    {item.toppings.length > 0 && (
                      <div className="mt-2 text-[14px] text-[#4b5563]">
                        {item.toppings.join(", ")}
                      </div>
                    )}
                  </div>
                  <span>{item.size}</span>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, -1)}
                      aria-label={`Giảm số lượng ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7dfe6] bg-white text-[22px] font-semibold transition hover:bg-[#eafaf7]"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, 1)}
                      aria-label={`Tăng số lượng ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7dfe6] bg-white text-[22px] font-semibold transition hover:bg-[#eafaf7]"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="justify-self-end rounded-full border border-[#d7dfe6] bg-white px-3 py-1 text-[16px] font-semibold text-[#991b1b] transition hover:bg-[#fff1f2]"
                  >
                    Xoá
                  </button>
                </div>
              ))}

              <div className="border-t border-[#d7dfe6] px-8 pt-8 pb-5">
                <div className="flex items-center justify-end gap-4 text-[28px] font-bold text-[#0f172a]">
                  <span>Tổng</span>
                  <span>{total.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 px-8 pb-8 sm:flex-row">
                <button
                  onClick={goBackToMenu}
                  className="flex-1 rounded-2xl border-2 border-[#d7dfe6] bg-[#f8fafb] py-5 text-[24px] font-bold text-[#0f172a] transition hover:bg-white"
                >
                  Quay lại chọn món
                </button>
                <button
                  onClick={proceedToCheckout}
                  className="flex-1 rounded-2xl bg-[#0a6b5f] py-5 text-[24px] font-bold text-white shadow-[0_8px_18px_rgba(15,118,110,0.25)] transition hover:bg-[#085c51]"
                >
                  Tiến hành thanh toán
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "checkout" && (
          <section className="mx-auto max-w-245 px-2 pb-8 pt-8">
            <div className="mb-8 rounded-3xl border border-[#d7dfe6] bg-[#f7f8f9] p-10 text-center">
              <p className="mb-3 text-[20px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Bước cuối cùng</p>
              <h1 className="text-[58px] font-black leading-[0.9] tracking-tighter text-[#0f172a]">
                Thanh toán
              </h1>
            </div>

            <div className="mb-8 rounded-[18px] border border-[#d7dfe6] bg-[#f7f8f9] px-8 py-8 text-center">
              <p className="text-[22px] text-[#4b5563]">Số tiền cần trả</p>
              <p className="mt-2 text-[46px] font-black tracking-tighter text-[#0f172a]">
                Tổng: {total.toLocaleString("vi-VN")}đ
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="mb-3 text-[30px] font-bold text-[#0f172a]">Phương thức thanh toán</h3>

              {paymentMethods.map(({ label, method }) => (
                <button
                  key={method}
                  onClick={() => setPayment(method)}
                  className={`flex w-full items-center rounded-[18px] border-2 px-6 py-5 text-left text-[28px] font-semibold transition ${
                    payment === method
                      ? "border-[#0d8b7b] bg-[#dff5f0] text-[#0f172a]"
                      : "border-[#d7dfe6] bg-[#f8fafb] text-[#0f172a]"
                  }`}
                >
                  <span className="mr-4 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0d8b7b]">
                    {payment === method && <span className="h-3 w-3 rounded-full bg-[#0d8b7b]" />}
                  </span>
                  {label}
                </button>
              ))}

              <p className="mt-5 text-center text-[20px] text-[#6b7280]">Hệ thống không dùng tiền mặt</p>

              {/* Cổng thanh toán là mock: cho phép demo nhánh PAYMENT_FAILED */}
              <label className="flex items-center justify-center gap-3 text-[16px] text-[#6b7280]">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="h-4 w-4 accent-[#991b1b]"
                />
                Giả lập thanh toán lỗi (demo)
              </label>
            </div>

            {payError && (
              <p
                role="alert"
                className="mt-6 rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-center text-[18px] text-[#991b1b]"
              >
                {payError}
              </p>
            )}

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={goToCart}
                disabled={paying}
                className="flex-1 rounded-[18px] border-2 border-[#d7dfe6] bg-[#f8fafb] py-5 text-[24px] font-bold text-[#0f172a] transition hover:bg-white disabled:opacity-60"
              >
                Quay lại giỏ
              </button>
              <button
                onClick={confirmPayment}
                disabled={paying || cart.length === 0}
                className="flex-1 rounded-[18px] bg-[#0a6b5f] py-5 text-[24px] font-bold text-white shadow-[0_8px_18px_rgba(15,118,110,0.25)] transition hover:bg-[#085c51] disabled:opacity-60"
              >
                {paying ? "Đang thanh toán…" : "Xác nhận trả"}
              </button>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
