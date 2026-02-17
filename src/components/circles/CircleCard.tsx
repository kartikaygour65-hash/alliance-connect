import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Lock, Globe, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  created_by: string;
}

interface CircleCardProps {
  circle: Circle;
  isMember: boolean;
  isPending?: boolean;
  onJoin: (circleId: string) => void;
  onLeave: (circleId: string) => void;
  onClick: (circleId: string) => void;
}

export function CircleCard({ circle, isMember, isPending, onJoin, onLeave, onClick }: CircleCardProps) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);

  const handleJoinLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setJoining(true);
    try {
      if (isMember) {
        await onLeave(circle.id);
      } else {
        await onJoin(circle.id);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(circle.id)}
      className="group relative aspect-[16/10] sm:aspect-[4/3] rounded-[32px] overflow-hidden cursor-pointer shadow-xl border-none"
    >
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        {circle.cover_url ? (
          <img
            src={circle.cover_url}
            alt={circle.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-primary via-purple-600 to-pink-500" />
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90" />
      </div>

      {/* Top Badges */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {circle.is_private && (
          <Badge variant="secondary" className="bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60">
            <Lock className="h-3 w-3 mr-1" /> Private
          </Badge>
        )}
      </div>

      {/* content */}
      <div className="absolute bottom-0 left-0 w-full p-6 z-20">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1 truncate leading-none">
              {circle.name}
            </h3>
            <div className="flex items-center gap-3 text-white/80">
              <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
                <Users className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{circle.member_count} Members</span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleJoinLeave}
            disabled={joining || isPending}
            className={`rounded-full px-5 h-10 font-black uppercase tracking-wider transition-all shadow-lg ${isMember
              ? "bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20"
              : isPending
                ? "bg-yellow-500/20 text-yellow-400 backdrop-blur-md border border-yellow-500/30 cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90 hover:scale-105"
              }`}
          >
            {joining ? (
              <span className="animate-pulse">...</span>
            ) : isMember ? (
              "Joined"
            ) : isPending ? (
              "Requested"
            ) : circle.is_private ? (
              "Request"
            ) : (
              "Join"
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
