import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Image as ImageIcon, Type, Loader2, X, Camera, Search, ZoomIn, Clock, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProfessionalCamera } from "@/components/camera/ProfessionalCamera";
import { cn } from "@/lib/utils";

interface CreateStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  reshareStoryId?: string;
  reshareMediaUrl?: string;
  reshareMediaType?: string;
  reshareUser?: { username: string; avatarUrl: string | null };
  resharePost?: any; // Added for Beaming
}

const BACKGROUND_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  '#1a1a2e',
  '#000000',
  'linear-gradient(to top, #30cfd0 0%, #330867 100%)',
  'linear-gradient(to top, #5f72bd 0%, #9b23ea 100%)'
];

export function CreateStoryModal({ open, onOpenChange, onCreated, reshareStoryId, reshareMediaUrl, reshareMediaType, reshareUser, resharePost }: CreateStoryModalProps) {
  const { user } = useAuth();
  const [storyType, setStoryType] = useState<'text' | 'media' | 'camera'>('text');
  const [content, setContent] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState(BACKGROUND_GRADIENTS[0]);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState([1]);
  const [duration, setDuration] = useState([5]);

  const [showMentionSearch, setShowMentionSearch] = useState(false);
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mentionedUsers, setMentionedUsers] = useState<any[]>([]);

  // Draggable Text State
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC: MASTER MEDIA RESOLVER ---
  const isReshare = !!reshareStoryId || !!resharePost;
  const isVideo = mediaFile?.type.startsWith('video') || reshareMediaType === 'video' || (resharePost && (resharePost.video_url || isReshare));

  // --- INIT RESHARE ---
  useEffect(() => {
    if (open) {
      if (isReshare) {
        if (resharePost) {
          // BEAM LOGIC
          setMediaPreview(resharePost.images?.[0] || resharePost.video_url || null);
          setStoryType('media');
          setScale([0.85]);
          setBackgroundStyle('black');
        } else if (reshareMediaUrl) {
          // STORY RESHARE LOGIC
          setMediaPreview(reshareMediaUrl);
          setStoryType('media');
          setScale([0.85]);
          setBackgroundStyle(BACKGROUND_GRADIENTS[5]);
        } else {
          setStoryType('text');
        }
      } else {
        // Default reset
        if (!mediaFile) setStoryType('text');
      }
    }
  }, [reshareMediaUrl, resharePost, open, isReshare, mediaFile]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => { if (!open) stopCamera(); }, [open, stopCamera]);

  const startCamera = () => {
    setStoryType('camera');
  };

  const handleCameraCapture = (file: File) => {
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setStoryType('media');
  };

  const handleSearchUsers = async (query: string) => {
    setMentionQuery(query);
    if (query.length < 1) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('user_id, username, avatar_url').ilike('username', `%${query}%`).limit(5);
    setSearchResults(data || []);
  };

  const addMention = (user: any) => {
    if (!mentionedUsers.find(u => u.user_id === user.user_id)) {
      setMentionedUsers([...mentionedUsers, { ...user, x: 0, y: 0 }]);
    }
    setShowMentionSearch(false); setMentionQuery(""); setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let mediaUrl = reshareMediaUrl || null;
      let type = 'text';

      if (mediaFile) {
        const { url, error } = await uploadFile('stories', mediaFile, user.id);
        if (error) throw error;
        mediaUrl = url;
        type = mediaFile.type.startsWith('video') ? 'video' : 'image';
      } else if (resharePost) {
        mediaUrl = resharePost.images?.[0] || resharePost.video_url;
        type = resharePost.video_url ? 'video' : 'image';
      } else if (reshareMediaUrl) {
        type = reshareMediaType || 'image';
      }

      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        content: content || null,
        media_url: mediaUrl,
        media_type: storyType === 'text' ? 'text' : type,
        background_color: (storyType === 'text' || isReshare || storyType === 'media') ? backgroundStyle : null,
        mentions: mentionedUsers.map(u => u.user_id),
        original_story_id: reshareStoryId || null,
        post_id: resharePost?.id || null, // For beams
        is_beam: !!resharePost,
        duration: duration[0],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      if (error) throw error;
      toast.success(reshareStoryId ? 'Story reshared!' : 'Story shared!');
      onCreated(); onOpenChange(false);
    } catch (e) { toast.error('Failed to post'); } finally { setLoading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setStoryType('media');
    }
  };

  const handleClose = () => {
    stopCamera(); setContent(''); setMediaFile(null); setMediaPreview(null); setMentionedUsers([]); setStoryType('text'); onOpenChange(false);
  };

  if (!open) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black z-[99999] flex flex-col overflow-hidden">

      {/* HEADER TOOLS */}
      <div className="flex justify-between items-center p-4 z-20 absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent">
        <Button variant="ghost" className="text-white" onClick={handleClose}><X /></Button>
        <div className="flex gap-4">
          {(storyType === 'text' || isReshare || storyType === 'media') && (
            <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
              <PopoverTrigger asChild><Button variant="ghost" className="text-white bg-black/40 rounded-full w-10 h-10 p-0 hover:bg-black/60"><Palette className="h-5 w-5" /></Button></PopoverTrigger>
              <PopoverContent className="w-auto p-2 bg-black/90 border-white/20 grid grid-cols-3 gap-2">
                {BACKGROUND_GRADIENTS.map((bg, i) => (
                  <button
                    key={i}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all active:scale-95",
                      backgroundStyle === bg ? "border-white scale-110 shadow-[0_0_10px_white]" : "border-white/20 hover:border-white/60"
                    )}
                    style={{ background: bg }}
                    onClick={() => {
                      setBackgroundStyle(bg);
                      setShowColorPicker(false); // Auto-close picker for better UX
                    }}
                  />
                ))}
              </PopoverContent>
            </Popover>
          )}
          {(storyType !== 'text') && (
            <Button
              variant="ghost"
              className="text-white bg-black/40 rounded-full w-10 h-10 p-0 hover:bg-black/60"
              onClick={() => setShowTextOverlay(!showTextOverlay)}
            >
              <Type className="h-5 w-5" />
            </Button>
          )}
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="bg-white text-black font-bold rounded-full px-6">{loading ? <Loader2 className="animate-spin" /> : 'Share'}</Button>
      </div>

      {showMentionSearch && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col pt-20 px-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-white/20 pb-4 mb-4">
            <Search className="h-5 w-5 text-white/50" />
            <Input autoFocus placeholder="Search..." className="bg-transparent border-none text-white text-xl focus-visible:ring-0 placeholder:text-white/30 p-0" value={mentionQuery} onChange={(e) => handleSearchUsers(e.target.value)} />
            <Button variant="ghost" className="text-white font-bold" onClick={() => setShowMentionSearch(false)}>Cancel</Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {searchResults.length === 0 && mentionQuery.length > 1 && <p className="text-center text-white/30 mt-10">No users found.</p>}
            {searchResults.map(u => (
              <button key={u.user_id} onClick={() => addMention(u)} className="flex items-center gap-4 w-full p-3 hover:bg-white/10 rounded-2xl transition-colors text-left">
                <Avatar className="h-12 w-12 border border-white/10"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.username?.[0]}</AvatarFallback></Avatar>
                <div><p className="text-white font-bold text-base">@{u.username}</p><p className="text-white/40 text-xs">Tap to mention</p></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- MASTER CANVAS --- */}
      <div
        className="flex-1 relative flex items-center justify-center"
        style={{ background: (storyType === 'text' || isReshare || storyType === 'media') ? backgroundStyle : 'black' }}
      >
        {/* TEXT MODE (Non-Reshare) */}
        {storyType === 'text' && !isReshare && (
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="bg-transparent border-none text-white text-4xl font-bold text-center placeholder:text-white/50 focus-visible:ring-0 resize-none z-10 w-full" placeholder="Type something..." />
        )}

        {/* MEDIA / RESHARE CENTERED CARD */}
        {(mediaPreview || isReshare) && storyType !== 'camera' && (
          <div className="relative w-full h-full flex items-center justify-center">

            <motion.div
              drag
              dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
              style={{ scale: scale[0] }}
              className={cn(
                "relative flex items-center justify-center bg-transparent transition-all duration-500",
                isReshare ? "w-[85%] h-[60%] rounded-[28px] overflow-hidden border border-white/10 shadow-2xl" : "w-full h-full"
              )}
            >
              {/* Attribution badge for reshare */}
              {(isReshare && (reshareUser || resharePost?.profiles)) && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10 z-[115]">
                  <Avatar className="h-4 w-4 ring-1 ring-white/20"><AvatarImage src={reshareUser?.avatarUrl || resharePost?.profiles?.avatar_url || ""} /><AvatarFallback>{(reshareUser?.username || resharePost?.profiles?.username || "?")[0]}</AvatarFallback></Avatar>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">@{reshareUser?.username || resharePost?.profiles?.username}</span>
                </div>
              )}

              {mediaPreview ? (
                isVideo ? (
                  <video src={mediaPreview} className="w-full h-full object-contain" autoPlay loop muted playsInline />
                ) : (
                  <img src={mediaPreview} className="w-full h-full object-contain" alt="Preview" />
                )
              ) : (
                /* TEXT-ONLY RESHARE CARD */
                <div className="w-full h-full flex items-center justify-center p-10 text-center" style={{ background: backgroundStyle }}>
                  <p className="text-white font-bold text-2xl leading-relaxed">Shared Content</p>
                </div>
              )}
            </motion.div>

            {/* Caption Overlay (draggable, optional text like Instagram) */}
            {/* Caption Overlay (draggable, thumb-friendly) */}
            {(showTextOverlay || content) && (
              <motion.div
                drag
                dragMomentum={false}
                dragConstraints={false}
                initial={{ y: 0, x: 0 }}
                style={{ x: textPosition.x, y: textPosition.y }}
                onDragEnd={(_, info) => setTextPosition({ x: textPosition.x + info.offset.x, y: textPosition.y + info.offset.y })}
                className="absolute z-[120] cursor-move touch-none p-4"
              >
                <div className="relative min-w-[200px] max-w-[300px]">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="bg-transparent border-none text-white text-3xl font-bold text-center resize-none focus-visible:ring-0 shadow-black drop-shadow-lg min-h-[60px] overflow-hidden"
                    placeholder="Type caption..."
                    autoFocus={showTextOverlay && !content}
                  />
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* CAMERA MODE */}
        {storyType === 'camera' && (
          <ProfessionalCamera
            onCapture={handleCameraCapture}
            onClose={() => setStoryType('text')}
          />
        )}

        {/* DRAGGABLE MENTIONS */}
        {mentionedUsers.map((u, i) => (
          <motion.div key={u.user_id} drag dragMomentum={false} className="absolute top-1/2 left-1/2 z-30 cursor-move" initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <div className="bg-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 transform -rotate-2 border-2 border-white">
              <span className="bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text font-black text-xl">@</span>
              <span className="font-bold text-black text-lg uppercase tracking-tight">{u.username}</span>
              <button onClick={() => setMentionedUsers(p => p.filter(m => m.user_id !== u.user_id))} className="bg-neutral-200 rounded-full p-1 ml-2 hover:bg-red-100"><X className="h-3 w-3 text-black" /></button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* EDIT TOOLS PANEL */}
      {(storyType === 'media' || isReshare) && !showMentionSearch && (
        <div className="absolute bottom-24 left-4 right-4 z-20 bg-black/60 backdrop-blur-md rounded-2xl p-4 space-y-4 border border-white/10 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-4"><ZoomIn className="text-white h-5 w-5" /><Slider value={scale} onValueChange={setScale} min={0.5} max={1.5} step={0.05} className="flex-1 py-4" /></div>
          {!isVideo && <div className="flex items-center gap-4"><Clock className="text-white h-5 w-5" /><Slider value={duration} onValueChange={setDuration} min={3} max={15} step={1} className="flex-1 py-4" /><span className="text-white text-xs font-bold w-8">{duration}s</span></div>}
        </div>
      )}

      {/* FOOTER SWITCHER */}
      {storyType !== 'camera' && !mediaFile && !isReshare && (
        <div className="p-6 bg-black flex justify-center gap-6 z-10">
          <Button variant={storyType === 'text' ? "default" : "ghost"} className="rounded-full" onClick={() => setStoryType('text')}><Type className="mr-2 h-4 w-4" /> Text</Button>
          <Button variant="ghost" className="rounded-full text-white" onClick={startCamera}><Camera className="mr-2 h-4 w-4" /> Camera</Button>
          <Button variant="ghost" className="rounded-full text-white" onClick={() => fileInputRef.current?.click()}><ImageIcon className="mr-2 h-4 w-4" /> Gallery</Button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
        </div>
      )}
    </motion.div>, document.body
  );
}