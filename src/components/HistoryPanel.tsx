"use client";

import { useState, useEffect } from "react";
import { Clock, FileText, Loader2 } from "lucide-react";
import type { BriefingListItem } from "@/lib/types";
import SidePanel from "./SidePanel";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (briefingId: string) => void;
}

export default function HistoryPanel({ open, onClose, onSelect }: HistoryPanelProps) {
  const [briefings, setBriefings] = useState<BriefingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    async function fetchBriefings() {
      try {
        const res = await fetch("/api/briefings");
        if (res.ok) {
          const data = await res.json();
          setBriefings(data.briefings || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchBriefings();
  }, [open]);

  return (
    <SidePanel open={open} onClose={onClose} title="Briefing History">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-gold spinner" />
        </div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={40} className="mx-auto text-white/15 mb-4" />
          <h3 className="text-white/40 font-body text-lg mb-2">No Previous Briefings</h3>
          <p className="text-white/20 font-body text-sm max-w-md mx-auto">
            Your briefing history will appear here after you generate your first analysis.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-body font-semibold mb-4">
            Past Briefings ({briefings.length})
          </h3>
          <div className="grid gap-3">
            {briefings.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  onSelect(b.id);
                  onClose();
                }}
                className="w-full text-left p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-gold/20 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white font-body font-medium text-sm group-hover:text-gold transition-colors">
                    {b.title}
                  </h4>
                  <span className="text-white/20 text-xs font-body shrink-0 ml-4">
                    {new Date(b.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-white/40 text-sm font-body line-clamp-2 mb-3">
                  {b.executive_summary || "No summary available"}
                </p>
                <div className="flex items-center gap-4 text-xs text-white/20 font-body">
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    {b.document_count} docs
                  </span>
                  <span>{b.bullet_count} findings</span>
                  {b.avg_score > 0 && (
                    <span className="font-mono">avg score: {b.avg_score.toFixed(1)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
