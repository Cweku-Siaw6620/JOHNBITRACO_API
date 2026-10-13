const mongoose = require("mongoose");
const { dashboardQuerySchema } = require("../validators/dashboardValidators");
const Sale = require("../models/Sale");
const CustomerPayment = require("../models/CustomerPayment");
const { getFinancialReportData } = require("../services/reportDataService");
const { receiptPdf, financialPdf } = require("../services/pdfReportService");
const { financialExcel } = require("../services/excelReportService");
const { getBranchId } = require("../utils/reportFormat");

async function receipt(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }

    // Resolve the allowed branch before accessing customer financial details.
    const sale = await Sale.findById(req.params.id)
      .populate("branch", "name code")
      .populate("customer", "name phone")
      .lean();

    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    getBranchId(req, String(sale.branch?._id || sale.branch));

    const payments = await CustomerPayment.find({ sale: sale._id })
      .select("amount method reference paidAt")
      .sort({ paidAt: 1 })
      .lean();

    receiptPdf(res, sale, payments);
  } catch (error) {
    next(error);
  }
}

async function report(req, res, next, kind) {
  try {
    const parsed = dashboardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid report filters",
        errors: parsed.error.issues,
      });
    }

    const { startDate, endDate, branchId } = parsed.data;
    const effectiveBranch = getBranchId(req, branchId);
    const data = await getFinancialReportData({
      branchId: effectiveBranch,
      startDate,
      endDate,
    });

    if (kind === "pdf") return financialPdf(res, data);
    return await financialExcel(res, data);
  } catch (error) {
    if (res.headersSent) return next(error);
    next(error);
  }
}

const financialPdfReport = (req, res, next) => report(req, res, next, "pdf");
const financialExcelReport = (req, res, next) => report(req, res, next, "xlsx");

module.exports = { receipt, financialPdfReport, financialExcelReport };
