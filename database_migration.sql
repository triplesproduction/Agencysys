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
