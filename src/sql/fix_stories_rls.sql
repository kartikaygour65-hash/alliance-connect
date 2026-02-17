-- ==========================================
-- STORIES RLS FIX
-- Run this to enable Story Viewing and Creation.
-- This ensures 'Viewed' status is saved correctly.
-- ==========================================

do $$
begin
  drop policy if exists "Enable all access for authenticated users to stories" on "public"."stories";
  drop policy if exists "Enable all access for authenticated users to story_views" on "public"."story_views";
  drop policy if exists "Enable all access for authenticated users to story_likes" on "public"."story_likes";
end $$;

-- 1. STORIES TABLE
alter table "public"."stories" enable row level security;

create policy "Enable all access for authenticated users to stories"
on "public"."stories"
for all
to authenticated
using (true)
with check (true);

-- 2. STORY VIEWS (This fixes the 'Ring stays bright' issue)
alter table "public"."story_views" enable row level security;

create policy "Enable all access for authenticated users to story_views"
on "public"."story_views"
for all
to authenticated
using (true)
with check (true);

-- 3. STORY LIKES
alter table "public"."story_likes" enable row level security;

create policy "Enable all access for authenticated users to story_likes"
on "public"."story_likes"
for all
to authenticated
using (true)
with check (true);
