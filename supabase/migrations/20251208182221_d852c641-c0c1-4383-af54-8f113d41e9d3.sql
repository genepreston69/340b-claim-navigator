-- Drop the overly permissive policy that allows all authenticated users to view patients
DROP POLICY IF EXISTS "Users can view patients" ON public.patients;

-- Create a new policy that only allows admins to view patients
CREATE POLICY "Only admins can view patients" 
ON public.patients 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));