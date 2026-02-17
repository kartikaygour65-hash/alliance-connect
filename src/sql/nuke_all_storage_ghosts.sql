-- =================================================================
-- NUKE OPTION: DELETE ALL "GHOST" FILES
-- =================================================================

-- You have 84 files (approx 120MB) hidden in your storage.
-- Since you migrated to Cloudinary, these are likely old/duplicate files
-- that are still consuming your bandwidth when users try to load them.

-- 1. SEE THE GHOST FILES (Run this selection to verify what they are)
SELECT 
    bucket_id, 
    name, 
    (metadata->>'size')::bigint / 1024 / 1024 as size_mb, 
    created_at 
FROM storage.objects
ORDER BY created_at DESC;

-- 2. DELETE EVERYTHING (Uncomment the line below to wipe Supabase Storage clean)
-- WARNING: This deletes ALL files in Supabase Storage.
-- Since you moved to Cloudinary, this should be safe, but please verify.

-- DELETE FROM storage.objects;

-- 3. VERIFY (Should be 0 after running step 2)
-- SELECT COUNT(*) FROM storage.objects;
