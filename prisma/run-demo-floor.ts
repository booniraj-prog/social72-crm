import { PrismaClient } from "@prisma/client";
import { shapeDemoFloor } from "./shape-demo-floor";

const prisma = new PrismaClient();
shapeDemoFloor(prisma)
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
