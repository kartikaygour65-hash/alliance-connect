-- =========================================================
-- STEP 1: MIGRATE SUPABASE STORAGE URLS TO CLOUDINARY
-- =========================================================
-- This script replaces all Supabase storage URLs with Cloudinary 
-- URLs to stop Supabase Egress (bandwidth) consumption.
--
-- PREREQUISITE: Set up "Auto Upload Mapping" in Cloudinary:
-- Mapping Name: supabase
-- URL Prefix: https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/
-- =========================================================

-- 1. PROFILES (Avatar & Cover) - TEXT COLUMNS
UPDATE profiles 
SET avatar_url = REPLACE(avatar_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE avatar_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

UPDATE profiles 
SET cover_url = REPLACE(cover_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE cover_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

-- 2. STORIES - TEXT COLUMN
UPDATE stories 
SET media_url = REPLACE(media_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE media_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

-- 3. CIRCLES & EVENTS - TEXT COLUMNS
UPDATE circles 
SET cover_url = REPLACE(cover_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE cover_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

UPDATE events 
SET cover_url = REPLACE(cover_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE cover_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

-- 4. POSTS (video_url is TEXT, images is TEXT[])
UPDATE posts 
SET video_url = REPLACE(video_url, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
WHERE video_url LIKE 'https://ophxaqowktnujdhrwwas.supabase.co%';

UPDATE posts 
SET images = ARRAY(
  SELECT REPLACE(img, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
  FROM unnest(images) AS img
)
WHERE images IS NOT NULL 
  AND array_length(images, 1) > 0 
  AND array_to_string(images, ',') LIKE '%ophxaqowktnujdhrwwas.supabase.co%';

-- 5. MARKETPLACE & LOST-FOUND - TEXT[] COLUMNS
UPDATE marketplace_listings 
SET images = ARRAY(
  SELECT REPLACE(img, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
  FROM unnest(images) AS img
)
WHERE images IS NOT NULL 
  AND array_length(images, 1) > 0 
  AND array_to_string(images, ',') LIKE '%ophxaqowktnujdhrwwas.supabase.co%';

UPDATE lost_found 
SET images = ARRAY(
  SELECT REPLACE(img, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
  FROM unnest(images) AS img
)
WHERE images IS NOT NULL 
  AND array_length(images, 1) > 0 
  AND array_to_string(images, ',') LIKE '%ophxaqowktnujdhrwwas.supabase.co%';

-- 6. CIRCLE POSTS - TEXT[] COLUMN
UPDATE circle_posts 
SET images = ARRAY(
  SELECT REPLACE(img, 'https://ophxaqowktnujdhrwwas.supabase.co/storage/v1/object/public/', 'https://res.cloudinary.com/dq9kqhji0/image/upload/supabase/')
  FROM unnest(images) AS img
)
WHERE images IS NOT NULL 
  AND array_length(images, 1) > 0 
  AND array_to_string(images, ',') LIKE '%ophxaqowktnujdhrwwas.supabase.co%';

-- =========================================================
-- STEP 2: VERIFICATION (DO NOT SKIP)
-- =========================================================
-- After running the above, go to your app and check if old images load.
-- If they load, they are now being served through Cloudinary.
-- =========================================================

-- =========================================================
-- STEP 3: THE "NUKE" (CLEANUP)
-- =========================================================
-- ONLY RUN THIS AFTER STEP 1 & 2 ARE VERIFIED WORKING.
-- This will delete the actual files from Supabase Storage.
-- =========================================================
-- DELETE FROM storage.objects 
-- WHERE bucket_id IN ('avatars', 'posts', 'stories', 'covers', 'marketplace', 'events', 'circles', 'lost-found');
