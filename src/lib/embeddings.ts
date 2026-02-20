import { pipeline } from "@xenova/transformers";

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;

/**
 * Get or create the embedding pipeline (cached singleton).
 */
async function getPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline("feature-extraction", EMBEDDING_MODEL, {
      // Use /tmp on Vercel for model cache
      cache_dir: process.env.VERCEL ? "/tmp/transformers-cache" : undefined,
    });
  }
  return embeddingPipeline;
}

/**
 * Generate embedding for a single text using local transformer model.
 * Returns a 384-dim vector (all-MiniLM-L6-v2).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const truncated = text.slice(0, 8000);
  const output = await pipe(truncated, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts.
 * Processes sequentially to avoid memory issues on serverless.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const results: number[][] = [];

  for (const text of texts) {
    const truncated = text.slice(0, 8000);
    const output = await pipe(truncated, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }

  return results;
}
