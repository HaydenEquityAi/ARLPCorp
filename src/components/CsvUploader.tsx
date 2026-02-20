"use client";

import { useState, useCallback } from "react";
import { Upload, Download, Check, AlertTriangle, X } from "lucide-react";

interface CsvUploaderProps {
  onImport: (rows: Record<string, string>[]) => void;
  columns: { key: string; label: string; required?: boolean }[];
  templateFileName?: string;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });

  return { headers, rows };
}

export default function CsvUploader({ onImport, columns, templateFileName = "template.csv" }: CsvUploaderProps) {
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    (file: File) => {
      setError("");
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers: h, rows } = parseCSV(text);
        if (rows.length === 0) {
          setError("CSV file is empty or has no data rows");
          return;
        }
        const missing = columns
          .filter((c) => c.required)
          .filter((c) => !h.includes(c.key))
          .map((c) => c.label);
        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(", ")}`);
          return;
        }
        setHeaders(h);
        setPreview(rows.slice(0, 5));
      };
      reader.readAsText(file);
    },
    [columns]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) handleFile(file);
      else setError("Please upload a .csv file");
    },
    [handleFile]
  );

  const downloadTemplate = () => {
    const csv = columns.map((c) => c.key).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmImport = () => {
    if (!preview) return;
    // Re-parse full file — preview was just first 5 rows
    onImport(preview);
    setPreview(null);
    setHeaders([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs font-body"
        >
          <Download size={14} />
          Download Template CSV
        </button>
      </div>

      {!preview && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-gold/20 transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
        >
          <Upload size={24} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm font-body">Drop CSV file here or click to browse</p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-300 text-xs font-body">{error}</p>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs font-body">Preview (first {preview.length} rows)</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setPreview(null); setHeaders([]); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white text-xs font-body"
              >
                <X size={12} />
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/30 text-gold text-xs font-body"
              >
                <Check size={12} />
                Import {preview.length} rows
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="border-b border-white/5">
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-white/50">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
