import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Trash2, Heart, Eye, ChevronRight, Send, Loader2, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StoryViewerProps {
  users: any[];
  initialUserIndex: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function StoryViewer({ users, initialUserIndex, onClose, onRefresh }: StoryViewerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [realtimeViewCount, setRealtimeViewCount] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mentionProfiles, setMentionProfiles] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);

  const currentUser = users[userIndex];
  const currentStory = currentUser?.stories[storyIndex];

  if (!currentUser || !currentStory) return null;

  const isOwnStory = currentStory?.user_id === user?.id;
  const isBeam = !!(currentStory?.is_beam && currentStory?.post);
  const post = currentStory?.post;
  const storyMedia = isBeam ? (post?.images?.[0] || post?.video_url) : currentStory?.media_url;
  const isVideo = currentStory?.media_type === 'video' || (isBeam && post?.video_url);
  const isTextStory = currentStory?.media_type === 'text' || (!storyMedia && currentStory?.content);

  const handleNext = useCallback(() => {
    if (storyIndex < currentUser.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (userIndex < users.length - 1) {
      setUserIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, userIndex, users.length, currentUser.stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      const prevIdx = userIndex - 1;
      setUserIndex(prevIdx);
      setStoryIndex(users[prevIdx].stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, userIndex, users]);

  useEffect(() => {
    if (!user || !currentStory) return;
    setLiked(false);
    supabase.from('story_likes').select('id').eq('story_id', currentStory.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [userIndex, storyIndex, user, currentStory]);

  // Reset mute state when story changes
  useEffect(() => {
    setIsMuted(true);
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  }, [currentStory?.id]);

  // Load mention profiles for stories that have mentions
  useEffect(() => {
    const loadMentions = async () => {
      const ids = currentStory?.mentions;
      if (!ids || ids.length === 0) {
        setMentionProfiles([]);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', ids);
      if (error) {
        console.error('Mention profiles error', error);
        setMentionProfiles([]);
        return;
      }
      setMentionProfiles(data || []);
    };

    loadMentions();
  }, [currentStory?.id, currentStory?.mentions]);

  useEffect(() => {
    if (isPaused || !currentStory) return;
    const duration = isVideo
      ? (videoDuration ? videoDuration * 1000 : 15000)
      : (currentStory.duration ? currentStory.duration * 1000 : 5000);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { handleNext(); return 0; }
        return prev + (100 / (duration / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, currentStory, videoDuration, isVideo, handleNext]);

  // Track a view when someone else watches this story
  useEffect(() => {
    if (!currentStory || !user || currentStory.user_id === user.id) return;

    const timer = setTimeout(() => {
      supabase
        .from('story_views')
        .insert({ story_id: currentStory.id, viewer_id: user.id })
        .then(({ error }) => {
          if (error && (error as any).code !== '23505') {
            console.error('View error', error);
          }
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [currentStory?.id, user]);

  // Fetch viewers + who liked for own stories
  const fetchViewers = useCallback(async () => {
    if (!currentStory || !isOwnStory) return;

    const { data: viewsData, error: viewsError } = await supabase
      .from('story_views')
      .select('id, viewer_id, viewed_at')
      .eq('story_id', currentStory.id)
      .order('viewed_at', { ascending: false });

    if (viewsError) {
      console.error('Fetch viewers error', viewsError);
      setViewers([]);
      setRealtimeViewCount(currentStory.view_count || 0);
      return;
    }

    const safeViews = viewsData || [];
    setRealtimeViewCount(safeViews.length || currentStory.view_count || 0);

    const viewerIds = safeViews.map(v => v.viewer_id);
    if (viewerIds.length === 0) {
      setViewers([]);
      return;
    }

    const [{ data: profilesData }, { data: likesData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', viewerIds),
      supabase
        .from('story_likes')
        .select('user_id')
        .eq('story_id', currentStory.id)
    ]);

    const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
    const likerIds = new Set((likesData || []).map((l: any) => l.user_id));

    setViewers(
      safeViews.map(v => ({
        ...v,
        hasLiked: likerIds.has(v.viewer_id),
        profile: profileMap.get(v.viewer_id) || { username: 'Unknown', avatar_url: null }
      }))
    );
  }, [currentStory, isOwnStory]);

  // Keep viewers list updated while owner is viewing their own story
  useEffect(() => {
    if (!currentStory || !isOwnStory) return;

    setRealtimeViewCount(currentStory.view_count || 0);
    fetchViewers();

    const channel = supabase
      .channel(`story_views:${currentStory.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'story_views',
          filter: `story_id=eq.${currentStory.id}`
        },
        () => {
          fetchViewers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStory?.id, isOwnStory, fetchViewers]);

  // Lazy-load viewers when the sheet is opened
  useEffect(() => {
    if (showViewers) {
      fetchViewers();
    }
  }, [showViewers, fetchViewers]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !user || isSendingReply) return;
    setIsSendingReply(true);

    try {
      const { data: convs, error: fetchError } = await supabase.from('conversations').select('*');
      if (fetchError) throw fetchError;

      const conv = convs?.find(c => {
        const values = Object.values(c);
        return values.includes(user.id) && values.includes(currentStory.user_id);
      });

      if (!conv) {
        toast.error("Start a normal chat with this user first!");
        setIsSendingReply(false);
        return;
      }

      const { error: insertError } = await supabase.from('direct_messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: `Replied to your story: ${replyText}`,
        media_url: storyMedia || null,
        message_type: isVideo ? 'video' : 'image'
      });

      if (insertError) throw insertError;

      await supabase.from('conversations').update({
        last_message: `Story Reply: ${replyText}`,
        last_message_at: new Date().toISOString()
      }).eq('id', conv.id);

      toast.success("Reply sent");
      setReplyText('');
      setIsPaused(false);
    } catch (e: any) {
      console.error("DM ERROR:", e);
      toast.error("Failed to send reply. Please check your connection.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleLike = async () => {
    if (!user || !currentStory) return;
    const newStatus = !liked;
    setLiked(newStatus);
    if (newStatus) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
      await supabase.from('story_likes').upsert({ user_id: user.id, story_id: currentStory.id });

      // Send notification to story owner (not for own stories)
      if (currentStory.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: currentStory.user_id,
          type: 'story_like',
          title: 'Story Like',
          body: 'liked your story',
          data: {
            user_id: user.id,
            story_id: currentStory.id,
            story_thumbnail: storyMedia || null,
          },
          is_read: false,
        }).then(({ error }) => {
          if (error) console.error('Story like notification error:', error);
        });
      }
    } else {
      await supabase.from('story_likes').delete().eq('user_id', user.id).eq('story_id', currentStory.id);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isVideo || !videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
    if (!next) {
      // Ensure playback continues after unmuting (required on some mobile browsers)
      videoRef.current.play().catch(() => { });
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    const { error } = await supabase.from('stories').delete().eq('id', currentStory.id);
    if (error) {
      console.error("Delete story error", error);
      toast.error("Failed to delete story.");
      return;
    }
    toast.success("Story deleted.");
    onRefresh();
    onClose();
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black z-[99999] flex items-center justify-center backdrop-blur-md">
      <div className="relative w-full md:max-w-[420px] h-full md:h-[88vh] bg-black md:rounded-[32px] overflow-hidden border border-white/10 shadow-2xl" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)}>

        {/* NAV TAPS - Split 30/70 */}
        <div className="absolute inset-0 z-30 flex">
          <div className="w-[30%] h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="w-[70%] h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
        </div>

        {/* PROGRESS BARS */}
        <div className="absolute top-10 inset-x-0 px-4 flex gap-1.5 z-[60] pointer-events-none">
          {currentUser.stories.map((_: any, i: number) => (
            <div key={i} className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white shadow-[0_0_8px_white]" style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* HEADER AREA */}
        <div className="absolute top-0 inset-x-0 p-4 pt-14 z-[60] flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto cursor-pointer" onClick={() => { onClose(); navigate(`/profile/${currentUser.username}`); }}>
            <Avatar className="h-9 w-9 border border-white/20"><AvatarImage src={currentUser.avatarUrl} /><AvatarFallback>{currentUser.username[0]}</AvatarFallback></Avatar>
            <span className="text-white font-bold text-sm drop-shadow-md">{currentUser.username}</span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            {isVideo && !isTextStory && (
              <button
                onClick={toggleMute}
                className="p-2 text-white/80 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            {isOwnStory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-2 text-white/80 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 text-white">
              <X />
            </button>
          </div>
        </div>

        {/* MEDIA / TEXT DISPLAY (Z-20 Container) */}
        <div
          className="w-full h-full flex items-center justify-center bg-zinc-950 relative z-20"
          style={{ background: currentStory.background_color || '#09090b' }}
        >
          {isTextStory ? (
            <div
              className="w-[85%] h-[60%] rounded-[28px] border border-white/10 flex items-center justify-center px-6 text-center"
              style={{ background: currentStory.background_color || '#000000' }}
            >
              <p className="text-white text-3xl md:text-4xl font-bold leading-relaxed break-words">
                {currentStory.content}
              </p>
            </div>
          ) : (
            <div className={cn("relative flex items-center justify-center transition-all duration-500 overflow-hidden", isBeam ? "w-[85%] h-[60%] rounded-[28px] border border-white/10" : "w-full h-full")}>
              {isBeam && post?.profiles?.username && (
                <div className="absolute top-4 left-4 z-[70] flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <Avatar className="h-5 w-5 border border-white/20">
                    <AvatarImage src={post.profiles.avatar_url || ""} />
                    <AvatarFallback>{post.profiles.username?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-semibold text-white">@{post.profiles.username}</span>
                </div>
              )}

              {mentionProfiles.length > 0 && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[70] flex flex-wrap justify-center gap-2">
                  {mentionProfiles.map((m: any) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
                    >
                      <span className="text-[11px] font-semibold text-white">@{m.username}</span>
                    </div>
                  ))}
                </div>
              )}

              {isVideo ? (
                <video
                  ref={videoRef}
                  src={storyMedia}
                  autoPlay
                  playsInline
                  loop
                  muted={isMuted}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                />
              ) : (
                <img src={storyMedia} className="w-full h-full object-contain" />
              )}

              {/* CAPTION OVERLAY FOR MEDIA STORIES */}
              {currentStory.content && (
                <div className="absolute bottom-24 inset-x-0 px-6 z-[75] flex justify-center pointer-events-none">
                  <p className="text-white text-lg font-bold text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-tight max-w-[90%]">
                    {currentStory.content}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🔥 FIX: VISIT POST BUTTON MOVED OUTSIDE THE Z-20 CONTAINER 🔥 */}
        {isBeam && !showViewers && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); navigate(`/post/${currentStory.post_id}`); }}
            className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-3.5 rounded-full font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all z-[100] flex items-center gap-2 pointer-events-auto cursor-pointer"
          >
            Visit Post <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* FOOTER AREA */}
        <div className="absolute bottom-0 inset-x-0 p-5 pb-10 bg-gradient-to-t from-black/90 to-transparent z-[60] flex items-center gap-4">
          {!isOwnStory ? (
            <div className="flex items-center gap-4 w-full pointer-events-auto">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply...`}
                className="flex-1 bg-white/10 border-none text-white rounded-full h-12 px-6"
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
              />
              <button onClick={handleSendReply} className="text-purple-500" disabled={isSendingReply || !replyText.trim()}>
                {isSendingReply ? <Loader2 className="animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleLike(); }} className={cn("transition-transform active:scale-75", liked ? "text-purple-500" : "text-white")}>
                <Heart className={cn("w-6 h-6", liked ? "fill-current" : "")} />
              </button>
            </div>
          ) : (
            <div className="flex w-full justify-end pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewers(true);
                  setIsPaused(true);
                }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2 rounded-full"
              >
                <Eye className="w-5 h-5" />
                <span className="font-medium">
                  {realtimeViewCount} view{realtimeViewCount === 1 ? '' : 's'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* VIEWERS LIST (Own Story Only) */}
        {isOwnStory && showViewers && (
          <div
            className="absolute inset-0 bg-black/60 z-[110] flex items-end md:items-center justify-center"
            onClick={() => {
              setShowViewers(false);
              setIsPaused(false);
            }}
          >
            <div
              className="w-full max-w-md max-h-[60vh] bg-zinc-900/95 rounded-t-3xl md:rounded-3xl p-4 pt-3 border border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-white/70" />
                  <span className="text-sm font-semibold text-white">
                    {realtimeViewCount} view{realtimeViewCount === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowViewers(false);
                    setIsPaused(false);
                  }}
                  className="p-1 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {viewers.length === 0 ? (
                  <p className="text-xs text-white/60">No viewers yet.</p>
                ) : (
                  viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={viewer.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {viewer.profile?.username?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm text-white">
                            {viewer.profile?.username || 'Unknown'}
                          </span>
                          {viewer.viewed_at && (
                            <span className="text-[10px] text-white/50">
                              {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      {viewer.hasLiked && (
                        <Heart className="w-4 h-4 text-purple-500 fill-purple-500" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION (Own Story Only) */}
        {isOwnStory && showDeleteConfirm && (
          <div className="absolute top-20 inset-x-0 z-[90] flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-black/90 border border-red-500/40 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
              <span className="text-xs text-white/90">Delete this story?</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="text-xs px-3 py-1 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                  handleDeleteStory();
                }}
                className="text-xs px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* HEART ANIMATION */}
        <AnimatePresence>
          {showHeartAnim && (
            <motion.div initial={{ opacity: 0, scale: 0.5, y: 0 }} animate={{ opacity: 1, scale: 2.5, y: -100 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
              <Heart className="w-20 h-20 fill-purple-500 text-purple-500 drop-shadow-[0_0_20px_purple]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body
  );
}