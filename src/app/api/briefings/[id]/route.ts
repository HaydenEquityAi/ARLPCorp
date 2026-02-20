import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const [briefingRes, bulletsRes, questionsRes, trendsRes] = await Promise.all([
      supabase.from("briefings").select("*").eq("id", id).single(),
      supabase.from("bullets").select("*").eq("briefing_id", id).order("rank"),
      supabase.from("analyst_questions").select("*").eq("briefing_id", id).order("rank"),
      supabase.from("trend_comparisons").select("*").eq("current_briefing_id", id).limit(1),
    ]);

    if (briefingRes.error) {
      return NextResponse.json({ error: "Briefing not found" }, { status: 404 });
    }

    const briefing = briefingRes.data;

    // Reconstruct the BriefingData shape from DB
    const briefingData = briefing.raw_response || {
      briefing_title: briefing.title,
      generated_at: briefing.created_at,
      document_count: briefing.document_count,
      executive_summary: briefing.executive_summary,
      bullets: (bulletsRes.data || []).map((b) => ({
        rank: b.rank,
        materiality_score: b.materiality_score,
        category: b.category,
        finding: b.finding,
        source_document: b.source_document,
        so_what: b.so_what,
        action_needed: b.action_needed,
      })),
    };

    const questionsData = briefing.analyst_questions_response || (
      questionsRes.data?.length
        ? {
            predicted_questions: questionsRes.data.map((q) => ({
              rank: q.rank,
              question: q.question,
              triggered_by: q.triggered_by,
              suggested_response: q.suggested_response,
              difficulty: q.difficulty,
              likely_asker_type: q.likely_asker_type,
            })),
            call_risk_assessment: "",
          }
        : null
    );

    const trendsData = briefing.trend_response || (
      trendsRes.data?.[0]
        ? {
            trend_analysis: {
              improved: trendsRes.data[0].improved,
              deteriorated: trendsRes.data[0].deteriorated,
              new_items: trendsRes.data[0].new_items,
              resolved: trendsRes.data[0].resolved,
            },
            overall_trajectory: trendsRes.data[0].overall_trajectory,
          }
        : null
    );

    return NextResponse.json({
      briefing: briefingData,
      questions: questionsData,
      trends: trendsData,
      briefing_id: id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch briefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
