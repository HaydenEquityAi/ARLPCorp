import { NextRequest } from "next/server";
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

  if (chunks.length === 0) return 0;

  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  const rows = chunks.map((chunk, i) => ({
    briefing_id: briefingId,
    document_name: chunk.documentName,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("document_chunks").insert(batch);
    if (error) console.error("Chunk insert error:", error.message);
  }

  return chunks.length;
}

/**
 * RAG: similarity search against stored document chunks.
 */
async function ragSearch(
  supabase: ReturnType<typeof createServerClient>,
  query: string,
  matchCount = 15,
  threshold = 0.5
): Promise<{ content: string; document_name: string; similarity: number }[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: matchCount,
      filter_briefing_id: null,
    });

    if (error) {
      console.error("RAG search error:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("RAG search failed:", err);
    return [];
  }
}

/**
 * SSE helper: format a Server-Sent Event message.
 */
function sseMessage(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, ...( typeof data === 'object' && data !== null ? data : { data }) })}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseMessage(type, data)));
        } catch {
          // Stream may be closed
        }
      };

      try {
        const body = await request.json();
        const { documents, mode, previous_briefing_id } = body as {
          documents: DocumentInput[];
          mode: "briefing" | "questions" | "trends" | "full";
          previous_briefing_id?: string;
        };

        if (!documents || documents.length === 0) {
          send("error", { message: "No documents provided" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        const documentsText = documents
          .map(
            (doc: DocumentInput, i: number) =>
              `\n--- DOCUMENT ${i + 1}: ${doc.name} ---\n${doc.content}\n--- END ${doc.name} ---`
          )
          .join("\n");

        const totalWords = documents.reduce(
          (sum: number, d: DocumentInput) => sum + (d.content?.split(/\s+/).length || 0),
          0
        );

        // ── Phase 1: Materiality Analysis ──
        if (mode === "briefing" || mode === "full") {
          send("phase", { phase: "Running materiality analysis across all documents..." });

          // RAG: pull historical context
          let ragContext = "";
          try {
            const summary = documents.map((d: DocumentInput) => d.content.slice(0, 500)).join(" ");
            const relevantChunks = await ragSearch(supabase, summary, 10, 0.5);
            if (relevantChunks.length > 0) {
              ragContext = `\n\nHISTORICAL CONTEXT (from previous briefings — use to identify trends):\n${relevantChunks
                .map(
                  (c) =>
                    `[${c.document_name}] (relevance: ${(c.similarity * 100).toFixed(0)}%): ${c.content}`
                )
                .join("\n\n")}`;
              send("phase", { phase: `Found ${relevantChunks.length} relevant historical chunks...` });
            }
          } catch (err) {
            console.error("RAG context failed, continuing without:", err);
          }

          const briefingMessage = `Here are ${documents.length} documents for executive briefing analysis:\n${documentsText}${ragContext}\n\nAnalyze all documents and produce the executive materiality briefing.`;

          let briefingData: BriefingData;
          try {
            briefingData = await callClaudeJSON<BriefingData>(MATERIALITY_PROMPT, briefingMessage);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Claude analysis failed";
            send("error", { message: `Materiality analysis failed: ${msg}` });
            controller.close();
            return;
          }

          // Save briefing to Supabase
          let briefingId: string | null = null;
          try {
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

            if (briefingError) throw briefingError;
            briefingId = briefingRow?.id || null;
          } catch (err) {
            console.error("Failed to save briefing:", err);
          }

          // Save bullets
          if (briefingId && briefingData.bullets?.length) {
            try {
              await supabase.from("bullets").insert(
                briefingData.bullets.map((b) => ({
                  briefing_id: briefingId,
                  rank: b.rank,
                  materiality_score: b.materiality_score,
                  category: b.category,
                  finding: b.finding,
                  source_document: b.source_document,
                  so_what: b.so_what,
                  action_needed: b.action_needed || false,
                }))
              );
            } catch (err) {
              console.error("Failed to save bullets:", err);
            }
          }

          // Save document metadata
          if (briefingId) {
            try {
              await supabase.from("documents").insert(
                documents.map((d: DocumentInput) => ({
                  briefing_id: briefingId,
                  file_name: d.name,
                  file_type: d.type || "unknown",
                  file_size: d.size || 0,
                  word_count: d.content?.split(/\s+/).length || 0,
                  page_count: d.pageCount,
                }))
              );
            } catch (err) {
              console.error("Failed to save documents:", err);
            }
          }

          // Stream briefing result immediately
          send("briefing", { data: briefingData, briefing_id: briefingId });

          // ── Phase 2: Analyst Questions ──
          send("phase", { phase: "Predicting analyst questions for the earnings call..." });

          try {
            const questionsMessage = `Here is the executive materiality briefing:\n${JSON.stringify(briefingData)}\n\nPredict the analyst questions for the upcoming call.`;
            const questionsData = await callClaudeJSON<QuestionsData>(
              ANALYST_QUESTIONS_PROMPT,
              questionsMessage
            );

            if (briefingId && questionsData.predicted_questions?.length) {
              try {
                await supabase.from("analyst_questions").insert(
                  questionsData.predicted_questions.map((q) => ({
                    briefing_id: briefingId,
                    rank: q.rank,
                    question: q.question,
                    triggered_by: q.triggered_by,
                    suggested_response: q.suggested_response,
                    difficulty: q.difficulty,
                    likely_asker_type: q.likely_asker_type,
                  }))
                );
                await supabase
                  .from("briefings")
                  .update({ analyst_questions_response: questionsData })
                  .eq("id", briefingId);
              } catch (err) {
                console.error("Failed to save questions:", err);
              }
            }

            send("questions", { data: questionsData });
          } catch (err) {
            console.error("Questions analysis failed:", err);
            send("phase", { phase: "Analyst questions unavailable, continuing..." });
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
                send("phase", { phase: "Comparing with previous period..." });

                const trendMessage = `PREVIOUS PERIOD BRIEFING:\n${JSON.stringify(prevBriefing.raw_response)}\n\nCURRENT PERIOD BRIEFING:\n${JSON.stringify(briefingData)}\n\nCompare these two periods.`;
                const trendsData = await callClaudeJSON<TrendsData>(
                  TREND_COMPARISON_PROMPT,
                  trendMessage
                );

                try {
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
                } catch (err) {
                  console.error("Failed to save trends:", err);
                }

                send("trends", { data: trendsData });
              }
            } catch (err) {
              console.error("Trend analysis failed:", err);
            }
          }

          // ── RAG: Index documents for future searches ──
          if (briefingId) {
            try {
              send("phase", { phase: "Indexing documents for future intelligence..." });
              const chunksIndexed = await indexDocuments(supabase, briefingId, documents);
              console.log(`Indexed ${chunksIndexed} chunks for briefing ${briefingId}`);
            } catch (err) {
              console.error("Document indexing failed (non-blocking):", err);
            }
          }

          // Done
          send("done", {
            metadata: {
              documents_analyzed: documents.length,
              total_words: totalWords,
              analyzed_at: new Date().toISOString(),
              briefing_id: briefingId,
            },
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        console.error("Analysis error:", err);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
