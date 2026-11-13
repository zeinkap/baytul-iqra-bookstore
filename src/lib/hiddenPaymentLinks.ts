import { prisma } from './prisma';

const PREFIX = 'hidden_payment_link:';

/** IDs of Stripe payment links hidden from the admin list (they still exist in Stripe). Stored in AppSetting because serverless filesystems are read-only. */
export async function getHiddenPaymentLinks(): Promise<string[]> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: PREFIX } },
    orderBy: { updatedAt: 'asc' },
  });
  return rows.map((row) => row.key.slice(PREFIX.length));
}

export async function hidePaymentLink(id: string): Promise<void> {
  const key = `${PREFIX}${id}`;
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: '1' }, update: {} });
}

export async function unhidePaymentLink(id: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: `${PREFIX}${id}` } });
}
