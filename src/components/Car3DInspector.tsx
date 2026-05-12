"use client";

import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Camera, X, Check, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { DamagePin } from "./CarDamageInspector";

// ─── Zone detection — normalized 0-1 coords within model bounding box ─────────
// nx: left→right, ny: ground→roof (Y-up), nz: front→rear
function detectZone(point: THREE.Vector3, bbox: THREE.Box3): string {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const nx = (point.x - bbox.min.x) / size.x;
  const ny = (point.y - bbox.min.y) / size.y;
  const nz = (point.z - bbox.min.z) / size.z;

  if (ny > 0.80) return "Krov";

  if (nz < 0.28 && ny > 0.55 && nx > 0.15 && nx < 0.85) return "Vjetrobransko staklo";
  if (nz > 0.72 && ny > 0.55 && nx > 0.15 && nx < 0.85) return "Stražnje staklo";

  if (ny < 0.22 && nx < 0.25 && nz < 0.38) return "Kotači prednji lijevi";
  if (ny < 0.22 && nx > 0.75 && nz < 0.38) return "Kotači prednji desni";
  if (ny < 0.22 && nx < 0.25 && nz > 0.62) return "Kotači stražnji lijevi";
  if (ny < 0.22 && nx > 0.75 && nz > 0.62) return "Kotači stražnji desni";

  if (nz < 0.25) {
    if (ny < 0.30) return "Prednji branik";
    if (nx < 0.35 && ny < 0.68) return "Prednja svjetla lijeva";
    if (nx > 0.65 && ny < 0.68) return "Prednja svjetla desna";
    return "Poklopac motora";
  }

  if (nz > 0.75) {
    if (ny < 0.30) return "Stražnji branik";
    if (nx < 0.35 && ny < 0.68) return "Stražnja svjetla lijeva";
    if (nx > 0.65 && ny < 0.68) return "Stražnja svjetla desna";
    return "Prtljažnik";
  }

  if (nx < 0.22) {
    if (ny < 0.18) return "Prag lijevi";
    if (ny > 0.56 && nz < 0.42) return "Retrovizor lijevi";
    if (nz < 0.38) return "Prednji blatobran lijevi";
    if (nz > 0.68) return "Stražnji blatobran lijevi";
    if (nz < 0.54) return "Prednja vrata lijeva";
    return "Stražnja vrata lijeva";
  }

  if (nx > 0.78) {
    if (ny < 0.18) return "Prag desni";
    if (ny > 0.56 && nz < 0.42) return "Retrovizor desni";
    if (nz < 0.38) return "Prednji blatobran desni";
    if (nz > 0.68) return "Stražnji blatobran desni";
    if (nz < 0.54) return "Prednja vrata desna";
    return "Stražnja vrata desna";
  }

  if (ny < 0.14) return "Donji dio";
  if (ny > 0.68) return "Krov";
  return "Karoserija";
}

// ─── Camera setup ─────────────────────────────────────────────────────────────
function SceneSetup({ bbox, controlsRef }: { bbox: THREE.Box3 | null; controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const done = useRef(false);

  useFrame(() => {
    if (done.current || !bbox || bbox.isEmpty() || !controlsRef.current) return;
    done.current = true;

    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    bbox.getCenter(center);
    bbox.getSize(size);

    const fovRad  = 40 * (Math.PI / 180);
    const fitDim  = Math.max(size.x, size.y, size.z);
    const dist    = (fitDim * 0.48) / Math.tan(fovRad / 2);
    const longest = Math.max(size.x, size.z);

    camera.position.set(center.x + size.x * 0.25, center.y + size.y * 0.35, center.z - dist);
    (camera as THREE.PerspectiveCamera).fov = 40;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    const ctrl = controlsRef.current;
    ctrl.target.copy(center);
    ctrl.minDistance   = dist * 0.35;   // zoom in to ~1/3 of initial distance
    ctrl.maxDistance   = dist * 1.05;   // barely any zoom out past starting view
    ctrl.minPolarAngle = 0.05;
    ctrl.maxPolarAngle = Math.PI * 0.48;
    ctrl.zoomSpeed     = 0.6;           // slower scroll = fewer render calls per gesture
    ctrl.update();
  });

  return null;
}

// ─── Orange pin — new damage ──────────────────────────────────────────────────
function DamageMarker({ pin, index, r, onClick }: { pin: Damage3DPin; index: number; r: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[pin.x, pin.y, pin.z]}>
      <mesh>
        <sphereGeometry args={[hovered ? r * 1.35 : r, 16, 16]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={hovered ? 1.2 : 0.6} transparent opacity={0.9} />
      </mesh>
      <Html center zIndexRange={[100, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
        <div
          style={{ width: 30, height: 30, borderRadius: "50%", background: "#f97316", border: "2.5px solid white",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "bold",
            color: "white", cursor: "pointer", pointerEvents: "auto", boxShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {index + 1}
        </div>
      </Html>
    </group>
  );
}

// ─── Indigo pin — pre-existing damage ────────────────────────────────────────
function ExistingMarker({ pin, index, r, onClick }: { pin: Damage3DPin; index: number; r: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[pin.x, pin.y, pin.z]}>
      <mesh>
        <sphereGeometry args={[hovered ? r * 1.2 : r * 0.9, 16, 16]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={hovered ? 0.9 : 0.3} transparent opacity={0.85} />
      </mesh>
      <Html center zIndexRange={[100, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
        <div
          style={{ width: 26, height: 26, borderRadius: "50%", background: "#6366f1", border: "2.5px solid #a5b4fc",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold",
            color: "white", cursor: "pointer", pointerEvents: "auto", boxShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {index + 1}
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload("/models/golf_8/scene.gltf");
useGLTF.preload("/models/passat_sedan/scene.gltf");
useGLTF.preload("/models/passat_estate/scene.gltf");
useGLTF.preload("/models/crafter/scene.gltf");

// ─── GLTF model ───────────────────────────────────────────────────────────────
function CarModel({ modelPath, onHit, damages, onPinClick, onBboxReady, markerR, preExistingDamages, onExistingPinClick }: {
  modelPath: string;
  onHit: (point: THREE.Vector3) => void;
  damages: Damage3DPin[];
  onPinClick: (id: string) => void;
  onBboxReady: (b: THREE.Box3) => void;
  markerR: number;
  preExistingDamages: Damage3DPin[];
  onExistingPinClick: (id: string) => void;
}) {
  const { scene } = useGLTF(modelPath);
  const { gl }    = useThree();

  useEffect(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    onBboxReady(bbox);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (e.point) onHit(e.point.clone());
  }, [onHit]);

  return (
    <group>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={() => { gl.domElement.style.cursor = "crosshair"; }}
        onPointerOut={() => { gl.domElement.style.cursor = "default"; }}
      />
      {preExistingDamages.map((pin, i) => (
        <ExistingMarker key={pin.id} pin={pin} index={i} r={markerR} onClick={() => onExistingPinClick(pin.id)} />
      ))}
      {damages.map((pin, i) => (
        <DamageMarker key={pin.id} pin={pin} index={i} r={markerR} onClick={() => onPinClick(pin.id)} />
      ))}
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: "#64748b", fontSize: 13 }}>Učitavanje 3D modela...</div>
    </Html>
  );
}

// ─── Note popup ───────────────────────────────────────────────────────────────
function PinPopup({ zone, note, photo, onNoteChange, onPhotoChange, onConfirm, onCancel }: {
  zone: string; note: string; photo: string | undefined;
  onNoteChange: (v: string) => void; onPhotoChange: (v: string | undefined) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="bg-white border border-[#E7E7E7] rounded-xl p-4 space-y-3 animate-slide-up shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Novo oštećenje</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Opis oštećenja (ogrebotina, udubljenje, pukotina...)"
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all resize-none h-20"
        autoFocus
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer border border-dashed border-slate-300 hover:border-[#003580]/50 rounded-lg px-3 py-2 transition-all flex-1">
          <Camera size={14} />
          {photo ? <span className="text-emerald-600">Fotografija dodana ✓</span> : "Dodaj fotografiju (opcija)"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
        </label>
        {photo && <img src={photo} alt="damage" className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0" />}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-xs py-1.5">Odustani</button>
        <button onClick={onConfirm} disabled={!note.trim()} className="btn-primary text-xs py-1.5">
          <Check size={12} /> Potvrdi oštećenje
        </button>
      </div>
    </div>
  );
}

// ─── Public types ─────────────────────────────────────────────────────────────
export interface Damage3DPin extends DamagePin {
  x: number;
  y: number;
  z: number;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Car3DInspector({ damages, onChange, preExistingDamages = [], modelPath = "/models/golf_8/scene.gltf" }: {
  damages: Damage3DPin[];
  onChange: (pins: Damage3DPin[]) => void;
  preExistingDamages?: Damage3DPin[];
  modelPath?: string;
}) {
  const [pending, setPending]           = useState<THREE.Vector3 | null>(null);
  const [pendingNote, setPendingNote]   = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();
  const [selectedPin, setSelectedPin]   = useState<string | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<string | null>(null);
  const [bbox, setBbox]                 = useState<THREE.Box3 | null>(null);

  const controlsRef = useRef<any>(null);
  const markerR = bbox ? new THREE.Vector3().subVectors(bbox.max, bbox.min).x * 0.012 : 0.001;

  const handleHit = useCallback((point: THREE.Vector3) => {
    setPending(point);
    setPendingNote("");
    setPendingPhoto(undefined);
    setSelectedPin(null);
    setSelectedExisting(null);
  }, []);

  const confirmPin = () => {
    if (!pending || !pendingNote.trim() || !bbox) return;
    onChange([
      ...damages,
      { id: `pin3d-${Date.now()}`, view: "front" as any,
        x: pending.x, y: pending.y, z: pending.z,
        zone: detectZone(pending, bbox), note: pendingNote.trim(), photo: pendingPhoto },
    ]);
    setPending(null);
  };

  const removePin = (id: string) => { onChange(damages.filter((p) => p.id !== id)); setSelectedPin(null); };

  const handleRotate = (dir: "left" | "right") => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const angle = (dir === "left" ? 1 : -1) * (Math.PI / 4);
    const offset = ctrl.object.position.clone().sub(ctrl.target);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = cos * offset.x + sin * offset.z;
    const z = -sin * offset.x + cos * offset.z;
    ctrl.object.position.set(ctrl.target.x + x, ctrl.object.position.y, ctrl.target.z + z);
    ctrl.update();
  };

  const selectedPinData      = selectedPin      ? damages.find((p) => p.id === selectedPin)                  : null;
  const selectedExistingData = selectedExisting ? preExistingDamages.find((p) => p.id === selectedExisting)  : null;

  return (
    <div className="space-y-3">
      {/* Legend when doing return inspection */}
      {preExistingDamages.length > 0 && (
        <div className="flex items-center gap-4 text-xs bg-slate-50 border border-[#E7E7E7] rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5 text-indigo-600">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block flex-shrink-0" />
            {preExistingDamages.length} oštećenja pri preuzimanju
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block flex-shrink-0" />
            {damages.length} nova pri povratku
          </span>
        </div>
      )}

      {/* Instructions */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className="text-[#003580] font-medium">Kliknite</span> na auto ·{" "}
          <span className="text-[#003580] font-medium">Povucite</span> za rotaciju ·{" "}
          <span className="text-[#003580] font-medium">Scroll</span> za zoom
        </span>
        {damages.length > 0 && <span className="text-amber-600 font-medium">{damages.length} oštećenje(a)</span>}
      </div>

      {/* 3D canvas */}
      <div className="relative rounded-xl overflow-hidden border border-[#E7E7E7] bg-slate-50" style={{ height: 380 }}>
        <button onClick={() => handleRotate("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-slate-100 border border-[#E7E7E7] flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-sm">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => handleRotate("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-slate-100 border border-[#E7E7E7] flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-sm">
          <ChevronRight size={18} />
        </button>

        <Canvas camera={{ position: [0, 5, 10], fov: 40, near: 0.001, far: 1000 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ scene }) => { scene.background = new THREE.Color(0xf1f5f9); }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} />
          <directionalLight position={[-5, 3, -5]} intensity={0.6} />

          <Suspense fallback={<Loader />}>
            <Environment preset="warehouse" />
            <CarModel
              modelPath={modelPath}
              onHit={handleHit}
              damages={damages}
              onPinClick={(id) => { setSelectedPin((p) => p === id ? null : id); setSelectedExisting(null); }}
              onBboxReady={setBbox}
              markerR={markerR}
              preExistingDamages={preExistingDamages}
              onExistingPinClick={(id) => { setSelectedExisting((p) => p === id ? null : id); setSelectedPin(null); setPending(null); }}
            />
          </Suspense>

          <OrbitControls ref={controlsRef} enablePan={false} enableDamping dampingFactor={0.08}
            minDistance={0.1} maxDistance={500} />
          <SceneSetup bbox={bbox} controlsRef={controlsRef} />
        </Canvas>

        {pending && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#003580]/90 text-white text-xs px-3 py-1 rounded-full font-medium pointer-events-none">
            Pozicija označena — unesite opis ispod
          </div>
        )}
      </div>

      {/* Pre-existing pin detail (read-only) */}
      {selectedExistingData && !pending && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-1.5 animate-slide-up shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Oštećenje pri preuzimanju</p>
              <p className="text-sm text-slate-800 mt-1">{selectedExistingData.note}</p>
              {selectedExistingData.photo && (
                <img src={selectedExistingData.photo} alt="" className="mt-2 h-20 w-auto rounded-lg border border-slate-200 object-cover" />
              )}
            </div>
            <button onClick={() => setSelectedExisting(null)} className="text-slate-400 hover:text-slate-600 ml-3 flex-shrink-0"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* New pin detail */}
      {selectedPinData && !pending && (
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-4 space-y-2 animate-slide-up shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-800">{selectedPinData.note}</p>
              {selectedPinData.photo && (
                <img src={selectedPinData.photo} alt="" className="mt-2 h-20 w-auto rounded-lg border border-slate-200 object-cover" />
              )}
            </div>
            <button onClick={() => removePin(selectedPinData.id)} className="text-slate-400 hover:text-red-500 transition-colors ml-3 flex-shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* New pin form */}
      {pending && bbox && (
        <PinPopup
          zone={detectZone(pending, bbox)} note={pendingNote} photo={pendingPhoto}
          onNoteChange={setPendingNote} onPhotoChange={setPendingPhoto}
          onConfirm={confirmPin} onCancel={() => setPending(null)}
        />
      )}

      {/* Damage log */}
      {damages.length > 0 && !selectedPin && !selectedExisting && !pending && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {preExistingDamages.length > 0 ? "Nova oštećenja pri povratku" : "Evidentirana oštećenja"} ({damages.length})
          </p>
          <div className="grid gap-1.5">
            {damages.map((pin, i) => (
              <button key={pin.id} onClick={() => setSelectedPin(pin.id)}
                className="flex items-start gap-3 bg-slate-50 hover:bg-slate-100 border border-[#E7E7E7] rounded-lg px-3 py-2.5 text-left transition-colors w-full">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug truncate">{pin.note}</p>
                </div>
                {pin.photo && <img src={pin.photo} alt="" className="w-8 h-8 object-cover rounded-md border border-slate-200 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pre-existing damage log */}
      {preExistingDamages.length > 0 && !selectedPin && !selectedExisting && !pending && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
            Oštećenja pri preuzimanju ({preExistingDamages.length})
          </p>
          <div className="grid gap-1.5">
            {preExistingDamages.map((pin, i) => (
              <button key={pin.id} onClick={() => setSelectedExisting(pin.id)}
                className="flex items-start gap-3 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 rounded-lg px-3 py-2.5 text-left transition-colors w-full">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 leading-snug truncate">{pin.note}</p>
                </div>
                {pin.photo && <img src={pin.photo} alt="" className="w-8 h-8 object-cover rounded-md border border-slate-200 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
