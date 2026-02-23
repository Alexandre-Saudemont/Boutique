import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Créer un admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@boutique.com",
      password: await bcrypt.hash("motdepasseAdmin", 10),
      firstName: "Admin",
      lastName: "Super",
      role: "admin",
    },
  });
  console.log("Admin créé :", admin);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
