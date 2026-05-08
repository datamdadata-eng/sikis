"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function formatIstanbulDateTime(): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

type FxPayload = {
  tryPerUsd: number;
  fxDate: string | null;
  fxError: string | null;
  refetchedAt: string;
};

export function LiveFxBar() {
  const [fx, setFx] = useState<FxPayload | null>(null);
  const [clock, setClock] = useState(formatIstanbulDateTime);

  const loadFx = useCallback(async () => {
    try {
      const res = await fetch("/api/fx", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as FxPayload;
        if (d.tryPerUsd > 0) setFx(d);
      }
    } catch {
      /* önceki kur korunur */
    }
  }, []);

  useEffect(() => {
    void loadFx();
    const fxId = setInterval(() => void loadFx(), 1000);
    const clockId = setInterval(() => setClock(formatIstanbulDateTime()), 1000);
    return () => {
      clearInterval(fxId);
      clearInterval(clockId);
    };
  }, [loadFx]);

  return (
    <div className="border-b border-border bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs text-muted-foreground sm:px-4 sm:text-sm">
        <CircleDollarSign className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden />
        {fx != null && fx.tryPerUsd > 0 && !fx.fxError ? (
          <>
            <span>
              Güncel kur (Frankfurter, her saniye):{" "}
              <strong className="text-foreground">1 USD = {formatNumberTr(fx.tryPerUsd)} ₺</strong>
            </span>
            {fx.fxDate && (
              <span className="text-muted-foreground">
                · Kur tabanı: <span className="text-foreground">{fx.fxDate}</span>
              </span>
            )}
            <span className="text-muted-foreground">
              · İstanbul: <span className="font-medium tabular-nums text-foreground">{clock}</span>
            </span>
          </>
        ) : (
          <span className="text-amber-700 dark:text-amber-500">
            Kur yükleniyor veya alınamıyor; her saniye yenilenir… ({clock})
          </span>
        )}
      </div>
    </div>
  );
}
