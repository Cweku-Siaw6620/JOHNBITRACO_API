
const Customer = require("../models/Customer");
const { z } = require("zod");

const customerSchema = z.object({
  name: z.string().trim().min(2).max(150),

  phone: z.string().trim().max(25).optional(),

  alternatePhone: z.string()
    .trim()
    .max(25)
    .optional(),

  address: z.string()
    .trim()
    .max(300)
    .optional(),

  notes: z.string()
    .trim()
    .max(1000)
    .optional(),
}).strict();

const createCustomer = async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer information",
        errors: parsed.error.issues,
      });
    }

    const customer = await Customer.create({
      ...parsed.data,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    next(error);
  }
};

const getCustomers = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination",
      });
    }

    const filter = { isActive: true };

    if (req.query.search) {
      const raw = String(req.query.search);

      if (raw.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Search is too long",
        });
      }

      const escaped = raw.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Customer.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      customers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
};
