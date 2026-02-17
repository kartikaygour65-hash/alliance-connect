import { useState, useRef } from "react";
import { Image, X, Send, Loader2, Sparkles, Ghost, Timer, ChevronDown, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { createPost } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { getInitials, cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

export function CreatePost({ onPostCreated }: { onPostCreated: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string; type: 'image' | 'video' }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const [isStealth, setIsStealth] = useState(false);
  const [duration, setDuration] = useState(24);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: (file.type.startsWith('video/') || /\.(mp4|mov|webm|quicktime|m4v)$/i.test(file.name)) ? 'video' as const : 'image' as const
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setIsExpanded(true);
  };

  const handleSubmit = async () => {
    if (!user || (!content.trim() && selectedFiles.length === 0)) return;
    setIsSubmitting(true);
    try {
      const imageUrls: string[] = [];
      let videoUrl: string | null = null;

      for (const item of selectedFiles) {
        const bucket = item.type === 'video' ? 'videos' : 'posts';
        const { url } = await uploadFile(bucket, item.file, user.id);
        if (url) {
          if (item.type === 'video') videoUrl = url;
          else imageUrls.push(url);
        }
      }

      const expiresAt = isStealth
        ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()
        : null;

      const uploadToast = toast.loading("Broadcasting to network...");
      const { error } = await createPost({
        user_id: user.id,
        content: content.trim(),
        images: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl,
        expires_at: expiresAt,
        is_stealth: isStealth
      });

      toast.dismiss(uploadToast);

      if (error) throw error;
      toast.success(isStealth ? `Stealth active for ${duration}h` : "Post created!");
      setContent("");
      setSelectedFiles([]);
      setIsExpanded(false);
      setIsStealth(false);
      onPostCreated();
    } catch (error) {
      console.error(error);
      toast.error("Failed to post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className={cn(
      "super-card mb-8 transition-all duration-500",
      isStealth ? "ring-2 ring-red-500/20 bg-red-950/5" : ""
    )}>
      <div className={cn(
        "absolute top-0 right-0 p-6 opacity-20 pointer-events-none transition-colors hidden md:block",
        isStealth ? "text-red-500" : "text-primary"
      )}>
        {isStealth ? <Ghost className="w-10 h-10 animate-pulse" /> : <Sparkles className="w-10 h-10" />}
      </div>

      <div className="flex gap-3 md:gap-4">
        <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white/10 shrink-0">
          <AvatarImage src={profile.avatar_url || ""} />
          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-4">
          <Input
            placeholder={isStealth ? "Whisper something secret..." : "What's on your mind?"}
            className={cn("super-input h-12 md:h-14 text-base md:text-lg", isStealth && "text-red-100 placeholder:text-red-500/30")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
          />

          {/* PREVIEW SECTION */}
          {selectedFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <AnimatePresence>
                {selectedFiles.map((file, i) => (
                  <motion.div
                    key={file.preview}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-white/10 group bg-black"
                  >
                    {file.type === 'video' ? (
                      <div className="relative w-full h-full">
                        <video src={file.preview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-white/20" />
                        </div>
                        <div className="absolute top-1 left-1 bg-primary px-1.5 rounded-md">
                          <span className="text-[8px] font-black uppercase text-white">Reel</span>
                        </div>
                      </div>
                    ) : (
                      <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {isExpanded && (
            <div className="flex flex-col md:flex-row md:items-center justify-between pt-2 animate-in slide-in-from-top-2 gap-3">
              <div className="flex gap-2 items-center flex-wrap">
                <Button variant="ghost" size="icon" className="text-green-400 h-9 w-9" onClick={() => fileInputRef.current?.click()}>
                  <Image className="h-5 w-5" />
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,video/*" />

                <div className="hidden md:block w-[1px] h-6 bg-white/10 mx-2" />

                <div className="flex items-center bg-white/5 rounded-xl px-1">
                  <Button
                    onClick={() => setIsStealth(!isStealth)}
                    variant="ghost"
                    className={cn("rounded-lg px-2 md:px-3 h-9 gap-2 transition-all", isStealth ? "text-red-500" : "text-white/40")}
                  >
                    <Timer className={cn("h-4 w-4", isStealth && "animate-spin")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Stealth</span>
                  </Button>

                  {isStealth && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 px-2 text-[10px] font-bold text-red-500/60 hover:text-red-500">
                          {duration}H <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-black/90 border-white/10 text-white">
                        <DropdownMenuItem onClick={() => setDuration(1)}>1 Hour</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDuration(12)}>12 Hours</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDuration(24)}>24 Hours</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "rounded-full h-10 px-6 font-bold transition-all shadow-lg w-full md:w-auto",
                  isStealth ? "bg-red-600 text-white shadow-red-500/20" : "bg-white text-black"
                )}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isStealth ? 'Burn' : 'Post'} <Send className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}