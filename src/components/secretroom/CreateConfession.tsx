import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { validateConfession, sanitizeField, confessionLimiter, isRateLimited } from "@/lib/security";

interface CreateConfessionProps {
  onCreated: () => void;
}

export function CreateConfession({ onCreated }: CreateConfessionProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;

    // SECURITY: Validate confession content
    const validation = validateConfession(content);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit confessions
    if (isRateLimited(confessionLimiter, 'create_confession')) return;

    setLoading(true);

    try {
      const { error } = await supabase.from('confessions').insert({
        user_id: user.id,
        content: sanitizeField(content.trim(), 1000)
      });

      if (error) throw error;

      toast.success('Confession posted anonymously');
      setContent('');
      onCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post confession');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 rounded-2xl mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
          <span className="text-sm">🎭</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          Posting as Anonymous
        </span>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your confession... Your identity is completely hidden."
        className="min-h-[100px] bg-secondary/30 border-white/10 resize-none mb-3"
        maxLength={1000}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length}/1000 characters
        </span>
        <Button
          onClick={handleSubmit}
          disabled={loading || !content.trim()}
          className="bg-gradient-primary hover:opacity-90"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post Anonymously
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
