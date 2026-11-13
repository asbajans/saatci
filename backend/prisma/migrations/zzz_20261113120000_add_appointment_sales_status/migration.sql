CREATE TYPE "SalesStatus" AS ENUM ('SOLD', 'NEGATIVE', 'CALLBACK');

ALTER TABLE "Appointment" ADD COLUMN "salesStatus" "SalesStatus";
