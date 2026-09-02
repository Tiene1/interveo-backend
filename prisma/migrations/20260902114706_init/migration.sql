-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('TECHNICIEN', 'DIRECTEUR');

-- CreateEnum
CREATE TYPE "StatutIntervention" AS ENUM ('PLANIFIEE', 'REALISEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeEquipement" AS ENUM ('CLIMATISATION', 'GROUPE_ELECTROGENE', 'INSTALLATION_ELECTRIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "CategoriePhoto" AS ENUM ('AVANT', 'APRES');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "identifiant" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "nomClient" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "telephone1" TEXT NOT NULL,
    "telephone2" TEXT,
    "geolocalisation" TEXT,
    "motifSignale" TEXT,
    "datePrevue" TIMESTAMP(3) NOT NULL,
    "technicienId" TEXT NOT NULL,
    "creeParId" TEXT NOT NULL,
    "typeEquipement" "TypeEquipement",
    "problemeConstate" TEXT,
    "travauxRealises" TEXT,
    "statut" "StatutIntervention" NOT NULL DEFAULT 'PLANIFIEE',
    "dateRealisation" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "categorie" "CategoriePhoto" NOT NULL,
    "cheminFichier" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_identifiant_key" ON "Utilisateur"("identifiant");

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_technicienId_fkey" FOREIGN KEY ("technicienId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
