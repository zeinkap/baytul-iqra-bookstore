"use client";
import { useEffect } from "react";

/** Records a scan once per browser session per code (so refreshes and re-renders don't inflate counts). */
export default function ScanLogger({ code }: { code: string }) {
  useEffect(() => {
    const key = `scan:${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable: log anyway
    }
    fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {
      // Tracking must never affect the customer
    });
  }, [code]);
  return null;
}
