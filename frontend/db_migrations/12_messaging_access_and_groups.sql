-- =====================================================================
-- TripleS OS Migration: Phase 4 — Messaging Access Control & Group Architecture
-- Filename: 12_messaging_access_and_groups.sql
-- Description: Sets up group channels (Company, Department, Project),
--              implements DM access rules, triggers auto-membership,
--              and configures secure RLS policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: ALTER TABLES AND ADD UNIQUE CONSTRAINTS
-- ---------------------------------------------------------------------

-- Alter conversations table to support groups
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL CHECK (type IN ('DIRECT', 'DEPARTMENT', 'PROJECT', 'COMPANY')) DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Alter conversation_participants table to support roles and joined timestamps
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL CHECK (role IN ('MEMBER', 'ADMIN')) DEFAULT 'MEMBER',
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint on participants to prevent double-insertions
ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS unique_conversation_user,
  ADD CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id);

-- ---------------------------------------------------------------------
-- STEP 2: CREATE HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Check if two users are allowed to DM each other
CREATE OR REPLACE FUNCTION public.can_message(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_a_role TEXT;
    user_b_role TEXT;
    user_a_dept TEXT;
    user_b_dept TEXT;
    has_common_project BOOLEAN;
BEGIN
    -- Self-communication is allowed
    IF user_a = user_b THEN
        RETURN TRUE;
    END IF;

    -- Fetch role and department details
    SELECT roleId, department INTO user_a_role, user_a_dept FROM public.employees WHERE id = user_a;
    SELECT roleId, department INTO user_b_role, user_b_dept FROM public.employees WHERE id = user_b;

    -- Rule 2: One of them is Admin
    IF UPPER(user_a_role) = 'ADMIN' OR UPPER(user_b_role) = 'ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Rule 3: One of them belongs to Operations
    IF UPPER(user_a_dept) = 'OPERATIONS TEAM' OR UPPER(user_a_dept) = 'OPERATIONS'
       OR UPPER(user_b_dept) = 'OPERATIONS TEAM' OR UPPER(user_b_dept) = 'OPERATIONS' THEN
        RETURN TRUE;
    END IF;

    -- Rule 1: Both belong to the same department
    IF user_a_dept IS NOT NULL AND user_b_dept IS NOT NULL AND user_a_dept = user_b_dept THEN
        RETURN TRUE;
    END IF;

    -- Rule 4: Share a project in public.project_members
    SELECT EXISTS (
        SELECT 1 
        FROM public.project_members pm1
        JOIN public.project_members pm2 ON pm1."projectId" = pm2."projectId"
        WHERE pm1."userId" = user_a AND pm2."userId" = user_b
    ) INTO has_common_project;

    IF has_common_project THEN
        RETURN TRUE;
    END IF;

    -- Rule 4 (Alternative): Share a PROJECT type conversation group
    SELECT EXISTS (
        SELECT 1
        FROM public.conversation_participants cp1
        JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        JOIN public.conversations c ON cp1.conversation_id = c.id
        WHERE cp1.user_id = user_a AND cp2.user_id = user_b AND c.type = 'PROJECT'
    ) INTO has_common_project;

    RETURN has_common_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fetch list of employees authorized for direct message with a user
CREATE OR REPLACE FUNCTION public.get_messageable_contacts(my_id UUID)
RETURNS SETOF public.employees AS $$
DECLARE
    my_dept TEXT;
    my_role TEXT;
BEGIN
    SELECT department, roleId INTO my_dept, my_role FROM public.employees WHERE id = my_id;

    -- Admins and Operations can message anyone
    IF UPPER(my_role) = 'ADMIN' OR UPPER(my_dept) = 'OPERATIONS TEAM' OR UPPER(my_dept) = 'OPERATIONS' THEN
        RETURN QUERY SELECT * FROM public.employees WHERE id != my_id;
        RETURN;
    END IF;

    -- Normal employees filtered by DM rules
    RETURN QUERY
    SELECT DISTINCT e.*
    FROM public.employees e
    WHERE e.id != my_id
      AND (
        (e.department IS NOT NULL AND my_dept IS NOT NULL AND e.department = my_dept)
        OR UPPER(e.roleId) = 'ADMIN'
        OR UPPER(e.department) = 'OPERATIONS TEAM' OR UPPER(e.department) = 'OPERATIONS'
        OR EXISTS (
            SELECT 1 
            FROM public.project_members pm1
            JOIN public.project_members pm2 ON pm1."projectId" = pm2."projectId"
            WHERE pm1."userId" = my_id AND pm2."userId" = e.id
        )
        OR EXISTS (
            SELECT 1
            FROM public.conversation_participants cp1
            JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            JOIN public.conversations c ON cp1.conversation_id = c.id
            WHERE cp1.user_id = my_id AND cp2.user_id = e.id AND c.type = 'PROJECT'
        )
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- STEP 3: CREATE TRIGGERS FOR AUTOMATIC GROUP MEMBERSHIPS
-- ---------------------------------------------------------------------

-- Sync Company & Department memberships on employee inserts/updates
CREATE OR REPLACE FUNCTION public.sync_employee_groups()
RETURNS TRIGGER AS $$
DECLARE
    dept_conv_id UUID;
    company_conv_id UUID;
    ops_conv_id UUID;
BEGIN
    -- 1. Sync Company Announcements Group
    SELECT id INTO company_conv_id FROM public.conversations WHERE type = 'COMPANY' LIMIT 1;
    IF company_conv_id IS NULL THEN
        company_conv_id := gen_random_uuid();
        INSERT INTO public.conversations (id, type, name)
        VALUES (company_conv_id, 'COMPANY', 'Company Announcements');
    END IF;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (company_conv_id, NEW.id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- 2. Sync Operations Group (All employees must see Operations group)
    SELECT id INTO ops_conv_id FROM public.conversations 
    WHERE type = 'DEPARTMENT' AND department = 'Operations' LIMIT 1;
    IF ops_conv_id IS NULL THEN
        ops_conv_id := gen_random_uuid();
        INSERT INTO public.conversations (id, type, name, department)
        VALUES (ops_conv_id, 'DEPARTMENT', 'Operations Group', 'Operations');
    END IF;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (ops_conv_id, NEW.id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- 3. Sync Personal Department Group
    -- Remove from old department group if it changed
    IF (TG_OP = 'UPDATE' AND OLD.department IS DISTINCT FROM NEW.department AND OLD.department IS NOT NULL) THEN
        SELECT id INTO dept_conv_id FROM public.conversations 
        WHERE type = 'DEPARTMENT' AND department = OLD.department LIMIT 1;
        
        IF dept_conv_id IS NOT NULL THEN
            DELETE FROM public.conversation_participants 
            WHERE conversation_id = dept_conv_id AND user_id = NEW.id;
        END IF;
    END IF;

    -- Add to new department group
    IF NEW.department IS NOT NULL AND NEW.department != 'General' AND NEW.department != 'Operations' THEN
        SELECT id INTO dept_conv_id FROM public.conversations 
        WHERE type = 'DEPARTMENT' AND department = NEW.department LIMIT 1;
        
        IF dept_conv_id IS NULL THEN
            dept_conv_id := gen_random_uuid();
            INSERT INTO public.conversations (id, type, name, department)
            VALUES (dept_conv_id, 'DEPARTMENT', NEW.department || ' Group', NEW.department);
        END IF;

        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (dept_conv_id, NEW.id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_employee_groups ON public.employees;
CREATE TRIGGER trigger_sync_employee_groups
AFTER INSERT OR UPDATE OF department ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_groups();

-- Sync Project group memberships automatically with project_members table
CREATE OR REPLACE FUNCTION public.sync_project_members()
RETURNS TRIGGER AS $$
DECLARE
    project_conv_id UUID;
BEGIN
    SELECT id INTO project_conv_id FROM public.conversations 
    WHERE type = 'PROJECT' AND project_id = NEW."projectId" AND status = 'ACTIVE' LIMIT 1;

    IF project_conv_id IS NOT NULL THEN
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (project_conv_id, NEW."userId")
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_project_members_delete()
RETURNS TRIGGER AS $$
DECLARE
    project_conv_id UUID;
BEGIN
    SELECT id INTO project_conv_id FROM public.conversations 
    WHERE type = 'PROJECT' AND project_id = OLD."projectId" AND status = 'ACTIVE' LIMIT 1;

    IF project_conv_id IS NOT NULL THEN
        DELETE FROM public.conversation_participants 
        WHERE conversation_id = project_conv_id AND user_id = OLD."userId";
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_project_members ON public.project_members;
CREATE TRIGGER trigger_sync_project_members
AFTER INSERT ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_members();

DROP TRIGGER IF EXISTS trigger_sync_project_members_delete ON public.project_members;
CREATE TRIGGER trigger_sync_project_members_delete
AFTER DELETE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_members_delete();

-- ---------------------------------------------------------------------
-- STEP 4: BACKFILL DATA FOR EXISTING USERS & DEPARTMENTS
-- ---------------------------------------------------------------------

DO $$
DECLARE
    company_conv_id UUID := gen_random_uuid();
    ops_conv_id UUID := gen_random_uuid();
    dept_conv_id UUID;
    emp RECORD;
BEGIN
    -- 1. Backfill Company Announcements
    IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE type = 'COMPANY') THEN
        INSERT INTO public.conversations (id, type, name)
        VALUES (company_conv_id, 'COMPANY', 'Company Announcements');
    ELSE
        SELECT id INTO company_conv_id FROM public.conversations WHERE type = 'COMPANY' LIMIT 1;
    END IF;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT company_conv_id, id
    FROM public.employees
    WHERE status = 'ACTIVE'
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- 2. Backfill Operations Group
    IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE type = 'DEPARTMENT' AND department = 'Operations') THEN
        INSERT INTO public.conversations (id, type, name, department)
        VALUES (ops_conv_id, 'DEPARTMENT', 'Operations Group', 'Operations');
    ELSE
        SELECT id INTO ops_conv_id FROM public.conversations WHERE type = 'DEPARTMENT' AND department = 'Operations' LIMIT 1;
    END IF;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT ops_conv_id, id
    FROM public.employees
    WHERE status = 'ACTIVE'
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- 3. Backfill Personal Department Groups
    FOR emp IN SELECT DISTINCT department FROM public.employees WHERE department IS NOT NULL AND department != 'General' AND department != 'Operations' LOOP
        SELECT id INTO dept_conv_id FROM public.conversations 
        WHERE type = 'DEPARTMENT' AND department = emp.department LIMIT 1;
        
        IF dept_conv_id IS NULL THEN
            dept_conv_id := gen_random_uuid();
            INSERT INTO public.conversations (id, type, name, department)
            VALUES (dept_conv_id, 'DEPARTMENT', emp.department || ' Group', emp.department);
        END IF;
        
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        SELECT dept_conv_id, id
        FROM public.employees
        WHERE department = emp.department AND status = 'ACTIVE'
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- STEP 5: ROW LEVEL SECURITY POLICIES
-- ---------------------------------------------------------------------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS
DROP POLICY IF EXISTS "Allow users to view conversations they participate in" ON public.conversations;
CREATE POLICY "Allow users to view conversations they participate in" 
ON public.conversations FOR SELECT USING (
  public.is_admin_or_manager() OR
  type = 'COMPANY' OR
  (type = 'DEPARTMENT' AND (department = (SELECT department FROM public.employees WHERE id = auth.uid()) OR department = 'Operations')) OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = public.conversations.id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow insertion of conversations" ON public.conversations;
CREATE POLICY "Allow insertion of conversations" 
ON public.conversations FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR
  (type = 'DIRECT' AND status = 'ACTIVE')
);

DROP POLICY IF EXISTS "Allow updating of conversations" ON public.conversations;
CREATE POLICY "Allow updating of conversations" 
ON public.conversations FOR UPDATE USING (
  public.is_admin_or_manager()
);

-- Conversation Participants RLS
DROP POLICY IF EXISTS "Allow users to view conversation participants" ON public.conversation_participants;
CREATE POLICY "Allow users to view conversation participants"
ON public.conversation_participants FOR SELECT USING (
  public.is_admin_or_manager() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_participants.conversation_id
  )
);

DROP POLICY IF EXISTS "Allow participant additions" ON public.conversation_participants;
CREATE POLICY "Allow participant additions"
ON public.conversation_participants FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR
  (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'DIRECT'
    ) AND public.can_message(auth.uid(), user_id)
  )
);

DROP POLICY IF EXISTS "Allow participant removal" ON public.conversation_participants;
CREATE POLICY "Allow participant removal"
ON public.conversation_participants FOR DELETE USING (
  public.is_admin_or_manager() OR
  user_id = auth.uid()
);

-- Messages RLS
DROP POLICY IF EXISTS "Allow users to view messages in accessible conversations" ON public.messages;
CREATE POLICY "Allow users to view messages in accessible conversations"
ON public.messages FOR SELECT USING (
  public.is_admin_or_manager() OR
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = messages.conversation_id
  )
);

DROP POLICY IF EXISTS "Allow members to send messages to active conversations" ON public.messages;
CREATE POLICY "Allow members to send messages to active conversations"
ON public.messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id 
      AND c.status = 'ACTIVE'
      AND (
        public.is_admin_or_manager() OR 
        (c.type != 'COMPANY' AND EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
        ))
      )
  )
);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
