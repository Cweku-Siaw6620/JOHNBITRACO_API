
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  create,
  getAll,
} = require("../controllers/purchaseController");

const {
  createRepayment,
  getPurchasePayments,
  getSupplierDebts,
} = require("../controllers/supplierPaymentController");

const router = express.Router();

router.use(authenticate);

router.use(authorize("admin", "assistant"));

// Purchase management
router.get("/", getAll);

router.post("/", create);

// Supplier debt reports
// Keep this route before dynamic /:id routes.
router.get("/debts", getSupplierDebts);

// Record payment against a purchase
router.post("/:id/payments", createRepayment);

// Retrieve payments for one purchase
router.get("/:id/payments", getPurchasePayments);

module.exports = router;
