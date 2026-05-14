"use client";

import { Drawer } from "vaul";
import clsx from "clsx";

export type FleetFilter = "all" | "free" | "rented" | "service" | "washing" | "inactive";
export type SortKey    = "make" | "year_desc" | "rate_desc" | "expiry_asc";

interface Props {
  open: boolean;
  onClose: () => void;
  filter: FleetFilter;
  onFilterChange: (f: FleetFilter) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  counts: Record<string, number>;
  totalShown: number;
}

const STATUS_OPTIONS: { value: FleetFilter; label: string; dot: string }[] = [
  { value: "all",      label: "Sva",        dot: "bg-ink-400" },
  { value: "free",     label: "Slobodna",   dot: "bg-emerald-500" },
  { value: "rented",   label: "U najmu",    dot: "bg-brand-500" },
  { value: "service",  label: "Servis",     dot: "bg-amber-400" },
  { value: "washing",  label: "Pranje",     dot: "bg-purple-400" },
  { value: "inactive", label: "Neaktivna",  dot: "bg-ink-300" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "make",       label: "Marka (A → Z)" },
  { value: "year_desc",  label: "Najnovija godina" },
  { value: "rate_desc",  label: "Najviša KM/dan tarifa" },
  { value: "expiry_asc", label: "Registracija ističe najprije" },
];

export default function FleetFiltersSheet({
  open,
  onClose,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  counts,
  totalShown,
}: Props) {
  const reset = () => {
    onFilterChange("all");
    onSortChange("make");
  };

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex h-auto max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-sheet outline-none">
          {/* Drag handle */}
          <div className="mx-auto mt-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-ink-200" />

          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-3 pb-2">
            <div>
              <Drawer.Title className="text-[17px] font-bold text-ink-800">Filteri</Drawer.Title>
              <Drawer.Description className="text-[12.5px] text-ink-500 mt-0.5">
                {totalShown} {totalShown === 1 ? "vozilo" : "vozila"} odgovara
              </Drawer.Description>
            </div>
            <button
              onClick={onClose}
              aria-label="Zatvori filtere"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {/* Status */}
            <section className="pt-2">
              <h3 className="label">Status</h3>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const active = filter === opt.value;
                  const count = opt.value === "all"
                    ? Object.values(counts).reduce((a, b) => a + b, 0)
                    : counts[opt.value] ?? 0;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onFilterChange(opt.value)}
                      className={clsx(
                        "h-11 px-3 inline-flex items-center gap-2 rounded-lg text-[12.5px] font-bold transition-colors",
                        active
                          ? "border-2 border-brand-500 bg-brand-50 text-brand-600"
                          : "border border-ink-200 text-ink-700 hover:bg-ink-50"
                      )}
                    >
                      <span className={clsx("badge-dot", opt.dot)} />
                      <span className="truncate">{opt.label}</span>
                      <span className="ml-auto text-ink-400 font-mono text-[11.5px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Sort */}
            <section className="mt-6">
              <h3 className="label">Sortiraj po</h3>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SortKey)}
                className="input"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </section>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-ink-150 safe-pb">
            <button onClick={reset} className="btn-secondary flex-1">
              Resetuj
            </button>
            <button onClick={onClose} className="btn-primary flex-1">
              Prikaži {totalShown} {totalShown === 1 ? "vozilo" : "vozila"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
