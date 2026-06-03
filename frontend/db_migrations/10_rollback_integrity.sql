-- =====================================================================
-- TripleS OS Migration: Rollback Relational Integrity
-- Filename: 10_rollback_integrity.sql
-- Description: Reverts unifying user/project ID types back to text/original state
--              and restores the original constraints and NO ACTION delete rules.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: DROP DEPENDENT RLS POLICIES & NEW CONSTRAINTS/INDEXES
-- ---------------------------------------------------------------------

-- Drop uuid-compatible RLS policies (public schema)
DROP POLICY IF EXISTS "Users can view related projects" ON public.projects;

-- Drop uuid-compatible storage schema RLS policy
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;

-- Drop all newly created constraints
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS fk_projects_created_by;
ALTER TABLE IF EXISTS public.project_members DROP CONSTRAINT IF EXISTS fk_project_members_project;
ALTER TABLE IF EXISTS public.project_members DROP CONSTRAINT IF EXISTS fk_project_members_user;
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS fk_project_assignments_project;
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS fk_project_assignments_user;
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS fk_project_assignments_assigned_by;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_project;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_assignee;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_creator;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_manager;
ALTER TABLE IF EXISTS public.work_hours DROP CONSTRAINT IF EXISTS fk_work_hours_employee;
ALTER TABLE IF EXISTS public.work_hours DROP CONSTRAINT IF EXISTS fk_work_hours_task;
ALTER TABLE IF EXISTS public.eod_reports DROP CONSTRAINT IF EXISTS fk_eod_reports_employee;
ALTER TABLE IF EXISTS public.leaves DROP CONSTRAINT IF EXISTS fk_leaves_employee;
ALTER TABLE IF EXISTS public.leaves DROP CONSTRAINT IF EXISTS fk_leaves_approver;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS fk_messages_conversation;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS fk_messages_sender;
ALTER TABLE IF EXISTS public.conversation_participants DROP CONSTRAINT IF EXISTS fk_conversation_participants_conversation;
ALTER TABLE IF EXISTS public.conversation_participants DROP CONSTRAINT IF EXISTS fk_conversation_participants_user;
ALTER TABLE IF EXISTS public.typing_status DROP CONSTRAINT IF EXISTS fk_typing_status_conversation;
ALTER TABLE IF EXISTS public.typing_status DROP CONSTRAINT IF EXISTS fk_typing_status_user;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS fk_notifications_user;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS fk_notifications_project;
ALTER TABLE IF EXISTS public.activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_project;
ALTER TABLE IF EXISTS public.activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_user;
ALTER TABLE IF EXISTS public.workflow_history DROP CONSTRAINT IF EXISTS fk_workflow_history_project;
ALTER TABLE IF EXISTS public.workflow_history DROP CONSTRAINT IF EXISTS fk_workflow_history_changed_by;
ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS fk_comments_project;
ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS fk_comments_user;
ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS fk_comments_parent;
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS fk_quotations_project;
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS fk_quotations_created_by;
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS fk_quotations_assigned_to;
ALTER TABLE IF EXISTS public.quotation_versions DROP CONSTRAINT IF EXISTS fk_quotation_versions_quotation;
ALTER TABLE IF EXISTS public.quotation_versions DROP CONSTRAINT IF EXISTS fk_quotation_versions_created_by;
ALTER TABLE IF EXISTS public.pricing_items DROP CONSTRAINT IF EXISTS fk_pricing_items_created_by;
ALTER TABLE IF EXISTS public.kpi_metrics DROP CONSTRAINT IF EXISTS fk_kpi_metrics_employee;
ALTER TABLE IF EXISTS public.kpi_profiles DROP CONSTRAINT IF EXISTS fk_kpi_profiles_employee;
ALTER TABLE IF EXISTS public.kpi_audit_logs DROP CONSTRAINT IF EXISTS fk_kpi_audit_logs_employee;
ALTER TABLE IF EXISTS public.employee_documents DROP CONSTRAINT IF EXISTS fk_employee_documents_employee;
ALTER TABLE IF EXISTS public.salary_history DROP CONSTRAINT IF EXISTS fk_salary_history_employee;
ALTER TABLE IF EXISTS public.payroll_records DROP CONSTRAINT IF EXISTS fk_payroll_records_employee;
ALTER TABLE IF EXISTS public.work_sessions DROP CONSTRAINT IF EXISTS fk_work_sessions_employee;
ALTER TABLE IF EXISTS public.attendance_overrides DROP CONSTRAINT IF EXISTS fk_attendance_overrides_employee;
ALTER TABLE IF EXISTS public.attendance_overrides DROP CONSTRAINT IF EXISTS fk_attendance_overrides_created_by;
ALTER TABLE IF EXISTS public.rules DROP CONSTRAINT IF EXISTS fk_rules_created_by;

-- Drop all newly created indexes
DROP INDEX IF EXISTS public.idx_projects_created_by;
DROP INDEX IF EXISTS public.idx_project_members_projectId;
DROP INDEX IF EXISTS public.idx_project_members_userId;
DROP INDEX IF EXISTS public.idx_project_assignments_project_id;
DROP INDEX IF EXISTS public.idx_project_assignments_user_id;
DROP INDEX IF EXISTS public.idx_tasks_assigneeId;
DROP INDEX IF EXISTS public.idx_tasks_creatorId;
DROP INDEX IF EXISTS public.idx_tasks_managerId;
DROP INDEX IF EXISTS public.idx_tasks_projectId;
DROP INDEX IF EXISTS public.idx_work_hours_employeeId;
DROP INDEX IF EXISTS public.idx_work_hours_taskId;
DROP INDEX IF EXISTS public.idx_work_sessions_employeeId;
DROP INDEX IF EXISTS public.idx_eod_reports_employeeId;
DROP INDEX IF EXISTS public.idx_leaves_employeeId;
DROP INDEX IF EXISTS public.idx_leaves_approverId;
DROP INDEX IF EXISTS public.idx_conversation_participants_conversation_id;
DROP INDEX IF EXISTS public.idx_conversation_participants_user_id;
DROP INDEX IF EXISTS public.idx_messages_conversation_id;
DROP INDEX IF EXISTS public.idx_messages_sender_id;
DROP INDEX IF EXISTS public.idx_typing_status_conversation_id;
DROP INDEX IF EXISTS public.idx_typing_status_user_id;
DROP INDEX IF EXISTS public.idx_activity_logs_project_id;
DROP INDEX IF EXISTS public.idx_activity_logs_user_id;
DROP INDEX IF EXISTS public.idx_workflow_history_project_id;
DROP INDEX IF EXISTS public.idx_workflow_history_changed_by;
DROP INDEX IF EXISTS public.idx_comments_project_id;
DROP INDEX IF EXISTS public.idx_comments_user_id;
DROP INDEX IF EXISTS public.idx_comments_parent_comment_id;
DROP INDEX IF EXISTS public.idx_quotations_project_id;
DROP INDEX IF EXISTS public.idx_quotations_created_by;
DROP INDEX IF EXISTS public.idx_quotations_assigned_to;

-- ---------------------------------------------------------------------
-- STEP 2: REVERT COLUMN TYPES BACK TO TEXT
-- ---------------------------------------------------------------------

-- Revert primary key of projects table
ALTER TABLE public.projects 
  ALTER COLUMN id TYPE text USING id::text;

-- Revert referencing columns in other tables to text
ALTER TABLE public.project_members 
  ALTER COLUMN "projectId" TYPE text USING "projectId"::text;

ALTER TABLE public.tasks 
  ALTER COLUMN "projectId" TYPE text USING "projectId"::text;

ALTER TABLE public.activity_logs 
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE public.comments 
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE public.project_assignments 
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE public.quotations 
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE public.workflow_history 
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE public.notifications
  ALTER COLUMN related_project_id TYPE text USING related_project_id::text;

-- Revert messaging user_id columns from uuid to text
ALTER TABLE public.conversation_participants 
  ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.messages 
  ALTER COLUMN sender_id TYPE text USING sender_id::text;

ALTER TABLE public.typing_status 
  ALTER COLUMN user_id TYPE text USING user_id::text;

-- ---------------------------------------------------------------------
-- STEP 3: RESTORE ORIGINAL CONSTRAINTS (WITH NO ACTION DELETES)
-- ---------------------------------------------------------------------

-- Restoring original references pointing directly to auth.users(id)
ALTER TABLE public.projects
  ADD CONSTRAINT "projects_createdBy_fkey" 
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.project_assignments
  ADD CONSTRAINT project_assignments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  ADD CONSTRAINT project_assignments_assigned_by_fkey 
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id),
  ADD CONSTRAINT project_assignments_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  ADD CONSTRAINT activity_logs_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.workflow_history
  ADD CONSTRAINT workflow_history_changed_by_fkey 
  FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  ADD CONSTRAINT workflow_history_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  ADD CONSTRAINT comments_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id),
  ADD CONSTRAINT comments_parent_comment_id_fkey 
  FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id),
  ADD CONSTRAINT quotations_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  ADD CONSTRAINT quotations_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.quotation_versions
  ADD CONSTRAINT quotation_versions_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id),
  ADD CONSTRAINT quotation_versions_quotation_id_fkey 
  FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;

ALTER TABLE public.pricing_items
  ADD CONSTRAINT pricing_items_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Restoring original references pointing to employees(id) (with NO ACTION rules)
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_projectId_fkey 
  FOREIGN KEY ("projectId") REFERENCES public.projects(id),
  ADD CONSTRAINT project_members_userId_fkey 
  FOREIGN KEY ("userId") REFERENCES public.employees(id);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_projectId_fkey 
  FOREIGN KEY ("projectId") REFERENCES public.projects(id),
  ADD CONSTRAINT "tasks_assigneeId_fkey" 
  FOREIGN KEY ("assigneeId") REFERENCES public.employees(id),
  ADD CONSTRAINT "tasks_creatorId_fkey" 
  FOREIGN KEY ("creatorId") REFERENCES public.employees(id),
  ADD CONSTRAINT "tasks_managerId_fkey" 
  FOREIGN KEY ("managerId") REFERENCES public.employees(id);

ALTER TABLE public.work_hours
  ADD CONSTRAINT "work_hours_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id),
  ADD CONSTRAINT "work_hours_taskId_fkey" 
  FOREIGN KEY ("taskId") REFERENCES public.tasks(id);

ALTER TABLE public.eod_reports
  ADD CONSTRAINT "eod_reports_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id);

ALTER TABLE public.leaves
  ADD CONSTRAINT "leaves_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id),
  ADD CONSTRAINT "leaves_approverId_fkey" 
  FOREIGN KEY ("approverId") REFERENCES public.employees(id);

ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_id_fkey 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);

ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_conversation_id_fkey 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);

ALTER TABLE public.typing_status
  ADD CONSTRAINT typing_status_conversation_id_fkey 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.kpi_metrics
  ADD CONSTRAINT "kpi_metrics_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id);

ALTER TABLE public.kpi_profiles
  ADD CONSTRAINT "kpi_profiles_employee_id_fkey" 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.kpi_audit_logs
  ADD CONSTRAINT "kpi_audit_logs_employee_id_fkey" 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.employee_documents
  ADD CONSTRAINT "employee_documents_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id);

ALTER TABLE public.salary_history
  ADD CONSTRAINT "salary_history_employeeid_fkey" 
  FOREIGN KEY (employeeid) REFERENCES public.employees(id);

ALTER TABLE public.payroll_records
  ADD CONSTRAINT "payroll_records_employeeid_fkey" 
  FOREIGN KEY (employeeid) REFERENCES public.employees(id);

ALTER TABLE public.work_sessions
  ADD CONSTRAINT "work_sessions_employeeId_fkey" 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id);

ALTER TABLE public.attendance_overrides
  ADD CONSTRAINT attendance_overrides_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  ADD CONSTRAINT attendance_overrides_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.employees(id);

ALTER TABLE public.rules
  ADD CONSTRAINT "rules_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES public.employees(id);

-- Restore employees default reference to auth
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_id_fkey;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id);

-- ---------------------------------------------------------------------
-- STEP 4: RE-CREATE ORIGINAL TEXT-COMPATIBLE RLS POLICIES
-- ---------------------------------------------------------------------

-- Public schema
DROP POLICY IF EXISTS "Users can view related projects" ON public.projects;
CREATE POLICY "Users can view related projects" ON public.projects
FOR SELECT USING (
  is_admin_or_manager() OR 
  (auth.uid() = created_by) OR 
  EXISTS (
    SELECT 1 FROM project_members 
    WHERE ((project_members."projectId" = projects.id::text) AND (project_members."userId" = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can view workflow history for related projects" ON public.workflow_history;
CREATE POLICY "Users can view workflow history for related projects" ON public.workflow_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_members 
    WHERE ((project_members."projectId" = workflow_history.project_id) AND (project_members."userId" = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can view activity logs for related projects" ON public.activity_logs;
CREATE POLICY "Users can view activity logs for related projects" ON public.activity_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_members 
    WHERE ((project_members."projectId" = activity_logs.project_id) AND (project_members."userId" = auth.uid()))
  )
);

-- Storage schema (references conversation_participants.user_id as text)
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
CREATE POLICY "Users can view chat media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-media' AND (
    owner = auth.uid() 
    OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id::text = (string_to_array(name, '/'))[2]
      AND user_id = auth.uid()::text
    )
  )
);

-- ---------------------------------------------------------------------
-- STEP 5: RELOAD SCHEMA CACHE
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
