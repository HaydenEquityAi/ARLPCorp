# ARLP Executive Intelligence Briefing System — "The War Room"

## THE MISSION
A comprehensive AI-powered executive intelligence platform for Alliance Resource Partners (ARLP), a publicly traded coal and energy company. This covers the entire earnings cycle — from pre-call preparation through post-call debrief — plus ongoing market and investor monitoring. The CEO and executive leadership team use 7 intelligence tabs to manage every aspect of earnings readiness.

This is not a summarizer. This is an AI Chief of Staff that thinks like a $500/hr investor relations consultant.

## WHO USES THIS
- CEO of Alliance Resource Partners
- CFO and executive leadership team
- Investor Relations team
- Board preparation staff
- The guy showing this to them: Hayden Ashley (Director of Innovation / AI)

## ARCHITECTURE OVERVIEW

### 7-Tab Navigation
The app has 7 main tabs and a slide-out History panel:

| Tab | ID | Icon | Purpose |
|-----|----|------|---------|
| Flash Reports | `flash` | Zap | Materiality-ranked briefing from uploaded docs |
| Earnings War Room | `earnings` | Mic | Transcript upload, vector search, Q&A, quarter comparison |
| SEC Filings | `sec` | FileSearch | EDGAR integration, risk factor tracking, filing comparison |
| Pre-Call War Room | `precall` | Shield | Opening remarks, danger zones, competitor analysis |
| Investor Intel | `investors` | Users | Holdings, analyst ratings, short interest, sentiment |
| Market Pulse | `market` | Activity | EIA energy prices, regulatory feed, morning briefings |
| Post-Call Debrief | `postcall` | MessageCircle | Prediction accuracy, sentiment timeline, action items |

History is a slide-out `SidePanel` accessible via a Clock icon in the header.

### Tab Container Architecture
`page.tsx` manages shared state (`activeTab`, `briefing`, `briefingId`, `questions`, `trends`) and renders tab containers:
- Each tab is a self-contained component in `src/components/tabs/`
- Tabs manage their own data fetching and local state
- Parent passes down shared context (`briefing`, `briefingId`, `questions`) to tabs that need it

## WHAT EACH TAB DOES

### Tab 1: Flash Reports (formerly "Materiality Briefing")
- **Upload** — Drag-and-drop PDFs, DOCX, TXT, CSV, JSON, HTML, XML. Client-side parsing via `pdfjs-dist` + `mammoth`.
- **Materiality Analysis** — SSE streaming via `/api/analyze`. Claude ranks 5-10 bullet points with materiality scores, categories, findings, sources, and "so what" context.
- **Analyst Question Predictor** — 5-7 predicted questions with difficulty ratings and talking points.
- **Trend Comparison** — Auto-compares with previous briefing from database.
- **Copy/Export** — One-click clipboard copy formatted for email.

### Tab 2: Earnings Call War Room
- **Transcript Upload** — Upload earnings call transcripts (.txt/.pdf/.docx) with fiscal year/quarter selectors.
- **Speaker-Aware Chunking** — `transcript-parser.ts` detects sections (prepared remarks vs Q&A), extracts speakers, chunks with speaker boundaries preserved.
- **Vector Search** — Chunks embedded via `all-MiniLM-L6-v2` (384-dim) into `transcript_chunks` table. Search via `match_transcript_chunks` RPC.
- **Q&A Interface** — `ChatInterface` component sends queries to `/api/transcripts/search` for SSE-streamed answers with citation cards.
- **Quarter Comparison** — Select two transcripts, Claude compares messaging, financials, guidance, and tone.
- **Transcript Browser** — Full text viewer with transcript list sidebar.

### Tab 3: SEC Filing Intelligence
- **EDGAR Integration** — `edgar.ts` fetches filing index from `data.sec.gov/submissions/CIK0001156039.json`, downloads full text, strips HTML.
- **Risk Factor Extraction** — Extracts Item 1A section, sends to Claude for structured risk factor parsing with severity scores.
- **Risk Factor Tracker** — Color-coded status badges (new/modified/unchanged/removed) across filing periods.
- **Filing Comparison** — Select two filings for Claude-powered side-by-side risk factor diff.
- **ARLP CIK**: `0001156039`

### Tab 4: CEO Pre-Call War Room
- **Opening Remarks** — Claude drafts 3-4 min opening script from briefing data. Teleprompter-style view with copy button.
- **Predicted Questions** — Enhanced analyst questions with likelihood percentages and danger zone flags.
- **Danger Zones** — 3-5 topics that could derail the call with worst-case questions and recommended responses.
- **Competitor Comparison** — Upload competitor transcripts for Claude messaging comparison.
- **Requires**: A Flash Report briefing must be generated first (needs `briefingId`).

### Tab 5: Investor Intelligence
- **Holdings Table** — Top institutional holders, sortable, color-coded buy/sell changes. CSV import supported.
- **Analyst Ratings** — Manual input form + list view. Ratings: Strong Buy / Buy / Hold / Sell / Strong Sell with price targets.
- **Short Interest** — Settlement dates, shares short, days to cover, % float. CSV import supported.
- **Sentiment Score** — Claude calculates -1.0 to +1.0 from all available data (holdings 40%, ratings 35%, short interest 25%).
- **CSV Upload** — `CsvUploader` component with template download, preview table, column mapping.

### Tab 6: Market Pulse
- **Energy Prices** — `eia.ts` fetches coal (market-sales-price) and natural gas (Henry Hub futures) from EIA API v2.
- **Price Display** — Latest price, change %, recent history list per commodity group.
- **Regulatory Feed** — Upload regulatory articles, Claude scores impact (1-10) and categorizes (regulatory/esg/policy/legal).
- **Morning Briefing** — Claude-generated daily brief from latest prices, news, and briefing data. 200-400 words, scannable format.

### Tab 7: Post-Call Debrief
- **Transcript Selector** — Pick from uploaded transcripts in Earnings War Room.
- **Prediction Accuracy** — Compares pre-call predicted questions vs actual questions asked. Shows accuracy % and per-question match status.
- **Sentiment Timeline** — Per-exchange sentiment analysis (positive/neutral/negative/hostile) with score bars.
- **Action Items** — Extracted commitments from transcript as checklist with priority, speaker, deadline.
- **Press Reactions** — Upload press articles for Claude sentiment analysis with key takeaways.

## TECH STACK

### Framework
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS

### AI
- Anthropic Claude API via `@anthropic-ai/sdk`
- Model: `claude-sonnet-4-20250514`
- Temperature: 0.2 for analysis
- All analysis prompts return structured JSON
- 15 specialized prompts in `src/lib/prompts.ts`

### Embeddings & RAG
- Local embeddings via `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim)
- pgvector in Supabase for similarity search
- RPC functions: `match_document_chunks`, `match_transcript_chunks`
- Singleton pipeline cached in module scope, `/tmp/transformers-cache` on Vercel

### Database & Storage
- Supabase (PostgreSQL + pgvector)
- 19 tables total (see schema below)
- Supabase Storage bucket: `executive-docs` (private)
- Service role key for server-side operations (no auth session)

### Document Parsing
- **Server-side**: `pdf-parse` + `mammoth` (in `parser.ts`, used by `/api/upload`)
- **Client-side**: `pdfjs-dist` + `mammoth` (in `client-parser.ts`, used by `page.tsx`)
- Client-side parsing is the primary flow — avoids Vercel 413 body size limits

### External APIs
- **SEC EDGAR** — Filing index + document download (`edgar.ts`). Requires `SEC_EDGAR_USER_AGENT` header.
- **EIA API v2** — Coal and natural gas prices (`eia.ts`). Requires `EIA_API_KEY` (free from eia.gov).

### Charts
- `recharts` — Time series and bar charts (Investor Intel, Market Pulse)

### Icons
- Lucide React

### Hosting
- Vercel (with function-level timeout/memory config in `vercel.json`)

## ENVIRONMENT VARIABLES
```
ANTHROPIC_API_KEY=                              # Required — Claude API
OPENAI_API_KEY=                                 # Optional — unused currently
NEXT_PUBLIC_SUPABASE_URL=                       # Required — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=                  # Required — Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=                      # Required — Supabase service role
EIA_API_KEY=                                    # Required for Market Pulse tab
SEC_EDGAR_USER_AGENT=ARLP-Executive-Briefing contact@company.com  # Required for SEC tab
```

## DATABASE SCHEMA

### Original Tables (Flash Reports)
```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;

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

create table bullets (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  rank int not null,
  materiality_score int not null check (materiality_score between 1 and 10),
  category text not null check (category in ('Financial','Strategic','Risk','Operational')),
  finding text not null,
  source_document text,
  so_what text,
  action_needed boolean default false,
  created_at timestamptz default now()
);

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

create table analyst_questions (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  rank int not null,
  question text not null,
  triggered_by text,
  suggested_response text,
  difficulty text check (difficulty in ('Easy','Moderate','Hard')),
  likely_asker_type text,
  created_at timestamptz default now()
);

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

create table document_chunks (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  document_name text,
  chunk_index int,
  content text,
  embedding vector(384),
  created_at timestamptz default now()
);
```

### Earnings War Room Tables
```sql
create table earnings_transcripts (
  id uuid default gen_random_uuid() primary key,
  company text not null default 'ARLP',
  fiscal_year int not null,
  fiscal_quarter int not null check (fiscal_quarter between 1 and 4),
  raw_text text not null,
  word_count int,
  source text,
  created_at timestamptz default now()
);

create table transcript_chunks (
  id uuid default gen_random_uuid() primary key,
  transcript_id uuid references earnings_transcripts(id) on delete cascade,
  content text not null,
  section_type text not null default 'other',
  speaker text,
  chunk_index int not null,
  embedding vector(384),
  created_at timestamptz default now()
);

create table transcript_comparisons (
  id uuid default gen_random_uuid() primary key,
  transcript_a_id uuid references earnings_transcripts(id) on delete cascade,
  transcript_b_id uuid references earnings_transcripts(id) on delete cascade,
  analysis text,
  created_at timestamptz default now()
);
```

### SEC Filing Tables
```sql
create table sec_filings (
  id uuid default gen_random_uuid() primary key,
  cik text not null,
  accession_number text not null unique,
  filing_type text not null,
  filing_date date not null,
  primary_document text,
  company_name text,
  full_text text,
  risk_factors_text text,
  created_at timestamptz default now()
);

create table risk_factor_tracking (
  id uuid default gen_random_uuid() primary key,
  filing_id uuid references sec_filings(id) on delete cascade,
  title text not null,
  content text,
  severity_score int check (severity_score between 1 and 10),
  status text default 'new' check (status in ('new','modified','unchanged','removed')),
  category text,
  previous_filing_id uuid references sec_filings(id),
  created_at timestamptz default now()
);
```

### Pre-Call War Room Tables
```sql
create table precall_sessions (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  opening_remarks text,
  danger_zones jsonb default '[]',
  competitor_analysis jsonb default '[]',
  created_at timestamptz default now()
);

create table competitor_transcripts (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  raw_text text not null,
  analysis jsonb,
  source text,
  created_at timestamptz default now()
);
```

### Investor Intelligence Tables
```sql
create table institutional_holders (
  id uuid default gen_random_uuid() primary key,
  institution_name text not null,
  shares_held bigint default 0,
  market_value numeric default 0,
  pct_of_portfolio numeric default 0,
  change_shares bigint default 0,
  change_pct numeric default 0,
  report_date date,
  source text default 'manual',
  created_at timestamptz default now()
);

create table analyst_ratings (
  id uuid default gen_random_uuid() primary key,
  analyst_name text not null,
  firm text not null,
  rating text not null check (rating in ('Strong Buy','Buy','Hold','Sell','Strong Sell')),
  price_target numeric default 0,
  previous_rating text,
  previous_price_target numeric,
  date date not null,
  created_at timestamptz default now()
);

create table short_interest (
  id uuid default gen_random_uuid() primary key,
  settlement_date date not null,
  short_interest bigint default 0,
  avg_daily_volume bigint default 0,
  days_to_cover numeric default 0,
  pct_float numeric default 0,
  change_pct numeric default 0,
  created_at timestamptz default now()
);

create table sentiment_scores (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  score numeric not null,
  components jsonb default '{}',
  rationale text,
  created_at timestamptz default now()
);
```

### Market Pulse Tables
```sql
create table energy_prices (
  id uuid default gen_random_uuid() primary key,
  series_id text not null,
  series_name text,
  date text not null,
  value numeric not null,
  unit text,
  created_at timestamptz default now(),
  unique(series_id, date)
);

create table regulatory_news (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  source text,
  date date not null,
  content text,
  impact_score int check (impact_score between 1 and 10),
  impact_analysis text,
  category text default 'regulatory' check (category in ('regulatory','esg','policy','legal')),
  created_at timestamptz default now()
);

create table morning_briefings (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  content text not null,
  key_metrics jsonb default '{}',
  created_at timestamptz default now()
);
```

### Post-Call Debrief Tables
```sql
create table postcall_debriefs (
  id uuid default gen_random_uuid() primary key,
  precall_session_id uuid references precall_sessions(id),
  transcript_id uuid references earnings_transcripts(id) on delete cascade,
  prediction_accuracy jsonb default '{}',
  sentiment_timeline jsonb default '[]',
  action_items jsonb default '[]',
  overall_assessment text,
  created_at timestamptz default now()
);

create table press_reactions (
  id uuid default gen_random_uuid() primary key,
  debrief_id uuid references postcall_debriefs(id) on delete cascade,
  title text not null,
  source text,
  date date,
  sentiment text check (sentiment in ('positive','neutral','negative')),
  sentiment_score numeric,
  key_takeaways jsonb default '[]',
  full_text text,
  created_at timestamptz default now()
);
```

### RPC Functions
```sql
-- Document chunk similarity search (Flash Reports RAG)
create or replace function match_document_chunks(
  query_embedding vector(384),
  match_threshold float default 0.5,
  match_count int default 15,
  filter_briefing_id uuid default null
) returns table (id uuid, briefing_id uuid, document_name text, chunk_index int, content text, similarity float)
language sql stable as $$
  select dc.id, dc.briefing_id, dc.document_name, dc.chunk_index, dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
    and (filter_briefing_id is null or dc.briefing_id = filter_briefing_id)
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Transcript chunk similarity search (Earnings War Room)
create or replace function match_transcript_chunks(
  query_embedding vector(384),
  match_threshold float default 0.4,
  match_count int default 10
) returns table (id uuid, transcript_id uuid, content text, section_type text, speaker text, chunk_index int, similarity float)
language sql stable as $$
  select tc.id, tc.transcript_id, tc.content, tc.section_type, tc.speaker, tc.chunk_index,
    1 - (tc.embedding <=> query_embedding) as similarity
  from transcript_chunks tc
  where 1 - (tc.embedding <=> query_embedding) > match_threshold
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;
```

## FILE STRUCTURE
```
src/
  app/
    layout.tsx                        — Root layout with metadata
    page.tsx                          — Main app: shared state, tab routing, upload flow
    globals.css                       — Tailwind + custom styles + fonts + animations
    api/
      upload/route.ts                 — File upload + server-side parsing (unused by main flow)
      analyze/route.ts                — SSE: materiality → questions → trends → RAG indexing
      briefings/route.ts              — GET: list all briefings
      briefings/[id]/route.ts         — GET: full briefing with bullets/questions/trends
      transcripts/route.ts            — GET: list transcripts / POST: upload + chunk + embed
      transcripts/[id]/route.ts       — GET/DELETE: single transcript
      transcripts/search/route.ts     — POST SSE: vector search + Claude answer with citations
      transcripts/compare/route.ts    — POST SSE: quarter-vs-quarter comparison
      sec/filings/route.ts            — GET: list cached SEC filings
      sec/fetch/route.ts              — POST SSE: EDGAR fetch → download → extract → analyze
      sec/risk-factors/route.ts       — GET: risk factor tracking list
      sec/compare/route.ts            — POST SSE: compare two filings
      precall/route.ts                — POST SSE: opening remarks + danger zones
      precall/competitors/route.ts    — POST: competitor transcript analysis
      investors/holdings/route.ts     — GET/POST: institutional holders (CSV import)
      investors/ratings/route.ts      — GET/POST: analyst ratings (manual input)
      investors/short-interest/route.ts — GET/POST: short interest data (CSV import)
      investors/sentiment/route.ts    — GET/POST: Claude sentiment calculation
      market/prices/route.ts          — GET/POST: energy prices (EIA API fetch)
      market/regulatory/route.ts      — GET/POST: regulatory news + Claude impact analysis
      market/morning-briefing/route.ts — GET/POST: daily morning briefing generation
      postcall/route.ts               — POST SSE: prediction accuracy + sentiment + action items
      postcall/[id]/route.ts          — GET: full debrief with press reactions
  components/
    Header.tsx                        — 7-tab scrollable nav + history button + actions
    UploadZone.tsx                    — Drag-and-drop file upload
    BulletCard.tsx                    — Materiality bullet with score bar
    AnalystQuestionCard.tsx           — Question card with difficulty badge
    TrendGrid.tsx                     — 2x2 trend comparison grid
    BriefingHistory.tsx               — Legacy history component (still used standalone)
    ScoreBar.tsx                      — Animated score bar (1-10)
    LoadingState.tsx                  — Full-screen loading overlay
    ExportButton.tsx                  — Clipboard export formatter
    SidePanel.tsx                     — Reusable slide-out panel (ESC to close)
    HistoryPanel.tsx                  — Briefing history in SidePanel
    ChatInterface.tsx                 — Reusable Q&A with SSE streaming + citations
    DataTable.tsx                     — Sortable table with generic types
    CsvUploader.tsx                   — CSV upload with preview, template download, column mapping
    tabs/
      FlashReportsTab.tsx             — Briefing bullets + executive summary
      EarningsWarRoomTab.tsx          — Transcript list + search/compare/browse modes
      SecFilingsTab.tsx               — Filing timeline + risk tracker + compare
      PreCallWarRoomTab.tsx           — Remarks + questions + dangers + competitors
      InvestorIntelTab.tsx            — Holdings + ratings + short interest + sentiment
      MarketPulseTab.tsx              — Prices + regulatory + morning briefing
      PostCallDebriefTab.tsx          — Accuracy + sentiment + actions + press
  lib/
    anthropic.ts                      — Claude client (callClaude, callClaudeJSON with retry)
    supabase.ts                       — Supabase client (server + browser)
    prompts.ts                        — 15 Claude system prompts
    parser.ts                         — Server-side PDF + DOCX parsing
    client-parser.ts                  — Browser-side PDF + DOCX parsing (pdfjs-dist + mammoth)
    types.ts                          — All TypeScript interfaces (~280 lines)
    chunker.ts                        — Document chunking (paragraph-boundary, overlap)
    embeddings.ts                     — Local embeddings (Xenova/all-MiniLM-L6-v2, 384-dim)
    transcript-parser.ts              — Transcript section detection, speaker extraction, speaker-aware chunking
    edgar.ts                          — SEC EDGAR API client (filing index, document fetch, risk factor extraction)
    eia.ts                            — EIA API v2 client (coal + natural gas prices)
  types/
    pdf-parse.d.ts                    — Type declarations for pdf-parse
```

## CLAUDE SYSTEM PROMPTS (15 total)

All prompts are in `src/lib/prompts.ts`:

| Prompt | Tab | Purpose |
|--------|-----|---------|
| `MATERIALITY_PROMPT` | Flash Reports | Rank 5-10 material items from documents |
| `ANALYST_QUESTIONS_PROMPT` | Flash Reports | Predict 5-7 analyst questions |
| `TREND_COMPARISON_PROMPT` | Flash Reports | Compare two briefing periods |
| `TRANSCRIPT_SEARCH_PROMPT` | Earnings | Answer questions from transcript excerpts with citations |
| `TRANSCRIPT_COMPARE_PROMPT` | Earnings | Compare two quarters (messaging, financials, guidance, tone) |
| `RISK_FACTOR_EXTRACTION_PROMPT` | SEC | Parse risk factors with severity scores |
| `RISK_FACTOR_COMPARISON_PROMPT` | SEC | Compare risk factors between two filings |
| `OPENING_REMARKS_PROMPT` | Pre-Call | Draft 3-4 min opening script |
| `EXPANDED_QUESTIONS_PROMPT` | Pre-Call | Add likelihood % and danger zone flags |
| `DANGER_ZONES_PROMPT` | Pre-Call | Identify 3-5 call-derailing topics |
| `COMPETITOR_ANALYSIS_PROMPT` | Pre-Call | Compare competitor messaging |
| `INVESTOR_SENTIMENT_PROMPT` | Investors | Calculate -1.0 to +1.0 sentiment score |
| `MORNING_BRIEFING_PROMPT` | Market | Generate daily CEO morning brief |
| `REGULATORY_IMPACT_PROMPT` | Market | Score regulatory article impact on ARLP |
| `PREDICTION_ACCURACY_PROMPT` | Post-Call | Score predicted vs actual questions |
| `CALL_SENTIMENT_PROMPT` | Post-Call | Per-exchange sentiment analysis |
| `ACTION_ITEMS_PROMPT` | Post-Call | Extract commitments from transcript |
| `PRESS_REACTION_PROMPT` | Post-Call | Analyze press article sentiment |

## API ROUTES (19 total)

### Flash Reports (existing)
- `POST /api/upload` — Server-side file parsing (unused by main UI flow)
- `POST /api/analyze` — SSE: materiality → questions → trends → RAG indexing
- `GET /api/briefings` — List all briefings with bullet count and avg score
- `GET /api/briefings/[id]` — Full briefing with bullets, questions, trends

### Earnings War Room
- `GET/POST /api/transcripts` — List / upload transcript (parse, chunk, embed)
- `GET/DELETE /api/transcripts/[id]` — Get / delete transcript
- `POST /api/transcripts/search` — SSE: embed query → vector search → Claude answer with citations
- `POST /api/transcripts/compare` — SSE: side-by-side quarter comparison

### SEC Filing Intelligence
- `GET /api/sec/filings` — List cached filings
- `POST /api/sec/fetch` — SSE: EDGAR fetch → download → extract → analyze risk factors
- `GET /api/sec/risk-factors` — Risk factor tracking across filings
- `POST /api/sec/compare` — SSE: compare two filings

### Pre-Call War Room
- `POST /api/precall` — SSE: opening remarks + danger zones
- `POST /api/precall/competitors` — Upload + analyze competitor transcript

### Investor Intelligence
- `GET/POST /api/investors/holdings` — Get / import institutional holders
- `GET/POST /api/investors/ratings` — Get / add analyst ratings
- `GET/POST /api/investors/short-interest` — Get / import short interest
- `GET/POST /api/investors/sentiment` — Get / calculate sentiment score

### Market Pulse
- `GET/POST /api/market/prices` — Get cached / fetch EIA prices
- `GET/POST /api/market/regulatory` — List / upload + analyze regulatory articles
- `GET/POST /api/market/morning-briefing` — Get today's / generate new morning briefing

### Post-Call Debrief
- `POST /api/postcall` — SSE: prediction accuracy + sentiment + action items (or press article analysis)
- `GET /api/postcall/[id]` — Full debrief with press reactions

## DESIGN SYSTEM

### Colors
- Background: Midnight black `#08080B` with fractal noise SVG texture overlay
- Primary accent: Gold `#C9A84C` with variants (light `#E8D48B`, dark `#9A7B2F`, muted `rgba(201,168,76,0.15)`)
- Custom slate: `slate-750: #293548`

### Typography
- Display headings: `Instrument Serif` (Google Fonts)
- Body text: `DM Sans` (Google Fonts)
- Data/scores/code: `JetBrains Mono` (Google Fonts)
- Loaded via CSS `@import` in `globals.css`

### Animations
- `animate-fade-in` — 0.5s ease-out opacity
- `animate-slide-up` — 0.5s ease-out translateY(20px→0)
- `animate-pulse-gold` — 2s gold box-shadow pulse
- `tab-fade-in` — 0.3s tab content entrance
- `slide-in-right` — 0.3s side panel entrance
- `score-bar-fill` — 0.8s CSS variable-driven width animation
- `.stagger-1` through `.stagger-8` — Staggered animation delays
- `.scrollbar-hide` — Hide scrollbars (for tab bar overflow)

### Component Patterns
- Cards: `rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10`
- Gold accent cards: `rounded-2xl bg-gradient-to-br from-gold/[0.06] to-transparent border border-gold/10`
- Buttons: `rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10`
- Gold buttons: `rounded-lg bg-gold/20 border border-gold/20 text-gold hover:bg-gold/30`
- Mode selectors: Pill-style button group in `bg-white/[0.02] border border-white/5`

## CRITICAL IMPLEMENTATION NOTES

1. **Client-side parsing is primary** — `page.tsx` uses `client-parser.ts` (pdfjs-dist + mammoth in browser). The `/api/upload` route exists but is NOT called by the main flow. Document text is sent as JSON to `/api/analyze`.

2. **SSE streaming pattern** — All long-running operations use `ReadableStream` with `data: {json}\n\n` format. Client reads with `reader.read()` loop, splits on `\n\n`, parses `data: ` prefix.

3. **Claude API pattern** — `callClaude` for plain text, `callClaudeJSON<T>` for parsed JSON with one retry on parse failure. Model: `claude-sonnet-4-20250514`, max_tokens: 4096, temperature: 0.2.

4. **Embeddings** — Local `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim). Singleton pipeline. Sequential processing to avoid OOM on serverless. Cache dir: `/tmp/transformers-cache` on Vercel.

5. **Analysis runs sequentially** — Briefing → questions (from briefing) → trends (if previous exists) → RAG indexing. Progress shown via SSE phase events.

6. **SEC EDGAR rate limiting** — Max 10 requests/second. 200ms delay between document downloads.

7. **Tab lazy loading** — Tab components only fetch data on first render (checked via `loaded` state flag).

8. **Supabase migration** — All new table DDL is in `supabase-migration.sql` at the project root. Must be run manually in the Supabase SQL Editor.

## WHAT SUCCESS LOOKS LIKE
The CEO opens this app before an earnings call. He sees 7 intelligence tabs covering his entire prep workflow. Flash Reports show the ranked material items. He switches to Pre-Call War Room for opening remarks and danger zones. After the call, he opens Post-Call Debrief to see how accurate the predictions were and extract action items. Meanwhile, Market Pulse shows him coal and gas prices, and Investor Intel tracks who's buying and selling ARLP shares.

He turns to Hayden and says: "How did you build this?"
