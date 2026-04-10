import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCol(table, col) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (error && error.message.includes('Could not find')) {
        return false;
    }
    return true;
}

async function run() {
    console.log('--- KPI PROFILES ---');
    console.log('employeeId:', await checkCol('kpi_profiles', 'employeeId'));
    console.log('employee_id:', await checkCol('kpi_profiles', 'employee_id'));
    console.log('monthYear:', await checkCol('kpi_profiles', 'monthYear'));
    console.log('month_year:', await checkCol('kpi_profiles', 'month_year'));
    console.log('currentScore:', await checkCol('kpi_profiles', 'currentScore'));
    console.log('current_score:', await checkCol('kpi_profiles', 'current_score'));

    console.log('--- KPI AUDIT LOGS ---');
    console.log('employeeId:', await checkCol('kpi_audit_logs', 'employeeId'));
    console.log('employee_id:', await checkCol('kpi_audit_logs', 'employee_id'));
    console.log('createdAt:', await checkCol('kpi_audit_logs', 'createdAt'));
    console.log('created_at:', await checkCol('kpi_audit_logs', 'created_at'));

    console.log('--- TASKS ---');
    console.log('assigneeId:', await checkCol('tasks', 'assigneeId'));
    console.log('assignee_id:', await checkCol('tasks', 'assignee_id'));
}

run();
