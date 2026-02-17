import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { getPosts, supabase } from "@/lib/supabase";
import { PostCard } from "./PostCard";
import { Button } from "@/components/ui/button";
import { CreatePost } from "./CreatePost";
import { AnimatePresence, motion } from "framer-motion";

export function Feed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedPostId = searchParams.get("post");

  const fetchFeed = async () => {
    setLoading(true);
    if (highlightedPostId) {
      const { data } = await supabase.from("posts").select("*, profiles(*)").eq("id", highlightedPostId).maybeSingle();
      if (data) {
        // Fetch aura status for the highlighted post too
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        let has_aura = false;
        if (currentUser) {
          const { data: auraData } = await supabase.from("auras").select("id").eq("post_id", data.id).eq("user_id", currentUser.id).maybeSingle();
          has_aura = !!auraData;
        }
        setPosts([{ ...data, aura_count: Number(data.aura_count) || 0, has_aura }]);
      } else {
        setPosts([]);
      }
    } else {
      // 1. Fetch Pinned Posts first
      const { data: pinnedData } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!user_id (
            username, full_name, avatar_url, role, is_verified, verified_title, verification_expiry, verification_status, is_private
          )
        `)
        .eq("is_pinned", true)
        .order("created_at", { ascending: false });

      // 2. Fetch Regular Feed
      const { data: regularData } = await getPosts(20, 0);

      const pinned = pinnedData || [];
      const regular = regularData || [];

      // 3. Deduplicate (Regular posts shouldn't repeat pinned ones)
      const pinnedIds = new Set(pinned.map(p => p.id));
      const filteredRegular = regular.filter(p => !pinnedIds.has(p.id));

      setPosts([...pinned, ...filteredRegular]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeed();

    // REAL-TIME: Listen for deletions (Stealth burns or manual deletes)
    const channel = supabase.channel('feed-realtime')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((current) => current.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        if (!highlightedPostId) fetchFeed();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        // If a post is pinned/unpinned, refresh feed
        if (payload.old.is_pinned !== payload.new.is_pinned) {
          fetchFeed();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [highlightedPostId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 w-full max-w-[600px] mx-auto">
      <div className="flex items-center justify-between px-2 pt-2">
        <h1 className="text-xl font-black italic uppercase tracking-tighter text-white/50">Alliance Network</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchFeed}
          disabled={loading}
          className="rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {!highlightedPostId && (
        <CreatePost onPostCreated={fetchFeed} />
      )}

      {posts.length === 0 ? (
        <div className="text-center py-16 px-6 glass-card rounded-[3rem] border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Welcome to the Network</h2>
          <p className="text-muted-foreground text-sm font-medium mb-8 max-w-xs mx-auto">
            Your feed is looking a bit quiet. Start by setting up your profile or follow some users to see what's happening.
          </p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button
              onClick={() => navigate('/profile?edit=true')}
              className="rounded-full h-12 bg-primary text-black font-black uppercase tracking-wider hover:scale-105 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)]"
            >
              Setup Your Profile
            </Button>
            <Button
              variant="ghost"
              onClick={fetchFeed}
              className="rounded-full h-12 text-muted-foreground font-bold uppercase text-[10px] tracking-widest hover:bg-white/5"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Feed
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <AnimatePresence mode="popLayout">
            {posts.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              >
                <PostCard post={p} onDeleted={fetchFeed} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}  