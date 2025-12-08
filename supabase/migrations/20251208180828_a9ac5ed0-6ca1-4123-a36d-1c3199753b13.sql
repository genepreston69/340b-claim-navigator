-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to auto-assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign role on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing table policies to require admin for full access
-- Drop the permissive policies and create role-based ones

-- Claims table
DROP POLICY IF EXISTS "Allow all operations on claims" ON public.claims;
CREATE POLICY "Admins can do all on claims" ON public.claims FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view claims" ON public.claims FOR SELECT TO authenticated USING (true);

-- Prescriptions table
DROP POLICY IF EXISTS "Allow all operations on prescriptions" ON public.prescriptions;
CREATE POLICY "Admins can do all on prescriptions" ON public.prescriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (true);

-- Patients table
DROP POLICY IF EXISTS "Allow all operations on patients" ON public.patients;
CREATE POLICY "Admins can do all on patients" ON public.patients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view patients" ON public.patients FOR SELECT TO authenticated USING (true);

-- Pharmacies table
DROP POLICY IF EXISTS "Allow all operations on pharmacies" ON public.pharmacies;
CREATE POLICY "Admins can do all on pharmacies" ON public.pharmacies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view pharmacies" ON public.pharmacies FOR SELECT TO authenticated USING (true);

-- Prescribers table
DROP POLICY IF EXISTS "Allow all operations on prescribers" ON public.prescribers;
CREATE POLICY "Admins can do all on prescribers" ON public.prescribers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view prescribers" ON public.prescribers FOR SELECT TO authenticated USING (true);

-- Drugs table
DROP POLICY IF EXISTS "Allow all operations on drugs" ON public.drugs;
CREATE POLICY "Admins can do all on drugs" ON public.drugs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view drugs" ON public.drugs FOR SELECT TO authenticated USING (true);

-- Insurance plans table
DROP POLICY IF EXISTS "Allow all operations on insurance_plans" ON public.insurance_plans;
CREATE POLICY "Admins can do all on insurance_plans" ON public.insurance_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view insurance_plans" ON public.insurance_plans FOR SELECT TO authenticated USING (true);

-- Locations table
DROP POLICY IF EXISTS "Allow all operations on locations" ON public.locations;
CREATE POLICY "Admins can do all on locations" ON public.locations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view locations" ON public.locations FOR SELECT TO authenticated USING (true);

-- Covered entities table
DROP POLICY IF EXISTS "Allow all operations on covered_entities" ON public.covered_entities;
CREATE POLICY "Admins can do all on covered_entities" ON public.covered_entities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view covered_entities" ON public.covered_entities FOR SELECT TO authenticated USING (true);