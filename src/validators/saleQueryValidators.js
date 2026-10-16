const { z } = require("zod");

const objectId = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  "Invalid MongoDB ID"
);

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const salesQuerySchema = z.object({
  branchId: objectId.optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  ...pagination,
}).strict().refine(
  (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
  { path: ["endDate"], message: "End date must not precede start date" }
);

const debtQuerySchema = z.object({
  branchId: objectId.optional(),
  ...pagination,
}).strict();

module.exports = {
  salesQuerySchema,
  debtQuerySchema,
};
