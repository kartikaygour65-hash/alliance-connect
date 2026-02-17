import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";
import { CreateStoryModal } from "./CreateStoryModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string | null;
  expires_at: string;
  created_at: string;
  view_count: number;
  duration?: number;
  mentions?: string[];
  is_beam?: boolean;
  post_id?: string;
  post?: any;
}

interface UserWithStories {
  userId: string;
  username: string;
  avatarUrl: string | null;
  stories: Story[];
  isViewed?: boolean;
}

export function StoriesBar() {
  const { user, profile } = useAuth();
  const [usersWithStories, setUsersWithStories] = useState<UserWithStories[]>([]);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ownStories, setOwnStories] = useState<Story[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('stories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_views' }, () => {
        loadAllData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;
    await Promise.all([fetchViewedStories(), fetchStories()]);
  };

  const fetchViewersForStories = async (stories: string[]) => {
    if (!user) return new Set<string>();
    const { data } = await supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', stories);
    return new Set(data?.map(v => v.story_id) || []);
  };

  const fetchViewedStories = async () => {
    if (!user) return;
    const { data } = await supabase.from('story_views').select('story_id').eq('viewer_id', user.id);
    if (data) {
      const ids = new Set(data.map(v => v.story_id));
      setViewedStoryIds(ids);
      return ids;
    }
    return new Set<string>();
  };

  const fetchStories = async () => {
    try {
      // 1. Fetch RAW Stories first (No joins, so it won't crash)
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (storiesError) throw storiesError;
      if (!storiesData || storiesData.length === 0) {
        setUsersWithStories([]);
        setOwnStories([]);
        return;
      }

      // 2. Identify all related data needed (Users and Linked Posts)
      const userIds = [...new Set(storiesData.map(s => s.user_id))];
      const postIds = [...new Set(storiesData.filter(s => s.post_id).map(s => s.post_id))];

      const [profilesRes, postsRes, viewsRes, followingRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username, avatar_url, is_private').in('user_id', userIds),
        postIds.length > 0
          ? supabase.from('posts').select('*, profiles(username, avatar_url)').in('id', postIds)
          : Promise.resolve({ data: [] }),
        supabase.from('story_views').select('story_id').eq('viewer_id', user!.id),
        // Fetch who we follow for privacy filtering
        supabase.from('follows').select('following_id').eq('follower_id', user!.id)
      ]);

      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const postsMap = new Map(postsRes.data?.map(p => [p.id, p]) || []);
      const currentViewedIds = new Set(viewsRes.data?.map(v => v.story_id) || []);
      const followingIds = new Set(followingRes.data?.map(f => f.following_id) || []);
      setViewedStoryIds(currentViewedIds);

      // 3. CLIENT-SIDE PRIVACY FILTER: Remove stories from private accounts we don't follow
      const accessibleStories = storiesData.filter(story => {
        // Own stories always visible
        if (story.user_id === user!.id) return true;
        const storyProfile = profilesMap.get(story.user_id);
        // If profile is private and we don't follow them, hide
        if (storyProfile?.is_private && !followingIds.has(story.user_id)) return false;
        return true;
      });

      // 4. Attach Posts to Stories manually (This fixes the blank media)
      const fullStoriesData = accessibleStories.map(story => ({
        ...story,
        post: story.post_id ? postsMap.get(story.post_id) : null
      }));

      // 5. Group by User
      const storiesByUser = new Map<string, Story[]>();
      fullStoriesData.forEach(story => {
        const existing = storiesByUser.get(story.user_id) || [];
        existing.push(story as unknown as Story);
        storiesByUser.set(story.user_id, existing);
      });

      const grouped: UserWithStories[] = [];
      storiesByUser.forEach((stories, userId) => {
        const userProfile = profilesMap.get(userId);
        if (userProfile) {
          const allViewed = stories.every(s => currentViewedIds.has(s.id));
          grouped.push({
            userId,
            username: userProfile.username || 'User',
            avatarUrl: userProfile.avatar_url,
            stories,
            isViewed: allViewed
          });
        }
      });

      // 6. Sort and Set State
      if (user) {
        const own = grouped.find(g => g.userId === user.id);
        setOwnStories(own ? own.stories : []);
      }

      const others = grouped.filter(g => g.userId !== user?.id);
      others.sort((a, b) => {
        if (a.isViewed !== b.isViewed) return a.isViewed ? 1 : -1;
        const dateA = new Date(a.stories[a.stories.length - 1].created_at).getTime();
        const dateB = new Date(b.stories[b.stories.length - 1].created_at).getTime();
        return dateB - dateA;
      });

      setUsersWithStories(others);
    } catch (err) {
      console.error("StoriesBar Failed to load:", err);
    }
  };

  const handleOwnStoryClick = () => {
    if (ownStories.length > 0) {
      const ownUserData: UserWithStories = {
        userId: user!.id,
        username: profile?.username || 'You',
        avatarUrl: profile?.avatar_url || null,
        stories: ownStories,
        isViewed: true
      };
      setUsersWithStories(prev => [ownUserData, ...prev.filter(u => u.userId !== user!.id)]);
      setSelectedUserIndex(0);
    } else {
      setShowCreateModal(true);
    }
  };

  return (
    <>
      <div className="overflow-x-auto scrollbar-hide border-b border-border/30">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 px-4 py-4">
          {user && (
            <div className="relative shrink-0">
              <StoryRing
                user={{ username: "Your Story", avatar_url: profile?.avatar_url, full_name: null }}
                hasStory={ownStories.length > 0}
                isSeen={ownStories.length > 0}
                onClick={handleOwnStoryClick}
              />
              <button
                onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
                className="absolute bottom-6 right-0 rounded-full p-1 border-2 border-background bg-primary text-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
          {usersWithStories.map((u, i) => (
            <div key={u.userId} className="shrink-0">
              <StoryRing
                user={{ username: u.username, avatar_url: u.avatarUrl, full_name: null }}
                hasStory
                isSeen={u.isViewed}
                onClick={() => setSelectedUserIndex(i)}
              />
            </div>
          ))}
        </motion.div>
      </div>

      {selectedUserIndex !== null && (
        <StoryViewer
          users={usersWithStories}
          initialUserIndex={selectedUserIndex}
          onClose={() => {
            setSelectedUserIndex(null);
            loadAllData();
          }}
          onRefresh={loadAllData}
        />
      )}

      <CreateStoryModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={loadAllData}
      />
    </>
  );
}