
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function truncateMessages() {
    try {
        const count = await prisma.message.deleteMany({});
        console.log(`Deleted ${count.count} messages.`);
    } catch (err) {
        console.error('Truncate error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

truncateMessages();
