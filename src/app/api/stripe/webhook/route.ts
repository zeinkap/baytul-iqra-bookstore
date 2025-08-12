import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'Webhook endpoint is active',
    timestamp: new Date().toISOString(),
    message: 'Basic webhook endpoint is working'
  });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ 
    status: 'POST endpoint received',
    timestamp: new Date().toISOString(),
    message: 'Webhook POST endpoint is working'
  });
}
