-- =========================================================
-- FINAL REMEDY: STOP BANDWIDTH LEAK & CLEAR BROKEN CONTENT
-- =========================================================
-- Since Supabase restricts direct SQL deletion for security,
-- this script focuses on the things you CAN control: 
-- 1. Stopping the bandwidth usage (Egress). 
-- 2. Removing the posts that aren't loading anyway. 
-- =========================================================

-- STEP 1: DELETE THE POSTS THAT AREN'T LOADING
-- This completely removes those old posts from your app.
-- Since you said you don't want them anyway, this is the cleanest fix.
DELETE FROM stories WHERE media_url LIKE '%supabase.co%';
DELETE FROM circle_posts WHERE array_to_string(images, ',') LIKE '%supabase.co%';
DELETE FROM posts WHERE array_to_string(images, ',') LIKE '%supabase.co%' OR video_url LIKE '%supabase.co%';

-- STEP 2: RESET BROKEN PROFILE PHOTOS
-- This keeps the user accounts but removes the profile photos that won't load.
UPDATE profiles SET avatar_url = NULL WHERE avatar_url LIKE '%supabase.co%';
UPDATE profiles SET cover_url = NULL WHERE cover_url LIKE '%supabase.co%';

-- STEP 3: RESET OTHER MEDIA REFERENCES
UPDATE circles SET cover_url = NULL WHERE cover_url LIKE '%supabase.co%';
UPDATE events SET cover_url = NULL WHERE cover_url LIKE '%supabase.co%';
UPDATE marketplace_listings SET images = '{}' WHERE array_to_string(images, ',') LIKE '%supabase.co%';
UPDATE lost_found SET images = '{}' WHERE array_to_string(images, ',') LIKE '%supabase.co%';

-- =========================================================
-- STEP 4: HOW TO CLEAR THE "STORAGE" QUOTA % (Dashboard Only)
-- =========================================================
-- To get the Storage % down to 0, follow these 3 steps in the browser:
-- 1. Go to your Supabase Dashboard.
-- 2. Click "Storage" in the left sidebar.
-- 3. For each bucket (avatars, posts, etc.):
--    - Click the three dots (...) next to the bucket name.
--    - Select "Empty Bucket" or "Delete Bucket".
-- =========================================================
