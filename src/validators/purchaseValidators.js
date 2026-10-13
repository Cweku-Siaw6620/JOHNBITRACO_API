
const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const money = z.number()
  .int()
  .safe()
  .nonnegative();

const purchaseItemSchema = z.object({
  variantId: objectId,

  quantity: z.number()
    .int()
    .safe()
    .positive(),

  unitCost: money,
}).strict();

const initialPaymentSchema = z.object({
  amount: money,

  method: z.enum([
    "cash",
    "momo",
    "bank",
  ]).optional(),

  reference: z.string()
    .trim()
    .max(150)
    .optional(),
}).strict().superRefine((data, ctx) => {
  if (data.amount > 0 && !data.method) {
    ctx.addIssue({
      code: "custom",
      path: ["method"],
      message: "Payment method is required",
    });
  }
});

const createPurchaseSchema = z.object({
  supplierId: objectId,

  branchId: objectId,

  requestKey: z.uuid(),

  items: z.array(purchaseItemSchema)
    .min(1)
    .max(100),

  initialPayment: initialPaymentSchema
    .optional(),

  supplierInvoiceNumber: z.string()
    .trim()
    .max(100)
    .optional(),

  notes: z.string()
    .trim()
    .max(1000)
    .optional(),
}).strict().superRefine((data, ctx) => {
  const ids = data.items.map(
    item => item.variantId.toLowerCase()
  );

  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: "Duplicate product variants are not allowed",
    });
  }

  const total = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  if (!Number.isSafeInteger(total)) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: "Purchase total exceeds safe limit",
    });
  }

  if ((data.initialPayment?.amount ?? 0) > total) {
    ctx.addIssue({
      code: "custom",
      path: ["initialPayment", "amount"],
      message: "Payment exceeds purchase total",
    });
  }
});

module.exports = {
  createPurchaseSchema,
};
