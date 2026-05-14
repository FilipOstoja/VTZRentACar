"use client";

import { useOptimistic, useState, useTransition, useRef, useEffect } from "react";
import clsx from "clsx";
import { setVehicleStatus, type VehicleStatus } from "@/app/dashboard/fleet/actions";

interface Vehicle {
  id: string;
  status: VehicleStatus | string;
}

interface Props {
  vehicle: Vehicle;
  /** Fires after the server action settles successfully. Use to refresh parent state. */
  onUpdated?: (next: VehicleStatus) => void;
}

const OPTIONS: { value: VehicleStatus; label: string; cls: string; dot: string }[] = [
  { value: "free",     label: "Slobodno",   cls: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
  { value: "rented",   label: "U najmu",    cls: "bg-brand-50 border-brand-200 text-brand-500",        dot: "bg-brand-500"   },
  { value: "service",  label: "Na servisu", cls: "bg-amber-50 border-amber-200 text-amber-700",        dot: "bg-amber-400"   },
  { value: "washing",  label: "Pranje",     cls: "bg-purple-50 border-purple-200 text-purple-700",     dot: "bg-purple-400"  },
  { value: "inactive", label: "Neaktivno",  cls: "bg-ink-100 border-ink-200 text-ink-500",             dot: "bg-ink-300"     },
];

export default function VehicleStatusPill({ vehicle, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    vehicle.status as VehicleStatus,
    (_state, next: VehicleStatus) => next,
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === optimisticStatus) ?? OPTIONS[0];

  function handlePick(next: VehicleStatus) {
    setOpen(false);
    if (next === optimisticStatus) return;
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await setVehicleStatus(vehicle.id, next);
      if (result.ok) {
        // Tell the parent to update its own state so the prop matches the new
        // status. Otherwise useOptimistic falls back to the old prop value
        // once the transition completes and the pill flickers back.
        onUpdated?.(next);
      } else {
        console.error("Status update failed:", result.error);
      }
    });
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "badge",
          current.cls,
          "h-8 pl-2.5 pr-2 cursor-pointer transition-colors",
          isPending && "opacity-80",
        )}
      >
        <span className={clsx("badge-dot", current.dot)} />
        <span>{current.label}</span>
        {isPending ? (
          <span className="ml-1 w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg border border-ink-200 shadow-card-md z-20 py-1 animate-slide-up"
        >
          {OPTIONS.map((opt) => {
            const active = opt.value === optimisticStatus;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => handlePick(opt.value)}
                className={clsx(
                  "w-full h-10 px-3 inline-flex items-center gap-2 text-left text-[12.5px] font-semibold transition-colors",
                  active ? "bg-brand-50 text-brand-600" : "text-ink-700 hover:bg-ink-50",
                )}
              >
                <span className={clsx("badge-dot", opt.dot)} />
                <span className="flex-1">{opt.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
