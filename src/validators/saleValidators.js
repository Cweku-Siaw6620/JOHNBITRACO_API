
const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const money = z.number()
  .int()
  .safe()
  .nonnegative();

const saleItemSchema = z.object({
  variantId: objectId,

  quantity: z.number()
    .int()
    .safe()
    .positive(),

  priceType: z.enum(["retail", "wholesale"]),
}).strict();

const paymentSchema = z.object({
  amount: money,

  method: z.enum(["cash", "momo", "bank"])
    .optional(),

  reference: z.string()
    .trim()
    .max(150)
    .optional(),
}).strict().superRefine((data, ctx) => {
  if (data.amount > 0 && !data.method) {
    ctx.addIssue({
      code: "custom",
      path: ["method"],
      message: "Payment method required",
    });
  }
});

const createSaleSchema = z.object({
  branchId: objectId,

  customerId: objectId.nullable().optional(),

  requestKey: z.uuid(),

  items: z.array(saleItemSchema)
    .min(1)
    .max(100),

  discount: money.default(0),

  initialPayment: paymentSchema.optional(),

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
      message: "Duplicate variants are not allowed",
    });
  }
});

const repaymentSchema = z.object({
  requestKey: z.uuid(),

  amount: money.refine(
    value => value > 0,
    "Payment must be greater than zero"
  ),

  method: z.enum(["cash", "momo", "bank"]),

  reference: z.string()
    .trim()
    .max(150)
    .optional(),
}).strict();

module.exports = {
  createSaleSchema,
  repaymentSchema,
};
