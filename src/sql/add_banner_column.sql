-- Add banner_url to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'banner_url'
    ) THEN
        ALTER TABLE "public"."profiles" 
        ADD COLUMN "banner_url" text;
    END IF;
END $$;
