"use client";

import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Target,
  MessageSquare,
  TrendingUp,
  Clock,
} from "lucide-react";
import type { BriefingData, ActiveTab } from "@/lib/types";

interface HeaderProps {
  briefing?: BriefingData | null;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onCopy: () => void;
  onNewAnalysis: () => void;
  copied: boolean;
  hasQuestions: boolean;
  hasTrends: boolean;
}

export default function Header({
  briefing,
  activeTab,
  onTabChange,
  onCopy,
  onNewAnalysis,
  copied,
  hasQuestions,
  hasTrends,
}: HeaderProps) {
  if (!briefing) {
    return (
      <header className="border-b border-white/5 bg-gradient-to-r from-gold/[0.03] to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Sparkles size={20} className="text-gold" />
            </div>
            <div>
              <h1 className="font-display text-xl text-white tracking-tight">
                Executive Intelligence Briefing
              </h1>
              <p className="text-xs text-white/40 tracking-widest uppercase font-body mt-0.5">
                Alliance Resource Partners · AI Materiality Analysis
              </p>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const tabs = [
    { id: "briefing" as ActiveTab, label: "Materiality Briefing", icon: <Target size={15} /> },
    { id: "questions" as ActiveTab, label: "Analyst Questions", icon: <MessageSquare size={15} />, disabled: !hasQuestions },
    { id: "trends" as ActiveTab, label: "Trend Comparison", icon: <TrendingUp size={15} />, disabled: !hasTrends },
    { id: "history" as ActiveTab, label: "History", icon: <Clock size={15} /> },
  ];

  return (
    <header className="border-b border-white/5 bg-gradient-to-r from-gold/[0.03] to-transparent sticky top-0 z-20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Sparkles size={18} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-lg text-white tracking-tight">
              {briefing.briefing_title || "Executive Briefing"}
            </h1>
            <p className="text-xs text-white/30 font-body">
              {briefing.document_count} documents · Generated{" "}
              {new Date(briefing.generated_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-body"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onNewAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-body"
          >
            <RefreshCw size={14} />
            New Analysis
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-body font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-gold text-gold"
                : tab.disabled
                ? "border-transparent text-white/20 cursor-not-allowed"
                : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
