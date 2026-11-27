import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-14 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
