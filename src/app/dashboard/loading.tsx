import { Skeleton, SkeletonStatCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-ink-50" aria-busy="true" aria-label="Učitavanje nadzorne ploče">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
        {/* header */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>

        {/* main grid: list + airport arrivals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white border border-ink-150 rounded-xl shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="w-10 h-10" rounded="full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16" rounded="full" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-ink-150 rounded-xl shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-ink-150 rounded-lg p-3 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
