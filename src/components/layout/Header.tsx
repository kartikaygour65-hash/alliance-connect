import { useState, useEffect } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { MenuDrawer } from "./MenuDrawer";
import { PulseBeacon } from "./PulseBeacon"; 
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/lib/utils";

export function Header() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
  }, [user]);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-[100] bg-black/60 backdrop-blur-2xl border-b border-white/5 h-16 md:hidden"
    >
      <div className="relative w-full h-full flex items-center justify-between px-4">
        <MenuDrawer />

        {/* ABSOLUTE CENTER HUB */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <PulseBeacon />
          <Link to="/leaderboard">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-xs font-black italic tracking-tighter text-white uppercase pt-0.5">
                Rank #{profile?.rank || "99"}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="relative rounded-2xl">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Link to="/profile">
            <Avatar className="h-9 w-9 border border-white/10">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="theme-bg font-black text-[10px]">{getInitials(profile?.full_name)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}