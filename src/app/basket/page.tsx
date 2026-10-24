import type { Metadata } from "next";
import BasketClient from "./BasketClient";

export const metadata: Metadata = { title: "Your basket | Baytul Iqra Bookstore", robots: { index: false } };

/** In-shop basket: the books a customer scanned, paid for together with Apple Pay / Google Pay or card. */
export default function BasketPage() {
  return <BasketClient />;
}
