const express = require("express");
const authenticate = require("../middlewares/authenticate");
const { authorize } = require("../middlewares/authorize");
const {
  receipt,
  financialPdfReport,
  financialExcelReport,
} = require("../controllers/reportController");

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin", "assistant"));

router.get("/sales/:id/receipt.pdf", receipt);
router.get("/financial.pdf", financialPdfReport);
router.get("/financial.xlsx", financialExcelReport);

module.exports = router;
