-- AlterTable
ALTER TABLE "SpecialistProfile" ADD COLUMN     "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "specialization" DROP NOT NULL;
