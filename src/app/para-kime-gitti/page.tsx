"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Calendar, ChevronLeft, ChevronRight, CircleDollarSign, HandCoins, LogOut, Package, Plus, ReceiptText, Save, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Distribution = { id: number; recipient_id: number; recipient_name: string; amount_try: string; percentage: string };
const formatTry = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const formatUsdt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const todayInIstanbul = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const numberFrom = (value: string) => Number(value.replace(",", "."));

export default function ParaKimeGittiPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [date, setDate] = useState(todayInIstanbul);
  const [records, setRecords] = useState<Distribution[]>([]);
  const [percentages, setPercentages] = useState<Record<number, string>>({});
  const [tryPerUsd, setTryPerUsd] = useState(0);
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPercentage, setRecipientPercentage] = useState("");
  const token = () => typeof window === "undefined" ? null : window.localStorage.getItem("satistakip-token");

  const checkAuth = useCallback(async () => {
    const authToken = token();
    if (!authToken) return setLoggedIn(false);
    try {
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) { window.localStorage.removeItem("satistakip-token"); return setLoggedIn(false); }
      const me = await res.json();
      setCurrentUserName(me.username ?? null);
      setLoggedIn(true);
    } catch { setLoggedIn(false); }
  }, []);

  const load = useCallback(async () => {
    const authToken = token();
    if (!authToken) return;
    setLoading(true); setError(null);
    try {
      const payoutRes = await fetch(`/api/money-distributions?date=${date}`, { cache: "no-store", headers: { Authorization: `Bearer ${authToken}` } });
      const payoutData = await payoutRes.json();
      if (!payoutRes.ok) throw new Error("load_failed");
      const nextRecords = Array.isArray(payoutData.records) ? payoutData.records : [];
      setRecords(nextRecords);
      setPercentages(Object.fromEntries(nextRecords.map((record: Distribution) => [record.recipient_id, String(record.percentage)])));
      setTryPerUsd(Number(payoutData.tryPerUsd ?? 0));
      setFxDate(payoutData.fxDate ?? null);
    } catch { setError("Satış dağılımı yüklenemedi. Lütfen tekrar deneyin."); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { void checkAuth(); }, [checkAuth]);
  useEffect(() => { if (loggedIn) void load(); }, [loggedIn, load]);

  const addRecipient = async () => {
    const name = recipientName.trim();
    const defaultPercentage = numberFrom(recipientPercentage || "0");
    if (!name || !Number.isFinite(defaultPercentage) || defaultPercentage < 0 || defaultPercentage > 100) {
      setError("Kişi adı ve 0–100 arası sabit yüzde girin."); return;
    }
    setSaving("recipient");
    try {
      const res = await fetch("/api/recipients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, defaultPercentage }) });
      if (!res.ok) throw new Error();
      setRecipientName(""); setRecipientPercentage(""); await load();
    } catch { setError("Kişi eklenemedi."); }
    finally { setSaving(null); }
  };

  const savePercentage = async (recipientId: number) => {
    const authToken = token();
    const defaultPercentage = numberFrom(percentages[recipientId] ?? "");
    if (!authToken || !Number.isFinite(defaultPercentage) || defaultPercentage < 0 || defaultPercentage > 100) {
      setError("Yüzde 0 ile 100 arasında olmalı."); return;
    }
    setSaving(`percentage:${recipientId}`);
    try {
      const res = await fetch(`/api/recipients/${recipientId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ defaultPercentage }) });
      if (!res.ok) throw new Error();
      await load();
    } catch { setError("Sabit yüzde kaydedilemedi."); }
    finally { setSaving(null); }
  };

  const logout = () => { window.localStorage.removeItem("satistakip-token"); setLoggedIn(false); setCurrentUserName(null); };
  const totals = useMemo(() => records.reduce((all, record) => {
    const amount = Number(record.amount_try);
    const share = amount * (numberFrom(percentages[record.recipient_id] ?? record.percentage) || 0) / 100;
    return { received: all.received + amount, personShare: all.personShare + share, ours: all.ours + amount - share };
  }, { received: 0, personShare: 0, ours: 0 }), [percentages, records]);
  const usdt = (value: number) => tryPerUsd > 0 ? value / tryPerUsd : null;
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const shiftDate = (days: number) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); setDate(next.toLocaleDateString("en-CA")); };

  if (!loggedIn) return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="space-y-4 text-center"><p className="text-muted-foreground">Giriş yapmanız gerekiyor.</p><Button asChild><Link href="/">Girişe git</Link></Button></div></div>;

  return <div className="min-h-screen bg-background text-foreground">
    <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" asChild><Link href="/" className="gap-2"><Package className="size-4" />Dashboard</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/ciro" className="gap-2"><Calendar className="size-4" />Ciro</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/borc" className="gap-2"><Banknote className="size-4" />Borçlar</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/giderler" className="gap-2"><ReceiptText className="size-4" />Giderler</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/hakedis" className="gap-2"><CircleDollarSign className="size-4" />Hakediş</Link></Button><Button variant="secondary" size="sm" asChild><Link href="/para-kime-gitti" className="gap-2"><HandCoins className="size-4" />Para Kime Gitti</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/performans" className="gap-2"><BarChart3 className="size-4" />Performans</Link></Button>
    </div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{currentUserName?.charAt(0).toUpperCase() ?? "A"}</span>{currentUserName ?? "Admin"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" />Çıkış yap</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></nav>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Para Kime Gitti</h1><p className="mt-1 text-sm text-muted-foreground">Tutarlar, yeni satışta seçtiğin kişiye göre otomatik gelir. Yüzdeler kişi bazında sabittir.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="Önceki gün"><ChevronLeft className="size-4" /></Button><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[160px]" aria-label="Tarih" /><Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="Sonraki gün"><ChevronRight className="size-4" /></Button></div></div>
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Bu gün yatırılan", value: totals.received, className: "text-primary" }, { label: "Kişilere gidecek", value: totals.personShare, className: "text-amber-600 dark:text-amber-400" }, { label: "Bize kalacak", value: totals.ours, className: "text-foreground" }].map((total) => <Card key={total.label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{total.label}</p><p className={`mt-1 text-2xl font-bold ${total.className}`}>{formatTry(total.value)} ₺</p>{usdt(total.value) !== null && <p className="mt-1 text-xs text-muted-foreground">≈ {formatUsdt(usdt(total.value)!)} USDT</p>}</CardContent></Card>)}</div>
      {tryPerUsd > 0 && <p className="text-xs text-muted-foreground">Kur: 1 USDT ≈ {formatTry(tryPerUsd)} ₺{fxDate ? ` · Kur tarihi: ${fxDate}` : ""}</p>}
      <Card><CardHeader><CardTitle className="text-base">Kişi ekle ve sabit yüzde belirle</CardTitle></CardHeader><CardContent className="grid max-w-xl gap-2 sm:grid-cols-[1fr_8rem_auto]"><Input value={recipientName} placeholder="Kişi adı" onChange={(event) => setRecipientName(event.target.value)} /><Input type="number" min="0" max="100" step="0.01" value={recipientPercentage} placeholder="Pay %" onChange={(event) => setRecipientPercentage(event.target.value)} /><Button variant="secondary" onClick={addRecipient} disabled={saving === "recipient"}><Plus className="size-4" />Ekle</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-lg">{dateLabel} satış dağılımı</CardTitle><p className="text-xs text-muted-foreground">“Yeni Satış” ekranındaki “Para Kime Gitti” seçimine göre otomatik oluşur.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-muted/50"><tr><th className="px-4 py-3 font-medium text-muted-foreground">Kişi</th><th className="px-4 py-3 text-right font-medium text-muted-foreground">O gün yatırılan</th><th className="px-4 py-3 font-medium text-muted-foreground">Sabit pay %</th><th className="px-4 py-3 text-right font-medium text-muted-foreground">Kişiye gidecek</th><th className="px-4 py-3 text-right font-medium text-muted-foreground">Bize kalacak</th></tr></thead><tbody>{records.map((record) => { const amount = Number(record.amount_try); const percentage = numberFrom(percentages[record.recipient_id] ?? record.percentage) || 0; const share = amount * percentage / 100; const ours = amount - share; return <tr key={record.recipient_id} className="border-t border-border"><td className="px-4 py-3 font-semibold uppercase">{record.recipient_name}</td><td className="px-4 py-3 text-right"><p className="font-medium text-primary">{formatTry(amount)} ₺</p>{usdt(amount) !== null && <p className="text-xs text-muted-foreground">≈ {formatUsdt(usdt(amount)!)} USDT</p>}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><Input className="w-24" type="number" min="0" max="100" step="0.01" value={percentages[record.recipient_id] ?? record.percentage} onChange={(event) => setPercentages((all) => ({ ...all, [record.recipient_id]: event.target.value }))} /><Button size="sm" variant="ghost" onClick={() => void savePercentage(record.recipient_id)} disabled={saving === `percentage:${record.recipient_id}`} aria-label="Yüzdeyi kaydet"><Save className="size-4" /></Button></div></td><td className="px-4 py-3 text-right"><p className="font-medium text-amber-600 dark:text-amber-400">{formatTry(share)} ₺</p>{usdt(share) !== null && <p className="text-xs text-muted-foreground">≈ {formatUsdt(usdt(share)!)} USDT</p>}</td><td className="px-4 py-3 text-right"><p className="font-medium text-primary">{formatTry(ours)} ₺</p>{usdt(ours) !== null && <p className="text-xs text-muted-foreground">≈ {formatUsdt(usdt(ours)!)} USDT</p>}</td></tr>; })}{!loading && records.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Henüz kişi eklenmemiş.</td></tr>}</tbody></table></div>{loading && <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>}</CardContent></Card>
    </main>
  </div>;
}
