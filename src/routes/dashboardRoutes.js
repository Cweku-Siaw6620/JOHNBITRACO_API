const express = require("express");
const authenticate = require("../middlewares/authenticate");
const { authorize } = require("../middlewares/authorize");
const {
  getFinancialDashboard,
} = require("../controllers/dashboardController");

const router = express.Router();

router.use(authenticate);
router.get("/financial", authorize("admin", "assistant"), getFinancialDashboard);

module.exports = router;
