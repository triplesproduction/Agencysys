-- =====================================================================
-- TripleS OS Migration: Notes Feature
-- Filename: 14_notes_table.sql
-- Description: Creates the notes table for personal and project notes
--              with RLS policies for proper access control.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: CREATE NOTES TABLE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL DEFAULT 'Untitled Note',
  content      jsonb,
  "employeeId" uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  "projectId"  uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team')),
  pinned       boolean DEFAULT false,
  color        text DEFAULT NULL,
  "createdAt"  timestamptz DEFAULT now(),
  "updatedAt"  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- STEP 2: PERFORMANCE INDEXES
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notes_employeeId ON public.notes("employeeId");
CREATE INDEX IF NOT EXISTS idx_notes_projectId ON public.notes("projectId");
CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON public.notes("updatedAt" DESC);

-- ---------------------------------------------------------------------
-- STEP 3: ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Own notes + team-visible project notes where user is a member + admin/manager override
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (
  auth.uid() = "employeeId"
  OR (
    visibility = 'team'
    AND "projectId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE "projectId" = notes."projectId" AND "userId" = auth.uid()
    )
  )
  OR public.is_admin_or_manager()
);

-- INSERT: Only own notes
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (
  auth.uid() = "employeeId"
);

-- UPDATE: Only own notes
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (
  auth.uid() = "employeeId"
);

-- DELETE: Only own notes
DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (
  auth.uid() = "employeeId"
);

-- ---------------------------------------------------------------------
-- STEP 4: AUTO-UPDATE updatedAt TRIGGER
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

-- ---------------------------------------------------------------------
-- STEP 5: RELOAD SCHEMA CACHE
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
