import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("analyst_ratings")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ratings: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { analyst_name, firm, rating, price_target, date } = body;

  if (!analyst_name || !firm || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("analyst_ratings")
    .insert({
      analyst_name,
      firm,
      rating,
      price_target: price_target || 0,
      date: date || new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rating: data });
}
