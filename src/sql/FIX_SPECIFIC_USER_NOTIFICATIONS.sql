-- =========================================================
-- FIX NOTIFICATION SPECIFICITY & AURA (LIKE) NOTIFICATIONS
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- =========================================================

-- 1. HELPER FUNCTION: Get Actor Display Name
-- Prioritizes full_name, then username, then fallback
CREATE OR REPLACE FUNCTION get_actor_display_name(actor_id UUID)
RETURNS TEXT AS $$
DECLARE
    display_name TEXT;
BEGIN
    SELECT COALESCE(full_name, username, 'Someone') INTO display_name FROM profiles WHERE user_id = actor_id;
    RETURN display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. UPDATE FOLLOW TRIGGER (SPECIFIC NAMES)
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (
    new.following_id,
    'follow',
    'New Follower',
    get_actor_display_name(new.follower_id) || ' started following you',
    jsonb_build_object('follower_id', new.follower_id),
    false
  );
  RETURN new;
END;
$$;

-- 3. UPDATE FOLLOW REQUEST TRIGGER (SPECIFIC NAMES)
CREATE OR REPLACE FUNCTION public.handle_new_follow_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (
    new.target_id,
    'follow_request',
    'Follow Request',
    get_actor_display_name(new.requester_id) || ' wants to follow you',
    jsonb_build_object('requester_id', new.requester_id, 'request_id', new.id),
    false
  );
  RETURN new;
END;
$$;

-- 4. ADD AURA (LIKE) NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION handle_new_aura_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
BEGIN
    SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
    
    -- Don't notify if liking own post
    IF post_owner_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, title, body, data, is_read)
        VALUES (
            post_owner_id,
            'like',
            'Post Liked',
            get_actor_display_name(NEW.user_id) || ' liked your photo',
            jsonb_build_object('user_id', NEW.user_id, 'post_id', NEW.post_id),
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_aura_notification ON public.auras;
CREATE TRIGGER on_aura_notification
AFTER INSERT ON public.auras
FOR EACH ROW EXECUTE PROCEDURE handle_new_aura_notification();

-- 5. ADD COMMENT NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION handle_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
BEGIN
    SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
    
    -- Don't notify if commenting own post
    IF post_owner_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, title, body, data, is_read)
        VALUES (
            post_owner_id,
            'comment',
            'New Comment',
            get_actor_display_name(NEW.user_id) || ' commented on your photo',
            jsonb_build_object('user_id', NEW.user_id, 'post_id', NEW.post_id, 'comment_id', NEW.id),
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_notification ON public.comments;
CREATE TRIGGER on_comment_notification
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE handle_new_comment_notification();

-- 6. ENSURE NOTIFICATION CONSTRAINT ALLOWS ALL TYPES
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";
ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'friend_request', 'message', 'circle_invite', 'circle_join_request', 'story_like', 'mention', 'system', 'request_accepted'));

NOTIFY pgrst, 'reload schema';
