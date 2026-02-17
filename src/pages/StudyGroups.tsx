import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Clock, MapPin, Loader2, BookOpen, ChevronRight, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateStudyGroupCreate, sanitizeField, studyGroupLimiter, genericLimiter, isRateLimited } from "@/lib/security";

// Engineering-focused subjects
const ENGINEERING_SUBJECTS = [
  "Mathematics (Calculus/Linear Algebra)",
  "Physics (Mechanics/Electromagnetism)",
  "Programming (Python/C/C++)",
  "Data Structures & Algorithms",
  "Circuits & Electronics",
  "Thermodynamics",
  "Engineering Mechanics",
  "Machine Learning / AI",
  "Embedded Systems",
  "Other Engineering Branch"
];

export default function StudyGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('6');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('study_groups').select('*').order('created_at', { ascending: false });
    setGroups(data || []);
  }, []);

  const fetchMemberships = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('study_group_members').select('group_id').eq('user_id', user.id);
    setUserMemberships(new Set(data?.map(m => m.group_id) || []));
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchGroups(), fetchMemberships()]);
      setLoading(false);
    };
    loadData();
  }, [fetchGroups, fetchMemberships]);

  const handleJoin = async (groupId: string) => {
    if (!user) return;

    // SECURITY: Rate limit join actions
    if (isRateLimited(genericLimiter, 'join_group')) return;

    try {
      const { error } = await supabase.from('study_group_members').insert({ group_id: groupId, user_id: user.id });
      if (error) throw error;
      setUserMemberships(prev => new Set([...prev, groupId]));
      fetchGroups();
      toast.success('Joined session!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join');
    }
  };

  const handleLeave = async (groupId: string) => {
    if (!user) return;

    // SECURITY: Rate limit leave actions
    if (isRateLimited(genericLimiter, 'leave_group')) return;

    try {
      const { error } = await supabase.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
      if (error) throw error;
      setUserMemberships(prev => { const next = new Set(prev); next.delete(groupId); return next; });
      fetchGroups();
      toast.success('Left session');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave');
    }
  };

  const handleCreate = async () => {
    if (!user || !subject.trim()) return;

    // SECURITY: Validate study group data
    const validation = validateStudyGroupCreate({
      subject: subject.trim(),
      description: description.trim() || undefined,
      max_members: maxMembers,
      meeting_time: meetingTime.trim() || undefined,
      location: location.trim() || undefined
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit study group creation
    if (isRateLimited(studyGroupLimiter, 'create_study_group')) return;

    setCreating(true);
    try {
      const { data: group, error: groupError } = await supabase.from('study_groups').insert({
        subject: sanitizeField(subject.trim(), 200),
        description: sanitizeField(description.trim(), 1000) || null,
        max_members: parseInt(maxMembers) || 6,
        meeting_time: sanitizeField(meetingTime.trim(), 100) || null,
        location: sanitizeField(location.trim(), 200) || null,
        created_by: user.id
      }).select().single();
      if (groupError) throw groupError;
      await supabase.from('study_group_members').insert({ group_id: group.id, user_id: user.id });
      toast.success('Session scheduled!');
      setSubject(''); setDescription(''); setShowCreateDialog(false);
      fetchGroups(); fetchMemberships();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black gradient-text uppercase tracking-tighter italic leading-none">Study <span className="text-foreground">Squads</span></h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Collab on Engineering Projects</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary rounded-2xl px-6 h-12 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                <Plus className="h-5 w-5 mr-2" /> Schedule Session
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 sm:max-w-md">
              <DialogHeader><DialogTitle className="gradient-text font-black uppercase italic">Create Squad</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Engineering Subject</Label>
                  <Select onValueChange={setSubject}>
                    <SelectTrigger className="bg-secondary/30 h-12 rounded-xl border-none"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                      {ENGINEERING_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Max Size</Label>
                    <Input type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} className="bg-secondary/30 h-12 rounded-xl border-none" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">When?</Label>
                    <Input value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} placeholder="e.g. 6 PM" className="bg-secondary/30 h-12 rounded-xl border-none" />
                  </div>
                </div>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Lab 4 / Library)" className="bg-secondary/30 h-12 rounded-xl border-none" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Topic: Internal Exams / Project Work" className="bg-secondary/30 rounded-xl" />
                <Button onClick={handleCreate} disabled={creating || !subject} className="w-full bg-gradient-primary h-14 rounded-2xl font-black uppercase tracking-widest">
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "POST SESSION"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        <div className="space-y-6">
          {groups.map((group, index) => {
            const isMember = userMemberships.has(group.id);
            const isFull = group.current_members >= group.max_members;
            const progress = (group.current_members / group.max_members) * 100;

            return (
              <motion.div key={group.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} className="glass-card p-6 rounded-[2.5rem] border-none shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><BookOpen className="h-16 w-16" /></div>

                <div className="flex items-start justify-between mb-4">
                  <div className="max-w-[70%]">
                    <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-widest px-3 py-1 mb-2">Engineering</Badge>
                    <h3 className="text-xl font-black uppercase leading-tight">{group.subject}</h3>
                    <p className="text-sm text-muted-foreground font-medium mt-1 line-clamp-1">{group.description}</p>
                  </div>
                  <Button size="sm" variant={isMember ? "outline" : "default"} onClick={() => isMember ? handleLeave(group.id) : handleJoin(group.id)} disabled={!isMember && isFull} className={`rounded-full px-6 font-black uppercase text-[10px] h-9 ${isMember ? 'border-2' : 'bg-gradient-primary'}`}>
                    {isMember ? 'Leave' : isFull ? 'Full' : 'Join'}
                  </Button>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-end">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><Clock className="h-3 w-3" /> {group.meeting_time || 'TBD'}</div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><MapPin className="h-3 w-3" /> {group.location || 'Library'}</div>
                    </div>
                    <div className="text-[10px] font-black text-primary uppercase">{group.current_members} / {group.max_members} IN</div>
                  </div>
                  <Progress value={progress} className="h-2.5 bg-secondary/30 rounded-full" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}