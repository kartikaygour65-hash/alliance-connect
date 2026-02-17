import { Skeleton } from "@/components/ui/skeleton";

export function MarketplaceSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Featured Carousel Placeholder */}
            <div className="flex gap-4 overflow-hidden mb-8">
                {[1, 2].map((i) => (
                    <Skeleton key={i} className="min-w-[85%] sm:min-w-[300px] h-[180px] rounded-3xl opacity-20" />
                ))}
            </div>

            {/* Grid of Products */}
            <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-3">
                        {/* Product Image */}
                        <Skeleton className="aspect-[4/5] w-full rounded-[2rem] opacity-20" />

                        {/* Product Details */}
                        <div className="space-y-2 px-2">
                            <Skeleton className="h-4 w-3/4 rounded-md opacity-30" />
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-3 w-3 rounded-full opacity-30" />
                                <Skeleton className="h-2 w-1/2 rounded-md opacity-30" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
