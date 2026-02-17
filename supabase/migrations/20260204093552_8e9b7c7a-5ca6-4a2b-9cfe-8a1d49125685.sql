-- Update notifications_type_check to include 'follow_request' and 'like' types
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['aura'::text, 'comment'::text, 'follow'::text, 'follow_request'::text, 'circle_invite'::text, 'event_invite'::text, 'message'::text, 'mention'::text, 'like'::text]));