const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.findMany({
        select: {
            email: true,
            roleId: true,
            passwordHash: true
        }
    });
    console.log(JSON.stringify(employees, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
