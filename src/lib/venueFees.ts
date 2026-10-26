import { prisma } from './prisma';
import { normalizeLocation } from './location';

const PREFIX = 'venue_fee:';
const MAX_FEE = 100_000;

/** Flat fees the shop pays to sell at a venue (e.g. a $50 bazaar stall), keyed by venue name. Set in Admin → Insights. */
export async function getVenueFees(): Promise<Record<string, number>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: PREFIX } } });
  const fees: Record<string, number> = {};
  for (const row of rows) {
    const amount = Number(row.value);
    if (Number.isFinite(amount) && amount > 0) fees[row.key.slice(PREFIX.length)] = amount;
  }
  return fees;
}

/** Sets (or, with null / 0, clears) a venue's flat fee. Returns false when the venue name or amount is not valid. */
export async function setVenueFee(venueInput: unknown, feeInput: unknown): Promise<boolean> {
  const venue = normalizeLocation(venueInput);
  if (!venue) return false;
  const key = `${PREFIX}${venue}`;
  const clearing = feeInput === null || feeInput === '' || Number(feeInput) === 0;
  if (clearing) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return true;
  }
  const fee = Number(feeInput);
  if (!Number.isFinite(fee) || fee < 0 || fee > MAX_FEE) return false;
  const value = String(Math.round(fee * 100) / 100);
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return true;
}
