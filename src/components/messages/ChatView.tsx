import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Image as ImageIcon, MoreVertical, Loader2,
  Check, CheckCheck, X, Trash2, Reply, Ban, Copy, Heart,
  User, Flag, PlayCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { getInitials, cn } from "@/lib/utils";
import { validateMessage, sanitizeField, messageLimiter, isRateLimited } from "@/lib/security";

export function ChatView({ conversationId, otherUser, onBack, onMessageRead }: any) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.username === 'arun' || user?.email === 'arunchoudhary@alliance.edu.in' || profile?.username === 'koki';
  const navigate = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState<{ id: string, time: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messageMap = useMemo(() => {
    return new Map(messages.map(m => [m.id, m]));
  }, [messages]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, fetchMessages)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    if (user && messages.length > 0) markMessagesAsRead();
    scrollToBottom();
  }, [messages.length]);

  const fetchMessages = async () => {
    // Fetch messages without FK join (works regardless of DB constraints)
    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch Error:", error);
      return;
    }

    if (!data) { setLoading(false); return; }

    // Collect ALL messages that have a shared_post_id (don't rely on message_type)
    const sharedPostIds = [...new Set(
      data.filter(m => m.shared_post_id).map(m => m.shared_post_id)
    )];

    const sharedPostMap = new Map<string, any>();

    if (sharedPostIds.length > 0) {
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, content, images, video_url, user_id,
          profiles!user_id (
            username, full_name, avatar_url
          )
        `)
        .in("id", sharedPostIds);

      if (postsData) {
        postsData.forEach(p => sharedPostMap.set(p.id, p));
      }
    }

    // Enrich messages with shared post data
    const enrichedMessages = data.map(m => ({
      ...m,
      shared_post: m.shared_post_id ? sharedPostMap.get(m.shared_post_id) || null : null
    }));

    setMessages(enrichedMessages);
    setLoading(false);
  };

  const markMessagesAsRead = async () => {
    await supabase.from("direct_messages").update({ is_read: true }).eq("conversation_id", conversationId).neq("sender_id", user?.id).eq("is_read", false);
    if (onMessageRead) onMessageRead();
  };

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { url } = await uploadFile('chat', file, user.id);
      await sendMessage(url, file.type.startsWith('image/') ? 'image' : 'video');
    } catch (err) { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const toggleLike = async (messageId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("direct_messages").update({ is_liked: !currentStatus }).eq("id", messageId);
    if (error) toast.error("Failed to react");
  };

  const handleDoubleTap = (message: any) => {
    const now = Date.now();
    if (lastTap && lastTap.id === message.id && now - lastTap.time < 300) {
      toggleLike(message.id, message.is_liked);
      setLastTap(null);
    } else {
      setLastTap({ id: message.id, time: now });
      setActiveMessageId(activeMessageId === message.id ? null : message.id);
    }
  };

  const sendMessage = async (mediaUrl: string | null = null, type: string = 'text') => {
    if (!user || (!newMessage.trim() && !mediaUrl)) return;

    // SECURITY: Validate text messages (skip for media-only messages)
    if (type === 'text' && newMessage.trim()) {
      const validation = validateMessage(newMessage);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
    }

    // SECURITY: Rate limit message sending
    if (isRateLimited(messageLimiter, 'send_message')) return;

    const content = sanitizeField(newMessage.trim(), 2000);
    const replyId = replyingTo?.id;
    setNewMessage("");
    setReplyingTo(null);

    const { data: newMsg, error } = await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      media_url: mediaUrl,
      message_type: type,
      reply_to_id: replyId
    }).select().single();

    if (error) { toast.error("Failed to send"); return; }
    if (newMsg) {
      await supabase.from("conversations").update({
        last_message_at: new Date().toISOString(),
        last_message: content || "Sent a file"
      }).eq("id", conversationId);
    }
  };

  const deleteMessage = async (id: string, senderId: string) => {
    // Only allow deletion if user is sender OR admin
    if (senderId !== user?.id && !isAdmin) {
      toast.error("Restricted Authorization: Signal blocked.");
      return;
    }

    try {
      // Use .select() to verify if the deletion actually happened
      const { data, error } = await supabase
        .from("direct_messages")
        .delete()
        .eq("id", id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Security Lock: Database blocked deletion. Run the SQL Panic Fix.");
      }

      toast.success("Message purged from terminal");
      setActiveMessageId(null);
      fetchMessages();
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.message || "Failed to delete message. Check DB permissions.");
      fetchMessages(); // Restore UI state
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative z-[60]">
      {/* HEADER - STRICTLY FIXED */}
      <header className="flex-none h-[72px] flex items-center gap-3 p-4 border-b border-white/5 bg-background/90 backdrop-blur-2xl z-50">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden -ml-2 text-white">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => navigate(`/profile/${otherUser.username}`)}>
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={otherUser.avatar_url || ""} />
            <AvatarFallback className="theme-bg font-bold">{getInitials(otherUser.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-white">
            <span className="font-bold text-sm leading-none">{otherUser.full_name}</span>
            <span className="text-[10px] text-green-500 font-medium mt-1 uppercase tracking-tighter italic">Active Now</span>
          </div>
        </div>

        {/* RESTORED 3 DOTS MENU */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
              <MoreVertical className="h-5 w-5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white rounded-2xl p-2 w-48 shadow-2xl z-[100]">
            <DropdownMenuItem className="focus:bg-white/10 cursor-pointer rounded-xl font-bold py-3" onClick={() => navigate(`/profile/${otherUser.username}`)}>
              <User className="mr-2 h-4 w-4" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem className="focus:bg-white/10 cursor-pointer rounded-xl font-bold py-3 text-red-500 focus:text-red-400">
              <Ban className="mr-2 h-4 w-4" /> Block User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-black/5 w-full" onClick={() => setActiveMessageId(null)}>
        {messages.map((message) => {
          const isOwn = message.sender_id === user?.id;
          const isTapped = activeMessageId === message.id;
          const isPostShare = !!message.shared_post;
          const repliedMessage = message.reply_to_id ? messageMap.get(message.reply_to_id) : null;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              <div className="relative flex flex-col gap-1 max-w-[85%] md:max-w-[70%]">

                {/* REPLIED MESSAGE PREVIEW BUBBLE */}
                {repliedMessage && (
                  <div className={`text-[10px] opacity-60 mb-1 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/5 truncate max-w-full italic flex items-center gap-1 ${isOwn ? 'self-end' : 'self-start'}`}>
                    <Reply className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{repliedMessage.content || "Media"}</span>
                  </div>
                )}

                <motion.div
                  onClick={(e) => { e.stopPropagation(); handleDoubleTap(message); }}
                  className={cn(
                    "relative rounded-[22px] transition-all active:scale-[0.98] shadow-lg overflow-hidden",
                    isOwn ? "bg-primary text-black rounded-tr-none" : "bg-zinc-900 text-white rounded-tl-none border border-white/5",
                    isPostShare ? "p-0.5 bg-zinc-800 border-white/10" : "px-4 py-2.5",
                    isTapped && "ring-2 ring-white/50" // Highlights when tapped
                  )}
                >
                  {/* INSTAGRAM STYLE SHARED POST CARD */}
                  {isPostShare && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${message.shared_post.id}`);
                      }}
                      className="group flex flex-col w-[240px] md:w-[280px] bg-zinc-900 rounded-[20px] overflow-hidden cursor-pointer active:opacity-90 transition-all border border-white/5 shadow-2xl"
                    >
                      {/* Insta-style Header */}
                      <div className="flex items-center gap-2 p-3 bg-zinc-900">
                        <Avatar className="h-6 w-6 ring-1 ring-white/10">
                          <AvatarImage src={message.shared_post.profiles?.avatar_url} />
                          <AvatarFallback className="text-[8px] bg-zinc-800">{getInitials(message.shared_post.profiles?.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] font-black text-white/90 tracking-tight">
                          {message.shared_post.profiles?.username}
                        </span>
                      </div>

                      {/* Square Thumbnail Preview */}
                      <div className="aspect-square relative bg-black overflow-hidden flex items-center justify-center">
                        {(message.shared_post.images?.[0] || message.shared_post.video_url) ? (
                          <>
                            {message.shared_post.images?.[0] ? (
                              <img
                                src={message.shared_post.images[0]}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                                alt="Post Preview"
                                loading="lazy"
                              />
                            ) : message.shared_post.video_url ? (
                              <video
                                src={message.shared_post.video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                loop
                                autoPlay
                              />
                            ) : null}

                            {message.shared_post.video_url && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                                  <PlayCircle className="w-10 h-10 text-white fill-white/20" />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-900">
                            <ImageIcon className="w-8 h-8 text-white/10 mb-2" />
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest italic leading-tight">Post Preview<br />Unavailable</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40" />
                      </div>

                      {/* Snippet Overlay */}
                      {message.shared_post.content && (
                        <div className="px-3 py-3 bg-zinc-900">
                          <p className="text-[11px] text-white/70 line-clamp-2 font-medium leading-snug italic">
                            {message.shared_post.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Messages (Images/Videos) */}
                  {message.media_url && !isPostShare && (
                    <div className="rounded-xl overflow-hidden mb-1 cursor-pointer" onClick={(e) => {
                      e.stopPropagation();
                      if (message.content && message.content.includes("Replied to")) {
                        // Redirects exactly to the ?openStory trigger
                        const targetUsername = isOwn ? otherUser.username : ((user as any)?.user_metadata?.username || (user as any)?.username);
                        if (targetUsername) {
                          navigate(`/profile/${targetUsername}?openStory=true`);
                        }
                      } else {
                        setLightboxImage(message.media_url);
                      }
                    }}>
                      {message.message_type === 'video' ? <video src={message.media_url} className="max-h-60" /> : <img src={message.media_url} className="max-h-60 object-cover" />}
                    </div>
                  )}

                  {message.content && !isPostShare && (
                    <p className="text-[15px] font-medium leading-snug break-words">{message.content}</p>
                  )}

                  {message.is_liked && (
                    <div className={`absolute -bottom-2 ${isOwn ? "-left-2" : "-right-2"} bg-zinc-900 rounded-full p-1 border border-white/10 shadow-lg`}>
                      <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                    </div>
                  )}
                </motion.div>
              </div>

              {/* RESTORED REPLY/DELETE MENU WHEN TAPPED */}
              <AnimatePresence>
                {isTapped && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className={`flex items-center gap-2 px-2 overflow-hidden ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(message); setActiveMessageId(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-zinc-700 transition-colors"
                    >
                      <Reply className="w-3 h-3" /> Reply
                    </button>
                    {(isOwn || isAdmin) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMessage(message.id, message.sender_id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> {isAdmin && !isOwn ? "MOD DELETE" : "Delete"}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TIMESTAMP */}
              <span className="text-[8px] opacity-30 mt-1 px-2 font-black uppercase tracking-widest italic text-white/40">
                {format(new Date(message.created_at), "h:mm a")}
                {isOwn && (message.is_read ? " • SEEN" : " • SENT")}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div >

      <footer className="flex-none p-4 bg-background border-t border-white/10 relative z-50">
        {/* RESTORED "REPLYING TO..." PREVIEW BAR */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-[80px] left-4 right-4 flex items-center justify-between px-4 py-2 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl text-white/70 text-sm shadow-2xl z-10"
            >
              <div className="flex items-center gap-2 truncate pr-4">
                <Reply className="h-4 w-4 text-primary" />
                <span className="truncate text-xs font-medium">Replying to: <span className="text-white italic">{replyingTo.content || "Media Attachment"}</span></span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:text-white bg-black/20 rounded-full"><X className="h-4 w-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 bg-zinc-900/50 rounded-[30px] px-2 py-1.5 border border-white/5 relative z-20">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
          <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 text-white/40 hover:bg-white/5 hover:text-white transition-colors" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImageIcon className="h-5 w-5" />}
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message..."
            className="bg-transparent border-none focus-visible:ring-0 h-11 text-[15px] text-white shadow-none"
          />
          {newMessage.trim() && (
            <Button onClick={() => sendMessage()} variant="ghost" className="text-primary font-black uppercase px-5 hover:text-primary transition-colors hover:bg-primary/10 rounded-full">Send</Button>
          )}
        </div>
      </footer>

      {/* LIGHTBOX POPUP */}
      {
        lightboxImage && (
          <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
            <DialogContent className="max-w-none w-screen h-screen bg-black/95 backdrop-blur-3xl p-0 border-none flex items-center justify-center shadow-none z-[160]">
              <img src={lightboxImage} className="max-w-full max-h-full object-contain" alt="Enlarged Media" />
              <Button variant="ghost" size="icon" className="absolute top-6 right-6 text-white bg-black/50 hover:bg-white/20 rounded-full" onClick={() => setLightboxImage(null)}>
                <X className="h-6 w-6" />
              </Button>
            </DialogContent>
          </Dialog>
        )
      }
    </div >
  );
}