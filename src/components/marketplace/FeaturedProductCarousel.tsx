import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Sparkles, ArrowRight } from "lucide-react";

interface FeaturedProps {
    listings: any[];
    onSelect: (item: any) => void;
}

export function FeaturedProductCarousel({ listings, onSelect }: FeaturedProps) {
    if (!listings || listings.length === 0) return null;

    // Just take the first 3 for the "Featured" section
    const featured = listings.slice(0, 3);

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles className="h-4 w-4 text-yellow-400 fill-yellow-400 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Top Deals</h2>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-6 px-1 snap-x snap-mandatory scrollbar-hide">
                {featured.map((item, i) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="min-w-[85%] sm:min-w-[300px] h-[180px] bg-gradient-to-br from-zinc-900 to-black rounded-3xl border border-white/10 relative overflow-hidden snap-center cursor-pointer group shadow-lg shadow-black/50"
                        onClick={() => onSelect(item)}
                    >
                        {/* Background Image with Gradient Overlay */}
                        <div className="absolute inset-0">
                            {item.images?.[0] ? (
                                <img src={item.images[0]} className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full bg-secondary/20" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        </div>

                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                            <div className="flex justify-between items-end">
                                <div>
                                    <Badge className="bg-white/10 backdrop-blur-md border-white/10 text-white mb-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/20">
                                        {item.category}
                                    </Badge>
                                    <h3 className="text-lg font-black text-white leading-tight line-clamp-1 mb-1">{item.title}</h3>
                                    <p className="text-primary font-black text-xl italic">₹{item.price.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:bg-primary group-hover:text-black transition-colors">
                                    <ArrowRight className="h-5 w-5 -rotate-45 group-hover:rotate-0 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
