import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bookmark, Grid, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { SavedCollections } from "@/components/saved/SavedCollections";
import { PostCard } from "@/components/feed/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toggleAura as toggleAuraFn } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  images: string[] | null;
  aura_count: number | null;
  comments_count: number | null;
  hashtags: string[] | null;
  created_at: string;
  profiles: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function Saved() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"collections" | "posts">("collections");
  const [userAuras, setUserAuras] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchSavedPosts();
      fetchUserAuras();
    }
  }, [user, selectedCollection]);

  const fetchSavedPosts = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", user.id);

    if (selectedCollection) {
      query = query.eq("collection_id", selectedCollection);
    }

    const { data: savedData } = await query;

    if (!savedData || savedData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = savedData.map(s => s.post_id);

    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .in("id", postIds)
      .order("created_at", { ascending: false });

    if (postsData) {
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", userIds);

      // Batch-fetch aura status for saved posts
      const postIds = postsData.map(p => p.id);
      const { data: auraData } = await supabase
        .from("auras")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);

      const likedPostIds = new Set(auraData?.map(a => a.post_id) || []);
      setUserAuras(likedPostIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enrichedPosts = postsData.map(post => ({
        ...post,
        aura_count: Number(post.aura_count) || 0,
        has_aura: likedPostIds.has(post.id),
        profiles: profileMap.get(post.user_id) || null,
      }));

      setPosts(enrichedPosts);
    }

    setLoading(false);
  };

  const fetchUserAuras = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("auras")
      .select("post_id")
      .eq("user_id", user.id);

    if (data) {
      setUserAuras(new Set(data.map(a => a.post_id)));
    }
  };

  const handleToggleAura = async (postId: string) => {
    if (!user) return;

    const wasLiked = userAuras.has(postId);

    // Optimistic update
    setUserAuras(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });

    const result = await toggleAuraFn(user.id, postId);

    if (result.error) {
      // Rollback
      setUserAuras(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => viewMode === "posts" ? setViewMode("collections") : navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Saved</h1>
        </div>

        {viewMode === "collections" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SavedCollections
              onSelectCollection={(id) => {
                setSelectedCollection(id);
                setViewMode("posts");
              }}
              selectedCollection={selectedCollection}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <Bookmark className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No saved posts</h3>
                <p className="text-muted-foreground text-sm">
                  Posts you save will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onToggleAura={() => handleToggleAura(post.id)}
                    hasAura={userAuras.has(post.id)}
                    onDeleted={fetchSavedPosts}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
