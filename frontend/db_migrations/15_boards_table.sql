-- Board Schema for Infinite Collaborative Canvas

CREATE TABLE public.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Untitled Board',
    document JSONB DEFAULT '{"document": {"store": {}}, "session": {}}'::jsonb,
    "projectId" UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    "employeeId" UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_boards_projectId ON public.boards("projectId");
CREATE INDEX idx_boards_employeeId ON public.boards("employeeId");
CREATE INDEX idx_boards_updatedAt ON public.boards("updatedAt" DESC);

-- Enable RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Everyone can view boards they are authorized for (simplification for MVP: all users can view all boards, but we restrict in app layer or strict RLS)
-- For this OS, we assume any team member can view team boards. We'll allow all authenticated employees to view all boards for now, or just their own + project members.
CREATE POLICY "boards_select" ON public.boards FOR SELECT USING (
    auth.uid() = "employeeId"
    OR "projectId" IS NULL -- Public boards? Actually, let's make them all visible for now, or use the project_members logic.
    OR EXISTS (
        SELECT 1 FROM public.project_members WHERE "projectId" = boards."projectId" AND "userId" = auth.uid()
    )
    OR public.is_admin_or_manager()
);

CREATE POLICY "boards_insert" ON public.boards FOR INSERT WITH CHECK (auth.uid() = "employeeId");

-- Anyone with access to the board can update it (for real-time collaboration)
CREATE POLICY "boards_update" ON public.boards FOR UPDATE USING (
    auth.uid() = "employeeId"
    OR EXISTS (
        SELECT 1 FROM public.project_members WHERE "projectId" = boards."projectId" AND "userId" = auth.uid()
    )
    OR public.is_admin_or_manager()
);

CREATE POLICY "boards_delete" ON public.boards FOR DELETE USING (
    auth.uid() = "employeeId"
    OR public.is_admin_or_manager()
);
