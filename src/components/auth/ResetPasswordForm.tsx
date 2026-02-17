import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      // Check if we are in a recovery flow
      const isRecovery = window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery') ||
        window.location.hash.includes('access_token=');

      if (!authLoading) {
        if (user) {
          setError(null);
          setIsVerifying(false);
        } else {
          // If no user yet, let's wait a second to see if Supabase picks up the session from hash
          if (isRecovery) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              setError(null);
            } else {
              // Final check: if still no user, it might be expired
              setError("Your reset link has expired or is invalid. Please request a new one.");
            }
          } else {
            setError("Invalid access. Please use the reset link sent to your email.");
          }
          setIsVerifying(false);
        }
      }
    };

    checkAuthStatus();
  }, [authLoading, user]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      toast.success("Password updated successfully!");

      // Redirect to home after a delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest opacity-50">Synchronizing Signal...</p>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto text-center"
      >
        <div className="glass-card p-8 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Password Reset Successful!</h2>
          <p className="text-muted-foreground text-sm">
            Your password has been updated. Redirecting you to the app...
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="glass-card p-8 rounded-2xl">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-50 rounded-full" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold gradient-text mb-2">
            Set New Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your new password below
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                minLength={8}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !!error || isVerifying}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 font-bold uppercase tracking-widest text-white shadow-lg shadow-orange-500/20"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
