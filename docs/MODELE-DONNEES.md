# Modèle de données — L'antre du vieux geek fou

Document de travail, **à relire et valider avant migration**. Rien n'est appliqué en base à ce stade.

---

## Décisions structurantes

| Décision | Choix | Pourquoi |
|---|---|---|
| Montants | `Int` en **centimes** (`priceCents`) | `Float` sur de la monnaie produit des totaux faux (`0.1 + 0.2 !== 0.3`). Jamais de flottant sur un prix. |
| Identifiants | `String @default(cuid())` | Les `Int` auto-incrémentés exposent le volume d'activité dans les URLs (`/produit/47` = 47 produits) et facilitent l'énumération. |
| Prix / stock | Portés par **`ProductVariant`**, jamais par `Product` | Une figurine en 2 éditions, un livre en FR/EN = 2 SKU, 2 stocks, 2 poids. Chaque produit a **au minimum une variante** (dite « par défaut »). |
| TVA | `vatRateBp` par produit + régime global | Franchise en base aujourd'hui, bascule sans migration au dépassement du seuil. Voir plus bas. |
| Suppression | `archivedAt`, pas `DELETE` | Supprimer un produit lié à une commande détruit l'historique de facturation. |
| Commande invité | `userId` optionnel + `email` obligatoire | Le compte obligatoire fait chuter la conversion. Décision à confirmer côté métier. |
| Snapshots | Adresses et lignes de commande **copiées**, jamais référencées | Un client qui change d'adresse ou un prix qui bouge ne doivent pas réécrire une commande passée. Obligation comptable. |

---

## TVA — franchise en base

Régime actif : **franchise en base** (micro-entreprise).

- Aucune TVA facturée. Prix saisis = prix payés.
- Mention obligatoire sur factures et CGV : *« TVA non applicable, art. 293 B du CGI »*.
- `Order.vatRegime` **fige le régime au moment de la commande** : si le passage à la TVA intervient en cours d'année, les anciennes commandes gardent leur régime d'origine. Indispensable en cas de contrôle.

Le jour du dépassement de seuil : on passe le réglage global à `STANDARD` et on renseigne `vatRateBp` sur les produits. Aucune migration.

> Taux à prévoir le moment venu : produits physiques au taux normal, **livres papier à taux réduit**, **livres numériques au taux normal**. Les ouvrages du Vieux geek fou tombent pile sur cette distinction — d'où un taux **par produit** et non global.

---

## Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum UserRole {
  CUSTOMER
  ADMIN           // tous droits
  STAFF_ORDERS    // préparateur : commandes, expéditions, stock
  STAFF_SUPPORT   // service client : commandes (lecture), avis, retours
}

enum ProductKind {
  PHYSICAL
  DIGITAL
}

enum ProductCondition {
  NEW
  USED
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  PREPARING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum VatRegime {
  FRANCHISE   // art. 293 B du CGI
  STANDARD
}

enum PaymentProvider {
  STRIPE
  PAYPAL
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
}

enum AddressType {
  SHIPPING
  BILLING
}

enum DiscountType {
  PERCENT
  FIXED
  FREE_SHIPPING
}

enum ModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

// ============================================================
// UTILISATEURS
// ============================================================

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?   // null si connexion externe un jour
  firstName       String?
  lastName        String?
  phone           String?
  role            UserRole  @default(CUSTOMER)

  emailVerifiedAt DateTime?
  marketingOptIn  DateTime? // RGPD : date du consentement, pas un booléen
  lastLoginAt     DateTime?
  anonymizedAt    DateTime? // droit à l'effacement sans casser les commandes

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  addresses       Address[]
  orders          Order[]
  cart            Cart?
  wishlistItems   WishlistItem[]
  reviews         Review[]
  posts           Post[]
  downloadGrants  DownloadGrant[]
  auditLogs       AuditLog[]

  @@map("users")
}

model Address {
  id         String      @id @default(cuid())
  userId     String
  type       AddressType
  label      String?     // « Domicile », « Bureau »
  firstName  String
  lastName   String
  company    String?
  line1      String
  line2      String?
  postalCode String
  city       String
  country    String      @default("FR")
  phone      String?
  isDefault  Boolean     @default(false)

  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("addresses")
}

// ============================================================
// TAXONOMIE
// ============================================================

model Category {
  id              String     @id @default(cuid())
  parentId        String?
  name            String
  slug            String     @unique
  description     String?    @db.Text
  imageUrl        String?
  position        Int        @default(0)
  isActive        Boolean    @default(true)

  metaTitle       String?
  metaDescription String?

  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  parent          Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryTree")

  products        Product[]  @relation("ProductCategories")
  primaryProducts Product[]  @relation("ProductPrimaryCategory")

  @@index([parentId])
  @@map("categories")
}

model Brand {
  id              String    @id @default(cuid())
  name            String
  slug            String    @unique
  logoUrl         String?
  description     String?   @db.Text
  metaTitle       String?
  metaDescription String?
  isActive        Boolean   @default(true)

  products        Product[]

  @@map("brands")
}

/// Licence = univers/franchise (One Piece, Star Wars, Cthulhu…).
/// Distinct de la marque (Bandai, Funko, Games Workshop…).
model Licence {
  id              String    @id @default(cuid())
  name            String
  slug            String    @unique
  imageUrl        String?
  description     String?   @db.Text
  metaTitle       String?
  metaDescription String?
  isActive        Boolean   @default(true)

  products        Product[]

  @@map("licences")
}

// ============================================================
// CATALOGUE
// ============================================================

model Product {
  id                String           @id @default(cuid())
  kind              ProductKind      @default(PHYSICAL)
  condition         ProductCondition @default(NEW)

  name              String
  slug              String           @unique
  shortDescription  String?          @db.Text
  longDescription   String?          @db.Text
  creator           String?          // auteur, illustrateur, sculpteur…

  brandId           String?
  licenceId         String?
  primaryCategoryId String?          // canonique : fil d'ariane + URL SEO

  vatRateBp         Int?             // points de base : 2000 = 20 %. Null en franchise.

  // Précommande / sortie
  releaseDate       DateTime?
  allowPreorder     Boolean          @default(false)

  // Publication
  isActive          Boolean          @default(true)
  publishedAt       DateTime?
  archivedAt        DateTime?

  // SEO
  metaTitle         String?
  metaDescription   String?
  searchKeywords    String?          // mots-clés internes, non affichés

  // Dénormalisé pour tri/affichage (recalculé à chaque avis validé)
  averageRating     Float?
  reviewCount       Int              @default(0)

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  brand             Brand?           @relation(fields: [brandId], references: [id])
  licence           Licence?         @relation(fields: [licenceId], references: [id])
  primaryCategory   Category?        @relation("ProductPrimaryCategory", fields: [primaryCategoryId], references: [id])
  categories        Category[]       @relation("ProductCategories")

  variants          ProductVariant[]
  images            ProductImage[]
  reviews           Review[]
  wishlistItems     WishlistItem[]
  digitalAssets     DigitalAsset[]

  @@index([brandId])
  @@index([licenceId])
  @@index([primaryCategoryId])
  @@index([isActive, publishedAt])
  @@map("products")
}

/// Porte le SKU, le prix, le stock et le poids.
/// Un produit sans variante réelle en possède une, nommée « Standard ».
model ProductVariant {
  id                  String    @id @default(cuid())
  productId           String
  sku                 String    @unique
  name                String    @default("Standard")

  priceCents          Int
  compareAtPriceCents Int?      // prix barré (promo)

  stock               Int       @default(0)
  lowStockThreshold   Int       @default(3)   // seuil d'alerte admin
  allowBackorder      Boolean   @default(false)

  // Logistique — requis pour le calcul des frais de port
  weightGrams         Int?
  lengthMm            Int?
  widthMm             Int?
  heightMm            Int?
  isFragile           Boolean   @default(false)
  isBulky             Boolean   @default(false)

  position            Int       @default(0)
  isActive            Boolean   @default(true)
  archivedAt          DateTime?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  product             Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  options             VariantOption[]
  images              ProductImage[]
  cartItems           CartItem[]
  orderItems          OrderItem[]
  backInStockRequests BackInStockRequest[]

  @@index([productId])
  @@map("product_variants")
}

/// Attributs de la variante : { name: "Taille", value: "1/7" }, { name: "Langue", value: "FR" }
model VariantOption {
  id        String         @id @default(cuid())
  variantId String
  name      String
  value     String

  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([variantId, name])
  @@index([name, value])
  @@map("variant_options")
}

model ProductImage {
  id        String          @id @default(cuid())
  productId String
  variantId String?         // image spécifique à une variante
  url       String
  alt       String?         // SEO + accessibilité : obligatoire à la saisie
  position  Int             @default(0)

  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant   ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@index([productId])
  @@map("product_images")
}

// ============================================================
// PRODUITS NUMÉRIQUES
// ============================================================

model DigitalAsset {
  id        String   @id @default(cuid())
  productId String
  fileKey   String   // clé de stockage privé — jamais d'URL publique
  fileName  String
  mimeType  String
  sizeBytes Int
  version   String   @default("1.0")
  createdAt DateTime @default(now())

  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  grants    DownloadGrant[]

  @@index([productId])
  @@map("digital_assets")
}

/// Droit de téléchargement délivré après paiement. Le fichier n'est jamais servi
/// directement : on vérifie le grant, puis on signe une URL à durée courte.
model DownloadGrant {
  id             String    @id @default(cuid())
  digitalAssetId String
  orderItemId    String
  userId         String?
  email          String
  token          String    @unique
  maxDownloads   Int       @default(5)
  downloadCount  Int       @default(0)
  expiresAt      DateTime?
  createdAt      DateTime  @default(now())

  digitalAsset   DigitalAsset @relation(fields: [digitalAssetId], references: [id])
  orderItem      OrderItem    @relation(fields: [orderItemId], references: [id])
  user           User?        @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("download_grants")
}

// ============================================================
// PANIER
// ============================================================

model Cart {
  id           String   @id @default(cuid())
  userId       String?  @unique
  sessionToken String?  @unique  // panier invité, cookie httpOnly
  customerNote String?  @db.Text // message client (délais, vacances…)
  expiresAt    DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  items        CartItem[]

  @@map("carts")
}

model CartItem {
  id        String   @id @default(cuid())
  cartId    String
  variantId String
  quantity  Int      @default(1)
  addedAt   DateTime @default(now())

  cart      Cart           @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([cartId, variantId])
  @@map("cart_items")
}

// ============================================================
// COMMANDES
// ============================================================

model Order {
  id             String      @id @default(cuid())
  orderNumber    String      @unique  // ex. AVGF-2026-000142

  userId         String?     // null = commande invité
  email          String
  phone          String?

  status         OrderStatus @default(PENDING_PAYMENT)
  vatRegime      VatRegime   @default(FRANCHISE) // figé à la commande

  // Totaux — tous en centimes, tous figés
  subtotalCents  Int
  discountCents  Int         @default(0)
  shippingCents  Int         @default(0)
  vatCents       Int         @default(0)
  totalCents     Int

  discountCode   String?     // snapshot du code utilisé
  customerNote   String?     @db.Text
  adminNote      String?     @db.Text

  // Expédition
  carrier        String?
  shippingMethod String?
  relayPointId   String?
  relayPointData Json?
  trackingNumber String?
  trackingUrl    String?

  placedAt       DateTime?
  paidAt         DateTime?
  shippedAt      DateTime?
  deliveredAt    DateTime?
  cancelledAt    DateTime?

  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  user           User?          @relation(fields: [userId], references: [id])
  addresses      OrderAddress[]
  items          OrderItem[]
  payments       Payment[]

  @@index([userId])
  @@index([status])
  @@index([email])
  @@map("orders")
}

/// Copie figée de l'adresse. Ne référence jamais `Address`.
model OrderAddress {
  id         String      @id @default(cuid())
  orderId    String
  type       AddressType
  firstName  String
  lastName   String
  company    String?
  line1      String
  line2      String?
  postalCode String
  city       String
  country    String
  phone      String?

  order      Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([orderId, type])
  @@map("order_addresses")
}

/// Copie figée de la ligne. `variantId` sert au réassort, jamais à l'affichage.
model OrderItem {
  id             String      @id @default(cuid())
  orderId        String
  variantId      String?

  productName    String
  variantName    String
  sku            String
  kind           ProductKind
  unitPriceCents Int
  vatRateBp      Int         @default(0)
  quantity       Int
  totalCents     Int

  order          Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variant        ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  downloadGrants DownloadGrant[]

  @@index([orderId])
  @@map("order_items")
}

model Payment {
  id                String          @id @default(cuid())
  orderId           String
  provider          PaymentProvider
  providerPaymentId String?         @unique
  status            PaymentStatus   @default(PENDING)
  amountCents       Int
  refundedCents     Int             @default(0)
  failureReason     String?
  rawPayload        Json?           // dernier webhook reçu, pour audit

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  order             Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("payments")
}

// ============================================================
// PROMOTIONS
// ============================================================

model DiscountCode {
  id               String       @id @default(cuid())
  code             String       @unique
  description      String?
  type             DiscountType
  percentBp        Int?         // 1500 = 15 %
  amountCents      Int?

  minSubtotalCents Int?
  startsAt         DateTime?
  endsAt           DateTime?
  maxUses          Int?
  usedCount        Int          @default(0)
  maxUsesPerUser   Int?
  isActive         Boolean      @default(true)

  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@map("discount_codes")
}

// ============================================================
// LIVRAISON
// ============================================================

model ShippingZone {
  id        String         @id @default(cuid())
  name      String
  countries String[]       // ["FR"], ["FR","BE","LU"]…
  isActive  Boolean        @default(true)

  rates     ShippingRate[]

  @@map("shipping_zones")
}

model ShippingRate {
  id             String       @id @default(cuid())
  zoneId         String
  name           String       // « Colissimo domicile », « Mondial Relay »
  carrier        String
  isRelayPoint   Boolean      @default(false)
  priceCents     Int
  minWeightGrams Int          @default(0)
  maxWeightGrams Int?
  freeAboveCents Int?         // franco de port (le fameux 50 €)
  estimatedDays  String?      // « 2 à 4 jours ouvrés »
  isActive       Boolean      @default(true)
  position       Int          @default(0)

  zone           ShippingZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  @@index([zoneId])
  @@map("shipping_rates")
}

// ============================================================
// ENGAGEMENT CLIENT
// ============================================================

model Review {
  id                String           @id @default(cuid())
  productId         String
  userId            String?
  authorName        String
  rating            Int              // 1 à 5
  title             String?
  content           String           @db.Text
  status            ModerationStatus @default(PENDING)
  verifiedPurchase  Boolean          @default(false)
  adminReply        String?          @db.Text

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  product           Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  user              User?            @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([productId, status])
  @@map("reviews")
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  productId String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@map("wishlist_items")
}

/// « Prévenez-moi quand ce produit est de nouveau disponible »
model BackInStockRequest {
  id         String    @id @default(cuid())
  variantId  String
  email      String
  userId     String?
  notifiedAt DateTime?
  createdAt  DateTime  @default(now())

  variant    ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([variantId, email])
  @@map("back_in_stock_requests")
}

model NewsletterSubscriber {
  id             String    @id @default(cuid())
  email          String    @unique
  consentAt      DateTime  @default(now())  // preuve RGPD
  confirmedAt    DateTime?                  // double opt-in
  unsubscribedAt DateTime?
  source         String?                    // « footer », « checkout »…
  token          String    @unique

  @@map("newsletter_subscribers")
}

// ============================================================
// BLOG
// ============================================================

model Post {
  id              String       @id @default(cuid())
  authorId        String?
  title           String
  slug            String       @unique
  excerpt         String?      @db.Text
  content         String       @db.Text
  coverImageUrl   String?
  status          PostStatus   @default(DRAFT)
  publishedAt     DateTime?

  metaTitle       String?
  metaDescription String?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  author          User?        @relation(fields: [authorId], references: [id], onDelete: SetNull)
  categories      PostCategory[] @relation("PostToCategory")
  tags            PostTag[]      @relation("PostToTag")

  @@index([status, publishedAt])
  @@map("posts")
}

model PostCategory {
  id    String @id @default(cuid())
  name  String
  slug  String @unique
  posts Post[] @relation("PostToCategory")

  @@map("post_categories")
}

model PostTag {
  id    String @id @default(cuid())
  name  String
  slug  String @unique
  posts Post[] @relation("PostToTag")

  @@map("post_tags")
}

// ============================================================
// EXPLOITATION
// ============================================================

/// Réglages modifiables sans redéploiement : régime TVA, franco de port,
/// bandeau d'annonce, message de vacances, seuil de commande minimum.
model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt

  @@map("settings")
}

/// Traçabilité des actions du personnel (multi-utilisateurs, rôles distincts).
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String   // "order.status_changed", "product.archived"…
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

---

## Ce que ce schéma ne couvre pas (assumé)

| Fonctionnalité | Raison |
|---|---|
| **Ichiban Kuji** | Loterie = lots, tickets, tirage vérifiable, traçabilité, contraintes légales sur les jeux payants. Projet à part entière, à modéliser séparément. |
| **Box surprise** | Modélisées comme des produits normaux au démarrage. Si le contenu doit être composé et suivi à l'unité, il faudra un modèle dédié. À clarifier avec ton ami. |
| **Espace revendeur** | Implique tarifs B2B, TVA intracommunautaire, factures pro. Hors périmètre initial. |
| **Export comptable** | Générable depuis `Order` + `Payment` sans modèle supplémentaire. |
| **Retours / SAV** | Un modèle `ReturnRequest` sera nécessaire, mais seulement quand le flux métier sera défini. |

---

## Points à confirmer avec ton ami

1. **Achat invité autorisé ?** Le schéma le permet. Si compte obligatoire, on simplifie.
2. **Franco de port à 50 €** — confirmé ? Et sur quel montant : avant ou après remise ?
3. **Seuil de commande minimum** — le doc pose la question sans y répondre.
4. **Transporteurs** — Colissimo seul, ou Mondial Relay aussi (points relais) ?
5. **Neuf/occasion** — un même article vendu dans les deux états : deux fiches produit distinctes (choix actuel) ou une seule avec bascule ?
6. **Modération des avis** — a priori (défaut retenu) ou a posteriori ?

---

## Prochaines étapes

1. Validation de ce document.
2. Réécriture de `schema.prisma`, `prisma migrate reset` (base vide, sans risque).
3. Seed : catégories de l'arborescence, zones et tarifs de livraison, réglages, compte admin.
4. Rapatriement d'Express dans Next.js + couche `server/services/`.
5. Socle : catalogue, fiche produit, panier, checkout Stripe.
6. Back-office admin.
