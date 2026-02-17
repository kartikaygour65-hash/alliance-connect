import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface StoryRingProps {
  user?: { username: string | null; avatar_url: string | null; full_name: string | null; } | null;
  hasStory?: boolean;
  isSeen?: boolean;
  onClick?: () => void;
}

export function StoryRing({ user, hasStory = false, isSeen = false, onClick }: StoryRingProps) {
  if (!user) return null;

  // Grey for Seen, Gradient for Unseen
  const ringClass = hasStory
    ? isSeen
      ? "p-[2px] border-2 border-zinc-600"
      : "p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"
    : "p-[1px] border border-transparent";

  return (
    <div className="relative flex flex-col items-center gap-1 cursor-pointer">
      <motion.button whileTap={{ scale: 0.92 }} onClick={onClick} className={`relative w-16 h-16 rounded-full flex items-center justify-center ${ringClass}`}>
        <div className="bg-background rounded-full p-[2px] w-full h-full flex items-center justify-center">
          <Avatar className="object-cover w-[58px] h-[58px]">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback>{getInitials(user.full_name || user.username)}</AvatarFallback>
          </Avatar>
        </div>
      </motion.button>
      <span className={`text-[10px] font-bold truncate max-w-[70px] ${isSeen ? 'text-muted-foreground' : 'text-foreground'}`}>
        {user.username || "User"}
      </span>
    </div>
  );
}