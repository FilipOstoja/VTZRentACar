"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";

export interface SignaturePadRef {
  clear: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
}

interface Props {
  label?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, Props>(({ label }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    setEmpty(false);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => { drawing.current = false; };

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
    },
    toDataURL: () => {
      if (empty) return null;
      return canvasRef.current?.toDataURL("image/png") ?? null;
    },
    isEmpty: () => empty,
  }));

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      )}
      <div className="relative border-2 border-dashed border-slate-200 rounded-xl bg-white overflow-hidden" style={{ height: 110 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        {empty && (
          <span className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="text-[11px] text-slate-300">Potpišite ovdje</span>
          </span>
        )}
      </div>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";
export default SignaturePad;
