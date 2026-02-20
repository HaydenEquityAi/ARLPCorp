import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sec_filings")
    .select("id, cik, accession_number, filing_type, filing_date, primary_document, company_name, created_at")
    .order("filing_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filings: data || [] });
}
