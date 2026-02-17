import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Zap, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getInitials, cn } from "@/lib/utils";
import { supabase, getShareSuggestions } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CreateStoryModal } from "@/components/stories/CreateStoryModal";

export function ShareModal({ post, open, onOpenChange }: any) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [beaming, setBeaming] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      getShareSuggestions(user.id).then(({ data }) => {
        setUsers(data || []);
        setLoading(false);
      });
    }
  }, [open, user]);

  const handleSendDM = async (receiverId: string) => {
    if (sentTo.includes(receiverId)) return;

    try {
      // 1. Get or Create Conversation
      const { data: convId, error: convErr } = await supabase.rpc('get_or_create_conversation', {
        user1: user?.id,
        user2: receiverId
      });
      if (convErr) throw convErr;

      // 2. Send the Post (Ensuring shared_post_id is passed for the thumbnail)
      const { error: msgErr } = await supabase.from("direct_messages").insert({
        conversation_id: convId,
        sender_id: user?.id,
        content: "Shared a post",
        message_type: 'post_share',
        shared_post_id: post.id // CRITICAL FOR THUMBNAIL
      });
      if (msgErr) throw msgErr;

      setSentTo(prev => [...prev, receiverId]);
      toast.success("Signal Sent!");
    } catch (error: any) {
      console.error("Share DM Error:", error);
      toast.error(error?.message || "Transmission failed.");
    }
  };

  const handleBeam = async () => {
    // Instead of instant insert, open the story creator:
    setBeaming(true);
    // We'll reuse the 'beaming' state to trigger the modal viewing
  };

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Dialog open={open && !beaming} onOpenChange={onOpenChange}>
        {/* ... (keep existing DialogContent) ... */}
        <DialogContent className="z-[1100] max-w-md bg-zinc-950 border-white/10 p-0 overflow-hidden shadow-2xl rounded-[2.5rem]">
          <DialogHeader className="p-6 border-b border-white/5">
            <DialogTitle className="text-xl font-black italic uppercase theme-text tracking-tighter text-white">Share Signal</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <Button onClick={handleBeam} className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest gap-3 shadow-lg shadow-primary/20">
              <Zap className="w-5 h-5 fill-current" />
              Beam to Story
            </Button>

            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 opacity-30 text-white" />
              <Input placeholder="Search frequency..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl border-white/5 bg-white/5 pl-12 h-12 text-sm focus:bg-white/10 transition-all text-white" />
            </div>

            <div className="h-[300px] overflow-y-auto space-y-1 no-scrollbar">
              {filteredUsers.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-white/10">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-zinc-800 text-[10px] font-bold text-white">{getInitials(u.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">{u.full_name}</span>
                      <span className="text-[10px] font-bold opacity-40 uppercase tracking-tight text-white/60">@{u.username}</span>
                    </div>
                  </div>
                  <Button size="sm" variant={sentTo.includes(u.user_id) ? "outline" : "default"} onClick={() => handleSendDM(u.user_id)} className={cn("rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest", sentTo.includes(u.user_id) ? "border-white/10 text-white/40" : "bg-white text-black")}>
                    {sentTo.includes(u.user_id) ? "Sent" : "Send"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {beaming && (
        <CreateStoryModal
          open={beaming}
          onOpenChange={(open) => {
            setBeaming(open);
            if (!open) onOpenChange(false); // Close parent too if canceled
          }}
          onCreated={() => {
            setBeaming(false);
            onOpenChange(false);
          }}
          resharePost={post}
        />
      )}
    </>
  );
}