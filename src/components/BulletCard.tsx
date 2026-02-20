"use client";

import { AlertTriangle, BarChart3, Target, Shield, Zap, Sparkles } from "lucide-react";
import type { BulletPoint } from "@/lib/types";
import ScoreBar from "./ScoreBar";

interface BulletCardProps {
  bullet: BulletPoint;
  index: number;
}

function getCategoryIcon(cat: string) {
  switch (cat?.toLowerCase()) {
    case "financial": return <BarChart3 size={16} className="text-emerald-400" />;
    case "strategic": return <Target size={16} className="text-blue-400" />;
    case "risk": return <Shield size={16} className="text-red-400" />;
    case "operational": return <Zap size={16} className="text-amber-400" />;
    default: return <Sparkles size={16} className="text-gold" />;
  }
}

export default function BulletCard({ bullet, index }: BulletCardProps) {
  return (
    <div
      className={`p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all animate-slide-up stagger-${index + 1}`}
    >
      <div className="flex items-start gap-5">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-midnight-100 border border-white/10 flex flex-col items-center justify-center">
          <span className="text-lg font-display text-white">#{bullet.rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-xs font-body font-medium text-white/60">
              {getCategoryIcon(bullet.category)}
              {bullet.category}
            </span>
            <ScoreBar score={bullet.materiality_score} />
            {bullet.action_needed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-body">
                <AlertTriangle size={10} />
                Action Needed
              </span>
            )}
          </div>

          <p className="text-white text-[15px] font-body leading-relaxed mb-3">
            {bullet.finding}
          </p>

          <div className="flex items-start gap-6 text-sm">
            <div className="flex-1">
              <span className="text-gold/60 font-body text-xs uppercase tracking-wider">So What:</span>
              <p className="text-white/50 font-body mt-0.5">{bullet.so_what}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-white/20 font-body text-xs uppercase tracking-wider">Source</span>
              <p className="text-white/40 font-mono text-xs mt-0.5">{bullet.source_document}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
