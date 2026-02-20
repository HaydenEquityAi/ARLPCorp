"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  X,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Target,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import type {
  ParsedDocument,
  BriefingData,
  QuestionsData,
  TrendsData,
  ActiveTab,
} from "@/lib/types";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import BulletCard from "@/components/BulletCard";
import AnalystQuestionCard from "@/components/AnalystQuestionCard";
import TrendGrid from "@/components/TrendGrid";
import BriefingHistory from "@/components/BriefingHistory";
import LoadingState from "@/components/LoadingState";

export default function Home() {
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState("");
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [questions, setQuestions] = useState<QuestionsData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("briefing");
  const [copied, setCopied] = useState(false);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    setError("");
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments((prev) => [...prev, ...data.documents]);
      if (data.errors?.length) {
        setError(`Some files had issues: ${data.errors.map((e: { file: string }) => e.file).join(", ")}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    setBriefing(null);
    setQuestions(null);
    setTrends(null);

    try {
      setAnalysisPhase("Running materiality analysis across all documents...");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: documents.map((d) => ({
            name: d.name,
            content: d.content,
            wordCount: d.wordCount,
            pageCount: d.pageCount,
            type: d.type,
            size: d.size,
          })),
          mode: "briefing",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.briefing) setBriefing(data.briefing);
      if (data.questions) setQuestions(data.questions);
      if (data.trends) setTrends(data.trends);
      setActiveTab("briefing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      setAnalysisPhase("");
    }
  };

  const copyBriefing = () => {
    if (!briefing) return;
    const text = [
      briefing.briefing_title,
      `Generated: ${new Date(briefing.generated_at).toLocaleDateString()}`,
      "",
      "EXECUTIVE SUMMARY",
      briefing.executive_summary,
      "",
      ...briefing.bullets.map(
        (b) =>
          `#${b.rank} [Score: ${b.materiality_score}/10] [${b.category}]\n${b.finding}\nSource: ${b.source_document}\nSo What: ${b.so_what}\n`
      ),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadBriefing = async (briefingId: string) => {
    setAnalyzing(true);
    setAnalysisPhase("Loading briefing...");
    try {
      const res = await fetch(`/api/briefings/${briefingId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.briefing) setBriefing(data.briefing);
      if (data.questions) setQuestions(data.questions);
      if (data.trends) setTrends(data.trends);
      setActiveTab("briefing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load briefing");
    } finally {
      setAnalyzing(false);
      setAnalysisPhase("");
    }
  };

  const resetAll = () => {
    setBriefing(null);
    setQuestions(null);
    setTrends(null);
    setDocuments([]);
    setActiveTab("briefing");
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  };

  // ─── Loading Overlay ───
  if (analyzing) {
    return <LoadingState phase={analysisPhase} />;
  }

  // ─── Upload View ───
  if (!briefing) {
    return (
      <div className="min-h-screen relative z-10">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCopy={copyBriefing}
          onNewAnalysis={resetAll}
          copied={copied}
          hasQuestions={!!questions}
          hasTrends={!!trends}
        />

        <main className="max-w-4xl mx-auto px-6 pt-16 pb-24">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl text-white mb-4">
              What matters most<span className="text-gold italic"> right now</span>
            </h2>
            <p className="text-white/50 font-body max-w-lg mx-auto leading-relaxed">
              Upload your monthly reports, earnings materials, and operational documents.
              AI will identify the 5-10 most material items for the executive team.
            </p>
          </div>

          <UploadZone onUpload={handleUpload} uploading={uploading} />

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-sm font-body">{error}</p>
            </div>
          )}

          {documents.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-body font-semibold text-white/50 uppercase tracking-wider">
                  {documents.length} Document{documents.length > 1 ? "s" : ""} Ready ·{" "}
                  {documents.reduce((s, d) => s + d.wordCount, 0).toLocaleString()} words
                </h3>
              </div>

              <div className="grid gap-2">
                {documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all animate-slide-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-white/30 text-xs font-body mt-0.5">
                        {formatBytes(doc.size)} · {doc.wordCount.toLocaleString()} words
                        {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                        {" · "}{doc.type.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={14} className="text-white/30" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={runAnalysis}
                disabled={documents.length === 0}
                className="mt-8 w-full py-4 px-6 rounded-xl font-body font-semibold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-3 bg-gradient-to-r from-gold to-gold-dark text-midnight hover:shadow-lg hover:shadow-gold/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                <Sparkles size={20} />
                Generate Executive Briefing
                <ChevronRight size={18} />
              </button>

              <p className="text-center text-white/20 text-xs font-body mt-3">
                Analyzes all documents together · Identifies top material items · Predicts analyst questions
              </p>
            </div>
          )}

          {documents.length === 0 && (
            <div className="grid grid-cols-3 gap-4 mt-16">
              {[
                { icon: <Target size={20} />, title: "Materiality Scoring", desc: "Ranks findings by financial impact, strategic significance, and risk" },
                { icon: <MessageSquare size={20} />, title: "Analyst Predictor", desc: "Anticipates the questions analysts will ask on the call" },
                { icon: <TrendingUp size={20} />, title: "Trend Tracking", desc: "Compares month-over-month to surface what changed" },
              ].map((f, i) => (
                <div key={i} className="p-6 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-gold/60 mb-3">{f.icon}</div>
                  <h4 className="text-white text-sm font-semibold mb-1.5">{f.title}</h4>
                  <p className="text-white/30 text-xs leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ─── Results View ───
  return (
    <div className="min-h-screen relative z-10">
      <Header
        briefing={briefing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCopy={copyBriefing}
        onNewAnalysis={resetAll}
        copied={copied}
        hasQuestions={!!questions}
        hasTrends={!!trends}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-300 text-sm font-body">{error}</p>
          </div>
        )}

        {/* Briefing Tab */}
        {activeTab === "briefing" && (
          <div className="animate-fade-in">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/[0.06] to-transparent border border-gold/10 mb-8">
              <h3 className="text-xs uppercase tracking-widest text-gold/60 font-body font-semibold mb-3">
                Executive Summary
              </h3>
              <p className="text-white/80 font-body leading-relaxed text-[15px]">
                {briefing.executive_summary}
              </p>
            </div>

            <div className="space-y-4">
              {briefing.bullets
                .sort((a, b) => a.rank - b.rank)
                .map((bullet, i) => (
                  <BulletCard key={i} bullet={bullet} index={i} />
                ))}
            </div>
          </div>
        )}

        {/* Analyst Questions Tab */}
        {activeTab === "questions" && questions && (
          <div className="animate-fade-in">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] to-transparent border border-amber-500/10 mb-8">
              <h3 className="text-xs uppercase tracking-widest text-amber-400/60 font-body font-semibold mb-3">
                Call Risk Assessment
              </h3>
              <p className="text-white/80 font-body leading-relaxed text-[15px]">
                {questions.call_risk_assessment}
              </p>
            </div>

            <div className="space-y-4">
              {questions.predicted_questions.map((q, i) => (
                <AnalystQuestionCard key={i} question={q} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === "trends" && trends && <TrendGrid trends={trends} />}

        {/* History Tab */}
        {activeTab === "history" && <BriefingHistory onSelect={loadBriefing} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 mt-16">
        <p className="text-center text-white/15 text-xs font-body">
          Alliance Resource Partners · Executive Intelligence System · Powered by Claude AI · Enterprise Data Security
        </p>
      </footer>
    </div>
  );
}
