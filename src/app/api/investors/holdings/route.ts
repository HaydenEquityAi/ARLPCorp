import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("institutional_holders")
    .select("*")
    .order("shares_held", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ holdings: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { holdings } = body;

  if (!holdings || !Array.isArray(holdings)) {
    return NextResponse.json({ error: "Holdings array required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const rows = holdings.map((h: Record<string, string>) => ({
    institution_name: h.institution_name,
    shares_held: parseInt(h.shares_held) || 0,
    market_value: parseFloat(h.market_value) || 0,
    pct_of_portfolio: parseFloat(h.pct_of_portfolio) || 0,
    change_shares: parseInt(h.change_shares) || 0,
    change_pct: parseFloat(h.change_pct) || 0,
    report_date: h.report_date || new Date().toISOString().split("T")[0],
    source: h.source || "csv_import",
  }));

  const { data, error } = await supabase
    .from("institutional_holders")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ holdings: data });
}
