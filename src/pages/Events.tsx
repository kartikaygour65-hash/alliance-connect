import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, MapPin, X, Upload, Sparkles, Trash2, Radio } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createEvent } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PulseBeacon } from "@/components/layout/PulseBeacon";
import { validateEventCreate, sanitizeField, eventLimiter, isRateLimited } from "@/lib/security";
import { uploadFile } from "@/lib/storage";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  location: string | null;
  event_date: string;
  created_by: string;
}

export default function Events() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeEvent, setActiveEvent] = useState<string | null>(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [spotlightFile, setSpotlightFile] = useState<File | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showThumbnailDialog, setShowThumbnailDialog] = useState(false);
  const [updatingThumbnail, setUpdatingThumbnail] = useState(false);

  // Cropper states
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'poster' | 'spotlight'>('poster');
  const [isCropping, setIsCropping] = useState(false);
  const [customAspect, setCustomAspect] = useState<number | undefined>(3 / 4);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'poster' | 'spotlight') => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
        setCropType(type);
        setCustomAspect(type === 'poster' ? 3 / 4 : 16 / 9);
        setIsCropping(true);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCropComplete = (blob: Blob) => {
    const croppedFile = new File([blob], cropType === 'poster' ? 'poster.jpg' : 'spotlight.jpg', { type: 'image/jpeg' });
    if (cropType === 'poster') setFile(croppedFile);
    else if (cropType === 'spotlight') setSpotlightFile(croppedFile);
    setIsCropping(false);
    setCropImage(null);
  };

  useEffect(() => {
    fetchEvents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEvents = async () => {
    // Fetch events from the last 24 hours onwards so they don't disappear immediately
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', yesterday.toISOString())
      .order('event_date', { ascending: true });

    if (error) {
      console.error("Error fetching events:", error);
      toast.error("Could not load events");
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!user || !title || !eventDate || !file) {
      toast.error("Please fill all required fields and upload a poster");
      return;
    }

    // SECURITY: Validate event data
    const validation = validateEventCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      event_date: eventDate
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit event creation
    if (isRateLimited(eventLimiter, 'create_event')) return;

    setCreating(true);
    try {
      const broadcastToast = toast.loading("Broadcasting Image Signals...");

      // 1. Upload Poster
      const { url: posterUrl, error: uploadError } = await uploadFile('events', file, user.id);
      if (uploadError) throw uploadError;

      // 2. Insert Event
      const { error: dbError } = await supabase.from('events').insert([{
        title: sanitizeField(title.trim(), 200),
        description: sanitizeField(description.trim(), 2000),
        location: sanitizeField(location.trim(), 200),
        event_date: new Date(eventDate).toISOString(),
        cover_url: posterUrl,
        created_by: user.id
      }]);

      toast.dismiss(broadcastToast);

      if (dbError) throw dbError;

      toast.success("Event Signal Captured & Broadcasted");
      setShowCreateDialog(false);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast.error(error.message || "Signal Frequency Mismatch. Check Payload.");
    } finally {
      setCreating(false);
    }
  };

  const handleSpotlightUpdate = async () => {
    if (!user || !selectedEventId || !spotlightFile) return;

    setUpdatingThumbnail(true);
    try {
      const uploadToast = toast.loading("Uploading Spotlight Signal...");
      const { url, error } = await uploadFile('events', spotlightFile, user.id);
      if (error) throw error;

      const { error: dbError } = await supabase
        .from('events')
        .update({ carousel_display_url: url })
        .eq('id', selectedEventId);

      toast.dismiss(uploadToast);
      if (dbError) throw dbError;

      toast.success("Spotlight Signal Synchronized");
      setShowThumbnailDialog(false);
      setSpotlightFile(null);
      fetchEvents();
    } catch (error: any) {
      toast.error(error.message || "Failed to sync spotlight");
    } finally {
      setUpdatingThumbnail(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to cancel this event?")) return;

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) toast.error("Failed to delete event");
    else {
      toast.success("Event Cancelled");
      fetchEvents();
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setEventDate('');
    setFile(null);
  };

  return (
    <AppLayout>
      <div className="min-h-screen pb-20 relative overflow-hidden">
        {/* Background Ambient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-8">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50"
              >
                Events
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 mt-2"
              >
                <div className="h-0.5 w-12 bg-pink-500" />
                <p className="text-sm font-bold uppercase tracking-widest text-pink-400">Campus Happenings</p>
              </motion.div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <PulseBeacon
                trigger={
                  <Button variant="outline" className="h-12 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md gap-3 group w-full sm:w-auto justify-center">
                    <Radio className="h-4 w-4 text-green-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">
                      Uncover PulseBeacon
                    </span>
                  </Button>
                }
              />

              {(user?.email === 'arunchoudhary@alliance.edu.in' || profile?.username === 'arun' || profile?.username === 'koki' || profile?.role === 'admin') && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => {
                      setSelectedEventId(null);
                      setShowThumbnailDialog(true);
                    }}
                    variant="outline"
                    className="h-12 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md font-black uppercase tracking-widest text-white/80 hover:text-white transition-all transform hover:-translate-y-1 w-full sm:w-auto"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Thumbnail
                  </Button>

                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button className="h-12 px-6 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 border-none font-black uppercase tracking-widest shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all transform hover:-translate-y-1 w-full sm:w-auto">
                        <Plus className="h-5 w-5 mr-2" />
                        Host Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card border-white/10 sm:max-w-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter gradient-text">Broadcast Event</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 mt-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Event Title</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="super-input bg-black/40 border-white/10" placeholder="MEGA EVENT 2024" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Description</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="super-input bg-black/40 border-white/10 min-h-[100px]" placeholder="What's happening?" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Location</Label>
                            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="super-input bg-black/40 border-white/10" placeholder="Audi 1" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Date & Time</Label>
                            <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="super-input bg-black/40 border-white/10" />
                          </div>

                          <div className="col-span-2 space-y-4">
                            <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Step 1: Event Poster (Vertical)</Label>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[8px] font-black uppercase rounded-lg", customAspect === 3 / 4 && "bg-white text-black")}
                                    onClick={() => setCustomAspect(3 / 4)}
                                  >
                                    Standard (3:4)
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[8px] font-black uppercase rounded-lg", customAspect === undefined && "bg-white text-black")}
                                    onClick={() => setCustomAspect(undefined)}
                                  >
                                    Free Size
                                  </Button>
                                </div>
                              </div>
                              <div className="border border-dashed border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/5 transition-colors relative group aspect-video flex items-center justify-center overflow-hidden">
                                <input type="file" accept="image/*" onChange={(e) => onFileSelect(e, 'poster')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                {file ? (
                                  <div className="absolute inset-0">
                                    <img src={URL.createObjectURL(file)} className="h-full w-full object-contain bg-black/40" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Upload className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2">
                                    <Upload className="h-6 w-6 opacity-40 group-hover:scale-110 transition-transform" />
                                    <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Upload Main Poster</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button onClick={handleCreate} disabled={creating} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/90 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                          {creating ? "Launching Satellite..." : "Initialize Broadcast"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>

          {/* CROPPER OVERLAY */}
          {cropImage && (
            <ImageCropper
              image={cropImage}
              aspect={customAspect}
              open={isCropping}
              title={cropType === 'poster' ? "Refine Event Poster" : "Refine Carousel Spotlight"}
              onCropComplete={handleCropComplete}
              onCancel={() => { setIsCropping(false); setCropImage(null); }}
            />
          )}

          {/* Events Gallery - Masonry / Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            <AnimatePresence>
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  layoutId={event.id}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="group relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 transition-all"
                  onClick={() => setActiveEvent(event.id)}
                >
                  {/* Background Image/Poster */}
                  <div className="absolute inset-0">
                    {event.cover_url ? (
                      <img
                        src={event.cover_url}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                        <Calendar className="h-8 w-8 opacity-20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                  </div>

                  {/* Content */}
                  <div className="absolute inset-0 p-4 flex flex-col justify-end">
                    <div className="relative z-20">
                      <div className="space-y-2 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center">
                            <span className="text-xs font-black leading-none">{format(new Date(event.event_date), 'd')}</span>
                            <span className="text-[6px] uppercase font-bold opacity-70 leading-none">{format(new Date(event.event_date), 'MMM')}</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <h3 className="text-lg font-black italic uppercase tracking-tighter leading-none text-white truncate w-full">
                              {event.title}
                            </h3>
                            <span className="text-[8px] font-bold text-white/60 tracking-wider truncate">
                              {event.location || "Campus"} • {format(new Date(event.event_date), 'h:mm a')}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pt-2">
                          <span className="text-[8px] text-white/60 font-medium line-clamp-1">{event.description}</span>

                          <div className="flex gap-2">
                            {(user?.email === 'arunchoudhary@alliance.edu.in' || profile?.username === 'arun' || profile?.username === 'koki' || profile?.role === 'admin') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full bg-white/10 hover:bg-white hover:text-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEventId(event.id);
                                  setShowThumbnailDialog(true);
                                }}
                              >
                                <Upload className="h-3 w-3" />
                              </Button>
                            )}
                            {user?.id === event.created_by && (
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-6 w-6 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                                onClick={(e) => handleDelete(event.id, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {events.length === 0 && !loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-60 text-center animate-in fade-in duration-700">
                <div className="relative group cursor-pointer mb-6" onClick={() => setShowCreateDialog(true)}>
                  <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl group-hover:bg-pink-500/30 transition-all duration-500" />
                  <Sparkles className="h-20 w-20 relative z-10 text-pink-500 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <h3 className="text-2xl font-black uppercase italic tracking-widest mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/40">
                  Radar Silent
                </h3>
                <p className="text-sm font-medium text-white/50 max-w-xs mx-auto leading-relaxed">
                  No signals detected. Be the spark that ignites the campus.
                </p>
                <Button
                  variant="link"
                  className="mt-4 text-pink-400 font-bold uppercase tracking-widest text-xs hover:text-pink-300"
                  onClick={() => setShowCreateDialog(true)}
                >
                  Initiate First Broadcast &rarr;
                </Button>
              </div>
            )}
          </div>

          {/* FULL SCREEN POSTER LIGHTBOX */}
          <Dialog open={!!activeEvent} onOpenChange={(open) => !open && setActiveEvent(null)}>
            <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-black/90 border-none p-0 overflow-hidden flex flex-col items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <button
                  onClick={() => setActiveEvent(null)}
                  className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white/70 hover:text-white backdrop-blur-md"
                >
                  <X className="h-6 w-6" />
                </button>
                {activeEvent && events.find(e => e.id === activeEvent)?.cover_url && (
                  <img
                    src={events.find(e => e.id === activeEvent)?.cover_url || ''}
                    alt="Full Event Poster"
                    className="max-w-full max-h-full object-contain shadow-2xl"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* SPOTLIGHT THUMBNAIL DIALOG */}
          <Dialog open={showThumbnailDialog} onOpenChange={setShowThumbnailDialog}>
            <DialogContent className="glass-card border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-black italic uppercase tracking-tighter gradient-text">Add Spotlight Thumbnail</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Event</Label>
                  <select
                    className="w-full h-12 rounded-xl bg-black/40 border border-white/10 px-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    value={selectedEventId || ''}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                  >
                    <option value="" disabled className="bg-zinc-900">Select an event...</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id} className="bg-zinc-900">{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Aspect Ratio</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-6 px-2 text-[8px] font-black uppercase rounded-lg", customAspect === 16 / 9 && "bg-white text-black")}
                        onClick={() => setCustomAspect(16 / 9)}
                      >
                        Carousel (16:9)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-6 px-2 text-[8px] font-black uppercase rounded-lg", customAspect === undefined && "bg-white text-black")}
                        onClick={() => setCustomAspect(undefined)}
                      >
                        Free Size
                      </Button>
                    </div>
                  </div>
                  <div className="border border-dashed border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/5 transition-colors relative group aspect-video flex items-center justify-center overflow-hidden">
                    <input type="file" accept="image/*" onChange={(e) => onFileSelect(e, 'spotlight')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    {spotlightFile ? (
                      <div className="absolute inset-0">
                        <img src={URL.createObjectURL(spotlightFile)} className="h-full w-full object-contain bg-black/40" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Radio className="h-6 w-6 opacity-40 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Select Signal</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleSpotlightUpdate}
                  disabled={updatingThumbnail || !spotlightFile || !selectedEventId}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/90 shadow-2xl transition-all active:scale-95"
                >
                  {updatingThumbnail ? "Syncing..." : "Update Spotlight"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </AppLayout>
  );
}
