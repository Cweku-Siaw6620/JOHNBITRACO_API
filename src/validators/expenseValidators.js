
const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const expenseCategories = [
  "rent",
  "electricity",
  "water",
  "salaries",
  "transport",
  "packaging",
  "repairs",
  "internet",
  "marketing",
  "utilities",
  "other",
];

const createExpenseSchema = z.object({
  branchId: objectId,

  category: z.enum(expenseCategories),

  description: z.string()
    .trim()
    .min(3)
    .max(500),

  amount: z.number()
    .int()
    .safe()
    .positive(),

  paymentMethod: z.enum([
    "cash",
    "momo",
    "bank",
  ]),

  paymentReference: z.string()
    .trim()
    .max(150)
    .optional(),

  expenseDate: z.iso.date(),

  requestKey: z.uuid(),
}).strict();

const reverseExpenseSchema = z.object({
  reason: z.string()
    .trim()
    .min(5)
    .max(500),
}).strict();

const expenseQuerySchema = z.object({
  branchId: objectId.optional(),

  category: z.enum(expenseCategories)
    .optional(),

  status: z.enum([
    "posted",
    "reversed",
    "all",
  ]).default("posted"),

  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),

  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
}).strict().refine(
  data =>
    !data.startDate ||
    !data.endDate ||
    data.startDate <= data.endDate,
  {
    message: "Start date cannot exceed end date",
    path: ["endDate"],
  }
);

module.exports = {
  createExpenseSchema,
  reverseExpenseSchema,
  expenseQuerySchema,
};
