-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "Guest" ADD COLUMN "occupation" TEXT;
ALTER TABLE "Guest" ADD COLUMN "provenance" TEXT;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN "address" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "responsibleName" TEXT;

-- AlterTable
ALTER TABLE "StayRegistration" ADD COLUMN "hotelAddress" TEXT;
ALTER TABLE "StayRegistration" ADD COLUMN "hotelRegistrationNumber" TEXT;
ALTER TABLE "StayRegistration" ADD COLUMN "hotelResponsibleName" TEXT;
ALTER TABLE "StayRegistration" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "StayRegistration" ADD COLUMN "occupation" TEXT;
ALTER TABLE "StayRegistration" ADD COLUMN "provenance" TEXT;
