"use client";

import { Loader2 } from "lucide-react";
import type { BriefingData } from "@/lib/types";
import BulletCard from "@/components/BulletCard";

interface FlashReportsTabProps {
  briefing: BriefingData | null;
  analyzing: boolean;
}

export default function FlashReportsTab({ briefing, analyzing }: FlashReportsTabProps) {
  if (!briefing && analyzing) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-gold spinner mb-4" />
          <p className="text-white/40 font-body">Generating flash report...</p>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="tab-fade-in">
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
  );
}
