import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { useAuth } from "@/hooks/useAuth";

export default function Onboarding() {
  const { user, loading, isOnboarded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // SECURITY: If the user is on the reset-password page, do NOT redirect them.
    if (window.location.pathname === "/reset-password") return;

    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (isOnboarded) {
        navigate("/");
      }
    }
  }, [user, loading, isOnboarded, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-surface p-4 overflow-x-hidden overflow-y-auto py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center min-h-full">
        <OnboardingForm />
      </div>
    </div>
  );
}
