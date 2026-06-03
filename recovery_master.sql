-- TRIPLE S OS MASTER RECOVERY SCRIPT
-- Restore Personnel, EOD Data, and Security Policies

-- 1. Restore Employees
INSERT INTO public.employees (id, email, "firstName", "lastName", "roleId", status, designation, "baseSalary", "leave_balance")
VALUES 
('dcac6bfe-9f0f-4c94-9ff3-a4fd599ce5c6', 'admin@triples.os', 'Admin', 'System', 'ADMIN', 'ACTIVE', 'System Administrator', 0, 0),
('d05fa8bf-10be-41a1-942f-9dc103448329', 'suraj@triplesproduction.com', 'Suraj', 'Singh', 'MANAGER', 'ACTIVE', 'Production Manager', 50000, 10),
('6010a8cd-3b3f-4f5c-9929-5e8c81fffd04', 'vaishnavi@triplesproduction.com', 'Vaishnavi', 'Patil', 'EMPLOYEE', 'ACTIVE', 'Website Developer', 25000, 12),
('f75f172c-945a-4378-a26e-6aa348ed55ad', 'siddhi@triplesproduction.com', 'Siddhi', 'Jadhav', 'EMPLOYEE', 'ACTIVE', 'Graphic Designer', 22000, 12),
('3c4fa07f-083a-4ea0-b88c-2dbfb1a9be1d', 'prince@triplesproduction.com', 'Prince', 'Kushwaha', 'EMPLOYEE', 'ACTIVE', 'Video Editor', 20000, 12),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', 'parth@triplesproduction.com', 'Parth', 'Shah', 'MANAGER', 'ACTIVE', 'Senior Developer', 45000, 10)
ON CONFLICT (id) DO UPDATE SET 
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "roleId" = EXCLUDED."roleId",
  designation = EXCLUDED.designation;

-- 2. Restore EOD Reports (Vaishnavi - April 2026)
INSERT INTO public.eod_reports ("employeeId", "reportDate", "tasksCompleted", "tasksInProgress", "blockers", "sentiment", "status", "work_hours", "completedText")
VALUES 
('6010a8cd-3b3f-4f5c-9929-5e8c81fffd04', '2026-04-05', '["male house software working phase one", "male house software working phase two"]', '[]', 'None', 'GOOD', 'SUBMITTED', 4, 'Working on Male House software phase one and two'),
('6010a8cd-3b3f-4f5c-9929-5e8c81fffd04', '2026-04-07', '["male house software working phase three"]', '[]', 'None', 'GOOD', 'SUBMITTED', 4, 'Phase three development'),
('6010a8cd-3b3f-4f5c-9929-5e8c81fffd04', '2026-04-08', '["male house software testing", "bug fixing"]', '[]', 'None', 'GOOD', 'SUBMITTED', 4, 'Testing and bug fixes'),
('6010a8cd-3b3f-4f5c-9929-5e8c81fffd04', '2026-04-11', '["final deployment checks"]', '[]', 'None', 'GOOD', 'SUBMITTED', 4, 'Pre-deployment audit');

-- 3. Restore EOD Reports (Parth - May 2026)
INSERT INTO public.eod_reports ("employeeId", "reportDate", "tasksCompleted", "tasksInProgress", "blockers", "sentiment", "status", "work_hours", "completedText")
VALUES 
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-01', '["Team sync", "Task delegation"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Daily management'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-02', '["Roadmap review", "Milestone tracking"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Planning session'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-04', '["Internal coordination"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Resource planning'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-05', '["Stakeholder communication"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Progress reporting'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-06', '["Performance monitoring"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Team guidance'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-07', '["System audit"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Audit check'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-08', '["Process optimization"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Workflow refinement'),
('ba635e03-0a19-4267-b5d8-bfa422aeb250', '2026-05-09', '["Final review"]', '[]', 'None', 'GREAT', 'SUBMITTED', 4, 'Weekly wrap-up');

-- 4. Restore RLS Policies (Consolidated)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Employees Policies
DROP POLICY IF EXISTS "Public employees are viewable by everyone" ON public.employees;
CREATE POLICY "Public employees are viewable by everyone" ON public.employees FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;
CREATE POLICY "Users can update own employee record" ON public.employees FOR UPDATE USING (auth.uid() = id);

-- EOD Reports Policies
DROP POLICY IF EXISTS "Users can view own eod_reports" ON public.eod_reports;
CREATE POLICY "Users can view own eod_reports" ON public.eod_reports FOR SELECT USING (auth.uid() = "employeeId" OR EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND "roleId" IN ('ADMIN', 'MANAGER')));

DROP POLICY IF EXISTS "Users can insert own eod_reports" ON public.eod_reports;
CREATE POLICY "Users can insert own eod_reports" ON public.eod_reports FOR INSERT WITH CHECK (auth.uid() = "employeeId");

-- Projects Policies
DROP POLICY IF EXISTS "Allow authenticated users to select projects" ON public.projects;
CREATE POLICY "Allow authenticated users to select projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');

-- Work Hours Policies
DROP POLICY IF EXISTS "Users can view own work_hours" ON public.work_hours;
CREATE POLICY "Users can view own work_hours" ON public.work_hours FOR SELECT USING (auth.uid() = "employeeId" OR EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND "roleId" IN ('ADMIN', 'MANAGER')));

NOTIFY pgrst, 'reload schema';
