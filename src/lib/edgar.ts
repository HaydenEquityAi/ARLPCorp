const ARLP_CIK = "0001156039";
const BASE_URL = "https://efts.sec.gov/LATEST/search-index";
const FILING_URL = "https://www.sec.gov/cgi-bin/browse-edgar";
const SUBMISSIONS_URL = "https://data.sec.gov/submissions";

function getUserAgent(): string {
  return process.env.SEC_EDGAR_USER_AGENT || "ARLP-Executive-Briefing admin@company.com";
}

interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
}

interface FilingIndex {
  recent: {
    accessionNumber: string[];
    filingDate: string[];
    reportDate: string[];
    form: string[];
    primaryDocument: string[];
    primaryDocDescription: string[];
  };
}

/**
 * Fetch filing index for ARLP from SEC EDGAR.
 */
export async function fetchFilingIndex(
  cik: string = ARLP_CIK,
  filingTypes: string[] = ["10-K", "10-Q"],
  count: number = 20
): Promise<EdgarFiling[]> {
  const paddedCik = cik.padStart(10, "0");
  const url = `${SUBMISSIONS_URL}/CIK${paddedCik}.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": getUserAgent(), Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`EDGAR API error: ${res.status} ${res.statusText}`);
  }

  const data: { filings: FilingIndex } = await res.json();
  const recent = data.filings.recent;

  const filings: EdgarFiling[] = [];
  for (let i = 0; i < recent.accessionNumber.length && filings.length < count; i++) {
    if (filingTypes.includes(recent.form[i])) {
      filings.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        reportDate: recent.reportDate[i],
        form: recent.form[i],
        primaryDocument: recent.primaryDocument[i],
        primaryDocDescription: recent.primaryDocDescription[i],
      });
    }
  }

  return filings;
}

/**
 * Fetch the full text of a specific filing document.
 */
export async function fetchFilingDocument(
  cik: string = ARLP_CIK,
  accessionNumber: string,
  primaryDoc: string
): Promise<string> {
  const paddedCik = cik.padStart(10, "0");
  const accessionFormatted = accessionNumber.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${accessionFormatted}/${primaryDoc}`;

  const res = await fetch(url, {
    headers: { "User-Agent": getUserAgent() },
  });

  if (!res.ok) {
    throw new Error(`Filing fetch error: ${res.status}`);
  }

  const html = await res.text();

  // Strip HTML tags for plain text extraction
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract the Risk Factors section (Item 1A) from a 10-K/10-Q filing.
 */
export function extractRiskFactors(fullText: string): string {
  // Common patterns for Item 1A in SEC filings
  const startPatterns = [
    /Item\s+1A\.?\s*[-–—]?\s*Risk\s+Factors/i,
    /ITEM\s+1A\.?\s*RISK\s+FACTORS/i,
  ];

  const endPatterns = [
    /Item\s+1B\.?\s*[-–—]?\s*Unresolved\s+Staff\s+Comments/i,
    /Item\s+2\.?\s*[-–—]?\s*Properties/i,
    /ITEM\s+1B/i,
    /ITEM\s+2/i,
  ];

  let startIndex = -1;
  for (const pattern of startPatterns) {
    const match = fullText.match(pattern);
    if (match && match.index !== undefined) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === -1) return "";

  let endIndex = fullText.length;
  for (const pattern of endPatterns) {
    const match = fullText.slice(startIndex + 100).match(pattern);
    if (match && match.index !== undefined) {
      endIndex = startIndex + 100 + match.index;
      break;
    }
  }

  return fullText.slice(startIndex, endIndex).trim();
}
