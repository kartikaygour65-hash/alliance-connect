-- Tighten notifications security: clients should not be able to insert arbitrary notifications
-- Notification creation is handled via SECURITY DEFINER database functions/triggers.

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
