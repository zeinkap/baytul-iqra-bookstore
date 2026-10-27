import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { buildDailySummary } from '@/lib/dailySummary';
import { sendDailySummaryEmail } from '@/lib/sendEmail';

// GET /api/cron/daily-summary - emails the shop the last month (scheduled in vercel.json).
// Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`. An admin can also call it from the browser:
//   ?preview=1  shows the email without sending,   ?force=1  sends even on a quiet month.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  const fromAdmin = await isAdminRequest(req);
  if (!fromCron && !fromAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await buildDailySummary();
  if (fromAdmin && req.nextUrl.searchParams.get('preview') === '1') {
    return new NextResponse(summary.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (!summary.hasActivity && !(fromAdmin && req.nextUrl.searchParams.get('force') === '1')) {
    return NextResponse.json({ sent: false, reason: 'No activity in the last month' });
  }

  const result = await sendDailySummaryEmail(summary);
  if (result.error) {
    console.error('Monthly summary email failed:', result.error);
    return NextResponse.json({ sent: false, error: 'Email provider rejected the message' }, { status: 502 });
  }
  return NextResponse.json({ sent: true, ...summary.stats });
}
