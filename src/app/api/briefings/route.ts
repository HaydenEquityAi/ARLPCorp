import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: briefings, error } = await supabase
      .from("briefings")
      .select(`
        id,
        created_at,
        title,
        executive_summary,
        document_count,
        bullets(materiality_score)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (briefings || []).map((b) => {
      const bulletScores = (b.bullets as { materiality_score: number }[]) || [];
      return {
        id: b.id,
        created_at: b.created_at,
        title: b.title,
        executive_summary: b.executive_summary,
        document_count: b.document_count,
        bullet_count: bulletScores.length,
        avg_score:
          bulletScores.length > 0
            ? bulletScores.reduce((s, x) => s + x.materiality_score, 0) / bulletScores.length
            : 0,
      };
    });

    return NextResponse.json({ briefings: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch briefings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
