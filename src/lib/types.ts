// Document types
export interface ParsedDocument {
  name: string;
  content: string;
  wordCount: number;
  pageCount?: number;
  type: string;
  size: number;
}

// Briefing types
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

// Analyst question types
export interface PredictedQuestion {
  rank: number;
  question: string;
  triggered_by: string;
  suggested_response: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  likely_asker_type: string;
}

export interface QuestionsData {
  predicted_questions: PredictedQuestion[];
  call_risk_assessment: string;
}

// Trend types
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

// Database record types
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

export type ActiveTab = "briefing" | "questions" | "trends" | "history";
