-- =================================================================
-- DIAGNOSTIC: REAL STORAGE & DATABASE USAGE
-- Run this in your Supabase Dashboard > SQL Editor to see the truth.
-- =================================================================

-- 1. Check Real File Storage Usage (Grouped by Bucket)
-- This queries the internal metadata table directly, bypassing the UI file browser.
SELECT 
    bucket_id, 
    COUNT(*) as file_count, 
    ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 2) as total_size_mb
FROM storage.objects
GROUP BY bucket_id
ORDER BY total_size_mb DESC;

-- 2. Check for "Orphaned" or Hidden Files
-- Sometimes files exist in the system but don't show up in a specific folder.
SELECT 
    id, 
    name, 
    bucket_id, 
    ROUND((metadata->>'size')::bigint / 1024.0 / 1024.0, 2) as size_mb,
    created_at
FROM storage.objects
ORDER BY (metadata->>'size')::bigint DESC
LIMIT 20;

-- 3. Check Overall Database Size (Tables + Indexes)
-- If your "Database" limit is full, it's not the images, it's the data rows.
SELECT pg_size_pretty(pg_database_size(current_database())) as total_database_size;

-- 4. Check Largest Tables
SELECT
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
