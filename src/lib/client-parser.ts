import type { ParsedDocument } from "./types";

async function parsePDF(buffer: ArrayBuffer, fileName: string, fileSize: number): Promise<ParsedDocument> {
  // Dynamic import to avoid SSR issues — pdfjs-dist requires browser APIs
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  const content = pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    name: fileName,
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    pageCount: pdf.numPages,
    type: "pdf",
    size: fileSize,
  };
}

async function parseDOCX(buffer: ArrayBuffer, fileName: string, fileSize: number): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const content = result.value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    name: fileName,
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    type: "docx",
    size: fileSize,
  };
}

function parseText(text: string, fileName: string, fileSize: number, ext: string): ParsedDocument {
  const content = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    name: fileName,
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    type: ext,
    size: fileSize,
  };
}

export async function parseFileClient(file: File): Promise<ParsedDocument> {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const buffer = await file.arrayBuffer();

  if (ext === "pdf") {
    return parsePDF(buffer, file.name, file.size);
  }

  if (ext === "docx" || ext === "doc") {
    return parseDOCX(buffer, file.name, file.size);
  }

  if (["txt", "md", "csv", "json", "xml", "html"].includes(ext)) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseText(text, file.name, file.size, ext);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}
