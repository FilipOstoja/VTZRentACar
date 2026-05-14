import clsx from "clsx";

type SkeletonProps = {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
};

/**
 * Base skeleton block. Uses the .skeleton utility (shimmer animation,
 * ink-100 background) defined in globals.css.
 */
export function Skeleton({ className, rounded = "md" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "skeleton",
        rounded === "sm" && "rounded-sm",
        rounded === "md" && "rounded-md",
        rounded === "lg" && "rounded-lg",
        rounded === "xl" && "rounded-xl",
        rounded === "full" && "rounded-full",
        className
      )}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-ink-150 shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-2 h-2" rounded="full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-ink-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx("bg-white rounded-xl border border-ink-150 shadow-card p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

// ── Aliases matching the design-handoff naming convention ──
// Same components, different export names. Both styles welcome.
export const StatCardSkeleton = SkeletonStatCard;
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
  );
}
