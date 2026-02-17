import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="glass-card mb-8 p-6 rounded-[2rem] border border-white/5 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md opacity-70" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-full opacity-50" />
      </div>

      {/* Content Text */}
      <div className="space-y-2 py-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-[85%] rounded-md" />
      </div>

      {/* Media Box */}
      <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
        <div className="flex gap-4">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Create Post Skeleton */}
      <div className="glass-card mb-6 p-4 rounded-[2rem] border border-white/5 opacity-80">
        <div className="flex gap-4 items-center">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-12 w-full rounded-2xl bg-white/5 border border-white/5" />
        </div>
      </div>

      {/* Post Skeletons */}
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}