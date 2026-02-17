import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Flag, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ConfessionCardProps {
  confession: {
    id: string;
    content: string;
    aura_count: number;
    comments_count: number;
    is_highlighted: boolean;
    created_at: string;
  };
  hasAura: boolean;
  onToggleAura: (id: string) => void;
  onComment: (id: string) => void;
  onReport: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

export function ConfessionCard({
  confession,
  hasAura,
  onToggleAura,
  onComment,
  onReport,
  onDelete,
  isAdmin
}: ConfessionCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleAuraClick = () => {
    setIsAnimating(true);
    onToggleAura(confession.id);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-4 rounded-2xl ${confession.is_highlighted
        ? 'bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 border border-primary/30'
        : 'glass-card'
        }`}
    >
      {confession.is_highlighted && (
        <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-medium flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Daily Highlight
        </div>
      )}

      {/* Anonymous label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
          <span className="text-sm">🎭</span>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Anonymous</p>
          <p className="text-xs text-muted-foreground/70">
            {formatDistanceToNow(new Date(confession.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Content */}
      <p className="text-foreground mb-4 whitespace-pre-wrap">{confession.content}</p>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleAuraClick}
            className="flex items-center gap-1.5 group"
          >
            <motion.div
              animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
              className={`p-1.5 rounded-full transition-colors ${hasAura
                ? 'bg-pink-500/20 text-pink-500'
                : 'bg-secondary/50 text-muted-foreground group-hover:text-pink-500'
                }`}
            >
              <Heart className={`h-4 w-4 ${hasAura ? 'fill-current' : ''}`} />
            </motion.div>
            <span className={`text-sm ${hasAura ? 'text-pink-500 font-medium' : 'text-muted-foreground'}`}>
              {confession.aura_count}
            </span>
          </motion.button>

          <button
            onClick={() => onComment(confession.id)}
            className="flex items-center gap-1.5 group"
          >
            <div className="p-1.5 rounded-full bg-secondary/50 text-muted-foreground group-hover:text-primary transition-colors">
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="text-sm text-muted-foreground">{confession.comments_count}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReport(confession.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Flag className="h-4 w-4" />
          </Button>

          {isAdmin && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(confession.id)}
              className="text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
