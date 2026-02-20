import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude } from "@/lib/anthropic";
import { TRANSCRIPT_COMPARE_PROMPT } from "@/lib/prompts";

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
        const { transcript_a_id, transcript_b_id } = await request.json();

        if (!transcript_a_id || !transcript_b_id) {
          send("error", { message: "Two transcript IDs required" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        const [{ data: a }, { data: b }] = await Promise.all([
          supabase.from("earnings_transcripts").select("*").eq("id", transcript_a_id).single(),
          supabase.from("earnings_transcripts").select("*").eq("id", transcript_b_id).single(),
        ]);

        if (!a || !b) {
          send("error", { message: "One or both transcripts not found" });
          controller.close();
          return;
        }

        send("phase", { phase: `Comparing ${a.company} Q${a.fiscal_quarter} FY${a.fiscal_year} vs Q${b.fiscal_quarter} FY${b.fiscal_year}...` });

        // Truncate transcripts if too long (keep first ~50k chars each)
        const textA = a.raw_text.slice(0, 50000);
        const textB = b.raw_text.slice(0, 50000);

        const userMessage = `QUARTER A: ${a.company} FY${a.fiscal_year} Q${a.fiscal_quarter}\n${textA}\n\n---\n\nQUARTER B: ${b.company} FY${b.fiscal_year} Q${b.fiscal_quarter}\n${textB}`;

        const answer = await callClaude(TRANSCRIPT_COMPARE_PROMPT, userMessage);
        send("answer", { content: answer });

        // Cache comparison
        await supabase.from("transcript_comparisons").insert({
          transcript_a_id,
          transcript_b_id,
          analysis: answer,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Comparison failed";
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
