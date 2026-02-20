"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onUpload: (files: FileList | File[]) => Promise<void>;
  uploading: boolean;
}

export default function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
    },
    [onUpload]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
        dragActive
          ? "border-gold bg-gold/[0.06] scale-[1.01]"
          : "border-white/10 hover:border-white/20 bg-white/[0.02]"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.html,.xml"
        className="hidden"
        onChange={(e) => e.target.files && onUpload(e.target.files)}
      />
      {uploading ? (
        <Loader2 size={40} className="mx-auto text-gold spinner mb-4" />
      ) : (
        <Upload size={40} className="mx-auto text-white/30 mb-4" />
      )}
      <p className="text-white/70 font-body text-lg mb-2">
        {dragActive ? "Drop files here" : uploading ? "Parsing documents..." : "Drop files or click to upload"}
      </p>
      <p className="text-white/30 font-body text-sm">
        PDF, Word (.docx), TXT, CSV, and more
      </p>
    </div>
  );
}
