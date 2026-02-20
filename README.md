# ARLP Executive Intelligence Briefing

AI-powered materiality analysis for executive leadership. Upload monthly reports, earnings materials, and operational documents — GPT-4o identifies the 5-10 most material items, predicts analyst questions, and tracks month-over-month trends.

## Features

- **Materiality Scoring** — Ranks findings 1-10 by financial impact, strategic significance, risk, and stakeholder impact
- **Analyst Question Predictor** — Anticipates the questions analysts will ask on earnings calls with suggested CEO talking points
- **Trend Comparison** — Compares period-over-period to surface what improved, deteriorated, or is new
- **PDF & DOCX Support** — Parses PDFs and Word documents server-side
- **Enterprise-Ready** — Swap between OpenAI and Azure OpenAI with a single env variable

## Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

```bash
vercel --prod
```

Set environment variables in Vercel dashboard under Settings > Environment Variables.

## Architecture (Microsoft-Swappable)

| Current | Microsoft Equivalent |
|---|---|
| OpenAI SDK | Azure OpenAI (change 1 env var) |
| File upload API | SharePoint + Azure Blob Storage |
| Next.js on Vercel | Azure Static Web Apps |
| pdf-parse + mammoth | Azure Document Intelligence |
| In-memory | Azure AI Search (RAG) |
