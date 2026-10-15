export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { extractBookItems } from "@/lib/stockManager";
import { similarBooks, popularBooks } from "@/lib/suggestions";
import BookSuggestions from "@/components/BookSuggestions";
import SuccessClient from "../checkout/success/SuccessClient";

/** Where Stripe sends in-shop (QR) buyers after paying: a focused receipt with "you might also like". */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const orderId = typeof resolved.orderId === "string" ? resolved.orderId : undefined;

  let suggestions = await popularBooks();
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { items: true } });
    const bookId = order ? extractBookItems(order.items).find((i) => i.id)?.id : undefined;
    const book = bookId
      ? await prisma.book.findUnique({ where: { id: bookId }, include: { categories: { select: { id: true } } } })
      : null;
    if (book) suggestions = await similarBooks(book);
  }

  return (
    <SuccessClient
      searchParams={resolved}
      footer={<BookSuggestions title="You might also like" suggestions={suggestions} />}
    />
  );
}
