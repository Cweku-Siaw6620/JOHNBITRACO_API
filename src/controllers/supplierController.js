
const Supplier = require("../models/Supplier");

const { z } = require("zod");

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(25).optional(),
  alternatePhone: z.string().trim().max(25).optional(),
  email: z.union([
    z.email(),
    z.literal(""),
  ]).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const createSupplier = async (req, res, next) => {
  try {
    const parsed = supplierSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier information",
        errors: parsed.error.issues,
      });
    }

    const supplier = await Supplier.create({
      ...parsed.data,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier,
    });
  } catch (error) {
    next(error);
  }
};

const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({
      isActive: true,
    })
      .sort({ name: 1 })
      .limit(500)
      .lean();

    return res.json({
      success: true,
      count: suppliers.length,
      suppliers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
};
