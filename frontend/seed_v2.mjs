import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('--- STARTING SEED V2 ---');
    
    // 1. Get Employees
    const { data: employees, error: empErr } = await supabase.from('employees').select('id, firstName');
    if (empErr) {
        console.error('Failed to fetch employees:', empErr);
        return;
    }
    
    if (!employees || employees.length === 0) {
        console.error('No employees found to assign tasks to.');
        return;
    }

    const empIds = employees.map(e => e.id);
    const priorities = ['LOW', 'MEDIUM', 'HIGH'];
    const statuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

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

    const tasks = taskTitles.map(title => {
        const randomEmp = empIds[Math.floor(Math.random() * empIds.length)];
        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14));

        return {
            title,
            description: `Auto-generated task for testing: ${title}. Full scope and requirements are detailed in the project wiki.`,
            status: randomStatus,
            priority: randomPriority,
            assigneeId: randomEmp,
            dueDate: dueDate.toISOString(),
            creatorId: empIds[0], // Arbitrarily use first employee as creator
            expectedHours: Math.floor(Math.random() * 20) + 1
        };
    });

    console.log(`Inserting ${tasks.length} tasks...`);

    const { data, error } = await supabase.from('tasks').insert(tasks);

    if (error) {
        console.error('Seed insertion failed:', error);
    } else {
        console.log('Successfully seeded 22 diverse tasks.');
    }
}

seed();
