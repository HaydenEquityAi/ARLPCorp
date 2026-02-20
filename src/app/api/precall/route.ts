import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude, callClaudeJSON } from "@/lib/anthropic";
import {
  OPENING_REMARKS_PROMPT,
  DANGER_ZONES_PROMPT,
} from "@/lib/prompts";

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
        const { briefing_id } = await request.json();

        if (!briefing_id) {
          send("error", { message: "briefing_id required" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        // Get briefing data
        const { data: briefing } = await supabase
          .from("briefings")
          .select("*")
          .eq("id", briefing_id)
          .single();

        if (!briefing || !briefing.raw_response) {
          send("error", { message: "Briefing not found" });
          controller.close();
          return;
        }

        const briefingJson = JSON.stringify(briefing.raw_response);

        // Phase 1: Opening Remarks
        send("phase", { phase: "Drafting opening remarks..." });
        try {
          const remarks = await callClaude(
            OPENING_REMARKS_PROMPT,
            `Here is the executive materiality briefing:\n${briefingJson}`
          );
          send("opening_remarks", { data: remarks });
        } catch (err) {
          console.error("Opening remarks failed:", err);
          send("phase", { phase: "Opening remarks generation failed, continuing..." });
        }

        // Phase 2: Danger Zones
        send("phase", { phase: "Identifying danger zones..." });
        try {
          const dangerData = await callClaudeJSON<{
            danger_zones: {
              topic: string;
              why_dangerous: string;
              worst_question: string;
              recommended_deflection: string;
              severity: string;
            }[];
          }>(DANGER_ZONES_PROMPT, `Here is the executive materiality briefing:\n${briefingJson}`);

          send("danger_zones", { data: dangerData.danger_zones || [] });
        } catch (err) {
          console.error("Danger zones failed:", err);
          send("phase", { phase: "Danger zone analysis failed, continuing..." });
        }

        // Save precall session
        try {
          await supabase.from("precall_sessions").insert({
            briefing_id,
          });
        } catch (err) {
          console.error("Failed to save precall session:", err);
        }

        send("done", { message: "Pre-call intelligence complete" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pre-call generation failed";
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
