const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.findMany();
    process.stdout.write(JSON.stringify(employees.map(e => ({ email: e.email, role: e.roleId })), null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
