import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Sparkles, Megaphone, ShieldAlert, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function TrendingTicker() {
    const [trends, setTrends] = useState<{ label: string; icon: any; color: string }[]>([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const fetchTrends = async () => {
            const updates: { label: string; icon: any; color: string }[] = [];
            const currentDate = new Date().toISOString();

            try {
                // 1. PULSE SIGNALS (Campus-wide announcements)
                const { data: pulseSignals } = await supabase
                    .from('pulse_signals')
                    .select('title, category')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (pulseSignals?.[0]) {
                    const s = pulseSignals[0];
                    updates.push({
                        label: `Pulse: ${s.title}`,
                        icon: s.category === 'urgent' ? ShieldAlert : Radio,
                        color: s.category === 'urgent' ? "text-red-500" : "text-primary"
                    });
                }

                // 2. HOT TOPICS (Recent High-Engagement Posts)
                const { data: pulses } = await supabase
                    .from('posts')
                    .select('content, aura_count')
                    .order('aura_count', { ascending: false })
                    .limit(1);

                if (pulses?.[0] && (pulses[0].aura_count || 0) > 2) {
                    updates.push({
                        label: `Trending: "${pulses[0].content?.slice(0, 30)}..."`,
                        icon: Sparkles,
                        color: "text-violet-400"
                    });
                }

                // 3. LATEST LOST & FOUND
                const { data: lostItems } = await supabase
                    .from('lost_found_items')
                    .select('title, status')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (lostItems?.[0]) {
                    const item = lostItems[0];
                    updates.push({
                        label: `${item.status === 'lost' ? '🔴 Lost' : '🟢 Found'}: ${item.title}`,
                        icon: Megaphone,
                        color: item.status === 'lost' ? "text-rose-400" : "text-emerald-400"
                    });
                }

                // 3. LATEST MARKETPLACE
                const { data: marketItems } = await supabase
                    .from('marketplace_listings')
                    .select('title, price')
                    .eq('status', 'available')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (marketItems?.[0]) {
                    updates.push({
                        label: `Deal: ${marketItems[0].title} - ₹${marketItems[0].price}`,
                        icon: TrendingUp,
                        color: "text-amber-400"
                    });
                }

                // 4. UPCOMING EVENTS
                const { data: events } = await supabase
                    .from('events')
                    .select('title')
                    .gte('event_date', currentDate)
                    .order('event_date', { ascending: true })
                    .limit(1);

                if (events?.[0]) {
                    updates.push({
                        label: `Upcoming: ${events[0].title}`,
                        icon: Megaphone,
                        color: "text-sky-400"
                    });
                }

            } catch (err) {
                console.error("Trend fetch error:", err);
            }

            if (updates.length === 0) {
                updates.push({ label: "Welcome to AUConnect Network", icon: Sparkles, color: "text-primary" });
            }

            setTrends(updates);
        };

        const channel = supabase
            .channel('trending-ticker-pulse')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pulse_signals' }, () => {
                fetchTrends();
            })
            .subscribe();

        fetchTrends();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (trends.length <= 1) return;
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % trends.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [trends.length]);

    if (trends.length === 0) return null;

    const currentTrend = trends[index];
    const Icon = currentTrend.icon;

    return (
        <div className="relative group mx-4 mb-6">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-11 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center px-4 overflow-hidden">
                <div className={cn("flex items-center justify-center p-1.5 rounded-full mr-3 shrink-0 bg-white/5", currentTrend.color)}>
                    <Icon className="h-3.5 w-3.5 animate-pulse" />
                </div>

                <div className="flex-1 relative h-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={index}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className="absolute inset-0 flex items-center"
                        >
                            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-white/90 truncate pr-4">
                                {currentTrend.label}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="flex gap-1.5 shrink-0 ml-2">
                    {trends.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-1 h-1 rounded-full transition-all duration-500",
                                i === index ? "bg-primary w-3" : "bg-white/10"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
