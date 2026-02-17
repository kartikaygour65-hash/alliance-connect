import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Loader2, Image as ImageIcon, Check, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface StoryHighlight {
  id: string;
  name: string;
  cover_url: string | null;
  user_id: string;
}

interface Story {
  id: string;
  media_url: string | null;
  content: string | null;
  background_color: string | null;
  created_at: string;
}

interface HighlightWithStories extends StoryHighlight {
  stories: Story[];
}

interface MomentHighlightsProps {
  userId: string;
  isOwnProfile?: boolean;
}

export function MomentHighlights({ userId, isOwnProfile = false }: MomentHighlightsProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<HighlightWithStories[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<HighlightWithStories | null>(null);
  const [newHighlightName, setNewHighlightName] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableStories, setAvailableStories] = useState<Story[]>([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [highlightToDelete, setHighlightToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchHighlights();
  }, [userId]);

  async function fetchHighlights() {
    const { data: highlightsData } = await supabase
      .from('story_highlights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!highlightsData) return;

    // Fetch stories for each highlight
    const highlightsWithStories: HighlightWithStories[] = [];

    for (const highlight of highlightsData) {
      const { data: itemsData } = await supabase
        .from('story_highlight_items')
        .select('story_id')
        .eq('highlight_id', highlight.id);

      if (itemsData && itemsData.length > 0) {
        const storyIds = itemsData.map(item => item.story_id);
        const { data: storiesData } = await supabase
          .from('stories')
          .select('id, media_url, content, background_color, created_at')
          .in('id', storyIds);

        highlightsWithStories.push({
          ...highlight,
          stories: storiesData || [],
        });
      } else {
        highlightsWithStories.push({
          ...highlight,
          stories: [],
        });
      }
    }

    setHighlights(highlightsWithStories);
  }

  async function fetchAvailableStories() {
    if (!user) return;

    // Fetch all stories from this user (including expired ones for highlights)
    const { data } = await supabase
      .from('stories')
      .select('id, media_url, content, background_color, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setAvailableStories(data || []);
  }

  const handleCreateHighlight = async () => {
    if (!newHighlightName.trim() || !user) {
      toast.error('Please enter a name for your highlight');
      return;
    }

    if (selectedStoryIds.size === 0) {
      toast.error('Please select at least one moment');
      return;
    }

    setLoading(true);
    try {
      // Get cover from first selected story
      const firstStoryId = Array.from(selectedStoryIds)[0];
      const firstStory = availableStories.find(s => s.id === firstStoryId);

      const { data: highlight, error } = await supabase
        .from('story_highlights')
        .insert({
          user_id: user.id,
          name: newHighlightName,
          cover_url: firstStory?.media_url || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add stories to highlight
      const items = Array.from(selectedStoryIds).map(storyId => ({
        highlight_id: highlight.id,
        story_id: storyId,
      }));

      await supabase.from('story_highlight_items').insert(items);

      toast.success('Highlight created!');
      setNewHighlightName('');
      setSelectedStoryIds(new Set());
      setShowCreateModal(false);
      fetchHighlights();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create highlight');
    } finally {
      setLoading(false);
    }
  };

  const handleEditHighlight = async (highlight: HighlightWithStories) => {
    setSelectedHighlight(highlight);
    await fetchAvailableStories();
    
    // Pre-select stories already in the highlight
    const existingIds = new Set(highlight.stories.map(s => s.id));
    setSelectedStoryIds(existingIds);
    setNewHighlightName(highlight.name);
    setShowEditSheet(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedHighlight || !user) return;

    setLoading(true);
    try {
      // Update name and cover
      const firstStoryId = Array.from(selectedStoryIds)[0];
      const firstStory = availableStories.find(s => s.id === firstStoryId);

      await supabase
        .from('story_highlights')
        .update({
          name: newHighlightName,
          cover_url: firstStory?.media_url || selectedHighlight.cover_url,
        })
        .eq('id', selectedHighlight.id);

      // Remove old items
      await supabase
        .from('story_highlight_items')
        .delete()
        .eq('highlight_id', selectedHighlight.id);

      // Add new items
      if (selectedStoryIds.size > 0) {
        const items = Array.from(selectedStoryIds).map(storyId => ({
          highlight_id: selectedHighlight.id,
          story_id: storyId,
        }));
        await supabase.from('story_highlight_items').insert(items);
      }

      toast.success('Highlight updated!');
      setShowEditSheet(false);
      setSelectedHighlight(null);
      fetchHighlights();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update highlight');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHighlight = async () => {
    if (!highlightToDelete) return;

    setLoading(true);
    try {
      await supabase
        .from('story_highlights')
        .delete()
        .eq('id', highlightToDelete);

      toast.success('Highlight deleted');
      setShowDeleteDialog(false);
      setHighlightToDelete(null);
      fetchHighlights();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete highlight');
    } finally {
      setLoading(false);
    }
  };

  const toggleStorySelection = (storyId: string) => {
    setSelectedStoryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const openCreateModal = async () => {
    await fetchAvailableStories();
    setSelectedStoryIds(new Set());
    setNewHighlightName('');
    setShowCreateModal(true);
  };

  if (highlights.length === 0 && !isOwnProfile) return null;

  return (
    <div className="py-4">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 px-4">
          {/* Add new highlight button (own profile only) */}
          {isOwnProfile && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openCreateModal}
              className="flex flex-col items-center gap-1.5 min-w-[72px]"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-primary transition-colors">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">New</span>
            </motion.button>
          )}

          {/* Highlight items */}
          {highlights.map((highlight) => (
            <motion.button
              key={highlight.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => isOwnProfile ? handleEditHighlight(highlight) : undefined}
              onContextMenu={(e) => {
                if (isOwnProfile) {
                  e.preventDefault();
                  setHighlightToDelete(highlight.id);
                  setShowDeleteDialog(true);
                }
              }}
              className="flex flex-col items-center gap-1.5 min-w-[72px] group"
            >
              <div className="relative">
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-muted to-muted-foreground/30">
                  <div className="p-[2px] bg-background rounded-full">
                    <Avatar className="h-14 w-14">
                      {highlight.cover_url ? (
                        <AvatarImage src={highlight.cover_url} className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                </div>
              </div>

              <span className="text-xs text-muted-foreground truncate max-w-[72px]">
                {highlight.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Create highlight modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>New Highlight</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-y-auto">
            <Input
              value={newHighlightName}
              onChange={(e) => setNewHighlightName(e.target.value)}
              placeholder="Highlight name"
              maxLength={20}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Select Moments</p>
              {availableStories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No moments available. Create some moments first!
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {availableStories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => toggleStorySelection(story.id)}
                      className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedStoryIds.has(story.id) ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      {story.media_url ? (
                        <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center p-2"
                          style={{ background: story.background_color || '#6366f1' }}
                        >
                          <p className="text-white text-[8px] line-clamp-3 text-center">
                            {story.content}
                          </p>
                        </div>
                      )}
                      {selectedStoryIds.has(story.id) && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateHighlight} disabled={loading || selectedStoryIds.size === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit highlight sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle>Edit Highlight</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => {
                if (selectedHighlight) {
                  setHighlightToDelete(selectedHighlight.id);
                  setShowEditSheet(false);
                  setShowDeleteDialog(true);
                }
              }}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <Input
              value={newHighlightName}
              onChange={(e) => setNewHighlightName(e.target.value)}
              placeholder="Highlight name"
              maxLength={20}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Moments in this highlight</p>
              <div className="grid grid-cols-3 gap-2 max-h-[calc(80vh-250px)] overflow-y-auto">
                {availableStories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => toggleStorySelection(story.id)}
                    className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedStoryIds.has(story.id) ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    {story.media_url ? (
                      <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center p-2"
                        style={{ background: story.background_color || '#6366f1' }}
                      >
                        <p className="text-white text-[8px] line-clamp-3 text-center">
                          {story.content}
                        </p>
                      </div>
                    )}
                    {selectedStoryIds.has(story.id) && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditSheet(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Highlight</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this highlight? The moments inside will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHighlight}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
