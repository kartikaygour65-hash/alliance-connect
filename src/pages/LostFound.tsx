import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search as SearchIcon,
  MapPin,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  MessageCircle,
  ImageIcon as ImageIcon,
  Camera,
  MessageSquare,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProfessionalCamera } from "@/components/camera/ProfessionalCamera";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { validateLostFoundItem, sanitizeField, lostFoundLimiter, genericLimiter, isRateLimited } from "@/lib/security";

interface LostFoundItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  images: string[] | null;
  contact_info: string | null;
  is_resolved: boolean;
  created_at: string;
  posted_by: string;
}

export default function LostFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'lost' | 'found'>('all');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [location, setLocation] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ file: File, preview: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lost_found')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile({ file, preview: URL.createObjectURL(file) });
    }
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;

    // SECURITY: Validate all fields
    const validation = validateLostFoundItem({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      location: location.trim() || undefined,
      contact_info: contactInfo.trim() || undefined
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit
    if (isRateLimited(lostFoundLimiter, 'create_lost_found')) return;

    setCreating(true);
    try {
      const imageUrls: string[] = [];
      if (selectedFile) {
        const { url, error } = await uploadFile('lost-found', selectedFile.file, user.id);
        if (error) throw error;
        if (url) imageUrls.push(url);
      }

      const { error } = await supabase.from('lost_found').insert({
        title: sanitizeField(title.trim(), 150),
        description: sanitizeField(description.trim(), 1000) || null,
        type,
        location: sanitizeField(location.trim(), 200) || null,
        contact_info: sanitizeField(contactInfo.trim(), 200) || null,
        images: imageUrls,
        posted_by: user.id,
        is_resolved: false
      });

      if (error) throw error;
      toast.success('Posted successfully!');
      setTitle(''); setDescription(''); setLocation(''); setContactInfo('');
      setSelectedFile(null); setShowCreateDialog(false);
      fetchItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post');
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async (itemId: string) => {
    // SECURITY: Rate limit resolve actions
    if (isRateLimited(genericLimiter, 'resolve_item')) return;

    try {
      const { error } = await supabase.from('lost_found').update({ is_resolved: true }).eq('id', itemId);
      if (error) throw error;
      toast.success('Marked as resolved!');
      fetchItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  const handleForceDelete = async (itemId: string) => {
    if (!window.confirm("Permanently delete this report?")) return;
    try {
      const { error } = await supabase.from('lost_found').delete().eq('id', itemId);
      if (error) throw error;
      toast.success('Report deleted');
      fetchItems();
    } catch (error: any) {
      toast.error('Delete failed');
    }
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return !item.is_resolved;
    return item.type === activeTab && !item.is_resolved;
  });

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text uppercase tracking-tight">Lost & Found</h1>
            <p className="text-xs text-muted-foreground">Community-driven campus help</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary rounded-full px-6 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" /> Report
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 sm:max-w-md">
              <DialogHeader><DialogTitle className="gradient-text text-center">New Report</DialogTitle></DialogHeader>
              <div className="space-y-5 mt-2">
                <RadioGroup value={type} onValueChange={(v) => setType(v as 'lost' | 'found')} className="grid grid-cols-2 gap-4">
                  <div>
                    <RadioGroupItem value="lost" id="lost_form" className="peer sr-only" />
                    <Label htmlFor="lost_form" className="flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-4 hover:bg-red-500/10 transition-all cursor-pointer peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-500/20">
                      <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-red-500">Lost</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="found" id="found_form" className="peer sr-only" />
                    <Label htmlFor="found_form" className="flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-4 hover:bg-green-500/5 transition-all cursor-pointer peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:bg-green-500/10">
                      <CheckCircle className="mb-2 h-6 w-6 text-green-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Found</span>
                    </Label>
                  </div>
                </RadioGroup>
                {/* HIDDEN FILE INPUTS */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />

                {selectedFile ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/10">
                    <img src={selectedFile.preview} className="h-full w-full object-contain bg-black/10" alt="Preview" />
                    <button onClick={() => setSelectedFile(null)} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1.5 shadow-lg"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border/50 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="bg-primary/10 p-3 rounded-full">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border/50 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="bg-primary/10 p-3 rounded-full">
                        <ImageIcon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gallery</span>
                    </button>
                  </div>
                )}
                <div className="space-y-3">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item Name *" className="bg-secondary/30 rounded-xl h-12" />
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where? (e.g. Block A Library)" className="bg-secondary/30 rounded-xl h-12" />
                  <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="Phone or Email" className="bg-secondary/30 rounded-xl h-12" />
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Special details?" className="bg-secondary/30 rounded-xl resize-none h-24" />
                </div>
                {showCamera && (
                  <ProfessionalCamera
                    onCapture={(file) => {
                      setSelectedFile({ file, preview: URL.createObjectURL(file) });
                      setShowCamera(false);
                    }}
                    onClose={() => setShowCamera(false)}
                  />
                )}
                <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full bg-gradient-primary rounded-xl h-12 text-md font-bold">
                  {creating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "POST REPORT"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
          <TabsList className="w-full h-14 bg-secondary/30 p-1.5 rounded-2xl">
            <TabsTrigger
              value="all"
              className="flex-1 rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              RECENT
            </TabsTrigger>
            <TabsTrigger
              value="lost"
              className="flex-1 rounded-xl font-bold data-[state=active]:bg-red-500 data-[state=active]:text-white"
            >
              LOST
            </TabsTrigger>
            <TabsTrigger
              value="found"
              className="flex-1 rounded-xl font-bold data-[state=active]:bg-green-500 data-[state=active]:text-white"
            >
              FOUND
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-6">
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "glass-card rounded-[32px] overflow-hidden border-none shadow-md relative group",
                item.type === 'lost' ? "bg-red-500/10 border-red-500/20" : "bg-green-500/5 border-green-500/20"
              )}
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${item.type === 'lost' ? 'bg-red-500' : 'bg-green-500'}`} />

              {item.images?.[0] && (
                <div className="relative w-full bg-secondary/20">
                  {/* FIXED: Using object-contain and aspect-video to preserve ratio */}
                  <img
                    src={item.images[0]}
                    className="w-full aspect-video object-contain bg-black"
                    alt="Item"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge className={`${item.type === 'lost' ? 'bg-red-600' : 'bg-green-600'} text-white border-none px-3 py-1 rounded-full uppercase text-[10px] font-black tracking-widest`}>
                      {item.type}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    {!item.images?.[0] && (
                      <Badge
                        className={`mb-2 rounded-full text-[10px] uppercase font-black tracking-widest border-none ${item.type === 'lost'
                          ? 'bg-red-600 text-white'
                          : 'bg-green-600 text-white'
                          }`}
                      >
                        {item.type}
                      </Badge>
                    )}
                    <h3 className="font-black text-xl text-foreground tracking-tight leading-none uppercase">{item.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground/70 uppercase">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.location || 'Unknown'}</span>
                      <span>•</span>
                      <span>{item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : 'just now'}</span>
                    </div>
                  </div>
                  {item.posted_by === user?.id && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleResolve(item.id)} className="rounded-full bg-secondary/50 border-none text-[10px] font-black h-9 px-4 hover:bg-green-500 hover:text-white transition-all">
                        <CheckCircle className="h-4 w-4 mr-1.5" /> RESOLVE
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleForceDelete(item.id)} className="rounded-full bg-red-500/10 text-red-500 border-none text-[10px] font-black h-9 px-3 hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {item.description && <p className="text-sm text-muted-foreground/90 leading-relaxed mb-6 font-medium">{item.description}</p>}
                {item.contact_info && (
                  <div className={`rounded-2xl p-4 flex items-center justify-between border ${item.type === 'lost' ? 'bg-red-500/5 border-red-500/10' : 'bg-green-500/5 border-green-500/10'}`}>
                    <div className="flex flex-col">
                      <span className={`text-[10px] uppercase font-black tracking-widest ${item.type === 'lost' ? 'text-red-500' : 'text-green-600'}`}>
                        {item.type === 'lost' ? 'Contact Owner' : 'Contact Finder'}
                      </span>
                      <span className="text-sm font-bold tracking-tight text-foreground">{item.contact_info}</span>
                    </div>
                    <div className={`p-2 rounded-full ${item.type === 'lost' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'}`}>
                      <MessageCircle className="h-5 w-5" />
                    </div>
                  </div>
                )}

                {item.posted_by !== user?.id && (
                  <Button
                    className="w-full mt-4 rounded-xl font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white border border-white/10 h-10"
                    onClick={() => navigate(`/messages?chat=${item.posted_by}`)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    DM User
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}