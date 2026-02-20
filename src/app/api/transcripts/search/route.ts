import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { callClaude } from "@/lib/anthropic";
import { TRANSCRIPT_SEARCH_PROMPT } from "@/lib/prompts";

export const maxDuration = 120;

function sseMessage(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, ...(typeof data === "object" && data !== null ? data : { data }) })}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseMessage(type, data)));
        } catch { /* stream closed */ }
      };

      try {
        const { query } = await request.json();
        if (!query) {
          send("error", { message: "No query provided" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query);

        // Search transcript chunks via pgvector
        const { data: chunks, error } = await supabase.rpc("match_transcript_chunks", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.4,
          match_count: 10,
        });

        if (error) {
          send("error", { message: error.message });
          controller.close();
          return;
        }

        if (!chunks || chunks.length === 0) {
          send("answer", { content: "No relevant transcript excerpts found for your query.", citations: [] });
          controller.close();
          return;
        }

        // Send citations
        const citations = chunks.map((c: { content: string; speaker: string; section_type: string; similarity: number }) => ({
          content: c.content.slice(0, 200),
          source: `${c.speaker || "Unknown"} (${c.section_type})`,
          similarity: c.similarity,
        }));
        send("citations", { citations });

        // Build context for Claude
        const context = chunks
          .map((c: { speaker: string; section_type: string; similarity: number; content: string }) =>
            `[Speaker: ${c.speaker || "Unknown"}, Section: ${c.section_type}, Relevance: ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`
          )
          .join("\n\n---\n\n");

        const userMessage = `TRANSCRIPT EXCERPTS:\n${context}\n\nUSER QUESTION: ${query}`;
        const answer = await callClaude(TRANSCRIPT_SEARCH_PROMPT, userMessage);

        send("answer", { content: answer, citations });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
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
