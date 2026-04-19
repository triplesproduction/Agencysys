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
