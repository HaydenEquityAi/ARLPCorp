// ─── Document types ───
export interface ParsedDocument {
  name: string;
  content: string;
  wordCount: number;
  pageCount?: number;
  type: string;
  size: number;
}

// ─── Briefing types ───
export interface BulletPoint {
  rank: number;
  materiality_score: number;
  category: "Financial" | "Strategic" | "Risk" | "Operational";
  finding: string;
  source_document: string;
  so_what: string;
  action_needed: boolean;
}

export interface BriefingData {
  briefing_title: string;
  generated_at: string;
  document_count: number;
  bullets: BulletPoint[];
  executive_summary: string;
}

// ─── Analyst question types ───
export interface PredictedQuestion {
  rank: number;
  question: string;
  triggered_by: string;
  suggested_response: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  likely_asker_type: string;
  likelihood_pct?: number;
  is_danger_zone?: boolean;
}

export interface QuestionsData {
  predicted_questions: PredictedQuestion[];
  call_risk_assessment: string;
}

// ─── Trend types ───
export interface TrendItem {
  item: string;
  previous?: string;
  current?: string;
  change_pct?: string;
  significance?: string;
  resolution?: string;
}

export interface TrendsData {
  trend_analysis: {
    improved: TrendItem[];
    deteriorated: TrendItem[];
    new_items: TrendItem[];
    resolved: TrendItem[];
  };
  overall_trajectory: string;
}

// ─── Database record types ───
export interface BriefingRecord {
  id: string;
  created_at: string;
  title: string;
  executive_summary: string | null;
  document_count: number;
  total_words: number | null;
  raw_response: BriefingData | null;
  analyst_questions_response: QuestionsData | null;
  trend_response: TrendsData | null;
  user_id: string | null;
}

export interface BriefingListItem {
  id: string;
  created_at: string;
  title: string;
  executive_summary: string | null;
  document_count: number;
  bullet_count: number;
  avg_score: number;
}

// ─── Tab navigation ───
export type ActiveTab =
  | "flash"       // Flash Reports (renamed from "briefing")
  | "earnings"    // Earnings Call War Room
  | "sec"         // SEC Filing Intelligence
  | "precall"     // CEO Pre-Call War Room
  | "investors"   // Investor Intelligence
  | "market"      // Market Pulse
  | "postcall";   // Post-Call Debrief

// ─── Earnings Call War Room types ───
export interface EarningsTranscript {
  id: string;
  company: string;
  fiscal_year: number;
  fiscal_quarter: number;
  raw_text: string;
  word_count: number;
  source: string;
  created_at: string;
  sections?: TranscriptSection[];
}

export interface TranscriptSection {
  type: "prepared_remarks" | "qa" | "operator" | "other";
  speaker?: string;
  content: string;
  start_index: number;
}

export interface TranscriptChunk {
  id: string;
  transcript_id: string;
  content: string;
  section_type: string;
  speaker?: string;
  chunk_index: number;
  embedding?: number[];
}

export interface TranscriptSearchResult {
  content: string;
  section_type: string;
  speaker?: string;
  similarity: number;
  transcript_id: string;
}

export interface TranscriptComparison {
  id: string;
  transcript_a_id: string;
  transcript_b_id: string;
  messaging_changes: string;
  financial_shifts: string;
  guidance_changes: string;
  tone_analysis: string;
  created_at: string;
}

// ─── SEC Filing Intelligence types ───
export interface SecFiling {
  id: string;
  cik: string;
  accession_number: string;
  filing_type: string;
  filing_date: string;
  primary_document: string;
  company_name: string;
  full_text?: string;
  risk_factors_text?: string;
  created_at: string;
}

export interface RiskFactor {
  id: string;
  filing_id: string;
  title: string;
  content: string;
  severity_score: number;
  status: "new" | "modified" | "unchanged" | "removed";
  category: string;
  previous_filing_id?: string;
}

export interface FilingComparison {
  filing_a: SecFiling;
  filing_b: SecFiling;
  risk_factor_changes: {
    new_risks: RiskFactor[];
    modified_risks: RiskFactor[];
    removed_risks: RiskFactor[];
    unchanged_risks: RiskFactor[];
  };
  key_changes: string;
}

// ─── Pre-Call War Room types ───
export interface PreCallSession {
  id: string;
  briefing_id: string;
  opening_remarks: string;
  danger_zones: DangerZone[];
  competitor_analysis?: CompetitorAnalysis[];
  created_at: string;
}

export interface DangerZone {
  topic: string;
  why_dangerous: string;
  worst_question: string;
  recommended_deflection: string;
  severity: "high" | "medium" | "low";
}

export interface CompetitorAnalysis {
  company_name: string;
  key_themes: string[];
  messaging_comparison: string;
  competitive_implications: string;
}

// ─── Investor Intelligence types ───
export interface InstitutionalHolder {
  id: string;
  institution_name: string;
  shares_held: number;
  market_value: number;
  pct_of_portfolio: number;
  change_shares: number;
  change_pct: number;
  report_date: string;
  source: string;
  created_at: string;
}

export interface AnalystRating {
  id: string;
  analyst_name: string;
  firm: string;
  rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  price_target: number;
  previous_rating?: string;
  previous_price_target?: number;
  date: string;
  created_at: string;
}

export interface ShortInterestData {
  id: string;
  settlement_date: string;
  short_interest: number;
  avg_daily_volume: number;
  days_to_cover: number;
  pct_float: number;
  change_pct: number;
  created_at: string;
}

export interface SentimentScore {
  id: string;
  date: string;
  score: number; // -1.0 to 1.0
  components: {
    holdings_signal: number;
    ratings_signal: number;
    short_interest_signal: number;
  };
  rationale: string;
  created_at: string;
}

// ─── Market Pulse types ───
export interface EnergyPrice {
  id: string;
  series_id: string;
  series_name: string;
  date: string;
  value: number;
  unit: string;
  created_at: string;
}

export interface RegulatoryItem {
  id: string;
  title: string;
  source: string;
  date: string;
  content: string;
  impact_score: number;
  impact_analysis: string;
  category: "regulatory" | "esg" | "policy" | "legal";
  created_at: string;
}

export interface MorningBriefing {
  id: string;
  date: string;
  content: string;
  key_metrics: {
    coal_price?: number;
    gas_price?: number;
    coal_change_pct?: number;
    gas_change_pct?: number;
  };
  created_at: string;
}

// ─── Post-Call Debrief types ───
export interface PostCallDebrief {
  id: string;
  precall_session_id?: string;
  transcript_id: string;
  prediction_accuracy: PredictionAccuracy;
  sentiment_timeline: SentimentExchange[];
  action_items: ActionItem[];
  overall_assessment: string;
  created_at: string;
}

export interface PredictionAccuracy {
  total_predicted: number;
  total_actual: number;
  matched: number;
  accuracy_pct: number;
  predictions: {
    predicted_question: string;
    actual_match?: string;
    was_asked: boolean;
    accuracy_notes: string;
  }[];
}

export interface SentimentExchange {
  speaker: string;
  question_summary: string;
  sentiment: "positive" | "neutral" | "negative" | "hostile";
  score: number; // -1.0 to 1.0
  key_concern?: string;
}

export interface ActionItem {
  id: string;
  commitment: string;
  speaker: string;
  context: string;
  deadline?: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface PressReaction {
  id: string;
  debrief_id: string;
  title: string;
  source: string;
  date: string;
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score: number;
  key_takeaways: string[];
  full_text: string;
  created_at: string;
}
