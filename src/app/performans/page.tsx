"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  LogOut,
  Package,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Period = "week" | "month";

type PerformanceRow = {
  user_id: number | null;
  user_name: string;
  rate_percent: string;
  user_count: string;
  user_onay_count: string;
  user_patladi_count: string;
  user_total: string;
  user_onay: string;
  user_patladi: string;
  closer_count: string;
  closer_onay_count: string;
  closer_patladi_count: string;
  closer_total: string;
  closer_onay: string;
  closer_patladi: string;
};

type PerformanceData = {
  period: Period;
  offset: number;
  startDate: string;
  endDate: string;
  rows: PerformanceRow[];
  totals: {
    total_count: string;
    total_onay_count: string;
    total_patladi_count: string;
    total_amount: string;
  };
};

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const formatMoney = (value: number) => `${formatNumberTr(value)} ₺`;

const formatPercent = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);

const formatDate = (value: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(value + "T12:00:00").toLocaleDateString("tr-TR", opts ?? { day: "numeric", month: "long", year: "numeric" });

function periodLabel(data: PerformanceData | null) {
  if (!data) return "...";
  if (data.period === "month") {
    return formatDate(data.startDate, { month: "long", year: "numeric" });
  }
  return `${formatDate(data.startDate, { day: "numeric", month: "long" })} - ${formatDate(data.endDate, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

export default function PerformansPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

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
        const res = await fetch(`/api/performance?period=${period}&offset=${offset}`, { cache: "no-store" });
        setData(res.ok ? await res.json() : null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loggedIn, offset, period]);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const totals = useMemo(() => {
    const userTotal = data?.rows.reduce((s, r) => s + Number(r.user_total ?? 0), 0) ?? 0;
    const closerTotal = data?.rows.reduce((s, r) => s + Number(r.closer_total ?? 0), 0) ?? 0;
    const earnedTotal =
      data?.rows.reduce((s, r) => {
        const rate = Number(r.rate_percent ?? 0);
        const ciro = Number(r.user_total ?? 0) + Number(r.closer_total ?? 0);
        return s + (ciro * rate) / 100;
      }, 0) ?? 0;
    const grand = Number(data?.totals.total_amount ?? 0);
    return { userTotal, closerTotal, earnedTotal, grand };
  }, [data]);

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="space-y-4 text-center">
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/giderler" className="gap-2">
                <ReceiptText className="size-4" />
                Giderler
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/hakedis" className="gap-2">
                <CircleDollarSign className="size-4" />
                Hakediş
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/para-kime-gitti">
                <HandCoins className="size-4" />
                Para Kime Gitti
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href="/performans">
                <BarChart3 className="size-4" />
                Performans
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

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Performans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kişilerin kullanıcı ve kapatıcı rollerindeki ciro, işlem ve tahmini kazançları.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border p-1">
              {(["week", "month"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={period === p ? "secondary" : "ghost"}
                  onClick={() => {
                    setPeriod(p);
                    setOffset(0);
                  }}
                >
                  {p === "week" ? "Haftalık" : "Aylık"}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label="Önceki dönem">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[230px] text-center text-sm font-medium">{periodLabel(data)}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset >= 0}
              aria-label="Sonraki dönem"
            >
              <ChevronRight className="size-4" />
            </Button>
            {offset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
                Bu {period === "week" ? "hafta" : "ay"}
              </Button>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Toplam ciro</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.grand)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data?.totals.total_count ?? "0"} kayıt · {data?.totals.total_onay_count ?? "0"} onay ·{" "}
                {data?.totals.total_patladi_count ?? "0"} patladı
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kullanıcı cirosu</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.userTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Satışı alan kişi bazında</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kapatıcı cirosu</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.closerTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Satışı kapatan kişi bazında</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tahmini kazanç</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.earnedTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Ciro × hakediş yüzdesi</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kişi performansı</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
            ) : !data || data.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Bu dönemde kayıt yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Kişi</th>
                      <th className="px-3 py-3 font-medium">Hakediş</th>
                      <th className="px-3 py-3 font-medium">Kullanıcı cirosu</th>
                      <th className="px-3 py-3 font-medium">Kullanıcı dilimi</th>
                      <th className="px-3 py-3 font-medium">Kapatıcı cirosu</th>
                      <th className="px-3 py-3 font-medium">Kapatıcı dilimi</th>
                      <th className="px-3 py-3 font-medium">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((row) => {
                      const userTotal = Number(row.user_total ?? 0);
                      const closerTotal = Number(row.closer_total ?? 0);
                      const rate = Number(row.rate_percent ?? 0);
                      const userEarned = (userTotal * rate) / 100;
                      const closerEarned = (closerTotal * rate) / 100;
                      const impact = userTotal + closerTotal;
                      const earned = userEarned + closerEarned;
                      const userShare = totals.userTotal > 0 ? (userTotal / totals.userTotal) * 100 : 0;
                      const closerShare = totals.closerTotal > 0 ? (closerTotal / totals.closerTotal) * 100 : 0;
                      return (
                        <tr key={`${row.user_id ?? "none"}-${row.user_name}`} className="align-top">
                          <td className="px-3 py-3">
                            <p className="font-semibold uppercase text-foreground">{row.user_name}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">%{formatPercent(rate)}</p>
                            <p className="text-xs text-muted-foreground">Kazanç oranı</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">{formatMoney(userTotal)}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.user_count} iş · {row.user_onay_count} onay · {row.user_patladi_count} patladı
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">%{formatPercent(userShare)}</p>
                            <p className="text-xs text-muted-foreground">
                              Kazanç: {formatMoney(userEarned)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">{formatMoney(closerTotal)}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.closer_count} iş · {row.closer_onay_count} onay · {row.closer_patladi_count} patladı
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">%{formatPercent(closerShare)}</p>
                            <p className="text-xs text-muted-foreground">
                              Kazanç: {formatMoney(closerEarned)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-primary">{formatMoney(impact)}</p>
                            <p className="text-xs text-muted-foreground">
                              Kazanç: {formatMoney(earned)}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
