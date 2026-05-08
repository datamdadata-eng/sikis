import { NextResponse } from "next/server";
import { fetchTryPerUsd } from "@/lib/frankfurter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const fx = await fetchTryPerUsd();
  return NextResponse.json({
    tryPerUsd: fx.tryPerUsd,
    fxDate: fx.fxDate,
    fxError: fx.error ?? null,
    refetchedAt: new Date().toISOString(),
  });
}
