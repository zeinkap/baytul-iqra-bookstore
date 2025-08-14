import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const HIDDEN_LINKS_FILE = path.join(process.cwd(), 'data', 'hidden-payment-links.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(HIDDEN_LINKS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read hidden payment link IDs
async function readHiddenLinks(): Promise<string[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(HIDDEN_LINKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

// Write hidden payment link IDs
async function writeHiddenLinks(ids: string[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(HIDDEN_LINKS_FILE, JSON.stringify(ids, null, 2));
}

export async function GET() {
  try {
    const hiddenLinks = await readHiddenLinks();
    return NextResponse.json(hiddenLinks);
  } catch (error) {
    console.error('Error reading hidden payment links:', error);
    return NextResponse.json(
      { error: 'Failed to read hidden payment links' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { paymentLinkId } = await req.json();
    
    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      );
    }

    const hiddenLinks = await readHiddenLinks();
    
    if (!hiddenLinks.includes(paymentLinkId)) {
      hiddenLinks.push(paymentLinkId);
      await writeHiddenLinks(hiddenLinks);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment link hidden successfully',
      hiddenLinks
    });
  } catch (error) {
    console.error('Error hiding payment link:', error);
    return NextResponse.json(
      { error: 'Failed to hide payment link' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { paymentLinkId } = await req.json();
    
    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      );
    }

    const hiddenLinks = await readHiddenLinks();
    const updatedHiddenLinks = hiddenLinks.filter(id => id !== paymentLinkId);
    
    await writeHiddenLinks(updatedHiddenLinks);

    return NextResponse.json({
      success: true,
      message: 'Payment link unhidden successfully',
      hiddenLinks: updatedHiddenLinks
    });
  } catch (error) {
    console.error('Error unhiding payment link:', error);
    return NextResponse.json(
      { error: 'Failed to unhide payment link' },
      { status: 500 }
    );
  }
}
