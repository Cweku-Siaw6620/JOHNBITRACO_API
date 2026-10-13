
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  createVariant,
  getVariants,
  updateVariant,
} = require("../controllers/productController");

const router = express.Router();

// Every product route requires authentication.
router.use(authenticate);

// Product catalog: available to authenticated users.
router.get(
  "/",
  authorize("admin", "assistant", "employee"),
  getProducts
);

// Important: specific routes before /:id.
router.patch(
  "/variants/:id",
  authorize("admin"),
  updateVariant
);

router.get(
  "/:id/variants",
  authorize("admin", "assistant", "employee"),
  getVariants
);

router.post(
  "/:id/variants",
  authorize("admin"),
  createVariant
);

router.get(
  "/:id",
  authorize("admin", "assistant", "employee"),
  getProductById
);

router.post(
  "/",
  authorize("admin"),
  createProduct
);

router.patch(
  "/:id",
  authorize("admin"),
  updateProduct
);

module.exports = router;
