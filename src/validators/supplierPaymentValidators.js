
const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const repaymentSchema = z.object({
  requestKey: z.uuid(),

  amount: z.number()
    .int()
    .safe()
    .positive(),

  method: z.enum([
    "cash",
    "momo",
    "bank",
  ]),

  reference: z.string()
    .trim()
    .max(150)
    .optional(),

  notes: z.string()
    .trim()
    .max(500)
    .optional(),
}).strict();

const debtQuerySchema = z.object({
  branchId: objectId.optional(),
  supplierId: objectId.optional(),

  status: z.enum([
    "unpaid",
    "partial",
    "paid",
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

module.exports = {
  repaymentSchema,
  debtQuerySchema,
};
