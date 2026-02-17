import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Loader2, Clock, CheckCircle2, Plus, Users, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { validatePollCreate, sanitizeField, pollLimiter, voteLimiter, isRateLimited } from "@/lib/security";

export default function Polls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);

  const fetchPolls = useCallback(async () => {
    if (!user) return;
    try {
      const { data: pollsData, error } = await supabase
        .from('polls')
        .select(`*, poll_options (*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: userVotes } = await supabase.from('poll_votes').select('poll_id').eq('user_id', user.id);
      const votedIds = new Set(userVotes?.map(v => v.poll_id));

      const formattedPolls = (pollsData || []).map(poll => ({
        ...poll,
        options: poll.poll_options || [],
        total_votes: (poll.poll_options || []).reduce((acc: number, curr: any) => acc + (curr.votes_count || 0), 0),
        has_voted: votedIds.has(poll.id)
      }));

      setPolls(formattedPolls);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleCreatePoll = async () => {
    const validOptions = options.filter(opt => opt.trim() !== "");

    // SECURITY: Validate poll data
    const validation = validatePollCreate(question, validOptions);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit poll creation
    if (isRateLimited(pollLimiter, 'create_poll')) return;

    setCreating(true);
    try {
      // Sanitize inputs before insert
      const sanitizedQuestion = sanitizeField(question.trim(), 300);
      const sanitizedOptions = validOptions.map(opt => sanitizeField(opt.trim(), 200));

      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert([{ question: sanitizedQuestion }])
        .select().single();

      if (pollError) throw pollError;

      const { error: optError } = await supabase.from('poll_options').insert(
        sanitizedOptions.map(opt => ({ poll_id: poll.id, option_text: opt }))
      );

      if (optError) throw optError;

      toast.success("Poll Launched!");
      setShowCreate(false);
      setQuestion("");
      setOptions(["", ""]);
      fetchPolls();
    } catch (err: any) {
      toast.error(err.message || "Failed to create poll");
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) return;

    // SECURITY: Rate limit voting
    if (isRateLimited(voteLimiter, 'poll_vote')) return;

    try {
      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
      if (error) throw error;
      toast.success("Vote recorded!");
      fetchPolls();
    } catch (err) {
      toast.error("Already voted!");
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-8 pb-32">
        {/* HERO SECTION */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 mb-10"
        >
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-xs uppercase">
            <Zap className="h-4 w-4 fill-primary" />
            Live Feedback
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase text-foreground">
              Campus <span className="gradient-text">Pulse</span>
            </h1>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                  <Plus className="h-5 w-5 mr-2" />
                  Ask
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10 sm:max-w-md backdrop-blur-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight">Launch a Poll</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Question</Label>
                    <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's on your mind?" className="bg-secondary/50 border-none h-14 rounded-2xl text-lg px-4" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Options</Label>
                    {options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={opt} onChange={(e) => {
                          const n = [...options]; n[i] = e.target.value; setOptions(n);
                        }} placeholder={`Option ${i + 1}`} className="bg-secondary/50 border-none h-12 rounded-xl px-4" />
                      </div>
                    ))}
                    {options.length < 5 && (
                      <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ""])} className="text-primary font-bold hover:bg-transparent p-0 h-auto">+ ADD OPTION</Button>
                    )}
                  </div>
                  <Button onClick={handleCreatePoll} disabled={creating} className="w-full bg-gradient-primary h-14 rounded-2xl font-black uppercase tracking-widest text-lg">
                    {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Launch Poll"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* POLLS FEED */}
        <div className="space-y-8">
          {polls.length === 0 ? (
            <div className="text-center py-20 glass-card rounded-[3rem] border-dashed border-2">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground font-bold uppercase tracking-widest">No debates yet.</p>
            </div>
          ) : (
            polls.map((poll, index) => (
              <motion.div
                key={poll.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-primary/20`} />

                <h3 className="text-2xl font-black leading-tight uppercase tracking-tighter italic mb-6">
                  {poll.question}
                </h3>

                <div className="space-y-4">
                  {poll.options.map((opt: any) => {
                    const pct = poll.total_votes > 0 ? Math.round((opt.votes_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.id} className="relative h-16">
                        <Button
                          disabled={poll.has_voted}
                          onClick={() => handleVote(poll.id, opt.id)}
                          variant="ghost"
                          className={`w-full h-full justify-between px-6 rounded-2xl relative z-10 border-2 transition-all duration-500 ${poll.has_voted
                            ? 'border-transparent'
                            : 'border-secondary hover:border-primary/50 bg-secondary/20'
                            }`}
                        >
                          <span className="font-bold text-lg">{opt.option_text}</span>
                          {poll.has_voted && (
                            <motion.span
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="font-black text-2xl text-primary italic"
                            >
                              {pct}%
                            </motion.span>
                          )}
                        </Button>

                        {poll.has_voted && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="absolute inset-0 bg-primary/10 rounded-2xl z-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                      <Users className="h-3.5 w-3.5" />
                      {poll.total_votes} Students
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
                    </div>
                  </div>

                  {poll.has_voted && (
                    <div className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase tracking-tighter">
                      <CheckCircle2 className="h-3 w-3" /> Voted
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}