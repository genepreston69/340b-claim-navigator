-- Create a helper function to check if user has analytics access (admin or collaborator)
CREATE OR REPLACE FUNCTION public.has_analytics_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'collaborator')
  )
$$;