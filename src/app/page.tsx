"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Package, LogOut, Plus, Trash2, Calculator, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type User = {
  id: number;
  name: string;
};

type Recipient = {
  id: number;
  name: string;
};

type Sale = {
  id: number;
  user_name: string | null;
  closer_name: string | null;
  recipient_name: string | null;
  amount: number;
  description: string | null;
  status: "onay" | "patladi";
  sale_date: string;
  sale_date_display?: string;
};

type SummaryRow = {
  day: string;
  total_onay: string;
  total_patladi: string;
};

type UserSummaryRow = {
  user_id: number | null;
  user_name: string | null;
  total_onay: string;
  total_patladi: string;
  total_amount: string;
};

type CloserSummaryRow = {
  closer_id: number | null;
  closer_name: string | null;
  total_onay: string;
  total_patladi: string;
  total_amount: string;
};

type DaySummary = {
  date: string;
  total_onay: string;
  total_patladi: string;
  net: number;
  users: UserSummaryRow[];
  closers: CloserSummaryRow[];
};

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const parseTrAmountToNumber = (value: string): number => {
  const cleaned = value.replace(/\./g, "").replace(/\s/g, "");
  return Number(cleaned || "0");
};

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummaryRow[]>([]);
  const [closerSummary, setCloserSummary] = useState<CloserSummaryRow[]>([]);
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");

  const [form, setForm] = useState<{
    userId: string;
    closerUserId: string;
    amount: string;
    description: string;
    status: "onay" | "patladi";
    recipientId: string;
  }>({
    userId: "",
    closerUserId: "",
    amount: "",
    description: "",
    status: "onay",
    recipientId: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calcA, setCalcA] = useState("");
  const [calcB, setCalcB] = useState("");
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window !== "undefined") {
          const token = window.localStorage.getItem("satistakip-token");
          if (token) {
            const meRes = await fetch("/api/me", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (meRes.ok) {
              const me = await meRes.json();
              setLoggedIn(true);
              setCurrentUserName(me.username ?? null);
            } else {
              window.localStorage.removeItem("satistakip-token");
            }
          }
        }

        const [usersRes, recipientsRes, salesRes, summaryRes, userSummaryRes, closerSummaryRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/recipients"),
          fetch("/api/sales"),
          fetch("/api/summary"),
          fetch("/api/summary/users"),
          fetch("/api/summary/closers"),
        ]);
        setUsers(await usersRes.json());
        setRecipients(await recipientsRes.json());
        setSales(await salesRes.json());
        setSummary(await summaryRes.json());
        setUserSummary(await userSummaryRes.json());
        setCloserSummary(await closerSummaryRes.json());
      } catch (e) {
        console.error(e);
        setError("Veriler yüklenemedi");
      }
    };
    init();
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error === "invalid_credentials" ? "Kullanıcı adı veya şifre hatalı" : "Giriş başarısız");
        return;
      }

      const data = await res.json();
      if (typeof window !== "undefined" && rememberMe) {
        window.localStorage.setItem("satistakip-token", data.token);
      }
      setLoggedIn(true);
      setCurrentUserName(data.user?.username ?? null);
      setLoginPass("");
    } catch (e) {
      console.error(e);
      setLoginError("Giriş sırasında hata oluştu");
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("satistakip-token");
    }
    setLoggedIn(false);
    setCurrentUserName(null);
    setShowLogout(false);
  };

  const handleAddUser = async () => {
    const name = newUserName.trim();
    if (!name) return;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const user: User = await res.json();
    setUsers((prev) => [user, ...prev]);
    setNewUserName("");
  };

  const handleAddRecipient = async () => {
    const name = newRecipientName.trim();
    if (!name) return;
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const recipient: Recipient = await res.json();
    setRecipients((prev) => [recipient, ...prev]);
    setNewRecipientName("");
  };

  const handleSubmitSale = async () => {
    setError(null);
    setLoading(true);
    try {
      const numericAmount = parseTrAmountToNumber(form.amount);

      const payload = {
        userId: form.userId ? Number(form.userId) : null,
        closerId: form.closerUserId ? Number(form.closerUserId) : null,
        amount: numericAmount,
        description: form.description || null,
        status: form.status,
        recipientId: form.recipientId ? Number(form.recipientId) : null,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError("Satış kaydedilemedi: " + (data.error ?? res.statusText));
        return;
      }

      await refreshData();

      setForm((prev) => ({
        ...prev,
        closerUserId: "",
        amount: "",
        description: "",
      }));
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    const [salesRes, summaryRes, userSummaryRes, closerSummaryRes] = await Promise.all([
      fetch("/api/sales"),
      fetch("/api/summary"),
      fetch("/api/summary/users"),
      fetch("/api/summary/closers"),
    ]);
    setSales(await salesRes.json());
    setSummary(await summaryRes.json());
    setUserSummary(await userSummaryRes.json());
    setCloserSummary(await closerSummaryRes.json());
    const today = todayIsoRef.current;
    if (today) {
      const dayRes = await fetch(`/api/summary/day?date=${today}`);
      if (dayRes.ok) setDaySummary(await dayRes.json());
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    if (!confirm("Bu satışı silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Satış silinemedi.");
      return;
    }
    setError(null);
    await refreshData();
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz? Bu kullanıcıya bağlı satışlar 'Kullanıcı yok' olarak kalır.")) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Kullanıcı silinemedi.");
      return;
    }
    setError(null);
    const usersRes = await fetch("/api/users");
    setUsers(await usersRes.json());
  };

  const handleDeleteRecipient = async (recipientId: number) => {
    if (!confirm("Bu kişiyi silmek istediğinize emin misiniz? Bu kişiye bağlı satışlar 'Para kime' alanında boş kalır.")) return;
    const res = await fetch(`/api/recipients/${recipientId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Para giden kişi silinemedi.");
      return;
    }
    setError(null);
    const recipientsRes = await fetch("/api/recipients");
    setRecipients(await recipientsRes.json());
  };

  // Bugün (Istanbul) — mount'ta hesapla; gün sonu sadece bu günün verisi
  const [todayIso, setTodayIso] = useState("");
  const todayIsoRef = useRef("");
  useEffect(() => {
    const iso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    setTodayIso(iso);
    todayIsoRef.current = iso;
  }, []);

  // Gün sonu kartı sadece bugünün verisiyle doldurulur (dünün verisi asla gösterilmez)
  useEffect(() => {
    if (!todayIso) return;
    let cancelled = false;
    fetch(`/api/summary/day?date=${todayIso}`)
      .then((r) => r.json())
      .then((data: DaySummary) => {
        if (!cancelled) setDaySummary(data);
      })
      .catch(() => {
        if (!cancelled) setDaySummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [todayIso]);

  const runPercentCalc = () => {
    setCalcError(null);
    const amount = parseTrAmountToNumber(calcA);
    const percent = Number(calcB);

    if (Number.isNaN(amount) || Number.isNaN(percent)) {
      setCalcError("Lütfen tutar ve yüzdeyi gir.");
      setCalcResult(null);
      return;
    }

    const result = (amount * percent) / 100;
    setCalcResult(result.toString());
  };

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border-border bg-card shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Package className="size-6 text-primary" />
              Yuri Ofis Finansal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-user">Kullanıcı Adı</Label>
              <Input
                id="login-user"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="Kullanıcı adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pass">Şifre</Label>
              <Input
                id="login-pass"
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Şifre"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                Beni hatırla
              </Label>
            </div>
            {loginError && (
              <p className="text-sm text-destructive">{loginError}</p>
            )}
            <Button onClick={handleLogin} className="w-full" size="lg">
              Giriş Yap
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href="/">
                <Package className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/ciro">
                <Calendar className="size-4" />
                Ciro
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Takip Paneli</h1>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Yeni Satış</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kullanıcı</Label>
                  <Select value={form.userId || "_"} onValueChange={(v) => setForm((prev) => ({ ...prev, userId: v === "_" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Seç</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kapatıcı</Label>
                  <Select value={form.closerUserId || "_"} onValueChange={(v) => setForm((prev) => ({ ...prev, closerUserId: v === "_" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç (opsiyonel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Seç (opsiyonel)</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tutar</Label>
                  <Input
                    type="text"
                    value={form.amount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const digitsOnly = raw.replace(/\D/g, "");
                      if (!digitsOnly) {
                        setForm((prev) => ({ ...prev, amount: "" }));
                        return;
                      }
                      setForm((prev) => ({ ...prev, amount: formatNumberTr(Number(digitsOnly)) }));
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Açıklama (opsiyonel)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v as "onay" | "patladi" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onay">Onay</SelectItem>
                      <SelectItem value="patladi">Patladı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Para Kime Gitti</Label>
                  <Select value={form.recipientId || "_"} onValueChange={(v) => setForm((prev) => ({ ...prev, recipientId: v === "_" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Seç</SelectItem>
                      {recipients.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSubmitSale} disabled={loading} className="w-full sm:w-auto" size="lg">
                <Plus className="size-4" />
                {loading ? "Kaydediliyor..." : "Satışı Kaydet"}
              </Button>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kullanıcı Ekle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="İsim"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleAddUser} size="sm" variant="secondary">
                    <Plus className="size-4" />
                    Ekle
                  </Button>
                </div>
                {users.length > 0 && (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm">
                        <span className="font-medium">{u.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(u.id)}>
                          <Trash2 className="size-3.5" />
                          Sil
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Para Giden Kişi Ekle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="İsim"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleAddRecipient} size="sm" variant="secondary">
                    <Plus className="size-4" />
                    Ekle
                  </Button>
                </div>
                {recipients.length > 0 && (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {recipients.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm">
                        <span className="font-medium">{r.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => handleDeleteRecipient(r.id)}>
                          <Trash2 className="size-3.5" />
                          Sil
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Gün Sonu Özeti
                  {todayIso ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      — {new Date(todayIso + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  ) : (
                    " (Bugün)"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
              {!todayIso ? (
                <p className="text-muted-foreground text-xs">Yükleniyor…</p>
              ) : daySummary ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Onay Toplamı</span>
                      <span className="font-medium text-primary">{formatNumberTr(Number(daySummary.total_onay ?? 0))} ₺</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patladı Toplamı</span>
                      <span className="font-medium text-destructive">{formatNumberTr(Number(daySummary.total_patladi ?? 0))} ₺</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border pt-2">
                      <span className="font-medium">Net (Genel)</span>
                      <span className={cn("font-semibold", daySummary.net >= 0 ? "text-primary" : "text-destructive")}>
                        {formatNumberTr(daySummary.net)} ₺
                      </span>
                    </div>
                  </div>
                  {daySummary.users.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2 text-xs">
                      <p className="mb-1 font-medium text-muted-foreground">Kullanıcı bazlı</p>
                      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                        {daySummary.users.map((u) => {
                          const totalOnay = Number(u.total_onay ?? 0);
                          const totalPatladi = Number(u.total_patladi ?? 0);
                          const net = totalOnay - totalPatladi;
                          return (
                            <div key={u.user_id ?? u.user_name ?? Math.random()} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
                              <div className="flex flex-col">
                                <span>{u.user_name ?? "Kullanıcı Yok"}</span>
                                <span className="text-muted-foreground">Onay: {formatNumberTr(totalOnay)} ₺ · Patladı: {formatNumberTr(totalPatladi)} ₺</span>
                              </div>
                              <span className={cn("text-[11px] font-semibold", net >= 0 ? "text-primary" : "text-destructive")}>{formatNumberTr(net)} ₺</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {daySummary.closers.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2 text-xs">
                      <p className="mb-1 font-medium text-muted-foreground">Kapatıcı bazlı</p>
                      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                        {daySummary.closers.map((u) => {
                          const totalOnay = Number(u.total_onay ?? 0);
                          const totalPatladi = Number(u.total_patladi ?? 0);
                          const net = totalOnay - totalPatladi;
                          return (
                            <div key={u.closer_id ?? u.closer_name ?? Math.random()} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
                              <div className="flex flex-col">
                                <span>{u.closer_name ?? "Kullanıcı Yok"}</span>
                                <span className="text-muted-foreground">Onay: {formatNumberTr(totalOnay)} ₺ · Patladı: {formatNumberTr(totalPatladi)} ₺</span>
                              </div>
                              <span className={cn("text-[11px] font-semibold", net >= 0 ? "text-primary" : "text-destructive")}>{formatNumberTr(net)} ₺</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Onay Toplamı</span><span className="font-medium">0 ₺</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Patladı Toplamı</span><span className="font-medium">0 ₺</span></div>
                  <div className="mt-2 flex justify-between border-t border-border pt-2"><span className="font-medium">Net (Genel)</span><span className="font-semibold">0 ₺</span></div>
                  <p className="pt-2 text-xs text-muted-foreground">Bugün henüz satış yok.</p>
                </div>
              )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="size-4" />
                  Yüzdelik Hesaplama
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Tutar (ör: 100000)"
                    value={calcA}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const digitsOnly = raw.replace(/\D/g, "");
                      if (!digitsOnly) { setCalcA(""); return; }
                      setCalcA(formatNumberTr(Number(digitsOnly)));
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Yüzde (ör: 10)"
                    value={calcB}
                    onChange={(e) => setCalcB(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Button onClick={runPercentCalc} size="sm" className="w-full sm:w-auto">
                  Hesapla (Tutar × Yüzde ÷ 100)
                </Button>
                {calcError && <p className="text-destructive text-xs">{calcError}</p>}
                {calcResult !== null && (
                  <p className="text-sm text-primary">
                    Sonuç: <span className="font-semibold">{calcResult} {!Number.isNaN(Number(calcResult)) && `(${formatNumberTr(Number(calcResult))})`}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Satışlar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto rounded-b-xl">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Tarih</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Kullanıcı</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Kapatıcı</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Tutar</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Durum</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Para Kime</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Açıklama</th>
                    <th className="w-14 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-t border-border transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.sale_date_display ?? new Date(s.sale_date).toLocaleString("tr-TR", {
                          timeZone: "Europe/Istanbul",
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5">{s.user_name ?? "-"}</td>
                      <td className="px-4 py-2.5">{s.closer_name ?? "-"}</td>
                      <td className="px-4 py-2.5 font-medium text-primary">{formatNumberTr(Number(s.amount))} ₺</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            s.status === "onay" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                          )}
                        >
                          {s.status === "onay" ? "Onay" : "Patladı"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{s.recipient_name ?? "-"}</td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground" title={s.description ?? ""}>
                        {s.description ?? "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDeleteSale(s.id)}>
                          <Trash2 className="size-4" />
                          Sil
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!sales.length && (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                        Henüz satış yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
