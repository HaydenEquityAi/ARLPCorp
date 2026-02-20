import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("risk_factor_tracking")
    .select("id, filing_id, title, content, severity_score, status, category, created_at")
    .order("severity_score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risk_factors: data || [] });
}
