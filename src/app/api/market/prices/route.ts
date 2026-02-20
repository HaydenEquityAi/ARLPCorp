import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchAllPrices } from "@/lib/eia";

export const maxDuration = 60;

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("energy_prices")
    .select("*")
    .order("date", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prices: data || [] });
}

export async function POST() {
  try {
    const prices = await fetchAllPrices(20);

    if (prices.length === 0) {
      return NextResponse.json({ error: "No prices fetched from EIA" }, { status: 500 });
    }

    const supabase = createServerClient();

    const rows = prices.map((p) => ({
      series_id: p.seriesId,
      series_name: p.seriesName,
      date: p.period,
      value: p.value,
      unit: p.unit,
    }));

    // Upsert to avoid duplicates
    const { data, error } = await supabase
      .from("energy_prices")
      .upsert(rows, { onConflict: "series_id,date" })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prices: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
