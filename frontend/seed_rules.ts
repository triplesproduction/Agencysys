import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_ID = "617b189f-d31e-41ce-8fb7-e263ab2dbb12"; // I need to dynamically get an admin ID. Let's just fetch the first admin!

async function run() {
    // 1. Get an admin user
    const { data: admins } = await supabase.from('employees').select('id, roleId').limit(10);
    const admin = admins?.find(a => a.roleId.includes('ADMIN'));
    const adminId = admin ? admin.id : admins?.[0]?.id;

    if(!adminId) {
        console.error("No employee found to assign rules to");
        return;
    }

    const rules = [
        {
            title: 'Company Policies',
            description: `**Office Conduct**
Maintain professionalism in all digital communications. Treat peers with respect and uphold the TripleS OS core values during every sprint.

**Work Ethics**
Extreme ownership is expected. If a module breaks, own the fix. Plagiarism or copying untrusted third-party code without architectural review is a strict violation.

**Reporting Hierarchy**
Developers report to their direct Shift Manager. Shift Managers report logic escalations to the Admin council. Do not bypass the reporting chain for non-emergencies.`,
            category: 'Work Policy',
            priority: 'Critical',
            createdBy: adminId
        },
        {
            title: 'Work Hour Guidelines',
            description: `**Login Time**
The standard system login window opens at 09:00 AM Local Time. Core availability must be maintained until 05:00 PM.

**Daily Working Hours**
Employees must track and log exactly 8 net working hours per daily shift into the Work Hours terminal.

**EOD Submission Rules**
An End of Day (EOD) report is mandatory. It must be submitted before your final logout, explicitly detailing completed tasks and active blockers.`,
            category: 'Attendance',
            priority: 'Important',
            createdBy: adminId
        },
        {
            title: 'Leave Policy',
            description: `**Leave Types**
Options currently supported: SICK, CASUAL, and EARNED.

**Approval Workflow**
1. Employee submits request via the Dashboard.
2. Manager reviews impact against Active Tasks queue.
3. Admin provides final sign-off confirming PTO validity.

**Application Timeline**
Non-emergency leaves must be requested a minimum of 7 days in advance.`,
            category: 'Leave',
            priority: 'Normal',
            createdBy: adminId
        },
        {
            title: 'Laptop Setup Guide',
            description: `**Folder Structure Setup**
Clone the primary repository into a designated workspace directory. Never clone work projects directly onto the Desktop.

**Naming Conventions**
- Use camelCase for typescript variables.
- Use PascalCase for React Components.
- Use kebab-case for CSS class nomenclature.`,
            category: 'Security',
            priority: 'Normal',
            createdBy: adminId
        },
        {
            title: 'Required Software Installation',
            description: `**VS Code**
Install the latest stable build. Required extensions: ESLint, Prettier, and Thunder Client for API testing.

**GitHub Desktop**
Required for visual commit tracking and PR reviews unless command-line is preferred.

**Slack / Teams**
Keep desktop notifications ON during core hours for emergency pings alerting to server downtime.`,
            category: 'Security',
            priority: 'Normal',
            createdBy: adminId
        },
        {
            title: 'Important Apps Setup',
            description: `**TripleS OS Login**
Authenticate daily using your assigned employeeId and role-mapped passcode. Tokens automatically expire after 24 hours.

**Task Management Rules**
Tasks must be transitioned from TODO → IN_PROGRESS → DONE in real-time. Do not complete work before updating its status.`,
            category: 'Work Policy',
            priority: 'Important',
            createdBy: adminId
        }
    ];

    for (const rule of rules) {
        // Check if rule already exists to avoid duplicates
        const { data: existing } = await supabase.from('rules').select('id').eq('title', rule.title).single();
        if (!existing) {
            console.log(`Inserting: ${rule.title}`);
            await supabase.from('rules').insert(rule);
        } else {
            console.log(`Rule already exists: ${rule.title}`);
        }
    }
    console.log("Seeding complete.");
}
run();
