-- ==========================================
-- MASTER SQL FIXES FOR CIRCLES & CHAT (Updated)
-- Run this in the Supabase SQL Editor.
-- It will DROP existing policies with the same name to avoid conflicts.
-- ==========================================

-- 1. CIRCLES: Allow authenticated users to create NEW circles
drop policy if exists "Users can create circles" on "public"."circles";
create policy "Users can create circles"
on "public"."circles"
for insert
to authenticated
with check (
  auth.uid() = created_by
);

-- 2. CIRCLES: Allow Admins/Mods to update their circles (e.g. Cover Image)
drop policy if exists "Admins can update their circles" on "public"."circles";
create policy "Admins can update their circles"
on "public"."circles"
for update
to authenticated
using (
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = id and role in ('admin', 'moderator')
  )
);

-- 3. NOTIFICATIONS: Allow users to send Circle Invites to others
drop policy if exists "Allow sending circle invites" on "public"."notifications";
create policy "Allow sending circle invites"
on "public"."notifications"
for insert
to authenticated
with check (
  type = 'circle_invite'
);

-- 4. CIRCLE MEMBERS: Allow users to join (Accept Invite)
drop policy if exists "Users can join circles" on "public"."circle_members";
create policy "Users can join circles"
on "public"."circle_members"
for insert
to authenticated
with check (
  auth.uid() = user_id
);

-- 5. CIRCLE MEMBERS: Allow Admins to remove users (Kick)
drop policy if exists "Admins can remove members" on "public"."circle_members";
create policy "Admins can remove members"
on "public"."circle_members"
for delete
to authenticated
using (
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = circle_members.circle_id and role = 'admin'
  )
);

-- 6. CIRCLE MEMBERS: Allow Admins to update roles (Make Admin)
drop policy if exists "Admins can update member roles" on "public"."circle_members";
create policy "Admins can update member roles"
on "public"."circle_members"
for update
to authenticated
using (
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = circle_members.circle_id and role = 'admin'
  )
);

-- 7. MESSAGES: Allow members to SEND messages
drop policy if exists "Members can send messages" on "public"."circle_messages";
create policy "Members can send messages"
on "public"."circle_messages"
for insert
to authenticated
with check (
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = circle_messages.circle_id
  )
);

-- 8. MESSAGES: Allow members to VIEW messages
drop policy if exists "Members can view messages" on "public"."circle_messages";
create policy "Members can view messages"
on "public"."circle_messages"
for select
to authenticated
using (
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = circle_messages.circle_id
  )
);
