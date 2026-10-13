
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  createSupplier,
  getSuppliers,
} = require("../controllers/supplierController");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("admin", "assistant"),
  getSuppliers
);

router.post(
  "/",
  authorize("admin"),
  createSupplier
);

module.exports = router;
