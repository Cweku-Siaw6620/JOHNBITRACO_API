
const mongoose = require("mongoose");
const { z } = require("zod");

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

const {
  productSchema,
} = require("../validators/inventoryValidators");

// Client-facing product registration includes prices, but not SKU, size or color.
// Amounts are integer pesewas, as required by the existing pricing system.
const productWithPricesSchema = productSchema.extend({
  retailPrice: z.number().int().nonnegative().safe(),
  wholesalePrice: z.number().int().nonnegative().safe(),
  referenceCost: z.number().int().nonnegative().safe().optional(),
});

const objectIdValid = (id) => mongoose.isValidObjectId(id);

const sendValidationError = (res, error) => {
  return res.status(400).json({
    success: false,
    message: "Invalid product information",
    errors: error.issues,
  });
};

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const {
      search = "",
      category,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (
      !Number.isSafeInteger(pageNum) ||
      pageNum < 1 ||
      !Number.isSafeInteger(limitNum) ||
      limitNum < 1 ||
      limitNum > 100 ||
      typeof search !== "string" ||
      search.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid search or pagination",
      });
    }

    const filter = { isActive: true };

    if (category) {
      if (
        !["Executive", "Loafers", "Boots", "Other"]
          .includes(category)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
        });
      }

      filter.category = category;
    }

    if (search.trim()) {
      const escaped = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { brand: { $regex: escaped, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    if (!objectIdValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products
// Register one shoe design and exactly one internal stock item atomically.
const createProduct = async (req, res, next) => {
  const parsed = productWithPricesSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const {
    retailPrice,
    wholesalePrice,
    referenceCost = 0,
    ...productFields
  } = parsed.data;

  const session = await mongoose.startSession();

  try {
    let createdProduct;
    let createdVariant;

    await session.withTransaction(async () => {
      // In the simplified catalog, a design is identified by brand + name.
      // Reject duplicates even if the capitalization differs.
      const exact = (value) =>
        `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

      const duplicate = await Product.findOne({
        isActive: true,
        name: { $regex: exact(productFields.name), $options: "i" },
        brand: { $regex: exact(productFields.brand || ""), $options: "i" },
      }).session(session);

      if (duplicate) {
        const error = new Error(
          "This brand and shoe name already exist. Update the existing product instead."
        );
        error.status = 409;
        throw error;
      }

      const [product] = await Product.create(
        [{ ...productFields, createdBy: req.user._id }],
        { session }
      );

      // SKU, size and color remain internal only, to preserve compatibility
      // with BranchStock, saleService and stock movement records.
      const [variant] = await ProductVariant.create(
        [{
          product: product._id,
          sku: `JB-${product._id.toString().toUpperCase()}`,
          size: "ONE",
          color: "standard",
          retailPrice,
          wholesalePrice,
          referenceCost,
        }],
        { session }
      );

      createdProduct = product;
      createdVariant = variant;
    });

    return res.status(201).json({
      success: true,
      message: "Product and stock item created successfully",
      product: createdProduct,
      variant: createdVariant,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// PATCH /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    if (!objectIdValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const parsed = productSchema
      .partial()
      .extend({
        isActive: require("zod").z.boolean().optional(),
      })
      .safeParse(req.body);

    if (
      !parsed.success ||
      Object.keys(parsed.data || {}).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid update information",
        ...(!parsed.success && {
          errors: parsed.error.issues,
        }),
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products/:id/variants
// Kept as a guarded legacy route; extra variants are no longer permitted.
const createVariant = async (req, res) => {
  return res.status(409).json({
    success: false,
    message: "Additional variants are disabled. Each shoe now has one stock item.",
  });
};

// GET /api/products/:id/variants
const getVariants = async (req, res, next) => {
  try {
    if (!objectIdValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variants = await ProductVariant.find({
      product: product._id,
      isActive: true,
    })
      .sort({ size: 1, color: 1 })
      .lean();

    return res.json({
      success: true,
      count: variants.length,
      variants,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/variants/:id
const updateVariant = async (req, res, next) => {
  try {
    if (!objectIdValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    // Internal identifiers remain immutable to protect stock and sale history.

    const schema = z.object({
      retailPrice: z.number().int().nonnegative().safe()
        .optional(),
      wholesalePrice: z.number().int().nonnegative().safe()
        .optional(),
      referenceCost: z.number().int().nonnegative().safe()
        .optional(),
      isActive: z.boolean().optional(),
    }).strict();

    const parsed = schema.safeParse(req.body);

    if (
      !parsed.success ||
      Object.keys(parsed.data || {}).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant update",
        ...(!parsed.success && {
          errors: parsed.error.issues,
        }),
      });
    }

    const variant = await ProductVariant.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.json({
      success: true,
      message: "Variant updated successfully",
      variant,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  createVariant,
  getVariants,
  updateVariant,
};
