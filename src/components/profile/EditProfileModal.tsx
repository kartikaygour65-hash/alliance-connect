import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Palette, Lock, Globe, Image as ImageIcon, Upload, Camera, Link as LinkIcon, RotateCw, ZoomIn, Check, X } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import { Slider } from "@/components/ui/slider";

export function EditProfileModal({ open, onOpenChange, profile, onProfileUpdated }: any) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(profile?.username || "");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [website, setWebsite] = useState(profile?.website || "");
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);

  // Theme State
  const [accentColor, setAccentColor] = useState(profile?.theme_config?.accent || "#8B5CF6");
  const [bgStyle, setBgStyle] = useState(profile?.theme_config?.background || "aurora-violet");

  // Files & Previews
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");
  const [coverFile, setCoverFile] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState(profile?.cover_url || "");

  // Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover' | null>(null);
  const [cropperImgSrc, setCropperImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropperImgSrc(reader.result?.toString() || null);
        setCropType(type);
        setIsCropping(true);
        setZoom(1);
        setRotation(0);
      });
      reader.readAsDataURL(file);
    }
    // clear input so same file can be selected again if needed
    e.target.value = '';
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      if (!cropperImgSrc || !croppedAreaPixels) return;

      const croppedBlob = await getCroppedImg(cropperImgSrc, croppedAreaPixels, rotation);
      if (!croppedBlob) throw new Error("Could not crop image");

      const previewUrl = URL.createObjectURL(croppedBlob);

      if (cropType === 'avatar') {
        setAvatarFile(croppedBlob);
        setAvatarPreview(previewUrl);
      } else {
        setCoverFile(croppedBlob);
        setCoverPreview(previewUrl);
      }
      setIsCropping(false);
      setCropperImgSrc(null);
    } catch (e) {
      toast.error("Failed to crop image");
    }
  };

  const handleSave = async () => {
    if (!profile?.user_id) {
      toast.error("User ID not found");
      return;
    }
    setLoading(true);
    console.log("[ProfileUpdate] Starting save process...");
    try {
      let avatar_url = profile.avatar_url;
      let cover_url = profile.cover_url;

      if (avatarFile) {
        console.log("[ProfileUpdate] Uploading new avatar...");
        const file = new File([avatarFile], `avatar_${profile.user_id}.jpg`, { type: "image/jpeg" });
        const { url, error } = await uploadFile('avatars', file, profile.user_id);
        if (error) throw error;
        if (url) {
          avatar_url = url;
          console.log("[ProfileUpdate] New avatar URL:", avatar_url);
        }
      }

      if (coverFile) {
        console.log("[ProfileUpdate] Uploading new cover...");
        const file = new File([coverFile], `cover_${profile.user_id}.jpg`, { type: "image/jpeg" });
        const { url, error } = await uploadFile('covers', file, profile.user_id);
        if (error) throw error;
        if (url) {
          cover_url = url;
          console.log("[ProfileUpdate] New cover URL:", cover_url);
        }
      }

      const theme_config = { accent: accentColor, background: bgStyle, aura: "glow" };
      console.log("[ProfileUpdate] Updating Supabase profile...");
      const { error: updateError } = await updateProfile(profile.user_id, {
        username,
        full_name: fullName,
        bio,
        website,
        is_private: isPrivate,
        theme_config,
        avatar_url,
        cover_url
      });

      if (updateError) throw updateError;

      toast.success("Profile updated!");
      console.log("[ProfileUpdate] Success!");

      // Cleanup previews
      if (avatarFile) URL.revokeObjectURL(avatarPreview);
      if (coverFile) URL.revokeObjectURL(coverPreview);

      onProfileUpdated();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[ProfileUpdate] Error:", e);
      toast.error(e.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // --- THE 5 AURORA OPTIONS ---
  const themes = [
    { name: "Nebula", bg: "aurora-violet", color: "#8b5cf6" }, // Purple
    { name: "Emerald", bg: "aurora-emerald", color: "#10b981" }, // Green
    { name: "Abyss", bg: "aurora-blue", color: "#06b6d4" }, // Blue
    { name: "Solar", bg: "aurora-orange", color: "#f97316" }, // Orange
    { name: "Rose", bg: "aurora-rose", color: "#f43f5e" }, // Pink
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setIsCropping(false); onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-black/95 border-white/10 backdrop-blur-xl max-h-[85vh] overflow-y-auto p-0 gap-0">

        {isCropping && cropperImgSrc ? (
          <div className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black z-10">
              <Button variant="ghost" size="icon" onClick={() => setIsCropping(false)}><X className="h-5 w-5" /></Button>
              <h3 className="font-black italic uppercase">Adjust Image</h3>
              <Button variant="ghost" size="icon" onClick={handleCropSave} className="text-primary"><Check className="h-5 w-5" /></Button>
            </div>

            <div className="flex-1 relative bg-neutral-900">
              <Cropper
                image={cropperImgSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={cropType === 'avatar' ? 1 : 16 / 9}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                cropShape={cropType === 'avatar' ? 'round' : 'rect'}
              />
            </div>

            <div className="p-4 bg-black space-y-4">
              <div className="flex items-center gap-4">
                <ZoomIn className="h-4 w-4 text-white/50" />
                <Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(v) => setZoom(v[0])} className="flex-1" />
              </div>
              <div className="flex items-center gap-4">
                <RotateCw className="h-4 w-4 text-white/50" />
                <Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} className="flex-1" />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <DialogHeader><DialogTitle className="text-xl font-black italic uppercase">Edit Profile</DialogTitle></DialogHeader>
            {/* BANNER */}
            <div className="relative group rounded-xl overflow-hidden border border-white/10 h-32 bg-neutral-900 cursor-pointer" onClick={() => coverInputRef.current?.click()}>
              {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity" /> : <div className="w-full h-full flex items-center justify-center text-white/20"><ImageIcon className="h-8 w-8" /></div>}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="bg-black/50 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-2"><Upload className="h-3 w-3" /> Change Cover</span></div>
            </div>

            {/* AVATAR */}
            <div className="flex justify-center -mt-16 relative z-10">
              <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div className="h-24 w-24 rounded-full border-4 border-black overflow-hidden bg-neutral-800">
                  {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white">?</div>}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="h-6 w-6 text-white" /></div>
              </div>
            </div>

            <input type="file" ref={coverInputRef} hidden accept="image/*" onChange={(e) => handleFileSelect(e, 'cover')} />
            <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleFileSelect(e, 'avatar')} />

            <div className="space-y-4">
              <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().trim())} className="bg-white/5 border-white/10" /></div>
              <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-white/5 border-white/10" /></div>
              <div className="space-y-2"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-white/5 border-white/10" /></div>
              <div className="space-y-2"><Label>Website</Label><div className="relative"><LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={website} onChange={(e) => setWebsite(e.target.value)} className="pl-9 bg-white/5 border-white/10" placeholder="https://..." /></div></div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">{isPrivate ? <Lock className="h-4 w-4 text-red-400" /> : <Globe className="h-4 w-4 text-green-400" />}<div><p className="font-bold text-sm">Private Account</p><p className="text-[10px] opacity-50">{isPrivate ? "Followers only" : "Public"}</p></div></div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Aurora Theme</Label>
              <div className="grid grid-cols-5 gap-2">
                {themes.map((t) => (
                  <button key={t.name} onClick={() => { setAccentColor(t.color); setBgStyle(t.bg); }} className={`h-10 rounded-lg border-2 transition-all ${bgStyle === t.bg ? 'border-white scale-105' : 'border-transparent opacity-50'}`} style={{ background: t.color }} title={t.name} />
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full font-black uppercase tracking-widest" disabled={loading} style={{ backgroundColor: accentColor }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}