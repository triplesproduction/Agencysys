-- Add last_seen to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;

-- Create function to update last seen
CREATE OR REPLACE FUNCTION update_last_seen(employee_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.employees
    SET last_seen = NOW()
    WHERE id = employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expose via RPC for the frontend to call before they disconnect or periodically
-- Actually, a better approach is to let employees update their own last_seen via updateEmployee.
-- Let's just use the column.
