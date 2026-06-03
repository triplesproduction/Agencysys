CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT "roleId" FROM public.employees WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean AS $$
  SELECT public.get_user_role() IN ('ADMIN', 'MANAGER');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT public.get_user_role() = 'ADMIN';
$$ LANGUAGE sql SECURITY DEFINER STABLE;
