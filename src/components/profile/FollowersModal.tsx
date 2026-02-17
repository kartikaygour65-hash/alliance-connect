import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, UserPlus, Check, Clock, Loader2, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FollowersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialTab: "followers" | "following";
  username: string;
  isPrivate?: boolean;
  isFollowing?: boolean;
  isOwnProfile?: boolean;
}

interface UserItem {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
}

type FollowStatus = "none" | "following" | "requested";

export function FollowersModal({
  open,
  onOpenChange,
  userId,
  initialTab,
  username,
  isPrivate = false,
  isFollowing = false,
  isOwnProfile = false,
}: FollowersModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [followers, setFollowers] = useState<UserItem[]>([]);
  const [following, setFollowing] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStatuses, setFollowStatuses] = useState<Record<string, FollowStatus>>({});
  const [loadingFollow, setLoadingFollow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (open) {
      // Only fetch if allowed to view
      const canView = isOwnProfile || !isPrivate || isFollowing;
      if (canView) {
        fetchData();
      }
    }
  }, [open, userId, isOwnProfile, isPrivate, isFollowing]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch followers
      const { data: followersData } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId);

      if (followersData && followersData.length > 0) {
        const followerIds = followersData.map((f) => f.follower_id);
        const { data: followerProfiles } = await supabase
          .from("profiles")
          .select("id, user_id, username, full_name, avatar_url, is_private")
          .in("user_id", followerIds);

        setFollowers((followerProfiles as UserItem[]) || []);
      } else {
        setFollowers([]);
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map((f) => f.following_id);
        const { data: followingProfiles } = await supabase
          .from("profiles")
          .select("id, user_id, username, full_name, avatar_url, is_private")
          .in("user_id", followingIds);

        setFollowing((followingProfiles as UserItem[]) || []);
      } else {
        setFollowing([]);
      }

      // Fetch current user's follow statuses for all users
      if (user) {
        const allUserIds = [
          ...new Set([
            ...(followersData?.map((f) => f.follower_id) || []),
            ...(followingData?.map((f) => f.following_id) || []),
          ]),
        ].filter((id) => id !== user.id);

        if (allUserIds.length > 0) {
          // Check follows
          const { data: myFollows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .in("following_id", allUserIds);

          // Check pending requests
          const { data: myRequests } = await supabase
            .from("follow_requests")
            .select("target_id")
            .eq("requester_id", user.id)
            .eq("status", "pending")
            .in("target_id", allUserIds);

          const statuses: Record<string, FollowStatus> = {};
          allUserIds.forEach((id) => {
            if (myFollows?.some((f) => f.following_id === id)) {
              statuses[id] = "following";
            } else if (myRequests?.some((r) => r.target_id === id)) {
              statuses[id] = "requested";
            } else {
              statuses[id] = "none";
            }
          });
          setFollowStatuses(statuses);
        }
      }
    } catch (error) {
      console.error("Error fetching follow data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUser: UserItem) => {
    if (!user) return;

    setLoadingFollow((prev) => ({ ...prev, [targetUser.user_id]: true }));

    try {
      const currentStatus = followStatuses[targetUser.user_id] || "none";

      if (currentStatus === "following") {
        // Unfollow
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUser.user_id);

        if (error) throw error;

        setFollowStatuses((prev) => ({ ...prev, [targetUser.user_id]: "none" }));
        toast.success("Unfollowed");
      } else if (currentStatus === "requested") {
        // Cancel request
        const { error } = await supabase
          .from("follow_requests")
          .delete()
          .eq("requester_id", user.id)
          .eq("target_id", targetUser.user_id);

        if (error) throw error;

        setFollowStatuses((prev) => ({ ...prev, [targetUser.user_id]: "none" }));
        toast.success("Request cancelled");
      } else {
        // New follow
        if (targetUser.is_private) {
          // Send follow request
          // First check if request already exists
          const { data: existingRequest } = await supabase
            .from("follow_requests")
            .select("id")
            .eq("requester_id", user.id)
            .eq("target_id", targetUser.user_id)
            .maybeSingle();

          if (existingRequest) {
            setFollowStatuses((prev) => ({ ...prev, [targetUser.user_id]: "requested" }));
            toast.info("Follow request already sent");
            return;
          }

          const { error } = await supabase
            .from("follow_requests")
            .insert({
              requester_id: user.id,
              target_id: targetUser.user_id,
              status: "pending",
            });

          if (error) throw error;

          setFollowStatuses((prev) => ({ ...prev, [targetUser.user_id]: "requested" }));
          toast.success("Follow request sent");
        } else {
          // Direct follow
          const { error } = await supabase
            .from("follows")
            .insert({ follower_id: user.id, following_id: targetUser.user_id });

          if (error) throw error;

          setFollowStatuses((prev) => ({ ...prev, [targetUser.user_id]: "following" }));
          toast.success("Following!");
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update follow status");
    } finally {
      setLoadingFollow((prev) => ({ ...prev, [targetUser.user_id]: false }));
    }
  };

  const handleUserClick = (userItem: UserItem) => {
    onOpenChange(false);
    navigate(`/profile/${userItem.username}`);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "AU";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderUserItem = (userItem: UserItem) => {
    const isCurrentUser = user?.id === userItem.user_id;
    const status = followStatuses[userItem.user_id] || "none";
    const isLoading = loadingFollow[userItem.user_id];

    return (
      <div
        key={userItem.id}
        className="flex items-center justify-between py-3 px-4 hover:bg-secondary/50 transition-colors"
      >
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => handleUserClick(userItem)}
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={userItem.avatar_url || ""} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
              {getInitials(userItem.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {userItem.username || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {userItem.full_name}
            </p>
          </div>
        </div>

        {!isCurrentUser && (
          <Button
            size="sm"
            variant={status === "none" ? "default" : "secondary"}
            className="rounded-lg text-xs h-8 px-4"
            onClick={() => handleFollow(userItem)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : status === "following" ? (
              "Following"
            ) : status === "requested" ? (
              "Requested"
            ) : (
              "Follow"
            )}
          </Button>
        )}
      </div>
    );
  };

  // Check if user can view the list
  const canView = isOwnProfile || !isPrivate || isFollowing;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border/50 pb-0">
          <div className="flex items-center justify-between mb-4">
            <DrawerTitle className="text-lg font-semibold">
              @{username}
            </DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {!canView ? (
            <div className="py-12 text-center">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">This Account is Private</h3>
              <p className="text-muted-foreground text-sm">
                Follow this account to see their followers and following.
              </p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "followers" | "following")}>
              <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-border/50 rounded-none h-auto p-0">
                <TabsTrigger
                  value="followers"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                >
                  {followers.length} Followers
                </TabsTrigger>
                <TabsTrigger
                  value="following"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                >
                  {following.length} Following
                </TabsTrigger>
              </TabsList>

              <TabsContent value="followers" className="mt-0">
                <ScrollArea className="h-[50vh]">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : followers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      No followers yet
                    </div>
                  ) : (
                    followers.map(renderUserItem)
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="following" className="mt-0">
                <ScrollArea className="h-[50vh]">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : following.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      Not following anyone
                    </div>
                  ) : (
                    following.map(renderUserItem)
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  );
}
