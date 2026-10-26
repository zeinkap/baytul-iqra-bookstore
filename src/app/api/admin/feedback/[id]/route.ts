import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { FEEDBACK_STATUSES } from '@/lib/feedbackStatus';

// PATCH /api/admin/feedback/[id] { status: "new" | "in-progress" | "fulfilled" } - track a book request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!FEEDBACK_STATUSES.includes(body?.status)) {
    return NextResponse.json({ error: `status must be one of: ${FEEDBACK_STATUSES.join(', ')}` }, { status: 400 });
  }
  const updated = await prisma.feedback.updateMany({ where: { id }, data: { status: body.status } });
  if (updated.count === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  return NextResponse.json({ id, status: body.status });
}

// DELETE /api/admin/feedback/[id] - remove a request
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.feedback.deleteMany({ where: { id } });
  if (deleted.count === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
