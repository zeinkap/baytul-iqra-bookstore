/** Fire-and-forget: tells the server a QR purchase attempt broke, so it shows up in Admin → QR Scans. */
export function reportScanFailure(code: string, event: 'buy-failed' | 'page-error', detail: string, location?: string) {
  try {
    fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, event, detail, location }),
      keepalive: true,
    }).catch(() => {
      // Tracking must never affect the customer
    });
  } catch {
    // ignore
  }
}
