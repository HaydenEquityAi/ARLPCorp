import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { createServerClient } from "@/lib/supabase";
import { chunkDocuments } from "@/lib/chunker";
import { generateEmbeddings, generateEmbedding } from "@/lib/embeddings";
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

/**
 * Chunk documents, generate embeddings, store in pgvector.
 * Returns the briefing_id used for storage.
 */
async function indexDocuments(
  supabase: ReturnType<typeof createServerClient>,
  briefingId: string,
  documents: DocumentInput[]
) {
  const chunks = chunkDocuments(
    documents.map((d) => ({ name: d.name, content: d.content })),
    1500,
    200
  );

  if (chunks.length === 0) return;

  // Generate embeddings for all chunks in batches
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // Insert chunks with embeddings into pgvector table
  const rows = chunks.map((chunk, i) => ({
    briefing_id: briefingId,
    document_name: chunk.documentName,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
  }));

  // Insert in batches of 50 to avoid payload limits
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("document_chunks").insert(batch);
    if (error) console.error("Failed to insert chunk batch:", error.message);
  }

  return chunks.length;
}

/**
 * RAG: Find the most relevant chunks across all past briefings
 * for a given query, using pgvector similarity search.
 */
async function ragSearch(
  supabase: ReturnType<typeof createServerClient>,
  query: string,
  matchCount = 20,
  threshold = 0.5,
  filterBriefingId?: string
): Promise<{ content: string; document_name: string; similarity: number }[]> {
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: matchCount,
    filter_briefing_id: filterBriefingId || null,
  });

  if (error) {
    console.error("RAG search failed:", error.message);
    return [];
  }

  return data || [];
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
    const hasEmbeddingKey = !!process.env.OPENAI_API_KEY;

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
      // RAG: Pull relevant historical context if embeddings are available
      let ragContext = "";
      if (hasEmbeddingKey) {
        try {
          // Search for relevant chunks from ALL past briefings
          const summary = documents.map((d) => d.content.slice(0, 500)).join(" ");
          const relevantChunks = await ragSearch(supabase, summary, 10, 0.5);

          if (relevantChunks.length > 0) {
            ragContext = `\n\nHISTORICAL CONTEXT (from previous briefings — use this to identify trends and changes):\n${relevantChunks
              .map(
                (c) =>
                  `[${c.document_name}] (relevance: ${(c.similarity * 100).toFixed(0)}%): ${c.content}`
              )
              .join("\n\n")}`;
          }
        } catch (err) {
          console.error("RAG search failed, proceeding without context:", err);
        }
      }

      const briefingMessage = `Here are ${documents.length} documents for executive briefing analysis:\n${documentsText}${ragContext}\n\nAnalyze all documents and produce the executive materiality briefing.`;
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

      // ── RAG: Index current documents for future searches ──
      if (briefingId && hasEmbeddingKey) {
        try {
          const chunksIndexed = await indexDocuments(supabase, briefingId, documents);
          console.log(`Indexed ${chunksIndexed} chunks for briefing ${briefingId}`);
        } catch (err) {
          console.error("Document indexing failed:", err);
        }
      }

      results.briefing = briefingData;
      results.briefing_id = briefingId;

      // ── Phase 2: Analyst Questions ──
      try {
        const questionsMessage = `Here is the executive materiality briefing:\n${JSON.stringify(briefingData)}\n\nPredict the analyst questions for the upcoming call.`;
        const questionsData = await callClaudeJSON<QuestionsData>(
          ANALYST_QUESTIONS_PROMPT,
          questionsMessage
        );

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

      // ── Phase 3: Auto-Trend Comparison ──
      if (briefingId) {
        try {
          const { data: prevBriefings } = await supabase
            .from("briefings")
            .select("id, raw_response")
            .neq("id", briefingId)
            .order("created_at", { ascending: false })
            .limit(1);

          const prevBriefing = prevBriefings?.[0];
          const prevId = previous_briefing_id || prevBriefing?.id;

          if (prevId && prevBriefing?.raw_response) {
            const trendMessage = `PREVIOUS PERIOD BRIEFING:\n${JSON.stringify(prevBriefing.raw_response)}\n\nCURRENT PERIOD BRIEFING:\n${JSON.stringify(briefingData)}\n\nCompare these two periods.`;
            const trendsData = await callClaudeJSON<TrendsData>(
              TREND_COMPARISON_PROMPT,
              trendMessage
            );

            await supabase.from("trend_comparisons").insert({
              current_briefing_id: briefingId,
              previous_briefing_id: prevId,
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
        rag_enabled: hasEmbeddingKey,
      },
    });
  } catch (err: unknown) {
    console.error("Analysis error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
