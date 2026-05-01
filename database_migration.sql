-- RUN THESE COMMANDS IN YOUR SUPABASE SQL EDITOR TO FIX MULTI-ASSIGNEE BUGS AND ENABLE PERSISTENT STORAGE
-- ------------------------------------------------------------------------------------------------------

-- 1. Add support for multiple assignees on tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS "assigneeIds" uuid[] DEFAULT '{}';

-- 2. Add creator tracking (Required for task allocation logs)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS "creatorId" uuid REFERENCES auth.users(id);

-- 3. (Optional) Enhance performance with an index on assigneeIds
CREATE INDEX IF NOT EXISTS tasks_assignee_ids_idx ON tasks USING GIN ("assigneeIds");

-- 4. Enable Real-time for tasks to see members join instantly
-- Navigate to Database -> Replication in Supabase Dashboard and enable 'tasks' table.

-- =====================================================================
-- MESSAGING PERFORMANCE INDEXES (Fix 7)
-- Run these in Supabase SQL Editor to make chat loading instant
-- =====================================================================

-- Index on conversation_id for fast message fetching per chat
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages (conversation_id);

-- Index on created_at for fast chronological ordering
CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages (created_at);

-- Composite index: conversation + time (optimal for paginated chat queries)
CREATE INDEX IF NOT EXISTS idx_messages_conv_id_created_at
    ON messages (conversation_id, created_at ASC);

-- Index on sender_id for fast unread count queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
    ON messages (sender_id);

-- Notify PostgREST to reload schema cache after any schema changes
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- PROJECTS MANAGEMENT SYSTEM
-- =====================================================================

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "status" text DEFAULT 'PLANNING',
  "priority" text,
  "startDate" date,
  "deadline" date,
  "createdBy" uuid,
  "createdAt" timestamptz DEFAULT now()
);

-- 2. Create Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid REFERENCES projects(id) ON DELETE CASCADE,
  "userId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "role" text DEFAULT 'MEMBER'
);

-- 3. Modify Tasks Table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS "projectId" uuid REFERENCES projects(id) ON DELETE SET NULL;

-- 4. Add Index for Performance
CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks("projectId");

-- 5. IMPORTANT: Add Foreign Key for project members to employees join
-- This ensures API joins work correctly
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_user') THEN
        ALTER TABLE project_members 
        ADD CONSTRAINT fk_project_members_user 
        FOREIGN KEY ("userId") REFERENCES employees(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Re-enable RLS and add basic policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to select projects" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert projects" ON projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update projects" ON projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to delete projects" ON projects FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to select project_members" ON project_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert project_members" ON project_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update project_members" ON project_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to delete project_members" ON project_members FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================================
-- WORK SESSIONS (WorkClock tracking)
-- =====================================================================
CREATE TABLE IF NOT EXISTS work_sessions (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "startTime" timestamptz DEFAULT now(),
  "endTime" timestamptz,
  "status" text DEFAULT 'ACTIVE',
  "createdAt" timestamptz DEFAULT now()
);

ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated to manage work_sessions" ON work_sessions FOR ALL USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
