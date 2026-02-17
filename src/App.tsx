
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { ThemeProvider } from "@/theme/themeProvider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Lazy Loaded Pages for Production Performance
const MessMenuPage = lazy(() => import("./pages/MessMenuPage"));
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const Search = lazy(() => import("./pages/Search"));
const Explore = lazy(() => import("./pages/Explore"));
const Create = lazy(() => import("./pages/Create"));
const Activity = lazy(() => import("./pages/Activity"));
const Messages = lazy(() => import("./pages/Messages"));
const SecretRoom = lazy(() => import("./pages/SecretRoom"));
const Circles = lazy(() => import("./pages/Circles"));
const CircleDetail = lazy(() => import("./pages/CircleDetail"));
const Events = lazy(() => import("./pages/Events"));
const Internships = lazy(() => import("./pages/Internships"));
const LostFound = lazy(() => import("./pages/LostFound"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const StudyGroups = lazy(() => import("./pages/StudyGroups"));
const Polls = lazy(() => import("./pages/Polls"));
const Settings = lazy(() => import("./pages/Settings"));
const Reels = lazy(() => import("./pages/Reels"));
const Saved = lazy(() => import("./pages/Saved"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const PostDetails = lazy(() => import("./pages/PostDetails"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));

function RecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check both hash and search for recovery type
    const isRecovery = (window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery')) &&
      !window.location.hash.includes('type=signup') &&
      !window.location.search.includes('type=signup');

    if (isRecovery && location.pathname !== '/reset-password') {
      const recoveryData = window.location.hash || window.location.search;
      navigate('/reset-password' + recoveryData, { replace: true });
    }
  }, [navigate, location]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,   // Data stays fresh for 2min — no re-fetch on page switch
      gcTime: 1000 * 60 * 5,      // Cache persists 5min after unmount for instant back-nav
    },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <RecoveryRedirect />
                <SettingsProvider>
                  <Suspense fallback={
                    <div className="min-h-screen w-full flex items-center justify-center">
                      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  }>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:username" element={<Profile />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/create" element={<Create />} />
                      <Route path="/activity" element={<Activity />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/mess-menu" element={<MessMenuPage />} />
                      <Route path="/secret-room" element={<SecretRoom />} />
                      <Route path="/polls" element={<Polls />} />
                      <Route path="/lost-found" element={<LostFound />} />
                      <Route path="/circles" element={<Circles />} />
                      <Route path="/circles/:id" element={<CircleDetail />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/internships" element={<Internships />} />
                      <Route path="/marketplace" element={<Marketplace />} />
                      <Route path="/study-groups" element={<StudyGroups />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/reels" element={<Reels />} />
                      <Route path="/saved" element={<Saved />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/post/:id" element={<PostDetails />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </SettingsProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}