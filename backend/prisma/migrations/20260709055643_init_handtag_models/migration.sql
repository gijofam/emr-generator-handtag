-- CreateEnum
CREATE TYPE "public"."BatchStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."CodeStatus" AS ENUM ('GENERATED', 'PRINTED', 'USED', 'VOID');

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."handtag_batches" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "public"."BatchStatus" NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "handtag_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."handtag_codes" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "qrUrl" TEXT NOT NULL,
    "status" "public"."CodeStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handtag_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "public"."products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_prefix_key" ON "public"."products"("prefix");

-- CreateIndex
CREATE INDEX "handtag_batches_productId_status_idx" ON "public"."handtag_batches"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "handtag_codes_code_key" ON "public"."handtag_codes"("code");

-- CreateIndex
CREATE INDEX "handtag_codes_productId_status_idx" ON "public"."handtag_codes"("productId", "status");

-- CreateIndex
CREATE INDEX "handtag_codes_batchId_idx" ON "public"."handtag_codes"("batchId");

-- AddForeignKey
ALTER TABLE "public"."handtag_batches" ADD CONSTRAINT "handtag_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."handtag_codes" ADD CONSTRAINT "handtag_codes_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."handtag_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."handtag_codes" ADD CONSTRAINT "handtag_codes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
