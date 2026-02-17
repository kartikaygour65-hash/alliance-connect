import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Settings, Edit2, Sparkles, Grid, Lock, MessageCircle, Check, Link as LinkIcon, ShieldOff, MoreVertical, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, getUserPosts, getFollowerCount, getFollowingCount, getProfileByUsername, isFollowing } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/feed/PostCard";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { FollowersModal } from "@/components/profile/FollowersModal";
import { ProfileSkeleton } from "@/components/ui/skeleton-loader";
import { MomentHighlights } from "@/components/stories/MomentHighlights";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { toast } from "sonner";
import { getInitials, cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { UserBadge } from "@/components/ui/UserBadge";

// --- AURA RING COMPONENT ---
const AuraProgressRing = ({ aura, size = 152, stroke = 6 }: { aura: number, size?: number, stroke?: number }) => {
  const radius = (size / 2) - stroke;
  const circumference = radius * 2 * Math.PI;
  const progress = (aura % 100) / 100;
  const offset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          stroke="var(--theme-accent)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="drop-shadow-[0_0_8px_var(--theme-accent)]"
        />
      </svg>
      <div className="absolute -top-1 -right-1 bg-black border border-white/20 px-2 py-0.5 rounded-full z-20 shadow-[0_0_10px_rgba(0,0,0,0.8)]">
        <p className="text-[10px] font-black theme-text drop-shadow-md">LVL {Math.floor(aura / 100) + 1}</p>
      </div>
    </div>
  );
};

export default function Profile() {
  const { username } = useParams();
  const [searchParams] = useSearchParams(); // Added to catch ?edit=true
  const { user, profile: currentUserProfile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // State definitions
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [followStatus, setFollowStatus] = useState<any>('none');
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [mutuals, setMutuals] = useState<any[]>([]);
  const [isPrivateLocked, setIsPrivateLocked] = useState(false);
  const [storyUserToView, setStoryUserToView] = useState<any>(null);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  const isOwnProfile = !username || (currentUserProfile?.username === username);
  const activeTheme = profile?.theme_config?.background || "aurora-violet";

  // Global Theme Sync
  useEffect(() => {
    if (activeTheme) {
      document.documentElement.setAttribute('data-theme', activeTheme);
    }
  }, [activeTheme]);

  // Catch the "Edit Profile" signal from Settings
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && isOwnProfile && profile) {
      setShowEditModal(true);
    }
  }, [searchParams, isOwnProfile, profile]);

  // Catch the "Open Story" signal from DMs
  useEffect(() => {
    if (searchParams.get('openStory') === 'true' && profile) {
      const fetchAndOpenStory = async () => {
        const { data: stories } = await supabase
          .from('stories')
          .select('*, post:posts(*)')
          .eq('user_id', profile.user_id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true });

        if (stories && stories.length > 0) {
          setStoryUserToView({ ...profile, stories });
        } else {
          toast.error("Story expired or unavailable");
        }

        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openStory');
        navigate({ search: newParams.toString() }, { replace: true });
      };
      fetchAndOpenStory();
    }
  }, [searchParams, profile, navigate]);

  const handleProfileUpdated = async () => {
    setLoading(true);
    await refreshProfile();
    await fetchData(); // Re-run complete fetch to sync all stats
    setShowEditModal(false);
    setLoading(false);
    toast.success("Profile Updated");
  };

  const handleFollow = async () => {
    if (!user || !profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus === 'following') {
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.user_id);
        setFollowStatus('none');
        setFollowerCount(c => c - 1);
      } else {
        // Handle private account follow request
        if (profile.is_private) {
          const { error } = await supabase.from('follow_requests').upsert({
            requester_id: user.id,
            target_id: profile.user_id,
            status: 'pending'
          }, { onConflict: 'requester_id, target_id' });

          if (error) throw error;
          setFollowStatus('requested');
        } else {
          await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.user_id });
          setFollowStatus('following');
          setFollowerCount(c => c + 1);
        }
      }
    } catch (e) {
      console.error("Follow error:", e);
      toast.error("Couldn't update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let targetProfile: any = null;

      if (isOwnProfile) {
        targetProfile = currentUserProfile;
      } else if (username) {
        const { data } = await getProfileByUsername(username);
        targetProfile = data;
      }

      if (!targetProfile) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(targetProfile);

      let isFollowed = false;
      if (!isOwnProfile) {
        const { isFollowing: fStatus } = await isFollowing(user.id, targetProfile.user_id);
        isFollowed = fStatus;

        if (isFollowed) {
          setFollowStatus('following');
        } else {
          const { data: pReq } = await supabase.from('follow_requests')
            .select('id')
            .eq('requester_id', user.id)
            .eq('target_id', targetProfile.user_id)
            .eq('status', 'pending')
            .maybeSingle();
          setFollowStatus(pReq ? 'requested' : 'none');
        }

        const { data: mutualData } = await supabase.rpc('get_mutual_follows', { viewer_id: user.id, target_id: targetProfile.user_id });
        setMutuals(mutualData || []);

        // Check block status
        const { data: blockedByMe } = await supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetProfile.user_id)
          .maybeSingle();
        setIsBlockedByMe(!!blockedByMe);

        const { data: blockedByThem } = await supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', targetProfile.user_id)
          .eq('blocked_id', user.id)
          .maybeSingle();
        setIsBlockedByThem(!!blockedByThem);
      }

      // Check if we should lock content
      const shouldLock = targetProfile.is_private && !isOwnProfile && !isFollowed;
      setIsPrivateLocked(shouldLock);

      if (!shouldLock) {
        const [followersResult, followingResult, postsResult] = await Promise.all([
          getFollowerCount(targetProfile.user_id),
          getFollowingCount(targetProfile.user_id),
          getUserPosts(targetProfile.user_id, 12, 0)
        ]);

        setPosts(postsResult.data || []);
        setFollowerCount(followersResult.count || 0);
        setFollowingCount(followingResult.count || 0);
      } else {
        // Even if locked, show counts (like Instagram)
        const [fers, fing] = await Promise.all([
          getFollowerCount(targetProfile.user_id),
          getFollowingCount(targetProfile.user_id)
        ]);
        setFollowerCount(fers.count || 0);
        setFollowingCount(fing.count || 0);
        setPosts([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/auth");
      } else {
        fetchData();

        // Realtime subscription for the target profile
        if (profile?.user_id) {
          const channel = supabase
            .channel(`profile_changes_${profile.user_id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `user_id=eq.${profile.user_id}`
              },
              (payload) => {
                setProfile((prev: any) => ({ ...prev, ...payload.new }));
              }
            )
            .subscribe();

          return () => {
            supabase.removeChannel(channel);
          };
        }
      }
    }
  }, [user, authLoading, username, currentUserProfile, profile?.user_id]);

  if (loading || authLoading) return <AppLayout><ProfileSkeleton /></AppLayout>;
  if (!profile || isBlockedByThem) return <AppLayout><div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-20"><ShieldOff className="h-16 w-16 mb-4 opacity-10" /><p className="uppercase font-black italic opacity-20">User Not Found</p></div></AppLayout>;

  // Block handler
  const handleBlockToggle = async () => {
    if (!user || !profile) return;
    setShowBlockMenu(false);
    if (isBlockedByMe) {
      // Unblock
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', profile.user_id);
      setIsBlockedByMe(false);
      toast.success(`Unblocked @${profile.username}`);
      fetchData();
    } else {
      // Block: also unfollow both ways
      const confirmed = window.confirm(`Block @${profile.username}? They won't be able to find your profile, posts, or story. They won't be notified.`);
      if (!confirmed) return;
      await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: profile.user_id });
      // Remove follows in both directions
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.user_id);
      await supabase.from('follows').delete().eq('follower_id', profile.user_id).eq('following_id', user.id);
      // Remove any pending follow requests
      await supabase.from('follow_requests').delete().eq('requester_id', user.id).eq('target_id', profile.user_id);
      await supabase.from('follow_requests').delete().eq('requester_id', profile.user_id).eq('target_id', user.id);
      setIsBlockedByMe(true);
      setFollowStatus('none');
      toast.success(`Blocked @${profile.username}`);
    }
  };

  return (
    <AppLayout>
      <div
        className="max-w-2xl mx-auto pb-20 min-h-screen profile-theme-container transition-all duration-700"
        data-theme={activeTheme}
      >
        {/* HEADER / COVER */}
        <div className="relative h-48 md:h-64 rounded-b-[3rem] overflow-hidden group border-b border-white/5">
          {profile.cover_url ? (
            <img src={profile.cover_url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="Cover" />
          ) : (
            <div className="w-full h-full bg-white/5 backdrop-blur-md" />
          )}
          {isOwnProfile && (
            <div className="absolute top-6 right-6 flex gap-2">
              <Button size="icon" variant="secondary" className="rounded-full glass-card border-none hover:scale-110 transition-transform" onClick={() => setShowEditModal(true)}>
                <Edit2 className="h-4 w-4 text-white" />
              </Button>
              <Button size="icon" variant="secondary" className="rounded-full glass-card border-none hover:scale-110 transition-transform" onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 text-white" />
              </Button>
            </div>
          )}
        </div>

        {/* INFO SECTION */}
        <div className="px-6 -mt-20 relative z-10">
          <div className="flex items-end justify-between gap-4">
            <div className="relative flex items-center justify-center group z-20">
              <AuraProgressRing aura={profile.total_aura || 0} size={152} stroke={6} />
              <div className="absolute p-1 rounded-full overflow-hidden">
                <Avatar className="h-32 w-32 border-[4px] border-black shadow-2xl transition-transform duration-500 group-hover:scale-95">
                  <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="text-foreground text-3xl font-black italic uppercase theme-bg">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {!isOwnProfile && !isBlockedByMe && (
                <div className="flex gap-2">
                  <Button className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-11 px-8 shadow-lg theme-bg text-white hover:opacity-90 transition-opacity" onClick={handleFollow}>
                    {followStatus === 'following' ? 'Following' : followStatus === 'requested' ? 'Requested' : 'Follow'}
                  </Button>
                  <Button size="icon" variant="secondary" className="rounded-2xl h-11 w-11 bg-white/10 text-white" onClick={() => navigate(`/messages?chat=${profile.user_id}`)}>
                    <MessageCircle className="h-5 w-5" />
                  </Button>

                  {/* THREE DOT MENU — Block/Unblock */}
                  <div className="relative">
                    <Button size="icon" variant="secondary" className="rounded-2xl h-11 w-11 bg-white/10 text-white" onClick={() => setShowBlockMenu(!showBlockMenu)}>
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                    {showBlockMenu && (
                      <div className="absolute top-12 right-0 z-50 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <button
                          onClick={handleBlockToggle}
                          className="w-full px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                        >
                          <ShieldOff className="h-4 w-4" />
                          Block User
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ADMIN ONLY: Verification Toggle */}
                  {(currentUserProfile?.username === 'kartikay' || currentUserProfile?.username === 'koki' || currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'developer') && (
                    <Button
                      size="icon"
                      onClick={async () => {
                        const newStatus = !profile.is_verified;

                        // Optimistic Update
                        setProfile((prev: any) => ({
                          ...prev,
                          is_verified: newStatus,
                          verification_status: newStatus ? 'verified' : 'none',
                          verified_title: newStatus ? prev.verified_title : null,
                          verification_expiry: newStatus ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
                        }));

                        await supabase.from('profiles').update({
                          is_verified: newStatus,
                          verification_status: newStatus ? 'verified' : 'none',
                          verified_title: null,
                          verification_expiry: newStatus ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
                        }).eq('user_id', profile.user_id);

                        if (newStatus) {
                          await supabase.from('notifications').insert({
                            user_id: profile.user_id,
                            type: 'system',
                            title: 'You are Verified!',
                            body: 'Welcome to the elite circle. Your badge is active.',
                            data: { type: 'verification_approved' },
                            is_read: false
                          });
                        }

                        toast.success(newStatus ? "User Verified" : "Verification Removed");
                        // fetchData(); // Subscription will handle the state sync reliably now
                      }}
                      className={cn("rounded-2xl h-11 w-11 text-white border border-white/10", profile.is_verified ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500")}
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
              {!isOwnProfile && isBlockedByMe && (
                <Button
                  className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-11 px-8 bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30"
                  onClick={handleBlockToggle}
                >
                  Unblock
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none theme-text drop-shadow-sm">{profile.full_name}</h1>
              {(profile.total_aura || 0) > 100 && <Check className="text-white h-5 w-5 rounded-full p-1 theme-bg" />}
              {/* NEW: Special Badge Implementation */}
              <UserBadge
                role={profile.role}
                userId={profile.user_id}
                username={profile.username}
                isVerified={profile.is_verified}
                verifiedTitle={profile.verified_title}
                verificationExpiry={profile.verification_expiry}
                className="ml-1"
              />
            </div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">@{profile.username}</p>
            {profile.department && (
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">
                <Building2 className="h-3 w-3" />
                <span>{profile.department}</span>
              </div>
            )}

            {/* NEW: Reputation / XP System Display */}
            <div className="w-full max-w-[200px] mt-2 group relative">
              <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground mb-1">
                <span>Aura</span>
                <span>{(profile.total_aura || 0) % 100} / 100 XP</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(profile.total_aura || 0) % 100}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full theme-bg shadow-[0_0_8px_var(--theme-accent)] relative"
                >
                  <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
                </motion.div>
              </div>
              {/* Tooltip on hover */}
              <div className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] text-white pointer-events-none z-50 whitespace-nowrap">
                Keep contributing to level up!
              </div>
            </div>

            {!isOwnProfile && mutuals.length > 0 && (
              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <div className="flex -space-x-2">
                  {mutuals.slice(0, 3).map(m => <Avatar key={m.user_id} className="w-5 h-5 border border-background"><AvatarImage src={m.avatar_url} /></Avatar>)}
                </div>
                <span>Followed by <span className="text-foreground font-bold">{mutuals[0].username}</span> {mutuals.length > 1 && `and others`}</span>
              </div>
            )}
            {profile.bio && <p className="mt-3 text-sm font-medium leading-relaxed max-w-md text-foreground/80">{profile.bio}</p>}
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 theme-text hover:underline text-sm font-bold w-fit"
              >
                <LinkIcon className="h-3 w-3" /> {profile.website}
              </a>
            )}
          </div>

          <div className="flex items-center gap-4 mt-8 py-6 border-y border-border text-center">
            <div className="flex-1">
              <p className="text-xl font-black italic leading-none text-foreground">{posts.length}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Posts</p>
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => { setFollowersModalTab("followers"); setShowFollowersModal(true); }}>
              <p className="text-xl font-black italic leading-none text-foreground">{followerCount}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Followers</p>
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => { setFollowersModalTab("following"); setShowFollowersModal(true); }}>
              <p className="text-xl font-black italic leading-none text-foreground">{followingCount}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Following</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-center gap-1">
                <Sparkles className="h-4 w-4 animate-pulse theme-text" />
                <p className="text-xl font-black italic leading-none theme-text">{Math.floor((profile.total_aura || 0) / 100) + 1}</p>
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Level</p>
            </div>
          </div>
        </div>

        {/* {!isPrivateLocked && <MomentHighlights userId={profile.user_id} isOwnProfile={isOwnProfile} />} */}

        {isBlockedByMe ? (
          <div className="mt-12 text-center py-16 bg-white/5 mx-6 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <ShieldOff className="h-8 w-8 text-red-500 opacity-40" />
            </div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">User Blocked</h3>
            <p className="text-xs font-bold opacity-40 mt-2 uppercase tracking-widest">You have blocked this user</p>
            <Button
              className="mt-6 rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-8 bg-white/5 text-white border border-white/10 hover:bg-white/10"
              onClick={handleBlockToggle}
            >
              Unblock
            </Button>
          </div>
        ) : isPrivateLocked ? (
          <div className="mt-12 text-center py-16 bg-white/5 mx-6 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 opacity-20" />
            </div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">Signal Restricted</h3>
            <p className="text-xs font-bold opacity-40 mt-2 uppercase tracking-widest">Follow to see posts and aura</p>
          </div>
        ) : (
          <div className="px-4 mt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-1 bg-black/20 h-12 p-1 rounded-2xl w-full max-w-xs mx-auto border border-white/5">
                <TabsTrigger value="posts" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:theme-bg data-[state=active]:text-white transition-all">
                  <Grid className="h-3.5 w-3.5 mr-2" /> Posts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="mt-6 space-y-6 outline-none">
                {posts.length === 0 ? (
                  <div className="text-center py-20 opacity-20 flex flex-col items-center">
                    <Grid className="h-12 w-12 mb-4" />
                    <p className="font-black uppercase text-[10px] tracking-widest">No signals broadcasted</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 px-2">
                    {posts.map(p => <PostCard key={p.id} post={p} onDeleted={fetchData} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <EditProfileModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />

      {profile && (
        <FollowersModal
          open={showFollowersModal}
          onOpenChange={setShowFollowersModal}
          userId={profile.user_id}
          initialTab={followersModalTab}
          username={profile.username || ""}
          isOwnProfile={isOwnProfile}
        />
      )}

      {/* NEW: Story Viewer overlay for ?openStory=true */}
      {storyUserToView && (
        <StoryViewer
          users={[storyUserToView]}
          initialUserIndex={0}
          onClose={() => setStoryUserToView(null)}
          onRefresh={() => { }}
        />
      )}
    </AppLayout>
  );
}