import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  RoleUtilisateur,
} from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquant (voir .env)');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const mdpTechnicien = process.env.SEED_TECHNICIEN_MOTDEPASSE ?? 'technicien123';
const mdpDirecteur = process.env.SEED_DIRECTEUR_MOTDEPASSE ?? 'directeur123';
const identifiantDirecteur = process.env.SEED_DIRECTEUR_IDENTIFIANT ?? 'kouassi';

const techniciens = [
  { nom: 'Jean Koffi', identifiant: 'koffi' },
  { nom: 'Awa Traore', identifiant: 'awa' },
  { nom: "Serge N'Guessan", identifiant: 'serge' },
  { nom: 'Ismael Diarra', identifiant: 'ismael' },
];

async function main(): Promise<void> {
  const hashTech = await argon2.hash(mdpTechnicien);
  for (const t of techniciens) {
    await prisma.utilisateur.upsert({
      where: { identifiant: t.identifiant },
      update: { nom: t.nom, role: RoleUtilisateur.TECHNICIEN, actif: true },
      create: {
        nom: t.nom,
        identifiant: t.identifiant,
        motDePasseHash: hashTech,
        role: RoleUtilisateur.TECHNICIEN,
      },
    });
  }

  const hashDir = await argon2.hash(mdpDirecteur);
  await prisma.utilisateur.upsert({
    where: { identifiant: identifiantDirecteur },
    update: {
      nom: 'Kouassi Bertin',
      role: RoleUtilisateur.DIRECTEUR,
      actif: true,
    },
    create: {
      nom: 'Kouassi Bertin',
      identifiant: identifiantDirecteur,
      motDePasseHash: hashDir,
      role: RoleUtilisateur.DIRECTEUR,
    },
  });

  const parRole = await prisma.utilisateur.groupBy({
    by: ['role'],
    _count: { _all: true },
  });
  const resume = parRole
    .map((r) => `${r.role}=${r._count._all}`)
    .join(', ');
  console.log(`Seed termine : ${resume}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
