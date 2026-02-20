import pdf from "pdf-parse";
import mammoth from "mammoth";

export interface ParsedDocument {
  name: string;
  content: string;
  wordCount: number;
  pageCount?: number;
  type: string;
  size: number;
}

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  fileSize: number
): Promise<ParsedDocument> {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  let content = "";
  let pageCount: number | undefined;

  try {
    if (ext === "pdf") {
      const result = await pdf(buffer);
      content = result.text;
      pageCount = result.numpages;
    } else if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else if (["txt", "md", "csv", "json", "xml", "html"].includes(ext)) {
      content = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown parse error";
    throw new Error(`Failed to parse ${fileName}: ${message}`);
  }

  // Clean up content
  content = content
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    name: fileName,
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    pageCount,
    type: ext,
    size: fileSize,
  };
}
