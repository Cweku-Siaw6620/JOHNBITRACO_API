const { z } = require("zod");

const pinSchema = z.string().regex(/^\d{5}$/, {
  message: "PIN must contain exactly 5 digits",
});

const loginSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("admin"),
    loginId: z.string().trim().min(1),
    password: z.string().min(1),
  }).strict(),

  z.object({
    role: z.literal("assistant"),
    loginId: z.string().trim().min(1),
    pin: pinSchema,
  }).strict(),

  z.object({
    role: z.literal("employee"),
    pin: pinSchema,
  }).strict(),
]);

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),

  role: z.enum(["assistant", "employee"]),

  loginId: z.string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),

  branch: z.string().regex(/^[a-fA-F0-9]{24}$/),

  pin: pinSchema,
}).strict().superRefine((data, ctx) => {
  if (data.role === "assistant" && !data.loginId) {
    ctx.addIssue({
      code: "custom",
      path: ["loginId"],
      message: "Assistant must have a Staff ID",
    });
  }

  if (data.role === "employee" && data.loginId) {
    ctx.addIssue({
      code: "custom",
      path: ["loginId"],
      message: "Employee accounts use PIN-only login",
    });
  }
});

const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  branch: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  isActive: z.boolean().optional(),
}).strict();

const resetPinSchema = z.object({
  pin: pinSchema,
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),

  newPassword: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number")
    .regex(/[^a-zA-Z0-9]/, "Include a symbol"),
}).strict();

module.exports = {
  loginSchema,
  createStaffSchema,
  updateStaffSchema,
  resetPinSchema,
  changePasswordSchema,
};