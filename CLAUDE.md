# ARLP Executive Intelligence Briefing System — "The War Room"

## THE MISSION
Build an AI-powered executive intelligence platform for Alliance Resource Partners (ARLP), a publicly traded coal and energy company. The CEO and executive leadership team need to upload 7-10 documents each month (earnings reports, operational updates, financial summaries, market analyses) and instantly receive a ranked, scored, executive-ready briefing of the 5-10 most material items across ALL documents.

This is not a summarizer. This is an AI Chief of Staff that thinks like a $500/hr investor relations consultant.

## WHO USES THIS
- CEO of Alliance Resource Partners
- CFO and executive leadership team
- Investor Relations team
- Board preparation staff
- The guy showing this to them: Hayden Ashley (Director of Innovation / AI)

## WHAT IT MUST DO

### Core Features (MVP — Must Ship)
1. **Document Upload** — Drag-and-drop multiple PDFs and Word docs (.docx). Parse them server-side. Show file names, sizes, word counts, page counts.
2. **Materiality Analysis** — Send ALL document text to Claude. Get back 5-10 ranked bullet points, each with:
   - Materiality score (1-10)
   - Category (Financial | Strategic | Risk | Operational)
   - Clear, specific, quantitative finding
   - Source document attribution
   - "So What" — why the CEO should care
   - Action needed flag (boolean)
3. **Analyst Question Predictor** — Based on the briefing, predict 5-7 questions analysts will likely ask on the earnings call. Each with:
   - The question as an analyst would phrase it
   - Difficulty rating (Easy / Moderate / Hard)
   - Suggested CEO talking point / response
   - Which bullet triggered the question
4. **Trend Comparison** — Compare current briefing to the previous month's briefing stored in the database. Show:
   - What improved
   - What deteriorated
   - What's new this period
   - What resolved from last period
   - Overall trajectory assessment
5. **Briefing History** — Save every briefing to Supabase. Browse past briefings. Auto-compare current to previous.
6. **Copy/Export** — One-click copy to clipboard formatted for email. PDF export option.

### Design Requirements — THIS MUST LOOK LIKE A $2M ENTERPRISE PRODUCT
- Dark theme. Midnight black (#08080B) background.
- Gold accent color (#C9A84C) — think Bloomberg Terminal meets private equity war room.
- Typography: Use "Instrument Serif" for display headings (Google Fonts), "DM Sans" for body text, "JetBrains Mono" for data/scores.
- Subtle noise texture overlay on the background.
- Animated score bars that fill on load.
- Staggered entrance animations for bullet points.
- Cards with subtle glass-morphism borders.
- The header should say "Executive Intelligence Briefing" with subtitle "Alliance Resource Partners · AI Materiality Analysis"
- A gold sparkle/diamond icon as the logo mark.
- Step indicators showing progress: Upload → Analyze → Briefing
- The results view should have tabs: "Materiality Briefing" | "Analyst Questions" | "Trend Comparison" | "History"
- Each bullet point card shows rank number, category badge with icon, score bar, finding text, source, and "so what"
- Action needed items get a red alert badge
- Analyst questions show difficulty as colored badges (green/amber/red)
- Mobile responsive but primarily designed for desktop/laptop use in a boardroom

### The Footer
"Alliance Resource Partners · Executive Intelligence System · Powered by Claude AI · Enterprise Data Security"

## TECH STACK

### Framework
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS

### AI
- Anthropic Claude API
- Model: claude-sonnet-4-20250514
- Use the Anthropic SDK (`@anthropic-ai/sdk`)
- Temperature: 0.2 for analysis (we want consistency, not creativity)
- All prompts return structured JSON

### Database & Storage
- Supabase (PostgreSQL)
- Supabase Storage for document files
- Supabase Auth for login (email/password — internal users only)
- Tables: briefings, bullets, documents, analyst_questions, trend_comparisons

### Document Parsing
- `pdf-parse` for PDF text extraction
- `mammoth` for DOCX text extraction
- Server-side only (API routes)

### Icons
- Lucide React

### Hosting
- Vercel

## ENVIRONMENT VARIABLES
```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## DATABASE SCHEMA

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Briefing sessions (one per analysis run)
create table briefings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  title text not null,
  executive_summary text,
  document_count int not null,
  total_words int,
  raw_response jsonb,
  analyst_questions_response jsonb,
  trend_response jsonb,
  user_id uuid references auth.users(id)
);

-- Individual materiality bullets (normalized for querying/trending)
create table bullets (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  rank int not null,
  materiality_score int not null check (materiality_score between 1 and 10),
  category text not null check (category in ('Financial', 'Strategic', 'Risk', 'Operational')),
  finding text not null,
  source_document text,
  so_what text,
  action_needed boolean default false,
  created_at timestamptz default now()
);

-- Uploaded document metadata
create table documents (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_size int,
  word_count int,
  page_count int,
  storage_path text,
  parsed_content text,
  uploaded_at timestamptz default now()
);

-- Predicted analyst questions
create table analyst_questions (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  rank int not null,
  question text not null,
  triggered_by text,
  suggested_response text,
  difficulty text check (difficulty in ('Easy', 'Moderate', 'Hard')),
  likely_asker_type text,
  created_at timestamptz default now()
);

-- Period-over-period trend comparisons
create table trend_comparisons (
  id uuid default gen_random_uuid() primary key,
  current_briefing_id uuid references briefings(id) on delete cascade,
  previous_briefing_id uuid references briefings(id),
  improved jsonb default '[]',
  deteriorated jsonb default '[]',
  new_items jsonb default '[]',
  resolved jsonb default '[]',
  overall_trajectory text,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_briefings_user on briefings(user_id);
create index idx_briefings_created on briefings(created_at desc);
create index idx_bullets_briefing on bullets(briefing_id);
create index idx_bullets_score on bullets(materiality_score desc);
create index idx_documents_briefing on documents(briefing_id);
```

## SUPABASE STORAGE
- Create bucket: `executive-docs` (private)
- File path pattern: `{briefing_id}/{filename}`

## CLAUDE SYSTEM PROMPTS

### Prompt 1: Materiality Analysis
```
You are a senior investor relations analyst and Chief of Staff for Alliance Resource Partners (ARLP), a publicly traded energy and minerals company. You have deep expertise in financial analysis, SEC reporting, coal/energy markets, and executive communications.

You will be given the full text of multiple internal documents related to monthly operations, earnings, and business performance.

YOUR TASK: Identify the 5-10 most MATERIAL bullet points across ALL documents combined and rank them.

MATERIALITY CRITERIA (in order of importance):
1. Financial Impact — revenue, EBITDA, capex, cash flow, production volume changes, cost per ton shifts
2. Strategic Significance — market positioning, regulatory changes, contract wins/losses, M&A, partnerships
3. Risk & Deviation — anything deviating from prior guidance, expectations, or historical trends
4. Stakeholder Impact — items investors, analysts, or the board will ask about

FOR EACH BULLET POINT PROVIDE:
- materiality_score: 1-10 (10 = most material)
- category: Financial | Strategic | Risk | Operational
- finding: Clear, specific, quantitative executive-ready statement (1-2 sentences)
- source_document: Which document this came from
- so_what: One sentence on why the CEO should care
- action_needed: true/false

Return valid JSON:
{
  "briefing_title": "Executive Materiality Briefing — [Month Year]",
  "generated_at": "ISO timestamp",
  "document_count": number,
  "executive_summary": "2-3 sentence overview of the most critical themes across all documents",
  "bullets": [
    {
      "rank": 1,
      "materiality_score": 9,
      "category": "Financial",
      "finding": "Specific finding here",
      "source_document": "document name",
      "so_what": "Why the CEO cares",
      "action_needed": true
    }
  ]
}

RULES:
- Focus on what CHANGED, what's UNEXPECTED, and what requires ACTION
- Be specific with numbers — never say "significant" when you can say "12.3%"
- Executives don't need summaries of things going as planned
- Return ONLY valid JSON
```

### Prompt 2: Analyst Question Predictor
```
You are a senior sell-side equity research analyst covering Alliance Resource Partners (ARLP) and the coal/energy sector with 15 years of earnings call experience.

Given the executive materiality briefing, predict 5-7 questions analysts will MOST LIKELY ask on the upcoming earnings call.

Return valid JSON:
{
  "predicted_questions": [
    {
      "rank": 1,
      "question": "The analyst's likely question",
      "triggered_by": "Which bullet or topic triggers this",
      "suggested_response": "2-3 sentence CEO talking point",
      "difficulty": "Easy | Moderate | Hard",
      "likely_asker_type": "Buy-side | Sell-side | Institutional"
    }
  ],
  "call_risk_assessment": "One sentence overall assessment of how challenging this call will be"
}
```

### Prompt 3: Trend Comparison
```
You are a senior investor relations analyst for ARLP. Compare two briefing periods and identify what improved, deteriorated, is new, and what resolved.

Return valid JSON:
{
  "trend_analysis": {
    "improved": [{"item": "desc", "previous": "before", "current": "now", "change_pct": "X%"}],
    "deteriorated": [{"item": "desc", "previous": "before", "current": "now", "change_pct": "X%"}],
    "new_items": [{"item": "desc", "significance": "why it matters"}],
    "resolved": [{"item": "desc", "resolution": "how resolved"}]
  },
  "overall_trajectory": "One sentence trajectory assessment"
}
```

## FILE STRUCTURE
```
src/
  app/
    layout.tsx          — Root layout with fonts, metadata
    page.tsx            — Main app (upload → analyze → results)
    globals.css         — Tailwind + custom styles + fonts
    api/
      upload/route.ts   — File upload + parsing endpoint
      analyze/route.ts  — Claude analysis endpoint (briefing/questions/trends)
      briefings/route.ts — CRUD for saved briefings
  lib/
    anthropic.ts        — Claude client wrapper
    supabase.ts         — Supabase client (server + browser)
    prompts.ts          — All system prompts
    parser.ts           — PDF + DOCX parsing
    types.ts            — All TypeScript interfaces
  components/
    Header.tsx
    UploadZone.tsx
    BulletCard.tsx
    AnalystQuestionCard.tsx
    TrendGrid.tsx
    BriefingHistory.tsx
    ScoreBar.tsx
    LoadingState.tsx
    ExportButton.tsx
```

## API ROUTE DETAILS

### POST /api/upload
- Accept multipart form data
- Parse PDFs with pdf-parse, DOCX with mammoth
- Store original files in Supabase Storage
- Return parsed document metadata + content

### POST /api/analyze
- Accept: { documents: [{name, content}], mode: "briefing" | "questions" | "trends" | "full", briefing_id?: string, previous_briefing_id?: string }
- Call Claude with appropriate prompt based on mode
- Save results to Supabase (briefings, bullets, analyst_questions tables)
- For "trends" mode, fetch previous briefing from DB automatically if previous_briefing_id provided
- Return structured JSON results

### GET /api/briefings
- Return all past briefings for the user, ordered by date desc
- Include bullet count and average materiality score

### GET /api/briefings/[id]
- Return full briefing with bullets, questions, and trends

## CRITICAL IMPLEMENTATION NOTES

1. **Claude API call pattern**: Use the Anthropic SDK. Set max_tokens to 4096. Temperature 0.2. Always request JSON output.

2. **Document size handling**: If total document text exceeds Claude's context window, chunk and summarize in passes. But for 7-10 typical business docs this shouldn't be an issue with claude-sonnet-4-20250514's 200K context.

3. **Error handling**: Wrap every Claude call in try/catch. If JSON parse fails, retry once. Show user-friendly errors.

4. **The analysis should run sequentially**: First materiality briefing, then analyst questions (using briefing output), then trend comparison (if previous briefing exists). Show progress to the user at each step.

5. **Auto-trend**: When a new briefing is generated and there's a previous briefing in the DB, automatically run trend comparison. Don't make the user do it manually.

6. **History view**: Show a list of past briefings as cards with date, document count, top materiality score, and executive summary preview. Click to view full briefing.

7. **Mobile responsive** but this is primarily a desktop app for boardroom use.

8. **Security**: All document parsing and Claude calls happen server-side. No API keys exposed to the client. Supabase RLS should ensure users only see their own briefings.

## WHAT SUCCESS LOOKS LIKE
The CEO opens this app on his laptop before a monthly call. His assistant has already uploaded the 10 documents. He sees a beautiful dark interface with gold accents. The top 7 material items are ranked with scores. He clicks "Analyst Questions" and sees exactly what he'll be asked with prepared talking points. He clicks "Trends" and sees what changed since last month. He clicks "Copy" and pastes the briefing into an email to the board.

He turns to Hayden and says: "How did you build this?"

## BUILD ORDER
1. Set up Next.js project with Tailwind, TypeScript
2. Create Supabase tables and storage bucket
3. Build the document upload API + UI
4. Build the Claude analysis API
5. Build the results UI (briefing tab with bullet cards)
6. Build analyst questions tab
7. Build trend comparison tab
8. Build briefing history
9. Add copy/export functionality
10. Polish animations, loading states, error states
11. Deploy to Vercel
