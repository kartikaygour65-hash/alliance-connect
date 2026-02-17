import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Folder, MoreHorizontal, Trash2, Edit2, Bookmark, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Collection {
  id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
  post_count?: number;
}

interface SavedPost {
  id: string;
  post_id: string;
  collection_id: string | null;
  post?: {
    id: string;
    images: string[] | null;
    content: string | null;
  };
}

interface SavedCollectionsProps {
  onSelectCollection?: (collectionId: string | null) => void;
  selectedCollection?: string | null;
}

export function SavedCollections({ onSelectCollection, selectedCollection }: SavedCollectionsProps) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [allSavedCount, setAllSavedCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCollections();
      fetchAllSavedCount();
    }
  }, [user]);

  const fetchCollections = async () => {
    if (!user) return;

    const { data: collectionsData } = await supabase
      .from("saved_collections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (collectionsData) {
      // Get post counts for each collection
      const { data: savedPosts } = await supabase
        .from("saved_posts")
        .select("collection_id, post_id")
        .eq("user_id", user.id);

      const countMap: Record<string, number> = {};
      savedPosts?.forEach(sp => {
        if (sp.collection_id) {
          countMap[sp.collection_id] = (countMap[sp.collection_id] || 0) + 1;
        }
      });

      const enrichedCollections = collectionsData.map(c => ({
        ...c,
        post_count: countMap[c.id] || 0,
      }));

      setCollections(enrichedCollections);
    }

    setLoading(false);
  };

  const fetchAllSavedCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from("saved_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setAllSavedCount(count || 0);
  };

  const handleCreateCollection = async () => {
    if (!user || !newCollectionName.trim()) return;

    const { data, error } = await supabase
      .from("saved_collections")
      .insert({
        user_id: user.id,
        name: newCollectionName.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create collection");
      return;
    }

    setCollections(prev => [{ ...data, post_count: 0 }, ...prev]);
    setNewCollectionName("");
    setCreateOpen(false);
    toast.success("Collection created");
  };

  const handleUpdateCollection = async () => {
    if (!editingCollection || !newCollectionName.trim()) return;

    const { error } = await supabase
      .from("saved_collections")
      .update({ name: newCollectionName.trim() })
      .eq("id", editingCollection.id);

    if (error) {
      toast.error("Failed to update collection");
      return;
    }

    setCollections(prev =>
      prev.map(c => (c.id === editingCollection.id ? { ...c, name: newCollectionName.trim() } : c))
    );
    setEditingCollection(null);
    setNewCollectionName("");
    toast.success("Collection updated");
  };

  const handleDeleteCollection = async (collectionId: string) => {
    const { error } = await supabase
      .from("saved_collections")
      .delete()
      .eq("id", collectionId);

    if (error) {
      toast.error("Failed to delete collection");
      return;
    }

    setCollections(prev => prev.filter(c => c.id !== collectionId));
    if (selectedCollection === collectionId) {
      onSelectCollection?.(null);
    }
    toast.success("Collection deleted");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* All Saved Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectCollection?.(null)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
          selectedCollection === null ? "bg-primary/20 text-primary" : "bg-secondary/30 hover:bg-secondary/50"
        }`}
      >
        <div className="p-2 rounded-lg bg-secondary">
          <Bookmark className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium">All Saved</p>
          <p className="text-xs text-muted-foreground">{allSavedCount} posts</p>
        </div>
      </motion.button>

      {/* Collections List */}
      <AnimatePresence>
        {collections.map((collection, index) => (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              selectedCollection === collection.id ? "bg-primary/20" : "bg-secondary/30 hover:bg-secondary/50"
            }`}
          >
            <button
              onClick={() => onSelectCollection?.(collection.id)}
              className="flex items-center gap-3 flex-1"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                {collection.cover_url ? (
                  <img src={collection.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Folder className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{collection.name}</p>
                <p className="text-xs text-muted-foreground">{collection.post_count} posts</p>
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingCollection(collection);
                    setNewCollectionName(collection.name);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDeleteCollection(collection.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Create Collection Button */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors"
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <span className="font-medium text-muted-foreground">New Collection</span>
          </motion.button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setCreateOpen(false);
                  setNewCollectionName("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-primary"
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setEditingCollection(null);
                  setNewCollectionName("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-primary"
                onClick={handleUpdateCollection}
                disabled={!newCollectionName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
