import { useState, useEffect, useRef } from "react";
import { Heart, Trash2, MoreVertical, MessageCircle, Slash, AlertTriangle, Send, Play, Pause, Volume2, VolumeX, Sparkles, Timer, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toggleAura } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { getInitials, cn, censorText } from "@/lib/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { toast } from "sonner";
import { PostComments } from "@/components/feed/PostComments";
import { ShareModal } from "@/components/feed/ShareModal";
import { motion, AnimatePresence } from "framer-motion";
import { UserBadge } from "@/components/ui/UserBadge";

function CustomVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  // AUTO-PLAY LOGIC: Plays when scrolled into view, pauses when scrolled out
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => { }); // Catch autoplay restrictions silently
          setIsPlaying(true);
        } else {
          videoRef.current?.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 } // Needs 60% of video visible to play
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  return (
    <div ref={containerRef} className="relative group w-full bg-black flex flex-col items-center justify-center cursor-pointer overflow-hidden shadow-2xl" onClick={togglePlay}>
      {/* Dynamic Blurred Backdrop for aspect ratio filling */}
      <video
        src={src}
        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20"
        muted
        playsInline
      />

      <video
        ref={videoRef}
        src={src}
        className="relative z-10 w-full h-full max-h-[600px] object-contain shadow-2xl"
        playsInline
        muted={isMuted}
        loop
        onTimeUpdate={handleTimeUpdate}
      />
      {!isPlaying && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none">
          <div className="p-4 rounded-full bg-black/40 backdrop-blur-md text-white scale-110">
            <Play className="w-8 h-8 fill-white" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between pointer-events-none z-30">
        <button onClick={togglePlay} className="text-white hover:text-white/80 pointer-events-auto">
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
        </button>
        <div className="flex-1 mx-4 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all duration-100 rounded-full shadow-[0_0_10px_white]" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={toggleMute} className="text-white hover:text-white/80 pointer-events-auto">
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

export function PostCard({ post, onDeleted }: any) {
  const { user, profile } = useAuth();
  const [hasAura, setHasAura] = useState(!!post.has_aura);
  const [auraCount, setAuraCount] = useState(Number(post.aura_count) || 0);
  const [commentsEnabled, setCommentsEnabled] = useState(post.comments_enabled ?? true);
  const [isPinned, setIsPinned] = useState(post.is_pinned ?? false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // Double tap animation state
  const [lastTap, setLastTap] = useState(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  // Stealth Timer Logic
  useEffect(() => {
    if (!post.expires_at || !post.is_stealth) return;
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(post.expires_at).getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        if (onDeleted) onDeleted();
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };
    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [post.expires_at, post.is_stealth, onDeleted]);

  // Initial Aura Check & Realtime Subscription
  useEffect(() => {
    if (!user) return;

    // Only verify from DB if has_aura wasn't pre-fetched by getPosts/getUserPosts.
    // When has_aura is pre-fetched (boolean), we trust it. When it's undefined
    // (e.g. highlighted post fallback, or PostDetails), we query the DB.
    if (post.has_aura === undefined) {
      supabase
        .from("auras")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error) {
            setHasAura(!!data);
          }
        });
    }

    // Subscribe to count updates
    const channel = supabase.channel(`post_stats:${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `id=eq.${post.id}` }, (payload: any) => {
        if (payload.new) {
          setAuraCount(Number(payload.new.aura_count) || 0);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, post.id]);

  const handleAura = async () => {
    if (!user) return toast.error("Log in to give Aura");

    const prevStatus = hasAura;
    const prevCount = auraCount;

    // Optimistic Update
    setHasAura(!prevStatus);
    setAuraCount(prevCount + (prevStatus ? -1 : 1));

    // Use the tested toggleAura function from supabase.ts
    // It handles check-then-insert/delete with correct payload format
    const result = await toggleAura(user.id, post.id);

    if (result.error) {
      // Rollback optimistic update
      setHasAura(prevStatus);
      setAuraCount(prevCount);
      toast.error(prevStatus ? "Failed to remove Aura" : "Failed to give Aura");
      console.error("Aura toggle error:", result.error);
    } else {
      // Sync to actual server state
      setHasAura(result.action === 'added');
    }
  };

  // Double tap handler for the media container
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) { // 300ms window for double tap
      if (!hasAura) handleAura();
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
    }
    setLastTap(now);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleted(true);
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      toast.success("Broadcast Terminated");
      if (onDeleted) onDeleted();
    } catch (e) {
      setIsDeleted(false);
      toast.error("Deletion failed");
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const toggleComments = async () => {
    const nextState = !commentsEnabled;
    setCommentsEnabled(nextState);
    await supabase.from("posts").update({ comments_enabled: nextState }).eq("id", post.id);
    toast.success(nextState ? "Comments Enabled" : "Comments Disabled");
  };

  const handleTogglePin = async () => {
    try {
      const nextState = !isPinned;
      const { error } = await supabase
        .from("posts")
        .update({ is_pinned: nextState })
        .eq("id", post.id);

      if (error) throw error;
      setIsPinned(nextState);
      toast.success(nextState ? "Post Pinned to Network" : "Post Unpinned");
    } catch (e: any) {
      toast.error(e.message || "Failed to update pin status");
    }
  };

  const author = post.profiles || { username: 'user', full_name: 'AU User', avatar_url: '', total_aura: 0 };
  const isElite = (author.total_aura || 0) >= 500;
  const isStealth = post.is_stealth;

  const canPin = user?.email === 'carunbtech23@ced.alliance.edu.in' ||
    user?.email === 'auconnecx@gmail.com' ||
    user?.email === 'gkartikay23@ced.alliance.edu.in' ||
    user?.email === 'shlok24@ced.alliance.edu.in' ||
    profile?.role === 'admin';

  if (isDeleted) return null;

  return (
    <>
      <motion.div
        initial={isElite ? { y: 20, opacity: 0 } : { opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "super-card mb-8 transition-all duration-500 overflow-hidden relative",
          isElite && "ghost-mode-active",
          isStealth && "stealth-glitch"
        )}
      >
        {isElite && !isStealth && (
          <div className="absolute top-4 right-12 z-20">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </div>
        )}

        {isStealth && (
          <div className="absolute top-16 right-4 flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full z-20 whitespace-nowrap pointer-events-none">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]" />
            <span className="text-[10px] font-black text-red-500 tracking-tighter uppercase tabular-nums">
              BURN IN: {timeLeft}
            </span>
          </div>
        )}

        {isPinned && (
          <div className="absolute top-16 left-4 flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full z-20 whitespace-nowrap pointer-events-none">
            <Pin className="h-3 w-3 text-primary fill-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary tracking-tighter uppercase tabular-nums">
              PINNED BROADCAST
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 z-10 relative">
          <Link to={`/profile/${author.username}`} className="flex items-center gap-3 group">
            <div className={cn(
              "p-0.5 rounded-full bg-gradient-to-tr from-accent to-primary",
              isElite && "shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            )}>
              <Avatar className="h-10 w-10 border-2 border-black">
                <AvatarImage src={author.avatar_url} />
                <AvatarFallback>{getInitials(author.full_name)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              {/* ENHANCED: Username Pops with drop-shadow for heavy themes */}
              <div className="flex items-center gap-1.5">
                <p className="font-black text-[15px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:underline leading-none">
                  {author.full_name}
                </p>
                <UserBadge
                  role={author.role}
                  userId={author.user_id || post.user_id}
                  username={author.username}
                  isVerified={author.is_verified}
                  verifiedTitle={author.verified_title}
                  verificationExpiry={author.verification_expiry}
                />
              </div>
              <p className="text-[10px] text-white/90 font-black tracking-wide uppercase mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                @{author.username} • {isStealth ? "CLASSIFIED" : `${formatDistanceToNow(new Date(post.created_at))} ago`}
              </p>
            </div>
          </Link>
          {(user?.id === post.user_id || canPin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95 transition-all shadow-sm border border-white/5">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-black/90 backdrop-blur-xl border-black/5 dark:border-white/10 rounded-xl">
                {canPin && (
                  <DropdownMenuItem onClick={handleTogglePin} className="text-primary focus:text-primary font-bold">
                    <Pin className="h-4 w-4 mr-2" /> {isPinned ? "Unpin Post" : "Pin to Network"}
                  </DropdownMenuItem>
                )}
                {user?.id === post.user_id && (
                  <DropdownMenuItem onClick={toggleComments} className="text-zinc-900 dark:text-white">
                    <Slash className="h-4 w-4 mr-2" /> {commentsEnabled ? "Disable Comments" : "Enable Comments"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500 focus:text-red-500">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="space-y-4 relative z-10">
          {post.content && (
            /* ENHANCED: Post content now matches username brightness and visibility */
            <p className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap px-1 pt-2 font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
              isElite && "font-medium text-base",
              isStealth ? "text-red-500 font-mono italic" : ""
            )}>
              {censorText(post.content)}
            </p>
          )}

          {(post.is_thread && post.thread_items) || post.video_url || post.images?.[0] ? (
            <div
              className={cn(
                "rounded-[2rem] overflow-hidden border dark:border-white/5 border-black/5 bg-black shadow-inner relative group cursor-pointer",
                isStealth && "grayscale opacity-80"
              )}
              onClick={handleDoubleTap}
            >
              {/* Double Tap Heart Animation overlay */}
              <AnimatePresence>
                {showHeartAnimation && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 0.4, type: "spring" }}
                    className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none drop-shadow-2xl"
                  >
                    <Heart className="w-32 h-32 fill-red-500 text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]" />
                  </motion.div>
                )}
              </AnimatePresence>

              {post.is_thread ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {post.thread_items.map((item: any, idx: number) => (
                      <CarouselItem key={idx}>
                        {item.type === 'video' ? <CustomVideoPlayer src={item.url} /> : <img src={item.url} alt="Thread item" className="w-full object-contain max-h-[500px] bg-black/40" />}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {post.thread_items.length > 1 && <><CarouselPrevious className="hidden md:flex left-2" /><CarouselNext className="hidden md:flex right-2" /></>}
                </Carousel>
              ) : post.video_url ? (
                <CustomVideoPlayer src={post.video_url} />
              ) : (
                <img src={post.images[0]} alt="Post content" className="w-full object-contain max-h-[600px] bg-zinc-900/50" loading="lazy" />
              )}
            </div>
          ) : null}
        </div>

        {/* FROSTED GLASS ACTION BUTTONS */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t dark:border-white/5 border-black/5 relative z-20">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full h-10 px-4 gap-2 transition-all duration-300",
                "bg-black/30 dark:bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg flex flex-row items-center justify-center",
                /* FIXED: Tone down aura glow slightly */
                hasAura && "bg-red-500/10 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
              )}
              onClick={handleAura}
            >
              <Heart className={cn(
                "h-5 w-5 transition-transform duration-300",
                hasAura ? "fill-red-500 text-red-500 scale-110 drop-shadow-[0_0_2px_rgba(239,68,68,0.4)]" : "text-white scale-100 hover:scale-110"
              )} />
              <span className={cn("text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap", hasAura ? "text-red-500" : "text-white")}>
                {auraCount} Aura
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-10 px-4 gap-2 bg-black/30 dark:bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg hover:bg-black/50 transition-all flex flex-row items-center justify-center"
              disabled={!commentsEnabled}
              onClick={() => setShowComments(true)}
            >
              <MessageCircle className="h-5 w-5 hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">
                {post.comments_count || 0}
              </span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 bg-black/30 dark:bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg hover:bg-black/50 transition-all flex items-center justify-center"
            onClick={() => setShowShareModal(true)}
          >
            <Send className="h-5 w-5 -rotate-12 translate-y-[-1px] hover:scale-110 transition-transform" />
          </Button>
        </div>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass-card dark:border-white/10 border-black/5 dark:bg-black/95 bg-white rounded-[2rem] w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex gap-2 font-black italic items-center">
              <AlertTriangle className="h-5 w-5" /> TERMINATE BROADCAST?
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-white/60 text-zinc-500 text-xs md:text-sm uppercase font-bold tracking-widest leading-relaxed">
              This signal will be permanently erased from the network.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 rounded-xl border-none dark:bg-white/5 bg-black/5 text-current font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold uppercase text-[10px]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PostComments
        postId={post.id}
        open={showComments}
        onOpenChange={setShowComments}
        postOwnerId={post.user_id}
      />

      <ShareModal
        post={post}
        open={showShareModal}
        onOpenChange={setShowShareModal}
      />
    </>
  );
}