"use client";

import type { PredictedQuestion } from "@/lib/types";

interface AnalystQuestionCardProps {
  question: PredictedQuestion;
  index: number;
}

function getDifficultyColor(d: string) {
  switch (d?.toLowerCase()) {
    case "hard": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "moderate": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default: return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
}

export default function AnalystQuestionCard({ question: q, index }: AnalystQuestionCardProps) {
  return (
    <div
      className={`p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all animate-slide-up stagger-${index + 1}`}
    >
      <div className="flex items-start gap-5">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-midnight-100 border border-white/10 flex items-center justify-center">
          <span className="text-base font-display text-white/60">Q{q.rank}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-body font-medium ${getDifficultyColor(q.difficulty)}`}>
              {q.difficulty}
            </span>
            <span className="text-white/20 text-xs font-body">{q.likely_asker_type}</span>
          </div>
          <p className="text-white font-body text-[15px] leading-relaxed mb-3 italic">
            &ldquo;{q.question}&rdquo;
          </p>
          <div className="p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10">
            <span className="text-emerald-400/60 font-body text-xs uppercase tracking-wider">
              Suggested Response
            </span>
            <p className="text-white/70 font-body text-sm mt-1 leading-relaxed">
              {q.suggested_response}
            </p>
          </div>
          <p className="text-white/30 font-body text-xs mt-3">
            Triggered by: {q.triggered_by}
          </p>
        </div>
      </div>
    </div>
  );
}
