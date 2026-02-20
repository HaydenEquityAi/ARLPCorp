"use client";

import { useState, useCallback } from "react";
import { Users, Loader2, Plus, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { InstitutionalHolder, AnalystRating, ShortInterestData, SentimentScore } from "@/lib/types";
import DataTable from "@/components/DataTable";
import CsvUploader from "@/components/CsvUploader";

type ViewMode = "holdings" | "ratings" | "short" | "sentiment";

export default function InvestorIntelTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("holdings");
  const [holdings, setHoldings] = useState<InstitutionalHolder[]>([]);
  const [ratings, setRatings] = useState<AnalystRating[]>([]);
  const [shortInterest, setShortInterest] = useState<ShortInterestData[]>([]);
  const [sentiment, setSentiment] = useState<SentimentScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    analyst_name: "", firm: "", rating: "Hold" as AnalystRating["rating"],
    price_target: 0, date: new Date().toISOString().split("T")[0],
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [holdingsRes, ratingsRes, shortRes, sentimentRes] = await Promise.all([
        fetch("/api/investors/holdings"),
        fetch("/api/investors/ratings"),
        fetch("/api/investors/short-interest"),
        fetch("/api/investors/sentiment"),
      ]);
      if (holdingsRes.ok) { const d = await holdingsRes.json(); setHoldings(d.holdings || []); }
      if (ratingsRes.ok) { const d = await ratingsRes.json(); setRatings(d.ratings || []); }
      if (shortRes.ok) { const d = await shortRes.json(); setShortInterest(d.data || []); }
      if (sentimentRes.ok) { const d = await sentimentRes.json(); setSentiment(d.scores || []); }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  if (!loaded && !loading) {
    fetchAll();
  }

  const addRating = async () => {
    try {
      const res = await fetch("/api/investors/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingForm),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rating) setRatings((prev) => [data.rating, ...prev]);
        setShowRatingForm(false);
        setRatingForm({ analyst_name: "", firm: "", rating: "Hold", price_target: 0, date: new Date().toISOString().split("T")[0] });
      }
    } catch { /* ignore */ }
  };

  const importHoldings = async (rows: Record<string, string>[]) => {
    try {
      const res = await fetch("/api/investors/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: rows }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.holdings) setHoldings(data.holdings);
      }
    } catch { /* ignore */ }
  };

  const importShortInterest = async (rows: Record<string, string>[]) => {
    try {
      const res = await fetch("/api/investors/short-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rows }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) setShortInterest(data.data);
      }
    } catch { /* ignore */ }
  };

  const calculateSentiment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investors/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.score) setSentiment((prev) => [data.score, ...prev]);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const ratingColors: Record<string, string> = {
    "Strong Buy": "text-emerald-400 bg-emerald-400/10",
    "Buy": "text-emerald-300 bg-emerald-300/10",
    "Hold": "text-amber-400 bg-amber-400/10",
    "Sell": "text-red-400 bg-red-400/10",
    "Strong Sell": "text-red-500 bg-red-500/10",
  };

  return (
    <div className="tab-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Users size={20} className="text-gold" />
        <h2 className="font-display text-xl text-white">Investor Intelligence</h2>
      </div>

      {/* View mode selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/5 w-fit">
        {[
          { id: "holdings" as ViewMode, label: `Holdings (${holdings.length})` },
          { id: "ratings" as ViewMode, label: `Ratings (${ratings.length})` },
          { id: "short" as ViewMode, label: "Short Interest" },
          { id: "sentiment" as ViewMode, label: "Sentiment" },
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

      {/* Holdings */}
      {viewMode === "holdings" && !loading && (
        <div className="space-y-4">
          <CsvUploader
            onImport={importHoldings}
            columns={[
              { key: "institution_name", label: "Institution Name", required: true },
              { key: "shares_held", label: "Shares Held", required: true },
              { key: "market_value", label: "Market Value" },
              { key: "change_shares", label: "Change (Shares)" },
              { key: "change_pct", label: "Change (%)" },
              { key: "report_date", label: "Report Date" },
            ]}
            templateFileName="holdings_template.csv"
          />
          <DataTable
            data={holdings}
            keyField="id"
            emptyMessage="No holdings data. Import via CSV above."
            columns={[
              { key: "institution_name", label: "Institution", sortable: true },
              { key: "shares_held", label: "Shares", sortable: true, render: (h) => (h.shares_held as number).toLocaleString() },
              { key: "market_value", label: "Value ($M)", sortable: true, render: (h) => `$${((h.market_value as number) / 1e6).toFixed(1)}M` },
              {
                key: "change_pct", label: "Change", sortable: true,
                render: (h) => {
                  const pct = h.change_pct as number;
                  return (
                    <span className={`flex items-center gap-1 ${pct > 0 ? "text-emerald-400" : pct < 0 ? "text-red-400" : "text-white/30"}`}>
                      {pct > 0 ? <TrendingUp size={12} /> : pct < 0 ? <TrendingDown size={12} /> : null}
                      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                    </span>
                  );
                },
              },
              { key: "report_date", label: "Report Date", render: (h) => new Date(h.report_date as string).toLocaleDateString() },
            ]}
          />
        </div>
      )}

      {/* Ratings */}
      {viewMode === "ratings" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRatingForm(!showRatingForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20 text-gold text-xs font-body hover:bg-gold/20"
            >
              <Plus size={14} />
              Add Rating
            </button>
          </div>

          {showRatingForm && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-2 gap-3">
              <input
                type="text" placeholder="Analyst Name" value={ratingForm.analyst_name}
                onChange={(e) => setRatingForm((f) => ({ ...f, analyst_name: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              />
              <input
                type="text" placeholder="Firm" value={ratingForm.firm}
                onChange={(e) => setRatingForm((f) => ({ ...f, firm: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              />
              <select
                value={ratingForm.rating}
                onChange={(e) => setRatingForm((f) => ({ ...f, rating: e.target.value as AnalystRating["rating"] }))}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              >
                {["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"].map((r) => (
                  <option key={r} value={r} className="bg-midnight">{r}</option>
                ))}
              </select>
              <input
                type="number" placeholder="Price Target" value={ratingForm.price_target || ""}
                onChange={(e) => setRatingForm((f) => ({ ...f, price_target: Number(e.target.value) }))}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              />
              <input
                type="date" value={ratingForm.date}
                onChange={(e) => setRatingForm((f) => ({ ...f, date: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-body focus:outline-none"
              />
              <button
                onClick={addRating}
                className="px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30"
              >
                Save Rating
              </button>
            </div>
          )}

          {ratings.length === 0 ? (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              No analyst ratings recorded. Add manually or import via CSV.
            </div>
          ) : (
            <div className="space-y-3">
              {ratings.map((r) => (
                <div key={r.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-body text-sm font-medium">{r.analyst_name}</span>
                      <span className="text-white/30 text-xs font-body">{r.firm}</span>
                    </div>
                    <span className="text-white/20 text-xs font-body">
                      {new Date(r.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-body font-medium ${ratingColors[r.rating] || "text-white/30"}`}>
                      {r.rating}
                    </span>
                    <span className="text-white font-mono text-sm">${r.price_target}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Short Interest */}
      {viewMode === "short" && !loading && (
        <div className="space-y-4">
          <CsvUploader
            onImport={importShortInterest}
            columns={[
              { key: "settlement_date", label: "Settlement Date", required: true },
              { key: "short_interest", label: "Short Interest", required: true },
              { key: "avg_daily_volume", label: "Avg Daily Volume" },
              { key: "days_to_cover", label: "Days to Cover" },
              { key: "pct_float", label: "% of Float" },
            ]}
            templateFileName="short_interest_template.csv"
          />

          {shortInterest.length > 0 ? (
            <div className="space-y-3">
              {shortInterest.slice(0, 12).map((si) => (
                <div key={si.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-white/40 text-xs font-body">
                      {new Date(si.settlement_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-body">
                    <div className="text-center">
                      <p className="text-white/20 text-xs">Short Interest</p>
                      <p className="text-white font-mono">{si.short_interest.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/20 text-xs">Days to Cover</p>
                      <p className="text-white font-mono">{si.days_to_cover.toFixed(1)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/20 text-xs">% Float</p>
                      <p className="text-white font-mono">{si.pct_float.toFixed(1)}%</p>
                    </div>
                    <span className={`flex items-center gap-1 ${si.change_pct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {si.change_pct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {si.change_pct > 0 ? "+" : ""}{si.change_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              No short interest data. Import via CSV above.
            </div>
          )}
        </div>
      )}

      {/* Sentiment */}
      {viewMode === "sentiment" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={calculateSentiment}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/20 text-gold text-sm font-body hover:bg-gold/30"
            >
              <BarChart3 size={14} />
              Calculate Sentiment
            </button>
          </div>

          {sentiment.length > 0 ? (
            <div className="space-y-4">
              {/* Latest sentiment score */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/[0.06] to-transparent border border-gold/10">
                <h3 className="text-xs uppercase tracking-widest text-gold/60 font-body font-semibold mb-3">
                  Current Investor Sentiment
                </h3>
                <div className="flex items-center gap-6">
                  <div className={`text-4xl font-mono font-bold ${
                    sentiment[0].score > 0.2 ? "text-emerald-400" :
                    sentiment[0].score < -0.2 ? "text-red-400" : "text-amber-400"
                  }`}>
                    {sentiment[0].score > 0 ? "+" : ""}{sentiment[0].score.toFixed(2)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm font-body">{sentiment[0].rationale}</p>
                  </div>
                </div>
              </div>

              {/* Score history */}
              <div className="space-y-2">
                {sentiment.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
                    <span className="text-white/30 text-xs font-body">{new Date(s.date).toLocaleDateString()}</span>
                    <span className={`font-mono text-sm ${
                      s.score > 0.2 ? "text-emerald-400" : s.score < -0.2 ? "text-red-400" : "text-amber-400"
                    }`}>
                      {s.score > 0 ? "+" : ""}{s.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-white/20 font-body text-sm">
              Add holdings, ratings, and short interest data, then calculate sentiment
            </div>
          )}
        </div>
      )}
    </div>
  );
}
