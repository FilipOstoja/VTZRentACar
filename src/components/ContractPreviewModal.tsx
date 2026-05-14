"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import type { ContractData } from "@/components/RentalContractPDF";
import SignaturePad, { type SignaturePadRef } from "@/components/SignaturePad";

interface Props {
  contractData: ContractData;
  clientEmail?: string;
  onClose: () => void;
}

async function buildPdfBlob(data: ContractData): Promise<Blob> {
  const [{ RentalContractPDF }, { pdf }] = await Promise.all([
    import("@/components/RentalContractPDF"),
    import("@react-pdf/renderer"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf(React.createElement(RentalContractPDF, { data }) as any).toBlob();
}

export default function ContractPreviewModal({ contractData, clientEmail, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const sigLessorRef = useRef<SignaturePadRef>(null);
  const sigLesseeRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    let url: string;
    buildPdfBlob(contractData).then((blob) => {
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setLoading(false);
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  const handleDownload = async (data?: ContractData) => {
    const blob = await buildPdfBlob(data ?? contractData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ugovor-${contractData.contractNumber}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handlePrint = () => {
    if (pdfUrl) window.open(pdfUrl, "_blank");
  };

  const handleSignAndSend = async () => {
    setSigning(true);
    setSendError(null);
    try {
      const signedData: ContractData = {
        ...contractData,
        signatureLessor: sigLessorRef.current?.toDataURL() ?? undefined,
        signatureLessee: sigLesseeRef.current?.toDataURL() ?? undefined,
      };

      const blob = await buildPdfBlob(signedData);

      // Update preview with signed version
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));

      if (clientEmail) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(blob);
        });

        const res = await fetch("/api/send-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: clientEmail,
            contractNumber: contractData.contractNumber,
            clientName: contractData.clientName,
            pdfBase64: base64,
          }),
        });
        if (!res.ok) throw new Error("Email nije poslan");
      }

      setSigned(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Greška pri slanju");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-ink-150 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[94vh] animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-150 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Pregled ugovora</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Br. {contractData.contractNumber} — {contractData.clientName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload()}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Preuzmi
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Štampaj
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* PDF preview */}
        <div className="flex-1 overflow-hidden bg-slate-100 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
              </svg>
              <span className="text-sm">Generiranje PDF-a...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              style={{ minHeight: 420 }}
              title="Pregled ugovora"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Greška pri učitavanju PDF-a
            </div>
          )}
        </div>

        {/* Signature section — shown only on touch/tablet */}
        {isTouch && !signed && (
          <div className="border-t border-ink-150 px-6 py-4 flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Digitalni potpisi</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { sigLessorRef.current?.clear(); sigLesseeRef.current?.clear(); }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Obriši potpise
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SignaturePad ref={sigLessorRef} label="Potpis iznajmljivača" />
              <SignaturePad ref={sigLesseeRef} label="Potpis najmoprimca" />
            </div>

            {sendError && (
              <p className="text-sm text-red-500 font-medium">{sendError}</p>
            )}

            <button
              onClick={handleSignAndSend}
              disabled={signing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-[#00256a] disabled:opacity-60 transition-colors"
            >
              {signing ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                  </svg>
                  Generiranje potpisanog ugovora...
                </>
              ) : clientEmail ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Potpiši i pošalji klijentu ({clientEmail})
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Potpiši i preuzmi
                </>
              )}
            </button>
          </div>
        )}

        {/* Signed confirmation */}
        {signed && (
          <div className="border-t border-emerald-200 bg-emerald-50 px-6 py-4 flex-shrink-0 flex items-center justify-between">
            <p className="text-sm text-emerald-700 font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Ugovor potpisan{clientEmail ? ` i poslan na ${clientEmail}` : " i spreman za preuzimanje"}
            </p>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline"
            >
              Zatvori
            </button>
          </div>
        )}

        {/* Footer bar when not touch (no signatures needed) */}
        {!isTouch && (
          <div className="border-t border-ink-150 px-6 py-3 flex-shrink-0 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              PDF ugovor je spreman. Preuzmite ili isprintajte kopiju.
            </p>
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
              Zatvori
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
