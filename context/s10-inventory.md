# FitTrack — S10 — Inventory
_Always include `00-global-contracts.md` alongside this file._

---

# S10 — Inventory

## Overview
Two independent sub-domains under one module:
- **RetailProducts** — gym supplements and accessories sold at the counter. Staff-initiated POS. Cash or PayMongo QR payment. Admin/staff-only sales history.
- **EquipmentTracking** — gym equipment quantity management (dumbbells, kettlebells, etc.). Count-only tracking. No sales. Write-offs reduce quantity via set-to value. Admin alert on write-off.

## Prisma Schema

```prisma
// ─── RETAIL PRODUCTS ─────────────────────────────────────────────────────────

model RetailProduct {
  id                    String   @id @default(uuid()) @db.Uuid
  name                  String   @db.VarChar(255)
  description           String?
  price                 Decimal  @db.Decimal(10,2)
  stock_quantity        Int      @default(0)
  reorder_threshold     Int      @default(10)
  last_low_stock_alert_at DateTime? @db.Timestamptz(6)  // DB-based dedup; no Redis needed
  image_url             String?  @db.VarChar(500)
  is_active             Boolean  @default(true)
  created_at            DateTime @default(now()) @db.Timestamptz(6)
  updated_at            DateTime @updatedAt @db.Timestamptz(6)

  sale_items    SaleTransactionItem[]

  @@index([is_active])
  @@index([stock_quantity])
  @@map("retail_products")
}

model SaleTransaction {
  id              String            @id @default(uuid()) @db.Uuid
  customer_name   String?           @db.VarChar(255)  // optional for walk-ins
  customer_user_id String?          @db.Uuid          // required when using shared PayMongo checkout ownership
  total_amount    Decimal           @db.Decimal(10,2)
  payment_method  SalePaymentMethod
  payment_id      String?           @db.Uuid  // FK to payments if paymongo
  processed_by    String            @db.Uuid  // staff who made the sale
  status          SaleStatus        @default(pending)
  created_at      DateTime          @default(now()) @db.Timestamptz(6)
  updated_at      DateTime          @updatedAt @db.Timestamptz(6)

  items           SaleTransactionItem[]
  staff           User              @relation("processed_by", fields: [processed_by], references: [id])

  @@index([created_at(sort: Desc)])
  @@index([status])
  @@map("sale_transactions")
}

enum SalePaymentMethod { cash paymongo }
enum SaleStatus { pending completed cancelled }

model SaleTransactionItem {
  id             String   @id @default(uuid()) @db.Uuid
  transaction_id String   @db.Uuid
  product_id     String   @db.Uuid
  quantity       Int
  unit_price     Decimal  @db.Decimal(10,2)  // price snapshot at time of sale
  subtotal       Decimal  @db.Decimal(10,2)
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  transaction    SaleTransaction @relation(fields: [transaction_id], references: [id], onDelete: Cascade)
  product        RetailProduct   @relation(fields: [product_id], references: [id])

  @@index([transaction_id])
  @@index([product_id])
  @@map("sale_transaction_items")
}

// ─── EQUIPMENT TRACKING ──────────────────────────────────────────────────────

model GymEquipmentItem {
  id               String   @id @default(uuid()) @db.Uuid
  name             String   @db.VarChar(255)
  description      String?
  quantity_total   Int      // original total count
  quantity_current Int      // current count; updated on write-off
  unit             String   @default("units") @db.VarChar(50)  // "pairs", "units", "sets"
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  write_offs       EquipmentWriteOff[]

  @@index([is_active])
  @@map("gym_equipment_items")
}

model EquipmentWriteOff {
  id                String   @id @default(uuid()) @db.Uuid
  equipment_id      String   @db.Uuid
  quantity_before   Int      // snapshot before this write-off
  quantity_set_to   Int      // new value set by staff
  quantity_lost     Int      // computed: quantity_before - quantity_set_to
  reason            String   // free text — frontend shows dropdown as UX shortcut
  performed_by      String   @db.Uuid
  created_at        DateTime @default(now()) @db.Timestamptz(6)
  updated_at        DateTime @updatedAt @db.Timestamptz(6)

  equipment    GymEquipmentItem @relation(fields: [equipment_id], references: [id])
  performer    User             @relation(fields: [performed_by], references: [id])

  @@index([equipment_id, created_at(sort: Desc)])
  @@map("equipment_write_offs")
}
```

## DTOs

```typescript
// ─── RETAIL PRODUCTS ─────────────────────────────────────────────────────────

class CreateRetailProductDTO {
  name: string               // @IsString() @IsNotEmpty() @MaxLength(255)
  description?: string       // @IsOptional()
  price: number              // @IsPositive()
  stock_quantity?: number    // @IsOptional() @IsInt() @Min(0)
  reorder_threshold?: number // @IsOptional() @IsInt() @Min(0)
  image_url?: string         // @IsOptional() @IsUrl()
}

class UpdateRetailProductDTO {
  name?: string
  description?: string
  price?: number             // @IsOptional() @IsPositive()
  reorder_threshold?: number // @IsOptional() @IsInt() @Min(0)
  image_url?: string
  is_active?: boolean
}

class RestockProductDTO {
  quantity: number           // @IsInt() @Min(1)
  notes?: string             // @IsOptional() @MaxLength(500)
}

class CreateSaleDTO {
  customer_name?: string     // @IsOptional() @IsString() @MaxLength(255)
  customer_user_id?: string  // @IsOptional() @IsUUID()
  payment_method: SalePaymentMethod  // @IsEnum(SalePaymentMethod)
  items: Array<{
    product_id: string       // @IsUUID()
    quantity: number         // @IsInt() @Min(1)
  }>                         // @IsArray() @ArrayMinSize(1) @ValidateNested()
}

class ProductFilterDTO extends PaginationDTO {
  search?: string            // @IsOptional()
  in_stock_only?: boolean    // @IsOptional() @IsBoolean()
}

// ─── EQUIPMENT TRACKING ──────────────────────────────────────────────────────

class CreateEquipmentItemDTO {
  name: string               // @IsString() @IsNotEmpty() @MaxLength(255)
  description?: string
  quantity_total: number     // @IsInt() @Min(0)
  quantity_current: number   // @IsInt() @Min(0)
  unit?: string              // @IsOptional() @MaxLength(50) default "units"
}

class UpdateEquipmentItemDTO {
  name?: string
  description?: string
  unit?: string
  is_active?: boolean
}

class EquipmentWriteOffDTO {
  quantity_set_to: number    // @IsInt() @Min(0) — the new absolute count
  reason: string             // @IsString() @IsNotEmpty() @MaxLength(1000)
}
```

## API Endpoints

### Retail Products

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/inventory/products | JWT | ProductFilterDTO | List products |
| GET | /v1/inventory/products/:id | JWT | — | Single product |
| POST | /v1/inventory/products | Admin | CreateRetailProductDTO | Add product |
| PATCH | /v1/inventory/products/:id | Admin | UpdateRetailProductDTO | Update or deactivate |
| POST | /v1/inventory/products/:id/restock | Admin/Staff | RestockProductDTO | Add stock |
| POST | /v1/inventory/sales | Staff | CreateSaleDTO | Record a POS sale |
| GET | /v1/inventory/sales | Admin/Staff | DateRangeDTO | All sale transactions |
| GET | /v1/inventory/sales/:id | Admin/Staff | — | Single sale with items |

### Equipment Tracking

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/inventory/equipment | Admin/Staff | PaginationDTO | List gym equipment items |
| GET | /v1/inventory/equipment/:id | Admin/Staff | — | Single item with write-off history |
| POST | /v1/inventory/equipment | Admin | CreateEquipmentItemDTO | Add equipment item |
| PATCH | /v1/inventory/equipment/:id | Admin | UpdateEquipmentItemDTO | Update item details |
| POST | /v1/inventory/equipment/:id/writeoff | Admin/Staff | EquipmentWriteOffDTO | Log quantity write-off |
| GET | /v1/inventory/equipment/:id/writeoffs | Admin/Staff | PaginationDTO | Write-off history for item |

## Process Flows

### Flow 10A — POS Sale (Cash)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Staff | POST /v1/inventory/sales { payment_method: cash, items: [...], customer_name? } | |
| 2 | InventoryService | For each item: SELECT retail_products WHERE id=X FOR UPDATE | Pessimistic lock |
| 3 | InventoryService | Validate stock_quantity >= requested quantity | Throw 422 INSUFFICIENT_STOCK with warning (sale still allowed by design — just warns) |
| 4 | InventoryService | Snapshot unit_price from products.price; compute subtotals + total_amount | |
| 5 | InventoryService | INSERT sale_transactions (status=completed, payment_method=cash) | |
| 6 | InventoryService | INSERT sale_transaction_items | |
| 7 | InventoryService | UPDATE retail_products SET stock_quantity -= qty FOR EACH item | |
| 8 | InventoryService | For each product: if stock_quantity < reorder_threshold AND (last_low_stock_alert_at IS NULL OR now - last_low_stock_alert_at > 24h) | UPDATE last_low_stock_alert_at=now; emit LowStockEvent → admin email |
| 9 | InventoryService | Return 201 sale transaction with items | |

### Flow 10B — POS Sale (PayMongo QR)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Staff | POST /v1/inventory/sales { payment_method: paymongo, items: [...], customer_name? } | |
| 2 | InventoryService | Steps 2–5 same as cash, but INSERT sale_transactions (status=pending, customer_user_id required) | |
| 3 | PaymentsService | POST PayMongo create payment link (amount=total, description="Product Sale") | Returns { checkout_url, provider_ref } |
| 4 | InventoryService | INSERT payments (payable_type=product, payment_stage=full, status=processing, provider_ref) | |
| 5 | InventoryService | Return { sale_id, checkout_url } | Staff shows QR on screen; customer scans on their own phone |
| 6 | Gateway | POST /v1/payments/webhook | payment.paid event |
| 7 | InventoryService | PaymentCompletedEvent handler: UPDATE sale_transactions status=completed | |
| 8 | InventoryService | UPDATE stock_quantity -= qty FOR EACH item | |
| 9 | InventoryService | Check low stock same as Flow 10A step 8 | |

### Flow 10C — Equipment Write-Off

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin/Staff | POST /v1/inventory/equipment/:id/writeoff { quantity_set_to, reason } | |
| 2 | InventoryService | SELECT gym_equipment_items WHERE id=X FOR UPDATE | |
| 3 | InventoryService | Validate quantity_set_to <= quantity_current | Throw 422 if setting to more than current (can't gain equipment via write-off) |
| 4 | InventoryService | INSERT equipment_write_offs { quantity_before=current, quantity_set_to, quantity_lost=before-set_to, reason, performed_by } | |
| 5 | InventoryService | UPDATE gym_equipment_items SET quantity_current=quantity_set_to | |
| 6 | EventEmitter2 | Emit EquipmentWriteOffEvent { equipment_name, quantity_lost, reason, performed_by } | Admin email alert immediately — no dedup |

### Flow 10D — Product Restock

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin/Staff | POST /v1/inventory/products/:id/restock { quantity, notes? } | |
| 2 | InventoryService | UPDATE retail_products SET stock_quantity += quantity | |
| 3 | InventoryService | Return updated product | |

## Service Functions

```typescript
// InventoryService
listProducts(dto: ProductFilterDTO): Promise<PaginatedResult<RetailProduct>>
getProductById(id: string): Promise<RetailProduct>
createProduct(dto: CreateRetailProductDTO): Promise<RetailProduct>
updateProduct(id: string, dto: UpdateRetailProductDTO): Promise<RetailProduct>
restockProduct(id: string, dto: RestockProductDTO): Promise<RetailProduct>
createSale(staffId: string, dto: CreateSaleDTO): Promise<SaleTransaction>
getSales(dto: DateRangeDTO): Promise<PaginatedResult<SaleTransaction>>
getSaleById(id: string): Promise<SaleTransaction>
handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void>
checkAndAlertLowStock(product: RetailProduct): Promise<void>

listEquipmentItems(dto: PaginationDTO): Promise<PaginatedResult<GymEquipmentItem>>
getEquipmentItemById(id: string): Promise<GymEquipmentItem>
createEquipmentItem(dto: CreateEquipmentItemDTO): Promise<GymEquipmentItem>
updateEquipmentItem(id: string, dto: UpdateEquipmentItemDTO): Promise<GymEquipmentItem>
writeOffEquipment(performerId: string, equipmentId: string, dto: EquipmentWriteOffDTO): Promise<EquipmentWriteOff>
getWriteOffHistory(equipmentId: string, dto: PaginationDTO): Promise<PaginatedResult<EquipmentWriteOff>>
```

---
