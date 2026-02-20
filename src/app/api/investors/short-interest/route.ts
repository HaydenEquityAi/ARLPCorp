import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("short_interest")
    .select("*")
    .order("settlement_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data: rows } = body;

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "Data array required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const insertRows = rows.map((r: Record<string, string>) => ({
    settlement_date: r.settlement_date,
    short_interest: parseInt(r.short_interest) || 0,
    avg_daily_volume: parseInt(r.avg_daily_volume) || 0,
    days_to_cover: parseFloat(r.days_to_cover) || 0,
    pct_float: parseFloat(r.pct_float) || 0,
    change_pct: parseFloat(r.change_pct) || 0,
  }));

  const { data, error } = await supabase
    .from("short_interest")
    .insert(insertRows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
