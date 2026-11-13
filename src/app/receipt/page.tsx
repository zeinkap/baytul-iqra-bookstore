export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { extractBookItems } from "@/lib/stockManager";
import { similarBooks, popularBooks } from "@/lib/suggestions";
import BookSuggestions from "@/components/BookSuggestions";
import SuccessClient from "../checkout/success/SuccessClient";

/**
 * "You might also like" for the receipt. It runs its own database queries, so the page streams it in after the
 * receipt instead of making the paid screen wait for them.
 */
async function ReceiptSuggestions({ orderId }: { orderId?: string }) {
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, select: { items: true, location: true } }) : null;
  const location = order?.location ?? undefined;
  const bookId = order ? extractBookItems(order.items).find((i) => i.id)?.id : undefined;
  const book = bookId ? await prisma.book.findUnique({ where: { id: bookId }, include: { categories: { select: { id: true } } } }) : null;
  const suggestions = book ? await similarBooks(book) : await popularBooks();
  return <BookSuggestions title="You might also like" suggestions={suggestions} location={location} />;
}

/** Where Stripe sends in-shop (QR) buyers after paying: a focused receipt with "you might also like". */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const orderId = typeof resolved.orderId === "string" ? resolved.orderId : undefined;

  return (
    <SuccessClient
      searchParams={resolved}
      footer={
        <Suspense fallback={null}>
          <ReceiptSuggestions orderId={orderId} />
        </Suspense>
      }
    />
  );
}
