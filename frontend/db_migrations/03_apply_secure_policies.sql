-- Employees Table Secure Policies
DROP POLICY IF EXISTS "Employees can view all employees" ON public.employees;
CREATE POLICY "Employees can view all employees" ON public.employees
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
CREATE POLICY "Employees can update own record" ON public.employees
FOR UPDATE USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Admins have full access to employees" ON public.employees;
CREATE POLICY "Admins have full access to employees" ON public.employees
FOR ALL USING (public.is_admin());

-- Projects Table Secure Policies
DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;
CREATE POLICY "Admins have full access to projects" ON public.projects
FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view related projects" ON public.projects;
CREATE POLICY "Users can view related projects" ON public.projects
FOR SELECT USING (
  public.is_admin_or_manager() OR
  (auth.uid()::text = created_by::text) OR
  EXISTS (SELECT 1 FROM public.project_members WHERE "projectId"::text = public.projects.id::text AND "userId"::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can update their projects" ON public.projects;
CREATE POLICY "Creators can update their projects" ON public.projects
FOR UPDATE USING (auth.uid()::text = created_by::text);

-- Workflow History Secure Policies
DROP POLICY IF EXISTS "Admins and Managers can view workflow history" ON public.workflow_history;
CREATE POLICY "Admins and Managers can view workflow history" ON public.workflow_history
FOR SELECT USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view workflow history for related projects" ON public.workflow_history;
CREATE POLICY "Users can view workflow history for related projects" ON public.workflow_history
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE "projectId"::text = public.workflow_history.project_id::text AND "userId"::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated users can insert workflow history" ON public.workflow_history;
CREATE POLICY "Authenticated users can insert workflow history" ON public.workflow_history
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Activity Logs Secure Policies
DROP POLICY IF EXISTS "Admins and Managers can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins and Managers can view activity logs" ON public.activity_logs
FOR SELECT USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view activity logs for related projects" ON public.activity_logs;
CREATE POLICY "Users can view activity logs for related projects" ON public.activity_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE "projectId"::text = public.activity_logs.project_id::text AND "userId"::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Notifications Secure Policies
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Quotation Versions & Pricing Items (Secured to Admin/Manager)
DROP POLICY IF EXISTS "Admin and Manager access quotation versions" ON public.quotation_versions;
CREATE POLICY "Admin and Manager access quotation versions" ON public.quotation_versions
FOR ALL USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Admin and Manager access pricing items" ON public.pricing_items;
CREATE POLICY "Admin and Manager access pricing items" ON public.pricing_items
FOR ALL USING (public.is_admin_or_manager());
