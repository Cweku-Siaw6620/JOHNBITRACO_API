const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const { getDashboard } = require("./dashboardService");
const { dateBounds } = require("../utils/reportFormat");

const MAX_ROWS = 5000;

async function getFinancialReportData({ branchId, startDate, endDate }) {
  const { start, endExclusive } = dateBounds(startDate, endDate);
  const dashboard = await getDashboard({ branchId, start, endExclusive });

  const branch = branchId
    ? { branch: new mongoose.Types.ObjectId(branchId) }
    : {};

  const saleFilter = { ...branch };
  const expenseFilter = { ...branch, status: "posted" };

  if (start || endExclusive) {
    saleFilter.soldAt = {
      ...(start && { $gte: start }),
      ...(endExclusive && { $lt: endExclusive }),
    };
    expenseFilter.expenseDate = {
      ...(start && { $gte: start }),
      ...(endExclusive && { $lt: endExclusive }),
    };
  }

  const [saleCount, expenseCount] = await Promise.all([
    Sale.countDocuments(saleFilter),
    Expense.countDocuments(expenseFilter),
  ]);

  if (saleCount > MAX_ROWS || expenseCount > MAX_ROWS) {
    const error = new Error(
      `Export exceeds ${MAX_ROWS} records in a detail sheet. Narrow the date range.`
    );
    error.status = 422;
    throw error;
  }

  const [sales, expenses] = await Promise.all([
    Sale.find(saleFilter)
      .select("soldAt branch customer total subtotal discount amountPaid balanceDue paymentStatus costOfGoodsSold grossProfit requestKey")
      .populate("branch", "name code")
      .populate("customer", "name")
      .sort({ soldAt: -1 })
      .lean(),
    Expense.find(expenseFilter)
      .select("expenseDate branch category description amount paymentMethod paymentReference")
      .populate("branch", "name code")
      .sort({ expenseDate: -1 })
      .lean(),
  ]);

  return { dashboard, sales, expenses, generatedAt: new Date() };
}

module.exports = { getFinancialReportData };
