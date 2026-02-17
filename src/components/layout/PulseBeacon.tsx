import { useState, useEffect } from "react";
import {
  Radio, Zap, MapPin, Clock, ShieldAlert, Sparkles, Briefcase,
  Send, Plus, X, Activity, SignalHigh, Trash2, Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function PulseBeacon({ trigger }: { trigger?: React.ReactNode }) {
  const { profile } = useAuth();
  const [signals, setSignals] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [newSignal, setNewSignal] = useState({
    title: "",
    content: "",
    category: "general",
    venue: "",
    event_time: ""
  });

  const fetchSignals = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pulse_signals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Pulse fetch failed", error);
        return;
      }

      if (data) {
        setSignals(data);
        if (data.length > 0) {
          const lastSignalDate = new Date(data[0].created_at).getTime();
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          setHasUnread(lastSignalDate > oneDayAgo);
        } else {
          setHasUnread(false);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const channel = supabase.channel('pulse-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pulse_signals' }, () => {
        fetchSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleTransmit = async () => {
    if (!newSignal.title || !newSignal.content) return toast.error("Transmission Data Incomplete");

    const payload = {
      ...newSignal,
      priority: newSignal.category === 'urgent'
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from('pulse_signals')
        .update(payload)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('pulse_signals')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      toast.error(editingId ? "Update failed" : "Transmission failed");
    } else {
      toast.success(editingId ? "Signal Parameters Updated" : "Signal Beamed into the Network");
      resetForm();
      fetchSignals();
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm("PERMANENTLY DELETE THIS SIGNAL?");
    if (!confirm) return;

    const { error } = await supabase.from('pulse_signals').delete().eq('id', id);
    if (error) toast.error("Erasure failed");
    else {
      toast.success("Signal Erased from Network");
      fetchSignals();
    }
  };

  const startEdit = (s: any) => {
    setNewSignal({
      title: s.title,
      content: s.content,
      category: s.category,
      venue: s.venue || "",
      event_time: s.event_time || ""
    });
    setEditingId(s.id);
    setIsTransmitting(true);
  };

  const resetForm = () => {
    setNewSignal({ title: "", content: "", category: "general", venue: "", event_time: "" });
    setEditingId(null);
    setIsTransmitting(false);
  };

  const getCategoryColor = (cat: string) => {
    const category = cat?.toLowerCase() || 'general';
    switch (category) {
      case 'urgent': return 'text-red-500 bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]';
      case 'internship': return 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.1)]';
      case 'academic': return 'text-blue-400 bg-blue-400/5 border-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.1)]';
      case 'event': return 'text-violet-400 bg-violet-400/5 border-violet-400/20 shadow-[0_0_20px_rgba(167,139,250,0.1)]';
      default: return 'text-primary bg-primary/5 border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]';
    }
  };

  const latestCategory = signals[0]?.category?.toLowerCase() || 'general';
  const latestTitle = signals[0]?.title || "Campus quiet. No signals yet.";

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <div className="relative cursor-pointer group flex items-center justify-center gap-2" onClick={() => setHasUnread(false)}>
            <div className="absolute h-8 w-8 rounded-full bg-primary/5 blur-xl animate-pulse" />
            <AnimatePresence>
              {hasUnread && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={cn(
                      "absolute h-8 w-8 rounded-full blur-md",
                      latestCategory === 'urgent' ? 'bg-red-500' : 'bg-primary'
                    )}
                  />
                </>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-2 relative z-10">
              <div className={cn(
                "w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border-2 transition-all duration-700 shrink-0",
                hasUnread
                  ? "bg-black border-primary text-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]"
                  : "bg-black/40 border-white/10 text-white/40"
              )}>
                <SignalHigh className={cn("w-4 h-4 md:w-6 md:h-6", hasUnread ? "animate-pulse" : "opacity-50")} />
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-60">
                  {hasUnread ? "New Campus Signal" : "Pulse Network"}
                </span>
                <span className="text-[11px] font-bold line-clamp-1 max-w-[9rem] opacity-80">
                  {isLoading ? "Syncing..." : latestTitle}
                </span>
              </div>
            </div>
          </div>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md bg-black/95 backdrop-blur-3xl border-l border-white/10 p-0 text-white flex flex-col">
        <SheetHeader className="p-8 border-b border-white/5 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <SheetTitle className="text-5xl font-black italic theme-text uppercase tracking-tighter leading-none mb-2">Pulse</SheetTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 h-3">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div key={i} animate={{ height: [4, 12, 4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }} className="w-0.5 bg-primary/60 rounded-full" />
                  ))}
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Frequency Active</span>
              </div>
            </div>
            {(profile?.role === 'admin' || profile?.username === 'arun' || profile?.username === 'koki' || ['carunbtech23@ced.alliance.edu.in', 'gkartikay23@ced.alliance.edu.in'].includes(profile?.email || '')) && (
              <Button onClick={() => isTransmitting ? resetForm() : setIsTransmitting(true)} variant="ghost" className={cn("rounded-2xl h-14 w-14 border border-white/10 transition-all", isTransmitting ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-white/5 text-white")}>
                {isTransmitting ? <X /> : <Plus />}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          <AnimatePresence mode="wait">
            {isTransmitting ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                    {editingId ? "Update Parameters" : "Secure Transmission"}
                  </h4>
                  <Input placeholder="SIGNAL TITLE" className="super-input bg-black/40" value={newSignal.title} onChange={(e) => setNewSignal({ ...newSignal, title: e.target.value })} />
                  <Textarea placeholder="TRANSMISSION BODY" className="super-input min-h-[120px] bg-black/40" value={newSignal.content} onChange={(e) => setNewSignal({ ...newSignal, content: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="LOCATION" className="super-input text-[10px] bg-black/40" value={newSignal.venue} onChange={(e) => setNewSignal({ ...newSignal, venue: e.target.value })} />
                    <Input placeholder="TIME" className="super-input text-[10px] bg-black/40" value={newSignal.event_time} onChange={(e) => setNewSignal({ ...newSignal, event_time: e.target.value })} />
                  </div>
                  <div className="flex gap-2 py-2">
                    {['general', 'event', 'internship', 'urgent'].map((cat) => (
                      <button key={cat} onClick={() => setNewSignal({ ...newSignal, category: cat })} className={cn("flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border", newSignal.category === cat ? "bg-primary text-black border-primary" : "bg-white/5 text-white/30 border-white/5")}>{cat}</button>
                    ))}
                  </div>
                  <Button onClick={handleTransmit} className="w-full h-14 theme-bg rounded-2xl font-black uppercase tracking-widest italic">
                    {editingId ? "Apply Changes" : "Initiate Broadcast"} <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {signals.map((s, idx) => (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={s.id} className={cn("group relative p-6 rounded-[2.5rem] border transition-all duration-500", getCategoryColor(s.category))}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] italic opacity-80">{s.category || 'signal'}</span>
                      </div>

                      {/* ADMIN TOOLS */}
                      {(profile?.role === 'admin' || profile?.username === 'arun' || profile?.username === 'koki' || ['carunbtech23@ced.alliance.edu.in', 'gkartikay23@ced.alliance.edu.in'].includes(profile?.email || '')) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(s)} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-500/10 rounded-full text-white/60 hover:text-red-500 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-[0.9] text-white group-hover:theme-text transition-colors">{s.title}</h3>
                    <p className="text-xs text-white/60 leading-relaxed font-medium mb-6">{s.content}</p>

                    {(s.event_time || s.venue) && (
                      <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                        {s.event_time && <div className="flex items-center gap-1.5 opacity-60"><Clock className="h-3 w-3 text-primary" /><span className="text-[9px] font-black uppercase">{s.event_time}</span></div>}
                        {s.venue && <div className="flex items-center gap-1.5 opacity-60"><MapPin className="h-3 w-3 text-primary" /><span className="text-[9px] font-black uppercase">{s.venue}</span></div>}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}