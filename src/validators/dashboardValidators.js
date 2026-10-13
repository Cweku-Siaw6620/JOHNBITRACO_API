const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid branch ID");

const dashboardQuerySchema = z.object({
  branchId: objectId.optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must not precede start date",
    });
  }
});

module.exports = { dashboardQuerySchema };
