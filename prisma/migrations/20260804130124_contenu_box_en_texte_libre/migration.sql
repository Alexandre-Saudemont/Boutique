/*
  Warnings:

  - You are about to drop the `box_content_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "box_content_items" DROP CONSTRAINT "box_content_items_orderItemId_fkey";

-- DropTable
DROP TABLE "box_content_items";

-- CreateTable
CREATE TABLE "box_contents" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "box_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "box_contents_orderItemId_idx" ON "box_contents"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "box_contents_orderItemId_boxNumber_key" ON "box_contents"("orderItemId", "boxNumber");

-- AddForeignKey
ALTER TABLE "box_contents" ADD CONSTRAINT "box_contents_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
