import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("postcall_debriefs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Also fetch press reactions
  const { data: pressReactions } = await supabase
    .from("press_reactions")
    .select("*")
    .eq("debrief_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    debrief: data,
    press_reactions: pressReactions || [],
  });
}
