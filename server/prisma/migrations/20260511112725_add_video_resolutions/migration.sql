-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "encodingProfile" TEXT NOT NULL DEFAULT 'incomplete',
ADD COLUMN     "resolutions" TEXT[];
