import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, VolumeX, Volume2, Play, ArrowLeft, Loader2, Trash2, Ghost } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toggleAura } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { ShareModal } from "@/components/feed/ShareModal";
import { PostComments } from "@/components/feed/PostComments";

export default function Reels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get("start");

  const [reels, setReels] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());

  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [showHeart, setShowHeart] = useState<{ id: string; x: number; y: number } | null>(null);

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    fetchReels();
    if (user) fetchUserLikes();
  }, [user]);

  const fetchReels = async () => {
    try {
      setIsInitialLoading(true);
      // FIX: Explicit Join 'profiles!user_id' prevents "Ambiguous Relationship" error
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!user_id ( username, full_name, avatar_url )
        `)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setReels(data);
        if (startId) {
          const index = data.findIndex(r => r.id === startId);
          if (index !== -1) {
            setCurrentIndex(index);
            setTimeout(() => {
              document.getElementById(`reel-${startId}`)?.scrollIntoView({ behavior: 'auto' });
            }, 150);
          }
        }
      }
    } catch (err) {
      console.error("Reel error:", err);
      toast.error("Signal Lost. Check Database.");
    } finally {
      setIsInitialLoading(false);
    }
  };

  const fetchUserLikes = async () => {
    if (!user) return;
    const { data } = await supabase.from("auras").select("post_id").eq("user_id", user.id);
    if (data) setLikedReels(new Set(data.map(a => a.post_id)));
  };

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      const reelId = entry.target.id.replace('reel-', '');
      const video = videoRefs.current.get(reelId);
      if (video) {
        if (entry.isIntersecting) {
          setCurrentIndex(reels.findIndex(r => r.id === reelId));
          video.muted = isMuted;
          if (!isPaused) video.play().catch(() => { });
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.8 });
    document.querySelectorAll('.reel-video-container').forEach(el => observer.observe(el));

    // REAL-TIME AURA SYNC: Listen for aura_count updates on the posts table
    const channel = supabase.channel('reels_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload: any) => {
        setReels(prev => prev.map(r =>
          r.id === payload.new.id ? { ...r, aura_count: payload.new.aura_count } : r
        ));
      })
      .subscribe();

    return () => {
      observer.disconnect();
      supabase.removeChannel(channel);
    };
  }, [reels, isMuted, isPaused]);

  const handleAura = async (reelId: string, x?: number, y?: number) => {
    if (!user) return toast.error("Sign in to give Aura");

    if (x && y) {
      setShowHeart({ id: Math.random().toString(), x, y });
      setTimeout(() => setShowHeart(null), 800);
    }

    const isLiked = likedReels.has(reelId);

    // Optimistic update
    setLikedReels(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(reelId) : next.add(reelId);
      return next;
    });
    setReels(prev => prev.map(r => {
      if (r.id === reelId) {
        return { ...r, aura_count: (r.aura_count || 0) + (isLiked ? -1 : 1) };
      }
      return r;
    }));

    // Use the tested toggleAura function
    const result = await toggleAura(user.id, reelId);

    if (result.error) {
      // Rollback on failure
      setLikedReels(prev => {
        const next = new Set(prev);
        isLiked ? next.add(reelId) : next.delete(reelId);
        return next;
      });
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          return { ...r, aura_count: (r.aura_count || 0) + (isLiked ? 1 : -1) };
        }
        return r;
      }));
      toast.error("Failed to toggle Aura");
    }
  };

  if (isInitialLoading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  if (reels.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-center p-10">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <Play className="w-10 h-10 text-white/20" />
        </div>
        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">No Reels Broadcasted</h2>
        <p className="text-white/40 text-sm max-w-xs">Be the first to upload a video to the network!</p>
        <Button onClick={() => navigate(-1)} variant="ghost" className="mt-8 text-white/60 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden flex justify-center selection:bg-primary/30">
      <div className="fixed top-0 inset-x-0 z-[60] p-4 md:p-6 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/20 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <span className="text-white font-black italic tracking-tighter uppercase text-xl md:text-2xl drop-shadow-2xl">Reels</span>
        <div className="w-10" />
      </div>

      <div ref={scrollRef} className="h-full w-full max-w-[500px] snap-y snap-mandatory overflow-y-scroll scrollbar-hide bg-black relative">
        {reels.map((reel) => (
          <div key={reel.id} id={`reel-${reel.id}`} className="reel-video-container h-full w-full relative snap-start snap-always">
            {/* Premium Video Display: Blurred Backdrop + Contained Video */}
            <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
              {/* Blurred Background Layer (Shadow/Fill) */}
              <video
                src={reel.video_url}
                className="absolute inset-0 h-full w-full object-cover blur-3xl opacity-40 scale-150 rotate-3 grayscale"
                muted
                playsInline
                loop
              />

              {/* Primary Video Layer (No Cut) */}
              <video
                ref={(el) => el && videoRefs.current.set(reel.id, el)}
                src={reel.video_url}
                className="relative z-10 w-full h-full object-contain"
                loop
                playsInline
                muted={isMuted}
                onClick={() => setIsPaused(!isPaused)}
                onDoubleClick={(e) => handleAura(reel.id, e.clientX, e.clientY)}
              />
            </div>
            {/* Sidebar & Info Logic */}
            <div className="absolute right-3 md:right-4 bottom-28 md:bottom-24 flex flex-col gap-7 md:gap-8 z-40 scale-105 md:scale-100">
              <div className="flex flex-col items-center gap-1.5">
                <Button onClick={() => handleAura(reel.id)} variant="ghost" className={cn("h-12 w-12 rounded-full bg-black/40 backdrop-blur-lg border border-white/10 shadow-2xl transition-all active:scale-90", likedReels.has(reel.id) && "bg-red-500/20")}>
                  <Heart className={cn("h-7 w-7", likedReels.has(reel.id) ? "text-red-500 fill-current" : "text-white")} />
                </Button>
                <span className="text-white text-[10px] font-black drop-shadow-md">{reel.aura_count || 0}</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button onClick={() => { setSelectedReel(reel); setShowComments(true); }} variant="ghost" className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-lg border border-white/10 shadow-2xl active:scale-90 transition-all">
                  <MessageCircle className="text-white h-7 w-7" />
                </Button>
                <span className="text-white text-[10px] font-black drop-shadow-md">{reel.comments_count || 0}</span>
              </div>
              <Button onClick={() => { setSelectedReel(reel); setShowShareModal(true); }} variant="ghost" className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-lg border border-white/10 shadow-2xl active:scale-90 transition-all">
                <Send className="text-white h-6 w-6 -rotate-12" />
              </Button>
              <Button onClick={() => setIsMuted(!isMuted)} variant="ghost" className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-lg border border-white/10 shadow-2xl active:scale-90 transition-all">
                {isMuted ? <VolumeX className="text-white h-6 w-6" /> : <Volume2 className="text-white h-6 w-6" />}
              </Button>
            </div>
            <div className="absolute bottom-8 left-4 right-16 z-40">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10 border-2 border-white/30"><AvatarImage src={reel.profiles?.avatar_url} /><AvatarFallback>{getInitials(reel.profiles?.full_name)}</AvatarFallback></Avatar>
                <span className="text-white font-black uppercase italic tracking-tighter">@{reel.profiles?.username}</span>
              </div>
              <p className="text-white/90 text-sm font-medium line-clamp-2">{reel.content}</p>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showHeart && <motion.div key={showHeart.id} initial={{ scale: 0 }} animate={{ scale: 1.5 }} exit={{ scale: 2, opacity: 0, y: -80 }} className="fixed z-[100] pointer-events-none" style={{ left: showHeart.x - 50, top: showHeart.y - 50 }}><Heart className="w-24 h-24 text-red-500 fill-current" /></motion.div>}
      </AnimatePresence>

      {selectedReel && (
        <div className="z-[1000]">
          <PostComments
            postId={selectedReel.id}
            open={showComments}
            onOpenChange={setShowComments}
            postOwnerId={selectedReel.user_id}
            onCommentAdded={() => {
              setReels(prev => prev.map(r =>
                r.id === selectedReel.id
                  ? { ...r, comments_count: (r.comments_count || 0) + 1 }
                  : r
              ));
            }}
          />
          <ShareModal post={selectedReel} open={showShareModal} onOpenChange={setShowShareModal} />
        </div>
      )}
    </div>
  );
}