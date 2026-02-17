-- CHECKS TOTAL FILE SIZE IN MEGABYTES
SELECT 
  SUM((metadata->>'size')::bigint) / 1024 / 1024 as "Total Storage Used (MB)",
  COUNT(*) as "Total Files"
FROM storage.objects;
