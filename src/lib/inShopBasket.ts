"use client";
import { useSyncExternalStore } from "react";

/**
 * The in-shop basket: books a customer has scanned and wants to pay for together. It lives in the browser
 * (localStorage) so it survives the trip to the camera and back; prices and stock are always re-read from the server.
 */
export type BasketLine = {
  id: string;
  /** What the QR label encodes (ISBN or book id), to link back to the book page */
  code: string;
  title: string;
  author: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
};

type Basket = { lines: BasketLine[]; location?: string; updatedAt: number };

const KEY = "inShopBasket:v1";
const EVENT = "in-shop-basket-change";
const MAX_PER_BOOK = 10;
const EXPIRES_AFTER_MS = 3 * 60 * 60 * 1000; // a shopping trip, not a saved cart
const EMPTY: Basket = { lines: [], updatedAt: 0 };

const clampQuantity = (quantity: number, stock: number) => Math.max(1, Math.min(quantity, stock, MAX_PER_BOOK));

// useSyncExternalStore needs a stable snapshot: re-parse only when the stored text changes
let cachedRaw: string | null = null;
let cachedBasket: Basket = EMPTY;

function read(): Basket {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedBasket;
    cachedRaw = raw;
    const parsed = raw ? (JSON.parse(raw) as Basket) : EMPTY;
    const fresh = parsed && Array.isArray(parsed.lines) && Date.now() - parsed.updatedAt < EXPIRES_AFTER_MS;
    cachedBasket = fresh ? parsed : EMPTY;
  } catch {
    cachedRaw = null;
    cachedBasket = EMPTY;
  }
  return cachedBasket;
}

function write(basket: Basket) {
  try {
    if (basket.lines.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify({ ...basket, updatedAt: Date.now() }));
  } catch {
    // private mode / storage full: the basket just won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback); // another tab
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** The basket, or an empty one on the server and during hydration. */
export function useInShopBasket(): Basket {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Adds copies of a book (merging with what's already there). Returns the quantity now in the basket. */
export function addToBasket(line: Omit<BasketLine, "quantity">, quantity: number, location?: string): number {
  const basket = read();
  const existing = basket.lines.find((l) => l.id === line.id);
  const nextQuantity = clampQuantity((existing?.quantity ?? 0) + quantity, line.stock);
  const lines = existing
    ? basket.lines.map((l) => (l.id === line.id ? { ...l, ...line, quantity: nextQuantity } : l))
    : [...basket.lines, { ...line, quantity: nextQuantity }];
  write({ lines, location: location ?? basket.location, updatedAt: Date.now() });
  return nextQuantity;
}

export function setBasketQuantity(id: string, quantity: number) {
  const basket = read();
  write({
    ...basket,
    lines: basket.lines.map((l) => (l.id === id ? { ...l, quantity: clampQuantity(quantity, l.stock) } : l)),
  });
}

export function removeFromBasket(id: string) {
  const basket = read();
  write({ ...basket, lines: basket.lines.filter((l) => l.id !== id) });
}

/** Applies fresh prices and stock from the server; drops books that can no longer be bought. */
export function refreshBasket(fresh: { lines: BasketLine[]; removed: string[] }) {
  const basket = read();
  const byId = new Map(fresh.lines.map((l) => [l.id, l]));
  const lines = basket.lines.flatMap((l) => {
    const next = byId.get(l.id);
    return next ? [{ ...l, ...next, quantity: clampQuantity(l.quantity, next.stock) }] : [];
  });
  write({ ...basket, lines });
}

export function clearBasket() {
  write(EMPTY);
}

export const basketCount = (lines: BasketLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
export const basketTotal = (lines: BasketLine[]) => lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
