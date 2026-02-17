import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Image, Loader2, Send, Heart, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { uploadMultipleFiles } from "@/lib/storage";
import { getInitials } from "@/lib/utils";

interface CirclePost {
  id: string;
  content: string | null;
  images: string[] | null;
  aura_count: number;
  comments_count: number;
  created_at: string;
  user_id: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
    full_name: string | null;
  };
}

interface CircleFeedProps {
  circleId: string;
  isMember: boolean;
  isAdmin: boolean;
}

export function CircleFeed({ circleId, isMember, isAdmin }: CircleFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const POSTS_PER_PAGE = 10;

  const fetchPosts = useCallback(async (pageNumber = 0) => {
    try {
      const from = pageNumber * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data: postsData, error } = await supabase
        .from('circle_posts')
        .select('*')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (postsData) {
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url, full_name')
          .in('user_id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const postsWithProfiles = postsData.map(p => ({
          ...p,
          profile: profilesMap.get(p.user_id)
        }));

        if (pageNumber === 0) {
          setPosts(postsWithProfiles);
        } else {
          setPosts(prev => [...prev, ...postsWithProfiles]);
        }

        if (postsData.length < POSTS_PER_PAGE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (error) {
      console.error("Error fetching circle posts:", error);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [circleId]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0);
  }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel(`circle-posts-${circleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'circle_posts',
        filter: `circle_id=eq.${circleId}`
      }, () => {
        fetchPosts(0); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId, fetchPosts]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPosts(nextPage);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 4));
  };

  const handlePost = async () => {
    if (!user || (!content.trim() && images.length === 0)) return;

    setPosting(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        const { urls } = await uploadMultipleFiles('circles', images, user.id);
        imageUrls = urls;
      }

      const { error } = await supabase.from('circle_posts').insert({
        circle_id: circleId,
        user_id: user.id,
        content: content.trim() || null,
        images: imageUrls.length > 0 ? imageUrls : null
      });

      if (error) throw error;

      setContent('');
      setImages([]);
      toast.success('Posted!');
      fetchPosts(0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('circle_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    // FIX 1: Max width constraint to mimic mobile feed on desktop
    <div className="max-w-lg mx-auto space-y-4">
      {/* Create post */}
      {isMember && (
        <div className="glass-card p-4 rounded-2xl space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with the circle..."
            className="bg-secondary/30 resize-none"
            rows={3}
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Image className="h-5 w-5" />
                  {images.length > 0 && <span>{images.length} selected</span>}
                </div>
              </label>
            </div>
            
            <Button
              onClick={handlePost}
              disabled={posting || (!content.trim() && images.length === 0)}
              size="sm"
              className="bg-gradient-primary"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Post</span>
            </Button>
          </div>
        </div>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No posts yet. Be the first to share!
        </div>
      ) : (
        <>
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4 rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={post.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(post.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {post.profile?.full_name || post.profile?.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {(post.user_id === user?.id || isAdmin) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDelete(post.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Content */}
              {post.content && (
                <p className="text-sm mb-3 whitespace-pre-wrap">{post.content}</p>
              )}

              {/* Images - FIX 2: Instagram Style (Square + Cover) */}
              {post.images && post.images.length > 0 && (
                <div className={`grid gap-1 mb-3 rounded-lg overflow-hidden ${
                  post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}>
                  {post.images.map((img, i) => (
                    <div key={i} className="aspect-square relative bg-secondary/20">
                      <img
                        src={img}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  {post.aura_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {post.comments_count || 0}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Posts'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}