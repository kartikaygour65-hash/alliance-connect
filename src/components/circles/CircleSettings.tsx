import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2, Save, Trash2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "@/lib/storage";

interface CircleSettingsProps {
  circle: {
    id: string;
    name: string;
    description: string | null;
    cover_url: string | null;
    is_private: boolean;
  };
  onUpdate: () => void;
}

export function CircleSettings({ circle, onUpdate }: CircleSettingsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(circle.name);
  const [description, setDescription] = useState(circle.description || '');
  const [isPrivate, setIsPrivate] = useState(circle.is_private);
  const [coverUrl, setCoverUrl] = useState(circle.cover_url);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingCover(true);
    try {
      const { url, error } = await uploadFile('circles', file, user.id);
      if (error) throw error;
      setCoverUrl(url);
      toast.success('Cover uploaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload cover');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Circle name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('circles')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_private: isPrivate,
          cover_url: coverUrl
        })
        .eq('id', circle.id);

      if (error) throw error;
      toast.success('Circle updated');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update circle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete all members first
      await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circle.id);

      // Delete all posts
      await supabase
        .from('circle_posts')
        .delete()
        .eq('circle_id', circle.id);

      // Delete all messages
      await supabase
        .from('circle_messages')
        .delete()
        .eq('circle_id', circle.id);

      // Delete circle
      const { error } = await supabase
        .from('circles')
        .delete()
        .eq('id', circle.id);

      if (error) throw error;
      
      toast.success('Circle deleted');
      navigate('/circles');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete circle');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cover Image */}
      <div className="space-y-2">
        <Label>Cover Image</Label>
        <div
          className="relative h-32 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 overflow-hidden cursor-pointer group"
          onClick={() => coverInputRef.current?.click()}
        >
          {coverUrl && (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Circle Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Circle name"
          className="bg-secondary/30"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this circle about?"
          className="bg-secondary/30 resize-none"
          rows={3}
        />
      </div>

      {/* Privacy */}
      <div className="flex items-center justify-between glass-card p-4 rounded-xl">
        <div className="flex items-center gap-3">
          {isPrivate ? (
            <Lock className="h-5 w-5 text-yellow-500" />
          ) : (
            <Globe className="h-5 w-5 text-green-500" />
          )}
          <div>
            <p className="font-medium text-sm">Private Circle</p>
            <p className="text-xs text-muted-foreground">
              {isPrivate 
                ? 'Only invited members can join' 
                : 'Anyone can discover and join'}
            </p>
          </div>
        </div>
        <Switch
          checked={isPrivate}
          onCheckedChange={setIsPrivate}
        />
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full bg-gradient-primary"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Changes
      </Button>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-sm font-medium text-destructive mb-4">Danger Zone</h3>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Circle
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Circle</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the circle, all posts, and messages. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
