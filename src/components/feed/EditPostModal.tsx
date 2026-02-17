import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditPostModalProps {
  post: {
    id: string;
    content: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditPostModal({ post, open, onOpenChange, onUpdated }: EditPostModalProps) {
  const [content, setContent] = useState(post.content || "");
  const [loading, setLoading] = useState(false);

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#\w+/g);
    return matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    const hashtags = extractHashtags(content);

    const { error } = await supabase
      .from("posts")
      .update({
        content: content.trim(),
        hashtags: hashtags.length > 0 ? hashtags : null,
      })
      .eq("id", post.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to update post");
    } else {
      toast.success("Post updated!");
      onUpdated();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="min-h-[150px]"
            maxLength={1000}
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{content.length}/1000</span>
            <Button
              onClick={handleSubmit}
              disabled={loading || !content.trim()}
              className="bg-gradient-primary"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
