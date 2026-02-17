import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Building2, MapPin, DollarSign, Clock, ExternalLink, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { validateInternshipCreate, sanitizeField, internshipLimiter, isRateLimited } from "@/lib/security";

interface Internship {
  id: string;
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  stipend: string | null;
  duration: string | null;
  apply_link: string | null;
  posted_by: string;
  created_at: string;
}

export default function Internships() {
  const { user } = useAuth();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [stipend, setStipend] = useState('');
  const [duration, setDuration] = useState('');
  const [applyLink, setApplyLink] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchInternships = useCallback(async () => {
    const { data } = await supabase
      .from('internships')
      .select('*')
      .order('created_at', { ascending: false });

    setInternships(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInternships();
  }, [fetchInternships]);

  const handleCreate = async () => {
    if (!user || !title.trim() || !company.trim()) return;

    // SECURITY: Validate internship data
    const validation = validateInternshipCreate({
      title: title.trim(),
      company: company.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      stipend: stipend.trim() || undefined,
      duration: duration.trim() || undefined,
      apply_link: applyLink.trim() || undefined
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit internship posting
    if (isRateLimited(internshipLimiter, 'create_internship')) return;

    setCreating(true);
    try {
      const { error } = await supabase.from('internships').insert({
        title: sanitizeField(title.trim(), 200),
        company: sanitizeField(company.trim(), 150),
        description: sanitizeField(description.trim(), 2000) || null,
        location: sanitizeField(location.trim(), 200) || null,
        stipend: sanitizeField(stipend.trim(), 100) || null,
        duration: sanitizeField(duration.trim(), 100) || null,
        apply_link: applyLink.trim() || null,
        posted_by: user.id
      });

      if (error) throw error;

      toast.success('Internship posted!');
      setTitle('');
      setCompany('');
      setDescription('');
      setLocation('');
      setStipend('');
      setDuration('');
      setApplyLink('');
      setShowCreateDialog(false);
      fetchInternships();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post internship');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold gradient-text">Internships</h1>
            <p className="text-sm text-muted-foreground">Opportunities for students</p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Post
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="gradient-text">Post Internship</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Software Developer Intern" className="bg-secondary/30" />
                </div>
                <div>
                  <Label htmlFor="company">Company *</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="bg-secondary/30" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Job details..." className="bg-secondary/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote/City" className="bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="stipend">Stipend</Label>
                    <Input id="stipend" value={stipend} onChange={(e) => setStipend(e.target.value)} placeholder="₹10,000/month" className="bg-secondary/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration</Label>
                    <Input id="duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="3 months" className="bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="applyLink">Apply Link</Label>
                    <Input id="applyLink" value={applyLink} onChange={(e) => setApplyLink(e.target.value)} placeholder="https://..." className="bg-secondary/30" />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={creating || !title.trim() || !company.trim()} className="w-full bg-gradient-primary">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Post Internship
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        {internships.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-2xl">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No internships posted yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {internships.map((internship, index) => (
              <motion.div
                key={internship.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 rounded-2xl"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{internship.title}</h3>
                    <p className="text-sm text-primary flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {internship.company}
                    </p>
                  </div>
                  {internship.apply_link && (
                    <a href={internship.apply_link} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-gradient-primary">
                        Apply <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                  )}
                </div>

                {internship.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{internship.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {internship.location && (
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" /> {internship.location}
                    </Badge>
                  )}
                  {internship.stipend && (
                    <Badge variant="secondary" className="gap-1">
                      <DollarSign className="h-3 w-3" /> {internship.stipend}
                    </Badge>
                  )}
                  {internship.duration && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" /> {internship.duration}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
