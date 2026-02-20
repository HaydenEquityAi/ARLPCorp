import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const parsed = [];
    const errors = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const doc = await parseDocument(buffer, file.name, file.size);
        parsed.push(doc);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({ file: file.name, error: message });
      }
    }

    return NextResponse.json({
      documents: parsed,
      errors: errors.length > 0 ? errors : undefined,
      total_words: parsed.reduce((sum, d) => sum + d.wordCount, 0),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


