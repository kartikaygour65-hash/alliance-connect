import { useState } from "react";
import { motion } from "framer-motion";
import { User, Building2, GraduationCap, Sparkles, Link as LinkIcon, FileText, Loader2, CheckCircle, XCircle, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkUsernameAvailable, updateProfile, supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useEffect } from "react";
import { toast } from "sonner";

const departments = [
  "Computer Science",
  "Business Administration",
  "Engineering",
  "Design",
  "Law",
  "Arts & Humanities",
  "Science",
  "Commerce",
  "Other",
];

const years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate", "Alumni"];

export function OnboardingForm() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    full_name: "", // This is Real Name
    department: "",
    year: "",
    bio: "",
    bio_link: "",
    avatar_url: "",
    banner_url: "",
    skills: [] as string[],
  });

  const [skillInput, setSkillInput] = useState("");
  const debouncedUsername = useDebounce(formData.username, 500);

  useEffect(() => {
    const checkUsername = async () => {
      if (debouncedUsername.length >= 3) {
        setCheckingUsername(true);
        const { available } = await checkUsernameAvailable(debouncedUsername);
        setUsernameAvailable(available);
        setCheckingUsername(false);
      } else {
        setUsernameAvailable(null);
      }
    };
    checkUsername();
  }, [debouncedUsername]);

  const handleAddSkill = () => {
    if (skillInput.trim() && formData.skills.length < 10) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await updateProfile(user.id, {
        username: formData.username,
        full_name: formData.full_name,
        department: formData.department || undefined,
        year: formData.year || undefined,
        bio: formData.bio || undefined,
        bio_link: formData.bio_link || undefined,
        avatar_url: formData.avatar_url || undefined,
        banner_url: formData.banner_url || undefined,
        skills: formData.skills.length > 0 ? formData.skills : undefined,
      });

      if (error) {
        if (error.message.includes("duplicate")) {
          setError("Username is already taken");
        } else {
          setError(error.message);
        }
        return;
      }

      await refreshProfile();
      toast.success("Welcome to Alliance Connect!");
      navigate("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };



  const canProceed = () => {
    if (step === 1) {
      return (
        formData.username.length >= 3 &&
        usernameAvailable === true &&
        formData.full_name.trim().length >= 2 &&
        formData.department
      );
    }
    if (step === 2) {
      // Step 2 is now optional
      return true;
    }
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      <div className="glass-card p-8 rounded-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold gradient-text mb-2">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            Step {step} of 2
          </p>
          <div className="flex gap-2 justify-center mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full transition-colors ${s <= step ? "bg-gradient-primary" : "bg-muted"
                  }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder="your_unique_id"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  className="h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary pr-10"
                  maxLength={20}
                />
                {checkingUsername && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This will be your unique search ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="full_name"
                placeholder="Your full name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Department <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-popover border-border shadow-2xl">
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  Year <span className="text-xs opacity-50">(Optional)</span>
                </Label>
                <Select
                  value={formData.year}
                  onValueChange={(value) => setFormData({ ...formData, year: value })}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select your year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-popover border-border shadow-2xl">
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}
        {
          step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                {/* Avatar Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile Picture
                  </Label>
                  <div className="relative aspect-square rounded-xl bg-secondary/50 border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group hover:border-primary transition-colors">
                    {formData.avatar_url ? (
                      <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-6 w-6" />
                        <span className="text-xs">Upload</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Use Cloudinary upload
                        const { url, error } = await uploadFile('avatars', file, user.id);

                        if (url) {
                          setFormData(prev => ({ ...prev, avatar_url: url }));
                        } else {
                          console.error("Avatar upload failed:", error);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Banner Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Banner
                  </Label>
                  <div className="relative aspect-square rounded-xl bg-secondary/50 border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group hover:border-primary transition-colors">
                    {formData.banner_url ? (
                      <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-6 w-6" />
                        <span className="text-xs">Upload</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Use Cloudinary upload
                        const { url, error } = await uploadFile('covers', file, user.id);

                        if (url) {
                          setFormData(prev => ({ ...prev, banner_url: url }));
                        } else {
                          console.error("Banner upload failed:", error);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="min-h-[100px] rounded-xl bg-secondary/50 border-border/50 focus:border-primary resize-none"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.bio.length}/160
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio_link" className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Website / Link
                </Label>
                <Input
                  id="bio_link"
                  placeholder="https://your-website.com"
                  value={formData.bio_link}
                  onChange={(e) => setFormData({ ...formData, bio_link: e.target.value })}
                  className="h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Skills
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                    className="h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary"
                  />
                  <Button
                    type="button"
                    onClick={handleAddSkill}
                    variant="secondary"
                    className="h-12 px-4 rounded-xl"
                  >
                    Add
                  </Button>
                </div>
                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.skills.map((skill, index) => (
                      <motion.span
                        key={index}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(index)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        }

        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step - 1)}
              className="flex-1 h-12 rounded-xl"
            >
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 h-12 rounded-xl bg-gradient-primary hover:opacity-90 font-semibold text-primary-foreground shadow-glow"
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
              className="flex-1 h-12 rounded-xl bg-gradient-primary hover:opacity-90 font-semibold text-primary-foreground shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Complete Setup"
              )}
            </Button>
          )}
        </div>
      </div >
    </motion.div >
  );
}
