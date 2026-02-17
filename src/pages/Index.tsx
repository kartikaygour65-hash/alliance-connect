import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Feed } from "@/components/feed/Feed";
import { useAuth } from "@/hooks/useAuth";
import { CampusCarousel } from "@/components/feed/CampusCarousel";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { TrendingTicker } from "@/components/feed/TrendingTicker";
import LandingPage from "@/components/landing/LandingPage";

export default function Index() {
  const { user, loading, isOnboarded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !isOnboarded) {
      navigate("/onboarding");
    }
  }, [user, loading, isOnboarded, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-12 h-12 rounded-xl bg-white/10 p-2"
      >
        <img src="/aulogo.png" alt="Loading" className="opacity-50" />
      </motion.div>
    </div>
  );

  // If no user, show the cinematic landing page
  if (!user) {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto w-full pb-20">

        {/* Stories - Padded for clean alignment */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 mb-6 mt-2"
        >
          <StoriesBar />
        </motion.div>

        {/* Command Center - Native swipe feel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <CampusCarousel />
        </motion.div>

        {/* Trending Ticker - New Dynamic Element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4"
        >
          <TrendingTicker />
        </motion.div>

        {/* Feed Section with Layout Transitions */}
        <div className="px-4 mt-4 space-y-6">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <motion.div
                key="skeleton-loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <FeedSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="main-feed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Feed />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}