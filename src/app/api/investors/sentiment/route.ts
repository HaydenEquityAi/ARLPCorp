import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaudeJSON } from "@/lib/anthropic";
import { INVESTOR_SENTIMENT_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sentiment_scores")
    .select("*")
    .order("date", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scores: data || [] });
}

export async function POST() {
  const supabase = createServerClient();

  // Gather all available data
  const [holdingsRes, ratingsRes, shortRes] = await Promise.all([
    supabase.from("institutional_holders").select("*").order("report_date", { ascending: false }).limit(20),
    supabase.from("analyst_ratings").select("*").order("date", { ascending: false }).limit(10),
    supabase.from("short_interest").select("*").order("settlement_date", { ascending: false }).limit(5),
  ]);

  const context = `
INSTITUTIONAL HOLDINGS (recent):
${JSON.stringify(holdingsRes.data || [])}

ANALYST RATINGS (recent):
${JSON.stringify(ratingsRes.data || [])}

SHORT INTEREST (recent):
${JSON.stringify(shortRes.data || [])}
`;

  try {
    const result = await callClaudeJSON<{
      score: number;
      components: { holdings_signal: number; ratings_signal: number; short_interest_signal: number };
      rationale: string;
    }>(INVESTOR_SENTIMENT_PROMPT, context);

    // Save to database
    const { data, error } = await supabase
      .from("sentiment_scores")
      .insert({
        date: new Date().toISOString().split("T")[0],
        score: result.score,
        components: result.components,
        rationale: result.rationale,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ score: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sentiment calculation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
