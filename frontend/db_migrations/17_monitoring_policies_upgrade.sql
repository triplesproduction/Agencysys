-- 17_monitoring_policies_upgrade.sql
-- Upgrade monitoring policies, device registrations, and screenshot metadata tables

-- 1. Upgrade Monitoring Policies Table
ALTER TABLE monitoring_policies 
ADD COLUMN IF NOT EXISTS "screenshotQuality" integer DEFAULT 80,
ADD COLUMN IF NOT EXISTS "idleTimeout" integer DEFAULT 5, -- in minutes
ADD COLUMN IF NOT EXISTS "multiMonitorCapture" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "autoClockOut" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "manualPausePermission" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "weekendTracking" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "workingHoursSchedule" jsonb DEFAULT '{}';

-- 2. Create Device Registrations Table
CREATE TABLE IF NOT EXISTS device_registrations (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" uuid REFERENCES employees(id) ON DELETE CASCADE,
  "deviceId" text NOT NULL UNIQUE,
  "deviceName" text,
  "operatingSystem" text,
  "version" text,
  "firstLogin" timestamptz DEFAULT now(),
  "lastSeen" timestamptz DEFAULT now(),
  "isTrusted" boolean DEFAULT true
);

-- 3. Upgrade Screenshots Table
ALTER TABLE employee_screenshots 
ADD COLUMN IF NOT EXISTS "sha256Hash" text;

-- 4. Insert / Update Default Policies with upgraded settings
INSERT INTO monitoring_policies ("name", "screenshotInterval", "screenshotQuality", "idleTimeout", "trackActivity", "trackApplications", "trackWebsites", "multiMonitorCapture", "autoClockOut", "manualPausePermission", "weekendTracking")
VALUES 
  ('Standard', 5, 80, 5, true, true, false, false, false, false, false),
  ('Creative Team', 10, 85, 10, true, true, false, true, false, true, false),
  ('Probation', 5, 80, 3, true, true, false, false, true, false, false),
  ('Remote Team', 5, 80, 5, true, true, true, false, false, false, true),
  ('Management', 0, 0, 15, false, false, false, false, false, true, true)
ON CONFLICT ("name") DO UPDATE 
SET "screenshotInterval" = EXCLUDED."screenshotInterval",
    "screenshotQuality" = EXCLUDED."screenshotQuality",
    "idleTimeout" = EXCLUDED."idleTimeout",
    "trackActivity" = EXCLUDED."trackActivity",
    "trackApplications" = EXCLUDED."trackApplications",
    "trackWebsites" = EXCLUDED."trackWebsites",
    "multiMonitorCapture" = EXCLUDED."multiMonitorCapture",
    "autoClockOut" = EXCLUDED."autoClockOut",
    "manualPausePermission" = EXCLUDED."manualPausePermission",
    "weekendTracking" = EXCLUDED."weekendTracking";

-- 5. Enable RLS on device_registrations
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;

-- 6. Add Security Policy
DROP POLICY IF EXISTS "Allow authenticated users to manage device_registrations" ON device_registrations;
CREATE POLICY "Allow authenticated users to manage device_registrations" 
ON device_registrations FOR ALL USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
