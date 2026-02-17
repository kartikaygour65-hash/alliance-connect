-- Add verification columns to profiles table

ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "verified_title" text,
ADD COLUMN IF NOT EXISTS "verification_expiry" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "verification_date" timestamp with time zone;

-- Policy to allow users to read verification status (already covered by public/authenticated select policy usually, but good to ensure)
-- Assuming "Public profiles" policy exists.

-- Optional: Function to auto-unverify if expired (can be a scheduled job or check on read)
-- For now we will check expiry in frontend or backend logic.
