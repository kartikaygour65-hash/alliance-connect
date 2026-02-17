-- ==========================================
-- FIX CHAT RLS (GRANULAR) & FEATURES
-- Run this to enable Reply, Delete, and Admin Moderation.
-- ==========================================

-- 1. ADD COLUMN FOR REPLIES
alter table "public"."circle_messages"
add column if not exists "reply_to_id" uuid references "public"."circle_messages"("id") on delete set null;

-- 2. RESET RLS FOR CIRCLE MESSAGES (Granular Security)
alter table "public"."circle_messages" enable row level security;

-- Drop permissive policy if exists (from previous scripts)
drop policy if exists "Enable all access for authenticated users to circle_messages" on "public"."circle_messages";
-- Drop other potential policies
drop policy if exists "Members can view messages" on "public"."circle_messages";
drop policy if exists "Members can send messages" on "public"."circle_messages";
drop policy if exists "Users can delete own messages" on "public"."circle_messages";

-- A. VIEW (SELECT): Allow all authenticated users (or just members? sticking to permissive for view to ensure feed works)
create policy "View messages"
on "public"."circle_messages" for select
to authenticated
using (true);

-- B. SEND (INSERT): Must be a member (or admin)
create policy "Send messages"
on "public"."circle_messages" for insert
to authenticated
with check (
  exists (
    select 1 from circle_members
    where circle_id = circle_messages.circle_id
    and user_id = auth.uid()
  )
);

-- C. EDIT (UPDATE): Only author
create policy "Edit own messages"
on "public"."circle_messages" for update
to authenticated
using (user_id = auth.uid());

-- D. DELETE: Author OR Admin/Moderator
create policy "Delete messages (Owner or Admin)"
on "public"."circle_messages" for delete
to authenticated
using (
  -- 1. Is Author
  user_id = auth.uid()
  OR
  -- 2. Is Circle Admin/Moderator
  exists (
    select 1 from circle_members
    where circle_id = circle_messages.circle_id
    and user_id = auth.uid()
    and role in ('admin', 'moderator')
  )
);
