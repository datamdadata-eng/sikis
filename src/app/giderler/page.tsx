"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Calendar, CircleDollarSign, LogOut, Package, Plus, ReceiptText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_EXPENSE_CATEGORY, EXPENSE_CATEGORIES } from "@/lib/finance-categories";

type Expense = {
  id: number;
  category: string;
  amount: string;
  note: string | null;
  created_at?: string;
};

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const expenseCategory = (expense: Expense) => expense.category?.trim() || DEFAULT_EXPENSE_CATEGORY;

const parseAmountInput = (value: string): number => {
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export default function GiderlerPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);
  const [activeCategory, setActiveCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses", { cache: "no-store" });
      const data = await res.json();
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      const loadedCategories = Array.isArray(data.categories)
        ? data.categories.map((c: unknown) => String(c).trim()).filter(Boolean)
        : [];
      setCategories(Array.from(new Set([...EXPENSE_CATEGORIES, ...loadedCategories])));
    } catch {
      setExpenses([]);
      setCategories([...EXPENSE_CATEGORIES]);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (loggedIn) loadExpenses();
  }, [loggedIn, loadExpenses]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expenseCategory(expense) === activeCategory),
    [activeCategory, expenses]
  );

  const totalsByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const category = expenseCategory(expense);
      totals.set(category, (totals.get(category) ?? 0) + Number(expense.amount ?? 0));
    }
    return totals;
  }, [expenses]);

  const activeTotal = activeExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const grandTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const handleAdd = async () => {
    const parsedAmount = parseAmountInput(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          amount: parsedAmount,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && (data as { error?: string }).error === "setup_required") {
        setError("Giderler için kurulum gerekli: bir kez POST /api/setup çalıştırın.");
        return;
      }
      if (!res.ok) {
        setError("Gider eklenemedi.");
        return;
      }
      setAmount("");
      setNote("");
      await loadExpenses();
    } catch {
      setError("Gider eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Silinemedi.");
      return;
    }
    setError(null);
    await loadExpenses();
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
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/borc">
                <Banknote className="size-4" />
                Borçlar
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" asChild>
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
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Giderler</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Gider kategorileri</CardTitle>
            <p className="text-xs text-muted-foreground">
              Giderlerde isim yok; seçili kategoriye sadece not ve tutar girilir.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = category === activeCategory;
                const total = totalsByCategory.get(category) ?? 0;
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
                    {total > 0 && (
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {formatNumberTr(total)} $
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
            <p className="text-sm text-muted-foreground">Kategori toplam gider</p>
            <p className="text-3xl font-bold text-primary">{formatNumberTr(activeTotal)} $</p>
            <p className="mt-1 text-xs text-muted-foreground">Genel toplam: {formatNumberTr(grandTotal)} $</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Yeni gider ekle</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bu gider <span className="font-medium text-foreground">{activeCategory}</span> kategorisine kaydedilecek.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tutar (USD)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Not</Label>
                <Textarea
                  rows={2}
                  placeholder="Örn: yemek ödemesi, temizlik, servis..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={() => void handleAdd()} disabled={loading} size="lg">
              <Plus className="size-4" />
              {loading ? "Kaydediliyor..." : "Gider ekle"}
            </Button>
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold tracking-tight">{activeCategory} gider kayıtları</h2>
        <div className="space-y-3">
          {activeExpenses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Henüz gider yok.</CardContent>
            </Card>
          ) : (
            activeExpenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary">{formatNumberTr(Number(expense.amount))} $</p>
                    {expense.note && <p className="text-sm text-muted-foreground">{expense.note}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => void handleDelete(expense.id)}
                  >
                    <Trash2 className="size-4" />
                    Sil
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
