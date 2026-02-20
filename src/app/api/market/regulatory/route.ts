import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaudeJSON } from "@/lib/anthropic";
import { REGULATORY_IMPACT_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("regulatory_news")
    .select("*")
    .order("date", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, content, source } = body;

  if (!content) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  try {
    // Analyze impact with Claude
    const analysis = await callClaudeJSON<{
      impact_score: number;
      category: string;
      impact_analysis: string;
    }>(REGULATORY_IMPACT_PROMPT, `ARTICLE TITLE: ${title || "Unknown"}\n\nARTICLE CONTENT:\n${content.slice(0, 20000)}`);

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("regulatory_news")
      .insert({
        title: title || "Untitled",
        source: source || "manual upload",
        date: new Date().toISOString().split("T")[0],
        content: content.slice(0, 50000),
        impact_score: analysis.impact_score,
        impact_analysis: analysis.impact_analysis,
        category: analysis.category,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
