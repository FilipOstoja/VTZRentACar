"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Camera, ChevronLeft, ChevronRight, X, Check, Trash2 } from "lucide-react";
import type { Damage3DPin } from "./Car3DInspector";

const Car3DInspector = dynamic(
  () => import("./Car3DInspector").then((m) => m.Car3DInspector),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[380px] rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 text-sm">
        Učitavanje 3D modela...
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type CarView = "front" | "left" | "rear" | "right" | "top";
const VIEWS: CarView[] = ["front", "left", "rear", "right", "top"];
const VIEW_LABELS: Record<CarView, string> = {
  front: "Prednja",
  left: "Lijeva",
  rear: "Zadnja",
  right: "Desna",
  top: "Krov",
};

export interface DamagePin {
  id: string;
  view: CarView;
  x: number;
  y: number;
  zone: string;
  note: string;
  photo?: string;
}

type Zone = { id: string; label: string; x: number; y: number; w: number; h: number };

// ─── Zone definitions (400 × 220 SVG space) ──────────────────────────────────
const ZONES: Record<CarView, Zone[]> = {
  front: [
    { id: "roof",      label: "Krov",           x: 145, y: 10,  w: 110, h: 26 },
    { id: "windshield",label: "Vjetrobran",      x: 109, y: 36,  w: 182, h: 68 },
    { id: "hood",      label: "Hauba",           x: 135, y: 104, w: 130, h: 64 },
    { id: "hl-l",      label: "Farovi lijevi",   x: 65,  y: 104, w: 68,  h: 64 },
    { id: "hl-r",      label: "Farovi desni",    x: 267, y: 104, w: 68,  h: 64 },
    { id: "bumper-f",  label: "Branik prednji",  x: 54,  y: 168, w: 292, h: 47 },
    { id: "wheel-fl",  label: "Točak PL",        x: 28,  y: 172, w: 54,  h: 43 },
    { id: "wheel-fr",  label: "Točak PD",        x: 318, y: 172, w: 54,  h: 43 },
  ],
  left: [
    { id: "hood-l",    label: "Hauba",           x: 276, y: 66,  w: 104, h: 68 },
    { id: "roof-l",    label: "Krov",            x: 152, y: 14,  w: 126, h: 54 },
    { id: "trunk-l",   label: "Prtljažnik",      x: 22,  y: 66,  w: 96,  h: 68 },
    { id: "door-f",    label: "Vrata prednja",   x: 197, y: 78,  w: 88,  h: 84 },
    { id: "door-r",    label: "Vrata zadnja",    x: 110, y: 78,  w: 86,  h: 84 },
    { id: "fender-f",  label: "Blatobran P-L",   x: 280, y: 78,  w: 76,  h: 84 },
    { id: "fender-r",  label: "Blatobran Z-L",   x: 44,  y: 78,  w: 62,  h: 84 },
    { id: "mirror-l",  label: "Retrovizor L",    x: 270, y: 66,  w: 28,  h: 22 },
    { id: "wheel-fl-s",label: "Točak prednji",   x: 286, y: 150, w: 78,  h: 65 },
    { id: "wheel-rl-s",label: "Točak zadnji",    x: 38,  y: 150, w: 78,  h: 65 },
  ],
  rear: [
    { id: "roof-rear", label: "Krov",            x: 145, y: 10,  w: 110, h: 26 },
    { id: "rear-win",  label: "Stražnje staklo", x: 112, y: 36,  w: 176, h: 65 },
    { id: "trunk",     label: "Prtljažnik",      x: 135, y: 101, w: 130, h: 65 },
    { id: "tl-l",      label: "Stop lijevi",     x: 65,  y: 101, w: 68,  h: 65 },
    { id: "tl-r",      label: "Stop desni",      x: 267, y: 101, w: 68,  h: 65 },
    { id: "bumper-r",  label: "Branik zadnji",   x: 54,  y: 166, w: 292, h: 49 },
    { id: "wheel-rl",  label: "Točak ZL",        x: 28,  y: 172, w: 54,  h: 43 },
    { id: "wheel-rr",  label: "Točak ZD",        x: 318, y: 172, w: 54,  h: 43 },
  ],
  right: [
    { id: "hood-r",    label: "Hauba",           x: 22,  y: 66,  w: 104, h: 68 },
    { id: "roof-r",    label: "Krov",            x: 122, y: 14,  w: 126, h: 54 },
    { id: "trunk-r",   label: "Prtljažnik",      x: 280, y: 66,  w: 96,  h: 68 },
    { id: "door-f-r",  label: "Vrata prednja",   x: 115, y: 78,  w: 88,  h: 84 },
    { id: "door-r-r",  label: "Vrata zadnja",    x: 203, y: 78,  w: 86,  h: 84 },
    { id: "fender-f-r",label: "Blatobran P-D",   x: 44,  y: 78,  w: 76,  h: 84 },
    { id: "fender-r-r",label: "Blatobran Z-D",   x: 295, y: 78,  w: 62,  h: 84 },
    { id: "mirror-r",  label: "Retrovizor D",    x: 102, y: 66,  w: 28,  h: 22 },
    { id: "wheel-fr-s",label: "Točak prednji",   x: 38,  y: 150, w: 78,  h: 65 },
    { id: "wheel-rr-s",label: "Točak zadnji",    x: 286, y: 150, w: 78,  h: 65 },
  ],
  top: [
    { id: "hood-top",  label: "Hauba",           x: 108, y: 8,   w: 184, h: 74 },
    { id: "roof-top",  label: "Krov",            x: 108, y: 82,  w: 184, h: 82 },
    { id: "trunk-top", label: "Prtljažnik",      x: 108, y: 164, w: 184, h: 58 },
    { id: "mirror-tl", label: "Retrovizor L",    x: 66,  y: 88,  w: 34,  h: 28 },
    { id: "mirror-tr", label: "Retrovizor D",    x: 300, y: 88,  w: 34,  h: 28 },
    { id: "wheel-tfl", label: "Točak PL",        x: 28,  y: 6,   w: 70,  h: 58 },
    { id: "wheel-tfr", label: "Točak PD",        x: 302, y: 6,   w: 70,  h: 58 },
    { id: "wheel-trl", label: "Točak ZL",        x: 28,  y: 160, w: 70,  h: 62 },
    { id: "wheel-trr", label: "Točak ZD",        x: 302, y: 160, w: 70,  h: 62 },
  ],
};

// ─── Wheel helper ─────────────────────────────────────────────────────────────
function Wheel({ cx, cy, r = 34 }: { cx: number; cy: number; r?: number }) {
  const inner = r * 0.68;
  const hub = r * 0.22;
  const spoke = r * 0.65;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.8" />
      <circle cx={cx} cy={cy} r={inner} fill="#18181b" stroke="#52525b" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={hub} fill="#111" stroke="#71717a" strokeWidth="1" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={cx + Math.cos(rad) * (hub + 2)}
            y1={cy + Math.sin(rad) * (hub + 2)}
            x2={cx + Math.cos(rad) * spoke}
            y2={cy + Math.sin(rad) * spoke}
            stroke="#52525b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

// ─── Front view ───────────────────────────────────────────────────────────────
function FrontCar() {
  return (
    <>
      <ellipse cx="200" cy="216" rx="142" ry="5" fill="#0a0a0a" />
      {/* Body shell */}
      <path
        d="M74,207 L74,182 Q70,162 88,154 L95,150 L95,107 Q95,94 106,85 L130,55 Q138,40 150,36 L250,36 Q262,40 270,55 L294,85 Q305,94 305,107 L305,150 L312,154 Q330,162 326,182 L326,207 Q326,215 318,215 L82,215 Q74,215 74,207 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      {/* Windshield */}
      <path
        d="M111,106 L132,56 Q140,41 150,37 L250,37 Q260,41 268,56 L289,106 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88"
      />
      {/* Roof bar */}
      <rect x="148" y="10" width="104" height="28" rx="7" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
      <rect x="154" y="15" width="92" height="18" rx="5" fill="#1c1c1e" />
      {/* Left headlight */}
      <path d="M76,109 L133,109 L133,148 Q133,154 126,154 L76,154 Q68,154 68,146 L68,117 Q68,109 76,109 Z"
        fill="#111827" stroke="#4b5563" strokeWidth="1.2" />
      <path d="M80,113 L129,113 L129,145 Q129,149 125,149 L80,149 Q74,149 74,143 L74,119 Q74,113 80,113 Z"
        fill="#0c1220" stroke="#1d4ed8" strokeWidth="0.8" fillOpacity="0.6" />
      <line x1="77" y1="119" x2="127" y2="119" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
      <line x1="77" y1="126" x2="110" y2="126" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Right headlight */}
      <path d="M267,109 L324,109 Q332,109 332,117 L332,146 Q332,154 324,154 L274,154 Q267,154 267,148 L267,109 Z"
        fill="#111827" stroke="#4b5563" strokeWidth="1.2" />
      <path d="M271,113 L328,113 Q328,119 328,143 Q328,149 322,149 L275,149 Q271,149 271,145 L271,113 Z"
        fill="#0c1220" stroke="#1d4ed8" strokeWidth="0.8" fillOpacity="0.6" />
      <line x1="273" y1="119" x2="323" y2="119" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
      <line x1="290" y1="126" x2="323" y2="126" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Centre grille */}
      <rect x="134" y="109" width="132" height="58" rx="3" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="140" y={114 + i * 12} width="120" height="7" rx="1.5" fill="#252528" stroke="#3f3f46" strokeWidth="0.5" />
      ))}
      <circle cx="200" cy="162" r="6" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      {/* Bumper */}
      <path d="M64,167 Q56,167 56,176 L56,208 Q56,216 64,216 L336,216 Q344,216 344,208 L344,176 Q344,167 336,167 Z"
        fill="#222225" stroke="#4a5568" strokeWidth="1.5" />
      <rect x="175" y="176" width="50" height="15" rx="2" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      <rect x="76" y="178" width="30" height="10" rx="2" fill="#1a1a1c" stroke="#3f3f46" strokeWidth="1" />
      <rect x="294" y="178" width="30" height="10" rx="2" fill="#1a1a1c" stroke="#3f3f46" strokeWidth="1" />
      {/* Wheels (barely visible from front) */}
      <ellipse cx="88" cy="215" rx="25" ry="6" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.5" />
      <ellipse cx="312" cy="215" rx="25" ry="6" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.5" />
    </>
  );
}

// ─── Left side view (front of car = RIGHT) ───────────────────────────────────
function LeftCar() {
  return (
    <>
      <ellipse cx="200" cy="213" rx="172" ry="5" fill="#0a0a0a" />
      {/* Body lower shell */}
      <path
        d="M28,162 L28,148 Q24,138 36,133 L50,130 L62,130 L62,88 Q62,76 73,70 L96,66 L288,66 L316,72 Q330,78 340,92 L352,118 L357,133 L370,138 Q378,143 375,153 L375,162 Q375,170 366,170 L38,170 Q28,170 28,162 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      {/* Roof/cabin */}
      <path d="M152,66 L165,22 Q172,10 184,8 L264,8 Q276,10 283,22 L296,66 Z"
        fill="#272729" stroke="#52525b" strokeWidth="1.5" />
      {/* Windshield glass */}
      <path d="M290,66 L278,24 Q274,12 264,9 L254,9 L248,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88" />
      {/* Rear window glass */}
      <path d="M157,66 L168,24 Q173,11 184,9 L190,9 L192,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88" />
      {/* Front door window */}
      <path d="M197,66 L202,22 L247,22 L248,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.72" />
      {/* Rear door window */}
      <path d="M160,66 L166,22 L198,22 L194,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.72" />
      {/* B-pillar */}
      <rect x="193" y="10" width="7" height="56" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="0.5" />
      {/* Door split line front */}
      <line x1="197" y1="66" x2="197" y2="158" stroke="#3f3f46" strokeWidth="1.5" />
      {/* Door handles */}
      <rect x="222" y="114" width="20" height="7" rx="3.5" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      <rect x="140" y="114" width="20" height="7" rx="3.5" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      {/* Mirror */}
      <path d="M295,72 L318,72 Q324,72 324,79 L324,96 Q324,102 318,102 L295,102 Q289,102 289,96 L289,79 Q289,72 295,72 Z"
        fill="#222225" stroke="#52525b" strokeWidth="1" />
      {/* Headlight (right = front) */}
      <rect x="342" y="88" width="22" height="38" rx="4" fill="#0c1220" stroke="#4b5563" strokeWidth="1.1" />
      <line x1="346" y1="98" x2="361" y2="98" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Taillight (left = rear) */}
      <rect x="36" y="88" width="22" height="38" rx="4" fill="#1a0505" stroke="#4b5563" strokeWidth="1.1" />
      <rect x="39" y="91" width="16" height="30" rx="2" fill="#7f1d1d" stroke="#dc2626" strokeWidth="0.5" fillOpacity="0.65" />
      {/* Body crease */}
      <path d="M42,116 Q100,112 200,110 Q290,112 358,116" fill="none" stroke="#4b5563" strokeWidth="0.8" />
      {/* Wheels */}
      <Wheel cx={322} cy={170} r={38} />
      <Wheel cx={78} cy={170} r={38} />
      {/* Wheel arch lines */}
      <path d="M284,130 Q322,118 360,130" fill="none" stroke="#3f3f46" strokeWidth="1" />
      <path d="M40,130 Q78,118 116,130" fill="none" stroke="#3f3f46" strokeWidth="1" />
    </>
  );
}

// ─── Rear view ────────────────────────────────────────────────────────────────
function RearCar() {
  return (
    <>
      <ellipse cx="200" cy="216" rx="142" ry="5" fill="#0a0a0a" />
      {/* Body shell */}
      <path
        d="M74,207 L74,182 Q70,162 88,154 L95,150 L95,107 Q95,94 106,85 L130,55 Q138,40 150,36 L250,36 Q262,40 270,55 L294,85 Q305,94 305,107 L305,150 L312,154 Q330,162 326,182 L326,207 Q326,215 318,215 L82,215 Q74,215 74,207 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      {/* Rear window */}
      <path
        d="M114,105 L134,56 Q142,41 152,37 L248,37 Q258,41 266,56 L286,105 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88"
      />
      {/* Roof bar */}
      <rect x="148" y="10" width="104" height="28" rx="7" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
      <rect x="154" y="15" width="92" height="18" rx="5" fill="#1c1c1e" />
      {/* Left taillight */}
      <path d="M76,109 L133,109 L133,148 Q133,154 126,154 L76,154 Q68,154 68,146 L68,117 Q68,109 76,109 Z"
        fill="#1a0505" stroke="#4b5563" strokeWidth="1.2" />
      <path d="M80,113 L129,113 L129,145 Q129,149 125,149 L80,149 Q74,149 74,143 L74,119 Q74,113 80,113 Z"
        fill="#7f1d1d" stroke="#dc2626" strokeWidth="0.8" fillOpacity="0.7" />
      <line x1="77" y1="119" x2="127" y2="119" stroke="#fca5a5" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      {/* Right taillight */}
      <path d="M267,109 L324,109 Q332,109 332,117 L332,146 Q332,154 324,154 L274,154 Q267,154 267,148 L267,109 Z"
        fill="#1a0505" stroke="#4b5563" strokeWidth="1.2" />
      <path d="M271,113 L328,113 Q328,119 328,143 Q328,149 322,149 L275,149 Q271,149 271,145 L271,113 Z"
        fill="#7f1d1d" stroke="#dc2626" strokeWidth="0.8" fillOpacity="0.7" />
      <line x1="273" y1="119" x2="323" y2="119" stroke="#fca5a5" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      {/* Trunk panel */}
      <rect x="134" y="109" width="132" height="55" rx="3" fill="#262628" stroke="#3f3f46" strokeWidth="1" />
      <path d="M148,136 Q200,131 252,136" fill="none" stroke="#3f3f46" strokeWidth="1" />
      {/* License plate */}
      <rect x="168" y="122" width="64" height="20" rx="2" fill="#e4e4e7" stroke="#a1a1aa" strokeWidth="1" />
      <rect x="171" y="125" width="58" height="14" rx="1" fill="#dbeafe" />
      {/* Bumper */}
      <path d="M64,165 Q56,165 56,174 L56,208 Q56,216 64,216 L336,216 Q344,216 344,208 L344,174 Q344,165 336,165 Z"
        fill="#222225" stroke="#4a5568" strokeWidth="1.5" />
      <rect x="76" y="178" width="30" height="10" rx="2" fill="#1a0505" stroke="#3f3f46" strokeWidth="1" />
      <rect x="294" y="178" width="30" height="10" rx="2" fill="#1a0505" stroke="#3f3f46" strokeWidth="1" />
      {/* Wheels */}
      <ellipse cx="88" cy="215" rx="25" ry="6" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.5" />
      <ellipse cx="312" cy="215" rx="25" ry="6" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.5" />
    </>
  );
}

// ─── Right side view (front of car = LEFT) ───────────────────────────────────
function RightCar() {
  return (
    <>
      <ellipse cx="200" cy="213" rx="172" ry="5" fill="#0a0a0a" />
      {/* Body lower shell */}
      <path
        d="M25,153 Q22,143 34,138 L48,133 L375,133 L388,138 Q374,143 374,153 L374,162 Q374,170 364,170 L35,170 Q25,170 25,162 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      <path
        d="M25,162 L25,148 Q22,138 34,133 L44,130 L104,130 Q108,130 110,88 Q112,76 127,70 L112,66 L284,66 L304,72 Q318,78 328,92 L338,118 L362,133 L374,133 L374,162 Q374,170 364,170 L35,170 Q25,170 25,162 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      {/* Roof/cabin (mirrored from left — front on LEFT) */}
      <path d="M248,66 L235,22 Q228,10 216,8 L136,8 Q124,10 117,22 L104,66 Z"
        fill="#272729" stroke="#52525b" strokeWidth="1.5" />
      {/* Windshield glass (LEFT side = front) */}
      <path d="M110,66 L122,24 Q126,12 136,9 L146,9 L152,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88" />
      {/* Rear window glass (RIGHT side = rear) */}
      <path d="M243,66 L232,24 Q227,11 216,9 L210,9 L208,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.88" />
      {/* Front door window */}
      <path d="M153,66 L152,22 L203,22 L202,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.72" />
      {/* Rear door window */}
      <path d="M206,66 L208,22 L240,22 L244,66 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.72" />
      {/* B-pillar */}
      <rect x="200" y="10" width="7" height="56" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="0.5" />
      {/* Door split line */}
      <line x1="203" y1="66" x2="203" y2="158" stroke="#3f3f46" strokeWidth="1.5" />
      {/* Door handles */}
      <rect x="160" y="114" width="20" height="7" rx="3.5" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      <rect x="242" y="114" width="20" height="7" rx="3.5" fill="#1a1a1c" stroke="#52525b" strokeWidth="1" />
      {/* Mirror (LEFT = front, mirror is near front) */}
      <path d="M82,72 L105,72 Q111,72 111,79 L111,96 Q111,102 105,102 L82,102 Q76,102 76,96 L76,79 Q76,72 82,72 Z"
        fill="#222225" stroke="#52525b" strokeWidth="1" />
      {/* Headlight (LEFT = front) */}
      <rect x="36" y="88" width="22" height="38" rx="4" fill="#0c1220" stroke="#4b5563" strokeWidth="1.1" />
      <line x1="39" y1="98" x2="54" y2="98" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Taillight (RIGHT = rear) */}
      <rect x="342" y="88" width="22" height="38" rx="4" fill="#1a0505" stroke="#4b5563" strokeWidth="1.1" />
      <rect x="345" y="91" width="16" height="30" rx="2" fill="#7f1d1d" stroke="#dc2626" strokeWidth="0.5" fillOpacity="0.65" />
      {/* Body crease */}
      <path d="M42,116 Q100,112 200,110 Q290,112 358,116" fill="none" stroke="#4b5563" strokeWidth="0.8" />
      {/* Wheels */}
      <Wheel cx={78} cy={170} r={38} />
      <Wheel cx={322} cy={170} r={38} />
      {/* Wheel arches */}
      <path d="M40,130 Q78,118 116,130" fill="none" stroke="#3f3f46" strokeWidth="1" />
      <path d="M284,130 Q322,118 360,130" fill="none" stroke="#3f3f46" strokeWidth="1" />
    </>
  );
}

// ─── Top / overhead view ──────────────────────────────────────────────────────
function TopCar() {
  return (
    <>
      {/* Body outline */}
      <path
        d="M116,222 Q108,222 106,214 L106,188 L98,186 Q90,184 90,176 L90,166 L100,164 L100,82 L90,80 L90,68 Q90,58 98,56 L106,54 L106,28 Q106,18 114,14 L200,8 L286,14 Q294,18 294,28 L294,54 L302,56 Q310,58 310,68 L310,80 L300,82 L300,164 L310,166 L310,176 Q310,184 302,186 L294,188 L294,214 Q292,222 284,222 Z"
        fill="#2d2d30" stroke="#52525b" strokeWidth="1.5"
      />
      {/* Windshield (top of car = front, near y:14) */}
      <path d="M118,54 L118,30 Q118,22 126,18 L200,12 L274,18 Q282,22 282,30 L282,54 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.85" />
      {/* Roof glass */}
      <rect x="120" y="82" width="160" height="80" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.7" />
      {/* Roof frame */}
      <rect x="110" y="82" width="180" height="80" rx="6" fill="none" stroke="#52525b" strokeWidth="2" />
      {/* Rear window */}
      <path d="M118,166 L118,188 Q118,196 126,200 L200,210 L274,200 Q282,196 282,188 L282,166 Z"
        fill="#0f172a" stroke="#334155" strokeWidth="1" fillOpacity="0.78" />
      {/* Hood centre line */}
      <line x1="200" y1="10" x2="200" y2="54" stroke="#3f3f46" strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Trunk centre line */}
      <line x1="200" y1="166" x2="200" y2="210" stroke="#3f3f46" strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Left mirror */}
      <path d="M82,90 L100,88 Q100,116 100,116 L82,114 Q74,112 74,102 Q74,92 82,90 Z"
        fill="#222225" stroke="#52525b" strokeWidth="1" />
      {/* Right mirror */}
      <path d="M318,90 L300,88 Q300,116 300,116 L318,114 Q326,112 326,102 Q326,92 318,90 Z"
        fill="#222225" stroke="#52525b" strokeWidth="1" />
      {/* Wheels */}
      <rect x="32" y="10" width="62" height="52" rx="14" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.8" />
      <rect x="40" y="16" width="46" height="40" rx="10" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <rect x="306" y="10" width="62" height="52" rx="14" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.8" />
      <rect x="314" y="16" width="46" height="40" rx="10" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <rect x="32" y="162" width="62" height="52" rx="14" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.8" />
      <rect x="40" y="168" width="46" height="40" rx="10" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <rect x="306" y="162" width="62" height="52" rx="14" fill="#0d0d0f" stroke="#3f3f46" strokeWidth="1.8" />
      <rect x="314" y="168" width="46" height="40" rx="10" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      {/* Direction arrow (front indicator) */}
      <text x="200" y="6" textAnchor="middle" fontSize="9" fill="#52525b">▲ PREDNJI</text>
    </>
  );
}

// ─── View registry ────────────────────────────────────────────────────────────
const CAR_VIEW_MAP: Record<CarView, () => React.ReactElement> = {
  front: FrontCar,
  left: LeftCar,
  rear: RearCar,
  right: RightCar,
  top: TopCar,
};

// ─── Main component ───────────────────────────────────────────────────────────
export function CarDamageInspector({
  damages,
  onChange,
  vehicleMake,
  vehicleModel,
  preExistingDamages = [],
}: {
  damages: DamagePin[];
  onChange: (pins: DamagePin[]) => void;
  vehicleMake?: string;
  vehicleModel?: string;
  preExistingDamages?: DamagePin[];
}) {
  // Resolve the correct 3D model path from the vehicle make/model
  const modelPath = (() => {
    const m = vehicleModel?.toLowerCase() ?? "";
    if (m.includes("crafter"))        return "/models/crafter/scene.gltf";
    if (m.includes("passat estate"))  return "/models/passat_estate/scene.gltf";
    if (m.includes("passat"))         return "/models/passat_sedan/scene.gltf";
    return "/models/golf_8/scene.gltf";
  })();

  const [viewIdx, setViewIdx] = useState(0);
  const [tiltDir, setTiltDir] = useState<"left" | "right" | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const dragRef = useRef<{ startX: number; moved: boolean }>({ startX: 0, moved: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<{ x: number; y: number; zone: string } | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();

  const currentView = VIEWS[viewIdx];
  const CarSVG = CAR_VIEW_MAP[currentView];

  // Always use 3D for all VTZ vehicles
  return (
    <Car3DInspector
      modelPath={modelPath}
      damages={damages as Damage3DPin[]}
      onChange={onChange as (pins: Damage3DPin[]) => void}
      preExistingDamages={preExistingDamages as Damage3DPin[]}
    />
  );

  // ── Rotation ────────────────────────────────────────────────────────────────
  const rotate = (dir: "left" | "right") => {
    if (transitioning) return;
    setTiltDir(dir);
    setTransitioning(true);
    setTimeout(() => {
      setViewIdx((i) => {
        const next = dir === "right" ? (i + 1) % VIEWS.length : (i - 1 + VIEWS.length) % VIEWS.length;
        return next;
      });
      setTiltDir(null);
      setTransitioning(false);
    }, 220);
  };

  // ── Drag-to-rotate ──────────────────────────────────────────────────────────
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragRef.current = { startX: x, moved: false };
  };
  const onDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    const x = "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
    const delta = x - dragRef.current.startX;
    if (Math.abs(delta) > 40) {
      dragRef.current.moved = true;
      rotate(delta < 0 ? "right" : "left");
    }
  };

  // ── Click to place pin ──────────────────────────────────────────────────────
  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragRef.current.moved) { dragRef.current.moved = false; return; }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 220;
    const zone = ZONES[currentView].find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    setPending({ x, y, zone: zone?.label ?? "Ostalo" });
    setPendingNote("");
    setPendingPhoto(undefined);
  };

  // ── Confirm pin ─────────────────────────────────────────────────────────────
  const confirmPin = () => {
    if (!pending || !pendingNote.trim()) return;
    onChange([
      ...damages,
      {
        id: `pin-${Date.now()}`,
        view: currentView,
        x: pending.x,
        y: pending.y,
        zone: pending.zone,
        note: pendingNote.trim(),
        photo: pendingPhoto,
      },
    ]);
    setPending(null);
  };

  const removePin = (id: string) => onChange(damages.filter((p) => p.id !== id));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const viewDamages         = damages.filter((p) => p.view === currentView);
  const viewExistingDamages = preExistingDamages.filter((p) => p.view === currentView);

  return (
    <div className="space-y-3">
      {/* View tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {VIEWS.map((v, i) => (
            <button
              key={v}
              onClick={() => { if (i !== viewIdx) rotate(i > viewIdx ? "right" : "left"); }}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                i === viewIdx
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {VIEW_LABELS[v]}
              {damages.filter((d) => d.view === v).length > 0 && (
                <span className="ml-1 bg-orange-600 text-white text-[10px] rounded-full px-1">
                  {damages.filter((d) => d.view === v).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500 italic">Kliknite na auto za oštećenje · Povucite za rotaciju</span>
      </div>

      {/* 3D car canvas */}
      <div className="relative bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden select-none">
        <button
          onClick={() => rotate("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-all"
          aria-label="Previous view"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => rotate("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-all"
          aria-label="Next view"
        >
          <ChevronRight size={16} />
        </button>

        <div
          className="mx-12 py-3"
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onTouchStart={onDragStart}
          onTouchEnd={onDragEnd}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 400 222"
            className="w-full cursor-crosshair"
            style={{
              transition: "transform 0.22s cubic-bezier(0.4,0,0.6,1), opacity 0.22s ease",
              transform: tiltDir
                ? `perspective(700px) rotateY(${tiltDir === "right" ? -50 : 50}deg) scaleX(0.8)`
                : "perspective(700px) rotateY(0deg) scaleX(1)",
              opacity: tiltDir ? 0.4 : 1,
            }}
            onClick={onSvgClick}
          >
            <CarSVG />

            {/* Invisible zone hit-targets */}
            {ZONES[currentView].map((z) => (
              <rect
                key={z.id}
                x={z.x} y={z.y} width={z.w} height={z.h}
                fill="transparent"
                style={{ cursor: "crosshair" }}
              />
            ))}

            {/* Pre-existing pins for this view (blue, read-only) */}
            {viewExistingDamages.map((pin, idx) => (
              <g key={pin.id}>
                <circle cx={pin.x} cy={pin.y} r={13} fill="#6366f1" fillOpacity="0.88" />
                <circle cx={pin.x} cy={pin.y} r={13} fill="none" stroke="#a5b4fc" strokeWidth="1.5" />
                <text x={pin.x} y={pin.y + 4.5} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" style={{ userSelect: "none" }}>
                  {idx + 1}
                </text>
              </g>
            ))}

            {/* New damage pins for this view */}
            {viewDamages.map((pin, idx) => (
              <g key={pin.id} style={{ cursor: "default" }}>
                <circle cx={pin.x} cy={pin.y} r={13} fill="#f97316" fillOpacity="0.92" />
                <circle cx={pin.x} cy={pin.y} r={13} fill="none" stroke="white" strokeWidth="1.5" />
                <text
                  x={pin.x} y={pin.y + 4.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="white"
                  style={{ userSelect: "none" }}
                >
                  {idx + 1}
                </text>
              </g>
            ))}

            {/* Pending pin crosshair */}
            {pending && (
              <g>
                <circle cx={pending.x} cy={pending.y} r={11} fill="#f97316" fillOpacity="0.35" stroke="#f97316" strokeWidth="2" />
                <line x1={pending.x - 16} y1={pending.y} x2={pending.x + 16} y2={pending.y} stroke="#f97316" strokeWidth="1.2" />
                <line x1={pending.x} y1={pending.y - 16} x2={pending.x} y2={pending.y + 16} stroke="#f97316" strokeWidth="1.2" />
              </g>
            )}
          </svg>
        </div>

        {/* View label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-500 bg-zinc-900/80 px-2.5 py-0.5 rounded-full pointer-events-none">
          {VIEW_LABELS[currentView]}
        </div>
      </div>

      {/* Pending pin note form */}
      {pending && (
        <div className="bg-zinc-800 border border-orange-500/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Novo oštećenje</p>
              <p className="text-xs text-orange-400 mt-0.5">{VIEW_LABELS[currentView]} — {pending.zone}</p>
            </div>
            <button onClick={() => setPending(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X size={16} />
            </button>
          </div>

          <textarea
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            placeholder="Opis oštećenja (ogrebotina, udubljenje, pukotina...)"
            className="input text-sm resize-none h-20"
            autoFocus
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer border border-dashed border-zinc-600 hover:border-orange-500/50 rounded-lg px-3 py-2 transition-all flex-1">
              <Camera size={14} />
              {pendingPhoto ? (
                <span className="text-emerald-400">Fotografija dodana ✓</span>
              ) : (
                "Dodaj fotografiju (opcija)"
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
            </label>
            {pendingPhoto && (
              <img
                src={pendingPhoto}
                alt="damage"
                className="w-12 h-12 object-cover rounded-lg border border-zinc-600 flex-shrink-0"
              />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setPending(null)} className="btn-secondary text-xs py-1.5">
              Odustani
            </button>
            <button
              onClick={confirmPin}
              disabled={!pendingNote.trim()}
              className="btn-primary text-xs py-1.5"
            >
              <Check size={12} />
              Potvrdi oštećenje
            </button>
          </div>
        </div>
      )}

      {/* Damage log */}
      {damages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            {preExistingDamages.length > 0 ? "Nova oštećenja pri povratku" : "Evidentirana oštećenja"} ({damages.length})
          </p>
          {damages.map((pin, i) => (
            <div key={pin.id} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg px-3 py-2.5">
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-orange-400 font-medium">
                  {VIEW_LABELS[pin.view]} — {pin.zone}
                </p>
                <p className="text-sm text-zinc-200 mt-0.5 leading-snug">{pin.note}</p>
                {pin.photo && (
                  <img
                    src={pin.photo}
                    alt="oštećenje"
                    className="mt-2 h-20 w-auto rounded-lg border border-zinc-700 object-cover"
                  />
                )}
              </div>
              <button
                onClick={() => removePin(pin.id)}
                className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                aria-label="Ukloni"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pre-existing damage log (SVG mode) */}
      {preExistingDamages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
            Oštećenja pri preuzimanju ({preExistingDamages.length})
          </p>
          {preExistingDamages.map((pin, i) => (
            <div key={pin.id} className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2.5">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-400 font-medium">{pin.zone}</p>
                <p className="text-sm text-zinc-300 mt-0.5 leading-snug">{pin.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
