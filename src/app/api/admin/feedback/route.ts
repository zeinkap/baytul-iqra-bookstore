import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

// GET /api/admin/feedback - recent customer book requests and comments
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const feedback = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return NextResponse.json({ feedback });
}
