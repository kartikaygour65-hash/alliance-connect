-- ==========================================
-- FIX CHAT RELATIONSHIPS (FKs)
-- Run this to fix "400 Bad Request" on Chat Loading
-- ==========================================

-- This script ensures that 'circle_messages' correctly references 'profiles'.
-- If this relationship is missing, the chat query fails.

do $$
begin
    -- 1. Ensure profiles.user_id is unique (required for FK)
    -- It likely is, but explicitly:
    if not exists (select 1 from pg_constraint where conname = 'profiles_user_id_key') then
       alter table "public"."profiles" add constraint "profiles_user_id_key" unique ("user_id");
    end if;

    -- 2. Add FK for circle_messages -> profiles
    if not exists (select 1 from pg_constraint where conname = 'circle_messages_user_id_fkey_profiles') then
       alter table "public"."circle_messages" 
       add constraint "circle_messages_user_id_fkey_profiles" 
       foreign key ("user_id") 
       references "public"."profiles" ("user_id");
    end if;

    -- 3. Add FK for circle_members -> profiles (Just in case)
    if not exists (select 1 from pg_constraint where conname = 'circle_members_user_id_fkey_profiles') then
       alter table "public"."circle_members" 
       add constraint "circle_members_user_id_fkey_profiles" 
       foreign key ("user_id") 
       references "public"."profiles" ("user_id");
    end if;

exception when others then
    raise notice 'Error creating constraints (might already exist or conflict): %', sqlerrm;
end $$;
