import { supabase } from "@/integrations/supabase/client";
import {
  sanitizeText,
  sanitizeSearchQuery,
  validateEmail,
  validatePassword,
  validateUsername,
  validateComment,
  validatePostContent,
  validateProfileUpdate,
  validateUUID,
  authLimiter,
  postLimiter,
  commentLimiter,
  searchLimiter,
  profileLimiter,
  supportLimiter
} from "@/lib/security";

// ============================================================
// EMAIL DOMAIN VALIDATION
// ============================================================
export const ALLOWED_DOMAIN = ".alliance.edu.in";
export function isValidAllianceEmail(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN) || email.toLowerCase() === "auconnecx@gmail.com";
}

// Helper to get the correct site URL for redirects (production vs local)
export function getSiteUrl() {
  const siteUrl = import.meta.env.VITE_SITE_URL;
  if (siteUrl) return siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  return window.location.origin;
}

// ============================================================
// AUTH FUNCTIONS (Rate limited + Validated)
// ============================================================

export async function signUp(email: string, password: string) {
  // Rate limit: 5 attempts per minute
  if (!authLimiter.canProceed('signup')) {
    return { error: { message: "Too many sign-up attempts. Please wait a minute." }, data: null };
  }

  // Validate email format
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return { error: { message: emailCheck.error! }, data: null };

  // Validate password strength
  const passCheck = validatePassword(password);
  if (!passCheck.valid) return { error: { message: passCheck.error! }, data: null };

  // Validate domain
  if (!isValidAllianceEmail(email)) {
    return { error: { message: "Only .alliance.edu.in email addresses are allowed" }, data: null };
  }

  const redirectUrl = `${getSiteUrl()}/verify-email`;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: redirectUrl }
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  // Rate limit: 5 attempts per minute
  if (!authLimiter.canProceed('signin')) {
    return { error: { message: "Too many login attempts. Please wait a minute." }, data: null };
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return { error: { message: emailCheck.error! }, data: null };

  if (!isValidAllianceEmail(email)) {
    return { error: { message: "Only .alliance.edu.in email addresses are allowed" }, data: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ============================================================
// PROFILE & SEARCH FUNCTIONS (Validated + Sanitized)
// ============================================================

export async function getProfile(userId: string) {
  const idCheck = validateUUID(userId);
  if (!idCheck.valid) return { data: null, error: { message: idCheck.error } };
  return await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
}

export async function getProfileByUsername(username: string) {
  const uCheck = validateUsername(username);
  if (!uCheck.valid) return { data: null, error: { message: uCheck.error } };
  return await supabase.from("profiles").select("*").eq("username", username.trim()).maybeSingle();
}

/**
 * SECURITY: Search query is sanitized to prevent PostgREST filter injection.
 * Characters like %, _, \, (, ) are stripped before being interpolated into .or().
 */
export async function searchUsers(query: string) {
  if (!searchLimiter.canProceed('search')) {
    return { data: [], error: { message: "Too many searches. Please wait." } };
  }

  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized || sanitized.length < 1) return { data: [], error: null };

  return await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`)
    .limit(20);
}

export async function checkUsernameAvailable(username: string) {
  const uCheck = validateUsername(username);
  if (!uCheck.valid) return { available: false };
  const { data } = await supabase.from("profiles").select("username").eq("username", username.trim()).maybeSingle();
  return { available: !data };
}

/**
 * SECURITY: Profile updates are validated against an allowlist of fields.
 * Unexpected fields are rejected. Text fields are sanitized.
 */
export async function updateProfile(userId: string, updates: any) {
  if (!profileLimiter.canProceed('profile_update')) {
    return { data: null, error: { message: "Too many updates. Please wait." } };
  }

  const idCheck = validateUUID(userId);
  if (!idCheck.valid) return { data: null, error: { message: idCheck.error } };

  const validation = validateProfileUpdate(updates);
  if (!validation.valid) return { data: null, error: { message: validation.error } };

  // Sanitize text fields before saving
  const sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.username) sanitizedUpdates.username = sanitizedUpdates.username.trim().toLowerCase();
  if (sanitizedUpdates.full_name) sanitizedUpdates.full_name = sanitizedUpdates.full_name.trim();
  if (sanitizedUpdates.bio) sanitizedUpdates.bio = sanitizedUpdates.bio.trim();

  const { data, error } = await supabase.from("profiles").update(sanitizedUpdates).eq("user_id", userId).select().single();
  if (error) return { data: null, error: { ...error, message: `[Supabase] ${error.message}` } };
  return { data, error };
}

// ============================================================
// FOLLOW FUNCTIONS (Validated)
// ============================================================

export async function isFollowing(followerId: string, followingId: string) {
  const id1 = validateUUID(followerId);
  const id2 = validateUUID(followingId);
  if (!id1.valid || !id2.valid) return { isFollowing: false, error: { message: "Invalid ID" } };

  const { data, error } = await supabase.from("follows").select("id").eq("follower_id", followerId).eq("following_id", followingId).maybeSingle();
  return { isFollowing: !!data, error };
}
export const checkIsFollowing = isFollowing;

export async function getFollowerCount(userId: string) {
  return await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId);
}

export async function getFollowingCount(userId: string) {
  return await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId);
}

// ============================================================
// POSTS & FEED (Validated + Rate Limited)
// ============================================================

export async function createPost(post: {
  user_id: string;
  content?: string;
  images?: string[] | null;
  video_url?: string | null;
  hashtags?: string[];
  expires_at?: string | null;
  is_stealth?: boolean;
}) {
  // Rate limit: 10 posts per 5 minutes
  if (!postLimiter.canProceed('create_post')) {
    return { data: null, error: { message: "You're posting too fast. Please wait a few minutes." } };
  }

  const idCheck = validateUUID(post.user_id);
  if (!idCheck.valid) return { data: null, error: { message: idCheck.error } };

  if (post.content) {
    const contentCheck = validatePostContent(post.content);
    if (!contentCheck.valid) return { data: null, error: { message: contentCheck.error } };
  }

  // Sanitize content
  const sanitizedPost = {
    ...post,
    content: post.content ? post.content.trim() : undefined,
    hashtags: post.hashtags
  };

  const { data, error } = await supabase.from("posts").insert([sanitizedPost]).select().single();
  if (error) return { data: null, error: { ...error, message: `[Supabase] ${error.message}` } };
  return { data, error };
}

export async function getPosts(limit = 20, offset = 0) {
  // Clamp limit to prevent abuse
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeOffset = Math.max(0, offset);

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!user_id (
        username,
        full_name,
        avatar_url,
        role,
        is_verified,
        verified_title,
        verification_expiry,
        verification_status,
        is_private
      )
    `)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error || !data) return { data: null, error };

  // CLIENT-SIDE SAFETY NET: Filter out private account posts
  let filteredData = data;
  let likedPostIds = new Set<string>();

  if (currentUser) {
    const { data: followingData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUser.id);

    const followingIds = new Set(followingData?.map(f => f.following_id) || []);

    filteredData = data.filter((post: any) => {
      if (post.user_id === currentUser.id) return true;
      if (post.profiles?.is_private && !followingIds.has(post.user_id)) return false;
      return true;
    });

    // BATCH-FETCH the user's aura (like) status for ALL posts in this page.
    // This eliminates N+1 queries in PostCard and ensures like state is
    // available immediately when the component mounts (no flash of un-liked).
    const postIds = filteredData.map((p: any) => p.id);
    if (postIds.length > 0) {
      const { data: userAuras } = await supabase
        .from("auras")
        .select("post_id")
        .eq("user_id", currentUser.id)
        .in("post_id", postIds);

      likedPostIds = new Set(userAuras?.map(a => a.post_id) || []);
    }
  }

  return {
    data: filteredData.map((post: any) => ({
      ...post,
      aura_count: Number(post.aura_count) || 0,
      has_aura: likedPostIds.has(post.id),
      profiles: post.profiles || { full_name: 'AU User', username: 'user' }
    })),
    error: null
  };
}

export async function getUserPosts(userId: string, limit = 12, offset = 0) {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeOffset = Math.max(0, offset);

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: postsData, error } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!user_id (
        username,
        full_name,
        avatar_url,
        role,
        is_verified,
        verified_title,
        verification_expiry,
        verification_status
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error || !postsData) return { data: null, error };

  // Batch-fetch aura status for all posts
  let likedPostIds = new Set<string>();
  if (currentUser) {
    const postIds = postsData.map((p: any) => p.id);
    if (postIds.length > 0) {
      const { data: userAuras } = await supabase
        .from("auras")
        .select("post_id")
        .eq("user_id", currentUser.id)
        .in("post_id", postIds);

      likedPostIds = new Set(userAuras?.map(a => a.post_id) || []);
    }
  }

  return {
    data: postsData.map((post: any) => ({
      ...post,
      aura_count: Number(post.aura_count) || 0,
      has_aura: likedPostIds.has(post.id),
      profiles: post.profiles || { full_name: 'AU User', username: 'user' }
    })),
    error: null
  };
}

// ============================================================
// SIGNAL & BEAM FUNCTIONS
// ============================================================

export async function getShareSuggestions(userId: string) {
  return await supabase
    .from("profiles")
    .select("user_id, username, full_name, avatar_url")
    .limit(10);
}

export async function beamToStory(userId: string, postId: string) {
  const id1 = validateUUID(userId);
  const id2 = validateUUID(postId);
  if (!id1.valid || !id2.valid) return { data: null, error: { message: "Invalid ID" } };

  return await supabase.from("stories").insert({
    user_id: userId,
    post_id: postId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    type: 'post_share'
  }).select().single();
}

// ============================================================
// COMMENTS & AURA (Validated + Rate Limited)
// ============================================================

export async function getComments(postId: string) {
  const idCheck = validateUUID(postId);
  if (!idCheck.valid) return { data: null, error: { message: idCheck.error } };

  return await supabase
    .from("comments")
    .select(`
      *,
      profiles!user_id (
        username,
        full_name,
        avatar_url,
        is_verified,
        verified_title
      )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
}

export async function createComment({ user_id, post_id, content, parent_id = null }: any) {
  // Rate limit: 20 comments per minute
  if (!commentLimiter.canProceed('create_comment')) {
    return { data: null, error: { message: "You're commenting too fast. Please wait." } };
  }

  const idCheck = validateUUID(user_id);
  if (!idCheck.valid) return { data: null, error: { message: idCheck.error } };

  const contentCheck = validateComment(content);
  if (!contentCheck.valid) return { data: null, error: { message: contentCheck.error } };

  const { data, error } = await supabase
    .from("comments")
    .insert([{
      user_id,
      post_id,
      content: content.trim(),
      parent_id
    }])
    .select(`
      *,
      profiles:user_id (
        username,
        full_name,
        avatar_url,
        is_verified,
        verified_title
      )
    `)
    .single();

  return { data, error };
}

export async function toggleAura(userId: string, postId: string) {
  const id1 = validateUUID(userId);
  const id2 = validateUUID(postId);
  if (!id1.valid || !id2.valid) return { action: "error", error: { message: "Invalid ID" } };

  // 1. Check if aura exists
  const { data: existing, error: checkError } = await supabase
    .from("auras")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (checkError) return { action: "error", error: checkError };

  // 2. Add or Remove (Let DB Trigger update counts)
  if (existing) {
    const { error: delError } = await supabase.from("auras").delete().eq("id", existing.id);
    return { action: "removed", error: delError };
  } else {
    const { error: insError } = await supabase.from("auras").insert([{ user_id: userId, post_id: postId }]);
    return { action: "added", error: insError };
  }
}

export async function getAuraLeaderboard(limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  return await supabase
    .from("profiles")
    .select("username, full_name, avatar_url, total_aura, department")
    .neq("username", "auconnect")
    .order("total_aura", { ascending: false })
    .limit(safeLimit);
}

// ============================================================
// SETTINGS & PRIVACY (Rate Limited)
// ============================================================

export async function getNotificationPrefs(userId: string) {
  return await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
}

export async function updateNotificationPrefs(userId: string, prefs: any) {
  return await supabase.from("notification_preferences").upsert({ user_id: userId, ...prefs });
}

export async function submitSupportTicket(ticket: { user_id: string; type: 'bug' | 'feedback' | 'contact'; message: string }) {
  // Rate limit: 3 tickets per 10 minutes
  if (!supportLimiter.canProceed('support_ticket')) {
    return { data: null, error: { message: "Too many reports. Please wait before submitting another." } };
  }

  // Validate
  if (!ticket.message || ticket.message.trim().length < 10) {
    return { data: null, error: { message: "Please provide more detail (at least 10 characters)." } };
  }
  if (ticket.message.length > 2000) {
    return { data: null, error: { message: "Report is too long (max 2000 characters)." } };
  }

  return await supabase.from("support_tickets").insert([{
    ...ticket,
    message: ticket.message.trim()
  }]);
}

export async function getBlockedUsers(userId: string) {
  return await supabase.from("blocks").select("blocked_id, profiles!blocked_id(*)").eq("blocker_id", userId);
}

export async function createEvent(event: {
  title: string;
  description?: string;
  location?: string;
  event_date: string;
  cover_url: string;
  created_by: string;
}) {
  const { data, error } = await supabase.from('events').insert([event]).select().single();
  if (error) return { data: null, error: { ...error, message: `[Supabase] ${error.message}` } };
  return { data, error };
}

export { supabase };