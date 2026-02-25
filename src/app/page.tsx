/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";

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

  const todaysSummary = useMemo(() => {
    if (!summary.length) return null;
    const todayRow = summary[0];
    const totalOnay = Number(todayRow.total_onay ?? 0);
    const totalPatladi = Number(todayRow.total_patladi ?? 0);
    const net = totalOnay - totalPatladi;
    return { totalOnay, totalPatladi, net };
  }, [summary]);

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
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <h1 className="text-xl font-semibold mb-4 text-center">Satış Paneli Girişi</h1>
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <label className="text-slate-300">Kullanıcı Adı</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label className="text-slate-300">Şifre</label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Beni hatırla</span>
            </label>
            {loginError && (
              <p className="text-xs text-red-400">
                {loginError}
              </p>
            )}
            <button
              onClick={handleLogin}
              className="mt-2 w-full inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400"
            >
              Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700">
              Dashboard
            </button>
          </div>
          <div className="relative text-xs">
            <button
              onClick={() => setShowLogout((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-100"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-emerald-950">
                {currentUserName?.charAt(0).toUpperCase() ?? "A"}
              </span>
              <span>{currentUserName ?? "Admin"}</span>
            </button>
            {showLogout && (
              <button
                onClick={handleLogout}
                className="absolute right-0 top-full mt-2 w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 shadow-lg hover:bg-slate-800"
              >
                Çıkış yap
              </button>
            )}
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Takip Paneli</h1>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-red-500 bg-red-950/40 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Yeni Satış</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Kullanıcı</span>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  value={form.userId}
                  onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                >
                  <option value="">Seç</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Kapatıcı</span>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  value={form.closerUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, closerUserId: e.target.value }))}
                >
                  <option value="">Seç (opsiyonel)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Tutar</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  value={form.amount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const digitsOnly = raw.replace(/\D/g, "");
                    if (!digitsOnly) {
                      setForm((prev) => ({ ...prev, amount: "" }));
                      return;
                    }
                    const num = Number(digitsOnly);
                    setForm((prev) => ({ ...prev, amount: formatNumberTr(num) }));
                  }}
                />
              </label>

              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-slate-300">Açıklama</span>
                <textarea
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Durum</span>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as "onay" | "patladi" }))
                  }
                >
                  <option value="onay">Onay</option>
                  <option value="patladi">Patladı</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Para Kime Gitti</span>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  value={form.recipientId}
                  onChange={(e) => setForm((prev) => ({ ...prev, recipientId: e.target.value }))}
                >
                  <option value="">Seç</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

            </div>

            <button
              onClick={handleSubmitSale}
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Kaydediliyor..." : "Satışı Kaydet"}
            </button>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-lg font-semibold">Kullanıcı Ekle</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="İsim"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
                <button
                  onClick={handleAddUser}
                  className="inline-flex items-center justify-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white"
                >
                  Ekle
                </button>
              </div>
              {users.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 text-xs">
                      <span className="text-slate-200">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-lg font-semibold">Para Giden Kişi Ekle</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="İsim"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                />
                <button
                  onClick={handleAddRecipient}
                  className="inline-flex items-center justify-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white"
                >
                  Ekle
                </button>
              </div>
              {recipients.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                  {recipients.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 text-xs">
                      <span className="text-slate-200">{r.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipient(r.id)}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
              <h2 className="mb-3 text-lg font-semibold">Gün Sonu Özeti</h2>
              {todaysSummary ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Onay Toplamı:</span>
                      <span className="font-medium text-emerald-400">
                        {formatNumberTr(todaysSummary.totalOnay)} ₺
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Patladı Toplamı:</span>
                      <span className="font-medium text-red-400">
                        {formatNumberTr(todaysSummary.totalPatladi)} ₺
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-slate-700 pt-2">
                      <span className="text-slate-200">Net (Genel):</span>
                      <span
                        className={
                          "font-semibold " + (todaysSummary.net >= 0 ? "text-emerald-400" : "text-red-400")
                        }
                      >
                        {formatNumberTr(todaysSummary.net)} ₺
                      </span>
                    </div>
                  </div>

                  {userSummary.length > 0 && (
                    <div className="mt-3 border-t border-slate-800 pt-2 text-xs">
                      <p className="mb-1 text-slate-300 font-medium">Kullanıcı Bazlı Gün Sonu</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {userSummary.map((u) => {
                          const totalOnay = Number(u.total_onay ?? 0);
                          const totalPatladi = Number(u.total_patladi ?? 0);
                          const net = totalOnay - totalPatladi;
                          return (
                            <div
                              key={u.user_id ?? u.user_name ?? Math.random()}
                              className="flex items-center justify-between rounded-md bg-slate-900/80 px-2 py-1"
                            >
                              <div className="flex flex-col">
                                <span className="text-slate-100">
                                  {u.user_name ?? "Kullanıcı Yok"}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Onay: {formatNumberTr(totalOnay)} ₺ · Patladı: {formatNumberTr(totalPatladi)} ₺
                                </span>
                              </div>
                              <span
                                className={
                                  "text-[11px] font-semibold " +
                                  (net >= 0 ? "text-emerald-400" : "text-red-400")
                                }
                              >
                                {formatNumberTr(net)} ₺
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {closerSummary.length > 0 && (
                    <div className="mt-3 border-t border-slate-800 pt-2 text-xs">
                      <p className="mb-1 text-slate-300 font-medium">Kapatıcı Bazlı Gün Sonu</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {closerSummary.map((u) => {
                          const totalOnay = Number(u.total_onay ?? 0);
                          const totalPatladi = Number(u.total_patladi ?? 0);
                          const net = totalOnay - totalPatladi;
                          return (
                            <div
                              key={u.closer_id ?? u.closer_name ?? Math.random()}
                              className="flex items-center justify-between rounded-md bg-slate-900/80 px-2 py-1"
                            >
                              <div className="flex flex-col">
                                <span className="text-slate-100">
                                  {u.closer_name ?? "Kullanıcı Yok"}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Onay: {formatNumberTr(totalOnay)} ₺ · Patladı: {formatNumberTr(totalPatladi)} ₺
                                </span>
                              </div>
                              <span
                                className={
                                  "text-[11px] font-semibold " +
                                  (net >= 0 ? "text-emerald-400" : "text-red-400")
                                }
                              >
                                {formatNumberTr(net)} ₺
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-xs">Henüz özet yok.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
              <h2 className="mb-3 text-lg font-semibold">Yüzdelik Hesaplama</h2>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                    placeholder="Tutar (ör: 100000)"
                    value={calcA}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const digitsOnly = raw.replace(/\D/g, "");
                      if (!digitsOnly) {
                        setCalcA("");
                        return;
                      }
                      const num = Number(digitsOnly);
                      setCalcA(formatNumberTr(num));
                    }}
                  />
                  <input
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                    placeholder="Yüzde (ör: 10)"
                    value={calcB}
                    onChange={(e) => setCalcB(e.target.value)}
                  />
                </div>
                <button
                  onClick={runPercentCalc}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-emerald-950 hover:bg-emerald-400"
                >
                  Hesapla (Tutar × Yüzde ÷ 100)
                </button>
                {calcError && <p className="text-[10px] text-red-400">{calcError}</p>}
                {calcResult !== null && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    Sonuç:{" "}
                    <span className="font-semibold">
                      {calcResult} ({!Number.isNaN(Number(calcResult)) ? formatNumberTr(Number(calcResult)) : ""})
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-lg font-semibold">Satışlar</h2>
          <div className="max-h-[400px] overflow-auto rounded-md border border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-900 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium text-slate-300">Tarih</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Kullanıcı</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Kapatıcı</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Tutar</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Durum</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Para Kime</th>
                  <th className="px-3 py-2 font-medium text-slate-300">Açıklama</th>
                  <th className="px-3 py-2 font-medium text-slate-300 w-14"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">
                      {new Date(s.sale_date).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{s.user_name ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-200">{s.closer_name ?? "-"}</td>
                    <td className="px-3 py-2 font-medium text-emerald-300">
                      {formatNumberTr(Number(s.amount))} ₺
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (s.status === "onay"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300")
                        }
                      >
                        {s.status === "onay" ? "Onay" : "Patladı"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-200">{s.recipient_name ?? "-"}</td>
                    <td className="px-3 py-2 max-w-xs truncate text-slate-300" title={s.description ?? ""}>
                      {s.description ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(s.id)}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {!sales.length && (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-400" colSpan={8}>
                      Henüz satış yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
