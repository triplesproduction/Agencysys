const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed script...");
  const admin = await prisma.employee.findFirst({ where: { roleId: 'ADMIN' } });
  const employee = await prisma.employee.findFirst({ where: { roleId: { notIn: ['ADMIN', 'MANAGER'] } } });

  const targetAdminId = admin ? admin.id : (await prisma.employee.findFirst())?.id;
  const targetEmployeeId = employee ? employee.id : (await prisma.employee.findFirst())?.id;

  if (!targetEmployeeId || !targetAdminId) {
    console.log('No employees found to assign tasks.');
    return;
  }

  const tasks = [
    {
      title: 'Design Marketing Campaign',
      description: 'Creating social media assets.',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      assigneeId: targetEmployeeId,
      creatorId: targetAdminId,
      managerId: targetAdminId,
    },
    {
      title: 'Fix Navigation Bug',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      assigneeId: targetEmployeeId,
      creatorId: targetAdminId,
      managerId: targetAdminId,
    },
    {
      title: 'Deploy to Staging',
      status: 'DONE',
      priority: 'HIGH',
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      assigneeId: targetEmployeeId,
      creatorId: targetAdminId,
      managerId: targetAdminId,
    }
  ];

  for (const task of tasks) {
    try {
      await prisma.task.create({ data: task });
      console.log(`Created task: ${task.title}`);
    } catch (err) {
      console.error(`Failed to create task ${task.title}:`, err.message);
    }
  }
}

main().finally(async () => {
    await prisma.$disconnect();
});
