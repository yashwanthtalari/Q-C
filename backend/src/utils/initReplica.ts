import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Initiating replica set via Prisma...');
    const res = await prisma.$runCommandRaw({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: 'localhost:27017' }]
      }
    });
    console.log('Replica set initiated:', res);
  } catch (err: any) {
    console.log('Replica set initiation result:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
