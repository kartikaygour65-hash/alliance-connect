import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/storage";
import { ImageCropper } from "@/components/ui/ImageCropper";

interface AdminThumbnailUpdateProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    settingKey: "mess_menu_thumbnail" | "leaderboard_thumbnail";
    title: string;
}

export function AdminThumbnailUpdate({ isOpen, onClose, onSuccess, settingKey, title }: AdminThumbnailUpdateProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setTempImageUrl(url);
        setIsCropping(true);
    };

    const onCropComplete = (croppedBlob: Blob) => {
        const croppedFile = new File([croppedBlob], "thumbnail.jpg", { type: "image/jpeg" });
        setSelectedFile(croppedFile);
        const url = URL.createObjectURL(croppedBlob);
        setPreviewUrl(url);
        setIsCropping(false);
    };

    const handleSave = async () => {
        if (!selectedFile) return toast.error("Please select an image first");

        setIsUploading(true);
        try {
            const { url: publicUrl, error: uploadError } = await uploadFile('posts', selectedFile, 'admin');

            if (uploadError) throw uploadError;
            if (!publicUrl) throw new Error("Upload failed");

            const { error: dbError } = await supabase
                .from('site_settings')
                .upsert({
                    key: settingKey,
                    value: publicUrl,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (dbError) throw dbError;

            toast.success(`${title} Thumbnail Updated!`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to update thumbnail");
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="relative w-full max-w-md glass-card p-6 rounded-[2.5rem] border-white/10 bg-zinc-900 overflow-hidden"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-primary" /> {title}
                        </h2>
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="relative aspect-video rounded-3xl bg-zinc-800/50 border-2 border-dashed border-white/10 overflow-hidden group">
                            {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                    <Upload className="h-8 w-8 text-primary/40" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Ratio 16:9 Preferred</span>
                                </div>
                            )}

                            <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="px-4 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-full">
                                    {previewUrl ? "Change Image" : "Select Image"}
                                </span>
                                <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" />
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 h-14 rounded-2xl text-white font-black uppercase tracking-widest hover:bg-white/5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isUploading || !selectedFile}
                                className="flex-[2] h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--primary),0.3)]"
                            >
                                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Deploy Thumbnail"}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>

            {tempImageUrl && (
                <ImageCropper
                    image={tempImageUrl}
                    aspect={16 / 9}
                    open={isCropping}
                    onCropComplete={onCropComplete}
                    onCancel={() => setIsCropping(false)}
                    title={`Frame Your ${title}`}
                />
            )}
        </>
    );
}
