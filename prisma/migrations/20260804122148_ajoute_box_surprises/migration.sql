-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "isMysteryBox" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isMysteryBox" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "box_content_items" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "box_content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "box_content_items_orderItemId_idx" ON "box_content_items"("orderItemId");

-- AddForeignKey
ALTER TABLE "box_content_items" ADD CONSTRAINT "box_content_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
