
const mongoose = require("mongoose");

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

const {
  productSchema,
  variantSchema,
} = require("../validators/inventoryValidators");

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
const createProduct = async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const product = await Product.create({
      ...parsed.data,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
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
const createVariant = async (req, res, next) => {
  try {
    if (!objectIdValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const parsed = variantSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Active product not found",
      });
    }

    const variant = await ProductVariant.create({
      ...parsed.data,
      product: product._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      variant,
    });
  } catch (error) {
    next(error);
  }
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

    // SKU, size, and color are immutable once created.
    // This protects stock and historical references.
    const { z } = require("zod");

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
