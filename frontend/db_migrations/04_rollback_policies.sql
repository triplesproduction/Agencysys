-- Drop Secure Policies
DROP POLICY IF EXISTS "Employees can view all employees" ON public.employees;

-- Restore Unsafe Policies
DROP POLICY IF EXISTS "Public employees are viewable by everyone" ON public.employees;
CREATE POLICY "Public employees are viewable by everyone" ON public.employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;
CREATE POLICY "Users can update own employee record" ON public.employees FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow all select on projects" ON public.projects;
CREATE POLICY "Allow all select on projects" ON public.projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all insert on projects" ON public.projects;
CREATE POLICY "Allow all insert on projects" ON public.projects FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all update on projects" ON public.projects;
CREATE POLICY "Allow all update on projects" ON public.projects FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow all select on workflow_history" ON public.workflow_history;
CREATE POLICY "Allow all select on workflow_history" ON public.workflow_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all insert on workflow_history" ON public.workflow_history;
CREATE POLICY "Allow all insert on workflow_history" ON public.workflow_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all select on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow all select on activity_logs" ON public.activity_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all insert on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow all insert on activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
CREATE POLICY "notifications_insert_any" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.quotation_versions;
CREATE POLICY "Allow all for authenticated users" ON public.quotation_versions FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.pricing_items;
CREATE POLICY "Allow all for authenticated users" ON public.pricing_items FOR ALL USING (true);
