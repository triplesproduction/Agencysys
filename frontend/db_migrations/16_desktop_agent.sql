-- 16_desktop_agent.sql
-- Migration to set up employee monitoring agent tables

-- 1. Create Monitoring Policies Table
CREATE TABLE IF NOT EXISTS monitoring_policies (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "screenshotInterval" integer DEFAULT 5, -- in minutes
  "trackActivity" boolean DEFAULT true,
  "trackApplications" boolean DEFAULT true,
  "trackWebsites" boolean DEFAULT false,
  "createdAt" timestamptz DEFAULT now()
);

-- 2. Add monitoringPolicyId to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS "monitoringPolicyId" uuid REFERENCES monitoring_policies(id) ON DELETE SET NULL;

-- 3. Create Employee Screenshots Table
CREATE TABLE IF NOT EXISTS employee_screenshots (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "sessionId" uuid REFERENCES work_sessions(id) ON DELETE SET NULL,
  "timestamp" timestamptz DEFAULT now(),
  "driveFileId" text,
  "activityPercentage" integer,
  "createdAt" timestamptz DEFAULT now()
);

-- 4. Create Employee Heartbeats Table
CREATE TABLE IF NOT EXISTS employee_heartbeats (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "sessionId" uuid REFERENCES work_sessions(id) ON DELETE SET NULL,
  "timestamp" timestamptz DEFAULT now(),
  "status" text DEFAULT 'ACTIVE',
  "activityPercentage" integer,
  "runningVersion" text,
  "batteryStatus" text,
  "networkStatus" text,
  "createdAt" timestamptz DEFAULT now()
);

-- 5. Create Application Usage Table
CREATE TABLE IF NOT EXISTS application_usage (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "sessionId" uuid REFERENCES work_sessions(id) ON DELETE SET NULL,
  "appName" text NOT NULL,
  "startTime" timestamptz NOT NULL,
  "endTime" timestamptz NOT NULL,
  "durationSeconds" integer NOT NULL,
  "createdAt" timestamptz DEFAULT now()
);

-- 6. Insert Default Monitoring Policies
INSERT INTO monitoring_policies ("name", "screenshotInterval", "trackActivity", "trackApplications", "trackWebsites")
VALUES 
  ('Standard', 5, true, true, false),
  ('Creative Team', 10, true, true, false),
  ('Probation', 5, true, true, false),
  ('Remote Team', 5, true, true, true),
  ('Management', 0, false, false, false)
ON CONFLICT ("name") DO UPDATE 
SET "screenshotInterval" = EXCLUDED."screenshotInterval",
    "trackActivity" = EXCLUDED."trackActivity",
    "trackApplications" = EXCLUDED."trackApplications",
    "trackWebsites" = EXCLUDED."trackWebsites";

-- 7. Enable RLS on new tables
ALTER TABLE monitoring_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_usage ENABLE ROW LEVEL SECURITY;

-- 8. Add Security Policies (Allow authenticated users)
CREATE POLICY "Allow authenticated users to manage monitoring_policies" 
ON monitoring_policies FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage employee_screenshots" 
ON employee_screenshots FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage employee_heartbeats" 
ON employee_heartbeats FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage application_usage" 
ON application_usage FOR ALL USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
