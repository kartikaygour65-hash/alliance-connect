import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { validateComment, sanitizeField, commentLimiter, isRateLimited } from "@/lib/security";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id?: string;
}

interface ConfessionCommentsProps {
  confessionId: string | null;
  onClose: () => void;
  isAdmin?: boolean;
}

export function ConfessionComments({ confessionId, onClose, isAdmin }: ConfessionCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (confessionId) {
      fetchComments();
    }
  }, [confessionId]);

  async function fetchComments() {
    if (!confessionId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .select('id, content, created_at, user_id')
        .eq('confession_id', confessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Fetch Comments Error:", error);
      // Silently handle aborted signals or network glitches
      if (error.name !== 'AbortError') {
        toast.error("Network signal interrupted");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async () => {
    if (!user || !confessionId || !newComment.trim() || submitting) return;

    // SECURITY: Validate comment content
    const validation = validateComment(newComment);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit comments
    if (isRateLimited(commentLimiter, 'confession_comment')) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.from('confession_comments').insert({
        confession_id: confessionId,
        user_id: user.id,
        content: sanitizeField(newComment.trim(), 500)
      });

      if (error) {
        if (error.message?.includes('aborted')) {
          throw new Error("Transmission Aborted: Signal Lost");
        }
        throw error;
      }

      setNewComment('');
      fetchComments();
    } catch (error: any) {
      console.error("Post Comment Error:", error);
      toast.error(error.message || 'Transmission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .delete()
        .eq('id', commentId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Security Lock: Database blocked deletion. Run the SQL Panic Fix.");
      }

      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success("Comment purged successfully");
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.message || "Deletion failed. Check DB permissions.");
    }
  };

  return (
    <Sheet open={!!confessionId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] glass-card border-t border-white/10 outline-none">
        <SheetHeader className="pb-4 border-b border-white/10">
          <SheetTitle className="gradient-text font-black uppercase tracking-tighter italic">Anonymous Signal Threads</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 max-h-[calc(70vh-160px)] no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center opacity-30 py-20 flex flex-col items-center">
              <span className="text-4xl mb-4">🎭</span>
              <p className="font-black uppercase text-[10px] tracking-[0.3em]">Zero Signals Detected</p>
            </div>
          ) : (
            comments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex gap-3 group"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-xs">🎭</span>
                </div>
                <div className="flex-1 bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black theme-text uppercase tracking-widest">Anonymous</span>
                      <span className="text-[8px] text-white/30 uppercase font-bold">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {(isAdmin || user?.id === comment.user_id) && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-red-500/50 hover:text-red-500 transition-colors active:scale-95"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">{comment.content}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Comment input */}
        <div className="pt-4 border-t border-white/10 flex gap-2 pb-6">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a signal to the thread..."
            className="flex-1 bg-white/5 border-white/10 rounded-xl h-12 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            disabled={submitting}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="h-12 px-6 theme-bg rounded-xl"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
