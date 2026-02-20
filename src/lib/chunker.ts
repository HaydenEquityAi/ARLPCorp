export interface DocumentChunk {
  documentName: string;
  chunkIndex: number;
  content: string;
}

/**
 * Split document text into overlapping chunks for embedding.
 * Splits on paragraph boundaries, then merges small paragraphs into chunks
 * of approximately `chunkSize` characters with `overlap` character overlap.
 */
export function chunkDocument(
  documentName: string,
  text: string,
  chunkSize = 1500,
  overlap = 200
): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];

  // Split into paragraphs
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    // If adding this paragraph exceeds chunk size, save current and start new
    if (currentChunk.length + para.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        documentName,
        chunkIndex,
        content: currentChunk.trim(),
      });
      chunkIndex++;

      // Keep overlap from end of previous chunk
      if (overlap > 0 && currentChunk.length > overlap) {
        currentChunk = currentChunk.slice(-overlap) + "\n\n" + para;
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      documentName,
      chunkIndex,
      content: currentChunk.trim(),
    });
  }

  return chunks;
}

/**
 * Chunk multiple documents at once.
 */
export function chunkDocuments(
  documents: { name: string; content: string }[],
  chunkSize = 1500,
  overlap = 200
): DocumentChunk[] {
  return documents.flatMap((doc) =>
    chunkDocument(doc.name, doc.content, chunkSize, overlap)
  );
}
