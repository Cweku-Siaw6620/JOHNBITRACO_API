
const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const money = z.number()
  .int()
  .nonnegative()
  .safe();

const quantity = z.number()
  .int()
  .nonnegative()
  .safe();

// =======================================
// PRODUCT VALIDATION
// =======================================

const productSchema = z.object({
  name: z.string()
    .trim()
    .min(2)
    .max(150),

  brand: z.string()
    .trim()
    .max(100)
    .optional(),

  category: z.enum([
    "Executive",
    "Loafers",
    "Boots",
    "Other",
  ]),

  description: z.string()
    .trim()
    .max(2000)
    .optional(),

  imageUrl: z.union([
    z.url().refine(
      value => value.startsWith("https://"),
      "HTTPS URL required"
    ),
    z.literal(""),
  ]).optional(),
}).strict();

// =======================================
// PRODUCT VARIANT VALIDATION
// =======================================

const variantSchema = z.object({
  sku: z.string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-zA-Z0-9_-]+$/),

  size: z.string()
    .trim()
    .min(1)
    .max(20),

  color: z.string()
    .trim()
    .min(2)
    .max(50),

  retailPrice: money,

  wholesalePrice: money,

  referenceCost: money.optional(),
}).strict().transform(data => ({
  ...data,
  sku: data.sku.toUpperCase(),
  color: data.color.toLowerCase(),
}));

// =======================================
// OPENING STOCK VALIDATION
// =======================================

const openingStockSchema = z.object({
  branchId: objectId,

  variantId: objectId,

  quantity: quantity.refine(
    value => value > 0,
    "Quantity must be greater than zero"
  ),

  // Actual cost per pair in pesewas.
  // Required for accurate inventory valuation.
  unitCost: money,

  lowStockThreshold: quantity.optional(),

  reason: z.string()
    .trim()
    .min(3)
    .max(500),
}).strict();

// =======================================
// STOCK ADJUSTMENT VALIDATION
// =======================================

const adjustmentSchema = z.object({
  branchId: objectId,

  variantId: objectId,

  quantityChange: z.number()
    .int()
    .safe()
    .refine(
      value => value !== 0,
      "Quantity change cannot be zero"
    ),

  // Required only when adding stock.
  // Must be omitted when removing stock.
  unitCost: money.optional(),

  reason: z.string()
    .trim()
    .min(5)
    .max(500),
}).strict().superRefine((data, ctx) => {
  // Adding stock requires a known cost.
  if (
    data.quantityChange > 0 &&
    data.unitCost === undefined
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["unitCost"],
      message:
        "Unit cost is required when adding stock",
    });
  }

  // Removing stock uses its existing
  // weighted-average cost.
  if (
    data.quantityChange < 0 &&
    data.unitCost !== undefined
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["unitCost"],
      message:
        "Do not provide unit cost when removing stock",
    });
  }
});

// =======================================
// INVENTORY QUERY VALIDATION
// =======================================

const inventoryQuerySchema = z.object({
  branchId: objectId.optional(),

  search: z.string()
    .trim()
    .max(100)
    .optional(),

  category: z.enum([
    "Executive",
    "Loafers",
    "Boots",
    "Other",
  ]).optional(),

  lowStock: z.enum([
    "true",
    "false",
  ]).optional(),

  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
}).strict();

// =======================================
// EXPORT VALIDATORS
// =======================================

module.exports = {
  productSchema,
  variantSchema,
  openingStockSchema,
  adjustmentSchema,
  inventoryQuerySchema,
};
