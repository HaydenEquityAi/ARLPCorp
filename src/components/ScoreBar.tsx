"use client";

interface ScoreBarProps {
  score: number;
}

export default function ScoreBar({ score }: ScoreBarProps) {
  const scoreColor = score >= 8 ? "text-red-400" : score >= 6 ? "text-amber-400" : "text-emerald-400";
  const barColor = score >= 8 ? "bg-red-500" : score >= 6 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-mono font-semibold ${scoreColor}`}>
        {score}/10
      </span>
      <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full score-bar-fill ${barColor}`}
          style={{ "--fill-width": `${score * 10}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
