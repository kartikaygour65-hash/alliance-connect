import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, X, SmilePlus, Reply as ReplyIcon, Trash2, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { createComment, getComments } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { getInitials, cn, censorText } from "@/lib/utils";
import { toast } from "sonner";

export function PostComments({ postId, open, onOpenChange, postOwnerId, onCommentAdded }: any) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const quickEmojis = ["🔥", "❤️", "😂", "😮", "🙌", "💯", "✨", "🫡"];

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data, error } = await getComments(postId);
    if (!error && data) {
      setComments(data.map((c: any) => ({
        ...c,
        profiles: c.profiles || { full_name: 'Unknown User', username: 'user' }
      })));
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    if (open && postId) {
      fetchComments();
      const channel = supabase.channel(`comments_${postId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, fetchComments)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [postId, open, fetchComments]);

  const handleSubmit = async (emoji?: string) => {
    const txt = emoji || content;
    if (!user || !postId || !txt.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          post_id: postId,
          content: censorText(txt.trim()),
          parent_id: replyTo?.id ?? null,
        })
        .select(`
        *,
        profiles:user_id (
          username,
          full_name,
          avatar_url
        )
      `)
        .single();

      if (error) throw error;

      // Update state & UI
      setComments(prev => [...prev, data]);
      setContent("");
      setReplyTo(null);
      if (onCommentAdded) onCommentAdded();
      toast.success("Commented");

    } catch (e: any) {
      console.error("Comment Error:", e);
      toast.error(e.message || "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Security Lock: Database blocked deletion. Row still exists.");
      }

      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success("Comment Removed");
    } catch (e: any) {
      console.error("Delete Error:", e);
      toast.error(e.message || "Failed to delete");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[1100] h-[85vh] rounded-t-[3rem] border-t border-white/10 bg-black/90 backdrop-blur-3xl p-0 flex flex-col outline-none shadow-2xl">
        <SheetHeader className="p-6 border-b border-white/5">
          <SheetTitle className="text-center font-black uppercase italic tracking-tighter text-xl theme-text">Comments</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary opacity-50" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center opacity-20 py-20 flex flex-col items-center">
              <SmilePlus className="mb-4 h-12 w-12" />
              <p className="font-black uppercase text-xs tracking-widest">Zero replies detected</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className={cn("flex gap-4 group", c.parent_id && "ml-10 border-l border-white/5 pl-4")}>
                <Avatar className="h-9 w-9 border border-white/10">
                  <AvatarImage src={c.profiles?.avatar_url} />
                  <AvatarFallback className="theme-bg">{getInitials(c.profiles?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between bg-white/5 p-4 rounded-3xl rounded-tl-none border border-white/5">
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest theme-text mb-1">@{c.profiles?.username}</p>
                      <p className="text-sm text-white/90 leading-relaxed font-medium">{c.content}</p>
                    </div>
                    {/* DELETE/OPTIONS (INSTA STYLE) */}
                    {(
                      user?.id === c.user_id ||
                      profile?.role === 'admin' ||
                      profile?.role === 'developer' ||
                      [
                        'carunbtech23@ced.alliance.edu.in',
                        'gkartikaybtech23@ced.alliance.edu.in',
                        'sshlok@ced.alliance.edu.in',
                        'aateef@ced.alliance.edu.in',
                        'sshlokbtech23@ced.alliance.edu.in',
                        'aateefbtech23@ced.alliance.edu.in'
                      ].includes(user?.email || '')
                    ) && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1 ml-2 opacity-30 hover:opacity-100 hover:text-red-500 transition-all active:scale-90"
                          title="Delete Comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                  </div>
                  <div className="flex gap-4 px-2 text-[10px] font-black uppercase tracking-widest opacity-30 mt-1">
                    <span>{formatDistanceToNow(new Date(c.created_at))}</span>
                    <button onClick={() => setReplyTo({ id: c.id, username: c.profiles?.username })} className="hover:text-primary">Reply</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* INPUT DOCK */}
        <div className="p-6 bg-black/60 border-t border-white/5 pb-10 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          {replyTo && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <ReplyIcon className="h-3 w-3" /> Replying to @{replyTo.username}
              </p>
              <button onClick={() => setReplyTo(null)} className="opacity-50 hover:opacity-100 p-1"><X className="h-4 w-4" /></button>
            </div>
          )}

          <div className="flex gap-3 justify-center overflow-x-auto no-scrollbar">
            {quickEmojis.map(e => (
              <button key={e} onClick={() => handleSubmit(e)} className="text-2xl hover:scale-125 transition-transform active:scale-90">{e}</button>
            ))}
          </div>

          <div className="flex gap-2 relative">
            <Input
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={replyTo ? `Add a reply...` : "Add a comment..."}
              className="rounded-2xl border-white/10 bg-white/5 h-14 pr-14 text-sm placeholder:opacity-20"
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={submitting || !content.trim()}
              className="absolute right-2 top-2 h-10 w-10 rounded-xl theme-bg shadow-lg shadow-primary/20"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}