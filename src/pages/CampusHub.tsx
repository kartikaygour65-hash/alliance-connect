import { useRef, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EventsView } from "@/components/campus/EventsView";
import { MessMenuView } from "@/components/campus/MessMenuView";
import { LeaderboardView } from "@/components/campus/LeaderboardView";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Calendar, UtensilsCrossed, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CampusHubProps {
    initialTab?: "events" | "mess" | "leaderboard";
}

export default function CampusHub({ initialTab: propInitialTab }: CampusHubProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    // Determine tab based on Prop (Route) OR Query Param
    const getTabFromUrl = () => {
        const tabParam = searchParams.get("tab");
        if (tabParam === "events" || tabParam === "mess" || tabParam === "leaderboard") return tabParam;
        return propInitialTab || "events";
    };

    const [activeTab, setActiveTab] = useState(getTabFromUrl());

    // Sync state when URL/Route changes
    useEffect(() => {
        const targetTab = getTabFromUrl();
        if (targetTab !== activeTab) {
            setActiveTab(targetTab);
            scrollToTab(targetTab);
        }
    }, [location.pathname, searchParams]);

    // Scroll to initial tab on mount with a slight delay to allow layout to settle
    useEffect(() => {
        const targetTab = getTabFromUrl();
        if (containerRef.current) {
            const index = targetTab === "mess" ? 1 : targetTab === "leaderboard" ? 2 : 0;
            setTimeout(() => {
                containerRef.current?.scrollTo({
                    left: index * (containerRef.current?.clientWidth || 0),
                    behavior: "instant"
                });
            }, 50);
        }
    }, []);

    // Update URL on scroll end
    const handleScroll = () => {
        if (!containerRef.current) return;
        const scrollLeft = containerRef.current.scrollLeft;
        const width = containerRef.current.clientWidth;
        const index = Math.round(scrollLeft / width);

        const newTab = index === 1 ? "mess" : index === 2 ? "leaderboard" : "events";
        if (newTab !== activeTab) {
            setActiveTab(newTab);
            // Update URL simply by pushing state to avoid full reload, OR replace history
            // Ideally we want the URL to match the tab, so we might want to navigate
            // but traversing history on scroll is bad UX. 
            // Instead, we just update the internal state and optionally the query param.
            // But if we are on /events and swipe to mess, should URL become /mess-menu?
            // That's complex. Let's keep it simple: Just update the visual state.
            // The floating nav buttons will do the hard navigation.
        }
    };

    const scrollToTab = (tab: "events" | "mess" | "leaderboard") => {
        if (!containerRef.current) return;
        const index = tab === "mess" ? 1 : tab === "leaderboard" ? 2 : 0;
        containerRef.current.scrollTo({
            left: index * containerRef.current.clientWidth,
            behavior: "smooth"
        });
        // We update local state immediately for responsiveness
        setActiveTab(tab);
    };

    // Helper to change route on click
    const handleTabClick = (tab: "events" | "mess" | "leaderboard") => {
        scrollToTab(tab);
        // Also update the route to match
        if (tab === "events") navigate("/events");
        if (tab === "mess") navigate("/mess-menu");
        if (tab === "leaderboard") navigate("/leaderboard");
    };

    return (
        <AppLayout disableScroll={true}>
            <div className="relative h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full overflow-hidden bg-black/90">

                {/* Floating Tab Bar */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center shadow-2xl">
                    <button
                        onClick={() => handleTabClick("events")}
                        className={cn("relative px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 group", activeTab === "events" ? "text-white" : "text-white/40 hover:text-white/80")}
                    >
                        {activeTab === "events" && <motion.div layoutId="bubble" className="absolute inset-0 bg-white/10 rounded-full border border-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                        <Calendar className="h-4 w-4 relative z-10" />
                        <span className="text-[10px] font-black uppercase tracking-widest relative z-10">Events</span>
                    </button>

                    <button
                        onClick={() => handleTabClick("mess")}
                        className={cn("relative px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 group", activeTab === "mess" ? "text-white" : "text-white/40 hover:text-white/80")}
                    >
                        {activeTab === "mess" && <motion.div layoutId="bubble" className="absolute inset-0 bg-white/10 rounded-full border border-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                        <UtensilsCrossed className="h-4 w-4 relative z-10" />
                        <span className="text-[10px] font-black uppercase tracking-widest relative z-10">Menu</span>
                    </button>

                    <button
                        onClick={() => handleTabClick("leaderboard")}
                        className={cn("relative px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 group", activeTab === "leaderboard" ? "text-white" : "text-white/40 hover:text-white/80")}
                    >
                        {activeTab === "leaderboard" && <motion.div layoutId="bubble" className="absolute inset-0 bg-white/10 rounded-full border border-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                        <Swords className="h-4 w-4 relative z-10" />
                        <span className="text-[10px] font-black uppercase tracking-widest relative z-10">Rank</span>
                    </button>
                </div>

                {/* Snap Container */}
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex flex-row w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide touch-pan-x"
                >
                    {/* Events Section */}
                    <div className="w-full min-w-full flex-shrink-0 h-full snap-center overflow-y-auto pb-32 pt-28 px-4 no-scrollbar">
                        <EventsView />
                    </div>

                    {/* Mess Menu Section */}
                    <div className="w-full min-w-full flex-shrink-0 h-full snap-center overflow-y-auto pb-32 pt-28 px-4 no-scrollbar">
                        <MessMenuView />
                    </div>

                    {/* Leaderboard Section */}
                    <div className="w-full min-w-full flex-shrink-0 h-full snap-center overflow-y-auto pb-32 pt-28 px-4 no-scrollbar">
                        <LeaderboardView />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
