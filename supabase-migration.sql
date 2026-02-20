-- ============================================================
-- ARLP Executive Intelligence Briefing — 7-Tab Expansion
-- Run this migration in the Supabase SQL Editor
-- ============================================================

-- Enable pgvector if not already enabled
create extension if not exists vector;

-- ─── Earnings Call War Room (Tab 2) ───

create table if not exists earnings_transcripts (
  id uuid default gen_random_uuid() primary key,
  company text not null default 'ARLP',
  fiscal_year int not null,
  fiscal_quarter int not null check (fiscal_quarter between 1 and 4),
  raw_text text not null,
  word_count int,
  source text,
  created_at timestamptz default now()
);

create table if not exists transcript_chunks (
  id uuid default gen_random_uuid() primary key,
  transcript_id uuid references earnings_transcripts(id) on delete cascade,
  content text not null,
  section_type text not null default 'other',
  speaker text,
  chunk_index int not null,
  embedding vector(384),
  created_at timestamptz default now()
);

create index if not exists idx_transcript_chunks_transcript on transcript_chunks(transcript_id);
create index if not exists idx_transcript_chunks_embedding on transcript_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create table if not exists transcript_comparisons (
  id uuid default gen_random_uuid() primary key,
  transcript_a_id uuid references earnings_transcripts(id) on delete cascade,
  transcript_b_id uuid references earnings_transcripts(id) on delete cascade,
  analysis text,
  created_at timestamptz default now()
);

-- RPC function for transcript chunk similarity search
create or replace function match_transcript_chunks(
  query_embedding vector(384),
  match_threshold float default 0.4,
  match_count int default 10
)
returns table (
  id uuid,
  transcript_id uuid,
  content text,
  section_type text,
  speaker text,
  chunk_index int,
  similarity float
)
language sql stable
as $$
  select
    tc.id,
    tc.transcript_id,
    tc.content,
    tc.section_type,
    tc.speaker,
    tc.chunk_index,
    1 - (tc.embedding <=> query_embedding) as similarity
  from transcript_chunks tc
  where 1 - (tc.embedding <=> query_embedding) > match_threshold
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;

-- ─── SEC Filing Intelligence (Tab 3) ───

create table if not exists sec_filings (
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

create index if not exists idx_sec_filings_date on sec_filings(filing_date desc);
create index if not exists idx_sec_filings_type on sec_filings(filing_type);

create table if not exists risk_factor_tracking (
  id uuid default gen_random_uuid() primary key,
  filing_id uuid references sec_filings(id) on delete cascade,
  title text not null,
  content text,
  severity_score int check (severity_score between 1 and 10),
  status text default 'new' check (status in ('new', 'modified', 'unchanged', 'removed')),
  category text,
  previous_filing_id uuid references sec_filings(id),
  created_at timestamptz default now()
);

create index if not exists idx_risk_factors_filing on risk_factor_tracking(filing_id);

-- ─── Pre-Call War Room (Tab 4) ───

create table if not exists precall_sessions (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  opening_remarks text,
  danger_zones jsonb default '[]',
  competitor_analysis jsonb default '[]',
  created_at timestamptz default now()
);

create index if not exists idx_precall_briefing on precall_sessions(briefing_id);

create table if not exists competitor_transcripts (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  raw_text text not null,
  analysis jsonb,
  source text,
  created_at timestamptz default now()
);

-- ─── Investor Intelligence (Tab 5) ───

create table if not exists institutional_holders (
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

create table if not exists analyst_ratings (
  id uuid default gen_random_uuid() primary key,
  analyst_name text not null,
  firm text not null,
  rating text not null check (rating in ('Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell')),
  price_target numeric default 0,
  previous_rating text,
  previous_price_target numeric,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists short_interest (
  id uuid default gen_random_uuid() primary key,
  settlement_date date not null,
  short_interest bigint default 0,
  avg_daily_volume bigint default 0,
  days_to_cover numeric default 0,
  pct_float numeric default 0,
  change_pct numeric default 0,
  created_at timestamptz default now()
);

create table if not exists sentiment_scores (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  score numeric not null,
  components jsonb default '{}',
  rationale text,
  created_at timestamptz default now()
);

-- ─── Market Pulse (Tab 6) ───

create table if not exists energy_prices (
  id uuid default gen_random_uuid() primary key,
  series_id text not null,
  series_name text,
  date text not null,
  value numeric not null,
  unit text,
  created_at timestamptz default now(),
  unique(series_id, date)
);

create index if not exists idx_energy_prices_date on energy_prices(date desc);

create table if not exists regulatory_news (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  source text,
  date date not null,
  content text,
  impact_score int check (impact_score between 1 and 10),
  impact_analysis text,
  category text default 'regulatory' check (category in ('regulatory', 'esg', 'policy', 'legal')),
  created_at timestamptz default now()
);

create table if not exists morning_briefings (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  content text not null,
  key_metrics jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── Post-Call Debrief (Tab 7) ───

create table if not exists postcall_debriefs (
  id uuid default gen_random_uuid() primary key,
  precall_session_id uuid references precall_sessions(id),
  transcript_id uuid references earnings_transcripts(id) on delete cascade,
  prediction_accuracy jsonb default '{}',
  sentiment_timeline jsonb default '[]',
  action_items jsonb default '[]',
  overall_assessment text,
  created_at timestamptz default now()
);

create table if not exists press_reactions (
  id uuid default gen_random_uuid() primary key,
  debrief_id uuid references postcall_debriefs(id) on delete cascade,
  title text not null,
  source text,
  date date,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  sentiment_score numeric,
  key_takeaways jsonb default '[]',
  full_text text,
  created_at timestamptz default now()
);

-- ─── Existing table: ensure document_chunks has embedding support ───
-- (This may already exist from the initial setup)

create table if not exists document_chunks (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references briefings(id) on delete cascade,
  document_name text,
  chunk_index int,
  content text,
  embedding vector(384),
  created_at timestamptz default now()
);

create index if not exists idx_document_chunks_briefing on document_chunks(briefing_id);
create index if not exists idx_document_chunks_embedding on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- RPC function for document chunk similarity search (if not already created)
create or replace function match_document_chunks(
  query_embedding vector(384),
  match_threshold float default 0.5,
  match_count int default 15,
  filter_briefing_id uuid default null
)
returns table (
  id uuid,
  briefing_id uuid,
  document_name text,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.briefing_id,
    dc.document_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
    and (filter_briefing_id is null or dc.briefing_id = filter_briefing_id)
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
