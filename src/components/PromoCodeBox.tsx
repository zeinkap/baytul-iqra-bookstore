"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type PromoItem = { id: string; quantity: number };
type PromoResult = { code: string; key: string; discountCents: number; finalCents: number };

// Remembered for this visit only, so a code typed on the scan page is still applied on the basket page
const STORAGE_KEY = "inShopPromoCode";
const readStored = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeStored = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(STORAGE_KEY, code);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: the code just isn't remembered
  }
};

export type InShopPromo = {
  /** The one applied code, with what it takes off for exactly these items (null when none, or while re-checking) */
  applied: { code: string; discountCents: number; finalCents: number } | null;
  /** True while a code is applied and is being re-checked for changed items */
  checking: boolean;
  error: string;
  busy: boolean;
  apply: (code: string) => Promise<void>;
  remove: () => void;
};

/**
 * One promo code for an in-shop purchase. The server prices the items and works out the discount (the browser
 * never does), and the code is checked again whenever the items change. Only one code can be applied at a time:
 * remove it to try another.
 */
export function useInShopPromo(items: PromoItem[]): InShopPromo {
  const itemsKey = JSON.stringify(items.map((i) => [i.id, i.quantity]));
  const [code, setCode] = useState<string | null>(null);
  const [result, setResult] = useState<PromoResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const check = useCallback(async (candidate: string, key: string): Promise<PromoResult | { error: string }> => {
    const res = await fetch("/api/in-shop/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `key` is the JSON of [id, quantity] pairs, so the check always matches the items it is stored against
      body: JSON.stringify({ items: (JSON.parse(key) as [string, number][]).map(([id, quantity]) => ({ id, quantity })), code: candidate }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: typeof data.error === "string" ? data.error : "Could not check the code. Please try again." };
    return { code: data.code, key, discountCents: data.discountCents, finalCents: data.finalCents };
  }, []);

  const apply = useCallback(
    async (input: string) => {
      if (code) return; // one code at a time
      const candidate = input.trim();
      if (!candidate) {
        setError("Enter a promo code");
        return;
      }
      setBusy(true);
      setError("");
      const id = ++latest.current;
      try {
        const outcome = await check(candidate, itemsKey);
        if (id !== latest.current) return;
        if ("error" in outcome) {
          setError(outcome.error);
          return;
        }
        setCode(outcome.code);
        setResult(outcome);
        writeStored(outcome.code);
      } catch {
        if (id === latest.current) setError("Could not check the code. Please try again.");
      } finally {
        if (id === latest.current) setBusy(false);
      }
    },
    [code, check, itemsKey]
  );

  const remove = useCallback(() => {
    latest.current++;
    setCode(null);
    setResult(null);
    setError("");
    setBusy(false);
    writeStored(null);
  }, []);

  // A code remembered from the scan page, tried once as soon as there is something to price (the basket fills in after load)
  const restored = useRef(false);
  const hasItems = items.length > 0;
  useEffect(() => {
    if (restored.current || !hasItems) return;
    restored.current = true;
    const stored = readStored();
    if (!stored) return;
    const id = ++latest.current;
    check(stored, itemsKey)
      .then((outcome) => {
        if (id !== latest.current) return;
        if ("error" in outcome) {
          writeStored(null);
          return;
        }
        setCode(outcome.code);
        setResult(outcome);
      })
      .catch(() => {});
    // itemsKey is read once, at the moment the items first appear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasItems]);

  // The items changed (quantity, basket): the discount may too, or the code may no longer fit (e.g. a minimum order)
  useEffect(() => {
    if (!code || !result || result.key === itemsKey) return;
    const id = ++latest.current;
    check(code, itemsKey)
      .then((outcome) => {
        if (id !== latest.current) return;
        if ("error" in outcome) {
          setError(`Promo code removed: ${outcome.error}`);
          setCode(null);
          setResult(null);
          writeStored(null);
          return;
        }
        setResult(outcome);
      })
      .catch(() => {
        if (id !== latest.current) return;
        setCode(null);
        setResult(null);
        setError("Promo code removed: could not check it again.");
        writeStored(null);
      });
  }, [code, result, itemsKey, check]);

  const current = result && result.key === itemsKey ? result : null;
  return {
    applied: current ? { code: current.code, discountCents: current.discountCents, finalCents: current.finalCents } : null,
    checking: !!code && !current,
    error,
    busy,
    apply,
    remove,
  };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** "Have a promo code?" link that opens a one-code field; once applied it shows what the code takes off. */
export default function PromoCodeBox({ promo }: { promo: InShopPromo }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const showField = open || !!promo.error;

  if (promo.applied || promo.checking) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm flex items-center justify-between gap-2" data-testid="promo-applied">
        <span className="text-emerald-800">
          {promo.applied ? (
            <>
              <b>{promo.applied.code}</b> applied · −{money(promo.applied.discountCents)}
            </>
          ) : (
            "Checking your code…"
          )}
        </span>
        <button type="button" onClick={promo.remove} className="font-semibold text-emerald-800 underline" data-testid="promo-remove">
          Remove
        </button>
      </div>
    );
  }

  if (!showField) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-emerald-700 underline" data-testid="promo-open">
        Have a promo code?
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void promo.apply(input);
      }}
      className="text-left"
      data-testid="promo-form"
    >
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Promo code"
          aria-label="Promo code"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          data-testid="promo-input"
          className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3 py-2 text-base uppercase text-gray-900"
        />
        <button
          type="submit"
          disabled={promo.busy}
          data-testid="promo-apply"
          className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {promo.busy ? "Checking…" : "Apply"}
        </button>
      </div>
      {promo.error && (
        <p className="mt-1 text-sm text-red-600" role="alert" data-testid="promo-error">
          {promo.error}
        </p>
      )}
    </form>
  );
}
