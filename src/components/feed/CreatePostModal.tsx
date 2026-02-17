import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CreatePost } from "./CreatePost";

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostModal({ open, onOpenChange }: CreatePostModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 bg-transparent border-none shadow-none gap-0 sm:top-[20%]">
        {/* Hidden title for accessibility compliance */}
        <DialogTitle className="sr-only">Create New Post</DialogTitle>
        
        {/* Main post creation component */}
        <CreatePost onPostCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}