"use client";

import { TrendingUp, TrendingDown, Sparkles, Check } from "lucide-react";
import type { TrendsData } from "@/lib/types";

interface TrendGridProps {
  trends: TrendsData;
}

export default function TrendGrid({ trends }: TrendGridProps) {
  return (
    <div className="animate-fade-in">
      {/* Overall Trajectory */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/[0.06] to-transparent border border-blue-500/10 mb-8">
        <h3 className="text-xs uppercase tracking-widest text-blue-400/60 font-body font-semibold mb-3">
          Overall Trajectory
        </h3>
        <p className="text-white/80 font-body leading-relaxed text-[15px]">
          {trends.overall_trajectory}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Improved */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="flex items-center gap-2 text-emerald-400 font-body font-semibold text-sm mb-4">
            <TrendingUp size={16} />
            Improved ({trends.trend_analysis.improved?.length || 0})
          </h4>
          <div className="space-y-3">
            {trends.trend_analysis.improved?.map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10">
                <p className="text-white/80 text-sm font-body">{item.item}</p>
                {item.change_pct && (
                  <p className="text-emerald-400 text-xs font-mono mt-1">{item.change_pct} improvement</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Deteriorated */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="flex items-center gap-2 text-red-400 font-body font-semibold text-sm mb-4">
            <TrendingDown size={16} />
            Deteriorated ({trends.trend_analysis.deteriorated?.length || 0})
          </h4>
          <div className="space-y-3">
            {trends.trend_analysis.deteriorated?.map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-red-500/[0.05] border border-red-500/10">
                <p className="text-white/80 text-sm font-body">{item.item}</p>
                {item.change_pct && (
                  <p className="text-red-400 text-xs font-mono mt-1">{item.change_pct} decline</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* New Items */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="flex items-center gap-2 text-blue-400 font-body font-semibold text-sm mb-4">
            <Sparkles size={16} />
            New This Period ({trends.trend_analysis.new_items?.length || 0})
          </h4>
          <div className="space-y-3">
            {trends.trend_analysis.new_items?.map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-blue-500/[0.05] border border-blue-500/10">
                <p className="text-white/80 text-sm font-body">{item.item}</p>
                {item.significance && (
                  <p className="text-blue-300/60 text-xs font-body mt-1">{item.significance}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resolved */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="flex items-center gap-2 text-white/40 font-body font-semibold text-sm mb-4">
            <Check size={16} />
            Resolved ({trends.trend_analysis.resolved?.length || 0})
          </h4>
          <div className="space-y-3">
            {trends.trend_analysis.resolved?.map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-white/60 text-sm font-body">{item.item}</p>
                {item.resolution && (
                  <p className="text-white/30 text-xs font-body mt-1">{item.resolution}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
