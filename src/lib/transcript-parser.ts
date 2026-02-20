export interface TranscriptSection {
  type: "prepared_remarks" | "qa" | "operator" | "other";
  speaker?: string;
  content: string;
  start_index: number;
}

export interface TranscriptChunkInput {
  content: string;
  section_type: string;
  speaker?: string;
  chunk_index: number;
}

const SPEAKER_PATTERN = /^(?:([A-Z][A-Za-z\s.'-]+?)(?:\s*[-–—]\s*|\s*,\s*)(?:(?:CEO|CFO|COO|President|Chairman|Director|VP|SVP|EVP|Analyst|Managing Director|Senior Vice President|Executive Vice President)[^:]*?)?\s*:)/m;
const QA_MARKERS = [
  /\bquestion[- ]and[- ]answer/i,
  /\bQ\s*&\s*A\s*(?:session|portion|segment)?/i,
  /\boperator\s*:\s*(?:.*?)\s*(?:question|Q&A)/i,
  /\bwe (?:will|can) now (?:open|begin|take)\b.*\bquestion/i,
];
const OPERATOR_PATTERNS = [
  /^operator\s*:/im,
  /^moderator\s*:/im,
];

/**
 * Detect sections in an earnings call transcript.
 * Splits into prepared remarks, Q&A, and operator sections.
 */
export function detectSections(text: string): TranscriptSection[] {
  const sections: TranscriptSection[] = [];
  let qaStartIndex = -1;

  // Find where Q&A begins
  for (const marker of QA_MARKERS) {
    const match = text.match(marker);
    if (match && match.index !== undefined) {
      qaStartIndex = match.index;
      break;
    }
  }

  if (qaStartIndex === -1) {
    // No Q&A section found — treat entire transcript as prepared remarks
    sections.push({
      type: "prepared_remarks",
      content: text,
      start_index: 0,
    });
    return sections;
  }

  // Prepared remarks section
  if (qaStartIndex > 0) {
    sections.push({
      type: "prepared_remarks",
      content: text.slice(0, qaStartIndex).trim(),
      start_index: 0,
    });
  }

  // Q&A section
  sections.push({
    type: "qa",
    content: text.slice(qaStartIndex).trim(),
    start_index: qaStartIndex,
  });

  return sections;
}

/**
 * Extract speakers from transcript text.
 */
export function extractSpeakers(text: string): string[] {
  const speakers = new Set<string>();
  const lines = text.split("\n");

  for (const line of lines) {
    const match = line.match(SPEAKER_PATTERN);
    if (match && match[1]) {
      const speaker = match[1].trim();
      if (speaker.length > 1 && speaker.length < 60) {
        speakers.add(speaker);
      }
    }
  }

  return Array.from(speakers);
}

/**
 * Extract questions from the Q&A section.
 */
export function extractQuestions(text: string): { speaker: string; question: string }[] {
  const questions: { speaker: string; question: string }[] = [];
  const sections = detectSections(text);
  const qaSection = sections.find((s) => s.type === "qa");
  if (!qaSection) return questions;

  const qaText = qaSection.content;
  const lines = qaText.split("\n");
  let currentSpeaker = "";
  let currentBlock = "";
  let isAnalyst = false;

  for (const line of lines) {
    const speakerMatch = line.match(SPEAKER_PATTERN);
    if (speakerMatch) {
      if (isAnalyst && currentBlock.trim() && currentBlock.includes("?")) {
        questions.push({ speaker: currentSpeaker, question: currentBlock.trim() });
      }
      currentSpeaker = speakerMatch[1].trim();
      currentBlock = line.slice(speakerMatch[0].length).trim();
      // Check if this person is likely an analyst (not management)
      const lowerLine = line.toLowerCase();
      isAnalyst = lowerLine.includes("analyst") ||
        lowerLine.includes("managing director") ||
        (!lowerLine.includes("ceo") && !lowerLine.includes("cfo") && !lowerLine.includes("president") &&
         !lowerLine.includes("chairman") && !lowerLine.includes("operator"));
    } else {
      currentBlock += " " + line.trim();
    }
  }

  // Don't forget the last block
  if (isAnalyst && currentBlock.trim() && currentBlock.includes("?")) {
    questions.push({ speaker: currentSpeaker, question: currentBlock.trim() });
  }

  return questions;
}

/**
 * Chunk transcript with speaker and section awareness.
 * Unlike generic document chunking, this preserves speaker boundaries.
 */
export function chunkTranscript(
  text: string,
  chunkSize = 1500,
  overlap = 200
): TranscriptChunkInput[] {
  const sections = detectSections(text);
  const chunks: TranscriptChunkInput[] = [];
  let globalIndex = 0;

  for (const section of sections) {
    const lines = section.content.split("\n");
    let currentChunk = "";
    let currentSpeaker: string | undefined;

    for (const line of lines) {
      const speakerMatch = line.match(SPEAKER_PATTERN);
      if (speakerMatch) {
        // If we have accumulated content and adding more would exceed chunk size, flush
        if (currentChunk.length > 0 && currentChunk.length + line.length > chunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            section_type: section.type,
            speaker: currentSpeaker,
            chunk_index: globalIndex++,
          });
          // Keep overlap
          if (overlap > 0 && currentChunk.length > overlap) {
            currentChunk = currentChunk.slice(-overlap) + "\n" + line;
          } else {
            currentChunk = line;
          }
        } else {
          currentChunk += (currentChunk ? "\n" : "") + line;
        }
        currentSpeaker = speakerMatch[1].trim();
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
        if (currentChunk.length > chunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            section_type: section.type,
            speaker: currentSpeaker,
            chunk_index: globalIndex++,
          });
          if (overlap > 0 && currentChunk.length > overlap) {
            currentChunk = currentChunk.slice(-overlap);
          } else {
            currentChunk = "";
          }
        }
      }
    }

    // Flush remaining
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        section_type: section.type,
        speaker: currentSpeaker,
        chunk_index: globalIndex++,
      });
    }
  }

  return chunks;
}
