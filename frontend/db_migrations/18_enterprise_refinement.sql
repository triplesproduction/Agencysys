-- 18_enterprise_refinement.sql
-- Refine database schema to support single sync endpoint, device fingerprints, and remote commands

-- 1. Upgrade Device Registrations Table
ALTER TABLE device_registrations 
ADD COLUMN IF NOT EXISTS "deviceFingerprint" text;

-- 2. Create Device Commands Table for Remote Actions Polling
CREATE TABLE IF NOT EXISTS device_commands (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deviceId" text NOT NULL, -- references device_registrations(deviceId)
  "command" text NOT NULL,
  "parameters" jsonb DEFAULT '{}',
  "status" text DEFAULT 'PENDING', -- PENDING, SENT, EXECUTED, FAILED
  "createdAt" timestamptz DEFAULT now(),
  "executedAt" timestamptz
);

-- 3. Enable RLS on device_commands
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;

-- 4. Add Security Policy
DROP POLICY IF EXISTS "Allow authenticated users to manage device_commands" ON device_commands;
CREATE POLICY "Allow authenticated users to manage device_commands" 
ON device_commands FOR ALL USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
