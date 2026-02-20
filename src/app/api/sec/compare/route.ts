import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude } from "@/lib/anthropic";
import { RISK_FACTOR_COMPARISON_PROMPT } from "@/lib/prompts";

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
        const { filing_a_id, filing_b_id } = await request.json();

        if (!filing_a_id || !filing_b_id) {
          send("error", { message: "Two filing IDs required" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        const [{ data: a }, { data: b }] = await Promise.all([
          supabase.from("sec_filings").select("*").eq("id", filing_a_id).single(),
          supabase.from("sec_filings").select("*").eq("id", filing_b_id).single(),
        ]);

        if (!a || !b) {
          send("error", { message: "One or both filings not found" });
          controller.close();
          return;
        }

        send("phase", { phase: "Comparing risk factors between filings..." });

        const riskA = a.risk_factors_text || "No risk factors extracted";
        const riskB = b.risk_factors_text || "No risk factors extracted";

        const userMessage = `FILING A: ${a.filing_type} filed ${a.filing_date}\nRisk Factors:\n${riskA.slice(0, 40000)}\n\n---\n\nFILING B: ${b.filing_type} filed ${b.filing_date}\nRisk Factors:\n${riskB.slice(0, 40000)}`;

        const answer = await callClaude(RISK_FACTOR_COMPARISON_PROMPT, userMessage);
        send("answer", { content: answer });
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
