-- Create a function to get all users with their roles (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  role app_role,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id as user_id,
    au.email,
    COALESCE(ur.role, 'user'::app_role) as role,
    au.created_at
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY au.created_at DESC
$$;