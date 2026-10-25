
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  createOpeningStock,
  createAdjustment,
  getInventory,
  getStockMovements,
} = require("../controllers/inventoryController");

const router = express.Router();

// All inventory routes require authentication.
router.use(authenticate);

// Read inventory within assigned branch permissions.
router.get(
  "/",
  authorize("admin", "assistant", "employee"),
  getInventory
);

// Read inventory movement history.
// Employees have read-only inventory access,
// but not detailed adjustment/audit information.
router.get(
  "/movements",
  authorize("admin", "assistant"),
  getStockMovements
);

// Only Admin initializes opening stock.
router.post(
  "/opening-stock",
  authorize("admin"),
  createOpeningStock
);

// Admin and Assistant can adjust permitted stock.
router.post(
  "/adjustments",
  authorize("admin"),
  createAdjustment
);

module.exports = router;
