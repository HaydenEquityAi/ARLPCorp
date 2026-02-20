import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude } from "@/lib/anthropic";
import { MORNING_BRIEFING_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function GET() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("morning_briefings")
    .select("*")
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ briefing: data || null });
}

export async function POST() {
  const supabase = createServerClient();

  // Gather context: recent prices, regulatory news, latest briefing
  const [pricesRes, regRes, briefingRes] = await Promise.all([
    supabase.from("energy_prices").select("*").order("date", { ascending: false }).limit(10),
    supabase.from("regulatory_news").select("*").order("date", { ascending: false }).limit(5),
    supabase.from("briefings").select("title, executive_summary").order("created_at", { ascending: false }).limit(1),
  ]);

  const context = `
LATEST ENERGY PRICES:
${JSON.stringify(pricesRes.data || [])}

RECENT REGULATORY NEWS:
${JSON.stringify((regRes.data || []).map((r: Record<string, unknown>) => ({ title: r.title, impact: r.impact_analysis, score: r.impact_score })))}

LATEST EXECUTIVE BRIEFING:
${briefingRes.data?.[0] ? `${briefingRes.data[0].title}: ${briefingRes.data[0].executive_summary}` : "No recent briefing"}
`;

  try {
    const content = await callClaude(MORNING_BRIEFING_PROMPT, context);

    // Extract key metrics from prices
    const prices = pricesRes.data || [];
    const coalPrice = prices.find((p: Record<string, unknown>) => String(p.series_name || "").toLowerCase().includes("coal"));
    const gasPrice = prices.find((p: Record<string, unknown>) => String(p.series_name || "").toLowerCase().includes("gas"));

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("morning_briefings")
      .insert({
        date: today,
        content,
        key_metrics: {
          coal_price: coalPrice ? Number(coalPrice.value) : null,
          gas_price: gasPrice ? Number(gasPrice.value) : null,
        },
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ briefing: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Briefing generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
