"use client";

import { useState, useCallback } from "react";
import { MessageCircle, Loader2, Upload, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import type { PostCallDebrief, PressReaction, EarningsTranscript } from "@/lib/types";

type ViewMode = "accuracy" | "sentiment" | "actions" | "press";

export default function PostCallDebriefTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("accuracy");
  const [transcripts, setTranscripts] = useState<EarningsTranscript[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState("");
  const [debrief, setDebrief] = useState<PostCallDebrief | null>(null);
  const [pressReactions, setPressReactions] = useState<PressReaction[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transcripts");
      if (res.ok) {
        const data = await res.json();
        setTranscripts(data.transcripts || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  if (!loaded && !loading) {
    fetchTranscripts();
  }

  const generateDebrief = async () => {
    if (!selectedTranscriptId) return;
    setGenerating(true);
    setGeneratingPhase("Analyzing transcript...");
    setDebrief(null);

    try {
      const res = await fetch("/api/postcall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_id: selectedTranscriptId }),
      });

      if (!res.ok) throw new Error("Debrief generation failed");

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
            if (event.type === "phase") setGeneratingPhase(event.phase);
            if (event.type === "debrief") setDebrief(event.data);
          } catch { /* skip */ }
        }
      }
    } catch {
      setGeneratingPhase("Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const uploadPressArticle = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.pdf,.docx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !debrief) return;
      setGenerating(true);
      setGeneratingPhase("Analyzing press article...");
      try {
        const text = await file.text();
        const res = await fetch("/api/postcall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript_id: selectedTranscriptId,
            press_article: { title: file.name, content: text, source: "manual upload" },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.press_reaction) setPressReactions((prev) => [...prev, data.press_reaction]);
        }
      } catch { /* ignore */ } finally { setGenerating(false); }
    };
    input.click();
  };

  const sentimentColors: Record<string, string> = {
    positive: "text-emerald-400 bg-emerald-400/10",
    neutral: "text-white/40 bg-white/5",
    negative: "text-red-400 bg-red-400/10",
    hostile: "text-red-500 bg-red-500/10",
  };

  const priorityColors: Record<string, string> = {
    high: "text-red-400 bg-red-400/10",
    medium: "text-amber-400 bg-amber-400/10",
    low: "text-white/40 bg-white/5",
  };

  return (
    <div className="tab-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle size={20} className="text-gold" />
        <h2 className="font-display text-xl text-white">Post-Call Debrief</h2>
      </div>

      {/* Transcript selector */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="text-xs text-white/30 font-body block mb-1">Select Transcript</label>
          <select
            value={selectedTranscriptId}
            onChange={(e) => setSelectedTranscriptId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
          >
            <option value="" className="bg-midnight">Select a transcript...</option>
            {transcripts.map((t) => (
              <option key={t.id} value={t.id} className="bg-midnight">
                {t.company} FY{t.fiscal_year} Q{t.fiscal_quarter}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={generateDebrief}
            disabled={!selectedTranscriptId || generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 disabled:opacity-30"
          >
            {generating ? <Loader2 size={14} className="spinner" /> : <Target size={14} />}
            {generating ? generatingPhase : "Generate Debrief"}
          </button>
        </div>
      </div>

      {!debrief && !generating && (
        <div className="text-center py-16">
          <MessageCircle size={40} className="mx-auto text-white/15 mb-4" />
          <h3 className="text-white/40 font-body text-lg mb-2">No Debrief Generated</h3>
          <p className="text-white/20 font-body text-sm">
            Select a transcript and generate a post-call debrief
          </p>
        </div>
      )}

      {debrief && (
        <>
          {/* View mode selector */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
            {[
              { id: "accuracy" as ViewMode, label: "Prediction Accuracy" },
              { id: "sentiment" as ViewMode, label: "Sentiment Timeline" },
              { id: "actions" as ViewMode, label: `Action Items (${debrief.action_items?.length || 0})` },
              { id: "press" as ViewMode, label: "Press Reactions" },
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

          {/* Prediction Accuracy */}
          {viewMode === "accuracy" && debrief.prediction_accuracy && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/[0.06] to-transparent border border-gold/10">
                <div className="flex items-center gap-6">
                  <div className="text-4xl font-mono font-bold text-gold">
                    {debrief.prediction_accuracy.accuracy_pct.toFixed(0)}%
                  </div>
                  <div>
                    <p className="text-white/60 text-sm font-body">Prediction Accuracy</p>
                    <p className="text-white/30 text-xs font-body">
                      {debrief.prediction_accuracy.matched} of {debrief.prediction_accuracy.total_predicted} predicted questions were asked
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {debrief.prediction_accuracy.predictions.map((p, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${
                    p.was_asked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.02] border-white/5"
                  }`}>
                    <div className="flex items-start gap-3">
                      {p.was_asked ? (
                        <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-white/20 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-white/80 text-sm font-body mb-1">{p.predicted_question}</p>
                        {p.actual_match && (
                          <p className="text-emerald-400/60 text-xs font-body italic mb-1">
                            Actual: &quot;{p.actual_match}&quot;
                          </p>
                        )}
                        <p className="text-white/30 text-xs font-body">{p.accuracy_notes}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentiment Timeline */}
          {viewMode === "sentiment" && debrief.sentiment_timeline && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/[0.06] to-transparent border border-blue-500/10">
                <h3 className="text-xs uppercase tracking-widest text-blue-400/60 font-body font-semibold mb-3">
                  Overall Assessment
                </h3>
                <p className="text-white/80 font-body leading-relaxed text-[15px]">
                  {debrief.overall_assessment}
                </p>
              </div>

              <div className="space-y-3">
                {debrief.sentiment_timeline.map((exchange, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-body text-sm font-medium">{exchange.speaker}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${sentimentColors[exchange.sentiment]}`}>
                        {exchange.sentiment.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm font-body mb-1">{exchange.question_summary}</p>
                    {exchange.key_concern && (
                      <p className="text-amber-400/60 text-xs font-body mt-2">
                        Key concern: {exchange.key_concern}
                      </p>
                    )}
                    <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          exchange.score > 0.3 ? "bg-emerald-400" :
                          exchange.score < -0.3 ? "bg-red-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.abs(exchange.score) * 100}%`, marginLeft: exchange.score < 0 ? "auto" : 0 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {viewMode === "actions" && debrief.action_items && (
            <div className="space-y-3">
              {debrief.action_items.length === 0 ? (
                <div className="text-center py-16 text-white/20 font-body text-sm">
                  No action items extracted
                </div>
              ) : (
                debrief.action_items.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => {
                        setDebrief((prev) => {
                          if (!prev) return prev;
                          const updated = { ...prev };
                          updated.action_items = [...updated.action_items];
                          updated.action_items[i] = { ...updated.action_items[i], completed: !item.completed };
                          return updated;
                        });
                      }}
                      className="mt-1 shrink-0 accent-gold"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${priorityColors[item.priority]}`}>
                          {item.priority}
                        </span>
                        <span className="text-white/30 text-xs font-body">{item.speaker}</span>
                        {item.deadline && <span className="text-white/20 text-xs font-body">Due: {item.deadline}</span>}
                      </div>
                      <p className={`text-sm font-body ${item.completed ? "text-white/30 line-through" : "text-white/70"}`}>
                        {item.commitment}
                      </p>
                      <p className="text-white/20 text-xs font-body mt-1">{item.context}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Press Reactions */}
          {viewMode === "press" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={uploadPressArticle}
                  disabled={generating}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm font-body hover:text-white hover:bg-white/10"
                >
                  <Upload size={14} />
                  Upload Press Article
                </button>
              </div>

              {pressReactions.length === 0 ? (
                <div className="text-center py-16 text-white/20 font-body text-sm">
                  Upload press articles to analyze reactions to the earnings call
                </div>
              ) : (
                <div className="space-y-3">
                  {pressReactions.map((pr) => (
                    <div key={pr.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-body text-sm font-medium">{pr.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${sentimentColors[pr.sentiment]}`}>
                          {pr.sentiment.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/20 font-body mb-3">
                        <span>{pr.source}</span>
                        <span>{new Date(pr.date).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-1">
                        {pr.key_takeaways.map((t, i) => (
                          <p key={i} className="text-white/50 text-sm font-body flex items-start gap-2">
                            <span className="text-gold/40 shrink-0">-</span>
                            {t}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
