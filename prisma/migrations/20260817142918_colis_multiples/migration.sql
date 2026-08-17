-- Une commande peut désormais partir en plusieurs colis.
--
-- Le suivi quittait la commande pour rejoindre le colis. La migration générée
-- automatiquement supprimait `orders.trackingNumber` et `orders.trackingUrl`
-- avant toute reprise : les numéros de suivi des commandes déjà expédiées
-- auraient disparu. L'ordre est donc rétabli à la main — on crée, on recopie,
-- et on ne supprime qu'ensuite.

-- 1. Le nouveau statut.
--
-- `ADD VALUE` est accepté dans une transaction depuis PostgreSQL 12, à
-- condition de ne pas s'en servir avant qu'elle soit validée. Cette migration
-- ne fait qu'ajouter la valeur, jamais ne l'écrit : rien à craindre ici.
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_SHIPPED';

-- 2. La table des colis.
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");
CREATE UNIQUE INDEX "shipments_orderId_position_key" ON "shipments"("orderId", "position");

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Le rattachement des lignes à leur colis.
ALTER TABLE "order_items" ADD COLUMN "shipmentId" TEXT;

CREATE INDEX "order_items_shipmentId_idx" ON "order_items"("shipmentId");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Le choix du client, figé à la commande.
ALTER TABLE "orders" ADD COLUMN "splitShipping" BOOLEAN NOT NULL DEFAULT false;

-- 5. Reprise des commandes existantes.
--
-- Chacune reçoit un colis unique qui hérite de son transporteur, de son suivi
-- et de ses dates. Les commandes entièrement numériques n'en reçoivent aucun :
-- elles ne partent dans aucun colis, et leur en fabriquer un ferait apparaître
-- un envoi fantôme dans le back-office.
INSERT INTO "shipments" ("id", "orderId", "position", "label", "carrier", "trackingNumber", "trackingUrl", "shippedAt", "deliveredAt", "createdAt", "updatedAt")
SELECT
    'shp_' || o."id",
    o."id",
    1,
    'Colis',
    o."carrier",
    o."trackingNumber",
    o."trackingUrl",
    o."shippedAt",
    o."deliveredAt",
    o."createdAt",
    CURRENT_TIMESTAMP
FROM "orders" o
WHERE EXISTS (
    SELECT 1 FROM "order_items" i
    WHERE i."orderId" = o."id" AND i."kind" <> 'DIGITAL'
);

UPDATE "order_items" i
SET "shipmentId" = s."id"
FROM "shipments" s
WHERE s."orderId" = i."orderId"
  AND s."position" = 1
  AND i."kind" <> 'DIGITAL';

-- 6. Le suivi quitte la commande, maintenant qu'il est recopié.
ALTER TABLE "orders" DROP COLUMN "trackingNumber";
ALTER TABLE "orders" DROP COLUMN "trackingUrl";
