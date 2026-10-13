
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  create,
  getSales,
  getDebts,
  getSalePayments,
  addPayment,
} = require("../controllers/saleController");

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin", "assistant"));

router.get("/", getSales);
router.post("/", create);

// Specific routes before parameterized routes.
router.get("/debts", getDebts);

router.get("/:id/payments", getSalePayments);
router.post("/:id/payments", addPayment);

module.exports = router;
