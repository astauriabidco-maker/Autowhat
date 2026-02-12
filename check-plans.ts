
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const plans = await prisma.subscriptionPlan.findMany();
    console.log('Plans found:', plans.length);
    plans.forEach(p => console.log(`- ${p.name} (${p.id})`));
}
run();
