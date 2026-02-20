"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { BriefingData, QuestionsData } from "@/lib/types";

interface ExportButtonProps {
  briefing: BriefingData;
  questions?: QuestionsData | null;
}

export default function ExportButton({ briefing, questions }: ExportButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const lines = [
      briefing.briefing_title,
      `Generated: ${new Date(briefing.generated_at).toLocaleDateString()}`,
      "",
      "EXECUTIVE SUMMARY",
      briefing.executive_summary,
      "",
      "MATERIALITY FINDINGS",
      ...briefing.bullets.map(
        (b) =>
          `#${b.rank} [Score: ${b.materiality_score}/10] [${b.category}]${b.action_needed ? " [ACTION NEEDED]" : ""}\n${b.finding}\nSource: ${b.source_document}\nSo What: ${b.so_what}\n`
      ),
    ];

    if (questions) {
      lines.push(
        "",
        "PREDICTED ANALYST QUESTIONS",
        ...questions.predicted_questions.map(
          (q) =>
            `Q${q.rank} [${q.difficulty}] ${q.question}\nSuggested Response: ${q.suggested_response}\n`
        )
      );
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-body"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
