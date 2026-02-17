-- ==========================================
-- ADD circle_join_request + ALL NOTIFICATION TYPES
-- Run this in Supabase SQL Editor
-- ==========================================

-- First: Remove the old constraint completely
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Then: Add a new constraint that includes EVERY type used in the app
-- We use a permissive list to avoid this error ever happening again
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'like',
  'comment',
  'follow',
  'follow_request',
  'friend_request',
  'message',
  'circle_invite',
  'circle_join_request',
  'mention',
  'system',
  'request_accepted',
  'post_share',
  'story_like'
));
