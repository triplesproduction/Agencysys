import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting DB Seed...');

    // Create Test Employees
    const admin = await prisma.employee.upsert({
        where: { email: 'admin@triples.os' },
        update: {},
        create: {
            id: 'admin-uuid-001',
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@triples.os',
            roleId: 'ADMIN',
            department: 'Management',
        },
    });

    const exactTaskWorker = await prisma.employee.upsert({
        where: { email: 'worker@triples.os' },
        update: {},
        create: {
            id: 'worker-uuid-002',
            firstName: 'Task',
            lastName: 'Worker',
            email: 'worker@triples.os',
            roleId: 'EMPLOYEE',
            department: 'Engineering',
        },
    });

    // Create Test Tasks
    const task1 = await prisma.task.create({
        data: {
            title: 'Initialize Phase 1 Frontend Integration',
            description: 'Ensure the APIs are wired up correctly.',
            status: 'TODO',
            priority: 'HIGH',
            dueDate: new Date(new Date().setDate(new Date().getDate() + 5)),
            estimatedHours: 10,
            assigneeId: exactTaskWorker.id,
            creatorId: admin.id,
        },
    });

    // Create Test Tasks (Developer Related)
    const devTasks = [
        {
            title: 'Implement Multi-factor Authentication',
            description: 'Add 2FA support using authenticator apps.',
            status: 'TODO',
            priority: 'HIGH'
        },
        {
            title: 'Optimize Database Query Performance',
            description: 'Analyze and index heavy queries in the employee module.',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM'
        },
        {
            title: 'Setup CI/CD Pipeline for Staging',
            description: 'Configure GitHub Actions for automated testing and deployment.',
            status: 'BACKLOG',
            priority: 'MEDIUM'
        },
        {
            title: 'Refactor Messaging Context Provider',
            description: 'Improve performance of real-time messaging updates.',
            status: 'TODO',
            priority: 'LOW'
        }
    ];

    // Create Test Tasks (Marketing Related)
    const marketingTasks = [
        {
            title: 'Social Media Campaign Strategy - Q2',
            description: 'Define platform-specific content buckets for the next quarter.',
            status: 'TODO',
            priority: 'HIGH'
        },
        {
            title: 'SEO Audit & Keyword Research',
            description: 'Competitor analysis and identifying high-intent keywords.',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM'
        },
        {
            title: 'Design Interactive Brand Guidelines',
            description: 'Create a digital-first brand identity portal for clients.',
            status: 'BACKLOG',
            priority: 'HIGH'
        },
        {
            title: 'B2B Client Testimonial Video Series',
            description: 'Record and edit 5 high-impact client success stories.',
            status: 'TODO',
            priority: 'MEDIUM'
        }
    ];

    for (const taskData of [...devTasks, ...marketingTasks]) {
        await prisma.task.create({
            data: {
                ...taskData,
                dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
                creatorId: admin.id,
                assigneeId: exactTaskWorker.id
            },
        });
    }

    // Create Work Hour Log
    await prisma.workHourLog.create({
        data: {
            employeeId: exactTaskWorker.id,
            taskId: task1.id,
            date: new Date(),
            hoursLogged: 4.5,
            description: 'Worked on initial scaffolding.',
        },
    });

    // Create Test Leave Application
    await prisma.leaveApplication.create({
        data: {
            employeeId: exactTaskWorker.id,
            leaveType: 'CASUAL',
            startDate: new Date(new Date().setDate(new Date().getDate() + 10)),
            endDate: new Date(new Date().setDate(new Date().getDate() + 12)),
            reason: 'Personal errands',
            status: 'PENDING'
        }
    });

    console.log('Seeding finished successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
