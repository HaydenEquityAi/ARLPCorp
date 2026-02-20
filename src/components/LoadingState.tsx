"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  phase: string;
}

export default function LoadingState({ phase }: LoadingStateProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 backdrop-blur-sm">
      <div className="text-center p-8 rounded-2xl bg-white/[0.03] border border-white/10 max-w-md">
        <Loader2 size={40} className="mx-auto text-gold spinner mb-4" />
        <p className="text-white/70 font-body text-lg mb-2">Analyzing Documents</p>
        <p className="text-white/40 font-body text-sm">{phase}</p>
      </div>
    </div>
  );
}
