"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  LogOut,
  Package,
  Plus,
  ReceiptText,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
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

type Expense = {
  id: number;
  label: string;
  kind: "percent" | "usd";
  value: number;
  amountTry: number;
};

type ProfitData = {
  date: string;
  revenueTry: number;
  hakedisTry: number;
  recipientSharesTry: number;
  expensesTry: number;
  netTry: number;
  expenses: Expense[];
  tryPerUsd: number;
  fxDate: string | null;
  fxError: string | null;
};

const todayInIstanbul = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const formatTry = (value: number) => new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(value);
const formatUsd = (value: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(value);

function getToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem("satistakip-token");
}

export default function GunlukKazancPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [date, setDate] = useState(todayInIstanbul);
  const [data, setData] = useState<ProfitData | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("unauthorized");
      const me = await response.json();
      setCurrentUserName(me.username ?? null);
      setLoggedIn(true);
    } catch {
      window.localStorage.removeItem("satistakip-token");
      setLoggedIn(false);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/daily-profit?date=${date}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("load_failed");
      setData(await response.json());
    } catch {
      setError("Günlük kazanç bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (loggedIn) void load();
  }, [loggedIn, load]);

  const addExpense = async () => {
    const token = getToken();
    const numericValue = Number(value.replace(",", "."));
    if (!token || !label.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Gider adı ve geçerli bir değer girin.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/daily-profit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date, label: label.trim(), value: numericValue }),
      });
      if (!response.ok) throw new Error("save_failed");
      setLabel("");
      setValue("");
      await load();
    } catch {
      setError("Gider kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: Expense) => {
    if (!window.confirm(`“${expense.label}” giderini silmek istediğinize emin misiniz?`)) return;
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(`/api/daily-profit/${expense.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("delete_failed");
      await load();
    } catch {
      setError("Gider silinemedi.");
    }
  };

  const shiftDate = (days: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(next.toLocaleDateString("en-CA"));
  };

  const logout = () => {
    window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const usdValue = (tryValue: number) => data && data.tryPerUsd > 0 ? tryValue / data.tryPerUsd : null;
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!loggedIn && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Giriş yapmanız gerekiyor.</p>
          <Button asChild><Link href="/">Girişe git</Link></Button>
        </div>
      </div>
    );
  }

  const summaryCards = [
    { label: "Toplam kazanılan", value: data?.revenueTry ?? 0, icon: ArrowUpRight, tone: "text-emerald-500" },
    { label: "Dağıtılan hakediş", value: data?.hakedisTry ?? 0, icon: HandCoins, tone: "text-amber-500" },
    { label: "Kişilere giden pay", value: data?.recipientSharesTry ?? 0, icon: ArrowDownRight, tone: "text-orange-500" },
    { label: "Diğer giderler", value: data?.expensesTry ?? 0, icon: ReceiptText, tone: "text-rose-500" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <Button variant="ghost" size="sm" asChild><Link href="/" className="gap-2"><Package className="size-4" />Dashboard</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/ciro" className="gap-2"><Calendar className="size-4" />Ciro</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/borc" className="gap-2"><Banknote className="size-4" />Borçlar</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/giderler" className="gap-2"><ReceiptText className="size-4" />Giderler</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/hakedis" className="gap-2"><CircleDollarSign className="size-4" />Hakediş</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/para-kime-gitti" className="gap-2"><HandCoins className="size-4" />Para Kime Gitti</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/performans" className="gap-2"><BarChart3 className="size-4" />Performans</Link></Button>
            <Button variant="secondary" size="sm" asChild><Link href="/gunluk-kazanc" className="gap-2"><TrendingUp className="size-4" />Günlük Kazanç</Link></Button>
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
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" />Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Günlük Net Kazanç</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Günlük cirodan hakedişleri, Para Kime Gitti paylarını ve dolar giderlerini düşer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="Önceki gün">
              <ChevronLeft className="size-4" />
            </Button>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[160px]" aria-label="Tarih" />
            <Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="Sonraki gün">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </header>

        {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <section aria-labelledby="summary-title">
          <h2 id="summary-title" className="mb-3 text-lg font-semibold">{dateLabel}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <Icon className={`size-5 ${card.tone}`} aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-2xl font-bold">{formatTry(card.value)} ₺</p>
                    {usdValue(card.value) !== null ? <p className="mt-1 text-xs text-muted-foreground">≈ {formatUsd(usdValue(card.value)!)} $</p> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Card className={data && data.netTry < 0 ? "border-destructive/50" : "border-emerald-500/40"}>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bize kalan net kazanç</p>
              <p className={`mt-1 text-4xl font-black tracking-tight ${data && data.netTry < 0 ? "text-destructive" : "text-emerald-500"}`}>
                {formatTry(data?.netTry ?? 0)} ₺
              </p>
              {data && usdValue(data.netTry) !== null ? <p className="mt-1 text-sm text-muted-foreground">≈ {formatUsd(usdValue(data.netTry)!)} $</p> : null}
            </div>
            <WalletCards className="size-12 text-emerald-500/70" aria-hidden="true" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Günlük gider ekle</CardTitle>
            <p className="text-sm text-muted-foreground">Gider açıklamasını ve dolar tutarını gir; sistem güncel kurla TL karşılığını hesaplar.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="expense-label">Gider adı</Label>
              <Input id="expense-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Reklam, araç, servis…" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-value">Dolar tutarı</Label>
              <Input
                id="expense-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="$0"
              />
            </div>
            <Button onClick={() => void addExpense()} disabled={saving}>
              <Plus className="size-4" />{saving ? "Ekleniyor…" : "Gider ekle"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gider dökümü</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p> : null}
            {!loading && data?.expenses.length === 0 ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">Bu gün için ek gider yok.</p> : null}
            {!loading && data && data.expenses.length > 0 ? (
              <div className="divide-y divide-border">
                {data.expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-medium">{expense.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {expense.kind === "percent" ? `Cironun %${formatTry(expense.value)} kadarı` : `${formatUsd(expense.value)} $`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-right font-semibold text-rose-500">−{formatTry(expense.amountTry)} ₺</p>
                      <Button variant="ghost" size="icon" onClick={() => void deleteExpense(expense)} aria-label={`${expense.label} giderini sil`}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Net = Toplam kazanılan − dağıtılan hakediş − kişilere giden pay − dolar giderleri.
          {data && data.tryPerUsd > 0 ? ` Kur: 1 $ = ${formatTry(data.tryPerUsd)} ₺${data.fxDate ? ` · ${data.fxDate}` : ""}.` : ""}
        </div>
      </main>
    </div>
  );
}
