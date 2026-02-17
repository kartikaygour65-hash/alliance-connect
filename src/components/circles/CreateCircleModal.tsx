import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Globe, Loader2, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { validateCircleCreate, sanitizeField, circleLimiter, isRateLimited } from "@/lib/security";

interface CreateCircleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateCircleModal({ open, onOpenChange, onCreated }: CreateCircleModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!user || !name.trim()) return;

    // SECURITY: Validate circle data
    const validation = validateCircleCreate({
      name: name.trim(),
      description: description.trim() || undefined
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit circle creation
    if (isRateLimited(circleLimiter, 'create_circle')) return;

    setLoading(true);

    try {
      let coverUrl = null;

      if (coverFile) {
        const { url, error } = await uploadFile('circles', coverFile, user.id);
        if (error) throw error;
        coverUrl = url;
      }

      // Create the circle (sanitized)
      const { data: circle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: sanitizeField(name.trim(), 100),
          description: sanitizeField(description.trim(), 500) || null,
          is_private: isPrivate,
          cover_url: coverUrl,
          created_by: user.id
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: circle.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      toast.success('Circle created successfully!');
      setName('');
      setDescription('');
      setIsPrivate(false);
      setCoverFile(null);
      setCoverPreview(null);
      onCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="gradient-text">Create Circle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover image */}
          <div>
            <Label className="text-sm text-muted-foreground">Cover Image</Label>
            <div className="mt-2 relative h-32 rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm">Add cover image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name">Circle Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Photography Club"
              className="bg-secondary/30"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this circle about?"
              className="bg-secondary/30 min-h-[80px]"
            />
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              <div>
                <p className="font-medium text-sm">{isPrivate ? 'Private Circle' : 'Public Circle'}</p>
                <p className="text-xs text-muted-foreground">
                  {isPrivate ? 'Only invited members can join' : 'Anyone can join this circle'}
                </p>
              </div>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full bg-gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Circle'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
