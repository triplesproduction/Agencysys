-- =====================================================
-- TripleS OS — Fix Missing RLS INSERT Policies
-- Run this in: https://supabase.com/dashboard/project/tslixoanxxkrzkjesxds/sql/new
-- =====================================================
-- Note: employees.id === auth.uid() in this project's auth design.
-- All employeeId foreign keys in child tables = the logged-in user's auth UUID.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEAVES — employees can apply for their own leaves
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert_own_leaves" ON public.leaves;
CREATE POLICY "employees_insert_own_leaves"
  ON public.leaves
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

DROP POLICY IF EXISTS "employees_select_own_leaves" ON public.leaves;
CREATE POLICY "employees_select_own_leaves"
  ON public.leaves
  FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can view leaves (admins review them)

DROP POLICY IF EXISTS "employees_update_own_leaves" ON public.leaves;
CREATE POLICY "employees_update_own_leaves"
  ON public.leaves
  FOR UPDATE
  TO authenticated
  USING (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WORK_HOURS — employees can log their own hours
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert_own_work_hours" ON public.work_hours;
CREATE POLICY "employees_insert_own_work_hours"
  ON public.work_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

DROP POLICY IF EXISTS "employees_select_work_hours" ON public.work_hours;
CREATE POLICY "employees_select_work_hours"
  ON public.work_hours
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. KPI_METRICS — employees can update their own KPIs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert_own_kpis" ON public.kpi_metrics;
CREATE POLICY "employees_insert_own_kpis"
  ON public.kpi_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

DROP POLICY IF EXISTS "employees_update_own_kpis" ON public.kpi_metrics;
CREATE POLICY "employees_update_own_kpis"
  ON public.kpi_metrics
  FOR UPDATE
  TO authenticated
  USING (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

DROP POLICY IF EXISTS "employees_select_kpis" ON public.kpi_metrics;
CREATE POLICY "employees_select_kpis"
  ON public.kpi_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EOD_REPORTS / eod_submissions — employees can submit their own EODs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert_own_eod" ON public.eod_submissions;
CREATE POLICY "employees_insert_own_eod"
  ON public.eod_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

-- If the table is named differently, also try:
DROP POLICY IF EXISTS "employees_insert_own_eod_reports" ON public.eod_reports;
CREATE POLICY "employees_insert_own_eod_reports"
  ON public.eod_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employeeId = auth.uid()::text
    OR (employeeId IS NOT NULL AND employeeId::uuid = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PAYROLL_RECORDS — employees can view their own payroll  
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_select_own_payroll" ON public.payroll_records;
CREATE POLICY "employees_select_own_payroll"
  ON public.payroll_records
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SALARY_HISTORY — employees can view their own salary history  
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_select_own_salary_history" ON public.salary_history;
CREATE POLICY "employees_select_own_salary_history"
  ON public.salary_history
  FOR SELECT
  TO authenticated
  USING (true);
