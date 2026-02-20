import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchFilingIndex, fetchFilingDocument, extractRiskFactors } from "@/lib/edgar";
import { callClaudeJSON } from "@/lib/anthropic";
import { RISK_FACTOR_EXTRACTION_PROMPT } from "@/lib/prompts";

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
        const filingTypes = body.filing_types || ["10-K", "10-Q"];

        send("phase", { phase: "Connecting to SEC EDGAR..." });

        // Fetch filing index
        const filings = await fetchFilingIndex(undefined, filingTypes, 10);
        send("phase", { phase: `Found ${filings.length} filings. Downloading...` });

        const supabase = createServerClient();

        for (let i = 0; i < filings.length; i++) {
          const filing = filings[i];

          // Check if already cached
          const { data: existing } = await supabase
            .from("sec_filings")
            .select("id")
            .eq("accession_number", filing.accessionNumber)
            .single();

          if (existing) {
            send("phase", { phase: `Filing ${i + 1}/${filings.length} already cached, skipping...` });
            continue;
          }

          send("phase", { phase: `Downloading ${filing.form} (${filing.filingDate})...` });

          try {
            // Fetch full document text
            const fullText = await fetchFilingDocument(undefined, filing.accessionNumber, filing.primaryDocument);
            const riskFactorsText = extractRiskFactors(fullText);

            // Save to database
            const { data: savedFiling } = await supabase
              .from("sec_filings")
              .insert({
                cik: "0001156039",
                accession_number: filing.accessionNumber,
                filing_type: filing.form,
                filing_date: filing.filingDate,
                primary_document: filing.primaryDocument,
                company_name: "Alliance Resource Partners, L.P.",
                full_text: fullText.slice(0, 500000), // Cap at 500K chars
                risk_factors_text: riskFactorsText,
              })
              .select("id")
              .single();

            // Extract and save risk factors if we found them
            if (riskFactorsText && savedFiling) {
              send("phase", { phase: `Analyzing risk factors for ${filing.form} (${filing.filingDate})...` });

              try {
                const riskData = await callClaudeJSON<{
                  risk_factors: { title: string; content: string; severity_score: number; category: string }[];
                }>(RISK_FACTOR_EXTRACTION_PROMPT, riskFactorsText.slice(0, 50000));

                if (riskData.risk_factors) {
                  await supabase.from("risk_factor_tracking").insert(
                    riskData.risk_factors.map((rf) => ({
                      filing_id: savedFiling.id,
                      title: rf.title,
                      content: rf.content.slice(0, 5000),
                      severity_score: rf.severity_score,
                      category: rf.category,
                      status: "new",
                    }))
                  );
                }
              } catch (err) {
                console.error("Risk factor extraction failed:", err);
              }
            }

            // Rate limit: SEC requires no more than 10 requests per second
            await new Promise((r) => setTimeout(r, 200));
          } catch (err) {
            console.error(`Failed to process filing ${filing.accessionNumber}:`, err);
            send("phase", { phase: `Warning: Failed to process ${filing.form} (${filing.filingDate})` });
          }
        }

        send("done", { message: `Processed ${filings.length} filings` });
      } catch (err) {
        const message = err instanceof Error ? err.message : "EDGAR fetch failed";
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
