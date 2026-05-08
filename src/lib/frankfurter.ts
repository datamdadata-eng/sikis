type Frankfurter = { rates?: { TRY?: number }; date?: string };

export type FxResult = {
  tryPerUsd: number;
  fxDate: string | null;
  error?: string;
};

export async function fetchTryPerUsd(): Promise<FxResult> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY", {
      cache: "no-store",
    });
    if (!res.ok) return { tryPerUsd: 0, fxDate: null, error: "fx_unavailable" };
    const data = (await res.json()) as Frankfurter;
    const tryPerUsd = data.rates?.TRY;
    if (!tryPerUsd || tryPerUsd <= 0) return { tryPerUsd: 0, fxDate: null, error: "fx_invalid" };
    return { tryPerUsd, fxDate: data.date ?? null };
  } catch {
    return { tryPerUsd: 0, fxDate: null, error: "fx_fetch_failed" };
  }
}
