-- ==========================================
-- FINAL "PERMISSIVE" RLS FIX FOR CIRCLES
-- Run this to unblock all creation/joining issues.
-- This sets very permissive policies for Insert.
-- ==========================================

-- DROP EXISTING POLICIES TO AVOID CONFLICTS
drop policy if exists "Users can create circles" on "public"."circles";
drop policy if exists "Enable insert for authenticated users only" on "public"."circles";

drop policy if exists "Admins can update their circles" on "public"."circles";

drop policy if exists "Allow sending circle invites" on "public"."notifications";
drop policy if exists "Enable insert for notifications" on "public"."notifications";

drop policy if exists "Users can join circles" on "public"."circle_members";
drop policy if exists "Enable insert for circle_members" on "public"."circle_members";

drop policy if exists "Admins can remove members" on "public"."circle_members";
drop policy if exists "Enable delete for circle_members (Self or Admin)" on "public"."circle_members";

drop policy if exists "Admins can update member roles" on "public"."circle_members";

drop policy if exists "Members can send messages" on "public"."circle_messages";
drop policy if exists "Enable insert for circle_messages" on "public"."circle_messages";

drop policy if exists "Members can view messages" on "public"."circle_messages";
drop policy if exists "Enable read access for circle_messages" on "public"."circle_messages";


-- 1. CIRCLES: Allow ANY authenticated user to create
create policy "Enable insert for authenticated users only"
on "public"."circles"
for insert
to authenticated
with check (true);

-- 2. CIRCLES: Allow Admins to update (Cover Image)
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

-- 3. NOTIFICATIONS: Allow ANY authenticated user to insert (Invites)
create policy "Enable insert for notifications"
on "public"."notifications"
for insert
to authenticated
with check (true);

-- 4. CIRCLE MEMBERS: Allow ANY authenticated user to insert (Join/Create)
create policy "Enable insert for circle_members"
on "public"."circle_members"
for insert
to authenticated
with check (true);

-- 5. CIRCLE MEMBERS: Allow Admins to delete (Kick) OR User to leave
create policy "Enable delete for circle_members (Self or Admin)"
on "public"."circle_members"
for delete
to authenticated
using (
  auth.uid() = user_id 
  OR
  auth.uid() in (
    select user_id from circle_members 
    where circle_id = circle_members.circle_id and role = 'admin'
  )
);

-- 6. CIRCLE MEMBERS: Allow Admins to update roles (Make Admin)
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

-- 7. MESSAGES: Allow ANY authenticated user to insert (Chat)
create policy "Enable insert for circle_messages"
on "public"."circle_messages"
for insert
to authenticated
with check (true);

-- 8. MESSAGES: Allow reading
create policy "Enable read access for circle_messages"
on "public"."circle_messages"
for select
to authenticated
using (true);
