"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, LogOut, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = "Ocak Şubat Mart Nisan Mayıs Haziran Temmuz Ağustos Eylül Ekim Kasım Aralık".split(" ");

const formatNumberTr = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

type DailyRow = { date: string; total_onay: string; total_patladi: string; total_amount: string };
type NonWorkingDay = { id: number; date: string; description: string | null };
type DayDetail = {
  date: string;
  total_onay: string;
  total_patladi: string;
  total_amount: string;
  net: number;
  users: { user_id: number | null; user_name: string | null; total_onay: string; total_patladi: string; total_amount: string }[];
  closers: { closer_id: number | null; closer_name: string | null; total_onay: string; total_patladi: string; total_amount: string }[];
};

export default function CiroPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [nonWorkingDays, setNonWorkingDays] = useState<NonWorkingDay[]>([]);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);

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
        const [dailyRes, nwRes] = await Promise.all([
          fetch(`/api/summary/daily?month=${currentMonth}`),
          fetch(`/api/non-working-days?month=${currentMonth}`),
        ]);
        const data = await dailyRes.json();
        setDailyData(Array.isArray(data) ? data : []);
        try {
          const nwData = await nwRes.json();
          setNonWorkingDays(Array.isArray(nwData) ? nwData : []);
        } catch {
          setNonWorkingDays([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn, currentMonth]);

  useEffect(() => {
    if (!loggedIn || !selectedDate) {
      setDayDetail(null);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/summary/day?date=${selectedDate}`);
        if (res.ok) {
          const data = await res.json();
          setDayDetail(data);
        } else {
          setDayDetail(null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn, selectedDate]);

  const handleLogout = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("satistakip-token");
    setLoggedIn(false);
    setCurrentUserName(null);
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

  const [y, m] = currentMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = lastDay.getDate();
  const dailyMap = Object.fromEntries(dailyData.map((r) => [r.date, r]));
  const nonWorkingMap = Object.fromEntries(
    nonWorkingDays.map((d) => [(d.date || "").slice(0, 10), d])
  );
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const netForSelected = dayDetail ? dayDetail.net : 0;
  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : "Gün seçin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Dashboard</Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2">
              <CalendarIcon className="size-4" />
              Ciro
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
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Ciro Takvimi</h1>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{selectedLabel}</p>
            <p className={cn("text-3xl font-bold", netForSelected >= 0 ? "text-primary" : "text-destructive")}>
              {selectedDate ? formatNumberTr(netForSelected) : "—"} ₺
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Net ciro (Onay − Patladı)</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">{MONTHS[m - 1]} {y}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1 font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: startWeekday }, (_, i) => (
                <div key={`pad-${i}`} className="min-h-[64px] rounded-md bg-muted/20" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const row = dailyMap[dateStr];
                const nw = nonWorkingMap[dateStr];
                const onay = row ? Number(row.total_onay) : 0;
                const patladi = row ? Number(row.total_patladi) : 0;
                const net = onay - patladi;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      "min-h-[64px] rounded-md border p-1 text-left transition-colors hover:bg-accent",
                      isSelected && "ring-2 ring-primary bg-primary/10",
                      isToday && !isSelected && "border-primary/50 bg-primary/5",
                      nw && "bg-amber-500/15 border-amber-500/60 dark:bg-amber-500/20"
                    )}
                  >
                    <span className={cn("font-medium", isToday && "text-primary")}>{day}</span>
                    {nw ? (
                      <p className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Çalışılmadı</p>
                    ) : row ? (
                      <p className={cn("mt-0.5 text-[10px] font-medium", net >= 0 ? "text-primary" : "text-destructive")}>
                        {formatNumberTr(net)} ₺
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {nonWorkingDays.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60 align-middle mr-1" />
                Çalışılmadı işaretli günler
              </p>
            )}
          </CardContent>
        </Card>

        {dayDetail && (
          <Card>
            <CardHeader>
              <CardTitle>Gün sonu özeti — {selectedLabel}</CardTitle>
              {selectedDate && nonWorkingMap[selectedDate] && (
                <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm">
                  <span className="font-medium text-amber-700 dark:text-amber-400">Çalışılmadı</span>
                  {nonWorkingMap[selectedDate].description && (
                    <p className="mt-1 text-muted-foreground">{nonWorkingMap[selectedDate].description}</p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Onay toplamı</p>
                  <p className="text-lg font-semibold text-primary">{formatNumberTr(Number(dayDetail.total_onay))} ₺</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Patladı toplamı</p>
                  <p className="text-lg font-semibold text-destructive">{formatNumberTr(Number(dayDetail.total_patladi))} ₺</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net</p>
                  <p className={cn("text-lg font-semibold", dayDetail.net >= 0 ? "text-primary" : "text-destructive")}>
                    {formatNumberTr(dayDetail.net)} ₺
                  </p>
                </div>
              </div>

              {dayDetail.users.length > 0 && (
                <div>
                  <p className="mb-2 font-medium text-muted-foreground">Kullanıcı bazlı</p>
                  <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-2">
                    {dayDetail.users.map((u) => {
                      const onay = Number(u.total_onay);
                      const patladi = Number(u.total_patladi);
                      const net = onay - patladi;
                      return (
                        <div key={u.user_id ?? u.user_name ?? Math.random()} className="flex justify-between text-sm">
                          <span>{u.user_name ?? "—"}</span>
                          <span className={cn("font-medium", net >= 0 ? "text-primary" : "text-destructive")}>
                            {formatNumberTr(net)} ₺
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {dayDetail.closers.length > 0 && (
                <div>
                  <p className="mb-2 font-medium text-muted-foreground">Kapatıcı bazlı</p>
                  <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-2">
                    {dayDetail.closers.map((u) => {
                      const onay = Number(u.total_onay);
                      const patladi = Number(u.total_patladi);
                      const net = onay - patladi;
                      return (
                        <div key={u.closer_id ?? u.closer_name ?? Math.random()} className="flex justify-between text-sm">
                          <span>{u.closer_name ?? "—"}</span>
                          <span className={cn("font-medium", net >= 0 ? "text-primary" : "text-destructive")}>
                            {formatNumberTr(net)} ₺
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {dayDetail.users.length === 0 && dayDetail.closers.length === 0 && Number(dayDetail.total_amount) === 0 && (
                <p className="text-muted-foreground text-sm">Bu güne ait satış yok.</p>
              )}
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
