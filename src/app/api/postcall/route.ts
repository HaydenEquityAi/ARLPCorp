import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaudeJSON, callClaude } from "@/lib/anthropic";
import {
  PREDICTION_ACCURACY_PROMPT,
  CALL_SENTIMENT_PROMPT,
  ACTION_ITEMS_PROMPT,
  PRESS_REACTION_PROMPT,
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
        const body = await request.json();
        const { transcript_id, press_article } = body;

        // If press_article is provided, just analyze that
        if (press_article) {
          send("phase", { phase: "Analyzing press article..." });
          const reaction = await callClaudeJSON<{
            sentiment: string;
            sentiment_score: number;
            key_takeaways: string[];
          }>(PRESS_REACTION_PROMPT, `ARTICLE: ${press_article.title}\n\n${press_article.content.slice(0, 20000)}`);

          const supabase = createServerClient();
          const { data: saved } = await supabase
            .from("press_reactions")
            .insert({
              title: press_article.title,
              source: press_article.source || "manual upload",
              date: new Date().toISOString().split("T")[0],
              sentiment: reaction.sentiment,
              sentiment_score: reaction.sentiment_score,
              key_takeaways: reaction.key_takeaways,
              full_text: press_article.content.slice(0, 50000),
            })
            .select()
            .single();

          send("press_reaction", { data: saved });
          controller.close();
          return;
        }

        if (!transcript_id) {
          send("error", { message: "transcript_id required" });
          controller.close();
          return;
        }

        const supabase = createServerClient();

        // Get transcript
        const { data: transcript } = await supabase
          .from("earnings_transcripts")
          .select("*")
          .eq("id", transcript_id)
          .single();

        if (!transcript) {
          send("error", { message: "Transcript not found" });
          controller.close();
          return;
        }

        const transcriptText = transcript.raw_text.slice(0, 80000);

        // Get most recent predicted questions (if any)
        const { data: recentQuestions } = await supabase
          .from("analyst_questions")
          .select("question, difficulty")
          .order("created_at", { ascending: false })
          .limit(10);

        // Phase 1: Prediction Accuracy (if we have predictions)
        let predictionAccuracy = null;
        if (recentQuestions && recentQuestions.length > 0) {
          send("phase", { phase: "Scoring prediction accuracy..." });
          try {
            const predictedList = recentQuestions.map((q: Record<string, unknown>) => q.question).join("\n- ");
            predictionAccuracy = await callClaudeJSON<{
              total_predicted: number;
              total_actual: number;
              matched: number;
              accuracy_pct: number;
              predictions: { predicted_question: string; actual_match: string | null; was_asked: boolean; accuracy_notes: string }[];
            }>(
              PREDICTION_ACCURACY_PROMPT,
              `PREDICTED QUESTIONS:\n- ${predictedList}\n\nACTUAL EARNINGS CALL TRANSCRIPT:\n${transcriptText}`
            );
          } catch (err) {
            console.error("Prediction accuracy failed:", err);
          }
        }

        // Phase 2: Sentiment Analysis
        send("phase", { phase: "Analyzing call sentiment..." });
        let sentimentData = null;
        try {
          sentimentData = await callClaudeJSON<{
            sentiment_timeline: { speaker: string; question_summary: string; sentiment: string; score: number; key_concern?: string }[];
            overall_assessment: string;
          }>(CALL_SENTIMENT_PROMPT, `EARNINGS CALL TRANSCRIPT:\n${transcriptText}`);
        } catch (err) {
          console.error("Sentiment analysis failed:", err);
        }

        // Phase 3: Action Items
        send("phase", { phase: "Extracting action items..." });
        let actionItems = null;
        try {
          actionItems = await callClaudeJSON<{
            action_items: { commitment: string; speaker: string; context: string; deadline?: string; priority: string; completed: boolean }[];
          }>(ACTION_ITEMS_PROMPT, `EARNINGS CALL TRANSCRIPT:\n${transcriptText}`);
        } catch (err) {
          console.error("Action items extraction failed:", err);
        }

        // Assemble debrief
        const debrief = {
          id: crypto.randomUUID(),
          transcript_id,
          prediction_accuracy: predictionAccuracy || {
            total_predicted: 0, total_actual: 0, matched: 0, accuracy_pct: 0, predictions: [],
          },
          sentiment_timeline: sentimentData?.sentiment_timeline || [],
          action_items: actionItems?.action_items || [],
          overall_assessment: sentimentData?.overall_assessment || "No assessment available",
          created_at: new Date().toISOString(),
        };

        // Save debrief
        try {
          await supabase.from("postcall_debriefs").insert({
            transcript_id,
            prediction_accuracy: debrief.prediction_accuracy,
            sentiment_timeline: debrief.sentiment_timeline,
            action_items: debrief.action_items,
            overall_assessment: debrief.overall_assessment,
          });
        } catch (err) {
          console.error("Failed to save debrief:", err);
        }

        send("debrief", { data: debrief });
        send("done", { message: "Post-call debrief complete" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Debrief generation failed";
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
