import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fullSeed() {
    console.log('--- STARTING FULL RECOVERY SEED ---');
    
    // 1. Seed Employees
    const employees = [
        { firstName: 'Suansh', lastName: 'Admin', email: 'suansh@agency.com', roleId: 'ADMIN' },
        { firstName: 'Parth', lastName: 'Manager', email: 'parth@agency.com', roleId: 'MANAGER' },
        { firstName: 'Prince', lastName: 'Dev', email: 'prince@agency.com', roleId: 'EMPLOYEE' },
        { firstName: 'Suraj', lastName: 'Dev', email: 'suraj@agency.com', roleId: 'EMPLOYEE' },
        { firstName: 'John', lastName: 'Dev', email: 'john@agency.com', roleId: 'EMPLOYEE' }
    ];

    console.log('Seeding employees...');
    const { data: savedEmps, error: empErr } = await supabase.from('employees').insert(employees).select();
    
    if (empErr) {
        console.error('Employee seed failed:', empErr.message);
        return;
    }

    console.log(`Seeded ${savedEmps.length} employees.`);
    const empIds = savedEmps.map(e => e.id);

    // 2. Seed Tasks
    const taskTitles = [
        'Research AI Integration Patterns',
        'Refactor Authentication Middleware',
        'Design System Audit - Q2',
        'Update Project Documentation',
        'Optimize Database Queries',
        'Implement Dark Mode Toggle',
        'Fix Memory Leak in Dashboard',
        'Setup CI/CD Pipeline',
        'Create Marketing Assets',
        'Review Security Protocols',
        'Performance Monitoring Setup',
        'Mobile Responsiveness Fixes',
        'Integrate Stripe Webhooks',
        'Draft Client Proposal - Nexus',
        'Team Sync & Strategy Session',
        'Develop Internal Tools API',
        'Automate End-of-Day Reports',
        'Cleanup Legacy Dependencies',
        'User Experience Workshop',
        'Finalize Q3 Roadmap',
        'Debug Real-time Notifications',
        'Enhance Search Functionality'
    ];

    const tasks = taskTitles.map((title, idx) => {
        const randomEmp = empIds[Math.floor(Math.random() * empIds.length)];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14));

        return {
            title,
            description: `Auto-generated task for testing: ${title}.`,
            status: idx % 4 === 0 ? 'TODO' : idx % 4 === 1 ? 'IN_PROGRESS' : idx % 4 === 2 ? 'REVIEW' : 'DONE',
            priority: idx % 3 === 0 ? 'HIGH' : idx % 3 === 1 ? 'MEDIUM' : 'LOW',
            assigneeId: randomEmp,
            dueDate: dueDate.toISOString(),
            creatorId: empIds[0],
            expectedHours: Math.floor(Math.random() * 10) + 2
        };
    });

    console.log('Seeding tasks...');
    const { error: taskErr } = await supabase.from('tasks').insert(tasks);
    if (taskErr) {
        console.error('Task seed failed:', taskErr.message);
    } else {
        console.log('SUCCESS: Full environment seeded with employees and tasks.');
    }
}

fullSeed();
