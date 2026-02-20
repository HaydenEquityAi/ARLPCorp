"use client";

import { useState, useCallback } from "react";
import { Activity, Loader2, RefreshCw, Upload, TrendingUp, TrendingDown, Sun } from "lucide-react";
import type { EnergyPrice, RegulatoryItem, MorningBriefing } from "@/lib/types";
import ScoreBar from "@/components/ScoreBar";

type ViewMode = "prices" | "regulatory" | "briefing";

export default function MarketPulseTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("prices");
  const [prices, setPrices] = useState<EnergyPrice[]>([]);
  const [regulatory, setRegulatory] = useState<RegulatoryItem[]>([]);
  const [morningBriefing, setMorningBriefing] = useState<MorningBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pricesRes, regRes, briefRes] = await Promise.all([
        fetch("/api/market/prices"),
        fetch("/api/market/regulatory"),
        fetch("/api/market/morning-briefing"),
      ]);
      if (pricesRes.ok) { const d = await pricesRes.json(); setPrices(d.prices || []); }
      if (regRes.ok) { const d = await regRes.json(); setRegulatory(d.items || []); }
      if (briefRes.ok) { const d = await briefRes.json(); setMorningBriefing(d.briefing || null); }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  if (!loaded && !loading) {
    fetchAll();
  }

  const fetchEiaPrices = async () => {
    setFetchingPrices(true);
    try {
      const res = await fetch("/api/market/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prices) setPrices(data.prices);
      }
    } catch { /* ignore */ } finally { setFetchingPrices(false); }
  };

  const uploadRegulatory = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.pdf,.docx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const text = await file.text();
        const res = await fetch("/api/market/regulatory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.name, content: text, source: "manual upload" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.item) setRegulatory((prev) => [data.item, ...prev]);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    input.click();
  };

  const generateMorningBriefing = async () => {
    setGeneratingBriefing(true);
    try {
      const res = await fetch("/api/market/morning-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.briefing) setMorningBriefing(data.briefing);
      }
    } catch { /* ignore */ } finally { setGeneratingBriefing(false); }
  };

  // Group prices by series for display
  const coalPrices = prices.filter((p) => p.series_name?.toLowerCase().includes("coal") || p.series_id?.includes("coal"));
  const gasPrices = prices.filter((p) => p.series_name?.toLowerCase().includes("gas") || p.series_id?.includes("gas"));
  const otherPrices = prices.filter((p) => !coalPrices.includes(p) && !gasPrices.includes(p));

  const renderPriceGroup = (title: string, data: EnergyPrice[]) => {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    const previous = sorted[1];
    const change = previous ? ((latest.value - previous.value) / previous.value) * 100 : 0;

    return (
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-body text-sm font-medium">{title}</h4>
          <span className={`flex items-center gap-1 text-sm font-mono ${
            change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-white/30"
          }`}>
            {change > 0 ? <TrendingUp size={14} /> : change < 0 ? <TrendingDown size={14} /> : null}
            {change > 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
        </div>
        <div className="text-2xl font-mono text-white mb-1">
          ${latest.value.toFixed(2)}
          <span className="text-white/20 text-sm ml-1">/{latest.unit}</span>
        </div>
        <p className="text-white/20 text-xs font-body">
          {new Date(latest.date).toLocaleDateString()} · {latest.series_name}
        </p>

        {/* Simple sparkline-style list of recent values */}
        <div className="mt-4 space-y-1">
          {sorted.slice(0, 8).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-body">
              <span className="text-white/20">{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span className="text-white/40 font-mono">${p.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="tab-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Activity size={20} className="text-gold" />
        <h2 className="font-display text-xl text-white">Market Pulse</h2>
      </div>

      {/* View mode selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
        {[
          { id: "prices" as ViewMode, label: "Energy Prices" },
          { id: "regulatory" as ViewMode, label: `Regulatory (${regulatory.length})` },
          { id: "briefing" as ViewMode, label: "Morning Briefing" },
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

      {/* Prices view */}
      {viewMode === "prices" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={fetchEiaPrices}
              disabled={fetchingPrices}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 disabled:opacity-50"
            >
              {fetchingPrices ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
              {fetchingPrices ? "Fetching..." : "Fetch EIA Prices"}
            </button>
          </div>

          {prices.length === 0 ? (
            <div className="text-center py-16">
              <Activity size={40} className="mx-auto text-white/15 mb-4" />
              <h3 className="text-white/40 font-body text-lg mb-2">No Price Data</h3>
              <p className="text-white/20 font-body text-sm">Click &quot;Fetch EIA Prices&quot; to pull coal and natural gas prices</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderPriceGroup("Coal", coalPrices)}
              {renderPriceGroup("Natural Gas", gasPrices)}
              {otherPrices.length > 0 && renderPriceGroup("Other", otherPrices)}
            </div>
          )}
        </div>
      )}

      {/* Regulatory view */}
      {viewMode === "regulatory" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={uploadRegulatory}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm font-body hover:text-white hover:bg-white/10"
            >
              <Upload size={14} />
              Upload Article
            </button>
          </div>

          {regulatory.length === 0 ? (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              Upload regulatory news articles for ARLP impact analysis
            </div>
          ) : (
            <div className="space-y-3">
              {regulatory.map((item) => (
                <div key={item.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-body ${
                        item.category === "regulatory" ? "bg-blue-500/10 text-blue-400" :
                        item.category === "esg" ? "bg-emerald-500/10 text-emerald-400" :
                        item.category === "policy" ? "bg-amber-500/10 text-amber-400" :
                        "bg-white/5 text-white/40"
                      }`}>
                        {item.category.toUpperCase()}
                      </span>
                      <span className="text-white font-body text-sm font-medium">{item.title}</span>
                    </div>
                    <ScoreBar score={item.impact_score} />
                  </div>
                  <p className="text-white/50 text-sm font-body mb-2">{item.impact_analysis}</p>
                  <div className="flex items-center gap-3 text-xs text-white/20 font-body">
                    <span>{item.source}</span>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Morning Briefing view */}
      {viewMode === "briefing" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={generateMorningBriefing}
              disabled={generatingBriefing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30 disabled:opacity-50"
            >
              {generatingBriefing ? <Loader2 size={14} className="spinner" /> : <Sun size={14} />}
              {generatingBriefing ? "Generating..." : "Generate Today's Briefing"}
            </button>
          </div>

          {morningBriefing ? (
            <div className="p-8 rounded-2xl bg-gradient-to-br from-gold/[0.06] to-transparent border border-gold/10">
              <div className="flex items-center gap-3 mb-4">
                <Sun size={20} className="text-gold" />
                <h3 className="font-display text-lg text-white">
                  Morning Briefing — {new Date(morningBriefing.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
              </div>

              {morningBriefing.key_metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {morningBriefing.key_metrics.coal_price != null && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-white/20 text-xs font-body">Coal</p>
                      <p className="text-white font-mono text-lg">${morningBriefing.key_metrics.coal_price.toFixed(2)}</p>
                      {morningBriefing.key_metrics.coal_change_pct != null && (
                        <span className={`text-xs font-mono ${morningBriefing.key_metrics.coal_change_pct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {morningBriefing.key_metrics.coal_change_pct > 0 ? "+" : ""}
                          {morningBriefing.key_metrics.coal_change_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  {morningBriefing.key_metrics.gas_price != null && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-white/20 text-xs font-body">Natural Gas</p>
                      <p className="text-white font-mono text-lg">${morningBriefing.key_metrics.gas_price.toFixed(2)}</p>
                      {morningBriefing.key_metrics.gas_change_pct != null && (
                        <span className={`text-xs font-mono ${morningBriefing.key_metrics.gas_change_pct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {morningBriefing.key_metrics.gas_change_pct > 0 ? "+" : ""}
                          {morningBriefing.key_metrics.gas_change_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="text-white/80 font-body leading-relaxed text-[15px] whitespace-pre-wrap">
                {morningBriefing.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Sun size={40} className="mx-auto text-white/15 mb-4" />
              <h3 className="text-white/40 font-body text-lg mb-2">No Morning Briefing</h3>
              <p className="text-white/20 font-body text-sm">Click &quot;Generate Today&apos;s Briefing&quot; to create a daily intelligence summary</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
