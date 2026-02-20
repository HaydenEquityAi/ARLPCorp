import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { chunkTranscript } from "@/lib/transcript-parser";
import { generateEmbeddings } from "@/lib/embeddings";

export const maxDuration = 120;

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("earnings_transcripts")
    .select("id, company, fiscal_year, fiscal_quarter, word_count, source, created_at")
    .order("fiscal_year", { ascending: false })
    .order("fiscal_quarter", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transcripts: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { company, fiscal_year, fiscal_quarter, raw_text, source } = body;

  if (!raw_text || !company) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServerClient();
  const wordCount = raw_text.split(/\s+/).length;

  // Insert transcript
  const { data: transcript, error: insertError } = await supabase
    .from("earnings_transcripts")
    .insert({
      company,
      fiscal_year: fiscal_year || new Date().getFullYear(),
      fiscal_quarter: fiscal_quarter || 1,
      raw_text,
      word_count: wordCount,
      source: source || "manual upload",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Chunk and embed in the background
  try {
    const chunks = chunkTranscript(raw_text, 1500, 200);
    if (chunks.length > 0) {
      const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

      const rows = chunks.map((chunk, i) => ({
        transcript_id: transcript.id,
        content: chunk.content,
        section_type: chunk.section_type,
        speaker: chunk.speaker || null,
        chunk_index: chunk.chunk_index,
        embedding: JSON.stringify(embeddings[i]),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        await supabase.from("transcript_chunks").insert(batch);
      }
    }
  } catch (err) {
    console.error("Transcript chunking/embedding failed:", err);
  }

  return NextResponse.json({ transcript });
}
