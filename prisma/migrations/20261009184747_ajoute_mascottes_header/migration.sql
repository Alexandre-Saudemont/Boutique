-- CreateTable
CREATE TABLE "header_mascots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "header_mascots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "header_mascots_startsAt_endsAt_idx" ON "header_mascots"("startsAt", "endsAt");
