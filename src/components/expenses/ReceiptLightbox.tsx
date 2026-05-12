"use client";

import { useEffect } from "react";

interface Props {
  url: string | null;
  onClose: () => void;
}

export default function ReceiptLightbox({ url, onClose }: Props) {
  useEffect(() => {
    if (!url) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 cursor-zoom-out"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Receipt"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
