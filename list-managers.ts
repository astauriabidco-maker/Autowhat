import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const employees = await prisma.employee.findMany({
    where: { role: 'ADMIN' },
    include: { tenant: true },
    take: 3
  });
  console.log('Result:', JSON.stringify(employees, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
