-- =====================================================================
-- TripleS OS Migration: Phase 3 — Database Relational Integrity
-- Filename: 09_database_relational_integrity.sql
-- Description: Unifies user/project ID types to UUID, establishes 
--              correct ON DELETE CASCADE/SET NULL rules, and adds
--              missing performance indexes on all foreign keys.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: DROP DEPENDENT RLS POLICIES & FOREIGN KEY CONSTRAINTS
-- ---------------------------------------------------------------------

-- Drop dependent public schema RLS policies
DROP POLICY IF EXISTS "Users can view related projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view workflow history for related projects" ON public.workflow_history;
DROP POLICY IF EXISTS "Users can view activity logs for related projects" ON public.activity_logs;

-- Drop dependent storage schema RLS policy (references conversation_participants.user_id)
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;

-- Drop constraints referencing projects(id)
ALTER TABLE IF EXISTS public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_project_id_fkey;
ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS comments_project_id_fkey;
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_project_id_fkey;
ALTER TABLE IF EXISTS public.project_members DROP CONSTRAINT IF EXISTS "project_members_projectId_fkey";
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS quotations_project_id_fkey;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS "tasks_projectId_fkey";
ALTER TABLE IF EXISTS public.workflow_history DROP CONSTRAINT IF EXISTS workflow_history_project_id_fkey;

-- Drop constraints referencing auth.users(id) / employees(id) on user columns
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS "projects_createdBy_fkey";
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_user_id_fkey;
ALTER TABLE IF EXISTS public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_assigned_by_fkey;
ALTER TABLE IF EXISTS public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE IF EXISTS public.workflow_history DROP CONSTRAINT IF EXISTS workflow_history_changed_by_fkey;
ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS quotations_created_by_fkey;
ALTER TABLE IF EXISTS public.quotations DROP CONSTRAINT IF EXISTS quotations_assigned_to_fkey;
ALTER TABLE IF EXISTS public.quotation_versions DROP CONSTRAINT IF EXISTS quotation_versions_created_by_fkey;
ALTER TABLE IF EXISTS public.pricing_items DROP CONSTRAINT IF EXISTS pricing_items_created_by_fkey;
ALTER TABLE IF EXISTS public.project_members DROP CONSTRAINT IF EXISTS "project_members_userId_fkey";
ALTER TABLE IF EXISTS public.project_members DROP CONSTRAINT IF EXISTS fk_project_members_user;

-- Drop constraints with NO ACTION delete rules that need to be updated to CASCADE/SET NULL
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS "tasks_assigneeId_fkey";
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS "tasks_creatorId_fkey";
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS "tasks_managerId_fkey";
ALTER TABLE IF EXISTS public.eod_reports DROP CONSTRAINT IF EXISTS "eod_reports_employeeId_fkey";
ALTER TABLE IF EXISTS public.leaves DROP CONSTRAINT IF EXISTS "leaves_employeeId_fkey";
ALTER TABLE IF EXISTS public.leaves DROP CONSTRAINT IF EXISTS "leaves_approverId_fkey";
ALTER TABLE IF EXISTS public.kpi_metrics DROP CONSTRAINT IF EXISTS "kpi_metrics_employeeId_fkey";
ALTER TABLE IF EXISTS public.work_hours DROP CONSTRAINT IF EXISTS "work_hours_employeeId_fkey";
ALTER TABLE IF EXISTS public.work_hours DROP CONSTRAINT IF EXISTS "work_hours_taskId_fkey";
ALTER TABLE IF EXISTS public.rules DROP CONSTRAINT IF EXISTS "rules_createdBy_fkey";
ALTER TABLE IF EXISTS public.kpi_profiles DROP CONSTRAINT IF EXISTS "kpi_profiles_employee_id_fkey";
ALTER TABLE IF EXISTS public.kpi_audit_logs DROP CONSTRAINT IF EXISTS "kpi_audit_logs_employee_id_fkey";
ALTER TABLE IF EXISTS public.employee_documents DROP CONSTRAINT IF EXISTS "employee_documents_employeeId_fkey";
ALTER TABLE IF EXISTS public.salary_history DROP CONSTRAINT IF EXISTS "salary_history_employeeid_fkey";
ALTER TABLE IF EXISTS public.payroll_records DROP CONSTRAINT IF EXISTS "payroll_records_employeeid_fkey";
ALTER TABLE IF EXISTS public.work_sessions DROP CONSTRAINT IF EXISTS "work_sessions_employeeId_fkey";
ALTER TABLE IF EXISTS public.attendance_overrides DROP CONSTRAINT IF EXISTS attendance_overrides_employee_id_fkey;
ALTER TABLE IF EXISTS public.attendance_overrides DROP CONSTRAINT IF EXISTS attendance_overrides_created_by_fkey;

-- Drop chat-related constraints for column alteration
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE IF EXISTS public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey;
ALTER TABLE IF EXISTS public.typing_status DROP CONSTRAINT IF EXISTS typing_status_conversation_id_fkey;

-- ---------------------------------------------------------------------
-- STEP 2: CONVERT COLUMN TYPES FROM TEXT TO UUID
-- ---------------------------------------------------------------------

-- Alter primary key of projects table
ALTER TABLE public.projects 
  ALTER COLUMN id TYPE uuid USING id::uuid;

-- Alter referencing columns in other tables to uuid
ALTER TABLE public.project_members 
  ALTER COLUMN "projectId" TYPE uuid USING "projectId"::uuid;

ALTER TABLE public.tasks 
  ALTER COLUMN "projectId" TYPE uuid USING "projectId"::uuid;

ALTER TABLE public.activity_logs 
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.comments 
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.project_assignments 
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.quotations 
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.workflow_history 
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.notifications
  ALTER COLUMN related_project_id TYPE uuid USING related_project_id::uuid;

-- Alter messaging user_id columns from text to uuid
ALTER TABLE public.conversation_participants 
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Alter sender_id column from text to uuid
ALTER TABLE public.messages 
  ALTER COLUMN sender_id TYPE uuid USING sender_id::uuid;

-- Alter user_id column from text to uuid in typing_status
ALTER TABLE public.typing_status 
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- ---------------------------------------------------------------------
-- STEP 3: RE-APPLY SECURE, NORMALIZED FOREIGN KEY CONSTRAINTS
-- ---------------------------------------------------------------------

-- 1. Projects Table
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS fk_projects_created_by,
  ADD CONSTRAINT fk_projects_created_by 
  FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Project Members Table
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS fk_project_members_project,
  ADD CONSTRAINT fk_project_members_project 
  FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_project_members_user,
  ADD CONSTRAINT fk_project_members_user 
  FOREIGN KEY ("userId") REFERENCES public.employees(id) ON DELETE CASCADE;

-- 3. Project Assignments Table
ALTER TABLE public.project_assignments
  DROP CONSTRAINT IF EXISTS fk_project_assignments_project,
  ADD CONSTRAINT fk_project_assignments_project 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_project_assignments_user,
  ADD CONSTRAINT fk_project_assignments_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_project_assignments_assigned_by,
  ADD CONSTRAINT fk_project_assignments_assigned_by 
  FOREIGN KEY (assigned_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 4. Tasks Table
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_project,
  ADD CONSTRAINT fk_tasks_project 
  FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_tasks_assignee,
  ADD CONSTRAINT fk_tasks_assignee 
  FOREIGN KEY ("assigneeId") REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_creator,
  ADD CONSTRAINT fk_tasks_creator 
  FOREIGN KEY ("creatorId") REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_manager,
  ADD CONSTRAINT fk_tasks_manager 
  FOREIGN KEY ("managerId") REFERENCES public.employees(id) ON DELETE SET NULL;

-- 5. Work Hours Table
ALTER TABLE public.work_hours
  DROP CONSTRAINT IF EXISTS fk_work_hours_employee,
  ADD CONSTRAINT fk_work_hours_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_work_hours_task,
  ADD CONSTRAINT fk_work_hours_task 
  FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;

-- 6. EOD Reports Table
ALTER TABLE public.eod_reports
  DROP CONSTRAINT IF EXISTS fk_eod_reports_employee,
  ADD CONSTRAINT fk_eod_reports_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE;

-- 7. Leaves Table
ALTER TABLE public.leaves
  DROP CONSTRAINT IF EXISTS fk_leaves_employee,
  ADD CONSTRAINT fk_leaves_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_leaves_approver,
  ADD CONSTRAINT fk_leaves_approver 
  FOREIGN KEY ("approverId") REFERENCES public.employees(id) ON DELETE SET NULL;

-- 8. Messages Table
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS fk_messages_conversation,
  ADD CONSTRAINT fk_messages_conversation 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_messages_sender,
  ADD CONSTRAINT fk_messages_sender 
  FOREIGN KEY (sender_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- 9. Conversation Participants Table
ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS fk_conversation_participants_conversation,
  ADD CONSTRAINT fk_conversation_participants_conversation 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_conversation_participants_user,
  ADD CONSTRAINT fk_conversation_participants_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- 10. Typing Status Table
ALTER TABLE public.typing_status
  DROP CONSTRAINT IF EXISTS fk_typing_status_conversation,
  ADD CONSTRAINT fk_typing_status_conversation 
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_typing_status_user,
  ADD CONSTRAINT fk_typing_status_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- 11. Notifications Table
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS fk_notifications_user,
  ADD CONSTRAINT fk_notifications_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_notifications_project,
  ADD CONSTRAINT fk_notifications_project 
  FOREIGN KEY (related_project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 12. Activity Logs Table
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS fk_activity_logs_project,
  ADD CONSTRAINT fk_activity_logs_project 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_activity_logs_user,
  ADD CONSTRAINT fk_activity_logs_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 13. Workflow History Table
ALTER TABLE public.workflow_history
  DROP CONSTRAINT IF EXISTS fk_workflow_history_project,
  ADD CONSTRAINT fk_workflow_history_project 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_workflow_history_changed_by,
  ADD CONSTRAINT fk_workflow_history_changed_by 
  FOREIGN KEY (changed_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 14. Comments Table
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS fk_comments_project,
  ADD CONSTRAINT fk_comments_project 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_comments_user,
  ADD CONSTRAINT fk_comments_user 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS fk_comments_parent,
  ADD CONSTRAINT fk_comments_parent 
  FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;

-- 15. Quotations Table
ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS fk_quotations_project,
  ADD CONSTRAINT fk_quotations_project 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_quotations_created_by,
  ADD CONSTRAINT fk_quotations_created_by 
  FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS fk_quotations_assigned_to,
  ADD CONSTRAINT fk_quotations_assigned_to 
  FOREIGN KEY (assigned_to) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 16. Quotation Versions Table
ALTER TABLE public.quotation_versions
  DROP CONSTRAINT IF EXISTS fk_quotation_versions_quotation,
  ADD CONSTRAINT fk_quotation_versions_quotation 
  FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_quotation_versions_created_by,
  ADD CONSTRAINT fk_quotation_versions_created_by 
  FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 17. Pricing Items Table
ALTER TABLE public.pricing_items
  DROP CONSTRAINT IF EXISTS fk_pricing_items_created_by,
  ADD CONSTRAINT fk_pricing_items_created_by 
  FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 18. Remaining employee relations (NO ACTION -> CASCADE)
ALTER TABLE public.kpi_metrics
  DROP CONSTRAINT IF EXISTS fk_kpi_metrics_employee,
  ADD CONSTRAINT fk_kpi_metrics_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.kpi_profiles
  DROP CONSTRAINT IF EXISTS fk_kpi_profiles_employee,
  ADD CONSTRAINT fk_kpi_profiles_employee 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.kpi_audit_logs
  DROP CONSTRAINT IF EXISTS fk_kpi_audit_logs_employee,
  ADD CONSTRAINT fk_kpi_audit_logs_employee 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_documents
  DROP CONSTRAINT IF EXISTS fk_employee_documents_employee,
  ADD CONSTRAINT fk_employee_documents_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.salary_history
  DROP CONSTRAINT IF EXISTS fk_salary_history_employee,
  ADD CONSTRAINT fk_salary_history_employee 
  FOREIGN KEY (employeeid) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_records
  DROP CONSTRAINT IF EXISTS fk_payroll_records_employee,
  ADD CONSTRAINT fk_payroll_records_employee 
  FOREIGN KEY (employeeid) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.work_sessions
  DROP CONSTRAINT IF EXISTS fk_work_sessions_employee,
  ADD CONSTRAINT fk_work_sessions_employee 
  FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.attendance_overrides
  DROP CONSTRAINT IF EXISTS fk_attendance_overrides_employee,
  ADD CONSTRAINT fk_attendance_overrides_employee 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS fk_attendance_overrides_created_by,
  ADD CONSTRAINT fk_attendance_overrides_created_by 
  FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS fk_rules_created_by,
  ADD CONSTRAINT fk_rules_created_by 
  FOREIGN KEY ("createdBy") REFERENCES public.employees(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- STEP 4: RE-CREATE DEPENDENT RLS POLICIES & INDEXES
-- ---------------------------------------------------------------------

-- Re-create public schema RLS policies with exact UUID-compatible definitions
DROP POLICY IF EXISTS "Users can view related projects" ON public.projects;
CREATE POLICY "Users can view related projects" ON public.projects
FOR SELECT USING (
  public.is_admin_or_manager() OR
  (auth.uid() = created_by) OR
  EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE "projectId" = public.projects.id AND "userId" = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view workflow history for related projects" ON public.workflow_history;
CREATE POLICY "Users can view workflow history for related projects" ON public.workflow_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE "projectId" = public.workflow_history.project_id AND "userId" = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view activity logs for related projects" ON public.activity_logs;
CREATE POLICY "Users can view activity logs for related projects" ON public.activity_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE "projectId" = public.activity_logs.project_id AND "userId" = auth.uid()
  )
);

-- Re-create storage schema RLS policy (optimized for user_id as uuid)
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
CREATE POLICY "Users can view chat media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-media' AND (
    owner = auth.uid() 
    OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id::text = (string_to_array(name, '/'))[2]
      AND user_id = auth.uid()
    )
  )
);

-- Projects performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_members_projectId ON public.project_members("projectId");
CREATE INDEX IF NOT EXISTS idx_project_members_userId ON public.project_members("userId");
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON public.project_assignments(user_id);

-- Tasks performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigneeId ON public.tasks("assigneeId");
CREATE INDEX IF NOT EXISTS idx_tasks_creatorId ON public.tasks("creatorId");
CREATE INDEX IF NOT EXISTS idx_tasks_managerId ON public.tasks("managerId");
CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON public.tasks("projectId");

-- Work Hours & Sessions
CREATE INDEX IF NOT EXISTS idx_work_hours_employeeId ON public.work_hours("employeeId");
CREATE INDEX IF NOT EXISTS idx_work_hours_taskId ON public.work_hours("taskId");
CREATE INDEX IF NOT EXISTS idx_work_sessions_employeeId ON public.work_sessions("employeeId");

-- EOD & Leaves
CREATE INDEX IF NOT EXISTS idx_eod_reports_employeeId ON public.eod_reports("employeeId");
CREATE INDEX IF NOT EXISTS idx_leaves_employeeId ON public.leaves("employeeId");
CREATE INDEX IF NOT EXISTS idx_leaves_approverId ON public.leaves("approverId");

-- Messaging performance indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation_id ON public.typing_status(conversation_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_user_id ON public.typing_status(user_id);

-- Other system components
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_project_id ON public.workflow_history(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_changed_by ON public.workflow_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON public.comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON public.quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON public.quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_assigned_to ON public.quotations(assigned_to);

-- ---------------------------------------------------------------------
-- STEP 5: RELOAD SCHEMA CACHE
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
