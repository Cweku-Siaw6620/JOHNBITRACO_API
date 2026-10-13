
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  createExpense,
  getExpenses,
  reverseExpense,
} = require("../controllers/expenseController");

const router = express.Router();

router.use(authenticate);

// Admin can see all branches.
// Assistant sees assigned Main Branch expenses.
router.get(
  "/",
  authorize("admin", "assistant"),
  getExpenses
);

// Admin and Assistant can record authorized expenses.
router.post(
  "/",
  authorize("admin", "assistant"),
  createExpense
);

// Financial reversals require Admin approval.
router.patch(
  "/:id/reverse",
  authorize("admin"),
  reverseExpense
);

module.exports = router;
