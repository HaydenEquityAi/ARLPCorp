import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { COMPETITOR_ANALYSIS_PROMPT } from "@/lib/prompts";
import type { CompetitorAnalysis } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { raw_text, source } = await request.json();

    if (!raw_text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const truncated = raw_text.slice(0, 50000);

    const analysis = await callClaudeJSON<CompetitorAnalysis>(
      COMPETITOR_ANALYSIS_PROMPT,
      `COMPETITOR TRANSCRIPT (source: ${source || "unknown"}):\n${truncated}`
    );

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
