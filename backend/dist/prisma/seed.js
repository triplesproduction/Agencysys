"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting DB Seed...');
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
    await prisma.workHourLog.create({
        data: {
            employeeId: exactTaskWorker.id,
            taskId: task1.id,
            date: new Date(),
            hoursLogged: 4.5,
            description: 'Worked on initial scaffolding.',
        },
    });
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
//# sourceMappingURL=seed.js.map