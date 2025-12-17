export const dynamic = "force-dynamic";

import SuccessClient from './SuccessClient';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  return <SuccessClient searchParams={resolvedSearchParams} />;
} 