"use client";

import { useState, useCallback } from "react";
import { FileSearch, Download, Loader2, AlertTriangle, GitCompare, Shield } from "lucide-react";
import type { SecFiling, RiskFactor } from "@/lib/types";
import ScoreBar from "@/components/ScoreBar";

type ViewMode = "timeline" | "risks" | "compare";

export default function SecFilingsTab() {
  const [filings, setFilings] = useState<SecFiling[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [filingTypeFilter, setFilingTypeFilter] = useState<string>("all");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const fetchFilings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sec/filings");
      if (res.ok) {
        const data = await res.json();
        setFilings(data.filings || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  const fetchRiskFactors = useCallback(async () => {
    try {
      const res = await fetch("/api/sec/risk-factors");
      if (res.ok) {
        const data = await res.json();
        setRiskFactors(data.risk_factors || []);
      }
    } catch { /* ignore */ }
  }, []);

  if (!loaded && !loading) {
    fetchFilings();
    fetchRiskFactors();
  }

  const triggerEdgarFetch = async () => {
    setFetching(true);
    setFetchProgress("Connecting to SEC EDGAR...");
    try {
      const res = await fetch("/api/sec/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filing_types: ["10-K", "10-Q"] }),
      });
      if (!res.ok) throw new Error("EDGAR fetch failed");
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
            if (event.type === "phase") setFetchProgress(event.phase);
            if (event.type === "done") { await fetchFilings(); await fetchRiskFactors(); }
          } catch { /* skip */ }
        }
      }
    } catch {
      setFetchProgress("Fetch failed. Check API configuration.");
    } finally {
      setFetching(false);
    }
  };

  const runComparison = async () => {
    if (!compareA || !compareB || compareA === compareB) return;
    setComparing(true);
    setCompareResult(null);
    try {
      const res = await fetch("/api/sec/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filing_a_id: compareA, filing_b_id: compareB }),
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
            if (event.type === "answer") { result = event.content; setCompareResult(result); }
            if (event.type === "chunk") { result += event.content; setCompareResult(result); }
          } catch { /* skip */ }
        }
      }
    } catch { setCompareResult("Comparison failed."); } finally { setComparing(false); }
  };

  const filteredFilings = filingTypeFilter === "all"
    ? filings
    : filings.filter((f) => f.filing_type === filingTypeFilter);

  const statusColors: Record<string, string> = {
    new: "text-emerald-400 bg-emerald-400/10",
    modified: "text-amber-400 bg-amber-400/10",
    unchanged: "text-white/30 bg-white/5",
    removed: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="tab-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileSearch size={20} className="text-gold" />
          <h2 className="font-display text-xl text-white">SEC Filing Intelligence</h2>
        </div>
        <button
          onClick={triggerEdgarFetch}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 transition-colors disabled:opacity-50"
        >
          {fetching ? <Loader2 size={14} className="spinner" /> : <Download size={14} />}
          {fetching ? fetchProgress : "Fetch from EDGAR"}
        </button>
      </div>

      {/* View mode selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
        {[
          { id: "timeline" as ViewMode, label: "Filing Timeline" },
          { id: "risks" as ViewMode, label: "Risk Tracker" },
          { id: "compare" as ViewMode, label: "Compare" },
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

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="text-gold spinner" />
        </div>
      )}

      {/* Timeline view */}
      {viewMode === "timeline" && !loading && (
        <div>
          <div className="flex gap-2 mb-4">
            {["all", "10-K", "10-Q", "8-K"].map((ft) => (
              <button
                key={ft}
                onClick={() => setFilingTypeFilter(ft)}
                className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${
                  filingTypeFilter === ft
                    ? "bg-gold/20 text-gold border border-gold/20"
                    : "bg-white/5 text-white/30 border border-white/5 hover:text-white/50"
                }`}
              >
                {ft === "all" ? "All" : ft}
              </button>
            ))}
          </div>

          {filteredFilings.length === 0 ? (
            <div className="text-center py-16">
              <FileSearch size={40} className="mx-auto text-white/15 mb-4" />
              <h3 className="text-white/40 font-body text-lg mb-2">No Filings Found</h3>
              <p className="text-white/20 font-body text-sm">Click &quot;Fetch from EDGAR&quot; to pull ARLP filings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFilings.map((f) => (
                <div key={f.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-gold/10 text-gold">
                        {f.filing_type}
                      </span>
                      <span className="text-white font-body text-sm font-medium">{f.company_name}</span>
                    </div>
                    <span className="text-white/20 text-xs font-body">
                      {new Date(f.filing_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-white/30 text-xs font-mono">{f.accession_number}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk tracker view */}
      {viewMode === "risks" && !loading && (
        <div>
          {riskFactors.length === 0 ? (
            <div className="text-center py-16">
              <Shield size={40} className="mx-auto text-white/15 mb-4" />
              <h3 className="text-white/40 font-body text-lg mb-2">No Risk Factors Tracked</h3>
              <p className="text-white/20 font-body text-sm">Fetch filings from EDGAR to extract and track risk factors</p>
            </div>
          ) : (
            <div className="space-y-3">
              {riskFactors.map((rf) => (
                <div key={rf.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${statusColors[rf.status]}`}>
                        {rf.status.toUpperCase()}
                      </span>
                      <span className="text-white/40 text-xs font-body">{rf.category}</span>
                    </div>
                    <ScoreBar score={rf.severity_score} />
                  </div>
                  <h4 className="text-white font-body text-sm font-medium mb-1">{rf.title}</h4>
                  <p className="text-white/40 text-xs font-body line-clamp-2">{rf.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare view */}
      {viewMode === "compare" && !loading && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-white/30 font-body block mb-1">Filing A</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              >
                <option value="" className="bg-midnight">Select filing...</option>
                {filings.map((f) => (
                  <option key={f.id} value={f.id} className="bg-midnight">
                    {f.filing_type} — {new Date(f.filing_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/30 font-body block mb-1">Filing B</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              >
                <option value="" className="bg-midnight">Select filing...</option>
                {filings.map((f) => (
                  <option key={f.id} value={f.id} className="bg-midnight">
                    {f.filing_type} — {new Date(f.filing_date).toLocaleDateString()}
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
            {comparing ? "Comparing..." : "Compare Filings"}
          </button>
          {compareResult && (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="text-white/70 text-sm font-body whitespace-pre-wrap leading-relaxed">
                {compareResult}
              </div>
            </div>
          )}
          {!compareResult && !comparing && (
            <div className="text-center py-12">
              <AlertTriangle size={24} className="mx-auto text-white/15 mb-3" />
              <p className="text-white/20 text-sm font-body">Select two filings to compare risk factors and key changes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
