-- =============================================
-- EMERGENCY STORAGE CLEANUP
-- Use this script to free up space and reduce bandwidth consumption.
-- =============================================

-- 1. VIEW LARGEST FILES (Run this first to see what's eating your quota)
SELECT 
    name, 
    bucket_id, 
    (metadata->>'size')::bigint / 1024 / 1024 as size_mb,
    created_at
FROM storage.objects
ORDER BY (metadata->>'size')::bigint DESC
LIMIT 10;

-- 2. DELETE FILES (Uncomment the lines below to delete the TOP 2 largest files)
-- WARNING: This action is irreversible. Make sure you don't delete critical assets.
-- DELETE FROM storage.objects 
-- WHERE id IN (
--     SELECT id FROM storage.objects 
--     ORDER BY (metadata->>'size')::bigint DESC 
--     LIMIT 2
-- );

-- 3. CONFIRM CLEANUP
-- SELECT count(*) as files_remaining, sum((metadata->>'size')::bigint) / 1024 / 1024 as total_mb_used 
-- FROM storage.objects;
