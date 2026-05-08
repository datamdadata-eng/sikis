"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, LogOut, Calendar, Banknote, Plus, Trash2, CircleDollarSign } from "lucide-react";
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
type Debt = {
  id: number;
  person_name: string;
  amount: string;
  description: string | null;
  created_at?: string;
};

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const parseTrAmountToNumber = (value: string): number => {
  const cleaned = value.replace(/\./g, "").replace(/\s/g, "");
  return Number(cleaned || "0");
};

export default function BorcPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [personName, setPersonName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [desc, setDesc] = useState("");
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

  const loadDebts = useCallback(async () => {
    try {
      const res = await fetch("/api/debts", { cache: "no-store" });
      const data = await res.json();
      setDebts(Array.isArray(data) ? data : []);
    } catch {
      setDebts([]);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (loggedIn) loadDebts();
  }, [loggedIn, loadDebts]);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const totalBorc = debts.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

  const handleAdd = async () => {
    const name = personName.trim();
    const amount = parseTrAmountToNumber(amountStr);
    if (!name) {
      setError("Kişi adı girin.");
      return;
    }
    if (amount <= 0) {
      setError("Geçerli bir tutar girin.");
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
      setAmountStr("");
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
    setDebts((prev) => prev.filter((d) => d.id !== id));
    await loadDebts();
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

        <Card className="mb-6 border-primary/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Toplam borç</p>
            <p className="text-3xl font-bold text-primary">{formatNumberTr(totalBorc)} ₺</p>
            <p className="mt-1 text-xs text-muted-foreground">{debts.length} kayıt</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Yeni borç ekle</CardTitle>
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
                <Label>Tutar (₺)</Label>
                <Input
                  placeholder="0"
                  value={amountStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const digitsOnly = raw.replace(/\D/g, "");
                    if (!digitsOnly) {
                      setAmountStr("");
                      return;
                    }
                    setAmountStr(formatNumberTr(Number(digitsOnly)));
                  }}
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
            <Button onClick={handleAdd} disabled={loading} size="lg">
              <Plus className="size-4" />
              {loading ? "Kaydediliyor..." : "Borç ekle"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Borç listesi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border overflow-hidden rounded-b-xl">
              {debts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz borç kaydı yok.</p>
              ) : (
                debts.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold uppercase text-foreground">{d.person_name}</p>
                      <p className="text-lg font-bold text-primary">{formatNumberTr(Number(d.amount))} ₺</p>
                      {d.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="size-4" />
                      Sil
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
