-- Add verify_user_rpc function
CREATE OR REPLACE FUNCTION admin_verify_user(target_user_id UUID, should_verify BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    is_verified = should_verify,
    verification_status = CASE WHEN should_verify THEN 'verified' ELSE 'rejected' END,
    verification_expiry = CASE WHEN should_verify THEN (now() + interval '30 days') ELSE NULL END,
    verified_title = NULL
  WHERE user_id = target_user_id;
END;
$$;
