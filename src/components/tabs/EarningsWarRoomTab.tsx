"use client";

import { useState, useCallback } from "react";
import { Mic, Upload, Search, GitCompare, Eye, Loader2, FileText, Trash2, Calendar } from "lucide-react";
import type { EarningsTranscript } from "@/lib/types";
import ChatInterface from "@/components/ChatInterface";

type Mode = "search" | "compare" | "browse";

export default function EarningsWarRoomTab() {
  const [transcripts, setTranscripts] = useState<EarningsTranscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ company: "ARLP", fiscal_year: new Date().getFullYear(), fiscal_quarter: 1 });
  const [selectedTranscript, setSelectedTranscript] = useState<EarningsTranscript | null>(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

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

  // Load on first render
  if (!loaded && !loading) {
    fetchTranscripts();
  }

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: uploadForm.company,
          fiscal_year: uploadForm.fiscal_year,
          fiscal_quarter: uploadForm.fiscal_quarter,
          raw_text: text,
          source: file.name,
        }),
      });
      if (res.ok) {
        await fetchTranscripts();
      }
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  };

  const deleteTranscript = async (id: string) => {
    try {
      await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      if (selectedTranscript?.id === id) setSelectedTranscript(null);
    } catch { /* ignore */ }
  };

  const runComparison = async () => {
    if (!compareA || !compareB || compareA === compareB) return;
    setComparing(true);
    setCompareResult(null);
    try {
      const res = await fetch("/api/transcripts/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_a_id: compareA, transcript_b_id: compareB }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
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
            if (event.type === "answer" || event.type === "chunk") {
              result = event.type === "answer" ? event.content : result + event.content;
              setCompareResult(result);
            }
          } catch { /* skip */ }
        }
      }
    } catch { setCompareResult("Comparison failed. Please try again."); } finally { setComparing(false); }
  };

  const modeButtons: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "search", label: "Search", icon: <Search size={14} /> },
    { id: "compare", label: "Compare", icon: <GitCompare size={14} /> },
    { id: "browse", label: "Browse", icon: <Eye size={14} /> },
  ];

  return (
    <div className="tab-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Mic size={20} className="text-gold" />
        <h2 className="font-display text-xl text-white">Earnings Call War Room</h2>
      </div>

      <div className="flex gap-6">
        {/* Left sidebar — Transcript list */}
        <div className="w-[280px] shrink-0 space-y-4">
          {/* Upload */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-white/40 font-body font-semibold">
              Upload Transcript
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={uploadForm.fiscal_year}
                onChange={(e) => setUploadForm((f) => ({ ...f, fiscal_year: Number(e.target.value) }))}
                className="px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs font-body focus:outline-none"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y} className="bg-midnight">{y}</option>
                ))}
              </select>
              <select
                value={uploadForm.fiscal_quarter}
                onChange={(e) => setUploadForm((f) => ({ ...f, fiscal_quarter: Number(e.target.value) }))}
                className="px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs font-body focus:outline-none"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q} className="bg-midnight">Q{q}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".txt,.pdf,.docx";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleUpload(file);
                };
                input.click();
              }}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20 text-gold text-xs font-body hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
              {uploading ? "Processing..." : "Upload Transcript"}
            </button>
          </div>

          {/* Transcript list */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-white/40 font-body font-semibold">
              Transcripts ({transcripts.length})
            </h3>
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="text-gold spinner" />
              </div>
            )}
            {!loading && transcripts.length === 0 && (
              <p className="text-white/20 text-xs font-body py-4">No transcripts uploaded yet</p>
            )}
            {transcripts.map((t) => (
              <div
                key={t.id}
                onClick={() => { setSelectedTranscript(t); setMode("browse"); }}
                className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                  selectedTranscript?.id === t.id
                    ? "bg-gold/10 border-gold/20"
                    : "bg-white/[0.02] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-white/30" />
                    <span className="text-white text-xs font-medium">{t.company}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTranscript(t.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={10} className="text-red-400" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar size={10} className="text-white/20" />
                  <span className="text-white/30 text-xs">FY{t.fiscal_year} Q{t.fiscal_quarter}</span>
                  <span className="text-white/15 text-xs">· {t.word_count?.toLocaleString()} words</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* Mode selector */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
            {modeButtons.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-body font-medium transition-all ${
                  mode === m.id ? "bg-gold/20 text-gold border border-gold/20" : "text-white/40 hover:text-white/60"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Search mode */}
          {mode === "search" && (
            <div className="h-[600px]">
              {transcripts.length === 0 ? (
                <div className="text-center py-16 text-white/20 font-body text-sm">
                  Upload a transcript to start searching
                </div>
              ) : (
                <ChatInterface
                  endpoint="/api/transcripts/search"
                  placeholder="Ask about earnings transcripts... e.g., 'What did management say about capex?'"
                />
              )}
            </div>
          )}

          {/* Compare mode */}
          {mode === "compare" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-white/30 font-body block mb-1">Quarter A</label>
                  <select
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
                  >
                    <option value="" className="bg-midnight">Select transcript...</option>
                    {transcripts.map((t) => (
                      <option key={t.id} value={t.id} className="bg-midnight">
                        {t.company} FY{t.fiscal_year} Q{t.fiscal_quarter}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-white/30 font-body block mb-1">Quarter B</label>
                  <select
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
                  >
                    <option value="" className="bg-midnight">Select transcript...</option>
                    {transcripts.map((t) => (
                      <option key={t.id} value={t.id} className="bg-midnight">
                        {t.company} FY{t.fiscal_year} Q{t.fiscal_quarter}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={runComparison}
                disabled={!compareA || !compareB || compareA === compareB || comparing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 transition-colors disabled:opacity-30"
              >
                {comparing ? <Loader2 size={14} className="spinner" /> : <GitCompare size={14} />}
                {comparing ? "Comparing..." : "Compare Quarters"}
              </button>
              {compareResult && (
                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="text-xs uppercase tracking-widest text-gold/60 font-body font-semibold mb-3">
                    Quarter Comparison
                  </h3>
                  <div className="text-white/70 text-sm font-body whitespace-pre-wrap leading-relaxed">
                    {compareResult}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Browse mode */}
          {mode === "browse" && (
            <div>
              {selectedTranscript ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-body font-medium">
                      {selectedTranscript.company} — FY{selectedTranscript.fiscal_year} Q{selectedTranscript.fiscal_quarter}
                    </h3>
                    <span className="text-white/20 text-xs font-body">
                      {selectedTranscript.word_count?.toLocaleString()} words
                    </span>
                  </div>
                  <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 max-h-[600px] overflow-y-auto">
                    <pre className="text-white/60 text-sm font-body whitespace-pre-wrap leading-relaxed">
                      {selectedTranscript.raw_text}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-white/20 font-body text-sm">
                  Select a transcript from the sidebar to browse
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
