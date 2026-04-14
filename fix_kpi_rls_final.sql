-- =====================================================
-- TripleS OS — Fix KPI_PROFILES RLS Permissions
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tslixoanxxkrzkjesxds/sql/new
-- =====================================================

-- This ensures that when an employee logs their hours,
-- the database trigger that updates their monthly KPI profile
-- (or creates it if it doesn't exist) is allowed to proceed.

BEGIN;

-- 1. Enable RLS on kpi_profiles
ALTER TABLE public.kpi_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "employees_select_kpi_profiles" ON public.kpi_profiles;
DROP POLICY IF EXISTS "employees_insert_kpi_profiles" ON public.kpi_profiles;
DROP POLICY IF EXISTS "employees_update_kpi_profiles" ON public.kpi_profiles;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.kpi_profiles;

-- 3. Create a clean, role-based policy that allows employees 
--    to manage their own profiles (required for triggers on hour-logging)
--    Note: Using snake_case column names 'employee_id' as found in schema
CREATE POLICY "employees_manage_own_kpi_profiles"
  ON public.kpi_profiles
  FOR ALL
  TO authenticated
  USING (
    employee_id::text = auth.uid()::text
  )
  WITH CHECK (
    employee_id::text = auth.uid()::text
  );

-- 4. Also ensure employees can insert into kpi_audit_logs if needed
ALTER TABLE public.kpi_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.kpi_audit_logs;
CREATE POLICY "employees_insert_own_kpi_logs"
  ON public.kpi_audit_logs
  FOR ALL
  TO authenticated
  USING (
    employee_id::text = auth.uid()::text
  )
  WITH CHECK (
    employee_id::text = auth.uid()::text
  );

COMMIT;
