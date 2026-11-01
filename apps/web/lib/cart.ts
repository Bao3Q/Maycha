'use client';

import { createContext, createElement, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { CreateOrderItem } from './api';

/**
 * Giỏ hàng lưu ở localStorage, dùng chung cho mọi trang
 * (header ở trang Đơn hàng / Đăng nhập cũng thấy được số món).
 */

export type Size = 'S' | 'M' | 'L';

export type CartItem = {
  id: string;
  /** Id sản phẩm gửi lên POST /orders (giỏ cũ chưa có thì tách từ `id`). */
  productId?: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  toppings: string[];
  imageUrl?: string;
};

export const SIZES: Size[] = ['S', 'M', 'L'];
export const TOPPING_OPTIONS = ['Trân châu', 'Kem'];
export const TOPPING_PRICE = 5000;

export const getSizePriceDelta = (size: string) => {
  switch (size) {
    case 'M':
      return 5000;
    case 'L':
      return 10000;
    default:
      return 0;
  }
};

export const getAdjustedItemPrice = (basePrice: number, size: string, toppings: string[]) =>
  basePrice + getSizePriceDelta(size) + toppings.length * TOPPING_PRICE;

/** Món trong giỏ → dòng gửi lên POST /orders. */
export const toOrderItem = (item: CartItem): CreateOrderItem => ({
  productId: item.productId ?? item.id.split('-')[0],
  productName: item.name,
  size: item.size.replace(/^Size\s+/, '') as CreateOrderItem['size'],
  toppings: item.toppings,
  qty: item.quantity,
  unitPrice: item.price,
});

const cartStorageKey = 'maycha-cart';
type CartContextValue = {
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const isCartItem = (value: unknown): value is CartItem => {
  if (typeof value !== 'object' || value === null) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    (item.productId === undefined || typeof item.productId === 'string') &&
    (item.imageUrl === undefined || typeof item.imageUrl === 'string') &&
    typeof item.name === 'string' &&
    typeof item.size === 'string' &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.price === 'number' &&
    Array.isArray(item.toppings) &&
    item.toppings.every((topping) => typeof topping === 'string')
  );
};

/** Một Provider giữ state chung cho header và tất cả trang con. */
export function CartProvider({ children }: { children: ReactNode }) {
  // Giỏ rỗng ở server và lần render đầu giúp Next.js hydrate nhất quán.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restored: CartItem[] = [];
    try {
      const saved = window.localStorage.getItem(cartStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every(isCartItem)) {
          throw new Error('Saved cart contains invalid items');
        }
        restored = parsed;
      }
    } catch (error) {
      console.error('Không thể tải giỏ hàng đã lưu:', error);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- khôi phục state từ browser storage sau hydration
    setCart(restored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Không ghi [] đè giỏ cũ trước khi đọc localStorage xong.
    if (!hydrated) return;
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch (error) {
      console.error('Không thể lưu giỏ hàng:', error);
    }
  }, [cart, hydrated]);

  const value = useMemo(() => ({ cart, setCart }), [cart]);
  return createElement(CartContext.Provider, { value }, children);
}

/** Component đọc và cập nhật cùng state qua React Context. */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được sử dụng bên trong CartProvider');
  }
  return context;
}

export const cartCount = (cart: CartItem[]) =>
  cart.reduce((count, item) => count + item.quantity, 0);

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
