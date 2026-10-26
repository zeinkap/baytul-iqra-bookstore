import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getVenueFees, setVenueFee } from '@/lib/venueFees';

// GET /api/admin/venue-fees - flat fees per venue, e.g. { "bazaar-oct": 50 }
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ fees: await getVenueFees() });
}

// PUT /api/admin/venue-fees { venue: "bazaar-oct", fee: 50 | null } - set or clear a venue's flat fee
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!(await setVenueFee(body?.venue, body?.fee))) {
    return NextResponse.json({ error: 'Use a venue name like bazaar-oct and a fee between $0 and $100,000' }, { status: 400 });
  }
  return NextResponse.json({ fees: await getVenueFees() });
}
