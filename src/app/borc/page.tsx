"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, LogOut, Calendar, Banknote, Plus, Trash2, CircleDollarSign, MinusCircle, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEBT_CATEGORIES, DEFAULT_DEBT_CATEGORY } from "@/lib/finance-categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canonicalPersonKey } from "@/lib/person-name-key";

type Debt = {
  id: number;
  person_name: string;
  amount: string;
  description: string | null;
  currency?: "USD" | "TRY";
  category?: string;
  created_at?: string;
};

type Reduction = {
  id: number;
  person_name: string;
  amount: string;
  currency: "USD" | "TRY";
  category?: string;
  description: string | null;
  created_at?: string;
};

type Bucket = { debts: Debt[]; reductions: Reduction[] };

type PersonBuckets = {
  key: string;
  displayName: string;
  USD: Bucket;
  TRY: Bucket;
};

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const debtCurrency = (d: Debt): "USD" | "TRY" => (d.currency === "TRY" ? "TRY" : "USD");
const debtCategory = (item: Debt | Reduction): string => item.category?.trim() || DEFAULT_DEBT_CATEGORY;

const parseAmountInput = (value: string): number => {
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function bucketSums(b: Bucket) {
  const debtSum = b.debts.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const paidSum = b.reductions.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return { debtSum, paidSum, balance: debtSum - paidSum };
}

function buildPeople(debts: Debt[], reductions: Reduction[]): PersonBuckets[] {
  const m = new Map<string, PersonBuckets>();
  const emptyBucket = (): Bucket => ({ debts: [], reductions: [] });

  const pickDisplay = (prev: string, next: string) => {
    const a = prev.trim();
    const b = next.trim();
    if (!a) return b;
    if (!b) return a;
    // Daha uzun / daha çok harf içeren (Türkçe İ vb.) görünen adı tercih et
    if (b.length > a.length) return b;
    return a;
  };

  for (const d of debts) {
    const key = canonicalPersonKey(d.person_name);
    if (!key) continue;
    if (!m.has(key)) {
      m.set(key, { key, displayName: d.person_name.trim(), USD: emptyBucket(), TRY: emptyBucket() });
    }
    const p = m.get(key)!;
    p.displayName = pickDisplay(p.displayName, d.person_name);
    const cur = debtCurrency(d);
    p[cur].debts.push(d);
  }
  for (const r of reductions) {
    const key = canonicalPersonKey(r.person_name);
    if (!key) continue;
    if (!m.has(key)) {
      m.set(key, { key, displayName: r.person_name.trim(), USD: emptyBucket(), TRY: emptyBucket() });
    }
    const p = m.get(key)!;
    p.displayName = pickDisplay(p.displayName, r.person_name);
    const cur = r.currency === "TRY" ? "TRY" : "USD";
    p[cur].reductions.push(r);
  }

  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key, "tr", { sensitivity: "base" }));
}

function formatMoney(n: number, cur: "USD" | "TRY") {
  return cur === "USD" ? formatUsd(n) : `${formatNumberTr(n)} ₺`;
}

export default function BorcPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [reductions, setReductions] = useState<Reduction[]>([]);
  const [categories, setCategories] = useState<string[]>([...DEBT_CATEGORIES]);
  const [activeCategory, setActiveCategory] = useState<string>(DEBT_CATEGORIES[0]);
  const [personName, setPersonName] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reduceSelect, setReduceSelect] = useState("");
  const [reduceAmountGlobal, setReduceAmountGlobal] = useState("");
  const [reduceDescGlobal, setReduceDescGlobal] = useState("");
  const [reduceLoading, setReduceLoading] = useState(false);

  /** keyed by `${personKey}|USD` veya `|TRY` */
  const [cardReduce, setCardReduce] = useState<
    Record<string, { amount: string; desc: string; loading: boolean }>
  >({});

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

  const loadDebts = useCallback(async () => {
    try {
      const res = await fetch("/api/debts", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDebts(data);
        setReductions([]);
        setCategories([...DEBT_CATEGORIES]);
      } else {
        setDebts(Array.isArray(data.debts) ? data.debts : []);
        setReductions(Array.isArray(data.reductions) ? data.reductions : []);
        const loadedCategories = Array.isArray(data.categories)
          ? data.categories.map((c: unknown) => String(c).trim()).filter(Boolean)
          : [];
        setCategories(Array.from(new Set([...DEBT_CATEGORIES, ...loadedCategories])));
      }
    } catch {
      setDebts([]);
      setReductions([]);
      setCategories([...DEBT_CATEGORIES]);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (loggedIn) loadDebts();
  }, [loggedIn, loadDebts]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  const activeDebts = useMemo(
    () => debts.filter((d) => debtCategory(d) === activeCategory),
    [activeCategory, debts]
  );

  const activeReductions = useMemo(
    () => reductions.filter((r) => debtCategory(r) === activeCategory),
    [activeCategory, reductions]
  );

  const people = useMemo(() => buildPeople(activeDebts, activeReductions), [activeDebts, activeReductions]);

  const { grossUsd, paidUsd, netUsd, grossTry, paidTry, netTry } = useMemo(() => {
    const gUsd = activeDebts.filter((d) => debtCurrency(d) === "USD").reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const pUsd = activeReductions.filter((r) => r.currency !== "TRY").reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const gTry = activeDebts.filter((d) => debtCurrency(d) === "TRY").reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const pTry = activeReductions.filter((r) => r.currency === "TRY").reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      grossUsd: gUsd,
      paidUsd: pUsd,
      netUsd: gUsd - pUsd,
      grossTry: gTry,
      paidTry: pTry,
      netTry: gTry - pTry,
    };
  }, [activeDebts, activeReductions]);

  const reduceOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const p of people) {
      for (const cur of ["USD", "TRY"] as const) {
        const b = p[cur];
        if (b.debts.length === 0 && b.reductions.length === 0) continue;
        const { balance } = bucketSums(b);
        if (balance <= 0.0001) continue;
        const value = `${p.key}|${cur}`;
        const label = `${p.displayName} (${cur}) — kalan ${formatMoney(balance, cur)}`;
        opts.push({ value, label });
      }
    }
    return opts;
  }, [people]);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const cardKey = (personKey: string, cur: "USD" | "TRY") => `${personKey}|${cur}`;

  const getCardState = (k: string) =>
    cardReduce[k] ?? { amount: "", desc: "", loading: false };

  const setCardField = (k: string, patch: Partial<{ amount: string; desc: string; loading: boolean }>) => {
    setCardReduce((prev) => {
      const cur = prev[k] ?? { amount: "", desc: "", loading: false };
      return { ...prev, [k]: { ...cur, ...patch } };
    });
  };

  const applyReduction = async (
    personNameForApi: string,
    currency: "USD" | "TRY",
    amountStr: string,
    description: string | null,
    cardKeyOpt: string | null
  ) => {
    const amount = parseAmountInput(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Geçerli bir tutar girin.");
      return false;
    }
    setError(null);
    if (cardKeyOpt) setCardField(cardKeyOpt, { loading: true });
    else setReduceLoading(true);
    try {
      const res = await fetch("/api/debts/reduce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: personNameForApi,
          amount,
          currency,
          category: activeCategory,
          description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && (data as { error?: string }).error === "setup_required") {
        setError(
          (data as { message?: string }).message ??
            "Kurulum gerekli: bir kez POST /api/setup çalıştırın."
        );
        return false;
      }
      if (res.status === 400) {
        setError((data as { message?: string }).message ?? "Düşüm yapılamadı.");
        return false;
      }
      if (!res.ok) {
        setError("Düşüm kaydedilemedi.");
        return false;
      }
      if (cardKeyOpt) setCardField(cardKeyOpt, { amount: "", desc: "", loading: false });
      else {
        setReduceAmountGlobal("");
        setReduceDescGlobal("");
        setReduceSelect("");
      }
      await loadDebts();
      return true;
    } catch {
      setError("Düşüm kaydedilemedi.");
      return false;
    } finally {
      if (cardKeyOpt) setCardField(cardKeyOpt, { loading: false });
      else setReduceLoading(false);
    }
  };

  const handleAdd = async () => {
    const name = personName.trim();
    const amount = parseAmountInput(amountUsd);
    if (!name) {
      setError("Kişi adı girin.");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Geçerli bir dolar tutarı girin.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: name,
          amount,
          currency: "USD",
          category: activeCategory,
          description: desc.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && (data as { error?: string }).error === "setup_required") {
        setError("Borçlar için kurulum gerekli: bir kez POST /api/setup çalıştırın.");
        return;
      }
      if (!res.ok) {
        setError("Borç eklenemedi.");
        return;
      }
      setPersonName("");
      setAmountUsd("");
      setDesc("");
      await loadDebts();
    } catch {
      setError("Borç eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu borcu silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Silinemedi.");
      return;
    }
    setError(null);
    await loadDebts();
  };

  const handleDeleteReduction = async (id: number) => {
    if (!confirm("Bu düşüm kaydını silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/debts/reductions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Düşüm silinemedi.");
      return;
    }
    setError(null);
    await loadDebts();
  };

  const handleGlobalReduce = async () => {
    if (!reduceSelect.includes("|")) {
      setError("Önce kişi ve para birimini seçin.");
      return;
    }
    const [pKey, cur] = reduceSelect.split("|");
    const currency = cur === "TRY" ? "TRY" : "USD";
    await applyReduction(pKey, currency, reduceAmountGlobal, reduceDescGlobal.trim() || null, null);
  };

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
              <Link href="/">
                <Package className="mr-1 size-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ciro">
                <Calendar className="mr-1 size-4" />
                Ciro
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href="/borc">
                <Banknote className="size-4" />
                Borçlar
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/giderler">
                <ReceiptText className="size-4" />
                Giderler
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
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

      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Borçlar</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Borç kategorileri</CardTitle>
            <p className="text-xs text-muted-foreground">
              Borçlar kişi bazlı takip edilir; gider kategorileri ayrı Giderler sayfasındadır.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = category === activeCategory;
                const debtCount = debts.filter((d) => debtCategory(d) === category).length;
                return (
                  <Button
                    key={category}
                    type="button"
                    variant={isActive ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setActiveCategory(category)}
                    className="gap-2"
                  >
                    {category}
                    {debtCount > 0 && (
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {debtCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-primary/30">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">{activeCategory}</p>
            <p className="text-sm text-muted-foreground">Kalan borç (USD)</p>
            <p className={`text-3xl font-bold ${netUsd < -0.01 ? "text-amber-600" : "text-primary"}`}>
              {formatUsd(netUsd)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Brüt: {formatUsd(grossUsd)} · Düşülen: {formatUsd(paidUsd)}
            </p>
            {grossTry > 0 || paidTry > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Kalan (TRY — eski kayıtlar)</p>
                <p className={`text-xl font-semibold ${netTry < -0.01 ? "text-amber-600" : "text-foreground"}`}>
                  {formatNumberTr(netTry)} ₺
                </p>
                <p className="text-xs text-muted-foreground">
                  Brüt: {formatNumberTr(grossTry)} ₺ · Düşülen: {formatNumberTr(paidTry)} ₺
                </p>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {activeDebts.length} borç satırı · {activeReductions.length} düşüm
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6 border-border">
          <CardHeader>
            <CardTitle className="text-base">Borç düş (kişi seç)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Sadece {activeCategory} kategorisinde kalan borcu olan kişiler listelenir; tutar kalanı aşamaz.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Kişi ve para birimi</Label>
                <Select
                  value={reduceSelect || undefined}
                  onValueChange={(v) => setReduceSelect(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={reduceOptions.length ? "Seçin…" : "Kalan borcu olan kişi yok"} />
                  </SelectTrigger>
                  <SelectContent>
                    {reduceOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Düşülecek tutar</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={reduceAmountGlobal}
                  onChange={(e) => setReduceAmountGlobal(e.target.value)}
                  disabled={reduceOptions.length === 0}
                />
              </div>
              <div className="space-y-2">
                <Label>Not (isteğe bağlı)</Label>
                <Input
                  placeholder="Örn: nakit ödeme"
                  value={reduceDescGlobal}
                  onChange={(e) => setReduceDescGlobal(e.target.value)}
                  disabled={reduceOptions.length === 0}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={reduceLoading || !reduceSelect || reduceOptions.length === 0}
              onClick={() => void handleGlobalReduce()}
              className="gap-2"
            >
              <MinusCircle className="size-4" />
              {reduceLoading ? "Kaydediliyor…" : "Borcu düş"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Yeni borç ekle</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bu borç <span className="font-medium text-foreground">{activeCategory}</span> kategorisine kaydedilecek.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kişi</Label>
                <Input
                  placeholder="İsim"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Tutar (USD)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Açıklama</Label>
                <Textarea
                  rows={2}
                  placeholder="Örn: şunun için aldı, kredi kartı, avans…"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={() => void handleAdd()} disabled={loading} size="lg">
              <Plus className="size-4" />
              {loading ? "Kaydediliyor..." : "Borç ekle"}
            </Button>
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold tracking-tight">{activeCategory} kişi bazında özet</h2>
        <div className="space-y-4">
          {people.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Henüz kayıt yok.</CardContent>
            </Card>
          ) : (
            people.map((person) => {
              const usdB = bucketSums(person.USD);
              const tryB = bucketSums(person.TRY);
              const hasUsd = person.USD.debts.length > 0 || person.USD.reductions.length > 0;
              const hasTry = person.TRY.debts.length > 0 || person.TRY.reductions.length > 0;
              return (
              <Card key={person.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base uppercase">{person.displayName}</CardTitle>
                  {(hasUsd || hasTry) && (
                    <p className="text-xs text-muted-foreground">
                      {hasUsd && (
                        <span>
                          USD kalan:{" "}
                          <span className="font-semibold text-foreground">{formatUsd(usdB.balance)}</span>
                        </span>
                      )}
                      {hasUsd && hasTry && <span className="mx-2">·</span>}
                      {hasTry && (
                        <span>
                          TRY kalan:{" "}
                          <span className="font-semibold text-foreground">{formatNumberTr(tryB.balance)} ₺</span>
                        </span>
                      )}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {(["USD", "TRY"] as const).map((cur) => {
                    const b = person[cur];
                    if (b.debts.length === 0 && b.reductions.length === 0) return null;
                    const { debtSum, paidSum, balance } = bucketSums(b);
                    const ck = cardKey(person.key, cur);
                    const st = getCardState(ck);
                    return (
                      <div key={cur} className="rounded-lg border border-border/80 bg-muted/20 p-4">
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-muted-foreground">{cur}</span>
                          <div className="text-right text-sm">
                            <span className="text-muted-foreground">Borç: </span>
                            <span className="font-semibold">{formatMoney(debtSum, cur)}</span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="text-muted-foreground">Düşülen: </span>
                            <span className="font-semibold">{formatMoney(paidSum, cur)}</span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="text-muted-foreground">Kalan: </span>
                            <span className={`font-bold ${balance < -0.01 ? "text-amber-600" : "text-primary"}`}>
                              {formatMoney(balance, cur)}
                            </span>
                          </div>
                        </div>

                        {b.debts.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Borç satırları</p>
                            <ul className="space-y-2">
                              {b.debts.map((d) => (
                                <li
                                  key={d.id}
                                  className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-primary">{formatMoney(Number(d.amount), cur)}</p>
                                    {d.description && (
                                      <p className="text-xs text-muted-foreground">{d.description}</p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-destructive hover:text-destructive"
                                    onClick={() => void handleDelete(d.id)}
                                  >
                                    <Trash2 className="size-4" />
                                    Sil
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {b.reductions.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Düşüm kayıtları</p>
                            <ul className="space-y-2">
                              {b.reductions.map((r) => (
                                <li
                                  key={r.id}
                                  className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground">− {formatMoney(Number(r.amount), cur)}</p>
                                    {r.description && (
                                      <p className="text-xs text-muted-foreground">{r.description}</p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-destructive hover:text-destructive"
                                    onClick={() => void handleDeleteReduction(r.id)}
                                  >
                                    <Trash2 className="size-4" />
                                    Sil
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {balance > 0.0001 && (
                          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
                            <div className="grid flex-1 gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Bu kişiden düş</Label>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="0.01"
                                  placeholder="Tutar"
                                  value={st.amount}
                                  onChange={(e) => setCardField(ck, { amount: e.target.value })}
                                  disabled={st.loading}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Not</Label>
                                <Input
                                  placeholder="İsteğe bağlı"
                                  value={st.desc}
                                  onChange={(e) => setCardField(ck, { desc: e.target.value })}
                                  disabled={st.loading}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={st.loading}
                              className="gap-2 sm:mb-0"
                              onClick={() =>
                                void applyReduction(person.key, cur, st.amount, st.desc.trim() || null, ck)
                              }
                            >
                              <MinusCircle className="size-4" />
                              {st.loading ? "…" : "Düş"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
            })
          )}
        </div>
      </div>
    </div>
  );
}
