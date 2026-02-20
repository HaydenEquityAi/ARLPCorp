import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { createServerClient } from "@/lib/supabase";
import {
  MATERIALITY_PROMPT,
  TREND_COMPARISON_PROMPT,
  ANALYST_QUESTIONS_PROMPT,
} from "@/lib/prompts";
import type { BriefingData, QuestionsData, TrendsData } from "@/lib/types";

export const maxDuration = 120;

interface DocumentInput {
  name: string;
  content: string;
  wordCount?: number;
  pageCount?: number;
  type?: string;
  size?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      documents,
      mode,
      previous_briefing_id,
    }: {
      documents: DocumentInput[];
      mode: "briefing" | "questions" | "trends" | "full";
      previous_briefing_id?: string;
    } = body;

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: "No documents provided" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const results: Record<string, unknown> = {};

    const documentsText = documents
      .map(
        (doc, i) =>
          `\n--- DOCUMENT ${i + 1}: ${doc.name} ---\n${doc.content}\n--- END ${doc.name} ---`
      )
      .join("\n");

    const totalWords = documents.reduce(
      (sum, d) => sum + (d.content?.split(/\s+/).length || 0),
      0
    );

    // ── Phase 1: Materiality Analysis ──
    if (mode === "briefing" || mode === "full") {
      const briefingMessage = `Here are ${documents.length} documents for executive briefing analysis:\n${documentsText}\n\nAnalyze all documents and produce the executive materiality briefing.`;
      const briefingData = await callClaudeJSON<BriefingData>(
        MATERIALITY_PROMPT,
        briefingMessage
      );

      // Save briefing to Supabase
      const { data: briefingRow, error: briefingError } = await supabase
        .from("briefings")
        .insert({
          title: briefingData.briefing_title || "Executive Briefing",
          executive_summary: briefingData.executive_summary,
          document_count: documents.length,
          total_words: totalWords,
          raw_response: briefingData,
        })
        .select("id")
        .single();

      if (briefingError) {
        console.error("Failed to save briefing:", briefingError);
      }

      const briefingId = briefingRow?.id;

      // Save bullets
      if (briefingId && briefingData.bullets?.length) {
        const bulletRows = briefingData.bullets.map((b) => ({
          briefing_id: briefingId,
          rank: b.rank,
          materiality_score: b.materiality_score,
          category: b.category,
          finding: b.finding,
          source_document: b.source_document,
          so_what: b.so_what,
          action_needed: b.action_needed || false,
        }));
        await supabase.from("bullets").insert(bulletRows);
      }

      // Save document metadata
      if (briefingId) {
        const docRows = documents.map((d) => ({
          briefing_id: briefingId,
          file_name: d.name,
          file_type: d.type || "unknown",
          file_size: d.size || 0,
          word_count: d.content?.split(/\s+/).length || 0,
          page_count: d.pageCount,
        }));
        await supabase.from("documents").insert(docRows);
      }

      results.briefing = briefingData;
      results.briefing_id = briefingId;

      // ── Phase 2: Analyst Questions ──
      if (mode === "full" || mode === "briefing") {
        try {
          const questionsMessage = `Here is the executive materiality briefing:\n${JSON.stringify(briefingData)}\n\nPredict the analyst questions for the upcoming call.`;
          const questionsData = await callClaudeJSON<QuestionsData>(
            ANALYST_QUESTIONS_PROMPT,
            questionsMessage
          );

          // Save questions
          if (briefingId && questionsData.predicted_questions?.length) {
            const questionRows = questionsData.predicted_questions.map((q) => ({
              briefing_id: briefingId,
              rank: q.rank,
              question: q.question,
              triggered_by: q.triggered_by,
              suggested_response: q.suggested_response,
              difficulty: q.difficulty,
              likely_asker_type: q.likely_asker_type,
            }));
            await supabase.from("analyst_questions").insert(questionRows);
            await supabase
              .from("briefings")
              .update({ analyst_questions_response: questionsData })
              .eq("id", briefingId);
          }

          results.questions = questionsData;
        } catch (err) {
          console.error("Questions analysis failed:", err);
        }
      }

      // ── Phase 3: Auto-Trend Comparison ──
      if (briefingId) {
        try {
          // Find most recent previous briefing
          const { data: prevBriefings } = await supabase
            .from("briefings")
            .select("id, raw_response")
            .neq("id", briefingId)
            .order("created_at", { ascending: false })
            .limit(1);

          const prevBriefing = prevBriefings?.[0];
          const prevBriefingIdToUse = previous_briefing_id || prevBriefing?.id;

          if (prevBriefingIdToUse && prevBriefing?.raw_response) {
            const trendMessage = `PREVIOUS PERIOD BRIEFING:\n${JSON.stringify(prevBriefing.raw_response)}\n\nCURRENT PERIOD BRIEFING:\n${JSON.stringify(briefingData)}\n\nCompare these two periods.`;
            const trendsData = await callClaudeJSON<TrendsData>(
              TREND_COMPARISON_PROMPT,
              trendMessage
            );

            // Save trend comparison
            await supabase.from("trend_comparisons").insert({
              current_briefing_id: briefingId,
              previous_briefing_id: prevBriefingIdToUse,
              improved: trendsData.trend_analysis?.improved || [],
              deteriorated: trendsData.trend_analysis?.deteriorated || [],
              new_items: trendsData.trend_analysis?.new_items || [],
              resolved: trendsData.trend_analysis?.resolved || [],
              overall_trajectory: trendsData.overall_trajectory,
            });

            await supabase
              .from("briefings")
              .update({ trend_response: trendsData })
              .eq("id", briefingId);

            results.trends = trendsData;
          }
        } catch (err) {
          console.error("Trend analysis failed:", err);
        }
      }
    }

    // Standalone questions mode
    if (mode === "questions" && body.briefing_data) {
      const questionsMessage = `Here is the executive materiality briefing:\n${JSON.stringify(body.briefing_data)}\n\nPredict the analyst questions for the upcoming call.`;
      const questionsData = await callClaudeJSON<QuestionsData>(
        ANALYST_QUESTIONS_PROMPT,
        questionsMessage
      );
      results.questions = questionsData;
    }

    // Standalone trends mode
    if (mode === "trends" && body.previous_briefing && body.current_briefing) {
      const trendMessage = `PREVIOUS PERIOD BRIEFING:\n${JSON.stringify(body.previous_briefing)}\n\nCURRENT PERIOD BRIEFING:\n${JSON.stringify(body.current_briefing)}\n\nCompare these two periods.`;
      const trendsData = await callClaudeJSON<TrendsData>(
        TREND_COMPARISON_PROMPT,
        trendMessage
      );
      results.trends = trendsData;
    }

    return NextResponse.json({
      success: true,
      ...results,
      metadata: {
        documents_analyzed: documents.length,
        total_words: totalWords,
        analyzed_at: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error("Analysis error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
