import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Lock, Globe, MessageCircle, Send, Loader2,
  Settings, UserPlus, FileText, Image as ImageIcon, MoreVertical,
  Download, Plus, VolumeX, Trash2, FileUp, Music, Film, Layers, Paperclip, Upload, X
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleMembers } from "@/components/circles/CircleMembers";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { uploadFile } from "@/lib/storage";

export default function CircleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [circle, setCircle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAdminHQ, setShowAdminHQ] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  // members state removed as it is handled by CircleMembers component

  const [activeTab, setActiveTab] = useState<'chat' | 'media'>('chat');
  const [realMemberCount, setRealMemberCount] = useState<number>(0);
  const isAdmin = userRole === 'admin' || userRole === 'moderator';

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [cRes, mRes, uRes, fRes] = await Promise.all([
      supabase.from('circles').select('*').eq('id', id).single(),
      supabase.from('circle_messages').select('*, profiles:user_id(username, avatar_url, full_name)').eq('circle_id', id).order('created_at', { ascending: true }),
      supabase.from('profiles').select('user_id, username, avatar_url').limit(8),
      supabase.from('circle_files').select('*, profiles:user_id(username)').eq('circle_id', id).order('created_at', { ascending: false }),
      // members fetched by component
    ]);
    if (cRes.error) console.error("Circle Fetch Error:", cRes.error);
    if (mRes.error) console.error("Messages Fetch Error:", mRes.error);
    if (fRes.error) console.error("Files Fetch Error:", fRes.error);

    setCircle(cRes.data);
    setMessages(mRes.data || []);
    setAllUsers(uRes.data || []);
    setFiles(fRes.data || []);

    // Fetch REAL member count from circle_members (not the drifted column)
    const { count } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', id);
    setRealMemberCount(count || 0);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [id]);

  useEffect(() => {
    const init = async () => {
      if (user) {
        const { data } = await supabase.from('circle_members').select('role').eq('circle_id', id).eq('user_id', user.id).single();
        setIsMember(!!data);
        setUserRole(data?.role || null);
      }
      await fetchData();
      setLoading(false);
    };
    init();

    const channel = supabase.channel(`realtime-circle-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_messages', filter: `circle_id=eq.${id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_files', filter: `circle_id=eq.${id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user, fetchData]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || (circle?.only_admins_can_post && !isAdmin)) return;
    await supabase.from('circle_messages').insert({ circle_id: id, user_id: user.id, content: newMessage.trim() });
    setNewMessage('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;

    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const { url } = await uploadFile('marketplace', file, `circles/${id}/${Date.now()}_${file.name}`);

      // 1. Add to Files Table
      const { data: fileRecord } = await supabase.from('circle_files').insert({
        circle_id: id, user_id: user.id, file_url: url, file_name: file.name, file_type: file.type
      }).select().single();

      // 2. Add a message to the chat that references this file
      await supabase.from('circle_messages').insert({
        circle_id: id,
        user_id: user.id,
        content: `Shared a file: ${file.name}`,
        file_id: fileRecord.id
      });

      toast.success("File shared!", { id: toastId });
      fetchData();
    } catch (err) {
      toast.error("Upload failed", { id: toastId });
    }
  };

  const handleCoverUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !circle) return;

    const toastId = toast.loading("Updating cover...");
    try {
      // Re-use uploadFile, 3rd arg is treated as ID/Path string in our implementation
      const { url, error } = await uploadFile('circles', file, `circles/${id}/cover_${Date.now()}`);

      if (error || !url) throw error || new Error("Upload failed");

      const { error: dbError } = await supabase
        .from('circles')
        .update({ cover_url: url })
        .eq('id', id);

      if (dbError) throw dbError;

      setCircle(prev => ({ ...prev, cover_url: url }));
      toast.success("Cover updated!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update cover", { id: toastId });
    }
  };

  // handleRemoveMember removed as it is handled in CircleMembers component

  const sendInvite = async (targetUser: any) => {
    if (!user || !circle || !profile) return;

    // Check if already a member first (optional optimizations can be added later)
    // For now, we trust the Admin panel list logic (which should filter out existing members ideally, but currently shows all)

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: targetUser.user_id,
        type: 'circle_invite', // New notification type
        title: 'Club Invitation',
        body: `${profile.username} wants to add you to ${circle.name}`,
        data: {
          circle_id: id,
          circle_name: circle.name,
          inviter_id: user.id,
          inviter_username: profile.username
        },
        is_read: false
      });

      if (error) throw error;
      toast.success(`Invite sent to @${targetUser.username}`);
    } catch (err: any) {
      toast.error("Failed to send invite");
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></AppLayout>;

  // Privacy Check: Restricted access to private circles for non-members (unless global admin)
  const isGlobalAdmin = profile?.role === 'admin' || profile?.role === 'developer';
  const canAccess = !circle?.is_private || isMember || isGlobalAdmin;

  if (!canAccess) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center h-[70vh] text-center px-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Private Circle</h2>
          <p className="text-muted-foreground text-sm font-medium mb-8">
            This circle is protected. You must be a member to see the messages and media shared here.
          </p>
          <Button
            onClick={() => navigate('/circles')}
            className="rounded-full px-8 bg-primary text-black font-black uppercase tracking-wider hover:scale-105 transition-all"
          >
            Back to Discovery
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)] relative">
        {/* WHATSAPP HEADER */}
        <div
          className="p-4 flex items-center gap-4 bg-background/80 backdrop-blur-md border-b border-white/5 cursor-pointer z-20 sticky top-0"
          onClick={() => setShowAdminHQ(true)}
        >
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate('/circles'); }} className="hover:bg-primary/20 rounded-full">
            <ArrowLeft />
          </Button>
          <Avatar className="h-10 w-10 ring-2 ring-primary/30 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <AvatarImage src={circle?.cover_url} />
            <AvatarFallback className="font-black bg-gradient-to-br from-primary via-purple-500 to-pink-500 text-white">{circle?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-black uppercase italic tracking-tighter text-lg truncate leading-none">{circle?.name}</h2>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-80 mt-1">{realMemberCount} Members • Tap for info</p>
          </div>
        </div>

        {/* CUSTOM TABS */}
        <div className="flex items-center px-2 pt-2 bg-background/50 border-b border-white/5 z-10">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'chat' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
          >
            Chat Room
            {activeTab === 'chat' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_#7c3aed]" />}
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'media' ? 'text-pink-500' : 'text-muted-foreground hover:text-white'}`}
          >
            Media & Files
            {activeTab === 'media' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 w-full h-0.5 bg-pink-500 shadow-[0_0_10px_#ec4899]" />}
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full absolute inset-0"
              >
                {/* CHAT MESSAGES */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gradient-to-b from-transparent to-primary/5">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex gap-3 ${m.user_id === user?.id ? 'flex-row-reverse' : ''} group`}>
                      {m.user_id !== user?.id && (
                        <Link to={`/profile/${m.profiles?.username}`}>
                          <Avatar className="h-8 w-8 ring-1 ring-white/10 mt-1">
                            <AvatarImage src={m.profiles?.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-white/10">{m.profiles?.username?.[0]}</AvatarFallback>
                          </Avatar>
                        </Link>
                      )}

                      <div className={`flex flex-col ${m.user_id === user?.id ? 'items-end' : 'items-start'} max-w-[75%]`}>
                        {m.user_id !== user?.id && <span className="text-[9px] font-black uppercase text-primary ml-1 mb-1 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">@{m.profiles?.username}</span>}

                        {/* FILE MESSAGE */}
                        {m.file_id ? (
                          <div
                            className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg backdrop-blur-sm ${m.user_id === user?.id ? 'bg-primary/20 border-primary/30 rounded-tr-none' : 'bg-secondary/40 border-white/5 rounded-tl-none'}`}
                            onClick={() => {
                              const f = files.find(f => f.id === m.file_id);
                              if (f) window.open(f.file_url, '_blank');
                            }}
                          >
                            <div className={`p-2.5 rounded-xl ${m.user_id === user?.id ? 'bg-primary text-white' : 'bg-white/10 text-muted-foreground'}`}>
                              {m.content.includes('shared a file') || m.content.includes('Shared a file') ? <Download className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate max-w-[150px]">{m.content.replace(/Shared a file: |shared a file: /gi, '')}</p>
                              <p className="text-[8px] font-black uppercase opacity-60 flex items-center gap-1 mt-0.5"><Download className="h-2 w-2" /> Tap to Save</p>
                            </div>
                          </div>
                        ) : (
                          /* TEXT MESSAGE */
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-md backdrop-blur-sm relative z-0 ${m.user_id === user?.id
                              ? 'bg-gradient-to-br from-primary to-purple-600 text-white rounded-tr-none shadow-primary/20'
                              : 'bg-white/10 text-white border border-white/5 rounded-tl-none'
                              }`}
                          >
                            {m.content}
                          </div>
                        )}
                        <span className="text-[9px] font-bold opacity-30 mt-1 uppercase tracking-wider">{formatDistanceToNow(new Date(m.created_at))} ago</span>
                      </div>

                      {/* ACTIONS (Delete / Reply) */}
                      <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ${m.user_id === user?.id ? 'mr-2' : 'ml-2'}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white"
                          onClick={() => setNewMessage(`> Replying to @${m.profiles?.username}: "${m.content.slice(0, 20)}..." \n`)}
                        >
                          <span className="sr-only">Reply</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                        </Button>

                        {(m.user_id === user?.id || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                              if (!window.confirm("Delete this message?")) return;
                              const { error } = await supabase.from('circle_messages').delete().eq('id', m.id);
                              if (error) toast.error("Failed to delete");
                              else toast.success("Message deleted");
                              // Realtime subscription will handle removal from UI
                            }}
                          >
                            <span className="sr-only">Delete</span>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* INPUT AREA */}
                < div className="p-3 bg-black/40 backdrop-blur-xl border-t border-white/5 pb-6" >
                  <div className="flex gap-2 items-center bg-white/5 p-1.5 rounded-[20px] border border-white/10 pr-2 relative shadow-lg">
                    <label className="cursor-pointer p-2.5 hover:bg-white/10 rounded-full transition-colors group">
                      <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>

                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="border-none bg-transparent focus-visible:ring-0 text-sm font-medium placeholder:text-muted-foreground/50 h-10 px-0"
                    />

                    <Button
                      onClick={handleSendMessage}
                      size="icon"
                      className={`rounded-full h-9 w-9 shadow-lg transition-all ${newMessage.trim() ? 'bg-primary text-black hover:scale-110' : 'bg-white/10 text-muted-foreground'}`}
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* MEDIA TAB */
              <motion.div
                key="media"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-y-auto p-4 scrollbar-hide absolute inset-0"
              >
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 pb-20">
                    <ImageIcon className="h-16 w-16 mb-4" />
                    <p className="font-black uppercase tracking-widest text-xs">No media shared yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-20">
                    {files.map(file => (
                      <motion.div
                        key={file.id}
                        whileHover={{ scale: 1.02 }}
                        className="glass-card p-3 rounded-2xl border-none shadow-lg flex flex-col gap-3 group relative overflow-hidden"
                      >
                        <div className={`aspect-square rounded-xl flex items-center justify-center relative overflow-hidden ${file.file_type?.includes('image') ? 'bg-black' : 'bg-pink-500/10'}`}>
                          {file.file_type?.includes('image') ? (
                            <img src={file.file_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <FileText className="h-10 w-10 text-pink-500" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="sm" variant="secondary" className="rounded-full h-8 w-8 p-0" onClick={() => window.open(file.file_url, '_blank')}><Download className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase truncate text-foreground">{file.file_name}</p>
                          <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest mt-1">@{file.profiles?.username}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ADMIN HQ SHEET */}
      <Sheet open={showAdminHQ} onOpenChange={setShowAdminHQ}>
        <SheetContent className="glass-card border-none overflow-y-auto sm:max-w-md rounded-l-[3rem] p-0">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-white/5 bg-black/40">
              <SheetHeader>
                <SheetTitle className="text-2xl font-black uppercase italic gradient-text">Command Center</SheetTitle>
              </SheetHeader>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2">Manage {circle?.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* COVER IMAGE (Admins Only) */}
              {isAdmin && (
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Cover Identity</Label>
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/10 group">
                    {circle?.cover_url ? (
                      <img src={circle.cover_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20"><ImageIcon className="h-10 w-10 text-white/20" /></div>
                    )}

                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-3 rounded-full bg-white/10 backdrop-blur-md mb-2">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Cover</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpdate} />
                    </label>
                  </div>
                </div>
              )}

              {/* CURRENT MEMBERS */}
              <div className="mb-6">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-3"><Users className="h-3 w-3" /> Members</Label>
                <CircleMembers circleId={id} isAdmin={isAdmin} currentUserRole={userRole} />
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><UserPlus className="h-3 w-3" /> Invite Squad</Label>
                <div className="space-y-2">
                  {allUsers.map(u => (
                    <div key={u.user_id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-2xl border border-white/5 hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback className="bg-white/5 text-[10px]">{u.username?.[0]}</AvatarFallback></Avatar>
                        <span className="text-xs font-bold uppercase tracking-tight">@{u.username}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:text-primary hover:bg-primary/10 font-black uppercase text-[10px] tracking-widest h-7"
                        onClick={() => sendInvite(u)}
                      >
                        Invite
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-[10px] font-black uppercase text-red-500 mb-3">Danger Zone</p>
                  <Button variant="destructive" className="w-full rounded-xl font-bold uppercase text-xs">Delete Circle</Button>
                </div>
              )}
            </div>
          </div >
        </SheetContent >
      </Sheet >
    </AppLayout >
  );
}