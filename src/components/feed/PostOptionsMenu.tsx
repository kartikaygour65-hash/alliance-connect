import { useState } from "react";
import { Edit2, Trash2, Share2, Flag, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSiteUrl } from "@/lib/supabase";


interface PostOptionsMenuProps {
  postId: string;
  userId: string;
  currentUserId: string | undefined;
  isSaved: boolean;
  onSaveToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  children: React.ReactNode;
}

export function PostOptionsMenu({
  postId,
  userId,
  currentUserId,
  isSaved,
  onSaveToggle,
  onEdit,
  onDeleted,
  children,
}: PostOptionsMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId === userId;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    setDeleting(false);

    if (error) {
      toast.error("Failed to delete post");
    } else {
      toast.success("Post deleted");
      onDeleted();
    }
    setShowDeleteDialog(false);
  };

  const handleShare = async () => {
    const url = `${getSiteUrl()}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleReport = async () => {
    if (!currentUserId) return;

    const { error } = await supabase.from("reports").insert([
      {
        reporter_id: currentUserId,
        content_id: postId,
        content_type: "post",
        reason: "Reported by user",
      },
    ]);

    if (error) {
      toast.error("Failed to report post");
    } else {
      toast.success("Post reported. Our team will review it.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onSaveToggle}>
            {isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4 mr-2" />
                Unsave
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>

          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}

          {!isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReport} className="text-destructive">
                <Flag className="h-4 w-4 mr-2" />
                Report
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
