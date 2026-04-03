-- Senior Supabase + PostgreSQL Architect Fix - AUTH RELAXATION
-- --------------------------------------------------
-- 🎯 OBJECTIVE: Fix auth mismatch (employeeId vs auth.uid)
-- 🔓 POLICY: Standardize all RLS to simple authenticated check

BEGIN;

-- 1. DEFINE HELPER FUNCTION TO RESET POLICIES
CREATE OR REPLACE FUNCTION public.reset_and_relax_rls(target_table text)
RETURNS void AS $$
BEGIN
    -- Enable RLS (Safety first)
    EXECUTE 'ALTER TABLE ' || target_table || ' ENABLE ROW LEVEL SECURITY';
    
    -- Drop ALL existing policies to ensure a clean slate
    -- We use a loop in PL/pgSQL to drop everything for that table
    DECLARE
        pol record;
    BEGIN
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = target_table) LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON ' || target_table;
        END LOOP;
    END;
    
    -- Create the new relaxed policy
    EXECUTE 'CREATE POLICY "Allow authenticated access" ON ' || target_table || 
            ' FOR ALL USING (auth.role() = ''authenticated'');';
END;
$$ LANGUAGE plpgsql;

-- 2. APPLY TO ALL TABLES
SELECT reset_and_relax_rls('employees');
SELECT reset_and_relax_rls('tasks');
SELECT reset_and_relax_rls('eod_reports');
SELECT reset_and_relax_rls('leaves');
SELECT reset_and_relax_rls('work_hours');
SELECT reset_and_relax_rls('kpi_profiles');
SELECT reset_and_relax_rls('kpi_audit_logs');
SELECT reset_and_relax_rls('rules');
SELECT reset_and_relax_rls('announcements');
SELECT reset_and_relax_rls('notifications');
SELECT reset_and_relax_rls('messages');

-- 3. ENSURE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_eod_reports_report_date ON eod_reports("reportDate");
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(createdAt);

COMMIT;
