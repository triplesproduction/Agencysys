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
CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);

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

-- 6. Disable RLS for testing to bypass permission issues
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
