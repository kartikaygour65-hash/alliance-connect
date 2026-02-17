import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface SkeletonLoaderProps {
  className?: string;
}

export function SkeletonLoader({ className }: SkeletonLoaderProps) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="glass-card p-4 rounded-2xl mb-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Content */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Image placeholder */}
      <Skeleton className="h-48 w-full rounded-xl mb-3" />

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/50">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-12 rounded-full" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function StorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-16 w-16 rounded-full" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function StoriesBarSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <StorySkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-lg mx-auto">
      {/* Cover */}
      <Skeleton className="h-32 w-full rounded-b-3xl" />

      {/* Profile Info */}
      <div className="px-4 -mt-12">
        <div className="flex items-end gap-4">
          <Skeleton className="h-24 w-24 rounded-full ring-4 ring-background" />
          <Skeleton className="h-9 w-24 rounded-full mb-2" />
        </div>

        <div className="mt-4 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-6 py-4 border-t border-b border-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-6 w-8 mx-auto mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="px-4 py-4 space-y-4">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="max-w-lg mx-auto">
      <StoriesBarSkeleton />
      <div className="px-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
