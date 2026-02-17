import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, UserPlus, Users, Check, X, Loader2, Bell, RefreshCw, MessageSquare } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  is_read: boolean;
  created_at: string;
  actor_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface FollowRequest {
  id: string;
  requester_id: string;
  status: string;
  created_at: string;
  requester_profile?: {
    user_id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export default function Activity() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const getActorId = (notifData: any) => {
        if (!notifData || typeof notifData !== 'object') return null;
        return notifData.user_id || notifData.follower_id || notifData.requester_id || notifData.sender_id || notifData.author_id || notifData.actor_id;
      };

      const actorIds = data
        .map(n => getActorId(n.data))
        .filter((id): id is string => !!id);

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, full_name, avatar_url")
          .in("user_id", actorIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const enrichedNotifications = data.map(n => ({
          ...n,
          actor_profile: profileMap.get(getActorId(n.data)),
        }));

        setNotifications(enrichedNotifications);
      } else {
        setNotifications(data);
      }
    }
  }, [user]);

  const fetchFollowRequests = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("follow_requests")
      .select("*")
      .eq("target_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      const requesterIds = data.map(r => r.requester_id);

      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, full_name, avatar_url")
          .in("user_id", requesterIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const enrichedRequests = data.map(r => ({
          ...r,
          requester_profile: profileMap.get(r.requester_id),
        }));

        setFollowRequests(enrichedRequests);
      } else {
        setFollowRequests([]);
      }
    }
  }, [user]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchFollowRequests()]);
    setLoading(false);
  }, [fetchNotifications, fetchFollowRequests]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadData();

      const notifChannel = supabase
        .channel("activity-notifications-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe();

      const requestChannel = supabase
        .channel("follow-requests-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${user.id}` },
          () => fetchFollowRequests()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notifChannel);
        supabase.removeChannel(requestChannel);
      };
    }
  }, [user, authLoading, navigate, loadData, fetchNotifications, fetchFollowRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // --- HANDLE ACCEPT (Via Request ID or User ID) ---
  const handleAcceptRequest = async (requestId: string, requesterId: string) => {
    if (!user) return;
    setProcessingRequest(requestId);

    try {
      // 1. Update Request Status
      // We try to find the request by ID first. 
      // If we only have requesterId (from notification), we find the pending request.

      let targetRequestId = requestId;

      if (!targetRequestId && requesterId) {
        const { data: foundRequest } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('requester_id', requesterId)
          .eq('target_id', user.id)
          .eq('status', 'pending')
          .single();

        if (foundRequest) targetRequestId = foundRequest.id;
      }

      if (targetRequestId) {
        const { error: updateError } = await supabase
          .from("follow_requests")
          .update({ status: "accepted" })
          .eq("id", targetRequestId);

        if (updateError) throw updateError;
      }

      // 2. Add to Followers Table
      // Check if already following to avoid duplicates
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', requesterId)
        .eq('following_id', user.id)
        .maybeSingle();

      if (!existingFollow) {
        const { error: followError } = await supabase.from("follows").insert({
          follower_id: requesterId,
          following_id: user.id,
        });
        if (followError) throw followError;
      }

      // 3. Update UI
      setFollowRequests(prev => prev.filter(r => r.id !== targetRequestId));

      // Remove notification from UI
      setNotifications(prev => prev.filter(n => n.data?.requester_id !== requesterId));

      // 4. Delete the notification from DB as well to keep it clean (Insta style)
      // We don't await this to keep UI snappy
      supabase.from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', 'follow_request')
        .contains('data', { requester_id: requesterId })
        .then();

      toast.success("Accepted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to accept");
    } finally {
      setProcessingRequest(null);
    }
  };

  // --- HANDLE REJECT ---
  const handleRejectRequest = async (requestId: string, requesterId: string) => {
    if (!user) return;
    setProcessingRequest(requestId || requesterId); // Use whichever is available as key

    try {
      let targetRequestId = requestId;

      if (!targetRequestId && requesterId) {
        const { data: foundRequest } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('requester_id', requesterId)
          .eq('target_id', user.id)
          .eq('status', 'pending')
          .single();

        if (foundRequest) targetRequestId = foundRequest.id;
      }

      if (targetRequestId) {
        const { error } = await supabase
          .from("follow_requests")
          .delete() // Delete the request instead of just marking rejected back to Insta style
          .eq("id", targetRequestId);

        if (error) throw error;
      }

      setFollowRequests(prev => prev.filter(r => r.id !== targetRequestId));
      setNotifications(prev => prev.filter(n => n.data?.requester_id !== requesterId));

      // Clean up notification DB
      supabase.from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', 'follow_request')
        .contains('data', { requester_id: requesterId })
        .then();

      toast.success("Removed");
    } catch (error) {
      toast.error("Failed to decline request");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleAcceptInvite = async (notification: Notification, e: any) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const { error } = await supabase.from('circle_members').insert({
        circle_id: notification.data.circle_id,
        user_id: user.id,
        role: 'member'
      });

      if (error) throw error;

      await markAsRead(notification.id);
      toast.success(`Joined ${notification.data.circle_name}!`);
    } catch (err) {
      toast.error("Failed to join circle");
    }
  };

  const handleDeclineInvite = async (notification: Notification, e: any) => {
    e.stopPropagation();
    await markAsRead(notification.id);
    await supabase.from('notifications').delete().eq('id', notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    toast.success("Invite declined");
  };

  // --- HANDLE CIRCLE JOIN REQUEST (Admin approves someone joining) ---
  const handleApproveJoinRequest = async (notification: Notification, e: any) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const { circle_id, requester_id, circle_name } = notification.data || {};
      if (!circle_id || !requester_id) throw new Error('Missing data');

      // Check if already a member
      const { data: existing } = await supabase
        .from('circle_members')
        .select('id')
        .eq('circle_id', circle_id)
        .eq('user_id', requester_id)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from('circle_members').insert({
          circle_id,
          user_id: requester_id,
          role: 'member'
        });
        if (error) throw error;
      }

      // Notify the requester that they were approved
      await supabase.from('notifications').insert({
        user_id: requester_id,
        type: 'circle_invite',
        title: 'Request Approved!',
        body: `Your request to join ${circle_name} was approved!`,
        data: { circle_id, circle_name },
        is_read: false,
      });

      await markAsRead(notification.id);
      await supabase.from('notifications').delete().eq('id', notification.id);
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      toast.success(`Approved! User added to ${circle_name}`);
    } catch (err) {
      toast.error('Failed to approve request');
    }
  };

  const handleDeclineJoinRequest = async (notification: Notification, e: any) => {
    e.stopPropagation();
    await markAsRead(notification.id);
    await supabase.from('notifications').delete().eq('id', notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    toast.success('Request declined');
  };

  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like": return { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/20" };
      case "comment": return { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/20" };
      case "follow": return { icon: UserPlus, color: "text-green-500", bg: "bg-green-500/20" };
      case "follow_request": return { icon: Users, color: "text-purple-500", bg: "bg-purple-500/20" };
      case "message": return { icon: MessageSquare, color: "text-orange-500", bg: "bg-orange-500/20" };
      case "circle_invite": return { icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/20" };
      case "circle_join_request": return { icon: UserPlus, color: "text-amber-500", bg: "bg-amber-500/20" };
      case "story_like": return { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/20" };
      case "request_accepted": return { icon: Check, color: "text-green-500", bg: "bg-green-500/20" };
      case "system": return { icon: Check, color: "text-blue-500", bg: "bg-blue-500/20" };
      default: return { icon: Bell, color: "text-primary", bg: "bg-primary/20" };
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.type === "message" && notification.data?.conversation_id) {
      navigate(`/messages?chat=${notification.data.conversation_id}`);
    } else if (notification.type === "follow_request") {
      // Do nothing, buttons handle it
    } else if (notification.data?.type === 'verification_request' && notification.data?.requester_id) {
      // Find username and go there
      navigate(`/profile?uid=${notification.data.requester_id}`); // We will need to handle uid lookup or just rely on actor_profile if available
      if (notification.actor_profile?.username) navigate(`/profile/${notification.actor_profile.username}`);
    } else if (notification.data?.post_id) {
      navigate(`/?post=${notification.data.post_id}`);
    } else if (notification.data?.follower_id || notification.data?.user_id || notification.data?.requester_id) {
      const actorUsername = notification.actor_profile?.username;
      if (actorUsername) navigate(`/profile/${actorUsername}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading || authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold gradient-text">Activity</h1>
            {unreadCount > 0 && <Badge variant="destructive" className="rounded-full">{unreadCount}</Badge>}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">Mark all read</Button>}
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="rounded-full">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-4">
            <TabsTrigger value="all" className="rounded-lg">
              All
              {unreadCount > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">{unreadCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-lg relative">
              Requests
              {followRequests.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">{followRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2">
            {notifications.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center"><Heart className="h-8 w-8 text-primary-foreground" /></div>
                <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                <p className="text-muted-foreground text-sm">When someone likes, comments, or follows you, you'll see it here</p>
              </motion.div>
            ) : (
              <AnimatePresence>
                {notifications.map((notification, index) => {
                  const { icon: Icon, color, bg } = getNotificationIcon(notification.type);
                  const isFollowRequest = notification.type === 'follow_request';
                  const requesterId = notification.data?.requester_id;

                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex flex-col gap-2 p-3 rounded-xl transition-colors cursor-pointer ${notification.is_read ? "bg-secondary/20" : "bg-primary/10 border border-primary/20"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Link to={`/profile/${notification.actor_profile?.username}`} onClick={(e) => e.stopPropagation()}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={notification.actor_profile?.avatar_url || ""} />
                            <AvatarFallback className="bg-gradient-primary text-primary-foreground">{getInitials(notification.actor_profile?.full_name)}</AvatarFallback>
                          </Avatar>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            {notification.type === 'circle_invite' || notification.type === 'circle_join_request' || notification.type === 'system' ? (
                              <span className="font-medium text-foreground">{notification.body}</span>
                            ) : (
                              <>
                                <span className="font-semibold">{notification.actor_profile?.full_name || notification.actor_profile?.username || "Someone"}</span>{" "}
                                <span className="text-muted-foreground">
                                  {notification.type === 'follow' ? 'started following you' :
                                    notification.type === 'follow_request' ? 'wants to follow you' :
                                      notification.type === 'like' ? 'liked your photo' :
                                        notification.type === 'story_like' ? 'liked your story' :
                                          notification.type === 'comment' ? 'commented on your photo' :
                                            notification.body?.replace(notification.actor_profile?.full_name || "", "").replace(notification.actor_profile?.username || "", "").trim() || 'interacted with you'}
                                </span>
                              </>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</p>
                        </div>

                        <div className={`p-2 rounded-full ${bg} ${color}`}><Icon className="h-4 w-4" /></div>
                        {!notification.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>

                      {/* CIRCLE INVITE ACTIONS */}
                      {notification.type === 'circle_invite' && !notification.is_read && (
                        <div className="flex gap-2 ml-14 mt-1 mb-2">
                          <Button
                            size="sm"
                            className="bg-primary text-black font-black uppercase tracking-wider h-8 px-4"
                            onClick={(e) => handleAcceptInvite(notification, e)}
                          >
                            Join Club
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-4"
                            onClick={(e) => handleDeclineInvite(notification, e)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* CIRCLE JOIN REQUEST ACTIONS (Admin sees these) */}
                      {notification.type === 'circle_join_request' && !notification.is_read && (
                        <div className="flex gap-2 ml-14 mt-1 mb-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 text-black font-black uppercase tracking-wider h-8 px-4"
                            onClick={(e) => handleApproveJoinRequest(notification, e)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-4"
                            onClick={(e) => handleDeclineJoinRequest(notification, e)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* FOLLOW REQUEST BUTTONS INSIDE NOTIFICATION */}
                      {isFollowRequest && requesterId && (
                        <div className="flex gap-2 ml-14 mt-1">
                          <Button
                            size="sm"
                            className="bg-gradient-primary h-8 px-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptRequest("", requesterId);
                            }}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectRequest("", requesterId);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-2">
            {followRequests.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center"><Users className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold mb-2">No follow requests</h3>
              </motion.div>
            ) : (
              <AnimatePresence>
                {followRequests.map((request, index) => (
                  <motion.div key={request.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.05 }} className="flex items-center gap-3 p-3 rounded-xl glass-card">
                    <Link to={`/profile/${request.requester_profile?.username}`}>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={request.requester_profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">{getInitials(request.requester_profile?.full_name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${request.requester_profile?.username}`} className="font-semibold text-sm hover:underline">{request.requester_profile?.full_name}</Link>
                      <p className="text-xs text-muted-foreground">@{request.requester_profile?.username} wants to follow you</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-full bg-gradient-primary h-8" onClick={() => handleAcceptRequest(request.id, request.requester_id)} disabled={processingRequest === request.id}>
                        {processingRequest === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => handleRejectRequest(request.id, request.requester_id)} disabled={processingRequest === request.id}><X className="h-4 w-4" /></Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}