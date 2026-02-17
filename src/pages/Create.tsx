import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Video, Hash, X, Loader2, ArrowLeft, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { createPost } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, uploadMultipleFiles } from "@/lib/storage";
import { toast } from "sonner";

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#\w+/g);
    return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);

    try {
      // Use helper to upload multiple files to Cloudinary
      const fileArray = Array.from(files).slice(0, 10);
      const { urls, errors } = await uploadMultipleFiles('posts', fileArray, user.id);

      if (errors.length > 0) {
        console.error("Some uploads failed", errors);
        toast.error("Some images failed to upload");
      }

      setImages(prev => [...prev, ...urls].slice(0, 10));

      if (urls.length > 0) {
        toast.success("Images uploaded");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100MB");
      return;
    }

    setUploading(true);

    try {
      const { url, error } = await uploadFile('videos', file, user.id);

      if (error) throw error;
      if (!url) throw new Error("Upload failed");

      setVideoUrl(url);
      setImages([]); // Clear images when video is added
      toast.success("Video uploaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideoUrl(null);
  };

  const handleSubmit = async () => {
    if (!user || (!content.trim() && images.length === 0 && !videoUrl)) {
      toast.error("Add some content to your post");
      return;
    }

    setLoading(true);

    try {
      const hashtags = extractHashtags(content);
      const { error } = await createPost({
        user_id: user.id,
        content: content.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        video_url: videoUrl || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
      });

      if (error) {
        toast.error("Failed to create post");
      } else {
        toast.success("Post created!");
        navigate("/");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const canPost = content.trim() || images.length > 0 || videoUrl;

  return (
    <AppLayout showNav={false}>
      <div className="min-h-screen bg-gradient-surface">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50"
        >
          <div className="flex items-center justify-between h-14 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Create Post</h1>
            <Button
              onClick={handleSubmit}
              disabled={loading || !canPost}
              size="sm"
              className="rounded-full bg-gradient-primary hover:opacity-90 px-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </motion.header>

        {/* Content */}
        <div className="pt-16 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-4"
          >
            <Textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px] bg-transparent border-none resize-none focus-visible:ring-0 text-lg placeholder:text-muted-foreground"
              maxLength={1000}
              autoFocus
            />

            <div className="text-right text-sm text-muted-foreground">
              {content.length}/1000
            </div>

            {/* Image Previews */}
            <AnimatePresence>
              {images.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((url, index) => (
                      <motion.div
                        key={url}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square rounded-xl overflow-hidden"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video Preview */}
            <AnimatePresence>
              {videoUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 relative rounded-xl overflow-hidden"
                >
                  <video
                    src={videoUrl}
                    controls
                    className="w-full aspect-video object-cover rounded-xl"
                  />
                  <button
                    onClick={removeVideo}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}

            {/* Media buttons */}
            <div className="flex gap-2 mt-6 pt-6 border-t border-border/50">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />

              <Button
                variant="secondary"
                className="flex-1 rounded-xl h-12"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || !!videoUrl}
              >
                <Image className="h-5 w-5 mr-2" />
                Photo
                {images.length > 0 && (
                  <span className="ml-1 text-xs">({images.length}/10)</span>
                )}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 rounded-xl h-12"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading || images.length > 0}
              >
                <Video className="h-5 w-5 mr-2" />
                Video
              </Button>
              <Button
                variant="secondary"
                className="flex-1 rounded-xl h-12"
                onClick={() => {
                  if (!content.includes("#")) {
                    setContent(prev => prev + " #");
                  }
                }}
              >
                <Hash className="h-5 w-5 mr-2" />
                Tag
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-4 text-center">
              Use #hashtags to make your post discoverable
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
