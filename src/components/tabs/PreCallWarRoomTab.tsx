"use client";

import { useState } from "react";
import { Shield, Loader2, AlertTriangle, Copy, Check, RefreshCw, Upload } from "lucide-react";
import type { BriefingData, QuestionsData, DangerZone, CompetitorAnalysis } from "@/lib/types";
import AnalystQuestionCard from "@/components/AnalystQuestionCard";

type ViewMode = "remarks" | "questions" | "dangers" | "competitors";

interface PreCallWarRoomTabProps {
  briefing: BriefingData | null;
  questions: QuestionsData | null;
  briefingId?: string | null;
}

export default function PreCallWarRoomTab({ briefing, questions, briefingId }: PreCallWarRoomTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("remarks");
  const [openingRemarks, setOpeningRemarks] = useState<string | null>(null);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorAnalysis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedPhase, setGeneratedPhase] = useState("");
  const [remarksCopied, setRemarksCopied] = useState(false);

  const generatePreCall = async () => {
    if (!briefingId || !briefing) return;
    setGenerating(true);
    setGeneratedPhase("Generating pre-call intelligence...");

    try {
      const res = await fetch("/api/precall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing_id: briefingId }),
      });

      if (!res.ok) throw new Error("Pre-call generation failed");

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "phase") setGeneratedPhase(event.phase);
            if (event.type === "opening_remarks") setOpeningRemarks(event.data);
            if (event.type === "danger_zones") setDangerZones(event.data);
            if (event.type === "competitors") setCompetitors(event.data);
          } catch { /* skip */ }
        }
      }
    } catch {
      setGeneratedPhase("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const uploadCompetitorTranscript = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.pdf,.docx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setGenerating(true);
      setGeneratedPhase("Analyzing competitor transcript...");
      try {
        const text = await file.text();
        const res = await fetch("/api/precall/competitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: text, source: file.name, briefing_id: briefingId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.analysis) setCompetitors((prev) => [...prev, data.analysis]);
        }
      } catch { /* ignore */ } finally { setGenerating(false); }
    };
    input.click();
  };

  const copyRemarks = () => {
    if (!openingRemarks) return;
    navigator.clipboard.writeText(openingRemarks);
    setRemarksCopied(true);
    setTimeout(() => setRemarksCopied(false), 2000);
  };

  const severityColors: Record<string, string> = {
    high: "border-red-500/30 bg-red-500/5",
    medium: "border-amber-500/30 bg-amber-500/5",
    low: "border-white/10 bg-white/[0.02]",
  };

  if (!briefing) {
    return (
      <div className="tab-fade-in text-center py-16">
        <Shield size={40} className="mx-auto text-white/15 mb-4" />
        <h3 className="text-white/40 font-body text-lg mb-2">No Briefing Data</h3>
        <p className="text-white/20 font-body text-sm">Generate a Flash Report first to enable pre-call preparation</p>
      </div>
    );
  }

  return (
    <div className="tab-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-gold" />
          <h2 className="font-display text-xl text-white">CEO Pre-Call War Room</h2>
        </div>
        <button
          onClick={generatePreCall}
          disabled={generating || !briefingId}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
          {generating ? generatedPhase : "Generate Pre-Call Intel"}
        </button>
      </div>

      {/* View mode selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
        {[
          { id: "remarks" as ViewMode, label: "Opening Remarks" },
          { id: "questions" as ViewMode, label: `Questions (${questions?.predicted_questions?.length || 0})` },
          { id: "dangers" as ViewMode, label: `Danger Zones (${dangerZones.length})` },
          { id: "competitors" as ViewMode, label: "Competitors" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            className={`px-4 py-2 rounded-md text-xs font-body font-medium transition-all ${
              viewMode === m.id ? "bg-gold/20 text-gold border border-gold/20" : "text-white/40 hover:text-white/60"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Opening Remarks */}
      {viewMode === "remarks" && (
        <div>
          {openingRemarks ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={copyRemarks}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-body hover:text-white"
                >
                  {remarksCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {remarksCopied ? "Copied" : "Copy to clipboard"}
                </button>
              </div>
              <div className="p-8 rounded-2xl bg-gradient-to-br from-gold/[0.04] to-transparent border border-gold/10">
                <div className="max-w-3xl mx-auto text-white/80 text-lg font-body leading-relaxed whitespace-pre-wrap">
                  {openingRemarks}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-white/20 font-body text-sm">
                Click &quot;Generate Pre-Call Intel&quot; to create opening remarks
              </p>
            </div>
          )}
        </div>
      )}

      {/* Questions */}
      {viewMode === "questions" && (
        <div>
          {questions && questions.predicted_questions?.length > 0 ? (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] to-transparent border border-amber-500/10 mb-4">
                <h3 className="text-xs uppercase tracking-widest text-amber-400/60 font-body font-semibold mb-3">
                  Call Risk Assessment
                </h3>
                <p className="text-white/80 font-body leading-relaxed text-[15px]">
                  {questions.call_risk_assessment}
                </p>
              </div>
              {questions.predicted_questions.map((q, i) => (
                <AnalystQuestionCard key={i} question={q} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              No questions generated yet
            </div>
          )}
        </div>
      )}

      {/* Danger Zones */}
      {viewMode === "dangers" && (
        <div>
          {dangerZones.length > 0 ? (
            <div className="space-y-4">
              {dangerZones.map((dz, i) => (
                <div key={i} className={`p-5 rounded-xl border ${severityColors[dz.severity]}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} className={dz.severity === "high" ? "text-red-400" : "text-amber-400"} />
                    <span className={`text-xs font-body font-semibold uppercase ${
                      dz.severity === "high" ? "text-red-400" : "text-amber-400"
                    }`}>
                      {dz.severity} risk
                    </span>
                  </div>
                  <h4 className="text-white font-body font-medium text-sm mb-2">{dz.topic}</h4>
                  <p className="text-white/50 text-sm font-body mb-3">{dz.why_dangerous}</p>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 mb-3">
                    <p className="text-xs text-red-400/60 uppercase tracking-wider font-body mb-1">Worst Question</p>
                    <p className="text-white/70 text-sm font-body italic">&quot;{dz.worst_question}&quot;</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-xs text-emerald-400/60 uppercase tracking-wider font-body mb-1">Recommended Response</p>
                    <p className="text-white/70 text-sm font-body">{dz.recommended_deflection}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              Click &quot;Generate Pre-Call Intel&quot; to identify danger zones
            </div>
          )}
        </div>
      )}

      {/* Competitors */}
      {viewMode === "competitors" && (
        <div>
          <div className="mb-4">
            <button
              onClick={uploadCompetitorTranscript}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm font-body hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <Upload size={14} />
              Upload Competitor Transcript
            </button>
          </div>
          {competitors.length > 0 ? (
            <div className="space-y-4">
              {competitors.map((comp, i) => (
                <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/5">
                  <h4 className="text-white font-body font-medium mb-3">{comp.company_name}</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-white/30 uppercase tracking-wider font-body mb-1">Key Themes</p>
                      <div className="flex flex-wrap gap-2">
                        {comp.key_themes.map((theme, j) => (
                          <span key={j} className="px-2 py-1 rounded-md bg-white/5 text-white/50 text-xs font-body">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-white/30 uppercase tracking-wider font-body mb-1">vs ARLP Messaging</p>
                      <p className="text-white/60 text-sm font-body">{comp.messaging_comparison}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30 uppercase tracking-wider font-body mb-1">Competitive Implications</p>
                      <p className="text-white/60 text-sm font-body">{comp.competitive_implications}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              Upload a competitor&apos;s earnings transcript to compare messaging
            </div>
          )}
        </div>
      )}
    </div>
  );
}
