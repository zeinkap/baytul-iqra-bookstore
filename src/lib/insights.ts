import { extractBookItems } from './stockManager';

/** Stalls are in the Atlanta area; "busiest hour" and "sales by day" use this clock, not the server's (UTC). */
export const STORE_TIME_ZONE = 'America/New_York';
/** Stripe's standard US card rate, used for an estimate only (the real fee is in your Stripe dashboard). */
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.3;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface InsightOrder {
  items: unknown;
  finalTotal: number;
  paidAt: Date;
  email: string | null;
  paymentMethod: string | null;
  device: string | null;
  source: string;
  location: string | null;
}
export interface InsightBook {
  id: string;
  title: string;
  stock: number;
  costPrice: number | null;
  createdAt: Date;
}
export interface InsightOptions {
  days: number;
  source: 'in-shop' | 'all';
  /** undefined = every venue, 'none' = untagged only, otherwise a venue slug */
  venue?: string;
  now?: Date;
}
export interface DeviceScanCount {
  device: string | null;
  count: number;
}

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

function clockParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    hour: Number(get('hour')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function computeInsights(
  allPaidOrders: InsightOrder[],
  books: InsightBook[],
  scansByDevice: DeviceScanCount[],
  options: InsightOptions
) {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000);
  const bookById = new Map(books.map((b) => [b.id, b]));

  const sourceOrders = allPaidOrders.filter((o) => options.source === 'all' || o.source === 'in-shop');
  const matchesVenue = (o: InsightOrder) =>
    options.venue === undefined ? true : options.venue === 'none' ? o.location === null : o.location === options.venue;
  const orders = sourceOrders.filter((o) => o.paidAt >= since && matchesVenue(o));

  // ---- Sales by time
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  const byWeekday = WEEKDAYS.map((day) => ({ day, orders: 0, revenue: 0 }));
  const dayKeys: string[] = [];
  const dayWindow = Math.min(options.days, 90);
  for (let i = dayWindow - 1; i >= 0; i--) dayKeys.push(clockParts(new Date(now.getTime() - i * 86_400_000)).date);
  const byDayMap = new Map(dayKeys.map((date) => [date, { date, orders: 0, revenue: 0 }]));
  for (const o of orders) {
    const c = clockParts(o.paidAt);
    byHour[c.hour].orders += 1;
    byHour[c.hour].revenue += o.finalTotal;
    byWeekday[c.weekday].orders += 1;
    byWeekday[c.weekday].revenue += o.finalTotal;
    const day = byDayMap.get(c.date);
    if (day) {
      day.orders += 1;
      day.revenue += o.finalTotal;
    }
  }
  const busiest = <T extends { orders: number; revenue: number }>(rows: T[]) =>
    rows.every((r) => r.orders === 0) ? null : rows.reduce((best, r) => (r.revenue > best.revenue ? r : best));

  // ---- Profit per sale
  let revenue = 0;
  let cost = 0;
  const missingCostBooks = new Set<string>();
  const perBook = new Map<string, { bookId: string; title: string; units: number; revenue: number; profit: number; costKnown: boolean }>();
  for (const o of orders) {
    revenue += o.finalTotal;
    for (const item of extractBookItems(o.items)) {
      const book = item.id ? bookById.get(item.id) : undefined;
      const known = book?.costPrice != null;
      if (item.id && !known) missingCostBooks.add(item.id);
      if (known) cost += (book!.costPrice as number) * item.quantity;
      const key = item.id ?? item.title;
      const row = perBook.get(key) ?? { bookId: key, title: book?.title ?? item.title, units: 0, revenue: 0, profit: 0, costKnown: known };
      row.units += item.quantity;
      row.revenue += item.price * item.quantity;
      row.profit += item.price * item.quantity - (known ? (book!.costPrice as number) * item.quantity : 0);
      perBook.set(key, row);
    }
  }
  const fees = orders.reduce((sum, o) => sum + o.finalTotal * STRIPE_PERCENT + STRIPE_FIXED, 0);
  const grossProfit = revenue - cost;
  const profit = {
    revenue: round(revenue),
    cost: round(cost),
    grossProfit: round(grossProfit),
    estimatedStripeFees: round(fees),
    profitAfterFees: round(grossProfit - fees),
    avgProfitPerOrder: orders.length ? round((grossProfit - fees) / orders.length) : 0,
    marginPercent: revenue > 0 ? round(((grossProfit - fees) / revenue) * 100, 1) : 0,
    booksMissingCost: missingCostBooks.size,
    perBook: [...perBook.values()]
      .map((r) => ({ ...r, revenue: round(r.revenue), profit: round(r.profit), profitPerCopy: r.costKnown && r.units ? round(r.profit / r.units) : null }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 15),
  };

  // ---- Basket size and repeat buyers
  const itemsPerOrder = orders.map((o) => extractBookItems(o.items).reduce((n, i) => n + i.quantity, 0));
  const ordersByBuyer = new Map<string, number>();
  for (const o of sourceOrders) {
    if (o.email) ordersByBuyer.set(o.email.toLowerCase(), (ordersByBuyer.get(o.email.toLowerCase()) ?? 0) + 1);
  }
  const buyersInWindow = new Set(orders.filter((o) => o.email).map((o) => (o.email as string).toLowerCase()));
  const repeatBuyers = [...buyersInWindow].filter((email) => (ordersByBuyer.get(email) ?? 0) >= 2).length;
  const baskets = {
    orders: orders.length,
    avgItemsPerOrder: orders.length ? round(itemsPerOrder.reduce((a, b) => a + b, 0) / orders.length) : 0,
    avgOrderValue: orders.length ? round(revenue / orders.length) : 0,
    distribution: {
      one: itemsPerOrder.filter((n) => n <= 1).length,
      two: itemsPerOrder.filter((n) => n === 2).length,
      threePlus: itemsPerOrder.filter((n) => n >= 3).length,
    },
    buyers: buyersInWindow.size,
    repeatBuyers,
    repeatRatePercent: buyersInWindow.size ? round((repeatBuyers / buyersInWindow.size) * 100, 1) : 0,
    ordersWithoutEmail: orders.filter((o) => !o.email).length,
  };

  // ---- Sell-through and restock (stock is shared, so this counts every paid sale at every venue)
  const sold = new Map<string, number>();
  for (const o of allPaidOrders.filter((x) => x.paidAt >= since)) {
    for (const item of extractBookItems(o.items)) {
      if (item.id) sold.set(item.id, (sold.get(item.id) ?? 0) + item.quantity);
    }
  }
  const weeks = options.days / 7;
  const stockRows = books.map((b) => {
    const unitsSold = sold.get(b.id) ?? 0;
    const perWeek = unitsSold / weeks;
    return {
      bookId: b.id,
      title: b.title,
      stock: b.stock,
      sold: unitsSold,
      perWeek: round(perWeek),
      weeksLeft: perWeek > 0 ? round(b.stock / perWeek, 1) : null,
      sellThroughPercent: unitsSold + b.stock > 0 ? round((unitsSold / (unitsSold + b.stock)) * 100, 1) : 0,
      costOfStock: b.costPrice != null ? round(b.costPrice * b.stock) : null,
      createdAt: b.createdAt,
    };
  });
  const restock = stockRows
    .filter((r) => r.sold > 0 && (r.stock === 0 || (r.weeksLeft !== null && r.weeksLeft <= 2)))
    .sort((a, b) => (a.weeksLeft ?? 0) - (b.weeksLeft ?? 0) || b.sold - a.sold)
    .slice(0, 25);
  const slowMovers = stockRows
    .filter((r) => r.stock > 0 && r.sold === 0 && r.createdAt < since)
    .sort((a, b) => (b.costOfStock ?? 0) - (a.costOfStock ?? 0) || b.stock - a.stock)
    .slice(0, 25);
  const strip = ({ createdAt: _createdAt, ...rest }: (typeof stockRows)[number]) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars
  const restockSection = {
    windowDays: options.days,
    restock: restock.map(strip),
    slowMovers: slowMovers.map(strip),
    top: stockRows
      .filter((r) => r.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10)
      .map(strip),
  };

  // ---- Payment method and device
  const methodCounts = new Map<string, { orders: number; revenue: number }>();
  const deviceOrders = new Map<string, number>();
  for (const o of orders) {
    const method = o.paymentMethod ?? 'unknown';
    const m = methodCounts.get(method) ?? { orders: 0, revenue: 0 };
    m.orders += 1;
    m.revenue += o.finalTotal;
    methodCounts.set(method, m);
    const d = o.device ?? 'unknown';
    deviceOrders.set(d, (deviceOrders.get(d) ?? 0) + 1);
  }
  const scansBy = new Map<string, number>();
  for (const s of scansByDevice) scansBy.set(s.device ?? 'unknown', (scansBy.get(s.device ?? 'unknown') ?? 0) + s.count);
  const deviceNames = new Set([...scansBy.keys(), ...deviceOrders.keys()]);
  const payments = {
    methods: [...methodCounts.entries()]
      .map(([method, v]) => ({ method, orders: v.orders, revenue: round(v.revenue), sharePercent: orders.length ? round((v.orders / orders.length) * 100, 1) : 0 }))
      .sort((a, b) => b.orders - a.orders),
    devices: [...deviceNames]
      .map((device) => {
        const scans = scansBy.get(device) ?? 0;
        const paid = deviceOrders.get(device) ?? 0;
        return { device, scans, orders: paid, conversionPercent: scans > 0 ? round((paid / scans) * 100, 1) : null };
      })
      .sort((a, b) => b.scans + b.orders - (a.scans + a.orders)),
  };

  return {
    range: { days: options.days, source: options.source, venue: options.venue ?? null },
    time: {
      byHour: byHour.map((h) => ({ ...h, revenue: round(h.revenue) })),
      byWeekday: byWeekday.map((d) => ({ ...d, revenue: round(d.revenue) })),
      byDay: [...byDayMap.values()].map((d) => ({ ...d, revenue: round(d.revenue) })),
      busiestHour: busiest(byHour),
      busiestWeekday: busiest(byWeekday),
    },
    profit,
    baskets,
    restock: restockSection,
    payments,
  };
}
