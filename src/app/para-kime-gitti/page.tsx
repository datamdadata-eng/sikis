"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Calendar, ChevronLeft, ChevronRight, CircleDollarSign, HandCoins, LogOut, Package, Plus, ReceiptText, Save, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Recipient = { id: number; name: string };
type Distribution = { id: number; recipient_id: number; recipient_name: string; amount_try: string; percentage: string; distribution_date: string };
type Draft = { amountTry: string; percentage: string };

const formatTry = (value: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const formatUsdt = (value: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const todayInIstanbul = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

function numberFrom(value: string) {
  return Number(value.replace(",", "."));
}

export default function ParaKimeGittiPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [date, setDate] = useState(todayInIstanbul);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [records, setRecords] = useState<Distribution[]>([]);
  const [tryPerUsd, setTryPerUsd] = useState(0);
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [newRecord, setNewRecord] = useState({ recipientId: "", amountTry: "", percentage: "" });
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const token = () => (typeof window === "undefined" ? null : window.localStorage.getItem("satistakip-token"));

  const checkAuth = useCallback(async () => {
    const authToken = token();
    if (!authToken) return setLoggedIn(false);
    try {
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) {
        window.localStorage.removeItem("satistakip-token");
        return setLoggedIn(false);
      }
      const me = await res.json();
      setCurrentUserName(me.username ?? null);
      setLoggedIn(true);
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => { void checkAuth(); }, [checkAuth]);

  const load = useCallback(async () => {
    const authToken = token();
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const [recipientRes, distributionRes] = await Promise.all([
        fetch("/api/recipients", { cache: "no-store" }),
        fetch(`/api/money-distributions?date=${date}`, { cache: "no-store", headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const recipientData = await recipientRes.json();
      const distributionData = await distributionRes.json();
      if (!distributionRes.ok) throw new Error(distributionData.error ?? "load_failed");
      const nextRecords = Array.isArray(distributionData.records) ? distributionData.records : [];
      setRecipients(Array.isArray(recipientData) ? recipientData : []);
      setRecords(nextRecords);
      setTryPerUsd(Number(distributionData.tryPerUsd ?? 0));
      setFxDate(distributionData.fxDate ?? null);
      setDrafts(Object.fromEntries(nextRecords.map((record: Distribution) => [record.id, { amountTry: String(record.amount_try), percentage: String(record.percentage) }])));
    } catch {
      setError("Kayıtlar yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (loggedIn) void load();
  }, [loggedIn, load]);

  const addRecipient = async () => {
    const name = recipientName.trim();
    if (!name) return;
    setSaving("recipient");
    try {
      const res = await fetch("/api/recipients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error();
      const recipient = await res.json() as Recipient;
      setRecipients((items) => [recipient, ...items]);
      setNewRecord((current) => ({ ...current, recipientId: String(recipient.id) }));
      setRecipientName("");
    } catch {
      setError("Kişi eklenemedi.");
    } finally {
      setSaving(null);
    }
  };

  const addRecord = async () => {
    const authToken = token();
    const amountTry = numberFrom(newRecord.amountTry);
    const percentage = numberFrom(newRecord.percentage);
    if (!authToken || !newRecord.recipientId || !Number.isFinite(amountTry) || amountTry < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setError("Kişi, yatırılan tutar ve 0–100 arası yüzde girin.");
      return;
    }
    setSaving("new");
    setError(null);
    try {
      const res = await fetch("/api/money-distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ recipientId: Number(newRecord.recipientId), amountTry, percentage, date }),
      });
      if (!res.ok) throw new Error();
      setNewRecord((current) => ({ ...current, amountTry: "", percentage: "" }));
      await load();
    } catch {
      setError("Kayıt kaydedilemedi.");
    } finally {
      setSaving(null);
    }
  };

  const updateRecord = async (id: number) => {
    const authToken = token();
    const draft = drafts[id];
    const amountTry = numberFrom(draft?.amountTry ?? "");
    const percentage = numberFrom(draft?.percentage ?? "");
    if (!authToken || !Number.isFinite(amountTry) || amountTry < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setError("Tutar ve yüzdeyi kontrol edin.");
      return;
    }
    setSaving(`save:${id}`);
    try {
      const res = await fetch(`/api/money-distributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ amountTry, percentage }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("Kayıt güncellenemedi.");
    } finally {
      setSaving(null);
    }
  };

  const deleteRecord = async (id: number) => {
    const authToken = token();
    if (!authToken) return;
    setSaving(`delete:${id}`);
    try {
      const res = await fetch(`/api/money-distributions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("Kayıt silinemedi.");
    } finally {
      setSaving(null);
    }
  };

  const logout = () => {
    window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
  };

  const totals = useMemo(() => records.reduce((all, record) => {
    const amount = Number(record.amount_try);
    const personShare = amount * Number(record.percentage) / 100;
    all.received += amount;
    all.personShare += personShare;
    all.ours += amount - personShare;
    return all;
  }, { received: 0, personShare: 0, ours: 0 }), [records]);
  const usdt = (value: number) => tryPerUsd > 0 ? value / tryPerUsd : null;
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  if (!loggedIn) return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="space-y-4 text-center"><p className="text-muted-foreground">Giriş yapmanız gerekiyor.</p><Button asChild><Link href="/">Girişe git</Link></Button></div></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" asChild><Link href="/" className="gap-2"><Package className="size-4" />Dashboard</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/ciro" className="gap-2"><Calendar className="size-4" />Ciro</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/borc" className="gap-2"><Banknote className="size-4" />Borçlar</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/giderler" className="gap-2"><ReceiptText className="size-4" />Giderler</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/hakedis" className="gap-2"><CircleDollarSign className="size-4" />Hakediş</Link></Button>
            <Button variant="secondary" size="sm" asChild><Link href="/para-kime-gitti" className="gap-2"><HandCoins className="size-4" />Para Kime Gitti</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/performans" className="gap-2"><BarChart3 className="size-4" />Performans</Link></Button>
          </div>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{currentUserName?.charAt(0).toUpperCase() ?? "A"}</span>{currentUserName ?? "Admin"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" />Çıkış yap</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Para Kime Gitti</h1><p className="mt-1 text-sm text-muted-foreground">Günlük yatırılan parayı, kişi payını ve size kalan tutarı takip edin.</p></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1); setDate(d.toLocaleDateString("en-CA")); }} aria-label="Önceki gün"><ChevronLeft className="size-4" /></Button><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[160px]" aria-label="Tarih" /><Button variant="outline" size="icon" onClick={() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + 1); setDate(d.toLocaleDateString("en-CA")); }} aria-label="Sonraki gün"><ChevronRight className="size-4" /></Button></div>
        </div>

        {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-3">
          {[{ label: "Bu gün yatırılan", value: totals.received, className: "text-primary" }, { label: "Kişilere gidecek", value: totals.personShare, className: "text-amber-600 dark:text-amber-400" }, { label: "Bize kalacak", value: totals.ours, className: "text-foreground" }].map((total) => <Card key={total.label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{total.label}</p><p className={`mt-1 text-2xl font-bold ${total.className}`}>{formatTry(total.value)} ₺</p>{usdt(total.value) !== null && <p className="mt-1 text-xs text-muted-foreground">≈ {formatUsdt(usdt(total.value)!)} USDT</p>}</CardContent></Card>)}
        </div>
        {tryPerUsd > 0 && <p className="text-xs text-muted-foreground">Kur: 1 USDT ≈ {formatTry(tryPerUsd)} ₺{fxDate ? ` · Kur tarihi: ${fxDate}` : ""}</p>}

        <Card><CardHeader><CardTitle className="text-lg">Yeni günlük kayıt — {dateLabel}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_7rem_auto] sm:items-end"><div className="space-y-1"><Label>Kişi</Label><Select value={newRecord.recipientId} onValueChange={(recipientId) => setNewRecord((current) => ({ ...current, recipientId }))}><SelectTrigger><SelectValue placeholder="Kişi seçin" /></SelectTrigger><SelectContent>{recipients.map((recipient) => <SelectItem key={recipient.id} value={String(recipient.id)}>{recipient.name.toUpperCase()}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Yatırılan para (₺)</Label><Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="100000" value={newRecord.amountTry} onChange={(event) => setNewRecord((current) => ({ ...current, amountTry: event.target.value }))} /></div><div className="space-y-1"><Label>Kişi payı %</Label><Input type="number" min="0" max="100" step="0.01" inputMode="decimal" placeholder="34" value={newRecord.percentage} onChange={(event) => setNewRecord((current) => ({ ...current, percentage: event.target.value }))} /></div><Button onClick={addRecord} disabled={saving === "new"}>{saving === "new" ? "Kaydediliyor..." : "Ekle"}</Button></CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">Kişi ekle</CardTitle></CardHeader><CardContent className="flex max-w-md gap-2"><Input value={recipientName} placeholder="Kişi adı" onChange={(event) => setRecipientName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addRecipient(); }} /><Button variant="secondary" onClick={addRecipient} disabled={saving === "recipient"}><Plus className="size-4" />Ekle</Button></CardContent></Card>

        <Card><CardHeader><CardTitle className="text-lg">{dateLabel} kayıtları</CardTitle><p className="text-xs text-muted-foreground">Örnek: 100.000 ₺ ve %34 için kişiye 34.000 ₺, size 66.000 ₺ kalır.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-muted/50"><tr><th className="px-4 py-3 font-medium text-muted-foreground">Kişi</th><th className="px-4 py-3 font-medium text-muted-foreground">Yatırılan</th><th className="px-4 py-3 font-medium text-muted-foreground">Pay %</th><th className="px-4 py-3 text-right font-medium text-muted-foreground">Kişiye gidecek</th><th className="px-4 py-3 text-right font-medium text-muted-foreground">Bize kalacak</th><th className="px-4 py-3" /></tr></thead><tbody>{records.map((record) => { const draft = drafts[record.id] ?? { amountTry: record.amount_try, percentage: record.percentage }; const amount = numberFrom(draft.amountTry) || 0; const share = amount * (numberFrom(draft.percentage) || 0) / 100; const ours = amount - share; return <tr key={record.id} className="border-t border-border"><td className="px-4 py-3 font-semibold uppercase">{record.recipient_name}</td><td className="px-4 py-3"><Input className="w-32" type="number" min="0" step="0.01" value={draft.amountTry} onChange={(event) => setDrafts((all) => ({ ...all, [record.id]: { ...draft, amountTry: event.target.value } }))} /></td><td className="px-4 py-3"><Input className="w-24" type="number" min="0" max="100" step="0.01" value={draft.percentage} onChange={(event) => setDrafts((all) => ({ ...all, [record.id]: { ...draft, percentage: event.target.value } }))} /></td><td className="px-4 py-3 text-right"><p className="font-medium text-amber-600 dark:text-amber-400">{formatTry(share)} ₺</p>{usdt(share) !== null && <p className="text-xs text-muted-foreground">≈ {formatUsdt(usdt(share)!)} USDT</p>}</td><td className="px-4 py-3 text-right"><p className="font-medium text-primary">{formatTry(ours)} ₺</p>{usdt(ours) !== null && <p className="text-xs text-muted-foreground">≈ {formatUsdt(usdt(ours)!)} USDT</p>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => void updateRecord(record.id)} disabled={saving === `save:${record.id}`} aria-label="Kaydet"><Save className="size-4" /></Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deleteRecord(record.id)} disabled={saving === `delete:${record.id}`} aria-label="Sil"><Trash2 className="size-4" /></Button></div></td></tr>; })}{!loading && records.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Bu gün için kayıt yok.</td></tr>}</tbody></table></div>{loading && <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>}</CardContent></Card>
      </main>
    </div>
  );
}
