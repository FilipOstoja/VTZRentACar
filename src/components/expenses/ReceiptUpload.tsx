"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

interface Props {
  value: File | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
}

export default function ReceiptUpload({ value, onChange, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    onChange(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "p-2 rounded-lg border transition-colors",
            value
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
          )}
          title={value ? value.name : "Dodaj sliku računa"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="text-xs text-slate-400 hover:text-red-500"
            title="Ukloni sliku"
          >
            ✕
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
        Slika računa (opcionalno)
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      {preview ? (
        <div className="relative w-full rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="w-full max-h-48 object-contain" />
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 rounded-full w-7 h-7 flex items-center justify-center shadow-sm transition-colors"
            title="Ukloni sliku"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-200 rounded-lg py-6 px-4 text-slate-500 hover:border-[#003580] hover:bg-blue-50/30 transition-colors flex flex-col items-center gap-2"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span className="text-xs font-semibold">Dodaj sliku računa</span>
          <span className="text-[10px] text-slate-400">JPG, PNG, HEIC</span>
        </button>
      )}
    </div>
  );
}
