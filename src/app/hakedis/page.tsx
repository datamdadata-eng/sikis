"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, LogOut, Calendar, Banknote, ChevronLeft, ChevronRight, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

type SalesRow = {
  user_id: number;
  user_name: string;
  total_amount: string;
  percentage: number;
  hakedis_try: string;
};

type CloserRow = {
  closer_id: number;
  closer_name: string;
  total_amount: string;
  percentage: number;
  hakedis_try: string;
};

type HakedisExtras = {
  weekTotalTry: string;
  weekTotalPercent: number;
  jinPercent: number;
  arsimetPercent: number;
  jinHakedisTry: string;
  arsimetHakedisTry: string;
};

type HakedisData = {
  weekStart: string;
  weekEnd: string;
  weekOffset: number;
  users: SalesRow[];
  closers: CloserRow[];
  extras?: HakedisExtras;
  tryPerUsd: number;
  fxDate: string | null;
  fxError: string | null;
};

export default function HakedisPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<HakedisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("satistakip-token");
    if (!token) {
      setLoggedIn(false);
      return;
    }
    try {
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const me = await res.json();
        setLoggedIn(true);
        setCurrentUserName(me.username ?? null);
      } else {
        window.localStorage.removeItem("satistakip-token");
        setLoggedIn(false);
      }
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!loggedIn) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hakedis?weekOffset=${weekOffset}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
        else setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn, weekOffset]);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const tryToUsd = (tryAmount: number) => {
    if (!data?.tryPerUsd || data.tryPerUsd <= 0) return null;
    return tryAmount / data.tryPerUsd;
  };

  const saveRate = async (opts: {
    weekStart: string;
    userId: number;
    role: "sales" | "closer";
    percentage: number;
  }) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("satistakip-token") : null;
    if (!token) return;
    const key = `${opts.userId}:${opts.role}`;
    setSavingKey(key);
    try {
      const res = await fetch("/api/hakedis/rate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          weekStart: opts.weekStart,
          userId: opts.userId,
          role: opts.role,
          percentage: opts.percentage,
        }),
      });
      if (res.ok) {
        const refresh = await fetch(`/api/hakedis?weekOffset=${weekOffset}`, { cache: "no-store" });
        if (refresh.ok) setData(await refresh.json());
      }
    } finally {
      setSavingKey(null);
    }
  };

  const saveExtras = async (partial: {
    weekTotalPercent?: number;
    jinPercent?: number;
    arsimetPercent?: number;
  }) => {
    if (!data) return;
    const token = typeof window !== "undefined" ? window.localStorage.getItem("satistakip-token") : null;
    if (!token) return;
    const sk =
      partial.weekTotalPercent !== undefined
        ? "extras:week"
        : partial.jinPercent !== undefined
          ? "extras:jin"
          : "extras:arsimet";
    setSavingKey(sk);
    try {
      const res = await fetch("/api/hakedis/extras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          weekStart: data.weekStart,
          ...partial,
        }),
      });
      if (res.ok) {
        const refresh = await fetch(`/api/hakedis?weekOffset=${weekOffset}`, { cache: "no-store" });
        if (refresh.ok) setData(await refresh.json());
      }
    } finally {
      setSavingKey(null);
    }
  };

  const weekLabel =
    data?.weekStart && data?.weekEnd
      ? `${new Date(data.weekStart + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${new Date(data.weekEnd + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`
      : "";

  const totalUsersTry =
    data?.users.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) ?? 0;
  const totalClosersTry =
    data?.closers.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) ?? 0;

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Giriş yapmanız gerekiyor.</p>
          <Button asChild>
            <Link href="/">Girişe git</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <Package className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ciro" className="gap-2">
                <Calendar className="size-4" />
                Ciro
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/borc" className="gap-2">
                <Banknote className="size-4" />
                Borçlar
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href="/hakedis">
                <CircleDollarSign className="size-4" />
                Hakediş
              </Link>
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {currentUserName?.charAt(0).toUpperCase() ?? "A"}
                </span>
                {currentUserName ?? "Admin"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hakediş</h1>
            <p className="text-sm text-muted-foreground">
              Haftalık (İstanbul Pazartesi–Pazar): Her satış yapan ve kapatıcı için ayrı hakediş % siz kaydedersiniz;
              tutar her hafta o kişinin cirosundan otomatik hesaplanır. JIN ve ARSIMET, haftanın tüm satış toplamı üzerinden
              % ile hesaplanır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Önceki hafta">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[200px] text-center text-sm font-medium text-foreground">{weekLabel || "…"}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
              aria-label="Sonraki hafta"
            >
              <ChevronRight className="size-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                Bu hafta
              </Button>
            )}
          </div>
        </div>

        {data && data.tryPerUsd > 0 && (
          <Card className="mb-6 border-border/80 bg-muted/20">
            <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm text-muted-foreground">
              <CircleDollarSign className="size-4 text-primary" />
              <span>
                Güncel kur (Frankfurter, her yüklemede API):{" "}
                <strong className="text-foreground">1 USD = {formatNumberTr(data.tryPerUsd)} ₺</strong>
                {data.fxDate && <span className="ml-1">({data.fxDate})</span>}
              </span>
            </CardContent>
          </Card>
        )}
        {data?.fxError && data.tryPerUsd <= 0 && (
          <p className="mb-4 text-xs text-amber-600">Dolar kuru alınamadı; sadece TL gösteriliyor.</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {(() => {
              const ex = data.extras ?? {
                weekTotalTry: "0",
                weekTotalPercent: 0,
                jinPercent: 0,
                arsimetPercent: 0,
                jinHakedisTry: "0",
                arsimetHakedisTry: "0",
              };
              const wtt = Number(ex.weekTotalTry);
              const usdWeek = tryToUsd(wtt);
              return (
                <Card className="border-primary/25">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">JIN · ARSIMET · hafta toplamı</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Bu haftanın <strong className="text-foreground">tüm satış</strong> toplamı (tüm satırlar) üzerinden
                      JIN ve ARSIMET hakediş %. Haftalık toplam % alanı yalnızca kayıt / not (hakediş hesabına girmez).
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                      <p className="text-muted-foreground">Hafta satış toplamı (tüm satırlar)</p>
                      <p className="text-xl font-bold text-primary">{formatNumberTr(wtt)} ₺</p>
                      {usdWeek != null && (
                        <p className="text-xs text-muted-foreground">{formatUsd(usdWeek)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Haftalık toplam % (kayıt)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          className="h-9 w-28"
                          defaultValue={ex.weekTotalPercent}
                          key={`${data.weekStart}-week-total-${ex.weekTotalPercent}`}
                          disabled={savingKey === "extras:week"}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isNaN(v) || v < 0 || v > 100) {
                              e.target.value = String(ex.weekTotalPercent);
                              return;
                            }
                            if (Math.abs(v - ex.weekTotalPercent) < 1e-6) return;
                            void saveExtras({ weekTotalPercent: v });
                          }}
                        />
                      </div>
                    </div>
                    <div className="hidden border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                      <span>İsim</span>
                      <span className="text-right">Haftalık ciro (toplam)</span>
                      <span className="text-center">Hakediş %</span>
                      <span className="text-right">Hakediş tutarı</span>
                    </div>
                    {(["JIN", "ARSIMET"] as const).map((name, idx) => {
                      const pct = name === "JIN" ? ex.jinPercent : ex.arsimetPercent;
                      const hk = name === "JIN" ? Number(ex.jinHakedisTry) : Number(ex.arsimetHakedisTry);
                      const saveKey = name === "JIN" ? "extras:jin" : "extras:arsimet";
                      const usdHakedis = tryToUsd(hk);
                      return (
                        <div
                          key={name}
                          className={`flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3 ${idx > 0 ? "border-t border-border" : ""}`}
                        >
                          <span className="font-semibold uppercase text-foreground">{name}</span>
                          <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                            <span className="text-xs text-muted-foreground sm:hidden">Ciro</span>
                            <p className="font-bold text-primary">{formatNumberTr(wtt)} ₺</p>
                            {usdWeek != null && (
                              <p className="text-xs text-muted-foreground sm:text-right">{formatUsd(usdWeek)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground sm:hidden">Hakediş %</span>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              className="h-9 w-24"
                              defaultValue={pct}
                              key={`${data.weekStart}-${name}-${pct}`}
                              disabled={savingKey === saveKey}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isNaN(v) || v < 0 || v > 100) {
                                  e.target.value = String(pct);
                                  return;
                                }
                                if (Math.abs(v - pct) < 1e-6) return;
                                void saveExtras(name === "JIN" ? { jinPercent: v } : { arsimetPercent: v });
                              }}
                            />
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{formatNumberTr(hk)} ₺</p>
                            {usdHakedis != null && (
                              <p className="text-xs text-muted-foreground">{formatUsd(usdHakedis)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })()}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Satış yapan</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Haftalık ciro toplamı: {formatNumberTr(totalUsersTry)} ₺ — her kişi için ayrı % kaydı; tutar otomatik.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                    <span>İsim</span>
                    <span className="text-right">Haftalık ciro</span>
                    <span className="text-center">Hakediş %</span>
                    <span className="text-right">Hakediş tutarı</span>
                  </div>
                  <div className="divide-y divide-border">
                    {data.users.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu hafta kayıt yok.</p>
                    ) : (
                      data.users.map((r) => {
                        const tl = Number(r.total_amount);
                        const hk = Number(r.hakedis_try);
                        const usdCiro = tryToUsd(tl);
                        const usdHakedis = tryToUsd(hk);
                        const saveKey = `${r.user_id}:sales`;
                        return (
                          <div
                            key={r.user_id}
                            className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3"
                          >
                            <span className="font-semibold uppercase text-foreground">{r.user_name}</span>
                            <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                              <span className="text-xs text-muted-foreground sm:hidden">Ciro</span>
                              <p className="font-bold text-primary">{formatNumberTr(tl)} ₺</p>
                              {usdCiro != null && (
                                <p className="text-xs text-muted-foreground sm:text-right">{formatUsd(usdCiro)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground sm:hidden">Hakediş %</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className="h-9 w-24"
                                defaultValue={r.percentage}
                                key={`${data.weekStart}-${r.user_id}-sales-${r.percentage}`}
                                disabled={savingKey === saveKey}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isNaN(v) || v < 0 || v > 100) {
                                    e.target.value = String(r.percentage);
                                    return;
                                  }
                                  if (Math.abs(v - r.percentage) < 1e-6) return;
                                  void saveRate({
                                    weekStart: data.weekStart,
                                    userId: r.user_id,
                                    role: "sales",
                                    percentage: v,
                                  });
                                }}
                              />
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-foreground">{formatNumberTr(hk)} ₺</p>
                              {usdHakedis != null && (
                                <p className="text-xs text-muted-foreground">{formatUsd(usdHakedis)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Kapatıcı</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Haftalık ciro toplamı: {formatNumberTr(totalClosersTry)} ₺ — her kişi için ayrı %; tutar otomatik.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                    <span>İsim</span>
                    <span className="text-right">Haftalık ciro</span>
                    <span className="text-center">Hakediş %</span>
                    <span className="text-right">Hakediş tutarı</span>
                  </div>
                  <div className="divide-y divide-border">
                    {data.closers.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu hafta kapatıcı kaydı yok.</p>
                    ) : (
                      data.closers.map((r) => {
                        const tl = Number(r.total_amount);
                        const hk = Number(r.hakedis_try);
                        const usdCiro = tryToUsd(tl);
                        const usdHakedis = tryToUsd(hk);
                        const saveKey = `${r.closer_id}:closer`;
                        return (
                          <div
                            key={r.closer_id}
                            className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3"
                          >
                            <span className="font-semibold uppercase text-foreground">{r.closer_name}</span>
                            <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                              <span className="text-xs text-muted-foreground sm:hidden">Ciro</span>
                              <p className="font-bold text-primary">{formatNumberTr(tl)} ₺</p>
                              {usdCiro != null && (
                                <p className="text-xs text-muted-foreground sm:text-right">{formatUsd(usdCiro)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground sm:hidden">Hakediş %</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className="h-9 w-24"
                                defaultValue={r.percentage}
                                key={`${data.weekStart}-${r.closer_id}-closer-${r.percentage}`}
                                disabled={savingKey === saveKey}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isNaN(v) || v < 0 || v > 100) {
                                    e.target.value = String(r.percentage);
                                    return;
                                  }
                                  if (Math.abs(v - r.percentage) < 1e-6) return;
                                  void saveRate({
                                    weekStart: data.weekStart,
                                    userId: r.closer_id,
                                    role: "closer",
                                    percentage: v,
                                  });
                                }}
                              />
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-foreground">{formatNumberTr(hk)} ₺</p>
                              {usdHakedis != null && (
                                <p className="text-xs text-muted-foreground">{formatUsd(usdHakedis)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Veri yüklenemedi.</p>
        )}
      </div>
    </div>
  );
}
