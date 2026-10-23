'use client';

import { type Dispatch, type SetStateAction, useSyncExternalStore } from 'react';
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
let cartSnapshot: CartItem[] = [];
let cartStoreInitialized = false;
const cartListeners = new Set<() => void>();
const emptyCart: CartItem[] = [];

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

const initializeCartStore = () => {
  if (cartStoreInitialized || typeof window === 'undefined') return;

  try {
    const savedCart = window.localStorage.getItem(cartStorageKey);
    if (savedCart) {
      const parsedCart: unknown = JSON.parse(savedCart);
      if (!Array.isArray(parsedCart)) {
        throw new Error('Saved cart data has an invalid format');
      }
      const validCart = parsedCart.filter(isCartItem);
      if (validCart.length !== parsedCart.length) {
        throw new Error('Saved cart contains invalid items');
      }
      cartSnapshot = validCart;
    }
  } catch (error) {
    console.error('Không thể tải giỏ hàng đã lưu:', error);
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

export const setCart: Dispatch<SetStateAction<CartItem[]>> = (action) => {
  initializeCartStore();
  cartSnapshot = typeof action === 'function' ? action(cartSnapshot) : action;

  try {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cartSnapshot));
  } catch (error) {
    console.error('Không thể lưu giỏ hàng:', error);
  }

  cartListeners.forEach((listener) => listener());
};

export function useCart() {
  const cart = useSyncExternalStore(subscribeToCart, getCartSnapshot, getServerCartSnapshot);
  return { cart, setCart };
}

export const cartCount = (cart: CartItem[]) =>
  cart.reduce((count, item) => count + item.quantity, 0);

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
